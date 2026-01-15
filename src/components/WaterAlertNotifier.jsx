import { useEffect } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    useEffect(() => {
        // 1. Register SW and Request Permissions
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

        // 2. Setup Supabase Realtime
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const { water_level } = payload.new;
                    sendLocalNotification(water_level);
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
                    tag: "water-alert",
                    data: "/",
                    // Vibrate Pattern: 200ms vibrate, 100ms pause, 200ms vibrate
                    vibrate: [500, 500],
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
