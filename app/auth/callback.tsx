import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

export default function AuthCallback() {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 20 }}>Verifying login...</Text>
        </View>
    );
}
