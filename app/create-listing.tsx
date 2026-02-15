
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types/database';

type ListingType = 'hire' | 'service';

export default function AddListingScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Form data
  const [listingType, setListingType] = useState<ListingType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('AddListingScreen: Loading categories');
    loadCategories();
  }, []);

  const loadCategories = async () => {
    if (!isSupabaseConfigured) {
      console.log('Supabase not configured');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      console.log('Categories loaded:', data?.length);
      setCategories(data || []);
    } catch (err: any) {
      console.error('Error loading categories:', err);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    console.log('User tapped Next button, current step:', currentStep);

    // Validation for each step
    if (currentStep === 1 && !listingType) {
      setError('Please select a listing type');
      return;
    }
    if (currentStep === 2 && !selectedCategory) {
      setError('Please select a category');
      return;
    }
    if (currentStep === 3 && !location.trim()) {
      setError('Please enter a location');
      return;
    }
    if (currentStep === 4 && priceEnabled && !price.trim()) {
      setError('Please enter a price or disable pricing');
      return;
    }
    if (currentStep === 5 && (!title.trim() || !description.trim())) {
      setError('Please fill in all fields');
      return;
    }

    setError('');

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    console.log('User tapped Back button');
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    console.log('User tapped Post button, checking auth status');

    // Check if user is logged in
    if (!user || !profile) {
      console.log('User not logged in, redirecting to login');
      router.push('/auth/login');
      return;
    }

    console.log('User is logged in, submitting listing');
    setSubmitting(true);
    setError('');

    try {
      const serviceData = {
        specialist_profile_id: profile.id,
        category_id: selectedCategory,
        title: title.trim(),
        description: description.trim(),
        price: priceEnabled ? parseFloat(price) : 0,
        currency: priceEnabled ? currency : 'USD',
        is_active: true,
      };

      console.log('Creating service with data:', serviceData);

      const { data, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();

      if (error) throw error;

      console.log('Service created successfully:', data.id);

      // Navigate to the created service
      router.replace(`/service/${data.id}`);
    } catch (err: any) {
      console.error('Error creating service:', err);
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    return (
      <View style={styles.stepIndicator}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <View key={stepNumber} style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  isActive && styles.stepCircleActive,
                  isCompleted && styles.stepCircleCompleted,
                ]}
              >
                {isCompleted ? (
                  <IconSymbol
                    android_material_icon_name="check"
                    ios_icon_name="checkmark"
                    size={16}
                    color={colors.background}
                  />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      isActive && styles.stepNumberActive,
                    ]}
                  >
                    {stepNumber}
                  </Text>
                )}
              </View>
              {index < totalSteps - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    isCompleted && styles.stepLineCompleted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderStep1 = () => {
    const stepTitle = 'Select Listing Type';
    const stepDescription = 'Are you looking to hire someone or offer a service?';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionCard,
              listingType === 'hire' && styles.optionCardSelected,
            ]}
            onPress={() => {
              console.log('User selected: hire');
              setListingType('hire');
              setError('');
            }}
          >
            <IconSymbol
              android_material_icon_name="person-search"
              ios_icon_name="person.crop.circle.badge.plus"
              size={48}
              color={listingType === 'hire' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.optionTitle,
                listingType === 'hire' && styles.optionTitleSelected,
              ]}
            >
              Hire
            </Text>
            <Text style={styles.optionDescription}>
              Looking for a specialist
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionCard,
              listingType === 'service' && styles.optionCardSelected,
            ]}
            onPress={() => {
              console.log('User selected: service');
              setListingType('service');
              setError('');
            }}
          >
            <IconSymbol
              android_material_icon_name="work"
              ios_icon_name="briefcase.fill"
              size={48}
              color={listingType === 'service' ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.optionTitle,
                listingType === 'service' && styles.optionTitleSelected,
              ]}
            >
              Service
            </Text>
            <Text style={styles.optionDescription}>
              Offering my services
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep2 = () => {
    const stepTitle = 'Select Category';
    const stepDescription = 'What type of service is this?';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <ScrollView style={styles.categoriesScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.categoriesGrid}>
              {categories.map((category: Category) => {
                const isSelected = selectedCategory === category.id;

                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                    ]}
                    onPress={() => {
                      console.log('User selected category:', category.name);
                      setSelectedCategory(category.id);
                      setError('');
                    }}
                  >
                    <Text style={styles.categoryName}>{category.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  const renderStep3 = () => {
    const stepTitle = 'Location';
    const stepDescription = 'Where is this service available?';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter city or area"
          placeholderTextColor={colors.textSecondary}
          value={location}
          onChangeText={(text) => {
            setLocation(text);
            setError('');
          }}
          autoCapitalize="words"
        />
      </View>
    );
  };

  const renderStep4 = () => {
    const stepTitle = 'Pricing';
    const stepDescription = 'Set your price (optional)';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Enable Pricing</Text>
          <Switch
            value={priceEnabled}
            onValueChange={(value) => {
              console.log('User toggled pricing:', value);
              setPriceEnabled(value);
              setError('');
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>

        {priceEnabled && (
          <View style={styles.priceInputContainer}>
            <TextInput
              style={[styles.input, styles.priceInput]}
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={price}
              onChangeText={(text) => {
                setPrice(text);
                setError('');
              }}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.currencyInput]}
              placeholder="USD"
              placeholderTextColor={colors.textSecondary}
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
        )}
      </View>
    );
  };

  const renderStep5 = () => {
    const stepTitle = 'Details';
    const stepDescription = 'Tell us about your listing';

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setError('');
          }}
          autoCapitalize="words"
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={(text) => {
            setDescription(text);
            setError('');
          }}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  const nextButtonText = currentStep === totalSteps ? 'Post Listing' : 'Next';

  return (
    <>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {renderStepIndicator()}

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderCurrentStep()}
          </ScrollView>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              disabled={submitting}
            >
              <IconSymbol
                android_material_icon_name="arrow-back"
                ios_icon_name="arrow.left"
                size={24}
                color={colors.text}
              />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>{nextButtonText}</Text>
                  <IconSymbol
                    android_material_icon_name="arrow-forward"
                    ios_icon_name="arrow.right"
                    size={24}
                    color={colors.background}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepCircleCompleted: {
    backgroundColor: colors.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepNumberActive: {
    color: colors.background,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: colors.success,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  optionTitleSelected: {
    color: colors.primary,
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  categoriesScroll: {
    flex: 1,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: '47%',
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 120,
    paddingTop: spacing.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  priceInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  currencyInput: {
    width: 100,
  },
  loader: {
    marginTop: spacing.xl,
  },
  errorContainer: {
    backgroundColor: colors.error,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  nextButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
