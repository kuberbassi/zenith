import React from 'react';
import { motion } from 'framer-motion';

interface CircularProgressProps {
    value: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    primaryColor?: string;
    secondaryColor?: string;
    glowColor?: string;
    children?: React.ReactNode;
}

export default function CircularProgress({
    value,
    max = 100,
    size = 120,
    strokeWidth = 12,
    primaryColor = '#ffffff', // Tailwind blue-500
    secondaryColor = 'rgba(255, 255, 255, 0.1)',
    glowColor = 'rgba(59, 130, 246, 0.5)',
    children
}: CircularProgressProps) {
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;

    // Calculate percentage and clamp between 0 and 100
    const percentage = Math.max(0, Math.min(100, (value / max) * 100));
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Glow Drop Shadow Definitions */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="glow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="15" floodColor={glowColor} floodOpacity="0.8" />
                        <feDropShadow dx="0" dy="0" stdDeviation="30" floodColor={glowColor} floodOpacity="0.5" />
                        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ffffff" floodOpacity="0.8" />
                    </filter>
                </defs>
            </svg>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="transform -rotate-90 origin-center filter drop-shadow-[0_0_12px_rgba(var(--color-primary),0.3)] hover:drop-shadow-[0_0_20px_rgba(var(--color-primary),0.6)] transition-all duration-500"
            >
                {/* Background Track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={secondaryColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />

                {/* Progress Circle - Animated */}
                <motion.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                />
            </svg>

            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {children}
            </div>
        </div>
    );
}
