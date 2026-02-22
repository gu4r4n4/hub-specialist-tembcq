import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Service, Category } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import { getCategoryIcons, normalizeMaterialIconName } from '@/utils/categoryIcons';
import * as Haptics from 'expo-haptics';

export default function ServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>((params.category as string) || null);

  const categoriesData = useMemo(() => {
    return [{ id: 'all', name: 'All' } as any, ...categories];
  }, [categories]);

  useEffect(() => {
    if (params.category) {
      setSelectedCategory(params.category as string);
    } else if (params.category === '') {
      setSelectedCategory(null);
    }
  }, [params.category]);

  useEffect(() => {
    loadData();
  }, [selectedCategory, params.location, params.search]);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const categoriesResult = await supabase.from('categories').select('*').order('display_order', { ascending: true, nullsFirst: false });

      let servicesQuery = supabase
        .from('services')
        .select('*, specialist:profiles!specialist_profile_id(*, portfolio:specialist_portfolio_images(*)), category:categories(*)')
        .eq('is_active', true);

      if (selectedCategory && selectedCategory !== 'all') {
        servicesQuery = servicesQuery.eq('category_id', selectedCategory);
      }

      if (params.location && params.location !== '') {
        servicesQuery = servicesQuery.eq('city', params.location);
      }

      if (params.search) {
        servicesQuery = servicesQuery.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
      }

      const servicesResult = await servicesQuery.order('rating_avg', { ascending: false });

      if (categoriesResult.data) {
        setCategories(categoriesResult.data);
      }

      if (servicesResult.data) {
        setServices(servicesResult.data);
      }
    } catch (error) {
      console.error('Exception loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/search');
  };

  const handleServicePress = (serviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/service/${serviceId}`);
  };

  const toggleCategory = (id: string | null) => {
    Haptics.selectionAsync();
    setSelectedCategory(id === 'all' ? null : id);
  };

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Configuration Required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Services</Text>
          {params.location && (
            <Text style={styles.subtitle}>in {params.location}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <IconSymbol
            android_material_icon_name="search"
            ios_icon_name="magnifyingglass"
            size={22}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.categoriesWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categoriesData}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.categoriesListContent}
          renderItem={({ item }: any) => {
            const isAll = item.id === 'all';
            const isActive = isAll ? !selectedCategory : selectedCategory === item.id;

            return (
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  isActive && styles.categoryPillActive,
                ]}
                onPress={() => toggleCategory(item.id)}
              >
                <Text style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive
                ]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.servicesContent}
        >
          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol ios_icon_name="magnifyingglass" android_material_icon_name="search_off" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No services found matching your criteria</Text>
            </View>
          ) : (
            services.map((service) => {
              const specialistName = service.specialist?.full_name || 'Unknown';
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
                    <Text style={styles.serviceTitle} numberOfLines={1}>{service.title}</Text>
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

                  <View style={styles.specialistRow}>
                    <View style={styles.specialistAvatar}>
                      <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.specialistInfo}>
                      <Text style={styles.specialistName}>{specialistName}</Text>
                      <View style={styles.ratingRow}>
                        <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={14} color={colors.warning} />
                        <Text style={styles.ratingText}>{ratingText}</Text>
                      </View>
                    </View>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{service.category?.name}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesWrapper: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
  },
  categoriesListContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    ...typography.bodySecondary,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  servicesContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  serviceCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  serviceTitle: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardImageContainer: {
    width: '100%',
    height: 180,
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
    fontWeight: '800',
    color: colors.text,
  },
  serviceDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  specialistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  specialistAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...typography.caption,
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  categoryBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodySecondary,
  },
});
