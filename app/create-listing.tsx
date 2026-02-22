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
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Category } from '@/types/database';
import * as Haptics from 'expo-haptics';

const DRAFT_STORAGE_KEY = 'hub_specialist_listing_draft';

export default function AddListingScreen() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

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
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    loadCategories();
    restoreDraft();
  }, []);

  // Save draft whenever important fields change
  useEffect(() => {
    if (!isRestoring) {
      saveDraft();
    }
  }, [selectedCategory, location, priceEnabled, price, currency, title, description, currentStep, isRestoring]);

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

  const saveDraft = async () => {
    try {
      const draft = {
        selectedCategory,
        location,
        priceEnabled,
        price,
        currency,
        title,
        description,
        currentStep,
      };
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  };

  const restoreDraft = async () => {
    try {
      const savedDraft = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        setSelectedCategory(draft.selectedCategory);
        setLocation(draft.location);
        setPriceEnabled(draft.priceEnabled);
        setPrice(draft.price);
        setCurrency(draft.currency);
        setTitle(draft.title);
        setDescription(draft.description);
        setCurrentStep(draft.currentStep || 1);
      }
    } catch (e) {
      console.error('Failed to restore draft:', e);
    } finally {
      setIsRestoring(false);
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep === 1) {
      if (!selectedCategory) {
        setError('Please select a category');
        return;
      }
      if (!location.trim()) {
        setError('Please enter a location');
        return;
      }
      if (priceEnabled && !price.trim()) {
        setError('Please enter a price');
        return;
      }
      setError('');
      setCurrentStep(2);
    } else {
      if (!title.trim() || !description.trim()) {
        setError('Please fill in all details');
        return;
      }
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
      setError('Please sign in to post your listing');
      router.push('/auth/login?redirect=/create-listing');
      return;
    }

    if (profile.role !== 'specialist') {
      setError('Only specialists can create listings. Please update your profile.');
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

      await clearDraft();
      router.replace(`/service/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Basics</Text>
      <Text style={styles.stepDescription}>What, where and for how much?</Text>

      <Text style={styles.inputLabel}>Service Type</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setShowCategoryModal(true)}>
        <IconSymbol ios_icon_name="tag.fill" android_material_icon_name="sell" size={20} color={colors.primary} />
        <View style={styles.selectorText}>
          <Text style={styles.selectorValue}>{categories.find(c => c.id === selectedCategory)?.name || 'Select Category'}</Text>
        </View>
        <IconSymbol ios_icon_name="chevron.down" android_material_icon_name="expand-more" size={20} color={colors.textTertiary} />
      </TouchableOpacity>

      <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Location</Text>
      <View style={styles.inputWrapper}>
        <IconSymbol ios_icon_name="mappin.and.ellipse" android_material_icon_name="place" size={20} color={colors.primary} style={styles.inputIcon} />
        <TextInput
          style={styles.inputWithIcon}
          placeholder="City or Service Area"
          value={location}
          onChangeText={text => { setLocation(text); setError(''); }}
          autoCapitalize="words"
        />
      </View>

      <View style={[styles.toggleRow, { marginTop: spacing.lg }]}>
        <View>
          <Text style={styles.toggleText}>Set Pricing</Text>
          <Text style={styles.toggleSubtext}>Leave off for "Price on request"</Text>
        </View>
        <Switch value={priceEnabled} onValueChange={setPriceEnabled} trackColor={{ false: colors.border, true: colors.primary }} />
      </View>

      {priceEnabled && (
        <View style={styles.priceRow}>
          <View style={[styles.inputWrapper, { flex: 1 }]}>
            <Text style={styles.currencyPrefix}>$</Text>
            <TextInput style={styles.inputWithPrefix} placeholder="0.00" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
          <TextInput style={[styles.input, { width: 80, marginBottom: 0 }]} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Details</Text>
      <Text style={styles.stepDescription}>Finalize your listing description</Text>

      <Text style={styles.inputLabel}>Listing Title</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Professional Home Cleaning"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.inputLabel}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe your service, experience, and what's included..."
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
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
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
          {currentStep === 1 ? renderStep1() : renderStep2()}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
            <Text style={styles.secondaryBtnText}>{currentStep === 1 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>{currentStep === totalSteps ? 'Post Listing' : 'Next Step'}</Text>}
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
    ...typography.h1,
    fontSize: 32,
    marginBottom: 8,
  },
  stepDescription: {
    ...typography.bodySecondary,
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectorText: {
    flex: 1,
  },
  selectorValue: {
    ...typography.body,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginLeft: spacing.md,
  },
  inputWithIcon: {
    flex: 1,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  currencyPrefix: {
    marginLeft: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  inputWithPrefix: {
    flex: 1,
    padding: spacing.md,
    paddingLeft: 4,
    fontSize: 16,
    color: colors.text,
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
  },
  toggleText: {
    ...typography.body,
    fontWeight: '700',
  },
  toggleSubtext: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
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
