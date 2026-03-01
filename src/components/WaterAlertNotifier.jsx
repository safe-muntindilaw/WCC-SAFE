import { useEffect, useRef, useState } from "react";
import { supabase } from "@/globals";
import { useResponsive } from "@/utils/useResponsive";
import { THEME } from "@/utils/theme";

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
                <div
                    onClick={handleSuppress}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9998,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        // Backdrop uses CSS animation class for breathing glow
                    }}
                    className="alert-backdrop">
                    {/* Card */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="alert-card"
                        style={{
                            zIndex: 9999,
                            backgroundColor: "#0f172a",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderTop: "3px solid #ef4444",
                            borderRadius: "16px",
                            padding: isMobile ? "24px 20px" : "32px 36px",
                            width: isMobile ? "90vw" : "400px",
                            boxShadow:
                                "0 0 0 1px rgba(239,68,68,0.1), 0 24px 64px rgba(0,0,0,0.6)",
                            position: "relative",
                            overflow: "hidden",
                        }}>
                        {/* Subtle inner glow top edge */}
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: "60px",
                                background:
                                    "linear-gradient(to bottom, rgba(239,68,68,0.08), transparent)",
                                borderRadius: "16px 16px 0 0",
                                pointerEvents: "none",
                            }}
                        />

                        {/* Header row */}
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                marginBottom: "20px",
                            }}>
                            <span
                                className="pulse-dot"
                                style={{
                                    width: "9px",
                                    height: "9px",
                                    borderRadius: "50%",
                                    backgroundColor: "#ef4444",
                                    display: "inline-block",
                                    flexShrink: 0,
                                }}
                            />
                            <span
                                style={{
                                    color: "#ef4444",
                                    fontWeight: "700",
                                    fontSize: "11px",
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                }}>
                                Active Alert
                            </span>
                            {/* Push badge to right */}
                            <div style={{ marginLeft: "auto" }}>
                                <span
                                    style={{
                                        backgroundColor: "rgba(239,68,68,0.12)",
                                        color: "#ef4444",
                                        border: "1px solid rgba(239,68,68,0.25)",
                                        borderRadius: "999px",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        padding: "2px 10px",
                                        letterSpacing: "0.04em",
                                    }}>
                                    LIVE
                                </span>
                            </div>
                        </div>

                        {/* Divider */}
                        <div
                            style={{
                                height: "1px",
                                background:
                                    "linear-gradient(to right, rgba(239,68,68,0.3), rgba(239,68,68,0.05), transparent)",
                                marginBottom: "20px",
                            }}
                        />

                        {/* Title */}
                        <p
                            style={{
                                color: "#f1f5f9",
                                fontSize: isMobile ? "20px" : "22px",
                                fontWeight: "700",
                                margin: "0 0 8px 0",
                                letterSpacing: "-0.01em",
                            }}>
                            ⚠️ Water Level Warning
                        </p>

                        {/* Subtitle */}
                        <p
                            style={{
                                color: "#64748b",
                                fontSize: "13px",
                                margin: "0 0 24px 0",
                                lineHeight: "1.5",
                            }}>
                            Threshold has been exceeded. Take necessary
                            precautions.
                        </p>

                        {/* Level indicator */}
                        <div
                            style={{
                                backgroundColor: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.07)",
                                borderRadius: "10px",
                                padding: "14px 16px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "24px",
                            }}>
                            <span
                                style={{
                                    color: "#64748b",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                }}>
                                Current Level
                            </span>
                            <span
                                style={{
                                    color: "#fbbf24",
                                    fontSize: "22px",
                                    fontWeight: "800",
                                    letterSpacing: "-0.02em",
                                }}>
                                {alertLevel}
                                <span
                                    style={{
                                        fontSize: "13px",
                                        fontWeight: "500",
                                        color: "#92400e",
                                        marginLeft: "2px",
                                    }}>
                                    m
                                </span>
                            </span>
                        </div>

                        {/* Stop button */}
                        <button
                            onClick={handleSuppress}
                            className="stop-btn"
                            style={{
                                width: "100%",
                                padding: "13px 0",
                                backgroundColor: "#ef4444",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "10px",
                                fontSize: "14px",
                                fontWeight: "700",
                                cursor: "pointer",
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                transition:
                                    "background-color 0.15s, transform 0.1s",
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.backgroundColor = "#dc2626";
                                e.target.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.backgroundColor = "#ef4444";
                                e.target.style.transform = "translateY(0)";
                            }}
                            onMouseDown={(e) => {
                                e.target.style.transform = "translateY(1px)";
                            }}>
                            Stop Alert
                        </button>

                        {/* Disclaimer */}
                        <p
                            style={{
                                color: "#334155",
                                fontSize: "11px",
                                textAlign: "center",
                                margin: "12px 0 0 0",
                                letterSpacing: "0.01em",
                            }}>
                            Alert will resume if water level rises again
                        </p>
                    </div>
                </div>
            )}

            <style>{`
                /* Backdrop: breathing color between black and deep red */
                @keyframes breatheBackdrop {
                    0%   { background-color: rgba(0, 0, 0, 0.65);   backdrop-filter: blur(6px); }
                    50%  { background-color: rgba(80, 5, 5, 0.72);  backdrop-filter: blur(8px); }
                    100% { background-color: rgba(0, 0, 0, 0.65);   backdrop-filter: blur(6px); }
                }
                .alert-backdrop {
                    animation: breatheBackdrop 2s ease-in-out infinite;
                    -webkit-backdrop-filter: blur(6px);
                }

                /* Card entrance */
                @keyframes cardIn {
                    from { opacity: 0; transform: scale(0.94) translateY(8px); }
                    to   { opacity: 1; transform: scale(1)    translateY(0);   }
                }
                .alert-card {
                    animation: cardIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }

                /* Pulsing dot */
                @keyframes dotPulse {
                    0%, 100% { opacity: 1;   transform: scale(1);    box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
                    50%       { opacity: 0.6; transform: scale(1.4);  box-shadow: 0 0 0 5px rgba(239,68,68,0); }
                }
                .pulse-dot {
                    animation: dotPulse 1.2s ease-in-out infinite;
                }
            `}</style>
        </>
    );
};

export default WaterAlertNotifier;
