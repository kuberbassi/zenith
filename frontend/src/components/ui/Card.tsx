import React, { type ReactNode } from 'react';


interface CardProps {
    children: ReactNode;
    className?: string;
    variant?: 'elevated' | 'filled' | 'outlined' | 'glass' | 'default';

    hover?: boolean;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
    children,
    className = '',
    variant = 'elevated',
    onClick,
}) => {
    const variantClasses = {
        elevated: 'bg-surface border border-outline/50 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_16px_rgba(0,0,0,0.01)]',
        filled: 'bg-surface-variant/40 text-on-surface-variant border border-transparent',
        outlined: 'bg-surface border border-outline/50',
        glass: 'bg-surface/70 backdrop-blur-md border border-outline/30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]',
        default: 'bg-surface border border-outline/40 shadow-[0_1px_2px_rgba(0,0,0,0.01)]'
    };

    return (
        <div
            className={`${variantClasses[variant as keyof typeof variantClasses] || variantClasses.elevated} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default Card;
