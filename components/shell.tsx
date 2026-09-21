import { ArrowUpRight } from "lucide-react";
export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Pulsik início">
        <img
          className="brand-logo"
          src="/icon_pulsik_no_bg.webp"
          width={40}
          height={40}
          alt=""
        />
        <span>
          Pulsik<span className="brand-dot">.</span>
        </span>
      </a>
      <div className="event-badge">
        <a
          className="event-logo-link"
          href="/"
          aria-label="Siará Tech Summit — início"
        >
          <img
            className="event-logo"
            src="/img_logo-sts_9dd3f97a14.avif"
            width={384}
            height={105}
            alt="Siará Tech Summit"
          />
        </a>
        <span className="event-year">2026</span>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Pulsik · Automação Inteligente.</span>
      <nav>
        <a href="/privacidade/">Privacidade</a>
        <a href="/regras/">Como funciona</a>
        <a href="https://pulsik.com.br/" target="_blank" rel="noreferrer">
          Conheça a Pulsik <ArrowUpRight size={14} />
        </a>
      </nav>
    </footer>
  );
}
