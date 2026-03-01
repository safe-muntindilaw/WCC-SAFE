import { useEffect, useRef, useState } from "react";
import { supabase } from "@/globals";
import { useResponsive } from "@/utils/useResponsive";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);
    const alertActiveRef = useRef(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertLevel, setAlertLevel] = useState(null);
    const { isMobile } = useResponsive();

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
                registration.showNotification("Water Level Alert", {
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
                setAlertVisible(true);
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
                        setAlertVisible(false);
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
        setAlertVisible(false);
    };

    return (
        <>
            {alertVisible && (
                // Backdrop — blurred + dimmed, covers entire screen
                <div
                    onClick={handleSuppress}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9998,
                        backgroundColor: "rgba(0, 0, 0, 0.55)",
                        backdropFilter: "blur(6px)",
                        WebkitBackdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                    {/* Card — stop click from bubbling to backdrop dismiss */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            zIndex: 9999,
                            backgroundColor: "#1a1a1a",
                            border: "2px solid #ef4444",
                            borderRadius: "16px",
                            padding: isMobile ? "24px 20px" : "32px 36px",
                            boxShadow: "0 8px 40px rgba(239, 68, 68, 0.35)",
                            width: isMobile ? "90vw" : "380px",
                            animation: "scaleIn 0.25s ease-out",
                            fontFamily: "sans-serif",
                        }}>
                        {/* Header row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "16px",
                            }}>
                            <span
                                style={{
                                    width: "11px",
                                    height: "11px",
                                    borderRadius: "50%",
                                    backgroundColor: "#ef4444",
                                    display: "inline-block",
                                    flexShrink: 0,
                                    animation: "pulse 1s infinite",
                                }}
                            />
                            <span
                                style={{
                                    color: "#ef4444",
                                    fontWeight: "700",
                                    fontSize: "12px",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                }}>
                                Active Alert
                            </span>
                        </div>

                        {/* Title */}
                        <p
                            style={{
                                color: "#ffffff",
                                fontSize: isMobile ? "18px" : "20px",
                                fontWeight: "700",
                                margin: "0 0 6px 0",
                            }}>
                            Water Level Warning
                        </p>

                        {/* Level */}
                        <p
                            style={{
                                color: "#9ca3af",
                                fontSize: "14px",
                                margin: "0 0 24px 0",
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
                                padding: "12px 0",
                                backgroundColor: "#ef4444",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "14px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "background-color 0.2s",
                                letterSpacing: "0.02em",
                            }}
                            onMouseEnter={(e) =>
                                (e.target.style.backgroundColor = "#b91c1c")
                            }
                            onMouseLeave={(e) =>
                                (e.target.style.backgroundColor = "#ef4444")
                            }>
                            Acknowledge &amp; Suppress Alert
                        </button>

                        {/* Disclaimer */}
                        <p
                            style={{
                                color: "#6b7280",
                                fontSize: "11px",
                                textAlign: "center",
                                margin: "12px 0 0 0",
                            }}>
                            Alert will resume if water level rises again
                        </p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.92); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1;   transform: scale(1);   }
                    50%       { opacity: 0.4; transform: scale(1.5); }
                }
            `}</style>
        </>
    );
};

export default WaterAlertNotifier;
