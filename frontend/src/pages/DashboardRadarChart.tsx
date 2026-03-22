import React from 'react';
import {
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    PointElement,
    RadialLinearScale,
    Tooltip,
    type ChartOptions,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import type { Subject } from '@/types';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

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

    const labels = subjects.map(sub => sub.code || (sub.name ? sub.name.substring(0, 6) : '???'));
    const values = subjects.map(sub => sub.attendance_percentage || sub.attendance?.percentage || 0);

    const data = {
        labels,
        datasets: [
            {
                label: 'Attendance',
                data: values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.12)',
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointBorderWidth: 0,
            },
        ],
    };

    const fontSize = subjects.length > 10 ? 9 : subjects.length > 7 ? 10 : 11;
    const options: ChartOptions<'radar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx) => `Attendance: ${Number(ctx.raw).toFixed(1)}%`,
                },
            },
        },
        scales: {
            r: {
                min: 0,
                max: 100,
                ticks: { display: false },
                grid: { color: 'rgba(255,255,255,0.05)' },
                angleLines: { color: 'rgba(255,255,255,0.05)' },
                pointLabels: {
                    color: 'rgba(255,255,255,0.35)',
                    font: { size: fontSize, weight: 500 },
                },
            },
        },
    };

    return <Radar data={data} options={options} />;
};

export default DashboardRadarChart;
