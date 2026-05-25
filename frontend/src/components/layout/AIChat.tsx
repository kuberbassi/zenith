import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X, Sparkles, User, ChevronDown, Trash2 } from 'lucide-react';
import api from '@/services/api';
import Loader from '@/components/ui/Loader';

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
            return <div key={i} className="flex gap-1.5 ml-1"><span className="text-white/60 shrink-0">•</span><span>{parts.slice(0)}</span></div>;
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
                        className="fixed bottom-6 right-6 lg:right-8 z-50 w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center overflow-hidden glass-panel group shadow-2xl transition-all"
                    >
                        <div className="absolute inset-0 bg-white/[0.05] group-hover:bg-white/[0.1] transition-colors" />
                        <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white relative z-10" />
                        <div className="absolute -inset-4 bg-white/5 blur-xl group-hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100" />
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
                        className="fixed bottom-[80px] right-6 lg:right-8 z-50 w-[calc(100vw-24px)] max-w-[380px] h-[520px] max-h-[calc(100vh-104px)] flex flex-col overflow-hidden rounded-[2rem] glass-glow"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/10 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-[13px] uppercase tracking-widest leading-none">Zenith AI</h3>
                                    <span className="text-[10px] text-white/25 font-bold uppercase tracking-tighter">Llama 3.3 · Control Link</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {messages.length > 0 && (
                                    <button onClick={clearChat} className="p-2 text-white/20 hover:text-white/60 transition-all rounded-xl hover:bg-white/[0.05]" title="Wipe session">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="p-2 text-white/20 hover:text-white/60 transition-all rounded-xl hover:bg-white/[0.05]">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto px-5 py-4 space-y-4 no-scrollbar"
                        >
                            {/* Empty State */}
                            {messages.length === 0 && !isTyping && (
                                <div className="h-full flex flex-col items-center justify-center gap-6 py-6" style={{ minHeight: '300px' }}>
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/[0.08] shadow-2xl">
                                        <Sparkles className="w-6 h-6 text-white/40" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <p className="text-white/70 text-sm font-black uppercase tracking-widest leading-none">Awaiting Protocol</p>
                                        <p className="text-white/30 text-xs font-medium max-w-[220px]">Synthetic intelligence connected to your academic mainframe</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                                        {SUGGESTIONS.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(s)}
                                                className="px-4 py-2.5 rounded-xl text-[11px] text-white/40 hover:text-white/80 font-bold text-left transition-all bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.1] hover:translate-x-1"
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
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-white/5 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                                            <Sparkles className={`w-4 h-4 ${msg.error ? 'text-red-400' : 'text-white/60'}`} />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[85%] px-4 py-3 text-[13px] leading-relaxed font-medium ${msg.role === 'user'
                                            ? 'rounded-2xl rounded-tr-sm bg-white text-black shadow-xl shadow-white/5'
                                            : msg.error
                                                ? 'rounded-2xl rounded-tl-sm bg-red-500/10 border border-red-500/20 text-red-200/90'
                                                : 'rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.06] text-white/80'
                                            }`}
                                    >
                                        {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center shrink-0 mt-0.5 border border-white/[0.1]">
                                            <User className="w-4 h-4 text-white/60" />
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-start">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 border border-white/10">
                                        <Loader size={16} />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.03] border border-white/[0.06] flex items-center gap-1.5">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-white/20 animate-pulse">Analyzing context...</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* Scroll anchor & button */}
                            <div ref={messagesEndRef} className="h-2" />
                        </div>

                        {showScrollBtn && (
                            <button onClick={scrollToBottom} className="absolute bottom-[80px] left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-xl hover:bg-white/20 transition-all z-10 shadow-2xl">
                                <ChevronDown className="w-5 h-5 text-white/80" />
                            </button>
                        )}

                        {/* Input */}
                        <div className="px-4 py-4 border-t border-white/[0.08] bg-white/[0.02]">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    placeholder="Execute command..."
                                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/15 focus:outline-none focus:border-white/20 transition-all focus:bg-white/[0.06] font-medium"
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xl ${input.trim() && !isTyping ? 'bg-white text-black hover:scale-105 active:scale-95' : 'bg-white/[0.04] border border-white/[0.06] text-white/20 opacity-40 cursor-not-allowed'}`}
                                >
                                    <Send className="w-5 h-5" />
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
