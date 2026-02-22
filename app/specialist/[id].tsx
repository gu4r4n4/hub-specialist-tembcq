
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, Image, ImageSourcePropType, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile, SpecialistPortfolioImage, Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

// Helper to resolve image sources (handles both local and remote URLs)
function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

export default function SpecialistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [specialist, setSpecialist] = useState<Profile | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<SpecialistPortfolioImage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    console.log('SpecialistDetailScreen: Loading specialist', id);
    loadSpecialist();
    loadPortfolio();
    loadServices();
  }, [id]);

  const loadSpecialist = async () => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading specialist:', error);
      } else {
        console.log('Specialist loaded:', data);
        setSpecialist(data);
      }
    } catch (error) {
      console.error('Exception loading specialist:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortfolio = async () => {
    if (!isSupabaseConfigured || !id) {
      setPortfolioLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('specialist_portfolio_images')
        .select('*')
        .eq('specialist_profile_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading portfolio:', error);
      } else {
        console.log('Portfolio images loaded:', data?.length || 0);
        setPortfolioImages(data || []);
      }
    } catch (error) {
      console.error('Exception loading portfolio:', error);
    } finally {
      setPortfolioLoading(false);
    }
  };

  const loadServices = async () => {
    if (!isSupabaseConfigured || !id) {
      setServicesLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, category:categories(*)')
        .eq('specialist_profile_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading services:', error);
      } else {
        console.log('Services loaded:', data?.length || 0);
        setServices(data || []);
      }
    } catch (error) {
      console.error('Exception loading services:', error);
    } finally {
      setServicesLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>Loading...</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!specialist) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>Error</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Specialist not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate aggregated rating from specialist's services
  const ratingAvg = services.length > 0
    ? services.reduce((sum, s) => sum + (s.rating_avg * s.rating_count), 0) / services.reduce((sum, s) => sum + s.rating_count, 0)
    : 0;
  const ratingCount = services.reduce((sum, s) => sum + s.rating_count, 0);
  const ratingText = ratingCount > 0 ? `${ratingAvg.toFixed(1)} (${ratingCount} reviews)` : 'No ratings yet';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom NavBar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>Pro Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          {specialist.avatar_url ? (
            <Image source={{ uri: specialist.avatar_url }} style={styles.specialistAvatar} />
          ) : (
            <View style={styles.specialistAvatarPlaceholder}>
              <IconSymbol
                ios_icon_name="person.fill"
                android_material_icon_name="person"
                size={50}
                color={colors.primary}
              />
            </View>
          )}
          <Text style={styles.name}>{specialist.full_name}</Text>
          {specialist.city && <Text style={styles.city}>{specialist.city}</Text>}

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <IconSymbol
              ios_icon_name="star.fill"
              android_material_icon_name="star"
              size={20}
              color={colors.warning}
            />
            <Text style={styles.ratingText}>{ratingText}</Text>
          </View>
        </View>

        {/* Bio Section */}
        {specialist.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{specialist.bio}</Text>
          </View>
        )}

        {/* Portfolio Gallery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio</Text>
          {portfolioLoading ? (
            <View style={styles.portfolioLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : portfolioImages.length === 0 ? (
            <View style={styles.emptyPortfolioContainer}>
              <IconSymbol
                ios_icon_name="photo.on.rectangle"
                android_material_icon_name="photo-library"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyPortfolioText}>No portfolio yet</Text>
            </View>
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={portfolioImages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.portfolioList}
              renderItem={({ item }) => (
                <View style={styles.portfolioItem}>
                  <Image
                    source={resolveImageSource(item.image_url)}
                    style={styles.portfolioImage}
                    resizeMode="cover"
                  />
                  {item.title && (
                    <Text style={styles.portfolioTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>

        {/* Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          {servicesLoading ? (
            <View style={styles.servicesLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : services.length === 0 ? (
            <Text style={styles.emptyServicesText}>No services available</Text>
          ) : (
            <React.Fragment>
              {services.map((service, index) => {
                const categoryName = service.category?.name || 'Uncategorized';
                const priceText = `${service.currency} ${service.price.toFixed(2)}`;
                const serviceRatingText = service.rating_count > 0
                  ? `${service.rating_avg.toFixed(1)} (${service.rating_count})`
                  : 'No ratings';

                return (
                  <React.Fragment key={index}>
                    <TouchableOpacity
                      style={styles.serviceCard}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        console.log('User tapped service:', service.id);
                        router.push(`/service/${service.id}`);
                      }}
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

                      {/* Portfolio Random Image */}
                      {(() => {
                        if (portfolioImages.length > 0) {
                          // Deterministic random image from the specialist's portfolio
                          const imageIndex = (service.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + index) % portfolioImages.length;
                          const randomImage = portfolioImages[imageIndex].image_url;
                          return (
                            <View style={styles.cardImageContainer}>
                              <Image source={{ uri: randomImage }} style={styles.cardImage} />
                            </View>
                          );
                        }
                        return null;
                      })()}
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
                        <View style={styles.serviceInfo}>
                          <IconSymbol
                            ios_icon_name="star.fill"
                            android_material_icon_name="star"
                            size={16}
                            color={colors.warning}
                          />
                          <Text style={styles.serviceInfoText}>{serviceRatingText}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  navTitle: {
    flex: 1,
    ...typography.h3,
    fontSize: 18,
    textAlign: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: colors.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specialistAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.backgroundSecondary,
  },
  specialistAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.backgroundSecondary,
  },
  name: {
    ...typography.h1,
    marginTop: spacing.md,
  },
  city: {
    ...typography.bodySecondary,
    marginTop: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingText: {
    ...typography.body,
    fontWeight: '600',
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  bio: {
    ...typography.body,
    lineHeight: 24,
  },
  portfolioLoadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyPortfolioContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyPortfolioText: {
    ...typography.bodySecondary,
    marginTop: spacing.sm,
  },
  portfolioList: {
    paddingRight: spacing.lg,
  },
  portfolioItem: {
    marginRight: spacing.md,
    width: 140,
  },
  portfolioImage: {
    width: 140,
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
  },
  portfolioTitle: {
    ...typography.caption,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  servicesLoadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyServicesText: {
    ...typography.bodySecondary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  serviceCard: {
    backgroundColor: colors.card,
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
