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
} from "antd";

const { Option } = Select;
const { Title } = Typography;

const CONTACT_ROLES = ["Admin", "Official", "Resident"];
const DEFAULT_PASSWORD = "muntindilaw";

const cleanName = (name) => (name || "").trim().replace(/\s{2,}/g, " ");
const formatPhoneNumber = (number) => {
    const digits = String(number || "").replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
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
    // Structured message state
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

    // Modal visibility states
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [isBatchModalVisible, setIsBatchModalVisible] = useState(false);

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
        if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))
            errors.push("Please enter a valid email address.");
        if (!availableRoles.includes(role))
            errors.push("Please select a valid role.");
        if (!/^9\d{9}$/.test(String(contact_number)))
            errors.push("Contact number must be 10 digits starting with 9.");

        if (currentUserRole === "Official" && role === "Admin") {
            errors.push("You do not have permission to manage Admin users.");
        }

        if (errors.length > 0) {
            if (!isBatch)
                setMessage({ type: "error", content: errors.join("\n") });
            return errors;
        }
        return true;
    };

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
        if (!validateForm()) return;
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
                // Success message
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
                // Success message
                setMessage({
                    type: "success",
                    content: "Contact created successfully.",
                });
            }

            resetForm();
            await fetchData();
        } catch (err) {
            setMessage({ type: "error", content: `Failed: ${err.message}` });
        } finally {
            setLoading(false);
        }
        setIsUserModalVisible(false); // Close modal after submit
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

            // Handle invalid contacts
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

            // Prepare payload
            const batchPayload = validContacts.map((c) => ({
                email: c.data.email,
                password: DEFAULT_PASSWORD,
                first_name: cleanName(c.data.first_name),
                last_name: cleanName(c.data.last_name),
                user_role: c.data.role,
                contact_number: `+63${c.data.contact_number}`,
                place_id: c.data.place_id,
            }));

            // Call backend function
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
        }

        setIsBatchModalVisible(false);
    };

    const filteredUsers = useMemo(
        () =>
            selectedRole ? users.filter((u) => u.role === selectedRole) : users,
        [users, selectedRole]
    );
    const totalPages = Math.max(
        1,
        Math.ceil(filteredUsers.length / itemsPerPage)
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedRole]);
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUsers.slice(start, start + itemsPerPage);
    }, [filteredUsers, currentPage]);

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
        <div style={{ padding: 24 }}>
            <Title level={2}>Contact Management</Title>

            {/* Structured message display */}
            {message.content && (
                <Alert
                    message={message.content}
                    type={message.type} // success, error, info
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Buttons to trigger modals */}
            <Space style={{ marginBottom: 20 }}>
                <Button
                    type="primary"
                    onClick={() => setIsUserModalVisible(true)}
                >
                    Add New User
                </Button>
                <Button
                    style={{ marginLeft: 8 }}
                    onClick={() => setIsBatchModalVisible(true)}
                >
                    Batch Upload
                </Button>
            </Space>

            {/* User Modal */}
            <Modal
                // title={isEditing ? "Edit Contact" : "Add New Contact"}
                open={isUserModalVisible}
                onCancel={() => {
                    resetForm();
                    setIsUserModalVisible(false);
                }}
                footer={null}
                width="50%"
                maxWidth={600}
                centered
                destroyOnHidden
            >
                <Form
                    layout="vertical"
                    onFinish={handleSubmit}
                    style={{
                        background: "#fff",
                        padding: 20,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    disabled={loading}
                >
                    <Title level={4}>
                        {isEditing ? "Edit Contact" : "Add New Contact"}
                    </Title>
                    <Form.Item label="First Name" required>
                        <Input
                            value={formData.first_name}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    first_name: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>
                    <Form.Item label="Last Name" required>
                        <Input
                            value={formData.last_name}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    last_name: e.target.value,
                                }))
                            }
                        />
                    </Form.Item>
                    <Form.Item label="Email" required>
                        <Input
                            type="email"
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
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                disabled={loading}
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
                                    resetForm();
                                    setIsUserModalVisible(false);
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
                width="50%"
                maxWidth={600}
                centered
                destroyOnHidden
            >
                {/* Batch upload form (unchanged) */}
                <Form
                    layout="vertical"
                    onFinish={handleFileUpload}
                    style={{
                        background: "#fff",
                        padding: 20,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    disabled={loading || isEditing || batchStatus.loading}
                >
                    <Title level={4}>Batch Upload Contacts</Title>
                    <Form.Item>
                        <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                        />
                        {uploadFile && (
                            <Button
                                onClick={handleRemoveFile}
                                style={{ marginLeft: 8 }}
                            >
                                Remove
                            </Button>
                        )}
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                onClick={handleFileUpload}
                                disabled={!uploadFile || batchStatus.loading}
                            >
                                {batchStatus.loading
                                    ? "Processing..."
                                    : "Upload & Process Batch"}
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
            <div>
                <Title level={3}>Contacts ({filteredUsers.length})</Title>
                <Space style={{ marginBottom: 16 }}>
                    <Select
                        value={selectedRole}
                        onChange={(value) => setSelectedRole(value)}
                        style={{ width: 200 }}
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
                    <Button
                        danger
                        disabled={selectedUsers.length === 0 || loading}
                        onClick={handleBatchDelete}
                    >
                        Delete Selected ({selectedUsers.length})
                    </Button>
                </Space>
                {!loading && filteredUsers.length === 0 ? (
                    <p>No contacts found.</p>
                ) : null}

                {paginatedUsers.length > 0 && (
                    <Table
                        rowKey="user_id"
                        dataSource={paginatedUsers}
                        pagination={false}
                        bordered
                    >
                        {/* Checkbox toggle in the header of Name column */}
                        <Table.Column
                            width={50}
                            align="center"
                            title={
                                <Checkbox
                                    onChange={toggleSelectAll}
                                    checked={
                                        paginatedUsers.length > 0 &&
                                        paginatedUsers.every((u) =>
                                            selectedUsers.includes(u.user_id)
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

                        <Table.Column
                            title="Name"
                            dataIndex={["first_name"]}
                            key="name"
                            render={(text, record) => (
                                <span>
                                    {record.first_name} {record.last_name}
                                </span>
                            )}
                        />
                        <Table.Column
                            title="Role"
                            dataIndex="role"
                            key="role"
                        />
                        <Table.Column
                            title="Place"
                            dataIndex={["places", "name"]}
                            key="place"
                            render={(text, record) =>
                                record.places?.name || "—"
                            }
                        />
                        <Table.Column
                            title="Contact"
                            dataIndex="contact_number"
                            key="contact"
                        />
                        <Table.Column
                            title="Actions"
                            key="actions"
                            render={(text, record) => (
                                <Space>
                                    <Button onClick={() => handleEdit(record)}>
                                        Edit
                                    </Button>
                                    <Button
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
                )}

                {/* Pagination */}
                <div style={{ textAlign: "center", marginTop: 20 }}>
                    <Button
                        disabled={currentPage === 1}
                        onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                        }
                    >
                        Previous
                    </Button>
                    <span style={{ margin: "0 15px" }}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        disabled={currentPage === totalPages}
                        onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
