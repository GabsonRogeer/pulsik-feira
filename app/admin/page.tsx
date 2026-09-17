"use client";
import { useEffect, useState } from "react";
import {
  Download,
  Search,
  ShieldCheck,
  Users,
  Gift,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Header, Footer } from "@/components/shell";
import { CAMPAIGN, PRIZES, type Participant } from "@/lib/config";
import { supabase } from "@/lib/supabase";
const demoRows: Participant[] = [
  {
    id: "1",
    name: "Marina Exemplo",
    company: "Empresa Exemplo",
    job_title: "Diretora",
    email: "marina@example.com",
    city: "Fortaleza",
    state: "CE",
    marketing: true,
    status: "complete",
    outcome: "cup",
    claim_code: "DEMO-7F3A92",
    redeemed_at: null,
  },
  {
    id: "2",
    name: "Lucas Demonstração",
    company: "Negócio Exemplo",
    job_title: "Gestor",
    email: "lucas@example.com",
    city: "Sobral",
    state: "CE",
    marketing: false,
    status: "complete",
    outcome: "pen",
    claim_code: "DEMO-19AC43",
    redeemed_at: null,
  },
  {
    id: "3",
    name: "Ana Teste",
    company: "Empresa Modelo",
    job_title: "Fundadora",
    email: "ana@example.com",
    city: "Caucaia",
    state: "CE",
    marketing: true,
    status: "complete",
    outcome: "keychain",
    claim_code: "DEMO-82BB71",
    redeemed_at: "2026-10-07T12:00:00Z",
  },
];
export default function Admin() {
  const demo = !supabase;
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
    setLoading(true);
    try {
      const { data: role, error: e } = await supabase.rpc("pulsik_is_admin");
      if (e || !role) {
        setAuthorized(false);
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
      "Cidade",
      "Estado",
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
      r.city,
      r.state,
      r.marketing ? "Sim" : "Não",
      PRIZES.find((p) => p.id === r.outcome)?.label || "Não girou",
      r.claim_code,
      r.redeemed_at,
    ]);
    const blob = new Blob(
      [
        "\uFEFF" +
          [headings, ...data]
            .map((row) => row.map(cell).join(";"))
            .join("\r\n"),
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
  const visible = rows.filter((r) =>
    [r.name, r.email, r.company, r.claim_code].some((v) =>
      v?.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const validQr = /^https:\/\/[^\s]+$/.test(qrUrl);
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
                disabled={loading}
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
              <button className="button primary" onClick={exportCSV}>
                <Download size={18} /> Exportar contatos
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <p className="notice">Carregando o painel…</p>
        ) : !authorized ? (
          <section className="glass access-card">
            <ShieldCheck size={34} />
            <h2>Acesso exclusivo da equipe</h2>
            <p>Entre com uma conta Google autorizada pela Pulsik.</p>
            <button
              className="button primary"
              onClick={async () => {
                const { error } = await supabase!.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: window.location.origin + "/admin/" },
                });
                if (error)
                  setMessage(
                    "Não foi possível iniciar o login. Tente novamente.",
                  );
              }}
            >
              Entrar com Google
            </button>
          </section>
        ) : (
          <>
            <div className="stats-grid">
              <div className="glass stat">
                <Users size={20} />
                <span>Participantes</span>
                <strong>{rows.length}</strong>
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
            {qrOpen && (
              <section className="glass qr-panel">
                <div>
                  <h2>O primeiro passo é um scan.</h2>
                  <p>
                    Informe o endereço público definitivo da aplicação para
                    gerar o QR Code do estande.
                  </p>
                  <label>
                    Endereço da aplicação
                    <input
                      type="url"
                      placeholder="https://seu-endereco-publico"
                      value={qrUrl}
                      onChange={(e) => setQrUrl(e.target.value)}
                    />
                  </label>
                  <p className="input-note">
                    Não use o link privado da demonstração no material da feira.
                    Confira o acesso sem login do proprietário antes de
                    imprimir.
                  </p>
                </div>
                {validQr ? (
                  <div className="qr-code">
                    <QRCodeSVG
                      value={qrUrl}
                      size={180}
                      marginSize={4}
                      level="M"
                    />
                    <button
                      className="text-button"
                      onClick={() => window.print()}
                    >
                      Imprimir QR Code
                    </button>
                  </div>
                ) : (
                  <p>O QR Code aparecerá após inserir uma URL HTTPS válida.</p>
                )}
              </section>
            )}
            <div className="operations-grid">
              <section className="glass redeem-panel">
                <h2>Conferir retirada</h2>
                <p>Consulte o código e confirme a entrega do brinde.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    lookup();
                  }}
                >
                  <label>
                    Código do participante
                    <input
                      placeholder={demo ? "DEMO-7F3A92" : "PUL-…"}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setSelected(null);
                      }}
                      required
                    />
                  </label>
                  <button className="button secondary">
                    <Search size={18} /> Consultar código
                  </button>
                </form>
                {selected && (
                  <div className="claim-review">
                    <strong>{selected.name}</strong>
                    <span>
                      {PRIZES.find((p) => p.id === selected.outcome)?.label}
                    </span>
                    {selected.redeemed_at ? (
                      <p className="success-text">
                        Já retirado ·{" "}
                        {new Date(selected.redeemed_at).toLocaleString("pt-BR")}
                      </p>
                    ) : (
                      <button
                        className="button primary"
                        onClick={redeem}
                        disabled={redeeming}
                      >
                        {redeeming
                          ? "Registrando…"
                          : "Confirmar entrega do brinde"}
                      </button>
                    )}
                  </div>
                )}
              </section>
              <section className="glass stock-panel">
                <h2>Brindes disponíveis</h2>
                <p>O estoque baixa quando o prêmio é concedido.</p>
                {PRIZES.slice(0, 3).map((p) => (
                  <div className="stock-row" key={p.id}>
                    <span>{p.label}</span>
                    <strong>
                      {remaining[p.id as keyof typeof remaining]}{" "}
                      <small>/ {p.stock}</small>
                    </strong>
                    <div className="stock-track">
                      <i
                        style={{
                          width: `${(remaining[p.id as keyof typeof remaining] / p.stock!) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>
            </div>
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
                      <th>Cidade</th>
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
                        <td>
                          {r.city} · {r.state}
                        </td>
                        <td>
                          {PRIZES.find((p) => p.id === r.outcome)?.label ||
                            "Não girou"}
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
