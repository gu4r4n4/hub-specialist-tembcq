
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
import { Keyboard } from 'react-native';

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
        base64: false,
      });

      console.log('[ImagePicker] result.canceled:', result.canceled);

      if (!result.canceled && result.assets?.[0]) {
        console.log('[ImagePicker] image selected:', result.assets[0].uri.substring(0, 50) + '...');
        setSelectedImage(result.assets[0].uri);
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
    const imageToUpload = selectedImage; // Keep a reference
    setSelectedImage(null);
    setUploadingImage(true);

    try {
      console.log('Starting upload for:', previewType);

      const fileExt = (imageToUpload.split('.').pop() || 'jpg').toLowerCase();
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = previewType === 'profile' ? 'avatars' : 'portfolio';

      console.log('Upload details:', { bucket, fileName, contentType });

      // Convert the picked image URI to a Blob (works on Expo Web + iOS/Android)
      const res = await fetch(imageToUpload);
      const blob = await res.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: blob.type || contentType,
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
          .eq('id', profile.id);

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

      // Navigate to profile tab to see latest data
      router.replace('/(tabs)/profile');

      Alert.alert('Success', `${previewType === 'profile' ? 'Profile picture' : 'Portfolio image'} saved successfully`);
    } catch (error: any) {
      console.error('Error in handleSaveImage:', error);
      let msg = error.message || 'An error occurred during upload.';
      if (msg.includes('bucket not found')) {
        msg = 'Storage bucket not found. Please ensure "avatars" and "portfolio" buckets exist in your Supabase dashboard.';
      }
      Alert.alert('Upload Failed', msg);
      // Re-open modal if it failed so user can try again
      setSelectedImage(imageToUpload);
      setShowPreviewModal(true);
    } finally {
      setUploadingImage(false);
    }
  };

  const getStoragePathFromPublicUrl = (publicUrl: string, bucket: string) => {
    try {
      const u = new URL(publicUrl);
      const path = decodeURIComponent(u.pathname);

      // /storage/v1/object/public/{bucket}/{objectPath}
      const marker1 = `/storage/v1/object/public/${bucket}/`;
      const i1 = path.indexOf(marker1);
      if (i1 !== -1) return path.slice(i1 + marker1.length);

      const marker2 = `/${bucket}/`;
      const i2 = path.lastIndexOf(marker2);
      if (i2 !== -1) return path.slice(i2 + marker2.length);

      return null;
    } catch {
      const marker = `/${bucket}/`;
      const idx = publicUrl.lastIndexOf(marker);
      if (idx === -1) return null;
      return decodeURIComponent(publicUrl.slice(idx + marker.length));
    }
  };

  const handleDeletePortfolioImage = (imageId: string, imageUrl: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to remove this image from your portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user || !profile) return;

            setUploadingImage(true);
            setPortfolioImages(prev => prev.filter(img => img.id !== imageId));

            try {
              const { error: dbError } = await supabase
                .from('specialist_portfolio_images')
                .delete()
                .eq('id', imageId);

              if (dbError) {
                await fetchPortfolioImages();
                throw dbError;
              }

              const storagePath = getStoragePathFromPublicUrl(imageUrl, 'portfolio');
              if (storagePath) {
                const { error: storageError } = await supabase.storage
                  .from('portfolio')
                  .remove([storagePath]);

                if (storageError) {
                  console.warn('Storage delete failed (DB row deleted):', storageError);
                }
              }

              await refreshProfile();
              await fetchPortfolioImages();
              router.replace({ pathname: '/(tabs)/profile', params: { t: String(Date.now()) } });
              Alert.alert('Success', 'Image removed from portfolio');
            } catch (e: any) {
              console.error('Delete failed:', e);
              Alert.alert('Error', e?.message || 'Failed to delete image');
            } finally {
              setUploadingImage(false);
            }
          },
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
        <div style={styles.emptyContainer}>
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
        </div>
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
                  <View key={image.id} style={styles.portfolioItem}>
                    <Image
                      source={{ uri: image.image_url }}
                      style={styles.portfolioImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.deleteIndicator}
                      onPress={() => handleDeletePortfolioImage(image.id, image.image_url)}
                      activeOpacity={0.8}
                      disabled={uploadingImage}
                    >
                      <IconSymbol
                        ios_icon_name="trash"
                        android_material_icon_name="delete"
                        size={12}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                    {image.title && (
                      <Text style={styles.portfolioImageTitle} numberOfLines={1}>
                        {image.title}
                      </Text>
                    )}
                  </View>
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
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => {
                  setShowPreviewModal(false);
                  setSelectedImage(null);
                }}
                disabled={uploadingImage}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  uploadingImage && styles.modalBtnDisabled,
                ]}
                onPress={handleSaveImage}
                disabled={uploadingImage}
                activeOpacity={0.9}
              >
                {uploadingImage ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText} numberOfLines={1}>
                    {previewType === 'profile' ? 'Save' : 'Upload'}
                  </Text>
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
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowSignOutModal(false)}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger]}
                onPress={handleSignOut}
                activeOpacity={0.9}
              >
                <Text style={styles.modalBtnDangerText}>Sign Out</Text>
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
    textAlign: 'center',
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
    position: 'relative',
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
    padding: spacing.xs,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.card,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  infoLabel: {
    ...typography.bodySecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  infoValue: {
    ...typography.body,
    fontWeight: '600',
  },
  listingsContainer: {
    paddingHorizontal: spacing.lg,
  },
  listingCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listingTitle: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },
  listingDescription: {
    ...typography.bodySecondary,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  listingPrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
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
    ...typography.bodySecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  createListingButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  createListingButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  portfolioItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  deleteIndicator: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  portfolioImageTitle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#FFFFFF',
    fontSize: 10,
    padding: 2,
    textAlign: 'center',
  },
  emptyPortfolio: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPortfolioText: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyPortfolioSubText: {
    ...typography.bodySecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  addPortfolioButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  addPortfolioButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
    gap: spacing.sm,
  },
  signOutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.card,
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewModalContent: {
    backgroundColor: colors.card,
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  modalText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  previewImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewAvatar: {
    width: '60%',
    aspectRatio: 1,
    borderRadius: 100,
  },
  previewPortfolio: {
    width: '100%',
    height: '100%',
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary,
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalBtnSecondary: {
    backgroundColor: colors.secondary + '20',
  },
  modalBtnSecondaryText: {
    color: colors.secondary,
    fontWeight: '700',
  },
  modalBtnDanger: {
    backgroundColor: colors.error,
  },
  modalBtnDangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
});
