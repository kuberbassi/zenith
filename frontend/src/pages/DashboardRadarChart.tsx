import React from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';
import type { Subject } from '@/types';

interface Props {
    subjects: Subject[];
}

const DashboardRadarChart: React.FC<Props> = ({ subjects }) => {
    if (!subjects || subjects.length === 0) {
        return (
            <div className="flex items-center justify-center h-full w-full text-white/25 text-sm">
                No data yet
            </div>
        );
    }

    const data = subjects.map(sub => ({
        subject: sub.code || (sub.name ? sub.name.substring(0, 6) : '???'),
        attendance: sub.attendance_percentage || sub.attendance?.percentage || 0,
        fullMark: 100,
    }));

    const fontSize = subjects.length > 10 ? 9 : subjects.length > 7 ? 10 : 11;
    const outerRadius = subjects.length > 10 ? '60%' : '68%';

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={data}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: 'rgba(255,255,255,0.35)', fontSize, fontWeight: 500 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                    name="Attendance"
                    dataKey="attendance"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.12}
                    strokeWidth={2}
                    isAnimationActive
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#111',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        padding: '8px 14px',
                    }}
                    itemStyle={{ color: '#ededed', fontWeight: 600 }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Attendance']}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
};

export default DashboardRadarChart;
