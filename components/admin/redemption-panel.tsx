import { Search } from "lucide-react";

import { PRIZES } from "@/lib/config";
import type { AdminModel } from "./use-admin";
export function RedemptionPanel({ model }: { model: AdminModel }) {
  const {
    demo,
    code,
    setCode,
    selected,
    setSelected,
    redeeming,
    lookup,
    redeem,
  } = model;
  return (
    <section className="glass redeem-panel">
      <h2>Conferir retirada</h2>
      <p>Consulte o código e confirme a entrega do brinde.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup();
        }}
      >
        <label>
          Código do participante
          <input
            placeholder={demo ? "DEMO-7F3A92" : "PUL-…"}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setSelected(null);
            }}
            required
          />
        </label>
        <button className="button secondary">
          <Search size={18} /> Consultar código
        </button>
      </form>
      {selected && (
        <div className="claim-review">
          <strong>{selected.name}</strong>
          <span>{PRIZES.find((p) => p.id === selected.outcome)?.label}</span>
          {selected.redeemed_at ? (
            <p className="success-text">
              Já retirado ·{" "}
              {new Date(selected.redeemed_at).toLocaleString("pt-BR")}
            </p>
          ) : (
            <button
              className="button primary"
              onClick={redeem}
              disabled={redeeming}
            >
              {redeeming ? "Registrando…" : "Confirmar entrega do brinde"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
