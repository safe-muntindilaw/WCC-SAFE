// UserManagement.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/globals";
import * as XLSX from "xlsx";
import {
    Input,
    Select,
    Button,
    Table,
    Checkbox,
    Space,
    Typography,
    Modal,
    Spin,
    Card,
    Divider,
    Upload,
    Tag,
    Tooltip,
    Drawer,
    Pagination,
    Flex,
} from "antd";
import {
    SwapOutlined,
    SortAscendingOutlined,
    SortDescendingOutlined,
    DeleteOutlined,
    UserAddOutlined,
    UploadOutlined,
    DownloadOutlined,
    EditOutlined,
    SearchOutlined,
    FilterOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    HomeOutlined,
    CloseOutlined,
    IdcardOutlined,
} from "@ant-design/icons";
import { THEME, cardStyle } from "@/utils/theme";
import { FloatLabel } from "@/utils/FloatLabel";
import {
    cleanName,
    capitalizeWords,
    formatPhoneNumber,
    validateUserForm,
} from "@/utils/validation";
import {
    showSuccess,
    showError,
    showValidationErrors,
    showBatchOperationResult,
} from "@/utils/notifications";
import { useConfirmDialog } from "@/utils/confirmDialog";
import { useResponsive, useResponsiveStyles } from "@/utils/useResponsive";
import {
    useEmailValidation,
    useContactValidation,
} from "@/utils/useFormValidation";
import { ValidationCard, InlineValidationText } from "@/utils/ValidationCard";

const { Title, Text } = Typography;

const CONTACT_ROLES = ["Admin", "Official", "Resident"];
const DEFAULT_PASSWORD = "muntindilaw";
const ROLE_COLORS = {
    Admin: THEME.BLUE_AUTHORITY,
    Official: THEME.BLUE_PRIMARY,
    Resident: THEME.GREEN_SAFE,
};
const INPUT_HEIGHT = { mobile: 32, desktop: 40 };

const getRoleColor = (role) => ROLE_COLORS[role] || "#000000";

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [places, setPlaces] = useState([]);
    const [placeMap, setPlaceMap] = useState({});
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [originalEmail, setOriginalEmail] = useState("");
    const [originalContactNumber, setOriginalContactNumber] = useState("");
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
    const [selectedRole, setSelectedRole] = useState("");
    const [uploadFile, setUploadFile] = useState(null);
    const [batchLoading, setBatchLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [isBatchModalVisible, setIsBatchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [placeFilter, setPlaceFilter] = useState("");
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: "asc",
    });
    const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);

    const [defaultPassword, setDefaultPassword] = useState("");

    const { confirm } = useConfirmDialog();
    const { isMobile } = useResponsive();
    const styles = useResponsiveStyles();

    const isEditing = !!formData.user_id;
    const itemsPerPage = isMobile ? 5 : 10;
    const inputHeight = isMobile ? INPUT_HEIGHT.mobile : INPUT_HEIGHT.desktop;

    // Use shared validation hooks
    const emailValidation = useEmailValidation(
        formData.email,
        isEditing,
        originalEmail
    );

    const contactValidation = useContactValidation(
        formData.contact_number,
        isEditing,
        formData.user_id,
        originalContactNumber // This is now the formatted 10-digit version
    );

    useEffect(() => {
        const getCurrentUserRole = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                if (!user) return;

                const { data, error } = await supabase
                    .from("contacts")
                    .select("role")
                    .eq("user_id", user.id)
                    .single();

                if (error) throw error;
                setCurrentUserRole(data.role);
            } catch (error) {
                console.error("Error fetching user role:", error);
                showError("Failed to load user role");
            }
        };
        getCurrentUserRole();
    }, []);

    const availableRoles = useMemo(() => {
        return currentUserRole === "Official"
            ? CONTACT_ROLES.filter((role) => role !== "Admin")
            : CONTACT_ROLES;
    }, [currentUserRole]);

    const fetchData = useCallback(async () => {
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

            // Add the password query to the Promise.all array
            const [usersResult, placesResult, passwordResult] =
                await Promise.all([
                    usersQuery,
                    supabase
                        .from("places")
                        .select("id, name")
                        .order("name", { ascending: true }),
                    supabase
                        .from("default_password")
                        .select("default")
                        .single(), // We only need the one default password
                ]);

            if (usersResult.error) throw usersResult.error;
            if (placesResult.error) throw placesResult.error;
            if (passwordResult.error) throw passwordResult.error;

            // Set all your states
            setUsers(usersResult.data || []);
            setPlaces(placesResult.data || []);

            // PASSING VALUE TO STATE: This makes it available as 'defaultPassword'
            setDefaultPassword(passwordResult.data.default);

            const map = (placesResult.data || []).reduce((acc, p) => {
                if (p?.name) acc[p.name.toLowerCase()] = p.id;
                return acc;
            }, {});
            setPlaceMap(map);
        } catch (error) {
            console.error(error);
            showError(`Failed to fetch data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [currentUserRole]);

    useEffect(() => {
        if (currentUserRole) fetchData();
    }, [currentUserRole, fetchData]);

    // Form validation
    const validationErrors = useMemo(() => {
        if (!isUserModalVisible) return [];

        return validateUserForm(
            formData,
            availableRoles,
            emailValidation.exists,
            contactValidation.exists
        );
    }, [
        formData,
        isUserModalVisible,
        availableRoles,
        emailValidation.exists,
        contactValidation.exists,
    ]);

    const isFormValid = useMemo(() => {
        const { first_name, last_name, email, role, contact_number, place_id } =
            formData;
        const cleanedContact = contact_number.replace(/\D/g, "");

        // Check if email or contact has changed in edit mode
        const emailChanged = isEditing ? email !== originalEmail : true;
        const contactChanged = isEditing
            ? contact_number !== originalContactNumber
            : true;

        // Base validations
        const baseValid =
            first_name.trim() &&
            last_name.trim() &&
            email &&
            role &&
            cleanedContact.length === 10 &&
            place_id &&
            validationErrors.length === 0;

        // If editing and fields haven't changed, skip their validation
        if (isEditing) {
            const emailValid = emailChanged
                ? emailValidation.isValid === true && !emailValidation.checking
                : true;
            const contactValid = contactChanged
                ? contactValidation.isValid === true &&
                  !contactValidation.checking
                : true;

            return baseValid && emailValid && contactValid;
        }

        // For new contacts, require all validations
        return (
            baseValid &&
            emailValidation.isValid === true &&
            !emailValidation.checking &&
            contactValidation.isValid === true &&
            !contactValidation.checking
        );
    }, [
        formData,
        validationErrors,
        emailValidation,
        contactValidation,
        isEditing,
        originalEmail,
        originalContactNumber,
    ]);

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
        setOriginalContactNumber("");
        setUploadFile(null);
    };

    const callEdgeFunction = async (functionName, body) => {
        const { data, error } = await supabase.functions.invoke(functionName, {
            body,
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        return data;
    };

    const handleSubmit = async () => {
        if (!defaultPassword) {
            showError(
                "System configuration is still loading. Please wait a moment."
            );
            return;
        }

        if (validationErrors.length > 0) {
            showValidationErrors(validationErrors);
            return;
        }

        const actionText = isEditing ? "Update" : "Add";
        const cleanedFirstName = cleanName(formData.first_name);
        const cleanedLastName = cleanName(formData.last_name);
        const selectedPlace = places.find((p) => p.id === formData.place_id);

        confirm({
            title: `${actionText} Contact`,
            content: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Name:
                        </Text>{" "}
                        <Text>
                            {capitalizeWords(cleanedFirstName)}{" "}
                            {capitalizeWords(cleanedLastName)}
                        </Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Email:
                        </Text>{" "}
                        <Text>{formData.email}</Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Contact:
                        </Text>{" "}
                        <Text>+63{formData.contact_number}</Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Role:
                        </Text>{" "}
                        <Text>{formData.role}</Text>
                    </div>
                    <div>
                        <Text strong style={{ color: THEME.BLUE_PRIMARY }}>
                            Area:
                        </Text>{" "}
                        <Text>{selectedPlace?.name || "-"}</Text>
                    </div>
                </Space>
            ),
            okText: actionText,
            cancelText: "Cancel",
            onOk: async () => {
                setLoading(true);
                try {
                    const formattedNumber = `+63${formData.contact_number}`;

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
                                first_name: capitalizeWords(cleanedFirstName),
                                last_name: capitalizeWords(cleanedLastName),
                                email: formData.email,
                                role: formData.role,
                                contact_number: formattedNumber,
                                place_id: formData.place_id,
                            })
                            .eq("user_id", formData.user_id);

                        if (error) throw error;
                        showSuccess("Contact updated successfully");
                    } else {
                        await callEdgeFunction("register-user", {
                            email: formData.email,
                            password: defaultPassword,
                            first_name: capitalizeWords(cleanedFirstName),
                            last_name: capitalizeWords(cleanedLastName),
                            user_role: formData.role,
                            contact_number: formattedNumber,
                            place_id: formData.place_id,
                        });
                        showSuccess("Contact created successfully");
                    }

                    await fetchData();
                    setIsUserModalVisible(false);
                    resetForm();
                } catch (err) {
                    console.error("Submit error:", err);
                    showError(`Failed: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleEdit = (user) => {
        const formattedNumber = formatPhoneNumber(user.contact_number);
        setFormData({
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            contact_number: formattedNumber,
            place_id: user.place_id,
        });
        setOriginalEmail(user.email);
        setOriginalContactNumber(formattedNumber); // FIXED: Store the formatted version, not the full version
        setIsUserModalVisible(true);
    };

    const handleDelete = async (user_id) => {
        confirm({
            title: "Delete Contact",
            content:
                "Delete this contact and their user account? This action cannot be undone.",
            danger: true,
            onOk: async () => {
                setLoading(true);
                try {
                    await callEdgeFunction("delete-user", { user_id });
                    const { error } = await supabase
                        .from("contacts")
                        .delete()
                        .eq("user_id", user_id);
                    if (error) throw error;
                    showSuccess("Contact deleted successfully");
                    await fetchData();
                    setSelectedUsers((prev) =>
                        prev.filter((id) => id !== user_id)
                    );
                } catch (err) {
                    showError(`Deletion failed: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleFileUpload = async () => {
        if (!uploadFile) {
            showError("Please select a file to upload");
            return;
        }

        setBatchLoading(true);

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

                if (placeId) {
                    contact.place_id = placeId;
                } else {
                    errors.push(`Area "${contact.place_name}" not found.`);
                }

                if (
                    currentUserRole === "Official" &&
                    contact.role === "Admin"
                ) {
                    errors.push("Officials cannot create Admin users.");
                }

                const validationErrors = validateUserForm(
                    contact,
                    availableRoles
                );
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

                showValidationErrors([
                    `${invalidContacts.length} contacts have validation errors`,
                    errorSummary,
                ]);
                return;
            }

            if (validContacts.length === 0) {
                showError("No valid contacts found in file");
                return;
            }

            const emails = validContacts.map((c) => c.data.email);
            const { data: existingContacts, error } = await supabase
                .from("contacts")
                .select("email, user_id, first_name, last_name")
                .in("email", emails);

            if (error) throw error;

            const existingEmailMap = new Map(
                (existingContacts || []).map((c) => [c.email, c])
            );
            const newContacts = validContacts.filter(
                (c) => !existingEmailMap.has(c.data.email)
            );
            const updateContacts = validContacts.filter((c) =>
                existingEmailMap.has(c.data.email)
            );

            const confirmMessage = [];
            if (newContacts.length > 0)
                confirmMessage.push(
                    `Create ${newContacts.length} new contact(s)`
                );
            if (updateContacts.length > 0)
                confirmMessage.push(
                    `Update ${updateContacts.length} existing contact(s)`
                );

            confirm({
                title: "Batch Upload Contacts",
                content: confirmMessage.join(" and ") + "?",
                okText: "Proceed",
                onOk: async () => {
                    try {
                        let successCount = 0;
                        let failedCount = 0;

                        if (newContacts.length > 0) {
                            try {
                                const batchPayload = newContacts.map((c) => ({
                                    email: c.data.email,
                                    password: defaultPassword,
                                    first_name: cleanName(c.data.first_name),
                                    last_name: cleanName(c.data.last_name),
                                    user_role: c.data.role,
                                    contact_number: `+63${c.data.contact_number}`,
                                    place_id: c.data.place_id,
                                }));

                                await callEdgeFunction(
                                    "register-batch-users",
                                    batchPayload
                                );
                                successCount += newContacts.length;
                            } catch (err) {
                                console.error("Batch create error:", err);
                                failedCount += newContacts.length;
                            }
                        }

                        if (updateContacts.length > 0) {
                            for (const contact of updateContacts) {
                                try {
                                    const existingContact =
                                        existingEmailMap.get(
                                            contact.data.email
                                        );
                                    const { error: updateError } =
                                        await supabase
                                            .from("contacts")
                                            .update({
                                                first_name: cleanName(
                                                    contact.data.first_name
                                                ),
                                                last_name: cleanName(
                                                    contact.data.last_name
                                                ),
                                                role: contact.data.role,
                                                contact_number: `+63${contact.data.contact_number}`,
                                                place_id: contact.data.place_id,
                                            })
                                            .eq(
                                                "user_id",
                                                existingContact.user_id
                                            );

                                    if (updateError) throw updateError;
                                    successCount++;
                                } catch (err) {
                                    console.error(
                                        "Update error for",
                                        contact.data.email,
                                        err
                                    );
                                    failedCount++;
                                }
                            }
                        }

                        showBatchOperationResult({
                            success: successCount,
                            failed: failedCount,
                            operation: "Batch Upload",
                        });

                        resetForm();
                        await fetchData();
                        setIsBatchModalVisible(false);
                    } catch (err) {
                        console.error("Batch upload error:", err);
                        showError(`Batch upload failed: ${err.message}`);
                    }
                },
            });
        } catch (err) {
            console.error("File processing error:", err);
            showError(`File processing failed: ${err.message}`);
        } finally {
            setBatchLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedUsers.length === 0) {
            showError("No contacts selected");
            return;
        }

        confirm({
            title: "Batch Delete",
            content: `Delete ${selectedUsers.length} contacts? This will remove their user accounts. This action cannot be undone.`,
            danger: true,
            okText: "Delete All",
            onOk: async () => {
                setLoading(true);
                try {
                    await callEdgeFunction("delete-batch-users", {
                        user_ids: selectedUsers,
                    });
                    const { error } = await supabase
                        .from("contacts")
                        .delete()
                        .in("user_id", selectedUsers);

                    if (error) throw error;

                    showSuccess(
                        `${selectedUsers.length} contacts deleted successfully`
                    );
                    setSelectedUsers([]);
                    await fetchData();
                } catch (err) {
                    showError(`Batch deletion failed: ${err.message}`);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const filteredUsers = useMemo(() => {
        let result = users;

        if (selectedRole)
            result = result.filter((u) => u.role === selectedRole);
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(
                (u) =>
                    u.first_name.toLowerCase().includes(lowerQuery) ||
                    u.last_name.toLowerCase().includes(lowerQuery) ||
                    u.email.toLowerCase().includes(lowerQuery)
            );
        }
        if (placeFilter)
            result = result.filter((u) => u.places?.name === placeFilter);

        return result;
    }, [users, selectedRole, searchQuery, placeFilter]);

    const handleSort = (columnKey) => {
        setSortConfig((prev) => ({
            key: columnKey,
            direction:
                prev.key === columnKey && prev.direction === "asc"
                    ? "desc"
                    : "asc",
        }));
    };

    const sortedUsers = useMemo(() => {
        if (!sortConfig.key) return filteredUsers;

        return [...filteredUsers].sort((a, b) => {
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
    }, [sortedUsers, currentPage, itemsPerPage]);

    const toggleUserSelect = (id) =>
        setSelectedUsers((prev) =>
            prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
        );

    const toggleSelectAll = () => {
        const pageIds = paginatedUsers.map((u) => u.user_id);
        const allSelectedOnPage = pageIds.every((id) =>
            selectedUsers.includes(id)
        );

        setSelectedUsers((prev) =>
            allSelectedOnPage
                ? prev.filter((id) => !pageIds.includes(id))
                : Array.from(new Set([...prev, ...pageIds]))
        );
    };

    const getSortIcon = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === "asc" ? (
                <SortAscendingOutlined />
            ) : (
                <SortDescendingOutlined />
            );
        }
        return <SwapOutlined />;
    };

    if (!currentUserRole) {
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
                <Spin size="large" tip="Loading contact management..." />
            </div>
        );
    }

    const columns = [
        {
            title: (
                <Checkbox
                    onChange={toggleSelectAll}
                    checked={
                        paginatedUsers.length > 0 &&
                        paginatedUsers.every((u) =>
                            selectedUsers.includes(u.user_id)
                        )
                    }
                />
            ),
            dataIndex: "select",
            key: "select",
            width: isMobile ? 48 : 50,
            fixed: "left",
            align: "center",
            render: (_, record) => (
                <Checkbox
                    checked={selectedUsers.includes(record.user_id)}
                    onChange={() => toggleUserSelect(record.user_id)}
                />
            ),
        },
        {
            title: (
                <Space size={4}>
                    <span>Name</span>
                    {!isMobile && (
                        <Button
                            type="text"
                            size="small"
                            icon={getSortIcon("name")}
                            onClick={() => handleSort("name")}
                            style={{ padding: "0 4px" }}
                        />
                    )}
                </Space>
            ),
            dataIndex: "first_name",
            key: "name",
            render: (_, record) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            strong
                            style={{
                                fontSize: isMobile ? 12 : 14,
                                display: "block",
                            }}>
                            {record.first_name} {record.last_name}
                        </Text>
                        {isMobile && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                {record.role} • {record.places?.name || "—"}
                            </Text>
                        )}
                    </div>
                </div>
            ),
        },
        ...(!isMobile
            ? [
                  {
                      title: "Email",
                      dataIndex: "email",
                      key: "email",
                      ellipsis: true,
                      render: (text) => (
                          <Text style={{ fontSize: 14 }}>{text}</Text>
                      ),
                  },
                  {
                      title: (
                          <Space size={4}>
                              <span>Role</span>
                              <Button
                                  type="text"
                                  size="small"
                                  icon={getSortIcon("role")}
                                  onClick={() => handleSort("role")}
                                  style={{ padding: "0 4px" }}
                              />
                          </Space>
                      ),
                      dataIndex: "role",
                      key: "role",
                      width: 120,
                      render: (role) => (
                          <Tag
                              style={{
                                  fontSize: 14,
                                  border: `1px solid ${getRoleColor(role)}`,
                                  color: getRoleColor(role),
                                  backgroundColor: "transparent",
                              }}>
                              {role}
                          </Tag>
                      ),
                  },
                  {
                      title: (
                          <Space size={4}>
                              <span>Place</span>
                              <Button
                                  type="text"
                                  size="small"
                                  icon={getSortIcon("place")}
                                  onClick={() => handleSort("place")}
                                  style={{ padding: "0 4px" }}
                              />
                          </Space>
                      ),
                      dataIndex: ["places", "name"],
                      key: "place",
                      render: (_, record) => (
                          <Text style={{ fontSize: 14 }}>
                              {record.places?.name || "—"}
                          </Text>
                      ),
                  },
                  {
                      title: "Contact",
                      dataIndex: "contact_number",
                      key: "contact",
                      render: (text) => (
                          <Text style={{ fontSize: 14 }}>{text}</Text>
                      ),
                  },
              ]
            : []),
        {
            title: "Actions",
            key: "actions",
            fixed: "right",
            width: isMobile ? 60 : 180,
            render: (_, record) => (
                <Space size={8}>
                    {isMobile ? (
                        <>
                            <Tooltip title="Edit">
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => handleEdit(record)}
                                />
                            </Tooltip>
                            <Tooltip title="Delete">
                                <Button
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => handleDelete(record.user_id)}
                                />
                            </Tooltip>
                        </>
                    ) : (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}>
                                Edit
                            </Button>
                            <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete(record.user_id)}>
                                Delete
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

// UserManagement.jsx second half
    return (
        <div style={{ padding: isMobile ? 16 : 24 }}>
            <Card
                style={{
                    ...cardStyle,
                    borderTop: `5px solid ${THEME.BLUE_PRIMARY}`,
                    minHeight: isMobile ? "50vh" : "65vh",
                }}>
                <Title
                    level={3}
                    style={{ color: THEME.BLUE_PRIMARY, marginBottom: 16 }}>
                    <UserOutlined style={{ marginRight: 8 }} />
                    Users ({sortedUsers.length})
                </Title>

                <Space
                    direction="vertical"
                    size="middle"
                    style={{ width: "100%" }}>
                    {isMobile ? (
                        <>
                            <div style={{ display: "flex", gap: 8 }}>
                                <Input
                                    placeholder="Search name or email"
                                    prefix={<SearchOutlined />}
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    allowClear
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    icon={<FilterOutlined />}
                                    onClick={() => setFilterDrawerVisible(true)}
                                />
                            </div>

                            <div style={{ display: "flex", gap: 8 }}>
                                <Button
                                    type="primary"
                                    icon={<UserAddOutlined />}
                                    onClick={() => {
                                        setIsUserModalVisible(true);
                                        resetForm();
                                    }}
                                    style={{ flex: 1 }}>
                                    New Contact
                                </Button>
                                <Button
                                    icon={<UploadOutlined />}
                                    onClick={() => setIsBatchModalVisible(true)}
                                    style={{ flex: 1 }}>
                                    Batch Upload
                                </Button>
                            </div>

                            {selectedUsers.length > 0 && (
                                <Button
                                    danger
                                    block
                                    icon={<DeleteOutlined />}
                                    onClick={handleBatchDelete}>
                                    Delete Selected ({selectedUsers.length})
                                </Button>
                            )}
                        </>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                flexWrap: "wrap",
                                alignItems: "center",
                            }}>
                            <Input
                                placeholder="Search name or email"
                                prefix={<SearchOutlined />}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                allowClear
                                style={{ width: 250 }}
                            />

                            <Select
                                value={selectedRole || undefined}
                                onChange={setSelectedRole}
                                placeholder="All Roles"
                                allowClear
                                style={{ width: 150 }}>
                                {availableRoles.map((role) => (
                                    <Select.Option key={role} value={role}>
                                        {role}
                                    </Select.Option>
                                ))}
                            </Select>

                            <Select
                                value={placeFilter || undefined}
                                onChange={setPlaceFilter}
                                placeholder="All Places"
                                allowClear
                                style={{ width: 200 }}>
                                {places.map((p) => (
                                    <Select.Option key={p.id} value={p.name}>
                                        {p.name}
                                    </Select.Option>
                                ))}
                            </Select>

                            <div style={{ flex: 1 }} />

                            {selectedUsers.length > 0 && (
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={handleBatchDelete}>
                                    Delete ({selectedUsers.length})
                                </Button>
                            )}

                            <Button
                                type="primary"
                                icon={<UserAddOutlined />}
                                onClick={() => {
                                    setIsUserModalVisible(true);
                                    resetForm();
                                }}>
                                New Contact
                            </Button>

                            <Button
                                icon={<UploadOutlined />}
                                onClick={() => setIsBatchModalVisible(true)}>
                                Batch Upload
                            </Button>
                        </div>
                    )}
                </Space>

                <Divider style={{ margin: "16px 0 0 0" }} />

                {sortedUsers.length === 0 ? (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: isMobile ? "50vh" : "65vh",
                            // padding: isMobile ? "32px 16px" : "48px 24px",
                            textAlign: "center",
                        }}>
                        <UserOutlined
                            style={{
                                fontSize: isMobile ? 64 : 80,
                                color: "#d9d9d9",
                                marginBottom: 24,
                            }}
                        />
                        <Title
                            level={isMobile ? 4 : 3}
                            style={{ color: "#8c8c8c", marginBottom: 12 }}>
                            No Contacts Found
                        </Title>
                        <Text
                            type="secondary"
                            style={{
                                fontSize: isMobile ? 14 : 16,
                                maxWidth: 400,
                                display: "block",
                                marginBottom: 24,
                            }}>
                            {searchQuery || selectedRole || placeFilter
                                ? "No contacts match your current filters. Try adjusting your search criteria."
                                : "Get started by adding your first contact using the button above."}
                        </Text>
                        {(searchQuery || selectedRole || placeFilter) && (
                            <Button
                                type="primary"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedRole("");
                                    setPlaceFilter("");
                                }}
                                style={{ height: inputHeight }}>
                                Clear All Filters
                            </Button>
                        )}
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            minHeight: isMobile ? "50vh" : "65vh",
                        }}>
                        <Table
                            columns={columns}
                            dataSource={paginatedUsers}
                            rowKey="user_id"
                            pagination={false}
                            scroll={
                                isMobile ? { x: "max-content" } : { x: 1000 }
                            }
                            size="small"
                            locale={{
                                emptyText: (
                                    <Text type="secondary">
                                        No contacts found
                                    </Text>
                                ),
                            }}
                            sticky={isMobile ? { offsetHeader: 0 } : false}
                        />

                        <div style={{ flex: 1 }} />

                        <div
                            style={{
                                paddingTop: 8,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            }}>
                            <Pagination
                                size={isMobile ? "small" : "default"}
                                current={currentPage}
                                pageSize={itemsPerPage}
                                total={sortedUsers.length}
                                onChange={setCurrentPage}
                                showSizeChanger={false}
                                showLessItems={true}
                            />
                        </div>
                    </div>
                )}
            </Card>

            {/* Mobile Filter Drawer */}
            <Drawer
                style={{
                    borderRadius: "0 0 50vw 50vw",
                    borderBottom: `4px solid ${THEME.BLUE_PRIMARY}`,
                }}
                placement="top"
                onClose={() => setFilterDrawerVisible(false)}
                open={filterDrawerVisible}
                height="auto"
                styles={{
                    body: { padding: isMobile ? 16 : 24 },
                    mask: { backdropFilter: "blur(4px)" },
                }}
                closable={false}>
                <Card
                    variant={false}
                    style={{
                        height: "100%",
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        borderRadius: "0 0 50vw 50vw",
                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                    }}>
                    <Space
                        direction="vertical"
                        size={16}
                        style={{ width: "100%" }}>
                        <FloatLabel label="Role" value={selectedRole} hasPrefix>
                            {selectedRole && (
                                <IdcardOutlined className="select-prefix-icon" />
                            )}
                            <Select
                                value={selectedRole || undefined}
                                onChange={setSelectedRole}
                                allowClear
                                style={{ width: "100%", height: 32 }}>
                                {availableRoles.map((role) => (
                                    <Select.Option key={role} value={role}>
                                        {role}
                                    </Select.Option>
                                ))}
                            </Select>
                        </FloatLabel>

                        <FloatLabel label="Place" value={placeFilter} hasPrefix>
                            {placeFilter && (
                                <HomeOutlined className="select-prefix-icon" />
                            )}
                            <Select
                                value={placeFilter || undefined}
                                onChange={setPlaceFilter}
                                allowClear
                                style={{ width: "100%", height: 32 }}>
                                {places.map((p) => (
                                    <Select.Option key={p.id} value={p.name}>
                                        {p.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </FloatLabel>

                        <div>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "12px",
                                    width: "100%",
                                    justifyContent: "center",
                                }}>
                                {["name", "role", "place"].map((key, index) => (
                                    <Button
                                        key={key}
                                        onClick={() => handleSort(key)}
                                        icon={getSortIcon(key)}
                                        type={
                                            sortConfig.key === key
                                                ? "primary"
                                                : "default"
                                        }
                                        style={{
                                            flex:
                                                index === 2
                                                    ? "0 1 60%"
                                                    : "1 1 calc(50% - 12px)",
                                            height: 32,
                                            borderRadius: 6,
                                            minWidth: "120px",
                                        }}>
                                        {key.charAt(0).toUpperCase() +
                                            key.slice(1)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <Flex justify="center">
                            {(selectedRole || placeFilter) && (
                                <Button
                                    type="primary"
                                    block
                                    onClick={() => {
                                        setSelectedRole("");
                                        setPlaceFilter("");
                                    }}
                                    style={{
                                        height: 32,
                                        borderRadius: 6,
                                        width: "40%",
                                        alignItems: "center",
                                    }}>
                                    Reset Filters
                                </Button>
                            )}
                        </Flex>

                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                            }}>
                            <Button
                                shape="circle"
                                icon={<CloseOutlined />}
                                onClick={() => setFilterDrawerVisible(false)}
                                style={{ width: 40, height: 40 }}
                            />
                        </div>
                    </Space>
                </Card>
            </Drawer>

            {/* User Modal */}
            <Modal
                title={
                    <Title level={4} style={{ margin: 0 }}>
                        {isEditing ? "Edit Contact" : "Add New Contact"}
                    </Title>
                }
                open={isUserModalVisible}
                onCancel={() => {
                    resetForm();
                    setIsUserModalVisible(false);
                }}
                footer={null}
                width={isMobile ? "100%" : 500}
                centered
                destroyOnHidden>
                <Card
                    variant={false}
                    style={{
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        marginTop: 16,
                    }}
                    styles={{ body: { padding: isMobile ? 16 : 24 } }}>
                    <Space
                        direction="vertical"
                        size={16}
                        style={{ width: "100%" }}>
                        <ValidationCard errors={validationErrors} />

                        <FloatLabel
                            label="First Name"
                            value={formData.first_name}
                            hasPrefix>
                            <Input
                                prefix={<UserOutlined />}
                                value={formData.first_name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        first_name: capitalizeWords(
                                            e.target.value
                                        ),
                                    }))
                                }
                                style={{ height: inputHeight }}
                            />
                        </FloatLabel>

                        <FloatLabel
                            label="Last Name"
                            value={formData.last_name}
                            hasPrefix>
                            <Input
                                prefix={<UserOutlined />}
                                value={formData.last_name}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        last_name: capitalizeWords(
                                            e.target.value
                                        ),
                                    }))
                                }
                                style={{ height: inputHeight }}
                            />
                        </FloatLabel>

                        <div>
                            <FloatLabel
                                label="Email (Gmail only)"
                                value={formData.email}
                                hasPrefix
                                status={
                                    formData.email &&
                                    emailValidation.touched &&
                                    !emailValidation.isValid &&
                                    !emailValidation.checking
                                        ? "error"
                                        : formData.email &&
                                          emailValidation.touched &&
                                          emailValidation.isValid
                                        ? "success"
                                        : undefined
                                }>
                                <Input
                                    prefix={<MailOutlined />}
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            email: e.target.value,
                                        }))
                                    }
                                    style={{ height: inputHeight }}
                                />
                            </FloatLabel>
                            <InlineValidationText
                                isValid={emailValidation.isValid}
                                checking={emailValidation.checking}
                                touched={emailValidation.touched}
                                validText="Email is available"
                                invalidText={
                                    emailValidation.exists
                                        ? "Email already registered"
                                        : "Invalid email format"
                                }
                            />
                        </div>

                        <div>
                            <FloatLabel
                                label="Contact Number"
                                value={formData.contact_number}
                                hasPrefix
                                status={
                                    formData.contact_number &&
                                    contactValidation.touched &&
                                    !contactValidation.isValid &&
                                    !contactValidation.checking
                                        ? "error"
                                        : formData.contact_number &&
                                          contactValidation.touched &&
                                          contactValidation.isValid
                                        ? "success"
                                        : undefined
                                }>
                                <Input
                                    prefix={
                                        <Space size={2}>
                                            <PhoneOutlined
                                                style={{ marginRight: "2px" }}
                                            />
                                            <span
                                                style={{ userSelect: "none" }}>
                                                +63
                                            </span>
                                        </Space>
                                    }
                                    maxLength={10}
                                    value={formData.contact_number}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            contact_number:
                                                e.target.value.replace(
                                                    /\D/g,
                                                    ""
                                                ),
                                        }))
                                    }
                                    style={{ height: inputHeight }}
                                    styles={{ prefix: { marginRight: 0 } }}
                                />
                            </FloatLabel>
                            <InlineValidationText
                                isValid={contactValidation.isValid}
                                checking={contactValidation.checking}
                                touched={contactValidation.touched}
                                validText="Contact number is available"
                                invalidText={
                                    contactValidation.exists
                                        ? "Contact number already registered"
                                        : "Invalid contact number"
                                }
                            />
                        </div>

                        <FloatLabel
                            label="Area"
                            value={formData.place_id}
                            hasPrefix>
                            <HomeOutlined className="select-prefix-icon" />
                            <Select
                                value={formData.place_id || undefined}
                                onChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        place_id: value,
                                    }))
                                }
                                style={{ width: "100%", height: inputHeight }}>
                                {places.map((p) => (
                                    <Select.Option key={p.id} value={p.id}>
                                        {p.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </FloatLabel>

                        <FloatLabel
                            label="Role"
                            value={formData.role}
                            hasPrefix>
                            {formData.role && (
                                <IdcardOutlined className="select-prefix-icon" />
                            )}
                            <Select
                                value={formData.role || undefined}
                                onChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        role: value,
                                    }))
                                }
                                style={{ width: "100%", height: inputHeight }}>
                                {availableRoles.map((role) => (
                                    <Select.Option key={role} value={role}>
                                        {role}
                                    </Select.Option>
                                ))}
                            </Select>
                        </FloatLabel>

                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                            <Button
                                style={{
                                    flex: 1,
                                    height: inputHeight,
                                    borderRadius: 6,
                                }}
                                onClick={() => {
                                    if (isEditing) setIsUserModalVisible(false);
                                    resetForm();
                                }}
                                disabled={loading}>
                                {isEditing ? "Cancel" : "Clear"}
                            </Button>

                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                disabled={loading || !isFormValid}
                                loading={loading}
                                style={{
                                    flex: 1,
                                    height: inputHeight,
                                    borderRadius: 6,
                                }}>
                                {loading
                                    ? "Processing..."
                                    : isEditing
                                    ? "Save Changes"
                                    : "Add Contact"}
                            </Button>
                        </div>
                    </Space>
                </Card>
            </Modal>

            {/* Batch Upload Modal */}
            <Modal
                title={
                    <Title level={4} style={{ margin: 0 }}>
                        <UploadOutlined style={{ marginRight: 8 }} />
                        Batch Upload Contacts
                    </Title>
                }
                open={isBatchModalVisible}
                onCancel={() => {
                    setUploadFile(null);
                    setIsBatchModalVisible(false);
                }}
                footer={null}
                width={isMobile ? "100%" : 500}
                centered
                destroyOnHidden>
                <Card
                    variant={false}
                    style={{
                        borderTop: `4px solid ${THEME.BLUE_PRIMARY}`,
                        marginTop: 16,
                    }}
                    styles={{ body: { padding: isMobile ? 16 : 24 } }}>
                    <Space
                        direction="vertical"
                        size={32}
                        style={{ width: "100%" }}>
                        <Card
                            size="small"
                            style={{
                                background: "#e6f7ff",
                                border: "1px solid #91d5ff",
                                borderRadius: 8,
                            }}>
                            <Space direction="vertical" size={4}>
                                <Text strong style={{ fontSize: 13 }}>
                                    Requirements:
                                </Text>
                                <ul
                                    style={{
                                        margin: 0,
                                        paddingLeft: 18,
                                        fontSize: 13,
                                        color: "#595959",
                                    }}>
                                    <li>
                                        All emails must be Gmail addresses
                                        (@gmail.com)
                                    </li>
                                    <li>
                                        Numbers must start with 9 (10 digits
                                        total)
                                    </li>
                                    <li>File format: .csv, .xlsx, or .xls</li>
                                    <li>
                                        Existing emails will be updated with new
                                        information
                                    </li>
                                </ul>
                            </Space>
                        </Card>

                        {uploadFile && (
                            <Card
                                size="small"
                                style={{
                                    background: "#f6ffed",
                                    border: "1px solid #b7eb8f",
                                    borderRadius: 8,
                                }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 8,
                                    }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            minWidth: 0,
                                            flex: 1,
                                        }}>
                                        <Text
                                            strong
                                            style={{
                                                flexShrink: 0,
                                                marginRight: 8,
                                            }}>
                                            File:
                                        </Text>
                                        <Text
                                            ellipsis
                                            style={{
                                                color: "#488828",
                                                minWidth: 0,
                                            }}>
                                            {uploadFile.name}
                                        </Text>
                                    </div>
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => setUploadFile(null)}
                                    />
                                </div>
                            </Card>
                        )}

                        <Space
                            direction="vertical"
                            size={12}
                            style={{ width: "100%" }}>
                            <Upload
                                beforeUpload={(file) => {
                                    setUploadFile(file);
                                    return false;
                                }}
                                showUploadList={false}
                                accept=".csv,.xlsx,.xls"
                                maxCount={1}
                                style={{ width: "100%" }}>
                                <Button
                                    icon={<UploadOutlined />}
                                    block
                                    style={{
                                        height: inputHeight,
                                        borderRadius: 6,
                                    }}>
                                    Upload File
                                </Button>
                            </Upload>

                            <Button
                                icon={<DownloadOutlined />}
                                block
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href =
                                        "/src/assets/safe_contact_list.xlsx";
                                    link.download = "safe_contact_list.xlsx";
                                    link.click();
                                }}
                                style={{
                                    height: inputHeight,
                                    borderRadius: 6,
                                }}>
                                Download Template
                            </Button>
                        </Space>

                        <Space
                            direction="vertical"
                            size={12}
                            style={{ width: "100%" }}>
                            <Button
                                block
                                danger
                                style={{ height: inputHeight, borderRadius: 6 }}
                                onClick={() => {
                                    setUploadFile(null);
                                    setIsBatchModalVisible(false);
                                }}
                                disabled={batchLoading}>
                                Cancel
                            </Button>

                            <Button
                                type="primary"
                                block
                                onClick={handleFileUpload}
                                disabled={!uploadFile || batchLoading}
                                loading={batchLoading}
                                style={{
                                    height: inputHeight,
                                    borderRadius: 6,
                                }}>
                                {batchLoading
                                    ? "Processing..."
                                    : "Upload & Process"}
                            </Button>
                        </Space>
                    </Space>
                </Card>
            </Modal>
        </div>
    );
};

export default UserManagement;