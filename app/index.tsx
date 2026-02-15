
import { useEffect, useState } from 'react';
import { Redirect, SplashScreen } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
    const [isReady, setIsReady] = useState(false);
    const [onboardingSeen, setOnboardingSeen] = useState(false);

    useEffect(() => {
        async function loadResourcesAndDataAsync() {
            try {
                const value = await AsyncStorage.getItem('onboarding_seen');
                if (value === 'true') {
                    setOnboardingSeen(true);
                }
            } catch (e) {
                console.warn(e);
            } finally {
                setIsReady(true);
                SplashScreen.hideAsync();
            }
        }

        loadResourcesAndDataAsync();
    }, []);

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (onboardingSeen) {
        return <Redirect href="/(tabs)/(home)" />;
    }

    return <Redirect href="/onboarding" />;
}
