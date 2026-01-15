import { useEffect } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    useEffect(() => {
        // Register the service worker
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").then(() => {
                console.log("Service worker registered");
            });
        }

        // Request notification permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        // Subscribe to water_alerts table
        const channel = supabase
            .channel("public:water_alerts")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const { water_level } = payload.new;
                    showNotification(water_level);
                }
            )
            .subscribe();

        async function showNotification(water_level) {
            if (!("Notification" in window)) return;
            if (Notification.permission !== "granted") return;

            const registration = await navigator.serviceWorker.ready;
            registration.showNotification("⚠️ Water Level Alert", {
                body: `Water level reached ${water_level}m`,
                icon: "/logo.png",
                badge: "/logo.png",
                data: "/",
            });
        }

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return null;
};

export default WaterAlertNotifier;
