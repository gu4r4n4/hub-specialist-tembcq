
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
        title: 'Instant Booking',
        description: 'Compare prices, read reviews, and book services instantly. All specialists are rated by real customers.',
        icon: 'calendar.circle.fill',
        materialIcon: 'event',
    },
    {
        id: '4',
        type: 'intro',
        title: 'Quality Guaranteed',
        description: 'We ensure high-quality service delivery. Your satisfaction is our top priority in every job.',
        icon: 'checkmark.seal.fill',
        materialIcon: 'verified',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList<OnboardingStep>>(null);

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('onboarding_seen', 'true');
            router.replace('/(tabs)/(home)');
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    };

    const handleNext = () => {
        handleFinish();
    };

    const handleSkip = () => {
        handleFinish();
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        if (index !== currentIndex) {
            setCurrentIndex(index);
        }
    };

    const renderItem = ({ item }: { item: OnboardingStep }) => (
        <View style={styles.slide}>
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
        </View>
    );

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
                <TouchableOpacity style={styles.button} onPress={handleFinish}>
                    <Text style={styles.buttonText}>Get Started</Text>
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
