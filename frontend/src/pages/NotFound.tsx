import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePageMeta } from '@/hooks/usePageMeta';

const NotFound: React.FC = () => {
    const { isAuthenticated } = useAuth();

    usePageMeta({
        title: 'Page Not Found | AcadHub',
        description: 'The page you requested does not exist on AcadHub.',
        indexable: false,
    });

    return (
        <div className="min-h-screen glass-panel text-white flex items-center justify-center px-6">
            <div className="max-w-xl w-full rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-10 text-center shadow-2xl">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white">
                    <Compass size={30} />
                </div>
                <p className="text-[11px] font-black tracking-[0.35em] uppercase text-white/70 mb-3">404</p>
                <h1 className="text-4xl font-black tracking-tight mb-4">Route Not Found</h1>
                <p className="text-sm text-white/55 leading-relaxed mb-8">
                    This page does not exist, or the route is no longer valid in the current app structure.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        to={isAuthenticated ? '/' : '/login'}
                        className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-2xl bg-white/10 text-white font-black uppercase tracking-wider text-[11px]"
                    >
                        {isAuthenticated ? <Home size={16} /> : <LogIn size={16} />}
                        {isAuthenticated ? 'Go Home' : 'Go To Login'}
                    </Link>
                    <Link
                        to="/privacy"
                        className="inline-flex items-center justify-center h-12 px-6 rounded-2xl border border-white/10 text-white/75 font-black uppercase tracking-wider text-[11px]"
                    >
                        Privacy
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
