import type { SupabaseClient } from "@supabase/supabase-js";
export const ADMIN_USERNAME = "pulsikadmin";
export const ADMIN_EMAIL = "pulsikadmin@admin.pulsik.com.br";
export async function signInAdmin(
  client: SupabaseClient,
  username: string,
  password: string,
) {
  if (username.trim().toLowerCase() !== ADMIN_USERNAME || !password)
    throw new Error("invalid_credentials");
  const { data, error } = await client.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("invalid_credentials");
  const { data: allowed, error: roleError } =
    await client.rpc("pulsik_is_admin");
  if (roleError || !allowed) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("admin_required");
  }
}
