// LoginPage.jsx - Updated with consistent styling from RegisterPage
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import { Card, Typography, Input, Button, Space, Spin } from "antd";
import { FloatLabel } from "@/utils/FloatLabel";
import { UserOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";
import { THEME, cardStyleAdaptive } from "@/utils/theme";
import { showSuccess, showError } from "@/utils/notifications";
import {
    useResponsive,
    useResponsiveStyles,
    useResponsivePadding,
} from "@/utils/useResponsive";

const { Title, Text, Link } = Typography;

const LoginPage = () => {
    const navigate = useNavigate();

    // Responsive Hooks
    const { isMobile } = useResponsive();
    const responsivePadding = useResponsivePadding();
    const { fontSize, buttonSize } = useResponsiveStyles();

    // State
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    // Check session on load
    useEffect(() => {
        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) navigate("/dashboard", { replace: true });
            setChecking(false);
        })();
    }, [navigate]);

    const handleLogin = async () => {
        if (!email || !password) {
            showError("Please enter email and password");
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;

            const userId = data.user.id;
            const { error: updateError } = await supabase
                .from("contacts")
                .update({ is_logged_in: true })
                .eq("user_id", userId);

            if (updateError) {
                console.error(
                    "Failed to update login status:",
                    updateError.message,
                );
            }

            showSuccess("Login successful");
            navigate("/dashboard", { replace: true });
        } catch (err) {
            console.error("Login error:", err);
            showError(
                err.message || "Login failed. Please check your credentials",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleLogin();
        }
    };

    if (checking) {
        return (
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 255, 255)",
                    zIndex: 100,
                }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100dvh",
                backgroundColor: THEME.BACKGROUND_LIGHT,
                padding: responsivePadding,
            }}>
            <Card
                style={{
                    ...cardStyleAdaptive,
                    maxWidth: 450,
                    width: "100%",
                }}>
                <div
                    style={{
                        textAlign: "center",
                        marginBottom: THEME.SPACING_LG,
                    }}>
                    <Title
                        level={isMobile ? 3 : 2}
                        style={{
                            color: THEME.BLUE_PRIMARY,
                            margin: 0,
                        }}>
                        Welcome Back
                    </Title>
                    <Text
                        type="secondary"
                        style={{ fontSize: fontSize.subtitle }}>
                        Smart Alerts for Flood Emergencies
                    </Text>
                </div>

                <Space
                    direction="vertical"
                    size="middle"
                    style={{ width: "100%" }}>
                    <FloatLabel label="Email Address" value={email}>
                        <Input
                            type="email"
                            prefix={<UserOutlined />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={loading}
                        />
                    </FloatLabel>

                    <FloatLabel label="Password" value={password}>
                        <Input.Password
                            prefix={<LockOutlined />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={loading}
                        />
                    </FloatLabel>

                    <Button
                        type="primary"
                        block
                        size={buttonSize}
                        icon={<LoginOutlined />}
                        loading={loading}
                        onClick={handleLogin}
                        style={{ height: 36, fontWeight: 600 }}>
                        {loading ? "AUTHENTICATING..." : "LOG IN"}
                    </Button>

                    <Space
                        direction="vertical"
                        size={0}
                        style={{ width: "100%", textAlign: "center" }}>
                        <div>
                            <Text type="secondary">
                                Don't have an account?{" "}
                            </Text>
                            <Link onClick={() => navigate("/register")}>
                                Register here
                            </Link>
                        </div>

                        <div>
                            <Text type="secondary">Forgot password? </Text>
                            <Link onClick={() => navigate("/forgot-password")}>
                                Click here
                            </Link>
                        </div>
                    </Space>
                </Space>
            </Card>
        </div>
    );
};

export default LoginPage;
