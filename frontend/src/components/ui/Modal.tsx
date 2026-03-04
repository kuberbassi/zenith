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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Close on Escape
            if (e.key === 'Escape') {
                onClose();
                return;
            }

            // Arrow key scrolling for modal content
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
            // Focus the modal for accessibility
            contentRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
    };

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
                        className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-md will-change-[opacity]"
                    />

                    {/* Modal - Theme-aware colors */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        className={`relative w-full ${sizeClasses[size]} ${className} rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5),_0_0_80px_rgba(59,130,246,0.05)] overflow-hidden will-change-transform max-h-[90vh] flex flex-col bg-[#111] border border-white/[0.08]`}
                    >
                        {/* Header */}
                        {title && (
                            <div className="flex items-center justify-between p-6 bg-white/[0.02] border-b border-white/[0.08]">
                                <h2 className="text-xl font-display font-medium text-white/90">{title}</h2>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors text-white/40 hover:text-white/80"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}

                        {/* Body - theme-aware text colors */}
                        <div
                            ref={contentRef}
                            tabIndex={-1}
                            className="p-6 text-white/80 overflow-y-auto flex-1 custom-scrollbar focus:outline-none"
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
