/** Brazilian phone with DDD: 11 digits, displayed as (85) 98925-5170. */
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(
    /^(\d{1,2})(\d{0,5})(\d{0,4})$/,
    (_, ddd, first, last) =>
      "(" +
      ddd +
      (ddd.length === 2 ? ")" : "") +
      (first ? " " + first : "") +
      (last ? "-" + last : ""),
  );
}
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) throw new Error("invalid_phone");
  return digits;
}
