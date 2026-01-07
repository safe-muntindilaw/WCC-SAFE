// AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { PublicRoute, ProtectedRoute } from "@/globals";
import { LandingPage, MainPage } from "@/globals";
import {
    DashboardPage,
    UserManagement,
    ReportPage,
    ProfilePage,
} from "@/globals";
import { LoginPage, RegisterPage, ForgotPasswordPage } from "@/globals";

const AppRoutes = () => (
    <Routes>
        {/* Public layout */}
        <Route
            element={
                <PublicRoute>
                    <LandingPage />
                </PublicRoute>
            }
        >
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected layout */}
        <Route
            element={
                <ProtectedRoute
                    allowedRoles={["Admin", "Official", "Resident"]}
                >
                    <MainPage />
                </ProtectedRoute>
            }
        >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/reports" element={<ReportPage />} />
            <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* 404 fallback */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
    </Routes>
);

export default AppRoutes;
