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

    // ===============================
    // ALERT EFFECTS
    // ===============================
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

        const message = `Flood alert ${threshold.name}. Water level: ${level} meters. Please take precautionary measures.`;

        const vibratePattern =
            levelName === "L3" ? [1000, 200, 1000, 200, 1000] : [600, 150, 600];

        const speak = () => {
            if (!alertActiveRef.current) return;

            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(message);
            utter.onend = () => {
                if (alertActiveRef.current) setTimeout(playSiren, 300);
            };
            window.speechSynthesis.speak(utter);
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

    // ===============================
    // LOCAL PUSH NOTIFICATION
    // ===============================
    const sendLocalNotification = async (level, threshold) => {
        if (threshold.name.toUpperCase() === "L0") return;

        const registration = await navigator.serviceWorker.ready;
        if (Notification.permission === "granted") {
            const vibratePattern =
                threshold.name.toUpperCase() === "L3" ?
                    [1000, 200, 1000]
                :   [500, 100, 500];
            registration.showNotification(
                `LGU Flood Alert - ${threshold.name}`,
                {
                    body: `Water level: ${level} meters.`,
                    icon: "/logo.png",
                    tag: "lgu-water-alert",
                    renotify: true,
                    requireInteraction: ["L2", "L3"].includes(
                        threshold.name.toUpperCase(),
                    ),
                    vibrate: vibratePattern,
                },
            );
        }
    };

    // ===============================
    // REALTIME LISTENER
    // ===============================
    useEffect(() => {
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                async (payload) => {
                    const { water_level, threshold_level } = payload.new;

                    if (
                        !threshold_level ||
                        threshold_level.toUpperCase() === "L0"
                    ) {
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

                    // Trigger effects and popup only for L2 and L3
                    if (["L2", "L3"].includes(threshold.name.toUpperCase())) {
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

    // ===============================
    // DISMISS HANDLER
    // ===============================
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
                            borderTop:
                                alertType.name === "L3" ?
                                    "6px solid #7f1d1d"
                                :   "6px solid #b91c1c",
                            padding: "28px",
                            boxShadow: "0 30px 70px rgba(0,0,0,0.3)",
                        }}>
                        <p
                            style={{
                                fontSize: "12px",
                                fontWeight: "700",
                                letterSpacing: "1px",
                                marginBottom: "6px",
                            }}>
                            Barangay Muntindilaw
                        </p>
                        <h2
                            style={{
                                fontSize: "20px",
                                fontWeight: "700",
                                marginBottom: "16px",
                            }}>
                            FLOOD ALERT
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
