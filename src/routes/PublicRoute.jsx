// PublicRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const PublicRoute = ({ children }) => {
    const { user } = useAuth();
    const isRecovery = window.location.hash.includes("type=recovery");

    // If user is logged in and not in recovery mode, redirect to dashboard
    if (user && !isRecovery) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default PublicRoute;
