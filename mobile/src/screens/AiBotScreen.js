import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, Keyboard, Animated, Dimensions
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Layout } from '../theme';
import { attendanceService } from '../services'; // AiService mapped here
import PressableScale from '../components/PressableScale';
import AnimatedHeader from '../components/AnimatedHeader';
import { LinearGradient } from '../components/LinearGradient';
import { Send, Bot, User as UserIcon, AlertCircle, RefreshCw, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const AiBotScreen = ({ navigation }) => {
    const { isDark, colors: c } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const styles = getStyles(c, isDark);

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const scrollY = useRef(new Animated.Value(0)).current;

    // Greeting on mount
    useEffect(() => {
        setMessages([{
            role: 'assistant',
            content: `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm your AcadHub AI Assistant. I can help analyze your attendance, suggest focus areas, or answer questions about your subjects. How can I help you today?`,
            id: 'greeting'
        }]);
    }, [user]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            setTimeout(() => {
                scrollRef.current.scrollToEnd({ animated: true });
            }, 100);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || loading) return;

        const userMessageText = inputText.trim();
        setInputText('');
        Keyboard.dismiss();

        const userMessage = { role: 'user', content: userMessageText, id: Date.now().toString() };
        setMessages(prev => [...prev, userMessage]);
        scrollToBottom();

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        try {
            // Include context via standard message
            const contextMessage = `Context: The user's name is ${user?.name || 'unknown'}, course is ${user?.course || 'unknown'}, semester ${user?.semester || 'unknown'}. Be concise and helpful.`;

            // Format for standard single-turn request to backend 
            // The backend endpoint accepts { message: string } and returns { reply: string }
            const response = await attendanceService.chat({
                message: `${contextMessage}\n\nUser Question: ${userMessageText}`
            });

            const aiMessage = {
                role: 'assistant',
                content: response.response || "I'm sorry, I couldn't process that request.",
                id: (Date.now() + 1).toString()
            };

            setMessages(prev => [...prev, aiMessage]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        } catch (error) {
            console.error("AI Error:", error);
            const errorMessage = {
                role: 'assistant',
                content: "I'm having trouble connecting to my servers right now. Please try again later.",
                id: (Date.now() + 1).toString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setLoading(false);
            scrollToBottom();
        }
    };

    const handleClearChat = () => {
        Alert.alert(
            "Clear Chat",
            "Are you sure you want to clear your conversation history?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        setMessages([{
                            role: 'assistant',
                            content: `Chat cleared. How can I help you, ${user?.name?.split(' ')[0] || 'friend'}?`,
                            id: Date.now().toString()
                        }]);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                }
            ]
        );
    };

    const renderMessage = (msg) => {
        const isUser = msg.role === 'user';

        return (
            <Animated.View key={msg.id} style={[styles.messageWrapper, isUser ? styles.messageWrapperUser : styles.messageWrapperBot]}>
                {!isUser && (
                    <View style={styles.botAvatar}>
                        <Bot size={16} color="#FFF" />
                    </View>
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                    <Text style={[styles.messageText, isUser ? styles.messageTextUser : styles.messageTextBot]}>
                        {msg.content}
                    </Text>
                    {msg.isError && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 }}>
                            <AlertCircle size={12} color={c.danger} />
                            <Text style={{ fontSize: 10, color: c.danger }}>Connection failed</Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            {/* BACKGROUND */}
            <LinearGradient
                colors={isDark ? ['#1A1A1A', '#0D0D0D'] : ['#F8F9FA', '#E9ECEF']}
                noTexture style={StyleSheet.absoluteFillObject}
            />

            {/* HEADER */}
            <AnimatedHeader
                scrollY={scrollY}
                title="AI Assistant"
                subtitle="Powered by Groq"
                isDark={isDark}
                colors={c}
                rightComponent={
                    <PressableScale onPress={handleClearChat} style={styles.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <RefreshCw size={20} color={c.subtext} />
                    </PressableScale>
                }
            />

            {/* CHAT AREA */}
            <ScrollView
                ref={scrollRef}
                style={styles.chatContainer}
                contentContainerStyle={[styles.chatContent, { paddingTop: Layout.header.maxHeight + insets.top + 20 }]}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                onContentSizeChange={scrollToBottom}
                showsVerticalScrollIndicator={false}
            >
                {messages.map(renderMessage)}

                {loading && (
                    <View style={[styles.messageWrapper, styles.messageWrapperBot]}>
                        <View style={styles.botAvatar}>
                            <Bot size={16} color="#FFF" />
                        </View>
                        <View style={[styles.bubble, styles.bubbleBot, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                            <ActivityIndicator size="small" color={c.primary} />
                        </View>
                    </View>
                )}
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* INPUT AREA */}
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask about your attendance, subjects..."
                        placeholderTextColor={c.subtext}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        maxLength={500}
                    />
                    <PressableScale
                        onPress={handleSend}
                        style={[styles.sendBtn, (!inputText.trim() || loading) && styles.sendBtnDisabled]}
                        disabled={!inputText.trim() || loading}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Send size={18} color={!inputText.trim() ? c.subtext : "#FFF"} />
                        )}
                    </PressableScale>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const getStyles = (c, isDark) => StyleSheet.create({
    container: {
        flex: 1,
    },
    chatContainer: {
        flex: 1,
    },
    chatContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
        maxWidth: '85%'
    },
    messageWrapperUser: {
        alignSelf: 'flex-end',
    },
    messageWrapperBot: {
        alignSelf: 'flex-start',
    },
    botAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginBottom: 2
    },
    bubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    bubbleUser: {
        backgroundColor: c.primary,
        borderBottomRightRadius: 4,
    },
    bubbleBot: {
        backgroundColor: isDark ? '#2B2D30' : '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    messageTextUser: {
        color: '#FFFFFF',
    },
    messageTextBot: {
        color: c.text,
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        backgroundColor: isDark ? 'rgba(26,26,26,0.8)' : 'rgba(248,249,250,0.8)',
        borderTopWidth: 1,
        borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: isDark ? '#2B2D30' : '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    input: {
        flex: 1,
        color: c.text,
        fontSize: 15,
        minHeight: 36,
        maxHeight: 100,
        paddingTop: 8,
        paddingBottom: 8,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
        marginBottom: 2
    },
    sendBtnDisabled: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    },
    clearBtn: {
        padding: 8,
        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        borderRadius: 20
    }
});

export default AiBotScreen;
