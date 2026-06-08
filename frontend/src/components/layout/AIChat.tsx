import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Sparkles, User, ChevronDown, Trash2 } from 'lucide-react';
import api from '@/services/api';

// Lightweight markdown → JSX for AI messages (Theme aware)
const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
        // Bold **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
        });

        // Bullet points
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            // Strip the list token from display
            const contentOnly = line.replace(/^[\s-•]+/, '');
            const subparts = contentOnly.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
                }
                return <span key={j}>{part}</span>;
            });
            return (
                <div key={i} className="flex gap-2 ml-1 my-1">
                    <span className="text-primary/70 shrink-0">•</span>
                    <span>{subparts}</span>
                </div>
            );
        }

        // Empty lines become spacing
        if (!trimmed) return <div key={i} className="h-2" />;

        return <div key={i} className="my-0.5">{parts}</div>;
    });
};

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    error?: boolean;
}

const SUGGESTIONS = [
    'How is my attendance today?',
    'Show my timetable',
    'Which classes can I skip?',
    'Analyze my results',
    'Optimize my study plan',
];

const AIChat: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isTyping, isOpen]);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    };

    // Close panel on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleSend = async (text?: string) => {
        const msg = (text || input).trim();
        if (!msg || isTyping) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: msg,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const history = messages
                .slice(-10)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await api.post('/api/ai/chat_v2', {
                message: msg,
                history,
            });

            const aiContent = response.data?.data?.response || 'Sorry, I couldn\'t process that. Try again!';

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiContent,
                timestamp: new Date()
            }]);
        } catch (err: any) {
            const errorMsg = err?.response?.data?.error || 'Something went wrong. Please try again.';
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: errorMsg,
                timestamp: new Date(),
                error: true,
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <>
            {/* ── Floating Button ─────────────────────────────────── */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 lg:right-8 z-40 w-14 h-14 rounded-full flex items-center justify-center bg-primary text-on-primary shadow-2xl transition-all cursor-pointer"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Chat Panel ──────────────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        ref={panelRef}
                        className="fixed bottom-[84px] right-6 lg:right-8 z-[9999] w-[calc(100vw-32px)] max-w-[400px] h-[550px] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden rounded-2xl bg-surface/90 border border-outline/50 backdrop-blur-xl shadow-2xl text-on-surface"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-outline/30 bg-surface-container/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-on-surface text-sm leading-none">Zenith AI</h3>
                                    <span className="text-[10px] text-on-surface-variant/50 font-semibold mt-1 block">Powered by Llama · Assistant</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {messages.length > 0 && (
                                    <button onClick={clearChat} className="p-2 text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container rounded-xl transition-all" title="Wipe session">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="p-2 text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container rounded-xl transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar"
                        >
                            {/* Empty State */}
                            {messages.length === 0 && !isTyping && (
                                <div className="h-full flex flex-col items-center justify-center gap-5 py-6" style={{ minHeight: '320px' }}>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-surface-container border border-outline/30">
                                        <Sparkles className="w-5 h-5 text-on-surface-variant/40 animate-pulse" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-on-surface text-sm font-bold leading-none">How can I help you today?</p>
                                        <p className="text-on-surface-variant/40 text-xs font-semibold max-w-[240px]">Ask me about attendance deficit risks, timetable slots, or grades scanning.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5 w-full max-w-[280px]">
                                        {SUGGESTIONS.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(s)}
                                                className="px-4 py-2.5 rounded-xl text-xs text-on-surface-variant hover:text-on-surface font-semibold text-left transition-all bg-surface-container/40 border border-outline/20 hover:bg-surface-container-high hover:translate-x-1"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Message Bubbles */}
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-primary/10 border border-primary/20 text-primary">
                                            <Sparkles className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed font-medium ${msg.role === 'user'
                                            ? 'rounded-2xl rounded-tr-sm bg-on-surface text-surface shadow-md'
                                            : msg.error
                                                ? 'rounded-2xl rounded-tl-sm bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
                                                : 'rounded-2xl rounded-tl-sm bg-surface-container-high border border-outline/35 text-on-surface shadow-xs'
                                            }`}
                                    >
                                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-surface-container border border-outline flex items-center justify-center shrink-0 mt-0.5 text-on-surface-variant/60">
                                            <User className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-start">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 border border-primary/20 text-primary">
                                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-surface-container-high border border-outline/35 flex items-center gap-1.5 shadow-xs">
                                        <span className="text-xs font-semibold text-on-surface-variant/40 animate-pulse">Analyzing schedule...</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Scroll anchor & button */}
                            <div ref={messagesEndRef} className="h-2" />
                        </div>

                        {showScrollBtn && (
                            <button onClick={scrollToBottom} className="absolute bottom-[84px] left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-surface border border-outline flex items-center justify-center shadow-lg hover:bg-surface-container transition-all z-10">
                                <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                            </button>
                        )}

                        {/* Input Area */}
                        <div className="px-4 py-4 border-t border-outline/30 bg-surface-container/30">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-surface border border-outline rounded-xl py-3 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-all focus:ring-1 focus:ring-primary/25 font-semibold"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${input.trim() && !isTyping ? 'bg-primary text-on-primary hover:scale-105 active:scale-95 shadow-md shadow-primary/20' : 'bg-surface-container border border-outline/20 text-on-surface-variant/20 opacity-45 cursor-not-allowed'}`}
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AIChat;
