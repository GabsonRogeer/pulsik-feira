import { CAMPAIGN } from "./config";
import type { Chances } from "./chances";
export const TEST_CAMPAIGN = "siara-2026-test";
export type CampaignId = typeof CAMPAIGN | typeof TEST_CAMPAIGN;
export type CampaignInfo = {
  id: CampaignId;
  active: boolean;
  starts_at: string;
  ends_at: string;
  chances: Chances;
};
export type StockItem = {
  id: "cup" | "keychain" | "pen";
  initial_stock: number;
  remaining: number;
};
export function campaignFromRequest(request: Request): CampaignId {
  const value = new URL(request.url).searchParams.get("campaign") ?? CAMPAIGN;
  if (value !== CAMPAIGN && value !== TEST_CAMPAIGN)
    throw new Error("invalid_request");
  return value;
}
export function campaignApi(path: string, campaign: CampaignId) {
  return `${path}?campaign=${encodeURIComponent(campaign)}`;
}
export function participationStatus(row: {
  status: string;
  outcome: string | null;
  spin_count?: number;
}) {
  if (row.status === "ready")
    return row.spin_count ? "Nova chance disponível" : "Aguardando giro";
  return row.outcome === "none" ? "Sem prêmio" : "Premiado";
}
