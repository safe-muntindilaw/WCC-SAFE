import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/globals";
import { useAuth } from "@/context/AuthContext";
import {
    Layout,
    Card,
    Input,
    Button,
    Select,
    Spin,
    Space,
    Typography,
    Row,
    Col,
    Alert,
    Badge,
} from "antd";
import {
    UserOutlined,
    SafetyOutlined,
    LockOutlined,
    EnvironmentOutlined,
    BellOutlined,
    HomeOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { FloatLabel } from "@/utils/FloatLabel";
import { THEME, cardStyleAdaptive } from "@/utils/theme";
import {
    cleanName,
    capitalizeWords,
    formatPhoneNumber,
} from "@/utils/validation";
import {
    showSuccessNotification,
    showErrorNotification,
    showValidationErrors,
} from "@/utils/notifications";
import { useConfirmDialog } from "@/utils/confirmDialog";
import { useResponsive } from "@/utils/useResponsive";
import {
    useContactValidation,
    usePasswordValidation,
} from "@/utils/useFormValidation";
import {
    PasswordRequirements,
    PasswordStrengthIndicator,
    InlineValidationText,
} from "@/utils/ValidationCard";

const { Title, Text } = Typography;
const { Content } = Layout;
const INPUT_HEIGHT = { mobile: 32, desktop: 40 };

const ProfilePage = () => {
    const { user } = useAuth();
    const { confirm } = useConfirmDialog();
    const { isMobile } = useResponsive();

    const inputHeight = isMobile ? INPUT_HEIGHT.mobile : INPUT_HEIGHT.desktop;

    const [profileData, setProfileData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        contactNumber: "",
        placeId: "",
    });
    const [passwordData, setPasswordData] = useState({
        newPassword: "",
        confirmPassword: "",
    });
    const [areas, setAreas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingDetails, setSavingDetails] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [savingSubscription, setSavingSubscription] = useState(false);
    const [originalContactNumber, setOriginalContactNumber] = useState("");
    const [hasDefaultPassword, setHasDefaultPassword] = useState(false);

    // Use shared validation hooks
    const contactValidation = useContactValidation(
        profileData.contactNumber,
        true,
        user?.id,
        originalContactNumber,
    );

    const passwordValidation = usePasswordValidation(
        passwordData.newPassword,
        passwordData.confirmPassword,
    );

    // Add CSS for green button
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
            .green-button.ant-btn-primary {
                background-color: ${THEME.GREEN_SUCCESS};
                border-color: ${THEME.GREEN_SUCCESS};
            }
            .green-button.ant-btn-primary:hover:not(:disabled) {
                background-color: #45a049 !important;
                border-color: #45a049 !important;
            }
            .green-button.ant-btn-primary:active:not(:disabled) {
                background-color: #3d8b40 !important;
                border-color: #3d8b40 !important;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    // Handle recovery token from URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("token");
        const type = urlParams.get("type");

        if (code && type === "recovery") {
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (error) {
                    showErrorNotification({
                        message: "Recovery Link Invalid",
                        description:
                            "The recovery link has expired or is invalid. Please request a new one.",
                    });
                } else {
                    showSuccessNotification({
                        message: "Password Recovery",
                        description:
                            "Please set your new password below to secure your account.",
                    });
                }
            });
            history.replaceState(null, "", window.location.pathname);
        }
    }, []);

    // Fetch profile and areas data
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [
                    { data: contactData, error: contactError },
                    { data: placesData, error: placesError },
                ] = await Promise.all([
                    supabase
                        .from("contacts")
                        .select(
                            "first_name, last_name, email, contact_number, place_id, subscribed, password_changed",
                        )
                        .eq("user_id", user.id)
                        .maybeSingle(),
                    supabase.from("places").select("id, name").order("name"),
                ]);

                if (contactError)
                    throw new Error("Failed to load profile data");
                if (placesError) throw new Error("Failed to load areas");

                if (contactData) {
                    const formattedNumber = formatPhoneNumber(
                        contactData.contact_number?.replace("+63", "") || "",
                    );
                    setProfileData({
                        firstName: contactData.first_name || "",
                        lastName: contactData.last_name || "",
                        email: user.email || contactData.email || "",
                        contactNumber: formattedNumber,
                        placeId: contactData.place_id || "",
                    });
                    // Store the clean 10-digit number for comparison
                    setOriginalContactNumber(formattedNumber); // Update this line
                    setIsSubscribed(contactData.subscribed || false);
                    setHasDefaultPassword(!contactData.password_changed);
                }

                if (placesData) {
                    setAreas(placesData);
                }
            } catch (error) {
                showErrorNotification({
                    message: "Failed to Load Profile",
                    description:
                        error.message ||
                        "An error occurred while loading your profile data.",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    // Validate profile form
    const validateProfileForm = () => {
        const errors = [];

        const cleanedFirstName = cleanName(profileData.firstName);
        const cleanedLastName = cleanName(profileData.lastName);

        if (!cleanedFirstName || cleanedFirstName.length < 2) {
            errors.push("First name must be at least 2 characters");
        } else if (!/^[a-zA-Z\s]+$/.test(cleanedFirstName)) {
            errors.push("First name must contain only letters and spaces");
        }

        if (!cleanedLastName || cleanedLastName.length < 2) {
            errors.push("Last name must be at least 2 characters");
        } else if (!/^[a-zA-Z\s]+$/.test(cleanedLastName)) {
            errors.push("Last name must contain only letters and spaces");
        }

        if (!profileData.contactNumber) {
            errors.push("Contact number is required");
        } else if (profileData.contactNumber.length !== 10) {
            errors.push("Contact number must be exactly 10 digits");
        } else if (!profileData.contactNumber.startsWith("9")) {
            errors.push("Contact number must start with 9");
        }

        if (contactValidation.exists) {
            errors.push(
                "Contact number is already registered to another account",
            );
        }

        if (!profileData.placeId) {
            errors.push("Please select your area");
        }

        return errors;
    };

    // Show profile update confirmation dialog
    const showProfileUpdateConfirmation = () => {
        const errors = validateProfileForm();

        if (errors.length > 0) {
            showValidationErrors(errors);
            return;
        }

        const selectedArea = areas.find((a) => a.id === profileData.placeId);
        const cleanedFirstName = capitalizeWords(
            cleanName(profileData.firstName),
        );
        const cleanedLastName = capitalizeWords(
            cleanName(profileData.lastName),
        );

        confirm({
            title: "Update Profile Information?",
            content: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Name:
                        </Text>{" "}
                        <Text>
                            {cleanedFirstName} {cleanedLastName}
                        </Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Contact:
                        </Text>{" "}
                        <Text>+63{profileData.contactNumber}</Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Area:
                        </Text>{" "}
                        <Text>{selectedArea?.name || "-"}</Text>
                    </div>
                </Space>
            ),
            okText: "Update Profile",
            cancelText: "Cancel",
            onOk: handleSaveDetails,
        });
    };

    // Handle profile update
    const handleSaveDetails = async () => {
        if (!user) return;
        setSavingDetails(true);

        try {
            const cleanedFirstName = capitalizeWords(
                cleanName(profileData.firstName),
            );
            const cleanedLastName = capitalizeWords(
                cleanName(profileData.lastName),
            );
            const formattedNumber = `+63${profileData.contactNumber}`;

            const { error: contactError } = await supabase
                .from("contacts")
                .update({
                    first_name: cleanedFirstName,
                    last_name: cleanedLastName,
                    contact_number: formattedNumber,
                    place_id: profileData.placeId,
                })
                .eq("user_id", user.id);

            if (contactError) throw contactError;

            setProfileData((prev) => ({
                ...prev,
                firstName: cleanedFirstName,
                lastName: cleanedLastName,
            }));
            setOriginalContactNumber(profileData.contactNumber);

            showSuccessNotification({
                message: "Profile Updated",
                description:
                    "Your profile information has been updated successfully.",
            });
        } catch (err) {
            if (
                err.code === "23505" ||
                (err.message &&
                    err.message.includes("contacts_contact_number_key"))
            ) {
                showErrorNotification({
                    message: "Update Failed",
                    description:
                        "This contact number is already registered to another account.",
                });
            } else {
                showErrorNotification({
                    message: "Update Failed",
                    description:
                        err.message ||
                        "Failed to update profile. Please try again.",
                });
            }
        } finally {
            setSavingDetails(false);
        }
    };

    // Validate password form
    const validatePasswordForm = () => {
        const errors = [];

        if (!passwordData.newPassword) {
            errors.push("New password is required");
        } else if (!passwordValidation.isValid) {
            errors.push("Password does not meet all requirements");
        }

        if (!passwordData.confirmPassword) {
            errors.push("Please confirm your password");
        } else if (!passwordValidation.passwordsMatch) {
            errors.push("Passwords do not match");
        }

        return errors;
    };

    // Show password change confirmation dialog
    const showPasswordChangeConfirmation = () => {
        const errors = validatePasswordForm();

        if (errors.length > 0) {
            showValidationErrors(errors);
            return;
        }

        confirm({
            title: "Change Your Password?",
            content:
                "Are you sure you want to change your password? You will need to use the new password for future logins.",
            okText: "Yes, Change Password",
            cancelText: "Cancel",
            onOk: handleSavePassword,
        });
    };

    // Handle password update
    const handleSavePassword = async () => {
        setSavingPassword(true);
        try {
            const { error: pwError } = await supabase.auth.updateUser({
                password: passwordData.newPassword,
            });

            if (pwError) throw pwError;

            const { error: updateError } = await supabase
                .from("contacts")
                .update({ password_changed: true })
                .eq("user_id", user.id);

            if (updateError) {
                console.error(
                    "Failed to update password_changed flag:",
                    updateError,
                );
            }

            setPasswordData({ newPassword: "", confirmPassword: "" });
            setHasDefaultPassword(false);

            showSuccessNotification({
                message: "Password Updated",
                description:
                    "Your password has been changed successfully. Please use your new password for future logins.",
            });
        } catch (err) {
            showErrorNotification({
                message: "Password Update Failed",
                description:
                    err.message ||
                    "Failed to change password. Please try again.",
            });
            setPasswordData({ newPassword: "", confirmPassword: "" });
        } finally {
            setSavingPassword(false);
        }
    };

    // Show subscription confirmation dialog
    const showSubscriptionConfirmation = () => {
        const newStatus = !isSubscribed;
        confirm({
            title:
                newStatus ?
                    "Enable SMS Notifications?"
                :   "Disable SMS Notifications?",
            content:
                newStatus ?
                    "Stay informed. You will receive real-time emergency alerts and important community updates directly to your phone."
                :   "Are you sure? By unsubscribing, you may miss critical safety alerts and time-sensitive announcements.",
            okText: newStatus ? "Enable Updates" : "Unsubscribe",
            cancelText: "Keep as is",
            danger: !newStatus,
            onOk: handleToggleSubscription,
        });
    };

    // Handle subscription toggle
    const handleToggleSubscription = async () => {
        if (!user) return;
        setSavingSubscription(true);
        const newStatus = !isSubscribed;

        try {
            const { error } = await supabase
                .from("contacts")
                .update({ subscribed: newStatus })
                .eq("user_id", user.id);

            if (error) throw error;

            setIsSubscribed(newStatus);

            showSuccessNotification({
                message: newStatus ? "Alerts Enabled" : "Alerts Disabled",
                description:
                    newStatus ?
                        "You will now receive emergency alerts and important announcements via SMS."
                    :   "You have been unsubscribed from SMS notifications.",
            });
        } catch (err) {
            showErrorNotification({
                message: "Update Failed",
                description:
                    err.message ||
                    "Failed to update subscription status. Please try again.",
            });
        } finally {
            setSavingSubscription(false);
        }
    };

    // Loading state
    if (loading) {
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
        <Content
            style={{
                padding: isMobile ? 16 : 24,
                maxWidth: THEME.MAX_WIDTH,
                margin: "0 auto",
            }}>
            <header style={{ marginBottom: THEME.SPACING_LG }}>
                <Title
                    level={isMobile ? 3 : 1}
                    style={{
                        margin: 0,
                        marginBottom: THEME.SPACING_XS,
                        color: THEME.BLUE_AUTHORITY,
                    }}>
                    <UserOutlined style={{ marginRight: THEME.SPACING_XS }} />
                    Account Settings
                </Title>
            </header>

            <Row gutter={[THEME.SPACING_MD, THEME.SPACING_MD]}>
                {/* Personal Details Card */}
                <Col xs={24} md={12} lg={8}>
                    <Card
                        title={
                            <Space size={THEME.SPACING_XS}>
                                <EnvironmentOutlined
                                    style={{ color: THEME.BLUE_AUTHORITY }}
                                />
                                <Text strong>Personal Information</Text>
                            </Space>
                        }
                        style={{
                            ...cardStyleAdaptive,
                            height: "100%",
                        }}>
                        <Space
                            direction="vertical"
                            size={THEME.SPACING_SM}
                            style={{ width: "100%" }}>
                            <FloatLabel value={profileData.firstName}>
                                <label
                                    style={{
                                        fontWeight: 600,
                                        color: THEME.BLUE_PRIMARY,
                                    }}>
                                    First Name
                                </label>
                                <Input
                                    prefix={<UserOutlined />}
                                    value={profileData.firstName}
                                    onChange={(e) =>
                                        setProfileData((prev) => ({
                                            ...prev,
                                            firstName: capitalizeWords(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>

                            <FloatLabel value={profileData.lastName}>
                                <label
                                    style={{
                                        fontWeight: 600,
                                        color: THEME.BLUE_PRIMARY,
                                    }}>
                                    Last Name
                                </label>
                                <Input
                                    prefix={<UserOutlined />}
                                    value={profileData.lastName}
                                    onChange={(e) =>
                                        setProfileData((prev) => ({
                                            ...prev,
                                            lastName: capitalizeWords(
                                                e.target.value,
                                            ),
                                        }))
                                    }
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>

                            <FloatLabel value={profileData.email}>
                                <label
                                    style={{
                                        fontWeight: 600,
                                        color: THEME.BLUE_PRIMARY,
                                    }}>
                                    Email Address
                                </label>
                                <Input
                                    value={profileData.email}
                                    disabled
                                    prefix={<MailOutlined />}
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>

                            <div>
                                <FloatLabel
                                    value={profileData.contactNumber}
                                    status={
                                        (
                                            profileData.contactNumber &&
                                            contactValidation.touched &&
                                            !contactValidation.isValid &&
                                            !contactValidation.checking
                                        ) ?
                                            "error"
                                        : (
                                            profileData.contactNumber &&
                                            contactValidation.touched &&
                                            contactValidation.isValid
                                        ) ?
                                            "success"
                                        :   undefined
                                    }>
                                    <label
                                        style={{
                                            fontWeight: 600,
                                            color: THEME.BLUE_PRIMARY,
                                        }}>
                                        Contact Number
                                    </label>
                                    <Input
                                        prefix={
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                }}>
                                                <PhoneOutlined
                                                    style={{
                                                        marginRight: "2px",
                                                    }}
                                                />
                                                <span
                                                    style={{
                                                        userSelect: "none",
                                                    }}>
                                                    +63
                                                </span>
                                            </div>
                                        }
                                        maxLength={10}
                                        value={profileData.contactNumber}
                                        onChange={(e) => {
                                            const formatted = formatPhoneNumber(
                                                e.target.value,
                                            );
                                            setProfileData((prev) => ({
                                                ...prev,
                                                contactNumber: formatted,
                                            }));
                                        }}
                                        style={{ height: inputHeight }}
                                        styles={{
                                            prefix: { marginRight: 0 },
                                        }}
                                    />
                                </FloatLabel>
                                <InlineValidationText
                                    isValid={contactValidation.isValid}
                                    checking={contactValidation.checking}
                                    touched={contactValidation.touched}
                                    validText="Contact number is available"
                                    invalidText={
                                        contactValidation.exists ?
                                            "This number is already registered"
                                        :   "Invalid contact number"
                                    }
                                />
                            </div>

                            <FloatLabel value={profileData.placeId}>
                                <label
                                    style={{
                                        fontWeight: 600,
                                        color: THEME.BLUE_PRIMARY,
                                    }}>
                                    Area
                                </label>

                                <div style={{ position: "relative" }}>
                                    {profileData.placeId && (
                                        <HomeOutlined
                                            style={{
                                                position: "absolute",
                                                left: 12,
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                color: THEME.BLUE_PRIMARY,
                                                pointerEvents: "none",
                                                zIndex: 2,
                                            }}
                                        />
                                    )}
                                    <Select
                                        value={profileData.placeId || undefined}
                                        onChange={(value) =>
                                            setProfileData((prev) => ({
                                                ...prev,
                                                placeId: value,
                                            }))
                                        }
                                        style={{
                                            width: "100%",
                                            height: inputHeight,
                                        }}
                                        options={areas.map((a) => ({
                                            label: a.name,
                                            value: a.id,
                                        }))}
                                    />
                                </div>
                            </FloatLabel>

                            <Button
                                type="primary"
                                block
                                loading={savingDetails}
                                onClick={showProfileUpdateConfirmation}
                                disabled={
                                    contactValidation.exists ||
                                    contactValidation.checking
                                }
                                style={{
                                    height: inputHeight,
                                    fontWeight: 600,
                                    marginTop: THEME.SPACING_SM,
                                }}>
                                Update Profile
                            </Button>
                        </Space>
                    </Card>
                </Col>

                {/* Password Card */}
                <Col xs={24} md={12} lg={8}>
                    <Card
                        title={
                            <Space size={THEME.SPACING_XS}>
                                <SafetyOutlined
                                    style={{ color: THEME.BLUE_AUTHORITY }}
                                />
                                <Text strong>Security</Text>
                            </Space>
                        }
                        style={{
                            ...cardStyleAdaptive,
                            height: "100%",
                        }}>
                        <Space
                            direction="vertical"
                            size={THEME.SPACING_MD}
                            style={{ width: "100%" }}>
                            <Alert
                                message={
                                    hasDefaultPassword ? "Action Required" : (
                                        "Security Recommendation"
                                    )
                                }
                                description={
                                    hasDefaultPassword ?
                                        "Your account is currently using the default password set by the administrator. For your security, please change it to a personal password immediately."
                                    :   "Keep your account secure by using a strong password. If your password was initially set up by a Barangay Administrator, consider updating it to something more personal."
                                }
                                type={hasDefaultPassword ? "warning" : "info"}
                                showIcon
                                style={{ fontSize: 13 }}
                            />

                            <FloatLabel
                                label="New Password"
                                value={passwordData.newPassword}>
                                <Input.Password
                                    prefix={<LockOutlined />}
                                    value={passwordData.newPassword}
                                    onChange={(e) =>
                                        setPasswordData((prev) => ({
                                            ...prev,
                                            newPassword: e.target.value,
                                        }))
                                    }
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>

                            {passwordData.newPassword && (
                                <>
                                    <PasswordRequirements
                                        checks={passwordValidation.checks}
                                        showOnlyIncomplete={false}
                                    />
                                    <PasswordStrengthIndicator
                                        strength={passwordValidation.strength}
                                        showLabel={true}
                                    />
                                </>
                            )}

                            <div>
                                <FloatLabel
                                    label="Confirm Password"
                                    value={passwordData.confirmPassword}
                                    status={
                                        (
                                            passwordData.confirmPassword &&
                                            !passwordValidation.passwordsMatch
                                        ) ?
                                            "error"
                                        : (
                                            passwordData.confirmPassword &&
                                            passwordValidation.passwordsMatch
                                        ) ?
                                            "success"
                                        :   undefined
                                    }>
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) =>
                                            setPasswordData((prev) => ({
                                                ...prev,
                                                confirmPassword: e.target.value,
                                            }))
                                        }
                                        style={{ height: inputHeight }}
                                    />
                                </FloatLabel>
                                {passwordData.confirmPassword && (
                                    <InlineValidationText
                                        isValid={
                                            passwordValidation.passwordsMatch
                                        }
                                        checking={false}
                                        validText="Passwords match"
                                        invalidText="Passwords do not match"
                                    />
                                )}
                            </div>

                            <Button
                                type="primary"
                                block
                                loading={savingPassword}
                                onClick={showPasswordChangeConfirmation}
                                icon={<LockOutlined />}
                                disabled={
                                    !passwordValidation.isValid ||
                                    !passwordValidation.passwordsMatch
                                }
                                style={{
                                    height: inputHeight,
                                    fontWeight: 600,
                                    marginTop: THEME.SPACING_SM,
                                }}>
                                Update Password
                            </Button>
                        </Space>
                    </Card>
                </Col>

                {/* Subscription Card */}
                <Col xs={24} md={12} lg={8}>
                    <Card
                        title={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    width: "100%",
                                }}>
                                <Space size={THEME.SPACING_XS} align="center">
                                    <BellOutlined
                                        style={{
                                            color:
                                                isSubscribed ?
                                                    THEME.GREEN_SUCCESS
                                                :   THEME.RED_ERROR,
                                        }}
                                    />
                                    <Text strong>Emergency Alerts</Text>
                                </Space>

                                <Badge
                                    status={isSubscribed ? "success" : "error"}
                                    text={isSubscribed ? "Active" : "Disabled"}
                                />
                            </div>
                        }
                        style={{
                            ...cardStyleAdaptive,
                            borderColor:
                                isSubscribed ?
                                    THEME.GREEN_SUCCESS
                                :   THEME.RED_ERROR, // ADD THIS
                            height: "100%",
                        }}>
                        <Space
                            direction="vertical"
                            size={THEME.SPACING_MD}
                            style={{ width: "100%" }}>
                            <Alert
                                message={
                                    isSubscribed ?
                                        "Notifications Active"
                                    :   "Action Required"
                                }
                                description={
                                    isSubscribed ?
                                        "You are currently receiving critical safety updates, disaster warnings, and barangay announcements via SMS."
                                    :   "You are currently opted out. You will not receive urgent SMS alerts regarding floods, fires, or community emergencies."
                                }
                                type={isSubscribed ? "success" : "error"}
                                showIcon
                            />

                            <Button
                                type={isSubscribed ? "default" : "primary"}
                                danger={isSubscribed}
                                block
                                loading={savingSubscription}
                                onClick={showSubscriptionConfirmation}
                                icon={<BellOutlined />}
                                className={!isSubscribed ? "green-button" : ""}
                                style={{
                                    height: inputHeight,
                                    fontWeight: 600,
                                    marginTop: THEME.SPACING_SM,
                                }}>
                                {isSubscribed ?
                                    "Turn Off Alerts"
                                :   "Turn On Alerts"}
                            </Button>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </Content>
    );
};

export default ProfilePage;
