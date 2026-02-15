
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    TouchableOpacity,
    Image,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Find Trusted Specialists',
        description: 'Connect with verified professionals for all your home service needs.',
        icon: 'magnifyingglass.circle.fill', // SF Symbol
        materialIcon: 'search',
    },
    {
        id: '2',
        title: 'Book Instantly',
        description: 'Schedule appointments seamlessly with real-time availability.',
        icon: 'calendar.circle.fill',
        materialIcon: 'event',
    },
    {
        id: '3',
        title: 'Track Your Orders',
        description: 'Monitor your service status and chat with specialists in real-time.',
        icon: 'checkmark.circle.fill',
        materialIcon: 'check-circle',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('onboarding_seen', 'true');
            router.replace('/(tabs)/(home)');
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            handleFinish();
        }
    };

    const handleSkip = () => {
        handleFinish();
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        setCurrentIndex(index);
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => (
        <View style={styles.slide}>
            <View style={styles.imageContainer}>
                <IconSymbol
                    ios_icon_name={item.icon as any}
                    android_material_icon_name={item.materialIcon as any}
                    size={120}
                    color={colors.primary}
                />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
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
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                keyExtractor={(item) => item.id}
                style={styles.list}
            />

            <View style={styles.footer}>
                <View style={styles.pagination}>
                    {SLIDES.map((_, index) => (
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
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
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
        paddingTop: spacing.xxl, // More space at top
    },
    imageContainer: {
        marginBottom: spacing.xxl,
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: 100, // Circle
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
        paddingHorizontal: spacing.lg,
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
