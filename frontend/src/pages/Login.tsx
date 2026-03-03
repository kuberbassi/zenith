import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';

const Login: React.FC = () => {
    const { loginWithGoogle } = useAuth();
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-surface-container p-4 relative overflow-hidden">
            {/* M3 Dynamic Background Shapes */}
            <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-container rounded-full blur-[100px] opacity-60 animate-pulse-slow" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary-container rounded-full blur-[80px] opacity-60 animate-pulse-slow" style={{ animationDelay: '2s' }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="z-10 w-full max-w-md"
            >
                <Card variant="elevated" className="text-center p-8 m3-card !rounded-3xl shadow-elevation-3 bg-surface/90 backdrop-blur-sm dark:bg-dark-surface-container dark:text-dark-surface-on">
                    {/* Icon */}
                    <div className="mb-6 flex justify-center">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center">
                            <img src="/icon-trans.png" alt="AcadHub" className="w-full h-full object-contain scale-[2.2]" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-display font-medium text-on-surface dark:text-dark-surface-on mb-2 tracking-tight">
                        AcadHub
                    </h1>
                    <p className="text-on-surface-variant text-lg">
                        Your ultimate student companion for attendance, timetables, and more.
                    </p>
                    <p className="text-on-surface-variant dark:text-dark-surface-variant mb-8 text-base">
                        Sign in to AcadHub to continue
                    </p>

                    <div className="flex flex-col items-center gap-3">
                        <GoogleLogin
                            onSuccess={async (credentialResponse) => {
                                setError(null);
                                try {
                                    if (!credentialResponse.credential) throw new Error('No credential received');
                                    await loginWithGoogle(credentialResponse.credential);
                                } catch (err) {
                                    console.error('❌ Backend login failed:', err);
                                    setError('Login failed. Please try again.');
                                }
                            }}
                            onError={() => {
                                console.error('❌ Google Login Failed');
                                setError('Google sign-in failed. Please try again.');
                            }}
                            theme="filled_black"
                            size="large"
                            width={320}
                            text="signin_with"
                            shape="pill"
                        />
                        {error && (
                            <p className="text-error text-sm">{error}</p>
                        )}

                    </div>

                    <p className="mt-8 text-xs text-on-surface-variant dark:text-dark-surface-variant opacity-70">
                        By continuing, you agree to our{' '}
                        <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                    </p>
                </Card>
            </motion.div>
        </div>
    );
};

export default Login;
