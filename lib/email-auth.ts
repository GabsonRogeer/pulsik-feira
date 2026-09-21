import { signIn, getSession } from "next-auth/react";
import { api, type LoginUser } from "./api-client";
export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("invalid_email");
  return email;
}
export async function sendEmailCode(value: string) {
  const email = normalizeEmail(value);
  await api("/api/email-code", { email });
  return email;
}
export async function verifyEmailCode(
  email: string,
  value: string,
): Promise<LoginUser> {
  const code = value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) throw new Error("invalid_code");
  const result = await signIn("email-code", {
    email: normalizeEmail(email),
    code,
    redirect: false,
  });
  if (!result || result.error) throw new Error("invalid_code");
  const session = await getSession();
  if (!session?.user?.email) throw new Error("missing_session");
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
export function emailAuthError(error: unknown) {
  const e = error as { message?: string; status?: number };
  if (e?.message === "invalid_email") return "Informe um e-mail válido.";
  if (e?.message === "invalid_code")
    return "Código inválido ou expirado. Confira o e-mail mais recente ou solicite outro código.";
  if (e?.status === 429)
    return "Muitas tentativas. Aguarde um pouco para tentar novamente.";
  if (e?.message === "email_unavailable")
    return "O envio de códigos está indisponível. Tente entrar com Google ou procure nossa equipe.";
  return "Não foi possível concluir o acesso. Confira sua conexão e tente novamente.";
}
