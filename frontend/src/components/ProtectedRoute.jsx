import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

const ProtectedRoute = ({ children, roles }) => {
    const { user, loading } = useAuth();
    if (loading)
        return (
            <div className="min-h-screen grid place-items-center">
                <Loader2
                    className="animate-spin text-slate-400"
                    size={22}
                    strokeWidth={1.6}
                />
            </div>
        );
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role))
        return <Navigate to="/dashboard" replace />;
    return children;
};

export default ProtectedRoute;
