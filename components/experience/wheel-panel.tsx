import { ArrowRight, RotateCw, Sparkles } from "lucide-react";
import { PRIZES } from "@/lib/config";

import { Wheel } from "@/components/wheel";

import type { ExperienceModel } from "./use-experience";
export function WheelPanel({ model }: { model: ExperienceModel }) {
  const { step, bonus, rotation, spinning, spin } = model;
  return (
    <section className="wheel-section" aria-label="Prêmios da roleta">
      <div className="orbit-caption">
        <Sparkles size={16} /> SUA SORTE CONECTA AQUI
      </div>
      <Wheel rotation={rotation} spinning={spinning} />
      {step === "wheel" ? (
        <div className="spin-action">
          <button
            className="button primary spin-button"
            onClick={spin}
            disabled={spinning}
          >
            <RotateCw size={20} className={spinning ? "spin-icon" : ""} />
            {spinning
              ? "Sua surpresa está chegando…"
              : bonus
                ? "Girar mais uma vez"
                : "Girar minha sorte"}
            {!spinning && <ArrowRight size={18} />}
          </button>
          <p className="wheel-note" role="status" aria-live="polite">
            {spinning
              ? "Aguarde o resultado."
              : bonus
                ? "Você ganhou uma nova chance!"
                : "Um giro inicial. Uma participação por conta."}
          </p>
        </div>
      ) : (
        <>
          <div className="glass wheel-caption">
            <span className="small-spark">✦</span>
            <div>
              <strong>Gire. Surpreenda-se. Leve com você.</strong>
              <p>Copo, chaveiro e caneta personalizados.</p>
            </div>
          </div>
          <p className="wheel-note">Pequenos presentes. Grandes conexões.</p>
        </>
      )}
      <details className="odds">
        <summary>Chances e regras da roleta</summary>
        <ul>
          {PRIZES.map((p) => (
            <li key={p.id}>
              <span>{p.label}</span>
              <b>{p.chance}%</b>
            </li>
          ))}
        </ul>
        <p>
          As fatias ilustram os resultados; não representam suas chances. Se um
          brinde acabar, sua chance passa para “Não foi dessa vez”. “Tente outra
          vez” libera um novo giro.
        </p>
      </details>
    </section>
  );
}
