import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authService } from '@/services/auth.service';

interface SemesterContextType {
    currentSemester: number;
    setCurrentSemester: (semester: number) => void;
}

const SemesterContext = createContext<SemesterContextType | undefined>(undefined);

export const SemesterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentSemester, setCurrentSemesterState] = useState<number>(() => {
        // Priority: user's manual selection in localStorage > user profile > default 1
        const saved = localStorage.getItem('acadhub_semester');
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
        }
        // Fallback to user profile
        const user = authService.getStoredUser();
        if (user?.semester) return user.semester;
        if (user?.current_semester) return user.current_semester;
        return 1;
    });

    // On initial load, if localStorage has no semester, seed it from user profile (one-time)
    useEffect(() => {
        const saved = localStorage.getItem('acadhub_semester');
        if (!saved) {
            const user = authService.getStoredUser();
            const sem = user?.semester || user?.current_semester;
            if (sem) {
                localStorage.setItem('acadhub_semester', sem.toString());
                setCurrentSemesterState(sem);
            }
        }
    }, []);

    const setCurrentSemester = (semester: number) => {
        setCurrentSemesterState(semester);
        localStorage.setItem('acadhub_semester', semester.toString());
    };

    return (
        <SemesterContext.Provider value={{ currentSemester, setCurrentSemester }}>
            {children}
        </SemesterContext.Provider>
    );
};

export const useSemester = (): SemesterContextType => {
    const context = useContext(SemesterContext);
    if (!context) {
        throw new Error('useSemester must be used within SemesterProvider');
    }
    return context;
};
