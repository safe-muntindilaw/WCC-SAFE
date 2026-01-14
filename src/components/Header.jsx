// Header.jsx
import { Layout, Menu, Dropdown, Avatar, Space, Badge, Typography } from "antd";
import {
    DashboardOutlined,
    TeamOutlined,
    FileTextOutlined,
    UserOutlined,
    LogoutOutlined,
    DownOutlined,
} from "@ant-design/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useCallback } from "react";
import Logo from "@/assets/logo.png";
import { showSuccess } from "@/utils/notifications";

import "../styles/Header.css";

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, userRole, logout, onlineUsers } = useAuth();

    // Generate initials from name or email
    const getInitials = (emailOrName) => {
        if (!emailOrName) return "U";
        const name = emailOrName.split("@")[0];
        const parts = name.split(".");
        if (parts.length >= 2) {
            return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
        }
        return name[0].toUpperCase();
    };

    // Role-based access
    const canViewUsers = useMemo(
        () => ["Admin", "Official"].includes(userRole),
        [userRole]
    );

    // Logout handler
    const handleLogout = useCallback(async () => {
        try {
            await logout();
            showSuccess("Logged out successfully");
            navigate("/login", { replace: true });
        } catch (err) {
            console.error("Logout failed:", err.message);
        }
    }, [logout, navigate]);

    // Menu items (desktop + mobile)
    const menuItems = useMemo(
        () => [
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
        ],
        [canViewUsers]
    );

    // Profile dropdown
    const userMenuItems = [
        {
            key: "header",
            type: "group",
            label: (
                <div className="user-dropdown-info">
                    <Text strong>{user?.email || "User"}</Text>
                    <br />
                    <Badge
                        status={onlineUsers?.[user?.id] ? "success" : "default"}
                        text={userRole || "Resident"}
                        className="role-badge"
                    />
                </div>
            ),
        },
        { type: "divider" },
        {
            key: "/profile",
            icon: <UserOutlined />,
            label: <Link to="/profile">My Profile</Link>,
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "Logout",
            danger: true,
            onClick: handleLogout,
        },
    ];

    return (
        <>
            <Header
                className="nav-header"
                style={{ position: "sticky", top: 0, zIndex: 1000 }}>
                {/* Logo */}
                <Link to="/dashboard">
                    <div className="nav-logo-container">
                        <img src={Logo} alt="Logo" className="nav-logo" />
                    </div>
                </Link>

                {/* Desktop menu */}
                <div className="nav-desktop-menu">
                    <Menu
                        mode="horizontal"
                        selectedKeys={[location.pathname]}
                        className="nav-menu"
                        items={menuItems}
                    />
                </div>

                {/* User dropdown */}
                <div className="nav-user-section">
                    <Dropdown
                        menu={{
                            className: "custom-user-dropdown",
                            items: userMenuItems,
                        }}
                        trigger={["click"]}
                        placement="bottomRight">
                        <Space className="user-dropdown-trigger">
                            <Avatar>{getInitials(user?.email)}</Avatar>
                            <span className="desktop-only">{userRole}</span>
                            <DownOutlined style={{ fontSize: "10px" }} />
                        </Space>
                    </Dropdown>
                </div>
            </Header>

            {/* Mobile bottom navigation */}
            <div className="nav-mobile-bottom">
                {menuItems.map((item) => (
                    <Link
                        key={item.key}
                        to={item.key}
                        className={`bottom-nav-item ${
                            location.pathname === item.key ? "active" : ""
                        }`}>
                        {/* Keep original icon */}
                        {item.icon}
                    </Link>
                ))}
            </div>
        </>
    );
};

export default AppHeader;
