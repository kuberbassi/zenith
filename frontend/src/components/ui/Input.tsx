import React, { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    fullWidth?: boolean;
}

const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    fullWidth = true,
    className = '',
    disabled,
    ...props
}) => {
    return (
        <div className={`${fullWidth ? 'w-full' : 'w-auto'} flex flex-col gap-1.5`}>
            {label && (
                <label className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                <input
                    className={`
                        w-full px-4 py-3 rounded-xl
                        bg-surface-container-highest
                        border transition-all duration-200
                        text-on-surface text-sm placeholder-on-surface-variant/50
                        disabled:opacity-50 disabled:cursor-not-allowed
                        focus:outline-none focus:ring-4 focus:ring-primary/10
                        ${error
                            ? 'border-error focus:border-error text-error'
                            : 'border-outline-variant/50 focus:border-primary hover:border-outline-variant'
                        }
                        ${className}
                    `}
                    disabled={disabled}
                    {...props}
                />
            </div>
            {(error || helperText) && (
                <p className={`text-xs ml-1 ${error ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
                    {error || helperText}
                </p>
            )}
        </div>
    );
};

export default Input;
