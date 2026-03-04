import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function MagneticElement({ children, className = '', springConfig = { stiffness: 150, damping: 15, mass: 0.1 } }: { children: React.ReactNode, className?: string, springConfig?: any }) {
    const ref = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, springConfig);
    const mouseYSpring = useSpring(y, springConfig);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();

        // Calculate distance from center of element
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Pull factor (how strongly it follows the mouse)
        // 0.2 means it moves 20% of the distance towards the mouse
        const pullFactor = 0.3;

        const distanceX = (e.clientX - centerX) * pullFactor;
        const distanceY = (e.clientY - centerY) * pullFactor;

        x.set(distanceX);
        y.set(distanceY);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            style={{
                x: mouseXSpring,
                y: mouseYSpring,
                zIndex: isHovered ? 50 : 1
            }}
            className={`cursor-pointer ${className}`}
        >
            {children}
        </motion.div>
    );
}
