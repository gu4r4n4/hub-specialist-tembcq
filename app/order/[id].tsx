import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Order, OrderStatus, OrderStatusHistory } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [canLeaveReview, setCanLeaveReview] = useState(false);

  useEffect(() => {
    if (id) {
      loadOrder();
      loadHistory();
      checkReviewEligibility();
    }
  }, [id, profile?.id]);

  const loadOrder = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
      .eq('id', id)
      .single();
    if (data) setOrder(data);
    setLoading(false);
  };

  const loadHistory = async () => {
    if (!id) return;
    const { data } = await supabase.from('order_status_history').select('*').eq('order_id', id).order('created_at', { ascending: false });
    if (data) setHistory(data);
  };

  const checkReviewEligibility = async () => {
    if (!id || profile?.role !== 'consumer') return;
    const { data: existing } = await supabase.from('service_reviews').select('id').eq('order_id', id).maybeSingle();
    setCanLeaveReview(!existing);
  };

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdating(true);
    try {
      const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
      if (!error) {
        loadOrder();
        loadHistory();
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isConsumer = profile?.role === 'consumer';
  const isSpecialist = profile?.role === 'specialist';
  const scheduledDate = new Date(order.scheduled_at).toLocaleDateString();
  const scheduledTime = new Date(order.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Order Details</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={styles.statusText}>{order.status.toUpperCase().replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Service Info</Text>
          <Text style={styles.serviceTitle}>{order.service?.title}</Text>
          <Text style={styles.price}>{order.service?.currency} {order.service?.price.toFixed(2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isConsumer ? 'Specialist' : 'Client'}</Text>
          <View style={styles.personRow}>
            <View style={styles.avatar}>
              <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.primary} />
            </View>
            <View style={styles.personInfo}>
              <Text style={styles.personName}>{isConsumer ? order.specialist?.full_name : order.consumer?.full_name}</Text>
              <Text style={styles.personCity}>{isConsumer ? order.specialist?.city : order.consumer?.city || 'No location'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduling</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoLine}>
              <IconSymbol ios_icon_name="calendar" android_material_icon_name="event" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{scheduledDate}</Text>
            </View>
            <View style={styles.infoLine}>
              <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{scheduledTime}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address & Comments</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>{order.address}</Text>
            {order.comment && <Text style={[styles.infoText, { marginTop: 8, color: colors.textSecondary }]}>{order.comment}</Text>}
          </View>
        </View>

        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status History</Text>
            <View style={styles.historyCard}>
              {history.map((item, index) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.timeline}>
                    <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                    {index < history.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyStatus, index === 0 && styles.historyStatusActive]}>
                      {item.new_status.toUpperCase().replace('_', ' ')}
                    </Text>
                    <Text style={styles.historyDate}>
                      {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {isConsumer && order.status === 'done' && canLeaveReview && (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push(`/order/${order.id}/review`)}>
              <Text style={styles.primaryBtnText}>Leave a Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSpecialist && order.status === 'new' && (
          <View style={styles.actionSection}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleStatusUpdate('confirmed')} disabled={updating}>
              <Text style={styles.primaryBtnText}>Confirm Order</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  navTitle: {
    flex: 1,
    ...typography.h3,
    fontSize: 18,
    textAlign: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  statusText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  serviceTitle: {
    ...typography.h2,
    fontSize: 22,
    marginBottom: 4,
  },
  price: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontWeight: '700',
    fontSize: 16,
  },
  personCity: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  infoBox: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoText: {
    ...typography.body,
    fontWeight: '600',
  },
  actionSection: {
    paddingHorizontal: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  historyCard: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyItem: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeline: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginTop: 4,
    zIndex: 2,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
    ringWidth: 4,
    ringColor: colors.primaryLight,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  historyContent: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  historyStatus: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  historyStatusActive: {
    color: colors.text,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
