import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import AIChat from './AIChat';

const AppLayout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="min-h-screen bg-background font-sans text-on-background flex relative overflow-x-hidden">
            {/* Sidebar (Left-side docked navigation on desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 min-w-0 flex flex-col min-h-screen lg:pl-64">
                {/* Content Container - No header, starts from top, padded for sidebar */}
                <main key={location.pathname} className="flex-1 w-full max-w-[1400px] mx-auto px-4 pt-10 pb-28 md:px-8 md:pt-12 md:pb-12 animate-fade-in relative z-10">
                    <Outlet />
                </main>
            </div>

            {/* Bottom Nav for Mobile */}
            <BottomNav />

            {/* Neural AI Assistant */}
            <AIChat />
        </div>
    );
};

export default AppLayout;
