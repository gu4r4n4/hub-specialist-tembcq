
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Service, Category } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import { getCategoryIcons, normalizeMaterialIconName } from '@/utils/categoryIcons';

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
    console.log('ServicesScreen: Loading services', { selectedCategory, location: params.location });
    loadData();
  }, [selectedCategory, params.location, params.search]);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const categoriesResult = await supabase.from('categories').select('*').order('display_order', { ascending: true, nullsFirst: false });

      let servicesQuery = supabase
        .from('services')
        .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
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
        console.log('Services loaded:', servicesResult.data.length);
        setServices(servicesResult.data);
      }
    } catch (error) {
      console.error('Exception loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    console.log('User tapped search');
    router.push('/search');
  };

  const handleServicePress = (serviceId: string) => {
    console.log('User tapped service:', serviceId);
    router.push(`/service/${serviceId}`);
  };

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Supabase not configured</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Services</Text>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <IconSymbol
            android_material_icon_name="search"
            ios_icon_name="magnifyingglass"
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Categories row: use a fixed-height wrapper + horizontal FlatList.
          This prevents a tall invisible touch area that blocks vertical scrolling on iOS. */}
      <View style={styles.categoriesWrapper} pointerEvents="box-none">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categoriesData}
          keyExtractor={(item: any) => item.id}
          style={styles.categoriesList}
          contentContainerStyle={styles.categoriesListContent}
          renderItem={({ item }: any) => {
            const isAll = item.id === 'all';
            const isActive = isAll ? !selectedCategory : selectedCategory === item.id;
            const categoryColor = (item.color || colors.primary) as string;

            const iconMapping = isAll ? null : getCategoryIcons(item.name);
            const iconMaterialRaw = isAll
              ? 'apps'
              : (iconMapping?.icon_material || item.icon_material || 'category');
            const iconMaterial = normalizeMaterialIconName(iconMaterialRaw);
            const iconSf = isAll
              ? 'square.grid.2x2'
              : (iconMapping?.icon_sf || item.icon_sf || 'square.grid.2x2');

            return (
              <TouchableOpacity
                style={[
                  styles.categoryCard,
                  isActive && styles.categoryCardActive,
                  isActive && { borderColor: categoryColor },
                ]}
                onPress={() => {
                  if (isAll) {
                    console.log('User selected All categories');
                    setSelectedCategory(null);
                  } else {
                    console.log('User selected category:', item.name);
                    setSelectedCategory(item.id);
                  }
                }}
              >
                <View
                  style={[
                    styles.categoryIconContainer,
                    { backgroundColor: isAll && isActive ? colors.primary : categoryColor },
                  ]}
                >
                  <IconSymbol
                    ios_icon_name={iconSf}
                    android_material_icon_name={iconMaterial as any}
                    size={26}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
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
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.servicesContent}
        >
          {services.length === 0 ? (
            <Text style={styles.emptyText}>No services found</Text>
          ) : (
            <React.Fragment>
              {services.map((service, index) => {
                const specialistName = service.specialist?.full_name || 'Unknown';
                const specialistCity = service.specialist?.city || '';
                const categoryName = service.category?.name || 'Uncategorized';
                const priceText = `${service.currency} ${service.price.toFixed(2)}`;
                const ratingText = service.rating_count > 0 ? `${service.rating_avg.toFixed(1)} (${service.rating_count})` : 'No ratings';

                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.serviceCard}
                    onPress={() => handleServicePress(service.id)}
                  >
                    <View style={styles.serviceHeader}>
                      <Text style={styles.serviceTitle}>{service.title}</Text>
                      {service.price > 0 && (
                        <Text style={styles.servicePrice}>{priceText}</Text>
                      )}
                    </View>
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>

                    {/* Specialist Summary Row */}
                    <View style={styles.specialistSummary}>
                      <IconSymbol
                        ios_icon_name="person.circle.fill"
                        android_material_icon_name="account-circle"
                        size={32}
                        color={colors.primary}
                      />
                      <View style={styles.specialistInfo}>
                        <Text style={styles.specialistName}>{specialistName}</Text>
                        <View style={styles.specialistRating}>
                          <IconSymbol
                            ios_icon_name="star.fill"
                            android_material_icon_name="star"
                            size={14}
                            color={colors.warning}
                          />
                          <Text style={styles.specialistRatingText}>{ratingText}</Text>
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
            </React.Fragment>
          )}
          {/* Spacer handled by styles.servicesContent paddingBottom */}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Fixed-height wrapper prevents the horizontal categories row from creating
  // a tall invisible touch area that blocks vertical scrolling.
  categoriesWrapper: {
    height: 112,
    marginBottom: spacing.sm,
  },
  categoriesList: {
    height: 112,
  },
  categoriesListContent: {
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    alignItems: 'flex-start',
  },
  // Match Home tab category card styling exactly
  categoryCard: {
    backgroundColor: colors.card,
    // Slightly tighter than Home to fit inside a smaller fixed-height categories row
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    alignSelf: 'flex-start',
    width: 120,
  },
  categoryCardActive: {
    borderWidth: 2,
  },
  categoryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    ...typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  // Avoid a large blank area at the top of the list on iOS (auto content inset)
  // and keep enough bottom space for the floating tab bar.
  servicesContent: {
    paddingTop: 0,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
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
  serviceCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  servicePrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  serviceDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.md,
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
  specialistInfo: {
    flex: 1,
  },
  specialistName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  specialistRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  specialistRatingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  serviceFooter: {
    flexDirection: 'row',
    gap: spacing.md,
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
