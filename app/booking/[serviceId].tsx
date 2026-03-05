import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Service } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

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
    loadService();
  }, [serviceId]);

  const loadService = async () => {
    if (!serviceId) return;
    setLoading(true);
    const { data } = await supabase.from('services').select('*, specialist:profiles!specialist_profile_id(*)').eq('id', serviceId).single();
    if (data) setService(data);
    setLoading(false);
  };

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!address.trim()) { setError('Please enter an address'); return; }
    if (!profile || !service) return;
    setSubmitting(true);
    const { data, error } = await supabase.from('orders').insert({
      consumer_profile_id: profile.id,
      specialist_profile_id: service.specialist_profile_id,
      service_id: service.id,
      status: 'new',
      scheduled_at: scheduledDate.toISOString(),
      address: address.trim(),
      comment: comment.trim() || null,
    }).select().single();
    if (!error) router.replace(`/order/${data.id}`);
    else { setError(error.message); setSubmitting(false); }
  };

  if (loading || !service) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Complete Booking</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <View style={styles.divider} />
          <Text style={styles.specialistName}>Pro: {service.specialist?.full_name}</Text>
        </View>

        <View style={styles.form}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Choose Date & Time</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
              <IconSymbol ios_icon_name="calendar" android_material_icon_name="event" size={20} color={colors.primary} />
              <Text style={styles.dateText}>
                {scheduledDate.toLocaleDateString()} at {scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <IconSymbol ios_icon_name="chevron.down" android_material_icon_name="expand-more" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, date) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (date) setScheduledDate(date);
                }}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Service Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Where should we meet?"
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes for Pro (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any special requests..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.bookButtonText}>Confirm Booking</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerCard: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    alignItems: 'center',
  },
  serviceTitle: {
    ...typography.h2,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 4,
  },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginVertical: spacing.lg,
  },
  specialistName: {
    ...typography.bodySecondary,
    fontWeight: '700',
  },
  form: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 4,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: {
    flex: 1,
    ...typography.body,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
