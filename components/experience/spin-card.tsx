import { ShieldCheck, Ticket } from "lucide-react";
import { PRIZES, type Outcome } from "@/lib/config";
import { PrizeIcon } from "@/components/prize-icon";

import type { ExperienceModel } from "./use-experience";
export function SpinCard({ model }: { model: ExperienceModel }) {
  const { demo, bonus, spinning, selection, setSelection, stock, logout } =
    model;
  return (
    <div className="glass spin-card">
      <div className="card-heading">
        <div className="icon-tile">
          <Ticket size={23} />
        </div>
        <div>
          <h2>
            {bonus ? "A sorte pediu mais um giro!" : "Seu giro está liberado."}
          </h2>
          <p>
            {bonus
              ? "Caiu “Tente outra vez”. Você tem uma nova chance."
              : "Toque no botão e descubra sua surpresa."}
          </p>
        </div>
      </div>
      <div className="prize-list">
        {PRIZES.slice(0, 3).map((p) => (
          <div key={p.id}>
            <PrizeIcon outcome={p.id} size={18} />
            <span>{p.label}</span>
            {stock[p.id] === 0 ? (
              <small>Esgotado</small>
            ) : p.id === "cup" ? (
              <small>Mais raro</small>
            ) : null}
          </div>
        ))}
      </div>
      <p className="fine">
        <ShieldCheck size={15} /> O resultado fica salvo para você.
      </p>
      {demo && (
        <details className="demo-controls">
          <summary>Opções para testar a demonstração</summary>
          <label>
            Resultado do próximo giro
            <select
              value={selection}
              disabled={spinning}
              onChange={(e) =>
                setSelection(e.target.value as Outcome | "random")
              }
            >
              <option value="random">Aleatório</option>
              {PRIZES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </details>
      )}
      <button
        className="text-button logout"
        disabled={spinning}
        onClick={logout}
      >
        {demo ? "Reiniciar demonstração" : "Sair da conta"}
      </button>
    </div>
  );
}
