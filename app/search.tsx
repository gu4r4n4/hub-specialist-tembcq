import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown,
    SlideOutDown
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function SearchScreen() {
    console.log('SearchScreen rendered');
    const router = useRouter();
    const [location, setLocation] = useState('');
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [cities, setCities] = useState<string[]>([]);
    const [loadingCities, setLoadingCities] = useState(true);
    const [showLocationModal, setShowLocationModal] = useState(false);

    useEffect(() => {
        if (!isSupabaseConfigured) return;
        fetchCities();
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setCategoriesLoading(true);
            const { data, error } = await supabase
                .from('categories')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;
            setCategories((data || []) as any);
        } catch (e: any) {
            console.error('SearchScreen: Load categories error:', e);
            Alert.alert('Error', e?.message || 'Failed to load categories');
        } finally {
            setCategoriesLoading(false);
        }
    };

    const fetchCities = async () => {
        try {
            setLoadingCities(true);
            const { data, error } = await supabase
                .from('services')
                .select('city')
                .not('city', 'is', null)
                .eq('is_active', true);

            if (error) throw error;

            if (data && data.length > 0) {
                const uniqueCitiesMap = data.reduce((acc: { [key: string]: boolean }, item) => {
                    if (item.city) acc[item.city] = true;
                    return acc;
                }, {});
                const uniqueCities = Object.keys(uniqueCitiesMap).sort();
                setCities(uniqueCities);
            }
        } catch (err) {
            console.error('SearchScreen: Error fetching cities:', err);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleSearch = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const categoryId = selectedCategory?.id;
        console.log('Searching for category:', categoryId, 'in', location);
        router.push({
            pathname: '/(tabs)/services',
            params: {
                location: location || '',
                category: categoryId || '',
            },
        });
    };

    const selectLocation = (city: string) => {
        Haptics.selectionAsync();
        setLocation(city);
        setShowLocationModal(false);
    };

    const selectCategory = (cat: { id: string; name: string } | null) => {
        Haptics.selectionAsync();
        setSelectedCategory(cat);
        setShowCategoryModal(false);
    };

    if (!isSupabaseConfigured) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Configuration Error</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                    <IconSymbol
                        ios_icon_name="chevron.left"
                        android_material_icon_name="arrow-back"
                        size={24}
                        color={colors.text}
                    />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Find Service</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.label}>What do you need?</Text>

                    <TouchableOpacity
                        style={styles.selector}
                        onPress={() => setShowCategoryModal(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.selectorIcon}>
                            <IconSymbol
                                ios_icon_name="magnifyingglass"
                                android_material_icon_name="search"
                                size={22}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.selectorText}>
                            <Text style={styles.selectorLabel}>Service Category</Text>
                            <Text style={[styles.selectorValue, !selectedCategory && styles.placeholder]}>
                                {selectedCategory?.name || 'Any service'}
                            </Text>
                        </View>
                        <IconSymbol
                            ios_icon_name="chevron.right"
                            android_material_icon_name="chevron-right"
                            size={18}
                            color={colors.textTertiary}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.selector, { marginTop: spacing.md }]}
                        onPress={() => setShowLocationModal(true)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.selectorIcon, { backgroundColor: colors.backgroundSecondary }]}>
                            <IconSymbol
                                ios_icon_name="mappin.and.ellipse"
                                android_material_icon_name="place"
                                size={22}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.selectorText}>
                            <Text style={styles.selectorLabel}>Location</Text>
                            <Text style={[styles.selectorValue, !location && styles.placeholder]}>
                                {location || 'All Uruguay'}
                            </Text>
                        </View>
                        <IconSymbol
                            ios_icon_name="chevron.right"
                            android_material_icon_name="chevron-right"
                            size={18}
                            color={colors.textTertiary}
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearch}
                    activeOpacity={0.8}
                >
                    <Text style={styles.searchButtonText}>Show Results</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Modals using simple logic but could be enhanced with Reanimated if they were custom views */}
            {/* For now, sticking to standard Modal with slide for reliability in this environment */}

            <Modal
                visible={showCategoryModal || showLocationModal}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setShowCategoryModal(false);
                    setShowLocationModal(false);
                }}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => {
                        setShowCategoryModal(false);
                        setShowLocationModal(false);
                    }}
                >
                    <Animated.View
                        entering={SlideInDown.springify().damping(20)}
                        exiting={SlideOutDown}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalIndicator} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {showCategoryModal ? 'Select Category' : 'Select Location'}
                            </Text>
                        </View>

                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {showCategoryModal ? (
                                <>
                                    <TouchableOpacity
                                        style={styles.optionItem}
                                        onPress={() => selectCategory(null)}
                                    >
                                        <Text style={[styles.optionText, !selectedCategory && styles.optionTextActive]}>
                                            All Categories
                                        </Text>
                                        {!selectedCategory && (
                                            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                    {categories.map((cat) => (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={styles.optionItem}
                                            onPress={() => selectCategory(cat)}
                                        >
                                            <Text style={[styles.optionText, selectedCategory?.id === cat.id && styles.optionTextActive]}>
                                                {cat.name}
                                            </Text>
                                            {selectedCategory?.id === cat.id && (
                                                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={styles.optionItem}
                                        onPress={() => selectLocation('')}
                                    >
                                        <Text style={[styles.optionText, !location && styles.optionTextActive]}>
                                            All Locations
                                        </Text>
                                        {!location && (
                                            <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                    {cities.map((city) => (
                                        <TouchableOpacity
                                            key={city}
                                            style={styles.optionItem}
                                            onPress={() => selectLocation(city)}
                                        >
                                            <Text style={[styles.optionText, location === city && styles.optionTextActive]}>
                                                {city}
                                            </Text>
                                            {location === city && (
                                                <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={20} color={colors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </ScrollView>
                    </Animated.View>
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
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        height: 60,
    },
    headerTitle: {
        ...typography.h3,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.h2,
        fontSize: 24,
        marginBottom: spacing.xl,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.md,
    },
    selectorIcon: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectorText: {
        flex: 1,
    },
    selectorLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    selectorValue: {
        ...typography.body,
        fontWeight: '600',
    },
    placeholder: {
        color: colors.textTertiary,
        fontWeight: '400',
    },
    searchButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        ...typography.bodySecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        maxHeight: '80%',
        paddingBottom: spacing.xl,
    },
    modalIndicator: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: spacing.sm,
    },
    modalHeader: {
        padding: spacing.lg,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        ...typography.h3,
    },
    modalScroll: {
        paddingHorizontal: spacing.lg,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    optionText: {
        ...typography.body,
        color: colors.textSecondary,
    },
    optionTextActive: {
        color: colors.primary,
        fontWeight: '600',
    }
});
