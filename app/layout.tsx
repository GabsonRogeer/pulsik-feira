import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/experience.css";
import "@/styles/admin.css";
export const metadata: Metadata = {
  title: "Pulsik | Sua sorte conecta aqui",
  description:
    "A experiência Pulsik no Siará Tech Summit. Cadastre-se, gire a roleta e descubra sua surpresa.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
