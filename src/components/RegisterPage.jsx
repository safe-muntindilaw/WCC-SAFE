import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/globals";
import {
    Card,
    Typography,
    Input,
    Button,
    Select,
    Space,
    Row,
    Col,
    Checkbox,
    Modal,
    Tooltip,
} from "antd";
import { FloatLabel } from "@/utils/FloatLabel";
import {
    UserOutlined,
    MailOutlined,
    LockOutlined,
    PhoneOutlined,
    HomeOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { THEME, cardStyleAdaptive } from "@/utils/theme";
import { capitalizeWords, cleanName } from "@/utils/validation";
import {
    showSuccessNotification,
    showErrorNotification,
    showValidationErrors,
} from "@/utils/notifications";
import {
    useResponsive,
    useResponsiveStyles,
    useResponsivePadding,
} from "@/utils/useResponsive";
import {
    useEmailValidation,
    useContactValidation,
    usePasswordValidation,
} from "@/utils/useFormValidation";
import {
    PasswordRequirements,
    PasswordStrengthIndicator,
    InlineValidationText,
} from "@/utils/ValidationCard";

const { Title, Text, Link } = Typography;
const { Option } = Select;
const INPUT_HEIGHT = { mobile: 32, desktop: 40 };

const TERMS_TEXT = `By clicking "I agree" and registering for the SAFE MUNTINDILAW Resident Portal (the "Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, you may not register or use the Service.

1. Eligibility and Registration
  • The Service is strictly available only to bona fide and registered residents of Barangay Muntindilaw, Antipolo City.
  • You represent and warrant that all information provided during registration is true, accurate, and complete.

2. Purpose of the Service
The SAFE MUNTINDILAW Resident Portal is provided for:
  • Facilitating official communication and advisories from the Barangay.
  • Enabling efficient response during emergencies and disasters.
  • Maintaining a secure, verified directory of residents for local governance and planning.

3. Data Privacy and Use
  • You explicitly consent to the collection, processing, and storage of your personal data by the Barangay office.
  • The Barangay commits to taking reasonable measures to protect your personal data.
  • Your personal data will not be sold, rented, or disclosed to third parties for marketing purposes.

4. User Responsibilities
  • You are responsible for maintaining the confidentiality of your account password.
  • You agree to notify the Barangay immediately of any unauthorized use of your account.

5. Termination
The Barangay reserves the right to suspend or terminate your account without prior notice if you breach these Terms.

6. Governing Law
These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines.`;

const RegisterPage = ({ onSuccess }) => {
    const navigate = useNavigate();

    const { isMobile } = useResponsive();
    const responsivePadding = useResponsivePadding();
    const { fontSize } = useResponsiveStyles();

    const inputHeight = isMobile ? INPUT_HEIGHT.mobile : INPUT_HEIGHT.desktop;

    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        contactNumber: "",
        place: "",
    });

    // Use shared validation hooks
    const emailValidation = useEmailValidation(formData.email, false, "");
    const contactValidation = useContactValidation(
        formData.contactNumber,
        false,
        null,
    );
    const passwordValidation = usePasswordValidation(
        formData.password,
        formData.confirmPassword,
    );

    // Fetch Places on Mount
    useEffect(() => {
        const fetchPlaces = async () => {
            const { data, error } = await supabase
                .from("places")
                .select("*")
                .order("name");
            if (!error) setPlaces(data);
        };
        fetchPlaces();
    }, []);

    // Form validation
    const isFormValid = useMemo(() => {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            contactNumber,
            place,
        } = formData;

        return (
            firstName.trim() &&
            lastName.trim() &&
            emailValidation.isValid === true &&
            contactNumber.length === 10 &&
            contactValidation.isValid === true &&
            password &&
            passwordValidation.isValid &&
            passwordValidation.passwordsMatch &&
            place &&
            agreedToTerms
        );
    }, [
        formData,
        emailValidation,
        contactValidation,
        passwordValidation,
        agreedToTerms,
    ]);

    // Handlers
    const handleChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        if (name === "firstName" || name === "lastName") {
            formattedValue = capitalizeWords(value);
        } else if (name === "contactNumber") {
            const digits = value.replace(/\D/g, "");
            if (digits.length > 0 && digits[0] !== "9") return;
            formattedValue = digits.slice(0, 10);
        }

        setFormData((prev) => ({ ...prev, [name]: formattedValue }));
    };

    const handleRegister = async () => {
        setLoading(true);
        const { firstName, lastName, email, password, contactNumber, place } =
            formData;

        try {
            const fullNumber = `+63${contactNumber}`;
            const cleanedFirstName = capitalizeWords(cleanName(firstName));
            const cleanedLastName = capitalizeWords(cleanName(lastName));
            const displayName = `${cleanedFirstName} ${cleanedLastName}`;

            // 1. Auth Signup
            const { data: authData, error: authError } =
                await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            role: "Resident",
                            display_name: displayName,
                        },
                    },
                });

            if (authError) throw authError;

            // 2. Database Insert
            const { error: dbError } = await supabase.from("contacts").insert([
                {
                    user_id: authData.user.id,
                    first_name: cleanedFirstName,
                    last_name: cleanedLastName,
                    email,
                    contact_number: fullNumber,
                    place_id: place,
                    role: "Resident",
                    password_changed: true,
                },
            ]);

            if (dbError) throw dbError;

            showSuccessNotification({
                message: "Registration Successful!",
                description:
                    "Please check your email for verification before logging in.",
            });

            if (onSuccess) onSuccess();
            navigate("/login");
        } catch (err) {
            showErrorNotification({
                message: "Registration Failed",
                description:
                    err.message ||
                    "An error occurred during registration. Please try again.",
            });
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
                minHeight: "100dvh",
                backgroundColor: THEME.BACKGROUND_LIGHT,
                padding: responsivePadding,
            }}>
            <Card
                style={{
                    ...cardStyleAdaptive,
                    maxWidth: 450,
                    width: "100%",
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
                        Resident Registration
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
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <FloatLabel
                                label="First Name"
                                value={formData.firstName}>
                                <Input
                                    prefix={<UserOutlined />}
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>
                        </Col>
                        <Col xs={24} sm={12}>
                            <FloatLabel
                                label="Last Name"
                                value={formData.lastName}>
                                <Input
                                    prefix={<UserOutlined />}
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>
                        </Col>
                    </Row>

                    <div>
                        <FloatLabel
                            label="Email Address (Gmail only)"
                            value={formData.email}
                            status={
                                (
                                    formData.email &&
                                    emailValidation.touched &&
                                    !emailValidation.isValid &&
                                    !emailValidation.checking
                                ) ?
                                    "error"
                                : (
                                    formData.email &&
                                    emailValidation.touched &&
                                    emailValidation.isValid
                                ) ?
                                    "success"
                                :   undefined
                            }>
                            <Input
                                type="email"
                                prefix={<MailOutlined />}
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                style={{ height: inputHeight }}
                            />
                        </FloatLabel>
                        <InlineValidationText
                            isValid={emailValidation.isValid}
                            checking={emailValidation.checking}
                            touched={emailValidation.touched}
                            validText="Email is available"
                            invalidText={
                                emailValidation.exists ?
                                    "Email already taken"
                                :   "Invalid email format"
                            }
                        />
                    </div>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <div>
                                <FloatLabel
                                    label="Contact Number"
                                    value={formData.contactNumber}
                                    status={
                                        (
                                            formData.contactNumber &&
                                            contactValidation.touched &&
                                            !contactValidation.isValid &&
                                            !contactValidation.checking
                                        ) ?
                                            "error"
                                        : (
                                            formData.contactNumber &&
                                            contactValidation.touched &&
                                            contactValidation.isValid
                                        ) ?
                                            "success"
                                        :   undefined
                                    }>
                                    <Input
                                        prefix={
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                }}>
                                                <PhoneOutlined />
                                                <span
                                                    style={{
                                                        userSelect: "none",
                                                    }}>
                                                    +63
                                                </span>
                                            </div>
                                        }
                                        suffix={
                                            <Tooltip title="Must be 10 digits (e.g., 9123456789)">
                                                <InfoCircleOutlined
                                                    style={{
                                                        color: "rgba(0,0,0,.45)",
                                                        cursor: "help",
                                                    }}
                                                />
                                            </Tooltip>
                                        }
                                        name="contactNumber"
                                        value={formData.contactNumber}
                                        onChange={handleChange}
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
                                            "Number already taken"
                                        :   "Invalid contact number"
                                    }
                                />
                            </div>
                        </Col>
                        <Col xs={24} sm={12}>
                            <FloatLabel label="Area" value={formData.place}>
                                {formData.place && (
                                    <HomeOutlined
                                        className="select-prefix-icon"
                                        style={{
                                            position: "absolute",
                                            left: "12px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            zIndex: 2,
                                        }}
                                    />
                                )}
                                <Select
                                    style={{
                                        width: "100%",
                                        height: inputHeight,
                                    }}
                                    value={formData.place || undefined}
                                    onChange={(val) =>
                                        setFormData((p) => ({
                                            ...p,
                                            place: val,
                                        }))
                                    }>
                                    {places.map((p) => (
                                        <Option key={p.id} value={p.id}>
                                            {p.name}
                                        </Option>
                                    ))}
                                </Select>
                            </FloatLabel>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <FloatLabel
                                label="Password"
                                value={formData.password}>
                                <Input.Password
                                    prefix={<LockOutlined />}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>
                        </Col>
                        <Col xs={24} sm={12}>
                            <div>
                                <FloatLabel
                                    label="Confirm Password"
                                    value={formData.confirmPassword}
                                    status={
                                        (
                                            formData.confirmPassword &&
                                            !passwordValidation.passwordsMatch
                                        ) ?
                                            "error"
                                        : (
                                            formData.confirmPassword &&
                                            passwordValidation.passwordsMatch
                                        ) ?
                                            "success"
                                        :   undefined
                                    }>
                                    <Input.Password
                                        prefix={<LockOutlined />}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        style={{ height: inputHeight }}
                                    />
                                </FloatLabel>
                                {formData.confirmPassword && (
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
                        </Col>
                    </Row>

                    {formData.password && (
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

                    <Button
                        type="primary"
                        block
                        size="large"
                        loading={loading}
                        disabled={!isFormValid || loading}
                        onClick={handleRegister}
                        style={{ height: inputHeight, fontWeight: 600 }}>
                        CREATE ACCOUNT
                    </Button>

                    <Space
                        direction="vertical"
                        size={4}
                        style={{ width: "100%", textAlign: "center", gap: 0 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "8px",
                            }}>
                            <Checkbox
                                checked={agreedToTerms}
                                onChange={(e) =>
                                    setAgreedToTerms(e.target.checked)
                                }
                            />
                            <Text type="secondary" style={{ fontSize: "14px" }}>
                                I agree to the{" "}
                                <Link
                                    type="primary"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsModalVisible(true);
                                    }}>
                                    Terms & Conditions
                                </Link>
                            </Text>
                        </div>

                        <div>
                            <Text type="secondary">
                                Already have an account?{" "}
                            </Text>
                            <Link onClick={() => navigate("/login")}>
                                Login here
                            </Link>
                        </div>
                    </Space>
                </Space>
            </Card>

            <Modal
                title={<Title level={4}>Terms and Conditions</Title>}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                centered
                footer={[
                    <Button
                        key="close"
                        onClick={() => setIsModalVisible(false)}>
                        Close
                    </Button>,
                    <Button
                        key="agree"
                        type="primary"
                        onClick={() => {
                            setAgreedToTerms(true);
                            setIsModalVisible(false);
                        }}>
                        I Agree
                    </Button>,
                ]}
                width={700}>
                <div
                    style={{
                        maxHeight: "71dvh",
                        overflowY: "auto",
                        padding: 10,
                    }}>
                    <pre
                        style={{
                            whiteSpace: "pre-wrap",
                            fontFamily: "inherit",
                            fontSize: "0.9em",
                        }}>
                        {TERMS_TEXT}
                    </pre>
                </div>
            </Modal>
        </div>
    );
};

export default RegisterPage;
