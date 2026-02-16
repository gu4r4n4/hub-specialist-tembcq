
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
  Modal,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types/database';


export default function AddListingScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  // Step tracking
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  // Form data
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
  const [showCategoryModal, setShowCategoryModal] = useState(false);

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
    if (currentStep === 1 && !selectedCategory) {
      setError('Please select a category');
      return;
    }
    if (currentStep === 2 && !location.trim()) {
      setError('Please enter a location');
      return;
    }
    if (currentStep === 3 && priceEnabled && !price.trim()) {
      setError('Please enter a price or disable pricing');
      return;
    }
    if (currentStep === 4 && (!title.trim() || !description.trim())) {
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

    // Check if user has specialist role
    if (profile.role !== 'specialist') {
      console.log('User is not a specialist');
      setError('Only specialists can create service listings. Please update your profile role.');
      return;
    }

    console.log('User is logged in as specialist, submitting listing');
    setSubmitting(true);
    setError('');

    try {
      // Update profile city if location was provided
      if (location.trim()) {
        console.log('Updating profile city to:', location);
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ city: location.trim() })
          .eq('id', profile.id);

        if (profileError) {
          console.error('Error updating profile city:', profileError);
          // Don't fail the whole operation, just log it
        }
      }

      const serviceData = {
        specialist_profile_id: profile.id,
        category_id: selectedCategory,
        title: title.trim(),
        description: description.trim(),
        price: priceEnabled ? parseFloat(price) : 0,
        currency: priceEnabled ? currency : 'USD',
        city: location.trim() || null,
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

  const renderStep2 = () => {
    const stepTitle = 'Select Category';
    const stepDescription = 'What type of service is this?';
    const selectedCat = categories.find(c => c.id === selectedCategory);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepDescription}>{stepDescription}</Text>

        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.locationIconContainer, { backgroundColor: colors.primary + '15' }]}>
            <IconSymbol
              ios_icon_name="tag.fill"
              android_material_icon_name="sell"
              size={22}
              color={colors.primary}
            />
          </View>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationLabel}>Category</Text>
            <Text style={styles.locationValue}>
              {selectedCat?.name || 'Select a Category'}
            </Text>
            {!selectedCategory && (
              <Text style={styles.selectorHint} numberOfLines={1}>
                Tap to choose a category
              </Text>
            )}
          </View>
          <IconSymbol
            ios_icon_name="chevron.down"
            android_material_icon_name="expand-more"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
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
        return renderStep2();
      case 2:
        return renderStep3();
      case 3:
        return renderStep4();
      case 4:
        return renderStep5();
      default:
        return null;
    }
  };

  const nextButtonText = currentStep === totalSteps ? 'Post Listing' : 'Next';

  return (
    <>
      <Stack.Screen options={{ title: 'Create Listing', headerShown: true }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.stepIndicator}>
            {/* Step 1 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, currentStep === 1 && styles.stepCircleActive, currentStep > 1 && styles.stepCircleCompleted]}>
                {currentStep > 1 ? <Text style={{ color: colors.background, fontSize: 14, fontWeight: 'bold' }}>✓</Text> : <Text style={[styles.stepNumber, currentStep === 1 && styles.stepNumberActive]}>1</Text>}
              </View>
              <View style={[styles.stepLine, currentStep > 1 && styles.stepLineCompleted]} />
            </View>
            {/* Step 2 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, currentStep === 2 && styles.stepCircleActive, currentStep > 2 && styles.stepCircleCompleted]}>
                {currentStep > 2 ? <Text style={{ color: colors.background, fontSize: 14, fontWeight: 'bold' }}>✓</Text> : <Text style={[styles.stepNumber, currentStep === 2 && styles.stepNumberActive]}>2</Text>}
              </View>
              <View style={[styles.stepLine, currentStep > 2 && styles.stepLineCompleted]} />
            </View>
            {/* Step 3 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, currentStep === 3 && styles.stepCircleActive, currentStep > 3 && styles.stepCircleCompleted]}>
                {currentStep > 3 ? <Text style={{ color: colors.background, fontSize: 14, fontWeight: 'bold' }}>✓</Text> : <Text style={[styles.stepNumber, currentStep === 3 && styles.stepNumberActive]}>3</Text>}
              </View>
              <View style={[styles.stepLine, currentStep > 3 && styles.stepLineCompleted]} />
            </View>
            {/* Step 4 */}
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, currentStep === 4 && styles.stepCircleActive, currentStep > 4 && styles.stepCircleCompleted]}>
                {currentStep > 4 ? <Text style={{ color: colors.background, fontSize: 14, fontWeight: 'bold' }}>✓</Text> : <Text style={[styles.stepNumber, currentStep === 4 && styles.stepNumberActive]}>4</Text>}
              </View>
            </View>
          </View>

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
              <Text style={{ fontSize: 20 }}>←</Text>
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
                  <Text style={{ fontSize: 20, color: colors.background }}>→</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <Pressable
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.modalCloseButton}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading categories...</Text>
                </View>
              ) : (
                categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.locationOption,
                      selectedCategory === cat.id && styles.locationOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      setShowCategoryModal(false);
                      setError('');
                    }}
                  >
                    <View style={styles.locationOptionContent}>
                      <IconSymbol
                        ios_icon_name="tag.fill"
                        android_material_icon_name="sell"
                        size={22}
                        color={selectedCategory === cat.id ? colors.primary : colors.textSecondary}
                      />
                      <Text style={[
                        styles.locationOptionText,
                        selectedCategory === cat.id && styles.locationOptionTextSelected
                      ]}>
                        {cat.name}
                      </Text>
                    </View>
                    {selectedCategory === cat.id && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={24}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  // Added search-style components
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 72,
  },
  locationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  locationValue: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  selectorHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h2,
    fontSize: 20,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalScroll: {
    paddingHorizontal: spacing.lg,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.xs,
  },
  locationOptionSelected: {
    backgroundColor: colors.primary + '10',
  },
  locationOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationOptionText: {
    ...typography.body,
    fontSize: 16,
    marginLeft: spacing.md,
    color: colors.text,
  },
  locationOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySecondary,
    marginTop: spacing.md,
  },
});
