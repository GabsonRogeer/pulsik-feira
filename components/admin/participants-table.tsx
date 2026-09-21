import { participationStatus } from "@/lib/campaign";
import { formatPhone } from "@/lib/phone";
import { Search } from "lucide-react";

import { PRIZES } from "@/lib/config";
import type { AdminModel } from "./use-admin";
export function ParticipantsTable({ model }: { model: AdminModel }) {
  const { query, setQuery, visible, statusFilter, setStatusFilter } = model;
  return (
    <section className="glass participants-panel">
      <div className="table-heading">
        <h2>Participantes</h2>
        <label className="search-label">
          <Search size={17} />
          <input
            aria-label="Buscar participante"
            placeholder="Nome, e-mail, telefone ou código"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="participant-filters">
        <label>
          Etapa
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos os cadastros</option>
            <option value="waiting">Aguardando primeiro giro</option>
            <option value="retry">Nova chance disponível</option>
            <option value="complete">Resultado final</option>
          </select>
        </label>
        <p>
          O cadastro aparece aqui antes do giro. O código CAD identifica o
          cadastro; o código PUL ou TST autoriza a retirada na campanha
          correspondente.
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Participante</th>
              <th>Empresa / Cargo</th>
              <th>Telefone</th>
              <th>Etapa / Resultado</th>
              <th>Retirada</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <small>{r.email}</small>
                  <small>{r.registration_code}</small>
                </td>
                <td>
                  {r.company}
                  <small>{r.job_title}</small>
                </td>
                <td>{r.phone ? formatPhone(r.phone) : "Não informado"}</td>
                <td>
                  {participationStatus(r)}
                  {r.outcome && (
                    <small>
                      {PRIZES.find((p) => p.id === r.outcome)?.label}
                    </small>
                  )}
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
