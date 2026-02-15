
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Modal, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

// Type aliases for review submission
type OrderRow = { id: string };
type ReviewRow = { order_id: string };
type ReviewImageRow = { id: string; storage_path: string };
type ReviewListRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  consumer: { full_name: string | null } | null;
  images: ReviewImageRow[] | null;
};

type RatingBreakdown = { rating: number; count: number | string };

export default function ServiceDetailScreen() {
  const router = useRouter();
  const rawId = useLocalSearchParams().id;
  // Normalize ID to handle string | string[] | undefined
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { user, profile } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewListRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Rating breakdown state
  const [ratingBreakdown, setRatingBreakdown] = useState<RatingBreakdown[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    console.log('ServiceDetailScreen: Loading service', id);
    loadService();
  }, [id]);

  // Load reviews when ID or profile changes (not service to avoid extra calls)
  useEffect(() => {
    if (!id) return;

    loadReviews();
    loadRatingBreakdown();
    checkReviewEligibility();
  }, [id, profile?.id, profile?.role]);

  // Compute breakdown total once using useMemo
  const breakdownTotal = useMemo(() => {
    return ratingBreakdown.reduce((sum: number, r: RatingBreakdown) => {
      const c = typeof r.count === 'string' ? Number(r.count) : r.count;
      return sum + (Number.isFinite(c) ? c : 0);
    }, 0);
  }, [ratingBreakdown]);

  const loadService = async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading service:', error);
      } else {
        console.log('Service loaded:', data);
        setService(data);
      }
    } catch (error) {
      console.error('Exception loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookService = () => {
    if (!user) {
      console.log('User not logged in, redirecting to login');
      router.push('/auth/login');
      return;
    }

    if (profile?.role !== 'consumer') {
      console.log('User is not a consumer');
      return;
    }

    console.log('User tapped Book Service button');
    router.push(`/booking/${id}`);
  };

  const handleViewSpecialist = () => {
    if (service?.specialist_profile_id) {
      console.log('User tapped View Specialist button');
      router.push(`/specialist/${service.specialist_profile_id}`);
    }
  };

  // Load latest 3 reviews with images
  const loadReviews = async () => {
    if (!isSupabaseConfigured || !id) {
      setReviewsLoading(false);
      return;
    }

    setReviewsLoading(true);

    try {
      const { data, error } = await supabase
        .from('service_reviews')
        .select(`
          *,
          consumer:profiles!consumer_profile_id(full_name),
          images:service_review_images(*)
        `)
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setReviews(data as ReviewListRow[]);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Check if current user can review this service
  const checkReviewEligibility = async () => {
    if (!isSupabaseConfigured) {
      setCanReview(false);
      return;
    }

    // Must be logged in
    if (!user || !profile) {
      setCanReview(false);
      return;
    }

    // Must be consumer
    if (profile.role !== 'consumer') {
      setCanReview(false);
      return;
    }

    // Must have a valid service ID (string)
    if (!id || typeof id !== 'string') {
      setCanReview(false);
      return;
    }

    try {
      // Check completed orders
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('service_id', id)
        .eq('consumer_profile_id', profile.id)
        .eq('status', 'done');

      if (error || !orders || orders.length === 0) {
        setCanReview(false);
        return;
      }

      // Check if review already exists for those orders
      const orderIds = orders.map(o => o.id);

      const { data: existingReviews } = await supabase
        .from('service_reviews')
        .select('order_id')
        .in('order_id', orderIds);

      const alreadyReviewed =
        existingReviews && existingReviews.length > 0;

      setCanReview(!alreadyReviewed);

    } catch (err) {
      console.error('Eligibility error:', err);
      setCanReview(false);
    }
  };

  // Load rating breakdown
  const loadRatingBreakdown = async () => {
    if (!isSupabaseConfigured || !id) {
      setBreakdownLoading(false);
      return;
    }

    setBreakdownLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('get_service_rating_breakdown', { p_service_id: id });

      if (!error && data) {
        setRatingBreakdown(data as RatingBreakdown[]);
      }
    } catch (error) {
      console.error('Error loading rating breakdown:', error);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Helper to get public URL for review images
  const getPublicUrl = (path: string) => {
    return supabase.storage
      .from('review-images')
      .getPublicUrl(path).data.publicUrl;
  };

  // Pick images for review
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos to add images to your review.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setReviewImages(prev => [...prev, ...newImages].slice(0, 5)); // Max 5 images
    }
  };

  // Remove image from review
  const removeImage = (index: number) => {
    setReviewImages(prev => prev.filter((_, i) => i !== index));
  };

  // Close and reset review modal
  const closeReviewModal = () => {
    setShowReviewModal(false);
    setReviewRating(0);
    setReviewComment('');
    setReviewImages([]);
  };

  // Submit review
  const submitReview = async () => {
    // Prevent double submit
    if (submittingReview) return;

    if (!profile || !service) return;

    if (reviewRating === 0) {
      Alert.alert('Rating required', 'Please select a rating before submitting.');
      return;
    }

    // Prevent low-rating spam without explanation
    if (reviewRating <= 2 && reviewComment.trim().length < 10) {
      Alert.alert(
        'Please add more details',
        'Low ratings require a short explanation (at least 10 characters).'
      );
      return;
    }

    // Only block if service is inactive (RLS handles expiration)
    if (!service.is_active) {
      Alert.alert('Service inactive', 'You cannot review an inactive service.');
      closeReviewModal();
      return;
    }

    // Optimistic UX: hide Add Review button immediately
    setCanReview(false);

    setSubmittingReview(true);

    try {
      // 1. Get completed orders for this service
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('service_id', id)
        .eq('consumer_profile_id', profile.id)
        .eq('status', 'done');

      if (ordersError || !orders || orders.length === 0) {
        throw new Error('No completed order found for this service');
      }

      // 2. Check which orders already have reviews
      const orderIds = (orders as OrderRow[]).map(o => o.id);

      const { data: existingReviews } = await supabase
        .from('service_reviews')
        .select('order_id')
        .in('order_id', orderIds);

      const reviewedOrderIds = new Set(
        (existingReviews as ReviewRow[] | null)?.map(r => r.order_id)
      );

      const unreviewedOrder = (orders as OrderRow[]).find(o => !reviewedOrderIds.has(o.id));

      if (!unreviewedOrder) {
        throw new Error('You have already reviewed all completed orders for this service');
      }

      const orderId = unreviewedOrder.id;

      // 3. Create review in DB
      const { data: review, error: reviewError } = await supabase
        .from('service_reviews')
        .insert({
          order_id: orderId,
          service_id: id,
          consumer_profile_id: profile.id,
          specialist_profile_id: service.specialist_profile_id,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        })
        .select()
        .single();

      if (reviewError) {
        if (reviewError.message?.includes('row-level security')) {
          throw new Error('You can only review after completing an order.');
        }
        throw reviewError;
      }

      // 4. Upload images if any
      const uploadedPaths: string[] = [];

      for (const imageUri of reviewImages) {
        try {
          // Generate unique filename
          const fileExt = imageUri.split('.').pop() || 'jpg';
          const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
          const storagePath = `reviews/${review.id}/${fileName}`;

          // Fetch image as blob
          const response = await fetch(imageUri);
          const blob = await response.blob();

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('review-images')
            .upload(storagePath, blob, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          uploadedPaths.push(storagePath);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          // Continue with other images
        }
      }

      // 5. Create DB records for uploaded images
      if (uploadedPaths.length > 0) {
        const imageRecords = uploadedPaths.map(path => ({
          review_id: review.id,
          storage_path: path,
        }));

        const { error: dbError } = await supabase
          .from('service_review_images')
          .insert(imageRecords);

        if (dbError) {
          console.error('Error creating image records:', dbError);
          // Rollback: delete uploaded images
          await supabase.storage.from('review-images').remove(uploadedPaths);
        }
      }

      // 6. Success - reset modal and refresh
      Alert.alert('Success', 'Your review has been submitted!');
      closeReviewModal();

      // Refresh service (for updated rating_avg/rating_count) and reviews
      await loadService();
      await loadReviews();
      await loadRatingBreakdown();
      // canReview already set to false optimistically

    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review. Please try again.');
      // Restore Add Review button on error
      checkReviewEligibility();
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Service Details' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Service Not Found' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Service not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const specialistName = service.specialist?.full_name || 'Unknown';
  const categoryName = service.category?.name || 'Uncategorized';
  const priceText = `${service.currency} ${service.price.toFixed(2)}`;
  const ratingText = service.rating_count > 0 ? `${service.rating_avg.toFixed(1)} (${service.rating_count} reviews)` : 'No ratings yet';

  // Check if service is expired
  const isExpired = !!service.expires_at && new Date(service.expires_at).getTime() < Date.now();
  const canBook = user && profile?.role === 'consumer' && !isExpired;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: service.title }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{service.title}</Text>
          <Text style={styles.price}>{priceText}</Text>
        </View>

        <View style={styles.infoRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={20}
              color={colors.warning}
            />
            <Text style={styles.infoText}>{ratingText}</Text>
          </View>

          {canReview && !showReviewModal && !submittingReview && (
            <TouchableOpacity onPress={() => setShowReviewModal(true)}>
              <Text style={styles.addReviewText}>Add Review</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>

        {/* Rating Breakdown */}
        {(breakdownLoading || ratingBreakdown.length > 0 || service.rating_count > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rating Breakdown</Text>
            {breakdownLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : ratingBreakdown.length === 0 ? (
              <Text style={styles.description}>No ratings yet</Text>
            ) : (
              <View style={styles.breakdownContainer}>
                {(() => {
                  const total = breakdownTotal || service.rating_count || 0;

                  return [5, 4, 3, 2, 1].map((rating) => {
                    const emoji = rating === 5 ? '🔥' : rating === 4 ? '❤️' : rating === 3 ? '🙂' : rating === 2 ? '🤡' : '💩';
                    const ratingData = ratingBreakdown.find((r: RatingBreakdown) => r.rating === rating);
                    const rawCount = ratingData?.count ?? 0;
                    const parsedCount = typeof rawCount === 'string' ? Number(rawCount) : rawCount;
                    const count = Number.isFinite(parsedCount) ? parsedCount : 0;

                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const safePct = Math.min(100, Math.max(0, Number.isFinite(percentage) ? percentage : 0));

                    return (
                      <View key={rating} style={styles.breakdownRow}>
                        <Text style={styles.breakdownEmoji}>{emoji}</Text>
                        <Text style={styles.breakdownRating}>{rating}</Text>
                        <View style={styles.breakdownBarContainer}>
                          <View style={[styles.breakdownBarFill, { width: `${safePct}%` }]} />
                        </View>
                        <Text style={styles.breakdownCount}>{count}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
            )}
          </View>
        )}

        {isExpired && (
          <View style={styles.section}>
            <View style={styles.expiredBanner}>
              <IconSymbol
                ios_icon_name="exclamationmark.triangle.fill"
                android_material_icon_name="warning"
                size={20}
                color={colors.warning}
              />
              <Text style={styles.expiredText}>
                This service listing has expired
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryBadge}>
            <IconSymbol
              ios_icon_name="tag.fill"
              android_material_icon_name="label"
              size={16}
              color={colors.primary}
            />
            <Text style={styles.categoryText}>{categoryName}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialist</Text>
          <TouchableOpacity style={styles.specialistCard} onPress={handleViewSpecialist}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={48}
              color={colors.primary}
            />
            <View style={styles.specialistInfo}>
              <Text style={styles.specialistName}>{specialistName}</Text>
              {service.specialist?.city && (
                <Text style={styles.specialistCity}>{service.specialist.city}</Text>
              )}
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reviews ({service.rating_count})
          </Text>

          {reviewsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : reviews.length === 0 ? (
            <Text style={styles.emptyText}>No reviews yet</Text>
          ) : (
            <>
              {reviews.map((review) => (
                <View key={review.id} style={styles.reviewCard}>

                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewerName}>
                      {review.consumer?.full_name || 'Anonymous'}
                    </Text>

                    <View style={{ flexDirection: 'row' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <IconSymbol
                          key={star}
                          ios_icon_name={star <= review.rating ? 'star.fill' : 'star'}
                          android_material_icon_name={star <= review.rating ? 'star' : 'star-outline'}
                          size={14}
                          color={star <= review.rating ? '#FFC107' : '#ccc'}
                        />
                      ))}
                    </View>
                  </View>

                  {review.comment && (
                    <Text style={styles.reviewComment}>
                      {review.comment}
                    </Text>
                  )}

                  {review.images?.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {review.images.map((img: ReviewImageRow) => {
                        const publicUrl = getPublicUrl(img.storage_path);
                        return (
                          <Image
                            key={img.id}
                            source={{ uri: publicUrl }}
                            style={styles.reviewImage}
                          />
                        );
                      })}
                    </ScrollView>
                  )}

                </View>
              ))}

              {service.rating_count > 3 && (
                <TouchableOpacity onPress={() => router.push({ pathname: '/service/[id]/reviews', params: { id: String(id) } })}>
                  <Text style={styles.seeAllText}>See All Reviews</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {canBook && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.bookButton} onPress={handleBookService}>
            <Text style={styles.bookButtonText}>Book This Service</Text>
          </TouchableOpacity>
        </View>
      )}

      {!user && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => {
              console.log('User tapped Sign In to Book button');
              router.push('/auth/login');
            }}
          >
            <Text style={styles.bookButtonText}>Sign In to Book</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={false}
        onRequestClose={closeReviewModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeReviewModal}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <TouchableOpacity
              onPress={submitReview}
              disabled={submittingReview || reviewRating === 0}
            >
              <Text style={[
                styles.modalSubmitText,
                (submittingReview || reviewRating === 0) && styles.modalSubmitTextDisabled
              ]}>
                {submittingReview ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingLabel}>Rating *</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewRating(star)}
                    style={styles.starButton}
                  >
                    <IconSymbol
                      ios_icon_name={star <= reviewRating ? 'star.fill' : 'star'}
                      android_material_icon_name={star <= reviewRating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= reviewRating ? '#FFC107' : '#ccc'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comment */}
            <View style={styles.commentSection}>
              <Text style={styles.commentLabel}>Your Review (Optional)</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Share your experience with this service..."
                placeholderTextColor="#999"
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Images */}
            <View style={styles.imagesSection}>
              <Text style={styles.imagesLabel}>Photos (Optional)</Text>

              {reviewImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesList}>
                  {reviewImages.map((uri, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <IconSymbol
                          ios_icon_name="xmark.circle.fill"
                          android_material_icon_name="cancel"
                          size={24}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {reviewImages.length < 5 && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                  <IconSymbol
                    ios_icon_name="photo"
                    android_material_icon_name="add-photo-alternate"
                    size={24}
                    color={colors.primary}
                  />
                  <Text style={styles.addImageText}>
                    Add Photos ({reviewImages.length}/5)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.bodySecondary,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.h2,
    color: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoText: {
    ...typography.body,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    lineHeight: 24,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  categoryText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  specialistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    ...typography.body,
    fontWeight: '600',
  },
  specialistCity: {
    ...typography.bodySecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Reviews styles
  addReviewText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  reviewCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  reviewerName: {
    ...typography.body,
    fontWeight: '600',
  },
  reviewComment: {
    ...typography.body,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  reviewImage: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  seeAllText: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  expiredText: {
    ...typography.body,
    color: colors.warning,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    width: 70,
  },
  modalTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
  },
  modalSubmitText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    width: 70,
    textAlign: 'right',
  },
  modalSubmitTextDisabled: {
    color: colors.textSecondary,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  ratingSection: {
    marginBottom: spacing.xl,
  },
  ratingLabel: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  starButton: {
    padding: spacing.sm,
  },
  commentSection: {
    marginBottom: spacing.xl,
  },
  commentLabel: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  commentInput: {
    ...typography.body,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagesSection: {
    marginBottom: spacing.xl,
  },
  imagesLabel: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  imagesList: {
    marginBottom: spacing.md,
  },
  imagePreviewContainer: {
    marginRight: spacing.md,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    borderStyle: 'dashed',
  },
  addImageText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  // Rating breakdown styles
  breakdownContainer: {
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownEmoji: {
    fontSize: 20,
    width: 28,
  },
  breakdownRating: {
    ...typography.body,
    fontWeight: '600',
    width: 20,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  breakdownCount: {
    ...typography.caption,
    color: colors.textSecondary,
    width: 30,
    textAlign: 'right',
  },
});
