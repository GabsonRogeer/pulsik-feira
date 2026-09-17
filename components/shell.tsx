import { ArrowUpRight, Zap } from "lucide-react";
export function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Pulsik início">
        <Zap size={30} />
        <span>
          pulsik<span className="brand-dot">.</span>
        </span>
      </a>
      <div className="event-badge">
        <span className="event-star">✳</span> SIARÁ TECH SUMMIT{" "}
        <span className="event-year">2026</span>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Pulsik · Inteligência que conecta.</span>
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
