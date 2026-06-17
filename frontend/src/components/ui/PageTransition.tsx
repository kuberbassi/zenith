import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: React.ReactNode;
}

const variants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -6 },
};

const transition = {
    duration: 0.28,
    ease: [0.16, 1, 0.3, 1] as const,
};

/**
 * Wraps app content and applies a smooth fade + subtle vertical slide
 * whenever the route changes. AnimatePresence uses `mode="wait"` so the
 * old page exits fully before the new one enters, preventing flicker.
 */
const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={location.pathname}
                variants={variants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                style={{ willChange: 'opacity, transform' }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
};

export default PageTransition;
