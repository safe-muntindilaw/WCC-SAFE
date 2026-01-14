import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // Keep session in localStorage
        autoRefreshToken: true, // Automatically refresh access tokens
        detectSessionInUrl: true, // Needed for OAuth/password recovery
        storage: window.localStorage, // PWA-safe storage
    },
});

export default supabase;
