
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Order } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function OrdersScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('OrdersScreen: Loading orders');
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
        console.log('Orders loaded:', data?.length);
        setOrders(data || []);
      }
    } catch (error) {
      console.error('Exception loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderPress = (orderId: string) => {
    console.log('User tapped order:', orderId);
    router.push(`/order/${orderId}`);
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

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="list.bullet.rectangle"
            android_material_icon_name="receipt"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>Sign in to view orders</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              console.log('User tapped Sign In button');
              router.push('/auth/login');
            }}
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
              ios_icon_name="list.bullet.rectangle"
              android_material_icon_name="receipt"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              {profile?.role === 'consumer' ? 'Book a service to get started' : 'Orders will appear here when clients book your services'}
            </Text>
          </View>
        ) : (
          <React.Fragment>
            {orders.map((order, index) => {
              const serviceTitle = order.service?.title || 'Unknown Service';
              const otherPersonName = profile?.role === 'consumer' ? order.specialist?.full_name : order.consumer?.full_name;
              const otherPersonLabel = profile?.role === 'consumer' ? 'Specialist' : 'Client';
              const scheduledDate = new Date(order.scheduled_at).toLocaleDateString();
              const statusLabel = getStatusLabel(order.status);
              const statusColor = getStatusColor(order.status);

              return (
                <TouchableOpacity
                  key={index}
                  style={styles.orderCard}
                  onPress={() => handleOrderPress(order.id)}
                >
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderTitle}>{serviceTitle}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.orderInfo}>
                    <IconSymbol
                      ios_icon_name="person.fill"
                      android_material_icon_name="person"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.orderInfoText}>{otherPersonLabel}:</Text>
                    <Text style={styles.orderInfoText}>{otherPersonName}</Text>
                  </View>
                  <View style={styles.orderInfo}>
                    <IconSymbol
                      ios_icon_name="calendar"
                      android_material_icon_name="event"
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.orderInfoText}>{scheduledDate}</Text>
                  </View>
                  {order.address && (
                    <View style={styles.orderInfo}>
                      <IconSymbol
                        ios_icon_name="location.fill"
                        android_material_icon_name="location-on"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.orderInfoText} numberOfLines={1}>
                        {order.address}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </React.Fragment>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
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
    paddingTop: 48,
  },
  title: {
    ...typography.h1,
  },
  subtitle: {
    ...typography.bodySecondary,
    marginTop: spacing.xs,
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
    paddingTop: spacing.xl * 2,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  orderTitle: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  orderInfoText: {
    ...typography.bodySecondary,
  },
});
