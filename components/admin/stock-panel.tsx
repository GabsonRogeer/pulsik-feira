import { PRIZES } from "@/lib/config";
import type { AdminModel } from "./use-admin";
export function StockPanel({ model }: { model: AdminModel }) {
  const {
    stock,
    stockDraft,
    setStockDraft,
    saveStock,
    saving,
    redeeming,
    testing,
  } = model;
  const changed = stock.some((s) => String(s.remaining) !== stockDraft[s.id]);
  return (
    <section className="glass stock-panel">
      <h2>{testing ? "Estoque de teste" : "Estoque da feira"}</h2>
      <p>
        Edite a quantidade disponível para novos giros. Prêmios já concedidos
        continuam reservados.
      </p>
      <form onSubmit={saveStock}>
        {stock.map((item) => {
          const prize = PRIZES.find((p) => p.id === item.id)!;
          return (
            <div className="stock-row" key={item.id}>
              <label htmlFor={"stock-" + item.id}>
                {prize.label}
                <small>
                  {item.initial_stock - item.remaining} concedidos ·{" "}
                  {item.initial_stock} no total
                </small>
              </label>
              <input
                id={"stock-" + item.id}
                className="stock-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="100000"
                step="1"
                required
                disabled={saving || redeeming}
                value={stockDraft[item.id] ?? ""}
                onChange={(e) =>
                  setStockDraft((old) => ({
                    ...old,
                    [item.id]: e.target.value,
                  }))
                }
              />
              <div className="stock-track">
                <i
                  style={{
                    width: `${item.initial_stock ? (item.remaining / item.initial_stock) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
        <button
          className="button secondary stock-save"
          disabled={saving || redeeming || !changed}
        >
          {saving ? "Salvando…" : "Salvar estoque disponível"}
        </button>
      </form>
    </section>
  );
}
