import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/globals";
import { Spin } from "antd";

const AuthContext = createContext();

// 🟢 OPTIMIZATION: Combine role retrieval and 'is_logged_in' update into one DB call.
const syncRoleAndLogin = async (userId, setUserRole) => {
    if (!userId) {
        setUserRole(null);
        return;
    }

    // Attempt to update is_logged_in to TRUE AND fetch the user's role in a single query.
    const { data, error } = await supabase
        .from("contacts")
        .update({ is_logged_in: true })
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching/syncing user role:", error);
        setUserRole("Resident"); // Fallback role on error
    } else if (data) {
        // Use the role returned from the update operation
        setUserRole(data.role || "Resident");
    } else {
        // Fallback if no contact record exists
        setUserRole("Resident");
    }
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // 1. Sync role whenever user changes (login/logout)
    useEffect(() => {
        let isMounted = true;

        if (isMounted) {
            // Use the combined function to sync role and login status
            syncRoleAndLogin(user?.id, setUserRole);
        }

        return () => {
            isMounted = false;
        };
    }, [user]); // Re-runs when the Supabase user state changes

    // 2. Initial session load and real-time auth listener setup
    useEffect(() => {
        let isMounted = true;

        const handleAuthState = (session, event) => {
            if (!isMounted) return;

            const authenticatedUser = session?.user ?? null;

            if (event === "PASSWORD_RECOVERY") {
                console.log("🔐 Recovery mode — skipping role/DB sync");
                if (authenticatedUser) setUser(authenticatedUser);
                return;
            }

            // Set the main user state, which triggers the first useEffect
            setUser(authenticatedUser);

            if (event === "SIGNED_OUT") {
                setUserRole(null); // Clear role on sign out
            }
        };

        // Initial session load
        const init = async () => {
            const { data } = await supabase.auth.getSession();
            handleAuthState(data?.session, null);
            setLoading(false); // Authentication check is complete
        };
        init();

        // Real-time listener
        const { data: subscription } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log("Auth event:", event);
                handleAuthState(session, event);
            }
        );

        return () => {
            isMounted = false;
            subscription?.unsubscribe?.();
        };
    }, []);

    const logout = async () => {
        if (user?.id) {
            // Update is_logged_in flag to false before logging out
            const { error } = await supabase
                .from("contacts")
                .update({ is_logged_in: false })
                .eq("user_id", user.id);

            if (error)
                console.error(
                    "Failed to update is_logged_in on logout:",
                    error
                );
        }

        await supabase.auth.signOut();
    };

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                }}
            >
                <Spin size="large" tip="Checking authentication..." />
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, userRole, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
