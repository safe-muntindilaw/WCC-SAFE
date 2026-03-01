import { useEffect, useRef, useState } from "react";
import { supabase } from "@/globals";
import { useResponsive } from "@/utils/useResponsive";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);
    const alertActiveRef = useRef(false);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertLevel, setAlertLevel] = useState(null);
    const [alertType, setAlertType] = useState(null);
    const [timestamp, setTimestamp] = useState(null);

    const { isMobile } = useResponsive();

    const THRESHOLDS = {
        advisory: 0.6,
        warning: 0.8,
        critical: 1.0,
    };

    const getThresholdLevel = (level) => {
        if (level >= THRESHOLDS.critical) {
            return {
                key: "critical",
                label: "CRITICAL",
                color: "#991b1b",
                border: "#dc2626",
            };
        }
        if (level >= THRESHOLDS.warning) {
            return {
                key: "warning",
                label: "WARNING",
                color: "#92400e",
                border: "#f59e0b",
            };
        }
        if (level >= THRESHOLDS.advisory) {
            return {
                key: "advisory",
                label: "ADVISORY",
                color: "#1e3a8a",
                border: "#3b82f6",
            };
        }
        return null;
    };

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const sendLocalNotification = async (level, type) => {
            const registration = await navigator.serviceWorker.ready;

            if (Notification.permission === "granted") {
                registration.showNotification(
                    `LGU Flood Alert - ${type.label}`,
                    {
                        body: `Water level recorded at ${level}m.`,
                        icon: "/logo.png",
                        tag: "lgu-water-alert",
                        renotify: true,
                        vibrate: [1000, 100, 1000],
                    },
                );
            }
        };

        const triggerAlertEffects = (level, type) => {
            if (!sirenRef.current || alertActiveRef.current) return;

            alertActiveRef.current = true;

            const message = `${type.label} flood alert. Water level recorded at ${level} meters. Please take precautionary measures.`;

            const speak = () => {
                if (!alertActiveRef.current) return;

                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(message);

                utter.onend = () => {
                    if (alertActiveRef.current) {
                        setTimeout(playSiren, 300);
                    }
                };

                window.speechSynthesis.speak(utter);
            };

            const playSiren = () => {
                if (!alertActiveRef.current) return;

                sirenRef.current.currentTime = 0;
                sirenRef.current.play().catch(() => {});
                sirenRef.current.onended = () => {
                    if (alertActiveRef.current) {
                        setTimeout(speak, 300);
                    }
                };
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
        };

        const checkSubscriptionAndNotify = async (level, type) => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            const { data: contact } = await supabase
                .from("contacts")
                .select("subscribed")
                .eq("user_id", user.id)
                .single();

            if (contact?.subscribed) {
                sendLocalNotification(level, type);
                triggerAlertEffects(level, type);

                setAlertLevel(level);
                setAlertType(type);
                setTimestamp(new Date().toLocaleString());
                setAlertVisible(true);
            }
        };

        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const level = payload.new.water_level;
                    const type = getThresholdLevel(level);

                    if (type) {
                        checkSubscriptionAndNotify(level, type);
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

    const handleDismiss = () => {
        alertActiveRef.current = false;
        window.speechSynthesis.cancel();

        if (sirenRef.current) {
            sirenRef.current.pause();
            sirenRef.current.currentTime = 0;
        }

        setAlertVisible(false);
    };

    return (
        <>
            {alertVisible && alertType && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 9999,
                    }}>
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            width: isMobile ? "92vw" : "480px",
                            borderRadius: "6px",
                            borderTop: `6px solid ${alertType.border}`,
                            padding: "28px",
                            boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
                            fontFamily: "Arial, sans-serif",
                        }}>
                        <p
                            style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "1px",
                                color: alertType.color,
                                marginBottom: "8px",
                            }}>
                            LOCAL GOVERNMENT UNIT
                        </p>

                        <h2
                            style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                marginBottom: "16px",
                                color: "#111827",
                            }}>
                            FLOOD ALERT BULLETIN
                        </h2>

                        <div
                            style={{
                                backgroundColor: "#f9fafb",
                                padding: "16px",
                                borderRadius: "4px",
                                marginBottom: "20px",
                            }}>
                            <p style={{ margin: 0, fontSize: "14px" }}>
                                <strong>Alert Level:</strong>{" "}
                                <span style={{ color: alertType.color }}>
                                    {alertType.label}
                                </span>
                            </p>
                            <p style={{ margin: 0, fontSize: "14px" }}>
                                <strong>Recorded Water Level:</strong>{" "}
                                {alertLevel} meters
                            </p>
                            <p style={{ margin: 0, fontSize: "14px" }}>
                                <strong>Threshold:</strong> ≥{" "}
                                {THRESHOLDS[alertType.key]} meters
                            </p>
                            <p style={{ margin: 0, fontSize: "13px" }}>
                                <strong>Date & Time:</strong> {timestamp}
                            </p>
                        </div>

                        <p
                            style={{
                                fontSize: "14px",
                                color: "#374151",
                                marginBottom: "24px",
                            }}>
                            Residents in low-lying and flood-prone areas are
                            advised to remain alert and take precautionary
                            measures as necessary. Continue monitoring official
                            LGU channels for updates.
                        </p>

                        <button
                            onClick={handleDismiss}
                            style={{
                                width: "100%",
                                padding: "12px",
                                backgroundColor: alertType.border,
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                fontWeight: "600",
                                cursor: "pointer",
                            }}>
                            ACKNOWLEDGE
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default WaterAlertNotifier;
