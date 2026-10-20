import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { session, isLoading } = useAuth();
    const location = useLocation();

    console.log("ProtectedRoute check:", { path: location.pathname, isLoading, hasSession: !!session });

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        console.log("ProtectedRoute: No session, redirecting to auth");
        // Redirect to login page but save the location they were trying to access
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
