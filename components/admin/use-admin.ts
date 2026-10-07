"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CAMPAIGN, PRIZES, type Participant } from "@/lib/config";
import { parseChancesDraft } from "@/lib/chances";
import {
  campaignApi,
  TEST_CAMPAIGN,
  type CampaignId,
  type CampaignInfo,
  type StockItem,
} from "@/lib/campaign";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { signInAdmin, adminLoginError } from "@/lib/admin-auth";
import { exportParticipantsCSV } from "@/lib/export-participants";
const emptyStock = { cup: 0, keychain: 0, pen: 0 };
export function useAdmin() {
  const demo = false;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const loginLock = useRef(false);
  const operationLock = useRef(false);
  const accessVersion = useRef(0);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Participant[]>([]);
  const [campaignId, setCampaignId] = useState<CampaignId>(CAMPAIGN);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [chancesDraft, setChancesDraft] = useState<Record<string, string>>({});
  const [stockDraft, setStockDraft] = useState<Record<string, string>>({
    cup: "0",
    keychain: "0",
    pen: "0",
  });
  const [saving, setSaving] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const testing = campaignId === TEST_CAMPAIGN;
  const remaining = {
    ...emptyStock,
    ...Object.fromEntries(stock.map((x) => [x.id, x.remaining])),
  };
  async function refresh(target: CampaignId) {
    const version = ++accessVersion.current;
    setLoading(true);
    try {
      const data = await api<{
        rows: Participant[];
        stock: StockItem[];
        campaign: CampaignInfo;
      }>(campaignApi("/api/admin", target));
      if (version !== accessVersion.current) return;
      setAuthorized(true);
      setRows(data.rows);
      setStock(data.stock);
      setCampaign(data.campaign);
      setChancesDraft(
        Object.fromEntries(
          PRIZES.map(({ id }) => [id, String(data.campaign.chances[id])]),
        ),
      );
      setStockDraft(
        Object.fromEntries(data.stock.map((x) => [x.id, String(x.remaining)])),
      );
      setSelected(null);
      setCode("");
    } catch (e) {
      if (version !== accessVersion.current) return;
      setAuthorized(false);
      setRows([]);
      setSelected(null);
      setStock([]);
      setCampaign(null);
      if (![401, 403].includes((e as { status: number }).status))
        setMessage(
          "Não foi possível carregar o painel. Confira a conexão e se as migrações do banco foram executadas.",
        );
    } finally {
      if (version === accessVersion.current) setLoading(false);
    }
  }
  async function load() {
    await refresh(campaignId);
  }
  async function changeCampaign(target: CampaignId) {
    if (saving || redeeming || loading) return;
    setCampaignId(target);
    setRows([]);
    setSelected(null);
    setMessage("");
    setResetConfirmation("");
    setQuery("");
    setStatusFilter("all");
    setQrOpen(false);
    setQrUrl("");
    await refresh(target);
  }
  useEffect(() => {
    void refresh(CAMPAIGN);
    return () => {
      accessVersion.current++;
    };
  }, []);
  function lookup() {
    const found = rows.find(
      (r) => r.claim_code?.toUpperCase() === code.trim().toUpperCase(),
    );
    setSelected(found || null);
    setMessage(
      found
        ? ""
        : "Código de retirada não encontrado nesta campanha. Códigos CAD identificam cadastros e não autorizam a entrega.",
    );
  }
  async function redeem() {
    if (!selected || operationLock.current) return;
    operationLock.current = true;
    setRedeeming(true);
    try {
      const data = await api<{
        participant: Participant;
        already_redeemed: boolean;
      }>(campaignApi("/api/admin", campaignId), {
        action: "redeem",
        code: selected.claim_code,
      });
      setSelected(data.participant);
      setRows((old) =>
        old.map((r) =>
          r.id === data.participant.id ? { ...r, ...data.participant } : r,
        ),
      );
      setMessage(
        data.already_redeemed
          ? "Este prêmio já havia sido retirado."
          : testing
            ? "Retirada de teste registrada. Não entregue um brinde real."
            : "Retirada registrada com sucesso.",
      );
    } catch {
      setMessage(
        "Não foi possível registrar a retirada. Confira a conexão e se esta campanha está aberta.",
      );
    } finally {
      operationLock.current = false;
      setRedeeming(false);
    }
  }
  async function operate(payload: Record<string, unknown>, success: string) {
    if (operationLock.current) return;
    operationLock.current = true;
    setSaving(true);
    setMessage("");
    try {
      await api(campaignApi("/api/admin", campaignId), payload);
      setResetConfirmation("");
      await refresh(campaignId);
      setMessage(success);
    } catch (e) {
      const error = (e as Error).message;
      setMessage(
        error.includes("chances_changed")
          ? "As porcentagens foram alteradas por outra pessoa. Clique em Atualizar para conferir antes de salvar novamente."
          : error.includes("invalid_chances")
            ? "Informe porcentagens entre 0 e 100, com até duas casas decimais e soma de 100%. Tente outra vez deve ficar abaixo de 100%."
            : error.includes("stock_changed")
              ? "O estoque mudou enquanto você editava. Clique em Atualizar, confira os valores e tente novamente."
              : error.includes("invalid_stock")
                ? "Informe quantidades inteiras entre 0 e 100.000."
                : error.includes("reset_not_allowed")
                  ? "A limpeza exige a confirmação LIMPAR TESTES e só vale para a campanha de teste."
                  : "Não foi possível salvar. Confira sua sessão e tente novamente.",
      );
    } finally {
      operationLock.current = false;
      setSaving(false);
    }
  }
  async function saveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      stock.length !== 3 ||
      stock.some(
        (x) =>
          !/^\d+$/.test(stockDraft[x.id] || "") ||
          Number(stockDraft[x.id]) > 100000,
      )
    ) {
      setMessage("Informe quantidades inteiras entre 0 e 100.000.");
      return;
    }
    await operate(
      {
        action: "stock",
        stock: stock.map((x) => ({
          id: x.id,
          expected: x.remaining,
          remaining: Number(stockDraft[x.id]),
        })),
      },
      "Estoque atualizado. Os prêmios já concedidos foram preservados.",
    );
  }
  async function saveChances(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chances = parseChancesDraft(chancesDraft);
    if (!chances || !campaign) {
      setMessage(
        "As porcentagens devem somar 100%, com até duas casas decimais. Tente outra vez deve ficar abaixo de 100%.",
      );
      return;
    }
    await operate(
      { action: "chances", chances, expected: campaign.chances },
      "Porcentagens salvas. Os próximos giros desta campanha já usarão as novas chances.",
    );
  }
  async function toggleTests() {
    const open =
      campaign?.active &&
      Date.now() >= Date.parse(campaign.starts_at) &&
      Date.now() < Date.parse(campaign.ends_at);
    await operate(
      { action: "test_state", active: !open },
      open
        ? "Testes pausados."
        : "Testes ativados por 7 dias. Abra /teste para participar.",
    );
  }
  async function resetTests(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resetConfirmation !== "LIMPAR TESTES") return;
    await operate(
      { action: "reset_test", confirmation: resetConfirmation },
      "Dados de teste apagados, estoque de teste restaurado e testes pausados. Ative novamente para repetir. A campanha da feira foi preservada.",
    );
  }
  function exportCSV() {
    exportParticipantsCSV(rows, demo, campaignId);
  }
  const visible = rows.filter(
    (r) =>
      (statusFilter === "all" ||
        (statusFilter === "waiting"
          ? r.status === "ready" && !r.spin_count
          : statusFilter === "retry"
            ? r.status === "ready" && !!r.spin_count
            : r.status === "complete")) &&
      [
        r.name,
        r.email,
        r.company,
        r.phone,
        r.registration_code,
        r.claim_code,
      ].some((v) => v?.toLowerCase().includes(query.toLowerCase())),
  );
  const validQr = /^https:\/\/[^\s]+$/.test(qrUrl);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginLock.current) return;
    loginLock.current = true;
    setSigningIn(true);
    setMessage("");
    try {
      await signInAdmin(username, password);
      setPassword("");
      await load();
    } catch (e) {
      setAuthorized(false);
      setRows([]);
      setSelected(null);
      setMessage(adminLoginError(e));
    } finally {
      setPassword("");
      setSigningIn(false);
      loginLock.current = false;
    }
  }
  async function logout() {
    try {
      await signOut({ redirect: false });
    } catch {
      setMessage("Não foi possível sair. Tente novamente.");
      return;
    }
    accessVersion.current++;
    setAuthorized(false);
    setRows([]);
    setSelected(null);
    setMessage("");
    setPassword("");
    setStock([]);
    setCampaign(null);
  }
  return {
    username,
    setUsername,
    password,
    setPassword,
    signingIn,
    logout,
    demo,
    authorized,
    loading,
    rows,
    remaining,
    query,
    setQuery,
    code,
    setCode,
    message,
    setMessage,
    selected,
    setSelected,
    redeeming,
    qrUrl,
    setQrUrl,
    qrOpen,
    setQrOpen,
    load,
    lookup,
    redeem,
    exportCSV,
    visible,
    validQr,
    login,
    campaignId,
    campaign,
    testing,
    changeCampaign,
    stock,
    stockDraft,
    setStockDraft,
    saving,
    saveStock,
    chancesDraft,
    setChancesDraft,
    saveChances,
    toggleTests,
    resetConfirmation,
    setResetConfirmation,
    resetTests,
    statusFilter,
    setStatusFilter,
  };
}
export type AdminModel = ReturnType<typeof useAdmin>;
