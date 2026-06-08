import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';

const NotFound: React.FC = () => {
    const { isAuthenticated } = useAuth();

    usePageMeta({
        title: 'Page Not Found | Zenith',
        description: 'The page you requested does not exist on Zenith.',
        indexable: false,
    });

    return (
        <div className="min-h-screen bg-background text-on-background flex items-center justify-center px-6 py-12 font-sans">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-sm w-full text-center space-y-8 select-none"
            >
                {/* Error code */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-on-surface-variant/30">
                        Error 404
                    </p>
                    <h1 className="text-6xl font-bold tracking-tight text-on-surface">
                        Lost
                    </h1>
                    <p className="text-sm text-on-surface-variant/50 leading-relaxed max-w-xs mx-auto">
                        This page doesn't exist or has moved somewhere else.
                    </p>
                </div>

                {/* Divider */}
                <div className="w-12 h-px bg-outline mx-auto" />

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to={isAuthenticated ? '/' : '/login'}
                        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-on-surface text-surface text-xs font-semibold hover:opacity-90 transition-all"
                    >
                        {isAuthenticated ? <Home size={14} /> : <LogIn size={14} />}
                        {isAuthenticated ? 'Go Home' : 'Sign In'}
                    </Link>
                    <a
                        href="/privacy"
                        className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg border border-outline bg-surface text-on-surface-variant text-xs font-semibold hover:border-on-surface hover:text-on-surface transition-all"
                    >
                        Privacy
                    </a>
                </div>
            </motion.div>
        </div>
    );
};

export default NotFound;
