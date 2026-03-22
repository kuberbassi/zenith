import React from 'react';
import { motion } from 'framer-motion';

export const Loader: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => {
    return (
        <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/5 border-t-white/80 border-r-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
            <motion.div
                className="absolute inset-[4px] rounded-full border border-white/5 border-b-white/50 border-l-white/20"
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <div className="absolute inset-0 rounded-full bg-white/5 blur-xl animate-pulse" />
        </div>
    );
};

export default Loader;
