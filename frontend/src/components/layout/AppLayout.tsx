import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import Dock from './Dock';
import Header from './Header';
import AmbientBackground from '../ui/AmbientBackground';
import AIChat from './AIChat';
import { attendanceService } from '@/services/attendance.service';

const AppLayout: React.FC = () => {
    const [notificationCount, setNotificationCount] = useState(0);
    const location = useLocation();

    // Fetch unread notification count
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const notifications = await attendanceService.getNotifications();
                const unread = notifications.filter((n: any) => !n.read).length;
                setNotificationCount(unread);
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            }
        };
        fetchNotifications();
    }, [location.pathname]); // Refresh on route change

    return (
        <div className="min-h-screen bg-background font-sans text-on-background flex flex-col relative overflow-x-hidden">
            {/* 3D Premium Background */}
            <AmbientBackground />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen relative">
                {/* Desktop Header */}
                <Header notificationCount={notificationCount} />

                {/* Optimized Mobile Nav Bar */}
                <div className="lg:hidden sticky top-0 z-50 bg-[#050508]/80 backdrop-blur-2xl border-b border-white/[0.05] px-4 py-3 flex justify-between items-center shadow-2xl">
                    <Link to="/" className="flex items-center gap-3 active:scale-95 transition-transform">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center p-1.5 overflow-hidden">
                            <img src="/icon-trans.png" alt="AcadHub" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black text-sm tracking-tight text-white uppercase leading-none">AcadHub</span>
                            <span className="text-[10px] font-bold text-blue-400/80 tracking-widest uppercase mt-0.5">Strategic Flight</span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-1">
                        <Link
                            to="/notifications"
                            className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-white/40"
                        >
                            <Bell size={20} />
                            {notificationCount > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            )}
                        </Link>
                        <Link
                            to="/settings"
                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-white/40"
                        >
                            <Settings size={20} />
                        </Link>
                    </div>
                </div>

                {/* Content Container - Ensure bottom padding accounts for the Dock */}
                <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in pb-32">
                    <Outlet />
                </div>
            </main>

            {/* Magnetic Fluid Bottom Navigation Dock */}
            <Dock />

            {/* Neural AI Assistant */}
            <AIChat />
        </div>
    );
};

export default AppLayout;
