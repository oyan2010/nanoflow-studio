import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
                    <div className="bg-destructive/10 p-4 rounded-full mb-6">
                        <AlertCircle className="w-12 h-12 text-destructive" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
                    <p className="text-muted-foreground max-w-md mb-8">
                        An unexpected error occurred. Please try reloading the page.
                    </p>

                    <div className="bg-muted/50 p-4 rounded-lg text-left max-w-lg w-full overflow-auto mb-8 text-xs font-mono border border-border">
                        <p className="text-red-500 font-semibold">{this.state.error?.toString()}</p>
                        {this.state.errorInfo && (
                            <pre className="mt-2 opacity-70">{this.state.errorInfo.componentStack}</pre>
                        )}
                    </div>

                    <Button
                        onClick={() => window.location.href = '/'}
                        className="gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reload Application
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
