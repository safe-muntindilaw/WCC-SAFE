import { useEffect, useRef, useState } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);
    const alertActiveRef = useRef(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertLevel, setAlertLevel] = useState(null);

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const SAFE_WATER_LEVEL = 1.0;

        const setupNotifications = async () => {
            if (!("serviceWorker" in navigator) || !("Notification" in window))
                return;
            try {
                await navigator.serviceWorker.register("/sw.js");
                if (Notification.permission === "default") {
                    await Notification.requestPermission();
                }
            } catch (err) {}
        };

        const sendLocalNotification = async (level) => {
            const registration = await navigator.serviceWorker.ready;
            if (Notification.permission === "granted") {
                registration.showNotification("⚠️ Water Level Alert", {
                    body: `Water level has reached ${level}m!`,
                    icon: "/logo.png",
                    tag: "water-alert",
                    vibrate: [1000, 100, 1000],
                    renotify: true,
                });
            }
        };

        const triggerAlertEffects = (level) => {
            if (!sirenRef.current || !("speechSynthesis" in window)) return;
            if (alertActiveRef.current) return;

            alertActiveRef.current = true;
            const message = `Warning! Water level has reached ${level} meters!`;

            const vibrate = () => {
                if ("vibrate" in navigator) {
                    navigator.vibrate([1000, 100, 1000, 100, 1000]);
                }
            };

            const playVoice = () => {
                if (!alertActiveRef.current) return;
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(message);
                msg.onend = () => {
                    if (alertActiveRef.current) {
                        setTimeout(playSiren, 250);
                    }
                };
                window.speechSynthesis.speak(msg);
            };

            const playSiren = () => {
                if (!alertActiveRef.current) return;
                vibrate();
                sirenRef.current.currentTime = 0;
                sirenRef.current.volume = 1.0;
                sirenRef.current.onended = () => {
                    sirenRef.current.onended = null;
                    setTimeout(playVoice, 0);
                };
                sirenRef.current.play().catch(() => {});
            };

            playSiren();
        };

        const stopAlertEffects = () => {
            alertActiveRef.current = false;
            window.speechSynthesis.cancel();
            if (sirenRef.current) {
                sirenRef.current.pause();
                sirenRef.current.currentTime = 0;
                sirenRef.current.onended = null;
            }
            if ("vibrate" in navigator) {
                navigator.vibrate(0);
            }
        };

        const checkSubscriptionAndNotify = async (waterLevel) => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.log(
                    "No logged-in user detected. Notification skipped.",
                );
                return;
            }

            const { data: contact, error } = await supabase
                .from("contacts")
                .select("subscribed")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error(
                    "Error checking subscription status:",
                    error.message,
                );
                return;
            }

            if (contact && contact.subscribed === true) {
                console.log("User is subscribed. Dispatching alerts...");
                sendLocalNotification(waterLevel);
                triggerAlertEffects(waterLevel);
                setAlertLevel(waterLevel);
                setAlertVisible(true); // 👈 show the popout
            } else {
                console.log(
                    "User is logged in but has notifications disabled.",
                );
            }
        };

        setupNotifications();

        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const level = payload.new.water_level;
                    if (level > SAFE_WATER_LEVEL) {
                        checkSubscriptionAndNotify(level);
                    } else {
                        stopAlertEffects();
                        setAlertVisible(false); // 👈 auto-hide when water subsides
                    }
                },
            )
            .subscribe();

        return () => {
            stopAlertEffects();
            supabase.removeChannel(channel);
        };
    }, []);

    const handleSuppress = () => {
        alertActiveRef.current = false;
        window.speechSynthesis.cancel();
        if (sirenRef.current) {
            sirenRef.current.pause();
            sirenRef.current.currentTime = 0;
            sirenRef.current.onended = null;
        }
        if ("vibrate" in navigator) navigator.vibrate(0);
        setAlertVisible(false); // 👈 hide the popout
    };

    return (
        <>
            {alertVisible && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "24px",
                        right: "24px",
                        zIndex: 9999,
                        backgroundColor: "#1a1a1a",
                        border: "2px solid #ef4444",
                        borderRadius: "16px",
                        padding: "20px 24px",
                        boxShadow: "0 8px 32px rgba(239,68,68,0.4)",
                        minWidth: "300px",
                        maxWidth: "360px",
                        animation: "slideIn 0.3s ease-out",
                        fontFamily: "sans-serif",
                    }}>
                    {/* Pulsing red dot */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "12px",
                        }}>
                        <span
                            style={{
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                backgroundColor: "#ef4444",
                                display: "inline-block",
                                animation: "pulse 1s infinite",
                            }}
                        />
                        <span
                            style={{
                                color: "#ef4444",
                                fontWeight: "700",
                                fontSize: "14px",
                                letterSpacing: "0.05em",
                            }}>
                            ACTIVE ALERT
                        </span>
                    </div>

                    {/* Alert message */}
                    <p
                        style={{
                            color: "#ffffff",
                            fontSize: "16px",
                            fontWeight: "600",
                            margin: "0 0 4px 0",
                        }}>
                        ⚠️ Water Level Warning
                    </p>
                    <p
                        style={{
                            color: "#9ca3af",
                            fontSize: "14px",
                            margin: "0 0 16px 0",
                        }}>
                        Current level:{" "}
                        <strong style={{ color: "#fbbf24" }}>
                            {alertLevel}m
                        </strong>
                    </p>

                    {/* Suppress button */}
                    <button
                        onClick={handleSuppress}
                        style={{
                            width: "100%",
                            padding: "10px 0",
                            backgroundColor: "#ef4444",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) =>
                            (e.target.style.backgroundColor = "#b91c1c")
                        }
                        onMouseLeave={(e) =>
                            (e.target.style.backgroundColor = "#ef4444")
                        }>
                        ✓ Acknowledge & Suppress Alert
                    </button>

                    {/* Small disclaimer */}
                    <p
                        style={{
                            color: "#6b7280",
                            fontSize: "11px",
                            textAlign: "center",
                            margin: "10px 0 0 0",
                        }}>
                        Alert will resume if water level rises again
                    </p>
                </div>
            )}

            {/* Keyframe animations injected via style tag */}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.4; transform: scale(1.4); }
                }
            `}</style>
        </>
    );
};

export default WaterAlertNotifier;
