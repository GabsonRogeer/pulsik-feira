"use client";
import { PRIZES } from "@/lib/config";
export function Wheel({
  rotation = 0,
  spinning = false,
}: {
  rotation?: number;
  spinning?: boolean;
}) {
  const cx = 200,
    cy = 200,
    r = 182;
  const fixed = (value: number) => Number(value.toFixed(3));
  return (
    <div className={"wheel-wrap " + (spinning ? "is-spinning" : "")}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div className="wheel-ring">
        <svg
          className="wheel"
          viewBox="0 0 400 400"
          role="img"
          aria-label="Roleta com copo personalizado, chaveiro abridor, caneta personalizada, não foi dessa vez e tente outra vez"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <defs>
            <radialGradient id="shine">
              <stop offset="0%" stopColor="white" stopOpacity=".13" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          {PRIZES.map((p, i) => {
            const a = ((i * 72 - 90) * Math.PI) / 180,
              b = (((i + 1) * 72 - 90) * Math.PI) / 180,
              mid = ((i * 72 + 36 - 90) * Math.PI) / 180;
            return (
              <g key={p.id}>
                <path
                  d={`M ${cx} ${cy} L ${fixed(cx + r * Math.cos(a))} ${fixed(cy + r * Math.sin(a))} A ${r} ${r} 0 0 1 ${fixed(cx + r * Math.cos(b))} ${fixed(cy + r * Math.sin(b))} Z`}
                  fill={p.color}
                  stroke="#b3a2ff44"
                  strokeWidth="1"
                />
                <g
                  transform={`translate(${fixed(cx + 123 * Math.cos(mid))},${fixed(cy + 123 * Math.sin(mid))}) rotate(${i * 72 + 36})`}
                >
                  <text
                    textAnchor="middle"
                    fill="white"
                    fontSize="14"
                    fontWeight="600"
                  >
                    {p.short === "Não foi dessa vez" ? (
                      <>
                        <tspan x="0" dy="-5">
                          Não foi
                        </tspan>
                        <tspan x="0" dy="19">
                          dessa vez
                        </tspan>
                      </>
                    ) : p.short === "Tente outra vez" ? (
                      <>
                        <tspan x="0" dy="-5">
                          Tente
                        </tspan>
                        <tspan x="0" dy="19">
                          outra vez
                        </tspan>
                      </>
                    ) : (
                      p.short
                    )}
                  </text>
                  {p.id === "cup" && (
                    <text
                      textAnchor="middle"
                      y="23"
                      fill="#eee4ff"
                      fontSize="10"
                      letterSpacing="2"
                    >
                      RARO
                    </text>
                  )}
                </g>
              </g>
            );
          })}
          <circle cx="200" cy="200" r="182" fill="url(#shine)" />
          <circle
            cx="200"
            cy="200"
            r="192"
            fill="none"
            stroke="#c9bbff"
            strokeOpacity=".35"
            strokeWidth="2"
          />
          {Array.from({ length: 40 }, (_, i) => {
            const a = (i * 9 * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={fixed(200 + 192 * Math.cos(a))}
                cy={fixed(200 + 192 * Math.sin(a))}
                r="2"
                fill={i % 2 ? "#9586d6" : "#eee2ff"}
              />
            );
          })}
        </svg>
        <div className="wheel-hub">
          <span className="hub-wave">ϟ</span>
          <span>PULSIK</span>
        </div>
      </div>
      <div className="wheel-shadow" />
    </div>
  );
}
