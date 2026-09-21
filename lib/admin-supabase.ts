import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Separate admin sessions from participant Google/email sessions.
export const adminSupabase =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "pulsik-admin-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
