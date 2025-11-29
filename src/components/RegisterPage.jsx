// RegisterPage.jsx (Themed for Government Look)
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
} from "@ant-design/icons";

// Destructure AntD components
const { Title, Text, Link } = Typography;
const { Option } = Select;

// --- 1. THEME COLORS ---
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

// --- 2. PROFESSIONAL TERMS AND CONDITIONS TEXT (Full Text) ---
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
// -------------------------------------------------------------

const RegisterPage = ({ onSuccess }) => {
    const navigate = useNavigate();
    const [places, setPlaces] = useState([]);
    const [formData, setFormData] = useState(initialFormData);
    const [status, setStatus] = useState({ message: null, isError: false });
    const [loading, setLoading] = useState(false);
    // emailValid: true=available, false=taken/invalid, null=not yet checked/empty
    const [emailValid, setEmailValid] = useState(null);
    const [contactValid, setContactValid] = useState(null);
    // State for '9' prefix validation error message
    const [contactPrefixError, setContactPrefixError] = useState(null);
    // State to distinguish between invalid format and taken email
    const [emailFormatInvalid, setEmailFormatInvalid] = useState(false);

    // State for Terms and Conditions agreement and Modal visibility
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Derived state for password matching
    const passwordsMatch = formData.password === formData.confirmPassword;

    // --- Modal Handlers ---
    const showModal = () => {
        setIsModalVisible(true);
    };

    const handleOk = () => {
        setIsModalVisible(false);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };
    // ----------------------

    // --- Effect: Load Places ---
    useEffect(() => {
        const fetchPlaces = async () => {
            const { data } = await supabase.from("places").select("id, name");
            if (data) setPlaces(data);
        };
        fetchPlaces();
    }, []);

    // --- Validation Logic (UPDATED: Stricter email regex and feedback) ---
    const checkEmail = useCallback(async (email) => {
        // Standard email regex (more restrictive than the previous one)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        if (!email) {
            setEmailValid(null); // Empty field
            setEmailFormatInvalid(false);
            return;
        }

        // 1. Check for valid format
        if (!emailRegex.test(email)) {
            setEmailFormatInvalid(true);
            setEmailValid(false); // Treat as invalid until format is fixed
            return;
        }

        setEmailFormatInvalid(false); // Format is valid, proceed to check uniqueness

        // 2. Check for uniqueness in DB
        const { data } = await supabase
            .from("contacts")
            .select("email")
            .eq("email", email)
            .maybeSingle();

        // If data exists, it's taken (false). If data is null, it's available (true).
        setEmailValid(!data);
    }, []);

    const checkContact = useCallback(async (contact) => {
        const cleanedNumber = contact.replace(/\D/g, "");
        setContactPrefixError(null);

        // 1. Check for 10-digit length
        if (cleanedNumber.length !== 10) {
            setContactPrefixError(null);
            return setContactValid(null);
        }

        // 2. Check if the number starts with '9'
        if (cleanedNumber.charAt(0) !== "9") {
            setContactPrefixError("Ang contact number ay dapat magsimula sa 9");
            return setContactValid(false);
        }

        // 3. Check for uniqueness in DB
        const fullNumber = `+63${cleanedNumber}`;
        const { data } = await supabase
            .from("contacts")
            .select("contact_number")
            .eq("contact_number", fullNumber)
            .maybeSingle();

        setContactPrefixError(null);
        setContactValid(!data);
    }, []);
    // --------------------------------------------------------------------------

    // --- Handler: Form Input Change ---
    const handleChange = (e) => {
        let { name, value } = e.target;
        setStatus({ message: null, isError: false });

        if (name === "firstName" || name === "lastName") {
            // Restriction: First letter capital, rest lowercase
            if (value.length > 0) {
                // Allows only alphabetical characters and spaces for names
                const cleanedValue = value.replace(/[^a-zA-Z\s]/g, "");
                // Apply Title Case formatting
                value =
                    cleanedValue.charAt(0).toUpperCase() +
                    cleanedValue.slice(1).toLowerCase();
            }
        } else if (name === "contactNumber") {
            // Restriction: Only digits (for number type)
            const numericValue = value.replace(/\D/g, "");
            value = numericValue;
            checkContact(value);
        } else if (name === "email") {
            checkEmail(value);
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // --- Handler: Select Change (for place) (unchanged) ---
    const handleSelectChange = (value) => {
        setFormData((prev) => ({ ...prev, place: value }));
        setStatus({ message: null, isError: false });
    };

    // --- Handler: Terms Checkbox Change ---
    const handleTermsChange = (e) => {
        setAgreedToTerms(e.target.checked);
        setStatus({ message: null, isError: false });
    };
    // ------------------------------------

    // --- Handler: Registration Submission ---
    const handleRegister = async () => {
        setLoading(true);
        setStatus({ message: null, isError: false });

        const { firstName, lastName, email, password, contactNumber, place } =
            formData;

        // --- Pre-submission Validation Checks ---
        if (password.length < 8 || password.length > 32) {
            setLoading(false);
            return setStatus({
                message: "Password must be between 8 and 32 characters long.",
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

        // CHECK EMAIL VALIDATION
        if (emailFormatInvalid) {
            // Check for format error first
            setLoading(false);
            return setStatus({
                message:
                    "Please enter a valid email format (e.g., user@domain.com).",
                isError: true,
            });
        }
        if (emailValid === false || emailValid === null) {
            // Then check for uniqueness/missing
            setLoading(false);
            return setStatus({
                message: "Please enter a valid and available email.",
                isError: true,
            });
        }
        // End Email Check

        // Use the cleaned number for validation/check
        const cleanedContact = contactNumber.replace(/\D/g, "");

        if (
            cleanedContact.length !== 10 ||
            cleanedContact.charAt(0) !== "9" ||
            contactValid === false
        ) {
            setLoading(false);
            return setStatus({
                message:
                    "Please enter a valid, 10-digit contact number starting with '9'.",
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
        // Check for Terms and Conditions agreement
        if (!agreedToTerms) {
            setLoading(false);
            return setStatus({
                message:
                    "You must agree to the Terms and Conditions to register.",
                isError: true,
            });
        }
        // --- End Validation Checks ---

        // Clean the number one last time for storage
        const fullNumber = `+63${cleanedContact}`;
        const placeIdToSave = place || null;

        // Ensure name format is enforced at the point of saving
        const formattedFirstName =
            firstName.charAt(0).toUpperCase() +
            firstName.slice(1).toLowerCase();
        const formattedLastName =
            lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();

        try {
            // 1. Register user with Supabase Auth
            const { data: authData, error: authError } =
                await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { role: "Resident" } },
                });

            if (authError) throw authError;

            // 2. Save detailed contact info to 'contacts' table
            const { error: dbError } = await supabase.from("contacts").insert([
                {
                    user_id: authData.user.id,
                    first_name: formattedFirstName, // Use formatted name
                    last_name: formattedLastName, // Use formatted name
                    email,
                    contact_number: fullNumber,
                    place_id: placeIdToSave,
                    role: "Resident",
                },
            ]);

            if (dbError) throw dbError;

            // 3. Success
            setStatus({
                message:
                    "Registration successful! Check your email for a confirmation link.",
                isError: false,
            });
            onSuccess?.();
            // setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            setStatus({
                message: `❌ Registration failed: ${err.message}`,
                isError: true,
            });
        } finally {
            setLoading(false);
        }
    };

    // --- Component Rendering ---
    const cleanedContactNumber = formData.contactNumber.replace(/\D/g, "");
    const isFormValid =
        formData.firstName &&
        formData.lastName &&
        formData.email &&
        formData.password &&
        formData.confirmPassword &&
        cleanedContactNumber.length === 10 &&
        cleanedContactNumber.charAt(0) === "9" &&
        formData.place &&
        passwordsMatch &&
        formData.password.length >= 8 &&
        formData.password.length <= 32 &&
        emailValid === true && // Must be valid and available
        contactValid === true &&
        agreedToTerms; // Must be true

    // --- Password Validation Status/Help Logic ---
    const getPasswordStatus = (password) => {
        if (password.length === 0) return { status: "", help: null };

        if (password.length < 8) {
            return {
                status: "error",
                help: "Password must be at least 8 characters long.(Ang password ay dapat hindi bababa sa 8 karakter)",
            };
        }
        if (password.length > 32) {
            return {
                status: "error",
                help: "Password cannot be more than 32 characters long.",
            };
        }

        // If password meets length requirements, check against confirm password for immediate warning
        if (
            formData.confirmPassword.length > 0 &&
            password !== formData.confirmPassword
        ) {
            return { status: "warning", help: "Passwords do not match." };
        }

        return { status: "success", help: "" };
    };

    const getConfirmPasswordStatus = (password, confirmPassword) => {
        if (confirmPassword.length === 0) return { status: "", help: null };

        // Check minimum length (8)
        if (confirmPassword.length < 8) {
            return {
                status: "error",
                help: "Password must be at least 8 characters long.(Ang password ay dapat hindi bababa sa 8 karakter)",
            };
        }
        // Check match
        if (password === confirmPassword) {
            return { status: "success", help: "Passwords match." };
        } else {
            return { status: "error", help: "Passwords do not match." };
        }
    };

    const passwordStatus = getPasswordStatus(formData.password);
    const confirmPasswordStatus = getConfirmPasswordStatus(
        formData.password,
        formData.confirmPassword
    );
    // ----------------------------------------------

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
                        Resident Registration Portal
                    </Text>
                </div>

                {/* Status Message using AntD Alert */}
                {status.message && (
                    <Alert
                        message={status.message}
                        type={status.isError ? "error" : "success"}
                        showIcon
                        style={{ marginBottom: 20 }}
                        closable
                    />
                )}

                <Form layout="vertical" onFinish={handleRegister}>
                    {/* Input Fields */}
                    <Row gutter={16}>
                        {/* First Name / Last Name */}
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
                    {/* Email */}
                    <Form.Item
                        label={<Text strong>Email Address</Text>}
                        required
                        validateStatus={
                            formData.email.length === 0
                                ? ""
                                : emailFormatInvalid
                                ? "error" // Show error if format is invalid
                                : emailValid === true
                                ? "success"
                                : emailValid === false
                                ? "error"
                                : "validating"
                        }
                        help={
                            formData.email.length > 0
                                ? emailFormatInvalid
                                    ? "Invalid email format (must include '@')"
                                    : emailValid === true
                                    ? "Available"
                                    : emailValid === false
                                    ? "Taken or invalid format (Nagamit na o di-wastong pormat"
                                    : null
                                : null
                        }
                    >
                        <Input
                            placeholder="Enter your registered email"
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
                    {/* Contact Number / Place */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Contact Number</Text>}
                                required
                                validateStatus={
                                    cleanedContactNumber.length === 0
                                        ? ""
                                        : contactPrefixError
                                        ? "error" // Prefix error takes priority
                                        : contactValid === true
                                        ? "success"
                                        : contactValid === false
                                        ? "error"
                                        : "validating"
                                }
                                help={
                                    contactPrefixError || // Display prefix error first
                                    (cleanedContactNumber.length > 0 &&
                                    cleanedContactNumber.charAt(0) === "9" &&
                                    contactValid !== null
                                        ? contactValid
                                            ? "Available"
                                            : "Taken or invalid format"
                                        : cleanedContactNumber.length > 0 &&
                                          cleanedContactNumber.length !== 10
                                        ? ""
                                        : null)
                                }
                            >
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
                                    placeholder="e.g., 9XXXXXXXXX"
                                    name="contactNumber"
                                    value={formData.contactNumber}
                                    onChange={handleChange}
                                    maxLength={10}
                                    type="tel"
                                    suffix={
                                        <PhoneOutlined
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
                    {/* Password / Confirm Password */}
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label={<Text strong>Password</Text>}
                                required
                                // PASSWORD LENGTH RULES (MIN 8, MAX 32)
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
                                // CONFIRM PASSWORD MATCHING
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

                    {/* --- CHECKBOX AND LINK TO MODAL --- */}
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
                    {/* ---------------------------------- */}

                    {/* Register Button */}
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
                        Register Account
                    </Button>

                    {/* Login Link */}
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

            {/* Terms and Conditions Modal */}
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
