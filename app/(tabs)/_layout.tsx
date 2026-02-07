
import React from 'react';
import FloatingTabBar from '@/components/FloatingTabBar';
import { Href } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function TabLayout() {
  const tabs = [
    {
      route: '/(tabs)/(home)' as Href,
      label: 'Home',
      ios_icon_name: 'house.fill',
      android_material_icon_name: 'home' as const,
    },
    {
      route: '/(tabs)/services' as Href,
      label: 'Services',
      ios_icon_name: 'briefcase.fill',
      android_material_icon_name: 'work' as const,
    },
    {
      route: '/(tabs)/orders' as Href,
      label: 'Orders',
      ios_icon_name: 'list.bullet.rectangle',
      android_material_icon_name: 'receipt' as const,
    },
    {
      route: '/(tabs)/profile' as Href,
      label: 'Profile',
      ios_icon_name: 'person.fill',
      android_material_icon_name: 'person' as const,
    },
  ];

  return <FloatingTabBar tabs={tabs} />;
}
