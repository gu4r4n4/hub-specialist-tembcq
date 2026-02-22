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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

function CategoryCard({ category, onPress }: { category: Category; onPress: () => void }) {
  const scale = useSharedValue(1);
  const icons = getCategoryIcons(category.name);
  const materialIconName = normalizeMaterialIconName(icons.icon_material);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[styles.categoryCard, animatedStyle]}>
        <View style={[styles.categoryIcon, { backgroundColor: colors.primaryLight }]}>
          <IconSymbol
            android_material_icon_name={materialIconName as any}
            ios_icon_name={icons.icon_sf}
            size={28}
            color={colors.primary}
          />
        </View>
        <Text style={styles.categoryName} numberOfLines={2}>{category.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const [categoriesResult, servicesResult] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true })
          .limit(10),
        supabase
          .from('services')
          .select('*, specialist:profiles!specialist_profile_id(*, portfolio:specialist_portfolio_images(*)), category:categories(*)')
          .eq('is_active', true)
          .order('rating_avg', { ascending: false })
          .limit(6),
      ]);

      if (categoriesResult.error) throw categoriesResult.error;
      if (servicesResult.error) throw servicesResult.error;

      setCategories(categoriesResult.data || []);
      setFeaturedServices(servicesResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/search');
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push(`/(tabs)/services?category=${categoryId}`);
  };

  const handleServicePress = (serviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/service/${serviceId}`);
  };

  const handleAddListing = () => {
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
            color={colors.textTertiary}
          />
          <Text style={styles.setupTitle}>Connection Required</Text>
          <Text style={styles.setupDescription}>
            Please check your internet connection or Supabase settings.
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
        <View style={styles.banner}>
          <Text style={styles.greeting}>Profi.uy</Text>
          <Text style={styles.title}>All specialists{"\n"}in one place</Text>

          <TouchableOpacity style={styles.searchBar} onPress={handleSearch} activeOpacity={0.9}>
            <IconSymbol
              android_material_icon_name="search"
              ios_icon_name="magnifyingglass"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.searchText}>What service do you need?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Categories</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onPress={() => handleCategoryPress(category.id)}
              />
            ))}
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
                color={colors.textTertiary}
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

                    {(() => {
                      const portfolio = (service.specialist as any)?.portfolio || [];
                      if (portfolio.length > 0) {
                        // Use a deterministic index based on service ID for stable "random" image
                        const imageIndex = service.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % portfolio.length;
                        const randomImage = portfolio[imageIndex].image_url;
                        return (
                          <View style={styles.cardImageContainer}>
                            <Image source={{ uri: randomImage }} style={styles.cardImage} />
                          </View>
                        );
                      }
                      return null;
                    })()}

                    <View style={styles.specialistSummary}>
                      <IconSymbol
                        ios_icon_name="person.circle.fill"
                        android_material_icon_name="account-circle"
                        size={24}
                        color={colors.primary}
                      />
                      <View style={styles.specialistInfo}>
                        <Text style={styles.specialistName}>{specialistName}</Text>
                        <View style={styles.ratingContainer}>
                          <IconSymbol
                            ios_icon_name="star.fill"
                            android_material_icon_name="star"
                            size={12}
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
                          size={14}
                          color={colors.textTertiary}
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

        <View style={{ height: 120 }} />
      </ScrollView>

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
  banner: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  greeting: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 38,
    marginBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 15,
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
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  setupDescription: {
    ...typography.bodySecondary,
    textAlign: 'center',
    lineHeight: 22,
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
    ...typography.h3,
    fontSize: 18,
  },
  seeAllText: {
    ...typography.bodySecondary,
    color: colors.text,
    fontWeight: '600',
  },
  categoriesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categoryCard: {
    alignItems: 'center',
    width: 100,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
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
    fontSize: 11,
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
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  serviceTitle: {
    ...typography.h3,
    fontSize: 17,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardImageContainer: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundSecondary,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  servicePrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  serviceDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  specialistSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceInfoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
  },
  fabExtended: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 110,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    gap: spacing.sm,
    zIndex: 100,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
