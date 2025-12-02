import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/globals";

// --- Configuration Constants ---
const CONTACT_ROLES = ["Official", "Admin", "Resident"];
const GOVERNMENT_COLORS = {
    // Official Philippine Government Colors (Deep Blue, Red, Yellow/Gold)
    PRIMARY: "#0056a0",
    SECONDARY_ACCENT: "#ffc72c",
    EDIT: "#f0ad4e",
    EDIT_HOVER: "#ec9b30",
    DANGER: "#dc3545",
    DANGER_HOVER: "#c82333",
    SUCCESS: "#28a745",
    SUCCESS_HOVER: "#218838",
    BORDER: "#ced4da",
    BACKGROUND: "#f8f9fa",
    CARD_BACKGROUND: "white",
    TEXT: "#212529",
    LIGHT_TEXT: "#6c757d",
};

// --- Combined Styles for Government Theme (Enhanced to match image design) ---
const styles = `
     /* General Reset & Layout */
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: ${GOVERNMENT_COLORS.BACKGROUND};
        color: ${GOVERNMENT_COLORS.TEXT};
        line-height: 1.6;
    }

    h1 {
        color: ${GOVERNMENT_COLORS.PRIMARY};
        border-bottom: 5px solid ${GOVERNMENT_COLORS.SECONDARY_ACCENT}; /* Strong accent border */
        padding-bottom: 12px;
        margin-bottom: 35px;
        font-size: 2.5em; /* Larger title */
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 1.5px;
    }
    
    hr {
        border-top: 1px solid ${GOVERNMENT_COLORS.BORDER}; 
        margin: 30px 0;
    }

    /* --- Form Styles (Updated) --- */
    .form-group {
        display: flex;
        align-items: center;
        margin-bottom: 18px; /* Increased spacing */
    }
    .form-group label {
        width: 160px; /* Wider label space */
        text-align: right;
        margin-right: 20px;
        font-weight: 600;
        color: ${GOVERNMENT_COLORS.PRIMARY}; /* Primary color for labels */
        font-size: 1.05em;
        flex-shrink: 0; /* Prevent shrinking on large screens */
    }
    .form-group label.required::after {
        content: "*";
        color: ${GOVERNMENT_COLORS.DANGER};
        margin-left: 5px;
        font-size: 1.2em;
    }
    .form-group input, .form-group select {
        padding: 10px 14px;
        border: 1px solid ${GOVERNMENT_COLORS.BORDER};
        border-radius: 6px; /* Slightly more rounded corners */
        flex-grow: 1;
        max-width: 400px;
        background-color: ${GOVERNMENT_COLORS.CARD_BACKGROUND};
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05); /* Inner shadow for depth */
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-group input:focus, .form-group select:focus {
        border-color: ${GOVERNMENT_COLORS.PRIMARY};
        box-shadow: 0 0 0 0.2rem rgba(0, 86, 160, 0.25); /* Focus ring (Primary Blue) */
        outline: none;
    }

    /* --- New Radio Button Styles --- */
    .radio-group-container {
        display: flex;
        gap: 20px; /* Space between radio options */
        align-items: center;
        flex-grow: 1;
        max-width: 400px;
    }
    .radio-label {
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        font-weight: 500;
        color: ${GOVERNMENT_COLORS.TEXT};
    }
    .radio-label input[type="radio"] {
        margin-right: 8px;
        /* Standard radio style */
        width: 18px;
        height: 18px;
        accent-color: ${GOVERNMENT_COLORS.PRIMARY}; /* Use primary color for the checked state */
    }
    /* End New Radio Button Styles */


    .form-actions {
        margin-left: 180px; /* Align with label width + margin */
        margin-top: 30px;
        display: flex;
        gap: 15px; /* Wider gap */
    }
    fieldset {
        border: 3px solid ${GOVERNMENT_COLORS.PRIMARY}; /* Thicker, prominent border */
        padding: 30px; 
        margin-bottom: 40px;
        background-color: ${GOVERNMENT_COLORS.CARD_BACKGROUND};
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); /* More visible shadow */
    }
    legend {
        font-weight: 700;
        padding: 0 15px;
        color: ${GOVERNMENT_COLORS.PRIMARY};
        font-size: 1.5em; /* Larger legend */
        border-bottom: none;
    }
    
    /* --- Government Themed Buttons --- */
    .action-buttons button, .form-actions button {
        padding: 12px 25px; /* Larger, easier-to-click buttons */
        cursor: pointer;
        font-weight: 700;
        border-radius: 6px;
        transition: background-color 0.2s, transform 0.1s, box-shadow 0.2s;
        border: none;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 3px 6px rgba(0,0,0,0.15);
    }
    .action-buttons button:active, .form-actions button:active {
        transform: translateY(2px);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* Form Submit/Save Button */
    .submit-button {
        background-color: ${GOVERNMENT_COLORS.SUCCESS};
        color: white;
    }
    .submit-button:hover {
        background-color: ${GOVERNMENT_COLORS.SUCCESS_HOVER};
        box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
    }
    .save-button {
        background-color: ${GOVERNMENT_COLORS.PRIMARY};
        color: white;
    }
    .save-button:hover {
        background-color: #004488; /* Darker blue */
        box-shadow: 0 4px 8px rgba(0, 86, 160, 0.3);
    }

    /* Table Action Buttons (UPDATED COLORS) */
    .edit-button {
        background-color: ${GOVERNMENT_COLORS.EDIT}; 
        color: ${GOVERNMENT_COLORS.TEXT}; 
        border: 1px solid ${GOVERNMENT_COLORS.EDIT_HOVER};
        padding: 8px 15px;
        font-size: 14px;
        box-shadow: none;
    }
    .edit-button:hover {
        background-color: ${GOVERNMENT_COLORS.EDIT_HOVER};
        color: white;
    }
    .delete-button {
        background-color: ${GOVERNMENT_COLORS.DANGER}; 
        color: white;
        padding: 8px 15px;
        font-size: 14px;
        box-shadow: none;
    }
    .delete-button:hover {
        background-color: ${GOVERNMENT_COLORS.DANGER_HOVER};
    }
    .clear-button {
        background-color: ${GOVERNMENT_COLORS.BORDER};
        color: ${GOVERNMENT_COLORS.TEXT};
        border: 1px solid #c0c0c0;
        box-shadow: none;
    }

    /* --- Government Card/Table Container (Ant Design Mimicry) --- */
    .ant-card-container {
        border-radius: 8px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1); /* Stronger shadow */
        margin-top: 40px;
        background-color: ${GOVERNMENT_COLORS.CARD_BACKGROUND};
        border: 1px solid ${GOVERNMENT_COLORS.BORDER};
    }
    .ant-card-head {
        padding: 18px 25px;
        border-bottom: 4px solid ${GOVERNMENT_COLORS.PRIMARY}; 
        background-color: #e9ecef; /* Slightly darker background for header */
        border-radius: 8px 8px 0 0;
        display: flex; /* For alignment of title and filter */
        justify-content: space-between;
        align-items: center;
    }
    .ant-card-head-title h3 {
        margin: 0;
        font-size: 1.3em;
        font-weight: 800;
        color: ${GOVERNMENT_COLORS.TEXT};
        text-transform: uppercase;
    }
    /* New Filter Style */
    .role-filter-group {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        color: ${GOVERNMENT_COLORS.PRIMARY};
    }
    .role-filter-group select {
        padding: 8px 12px;
        border: 1px solid ${GOVERNMENT_COLORS.BORDER};
        border-radius: 6px;
        min-width: 200px;
        background-color: white;
        cursor: pointer;
    }
    
    .ant-table-wrapper {
        padding: 20px 25px 25px; 
        overflow-x: auto; /* Enable horizontal scrolling for the table */
    }
    .ant-table {
        min-width: 700px; /* Ensure table doesn't shrink too much */
        width: 100%;
        border-collapse: collapse;
    }
    .ant-table-thead tr {
        background-color: #f1f3f5; /* Light blue/gray for header */
    }
    .ant-table-cell {
        padding: 15px 18px;
        border-bottom: 1px solid #f0f0f0; /* Lighter inner lines */
        font-size: 14px;
        text-align: left;
    }
    .ant-table-thead .ant-table-cell {
        font-weight: 700;
        color: ${GOVERNMENT_COLORS.PRIMARY}; /* Primary color for column headers */
        text-transform: uppercase;
        letter-spacing: 0.8px;
        border-bottom: 2px solid ${GOVERNMENT_COLORS.BORDER};
    }
    .ant-table-tbody tr:hover {
        background-color: #eef1f4; /* Subtle hover effect */
    }
    .table-actions button {
        margin-right: 8px;
    }

    /* --- Role Tags/Badges (Adjusted Contrast) --- */
    .role-tag {
        display: inline-block;
        padding: 5px 12px;
        font-size: 13px;
        border-radius: 15px; /* Pill shape */
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        min-width: 100px;
        text-align: center;
    }
    .role-tag.Official {
        background-color: ${GOVERNMENT_COLORS.PRIMARY};
        color: white;
        border: 1px solid #004085;
    }
    .role-tag.Admin {
        background-color: ${GOVERNMENT_COLORS.SECONDARY_ACCENT}; 
        color: #72561b; /* Darker text for contrast on yellow */
        border: 1px solid #c9a74c;
    }
    .role-tag.Resident {
        background-color: #e3f2fd;
        color: ${GOVERNMENT_COLORS.PRIMARY};
        border: 1px solid ${GOVERNMENT_COLORS.PRIMARY};
    }

    /* Message Styling */
    .system-message {
        padding: 15px; 
        font-weight: 600; 
        border-radius: 6px;
        margin-bottom: 25px;
        line-height: 1.4;
        font-size: 1.05em;
    }
    .success-message {
        border: 1px solid ${GOVERNMENT_COLORS.SUCCESS}; 
        background-color: #d4edda;
        color: ${GOVERNMENT_COLORS.SUCCESS_HOVER};
    }
    .error-message {
        border: 1px solid ${GOVERNMENT_COLORS.DANGER}; 
        background-color: #f8d7da;
        color: ${GOVERNMENT_COLORS.DANGER_HOVER};
    }
    .warning-message {
        border: 1px solid ${GOVERNMENT_COLORS.EDIT}; 
        background-color: #fff3cd;
        color: #856404;
    }
    
    /* ================================================= */
    /* --- MEDIA QUERIES FOR TABLET AND PHONE VIEWING --- */
    /* ================================================= */

    @media (max-width: 768px) {
        /* General Adjustments */
        h1 {
            font-size: 2em;
            text-align: center;
            margin-bottom: 25px;
        }

        /* --- Form Stacking on Small Screens --- */
        .form-group {
            flex-direction: column; /* Stack label and input */
            align-items: flex-start; /* Align stacked items to the left */
        }
        .form-group label {
            width: 100%; /* Label takes full width */
            text-align: left; /* Align label text left */
            margin-right: 0;
            margin-bottom: 5px; /* Add space below label */
        }
        .form-group input, .form-group select {
            max-width: 100%; /* Input takes full width */
            box-sizing: border-box; /* Include padding/border in width */
        }
        
        /* Radio button adjustment */
        .radio-group-container {
            flex-direction: column; /* Stack radio options */
            gap: 10px;
            align-items: flex-start;
            max-width: 100%;
        }

        /* Form actions centering */
        .form-actions {
            margin-left: 0; /* Remove fixed margin */
            margin-top: 20px;
            justify-content: center; /* Center buttons */
            flex-wrap: wrap; /* Allow buttons to wrap */
        }
        .form-actions button {
            width: 100%; /* Make buttons full width on small screens */
            max-width: 250px; 
        }

        /* Fieldset Padding */
        fieldset {
            padding: 20px 15px;
        }
        legend {
            font-size: 1.3em;
        }

        /* --- Table/Card Adjustments --- */
        .ant-card-head {
            flex-direction: column; /* Stack title and filter */
            align-items: flex-start;
            padding: 15px;
            gap: 15px;
        }
        .ant-card-head-title h3 {
            font-size: 1.1em;
        }
        .role-filter-group {
            width: 100%; /* Filter group takes full width */
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
        }
        .role-filter-group select {
            min-width: 100%; /* Filter dropdown takes full width */
        }

        /* Table Responsiveness: Hide Place column on small screens */
        .ant-table-cell:nth-child(3), /* Place column */
        .ant-table-thead .ant-table-cell:nth-child(3) {
            display: none;
        }
        
        /* Table Action Buttons Stack */
        .ant-table-cell.table-actions {
            white-space: nowrap; /* Prevent buttons from breaking inline */
        }
        .table-actions button {
            display: block; /* Make action buttons stack */
            width: 100%;
            margin-right: 0;
            margin-bottom: 5px; 
            max-width: 100px;
        }
        .ant-table {
            min-width: 500px; /* Reduced minimum width for better fit, scrolling handles the rest */
        }
    }
`;


// ... (AdminTable component remains the same) ...

const AdminTable = ({
    contacts,
    loading,
    handleEdit,
    handleDelete,
    selectedRole,
    handleRoleFilterChange,
}) => {
    const contactRows = useMemo(() => {
        if (loading || contacts.length === 0) return [];

        return contacts.map((u) => {
            const roleClass = u.role.replace(/\s/g, "");

            return (
                <tr key={u.user_id} className="ant-table-row">
                    <td className="ant-table-cell">
                        {u.first_name} {u.last_name}
                    </td>
                    <td className="ant-table-cell">
                        <span className={`role-tag ${roleClass}`}>
                            {u.role}
                        </span>
                    </td>
                    <td className="ant-table-cell">{u.places?.name || "—"}</td>
                    {/* Display formatting: Remove '+63' prefix to show 10-digit number (e.g., 9xxxxxxxxx) or keep the full 11-digit local format (09xxxxxxxxx) */}
                    <td className="ant-table-cell">{u.contact_number}</td>
                    <td className="ant-table-cell table-actions">
                        <button
                            onClick={() => handleEdit(u)}
                            disabled={loading}
                            className="edit-button"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => handleDelete(u.user_id)}
                            disabled={loading}
                            className="delete-button"
                        >
                            Delete
                        </button>
                    </td>
                </tr>
            );
        });
    }, [contacts, loading, handleEdit, handleDelete]);

    return (
        <div className="ant-card-container">
            <div className="ant-card-head">
                <div className="ant-card-head-title">
                    <h3>
                        Official Directory:{" "}
                        {selectedRole === "" ? "All Contacts" : selectedRole} (
                        {contacts.length})
                    </h3>
                </div>
                {/* --- Role Filter Dropdown --- */}
                <div className="role-filter-group">
                    <label htmlFor="roleFilter">Filter by Role:</label>
                    <select
                        id="roleFilter"
                        value={selectedRole}
                        onChange={handleRoleFilterChange}
                        disabled={loading}
                    >
                        <option value="">-- Show All Roles --</option>
                        {CONTACT_ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role}
                            </option>
                        ))}
                    </select>
                </div>
                {/* --------------------------- */}
            </div>
            <div className="ant-card-body">
                {loading && (
                    <p
                        style={{
                            padding: "30px",
                            textAlign: "center",
                            fontSize: "1.2em",
                            color: GOVERNMENT_COLORS.PRIMARY,
                            fontWeight: 700,
                        }}
                    >
                        <span role="img" aria-label="loading">
                            ⏳
                        </span>{" "}
                        Fetching official records...
                    </p>
                )}
                {!loading && contacts.length === 0 ? (
                    <p
                        style={{
                            padding: "30px",
                            textAlign: "center",
                            color: GOVERNMENT_COLORS.LIGHT_TEXT,
                        }}
                    >
                        {selectedRole === ""
                            ? "No contact records found in the database. Please add new entries above."
                            : `No records found for the role: ${selectedRole}.`}
                    </p>
                ) : (
                    <div className="ant-table-wrapper">
                        <table className="ant-table">
                            <thead className="ant-table-thead">
                                <tr>
                                    <th className="ant-table-cell">
                                        Full Name
                                    </th>
                                    <th className="ant-table-cell">
                                        Official Role
                                    </th>
                                    <th className="ant-table-cell">Place</th>
                                    <th className="ant-table-cell">
                                        Contact Number
                                    </th>
                                    <th className="ant-table-cell">Action</th>
                                </tr>
                            </thead>
                            <tbody className="ant-table-tbody">
                                {contactRows}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};


// ... (UserManagement component logic remains the same) ...

const UserManagement = () => {
    const [users, setUsers] = useState([]); // Stores ALL fetched users
    const [places, setPlaces] = useState([]);
    const [formData, setFormData] = useState({
        user_id: null,
        first_name: "",
        last_name: "",
        role: "",
        contact_number: "", // Should be stored as 10 digits (9xxxxxxxxx) in state for input
        place_id: "",
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // --- NEW STATE FOR ROLE FILTER ---
    const [selectedRole, setSelectedRole] = useState("");
    // ---------------------------------

    const isEditing = !!formData.user_id;

    // Helper to determine message class
    const getMessageClass = (msg) => {
        if (msg.includes("Success") || msg.includes("✅"))
            return "success-message";
        if (
            msg.includes("Error") ||
            msg.includes("Failed") ||
            msg.includes("🔴")
        )
            return "error-message";
        if (msg.includes("Validation") || msg.includes("🟡"))
            return "warning-message";
        return "";
    };

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("contacts")
            .select(
                `
                user_id,
                first_name,
                last_name,
                role,
                contact_number,
                place_id,
                places(name)
                `
            )
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching contacts:", error);
            setMessage(
                "🔴 System Error: Failed to fetch official contact records."
            );
        } else {
            setUsers(data); // Store ALL users
        }
        setLoading(false);
    };

    const fetchPlaces = async () => {
        const { data, error } = await supabase
            .from("places")
            .select("id, name")
            .order("name", { ascending: true });

        if (error) {
            console.error("Error fetching places:", error);
            if (!message)
                setMessage("🔴 System Alert: Failed to fetch Barangay list.");
        } else {
            setPlaces(data);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchPlaces();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // --- NEW HANDLER FOR ROLE FILTER CHANGE ---
    const handleRoleFilterChange = (e) => {
        setSelectedRole(e.target.value);
    };
    // ------------------------------------------

    const validateForm = () => {
        setMessage("");
        if (
            !formData.first_name ||
            !formData.last_name ||
            !formData.role ||
            !formData.place_id ||
            !formData.contact_number
        ) {
            setMessage(
                "🟡 Validation Notice: All fields marked with (*) are required for official registration."
            );
            return false;
        }
        // Check for 10 digits starting with '9'
        if (!/^9\d{9}$/.test(formData.contact_number)) {
            setMessage(
                "🟡 Validation Notice: Contact number must be exactly 10 digits and start with '9' (e.g., 9XXXXXXXXX)."
            );
            return false;
        }
        return true;
    };

    const resetForm = () => {
        setFormData({
            user_id: null,
            first_name: "",
            last_name: "",
            role: "",
            contact_number: "",
            place_id: "",
        });
        setMessage("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        if (!validateForm()) return;
        setLoading(true);

        // Convert to E.164 Format for Database Storage
        const formattedNumber = `+63${formData.contact_number}`;
        // -----------------------------------------------------------------

        const contactData = {
            first_name: formData.first_name,
            last_name: formData.last_name,
            role: formData.role,
            contact_number: formattedNumber, // Storing E.164 format
            place_id: formData.place_id,
        };

        let error;
        let successMessage;

        if (isEditing) {
            ({ error } = await supabase
                .from("contacts")
                .update(contactData)
                .eq("user_id", formData.user_id));

            successMessage = "✅ Success: Contact record updated and saved.";
        } else {
            ({ error } = await supabase.from("contacts").insert([contactData]));
            successMessage =
                "✅ Success: New contact officially added to the directory.";
        }
        if (error) {
            console.error("Database Error:", error);
            setMessage(`🔴 Transaction Failed: ${error.message}`);
        } else {
            setMessage(successMessage);
        }

        resetForm();
        await fetchUsers(); // Wait for fetch to complete
        setLoading(false);
    };

    const handleEdit = (user) => {
        // Convert from E.164 (+639XXXXXXXXX) to 10 digits (9XXXXXXXXX)
        const digitsOnly = user.contact_number.replace(/\D/g, ""); // Remove all non-digits
        // Take the last 10 digits (removing country code 63)
        const cleanNumber =
            digitsOnly.length >= 10
                ? digitsOnly.slice(-10)
                : user.contact_number;

        setFormData({
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            contact_number: cleanNumber,
            place_id: user.place_id,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (user_id) => {
        if (
            !confirm(
                "🚨 CONFIRMATION: Are you sure you want to permanently DELETE this contact record? This action cannot be undone."
            )
        )
            return;
        setLoading(true);

        const { error } = await supabase
            .from("contacts")
            .delete()
            .eq("user_id", user_id);

        if (error) {
            console.error("Database Error:", error);
            setMessage(`🔴 Deletion Failed: ${error.message}`);
        } else
            setMessage(
                "🗑️ Record Deleted: Contact successfully removed from the directory."
            );

        setLoading(false);
        fetchUsers();
    };

    // --- NEW: Filter contacts based on selectedRole ---
    const filteredUsers = useMemo(() => {
        if (selectedRole === "") {
            return users; // Show all
        }
        return users.filter((user) => user.role === selectedRole);
    }, [users, selectedRole]);
    // -------------------------------------------------

    return (
        <>
            {/* INJECTS THE CSS STYLES, NOW INCLUDING MEDIA QUERIES */}
            <style>{styles}</style> 
            <div
                style={{
                    maxWidth: "1000px",
                    margin: "0 auto",
                    padding: "20px",
                }}
            >
                <h1>Resident Contact Management System</h1>

                {/* Global Message/Alert Area */}
                {message && (
                    <p className={`system-message ${getMessageClass(message)}`}>
                        {message}
                    </p>
                )}

                {/* --- Contact Form Section (Official Record Entry) --- */}
                <form onSubmit={handleSubmit}>
                    <fieldset>
                        <legend>
                            {isEditing
                                ? "Edit Official Record"
                                : "Register New Contact Entry"}
                        </legend>

                        {/* First Name */}
                        <div className="form-group">
                            <label htmlFor="firstName" className="required">
                                First Name:
                            </label>
                            <input
                                id="firstName"
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* Last Name */}
                        <div className="form-group">
                            <label htmlFor="lastName" className="required">
                                Last Name:
                            </label>
                            <input
                                id="lastName"
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* Place/Barangay */}
                        <div className="form-group">
                            <label htmlFor="placeId" className="required">
                                Place/Barangay:
                            </label>
                            <select
                                id="placeId"
                                name="place_id"
                                value={formData.place_id}
                                onChange={handleChange}
                                required
                            >
                                <option value="">-- Select Place --</option>
                                {places.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Official Role */}
                        <div className="form-group">
                            <label htmlFor="role" className="required">
                                Official Role:
                            </label>
                            <div className="radio-group-container">
                                {" "}
                                {/* New wrapper for radio buttons */}
                                {CONTACT_ROLES.map((role) => (
                                    <label key={role} className="radio-label">
                                        <input
                                            type="radio"
                                            name="role"
                                            value={role}
                                            checked={formData.role === role}
                                            onChange={handleChange}
                                            required
                                        />
                                        {role}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Contact Number (PH) - MODIFIED WITH PREFIX */}
                        <div className="form-group">
                            <label htmlFor="contactNumber" className="required">
                                Contact No.:
                            </label>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0",
                                    flexGrow: 1,
                                    maxWidth: "400px",
                                }}
                            >
                                <span
                                    style={{
                                        padding: "10px 14px", /* Adjusted padding to match input */
                                        backgroundColor: "#e9ecef",
                                        border:
                                            "1px solid " +
                                            GOVERNMENT_COLORS.BORDER,
                                        borderRight: "none",
                                        borderRadius: "6px 0 0 6px",
                                        fontWeight: "700",
                                        color: GOVERNMENT_COLORS.PRIMARY,
                                        fontSize: "1em",
                                        display: "flex",
                                        alignItems: "center",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    +63
                                </span>
                                <input
                                    id="contactNumber"
                                    type="tel"
                                    name="contact_number"
                                    value={formData.contact_number}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(
                                            /\D/g,
                                            ""
                                        ); // Strip non-digits
                                        // Allow any input change, validation happens on submit
                                        setFormData((prev) => ({
                                            ...prev,
                                            contact_number: value,
                                        }));
                                    }}
                                    placeholder="9XXXXXXXXX (10 digits)"
                                    maxLength={10}
                                    style={{
                                        borderRadius: "0 6px 6px 0",
                                        flexGrow: 1,
                                        padding: "10px 14px",
                                        border:
                                            "1px solid " +
                                            GOVERNMENT_COLORS.BORDER,
                                        backgroundColor:
                                            GOVERNMENT_COLORS.CARD_BACKGROUND,
                                        boxShadow:
                                            "inset 0 1px 3px rgba(0, 0, 0, 0.05)",
                                        transition:
                                            "border-color 0.2s, box-shadow 0.2s",
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor =
                                            GOVERNMENT_COLORS.PRIMARY;
                                        e.target.style.boxShadow =
                                            "0 0 0 0.2rem rgba(0, 86, 160, 0.25)";
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor =
                                            GOVERNMENT_COLORS.BORDER;
                                        e.target.style.boxShadow =
                                            "inset 0 1px 3px rgba(0, 0, 0, 0.05)";
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                disabled={loading}
                                className={
                                    isEditing ? "save-button" : "submit-button"
                                }
                            >
                                {isEditing ? "Save Changes" : "Register Contact"}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                disabled={loading}
                                className="clear-button"
                            >
                                {isEditing ? "Cancel Edit" : "Clear Form"}
                            </button>
                        </div>
                    </fieldset>
                </form>
                <hr />

                {/* --- Contact Table Section --- */}
                <AdminTable
                    contacts={filteredUsers}
                    loading={loading}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    selectedRole={selectedRole}
                    handleRoleFilterChange={handleRoleFilterChange}
                />
            </div>
        </>
    );
};

export default UserManagement;