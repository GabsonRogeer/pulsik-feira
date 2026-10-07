"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import { TEST_CAMPAIGN, campaignApi, type CampaignId } from "@/lib/campaign";
import { api, type LoginUser } from "@/lib/api-client";
import {
  CAMPAIGN,
  PRIZES,
  type Outcome,
  type Participant,
  type SpinResult,
} from "@/lib/config";
import { normalizePhone } from "@/lib/phone";
import { errorText } from "@/lib/errors";
import { celebrate } from "@/lib/celebrate";
import { useEmailLogin } from "./use-email-login";
type Step = "welcome" | "form" | "wheel" | "result";
const DEMO_KEY = "pulsik-demo-v1";
export function useExperience(
  forceDemo = false,
  campaign: CampaignId = CAMPAIGN,
) {
  const demo = forceDemo;
  const testing = campaign === TEST_CAMPAIGN;
  const experienceError = (e: unknown) =>
    testing && (e as Error)?.message?.includes("campaign_closed")
      ? "A campanha de teste está pausada ou expirou. Peça à equipe para ativar os testes no painel."
      : errorText(e);
  const [step, setStep] = useState<Step>("welcome");
  const [guest, setGuest] = useState(false);
  const [user, setUser] = useState<LoginUser | null>(null);
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
  async function refresh() {
    const result = await api<{
      user: LoginUser;
      participant: Participant | null;
      stock: { id: string; remaining: number }[];
    }>(campaignApi("/api/participation", campaign));
    setUser(result.user);
    setGuest(result.user.guest === true);
    setParticipant(result.participant);
    setStep(
      result.participant
        ? result.participant.status === "complete"
          ? "result"
          : "wheel"
        : "form",
    );
    setStock(Object.fromEntries(result.stock.map((x) => [x.id, x.remaining])));
  }
  const emailLogin = useEmailLogin(async (u) => {
    setUser(u);
    try {
      await refresh();
    } catch (e) {
      setError(experienceError(e));
    }
  });
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
    getSession()
      .then(async (session) => {
        if (active) {
          try {
            await refresh();
          } catch (e) {
            if (session?.user || (e as { status?: number }).status !== 401)
              throw e;
          }
        }
        const error = new URLSearchParams(window.location.search).get("error");
        if (active && error)
          setError(
            "Não foi possível concluir o login. Tente novamente ou entre com código por e-mail.",
          );
      })
      .catch((e) => active && setError(experienceError(e)))
      .finally(() => active && setInitializing(false));
    return () => {
      active = false;
    };
  }, [demo, campaign]);
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
      await signIn("google", { callbackUrl: testing ? "/teste" : "/" });
    } catch (e) {
      setError(experienceError(e));
      setBusy(false);
    }
  }
  async function enterGuest() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api(campaignApi("/api/guest", campaign), { action: "start" });
      setGuest(true);
      setStep("form");
    } catch (e) {
      setError(experienceError(e));
    } finally {
      setBusy(false);
      lock.current = false;
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
      phone: String(f.get("phone") || ""),
      marketing: f.get("marketing") === "on",
    };
    try {
      values.phone = normalizePhone(values.phone);
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
      } else if (guest) {
        await api<Participant>(campaignApi("/api/guest", campaign), {
          action: "register",
          email: String(f.get("email") || "")
            .trim()
            .toLowerCase(),
          ...values,
        });
        await refresh();
      } else {
        const p = await api<Participant>(
          campaignApi("/api/participation", campaign),
          values,
        );
        setParticipant(p);
        setStep(p.status === "complete" ? "result" : "wheel");
      }
    } catch (e) {
      setError(experienceError(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
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
        const key =
          "pulsik-pending:" + campaign + ":" + participant.id + ":" + user!.id;
        let requestId = localStorage.getItem(key);
        if (!requestId) {
          requestId = crypto.randomUUID();
          localStorage.setItem(key, requestId);
        }
        result = await api<SpinResult>(campaignApi("/api/spin", campaign), {
          requestId,
        });
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
      setError(experienceError(e));
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
      try {
        const response = await fetch("/api/guest", { method: "DELETE" });
        if (!response.ok) throw new Error("logout_failed");
        await signOut({ redirect: false });
      } catch (e) {
        setError(experienceError(e));
        return;
      }
    }
    emailLogin.reset();
    setUser(null);
    setGuest(false);
    setParticipant(null);
    setStep("welcome");
    setBonus(false);
    setError("");
    setRotation(0);
  }
  const won = participant?.outcome && participant.outcome !== "none";
  const prize = PRIZES.find((p) => p.id === participant?.outcome);

  async function copyClaimCode() {
    try {
      await navigator.clipboard.writeText(participant?.claim_code || "");
      setCopied(true);
    } catch {
      setError("Selecione o código e copie manualmente.");
    }
  }
  return {
    emailLogin,
    campaign,
    demo,
    guest,
    enterGuest,
    testing,
    step,
    user,
    participant,
    busy,
    initializing,
    error,
    bonus,
    rotation,
    spinning,
    selection,
    setSelection,
    copied,
    stock,
    heading,
    login,
    register,
    spin,
    logout,
    won,
    prize,
    copyClaimCode,
  };
}
export type ExperienceModel = ReturnType<typeof useExperience>;
