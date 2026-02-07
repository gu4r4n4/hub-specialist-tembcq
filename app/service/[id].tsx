
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function ServiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user, profile } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('ServiceDetailScreen: Loading service', id);
    loadService();
  }, [id]);

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
  const canBook = user && profile?.role === 'consumer';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: service.title }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{service.title}</Text>
          <Text style={styles.price}>{priceText}</Text>
        </View>

        <View style={styles.infoRow}>
          <IconSymbol
            ios_icon_name="star.fill"
            android_material_icon_name="star"
            size={20}
            color={colors.warning}
          />
          <Text style={styles.infoText}>{ratingText}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{service.description}</Text>
        </View>

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
});
