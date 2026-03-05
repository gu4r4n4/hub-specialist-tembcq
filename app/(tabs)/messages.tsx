import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Chat } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

export default function MessagesScreen() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && profile) {
            loadChats();
        } else {
            setLoading(false);
        }
    }, [user, profile]);

    const loadChats = async () => {
        if (!isSupabaseConfigured || !profile) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('chats')
                .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
                .or(`consumer_profile_id.eq.${profile.id},specialist_profile_id.eq.${profile.id}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setChats(data as any || []);
        } catch (err) {
            console.error('Error loading chats:', err);
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
                    <IconSymbol ios_icon_name="lock.fill" android_material_icon_name="lock" size={48} color={colors.primary} />
                    <Text style={styles.emptyTitle}>Sign in to view messages</Text>
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
                                    <Text style={styles.chatService} numberOfLines={1}>{item.service?.title}</Text>
                                </View>
                                <View style={styles.chatMeta}>
                                    <Text style={styles.chatTime}>
                                        {new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </Text>
                                    <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="chevron-right" size={16} color={colors.textTertiary} />
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
    emptyText: {
        ...typography.bodySecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.md,
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '700',
    },
});
