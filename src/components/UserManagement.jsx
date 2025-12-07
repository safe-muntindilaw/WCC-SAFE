import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/globals";
import * as XLSX from "xlsx";
import {
    Form,
    Input,
    Select,
    Radio,
    Button,
    Table,
    Checkbox,
    Alert,
    Space,
    Typography,
    Modal,
    Spin,
    Row,
    Col,
} from "antd";
import {
    SwapOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    DeleteOutlined,
} from "@ant-design/icons";

const { Option } = Select;
const { Title } = Typography;

const CONTACT_ROLES = ["Admin", "Official", "Resident"];
const DEFAULT_PASSWORD = "muntindilaw";

const cleanName = (name) => (name || "").trim().replace(/\s{2,}/g, " ");
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

const capitalizeWords = (str) => {
    return (str || "")
        .replace(/\s+/g, " ")
        .split(" ")
        .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
};

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [places, setPlaces] = useState([]);
    const [placeMap, setPlaceMap] = useState({});
    const [currentUserRole, setCurrentUserRole] = useState(null);

    const [originalEmail, setOriginalEmail] = useState("");
    const [formData, setFormData] = useState({
        user_id: null,
        first_name: "",
        last_name: "",
        email: "",
        role: "",
        contact_number: "",
        place_id: "",
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", content: "" });
    const [selectedRole, setSelectedRole] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [batchStatus, setBatchStatus] = useState({
        loading: false,
        message: "",
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedUsers, setSelectedUsers] = useState([]);

    // Real-time validation states
    const [validationErrors, setValidationErrors] = useState([]);

    // Modal visibility states
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [isBatchModalVisible, setIsBatchModalVisible] = useState(false);

    const [searchQuery, setSearchQuery] = useState(""); // search query
    const [placeFilter, setPlaceFilter] = useState(""); // place filter
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: "asc",
    }); // sorting

    const isEditing = !!formData.user_id;

    // Get current user's role
    useEffect(() => {
        const getCurrentUserRole = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                    const { data, error } = await supabase
                        .from("contacts")
                        .select("role")
                        .eq("user_id", user.id)
                        .single();

                    if (!error && data) {
                        setCurrentUserRole(data.role);
                    }
                }
            } catch (error) {
                console.error("Error fetching user role:", error);
            }
        };
        getCurrentUserRole();
    }, []);

    const availableRoles = useMemo(() => {
        if (currentUserRole === "Official") {
            return CONTACT_ROLES.filter((role) => role !== "Admin");
        }
        return CONTACT_ROLES;
    }, [currentUserRole]);

    const fetchData = async () => {
        setLoading(true);
        try {
            let usersQuery = supabase
                .from("contacts")
                .select(
                    "user_id, first_name, last_name, email, role, contact_number, place_id, places(name)"
                )
                .order("created_at", { ascending: false });

            if (currentUserRole === "Official") {
                usersQuery = usersQuery.neq("role", "Admin");
            }

            const [usersResult, placesResult] = await Promise.all([
                usersQuery,
                supabase
                    .from("places")
                    .select("id, name")
                    .order("name", { ascending: true }),
            ]);

            if (usersResult.error) throw usersResult.error;
            if (placesResult.error) throw placesResult.error;

            setUsers(usersResult.data || []);
            setPlaces(placesResult.data || []);

            const map = (placesResult.data || []).reduce((acc, p) => {
                if (p && p.name) acc[p.name.toLowerCase()] = p.id;
                return acc;
            }, {});
            setPlaceMap(map);
        } catch (error) {
            console.error(error);
            setMessage({
                type: "error",
                content: `Failed to fetch data: ${error.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUserRole) {
            fetchData();
        }
    }, [currentUserRole]);

    const validateForm = (data = formData, isBatch = false) => {
        const errors = [];
        const {
            first_name = "",
            last_name = "",
            email = "",
            role = "",
            contact_number = "",
            place_id = "",
        } = data;
        const cleanedFirstName = cleanName(first_name);
        const cleanedLastName = cleanName(last_name);

        if (
            !cleanedFirstName ||
            !cleanedLastName ||
            !email ||
            !role ||
            !place_id ||
            !contact_number
        )
            errors.push("All fields are required.");
        if (!/^[a-zA-Z\s]{2,}$/.test(cleanedFirstName))
            errors.push(
                "First name must contain only letters and spaces (min 2 characters)."
            );
        if (!/^[a-zA-Z\s]{2,}$/.test(cleanedLastName))
            errors.push(
                "Last name must contain only letters and spaces (min 2 characters)."
            );

        // Enhanced email validation - only allow @gmail.com
        if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email))
            errors.push(
                "Please enter a valid Gmail address (e.g., user@gmail.com)."
            );

        if (!availableRoles.includes(role))
            errors.push("Please select a valid role.");

        // Enhanced contact number validation with pattern detection
        if (!/^9\d{9}$/.test(String(contact_number))) {
            errors.push("Contact number must be 10 digits starting with 9.");
        } else {
            // Check for suspicious patterns
            const patternError = detectSuspiciousPattern(
                String(contact_number)
            );
            if (patternError) {
                errors.push(patternError);
            }
        }

        if (currentUserRole === "Official" && role === "Admin") {
            errors.push("You do not have permission to manage Admin users.");
        }

        if (errors.length > 0) {
            if (!isBatch) {
                setMessage({
                    type: "error-validation",
                    content: errors.join("\n"),
                });
                setValidationErrors(errors);
            }
            return errors;
        }

        if (!isBatch) setValidationErrors([]);
        return true;
    };

    // Real-time validation on form data change
    useEffect(() => {
        if (isUserModalVisible) {
            const result = validateForm(formData, false);
            if (result !== true) {
                setValidationErrors(result);
            } else {
                setValidationErrors([]);
            }
        }
    }, [formData, isUserModalVisible, currentUserRole, availableRoles]);

    // Check if form is valid for submission
    const isFormValid = useMemo(() => {
        const { first_name, last_name, email, role, contact_number, place_id } =
            formData;

        // All fields must be filled
        if (
            !first_name ||
            !last_name ||
            !email ||
            !role ||
            !contact_number ||
            !place_id
        ) {
            return false;
        }

        // Must have no validation errors
        return validationErrors.length === 0;
    }, [formData, validationErrors]);

    const resetForm = () => {
        setFormData({
            user_id: null,
            first_name: "",
            last_name: "",
            email: "",
            role: "",
            contact_number: "",
            place_id: "",
        });
        setOriginalEmail("");
        setBatchStatus({ loading: false, message: "" });
        setUploadFile(null);
        setSelectedUsers([]);
        // setValidationErrors([]);
    };

    const callEdgeFunction = async (functionName, body) => {
        const { data, error } = await supabase.functions.invoke(functionName, {
            body,
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        return data;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: "", content: "" });
        setBatchStatus({ loading: false, message: "" });

        const validationResult = validateForm();
        if (validationResult !== true) return;

        setLoading(true);

        try {
            const formattedNumber = `+63${formData.contact_number}`;
            const cleanedFirstName = cleanName(formData.first_name);
            const cleanedLastName = cleanName(formData.last_name);

            if (isEditing) {
                if (formData.email !== originalEmail) {
                    await callEdgeFunction("change-email", {
                        user_id: formData.user_id,
                        new_email: formData.email,
                    });
                }
                const { error } = await supabase
                    .from("contacts")
                    .update({
                        first_name: cleanedFirstName,
                        last_name: cleanedLastName,
                        email: formData.email,
                        role: formData.role,
                        contact_number: formattedNumber,
                        place_id: formData.place_id,
                    })
                    .eq("user_id", formData.user_id);

                if (error) throw error;
                setMessage({
                    type: "success",
                    content: "Contact updated successfully.",
                });
            } else {
                await callEdgeFunction("register-user", {
                    email: formData.email,
                    password: DEFAULT_PASSWORD,
                    first_name: cleanedFirstName,
                    last_name: cleanedLastName,
                    user_role: formData.role,
                    contact_number: formattedNumber,
                    place_id: formData.place_id,
                });
                setMessage({
                    type: "success",
                    content: "Contact created successfully.",
                });
            }

            // resetForm();
            await fetchData();
            setIsUserModalVisible(false);
        } catch (err) {
            setMessage({ type: "error", content: `Failed: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (user) => {
        setMessage({ type: "", content: "" });
        setBatchStatus({ loading: false, message: "" });
        setFormData({
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            contact_number: formatPhoneNumber(user.contact_number),
            place_id: user.place_id,
        });
        setOriginalEmail(user.email);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setIsUserModalVisible(true);
    };

    const handleDelete = async (user_id) => {
        if (!confirm("Delete contact and their user account?")) return;
        setLoading(true);
        setMessage({ type: "info", content: "Deleting..." });

        try {
            await callEdgeFunction("delete-user", { user_id });
            const { error } = await supabase
                .from("contacts")
                .delete()
                .eq("user_id", user_id);
            if (error) throw error;
            setMessage({
                type: "success",
                content: "Contact deleted successfully.",
            });
            await fetchData();
            setSelectedUsers((prev) => prev.filter((id) => id !== user_id));
        } catch (err) {
            setMessage({
                type: "error",
                content: `Deletion failed: ${err.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setUploadFile(e.target.files[0]);
        setBatchStatus({ loading: false, message: "" });
        setMessage({ type: "", content: "" });
    };

    const handleRemoveFile = () => {
        setUploadFile(null);
        setBatchStatus({ loading: false, message: "" });
    };

    const handleFileUpload = async (e) => {
        e.preventDefault();

        if (!uploadFile) {
            setBatchStatus({
                loading: false,
                message: "Please select a file to upload.",
            });
            return;
        }

        setBatchStatus({ loading: true, message: "Processing file..." });
        setMessage({ type: "", content: "" });

        try {
            const data = await uploadFile.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawJsonData = XLSX.utils.sheet_to_json(worksheet);

            const validationResults = rawJsonData.map((row, index) => {
                const contact = {
                    first_name: row["First Name"] || "",
                    last_name: row["Last Name"] || "",
                    email: row["Email"] || "",
                    role: row["Role"] || "",
                    contact_number: formatPhoneNumber(
                        row["Contact Number"] || ""
                    ),
                    place_name: row["Place"] || row["Area"] || "",
                    place_id: "",
                };

                const placeId = placeMap[contact.place_name.toLowerCase()];
                const errors = [];

                if (placeId) contact.place_id = placeId;
                else errors.push(`Area "${contact.place_name}" not found.`);

                if (
                    currentUserRole === "Official" &&
                    contact.role === "Admin"
                ) {
                    errors.push("Officials cannot create Admin users.");
                }

                const validationErrors = validateForm(contact, true);
                if (Array.isArray(validationErrors))
                    errors.push(...validationErrors);

                return { data: contact, row: index + 2, errors };
            });

            const validContacts = validationResults.filter(
                (r) => r.errors.length === 0
            );
            const invalidContacts = validationResults.filter(
                (r) => r.errors.length > 0
            );

            if (invalidContacts.length > 0) {
                const errorSummary = invalidContacts
                    .map(
                        (c) =>
                            `Row ${c.row} (${c.data.email}): ${c.errors.join(
                                ", "
                            )}`
                    )
                    .join("\n");

                setBatchStatus({
                    loading: false,
                    message: `Validation failed for ${invalidContacts.length} contacts.`,
                });
                setMessage({
                    type: "error",
                    content: `Batch Validation Errors:\n${errorSummary}`,
                });
                return;
            }

            if (validContacts.length === 0) {
                setBatchStatus({
                    loading: false,
                    message: "No valid contacts found.",
                });
                return;
            }

            const batchPayload = validContacts.map((c) => ({
                email: c.data.email,
                password: DEFAULT_PASSWORD,
                first_name: cleanName(c.data.first_name),
                last_name: cleanName(c.data.last_name),
                user_role: c.data.role,
                contact_number: `+63${c.data.contact_number}`,
                place_id: c.data.place_id,
            }));

            await callEdgeFunction("register-batch-users", batchPayload);

            setBatchStatus({
                loading: false,
                message: `${validContacts.length} contacts uploaded successfully.`,
            });
            setMessage({
                type: "success",
                content: `Batch upload successful.`,
            });

            resetForm();
            await fetchData();
        } catch (err) {
            console.error(err);
            setBatchStatus({
                loading: false,
                message: `Batch upload failed: ${err.message}`,
            });
            setMessage({
                type: "error",
                content: `Batch upload failed: ${err.message}`,
            });
        } finally {
            setIsBatchModalVisible(false);
        }
    };

    // Filter users based on role, search, place, and sort
    const filteredUsers = useMemo(() => {
        let tempUsers = users;
        if (selectedRole) {
            tempUsers = users.filter((u) => u.role === selectedRole);
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            tempUsers = tempUsers.filter(
                (u) =>
                    u.first_name.toLowerCase().includes(lowerQuery) ||
                    u.last_name.toLowerCase().includes(lowerQuery)
            );
        }
        if (placeFilter) {
            tempUsers = tempUsers.filter((u) => u.places?.name === placeFilter);
        }
        return tempUsers;
    }, [users, selectedRole, searchQuery, placeFilter]);

    // Sorting logic
    const handleSort = (columnKey) => {
        setSortConfig((prev) => {
            if (prev.key === columnKey) {
                // toggle direction
                return {
                    key: columnKey,
                    direction: prev.direction === "asc" ? "desc" : "asc",
                };
            }
            // set new column, default to ascending
            return { key: columnKey, direction: "asc" };
        });
    };

    const sortedUsers = useMemo(() => {
        if (!sortConfig.key) return filteredUsers;

        const sorted = [...filteredUsers].sort((a, b) => {
            let aVal, bVal;
            switch (sortConfig.key) {
                case "name":
                    aVal = a.first_name + a.last_name;
                    bVal = b.first_name + b.last_name;
                    break;
                case "place":
                    aVal = a.places?.name || "";
                    bVal = b.places?.name || "";
                    break;
                case "role":
                    aVal = a.role;
                    bVal = b.role;
                    break;
                default:
                    return 0;
            }
            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredUsers, sortConfig]);

    const totalPages = Math.max(
        1,
        Math.ceil(sortedUsers.length / itemsPerPage)
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedRole, searchQuery, placeFilter, sortConfig]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedUsers.slice(start, start + itemsPerPage);
    }, [sortedUsers, currentPage]);

    const toggleUserSelect = (id) =>
        setSelectedUsers((prev) =>
            prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
        );
    const toggleSelectAll = () => {
        const pageIds = paginatedUsers.map((u) => u.user_id);
        const allSelectedOnPage = pageIds.every((id) =>
            selectedUsers.includes(id)
        );
        if (allSelectedOnPage)
            setSelectedUsers((prev) =>
                prev.filter((id) => !pageIds.includes(id))
            );
        else
            setSelectedUsers((prev) =>
                Array.from(new Set([...prev, ...pageIds]))
            );
    };

    const handleBatchDelete = async () => {
        if (selectedUsers.length === 0) {
            alert("No contacts selected.");
            return;
        }
        if (
            !confirm(
                `Delete ${selectedUsers.length} contacts? This will remove their user accounts.`
            )
        )
            return;
        setLoading(true);
        setMessage({ type: "info", content: "Deleting..." });
        setBatchStatus({ loading: false, message: "" });

        try {
            await callEdgeFunction("delete-batch-users", {
                user_ids: selectedUsers,
            });
            const { error } = await supabase
                .from("contacts")
                .delete()
                .in("user_id", selectedUsers);
            if (error) throw error;
            setMessage({
                type: "success",
                content: `${selectedUsers.length} contacts deleted successfully.`,
            });
            setSelectedUsers([]);
            await fetchData();
        } catch (err) {
            setMessage({
                type: "error",
                content: `Batch deletion failed: ${err.message}`,
            });
        } finally {
            setLoading(false);
        }
    };

    if (!currentUserRole) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "calc(100vh - 60px)",
                    width: "100%",
                }}
            >
                <Spin size="large" tip="Loading contact management..." />
            </div>
        );
    }

    return (
        <div
            style={{ padding: window.innerWidth < 768 ? "0 12px 0 12px" : 24 }}
        >
            <Title level={window.innerWidth < 768 ? 3 : 2}>
                Contact Management
            </Title>

            {message.content && message.type !== "error-validation" && (
                <Alert
                    message={message.content}
                    type={message.type}
                    showIcon
                    closable
                    style={{
                        marginBottom: 16,
                        whiteSpace: "pre-line",
                    }}
                />
            )}

            {/* User Modal */}
            <Modal
                open={isUserModalVisible}
                onCancel={() => {
                    resetForm();
                    setIsUserModalVisible(false);
                }}
                footer={null}
                width={window.innerWidth < 768 ? "95%" : "50%"}
                style={{ maxWidth: window.innerWidth < 768 ? "100%" : 600 }}
                centered
                destroyOnHidden
            >
                <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    style={{
                        background: "#fff",
                        padding: window.innerWidth < 768 ? 12 : 20,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    disabled={loading}
                >
                    <Title level={4}>
                        {isEditing ? "Edit Contact" : "Add New Contact"}
                    </Title>

                    {/* Show validation errors */}
                    {validationErrors.length > 0 && (
                        <Alert
                            message="Validation Errors"
                            description={
                                <ul
                                    style={{ marginBottom: 0, paddingLeft: 20 }}
                                >
                                    {validationErrors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            }
                            type="error"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                    )}

                    {/* Place First Name and Last Name side by side on desktop, stacked on mobile */}
                    <Row gutter={[16, 0]}>
                        <Col xs={24} sm={12}>
                            <Form.Item label="First Name" required>
                                <Input
                                    value={formData.first_name}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            first_name: capitalizeWords(
                                                e.target.value
                                            ),
                                        }))
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item label="Last Name" required>
                                <Input
                                    value={formData.last_name}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            last_name: capitalizeWords(
                                                e.target.value
                                            ),
                                        }))
                                    }
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="Email (Gmail only)" required>
                        <Input
                            type="email"
                            placeholder="user@gmail.com"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    email: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>
                    <Form.Item label="Place/Barangay" required>
                        <Select
                            value={formData.place_id}
                            onChange={(value) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    place_id: value,
                                }))
                            }
                            placeholder="-- Select Place --"
                        >
                            {places.map((p) => (
                                <Option key={p.id} value={p.id}>
                                    {p.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item label="Role" required>
                        <Radio.Group
                            value={formData.role}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    role: e.target.value,
                                }))
                            }
                            style={{
                                display: "flex",
                                flexDirection:
                                    window.innerWidth < 768 ? "column" : "row",
                                gap: window.innerWidth < 768 ? 8 : 0,
                            }}
                        >
                            {availableRoles.map((role) => (
                                <Radio key={role} value={role}>
                                    {role}
                                </Radio>
                            ))}
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="Contact Number" required>
                        <Input
                            addonBefore="+63"
                            maxLength={10}
                            placeholder="9XXXXXXXXX"
                            value={formData.contact_number}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    contact_number: e.target.value.replace(
                                        /\D/g,
                                        ""
                                    ),
                                }))
                            }
                        />
                    </Form.Item>
                    <Form.Item>
                        <Space wrap>
                            <Button
                                type="primary"
                                htmlType="submit"
                                disabled={loading || !isFormValid}
                                onClick={handleSubmit}
                            >
                                {loading
                                    ? "Processing..."
                                    : isEditing
                                    ? "Save Changes"
                                    : "Add Contact"}
                            </Button>
                            <Button
                                onClick={() => {
                                    if (isEditing) {
                                        setIsUserModalVisible(false);
                                        resetForm();
                                    } else {
                                        resetForm();
                                    }
                                }}
                                disabled={loading}
                            >
                                {isEditing ? "Cancel" : "Clear"}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Batch Upload Modal */}
            <Modal
                open={isBatchModalVisible}
                onCancel={() => {
                    handleRemoveFile();
                    setIsBatchModalVisible(false);
                }}
                footer={null}
                width={window.innerWidth < 768 ? "95%" : "50%"}
                style={{ maxWidth: window.innerWidth < 768 ? "100%" : 600 }}
                centered
                destroyOnHidden
            >
                <Form
                    layout="vertical"
                    onFinish={handleFileUpload}
                    style={{
                        background: "#fff",
                        padding: window.innerWidth < 768 ? 12 : 20,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    disabled={loading || isEditing || batchStatus.loading}
                >
                    <Title level={4}>Batch Upload Contacts</Title>
                    <Alert
                        message="Requirements"
                        description="All emails must be Gmail addresses (@gmail.com). Contact numbers must start with 9 and cannot contain suspicious patterns (4+ repeated or sequential digits)."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                    <Form.Item>
                        <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                        />
                        {uploadFile && (
                            <Button
                                onClick={handleRemoveFile}
                                style={{ marginTop: 8 }}
                            >
                                Remove
                            </Button>
                        )}
                    </Form.Item>
                    <Form.Item>
                        <Space wrap>
                            <Button
                                type="primary"
                                htmlType="submit"
                                onClick={handleFileUpload}
                                disabled={!uploadFile || batchStatus.loading}
                            >
                                {batchStatus.loading
                                    ? "Processing..."
                                    : "Upload & Process"}
                            </Button>
                            <Button
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href =
                                        "/src/assets/safe_contact_list.xlsx";
                                    link.download = "safe_contact_list";
                                    link.click();
                                }}
                            >
                                Download Template
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Contacts List */}
            <div style={{ paddingBottom: 0 }}>
                <Title level={3}>Contacts ({sortedUsers.length})</Title>

                <>
                    <div
                        style={{
                            position: "sticky",
                            top: 10,
                            zIndex: 10,
                            backgroundColor: "white",
                            paddingBottom: 16,
                            borderBottom: "1px solid #f0f0f0",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        {/* Desktop: Single Row, Mobile: Three Rows */}
                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                                flexWrap: "wrap",
                            }}
                        >
                            {/* Group 1: Delete + Search */}
                            <Button
                                danger
                                disabled={selectedUsers.length === 0 || loading}
                                onClick={handleBatchDelete}
                            >
                                <DeleteOutlined /> ({selectedUsers.length})
                            </Button>

                            <Input
                                placeholder="Search name"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    flex: "1 1 200px",
                                    maxWidth: 400,
                                    minWidth: 150,
                                }}
                                allowClear
                            />

                            {/* Group 2: Role + Place Filters */}
                            <Select
                                value={selectedRole}
                                onChange={(value) => setSelectedRole(value)}
                                style={{ flex: "1 1 120px", minWidth: 120 }}
                                allowClear
                                placeholder="Filter by role"
                            >
                                <Option value="">All Roles</Option>
                                {availableRoles.map((r) => (
                                    <Option key={r} value={r}>
                                        {r}
                                    </Option>
                                ))}
                            </Select>

                            <Select
                                value={placeFilter}
                                onChange={(value) => setPlaceFilter(value)}
                                style={{ flex: "1 1 120px", minWidth: 120 }}
                                allowClear
                                placeholder="Filter by place"
                            >
                                <Option value="">All Places</Option>
                                {places.map((p) => (
                                    <Option key={p.id} value={p.name}>
                                        {p.name}
                                    </Option>
                                ))}
                            </Select>

                            {/* Group 3: Action Buttons + Pagination */}
                            <Button
                                type="primary"
                                onClick={() => setIsUserModalVisible(true)}
                            >
                                New Contact
                            </Button>

                            <Button
                                onClick={() => setIsBatchModalVisible(true)}
                            >
                                Batch Upload
                            </Button>

                            {/* Pagination Controls */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                    marginLeft: "auto",
                                }}
                            >
                                <Button
                                    size={"small"}
                                    disabled={currentPage === 1}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1)
                                        )
                                    }
                                >
                                    {"<"}
                                </Button>
                                <span style={{ whiteSpace: "nowrap" }}>
                                    {currentPage} | {totalPages}
                                </span>
                                <Button
                                    size={"small"}
                                    disabled={currentPage === totalPages}
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1)
                                        )
                                    }
                                >
                                    {">"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </>

                {!loading && sortedUsers.length === 0 && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: "40px 0",
                        }}
                    >
                        <p>No contact found.</p>
                    </div>
                )}

                {paginatedUsers.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                        <Table
                            rowKey="user_id"
                            dataSource={paginatedUsers}
                            pagination={false}
                            bordered
                            scroll={{
                                x: window.innerWidth < 768 ? 800 : undefined,
                                y: "calc(100vh - 400px)",
                            }}
                            size={window.innerWidth < 768 ? "small" : "middle"}
                            sticky
                        >
                            {/* Checkbox select all */}
                            <Table.Column
                                width={40}
                                align="center"
                                fixed={window.innerWidth < 768 ? "left" : false}
                                title={
                                    <Checkbox
                                        onChange={toggleSelectAll}
                                        checked={
                                            paginatedUsers.length > 0 &&
                                            paginatedUsers.every((u) =>
                                                selectedUsers.includes(
                                                    u.user_id
                                                )
                                            )
                                        }
                                    />
                                }
                                render={(text, record) => (
                                    <Checkbox
                                        checked={selectedUsers.includes(
                                            record.user_id
                                        )}
                                        onChange={() =>
                                            toggleUserSelect(record.user_id)
                                        }
                                    />
                                )}
                            />

                            {/* Name column with sort */}
                            <Table.Column
                                title={
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>Name</span>
                                        <Button
                                            size="small"
                                            onClick={() => handleSort("name")}
                                            style={{ marginLeft: 4 }}
                                            icon={
                                                sortConfig.key === "name" &&
                                                sortConfig.direction ===
                                                    "asc" ? (
                                                    <SortAscendingOutlined />
                                                ) : sortConfig.key === "name" &&
                                                  sortConfig.direction ===
                                                      "desc" ? (
                                                    <SortDescendingOutlined />
                                                ) : (
                                                    <SwapOutlined />
                                                )
                                            }
                                        />
                                    </div>
                                }
                                dataIndex={["first_name"]}
                                key="name"
                                width={150}
                                render={(text, record) => (
                                    <span>
                                        {record.first_name} {record.last_name}
                                    </span>
                                )}
                            />

                            {/* Role column with sort */}
                            <Table.Column
                                title={
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>Role</span>
                                        <Button
                                            size="small"
                                            onClick={() => handleSort("role")}
                                            style={{ marginLeft: 4 }}
                                            icon={
                                                sortConfig.key === "role" &&
                                                sortConfig.direction ===
                                                    "asc" ? (
                                                    <SortAscendingOutlined />
                                                ) : sortConfig.key === "role" &&
                                                  sortConfig.direction ===
                                                      "desc" ? (
                                                    <SortDescendingOutlined />
                                                ) : (
                                                    <SwapOutlined />
                                                )
                                            }
                                        />
                                    </div>
                                }
                                dataIndex="role"
                                key="role"
                                width={120}
                            />

                            {/* Place column with sort */}
                            <Table.Column
                                title={
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <span>Place</span>
                                        <Button
                                            size="small"
                                            onClick={() => handleSort("place")}
                                            style={{ marginLeft: 4 }}
                                            icon={
                                                sortConfig.key === "place" &&
                                                sortConfig.direction ===
                                                    "asc" ? (
                                                    <SortAscendingOutlined />
                                                ) : sortConfig.key ===
                                                      "place" &&
                                                  sortConfig.direction ===
                                                      "desc" ? (
                                                    <SortDescendingOutlined />
                                                ) : (
                                                    <SwapOutlined />
                                                )
                                            }
                                        />
                                    </div>
                                }
                                dataIndex={["places", "name"]}
                                key="place"
                                width={120}
                                render={(text, record) =>
                                    record.places?.name || "—"
                                }
                            />

                            {/* Contact Number */}
                            <Table.Column
                                title="Contact"
                                dataIndex="contact_number"
                                key="contact"
                                width={120}
                            />

                            {/* Actions */}
                            <Table.Column
                                title="Actions"
                                key="actions"
                                width={100}
                                fixed={
                                    window.innerWidth < 768 ? "right" : false
                                }
                                render={(text, record) => (
                                    <Space size="small">
                                        <Button
                                            size={
                                                window.innerWidth < 768
                                                    ? "small"
                                                    : "middle"
                                            }
                                            onClick={() => handleEdit(record)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size={
                                                window.innerWidth < 768
                                                    ? "small"
                                                    : "middle"
                                            }
                                            danger
                                            onClick={() =>
                                                handleDelete(record.user_id)
                                            }
                                        >
                                            Delete
                                        </Button>
                                    </Space>
                                )}
                            />
                        </Table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
