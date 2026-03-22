import React, { useState, useRef, useEffect, type SelectHTMLAttributes } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
    options: { value: string | number; label: string }[];
    onChange?: (e: { target: { value: string } }) => void;
}

const Select: React.FC<SelectProps> = ({
    label,
    error,
    helperText,
    fullWidth = true,
    options,
    className = '',
    disabled,
    value,
    onChange,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => String(o.value) === String(value));
    const displayLabel = selectedOption?.label || (options.length > 0 ? options[0].label : '');

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close on ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        if (isOpen) document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen]);

    const handleSelect = (optValue: string | number) => {
        if (onChange) {
            onChange({ target: { value: String(optValue) } });
        }
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`${fullWidth ? 'w-full' : 'w-auto'} flex flex-col gap-1.5 relative`}>
            {label && (
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full px-5 py-3.5 rounded-2xl text-left
                    bg-white/[0.03] backdrop-blur-sm
                    border transition-all duration-200
                    text-white text-sm font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-white/10
                    cursor-pointer flex items-center justify-between gap-2
                    ${error
                        ? 'border-red-500/40 focus:border-red-500'
                        : isOpen
                            ? 'border-white/20 ring-2 ring-white/10'
                            : 'border-white/[0.08] hover:border-white/[0.15]'
                    }
                    ${className}
                `}
            >
                <span className={selectedOption ? 'text-white' : 'text-white/30'}>
                    {displayLabel}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Custom Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={dropdownRef}
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute left-0 right-0 z-[60] mt-1 rounded-2xl border border-white/[0.1] bg-[#111111] backdrop-blur-2xl shadow-2xl overflow-hidden"
                        style={{
                            top: '100%',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
                            maxHeight: '220px',
                            overflowY: 'auto'
                        }}
                    >
                        {options.map((opt, idx) => {
                            const isSelected = String(opt.value) === String(value);
                            return (
                                <button
                                    key={`${opt.value}-${idx}`}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`
                                        w-full px-5 py-3 text-left text-sm font-medium flex items-center justify-between
                                        transition-all duration-100
                                        ${isSelected
                                            ? 'bg-white/7 text-white'
                                            : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                                        }
                                    `}
                                >
                                    <span>{opt.label}</span>
                                    {isSelected && <Check size={14} className="text-white" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hidden native select for form compatibility */}
            <select className="sr-only" value={value} onChange={() => { }} tabIndex={-1} {...props}>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            {(error || helperText) && (
                <p className={`text-xs ml-1 ${error ? 'text-red-400 font-medium' : 'text-white/30'}`}>
                    {error || helperText}
                </p>
            )}
        </div>
    );
};

export default Select;
