import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        // Log to error reporting service in production
        if (import.meta.env.PROD) {
            // Could integrate with Sentry, LogRocket, etc.
            console.error('Error caught by boundary:', error, errorInfo);
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background text-on-background selection:bg-primary-container selection:text-primary">
                    <div className="max-w-md w-full text-center space-y-6 p-8 bg-surface border-2 border-primary rounded-xl shadow-[4px_4px_0px_0px_var(--md-sys-color-primary)] transition-all select-none">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg border-2 border-dashed border-error text-error bg-error/5 animate-pulse">
                            <AlertTriangle className="w-7 h-7" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-on-surface">
                                Something went wrong
                            </h2>
                            <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto">
                                An unexpected error occurred. You can try reloading the page or going back to the home page.
                            </p>
                        </div>

                        {import.meta.env.DEV && this.state.error && (
                            <details className="p-4 bg-surface-variant border-2 border-dashed border-outline rounded-lg text-left text-xs font-mono select-text">
                                <summary className="cursor-pointer text-error font-semibold hover:underline focus:outline-none flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                                    <span>Error Details</span>
                                </summary>
                                <pre className="mt-3 overflow-auto text-[11px] text-on-surface-variant max-h-40 whitespace-pre-wrap break-all scrollbar-thin">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                            <button
                                onClick={this.handleGoHome}
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg border-2 border-primary bg-surface text-primary font-medium text-sm hover:bg-surface-variant transition-all shadow-[2px_2px_0px_0px_var(--md-sys-color-primary)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_var(--md-sys-color-primary)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_var(--md-sys-color-primary)]"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </button>
                            <button
                                onClick={this.handleRetry}
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-primary text-on-primary border-2 border-primary font-medium text-sm hover:opacity-95 transition-all shadow-[2px_2px_0px_0px_var(--md-sys-color-outline)] active:translate-y-[1px] active:translate-x-[1px] active:shadow-[1px_1px_0px_0px_var(--md-sys-color-outline)] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0px_0px_var(--md-sys-color-outline)]"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
