import React, { useState, useRef, useEffect, type SelectHTMLAttributes } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

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

    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
                    return;
                }
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Track coordinates in viewport
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const updateCoords = () => {
                const rect = containerRef.current!.getBoundingClientRect();
                setCoords({
                    top: rect.bottom,
                    left: rect.left,
                    width: rect.width
                });
            };
            window.addEventListener('resize', updateCoords);
            window.addEventListener('scroll', updateCoords, true);
            return () => {
                window.removeEventListener('resize', updateCoords);
                window.removeEventListener('scroll', updateCoords, true);
            };
        }
    }, [isOpen]);

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
                <label className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        if (!isOpen && containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            setCoords({
                                top: rect.bottom,
                                left: rect.left,
                                width: rect.width
                            });
                        }
                        setIsOpen(!isOpen);
                    }
                }}
                className={`
                    w-full px-5 py-3.5 rounded-2xl text-left
                    bg-surface
                    border transition-all duration-200
                    text-on-surface text-sm font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed
                    focus:outline-none focus:ring-2 focus:ring-primary/10
                    cursor-pointer flex items-center justify-between gap-2
                    ${error
                        ? 'border-error/40 focus:border-error'
                        : isOpen
                            ? 'border-primary ring-2 ring-primary/10'
                            : 'border-outline hover:border-outline-variant'
                    }
                    ${className}
                `}
            >
                <span className={selectedOption ? 'text-on-surface' : 'text-on-surface-variant/40'}>
                    {displayLabel}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-on-surface-variant/45 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Custom Dropdown */}
            {createPortal(
                <AnimatePresence>
                    {isOpen && coords && (
                        <motion.div
                            ref={dropdownRef}
                            initial={{ opacity: 0, y: -8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.96 }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            className="fixed rounded-2xl border border-outline bg-surface shadow-2xl overflow-hidden"
                            style={{
                                top: `${coords.top}px`,
                                left: `${coords.left}px`,
                                width: `${coords.width}px`,
                                boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                                maxHeight: '220px',
                                overflowY: 'auto',
                                zIndex: 999999
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
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                                            }
                                        `}
                                    >
                                        <span>{opt.label}</span>
                                        {isSelected && <Check size={14} className="text-primary" />}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Hidden native select for form compatibility */}
            <select className="sr-only" value={value} onChange={() => { }} tabIndex={-1} {...props}>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>

            {(error || helperText) && (
                <p className={`text-xs ml-1 ${error ? 'text-error font-medium' : 'text-on-surface-variant/50'}`}>
                    {error || helperText}
                </p>
            )}
        </div>
    );
};

export default Select;
