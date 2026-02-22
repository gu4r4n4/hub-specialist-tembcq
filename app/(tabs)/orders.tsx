import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

export default function OrdersScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const loadOrders = async () => {
    if (!isSupabaseConfigured || !profile) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)');

      if (profile.role === 'consumer') {
        query = query.eq('consumer_profile_id', profile.id);
      } else {
        query = query.eq('specialist_profile_id', profile.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading orders:', error);
      } else {
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Exception loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPress = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/order/${orderId}`);
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      new: colors.info,
      confirmed: colors.success,
      in_progress: colors.warning,
      done: colors.textTertiary,
      cancelled: colors.error,
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

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol
              ios_icon_name="lock.fill"
              android_material_icon_name="lock"
              size={48}
              color={colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>Sign in to view orders</Text>
          <Text style={styles.emptyText}>You need to be logged in to track your service requests.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const roleText = profile?.role === 'consumer' ? 'Your Bookings' : 'Your Jobs';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>{roleText}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol
              ios_icon_name="receipt"
              android_material_icon_name="receipt"
              size={64}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              {profile?.role === 'consumer' ? 'Book a service to get started' : 'Orders will appear here when clients book your services'}
            </Text>
          </View>
        ) : (
          <React.Fragment>
            {orders.map((order) => {
              const serviceTitle = order.service?.title || 'Unknown Service';
              const otherPersonName = profile?.role === 'consumer' ? order.specialist?.full_name : order.consumer?.full_name;
              const scheduledDate = new Date(order.scheduled_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const statusLabel = getStatusLabel(order.status);
              const statusColor = getStatusColor(order.status);

              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => handleOrderPress(order.id)}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.titleContainer}>
                      <Text style={styles.orderTitle} numberOfLines={1}>{serviceTitle}</Text>
                      <Text style={styles.otherPersonName}>{otherPersonName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '10' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  <View style={styles.orderFooter}>
                    <View style={styles.infoRow}>
                      <IconSymbol ios_icon_name="calendar" android_material_icon_name="event" size={14} color={colors.textSecondary} />
                      <Text style={styles.infoText}>{scheduledDate}</Text>
                    </View>
                    {order.address && (
                      <View style={styles.infoRow}>
                        <IconSymbol ios_icon_name="mappin" android_material_icon_name="location-on" size={14} color={colors.textSecondary} />
                        <Text style={styles.infoText} numberOfLines={1}>{order.address}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </React.Fragment>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
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
  subtitle: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: -4,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.md,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  orderTitle: {
    ...typography.h3,
    fontSize: 17,
  },
  otherPersonName: {
    ...typography.bodySecondary,
    fontSize: 13,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  infoText: {
    ...typography.caption,
    fontSize: 12,
  },
});
