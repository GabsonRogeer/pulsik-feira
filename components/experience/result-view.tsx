import {
  ArrowRight,
  Check,
  Copy,
  Globe,
  Instagram,
  Linkedin,
  LogOut,
  RotateCw,
  Ticket,
} from "lucide-react";
import { SOCIALS } from "@/lib/config";
import { PrizeIcon } from "@/components/prize-icon";

import type { ExperienceModel } from "./use-experience";
export function ResultView({ model }: { model: ExperienceModel }) {
  const {
    demo,
    testing,
    participant,
    copied,
    heading,
    logout,
    won,
    prize,
    copyClaimCode,
  } = model;
  if (!participant) return null;
  return (
    <main className="result-layout">
      <section className="result-intro">
        <div className="eyebrow">
          {won ? "ESSA CONEXÃO DEU SORTE" : "FOI BOM CONECTAR COM VOCÊ"}
        </div>
        <div className={"result-emblem " + (!won ? "no-win" : "")}>
          <PrizeIcon outcome={participant.outcome || "none"} size={52} />
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {won ? (
            <>
              Deu match
              <br />
              com a <em>sorte!</em>
            </>
          ) : (
            <>
              A conexão
              <br />
              já <em>valeu.</em>
            </>
          )}
        </h1>
        <p className="lead">
          Obrigado por conhecer nosso estande
          <br />
          aqui no Siará Tech Summit, {participant.name.split(" ")[0]}!
        </p>
        <p className="result-copy">
          {won ? (
            <>
              Parabéns! Você ganhou{" "}
              <strong>{prize?.label.toLowerCase()}</strong>.<br />
              Uma lembrança da Pulsik para levar com você.
            </>
          ) : (
            <>
              Não foi dessa vez na roleta, mas foi um prazer receber você.
              Continue por perto: ainda temos muito para compartilhar.
            </>
          )}
        </p>
      </section>
      <div className="result-right">
        {won && (
          <section className="glass prize-ticket">
            <div className="ticket-top">
              <span>
                <Ticket size={17} /> SEU PRESENTE
              </span>
              <span className="status-pill">
                {participant.redeemed_at
                  ? "Retirado"
                  : "Reservado" + (demo || testing ? " · teste" : "")}
              </span>
            </div>
            <h2>{prize?.label}</h2>
            <p>
              {testing
                ? "Este resultado é de teste e não dá direito à retirada de um brinde real. A equipe pode simular a entrega no painel de testes."
                : "Você pode retirar agora ou depois, no estande da Pulsik, durante o evento de 7 a 9 de outubro."}
            </p>
            <div className="ticket-divider" />
            <span className="field-caption">CÓDIGO DE RETIRADA</span>
            <div className="claim-code">
              <strong>{participant.claim_code}</strong>
              <button
                className="icon-button"
                aria-label="Copiar código de retirada"
                onClick={copyClaimCode}
              >
                {copied ? <Check size={21} /> : <Copy size={21} />}
              </button>
            </div>
            <p className="ticket-hint">
              {demo || testing
                ? "Código demonstrativo. Não dá direito à retirada de brinde."
                : "Apresente este código à nossa equipe. Você pode voltar a esta página com a mesma conta ou e-mail."}
            </p>
            {copied && (
              <p role="status" className="success-text">
                Código copiado!
              </p>
            )}
          </section>
        )}
        <section className="glass social-card">
          <span className="eyebrow">A CONEXÃO CONTINUA</span>
          <h2>
            Siga a Pulsik para mais<span>.</span>
          </h2>
          <p>
            Ideias, inteligência artificial e novas possibilidades para o seu
            negócio.
          </p>
          <div className="social-links">
            <a
              href={SOCIALS.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={21} /> Instagram <ArrowRight size={16} />
            </a>
            <a
              href={SOCIALS.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Linkedin size={21} /> LinkedIn <ArrowRight size={16} />
            </a>
          </div>
          <a
            className="text-link"
            href={SOCIALS.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe size={16} /> Conheça nosso universo
          </a>
        </section>
        <button className="text-button reset" onClick={logout}>
          {demo ? (
            <>
              <RotateCw size={15} /> Testar novamente
            </>
          ) : (
            <>
              <LogOut size={15} /> Sair da minha conta
            </>
          )}
        </button>
      </div>
    </main>
  );
}
