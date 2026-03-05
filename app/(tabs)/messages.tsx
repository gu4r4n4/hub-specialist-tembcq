import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Chat } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function MessagesScreen() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            if (user && profile) {
                loadChats();

                // Subscribe to changes in messages and chats to refresh the list
                const chatSubscription = supabase
                    .channel('messages-tab-refresh')
                    .on('postgres_changes' as any, {
                        event: '*',
                        schema: 'public',
                        table: 'messages'
                    }, () => loadChats())
                    .on('postgres_changes' as any, {
                        event: '*',
                        schema: 'public',
                        table: 'chats'
                    }, () => loadChats())
                    .subscribe();

                return () => {
                    chatSubscription.unsubscribe();
                };
            } else {
                setLoading(false);
            }
        }, [user, profile])
    );

    const loadChats = async () => {
        if (!isSupabaseConfigured || !profile) return;
        setLoading(true);
        try {
            console.log('Fetching chats for profile ID:', profile.id);
            // First, let's try a very simple query to see if we get ANY chats
            const { data: simpleData, error: simpleError } = await supabase
                .from('chats')
                .select('id')
                .or(`consumer_profile_id.eq.${profile.id},specialist_profile_id.eq.${profile.id}`);

            console.log('Simple query data:', simpleData);
            console.log('Simple query error:', simpleError);

            const { data, error } = await supabase
                .from('chats')
                .select(`
                    *,
                    service:services(id, title),
                    consumer:profiles!consumer_profile_id(id, full_name, avatar_url),
                    specialist:profiles!specialist_profile_id(id, full_name, avatar_url),
                    messages(*)
                `)
                .or(`consumer_profile_id.eq.${profile.id},specialist_profile_id.eq.${profile.id}`)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Supabase full query error:', error);
                throw error;
            }

            console.log('Full query data count:', data?.length);
            if (data && data.length > 0) {
                console.log('First chat details:', JSON.stringify(data[0], null, 2));
            }

            // Format chats and calculate unread count
            const formattedChats = (data as any[]).map(chat => {
                const chatMessages = chat.messages || [];

                // Unread are messages NOT sent by me and marked is_read=false
                const unreadCount = chatMessages.filter((m: any) =>
                    !m.is_read && m.sender_profile_id !== profile.id
                ).length;

                // Get the most recent message
                const sortedMsgs = [...chatMessages].sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                const lastMsg = sortedMsgs[0];

                return {
                    ...chat,
                    unreadCount,
                    lastMessage: lastMsg?.content || chat.service?.title || 'No messages yet'
                };
            });

            console.log(`Messages tab: Found ${formattedChats.length} chats for profile ${profile.id}`);
            if (formattedChats.length === 0) {
                console.log('No chats found in query. Possible RLS issue or incorrect filter.');
            }
            setChats(formattedChats);
        } catch (err: any) {
            console.error('Error loading chats:', err);
            Alert.alert('DEBUG: Load Error', err.message || 'Unknown error. Check console.');
        } finally {
            setLoading(false);
        }
    };

    const handleChatPress = (chatId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/chat/${chatId}` as any);
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Messages</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={48} color={colors.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>Sign in to view messages</Text>
                    <Text style={styles.emptyText}>You need to be logged in to chat with specialists and view your conversations.</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/auth/login')}>
                        <Text style={styles.buttonText}>Sign In</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Messages</Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : chats.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <IconSymbol ios_icon_name="bubble.left.and.bubble.right" android_material_icon_name="forum" size={64} color={colors.textTertiary} />
                    <Text style={styles.emptyTitle}>No conversations yet</Text>
                    <Text style={styles.emptyText}>Start a conversation with a specialist to see it here.</Text>
                </View>
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        const otherPerson = profile?.id === item.consumer_profile_id ? item.specialist : item.consumer;
                        return (
                            <TouchableOpacity style={styles.chatCard} onPress={() => handleChatPress(item.id)}>
                                <View style={styles.avatar}>
                                    {otherPerson?.avatar_url ? (
                                        <Image source={{ uri: otherPerson.avatar_url }} style={styles.avatarImg} />
                                    ) : (
                                        <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={24} color={colors.primary} />
                                    )}
                                </View>
                                <View style={styles.chatInfo}>
                                    <Text style={styles.chatName}>{otherPerson?.full_name}</Text>
                                    <Text style={styles.chatService} numberOfLines={1}>{(item as any).lastMessage}</Text>
                                </View>
                                <View style={styles.chatMeta}>
                                    <Text style={styles.chatTime}>
                                        {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </Text>
                                    {(item as any).unreadCount > 0 ? (
                                        <View style={styles.unreadBadge}>
                                            <Text style={styles.unreadBadgeText}>{(item as any).unreadCount}</Text>
                                        </View>
                                    ) : (
                                        <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textTertiary} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
    },
    title: {
        ...typography.h2,
        fontSize: 28,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    chatInfo: {
        flex: 1,
        gap: 4,
    },
    chatName: {
        ...typography.body,
        fontWeight: '700',
    },
    chatService: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    chatMeta: {
        alignItems: 'flex-end',
        gap: 4,
    },
    chatTime: {
        ...typography.caption,
        fontSize: 10,
        color: colors.textTertiary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        ...typography.h3,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyText: {
        ...typography.bodySecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xxl,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    unreadBadge: {
        backgroundColor: colors.primary,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    unreadBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
});
