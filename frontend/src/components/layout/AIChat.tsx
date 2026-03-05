import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Sparkles, User, ChevronDown, Trash2 } from 'lucide-react';
import api from '@/services/api';

// Lightweight markdown → JSX for AI messages
const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
        // Bold **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-bold text-white">{part.slice(2, -2)}</strong>;
            }
            return <span key={j}>{part}</span>;
        });

        // Bullet points
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            return <div key={i} className="flex gap-1.5 ml-1"><span className="text-blue-400/60 shrink-0">•</span><span>{parts.slice(0)}</span></div>;
        }

        // Empty lines become spacing
        if (!trimmed) return <div key={i} className="h-1.5" />;

        return <div key={i}>{parts}</div>;
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
    'Which subjects can I skip?',
    'How\'s my attendance overall?',
    'What\'s my schedule today?',
    'Help me improve my grades',
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
        scrollToBottom();
    }, [messages, isTyping]);

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

            const response = await api.post('/api/ai/chat', {
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
                        whileHover={{ scale: 1.08, y: -2 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-[90px] md:bottom-[112px] right-4 lg:right-8 z-50 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center overflow-hidden group"
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)',
                            boxShadow: '0 4px 24px rgba(99, 102, 241, 0.4), 0 2px 8px rgba(0,0,0,0.3)',
                        }}
                    >
                        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white relative z-10" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Chat Panel ──────────────────────────────────────── */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        ref={panelRef}
                        className="fixed bottom-[90px] md:bottom-[112px] right-3 lg:right-8 z-50 w-[calc(100vw-24px)] max-w-[380px] h-[520px] max-h-[calc(100vh-96px)] flex flex-col overflow-hidden rounded-2xl"
                        style={{
                            background: '#0c0c0f',
                            border: '1px solid rgba(255,255,255,0.06)',
                            boxShadow: '0 24px 80px -12px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                                    <Sparkles className="w-3.5 h-3.5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-[13px] leading-none">AcadHub AI</h3>
                                    <span className="text-[10px] text-white/30 font-medium">Llama 3.3 · Your data</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                                {messages.length > 0 && (
                                    <button onClick={clearChat} className="p-1.5 text-white/20 hover:text-white/50 transition-colors rounded-lg hover:bg-white/[0.04]" title="Clear chat">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="p-1.5 text-white/20 hover:text-white/50 transition-colors rounded-lg hover:bg-white/[0.04]">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar"
                        >
                            {/* Empty State */}
                            {messages.length === 0 && !isTyping && (
                                <div className="h-full flex flex-col items-center justify-center gap-5 py-6">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <Sparkles className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-white/60 text-sm font-medium mb-1">Ask me anything</p>
                                        <p className="text-white/25 text-xs max-w-[220px]">I can see your attendance, timetable, subjects, and more</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
                                        {SUGGESTIONS.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(s)}
                                                className="px-3 py-2 rounded-xl text-[11px] text-white/40 hover:text-white/70 font-medium text-left transition-all hover:bg-white/[0.04]"
                                                style={{ border: '1px solid rgba(255,255,255,0.05)' }}
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
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: msg.error ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))', border: `1px solid ${msg.error ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.15)'}` }}>
                                            <Sparkles className={`w-3 h-3 ${msg.error ? 'text-red-400' : 'text-blue-400'}`} />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[75%] px-3 py-2 text-[13px] leading-relaxed ${msg.role === 'user'
                                            ? 'rounded-2xl rounded-br-md text-white'
                                            : msg.error
                                                ? 'rounded-2xl rounded-bl-md text-red-300/80'
                                                : 'rounded-2xl rounded-bl-md text-white/70'
                                            }`}
                                        style={{
                                            background: msg.role === 'user'
                                                ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                                                : msg.error
                                                    ? 'rgba(239,68,68,0.08)'
                                                    : 'rgba(255,255,255,0.04)',
                                            border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-6 h-6 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5 border border-white/[0.06]">
                                            <User className="w-3 h-3 text-white/40" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-start">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.15)' }}>
                                        <Sparkles className="w-3 h-3 text-blue-400" />
                                    </div>
                                    <div className="px-3 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                        {[0, 0.15, 0.3].map((delay, i) => (
                                            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay }} className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Scroll anchor & button */}
                            <div ref={messagesEndRef} className="h-1" />
                        </div>

                        {showScrollBtn && (
                            <button onClick={scrollToBottom} className="absolute bottom-[60px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm hover:bg-white/15 transition-all z-10">
                                <ChevronDown className="w-4 h-4 text-white/50" />
                            </button>
                        )}

                        {/* Input */}
                        <div className="px-3 py-2.5 border-t border-white/[0.06]">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Ask about your academics..."
                                    className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/30 transition-all"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
                                    style={{
                                        background: input.trim() && !isTyping ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <Send className="w-4 h-4 text-white" />
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
