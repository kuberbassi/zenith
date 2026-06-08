import React from 'react';
import { motion } from 'framer-motion';

export const Loader: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <motion.div
                className="absolute inset-0 rounded-full border-2 border-outline-variant/30 border-t-primary border-r-primary/50"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
            <motion.div
                className="absolute inset-[4px] rounded-full border border-outline-variant/20 border-b-primary/50 border-l-primary/20"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl animate-pulse" />
        </div>
    );
};

export default Loader;
