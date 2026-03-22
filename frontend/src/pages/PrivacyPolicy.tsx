import React from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Eye, Database, Lock, Globe, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
    {
        icon: Eye,
        title: 'Introduction',
        content: 'Welcome to AcadHub ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience while using our application.'
    },
    {
        icon: Database,
        title: 'Information We Collect',
        content: 'We collect only the information necessary to provide our services:',
        list: [
            { label: 'Google Account Information', desc: 'When you sign in with Google, we collect your email address, name, and profile picture.' },
            { label: 'Profile Metadata', desc: 'We collect user-provided details like headline, college, and branch to enhance your profile.' },
        ]
    },
    {
        icon: Shield,
        title: 'How We Use Your Information',
        content: 'We use your information solely to:',
        list: [
            { label: 'Dashboard', desc: 'Provide and personalize the AcadHub dashboard and attendance tracking.' },
            { label: 'Profile Optimization', desc: 'Display your academic status and social connections on your profile.' },
        ],
        note: 'We do not sell your personal data to third parties.'
    },
    {
        icon: Lock,
        title: 'Data Security',
        content: 'We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.'
    },
    {
        icon: Globe,
        title: 'Google User Data',
        content: 'AcadHub\'s use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.',
        link: { text: 'Google API Services User Data Policy', url: 'https://developers.google.com/terms/api-services-user-data-policy' }
    },
    {
        icon: Mail,
        title: 'Contact Us',
        content: 'If you have any questions about this Privacy Policy, please contact us at kuberbassi2007@gmail.com.'
    },
];

const PrivacyPolicy: React.FC = () => {
    const navigate = useNavigate();

    usePageMeta({
        title: 'Privacy Policy | AcadHub',
        description: 'Read the AcadHub privacy policy to understand how we collect, use, and protect your data.',
        indexable: true,
    });

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-2xl border-b border-white/[0.04]">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white/80">Privacy Policy</h1>
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Last updated: March 5, 2026 • v3.5.0</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
                {sections.map((section, i) => (
                    <motion.div
                        key={section.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 hover:border-white/[0.1] transition-all"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                <section.icon size={16} className="text-white" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">{i + 1}. {section.title}</h2>
                        </div>

                        <p className="text-sm text-white/40 leading-relaxed">{section.content}</p>

                        {section.list && (
                            <div className="mt-4 space-y-2">
                                {section.list.map((item) => (
                                    <div key={item.label} className="flex gap-3 items-start rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-white/25 mt-1.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-xs font-bold text-white/60">{item.label}</span>
                                            <span className="text-xs text-white/30 ml-1">— {item.desc}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {section.note && (
                            <div className="mt-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-4 py-3">
                                <p className="text-xs font-bold text-white/80">{section.note}</p>
                            </div>
                        )}

                        {section.link && (
                            <a href={section.link.url} target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs font-bold text-white hover:text-white transition-colors underline underline-offset-2">
                                {section.link.text} →
                            </a>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default PrivacyPolicy;
