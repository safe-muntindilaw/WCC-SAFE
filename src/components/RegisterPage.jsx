import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import {
    Card,
    Typography,
    Input,
    Button,
    Form,
    Select,
    Space,
    Row,
    Col,
    Alert,
    Checkbox,
    Modal,
} from "antd";
import {
    UserAddOutlined,
    MailOutlined,
    LockOutlined,
    PhoneOutlined,
    HomeOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";

const { Title, Text, Link } = Typography;
const { Option } = Select;

const THEME = {
    BLUE_PRIMARY: "#0056a0",
    BACKGROUND_LIGHT: "#f0f2f5",
    CARD_BG: "white",
    BUTTON_HOVER: "#004480",
    CARD_SHADOW: "0 8px 16px rgba(0, 86, 160, 0.2)",
    ACCENT_YELLOW: "#ffc72c",
};

const initialFormData = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    contactNumber: "",
    place: "",
};

const TERMS_AND_CONDITIONS_TEXT = `
TERMS AND CONDITIONS FOR SAFE MUNTINDILAW RESIDENT PORTAL

Effective Date: November 22, 2025

1. Definitions
The terms "Barangay" or "Barangay Office" refer to the governing body of Barangay Muntindilaw, Antipolo City, and its authorized representatives who operate the Service.

2. Acceptance of Terms
By clicking "I agree" and registering for the SAFE MUNTINDILAW Resident Portal (the "Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not register or use the Service.

3. Eligibility and Registration
• Eligibility: The Service is strictly available only to **bona fide and registered residents** of Barangay Muntindilaw, Antipolo City.
• Accuracy of Information: You represent and warrant that all information provided during registration, including your name, email, contact number, and place of residence, is true, accurate, and complete. You acknowledge that providing false or misleading information is grounds for immediate termination of your account and may result in legal action.
• Contact Number: You agree to register a functional mobile contact number which will be verified and used for urgent advisories, emergency contact, and official communications from the Barangay office.

4. Purpose of the Service
The SAFE MUNTINDILAW Resident Portal is provided for the sole purpose of:
• Facilitating official communication and advisories from the Barangay.
• Enabling efficient response during emergencies and disasters.
• Maintaining a secure, verified directory of residents for local governance and planning.

5. Data Privacy and Use (Philippines Data Privacy Act Compliance)
• Consent: You explicitly consent to the collection, processing, and storage of your personal data (name, contact number, address/place, and email) by the Barangay office for the purposes outlined in Section 4.
• Security: The Barangay commits to taking reasonable technical, organizational, and physical measures to protect your personal data against accidental or unlawful destruction, alteration, and unauthorized access.
• Non-Disclosure: Your personal data will not be sold, rented, or disclosed to third parties for marketing purposes. It will only be shared with authorized government agencies or emergency response units when necessary for the execution of public functions or in emergency situations.
• Data Retention: Personal data collected shall be retained for the duration of the residency and/or as required by relevant government regulations.

6. User Responsibilities
• Account Security: You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account. You agree to notify the Barangay immediately of any unauthorized use of your password or account.
• Prohibited Conduct: You agree not to use the Service for any unlawful purpose, including but not limited to harassment, distribution of spam, or posting unauthorized content.

7. Termination
The Barangay reserves the right to suspend or terminate your account and access to the Service, without prior notice, if you breach these Terms, including but not limited to the provision of false registration information, or upon request due to change in residency status.

8. Limitation of Liability
The Service is provided "as is." The Barangay and its officials will not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the Service.

9. Governing Law and Dispute Resolution
These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines. Any dispute arising from these Terms shall be exclusively submitted to the appropriate courts in Antipolo City.
`;

const RegisterPage = ({ onSuccess }) => {
    const navigate = useNavigate();
    const [places, setPlaces] = useState([]);
    const [formData, setFormData] = useState(initialFormData);
    const [status, setStatus] = useState({ message: null, isError: false });
    const [loading, setLoading] = useState(false);
    const [emailValid, setEmailValid] = useState(null);
    const [contactValid, setContactValid] = useState(null);
    const [contactPrefixError, setContactPrefixError] = useState(null);
    const [emailFormatInvalid, setEmailFormatInvalid] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Alphanumeric Password Validation
    const validatePassword = (password) => {
        return {
            length: password.length >= 8 && password.length <= 32,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            hasLetter: /[a-zA-Z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            specialCharacters: /[^a-zA-Z0-9]/.test(password),
        };
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

    const passwordChecks = validatePassword(formData.password);
    const isPasswordValid = Object.values(passwordChecks).every(
        (check) => check
    );
    const passwordsMatch = formData.password === formData.confirmPassword;

    const showModal = () => setIsModalVisible(true);
    const handleOk = () => setIsModalVisible(false);
    const handleCancel = () => setIsModalVisible(false);

    useEffect(() => {
        const fetchPlaces = async () => {
            const { data } = await supabase.from("places").select("id, name");
            if (data) setPlaces(data);
        };
        fetchPlaces();
    }, []);

    // Email Validation
    const checkEmail = useCallback(async (email) => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;

        if (!email) {
            setEmailValid(null);
            setEmailFormatInvalid(false);
            return;
        }

        if (!emailRegex.test(email)) {
            setEmailFormatInvalid(true);
            setEmailValid(false);
            return;
        }

        setEmailFormatInvalid(false);

        const { data } = await supabase
            .from("contacts")
            .select("email")
            .eq("email", email)
            .maybeSingle();

        setEmailValid(!data);
    }, []);

    // Phone Number Validation with Pattern Detection
    const checkContact = useCallback(async (contact) => {
        const cleanedNumber = contact.replace(/\D/g, "");
        setContactPrefixError(null);

        if (cleanedNumber.length !== 9) {
            setContactPrefixError(null);
            return setContactValid(null);
        }

        // Prepend '9' to create full 10-digit number for pattern checking
        const fullTenDigit = "9" + cleanedNumber;

        // Check for suspicious patterns on the full number
        const patternError = detectSuspiciousPattern(fullTenDigit);
        if (patternError) {
            setContactPrefixError(patternError);
            return setContactValid(false);
        }

        const fullNumber = `+63${fullTenDigit}`;
        const { data } = await supabase
            .from("contacts")
            .select("contact_number")
            .eq("contact_number", fullNumber)
            .maybeSingle();

        setContactPrefixError(null);
        setContactValid(!data);
    }, []);

    const handleChange = (e) => {
        let { name, value } = e.target;
        setStatus({ message: null, isError: false });

        if (name === "firstName" || name === "lastName") {
            // Remove only unwanted characters if necessary, but preserve parentheses
            // For now, just capitalize properly without stripping characters
            const words = value.split(" ").map((word) => {
                if (word.length === 0) return word;
                return word.charAt(0).toUpperCase() + word.slice(1);
            });
            value = words.join(" ");
        } else if (name === "contactNumber") {
            const numericValue = value.replace(/\D/g, "");
            value = numericValue;
            checkContact(value);
        } else if (name === "email") {
            checkEmail(value);
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value) => {
        setFormData((prev) => ({ ...prev, place: value }));
        setStatus({ message: null, isError: false });
    };

    const handleTermsChange = (e) => {
        setAgreedToTerms(e.target.checked);
        setStatus({ message: null, isError: false });
    };

    const handleRegister = async () => {
        setLoading(true);
        setStatus({ message: null, isError: false });

        const { firstName, lastName, email, password, contactNumber, place } =
            formData;
        const displayName = `${firstName} ${lastName}`;

        // Password Validation
        if (!isPasswordValid) {
            setLoading(false);
            return setStatus({
                message:
                    "Password must meet all security requirements (8-32 characters, uppercase, lowercase, number, alphanumeric with special character).",
                isError: true,
            });
        }

        if (!passwordsMatch) {
            setLoading(false);
            return setStatus({
                message: "Passwords do not match.",
                isError: true,
            });
        }

        if (emailFormatInvalid) {
            setLoading(false);
            return setStatus({
                message:
                    "Please enter a valid email address (e.g., user@gmail.com).",
                isError: true,
            });
        }

        if (emailValid === false || emailValid === null) {
            setLoading(false);
            return setStatus({
                message: "Please enter a valid and available email address.",
                isError: true,
            });
        }

        const cleanedContact = contactNumber.replace(/\D/g, "");

        // Enhanced contact validation with pattern check
        if (cleanedContact.length !== 9) {
            setLoading(false);
            return setStatus({
                message: "Please enter a valid, 9-digit contact number.",
                isError: true,
            });
        }

        // Prepend '9' to create full 10-digit number for pattern checking
        const fullTenDigit = "9" + cleanedContact;
        const patternError = detectSuspiciousPattern(fullTenDigit);
        if (patternError) {
            setLoading(false);
            return setStatus({
                message: patternError,
                isError: true,
            });
        }

        if (contactValid === false) {
            setLoading(false);
            return setStatus({
                message: "This contact number is already taken or invalid.",
                isError: true,
            });
        }

        if (!place) {
            setLoading(false);
            return setStatus({
                message: "Please select your place of residence.",
                isError: true,
            });
        }

        if (!agreedToTerms) {
            setLoading(false);
            return setStatus({
                message:
                    "You must agree to the Terms and Conditions to register.",
                isError: true,
            });
        }

        const fullNumber = `+639${cleanedContact}`;
        const placeIdToSave = place || null;
        const formattedFirstName =
            firstName.charAt(0).toUpperCase() +
            firstName.slice(1).toLowerCase();
        const formattedLastName =
            lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

        try {
            const { data: authData, error: authError } =
                await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { role: "Resident", display_name: displayName },
                    },
                    display_name: displayName,
                });

            if (authError) throw authError;

            const { error: dbError } = await supabase.from("contacts").insert([
                {
                    user_id: authData.user.id,
                    first_name: formattedFirstName,
                    last_name: formattedLastName,
                    email,
                    contact_number: fullNumber,
                    place_id: placeIdToSave,
                    role: "Resident",
                },
            ]);

            if (dbError) throw dbError;

            setStatus({
                message:
                    "Registration successful! Check your email for a confirmation link.",
                isError: false,
            });
            onSuccess?.();
        } catch (err) {
            setStatus({
                message: `Registration failed: ${err.message}`,
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const cleanedContactNumber = formData.contactNumber.replace(/\D/g, "");
    const isFormValid =
        formData.firstName &&
        formData.lastName &&
        formData.email &&
        formData.password &&
        formData.confirmPassword &&
        cleanedContactNumber.length === 9 &&
        formData.place &&
        passwordsMatch &&
        isPasswordValid &&
        emailValid === true &&
        contactValid === true &&
        agreedToTerms;

    const getPasswordStatus = () => {
        if (formData.password.length === 0) return { status: "", help: null };

        if (!isPasswordValid) {
            return {
                status: "error",
                help: "Password must meet all requirements",
            };
        }

        if (
            formData.confirmPassword.length > 0 &&
            formData.password !== formData.confirmPassword
        ) {
            return { status: "warning", help: "Passwords do not match." };
        }

        return { status: "success", help: "" };
    };

    const getConfirmPasswordStatus = () => {
        if (formData.confirmPassword.length === 0)
            return { status: "", help: null };

        if (!isPasswordValid) {
            return {
                status: "error",
                help: "Password must meet requirements first",
            };
        }

        if (formData.password === formData.confirmPassword) {
            return { status: "success", help: "Passwords match." };
        } else {
            return { status: "error", help: "Passwords do not match." };
        }
    };

    const passwordStatus = getPasswordStatus();
    const confirmPasswordStatus = getConfirmPasswordStatus();

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
                    maxWidth: 500,
                    width: "100%",
                    boxShadow: THEME.CARD_SHADOW,
                    borderRadius: 12,
                    borderTop: `5px solid ${THEME.BLUE_PRIMARY}`,
                    paddingTop: 10,
                    marginTop: 10,
                    marginBottom: 10,
                }}
            >
                <div style={{ textAlign: "center", marginBottom: 16 }}>
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
                        style={{ color: THEME.BLUE_PRIMARY, fontSize: "13px" }}
                    >
                        Resident Registration Portal
                    </Text>
                </div>

                {status.message && (
                    <Alert
                        message={status.message}
                        type={status.isError ? "error" : "success"}
                        showIcon
                        style={{ marginBottom: 16 }}
                        closable
                    />
                )}

                <Form layout="vertical" onFinish={handleRegister}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>First Name</Text>}
                                required
                            >
                                <Input
                                    placeholder="Enter first name"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Last Name</Text>}
                                required
                            >
                                <Input
                                    placeholder="Enter last name"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        label={<Text strong>Email Address</Text>}
                        required
                        validateStatus={
                            formData.email.length === 0
                                ? ""
                                : emailFormatInvalid
                                ? "error"
                                : emailValid === true
                                ? "success"
                                : emailValid === false
                                ? "error"
                                : "validating"
                        }
                        help={
                            formData.email.length > 0
                                ? emailFormatInvalid
                                    ? "Email must be a valid email address (e.g., user@gmail.com)"
                                    : emailValid === true
                                    ? "Available"
                                    : emailValid === false
                                    ? "Taken or invalid format"
                                    : null
                                : null
                        }
                    >
                        <Input
                            placeholder="example@gmail.com"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            prefix={
                                <MailOutlined
                                    style={{ color: THEME.BLUE_PRIMARY }}
                                />
                            }
                        />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Contact Number</Text>}
                                required
                                validateStatus={
                                    cleanedContactNumber.length === 0
                                        ? ""
                                        : contactPrefixError
                                        ? "error"
                                        : contactValid === true
                                        ? "success"
                                        : contactValid === false
                                        ? "error"
                                        : "validating"
                                }
                                help={
                                    contactPrefixError ||
                                    (cleanedContactNumber.length > 0 &&
                                    contactValid !== null
                                        ? contactValid
                                            ? "Available"
                                            : "Taken or invalid format"
                                        : null)
                                }
                            >
                                <div style={{ position: "relative" }}>
                                    <Input
                                        prefix={
                                            <Text
                                                strong
                                                style={{
                                                    marginRight: 4,
                                                    color: THEME.BLUE_PRIMARY,
                                                }}
                                            >
                                                +63
                                            </Text>
                                        }
                                        name="contactNumber"
                                        value={
                                            formData.contactNumber
                                                ? "9" + formData.contactNumber
                                                : "9"
                                        }
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            // Remove the leading '9' if present
                                            const withoutNine =
                                                value.startsWith("9")
                                                    ? value.slice(1)
                                                    : value;
                                            handleChange({
                                                target: {
                                                    name: "contactNumber",
                                                    value: withoutNine,
                                                },
                                            });
                                        }}
                                        maxLength={10}
                                        type="tel"
                                        suffix={
                                            <PhoneOutlined
                                                style={{
                                                    color: THEME.BLUE_PRIMARY,
                                                }}
                                            />
                                        }
                                        style={{ position: "relative" }}
                                    />
                                    {formData.contactNumber.length === 0 && (
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: "65px",
                                                top: "50%",
                                                transform: "translateY(-50%)",
                                                color: "#bfbfbf",
                                                pointerEvents: "none",
                                                fontSize: "14px",
                                            }}
                                        >
                                            XXXXXXXXX
                                        </div>
                                    )}
                                </div>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Area</Text>}
                                required
                            >
                                <Select
                                    placeholder="Select your Place"
                                    name="place"
                                    value={formData.place || undefined}
                                    onChange={handleSelectChange}
                                    suffixIcon={
                                        <HomeOutlined
                                            style={{
                                                color: THEME.BLUE_PRIMARY,
                                            }}
                                        />
                                    }
                                >
                                    <Option value="" disabled>
                                        Select Place
                                    </Option>
                                    {places.map((p) => (
                                        <Option key={p.id} value={p.id}>
                                            {p.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Password</Text>}
                                required
                                validateStatus={passwordStatus.status}
                                help={passwordStatus.help}
                            >
                                <Input.Password
                                    placeholder="Enter password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    prefix={
                                        <LockOutlined
                                            style={{
                                                color: THEME.BLUE_PRIMARY,
                                            }}
                                        />
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Confirm Password</Text>}
                                required
                                validateStatus={confirmPasswordStatus.status}
                                help={confirmPasswordStatus.help}
                            >
                                <Input.Password
                                    placeholder="Confirm your password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    prefix={
                                        <LockOutlined
                                            style={{
                                                color: THEME.BLUE_PRIMARY,
                                            }}
                                        />
                                    }
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Password Requirements Display */}
                    {formData.password.length > 0 && (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: 10,
                                backgroundColor: "#f6f8fa",
                                borderRadius: 6,
                                border: "1px solid #e1e4e8",
                            }}
                        >
                            <Text
                                strong
                                style={{
                                    display: "block",
                                    marginBottom: 6,
                                    color: THEME.BLUE_PRIMARY,
                                    fontSize: "12px",
                                }}
                            >
                                Password Requirements:
                            </Text>
                            <Space direction="vertical" size={2}>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: passwordChecks.length
                                            ? "#52c41a"
                                            : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.length ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    8-32 characters
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: passwordChecks.uppercase
                                            ? "#52c41a"
                                            : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.uppercase ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    One uppercase letter (A-Z)
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: passwordChecks.lowercase
                                            ? "#52c41a"
                                            : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.lowercase ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    One lowercase letter (a-z)
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: passwordChecks.number
                                            ? "#52c41a"
                                            : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.number ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    One number (0-9)
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color:
                                            passwordChecks.hasLetter &&
                                            passwordChecks.hasNumber
                                                ? "#52c41a"
                                                : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.hasLetter &&
                                    passwordChecks.hasNumber ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    Alphanumeric
                                </Text>
                                <Text
                                    style={{
                                        fontSize: 11,
                                        color: passwordChecks.specialCharacters
                                            ? "#52c41a"
                                            : "#8c8c8c",
                                    }}
                                >
                                    {passwordChecks.specialCharacters ? (
                                        <CheckCircleOutlined />
                                    ) : (
                                        <CloseCircleOutlined />
                                    )}{" "}
                                    Special character
                                </Text>
                            </Space>
                        </div>
                    )}

                    <Form.Item name="agreement" valuePropName="checked">
                        <Checkbox
                            checked={agreedToTerms}
                            onChange={handleTermsChange}
                            style={{
                                color: THEME.BLUE_PRIMARY,
                                fontWeight: "500",
                            }}
                        >
                            I have read and agree to the
                            <Link
                                onClick={showModal}
                                style={{
                                    color: THEME.BLUE_PRIMARY,
                                    fontWeight: "700",
                                    marginLeft: 4,
                                }}
                            >
                                Terms and Conditions
                            </Link>
                        </Checkbox>
                    </Form.Item>

                    <Button
                        type="primary"
                        htmlType="submit"
                        block
                        icon={<UserAddOutlined />}
                        loading={loading}
                        disabled={!isFormValid || loading}
                        style={{
                            backgroundColor: THEME.BLUE_PRIMARY,
                            borderColor: THEME.BLUE_PRIMARY,
                            height: 44,
                            fontWeight: 600,
                            marginTop: 16,
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
                        Register
                    </Button>

                    <div style={{ marginTop: 20, textAlign: "center" }}>
                        <Text>
                            Already have an account?{" "}
                            <Link onClick={() => navigate("/login")}>
                                Log In
                            </Link>
                        </Text>
                    </div>
                </Form>
            </Card>

            <Modal
                title={
                    <Title level={4} style={{ color: THEME.BLUE_PRIMARY }}>
                        Terms and Conditions
                    </Title>
                }
                open={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
                footer={[
                    <Button key="back" onClick={handleCancel}>
                        Close
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        onClick={() => {
                            setAgreedToTerms(true);
                            handleOk();
                        }}
                        style={{
                            backgroundColor: THEME.BLUE_PRIMARY,
                            borderColor: THEME.BLUE_PRIMARY,
                        }}
                    >
                        I Agree & Close
                    </Button>,
                ]}
                width={700}
            >
                <div
                    style={{
                        maxHeight: "60vh",
                        overflowY: "auto",
                        padding: 10,
                        border: `1px solid ${THEME.BACKGROUND_LIGHT}`,
                        borderRadius: 5,
                    }}
                >
                    <pre
                        style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "inherit",
                            fontSize: "0.9em",
                        }}
                    >
                        {TERMS_AND_CONDITIONS_TEXT}
                    </pre>
                </div>
            </Modal>
        </div>
    );
};

export default RegisterPage;
