import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import { useState } from "react";

import {
    Card,
    Typography,
    Input,
    Button,
    Form,
    Space,
    Alert,
    message,
} from "antd";

import { SendOutlined, MailOutlined } from "@ant-design/icons";

const { Title, Text, Link } = Typography;

const THEME = {
    BLUE_PRIMARY: "#0056a0",
    BACKGROUND_LIGHT: "#f0f2f5",
    CARD_BG: "white",
    BUTTON_HOVER: "#004480",
    CARD_SHADOW: "0 8px 16px rgba(0, 86, 160, 0.2)",
};

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [isLoading, setIsLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    const handleReset = async (values) => {
        const trimmedEmail = values.email.trim();
        setIsLoading(true);
        setAlertMessage(null);

        try {
            const { data: userData } = await supabase
                .from("contacts")
                .select("email")
                .eq("email", trimmedEmail)
                .maybeSingle();

            if (!userData) {
                setAlertMessage({
                    type: "success",
                    text: "If an account with this email exists, a password reset email has been sent. Check your inbox.",
                });
                return;
            }

            const { error: authError } =
                await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                    redirectTo: `${window.location.origin}/profile`,
                });

            if (authError) throw authError;

            setAlertMessage({
                type: "success",
                text: "Password reset email sent, check your inbox to continue.",
            });
            form.resetFields();
        } catch (error) {
            console.error("Reset Error:", error);
            const messageText = error.message || "An unknown error occurred.";
            setAlertMessage({
                type: "error",
                text: `Failed to send reset link: ${messageText}`,
            });
            message.error(messageText);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "100vh",
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
                    paddingTop: 10,
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 24 }}>
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
                    <Text
                        type="secondary"
                        style={{ color: THEME.BLUE_PRIMARY }}
                    >
                        Account Recovery
                    </Text>
                </div>

                {alertMessage && (
                    <Alert
                        message={alertMessage.text}
                        type={alertMessage.type}
                        showIcon
                        closable
                        onClose={() => setAlertMessage(null)}
                        style={{ marginBottom: 24 }}
                    />
                )}

                <Form
                    form={form}
                    name="forgot_password_form"
                    onFinish={handleReset}
                    layout="vertical"
                >
                    <Form.Item
                        label={<Text strong>Registered Email Address</Text>}
                        name="email"
                        rules={[
                            {
                                required: true,
                                message: "Please enter your email!",
                            },
                            {
                                type: "email",
                                message: "Please enter a valid email address.",
                            },
                        ]}
                        tooltip="Enter the email associated with your account."
                    >
                        <Input
                            placeholder="Enter your email"
                            prefix={
                                <MailOutlined
                                    style={{ color: THEME.BLUE_PRIMARY }}
                                />
                            }
                        />
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={isLoading}
                        icon={<SendOutlined />}
                        style={{
                            backgroundColor: THEME.BLUE_PRIMARY,
                            borderColor: THEME.BLUE_PRIMARY,
                            height: 44,
                            fontWeight: 600,
                            marginTop: 8,
                            transition: "background-color 0.3s",
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
                        {isLoading
                            ? "SENDING LINK..."
                            : "SEND PASSWORD RESET LINK"}
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
                            Remember your password?{" "}
                            <Link
                                onClick={() => navigate("/login")}
                                style={{
                                    color: THEME.BLUE_PRIMARY,
                                    fontWeight: "600",
                                }}
                            >
                                Back to Login
                            </Link>
                        </Text>
                        <Text>
                            New user?{" "}
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
                    </Space>
                </Form>
            </Card>
        </div>
    );
};

export default ForgotPasswordPage;
