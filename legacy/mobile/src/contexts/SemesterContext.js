import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import offlineStorage from '../lib/offlineStorage';

const SemesterContext = createContext();

export const SemesterProvider = ({ children }) => {
    const { user } = useAuth();
    const [selectedSemester, setSelectedSemester] = useState(1);
    const [loading, setLoading] = useState(true);

    // Initial load from local storage
    useEffect(() => {
        const loadLocal = async () => {
            const saved = await offlineStorage.getData('selected_semester');
            if (saved) setSelectedSemester(Number(saved));
        };
        loadLocal();
    }, []);

    // Fetch from backend to sync
    useEffect(() => {
        if (user) {
            fetchSemesterPreference();
        }
    }, [user]);

    const fetchSemesterPreference = async () => {
        try {
            const res = await api.get('/api/profile/preferences');
            if (res.data && res.data.selected_semester) {
                const serverSem = Number(res.data.selected_semester);
                setSelectedSemester(serverSem);
                offlineStorage.saveData('selected_semester', serverSem);
            } else if (user?.semester) {
                // Fallback to user's profile semester
                setSelectedSemester(Number(user.semester));
            }
        } catch (e) {
            console.log("Error fetching semester preference", e);
        } finally {
            setLoading(false);
        }
    };

    const updateSemester = async (sem) => {
        const semesterNum = Number(sem);
        setSelectedSemester(semesterNum);
        offlineStorage.saveData('selected_semester', semesterNum);
        try {
            // Save to backend
            await api.post('/api/profile/preferences', {
                selected_semester: semesterNum
            });
        } catch (e) {
            console.log("Error saving semester preference", e);
        }
    };

    return (
        <SemesterContext.Provider value={{ selectedSemester, updateSemester, loading }}>
            {children}
        </SemesterContext.Provider>
    );
};

export const useSemester = () => useContext(SemesterContext);
