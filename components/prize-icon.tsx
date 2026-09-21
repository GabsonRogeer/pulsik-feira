import { Coffee, KeyRound, PenLine, RotateCw, Heart } from "lucide-react";
import type { Outcome } from "@/lib/config";
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
