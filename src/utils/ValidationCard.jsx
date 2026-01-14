// ValidationCard.jsx - Reusable validation feedback component
import { Card, Space, Typography, Progress } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { THEME } from "./theme";

const { Text } = Typography;

export const ValidationCard = ({ errors = [], type = "error" }) => {
    if (errors.length === 0) return null;

    const isError = type === "error";
    const backgroundColor = isError ? "#fff2f0" : "#f6ffed";
    const borderColor = isError ? "#ffccc7" : "#b7eb8f";
    const textColor = isError ? THEME.RED_ERROR : THEME.GREEN_SUCCESS;

    return (
        <Card
            size="small"
            style={{
                background: backgroundColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
            }}>
            <Space direction="vertical" size={4}>
                <Text strong style={{ fontSize: 13, color: textColor }}>
                    {isError ? "Requirements:" : "All requirements met!"}
                </Text>
                <ul
                    style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        color: textColor,
                    }}>
                    {errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                    ))}
                </ul>
            </Space>
        </Card>
    );
};

export const PasswordRequirements = ({
    checks,
    showOnlyIncomplete = false,
}) => {
    const requirements = [
        { key: "length", label: "8-32 characters", check: checks.length },
        {
            key: "uppercase",
            label: "One uppercase letter",
            check: checks.uppercase,
        },
        {
            key: "lowercase",
            label: "One lowercase letter",
            check: checks.lowercase,
        },
        { key: "number", label: "One number", check: checks.number },
        {
            key: "specialCharacters",
            label: "One special character",
            check: checks.specialCharacters,
        },
    ];

    const allMet = requirements.every((req) => req.check);
    const incompletRequirements = requirements.filter((req) => !req.check);

    if (showOnlyIncomplete && allMet) return null;

    const displayRequirements = showOnlyIncomplete
        ? incompletRequirements
        : requirements;

    return (
        <Card
            size="small"
            style={{
                background: allMet ? "#f6ffed" : "#fff2f0",
                border: `1px solid ${allMet ? "#b7eb8f" : "#ffccc7"}`,
                borderRadius: 8,
            }}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Text
                    strong
                    style={{
                        fontSize: 13,
                        color: allMet ? THEME.GREEN_SUCCESS : THEME.RED_ERROR,
                    }}>
                    {allMet
                        ? "Password Requirements Met!"
                        : "Password Requirements:"}
                </Text>
                <ul
                    style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 13,
                        color: allMet ? THEME.GREEN_SUCCESS : THEME.RED_ERROR,
                    }}>
                    {displayRequirements.map((req) => (
                        <li key={req.key}>
                            {req.check ? (
                                <CheckCircleOutlined
                                    style={{
                                        marginRight: 4,
                                        color: THEME.GREEN_SUCCESS,
                                    }}
                                />
                            ) : (
                                <CloseCircleOutlined
                                    style={{
                                        marginRight: 4,
                                        color: THEME.RED_ERROR,
                                    }}
                                />
                            )}
                            {req.label}
                        </li>
                    ))}
                </ul>
            </Space>
        </Card>
    );
};

export const PasswordStrengthIndicator = ({ strength, showLabel = true }) => {
    const getStrengthColor = () => {
        if (strength < 40) return THEME.RED_ERROR;
        if (strength < 80) return "#faad14";
        return THEME.GREEN_SUCCESS;
    };

    const getStrengthText = () => {
        if (strength < 40) return "Weak";
        if (strength < 80) return "Medium";
        return "Strong";
    };

    if (!strength) return null;

    return (
        <div style={{ marginTop: 8 }}>
            {showLabel && (
                <Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    Password Strength:{" "}
                    <Text strong style={{ color: getStrengthColor() }}>
                        {getStrengthText()}
                    </Text>
                </Text>
            )}
            <Progress
                percent={strength}
                strokeColor={getStrengthColor()}
                showInfo={false}
                size="small"
            />
        </div>
    );
};

export const InlineValidationText = ({
    isValid,
    checking,
    validText,
    invalidText,
    touched = true,
}) => {
    // Don't show anything if field hasn't been touched
    if (!touched) return null;

    if (checking) {
        return (
            <Text
                type="secondary"
                style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                ○ Checking...
            </Text>
        );
    }

    if (isValid === null) return null;

    return (
        <Text
            type={isValid ? "success" : "danger"}
            style={{ fontSize: 12, display: "block", marginTop: 4 }}>
            {isValid ? `✓ ${validText}` : `✗ ${invalidText}`}
        </Text>
    );
};
