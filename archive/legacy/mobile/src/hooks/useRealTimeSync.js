import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../services/api';

const useRealTimeSync = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        if (!user?.email) return;

        console.log('🔌 Connecting to real-time sync server...');
        const socket = io(API_URL, {
            autoConnect: true,
        });

        socket.on('connect', () => {
            console.log('✅ Real-time sync connected');
            // Join a private room for the user
            socket.emit('join', { room: user.email });
        });

        socket.on('attendance_updated', (data) => {
            console.log('📅 Attendance updated event received:', data);
            // Invalidate attendance related queries
            queryClient.invalidateQueries({ queryKey: ['timetable'] });
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
        });

        socket.on('timetable_updated', (data) => {
            console.log('🕒 Timetable updated event received:', data);
            queryClient.invalidateQueries({ queryKey: ['timetable'] });
        });

        socket.on('disconnect', () => {
            console.log('❌ Real-time sync disconnected');
        });

        return () => {
            socket.disconnect();
        };
    }, [user?.email, queryClient]);
};

export default useRealTimeSync;
