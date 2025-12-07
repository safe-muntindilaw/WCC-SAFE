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

// Destructure AntD components
const { Title, Text, Link } = Typography;

// --- 1. THEME COLORS (Consistent Government Blue/Yellow) ---
const THEME = {
    BLUE_PRIMARY: "#0056a0",

    BACKGROUND_LIGHT: "#f0f2f5",
    CARD_BG: "white",
    BUTTON_HOVER: "#004480",
    CARD_SHADOW: "0 8px 16px rgba(0, 86, 160, 0.2)",
};

// --- MAIN COMPONENT ---
const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();

    const [isLoading, setIsLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    /**
     * Handles the password reset process on form submission.
     * @param {object} values - Contains the 'email' from the Ant Design Form.
     */
    const handleReset = async (values) => {
        const trimmedEmail = values.email.trim();
        setIsLoading(true);
        setAlertMessage(null); // Clear previous messages

        try {
            // 1. CHECK DATABASE: Verify if the email exists in the 'contacts' table
            const { data: userData } = await supabase
                .from("contacts")
                .select("email")
                .eq("email", trimmedEmail)
                .maybeSingle();

            // 2. Conditional Logic: If email is not in the DB, show a non-specific success message
            // This is a security best practice to prevent email enumeration.
            if (!userData) {
                setAlertMessage({
                    type: "success",
                    text: "If an account with this email exists, a password reset email has been sent. Check your inbox.",
                });
                return;
            }

            // 3. SEND RESET EMAIL: If found, proceed with Supabase Auth reset
            const { error: authError } =
                await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                    // Redirect to the /profile page to handle the token
                    redirectTo: `${window.location.origin}/profile`,
                });

            if (authError) {
                throw authError;
            }

            // 4. SUCCESS MESSAGE
            setAlertMessage({
                type: "success",
                text: "Password reset email sent, check your inbox to continue.",
            });
            form.resetFields(); // Clear the form on successful submission
        } catch (error) {
            console.error("Reset Error:", error);
            const messageText =
                error.message ||
                "An unknown error occurred. Please try again later.";
            setAlertMessage({
                type: "error",
                text: `Failed to send reset link: ${messageText}`,
            });
            message.error(messageText); // Use AntD message for transient feedback
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
                backgroundColor: THEME.BACKGROUND_LIGHT, // Government background
                padding: "1rem",
            }}
        >
            <Card
                style={{
                    maxWidth: 450,
                    width: "100%",
                    boxShadow: THEME.CARD_SHADOW, // Government shadow
                    borderRadius: 12, // Slightly less rounded for a formal look
                    backgroundColor: THEME.CARD_BG,
                    borderTop: `5px solid ${THEME.BLUE_PRIMARY}`, // Blue accent border
                    paddingTop: 10,
                }}
            >
                {/* Header Section */}
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

                {/* Alert Message Section */}
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

                {/* Reset Form */}
                <Form
                    form={form}
                    name="forgot_password_form"
                    onFinish={handleReset}
                    layout="vertical"
                >
                    {/* Email Input */}
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
                        required
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

                    {/* Submit Button */}
                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        loading={isLoading}
                        icon={<SendOutlined />}
                        style={{
                            backgroundColor: THEME.BLUE_PRIMARY, // Government Blue
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

                    {/* Navigation Links */}
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
