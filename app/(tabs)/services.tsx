
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Service, Category } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function ServicesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState((params.search as string) || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>((params.category as string) || null);

  useEffect(() => {
    console.log('ServicesScreen: Loading services');
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    try {
      const categoriesResult = await supabase.from('categories').select('*').order('name');
      
      let servicesQuery = supabase
        .from('services')
        .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
        .eq('is_active', true);

      if (selectedCategory) {
        servicesQuery = servicesQuery.eq('category_id', selectedCategory);
      }

      if (searchQuery) {
        servicesQuery = servicesQuery.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
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
    console.log('User searched for:', searchQuery);
    loadData();
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
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <IconSymbol
            ios_icon_name="magnifyingglass"
            android_material_icon_name="search"
            size={20}
            color={colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => {
            console.log('User selected All categories');
            setSelectedCategory(null);
          }}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>All</Text>
        </TouchableOpacity>
        {categories.map((category, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.categoryChip, selectedCategory === category.id && styles.categoryChipActive]}
            onPress={() => {
              console.log('User selected category:', category.name);
              setSelectedCategory(category.id);
            }}
          >
            <Text style={[styles.categoryChipText, selectedCategory === category.id && styles.categoryChipTextActive]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {services.length === 0 ? (
            <Text style={styles.emptyText}>No services found</Text>
          ) : (
            <React.Fragment>
              {services.map((service, index) => {
                const specialistName = service.specialist?.full_name || 'Unknown';
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
                      <Text style={styles.servicePrice}>{priceText}</Text>
                    </View>
                    <Text style={styles.serviceDescription} numberOfLines={2}>
                      {service.description}
                    </Text>
                    <View style={styles.serviceFooter}>
                      <View style={styles.serviceInfo}>
                        <IconSymbol
                          ios_icon_name="person.fill"
                          android_material_icon_name="person"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.serviceInfoText}>{specialistName}</Text>
                      </View>
                      <View style={styles.serviceInfo}>
                        <IconSymbol
                          ios_icon_name="tag.fill"
                          android_material_icon_name="label"
                          size={16}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.serviceInfoText}>{categoryName}</Text>
                      </View>
                      <View style={styles.serviceInfo}>
                        <IconSymbol
                          ios_icon_name="star.fill"
                          android_material_icon_name="star"
                          size={16}
                          color={colors.warning}
                        />
                        <Text style={styles.serviceInfoText}>{ratingText}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </React.Fragment>
          )}
          <View style={{ height: 100 }} />
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
    padding: spacing.lg,
    paddingTop: 48,
  },
  title: {
    ...typography.h1,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingLeft: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryChip: {
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.body,
    color: colors.text,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
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
