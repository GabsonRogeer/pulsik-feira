"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CAMPAIGN, type Participant } from "@/lib/config";
import { signOut } from "next-auth/react";
import { api } from "@/lib/api-client";
import { signInAdmin, adminLoginError } from "@/lib/admin-auth";
import { exportParticipantsCSV } from "@/lib/export-participants";
import { demoRows } from "./demo-data";
export function useAdmin() {
  const demo = false;
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
    const version = ++accessVersion.current;
    setLoading(true);
    try {
      const data = await api<{
        rows: Participant[];
        stock: { id: string; remaining: number }[];
      }>("/api/admin");
      if (version !== accessVersion.current) return;
      setAuthorized(true);
      setRows(data.rows);
      setRemaining(
        Object.fromEntries(
          data.stock.map((x) => [x.id, x.remaining]),
        ) as typeof remaining,
      );
    } catch (e) {
      setAuthorized(false);
      setRows([]);
      setSelected(null);
      if (![401, 403].includes((e as { status: number }).status))
        setMessage(
          "Não foi possível carregar o painel. Confira a configuração do servidor.",
        );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
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
        const data = await api<{
          participant: Participant;
          already_redeemed: boolean;
        }>("/api/admin", { code: selected.claim_code });
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
