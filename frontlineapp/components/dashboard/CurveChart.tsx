"use client";

import { useMemo } from "react";
import type { CurvePoint } from "@/lib/wallet/curve-chart";

const MARGIN = { top: 16, right: 16, bottom: 32, left: 48 };
const WIDTH = 600;
const HEIGHT = 220;

function fmtAxis(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export function CurveChart({
  points,
  currentSold,
  currentPrice,
}: {
  points: CurvePoint[];
  currentSold: number;
  currentPrice: number;
}) {
  const { path, areaPath, xTicks, yTicks, xScale, yScale } = useMemo(() => {
    const maxX = Math.max(points[points.length - 1]?.soldFlt ?? 0, currentSold);
    const maxY = Math.max(
      ...points.map((p) => p.priceHbar),
      currentPrice * 1.1,
    );

    const innerW = WIDTH - MARGIN.left - MARGIN.right;
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

    const xScale = (v: number) => MARGIN.left + (v / maxX) * innerW;
    const yScale = (v: number) => MARGIN.top + innerH - (v / maxY) * innerH;

    let path = "";
    let areaPath = "";
    points.forEach((p, i) => {
      const x = xScale(p.soldFlt);
      const y = yScale(p.priceHbar);
      if (i === 0) {
        path += `M ${x} ${y}`;
        areaPath += `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
        areaPath += ` L ${x} ${y}`;
      }
    });
    // Close area
    const lastX = xScale(points[points.length - 1].soldFlt);
    const baseY = yScale(0);
    const firstX = xScale(points[0].soldFlt);
    areaPath += ` L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;

    const xTicks = [0, maxX * 0.25, maxX * 0.5, maxX * 0.75, maxX];
    const yTicks = [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];

    return { path, areaPath, xTicks, yTicks, xScale, yScale };
  }, [points, currentSold, currentPrice]);

  const cx = xScale(currentSold);
  const cy = yScale(currentPrice);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: "auto" }}
      aria-label="Bonding curve price chart"
    >
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-mint)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent-mint)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line
          key={`gy-${i}`}
          x1={MARGIN.left}
          y1={yScale(t)}
          x2={WIDTH - MARGIN.right}
          y2={yScale(t)}
          stroke="var(--border-color)"
          strokeDasharray="3,3"
          strokeWidth={1}
        />
      ))}
      {xTicks.map((t, i) => (
        <line
          key={`gx-${i}`}
          x1={xScale(t)}
          y1={MARGIN.top}
          x2={xScale(t)}
          y2={HEIGHT - MARGIN.bottom}
          stroke="var(--border-color)"
          strokeDasharray="3,3"
          strokeWidth={1}
        />
      ))}

      {/* Area */}
      <path d={areaPath} fill="url(#curveFill)" />

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke="var(--accent-mint)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current position dot */}
      <circle cx={cx} cy={cy} r={4} fill="var(--accent-amber)" stroke="var(--surface-base)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={8} fill="none" stroke="var(--accent-amber)" strokeWidth={1} opacity={0.4} />

      {/* Y-axis labels */}
      {yTicks.map((t, i) => (
        <text
          key={`yl-${i}`}
          x={MARGIN.left - 8}
          y={yScale(t) + 4}
          textAnchor="end"
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          {fmtAxis(t)}
        </text>
      ))}

      {/* X-axis labels */}
      {xTicks.map((t, i) => (
        <text
          key={`xl-${i}`}
          x={xScale(t)}
          y={HEIGHT - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          {fmtAxis(t)}
        </text>
      ))}

      {/* Axis titles */}
      <text
        x={MARGIN.left - 36}
        y={HEIGHT / 2}
        textAnchor="middle"
        fontSize={10}
        fill="var(--text-muted)"
        fontFamily="var(--font-sans)"
        transform={`rotate(-90, ${MARGIN.left - 36}, ${HEIGHT / 2})`}
      >
        Price (HBAR)
      </text>
      <text
        x={WIDTH / 2 + MARGIN.left / 2}
        y={HEIGHT - 2}
        textAnchor="middle"
        fontSize={10}
        fill="var(--text-muted)"
        fontFamily="var(--font-sans)"
      >
        Sold supply (FLT)
      </text>
    </svg>
  );
}
