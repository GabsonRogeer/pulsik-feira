import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import type { EmailLoginModel } from "./use-email-login";
export function EmailLogin({
  model,
  disabled,
}: {
  model: EmailLoginModel;
  disabled: boolean;
}) {
  const {
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
  } = model;
  return (
    <div className="email-login">
      <div className="auth-divider">
        <span>ou</span>
      </div>
      {!open ? (
        <button
          className="button secondary"
          disabled={disabled || busy}
          onClick={() => setOpen(true)}
        >
          <Mail size={19} />
          Continuar com e-mail
          <ArrowRight size={18} />
        </button>
      ) : (
        <>
          <form
            className="email-login-form"
            onSubmit={sentEmail ? verify : send}
          >
            {sentEmail ? (
              <>
                <p className="email-destination">
                  Digite o código enviado para <strong>{sentEmail}</strong>.
                </p>
                <label htmlFor="login-code">
                  Código de acesso
                  <input
                    id="login-code"
                    ref={codeInput}
                    className="email-code"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    required
                    disabled={disabled || busy}
                    aria-describedby="code-help"
                  />
                </label>
                <p id="code-help" className="input-note">
                  Use os 6 números do e-mail mais recente.
                </p>
              </>
            ) : (
              <label htmlFor="login-email">
                Seu e-mail
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  required
                  disabled={disabled || busy}
                />
              </label>
            )}
            <button
              className="button primary"
              disabled={disabled || busy || (!sentEmail && remaining > 0)}
            >
              {busy ? (
                <LoaderCircle size={18} className="spin-icon" />
              ) : (
                <Mail size={18} />
              )}{" "}
              {busy
                ? "Aguarde…"
                : sentEmail
                  ? "Confirmar e continuar"
                  : remaining
                    ? "Aguarde " + remaining + "s"
                    : "Receber código por e-mail"}
            </button>
          </form>
          {sentEmail && (
            <div className="email-login-actions">
              <button
                className="text-button"
                disabled={disabled || busy || remaining > 0}
                onClick={() => void send()}
              >
                {remaining > 0
                  ? "Reenviar em " + remaining + "s"
                  : "Reenviar código"}
              </button>
              <button
                className="text-button"
                disabled={disabled || busy}
                onClick={changeEmail}
              >
                Corrigir e-mail
              </button>
            </div>
          )}
          {notice && (
            <p className="email-auth-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
