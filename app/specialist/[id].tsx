
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';

export default function SpecialistDetailScreen() {
  const { id } = useLocalSearchParams();
  const [specialist, setSpecialist] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('SpecialistDetailScreen: Loading specialist', id);
    loadSpecialist();
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
        setSpecialist(data);
      }
    } catch (error) {
      console.error('Exception loading specialist:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Specialist Profile' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!specialist) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Specialist Not Found' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Specialist not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: specialist.full_name }} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <IconSymbol
            ios_icon_name="person.circle.fill"
            android_material_icon_name="account-circle"
            size={100}
            color={colors.primary}
          />
          <Text style={styles.name}>{specialist.full_name}</Text>
          {specialist.city && <Text style={styles.city}>{specialist.city}</Text>}
        </View>

        {specialist.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{specialist.bio}</Text>
          </View>
        )}

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
  header: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: {
    ...typography.h1,
    marginTop: spacing.md,
  },
  city: {
    ...typography.bodySecondary,
    marginTop: spacing.xs,
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
});
