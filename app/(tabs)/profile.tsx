import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform, ActivityIndicator, Image, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { Service, SpecialistPortfolioImage } from '@/types/database';
import * as ImagePicker from 'expo-image-picker';
import { Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
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
    if (!loading && (!user || !profile)) {
      router.replace('/auth/login');
    }
  }, [loading, user, profile]);

  useEffect(() => {
    if (user && profile) {
      fetchMyListings();
      if (profile.role === 'specialist') {
        fetchPortfolioImages();
      }
    }
  }, [user, profile]);

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
      console.error('Error fetching listings:', err);
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

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await signOut();
    router.replace('/(tabs)/(home)');
  };

  const openGallery = async (type: 'profile' | 'portfolio') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Keyboard.dismiss();
      const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow access to your photo library to upload images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : undefined,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setSelectedImage(result.assets[0].uri);
        setPreviewType(type);
        setShowPreviewModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to open image gallery');
    }
  };

  const handleSaveImage = async () => {
    if (!selectedImage || !profile || !user) return;
    setShowPreviewModal(false);
    const imageToUpload = selectedImage;
    setSelectedImage(null);
    setUploadingImage(true);
    try {
      const fileExt = (imageToUpload.split('.').pop() || 'jpg').toLowerCase();
      const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = previewType === 'profile' ? 'avatars' : 'portfolio';
      const res = await fetch(imageToUpload);
      const blob = await res.blob();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      if (previewType === 'profile') {
        await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      } else {
        await supabase.from('specialist_portfolio_images').insert({
          specialist_profile_id: profile.id,
          image_url: publicUrl,
          sort_order: portfolioImages.length,
        });
        fetchPortfolioImages();
      }
      await refreshProfile();
      Alert.alert('Success', 'Image saved successfully');
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeletePortfolioImage = (imageId: string, imageUrl: string) => {
    Alert.alert('Delete Image', 'Remove this image from your portfolio?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setUploadingImage(true);
          try {
            await supabase.from('specialist_portfolio_images').delete().eq('id', imageId);
            fetchPortfolioImages();
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete image');
          } finally {
            setUploadingImage(false);
          }
        },
      },
    ]);
  };

  if (loading || !user || !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={() => openGallery('profile')} disabled={uploadingImage}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={40} color={colors.primary} />
              </View>
            )}
            <View style={styles.avatarEdit}>
              <IconSymbol ios_icon_name="camera.fill" android_material_icon_name="photo-camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile.full_name}</Text>
          <View style={[styles.badge, profile.role === 'specialist' ? styles.specialistBadge : styles.consumerBadge]}>
            <Text style={styles.badgeText}>{profile.role.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <View style={styles.menuItem}>
              <IconSymbol ios_icon_name="envelope.fill" android_material_icon_name="email" size={20} color={colors.textSecondary} />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Email</Text>
                <Text style={styles.menuValue}>{user.email}</Text>
              </View>
            </View>
            <View style={[styles.menuItem, styles.noBorder]}>
              <IconSymbol ios_icon_name="mappin.and.ellipse" android_material_icon_name="place" size={20} color={colors.textSecondary} />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Location</Text>
                <Text style={styles.menuValue}>{profile.city || 'Not set'}</Text>
              </View>
            </View>
          </View>
        </View>

        {profile.role === 'specialist' && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Portfolio</Text>
                <TouchableOpacity onPress={() => openGallery('portfolio')}>
                  <Text style={styles.actionText}>Add Image</Text>
                </TouchableOpacity>
              </View>
              {loadingPortfolio ? (
                <ActivityIndicator color={colors.primary} />
              ) : portfolioImages.length === 0 ? (
                <View style={[styles.emptyCard, { borderStyle: 'solid', backgroundColor: colors.background }]}>
                  <IconSymbol ios_icon_name="photo.on.rectangle" android_material_icon_name="photo-library" size={32} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { marginTop: 8 }]}>Showcase your work to attract more clients.</Text>
                </View>
              ) : (
                <View style={styles.portfolioGrid}>
                  {portfolioImages.map(img => (
                    <TouchableOpacity key={img.id} style={styles.portfolioItem} onPress={() => handleDeletePortfolioImage(img.id, img.image_url)}>
                      <Image source={{ uri: img.image_url }} style={styles.portfolioImage} />
                      <View style={styles.deleteOverlay}>
                        <IconSymbol ios_icon_name="trash.fill" android_material_icon_name="delete" size={14} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Services</Text>
                <TouchableOpacity onPress={() => router.push('/create-listing')}>
                  <Text style={styles.actionText}>Add New</Text>
                </TouchableOpacity>
              </View>
              {loadingListings ? (
                <ActivityIndicator color={colors.primary} />
              ) : myListings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>You haven't listed any services yet.</Text>
                </View>
              ) : (
                myListings.map(listing => (
                  <TouchableOpacity key={listing.id} style={styles.serviceItem} onPress={() => router.push(`/service/${listing.id}`)}>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceTitle}>{listing.title}</Text>
                      <Text style={styles.serviceCategory}>{listing.category?.name}</Text>
                    </View>
                    <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowSignOutModal(true)}>
            <IconSymbol ios_icon_name="arrow.right.square" android_material_icon_name="logout" size={20} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sign Out Modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalBoxTitle}>Sign Out</Text>
            <Text style={styles.modalBoxText}>Are you sure you want to exit?</Text>
            <View style={styles.modalBoxActions}>
              <TouchableOpacity style={[styles.modalBoxBtn, styles.cancelBtn]} onPress={() => setShowSignOutModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBoxBtn, styles.confirmBtn]} onPress={handleSignOut}>
                <Text style={styles.confirmBtnText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal visible={showPreviewModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.previewBox}>
            <Text style={styles.modalBoxTitle}>Preview</Text>
            {selectedImage && <Image source={{ uri: selectedImage }} style={styles.previewImage} />}
            <View style={styles.modalBoxActions}>
              <TouchableOpacity style={[styles.modalBoxBtn, styles.cancelBtn]} onPress={() => setShowPreviewModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBoxBtn, styles.confirmBtn]} onPress={handleSaveImage}>
                <Text style={styles.confirmBtnText}>Save</Text>
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
    backgroundColor: colors.backgroundSecondary,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h2,
    fontSize: 28,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.backgroundSecondary,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: {
    ...typography.h3,
    fontSize: 22,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  specialistBadge: {
    backgroundColor: colors.secondary,
  },
  consumerBadge: {
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  actionText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  menuValue: {
    ...typography.body,
    fontWeight: '600',
  },
  serviceItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  serviceCategory: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEEF0',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  signOutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalBoxTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  modalBoxText: {
    ...typography.bodySecondary,
    marginBottom: spacing.xl,
  },
  modalBoxActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalBoxBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.backgroundSecondary,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  previewBox: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginVertical: spacing.xl,
  },
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  portfolioItem: {
    width: (width - (spacing.lg * 2) - (spacing.md * 2)) / 3,
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(250, 42, 72, 0.8)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
