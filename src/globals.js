// globals.js - UPDATED
export { default as Header } from "@/components/Header";
export { default as DashboardPage } from "@/components/DashboardPage";
export { default as UserManagement } from "@/components/UserManagement";
export { default as ReportPage } from "@/components/ReportPage";
export { default as ProfilePage } from "@/components/ProfilePage";
export { default as LoginPage } from "@/components/LoginPage";
export { default as RegisterPage } from "@/components/RegisterPage";
export { default as ForgotPasswordPage } from "@/components/ForgotPasswordPage";

export { default as AuthProvider } from "@/context/AuthContext";
export { default as AppRoutes } from "@/routes/AppRoutes";
export { default as PublicRoute } from "@/routes/PublicRoute";
export { default as ProtectedRoute } from "@/routes/ProtectedRoute";
export { default as MainPage } from "@/layouts/MainPage";
export { default as LandingPage } from "@/layouts/LandingPage";
export { default as supabase } from "@/services/supabaseClient";

// NEW: Export utilities
export { THEME, cardStyle, primaryButtonStyle } from "@/utils/theme";
export {
    validateUserForm,
    validateEmail,
    validatePassword,
    formatPhoneNumber,
    detectSuspiciousPattern,
    capitalizeWords,
} from "@/utils/validation";
export {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showValidationErrors,
    showBatchOperationResult,
} from "@/utils/notifications";
export { useConfirmDialog } from "@/utils/confirmDialog";
export {
    useResponsive,
    useResponsiveStyles,
    useResponsiveTableScroll,
} from "@/utils/useResponsive";
