import { PRIZES, type Outcome } from "./config";

export type Chances = Record<Outcome, number>;
export const DEFAULT_CHANCES = Object.fromEntries(
  PRIZES.map((p) => [p.id, p.chance]),
) as Chances;

// Compare hundredths so decimal sums are not affected by floating-point error.
export function validChances(value: unknown): value is Chances {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = value as Record<string, unknown>;
  return (
    Object.keys(entries).length === PRIZES.length &&
    PRIZES.every(({ id }) => {
      const n = entries[id];
      return (
        typeof n === "number" &&
        Number.isFinite(n) &&
        n >= 0 &&
        n <= 100 &&
        Math.abs(n * 100 - Math.round(n * 100)) < 1e-8
      );
    }) &&
    PRIZES.reduce(
      (sum, { id }) => sum + Math.round((entries[id] as number) * 100),
      0,
    ) === 10000 &&
    (entries.retry as number) < 100
  );
}

export function parseChancesDraft(
  draft: Record<string, string>,
): Chances | null {
  if (PRIZES.some(({ id }) => !/^\d+(?:[.,]\d{1,2})?$/.test(draft[id] ?? "")))
    return null;
  const chances = Object.fromEntries(
    PRIZES.map(({ id }) => [id, Number(draft[id].replace(",", "."))]),
  );
  return validChances(chances) ? chances : null;
}
