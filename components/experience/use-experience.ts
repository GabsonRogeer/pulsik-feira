"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
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
import { supabase } from "@/lib/supabase";
import { useEmailLogin } from "./use-email-login";
type Step = "welcome" | "form" | "wheel" | "result";
const DEMO_KEY = "pulsik-demo-v1";
export function useExperience(forceDemo = false) {
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
  const emailLogin = useEmailLogin(async (u) => {
    setUser(u);
    try {
      await refresh(u);
    } catch (e) {
      setError(errorText(e));
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
      } else {
        const { data, error: e } = await supabase!.rpc("pulsik_register", {
          p_campaign: CAMPAIGN,
          p_name: values.name,
          p_company: values.company,
          p_job_title: values.job_title,
          p_phone: values.phone,
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
    emailLogin.reset();
    setUser(null);
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
    demo,
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
