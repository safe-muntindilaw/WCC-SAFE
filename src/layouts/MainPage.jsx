// MainPage.jsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/globals";

const MainPage = () => {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div>
            <Header />
            <Outlet />
        </div>
    );
};

export default MainPage;
