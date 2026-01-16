import { useEffect, useRef } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

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

        const triggerAlertEffects = (level) => {
            // 1. Long Vibration (Covers both siren and voice duration)
            if ("vibrate" in navigator) {
                // Pattern: Vibrate 1s, Pause 0.1s, Repeat...
                window.navigator.vibrate([
                    1000, 100, 1000, 100, 1000, 100, 1000, 100, 1000,
                ]);
            }

            // 2. Start Siren Immediately
            if (sirenRef.current) {
                sirenRef.current.currentTime = 0;
                sirenRef.current.volume = 1.0;
                sirenRef.current
                    .play()
                    .catch((e) => console.log("Siren blocked:", e));
            }

            // 3. Queue Voice (Delayed by 2 seconds to let siren blast first)
            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance();
                msg.text = `WARNING! WARNING! Water level has reached ${level} meters!`;
                msg.pitch = 1.0;
                msg.rate = 0.9;
                msg.volume = 1.0;

                // This creates the Siren -> Voice sequence
                setTimeout(() => {
                    window.speechSynthesis.speak(msg);
                }, 2000);
            }
        };

        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const { water_level } = payload.new;
                    sendLocalNotification(water_level);
                    triggerAlertEffects(water_level);
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
                    vibrate: [1000, 100, 1000, 100, 1000],
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
