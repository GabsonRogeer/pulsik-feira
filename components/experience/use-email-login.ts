"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LoginUser } from "@/lib/api-client";
import { EMAIL_RESEND_SECONDS } from "@/lib/auth-limits";
import {
  emailAuthError,
  sendEmailCode,
  verifyEmailCode,
} from "@/lib/email-auth";
export function useEmailLogin(onVerified: (user: LoginUser) => Promise<void>) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [remaining, setRemaining] = useState(0);
  const lock = useRef(false);
  const resendAt = useRef(0);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const tick = () =>
      setRemaining(
        Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000)),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (sentEmail) codeInput.current?.focus();
  }, [sentEmail]);
  async function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (lock.current || Date.now() < resendAt.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const address = await sendEmailCode(sentEmail || email);
      resendAt.current = Date.now() + EMAIL_RESEND_SECONDS * 1000;
      setRemaining(EMAIL_RESEND_SECONDS);
      setSentEmail(address);
      setCode("");
      setNotice("Código solicitado. Confira sua caixa de entrada e o spam.");
      codeInput.current?.focus();
    } catch (e) {
      setError(emailAuthError(e));
      if ((e as { status?: number })?.status === 429) {
        resendAt.current = Date.now() + EMAIL_RESEND_SECONDS * 1000;
        setRemaining(EMAIL_RESEND_SECONDS);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentEmail || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const user = await verifyEmailCode(sentEmail, code);
      setCode("");
      await onVerified(user);
    } catch (e) {
      setError(emailAuthError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function changeEmail() {
    if (lock.current) return;
    setSentEmail("");
    setCode("");
    setError("");
    setNotice("");
    // Changing this UI state does not bypass the server's per-email limit.
    resendAt.current = 0;
    setRemaining(0);
  }
  function reset() {
    changeEmail();
    setEmail("");
    setOpen(false);
  }
  return {
    open,
    setOpen,
    email,
    setEmail,
    sentEmail,
    code,
    setCode,
    busy,
    error,
    notice,
    remaining,
    codeInput,
    send,
    verify,
    changeEmail,
    reset,
  };
}
export type EmailLoginModel = ReturnType<typeof useEmailLogin>;
