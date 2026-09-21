import {
  TEST_CAMPAIGN,
  participationStatus,
  type CampaignId,
} from "./campaign";
import { formatPhone } from "./phone";
import { CAMPAIGN, PRIZES, type Participant } from "./config";
export function exportParticipantsCSV(
  rows: Participant[],
  demo: boolean,
  campaign: CampaignId = CAMPAIGN,
) {
  const cell = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const headings = [
    "Campanha",
    "Código de cadastro",
    "Etapa",
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
    campaign,
    r.registration_code,
    participationStatus(r),
    r.name,
    r.company,
    r.job_title,
    r.email,
    r.phone ? formatPhone(r.phone) : "",
    r.marketing ? "Sim" : "Não",
    PRIZES.find((p) => p.id === r.outcome)?.label || "Aguardando giro",
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
  a.download = demo
    ? "pulsik-demonstracao.csv"
    : campaign === TEST_CAMPAIGN
      ? "pulsik-testes.csv"
      : "pulsik-participantes.csv";
  a.click();
  URL.revokeObjectURL(url);
}
