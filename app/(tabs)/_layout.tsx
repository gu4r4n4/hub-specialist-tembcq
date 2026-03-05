import { Stack, Href } from 'expo-router';
import FloatingTabBar from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function TabLayout() {
  const { profile } = useAuth();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasUnreadOrders, setHasUnreadOrders] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // Fetch initial counts
    const fetchCounts = async () => {
      // Unread messages
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('is_read', false)
        .neq('sender_profile_id', profile.id)
        .limit(1);

      setHasUnreadMessages(!!messages && messages.length > 0);

      // New orders (Status = new)
      if (profile.role === 'specialist') {
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('status', 'new')
          .eq('specialist_profile_id', profile.id)
          .limit(1);
        setHasUnreadOrders(!!orders && orders.length > 0);
      } else {
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .eq('status', 'new')
          .eq('consumer_profile_id', profile.id)
          .limit(1);
        setHasUnreadOrders(!!orders && orders.length > 0);
      }
    };

    fetchCounts();

    // Subscribe to changes
    const msgSubscription = supabase
      .channel('unread-messages')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'messages' }, fetchCounts)
      .subscribe();

    const orderSubscription = supabase
      .channel('unread-orders')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'orders' }, fetchCounts)
      .subscribe();

    return () => {
      msgSubscription.unsubscribe();
      orderSubscription.unsubscribe();
    };
  }, [profile]);

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
      name: 'messages',
      route: '/(tabs)/messages' as Href,
      label: 'Messages',
      icon: 'chat' as const,
      badge: hasUnreadMessages,
    },
    {
      name: 'orders',
      route: '/(tabs)/orders' as Href,
      label: 'Orders',
      icon: 'receipt' as const,
      badge: hasUnreadOrders,
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
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
      <FloatingTabBar tabs={tabs} />
    </>
  );
}
