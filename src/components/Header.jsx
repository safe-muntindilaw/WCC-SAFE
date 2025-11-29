// Header.jsx
import { Layout, Menu, Button } from "antd";
import {
    DashboardOutlined,
    TeamOutlined,
    FileTextOutlined,
    UserOutlined,
    LogoutOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useCallback } from "react";
import Logo from "@/assets/logo.png";
import "../styles/Header.css";

// Destructure AntD components
const { Header } = Layout;

const AppHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userRole, logout } = useAuth();

    // Check if user can view Users tab
    const canViewUsers = useMemo(
        () => ["Admin", "Official"].includes(userRole),
        [userRole]
    );

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            await logout();
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Logout failed:", err.message);
        }
    }, [logout, navigate]);

    // Define menu items
    const menuItems = [
        {
            key: "/dashboard",
            icon: <DashboardOutlined />,
            label: <Link to="/dashboard">Dashboard</Link>,
        },
        ...(canViewUsers
            ? [
                  {
                      key: "/users",
                      icon: <TeamOutlined />,
                      label: <Link to="/users">Users</Link>,
                  },
              ]
            : []),
        {
            key: "/reports",
            icon: <FileTextOutlined />,
            label: <Link to="/reports">Reports</Link>,
        },
        {
            key: "/profile",
            icon: <UserOutlined />,
            label: <Link to="/profile">Profile ({userRole})</Link>,
        },
    ];

    return (
        <>
            {/* Header */}
            <Header 
                className="nav-header"
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    width: '100%'
                }}
            >
                {/* Logo */}
                <Link to="/dashboard">
                    <div className="nav-logo">
                        <img src={Logo} alt="Logo" className="nav-logo" />
                    </div>
                </Link>

                {/* Desktop Menu */}
                <div className="nav-desktop-menu">
                    <Menu
                        mode="horizontal"
                        selectedKeys={[location.pathname]}
                        className="nav-menu"
                        items={menuItems}
                    />
                </div>

                {/* Logout */}
                <div className="nav-logout">
                    <Button
                        type="link"
                        icon={<LogoutOutlined />}
                        onClick={handleLogout}
                    >
                        Logout
                    </Button>
                </div>
            </Header>

            {/* Mobile Bottom Navigation */}
            <div className="nav-mobile-bottom">
                {menuItems.map((item) => (
                    <Link
                        key={item.key}
                        to={item.key}
                        className={`bottom-nav-item ${
                            location.pathname === item.key ? "active" : ""
                        }`}
                    >
                        {item.icon}
                    </Link>
                ))}
            </div>
        </>
    );
};

export default AppHeader;