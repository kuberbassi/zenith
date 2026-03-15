import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
                {/* Unified Header (all screen sizes) */}
                <Header notificationCount={notificationCount} />

                {/* Content Container */}
                <div className="flex-1 px-4 pb-[calc(9rem+env(safe-area-inset-bottom,0px))] pt-16 md:px-6 md:pb-32 md:pt-16 lg:px-8 lg:pt-20 max-w-7xl mx-auto w-full animate-fade-in">
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
