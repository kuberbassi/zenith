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

                {/* Mobile Header — floating capsule pill */}
                <div className="lg:hidden fixed top-4 left-1/2 -translate-x-1/2 z-50">
                    <div
                        className="flex items-center h-12 px-2.5 rounded-full bg-[#111]/90 backdrop-blur-2xl border border-white/[0.09]"
                        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}
                    >
                        <Link to="/" className="flex items-center gap-2.5 px-2 active:opacity-70 transition-opacity select-none">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/25 to-blue-600/10 border border-blue-500/20 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                                <img src="/icon-trans.png" alt="AcadHub" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="font-black text-[11px] tracking-tight text-white uppercase leading-none">AcadHub</span>
                                <span className="text-[8px] font-bold text-blue-400/70 tracking-widest uppercase mt-[3px]">Strategic Flight</span>
                            </div>
                        </Link>
                        <div className="w-px h-6 bg-white/[0.08] mx-1.5" />
                        <div className="flex items-center">
                            <Link
                                to="/notifications"
                                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] active:bg-white/10 transition-colors text-white/40"
                            >
                                <Bell size={15} />
                                {notificationCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                )}
                            </Link>
                            <Link
                                to="/settings"
                                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/[0.06] active:bg-white/10 transition-colors text-white/40"
                            >
                                <Settings size={15} />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Content Container - Ensure bottom padding accounts for the Dock */}
                <div className="flex-1 px-4 pb-32 pt-20 md:px-6 md:pb-32 md:pt-20 lg:p-8 lg:pb-32 max-w-7xl mx-auto w-full animate-fade-in">
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
