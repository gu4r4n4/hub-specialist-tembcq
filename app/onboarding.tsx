import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const STEPS = [
    {
        id: '1',
        title: 'Your Home Services Hub',
        description: 'Trusted marketplace connecting you with verified local professionals for all your needs.',
        icon: 'house.circle.fill',
        materialIcon: 'home',
    },
    {
        id: '2',
        title: 'Verified Professionals',
        description: 'Browse hundreds of pros. From plumbers to cleaners, we\'ve got you covered.',
        icon: 'person.2.circle.fill',
        materialIcon: 'people',
    },
    {
        id: '3',
        title: 'Instant Booking',
        description: 'Compare prices, read real reviews, and book services instantly in a few taps.',
        icon: 'calendar.circle.fill',
        materialIcon: 'event',
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleFinish = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await AsyncStorage.setItem('onboarding_seen', 'true');
        router.replace('/(tabs)/(home)');
    };

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        if (index !== currentIndex) setCurrentIndex(index);
    };

    const renderItem = ({ item }: any) => (
        <View style={styles.slide}>
            <View style={styles.imageCont}>
                <IconSymbol ios_icon_name={item.icon} android_material_icon_name={item.materialIcon} size={120} color={colors.primary} />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleFinish}><Text style={styles.skipText}>Skip</Text></TouchableOpacity>
            </View>

            <FlatList
                data={STEPS}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScroll}
                keyExtractor={item => item.id}
            />

            <View style={styles.footer}>
                <View style={styles.dots}>
                    {STEPS.map((_, i) => (
                        <View key={i} style={[styles.dot, i === currentIndex && styles.activeDot]} />
                    ))}
                </View>
                <TouchableOpacity style={styles.btn} onPress={handleFinish}>
                    <Text style={styles.btnText}>{currentIndex === STEPS.length - 1 ? 'Get Started' : 'Next'}</Text>
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
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        alignItems: 'flex-end',
    },
    skipText: {
        ...typography.bodySecondary,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    imageCont: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xxl,
    },
    title: {
        ...typography.h1,
        textAlign: 'center',
        fontSize: 32,
        marginBottom: spacing.md,
    },
    description: {
        ...typography.body,
        textAlign: 'center',
        color: colors.textSecondary,
        lineHeight: 24,
        fontSize: 18,
    },
    footer: {
        padding: spacing.xl,
        gap: spacing.xl,
        marginBottom: spacing.xxl,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.border,
    },
    activeDot: {
        width: 24,
        backgroundColor: colors.primary,
    },
    btn: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md + 4,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
    },
    btnText: {
        color: '#FFF',
        fontWeight: '800',
        fontSize: 18,
    },
});
