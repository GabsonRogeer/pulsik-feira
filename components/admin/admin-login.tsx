import { ShieldCheck, LoaderCircle } from "lucide-react";
import type { AdminModel } from "./use-admin";
export function AdminLogin({ model }: { model: AdminModel }) {
  const { username, setUsername, password, setPassword, signingIn, login } =
    model;
  return (
    <section className="glass access-card">
      <ShieldCheck size={34} />
      <h2>Acesso exclusivo da equipe</h2>
      <p>Entre com seu usuário e senha.</p>
      <form className="admin-login-form" onSubmit={login}>
        <label htmlFor="admin-username">
          Usuário
          <input
            id="admin-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={signingIn}
          />
        </label>
        <label htmlFor="admin-password">
          Senha
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={signingIn}
          />
        </label>
        <button className="button primary" disabled={signingIn}>
          {signingIn && <LoaderCircle size={18} className="spin-icon" />}
          {signingIn ? "Entrando…" : "Entrar no painel"}
        </button>
      </form>
    </section>
  );
}
