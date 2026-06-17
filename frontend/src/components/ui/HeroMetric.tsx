import React, { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface HeroMetricProps {
    value: string | number;
    label: string;
    icon?: ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
}

const HeroMetric: React.FC<HeroMetricProps> = ({
    value,
    label,
    icon,
    trend,
    trendValue
}) => {
    // Gradient based on trend
    const gradients = {
        up: 'from-success via-success-light to-success-dark',
        neutral: 'from-warning via-warning-light to-warning-dark',
        down: 'from-error via-error-light to-error-dark',
    };

    const gradient = trend ? gradients[trend] : 'from-primary via-primary-400 to-primary-600';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className={`
                relative overflow-hidden
                bg-gradient-to-br ${gradient}
                text-white
                rounded-xl
                p-12
                shadow-2xl
            `}
        >
            {/* Animated background particles */}
            <div className="absolute inset-0 opacity-20">
                <motion.div
                    className="absolute -right-16 -top-16 w-48 h-48 bg-white rounded-full blur-3xl"
                    style={{ willChange: 'transform, opacity' }}
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
                <motion.div
                    className="absolute -left-8 -bottom-8 w-32 h-32 bg-white rounded-full blur-2xl"
                    style={{ willChange: 'transform, opacity' }}
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10">
                {icon && (
                    <motion.div
                        className="mb-6 w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm"
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                        {icon}
                    </motion.div>
                )}

                <div className="flex items-baseline gap-4 mb-3">
                    <motion.h2
                        className="text-hero font-bold tracking-tighter"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    >
                        {value}
                    </motion.h2>

                    {trend && trendValue && (
                        <motion.span
                            className="text-2xl font-semibold bg-white/20 px-4 py-2 rounded-md backdrop-blur-sm"
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                        </motion.span>
                    )}
                </div>

                <p className="text-xl font-medium text-white/90">
                    {label}
                </p>
            </div>

            {/* Decorative corner accent */}
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-tl-full" />
        </motion.div>
    );
};

export default HeroMetric;
