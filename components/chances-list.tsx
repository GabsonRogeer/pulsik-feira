"use client";
import { useEffect, useState } from "react";
import { CAMPAIGN, PRIZES } from "@/lib/config";
import { campaignApi, type CampaignId } from "@/lib/campaign";
import { DEFAULT_CHANCES, validChances, type Chances } from "@/lib/chances";
import { api } from "@/lib/api-client";

export function ChancesList({
  campaign = CAMPAIGN,
  demo = false,
}: {
  campaign?: CampaignId;
  demo?: boolean;
}) {
  const [chances, setChances] = useState<Chances | null>(
    demo ? DEFAULT_CHANCES : null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (demo) {
      setChances(DEFAULT_CHANCES);
      return;
    }
    let active = true;
    let sequence = 0;
    setChances(null);
    setFailed(false);
    async function refresh() {
      const request = ++sequence;
      try {
        const data = await api<{ chances: Chances }>(
          campaignApi("/api/chances", campaign),
        );
        if (!validChances(data.chances)) throw new Error("invalid_chances");
        if (active && request === sequence) {
          setChances(data.chances);
          setFailed(false);
        }
      } catch {
        if (active && request === sequence) {
          setChances(null);
          setFailed(true);
        }
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [campaign, demo]);
  if (!chances)
    return (
      <p role="status">
        {failed
          ? "Não foi possível carregar as chances. Tente atualizar a página."
          : "Carregando chances…"}
      </p>
    );
  return (
    <ul>
      {PRIZES.map((p) => (
        <li key={p.id}>
          <span>{p.label}</span> <b>{chances[p.id].toLocaleString("pt-BR")}%</b>
        </li>
      ))}
    </ul>
  );
}
