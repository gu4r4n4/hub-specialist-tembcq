
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
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
    const { profile } = useAuth();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (id) {
            loadOrder();
        }
    }, [id]);

    const loadOrder = async () => {
        if (!isSupabaseConfigured || !id) {
            setLoading(false);
            return;
        }

        try {
            console.log('Loading order for review:', id);
            const { data, error } = await supabase
                .from('orders')
                .select('*, service:services(*)')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error loading order:', error);
                Alert.alert('Error', 'Could not load order details');
                router.back();
                return;
            }

            setOrder(data);

            // Check if already reviewed
            const { data: existing, error: existingError } = await supabase
                .from('service_reviews')
                .select('id')
                .eq('order_id', id)
                .maybeSingle();

            if (existing) {
                console.log('Order already reviewed');
                Alert.alert('Already Reviewed', 'You have already left a review for this order.', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (error) {
            console.error('Exception loading order:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (submitting) return;
        if (!order || !profile) {
            console.error('Submit failed: No order or profile');
            return;
        }

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
            console.log('Submitting review for order:', order.id);
            const { error: reviewError } = await supabase
                .from('service_reviews')
                .insert({
                    order_id: order.id,
                    service_id: order.service_id,
                    consumer_profile_id: profile.id,
                    specialist_profile_id: order.specialist_profile_id,
                    rating,
                    comment: comment.trim() || null,
                });

            if (reviewError) {
                console.error('Supabase review insert error:', reviewError);
                throw reviewError;
            }

            console.log('Review submitted successfully');
            Alert.alert('Success', 'Thank you for your review!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error: any) {
            console.error('Error submitting review:', error);
            Alert.alert('Error', error.message || 'Failed to submit review. Please try again.');
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

    if (!order) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <Text>Order not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ title: 'Write a Review' }} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.serviceTitle}>{order.service?.title}</Text>
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
