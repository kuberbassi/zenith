/**
 * LazyCharts — Chart.js wrappers (recharts removed)
 */
import React, { Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

const ChartSkeleton: React.FC<{ height?: number | string }> = ({ height = 300 }) => (
    <div
        className="animate-pulse bg-surface-container-high/50 rounded-xl flex items-center justify-center"
        style={{ height }}
    >
        <LoadingSpinner size="md" />
    </div>
);

export const LazyBarChartWrapper: React.FC<any> = ({ height = 300, data, options, ...rest }) => (
    <Suspense fallback={<ChartSkeleton height={height} />}>
        <div style={{ height }}>
            <Bar data={data} options={{ responsive: true, maintainAspectRatio: false, ...options }} {...rest} />
        </div>
    </Suspense>
);

export const LazyLineChartWrapper: React.FC<any> = ({ height = 300, data, options, ...rest }) => (
    <Suspense fallback={<ChartSkeleton height={height} />}>
        <div style={{ height }}>
            <Line data={data} options={{ responsive: true, maintainAspectRatio: false, ...options }} {...rest} />
        </div>
    </Suspense>
);

export const LazyPieChartWrapper: React.FC<any> = ({ height = 300, data, options, ...rest }) => (
    <Suspense fallback={<ChartSkeleton height={height} />}>
        <div style={{ height }}>
            <Doughnut data={data} options={{ responsive: true, maintainAspectRatio: false, ...options }} {...rest} />
        </div>
    </Suspense>
);
