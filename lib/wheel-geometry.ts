import { PRIZES } from "./config";
const fixed = (value: number) => Number(value.toFixed(3));
const cx = 200,
  cy = 200,
  radius = 182;
export const WHEEL_SEGMENTS = PRIZES.map((prize, i) => {
  const a = ((i * 72 - 90) * Math.PI) / 180;
  const b = (((i + 1) * 72 - 90) * Math.PI) / 180;
  const mid = ((i * 72 + 36 - 90) * Math.PI) / 180;
  return {
    ...prize,
    path: `M ${cx} ${cy} L ${fixed(cx + radius * Math.cos(a))} ${fixed(cy + radius * Math.sin(a))} A ${radius} ${radius} 0 0 1 ${fixed(cx + radius * Math.cos(b))} ${fixed(cy + radius * Math.sin(b))} Z`,
    labelTransform: `translate(${fixed(cx + 123 * Math.cos(mid))},${fixed(cy + 123 * Math.sin(mid))}) rotate(${i * 72 + 36})`,
  };
});
export const WHEEL_LIGHTS = Array.from({ length: 40 }, (_, i) => {
  const angle = (i * 9 * Math.PI) / 180;
  return {
    x: fixed(cx + 192 * Math.cos(angle)),
    y: fixed(cy + 192 * Math.sin(angle)),
    color: i % 2 ? "#9586d6" : "#eee2ff",
  };
});
