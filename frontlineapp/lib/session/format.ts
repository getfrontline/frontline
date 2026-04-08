import { FLT_SYMBOL } from "./catalog";

export const fmtFlt = (n: number, fractionDigits = 2) => {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
  return `${formatted} ${FLT_SYMBOL}`;
};

export const fmtFltCompact = (n: number) => {
  const formatted = new Intl.NumberFormat("en-US", {
    notation: n >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
  return `${formatted} ${FLT_SYMBOL}`;
};

export const fmtPct = (n: number, digits = 1) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
