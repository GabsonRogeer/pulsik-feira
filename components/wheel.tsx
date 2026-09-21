"use client";
import type { CSSProperties } from "react";
import { WHEEL_SEGMENTS, WHEEL_LIGHTS } from "@/lib/wheel-geometry";
export function Wheel({
  rotation = 0,
  spinning = false,
}: {
  rotation?: number;
  spinning?: boolean;
}) {
  return (
    <div className={"wheel-wrap " + (spinning ? "is-spinning" : "")}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div className="wheel-ring">
        <svg
          className="wheel"
          viewBox="0 0 400 400"
          role="img"
          aria-label="Roleta com copo personalizado, chaveiro abridor, caneta personalizada, não foi dessa vez e tente outra vez"
          style={{ "--wheel-rotation": `${rotation}deg` } as CSSProperties}
        >
          <defs>
            <radialGradient id="shine">
              <stop offset="0%" stopColor="white" stopOpacity=".13" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          {WHEEL_SEGMENTS.map((p) => {
            return (
              <g key={p.id}>
                <path
                  d={p.path}
                  fill={p.color}
                  stroke="#b3a2ff44"
                  strokeWidth="1"
                />
                <g transform={p.labelTransform}>
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
          {WHEEL_LIGHTS.map((light, i) => (
            <circle
              key={i}
              cx={light.x}
              cy={light.y}
              r="2"
              fill={light.color}
            />
          ))}
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
