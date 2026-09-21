import { formatPhone } from "@/lib/phone";
import { Search } from "lucide-react";

import { PRIZES } from "@/lib/config";
import type { AdminModel } from "./use-admin";
export function ParticipantsTable({ model }: { model: AdminModel }) {
  const { query, setQuery, visible } = model;
  return (
    <section className="glass participants-panel">
      <div className="table-heading">
        <h2>Participantes</h2>
        <label className="search-label">
          <Search size={17} />
          <input
            aria-label="Buscar participante"
            placeholder="Nome, e-mail, empresa ou código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              <th>Empresa / Cargo</th>
              <th>Telefone</th>
              <th>Resultado</th>
              <th>Retirada</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                </td>
                <td>
                  {r.company}
                  <small>{r.job_title}</small>
                </td>
                <td>{r.phone ? formatPhone(r.phone) : "Não informado"}</td>
                <td>
                  {PRIZES.find((p) => p.id === r.outcome)?.label || "Não girou"}
                  <small>{r.claim_code}</small>
                </td>
                <td>
                  {r.redeemed_at ? (
                    <span className="status-pill">Retirado</span>
                  ) : r.claim_code ? (
                    "Pendente"
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="empty-state">Nenhum participante encontrado.</p>
        )}
      </div>
    </section>
  );
}
