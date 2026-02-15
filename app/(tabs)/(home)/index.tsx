
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Category, Service } from '@/types/database';
import { getCategoryIcons, normalizeMaterialIconName } from '@/utils/categoryIcons';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('HomeScreen: Loading data');
    loadData();
  }, []);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured');
      setLoading(false);
      return;
    }

    try {
      const [categoriesResult, servicesResult] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true })
          .limit(8),
        supabase
          .from('services')
          .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
          .eq('is_active', true)
          .order('rating_avg', { ascending: false })
          .limit(6),
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (servicesResult.error) throw servicesResult.error;

      console.log('Data loaded successfully');
      setCategories(categoriesResult.data || []);
      setFeaturedServices(servicesResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    console.log('User tapped search');
    router.push('/search');
  };

  const handleCategoryPress = (categoryId: string) => {
    console.log('User tapped category:', categoryId);
    router.push(`/(tabs)/services?category=${categoryId}`);
  };

  const handleServicePress = (serviceId: string) => {
    console.log('User tapped service:', serviceId);
    router.push(`/service/${serviceId}`);
  };

  const handleAddListing = () => {
    console.log('User tapped Add Listing button');
    router.push('/create-listing');
  };

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.setupContainer}>
          <IconSymbol
            android_material_icon_name="cloud-off"
            ios_icon_name="cloud.slash"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={styles.setupTitle}>Supabase Not Configured</Text>
          <Text style={styles.setupDescription}>
            Please configure your Supabase credentials in app.json to use this app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome</Text>
            <Text style={styles.title}>Find Your Specialist</Text>
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <IconSymbol
              android_material_icon_name="search"
              ios_icon_name="magnifyingglass"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {categories.map((category) => {
              const icons = getCategoryIcons(category.name);
              const materialIconName = normalizeMaterialIconName(icons.icon_material);
              const categoryColor = category.color || colors.primary;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryCard, { borderColor: categoryColor }]}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
                    <IconSymbol
                      android_material_icon_name={materialIconName as any}
                      ios_icon_name={icons.icon_sf}
                      size={28}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>{category.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Services</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/services')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {featuredServices.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                android_material_icon_name="work-outline"
                ios_icon_name="briefcase"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>No services available yet</Text>
            </View>
          ) : (
            <View style={styles.servicesGrid}>
              {featuredServices.map((service) => {
                const specialistName = service.specialist?.full_name || 'Unknown';
                const categoryName = service.category?.name || 'Uncategorized';
                const ratingAvg = service.rating_avg || 0;
                const ratingCount = service.rating_count || 0;
                const priceText = `${service.currency} ${service.price.toFixed(2)}`;
                const ratingText = ratingCount > 0 ? `${ratingAvg.toFixed(1)} (${ratingCount})` : 'No ratings';

                return (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    onPress={() => handleServicePress(service.id)}
                  >
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle} numberOfLines={1}>
                        {service.title}
                      </Text>
                      {service.price > 0 && (
                        <Text style={styles.servicePrice}>{priceText}</Text>
                      )}
                    </View>

                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>

                    {/* Specialist Summary Row (Matching Services Tab) */}
                    <View style={styles.specialistSummary}>
                      <IconSymbol
                        ios_icon_name="person.circle.fill"
                        android_material_icon_name="account-circle"
                        size={32}
                        color={colors.primary}
                      />
                      <View style={styles.specialistInfo}>
                        <Text style={styles.specialistName}>{specialistName}</Text>
                        <View style={styles.ratingContainer}>
                          <IconSymbol
                            ios_icon_name="star.fill"
                            android_material_icon_name="star"
                            size={14}
                            color={colors.warning}
                          />
                          <Text style={styles.ratingText}>{ratingText}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.serviceFooter}>
                      <View style={styles.serviceInfo}>
                        <IconSymbol
                          ios_icon_name="tag.fill"
                          android_material_icon_name="label"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.serviceInfoText}>{categoryName}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button - Modern "List Service" Pill */}
      <TouchableOpacity style={styles.fabExtended} onPress={handleAddListing}>
        <IconSymbol
          android_material_icon_name="add"
          ios_icon_name="plus"
          size={24}
          color="#FFFFFF"
        />
        <Text style={styles.fabText}>List Service</Text>
      </TouchableOpacity>
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
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  setupDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categoryCard: {
    alignItems: 'center',
    width: 100,
    marginRight: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryName: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.text,
  },
  servicesGrid: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  serviceDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specialistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  specialistName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  fabExtended: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 100,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    gap: spacing.sm,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  specialistSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  serviceInfoText: {
    ...typography.caption,
  },
});
