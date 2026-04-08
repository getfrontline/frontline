export const CONTRACTS = {
  flt: process.env.NEXT_PUBLIC_FLT_TOKEN_ADDRESS ?? "",
  pool: process.env.NEXT_PUBLIC_FRONTLINE_POOL_ADDRESS ?? "",
  reputation: process.env.NEXT_PUBLIC_FRONTLINE_REPUTATION_ADDRESS ?? "",
} as const;

export function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function hashscanUrl(addr: string, type: "contract" | "account" | "token" = "contract"): string {
  return `https://hashscan.io/testnet/${type}/${addr}`;
}
