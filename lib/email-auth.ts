import type { SupabaseClient } from "@supabase/supabase-js";
type AuthClient = Pick<SupabaseClient["auth"], "signInWithOtp" | "verifyOtp">;
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("invalid_email");
  return email;
}
export async function sendEmailCode(auth: AuthClient, value: string) {
  const email = normalizeEmail(value);
  const { error } = await auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
  return email;
}
export async function verifyEmailCode(
  auth: AuthClient,
  email: string,
  value: string,
) {
  const token = value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) throw new Error("invalid_code");
  const { data, error } = await auth.verifyOtp({
    email: normalizeEmail(email),
    token,
    type: "email",
  });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("missing_session");
  return data.user;
}
export function emailAuthError(error: unknown) {
  const e = error as { code?: string; message?: string; status?: number };
  const message = e?.message || "";
  if (message === "invalid_email" || e?.code === "email_address_invalid")
    return "Informe um e-mail válido.";
  if (message === "invalid_code")
    return "Digite os 6 números do código recebido.";
  if (e?.code === "otp_expired" || /expired|invalid.*token/i.test(message))
    return "Código inválido ou expirado. Confira o e-mail mais recente ou solicite outro código.";
  if (e?.status === 429 || e?.code?.includes("rate_limit"))
    return "Muitas tentativas. Aguarde um pouco antes de tentar novamente.";
  if (
    e?.code === "email_provider_disabled" ||
    e?.code === "email_address_not_authorized" ||
    /sending.*email/i.test(message)
  )
    return "O envio de códigos está indisponível no momento. Tente entrar com Google ou procure nossa equipe.";
  return "Não foi possível concluir o acesso. Confira sua conexão e tente novamente.";
}
