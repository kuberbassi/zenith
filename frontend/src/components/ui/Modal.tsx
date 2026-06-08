import React, { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: ReactNode;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    className = '',
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    // Stable ref so keyDown handler never causes effect re-runs
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Close on Escape
            if (e.key === 'Escape') {
                onCloseRef.current();
                return;
            }

            // Arrow key scrolling — only when focus is NOT inside an input/textarea/select
            const target = e.target as HTMLElement;
            const isEditable = target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target.isContentEditable;
            if (isEditable) return;

            const content = contentRef.current;
            if (!content) return;

            const scrollAmount = 60;
            switch (e.key) {
                case 'ArrowDown':
                    content.scrollTop += scrollAmount;
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    content.scrollTop -= scrollAmount;
                    e.preventDefault();
                    break;
                case 'PageDown':
                    content.scrollTop += content.clientHeight * 0.8;
                    e.preventDefault();
                    break;
                case 'PageUp':
                    content.scrollTop -= content.clientHeight * 0.8;
                    e.preventDefault();
                    break;
                case 'Home':
                    if (e.ctrlKey) {
                        content.scrollTop = 0;
                        e.preventDefault();
                    }
                    break;
                case 'End':
                    if (e.ctrlKey) {
                        content.scrollTop = content.scrollHeight;
                        e.preventDefault();
                    }
                    break;
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        };
    }, [isOpen]); // only re-run when modal opens/closes, NOT on onClose identity change

    const sizeClasses = {
        sm: 'max-w-[400px]',   // 400px
        md: 'max-w-[480px]',   // 480px
        lg: 'max-w-[560px]',   // 560px
        xl: 'max-w-[680px]',   // 680px
    };

    const hasCustomMaxWidth = className.split(' ').some(c => c.startsWith('max-w-'));

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm will-change-[opacity]"
                    />

                    {/* Modal - Theme-aware colors */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        className={`relative w-full ${hasCustomMaxWidth ? '' : sizeClasses[size]} ${className} rounded-2xl bg-surface border border-outline shadow-2xl overflow-hidden will-change-transform max-h-[90vh] flex flex-col`}
                    >
                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between px-5 py-4 md:px-6 md:py-4 bg-surface-container/20 border-b border-outline">
                                <h2 className="text-base font-bold text-on-surface">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant/40 hover:text-on-surface"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Body - theme-aware text colors */}
                        <div
                            ref={contentRef}
                            tabIndex={-1}
                            className="p-5 md:p-6 overflow-y-auto flex-1 custom-scrollbar focus:outline-none"
                        >
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default Modal;
