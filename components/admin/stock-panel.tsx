import { PRIZES } from "@/lib/config";
import type { AdminModel } from "./use-admin";
export function StockPanel({ model }: { model: AdminModel }) {
  const { remaining } = model;
  return (
    <section className="glass stock-panel">
      <h2>Brindes disponíveis</h2>
      <p>O estoque baixa quando o prêmio é concedido.</p>
      {PRIZES.slice(0, 3).map((p) => (
        <div className="stock-row" key={p.id}>
          <span>{p.label}</span>
          <strong>
            {remaining[p.id as keyof typeof remaining]}{" "}
            <small>/ {p.stock}</small>
          </strong>
          <div className="stock-track">
            <i
              style={{
                width: `${(remaining[p.id as keyof typeof remaining] / p.stock!) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}
