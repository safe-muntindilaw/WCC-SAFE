// ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
const ProtectedRoute = ({ allowedRoles, children }) => {
    const { user } = useAuth();
    const location = useLocation();
    const isRecovery =
        location.hash.includes("type=recovery") ||
        window.location.hash.includes("type=recovery");
    if (isRecovery) {
        return children;
    }
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    const userRole = user?.user_metadata?.role;
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        return <Navigate to="/unauthorized" replace />;
    }
    return children;
};
export default ProtectedRoute;
