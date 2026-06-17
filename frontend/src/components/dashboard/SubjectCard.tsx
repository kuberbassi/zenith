import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

interface SubjectCardProps {
    subject: {
        subject: string;
        percentage: number;
        present: number;
        total_lectures: number;
        code?: string;
    };
    onClick: () => void;
}

const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick }) => {
    const isLow = subject.percentage < 75;

    return (
        <motion.div
            layoutId={subject.subject}
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-surface p-4 rounded-xl border border-outline-variant/20 shadow-sm cursor-pointer group hover:border-primary/50 transition-colors"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
                    <BookOpen className="w-5 h-5" />
                </div>
                <div className={`px-2 py-1 rounded-lg text-sm font-bold ${isLow ? 'bg-error/10 text-error' : 'bg-green-500/10 text-white'
                    }`}>
                    {subject.percentage}%
                </div>
            </div>

            <h4 className="font-bold text-xl text-on-surface line-clamp-1 mb-2">{subject.subject}</h4>
            <div className="flex justify-between text-base font-medium text-on-surface-variant">
                <span>{subject.present}/{subject.total_lectures} Present</span>
                <span>{subject.code || ''}</span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-1 w-full bg-on-surface/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${isLow ? 'bg-error' : 'bg-on-surface'}`}
                    style={{ width: `${Math.min(subject.percentage, 100)}%` }}
                />
            </div>
        </motion.div>
    );
};

export default SubjectCard;
