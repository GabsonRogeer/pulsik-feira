import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { formatPhone } from "@/lib/phone";

import type { ExperienceModel } from "./use-experience";
export function RegistrationForm({ model }: { model: ExperienceModel }) {
  const { demo, user, busy, register, logout } = model;
  return (
    <form className="glass form-card" onSubmit={register}>
      <div className="signed-in">
        <ShieldCheck size={17} />
        <span>{demo ? "Cadastro de demonstração" : user?.email}</span>
        {!demo && (
          <button type="button" className="text-button" onClick={logout}>
            Trocar
          </button>
        )}
      </div>
      <div className="form-grid">
        <label className="full">
          Nome
          <input
            name="name"
            autoComplete="name"
            defaultValue={demo ? "" : user?.name || ""}
            placeholder="Como podemos chamar você?"
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label>
          Empresa
          <input
            name="company"
            autoComplete="organization"
            placeholder="Sua empresa"
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          Cargo
          <input
            name="job_title"
            autoComplete="organization-title"
            placeholder="Seu cargo"
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="full">
          E-mail
          <input
            name="email"
            type="email"
            value={demo ? "visitante@exemplo.com" : user?.email || ""}
            readOnly
            aria-describedby="email-note"
          />
        </label>
        <span id="email-note" className="input-note full">
          {demo
            ? "Usamos um e-mail fictício nesta demonstração."
            : "E-mail verificado no seu acesso."}
        </span>
        <label className="full">
          Telefone
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Ex.: (99) 99999-0000"
            required
            minLength={15}
            maxLength={15}
            onChange={(event) => {
              event.currentTarget.value = formatPhone(
                event.currentTarget.value,
              );
            }}
            aria-describedby="phone-note"
          />
        </label>
        <span id="phone-note" className="input-note full">
          Informe o DDD e os 9 dígitos do telefone.
        </span>
      </div>
      <label className="checkbox">
        <input type="checkbox" name="marketing" />
        <span>
          Quero receber novidades e conteúdos da Pulsik.{" "}
          <small>Opcional.</small>
        </span>
      </label>
      <p className="form-privacy">
        Usamos estes dados para gerenciar sua participação e a entrega do
        prêmio.{" "}
        <a href="/privacidade/" target="_blank">
          Saiba mais
        </a>
        .
      </p>
      <button className="button primary" disabled={busy}>
        {busy ? <LoaderCircle className="spin-icon" size={18} /> : null}
        {busy ? "Salvando…" : "Liberar meu giro"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
