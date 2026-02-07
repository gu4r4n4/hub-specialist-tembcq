
import React from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Href } from 'expo-router';

export default function TabLayout() {
  const tabs = [
    {
      name: 'home',
      route: '/(tabs)/(home)' as Href,
      label: 'Home',
      icon: 'home' as const,
    },
    {
      name: 'services',
      route: '/(tabs)/services' as Href,
      label: 'Services',
      icon: 'work' as const,
    },
    {
      name: 'orders',
      route: '/(tabs)/orders' as Href,
      label: 'Orders',
      icon: 'receipt' as const,
    },
    {
      name: 'profile',
      route: '/(tabs)/profile' as Href,
      label: 'Profile',
      icon: 'person' as const,
    },
  ];

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
        <Stack.Screen name="services" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
