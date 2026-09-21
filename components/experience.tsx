"use client";
import { ArrowRight, Sparkles } from "lucide-react";

import { Header, Footer } from "@/components/shell";
import { useExperience } from "./experience/use-experience";
import { ResultView } from "./experience/result-view";
import { WelcomeCard } from "./experience/welcome-card";
import { RegistrationForm } from "./experience/registration-form";
import { SpinCard } from "./experience/spin-card";
import { WheelPanel } from "./experience/wheel-panel";
export function Experience({ forceDemo = false }: { forceDemo?: boolean }) {
  const model = useExperience(forceDemo);
  const { demo, step, participant, error, heading } = model;
  return (
    <>
      {demo && (
        <div className="demo-banner">
          <span>
            <Sparkles size={14} /> Demonstração · Sem cadastro real ou reserva
            de brindes
          </span>
          <a href="/admin/">
            Ver painel da equipe <ArrowRight size={13} />
          </a>
        </div>
      )}
      <Header />
      {step === "result" && participant ? (
        <ResultView model={model} />
      ) : (
        <main className={"experience stage-" + step}>
          <section className="intro">
            <div className="eyebrow">
              <span />{" "}
              {step === "welcome"
                ? "CONEXÕES QUE SURPREENDEM"
                : step === "form"
                  ? "VAMOS NOS CONHECER"
                  : "SEU MOMENTO CHEGOU"}
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {step === "welcome" ? (
                <>
                  O próximo giro
                  <br />
                  pode ser <em>seu.</em>
                </>
              ) : step === "form" ? (
                <>
                  Uma conexão.
                  <br />
                  Muitas <em>possibilidades.</em>
                </>
              ) : (
                <>
                  Um giro.
                  <br />
                  Uma <em>surpresa.</em>
                </>
              )}
            </h1>
            <p className="lead">
              {step === "welcome" ? (
                <>
                  Você já deu o primeiro passo para o futuro.
                  <br className="desktop-br" /> Agora, deixe a sorte fazer a
                  parte dela.
                </>
              ) : step === "form" ? (
                "Conte um pouco sobre você para liberar seu giro."
              ) : (
                "Cruzando os dedos por você, " +
                (participant?.name.split(" ")[0] || "visitante") +
                ". Seu próximo presente pode estar aqui."
              )}
            </p>
            <div className="steps" aria-label="Etapas da participação">
              <span
                className={
                  step === "welcome" || step === "form" ? "active" : "done"
                }
              >
                01 <b>Conecte-se</b>
              </span>
              <i />
              <span className={step === "wheel" ? "active" : ""}>
                02 <b>Gire</b>
              </span>
              <i />
              <span>
                03 <b>Descubra</b>
              </span>
            </div>
            {step === "welcome" && <WelcomeCard model={model} />}
            {step === "form" && <RegistrationForm model={model} />}
            {step === "wheel" && <SpinCard model={model} />}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <div className="event-caption">
              <span>07 — 09 OUT</span>
              <span>Um encontro com novas possibilidades.</span>
            </div>
          </section>
          <WheelPanel model={model} />
        </main>
      )}
      {step === "result" && error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <Footer />
    </>
  );
}
