"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  Globe,
  Instagram,
  Linkedin,
  LoaderCircle,
  LogOut,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Coffee,
  KeyRound,
  PenLine,
  Heart,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import {
  CAMPAIGN,
  PRIZES,
  SOCIALS,
  STATES,
  type Outcome,
  type Participant,
  type SpinResult,
} from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { Wheel } from "./wheel";
import { Header, Footer } from "./shell";
type Step = "welcome" | "form" | "wheel" | "result";
const DEMO_KEY = "pulsik-demo-v1";
function errorText(error: unknown) {
  const m = (error as { message?: string })?.message || "";
  if (m.includes("campaign_closed"))
    return "A participação estará disponível de 7 a 9 de outubro de 2026.";
  if (m.includes("duplicate_email"))
    return "Este e-mail já participou. Entre com a conta usada no cadastro.";
  if (m.includes("google_required"))
    return "Entre com sua conta Google para participar.";
  if (m.includes("not_registered"))
    return "Conclua seu cadastro antes de girar.";
  if (m.includes("invalid_fields"))
    return "Confira os campos do cadastro e tente novamente.";
  return "Não foi possível concluir agora. Confira sua conexão e tente novamente. Seu giro não será perdido.";
}
export function PrizeIcon({
  outcome,
  size = 28,
}: {
  outcome: Outcome;
  size?: number;
}) {
  const Icon =
    outcome === "cup"
      ? Coffee
      : outcome === "keychain"
        ? KeyRound
        : outcome === "pen"
          ? PenLine
          : outcome === "retry"
            ? RotateCw
            : Heart;
  return <Icon size={size} strokeWidth={1.5} />;
}
export function Experience({ forceDemo = false }: { forceDemo?: boolean }) {
  const demo = forceDemo || !supabase;
  const [step, setStep] = useState<Step>("welcome");
  const [user, setUser] = useState<User | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(!demo);
  const [error, setError] = useState("");
  const [bonus, setBonus] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [selection, setSelection] = useState<Outcome | "random">("random");
  const [copied, setCopied] = useState(false);
  const [stock, setStock] = useState<Record<string, number>>({
    cup: 30,
    keychain: 200,
    pen: 200,
  });
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  async function refresh(u: User) {
    if (!supabase) return;
    const { data, error: e } = await supabase
      .from("pulsik_participants")
      .select("*")
      .eq("campaign_id", CAMPAIGN)
      .eq("user_id", u.id)
      .maybeSingle();
    if (e) throw e;
    if (data) {
      setParticipant(data);
      setStep(data.status === "complete" ? "result" : "wheel");
    } else setStep("form");
    const { data: inventory } = await supabase
      .from("pulsik_prizes")
      .select("id,remaining")
      .eq("campaign_id", CAMPAIGN);
    if (inventory)
      setStock(Object.fromEntries(inventory.map((x) => [x.id, x.remaining])));
  }
  useEffect(() => {
    let active = true;
    if (demo) {
      try {
        const saved = sessionStorage.getItem(DEMO_KEY);
        if (saved) {
          const p: Participant = JSON.parse(saved);
          setParticipant(p);
          setStep(p.status === "complete" ? "result" : "wheel");
        }
      } catch {}
      return;
    }
    const client = supabase!;
    client.auth
      .getSession()
      .then(async ({ data, error: e }) => {
        if (e) throw e;
        if (data.session && active) {
          setUser(data.session.user);
          await refresh(data.session.user);
        }
      })
      .catch((e) => active && setError(errorText(e)))
      .finally(() => active && setInitializing(false));
    const { data: subscription } = client.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session && active) {
          setUser(session.user);
          setTimeout(
            () => refresh(session.user).catch((e) => setError(errorText(e))),
            0,
          );
        }
      },
    );
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [demo]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (step !== "welcome") {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [step]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "read_pulsik_participation",
            title: "Consultar etapa da participação Pulsik",
            description:
              "Lê a etapa e o resultado exibidos, sem criar cadastro ou realizar giro.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Este comando não aceita parâmetros.");
              return {
                mode: demo ? "demo" : "live",
                step,
                outcome: participant?.outcome ?? null,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [demo, step, participant?.outcome]);
  function saveDemo(p: Participant) {
    setParticipant(p);
    try {
      sessionStorage.setItem(DEMO_KEY, JSON.stringify(p));
    } catch {}
  }
  async function login() {
    if (demo) {
      setStep("form");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: e } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/",
          queryParams: { prompt: "select_account" },
        },
      });
      if (e) throw e;
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    const values = {
      name: String(f.get("name") || "").trim(),
      company: String(f.get("company") || "").trim(),
      job_title: String(f.get("job_title") || "").trim(),
      city: String(f.get("city") || "").trim(),
      state: String(f.get("state") || ""),
      marketing: f.get("marketing") === "on",
    };
    try {
      if (
        Object.entries(values).some(
          ([k, v]) =>
            k !== "marketing" && typeof v === "string" && v.length < 2,
        )
      )
        throw new Error("invalid_fields");
      if (demo) {
        saveDemo({
          id: "demo",
          ...values,
          email: "visitante@exemplo.com",
          status: "ready",
          outcome: null,
          claim_code: null,
          redeemed_at: null,
        });
        setStep("wheel");
      } else {
        const { data, error: e } = await supabase!.rpc("pulsik_register", {
          p_campaign: CAMPAIGN,
          p_name: values.name,
          p_company: values.company,
          p_job_title: values.job_title,
          p_city: values.city,
          p_state: values.state,
          p_marketing: values.marketing,
        });
        if (e) throw e;
        const p = data as Participant;
        setParticipant(p);
        setStep(p.status === "complete" ? "result" : "wheel");
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 120,
        spread: 95,
        origin: { y: 0.65 },
        colors: ["#b899ff", "#91d9eb", "#ffffff", "#ffca91"],
        disableForReducedMotion: true,
      });
      setTimeout(
        () =>
          confetti({
            particleCount: 70,
            angle: 120,
            spread: 70,
            origin: { x: 1, y: 0.55 },
            colors: ["#b899ff", "#91d9eb", "#ffffff"],
            disableForReducedMotion: true,
          }),
        350,
      );
    } catch {}
  }
  async function spin() {
    if (lock.current || !participant || participant.status === "complete")
      return;
    lock.current = true;
    setSpinning(true);
    setError("");
    setBonus(false);
    let result: SpinResult;
    try {
      if (demo) {
        const draw =
          (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 100;
        let total = 0;
        const chosen =
          selection === "random"
            ? PRIZES.find((p) => (total += p.chance) > draw)!.id
            : selection;
        result = {
          id: crypto.randomUUID(),
          outcome: chosen,
          claim_code:
            chosen === "none" || chosen === "retry" ? null : "DEMO-7F3A92",
        };
      } else {
        const key = "pulsik-pending:" + user!.id;
        let requestId = localStorage.getItem(key);
        if (!requestId) {
          requestId = crypto.randomUUID();
          localStorage.setItem(key, requestId);
        }
        const { data, error: e } = await supabase!.rpc("pulsik_spin", {
          p_campaign: CAMPAIGN,
          p_request: requestId,
        });
        if (e) throw e;
        result = data as SpinResult;
        localStorage.removeItem(key);
      }
      const index = PRIZES.findIndex((p) => p.id === result.outcome);
      const target = 360 - (index * 72 + 36);
      setRotation(
        (previous) => Math.ceil(previous / 360) * 360 + 1800 + target,
      );
      const next = {
        ...participant,
        status:
          result.outcome === "retry"
            ? ("ready" as const)
            : ("complete" as const),
        outcome: result.outcome === "retry" ? null : result.outcome,
        claim_code: result.claim_code,
      };
      if (demo) {
        try {
          sessionStorage.setItem(DEMO_KEY, JSON.stringify(next));
        } catch {}
      }
      timer.current = setTimeout(
        () => {
          setParticipant(next);
          setSpinning(false);
          lock.current = false;
          if (result.outcome === "retry") {
            setBonus(true);
            void celebrate();
          } else {
            setStep("result");
            if (result.outcome !== "none") void celebrate();
          }
        },
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 100
          : 5750,
      );
    } catch (e) {
      setError(errorText(e));
      setSpinning(false);
      lock.current = false;
    }
  }
  async function logout() {
    if (spinning) return;
    if (demo) {
      try {
        sessionStorage.removeItem(DEMO_KEY);
      } catch {}
    } else {
      const { error: e } = await supabase!.auth.signOut();
      if (e) {
        setError(errorText(e));
        return;
      }
    }
    setUser(null);
    setParticipant(null);
    setStep("welcome");
    setBonus(false);
    setError("");
    setRotation(0);
  }
  const won = participant?.outcome && participant.outcome !== "none";
  const prize = PRIZES.find((p) => p.id === participant?.outcome);
  return (
    <>
      {demo && (
        <div className="demo-banner">
          <span>
            <Sparkles size={14} /> Demonstração · Sem cadastro real ou reserva
            de brindes
          </span>
          <a href="/admin/">
            Ver painel da equipe <ArrowRight size={13} />
          </a>
        </div>
      )}
      <Header />
      {step === "result" && participant ? (
        <main className="result-layout">
          <section className="result-intro">
            <div className="eyebrow">
              {won ? "ESSA CONEXÃO DEU SORTE" : "FOI BOM CONECTAR COM VOCÊ"}
            </div>
            <div className={"result-emblem " + (!won ? "no-win" : "")}>
              <PrizeIcon outcome={participant.outcome || "none"} size={52} />
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {won ? (
                <>
                  Deu match
                  <br />
                  com a <em>sorte!</em>
                </>
              ) : (
                <>
                  A conexão
                  <br />
                  já <em>valeu.</em>
                </>
              )}
            </h1>
            <p className="lead">
              Obrigado por conhecer nosso estande
              <br />
              aqui no Siará Tech Summit, {participant.name.split(" ")[0]}!
            </p>
            <p className="result-copy">
              {won ? (
                <>
                  Parabéns! Você ganhou{" "}
                  <strong>{prize?.label.toLowerCase()}</strong>.<br />
                  Uma lembrança da Pulsik para levar com você.
                </>
              ) : (
                <>
                  Não foi dessa vez na roleta, mas foi um prazer receber você.
                  Continue por perto: ainda temos muito para compartilhar.
                </>
              )}
            </p>
          </section>
          <div className="result-right">
            {won && (
              <section className="glass prize-ticket">
                <div className="ticket-top">
                  <span>
                    <Ticket size={17} /> SEU PRESENTE
                  </span>
                  <span className="status-pill">
                    {participant.redeemed_at
                      ? "Retirado"
                      : "Reservado" + (demo ? " · teste" : "")}
                  </span>
                </div>
                <h2>{prize?.label}</h2>
                <p>
                  Você pode retirar agora ou depois, no estande da Pulsik,
                  durante o evento de 7 a 9 de outubro.
                </p>
                <div className="ticket-divider" />
                <span className="field-caption">CÓDIGO DE RETIRADA</span>
                <div className="claim-code">
                  <strong>{participant.claim_code}</strong>
                  <button
                    className="icon-button"
                    aria-label="Copiar código de retirada"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          participant.claim_code || "",
                        );
                        setCopied(true);
                      } catch {
                        setError("Selecione o código e copie manualmente.");
                      }
                    }}
                  >
                    {copied ? <Check size={21} /> : <Copy size={21} />}
                  </button>
                </div>
                <p className="ticket-hint">
                  {demo
                    ? "Código demonstrativo. Não dá direito à retirada de brinde."
                    : "Apresente este código à nossa equipe. Você pode voltar a esta página com a mesma conta Google."}
                </p>
                {copied && (
                  <p role="status" className="success-text">
                    Código copiado!
                  </p>
                )}
              </section>
            )}
            <section className="glass social-card">
              <span className="eyebrow">A CONEXÃO CONTINUA</span>
              <h2>
                Siga a Pulsik para mais<span>.</span>
              </h2>
              <p>
                Ideias, inteligência artificial e novas possibilidades para o
                seu negócio.
              </p>
              <div className="social-links">
                <a
                  href={SOCIALS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram size={21} /> Instagram <ArrowRight size={16} />
                </a>
                <a
                  href={SOCIALS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Linkedin size={21} /> LinkedIn <ArrowRight size={16} />
                </a>
              </div>
              <a
                className="text-link"
                href={SOCIALS.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe size={16} /> Conheça nosso universo
              </a>
            </section>
            <button className="text-button reset" onClick={logout}>
              {demo ? (
                <>
                  <RotateCw size={15} /> Testar novamente
                </>
              ) : (
                <>
                  <LogOut size={15} /> Sair da minha conta
                </>
              )}
            </button>
          </div>
        </main>
      ) : (
        <main className={"experience stage-" + step}>
          <section className="intro">
            <div className="eyebrow">
              <span />{" "}
              {step === "welcome"
                ? "CONEXÕES QUE SURPREENDEM"
                : step === "form"
                  ? "VAMOS NOS CONHECER"
                  : "SEU MOMENTO CHEGOU"}
            </div>
            <h1 ref={heading} tabIndex={-1}>
              {step === "welcome" ? (
                <>
                  O próximo giro
                  <br />
                  pode ser <em>seu.</em>
                </>
              ) : step === "form" ? (
                <>
                  Uma conexão.
                  <br />
                  Muitas <em>possibilidades.</em>
                </>
              ) : (
                <>
                  Um giro.
                  <br />
                  Uma <em>surpresa.</em>
                </>
              )}
            </h1>
            <p className="lead">
              {step === "welcome" ? (
                <>
                  Você já deu o primeiro passo para o futuro.
                  <br className="desktop-br" /> Agora, deixe a sorte fazer a
                  parte dela.
                </>
              ) : step === "form" ? (
                "Conte um pouco sobre você para liberar seu giro."
              ) : (
                "Cruzando os dedos por você, " +
                (participant?.name.split(" ")[0] || "visitante") +
                ". Seu próximo presente pode estar aqui."
              )}
            </p>
            <div className="steps" aria-label="Etapas da participação">
              <span
                className={
                  step === "welcome" || step === "form" ? "active" : "done"
                }
              >
                01 <b>Conecte-se</b>
              </span>
              <i />
              <span className={step === "wheel" ? "active" : ""}>
                02 <b>Gire</b>
              </span>
              <i />
              <span>
                03 <b>Descubra</b>
              </span>
            </div>
            {step === "welcome" && (
              <div className="glass entry-card">
                <div className="card-heading">
                  <div className="icon-tile">
                    <Gift size={23} />
                  </div>
                  <div>
                    <h2>Uma conexão. Uma surpresa.</h2>
                    <p>
                      {demo
                        ? "Explore a experiência antes da feira."
                        : "Entre para participar da roleta Pulsik."}
                    </p>
                  </div>
                </div>
                <button
                  className="button google"
                  disabled={busy || initializing}
                  onClick={login}
                >
                  {busy || initializing ? (
                    <LoaderCircle className="spin-icon" size={20} />
                  ) : demo ? (
                    <Sparkles size={20} />
                  ) : (
                    <span className="google-g">G</span>
                  )}
                  {initializing
                    ? "Conectando…"
                    : demo
                      ? "Experimentar a roleta"
                      : "Continuar com Google"}
                  <ArrowRight size={18} />
                </button>
                <p className="fine">
                  <ShieldCheck size={15} />
                  {demo
                    ? "Na feira, acesso com sua conta Google."
                    : "Uma participação por conta durante o evento."}
                </p>
              </div>
            )}
            {step === "form" && (
              <form className="glass form-card" onSubmit={register}>
                <div className="signed-in">
                  <ShieldCheck size={17} />
                  <span>{demo ? "Cadastro de demonstração" : user?.email}</span>
                  {!demo && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={logout}
                    >
                      Trocar
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  <label className="full">
                    Nome
                    <input
                      name="name"
                      autoComplete="name"
                      defaultValue={
                        demo ? "" : user?.user_metadata?.full_name || ""
                      }
                      placeholder="Como podemos chamar você?"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Empresa
                    <input
                      name="company"
                      autoComplete="organization"
                      placeholder="Sua empresa"
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Cargo
                    <input
                      name="job_title"
                      autoComplete="organization-title"
                      placeholder="Seu cargo"
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </label>
                  <label className="full">
                    E-mail
                    <input
                      name="email"
                      type="email"
                      value={demo ? "visitante@exemplo.com" : user?.email || ""}
                      readOnly
                      aria-describedby="email-note"
                    />
                  </label>
                  <span id="email-note" className="input-note full">
                    {demo
                      ? "Usamos um e-mail fictício nesta demonstração."
                      : "Vinculado à sua conta Google."}
                  </span>
                  <label>
                    Cidade
                    <input
                      name="city"
                      autoComplete="address-level2"
                      placeholder="Sua cidade"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Estado
                    <select
                      name="state"
                      autoComplete="address-level1"
                      defaultValue=""
                      required
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {STATES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="checkbox">
                  <input type="checkbox" name="marketing" />
                  <span>
                    Quero receber novidades e conteúdos da Pulsik.{" "}
                    <small>Opcional.</small>
                  </span>
                </label>
                <p className="form-privacy">
                  Usamos estes dados para gerenciar sua participação e a entrega
                  do prêmio.{" "}
                  <a href="/privacidade/" target="_blank">
                    Saiba mais
                  </a>
                  .
                </p>
                <button className="button primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin-icon" size={18} />
                  ) : null}
                  {busy ? "Salvando…" : "Liberar meu giro"}
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
            {step === "wheel" && (
              <div className="glass spin-card">
                <div className="card-heading">
                  <div className="icon-tile">
                    <Ticket size={23} />
                  </div>
                  <div>
                    <h2>
                      {bonus
                        ? "A sorte pediu mais um giro!"
                        : "Seu giro está liberado."}
                    </h2>
                    <p>
                      {bonus
                        ? "Caiu “Tente outra vez”. Você tem uma nova chance."
                        : "Toque no botão e descubra sua surpresa."}
                    </p>
                  </div>
                </div>
                <div className="prize-list">
                  {PRIZES.slice(0, 3).map((p) => (
                    <div key={p.id}>
                      <PrizeIcon outcome={p.id} size={18} />
                      <span>{p.label}</span>
                      {stock[p.id] === 0 ? (
                        <small>Esgotado</small>
                      ) : p.id === "cup" ? (
                        <small>Mais raro</small>
                      ) : null}
                    </div>
                  ))}
                </div>
                <p className="fine">
                  <ShieldCheck size={15} /> O resultado fica salvo para você.
                </p>
                {demo && (
                  <details className="demo-controls">
                    <summary>Opções para testar a demonstração</summary>
                    <label>
                      Resultado do próximo giro
                      <select
                        value={selection}
                        disabled={spinning}
                        onChange={(e) =>
                          setSelection(e.target.value as Outcome | "random")
                        }
                      >
                        <option value="random">Aleatório</option>
                        {PRIZES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </details>
                )}
                <button
                  className="text-button logout"
                  disabled={spinning}
                  onClick={logout}
                >
                  {demo ? "Reiniciar demonstração" : "Sair da conta"}
                </button>
              </div>
            )}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <div className="event-caption">
              <span>07 — 09 OUT</span>
              <span>Um encontro com novas possibilidades.</span>
            </div>
          </section>
          <section className="wheel-section" aria-label="Prêmios da roleta">
            <div className="orbit-caption">
              <Sparkles size={16} /> SUA SORTE CONECTA AQUI
            </div>
            <Wheel rotation={rotation} spinning={spinning} />
            {step === "wheel" ? (
              <div className="spin-action">
                <button
                  className="button primary spin-button"
                  onClick={spin}
                  disabled={spinning}
                >
                  <RotateCw size={20} className={spinning ? "spin-icon" : ""} />
                  {spinning
                    ? "Sua surpresa está chegando…"
                    : bonus
                      ? "Girar mais uma vez"
                      : "Girar minha sorte"}
                  {!spinning && <ArrowRight size={18} />}
                </button>
                <p className="wheel-note" role="status" aria-live="polite">
                  {spinning
                    ? "Aguarde o resultado."
                    : bonus
                      ? "Você ganhou uma nova chance!"
                      : "Um giro inicial. Uma participação por conta."}
                </p>
              </div>
            ) : (
              <>
                <div className="glass wheel-caption">
                  <span className="small-spark">✦</span>
                  <div>
                    <strong>Gire. Surpreenda-se. Leve com você.</strong>
                    <p>Copo, chaveiro e caneta personalizados.</p>
                  </div>
                </div>
                <p className="wheel-note">
                  Pequenos presentes. Grandes conexões.
                </p>
              </>
            )}
            <details className="odds">
              <summary>Chances e regras da roleta</summary>
              <ul>
                {PRIZES.map((p) => (
                  <li key={p.id}>
                    <span>{p.label}</span>
                    <b>{p.chance}%</b>
                  </li>
                ))}
              </ul>
              <p>
                As fatias ilustram os resultados; não representam suas chances.
                Se um brinde acabar, sua chance passa para “Não foi dessa vez”.
                “Tente outra vez” libera um novo giro.
              </p>
            </details>
          </section>
        </main>
      )}
      {step === "result" && error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <Footer />
    </>
  );
}
