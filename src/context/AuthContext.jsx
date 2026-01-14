// AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/globals";
import { Spin } from "antd";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState({}); // Track who is online

    const fetchRole = async (userId) => {
        const { data } = await supabase
            .from("contacts")
            .select("role")
            .eq("user_id", userId)
            .maybeSingle();
        setUserRole(data?.role || "Resident");
    };

    useEffect(() => {
        let channel;

        const init = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                await fetchRole(session.user.id);
                setupPresence(session.user);
            }
            setLoading(false);
        };

        const setupPresence = (currentUser) => {
            // Create a channel for tracking online users
            channel = supabase.channel("online-users", {
                config: { presence: { key: currentUser.id } },
            });

            channel
                .on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    setOnlineUsers(state);
                })
                .subscribe(async (status) => {
                    if (status === "SUBSCRIBED") {
                        // "Track" this device's presence
                        await channel.track({
                            online_at: new Date().toISOString(),
                            device: window.navigator.userAgent.includes("Mobi")
                                ? "Mobile"
                                : "Desktop",
                        });
                    }
                });
        };

        init();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN") {
                setUser(session?.user);
                fetchRole(session?.user?.id);
                if (session?.user) setupPresence(session.user);
            } else if (event === "SIGNED_OUT") {
                setUser(null);
                setUserRole(null);
                if (channel) channel.unsubscribe();
            }
        });

        return () => {
            subscription?.unsubscribe();
            if (channel) channel.unsubscribe();
        };
    }, []);

    const logout = async () => {
        // Presence unsubscribes automatically on signOut
        setUser(null);
        setUserRole(null);
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider
            value={{ user, userRole, loading, logout, onlineUsers }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
