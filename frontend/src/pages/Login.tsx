import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Sun, Moon } from 'lucide-react';

const Login: React.FC = () => {
    const { loginWithGoogle } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [error, setError] = useState<string | null>(null);

    usePageMeta({
        title: 'Zenith | Student Center',
        description: 'Sign in to Zenith — your all-in-one student dashboard for IPU. Track attendance, sync results, manage timetables, and develop your skills.',
        indexable: false,
    });

    return (
        <div className="min-h-screen w-full flex flex-col justify-between items-center relative overflow-hidden bg-background text-on-background font-sans py-8">
            {/* Subtle Geist Dot Grid Background */}
            <div className="fixed inset-0 z-0 subtle-dot-grid" />

            {/* Floating Top Header / Theme Toggle */}
            <header className="w-full max-w-7xl px-6 flex justify-end z-10">
                <button
                    onClick={toggleTheme}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-outline bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all duration-200 cursor-pointer shadow-sm"
                    title="Toggle theme"
                >
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
            </header>

            {/* Main Login Card Container */}
            <main className="flex-1 flex items-center justify-center w-full max-w-md px-4 z-10 my-8">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full text-center p-8 md:p-10 rounded-2xl bg-surface border border-outline shadow-[0_8px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] select-none"
                >
                    {/* Logo Icon */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.4 }}
                        className="mb-8 flex justify-center"
                    >
                        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-surface-variant border border-outline shadow-sm flex items-center justify-center">
                            <img src="/zenith-logo.png" alt="Zenith Logo" className="w-[72px] h-[72px] object-contain" />
                        </div>
                    </motion.div>

                    {/* Branding Titles */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.18, duration: 0.4 }}
                        className="mb-8"
                    >
                        <h1 className="text-3xl font-extrabold text-on-background tracking-tight mb-2">
                            Zenith
                        </h1>
                        <p className="text-sm text-on-surface-variant font-semibold tracking-wide uppercase">
                            Student Portal
                        </p>
                        <p className="text-xs text-on-surface-variant/50 mt-1.5 font-medium">
                            Sign in with your Google account to get started
                        </p>
                    </motion.div>

                    {/* Google Login Component */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25, duration: 0.4 }}
                        className="flex flex-col items-center gap-4 relative z-20"
                    >
                        <div className="hover:scale-[1.01] transition-transform duration-200">
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    setError(null);
                                    try {
                                        if (!credentialResponse.credential) throw new Error('No credential received');
                                        await loginWithGoogle(credentialResponse.credential);
                                    } catch (err: any) {
                                        console.error('❌ Backend login failed:', err);
                                        const errMsg = err.response?.data?.error || err.message || 'Login failed. Please try again.';
                                        setError(errMsg);
                                    }
                                }}
                                onError={() => {
                                    console.error('❌ Google Login Failed');
                                    setError('Auth provider failed. Please try again.');
                                }}
                                theme={theme === 'dark' ? 'filled_black' : 'outline'}
                                size="large"
                                width={280}
                                text="continue_with"
                                shape="circle"
                            />
                        </div>
                        {error && (
                            <motion.p
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-error text-xs font-semibold mt-1 bg-error/5 border border-error/15 py-2.5 px-4 rounded-xl w-full text-center"
                            >
                                {error}
                            </motion.p>
                        )}
                    </motion.div>

                    {/* Policies Agreement Info */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35, duration: 0.4 }}
                        className="mt-10 text-[11px] font-medium text-on-surface-variant/40 leading-relaxed pt-6 border-t border-outline"
                    >
                        By signing in, you accept the{' '}
                        <a href="/terms" className="text-on-surface-variant/60 hover:text-on-surface transition-colors underline underline-offset-4 font-semibold">Terms of Service</a>
                        {' '}&{' '}
                        <a href="/privacy" className="text-on-surface-variant/60 hover:text-on-surface transition-colors underline underline-offset-4 font-semibold">Privacy Policy</a>
                    </motion.p>
                </motion.div>
            </main>

            {/* Stark minimal Footer */}
            <footer className="w-full max-w-7xl px-6 text-center z-10">
                <p className="text-[10px] text-on-surface-variant/30 font-medium tracking-wide">
                    &copy; {new Date().getFullYear()} Zenith. All rights reserved.
                </p>
            </footer>
        </div>
    );
};

export default Login;
