
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { Order } from '@/types/database';

export default function OrderReviewScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user, profile } = useAuth();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [images, setImages] = useState<string[]>([]);

    useEffect(() => {
        loadOrder();
    }, [id]);

    const loadOrder = async () => {
        if (!isSupabaseConfigured || !id) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*, service:services(*)')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error loading order:', error);
                Alert.alert('Error', 'Could not load order details');
                router.back();
            } else {
                setOrder(data);
                // Check if already reviewed
                const { data: existing } = await supabase
                    .from('service_reviews')
                    .select('id')
                    .eq('order_id', id)
                    .maybeSingle();

                if (existing) {
                    Alert.alert('Already Reviewed', 'You have already left a review for this order.');
                    router.back();
                }
            }
        } catch (error) {
            console.error('Exception loading order:', error);
        } finally {
            setLoading(false);
        }
    };

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
            const newImages = result.assets.map((asset: any) => asset.uri);
            setImages(prev => [...prev, ...newImages].slice(0, 5));
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (!order || !profile) return;

        if (rating === 0) {
            Alert.alert('Rating required', 'Please select a rating.');
            return;
        }

        if (rating <= 2 && comment.trim().length < 10) {
            Alert.alert('More details needed', 'Low ratings require a short explanation (at least 10 characters).');
            return;
        }

        setSubmitting(true);

        try {
            // 1. Create review
            const { data: review, error: reviewError } = await supabase
                .from('service_reviews')
                .insert({
                    order_id: order.id,
                    service_id: order.service_id,
                    consumer_profile_id: profile.id,
                    specialist_profile_id: order.specialist_profile_id,
                    rating,
                    comment: comment.trim() || null,
                })
                .select()
                .single();

            if (reviewError) throw reviewError;

            // 2. Upload images
            const uploadedPaths: string[] = [];
            for (const uri of images) {
                const fileExt = uri.split('.').pop() || 'jpg';
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const storagePath = `reviews/${review.id}/${fileName}`;

                const response = await fetch(uri);
                const blob = await response.blob();

                const { error: uploadError } = await supabase.storage
                    .from('review-images')
                    .upload(storagePath, blob);

                if (!uploadError) {
                    uploadedPaths.push(storagePath);
                }
            }

            // 3. Create image records
            if (uploadedPaths.length > 0) {
                const imageRecords = uploadedPaths.map(path => ({
                    review_id: review.id,
                    storage_path: path,
                }));
                await supabase.from('service_review_images').insert(imageRecords);
            }

            Alert.alert('Success', 'Thank you for your review!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Error submitting review:', error);
            Alert.alert('Error', error.message || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Write a Review' }} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.serviceTitle}>{order?.service?.title}</Text>
                    <Text style={styles.instruction}>How was your experience?</Text>
                </View>

                <View style={styles.ratingSection}>
                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starButton}>
                                <IconSymbol
                                    ios_icon_name={star <= rating ? 'star.fill' : 'star'}
                                    android_material_icon_name={star <= rating ? 'star' : 'star-outline'}
                                    size={48}
                                    color={star <= rating ? '#FFC107' : '#ccc'}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Your Review (Optional)</Text>
                    <TextInput
                        style={styles.commentInput}
                        placeholder="Share details of your experience..."
                        placeholderTextColor="#999"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Photos (Optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesList}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imagePreviewContainer}>
                                <Image source={{ uri }} style={styles.imagePreview} />
                                <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                                    <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={24} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 5 && (
                            <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                                <IconSymbol ios_icon_name="photo" android_material_icon_name="add-photo-alternate" size={32} color={colors.primary} />
                                <Text style={styles.addImageText}>Add Photos</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, (submitting || rating === 0) && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || rating === 0}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Review</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    serviceTitle: {
        ...typography.h2,
        textAlign: 'center',
    },
    instruction: {
        ...typography.bodySecondary,
        marginTop: spacing.xs,
    },
    ratingSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    starButton: {
        padding: spacing.xs,
    },
    section: {
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.h3,
        marginBottom: spacing.md,
    },
    commentInput: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        minHeight: 120,
        borderWidth: 1,
        borderColor: colors.border,
    },
    imagesList: {
        flexDirection: 'row',
    },
    imagePreviewContainer: {
        position: 'relative',
        marginRight: spacing.md,
    },
    imagePreview: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.sm,
    },
    removeImageButton: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: 'white',
        borderRadius: 12,
    },
    addImageButton: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    addImageText: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginTop: spacing.md,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
