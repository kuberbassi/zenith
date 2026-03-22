import React from 'react';
import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
    type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

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

    const points = Object.keys(aggregated).sort().slice(-10).map(date => {
        const d = aggregated[date];
        const total = d.present + d.absent;
        return {
            label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            engagement: total > 0 ? Math.round((d.present / total) * 100) : 0,
        };
    });

    const data = {
        labels: points.map((point) => point.label),
        datasets: [
            {
                data: points.map((point) => point.engagement),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 0,
                pointHoverRadius: 4,
            },
        ],
    };

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#111',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                cornerRadius: 12,
                displayColors: false,
                callbacks: {
                    label: (ctx) => `Engagement: ${Number(ctx.raw).toFixed(0)}%`,
                },
            },
        },
        scales: {
            x: { display: false },
            y: { display: false, min: 0, max: 100 },
        },
    };

    return <Line data={data} options={options} />;
};

export default AttendanceTrendChart;
