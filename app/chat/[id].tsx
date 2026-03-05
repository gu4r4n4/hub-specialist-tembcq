import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/styles/commonStyles';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Chat, Message, Profile } from '@/types/database';
import { IconSymbol } from '@/components/IconSymbol';
import * as Haptics from 'expo-haptics';

export default function ChatDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { user, profile } = useAuth();

    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (id) {
            loadChat();
            const subscription = subscribeToMessages();
            return () => {
                subscription?.unsubscribe();
            };
        }
    }, [id]);

    const loadChat = async () => {
        if (!id || !isSupabaseConfigured) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('chats')
                .select('*, service:services(*), consumer:profiles!consumer_profile_id(*), specialist:profiles!specialist_profile_id(*)')
                .eq('id', id)
                .single();

            if (error) throw error;
            setChat(data as any);

            // Load initial messages
            const { data: initialMessages, error: msgError } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', id)
                .order('created_at', { ascending: true });

            if (msgError) throw msgError;
            setMessages(initialMessages || []);
        } catch (err: any) {
            console.error('Error loading chat:', err);
            Alert.alert('Error', 'Failed to load conversation');
        } finally {
            setLoading(false);
        }
    };

    const subscribeToMessages = () => {
        if (!id) return null;
        return supabase
            .channel(`chat:${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${id}`,
                },
                (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages((current) => [...current, newMsg]);
                    // Auto scroll to bottom
                    setTimeout(() => {
                        flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                }
            )
            .subscribe();
    };

    const handleSend = async () => {
        if (!newMessage.trim() || !user || !profile || !id || sending) return;

        setSending(true);
        const textToSend = newMessage.trim();
        setNewMessage('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            const { error } = await supabase.from('messages').insert({
                chat_id: id as string,
                sender_profile_id: profile.id,
                content: textToSend,
            });

            if (error) throw error;

            // Update chat's updated_at
            await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', id);
        } catch (err: any) {
            console.error('Error sending message:', err);
            Alert.alert('Error', 'Failed to send message');
            setNewMessage(textToSend); // Restore message
        } finally {
            setSending(false);
        }
    };

    const handleBook = () => {
        if (!chat?.service_id) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(`/booking/${chat.service_id}`);
    };

    if (loading || !chat) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const otherPerson = profile?.id === chat.consumer_profile_id ? chat.specialist : chat.consumer;
    const isSpecialist = profile?.role === 'specialist';

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName}>{otherPerson?.full_name}</Text>
                    <Text style={styles.headerService} numberOfLines={1}>{chat.service?.title}</Text>
                </View>
                {!isSpecialist && (
                    <TouchableOpacity onPress={handleBook} style={styles.bookBtn}>
                        <Text style={styles.bookBtnText}>Book Now</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item }) => {
                    const isMine = item.sender_profile_id === profile?.id;
                    return (
                        <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
                            <Text style={[styles.messageContent, isMine ? styles.myMessageText : styles.theirMessageText]}>
                                {item.content}
                            </Text>
                            <Text style={[styles.messageTime, isMine ? styles.myMessageTime : styles.theirMessageTime]}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    );
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        value={newMessage}
                        onChangeText={setNewMessage}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!newMessage.trim() || sending}
                        style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
                    >
                        {sending ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <IconSymbol ios_icon_name="paperplane.fill" android_material_icon_name="send" size={20} color="#FFF" />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
    },
    headerName: {
        ...typography.body,
        fontWeight: '700',
    },
    headerService: {
        ...typography.caption,
        color: colors.primary,
        fontWeight: '600',
    },
    bookBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
    },
    bookBtnText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '700',
    },
    messageList: {
        padding: spacing.md,
        gap: 12,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFF',
        borderBottomLeftRadius: 4,
    },
    messageContent: {
        ...typography.body,
        fontSize: 15,
    },
    myMessageText: {
        color: '#FFF',
    },
    theirMessageText: {
        color: colors.text,
    },
    messageTime: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    theirMessageTime: {
        color: colors.textTertiary,
    },
    inputArea: {
        flexDirection: 'row',
        padding: spacing.md,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'flex-end',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        paddingTop: 8,
        maxHeight: 100,
        ...typography.body,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: colors.borderDark,
    },
});
