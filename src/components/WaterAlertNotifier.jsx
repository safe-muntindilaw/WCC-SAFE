import { useEffect } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    useEffect(() => {
        const setupNotifications = async () => {
            if (!("serviceWorker" in navigator) || !("Notification" in window))
                return;

            try {
                await navigator.serviceWorker.register("/sw.js");
                if (Notification.permission === "default") {
                    await Notification.requestPermission();
                }
            } catch (err) {
                console.error("SW Registration failed:", err);
            }
        };

        setupNotifications();

        const triggerAlertEffects = () => {
            // 1. Vibration logic
            if ("vibrate" in navigator) {
                window.navigator.vibrate([
                    800, 200, 800, 200, 800, 200, 800, 200, 800,
                ]);
            }

            // 2. Speech Synthesis logic
            const msg = new SpeechSynthesisUtterance();
            msg.text = "WARNING! WARNING!";
            msg.pitch = 0.7;
            msg.rate = 0.3;
            msg.volume = 1.0;

            window.speechSynthesis.speak(msg);
        };

        // 2. Setup Supabase Realtime
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const { water_level } = payload.new;

                    sendLocalNotification(water_level);

                    triggerAlertEffects();
                }
            )
            .subscribe();

        async function sendLocalNotification(level) {
            const registration = await navigator.serviceWorker.ready;

            if (Notification.permission === "granted") {
                registration.showNotification("⚠️ Water Level Alert", {
                    body: `Water level has reached ${level}m!`,
                    icon: "/logo.png",
                    badge: "/logo.png",
                    vibrate: [800, 200, 800, 200, 800, 200, 800, 200, 800],
                    tag: "water-alert",
                    renotify: true,
                    data: "/",
                });
            }
        }

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return null;
};

export default WaterAlertNotifier;
