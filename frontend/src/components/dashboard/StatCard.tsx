import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down';
    color?: 'primary' | 'secondary' | 'tertiary' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, color = 'primary' }) => {
    const colorClasses = {
        primary: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary/10 text-secondary',
        tertiary: 'bg-tertiary/10 text-tertiary',
        error: 'bg-error/10 text-error',
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-surface p-4 rounded-2xl border border-outline-variant/20 shadow-sm"
        >
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl ${colorClasses[color]}`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center text-xs font-bold ${trend === 'up' ? 'text-white' : 'text-error'}`}>
                        {trend === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    </div>
                )}
            </div>
            <h3 className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">{title}</h3>
            <p className="text-2xl font-bold text-on-surface mt-1">{value}</p>
        </motion.div>
    );
};

export default StatCard;
