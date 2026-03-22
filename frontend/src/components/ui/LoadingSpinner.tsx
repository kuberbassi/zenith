import React from 'react';
import Loader from './Loader';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    fullScreen?: boolean;
    variant?: 'spinner' | 'skeleton';
    skeletonClassName?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    fullScreen = false,
    variant = 'spinner',
    skeletonClassName = 'h-24 w-full',
}) => {

    // Skeleton variant
    if (variant === 'skeleton') {
        return (
            <div className={`animate-pulse bg-surface-container-high rounded-xl ${skeletonClassName}`} />
        );
    }

    // Spinner variant
    const loaderSizes = {
        sm: 20,
        md: 32,
        lg: 48,
    };

    const spinner = (
        <Loader size={loaderSizes[size]} />
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
                <div className="flex flex-col items-center gap-4">
                    {spinner}
                    <p className="text-on-surface-variant text-sm font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    return <div className="flex items-center justify-center p-4">{spinner}</div>;
};

export default LoadingSpinner;
