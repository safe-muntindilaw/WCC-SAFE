// LoginPage.jsx (Refined, Modern, Logo-Ready Design)
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import { Card, Typography, Input, Button, Form, Space, Alert } from "antd";
import { UserOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";

// LOGO INTEGRATION: Import your logo here
import BarangayLogo from '@/assets/logo.png'; 

// Destructure AntD components
const { Title, Text, Link } = Typography;

// --- 1. THEME COLORS ---
const THEME = {
    BLUE_PRIMARY: '#0056a0', 
    BACKGROUND_LIGHT: '#f0f2f5',
    CARD_BG: 'white',
    // Button Hover
    BUTTON_HOVER: '#004480',
    // Box Shadow for official look
    CARD_SHADOW: "0 8px 16px rgba(0, 86, 160, 0.2)", 
};

const initialFormData = { email: "", password: "" };

const LoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState(initialFormData);
    const [statusMessage, setStatusMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) navigate("/dashboard", { replace: true });
        })();
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setStatusMessage(null);
    };

    const handleLogin = async (values) => {
        setLoading(true);
        setStatusMessage(null);

        const { email, password } = values; // Use values from AntD Form

        try {
            const { data, error: authError } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            if (authError) throw new Error("Invalid email or password.");

            const userId = data?.user?.id;
            if (userId) {
                // Assuming "contacts" table is where user roles/details are stored
                const { error: updateError } = await supabase
                    .from("contacts")
                    .update({ is_logged_in: true })
                    .eq("user_id", userId)
                    .select();

                if (updateError)
                    console.error(
                        "Failed to set is_logged_in:",
                        updateError.message
                    );
            }

            navigate("/dashboard", { replace: true });
        } catch (err) {
            setStatusMessage(`❌ Authentication failed. Please check your credentials.`);
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
                // Government Blue Background
                backgroundColor: THEME.BACKGROUND_LIGHT, 
                padding: "1rem",
            }}
        >
            <Card
                style={{
                    maxWidth: 450,
                    width: "100%",
                    // Stronger Government Shadow
                    boxShadow: THEME.CARD_SHADOW, 
                    borderRadius: 12,
                    backgroundColor: THEME.CARD_BG,
                    // Subtle Blue Border at the top for accent
                    borderTop: `5px solid ${THEME.BLUE_PRIMARY}`, 
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    
                    {/* 🖼️ LOGO CONTAINER: Using imported PNG */}
                    <div style={{
                        width: 100, 
                        height: 50, 
                        margin: '0 auto 0',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                    }}>
                        <img 
                            src={BarangayLogo} 
                            alt="Muntindilaw Logo" 
                            style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'contain',
                            }} 
                        />
                    </div>
                    {/* END LOGO */}

                    <Title level={2} style={{ color: THEME.BLUE_PRIMARY, marginBottom: 4, fontWeight: '800' }}>
                        SAFE MUNTINDILAW
                    </Title>
                    <Text type="secondary" style={{ color: THEME.BLUE_PRIMARY }}>
                        Smart Alerts for Flood Emergencies
                    </Text>
                </div>

                {/* Status Message using AntD Alert */}
                {statusMessage && (
                    <Alert
                        message={statusMessage}
                        type="error"
                        showIcon
                        style={{ marginBottom: 20 }}
                        closable
                    />
                )}

                {/* AntD Form handles submission with validation */}
                <Form layout="vertical" onFinish={handleLogin}>
                    
                    {/* Email Input */}
                    <Form.Item 
                        label={<Text strong>Email Address</Text>} 
                        name="email"
                        rules={[
                            { required: true, message: 'Please input your Email!' },
                            { type: 'email', message: 'The input is not valid E-mail!' }
                        ]}
                    >
                        <Input
                            placeholder="Enter your registered email"
                            name="email"
                            type="email"
                            prefix={<UserOutlined style={{ color: THEME.BLUE_PRIMARY }} />}
                        />
                    </Form.Item>

                    {/* Password Input */}
                    <Form.Item 
                        label={<Text strong>Password</Text>} 
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }]}
                    >
                        <Input.Password
                            placeholder="Enter your password"
                            name="password"
                            prefix={<LockOutlined style={{ color: THEME.BLUE_PRIMARY }} />}
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
                            transition: 'background-color 0.3s',
                        }}
            
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = THEME.BUTTON_HOVER)
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor = THEME.BLUE_PRIMARY)
                        }
                    >
                        {loading ? "AUTHENTICATING..." : "LOG IN PORTAL"}
                    </Button>

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
                                    fontWeight: '600'
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
                                    fontWeight: '600'
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