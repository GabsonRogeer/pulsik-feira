"use client";
import {
  Download,
  LogOut,
  Users,
  Gift,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  QrCode,
} from "lucide-react";

import { Header, Footer } from "@/components/shell";

import { AdminLogin } from "./admin-login";
import { useAdmin } from "./use-admin";
import { QrPanel } from "./qr-panel";
import { RedemptionPanel } from "./redemption-panel";
import { CampaignPanel } from "./campaign-panel";
import { StockPanel } from "./stock-panel";
import { ChancesPanel } from "./chances-panel";
import { ParticipantsTable } from "./participants-table";
export function AdminDashboard() {
  const model = useAdmin();
  const {
    demo,
    authorized,
    loading,
    rows,
    message,
    setMessage,
    qrOpen,
    setQrOpen,
    load,
    exportCSV,
    logout,
  } = model;
  return (
    <>
      {demo && (
        <div className="demo-banner">
          <span>
            Painel de demonstração · Todos os dados abaixo são fictícios
          </span>
          <a href="/">Voltar à roleta</a>
        </div>
      )}
      <Header />
      <main className="admin-layout">
        <a href="/" className="text-link">
          <ArrowLeft size={15} /> Voltar à experiência
        </a>
        <div className="admin-title">
          <div>
            <div className="eyebrow">BASTIDORES DA EXPERIÊNCIA</div>
            <h1>
              Painel da <em>equipe.</em>
            </h1>
          </div>
          {authorized && (
            <div className="admin-actions">
              <button
                className="button secondary"
                onClick={() => setQrOpen(!qrOpen)}
              >
                <QrCode size={18} /> QR Code
              </button>
              <button
                className="button secondary"
                disabled={loading || model.saving || model.redeeming}
                onClick={
                  demo
                    ? () =>
                        setMessage(
                          "Os dados exibidos são exemplos para testar o painel.",
                        )
                    : load
                }
              >
                <RefreshCw size={18} /> Atualizar
              </button>
              {!demo && (
                <button
                  className="button secondary"
                  disabled={model.saving || model.redeeming}
                  onClick={logout}
                >
                  <LogOut size={18} />
                  Sair
                </button>
              )}
              <button className="button primary" onClick={exportCSV}>
                <Download size={18} /> Exportar contatos
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <p className="notice">Carregando o painel…</p>
        ) : !authorized ? (
          <AdminLogin model={model} />
        ) : (
          <>
            <CampaignPanel model={model} />
            <div className="stats-grid">
              <div className="glass stat">
                <Users size={20} />
                <span>Cadastros · {model.testing ? "teste" : "feira"}</span>
                <strong>{rows.length}</strong>
                <small>
                  {rows.filter((r) => r.status === "ready").length} aguardando
                  giro ou nova chance
                </small>
              </div>
              <div className="glass stat">
                <Gift size={20} />
                <span>Prêmios concedidos</span>
                <strong>{rows.filter((r) => r.claim_code).length}</strong>
              </div>
              <div className="glass stat">
                <CheckCircle2 size={20} />
                <span>Brindes retirados</span>
                <strong>{rows.filter((r) => r.redeemed_at).length}</strong>
              </div>
            </div>
            {qrOpen && <QrPanel model={model} />}
            <div className="operations-grid">
              <RedemptionPanel model={model} />
              <StockPanel model={model} />
            </div>
            <ChancesPanel model={model} />
            <ParticipantsTable model={model} />
          </>
        )}
        {message && (
          <p className="notice admin-message" role="status">
            {message}
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
