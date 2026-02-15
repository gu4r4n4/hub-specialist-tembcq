
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { Service, SpecialistPortfolioImage } from '@/types/database';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Keyboard } from 'react-native';
import { decode } from 'base64-arraybuffer';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [myListings, setMyListings] = useState<Service[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [portfolioImages, setPortfolioImages] = useState<SpecialistPortfolioImage[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewType, setPreviewType] = useState<'profile' | 'portfolio'>('profile');

  useEffect(() => {
    console.log('MODALS STATE:', { showPreviewModal, showSignOutModal });
  }, [showPreviewModal, showSignOutModal]);

  const handleSignOut = async () => {
    console.log('User confirmed sign out');
    setShowSignOutModal(false);
    await signOut();
    console.log('User signed out, navigating to home');
    router.replace('/(tabs)/(home)');
  };

  const fetchMyListings = async () => {
    if (!profile) return;

    setLoadingListings(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, category:categories(*)')
        .eq('specialist_profile_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyListings(data || []);
    } catch (err) {
      console.error('Error fetching my listings:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchPortfolioImages = async () => {
    if (!profile || profile.role !== 'specialist') return;

    setLoadingPortfolio(true);
    try {
      const { data, error } = await supabase
        .from('specialist_portfolio_images')
        .select('*')
        .eq('specialist_profile_id', profile.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPortfolioImages(data || []);
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const openGallery = async (type: 'profile' | 'portfolio') => {
    try {
      console.log('[ImagePicker] openGallery pressed', type);

      // Close any potential keyboards that might interfere
      Keyboard.dismiss();

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('[ImagePicker] permission result:', permissionResult);

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library in settings to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : undefined,
        quality: 0.8,
        base64: true,
      });

      console.log('[ImagePicker] result.canceled:', result.canceled);

      if (!result.canceled && result.assets?.[0]) {
        console.log('[ImagePicker] image selected:', result.assets[0].uri.substring(0, 50) + '...');
        setSelectedImage(result.assets[0].uri);
        setSelectedBase64(result.assets[0].base64 || null);
        setPreviewType(type);
        setShowPreviewModal(true);
      }
    } catch (error: any) {
      console.error('[ImagePicker] openGallery error:', error);
      Alert.alert('Error', error?.message || 'Failed to open image gallery');
    }
  };

  const handleSaveImage = async () => {
    if (!selectedImage || !profile || !user) return;

    // Close keyboard and modal first for better UX
    Keyboard.dismiss();
    setShowPreviewModal(false);
    setUploadingImage(true);

    try {
      console.log('Starting upload for:', previewType);

      const fileExt = (selectedImage.split('.').pop() || 'jpg').toLowerCase();
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = previewType === 'profile' ? 'avatars' : 'portfolio';

      console.log('Upload details:', { bucket, fileName, contentType });

      if (!selectedBase64) {
        throw new Error('No base64 data returned from image picker');
      }

      const arrayBuffer = decode(selectedBase64);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase storage upload error detail:', JSON.stringify(uploadError, null, 2));
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (previewType === 'profile') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', profile.id); // More robust mapping to the specific profile record

        if (updateError) {
          console.error('Profile update error detail:', JSON.stringify(updateError, null, 2));
          throw updateError;
        }

        await refreshProfile();
      } else {
        const { error: insertError } = await supabase
          .from('specialist_portfolio_images')
          .insert({
            specialist_profile_id: profile.id,
            image_url: publicUrl,
            sort_order: portfolioImages.length,
          });

        if (insertError) {
          console.error('Portfolio insert error:', insertError);
          throw insertError;
        }

        fetchPortfolioImages();
        await refreshProfile();
      }

      setSelectedImage(null);
      setSelectedBase64(null);
      Alert.alert('Success', `${previewType === 'profile' ? 'Profile picture' : 'Portfolio image'} saved successfully`);
    } catch (error: any) {
      console.error('Error in handleSaveImage:', error);
      let msg = error.message || 'An error occurred during upload.';
      if (msg.includes('bucket not found')) {
        msg = 'Storage bucket not found. Please ensure "avatars" and "portfolio" buckets exist in your Supabase dashboard.';
      }
      Alert.alert('Upload Failed', msg);
      // Re-open modal if it failed so user can try again
      setShowPreviewModal(true);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeletePortfolioImage = async (imageId: string, imageUrl: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to remove this image from your portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Delete from database
              const { error: dbError } = await supabase
                .from('specialist_portfolio_images')
                .delete()
                .eq('id', imageId);

              if (dbError) throw dbError;

              // 2. Try to delete from storage (extract path from URL)
              try {
                const pathParts = imageUrl.split('/portfolio/');
                if (pathParts.length > 1) {
                  const storagePath = pathParts[1];
                  await supabase.storage.from('portfolio').remove([storagePath]);
                }
              } catch (storageErr) {
                console.error('Error deleting from storage:', storageErr);
                // Continue even if storage delete fails
              }

              Alert.alert('Success', 'Image removed from portfolio');
              fetchPortfolioImages();
            } catch (error: any) {
              console.error('Error deleting image:', error);
              Alert.alert('Error', error.message || 'Failed to delete image');
            }
          }
        },
      ]
    );
  };

  useEffect(() => {
    if (user && profile) {
      fetchMyListings();
      if (profile.role === 'specialist') {
        fetchPortfolioImages();
      }
    }
  }, [user, profile]);

  if (!user || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="person.circle"
            android_material_icon_name="account-circle"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>Sign in to view your profile</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              console.log('User tapped Sign In button');
              router.push('/auth/login');
            }}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              console.log('User tapped Register button');
              router.push('/auth/register');
            }}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const roleLabel = profile.role === 'consumer' ? 'Consumer' : 'Specialist';
  const roleColor = profile.role === 'consumer' ? colors.primary : colors.secondary;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => openGallery('profile')}
            disabled={uploadingImage}
          >
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <IconSymbol
                ios_icon_name="person.circle.fill"
                android_material_icon_name="account-circle"
                size={80}
                color={colors.primary}
              />
            )}
            <View style={styles.avatarEditButton}>
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="photo-camera"
                size={16}
                color="#FFFFFF"
              />
            </View>
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile.full_name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          {profile.city && <Text style={styles.profileCity}>{profile.city}</Text>}
          {profile.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="envelope.fill"
                android_material_icon_name="email"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>
        </View>

        {profile.role === 'specialist' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Listings</Text>
              {myListings.length > 0 && (
                <TouchableOpacity
                  onPress={() => router.push('/create-listing')}
                  style={styles.addButton}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle.fill"
                    android_material_icon_name="add-circle"
                    size={24}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {loadingListings ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : myListings.length === 0 ? (
              <View style={styles.emptyListings}>
                <IconSymbol
                  ios_icon_name="doc.text"
                  android_material_icon_name="description"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyListingsText}>No listings yet</Text>
                <TouchableOpacity
                  style={styles.createListingButton}
                  onPress={() => router.push('/create-listing')}
                >
                  <Text style={styles.createListingButtonText}>Create Your First Listing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listingsContainer}>
                {myListings.map((listing) => (
                  <TouchableOpacity
                    key={listing.id}
                    style={styles.listingCard}
                    onPress={() => router.push(`/service/${listing.id}`)}
                  >
                    <View style={styles.listingHeader}>
                      <Text style={styles.listingTitle} numberOfLines={1}>
                        {listing.title}
                      </Text>
                      {listing.category && (
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryText}>{listing.category.name}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.listingDescription} numberOfLines={2}>
                      {listing.description}
                    </Text>
                    {listing.price > 0 && (
                      <Text style={styles.listingPrice}>
                        {listing.currency} {listing.price}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {profile.role === 'specialist' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Portfolio Gallery</Text>
              <TouchableOpacity
                onPress={() => openGallery('portfolio')}
                style={styles.addButton}
                disabled={uploadingImage}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={24}
                  color={uploadingImage ? colors.textSecondary : colors.primary}
                />
              </TouchableOpacity>
            </View>

            {loadingPortfolio ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : portfolioImages.length === 0 ? (
              <View style={styles.emptyPortfolio}>
                <IconSymbol
                  ios_icon_name="photo.on.rectangle"
                  android_material_icon_name="collections"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyPortfolioText}>No portfolio images yet</Text>
                <Text style={styles.emptyPortfolioSubText}>
                  Showcase your work by adding photos of your completed projects
                </Text>
                <TouchableOpacity
                  style={styles.addPortfolioButton}
                  onPress={() => openGallery('portfolio')}
                  disabled={uploadingImage}
                >
                  <IconSymbol
                    ios_icon_name="plus.circle.fill"
                    android_material_icon_name="add-circle"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addPortfolioButtonText}>Add Portfolio Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.portfolioGrid}>
                {portfolioImages.map((image) => (
                  <TouchableOpacity
                    key={image.id}
                    style={styles.portfolioItem}
                    onLongPress={() => handleDeletePortfolioImage(image.id, image.image_url)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: image.image_url }}
                      style={styles.portfolioImage}
                      resizeMode="cover"
                    />
                    <View style={styles.deleteIndicator}>
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={12}
                        color="#FFFFFF"
                      />
                    </View>
                    {image.title && (
                      <Text style={styles.portfolioImageTitle} numberOfLines={1}>
                        {image.title}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={() => {
              console.log('User tapped Sign Out button');
              setShowSignOutModal(true);
            }}
          >
            <IconSymbol
              ios_icon_name="arrow.right.square"
              android_material_icon_name="logout"
              size={20}
              color={colors.error}
            />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={showPreviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!uploadingImage) {
            setShowPreviewModal(false);
            setSelectedImage(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <Text style={styles.modalTitle}>
              {previewType === 'profile' ? 'Profile Picture' : 'Portfolio Image'}
            </Text>
            <Text style={styles.modalText}>
              Do you want to save this photo?
            </Text>

            <View style={styles.previewImageContainer}>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={previewType === 'profile' ? styles.previewAvatar : styles.previewPortfolio}
                  resizeMode="cover"
                />
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setShowPreviewModal(false);
                  setSelectedImage(null);
                }}
                disabled={uploadingImage}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={handleSaveImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalText}>Are you sure you want to sign out?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  console.log('User cancelled sign out');
                  setShowSignOutModal(false);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonConfirm} onPress={handleSignOut}>
                <Text style={styles.modalButtonConfirmText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: Platform.OS === 'android' ? 48 : spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  profileName: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  roleText: {
    ...typography.body,
    fontWeight: '600',
  },
  profileCity: {
    ...typography.bodySecondary,
    marginBottom: spacing.xs,
  },
  profileBio: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyListings: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyListingsText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  createListingButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  createListingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listingsContainer: {
    marginHorizontal: spacing.lg,
    gap: spacing.md,
  },
  listingCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  listingTitle: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  listingDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.sm,
  },
  listingPrice: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  infoValue: {
    ...typography.bodySecondary,
    flex: 1,
    textAlign: 'right',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  signOutText: {
    ...typography.body,
    color: colors.error,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.body,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    ...typography.body,
    fontWeight: '600',
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.card,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPortfolio: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPortfolioText: {
    ...typography.h3,
    marginTop: spacing.md,
    color: colors.text,
  },
  emptyPortfolioSubText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  addPortfolioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  addPortfolioButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  portfolioItem: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  portfolioImageTitle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: spacing.xs,
    color: '#FFFFFF',
    fontSize: 12,
  },
  previewModalContent: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  previewImageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginVertical: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewAvatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  previewPortfolio: {
    width: '100%',
    height: '100%',
  },
  deleteIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 0, 0, 0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
