import type { SupabaseClient } from "@supabase/supabase-js";
export const ADMIN_USERNAME = "pulsikadmin";
export const ADMIN_EMAIL = "pulsikadmin@pulsik.com.br";
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
    if (roleError) throw new Error("admin_check_failed");
    throw new Error("admin_required");
  }
}

export function adminLoginError(error: unknown) {
  const e = error as { status?: number; code?: string; message?: string };
  if (e?.status === 429)
    return "Muitas tentativas. Aguarde um pouco para entrar novamente.";
  if (e?.message === "admin_required")
    return "Login confirmado, mas esta conta não tem acesso administrativo. Execute o setup-admin.sql para a conta cadastrada.";
  if (e?.message === "admin_check_failed")
    return "Login confirmado, mas não foi possível verificar a permissão administrativa. Confira a função pulsik_is_admin no Supabase.";
  if (e?.code === "email_not_confirmed")
    return "O e-mail da conta administrativa ainda não foi confirmado no Supabase.";
  if (e?.code === "invalid_credentials" || e?.message === "invalid_credentials")
    return "Usuário ou senha incorretos. Confira os dados da conta administrativa.";
  if (e?.code === "email_provider_disabled")
    return "O acesso por senha está desabilitado no Supabase. Habilite o provedor Email.";
  return "Não foi possível conectar ao serviço de login. Confira sua conexão e tente novamente.";
}
