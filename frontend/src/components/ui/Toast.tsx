import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (type: ToastType, message: string, duration?: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Dispatch a toast from anywhere (outside React). Used by api.ts interceptors.
 */
export function dispatchGlobalToast(type: ToastType, message: string) {
    window.dispatchEvent(new CustomEvent('global-toast', { detail: { type, message } }));
}

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (type: ToastType, message: string, duration = 3000) => {
        const id = Math.random().toString(36).substring(7);
        const newToast: Toast = { id, type, message, duration };

        setToasts((prev) => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    const success = (message: string) => showToast('success', message);
    const error = (message: string) => showToast('error', message);
    const warning = (message: string) => showToast('warning', message);
    const info = (message: string) => showToast('info', message);

    // Listen for global toast events fired from outside React (e.g. api.ts)
    useEffect(() => {
        const handler = (e: Event) => {
            const { type, message } = (e as CustomEvent<{ type: ToastType; message: string }>).detail;
            showToast(type, message);
        };
        window.addEventListener('global-toast', handler);
        return () => window.removeEventListener('global-toast', handler);
    });

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="w-5 h-5" />;
            case 'error':
                return <XCircle className="w-5 h-5" />;
            case 'warning':
                return <AlertCircle className="w-5 h-5" />;
            case 'info':
                return <Info className="w-5 h-5" />;
        }
    };

    const getColors = (type: ToastType) => {
        switch (type) {
            case 'success':
                return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            case 'error':
                return 'bg-red-500/10 border-red-500/20 text-red-400';
            case 'warning':
                return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
            case 'info':
                return 'bg-white/5 border-white/10 text-white/90';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}

            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.8 }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg min-w-[300px] max-w-md ${getColors(toast.type)}`}
                        >
                            {getIcon(toast.type)}
                            <p className="flex-1 text-sm font-medium">{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
