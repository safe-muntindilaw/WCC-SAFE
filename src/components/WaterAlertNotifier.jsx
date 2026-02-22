import { useEffect, useRef } from "react";
import { supabase } from "@/globals";

const WaterAlertNotifier = () => {
    const sirenRef = useRef(null);

    useEffect(() => {
        sirenRef.current = new Audio("/siren.mp3");

        const checkSubscriptionAndNotify = async (waterLevel) => {
            // 1. Get the current logged-in user session
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                console.log(
                    "No logged-in user detected. Notification skipped.",
                );
                return;
            }

            // 2. Query the contacts table using the user's UUID
            const { data: contact, error } = await supabase
                .from("contacts")
                .select("subscribed")
                .eq("user_id", user.id)
                .single();

            if (error) {
                console.error(
                    "Error checking subscription status:",
                    error.message,
                );
                return;
            }

            // 3. Conditional Alerting: Only if 'subscribed' is true
            if (contact && contact.subscribed === true) {
                console.log("User is subscribed. Dispatching alerts...");
                sendLocalNotification(waterLevel);
                triggerAlertEffects(waterLevel);
            } else {
                console.log(
                    "User is logged in but has notifications disabled.",
                );
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
            if ("vibrate" in navigator) {
                window.navigator.vibrate([1000, 100, 1000, 100, 1000]);
            }

            if (sirenRef.current) {
                let playCount = 0;
                const maxPlays = 3;

                const playNext = () => {
                    if (playCount >= maxPlays) {
                        sirenRef.current.removeEventListener("ended", onEnded);
                        return;
                    }
                    playCount++;
                    sirenRef.current.currentTime = 0;
                    sirenRef.current.volume = 1.0;
                    sirenRef.current.play().catch(() => {});
                };

                const onEnded = () => {
                    // Wait 2 seconds between each siren play
                    setTimeout(playNext, 2000);
                };

                sirenRef.current.removeEventListener("ended", onEnded);
                sirenRef.current.addEventListener("ended", onEnded);
                playNext(); // start first play
            }

            if ("speechSynthesis" in window) {
                window.speechSynthesis.cancel();
                const message = `Warning! Water level has reached ${level} meters!`;

                let voiceCount = 0;
                const maxVoicePlays = 3;

                const speakNext = () => {
                    if (voiceCount >= maxVoicePlays) return;
                    voiceCount++;

                    const msg = new SpeechSynthesisUtterance(message);
                    msg.onend = () => {
                        setTimeout(speakNext, 2000);
                    };
                    window.speechSynthesis.speak(msg);
                };
                setTimeout(speakNext, 2000);
            }
        };

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
