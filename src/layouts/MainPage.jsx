// MainPage.jsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/globals";
import "@/styles/main.css";

const MainPage = () => {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="protected-container">
            <Header />
            <Outlet />
        </div>
    );
};

export default MainPage;
