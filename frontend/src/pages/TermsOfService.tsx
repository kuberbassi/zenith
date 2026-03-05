import React from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, AlertTriangle, UserCheck, XCircle, RefreshCw, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
    {
        icon: FileText,
        title: 'Acceptance of Terms',
        content: 'By accessing and using AcadHub, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use this application.'
    },
    {
        icon: UserCheck,
        title: 'Description of Service',
        content: 'AcadHub provides an academic management dashboard that integrates with your Google account to track attendance, assignments, and tasks. You understand and agree that the Service is provided "AS-IS" and we make no warranties regarding its availability, accuracy, or reliability.'
    },
    {
        icon: AlertTriangle,
        title: 'User Conduct',
        content: 'You agree to use the Service only for lawful purposes. You are responsible for all activities that occur under your account.',
        list: [
            'Do not attempt to gain unauthorized access to our systems.',
            'Do not use the service to distribute malicious software.',
            'Do not harass, abuse, or harm other users.',
            'Do not use automated scripts to access the service.',
        ]
    },
    {
        icon: XCircle,
        title: 'Termination',
        content: 'We reserve the right to terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.'
    },
    {
        icon: RefreshCw,
        title: 'Changes to Terms',
        content: 'We reserve the right, at our sole discretion, to modify or replace these Terms at any time. Continued use of the Service after changes constitutes acceptance of the modified terms.'
    },
    {
        icon: Mail,
        title: 'Contact Us',
        content: 'If you have any questions about these Terms, please contact us at kuberbassi2007@gmail.com.'
    },
];

const TermsOfService: React.FC = () => {
    const navigate = useNavigate();

    usePageMeta({
        title: 'Terms of Service | AcadHub',
        description: 'Read the AcadHub terms of service. Understand your rights and responsibilities as a user.',
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
                        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-white/80">Terms of Service</h1>
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Last updated: February 4, 2026 • v3.0.0</p>
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
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <section.icon size={16} className="text-blue-400" />
                            </div>
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80">{i + 1}. {section.title}</h2>
                        </div>

                        <p className="text-sm text-white/40 leading-relaxed">{section.content}</p>

                        {section.list && (
                            <div className="mt-4 space-y-2">
                                {section.list.map((item) => (
                                    <div key={item} className="flex gap-3 items-start rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50 mt-1.5 flex-shrink-0" />
                                        <span className="text-xs text-white/40">{item}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}

                {/* Disclaimer */}
                <div className="rounded-2xl bg-amber-500/5 border border-amber-500/10 p-6 text-center">
                    <p className="text-xs font-bold text-amber-400/60 uppercase tracking-widest">
                        By using AcadHub, you acknowledge that you have read, understood, and agree to these Terms of Service.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
