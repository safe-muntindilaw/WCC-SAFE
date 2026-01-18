import { useEffect, useRef } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const checkSubscriptionAndNotify = async (waterLevel) => {
            // 1. Get the currently logged-in user from Supabase Auth
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.log("No authenticated user found. Skipping alert.");
                return;
            }

            // 2. Query your 'public.contacts' table using the Auth UUID
            const { data: contact, error } = await supabase
                .from("contacts")
                .select("subscribed")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error(
                    "Error verifying contact subscription:",
                    error.message,
                );
                return;
            }

            // 3. Trigger effects only if 'subscribed' is true
            if (contact && contact.subscribed) {
                console.log(
                    `Alerting subscriber for water level: ${waterLevel}m`,
                );
                sendLocalNotification(water_level);
                triggerAlertEffects(waterLevel);
            }
        };

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

        setupNotifications();

        const triggerAlertEffects = (level) => {
            // Haptic/Vibration
            if ("vibrate" in navigator) {
                window.navigator.vibrate([1000, 100, 1000, 100, 1000]);
            }

            // Siren Sound
            if (sirenRef.current) {
                sirenRef.current.currentTime = 0;
                sirenRef.current.volume = 1.0;
                sirenRef.current.play().catch(() => {});
            }

            // Voice Alert
            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance(
                    `Warning! Water level has reached ${level} meters!`,
                );
                setTimeout(() => window.speechSynthesis.speak(msg), 2000);
            }
        };

        // Listen for new water level entries
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    checkSubscriptionAndNotify(payload.new.water_level);
                },
            )
            .subscribe();

        async function sendLocalNotification(level) {
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
        }

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return null;
};

export default WaterAlertNotifier;
