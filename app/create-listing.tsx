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
import * as Haptics from 'expo-haptics';

export default function AddListingScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 1 && !selectedCategory) {
      setError('Please select a category');
      return;
    }
    if (currentStep === 2 && !location.trim()) {
      setError('Please enter a location');
      return;
    }
    if (currentStep === 3 && priceEnabled && !price.trim()) {
      setError('Please enter a price');
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!user || !profile) {
      router.push('/auth/login');
      return;
    }
    if (profile.role !== 'specialist') {
      setError('Only specialists can create listings.');
      return;
    }
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
        city: location.trim() || null,
        is_active: true,
      };
      const { data, error } = await supabase.from('services').insert(serviceData).select().single();
      if (error) throw error;
      router.replace(`/service/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Category</Text>
      <Text style={styles.stepDescription}>What type of service is this?</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowCategoryModal(true)}>
        <IconSymbol ios_icon_name="tag.fill" android_material_icon_name="sell" size={24} color={colors.primary} />
        <View style={styles.selectorText}>
          <Text style={styles.selectorLabel}>Category</Text>
          <Text style={styles.selectorValue}>{categories.find(c => c.id === selectedCategory)?.name || 'Choose one...'}</Text>
        </View>
        <IconSymbol ios_icon_name="chevron.down" android_material_icon_name="expand-more" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Location</Text>
      <Text style={styles.stepDescription}>Where is this service available?</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter city or area"
        value={location}
        onChangeText={text => { setLocation(text); setError(''); }}
        autoCapitalize="words"
      />
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Pricing</Text>
      <Text style={styles.stepDescription}>Set your price (optional)</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleText}>Enable Pricing</Text>
        <Switch value={priceEnabled} onValueChange={setPriceEnabled} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>
      {priceEnabled && (
        <View style={styles.priceRow}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="0.00" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, { width: 80 }]} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
        </View>
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Listing Details</Text>
      <Text style={styles.stepDescription}>Tell us about your offer</Text>
      <TextInput
        style={styles.input}
        placeholder="Catchy Title"
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Detailed Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={6}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.stepLabels}>
          <Text style={styles.stepIndicatorText}>Step {currentStep} of {totalSteps}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
            <Text style={styles.secondaryBtnText}>{currentStep === 1 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{currentStep === totalSteps ? 'Post Listing' : 'Continue'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showCategoryModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
            </View>
            <ScrollView style={styles.modalScroll}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryOption, selectedCategory === cat.id && styles.categoryOptionActive]}
                  onPress={() => { setSelectedCategory(cat.id); setShowCategoryModal(false); setError(''); }}
                >
                  <Text style={[styles.categoryOptionText, selectedCategory === cat.id && styles.categoryOptionTextActive]}>{cat.name}</Text>
                  {selectedCategory === cat.id && <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
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
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLabels: {
    flex: 1,
  },
  stepIndicatorText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...typography.h2,
    fontSize: 28,
    marginBottom: 8,
  },
  stepDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.xxl,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectorText: {
    flex: 1,
  },
  selectorLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  selectorValue: {
    ...typography.body,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  toggleText: {
    ...typography.body,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '70%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  modalTitle: {
    ...typography.h3,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryOptionActive: {
    backgroundColor: colors.primaryLight + '20',
  },
  categoryOptionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  categoryOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
