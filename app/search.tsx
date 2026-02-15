import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';

export default function SearchScreen() {
    const router = useRouter();

    // Safety check: if router isn't available, we can't do much.
    // However, we'll log it instead of returning null to avoid blank screens
    // if it's just a transient state.
    if (!router) {
        console.warn('SearchScreen: Router not yet available');
    }

    console.log('SearchScreen: Rendering');
    const [location, setLocation] = useState('');
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [cities, setCities] = useState<string[]>([]);
    const [loadingCities, setLoadingCities] = useState(true);
    const [showLocationModal, setShowLocationModal] = useState(false);

    useEffect(() => {
        fetchCities();
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            console.log('SearchScreen: Loading categories');
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
        const categoryId = selectedCategory?.id;
        console.log('SearchScreen: Navigating to services with:', { categoryId, location });

        router.push({
            pathname: '/(tabs)/services',
            params: {
                location: location || '',
                category: categoryId || '',
            },
        });
    };

    const selectLocation = (city: string) => {
        setLocation(city);
        setShowLocationModal(false);
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

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Location Selector */}
                <View style={styles.section}>
                    <Text style={styles.label}>Where do you need service?</Text>
                    <TouchableOpacity
                        style={styles.locationButton}
                        onPress={() => setShowLocationModal(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.locationIconContainer}>
                            <IconSymbol
                                ios_icon_name="mappin.circle.fill"
                                android_material_icon_name="location-on"
                                size={24}
                                color={colors.primary}
                            />
                        </View>
                        <View style={styles.locationTextContainer}>
                            <Text style={styles.locationLabel}>Location</Text>
                            <Text style={styles.locationValue}>
                                {location || 'All Locations'}
                            </Text>
                        </View>
                        <IconSymbol
                            ios_icon_name="chevron.down"
                            android_material_icon_name="expand-more"
                            size={20}
                            color={colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                {/* Category Selector */}
                <View style={styles.section}>
                    <Text style={styles.label}>What service are you looking for?</Text>
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
                                {selectedCategory?.name || 'All Categories'}
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

                {/* Search Button */}
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={handleSearch}
                    activeOpacity={0.8}
                >
                    <IconSymbol
                        ios_icon_name="magnifyingglass"
                        android_material_icon_name="search"
                        size={20}
                        color="#FFFFFF"
                        style={styles.searchButtonIcon}
                    />
                    <Text style={styles.searchButtonText}>Search Services</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Location Modal */}
            <Modal
                visible={showLocationModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowLocationModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowLocationModal(false)}
                >
                    <Pressable
                        style={styles.modalContent}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Location</Text>
                            <TouchableOpacity
                                onPress={() => setShowLocationModal(false)}
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
                            {/* All Locations Option */}
                            <TouchableOpacity
                                style={[
                                    styles.locationOption,
                                    location === '' && styles.locationOptionSelected
                                ]}
                                onPress={() => selectLocation('')}
                            >
                                <View style={styles.locationOptionContent}>
                                    <IconSymbol
                                        ios_icon_name="globe"
                                        android_material_icon_name="public"
                                        size={22}
                                        color={location === '' ? colors.primary : colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.locationOptionText,
                                        location === '' && styles.locationOptionTextSelected
                                    ]}>
                                        All Locations
                                    </Text>
                                </View>
                                {location === '' && (
                                    <IconSymbol
                                        ios_icon_name="checkmark.circle.fill"
                                        android_material_icon_name="check-circle"
                                        size={24}
                                        color={colors.primary}
                                    />
                                )}
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* City Options */}
                            {loadingCities ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                    <Text style={styles.loadingText}>Loading cities...</Text>
                                </View>
                            ) : (
                                cities.map((city) => (
                                    <TouchableOpacity
                                        key={city}
                                        style={[
                                            styles.locationOption,
                                            location === city && styles.locationOptionSelected
                                        ]}
                                        onPress={() => selectLocation(city)}
                                    >
                                        <View style={styles.locationOptionContent}>
                                            <IconSymbol
                                                ios_icon_name="mappin.circle"
                                                android_material_icon_name="place"
                                                size={22}
                                                color={location === city ? colors.primary : colors.textSecondary}
                                            />
                                            <Text style={[
                                                styles.locationOptionText,
                                                location === city && styles.locationOptionTextSelected
                                            ]}>
                                                {city}
                                            </Text>
                                        </View>
                                        {location === city && (
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
                            {/* All Categories Option */}
                            <TouchableOpacity
                                style={[
                                    styles.locationOption,
                                    !selectedCategory && styles.locationOptionSelected
                                ]}
                                onPress={() => {
                                    setSelectedCategory(null);
                                    setShowCategoryModal(false);
                                }}
                            >
                                <View style={styles.locationOptionContent}>
                                    <IconSymbol
                                        ios_icon_name="square.grid.2x2.fill"
                                        android_material_icon_name="apps"
                                        size={22}
                                        color={!selectedCategory ? colors.primary : colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.locationOptionText,
                                        !selectedCategory && styles.locationOptionTextSelected
                                    ]}>
                                        All Categories
                                    </Text>
                                </View>
                                {!selectedCategory && (
                                    <IconSymbol
                                        ios_icon_name="checkmark.circle.fill"
                                        android_material_icon_name="check-circle"
                                        size={24}
                                        color={colors.primary}
                                    />
                                )}
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* Category Options */}
                            {categoriesLoading ? (
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
                                            selectedCategory?.id === cat.id && styles.locationOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedCategory(cat);
                                            setShowCategoryModal(false);
                                        }}
                                    >
                                        <View style={styles.locationOptionContent}>
                                            <IconSymbol
                                                ios_icon_name="tag.fill"
                                                android_material_icon_name="sell"
                                                size={22}
                                                color={selectedCategory?.id === cat.id ? colors.primary : colors.textSecondary}
                                            />
                                            <Text style={[
                                                styles.locationOptionText,
                                                selectedCategory?.id === cat.id && styles.locationOptionTextSelected
                                            ]}>
                                                {cat.name}
                                            </Text>
                                        </View>
                                        {selectedCategory?.id === cat.id && (
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
        flex: 1,
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    label: {
        ...typography.h3,
        fontSize: 18,
        marginBottom: spacing.md,
    },
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
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        paddingRight: spacing.md,
        minHeight: 72,
    },
    searchInputContainerFocused: {
        borderColor: colors.primary,
        borderWidth: 2,
    },
    searchIconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.textSecondary + '10',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.md,
        marginRight: spacing.md,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        paddingVertical: spacing.md,
    },
    clearButton: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
    },
    searchButton: {
        flexDirection: 'row',
        backgroundColor: colors.primary,
        paddingVertical: spacing.md + 4,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    searchButtonDisabled: {
        backgroundColor: colors.textSecondary,
        opacity: 0.5,
        shadowOpacity: 0,
        elevation: 0,
    },
    searchButtonIcon: {
        marginRight: spacing.sm,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
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
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
    },
    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    loadingText: {
        ...typography.bodySecondary,
        marginTop: spacing.md,
    },
    selectorHint: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
});
