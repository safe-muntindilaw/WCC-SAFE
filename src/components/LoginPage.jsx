// LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import { Card, Typography, Input, Button, Form, Space, Alert } from "antd";
import { UserOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";

import BarangayLogo from "@/assets/logo.png";

const { Title, Text, Link } = Typography;

const THEME = {
    BLUE_PRIMARY: "#0056a0",
    BACKGROUND_LIGHT: "#f0f2f5",
    CARD_BG: "white",
    BUTTON_HOVER: "#004480",
    CARD_SHADOW: "0 8px 16px rgba(0, 86, 160, 0.2)",
};

const LoginPage = () => {
    const navigate = useNavigate();
    // const [formData, setFormData] = useState(initialFormData);
    const [statusMessage, setStatusMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    // Check session on load
    useEffect(() => {
        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) navigate("/dashboard", { replace: true });
        })();
    }, [navigate]);

    const handleLogin = async (values) => {
        setLoading(true);
        setStatusMessage(null);
        const { email, password } = values;

        try {
            // Sign in with Supabase v2
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;

            // Update user login status in "contacts"
            const userId = data.user.id;
            const { error: updateError } = await supabase
                .from("contacts")
                .update({ is_logged_in: true })
                .eq("user_id", userId);

            if (updateError) {
                console.error(
                    "Failed to update login status:",
                    updateError.message
                );
            }

            // Navigate to dashboard
            navigate("/dashboard", { replace: true });
        } catch (err) {
            console.error("Login error:", err);
            setStatusMessage("Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                backgroundColor: THEME.BACKGROUND_LIGHT,
                padding: "1rem",
            }}
        >
            <Card
                style={{
                    maxWidth: 450,
                    width: "100%",
                    boxShadow: THEME.CARD_SHADOW,
                    borderRadius: 12,
                    backgroundColor: THEME.CARD_BG,
                    borderTop: `5px solid ${THEME.BLUE_PRIMARY}`,
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    {/* Logo */}
                    {/* <div style={{ width: 100, height: 50, margin: '0 auto' }}> */}
                    {/* <img src={BarangayLogo} alt="Muntindilaw Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> */}
                    {/* </div> */}
                    <Title
                        level={2}
                        style={{
                            color: THEME.BLUE_PRIMARY,
                            marginBottom: 4,
                            fontWeight: "800",
                        }}
                    >
                        SAFE MUNTINDILAW
                    </Title>
                    <Text style={{ color: THEME.BLUE_PRIMARY }}>
                        Smart Alerts for Flood Emergencies
                    </Text>
                </div>

                {statusMessage && (
                    <Alert
                        message={statusMessage}
                        type="error"
                        showIcon
                        style={{ marginBottom: 20 }}
                        closable
                        onClose={() => setStatusMessage(null)}
                    />
                )}

                <Form layout="vertical" onFinish={handleLogin}>
                    {/* Email */}
                    <Form.Item
                        label={<Text strong>Email Address</Text>}
                        name="email"
                        rules={[
                            {
                                required: true,
                                message: "Please input your Email!",
                            },
                            {
                                type: "email",
                                message: "The input is not valid E-mail!",
                            },
                        ]}
                    >
                        <Input
                            placeholder="Enter your registered email"
                            prefix={
                                <UserOutlined
                                    style={{ color: THEME.BLUE_PRIMARY }}
                                />
                            }
                        />
                    </Form.Item>

                    {/* Password */}
                    <Form.Item
                        label={<Text strong>Password</Text>}
                        name="password"
                        rules={[
                            {
                                required: true,
                                message: "Please input your Password!",
                            },
                        ]}
                    >
                        <Input.Password
                            placeholder="Enter your password"
                            prefix={
                                <LockOutlined
                                    style={{ color: THEME.BLUE_PRIMARY }}
                                />
                            }
                        />
                    </Form.Item>

                    {/* Login Button */}
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        icon={<LoginOutlined />}
                        loading={loading}
                        style={{
                            backgroundColor: THEME.BLUE_PRIMARY,
                            borderColor: THEME.BLUE_PRIMARY,
                            height: 44,
                            fontWeight: 600,
                            marginTop: 16,
                        }}
                        onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                            THEME.BUTTON_HOVER)
                        }
                        onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                            THEME.BLUE_PRIMARY)
                        }
                    >
                        {loading ? "AUTHENTICATING..." : "LOG IN"}
                    </Button>

                    {/* Links */}
                    <Space
                        direction="vertical"
                        size="small"
                        style={{
                            width: "100%",
                            marginTop: 24,
                            textAlign: "center",
                        }}
                    >
                        <Text>
                            Don’t have an account?{" "}
                            <Link
                                onClick={() => navigate("/register")}
                                style={{
                                    color: THEME.BLUE_PRIMARY,
                                    fontWeight: "600",
                                }}
                            >
                                Register here
                            </Link>
                        </Text>
                        <Text>
                            Forgot password?{" "}
                            <Link
                                onClick={() => navigate("/forgot-password")}
                                style={{
                                    color: THEME.BLUE_PRIMARY,
                                    fontWeight: "600",
                                }}
                            >
                                Click here
                            </Link>
                        </Text>
                    </Space>
                </Form>
            </Card>
        </div>
    );
};

export default LoginPage;
