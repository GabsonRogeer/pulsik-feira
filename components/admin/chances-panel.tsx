import { PRIZES } from "@/lib/config";
import { parseChancesDraft } from "@/lib/chances";
import type { AdminModel } from "./use-admin";

export function ChancesPanel({ model }: { model: AdminModel }) {
  const {
    campaign,
    testing,
    chancesDraft,
    setChancesDraft,
    saveChances,
    saving,
    redeeming,
  } = model;
  const valid = parseChancesDraft(chancesDraft);
  const total =
    PRIZES.reduce((sum, { id }) => {
      const value = Number((chancesDraft[id] ?? "").replace(",", "."));
      return sum + (Number.isFinite(value) ? Math.round(value * 100) : 0);
    }, 0) / 100;
  const changed = PRIZES.some(
    ({ id }) =>
      Number((chancesDraft[id] ?? "").replace(",", ".")) !==
      campaign?.chances[id],
  );
  return (
    <section className="glass chances-panel">
      <h2>Chances da roleta · {testing ? "teste" : "feira"}</h2>
      <p>
        Ajuste as porcentagens por giro. As mudanças valem para os próximos
        giros desta campanha.
      </p>
      <form onSubmit={saveChances}>
        <div className="chances-fields">
          {PRIZES.map((prize) => (
            <label key={prize.id} htmlFor={`chance-${prize.id}`}>
              {prize.label} (%)
              <input
                id={`chance-${prize.id}`}
                type="number"
                inputMode="decimal"
                min="0"
                max={prize.id === "retry" ? "99.99" : "100"}
                step="0.01"
                required
                disabled={saving || redeeming}
                aria-describedby="chances-total chances-help"
                value={chancesDraft[prize.id] ?? ""}
                onChange={(e) =>
                  setChancesDraft((old) => ({
                    ...old,
                    [prize.id]: e.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <p
          id="chances-total"
          role="status"
          className={valid ? "chances-valid" : "chances-invalid"}
        >
          Total: {total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
          de 100%
          {!valid && " · Ajuste os valores para salvar."}
        </p>
        <p id="chances-help">
          A soma deve ser 100%. “Tente outra vez” deve ficar abaixo de 100% para
          permitir um resultado final. Se um produto esgotar, sua chance passa
          para “Não foi dessa vez”.
        </p>
        <button
          className="button secondary stock-save"
          disabled={saving || redeeming || !changed || !valid}
        >
          {saving ? "Salvando…" : "Salvar porcentagens"}
        </button>
      </form>
    </section>
  );
}
