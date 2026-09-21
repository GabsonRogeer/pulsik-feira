import { signIn } from "next-auth/react";
export async function signInAdmin(username: string, password: string) {
  if (!username.trim() || !password) throw new Error("invalid_credentials");
  const result = await signIn("admin", {
    username: username.trim(),
    password,
    redirect: false,
  });
  if (!result || result.error) throw new Error("invalid_credentials");
}
export function adminLoginError(_error?: unknown) {
  return "Não foi possível entrar. Confira o usuário e a senha ou aguarde alguns minutos antes de tentar novamente.";
}
