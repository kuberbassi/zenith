import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Log { date: string; subject: string; status: string; }
interface Props { logs: Log[]; }

const AttendanceTrendChart: React.FC<Props> = ({ logs }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="flex items-center justify-center h-full w-full text-white/25 text-sm pb-10">
                No trend data yet
            </div>
        );
    }

    const aggregated = logs.reduce((acc, log) => {
        if (!acc[log.date]) acc[log.date] = { present: 0, absent: 0 };
        if (log.status === 'present') acc[log.date].present += 1;
        if (log.status === 'absent') acc[log.date].absent += 1;
        return acc;
    }, {} as Record<string, { present: number; absent: number }>);

    const data = Object.keys(aggregated).sort().slice(-10).map(date => {
        const d = aggregated[date];
        const total = d.present + d.absent;
        return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            engagement: total > 0 ? Math.round((d.present / total) * 100) : 0,
        };
    });

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#111',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        padding: '8px 14px',
                    }}
                    itemStyle={{ color: '#ededed', fontWeight: 600 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.3)' }}
                />
                <Area
                    type="monotone"
                    dataKey="engagement"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#trendGrad)"
                    isAnimationActive
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default AttendanceTrendChart;
