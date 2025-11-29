import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/globals";
import { Spin } from "antd";

const AuthContext = createContext();

const getProfileRole = async (userId, setUserRole) => {
    if (!userId) return setUserRole(null);

    const { data, error } = await supabase
        .from("contacts")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("Error fetching user role:", error);
        setUserRole("Resident");
    } else if (data) {
        setUserRole(data.role || "Resident");
    } else {
        setUserRole("Resident");
    }
};

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    // Handles side-effects (role fetch, DB sync) whenever 'user' changes
    useEffect(() => {
        let isMounted = true;

        const fetchRoleAndSyncDb = async (authenticatedUser) => {
            if (!isMounted || !authenticatedUser) {
                setUserRole(null);
                return;
            }

            // 1. Fetch the user's role
            await getProfileRole(authenticatedUser.id, setUserRole);

            // 2. Mark as logged in in DB
            await supabase
                .from("contacts")
                .update({ is_logged_in: true })
                .eq("user_id", authenticatedUser.id);
        };

        fetchRoleAndSyncDb(user);

        return () => {
            isMounted = false;
        };
    }, [user]);

    // Handles initial session load and real-time auth change listener
    useEffect(() => {
        let isMounted = true;

        const setAuthState = (session, event) => {
            if (!isMounted) return;

            const authenticatedUser = session?.user ?? null;

            if (event === "PASSWORD_RECOVERY") {
                console.log(
                    "🔐 Entering recovery mode — skipping role/DB sync"
                );
                if (authenticatedUser) {
                    setUser(authenticatedUser);
                }
                return;
            }

            setUser(authenticatedUser);

            if (event === "SIGNED_OUT") {
                setLoading(false);
            }
        };

        // Initial session load
        const init = async () => {
            const { data } = await supabase.auth.getSession();
            setAuthState(data.session, null);
            setLoading(false);
        };
        init();

        // Real-time listener
        const { data: subscription } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log("Auth event:", event);
                setAuthState(session, event);
            }
        );

        return () => {
            isMounted = false;
            subscription?.unsubscribe?.();
        };
    }, []);

    const logout = async () => {
        if (user?.id) {
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
