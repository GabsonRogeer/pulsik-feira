"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CAMPAIGN, type Participant } from "@/lib/config";
import { adminSupabase as supabase } from "@/lib/admin-supabase";
import { signInAdmin, adminLoginError } from "@/lib/admin-auth";
import { exportParticipantsCSV } from "@/lib/export-participants";
import { demoRows } from "./demo-data";
export function useAdmin() {
  const demo = !supabase;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const loginLock = useRef(false);
  const accessVersion = useRef(0);
  const [authorized, setAuthorized] = useState(demo);
  const [loading, setLoading] = useState(!demo);
  const [rows, setRows] = useState<Participant[]>(demo ? demoRows : []);
  const [remaining, setRemaining] = useState({
    cup: 29,
    keychain: 199,
    pen: 199,
  });
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  async function load() {
    if (!supabase) return;
    const version = ++accessVersion.current;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setAuthorized(false);
        setRows([]);
        return;
      }
      const { data: role, error: e } = await supabase.rpc("pulsik_is_admin");
      if (e || !role) {
        setAuthorized(false);
        setRows([]);
        setSelected(null);
        return;
      }
      setAuthorized(true);
      let all: Participant[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("pulsik_participants")
          .select("*")
          .eq("campaign_id", CAMPAIGN)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        all = all.concat(data);
        if (data.length < 1000) break;
      }
      if (version !== accessVersion.current) return;
      setRows(all);
      const { data: stock, error: stockError } = await supabase
        .from("pulsik_prizes")
        .select("*")
        .eq("campaign_id", CAMPAIGN);
      if (stockError) throw stockError;
      if (stock)
        setRemaining(
          Object.fromEntries(
            stock.map((s) => [s.id, s.remaining]),
          ) as typeof remaining,
        );
    } catch {
      setMessage("Não foi possível carregar os dados. Tente atualizar.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        accessVersion.current++;
        setAuthorized(false);
        setRows([]);
        setSelected(null);
        setLoading(false);
      }
    });
    return () => {
      accessVersion.current++;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  function lookup() {
    const found = rows.find(
      (r) => r.claim_code?.toUpperCase() === code.trim().toUpperCase(),
    );
    setSelected(found || null);
    setMessage(
      found ? "" : "Código não encontrado. Confira e tente novamente.",
    );
  }
  async function redeem() {
    if (!selected || redeeming) return;
    setRedeeming(true);
    try {
      if (demo) {
        const updated = { ...selected, redeemed_at: new Date().toISOString() };
        setRows((old) => old.map((r) => (r.id === updated.id ? updated : r)));
        setSelected(updated);
        setMessage(
          "Retirada simulada com sucesso. Nenhum brinde real foi entregue.",
        );
      } else {
        const { data, error } = await supabase!.rpc("pulsik_redeem", {
          p_code: selected.claim_code,
        });
        if (error) throw error;
        setSelected(data.participant);
        setRows((old) =>
          old.map((r) => (r.id === data.participant.id ? data.participant : r)),
        );
        setMessage(
          data.already_redeemed
            ? "Este prêmio já havia sido retirado."
            : "Retirada registrada com sucesso.",
        );
      }
    } catch {
      setMessage(
        "Não foi possível registrar a retirada. Confira a conexão e se o período do evento está aberto.",
      );
    } finally {
      setRedeeming(false);
    }
  }
  function exportCSV() {
    exportParticipantsCSV(rows, demo);
  }
  const visible = rows.filter((r) =>
    [r.name, r.email, r.company, r.claim_code].some((v) =>
      v?.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const validQr = /^https:\/\/[^\s]+$/.test(qrUrl);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || loginLock.current) return;
    loginLock.current = true;
    setSigningIn(true);
    setMessage("");
    try {
      await signInAdmin(supabase, username, password);
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
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      setMessage("Não foi possível sair. Tente novamente.");
      return;
    }
    accessVersion.current++;
    setAuthorized(false);
    setRows([]);
    setSelected(null);
    setMessage("");
    setPassword("");
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
  };
}

export type AdminModel = ReturnType<typeof useAdmin>;
