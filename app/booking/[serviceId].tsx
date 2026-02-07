
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Service } from '@/types/database';

export default function BookingScreen() {
  const router = useRouter();
  const { serviceId } = useLocalSearchParams();
  const { profile } = useAuth();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('BookingScreen: Loading service', serviceId);
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    if (!isSupabaseConfigured || !serviceId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .select('*, specialist:profiles!specialist_profile_id(*)')
        .eq('id', serviceId)
        .single();

      if (error) {
        console.error('Error loading service:', error);
      } else {
        setService(data);
      }
    } catch (error) {
      console.error('Exception loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    console.log('User tapped Book Service button');

    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    if (!profile || !service) {
      setError('Missing profile or service data');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          consumer_profile_id: profile.id,
          specialist_profile_id: service.specialist_profile_id,
          service_id: service.id,
          status: 'new',
          scheduled_at: scheduledDate.toISOString(),
          address: address.trim(),
          comment: comment.trim() || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating order:', insertError);
        setError(insertError.message || 'Failed to create booking');
        setSubmitting(false);
      } else {
        console.log('Order created successfully:', data);
        router.replace(`/order/${data.id}`);
      }
    } catch (err) {
      console.error('Exception creating order:', err);
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Book Service' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!service) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Service Not Found' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Service not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateText = scheduledDate.toLocaleDateString();
  const timeText = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Book Service' }} />
      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        <View style={styles.serviceCard}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.servicePrice}>
            {service.currency} {service.price.toFixed(2)}
          </Text>
          <Text style={styles.specialistName}>
            Specialist: {service.specialist?.full_name}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Scheduled Date & Time</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                console.log('User tapped date picker');
                setShowDatePicker(true);
              }}
            >
              <Text style={styles.dateButtonText}>{dateText}</Text>
              <Text style={styles.dateButtonText}>{timeText}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="datetime"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    console.log('User selected date:', selectedDate);
                    setScheduledDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter service address"
              placeholderTextColor={colors.textSecondary}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Additional Comments</Text>
            <TextInput
              style={styles.input}
              placeholder="Any special requests or notes..."
              placeholderTextColor={colors.textSecondary}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              editable={!submitting}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Confirm Booking</Text>
            )}
          </TouchableOpacity>
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
  serviceCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  servicePrice: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  specialistName: {
    ...typography.bodySecondary,
  },
  errorBanner: {
    backgroundColor: colors.error + '20',
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.sm,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 14,
  },
  form: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    ...typography.body,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
