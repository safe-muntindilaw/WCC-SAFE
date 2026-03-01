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
    const [thresholds, setThresholds] = useState([]);

    const { isMobile } = useResponsive();

    // ===============================
    // FETCH THRESHOLDS FROM DATABASE
    // ===============================
    useEffect(() => {
        const fetchThresholds = async () => {
            const { data, error } = await supabase
                .from("water_thresholds")
                .select("*")
                .order("converted_min_level", { ascending: true });

            if (!error && data) {
                setThresholds(data);
            }
        };

        fetchThresholds();
    }, []);

    // ===============================
    // FIND MATCHING THRESHOLD
    // ===============================
    const getThresholdLevel = (level) => {
        for (const threshold of thresholds) {
            if (
                level >= threshold.converted_min_level &&
                level <= threshold.converted_max_level
            ) {
                return threshold;
            }
        }
        return null;
    };

    // ===============================
    // MAIN ALERT LISTENER
    // ===============================
    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const sendLocalNotification = async (level, threshold) => {
            const registration = await navigator.serviceWorker.ready;

            if (Notification.permission === "granted") {
                registration.showNotification(
                    `LGU Flood Alert - ${threshold.name}`,
                    {
                        body: `Water level recorded at ${level} meters.`,
                        icon: "/logo.png",
                        tag: "lgu-water-alert",
                        renotify: true,
                        vibrate: [500, 100, 500],
                    },
                );
            }
        };

        const triggerAlertEffects = (level, threshold) => {
            if (!sirenRef.current || alertActiveRef.current) return;

            const levelName = threshold.name.toUpperCase();

            // ===============================
            // L1 = NOTIFICATION ONLY
            // ===============================
            if (levelName === "L1" || levelName === "ADVISORY") {
                return;
            }

            alertActiveRef.current = true;

            const message = `${threshold.name} flood alert. Water level recorded at ${level} meters. Please take precautionary measures.`;

            const vibratePattern =
                levelName === "L3" || levelName === "CRITICAL" ?
                    [1000, 200, 1000, 200, 1000] // Strong vibration
                :   [600, 150, 600]; // Medium vibration

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

                if ("vibrate" in navigator) {
                    navigator.vibrate(vibratePattern);
                }

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

            if ("vibrate" in navigator) {
                navigator.vibrate(0);
            }
        };

        const checkSubscriptionAndNotify = async (level) => {
            const threshold = getThresholdLevel(level);

            if (!threshold) {
                stopAlertEffects();
                setAlertVisible(false);
                return;
            }

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
                sendLocalNotification(level, threshold);
                triggerAlertEffects(level, threshold);

                setAlertLevel(level);
                setAlertType(threshold);
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
                    checkSubscriptionAndNotify(level);
                },
            )
            .subscribe();

        return () => {
            stopAlertEffects();
            supabase.removeChannel(channel);
        };
    }, [thresholds]);

    const handleDismiss = () => {
        alertActiveRef.current = false;
        window.speechSynthesis.cancel();

        if (sirenRef.current) {
            sirenRef.current.pause();
            sirenRef.current.currentTime = 0;
        }

        if ("vibrate" in navigator) {
            navigator.vibrate(0);
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
                        backgroundColor: "rgba(0,0,0,0.75)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 9999,
                    }}>
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            width: isMobile ? "92vw" : "500px",
                            borderRadius: "6px",
                            borderTop: "6px solid #b91c1c",
                            padding: "28px",
                            boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
                            fontFamily: "Arial, sans-serif",
                        }}>
                        <p
                            style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "1px",
                                marginBottom: "6px",
                            }}>
                            LOCAL GOVERNMENT UNIT
                        </p>

                        <h2
                            style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                marginBottom: "16px",
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
                            <p>
                                <strong>Alert Level:</strong> {alertType.name}
                            </p>
                            <p>
                                <strong>Recorded Water Level:</strong>{" "}
                                {alertLevel} meters
                            </p>
                            <p>
                                <strong>Threshold Range:</strong>{" "}
                                {alertType.converted_min_level}m –{" "}
                                {alertType.converted_max_level}m
                            </p>
                            <p>
                                <strong>Date & Time:</strong> {timestamp}
                            </p>
                        </div>

                        <p style={{ marginBottom: "24px" }}>
                            Residents in flood-prone and low-lying areas are
                            advised to remain alert and monitor official LGU
                            advisories for further updates.
                        </p>

                        <button
                            onClick={handleDismiss}
                            style={{
                                width: "100%",
                                padding: "12px",
                                backgroundColor: "#b91c1c",
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
