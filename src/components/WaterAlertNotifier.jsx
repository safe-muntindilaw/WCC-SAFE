import { useEffect, useRef } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const checkSubscriptionAndNotify = async (waterLevel) => {
            // 1. Get the user's unique ID (e.g., stored during signup/onboarding)
            const userContactInfo = localStorage.getItem("userContact"); // Adjust this to your key

            if (!userContactInfo) return; // Not subscribed/registered

            // 2. Query your 'contacts' table to see if they are active
            const { data, error } = await supabase
                .from("contacts")
                .select("is_active") // Assuming you have a column like this
                .eq("contact_info", userContactInfo)
                .single();

            if (error || !data || !data.is_active) {
                console.log(
                    "User is not a subscribed contact. Skipping alert.",
                );
                return;
            }

            // 3. If they are a valid contact, trigger the effects
            sendLocalNotification(waterLevel);
            triggerAlertEffects(waterLevel);
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
            if ("vibrate" in navigator) {
                window.navigator.vibrate([1000, 100, 1000, 100, 1000]);
            }

            if (sirenRef.current) {
                sirenRef.current.currentTime = 0;
                sirenRef.current.volume = 1.0;
                sirenRef.current
                    .play()
                    .catch((e) => console.log("Siren blocked:", e));
            }

            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const msg = new SpeechSynthesisUtterance();
                msg.text = `WARNING! Water level has reached ${level} meters!`;
                setTimeout(() => {
                    window.speechSynthesis.speak(msg);
                }, 2000);
            }
        };

        // Real-time listener
        const channel = supabase
            .channel("water_alerts_room")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "water_alerts" },
                (payload) => {
                    const { water_level } = payload.new;
                    // Check subscription BEFORE alerting
                    checkSubscriptionAndNotify(water_level);
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
