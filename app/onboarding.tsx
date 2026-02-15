
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
        title: 'Find Trusted Specialists',
        description: 'Connect with verified professionals for all your home service needs.',
        icon: 'magnifyingglass.circle.fill',
        materialIcon: 'search',
    },
    {
        id: '2',
        type: 'intent',
        title: 'What brings you here?',
        description: 'Choose how you want to use the app initially.',
        icon: 'person.2.circle.fill',
        materialIcon: 'people',
    },
    {
        id: '3',
        type: 'location',
        title: 'Select Your Location',
        description: 'Find services available in your area. You can always change this later.',
        icon: 'map.circle.fill',
        materialIcon: 'location-on',
    },
    {
        id: '4',
        type: 'outro',
        title: 'You\'re All Set',
        description: 'Ready to discover customized services tailored just for you.',
        icon: 'checkmark.circle.fill',
        materialIcon: 'check-circle',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // State for Location Step
    const [locations, setLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // State for Intent Step
    const [selectedIntent, setSelectedIntent] = useState<'hire' | 'work' | null>(null);

    useEffect(() => {
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        if (!isSupabaseConfigured) return;

        setLoadingLocations(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select(`
                    specialist:profiles!specialist_profile_id(city)
                `)
                .eq('is_active', true);

            if (error) throw error;

            if (data) {
                const cities = new Set<string>();
                data.forEach((item: any) => {
                    if (item.specialist?.city) {
                        cities.add(item.specialist.city);
                    }
                });
                setLocations(Array.from(cities).sort());
            }
        } catch (err) {
            console.error('Error fetching locations:', err);
        } finally {
            setLoadingLocations(false);
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

            if (selectedIntent) {
                await AsyncStorage.setItem('user_intent_preference', selectedIntent);
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
            setCurrentIndex(nextIndex);
        } else {
            handleFinish();
        }
    };

    const handleSkip = () => {
        handleFinish();
    };

    const toggleLocation = (loc: string) => {
        setSelectedLocation(prev => prev === loc ? null : loc);
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

    const renderIntentSelect = (item: OnboardingStep) => (
        <View style={styles.contentContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.intentsContainer}>
                <TouchableOpacity
                    style={[
                        styles.intentCard,
                        selectedIntent === 'hire' && styles.intentCardSelected
                    ]}
                    onPress={() => setSelectedIntent('hire')}
                >
                    <IconSymbol
                        ios_icon_name="magnifyingglass.circle.fill"
                        android_material_icon_name="search"
                        size={48}
                        color={selectedIntent === 'hire' ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                        styles.intentText,
                        selectedIntent === 'hire' && styles.intentTextSelected
                    ]}>
                        I want to Hire
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.intentCard,
                        selectedIntent === 'work' && styles.intentCardSelected
                    ]}
                    onPress={() => setSelectedIntent('work')}
                >
                    <IconSymbol
                        ios_icon_name="briefcase.circle.fill"
                        android_material_icon_name="work"
                        size={48}
                        color={selectedIntent === 'work' ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[
                        styles.intentText,
                        selectedIntent === 'work' && styles.intentTextSelected
                    ]}>
                        I want to Work
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderLocationSelect = (item: OnboardingStep) => (
        <View style={styles.contentContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.locationsContainer}>
                {loadingLocations ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                ) : locations.length === 0 ? (
                    <View style={styles.noLocations}>
                        <IconSymbol
                            ios_icon_name="globe"
                            android_material_icon_name="public"
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={styles.noLocationsText}>No specific locations found.</Text>
                        <Text style={styles.noLocationsSubText}>We'll show you all available services.</Text>
                    </View>
                ) : (
                    <View style={styles.chipsContainer}>
                        {locations.map((loc) => {
                            const isSelected = selectedLocation === loc;
                            return (
                                <TouchableOpacity
                                    key={loc}
                                    style={[
                                        styles.chip,
                                        isSelected && styles.chipSelected
                                    ]}
                                    onPress={() => toggleLocation(loc)}
                                >
                                    <IconSymbol
                                        ios_icon_name={isSelected ? "checkmark.circle.fill" : "mappin.circle"}
                                        android_material_icon_name={isSelected ? "check-circle" : "location-on"}
                                        size={16}
                                        color={isSelected ? colors.background : colors.textSecondary}
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={[
                                        styles.chipText,
                                        isSelected && styles.chipTextSelected
                                    ]}>
                                        {loc}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            <Text style={styles.hintText}>
                {selectedLocation
                    ? `Services will be filtered for ${selectedLocation}`
                    : "Showing all services from everywhere"}
            </Text>
        </View>
    );

    const renderItem = ({ item }: { item: OnboardingStep }) => {
        return (
            <View style={styles.slide}>
                {item.type === 'intent'
                    ? renderIntentSelect(item)
                    : item.type === 'location'
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
                extraData={{ selectedLocation, locations, loadingLocations, selectedIntent }}
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
    title: {
        ...typography.h1,
        textAlign: 'center',
        marginBottom: spacing.md,
        color: colors.text,
    },
    description: {
        ...typography.body,
        textAlign: 'center',
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    intentsContainer: {
        width: '100%',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
    },
    intentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border,
        gap: spacing.md,
    },
    intentCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10', // 10% opacity hex
    },
    intentText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    intentTextSelected: {
        color: colors.primary,
    },
    locationsContainer: {
        width: '100%',
        minHeight: 200,
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    noLocations: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    noLocationsText: {
        ...typography.h3,
        marginTop: spacing.md,
        color: colors.text,
    },
    noLocationsSubText: {
        ...typography.bodySecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'center',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chipSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    chipTextSelected: {
        color: colors.background,
    },
    hintText: {
        ...typography.caption,
        color: colors.textSecondary,
        fontStyle: 'italic',
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
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
});
