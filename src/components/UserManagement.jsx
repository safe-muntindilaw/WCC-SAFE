import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/globals";

const CONTACT_ROLES = ["Official", "Admin", "Resident"];
const DEFAULT_PASSWORD = "safe2025";

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [places, setPlaces] = useState([]);
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
    const [message, setMessage] = useState("");
    const [selectedRole, setSelectedRole] = useState("");

    const isEditing = !!formData.user_id;

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("contacts")
            .select(
                `
                user_id,
                first_name,
                last_name,
                email,
                role,
                contact_number,
                place_id,
                places(name)
            `
            )
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching contacts:", error);
            setMessage("Failed to fetch contacts.");
        } else {
            setUsers(data);
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
            setMessage("Failed to fetch places.");
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

    const handleRoleFilterChange = (e) => {
        setSelectedRole(e.target.value);
    };

    const validateForm = () => {
        setMessage("");
        if (
            !formData.first_name ||
            !formData.last_name ||
            !formData.email ||
            !formData.role ||
            !formData.place_id ||
            !formData.contact_number
        ) {
            setMessage("All fields are required.");
            return false;
        }
        if (!/^9\d{9}$/.test(formData.contact_number)) {
            setMessage("Contact number must be 10 digits starting with 9.");
            return false;
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
        setMessage("");
    };
    
    const createNewContactWithAuth = async () => {
        const formattedNumber = `+63${formData.contact_number}`;

        const payload = {
            email: formData.email,
            password: DEFAULT_PASSWORD,
            first_name: formData.first_name,
            last_name: formData.last_name,
            user_role: formData.role,
            contact_number: formattedNumber,
            place_id: formData.place_id,
        };

        const { data, error } = await supabase.functions.invoke(
            "register-user",
            { body: payload }
        );

        if (error) {
            console.error("Edge Function Error:", error);
            setMessage(`Failed: ${error.message}`);
            return false;
        }

        if (data?.error) {
            setMessage(`Failed: ${data.error}`);
            return false;
        }

        return true;
    };

    /** ------------------------------------------------------
     * SAVE CONTACT (EDIT or ADD)
     * ----------------------------------------------------- */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");
        if (!validateForm()) return;

        setLoading(true);

        if (isEditing) {
            // EDITING ONLY updates contacts table
            const formattedNumber = `+63${formData.contact_number}`;
            const updateData = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                role: formData.role,
                contact_number: formattedNumber,
                place_id: formData.place_id,
            };

            const { error } = await supabase
                .from("contacts")
                .update(updateData)
                .eq("user_id", formData.user_id);

            if (error) {
                setMessage(`Failed: ${error.message}`);
            } else {
                setMessage("Contact updated successfully.");
            }
        } else {
            // ADDING NEW CONTACT → CALL EDGE FUNCTION
            const ok = await createNewContactWithAuth();
            if (ok) setMessage("Contact & account created successfully.");
        }

        resetForm();
        await fetchUsers();
        setLoading(false);
    };

    const handleEdit = (user) => {
        const digitsOnly = user.contact_number.replace(/\D/g, "");
        const cleanNumber =
            digitsOnly.length >= 10
                ? digitsOnly.slice(-10)
                : user.contact_number;

        setFormData({
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            contact_number: cleanNumber,
            place_id: user.place_id,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    /** ------------------------------------------------------
     * DELETE CONTACT + AUTH USER
     * ----------------------------------------------------- */
    const handleDelete = async (user_id) => {
        if (!confirm("Delete contact and their user account?")) return;
        setLoading(true);

        try {
            const { error: functionError } = await supabase.functions.invoke(
                "delete-user",
                { body: { user_id } }
            );

            if (functionError) {
                setMessage(`Auth delete failed: ${functionError.message}`);
                setLoading(false);
                return;
            }

            const { error: contactError } = await supabase
                .from("contacts")
                .delete()
                .eq("user_id", user_id);

            if (contactError) {
                setMessage(
                    `Auth deleted but contact failed: ${contactError.message}`
                );
            } else {
                setMessage("Contact deleted successfully.");
            }
        } catch (err) {
            setMessage(`Deletion error: ${err.message}`);
        }

        setLoading(false);
        fetchUsers();
    };

    const filteredUsers = useMemo(() => {
        if (selectedRole === "") return users;
        return users.filter((user) => user.role === selectedRole);
    }, [users, selectedRole]);

    return (
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
            <h1>Contact Management</h1>

            {message && (
                <div
                    style={{
                        padding: "10px",
                        marginBottom: "20px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        backgroundColor: message.includes("success")
                            ? "#d4edda"
                            : "#f8d7da",
                    }}
                >
                    {message}
                </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
                <fieldset
                    style={{
                        border: "1px solid #ccc",
                        padding: "20px",
                        borderRadius: "4px",
                    }}
                >
                    <legend>
                        {isEditing ? "Edit Contact" : "Add New Contact"}
                    </legend>

                    <div style={{ marginBottom: "15px" }}>
                        <label>First Name: *</label>
                        <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Last Name: *</label>
                        <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Email: *</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: "15px" }}>
                        <label>Place/Barangay: *</label>
                        <select
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

                    <div style={{ marginBottom: "15px" }}>
                        <label>Role: *</label>
                        <div>
                            {CONTACT_ROLES.map((role) => (
                                <label
                                    key={role}
                                    style={{ marginRight: "15px" }}
                                >
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

                    <div style={{ marginBottom: "15px" }}>
                        <label>Contact Number: *</label>
                        <div style={{ display: "flex" }}>
                            <span>+63</span>
                            <input
                                type="tel"
                                name="contact_number"
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
                                placeholder="9XXXXXXXXX"
                                maxLength={10}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={loading}>
                        {isEditing ? "Save Changes" : "Add Contact"}
                    </button>
                    <button
                        type="button"
                        onClick={resetForm}
                        disabled={loading}
                    >
                        {isEditing ? "Cancel" : "Clear"}
                    </button>
                </fieldset>
            </form>

            {/* CONTACT LIST */}
            <div>
                <div
                    style={{
                        marginBottom: "15px",
                        display: "flex",
                        justifyContent: "space-between",
                    }}
                >
                    <h2>Contacts ({filteredUsers.length})</h2>
                    <select
                        value={selectedRole}
                        onChange={handleRoleFilterChange}
                    >
                        <option value="">All Roles</option>
                        {CONTACT_ROLES.map((r) => (
                            <option key={r} value={r}>
                                {r}
                            </option>
                        ))}
                    </select>
                </div>

                {!loading && filteredUsers.length === 0 && (
                    <p>No contacts found.</p>
                )}

                {!loading && filteredUsers.length > 0 && (
                    <table style={{ width: "100%" }}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Place</th>
                                <th>Contact</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => (
                                <tr key={u.user_id}>
                                    <td>
                                        {u.first_name} {u.last_name}
                                    </td>
                                    <td>{u.role}</td>
                                    <td>{u.places?.name || "—"}</td>
                                    <td>{u.contact_number}</td>
                                    <td>
                                        <button onClick={() => handleEdit(u)}>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDelete(u.user_id)
                                            }
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
