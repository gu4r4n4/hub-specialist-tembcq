
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Order, OrderStatus, OrderStatusHistory } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ status: OrderStatus; label: string } | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [canLeaveReview, setCanLeaveReview] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    console.log('OrderDetailScreen: Loading order', id);
    loadOrder();
    loadHistory();
    checkReviewEligibility();
  }, [id, profile?.id]);

  const loadOrder = async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading order:', error);
      } else {
        console.log('Order loaded:', data);
        setOrder(data);
      }
    } catch (error) {
      console.error('Exception loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!isSupabaseConfigured || !id) {
      setLoadingHistory(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
      } else {
        setHistory(data || []);
      }
    } catch (error) {
      console.error('Exception loading history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const checkReviewEligibility = async () => {
    if (!isSupabaseConfigured || !id || !profile || profile.role !== 'consumer') {
      setCanLeaveReview(false);
      return;
    }

    try {
      // Check if review already exists
      const { data: existing } = await supabase
        .from('service_reviews')
        .select('id')
        .eq('order_id', id)
        .maybeSingle();

      // We'll also need to check order status from the order state, 
      // but since we call this in useEffect, it might be better to check it here too
      // or rely on the order state if it's already loaded.
      // For now, let's just check the DB for existing review.
      // The status check will be done in the render condition.
      setCanLeaveReview(!existing);
    } catch (error) {
      console.error('Error checking review eligibility:', error);
      setCanLeaveReview(false);
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    console.log('Updating order status to:', newStatus);
    setUpdating(true);
    setShowConfirmModal(false);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Error updating order:', error);
      } else {
        console.log('Order updated successfully');
        await loadOrder();
        await loadHistory();
        await checkReviewEligibility();
      }
    } catch (error) {
      console.error('Exception updating order:', error);
    } finally {
      setUpdating(false);
    }
  };

  const confirmStatusChange = (status: OrderStatus, label: string) => {
    console.log('User requested status change to:', status);
    setConfirmAction({ status, label });
    setShowConfirmModal(true);
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      new: colors.statusNew,
      confirmed: colors.statusConfirmed,
      in_progress: colors.statusInProgress,
      done: colors.statusDone,
      cancelled: colors.statusCancelled,
    };
    return statusColors[status] || colors.textSecondary;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'New',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      done: 'Done',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Order Details' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Order Not Found' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isConsumer = profile?.role === 'consumer';
  const isSpecialist = profile?.role === 'specialist';
  const statusLabel = getStatusLabel(order.status);
  const statusColor = getStatusColor(order.status);
  const scheduledDate = new Date(order.scheduled_at).toLocaleDateString();
  const scheduledTime = new Date(order.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const canConsumerCancel = isConsumer && (order.status === 'new' || order.status === 'confirmed');
  const canSpecialistConfirm = isSpecialist && order.status === 'new';
  const canSpecialistStart = isSpecialist && order.status === 'confirmed';
  const canSpecialistComplete = isSpecialist && order.status === 'in_progress';
  const canSpecialistCancel = isSpecialist && order.status !== 'done' && order.status !== 'cancelled';
  const isReviewEligible = canLeaveReview && order.status === 'done';

  const getHistoryStatusLabel = (status: string | null) => {
    if (!status) return 'Created';
    return getStatusLabel(status);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Order Details' }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service</Text>
          <Text style={styles.serviceTitle}>{order.service?.title}</Text>
          <Text style={styles.servicePrice}>
            {order.service?.currency} {order.service?.price.toFixed(2)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isConsumer ? 'Specialist' : 'Client'}
          </Text>
          <View style={styles.personCard}>
            <IconSymbol
              ios_icon_name="person.circle.fill"
              android_material_icon_name="account-circle"
              size={48}
              color={colors.primary}
            />
            <View style={styles.personInfo}>
              <Text style={styles.personName}>
                {isConsumer ? order.specialist?.full_name : order.consumer?.full_name}
              </Text>
              {(isConsumer ? order.specialist?.city : order.consumer?.city) && (
                <Text style={styles.personCity}>
                  {isConsumer ? order.specialist?.city : order.consumer?.city}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.infoRow}>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="event"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>{scheduledDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <IconSymbol
              ios_icon_name="clock"
              android_material_icon_name="access-time"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>{scheduledTime}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.infoRow}>
            <IconSymbol
              ios_icon_name="location.fill"
              android_material_icon_name="location-on"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.infoText}>{order.address}</Text>
          </View>
        </View>

        {order.comment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comments</Text>
            <Text style={styles.commentText}>{order.comment}</Text>
          </View>
        )}

        {isReviewEligible && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push(`/order/${order.id}/review`)}
            >
              <Text style={styles.actionButtonText}>Leave a Review</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          {loadingHistory ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : history.length === 0 ? (
            <Text style={styles.infoText}>No history available</Text>
          ) : (
            <View style={styles.timelineContainer}>
              {history.map((h: OrderStatusHistory, index: number) => (
                <View key={h.id} style={styles.timelineItem}>
                  <View style={styles.timelineLineContainer}>
                    <View style={[styles.timelineDot, { backgroundColor: getStatusColor(h.new_status) }]} />
                    {index < history.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineStatus}>
                      {getHistoryStatusLabel(h.new_status)}
                    </Text>
                    <Text style={styles.timelineTime}>
                      {new Date(h.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {isSpecialist && (
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            {canSpecialistConfirm && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={() => confirmStatusChange('confirmed', 'Confirm')}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>Confirm Order</Text>
              </TouchableOpacity>
            )}
            {canSpecialistStart && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.warning }]}
                onPress={() => confirmStatusChange('in_progress', 'Start')}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>Start Work</Text>
              </TouchableOpacity>
            )}
            {canSpecialistComplete && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={() => confirmStatusChange('done', 'Complete')}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>Mark as Done</Text>
              </TouchableOpacity>
            )}
            {canSpecialistCancel && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.error }]}
                onPress={() => confirmStatusChange('cancelled', 'Cancel')}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>Cancel Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isConsumer && canConsumerCancel && (
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={() => confirmStatusChange('cancelled', 'Cancel')}
              disabled={updating}
            >
              <Text style={styles.actionButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Action</Text>
            <Text style={styles.modalText}>
              Are you sure you want to {confirmAction?.label.toLowerCase()} this order?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  console.log('User cancelled action');
                  setShowConfirmModal(false);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonConfirm}
                onPress={() => {
                  if (confirmAction) {
                    handleStatusUpdate(confirmAction.status);
                  }
                }}
              >
                <Text style={styles.modalButtonConfirmText}>Confirm</Text>
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
  statusCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusLabel: {
    ...typography.bodySecondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...typography.h3,
    fontWeight: '700',
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  serviceTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  servicePrice: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    ...typography.body,
    fontWeight: '600',
  },
  personCity: {
    ...typography.bodySecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body,
  },
  commentText: {
    ...typography.body,
    lineHeight: 24,
  },
  actionsSection: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  timelineContainer: {
    marginTop: spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 50,
  },
  timelineLineContainer: {
    alignItems: 'center',
    width: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: -2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  timelineStatus: {
    ...typography.body,
    fontWeight: '600',
  },
  timelineTime: {
    ...typography.bodySecondary,
    fontSize: 12,
  },
});
