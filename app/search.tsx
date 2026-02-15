import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function SearchScreen() {
    const router = useRouter();
    const [location, setLocation] = useState('');
    const [query, setQuery] = useState('');

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
                <View style={styles.inputContainer}>
                    <IconSymbol
                        ios_icon_name="mappin.and.ellipse"
                        android_material_icon_name="location-on"
                        size={20}
                        color={colors.primary}
                        style={styles.inputIcon}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Current Location"
                        value={location}
                        onChangeText={setLocation}
                        placeholderTextColor={colors.textSecondary}
                    />
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
