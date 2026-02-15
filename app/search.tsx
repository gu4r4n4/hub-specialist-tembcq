import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { Picker } from '@react-native-picker/picker';

export default function SearchScreen() {
    const router = useRouter();
    const [location, setLocation] = useState('');
    const [query, setQuery] = useState('');
    const [cities, setCities] = useState<string[]>([]);
    const [loadingCities, setLoadingCities] = useState(true);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        try {
            setLoadingCities(true);
            // Fetch distinct cities from services table
            const { data, error } = await supabase
                .from('services')
                .select('city')
                .not('city', 'is', null)
                .eq('is_active', true);

            if (error) throw error;

            // Extract unique cities and sort them
            const uniqueCities = [...new Set(data.map(item => item.city).filter(Boolean))].sort();
            setCities(uniqueCities as string[]);
        } catch (err) {
            console.error('Error fetching cities:', err);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleSearch = () => {
        console.log('Searching for:', query, 'in', location);
        // Navigate to services with query params
        router.push(`/(tabs)/services?search=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}`);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <IconSymbol
                        ios_icon_name="xmark"
                        android_material_icon_name="close"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Search Services</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.pickerContainer}>
                    <IconSymbol
                        ios_icon_name="mappin.and.ellipse"
                        android_material_icon_name="location-on"
                        size={20}
                        color={colors.primary}
                        style={styles.inputIcon}
                    />
                    {loadingCities ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ flex: 1 }} />
                    ) : (
                        <Picker
                            selectedValue={location}
                            onValueChange={(itemValue) => setLocation(itemValue)}
                            style={styles.picker}
                            dropdownIconColor={colors.text}
                        >
                            <Picker.Item label="All Locations" value="" />
                            {cities.map((city) => (
                                <Picker.Item key={city} label={city} value={city} />
                            ))}
                        </Picker>
                    )}
                </View>

                <Text style={styles.label}>Service or Keyword</Text>
                <View style={styles.inputContainer}>
                    <IconSymbol
                        ios_icon_name="magnifyingglass"
                        android_material_icon_name="search"
                        size={20}
                        color={colors.textSecondary}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Plumber, Cleaner"
                        value={query}
                        onChangeText={setQuery}
                        placeholderTextColor={colors.textSecondary}
                        autoFocus
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                </View>

                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                    <Text style={styles.searchButtonText}>Search</Text>
                </TouchableOpacity>
            </View>
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
        justifyContent: 'space-between',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        ...typography.h3,
    },
    closeButton: {
        padding: spacing.xs,
    },
    content: {
        padding: spacing.lg,
    },
    label: {
        ...typography.body,
        fontWeight: '600',
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    pickerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingLeft: spacing.md,
        marginBottom: spacing.md,
        minHeight: 50,
    },
    picker: {
        flex: 1,
        color: colors.text,
    },
    input: {
        flex: 1,
        paddingVertical: spacing.md,
        fontSize: 16,
        color: colors.text,
    },
    searchButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
