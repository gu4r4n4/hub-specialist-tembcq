
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    TouchableOpacity,
    NativeSyntheticEvent,
    NativeScrollEvent,
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const { width } = Dimensions.get('window');

type OnboardingStep = {
    id: string;
    type: 'intro' | 'intent' | 'location' | 'outro';
    title: string;
    description: string;
    icon?: string;
    materialIcon?: string;
};

const STEPS: OnboardingStep[] = [
    {
        id: '1',
        type: 'intro',
        title: 'Your Home Services Hub',
        description: 'Your trusted marketplace connecting homeowners with verified local professionals for all your service needs.',
        icon: 'house.circle.fill',
        materialIcon: 'home',
    },
    {
        id: '2',
        type: 'intro',
        title: 'Verified Professionals',
        description: 'Browse hundreds of verified professionals. From plumbers to electricians, cleaners to handymen - we\'ve got you covered.',
        icon: 'person.2.circle.fill',
        materialIcon: 'people',
    },
    {
        id: '3',
        type: 'intro',
        title: 'Trusted by Thousands',
        description: 'Read reviews, compare prices, and book services instantly. All specialists are verified and rated by real customers.',
        icon: 'checkmark.seal.fill',
        materialIcon: 'verified',
    },
    {
        id: '4',
        type: 'location',
        title: 'Choose Your City',
        description: 'Choose your city to see services available in your area. You can always change this later in settings.',
        icon: 'map.circle.fill',
        materialIcon: 'location-on',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList<OnboardingStep>>(null);

    // State for Location Step
    const [cities, setCities] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [loadingCities, setLoadingCities] = useState(false);
    const [showLocationModal, setShowLocationModal] = useState(false);

    useEffect(() => {
        fetchCities();
    }, []);

    const fetchCities = async () => {
        if (!isSupabaseConfigured) return;

        setLoadingCities(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('city')
                .not('city', 'is', null)
                .eq('is_active', true);

            if (error) throw error;

            if (data) {
                const uniqueCities = [...new Set(data.map(item => item.city).filter(Boolean))].sort();
                setCities(uniqueCities as string[]);
            }
        } catch (err) {
            console.error('Error fetching cities:', err);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('onboarding_seen', 'true');

            if (selectedLocation) {
                await AsyncStorage.setItem('user_location_preference', selectedLocation);
            } else {
                await AsyncStorage.removeItem('user_location_preference');
            }

            router.replace('/(tabs)/(home)');
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    };

    const handleNext = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < STEPS.length) {
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        } else {
            handleFinish();
        }
    };

    const handleSkip = () => {
        handleFinish();
    };

    const selectLocation = (city: string) => {
        setSelectedLocation(city);
        setShowLocationModal(false);
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        if (index !== currentIndex) {
            setCurrentIndex(index);
        }
    };

    const renderIntroOutro = (item: OnboardingStep) => (
        <View style={styles.contentContainer}>
            <View style={styles.imageContainer}>
                <IconSymbol
                    ios_icon_name={item.icon as any}
                    android_material_icon_name={item.materialIcon as any}
                    size={100}
                    color={colors.primary}
                />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    const renderLocationSelect = (item: OnboardingStep) => (
        <View style={styles.contentContainer}>
            <View style={styles.locationIconContainer}>
                <IconSymbol
                    ios_icon_name="map.circle.fill"
                    android_material_icon_name="location-on"
                    size={80}
                    color={colors.primary}
                />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            {/* Location Selector Button */}
            <TouchableOpacity
                style={styles.locationButton}
                onPress={() => setShowLocationModal(true)}
                activeOpacity={0.7}
            >
                <View style={styles.locationIconBox}>
                    <IconSymbol
                        ios_icon_name="mappin.circle.fill"
                        android_material_icon_name="location-on"
                        size={24}
                        color={colors.primary}
                    />
                </View>
                <View style={styles.locationTextContainer}>
                    <Text style={styles.locationLabel}>Your Location</Text>
                    <Text style={styles.locationValue}>
                        {selectedLocation || 'All Locations'}
                    </Text>
                </View>
                <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="expand-more"
                    size={20}
                    color={colors.textSecondary}
                />
            </TouchableOpacity>

            <Text style={styles.hintText}>
                {selectedLocation
                    ? `You'll see services available in ${selectedLocation}`
                    : "You'll see services from all locations"}
            </Text>
        </View>
    );

    const renderItem = ({ item }: { item: OnboardingStep }) => {
        return (
            <View style={styles.slide}>
                {item.type === 'location'
                    ? renderLocationSelect(item)
                    : renderIntroOutro(item)
                }
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                ref={flatListRef}
                data={STEPS}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                keyExtractor={(item) => item.id}
                style={styles.list}
                scrollEnabled={true}
                extraData={{ selectedLocation, cities, loadingCities }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                onScrollToIndexFailed={(info) => {
                    flatListRef.current?.scrollToOffset({
                        offset: info.averageItemLength * info.index,
                        animated: true,
                    });
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                    }, 50);
                }}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {STEPS.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentIndex === index && styles.activeDot,
                            ]}
                        />
                    ))}
                </View>

                <TouchableOpacity style={styles.button} onPress={handleNext}>
                    <Text style={styles.buttonText}>
                        {currentIndex === STEPS.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>

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
                    <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Your City</Text>
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
                                    selectedLocation === '' && styles.locationOptionSelected
                                ]}
                                onPress={() => selectLocation('')}
                            >
                                <View style={styles.locationOptionContent}>
                                    <IconSymbol
                                        ios_icon_name="globe"
                                        android_material_icon_name="public"
                                        size={22}
                                        color={selectedLocation === '' ? colors.primary : colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.locationOptionText,
                                        selectedLocation === '' && styles.locationOptionTextSelected
                                    ]}>
                                        All Locations
                                    </Text>
                                </View>
                                {selectedLocation === '' && (
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
                                            selectedLocation === city && styles.locationOptionSelected
                                        ]}
                                        onPress={() => selectLocation(city)}
                                    >
                                        <View style={styles.locationOptionContent}>
                                            <IconSymbol
                                                ios_icon_name="mappin.circle"
                                                android_material_icon_name="place"
                                                size={22}
                                                color={selectedLocation === city ? colors.primary : colors.textSecondary}
                                            />
                                            <Text style={[
                                                styles.locationOptionText,
                                                selectedLocation === city && styles.locationOptionTextSelected
                                            ]}>
                                                {city}
                                            </Text>
                                        </View>
                                        {selectedLocation === city && (
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
        alignItems: 'flex-end',
        padding: spacing.md,
    },
    skipButton: {
        padding: spacing.sm,
    },
    skipText: {
        ...typography.body,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    list: {
        flex: 1,
    },
    slide: {
        width,
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    contentContainer: {
        alignItems: 'center',
        width: '100%',
        paddingTop: spacing.xl,
    },
    imageContainer: {
        marginBottom: spacing.xl,
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 80,
        borderWidth: 1,
        borderColor: colors.border,
    },
    locationIconContainer: {
        marginBottom: spacing.lg,
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.primary + '15',
        borderRadius: 70,
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
        marginBottom: spacing.md,
        color: colors.text,
        fontSize: 28,
        paddingHorizontal: spacing.md,
    },
    description: {
        ...typography.body,
        textAlign: 'center',
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.sm,
        fontSize: 16,
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
        width: '100%',
        marginTop: spacing.md,
    },
    locationIconBox: {
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
    hintText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginTop: spacing.md,
        textAlign: 'center',
    },
    footer: {
        padding: spacing.xl,
        paddingBottom: spacing.xxl,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.xl,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.border,
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: colors.primary,
        width: 20,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md + 4,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
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
});
