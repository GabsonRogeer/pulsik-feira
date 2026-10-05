import {
  ArrowRight,
  Gift,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import { EmailLogin } from "./email-login";
import type { ExperienceModel } from "./use-experience";
export function WelcomeCard({ model }: { model: ExperienceModel }) {
  const { demo, busy, initializing, login, emailLogin, enterGuest } = model;
  return (
    <div className="glass entry-card">
      <div className="card-heading">
        <div className="icon-tile">
          <Gift size={23} />
        </div>
        <div>
          <h2>Uma conexão. Uma surpresa.</h2>
          <p>
            {demo
              ? "Explore a experiência antes da feira."
              : "Entre para participar da roleta Pulsik."}
          </p>
        </div>
      </div>
      <button
        className="button google"
        disabled={busy || initializing || emailLogin.busy}
        onClick={login}
      >
        {busy || initializing ? (
          <LoaderCircle className="spin-icon" size={20} />
        ) : demo ? (
          <Sparkles size={20} />
        ) : (
          <span className="google-g">G</span>
        )}
        {initializing
          ? "Conectando…"
          : demo
            ? "Experimentar a roleta"
            : "Continuar com Google"}
        <ArrowRight size={18} />
      </button>
      {!demo && (
        <>
          <EmailLogin model={emailLogin} disabled={busy || initializing} />
          <div className="guest-login">
            <div className="auth-divider">
              <span>ou</span>
            </div>
            <button
              className="button secondary"
              disabled={busy || initializing || emailLogin.busy}
              onClick={enterGuest}
            >
              <UserRound size={19} />
              Entrar como convidado
              <ArrowRight size={18} />
            </button>
            <p className="input-note">
              Preencha seu cadastro e participe sem esperar um código por
              e-mail.
            </p>
          </div>
        </>
      )}
      <p className="fine">
        <ShieldCheck size={15} />
        {demo
          ? "Na feira, acesso com Google, e-mail ou como convidado."
          : "Uma participação por conta/e-mail durante o evento."}
      </p>
    </div>
  );
}
