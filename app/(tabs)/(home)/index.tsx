
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category, Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function HomeScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        supabase.from('categories').select('*').order('name'),
        supabase
          .from('services')
          .select('*, specialist:profiles!specialist_profile_id(*), category:categories(*)')
          .eq('is_active', true)
          .order('rating_avg', { ascending: false })
          .limit(6),
      ]);

      if (categoriesResult.error) {
        console.error('Error loading categories:', categoriesResult.error);
      } else {
        console.log('Categories loaded:', categoriesResult.data?.length);
        setCategories(categoriesResult.data || []);
      }

      if (servicesResult.error) {
        console.error('Error loading services:', servicesResult.error);
      } else {
        console.log('Featured services loaded:', servicesResult.data?.length);
        setFeaturedServices(servicesResult.data || []);
      }
    } catch (error) {
      console.error('Exception loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    console.log('User tapped search with query:', searchQuery);
    router.push(`/(tabs)/services?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleCategoryPress = (categoryId: string) => {
    console.log('User tapped category:', categoryId);
    router.push(`/(tabs)/services?category=${categoryId}`);
  };

  const handleServicePress = (serviceId: string) => {
    console.log('User tapped service:', serviceId);
    router.push(`/service/${serviceId}`);
  };

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={64}
            color={colors.warning}
          />
          <Text style={styles.errorTitle}>Supabase Not Configured</Text>
          <Text style={styles.errorText}>
            Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment variables.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const greetingText = user ? `Hello, ${profile?.full_name || 'there'}!` : 'Welcome to HUB SPECIALIST';
  const subtitleText = user ? 'Find the perfect service for your needs' : 'Sign in to book services';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greetingText}</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
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

        {!user && (
          <View style={styles.authPrompt}>
            <Text style={styles.authPromptText}>Sign in to book services and manage orders</Text>
            <TouchableOpacity
              style={styles.authButton}
              onPress={() => {
                console.log('User tapped Sign In button');
                router.push('/auth/login');
              }}
            >
              <Text style={styles.authButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyText}>No categories available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
              {categories.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.categoryCard}
                  onPress={() => handleCategoryPress(category.id)}
                >
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Services</Text>
          {featuredServices.length === 0 ? (
            <Text style={styles.emptyText}>No services available</Text>
          ) : (
            <React.Fragment>
              {featuredServices.map((service, index) => {
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
        </View>

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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySecondary,
    textAlign: 'center',
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  greeting: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
  authPrompt: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  authPromptText: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  authButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  categoriesScroll: {
    paddingLeft: spacing.lg,
  },
  categoryCard: {
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryName: {
    ...typography.body,
    fontWeight: '600',
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
