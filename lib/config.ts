export const CAMPAIGN = "siara-2026";
export const SOCIALS = {
  instagram: "https://www.instagram.com/pulsik_ia/",
  linkedin: "https://www.linkedin.com/company/pulsik/",
  website: "https://pulsik.com.br/",
};
export const PRIZES = [
  {
    id: "cup",
    label: "Copo personalizado",
    short: "Copo",
    chance: 3,
    stock: 30,
    color: "#8d72ef",
  },
  {
    id: "keychain",
    label: "Chaveiro abridor",
    short: "Chaveiro",
    chance: 20,
    stock: 200,
    color: "#5766bf",
  },
  {
    id: "pen",
    label: "Caneta personalizada",
    short: "Caneta",
    chance: 20,
    stock: 200,
    color: "#398daf",
  },
  {
    id: "none",
    label: "Não foi dessa vez",
    short: "Não foi dessa vez",
    chance: 47,
    stock: null,
    color: "#353d66",
  },
  {
    id: "retry",
    label: "Tente outra vez",
    short: "Tente outra vez",
    chance: 10,
    stock: null,
    color: "#6961b2",
  },
] as const;
export type Outcome = (typeof PRIZES)[number]["id"];
export type Participant = {
  id: string;
  name: string;
  company: string;
  job_title: string;
  email: string;
  phone: string | null;
  marketing: boolean;
  status: "ready" | "complete";
  outcome: Outcome | null;
  claim_code: string | null;
  redeemed_at: string | null;
  created_at?: string;
  registration_code?: string;
  spin_count?: number;
};
export type SpinResult = {
  id: string;
  outcome: Outcome;
  claim_code: string | null;
};
