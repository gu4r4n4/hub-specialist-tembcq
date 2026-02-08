
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category, Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import { getCategoryIcons, normalizeMaterialIconName } from '@/utils/categoryIcons';

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
      console.log('Supabase not configured - showing demo mode');
      setLoading(false);
      return;
    }

    try {
      const [categoriesResult, servicesResult] = await Promise.all([
        supabase.from('categories').select('*').order('display_order', { ascending: true, nullsFirst: false }),
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

  // Show setup instructions if Supabase is not configured
  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.setupContainer}>
          <IconSymbol
            ios_icon_name="wrench.and.screwdriver.fill"
            android_material_icon_name="build"
            size={80}
            color={colors.primary}
          />
          <Text style={styles.setupTitle}>Welcome to SpecHUB</Text>
          <Text style={styles.setupSubtitle}>A Services Marketplace</Text>
          
          <View style={styles.setupCard}>
            <Text style={styles.setupCardTitle}>Setup Required</Text>
            <Text style={styles.setupCardText}>
              To get started, you need to configure your Supabase database:
            </Text>
            
            <View style={styles.setupSteps}>
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Create a Supabase project at supabase.com</Text>
              </View>
              
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>Run the SQL setup from SUPABASE_SETUP.md</Text>
              </View>
              
              <View style={styles.setupStep}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Add your credentials to app.json under "extra"</Text>
              </View>
            </View>
          </View>

          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>What you&apos;ll get:</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.success}
                />
                <Text style={styles.featureText}>Browse services by category</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.success}
                />
                <Text style={styles.featureText}>Book appointments with specialists</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.success}
                />
                <Text style={styles.featureText}>Track your orders in real-time</Text>
              </View>
              <View style={styles.featureItem}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.success}
                />
                <Text style={styles.featureText}>Manage your profile and services</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.docsButton}
            onPress={() => console.log('User wants to view documentation')}
          >
            <IconSymbol
              ios_icon_name="doc.text.fill"
              android_material_icon_name="description"
              size={20}
              color="#FFFFFF"
            />
            <Text style={styles.docsButtonText}>View Setup Documentation</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const greetingText = user ? `Hello, ${profile?.full_name || 'there'}!` : 'Welcome to SpecHUB';
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
              {categories.map((category, index) => {
                const categoryColor = category.color || colors.primary;
                
                // Prefer our mapping (consistent UI), fallback to DB values.
                // Also normalize Material icon names (supports both underscore and hyphen sources).
                const iconMapping = getCategoryIcons(category.name);
                const iconMaterialRaw = iconMapping.icon_material || category.icon_material || 'category';
                const iconMaterial = normalizeMaterialIconName(iconMaterialRaw);
                const iconSf = iconMapping.icon_sf || category.icon_sf || 'square.grid.2x2';

                return (
                  <React.Fragment key={index}>
                    <TouchableOpacity
                      style={[styles.categoryCard, { borderColor: categoryColor }]}
                      onPress={() => handleCategoryPress(category.id)}
                    >
                      <View style={[styles.categoryIconContainer, { backgroundColor: categoryColor }]}>
                        <IconSymbol
                          ios_icon_name={iconSf}
                          android_material_icon_name={iconMaterial as any}
                          size={28}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.categoryName} numberOfLines={2}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
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
                const specialistCity = service.specialist?.city || '';
                const categoryName = service.category?.name || 'Uncategorized';
                const priceText = `${service.currency} ${service.price.toFixed(2)}`;
                const ratingText = service.rating_count > 0 ? `${service.rating_avg.toFixed(1)} (${service.rating_count})` : 'No ratings';

                return (
                  <React.Fragment key={index}>
                    <TouchableOpacity
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
                  </React.Fragment>
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
  setupContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  setupTitle: {
    ...typography.h1,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  setupSubtitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  setupCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setupCardTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  setupCardText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  setupSteps: {
    gap: spacing.md,
  },
  setupStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    flex: 1,
    paddingTop: 4,
  },
  featuresCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuresTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  featuresList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.body,
    flex: 1,
  },
  docsButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  docsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    width: 120,
  },
  categoryIconContainer: {
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
