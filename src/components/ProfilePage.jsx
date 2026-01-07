// ProfilePage.jsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/globals";
import { useAuth } from "@/context/AuthContext";
import {
    Layout,
    Card,
    Form,
    Input,
    Button,
    Select,
    Spin,
    message,
    Alert,
    Space,
    Typography,
    Row,
    Col,
    Divider,
} from "antd";
import {
    UserOutlined,
    SafetyOutlined,
    LockOutlined,
    EnvironmentOutlined,
    BellOutlined,
} from "@ant-design/icons";

// --- 1. THEME AND CONSTANTS ---
const { Title, Text } = Typography;
const { Content } = Layout;
const { Option } = Select;

const THEME = {
    BLUE_AUTHORITY: "#0A3D62",
    BLUE_PRIMARY_BUTTON: "#1A5276",
    CARD_SHADOW: "0 8px 16px rgba(10, 61, 98, 0.1)",
    MAX_WIDTH: "1400px",
    RED_ERROR: "#ff4d4f",
    GREEN_SUCCESS: "#59ad2fff",
};

const FORM_LAYOUT = {
    labelCol: { span: 24 },
    wrapperCol: { span: 24 },
};

// --- 2. PHONE NUMBER UTILITIES ---
const formatPhoneNumber = (number) => {
    const digits = String(number || "").replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
};

// Detect suspicious patterns in contact numbers
const detectSuspiciousPattern = (number) => {
    // Check for 4 or more consecutive identical digits
    const repeatingPattern = /(\d)\1{3,}/;
    if (repeatingPattern.test(number)) {
        return "Contact number contains too many repeated digits (max 3 in a row)";
    }

    // Check for sequential patterns (ascending or descending) - 4 or more
    let sequentialCount = 1;
    for (let i = 1; i < number.length; i++) {
        const current = parseInt(number[i]);
        const previous = parseInt(number[i - 1]);

        if (current === previous + 1 || current === previous - 1) {
            sequentialCount++;
            if (sequentialCount >= 4) {
                return "Contact number contains suspicious sequential pattern (max 3 in sequence)";
            }
        } else {
            sequentialCount = 1;
        }
    }

    return null;
};

// --- 3. MAIN COMPONENT ---

const ProfilePage = () => {
    const { user } = useAuth();
    const [formDetails] = Form.useForm();
    const [formPassword] = Form.useForm();

    const [loading, setLoading] = useState(true);
    const [savingDetails, setSavingDetails] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [savingSubscription, setSavingSubscription] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);
    const [barangays, setBarangays] = useState([]);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("token");
        const type = urlParams.get("type");

        if (code && type === "recovery") {
            // exchange code for session
            supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (error) {
                    message.error(
                        "The recovery link has expired or is invalid."
                    );
                } else {
                    // set state to show password reset form
                    setIsChangingPassword(true);
                    message.success("Please set your new password below.");
                }
            });
            // clean URL
            history.replaceState(null, "", window.location.pathname);
        }
    }, []);

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch contact data and places data concurrently
                const [
                    { data: contactData, error: contactError },
                    { data: placesData, error: placesError },
                ] = await Promise.all([
                    supabase
                        .from("contacts")
                        .select(
                            "first_name, last_name, email, contact_number, place_id, subscribed"
                        )
                        .eq("user_id", user.id)
                        .maybeSingle(),
                    supabase.from("places").select("id, name"),
                ]);

                if (contactError) throw new Error("Failed to load profile.");
                if (placesError) throw new Error("Failed to load barangays.");

                if (contactData) {
                    // Format the contact number for display
                    const formattedNumber = formatPhoneNumber(
                        contactData.contact_number?.replace("+63", "")
                    );

                    const initialValues = {
                        firstName: contactData.first_name || "",
                        lastName: contactData.last_name || "",
                        email: user.email || contactData.email || "",
                        contactNumber: formattedNumber,
                        place: contactData.place_id || undefined,
                    };
                    formDetails.setFieldsValue(initialValues);
                    setIsSubscribed(contactData.subscribed || false);
                }

                if (placesData) {
                    // Sort barangays alphabetically by name
                    setBarangays(
                        placesData.sort((a, b) => a.name.localeCompare(b.name))
                    );
                }
            } catch (error) {
                message.error(error.message || "Failed to load initial data.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, formDetails]);

    // ** Function for Subscription Toggle **
    const handleToggleSubscription = async () => {
        if (!user) return;
        setSavingSubscription(true);
        setStatusMessage(null);
        const newStatus = !isSubscribed;

        try {
            const { error } = await supabase
                .from("contacts")
                .update({ subscribed: newStatus })
                .eq("user_id", user.id);

            if (error) throw error;

            setIsSubscribed(newStatus);
            const msg = newStatus
                ? "✅ Successfully Subscribed to Barangay Announcements! (Matagumpay na naka-subscribe sa mga anunsyo ng Barangay.)"
                : "✅ Successfully Unsubscribed from Barangay Announcements. (Matagumpay na naka-unsubscribe sa mga anunsyo ng Barangay.)";
            setStatusMessage(msg);
            message.success(newStatus ? "Subscribed!" : "Unsubscribed!");
        } catch (err) {
            let userFriendlyMsg =
                err.message ||
                "A system error occurred while updating subscription status. (Nagkaroon ng error sa sistema habang pinoproseso ang pag-update ng subscription.)";
            setStatusMessage(`❌ ${userFriendlyMsg}`);
            message.error(userFriendlyMsg);
        } finally {
            setSavingSubscription(false);
        }
    };

    // ** Function for Saving Personal Details **
    const handleSaveDetails = async (values) => {
        if (!user) return;
        setSavingDetails(true);
        setStatusMessage(null);

        try {
            // Format and prepend +63 if contact number is present
            const formattedNumber = formatPhoneNumber(values.contactNumber);
            const contactNumberToSave = formattedNumber
                ? `+63${formattedNumber}`
                : null;

            const { error: contactError } = await supabase
                .from("contacts")
                .update({
                    first_name: values.firstName,
                    last_name: values.lastName,
                    contact_number: contactNumberToSave,
                    place_id: values.place || null,
                })
                .eq("user_id", user.id);

            if (contactError) throw contactError;

            setStatusMessage(
                "✅ Official Resident Record Updated Successfully. (Matagumpay na na-update ang talaan ng residente.)"
            );
            message.success("Profile updated in the Barangay database.");
        } catch (err) {
            let userFriendlyMsg = "";

            // Custom error message for unique constraint violation on contact_number
            if (
                err.code === "23505" ||
                (err.message &&
                    err.message.includes("contacts_contact_number_key"))
            ) {
                userFriendlyMsg =
                    "Contact number is already taken. (Ang contact number na ito ay ginagamit na ng iba.)";
            } else {
                userFriendlyMsg =
                    err.message ||
                    "A system error occurred while processing the detail update. (Nagkaroon ng error sa sistema habang pinoproseso ang pag-update ng detalye.)";
            }

            setStatusMessage(`❌ ${userFriendlyMsg}`);
            message.error(userFriendlyMsg);
        } finally {
            setSavingDetails(false);
        }
    };

    // ** Function for Saving Password **
    const handleSavePassword = async (values) => {
        setSavingPassword(true);
        setStatusMessage(null);

        try {
            const { error: pwError } = await supabase.auth.updateUser({
                password: values.newPassword,
            });

            if (pwError) throw pwError;

            formPassword.resetFields();
            setIsChangingPassword(false);

            setStatusMessage(
                "✅ Your password has been successfully updated! (Maaari ninyong ipagpatuloy ang inyong kasalukuyang session nang walang abala. Ang bagong password ay gagamitin lamang sa inyong susunod na pag-login.)"
            );
            message.success("Password successfully changed!");
        } catch (err) {
            const msg =
                err.message ||
                "An authentication error occurred while changing the password. (Nagkaroon ng error sa pagpapatunay habang pinapalitan ang password.)";
            setStatusMessage(`❌ ${msg}`);
            message.error(msg);

            formPassword.resetFields();
        } finally {
            setSavingPassword(false);
        }
    };

    const isError = useMemo(
        () => statusMessage && statusMessage.startsWith("❌"),
        [statusMessage]
    );

    // --- 4. RENDER MAIN CONTENT ---
    return (
        <Content
            style={{
                padding: "40px 20px",
                maxWidth: THEME.MAX_WIDTH,
                margin: "0 auto",
            }}>
            <Title
                level={1}
                style={{ marginBottom: "15px", color: THEME.BLUE_AUTHORITY }}>
                <UserOutlined style={{ marginRight: 10 }} />
                Barangay Resident Account Management
            </Title>
            <Divider style={{ marginTop: 0, marginBottom: 30 }} />

            {statusMessage && (
                <Alert
                    message={
                        <Text
                            strong
                            style={{
                                color: isError ? THEME.RED_ERROR : undefined,
                            }}>
                            {isError
                                ? "Operation Failed"
                                : "Operation Successful"}
                        </Text>
                    }
                    description={statusMessage.replace(/^[✅❌]\s?/, "")}
                    type={isError ? "error" : "success"}
                    showIcon
                    closable
                    onClose={() => setStatusMessage(null)}
                    motion={false}
                    style={{
                        marginBottom: "30px",
                        borderLeft: `5px solid ${
                            isError ? THEME.RED_ERROR : THEME.GREEN_SUCCESS
                        }`,
                        padding: "15px 20px",
                    }}
                />
            )}

            <Row gutter={[30, 30]}>
                {/* 1. Personal Details Form */}
                <Col xs={24} lg={8}>
                    <Card
                        title={
                            <Title
                                level={3}
                                style={{
                                    margin: 0,
                                    color: THEME.BLUE_AUTHORITY,
                                }}>
                                <EnvironmentOutlined
                                    style={{ marginRight: 8 }}
                                />
                                Resident Identification Record
                            </Title>
                        }
                        bordered={false}
                        style={{
                            height: "100%",
                            boxShadow: THEME.CARD_SHADOW,
                            borderTop: `5px solid ${THEME.BLUE_AUTHORITY}`,
                        }}>
                        {loading ? (
                            <Spin
                                tip="Loading profile..."
                                style={{
                                    display: "block",
                                    margin: "50px auto",
                                }}
                            />
                        ) : (
                            <Form
                                {...FORM_LAYOUT}
                                form={formDetails}
                                onFinish={handleSaveDetails}
                                layout="vertical">
                                <Row gutter={24}>
                                    <Col span={12}>
                                        <Form.Item
                                            label="First Name (Given Name)"
                                            name="firstName"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        "First Name is required for the record! (Pangalan ay kinakailangan sa rekord!)",
                                                },
                                            ]}>
                                            <Input placeholder="e.g. Juan (Hal. Juan)" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Last Name (Surname)"
                                            name="lastName"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        "Last Name is required for the record! (Apelyido ay kinakailangan sa rekord!)",
                                                },
                                            ]}>
                                            <Input placeholder="e.g. Dela Cruz (Hal. Dela Cruz)" />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Form.Item
                                    label="Primary Email Address (System Login ID)"
                                    name="email"
                                    tooltip="This is your permanent system login ID. It cannot be changed here. (Ito ang iyong permanenteng system login ID. Hindi ito mababago dito.)">
                                    <Input
                                        disabled
                                        style={{
                                            backgroundColor: "#f5f5f5",
                                            color: "rgba(0, 0, 0, 0.65)",
                                            cursor: "not-allowed",
                                        }}
                                        addonBefore={<UserOutlined />}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Contact Number (For Barangay Updates)"
                                    name="contactNumber"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please input your 10-digit contact number! (Pakilagay ang inyong 10-digit contact number!)",
                                        },
                                        {
                                            len: 10,
                                            message:
                                                "Contact number must be exactly 10 digits (excluding +63). (Ang contact number ay dapat 10 digits lang.)",
                                        },
                                        {
                                            pattern: /^\d+$/,
                                            message:
                                                "Contact number must contain only digits. (Contact number ay dapat na mga numero lamang.)",
                                        },
                                        {
                                            validator: (_, value) => {
                                                if (!value)
                                                    return Promise.resolve();
                                                const suspiciousError =
                                                    detectSuspiciousPattern(
                                                        value
                                                    );
                                                if (suspiciousError) {
                                                    return Promise.reject(
                                                        new Error(
                                                            `${suspiciousError} (Hindi pwedeng mahigit 3 magkaparehong o sunod-sunod na numero.)`
                                                        )
                                                    );
                                                }
                                                return Promise.resolve();
                                            },
                                        },
                                    ]}>
                                    <Input
                                        addonBefore="+63"
                                        maxLength={10}
                                        placeholder="e.g. 917xxxxxxx"
                                        onChange={(e) => {
                                            const formatted = formatPhoneNumber(
                                                e.target.value
                                            );
                                            formDetails.setFieldValue(
                                                "contactNumber",
                                                formatted
                                            );
                                        }}
                                    />
                                </Form.Item>
                                <div
                                    style={{
                                        marginTop: -20,
                                        marginBottom: 24,
                                    }}></div>

                                <Form.Item
                                    label="Permanent Barangay Assignment"
                                    name="place"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please select your official Barangay. (Pumili ng inyong opisyal na Barangay.)",
                                        },
                                    ]}>
                                    <Select
                                        placeholder="Select Barangay (Pumili ng Barangay)"
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            option.children
                                                .toLowerCase()
                                                .indexOf(input.toLowerCase()) >=
                                            0
                                        }>
                                        {barangays.map((b) => (
                                            <Option key={b.id} value={b.id}>
                                                {b.name}
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    style={{ marginBottom: 0, marginTop: 30 }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={savingDetails}
                                        icon={<EnvironmentOutlined />}
                                        size="large"
                                        style={{
                                            backgroundColor:
                                                THEME.BLUE_PRIMARY_BUTTON,
                                            borderColor:
                                                THEME.BLUE_PRIMARY_BUTTON,
                                            fontWeight: "bold",
                                            width: "100%",
                                        }}>
                                        {savingDetails
                                            ? "Processing Update..."
                                            : "Update Record"}
                                    </Button>
                                </Form.Item>
                            </Form>
                        )}
                    </Card>
                </Col>

                {/* 2. Password Change Section */}
                <Col xs={24} lg={8}>
                    <Card
                        title={
                            <Title
                                level={3}
                                style={{
                                    margin: 0,
                                    color: THEME.BLUE_AUTHORITY,
                                }}>
                                <SafetyOutlined style={{ marginRight: 8 }} />
                                Authentication Security
                            </Title>
                        }
                        bordered={false}
                        style={{
                            height: "100%",
                            boxShadow: THEME.CARD_SHADOW,
                            borderTop: `5px solid ${THEME.BLUE_AUTHORITY}`,
                        }}>
                        <Alert
                            message="Security Warning"
                            description="Always ensure that you are the only one who knows your login credentials. Never share your new password with anyone. (Siguraduhin na kayo lamang ang nakakaalam ng inyong login credentials. Huwag kailanman ibahagi ang inyong bagong password sa kahit kanino.)"
                            type="warning"
                            showIcon
                            motion={false}
                            style={{ marginBottom: "25px" }}
                        />

                        {!isChangingPassword ? (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "10px 0",
                                }}>
                                <Button
                                    type="default"
                                    onClick={() => {
                                        formPassword.resetFields();
                                        setIsChangingPassword(true);
                                        setStatusMessage(null);
                                    }}
                                    icon={<LockOutlined />}
                                    size="large"
                                    style={{
                                        fontWeight: "bold",
                                        height: "40px",
                                        color: THEME.BLUE_AUTHORITY,
                                        borderColor: THEME.BLUE_AUTHORITY,
                                        width: "100%",
                                    }}>
                                    Change Password
                                </Button>
                            </div>
                        ) : (
                            <Form
                                {...FORM_LAYOUT}
                                form={formPassword}
                                onFinish={handleSavePassword}
                                layout="vertical">
                                <Form.Item
                                    label="New Password"
                                    name="newPassword"
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "A new password is required! (Ang bagong password ay kinakailangan!)",
                                        },
                                        {
                                            min: 8,
                                            message:
                                                "Password must be at least 8 characters for security. (Ang password ay dapat hindi bababa sa 8 karakter.)",
                                        },
                                    ]}>
                                    <Input.Password placeholder="Enter New Secure Password" />
                                </Form.Item>

                                <Form.Item
                                    label="Confirm New Password"
                                    name="confirmPassword"
                                    dependencies={["newPassword"]}
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please confirm the new password! (Pakikumpirma ang bagong password!)",
                                        },
                                        ({ getFieldValue }) => ({
                                            validator(_, value) {
                                                if (
                                                    !value ||
                                                    getFieldValue(
                                                        "newPassword"
                                                    ) === value
                                                ) {
                                                    return Promise.resolve();
                                                }
                                                return Promise.reject(
                                                    new Error(
                                                        "The passwords do not match! (Ang mga password ay hindi magkatugma!)"
                                                    )
                                                );
                                            },
                                        }),
                                    ]}>
                                    <Input.Password placeholder="Re-enter New Password" />
                                </Form.Item>

                                <Form.Item
                                    style={{ marginBottom: 0, marginTop: 20 }}>
                                    <Space
                                        direction="vertical"
                                        style={{ width: "100%" }}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={savingPassword}
                                            icon={<SafetyOutlined />}
                                            size="large"
                                            style={{
                                                backgroundColor:
                                                    THEME.BLUE_PRIMARY_BUTTON,
                                                borderColor:
                                                    THEME.BLUE_PRIMARY_BUTTON,
                                                fontWeight: "bold",
                                                width: "100%",
                                            }}>
                                            {savingPassword
                                                ? "Securing Password..."
                                                : "Save New Password"}
                                        </Button>
                                        <Button
                                            type="default"
                                            onClick={() => {
                                                setIsChangingPassword(false);
                                                formPassword.resetFields();
                                                setStatusMessage(null);
                                            }}
                                            style={{ width: "100%" }}>
                                            Cancel Change
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Form>
                        )}
                    </Card>
                </Col>

                {/* 3. Subscription Management Section */}
                <Col xs={24} lg={8}>
                    <Card
                        title={
                            <Title
                                level={3}
                                style={{
                                    margin: 0,
                                    color: THEME.BLUE_AUTHORITY,
                                }}>
                                <BellOutlined style={{ marginRight: 8 }} />
                                Barangay Announcements
                            </Title>
                        }
                        bordered={false}
                        style={{
                            height: "100%",
                            boxShadow: THEME.CARD_SHADOW,
                            borderTop: `5px solid ${
                                isSubscribed
                                    ? THEME.GREEN_SUCCESS
                                    : THEME.RED_ERROR
                            }`,
                        }}>
                        <Alert
                            message={
                                isSubscribed
                                    ? "Subscription Active"
                                    : "Subscription Inactive"
                            }
                            description={
                                isSubscribed
                                    ? "You are currently subscribed to receive important updates and announcements from your Barangay. (Nakakatanggap kayo ng mahahalagang balita at anunsyo.)"
                                    : "You are currently NOT subscribed to receive Barangay updates. Click below to subscribe. (Hindi kayo nakakatanggap ng mga anunsyo.)"
                            }
                            type={isSubscribed ? "success" : "error"}
                            showIcon
                            motion={false}
                            style={{ marginBottom: "25px" }}
                        />

                        <Button
                            type={isSubscribed ? "default" : "primary"}
                            onClick={handleToggleSubscription}
                            loading={savingSubscription}
                            icon={<BellOutlined />}
                            size="large"
                            danger={isSubscribed}
                            style={{
                                width: "100%",
                                fontWeight: "bold",
                                ...(isSubscribed
                                    ? {
                                          color: THEME.RED_ERROR,
                                          borderColor: THEME.RED_ERROR,
                                      }
                                    : {
                                          backgroundColor: THEME.GREEN_SUCCESS,
                                          borderColor: THEME.GREEN_SUCCESS,
                                      }),
                            }}>
                            {savingSubscription
                                ? "Updating..."
                                : isSubscribed
                                ? "Unsubscribe"
                                : "Subscribe"}
                        </Button>
                    </Card>
                </Col>
            </Row>
        </Content>
    );
};

export default ProfilePage;
