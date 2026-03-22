import React, { useState, Suspense } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Sphere, MeshDistortMaterial } from '@react-three/drei';

const ThreeBackground = () => {
    return (
        <div className="absolute inset-0 z-0 bg-[#020205]">
            <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} color="#3b82f6" />
                <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#8b5cf6" />

                <Suspense fallback={null}>
                    <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                    <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
                        <Sphere args={[1, 64, 64]} scale={1.2}>
                            <MeshDistortMaterial
                                color="#0a192f"
                                attach="material"
                                distort={0.4}
                                speed={1.5}
                                roughness={0.2}
                                metalness={0.8}
                            />
                        </Sphere>
                    </Float>
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={0.5} enableZoom={false} enablePan={false} />
            </Canvas>
        </div>
    );
};

const Login: React.FC = () => {
    const { loginWithGoogle } = useAuth();
    const [error, setError] = useState<string | null>(null);

    usePageMeta({
        title: 'AcadHub | Student Center',
        description: 'Sign in to AcadHub — your all-in-one student dashboard for IPU. Track attendance, sync results, manage timetables, and develop your skills.',
        indexable: true,
    });

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-black">
            <ThreeBackground />

            {/* Overlay Gradient */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-transparent to-black/50 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                className="z-20 w-full max-w-md px-4"
            >
                <div className="relative text-center p-10 md:p-12 rounded-[2.5rem] bg-[#0a0a0a]/60 backdrop-blur-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
                    style={{ boxShadow: '0 0 80px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.1)' }}>

                    {/* Glowing Accent */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm" />

                    {/* Icon */}
                    <div className="mb-8 flex justify-center relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
                        <div className="w-20 h-20 rounded-3xl bg-[#050508] border border-white/10 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
                            <img src="/icon-trans.png" alt="AcadHub" className="w-[70%] h-[70%] object-contain transition-transform duration-700 hover:scale-110" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase font-display">
                        AcadHub
                    </h1>
                    <p className="text-white/40 text-sm font-bold tracking-widest uppercase mb-10 leading-relaxed">
                        Institutional Nexus <br />
                        <span className="text-blue-400">Authentication Required</span>
                    </p>

                    <div className="flex flex-col items-center gap-4 relative z-20">
                        <div className="hover:scale-105 transition-transform duration-300">
                            <GoogleLogin
                                onSuccess={async (credentialResponse) => {
                                    setError(null);
                                    try {
                                        if (!credentialResponse.credential) throw new Error('No credential received');
                                        await loginWithGoogle(credentialResponse.credential);
                                    } catch (err) {
                                        console.error('❌ Backend login failed:', err);
                                        setError('Login sequence failed. Please recalibrate.');
                                    }
                                }}
                                onError={() => {
                                    console.error('❌ Google Login Failed');
                                    setError('Auth provider failed. Please try again.');
                                }}
                                theme="filled_black"
                                size="large"
                                width={280}
                                text="continue_with"
                                shape="pill"
                            />
                        </div>
                        {error && (
                            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-xs font-bold uppercase tracking-widest mt-2 bg-red-500/10 py-2 px-4 rounded-xl border border-red-500/20">
                                {error}
                            </motion.p>
                        )}
                    </div>

                    <p className="mt-12 text-[10px] font-black tracking-widest uppercase text-white/20">
                        By authenticating, you accept the <br />
                        <a href="/terms" className="text-blue-500/60 hover:text-blue-400 transition-colors">Terms of Protocol</a> &{' '}
                        <a href="/privacy" className="text-blue-500/60 hover:text-blue-400 transition-colors">Privacy Matrix</a>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
