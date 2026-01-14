// ForgotPasswordPage.jsx - Updated with consistent styling from RegisterPage
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import { Card, Typography, Input, Button, Space } from "antd";
import { FloatLabel } from "@/utils/FloatLabel";
import { SendOutlined, MailOutlined } from "@ant-design/icons";
import { THEME, cardStyle } from "@/utils/theme";
import { validateEmail } from "@/utils/validation";
import { showSuccess, showError, showInfo } from "@/utils/notifications";
import {
    useResponsive,
    useResponsiveStyles,
    useResponsivePadding,
} from "@/utils/useResponsive";

const { Title, Text, Link } = Typography;

const ForgotPasswordPage = () => {
    const navigate = useNavigate();

    // Responsive Hooks
    const { isMobile } = useResponsive();
    const responsivePadding = useResponsivePadding();
    const { fontSize, buttonSize } = useResponsiveStyles();

    // State
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleReset = async () => {
        const trimmedEmail = email.trim();

        if (!trimmedEmail) {
            showError("Please enter your email address");
            return;
        }

        if (!validateEmail(trimmedEmail)) {
            showError("Please enter a valid Gmail address");
            return;
        }

        setIsLoading(true);

        try {
            const { data: userData } = await supabase
                .from("contacts")
                .select("email")
                .eq("email", trimmedEmail)
                .maybeSingle();

            if (!userData) {
                showInfo(
                    "If an account with this email exists, a password reset email has been sent"
                );
                setEmail("");
                return;
            }

            const { error: authError } =
                await supabase.auth.resetPasswordForEmail(trimmedEmail, {
                    redirectTo: `${window.location.origin}/profile`,
                });

            if (authError) throw authError;

            showSuccess(
                "Password reset email sent! Check your inbox to continue"
            );
            setEmail("");
        } catch (error) {
            console.error("Reset Error:", error);
            showError(`Failed to send reset link: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleReset();
        }
    };

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
                    ...cardStyle,
                    maxWidth: 450,
                    width: "100%",
                    borderTop: `6px solid ${THEME.BLUE_PRIMARY}`,
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
                        Reset Password
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
                    <FloatLabel label="Registered Email Address" value={email}>
                        <Input
                            type="email"
                            prefix={<MailOutlined />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={isLoading}
                        />
                    </FloatLabel>

                    <Button
                        type="primary"
                        block
                        size={buttonSize}
                        icon={<SendOutlined />}
                        loading={isLoading}
                        onClick={handleReset}
                        style={{ height: 36, fontWeight: 600 }}>
                        {isLoading
                            ? "SENDING LINK..."
                            : "SEND PASSWORD RESET LINK"}
                    </Button>

                    <Space
                        direction="vertical"
                        size={0}
                        style={{ width: "100%", textAlign: "center" }}>
                        <div>
                            <Text type="secondary">
                                Remember your password?{" "}
                            </Text>
                            <Link onClick={() => navigate("/login")}>
                                Back to Login
                            </Link>
                        </div>

                        <div>
                            <Text type="secondary">New user? </Text>
                            <Link onClick={() => navigate("/register")}>
                                Register here
                            </Link>
                        </div>
                    </Space>
                </Space>
            </Card>
        </div>
    );
};

export default ForgotPasswordPage;
