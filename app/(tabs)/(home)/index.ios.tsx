
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
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
    console.log('HomeScreen (iOS): Loading data');
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
    router.push('/add-listing');
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
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol
              android_material_icon_name="search"
              ios_icon_name="magnifyingglass"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services..."
              placeholderTextColor={colors.textSecondary}
              onFocus={handleSearch}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {categories.map((category) => {
              const icons = getCategoryIcons(category);
              const materialIconName = normalizeMaterialIconName(icons.icon_material);
              const categoryColor = category.color || colors.primary;

              return (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryCard}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: `${categoryColor}20` }]}>
                    <IconSymbol
                      android_material_icon_name={materialIconName}
                      ios_icon_name={icons.icon_sf}
                      size={32}
                      color={categoryColor}
                    />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
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
                const priceDisplay = service.price > 0 ? `${service.currency} ${service.price}` : 'Price on request';

                return (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.serviceCard}
                    onPress={() => handleServicePress(service.id)}
                  >
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle} numberOfLines={2}>
                        {service.title}
                      </Text>
                      <Text style={styles.servicePrice}>{priceDisplay}</Text>
                    </View>

                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>

                    <View style={styles.serviceFooter}>
                      {service.rating_count > 0 && (
                        <View style={styles.ratingContainer}>
                          <IconSymbol
                            android_material_icon_name="star"
                            ios_icon_name="star.fill"
                            size={14}
                            color={colors.warning}
                          />
                          <Text style={styles.ratingText}>{service.rating_avg.toFixed(1)}</Text>
                          <Text style={styles.ratingCount}>({service.rating_count})</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddListing}>
        <IconSymbol
          android_material_icon_name="add"
          ios_icon_name="plus"
          size={28}
          color={colors.background}
        />
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
    padding: spacing.lg,
  },
  greeting: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
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
    width: 80,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
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
  ratingCount: {
    fontSize: 12,
    color: colors.textSecondary,
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
