import { formatPhone } from "./phone";
import { PRIZES, type Participant } from "./config";
export function exportParticipantsCSV(rows: Participant[], demo: boolean) {
  const cell = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const headings = [
    "Nome",
    "Empresa",
    "Cargo",
    "E-mail",
    "Telefone",
    "Aceita novidades",
    "Resultado",
    "Código",
    "Retirado em",
  ];
  const data = rows.map((r) => [
    r.name,
    r.company,
    r.job_title,
    r.email,
    r.phone ? formatPhone(r.phone) : "",
    r.marketing ? "Sim" : "Não",
    PRIZES.find((p) => p.id === r.outcome)?.label || "Não girou",
    r.claim_code,
    r.redeemed_at,
  ]);
  const blob = new Blob(
    [
      "\uFEFF" +
        [headings, ...data].map((row) => row.map(cell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = demo ? "pulsik-demonstracao.csv" : "pulsik-participantes.csv";
  a.click();
  URL.revokeObjectURL(url);
}
