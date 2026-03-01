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

    // Load siren
    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");
    }, []);

    const getLevelMessage = (levelName, waterLevel) => {
        switch (levelName) {
            case "L1":
                return `Flood Alert Level 1. Water level has reached ${waterLevel} meters. Stay alert and monitor local advisories.`;
            case "L2":
                return `Flood Alert Level 2. Water level is at ${waterLevel} meters. Prepare for possible evacuation and follow LGU instructions.`;
            case "L3":
                return `Flood Alert Level 3. Water level is critically high at ${waterLevel} meters. Immediate evacuation is advised in low-lying areas.`;
            default:
                return "";
        }
    };

    const triggerAlertEffects = (level, threshold) => {
        const levelName = threshold.name.toUpperCase();
        if (
            !sirenRef.current ||
            alertActiveRef.current ||
            levelName === "L0" ||
            levelName === "L1"
        )
            return;

        alertActiveRef.current = true;

        const message = getLevelMessage(levelName, level);

        const vibratePattern =
            levelName === "L3" ? [1000, 200, 1000, 200, 1000] : [600, 150, 600];

        const speak = () => {
            if (!alertActiveRef.current) return;

            // Pause before announcing level
            setTimeout(() => {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(message);
                utter.onend = () => {
                    if (alertActiveRef.current) setTimeout(playSiren, 300);
                };
                window.speechSynthesis.speak(utter);
            }, 300); // 0.3s pause
        };

        const playSiren = () => {
            if (!alertActiveRef.current) return;

            if ("vibrate" in navigator) navigator.vibrate(vibratePattern);

            sirenRef.current.currentTime = 0;
            sirenRef.current.play().catch(() => {});
            sirenRef.current.onended = () => {
                if (alertActiveRef.current) setTimeout(speak, 300);
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
        if ("vibrate" in navigator) navigator.vibrate(0);
    };

    const sendLocalNotification = async (level, threshold) => {
        const levelName = threshold.name.toUpperCase();
        if (levelName === "L0") return;

        const registration = await navigator.serviceWorker.ready;

        const message = getLevelMessage(levelName, level);
        const vibratePattern =
            levelName === "L3" ? [1000, 200, 1000] : [500, 100, 500];

        if (Notification.permission === "granted") {
            registration.showNotification(`LGU Flood Alert - ${levelName}`, {
                body: message,
                icon: "/logo.png",
                tag: "lgu-water-alert",
                renotify: true,
                requireInteraction: ["L2", "L3"].includes(levelName),
                vibrate: vibratePattern,
            });
        }
    };

    useEffect(() => {
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                async (payload) => {
                    const { water_level, threshold_level } = payload.new;
                    const levelName = threshold_level?.toUpperCase();

                    if (!levelName || levelName === "L0") {
                        stopAlertEffects();
                        setAlertVisible(false);
                        return;
                    }

                    const { data: threshold } = await supabase
                        .from("water_thresholds")
                        .select("*")
                        .eq("name", threshold_level)
                        .single();

                    if (!threshold) return;

                    const {
                        data: { user },
                    } = await supabase.auth.getUser();
                    if (!user) return;

                    const { data: contact } = await supabase
                        .from("contacts")
                        .select("subscribed")
                        .eq("user_id", user.id)
                        .single();

                    if (!contact?.subscribed) return;

                    // Send push notification
                    sendLocalNotification(water_level, threshold);

                    // Show popup and effects for L2/L3 only
                    if (["L2", "L3"].includes(levelName)) {
                        triggerAlertEffects(water_level, threshold);
                        setAlertLevel(water_level);
                        setAlertType(threshold);
                        setTimestamp(new Date().toLocaleString());
                        setAlertVisible(true);
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
        stopAlertEffects();
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
                            border: "1px solid #e5e7eb",
                            borderTop:
                                alertType.name === "L3" ?
                                    "4px solid #ef4444"
                                :   "4px solid #f87171",
                            padding: "28px",
                            boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
                        }}>
                        <p
                            style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "1px",
                                marginBottom: "6px",
                                color: "#ef4444",
                            }}>
                            LOCAL GOVERNMENT UNIT
                        </p>
                        <h2
                            style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                marginBottom: "16px",
                                color: "#ef4444",
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
                            {getLevelMessage(
                                alertType.name.toUpperCase(),
                                alertLevel,
                            )}
                        </p>

                        <button
                            onClick={handleDismiss}
                            style={{
                                width: "100%",
                                padding: "12px",
                                backgroundColor:
                                    alertType.name === "L3" ?
                                        "#ef4444"
                                    :   "#f87171",
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
