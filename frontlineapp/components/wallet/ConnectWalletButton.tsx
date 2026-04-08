"use client";

import { useWallet } from "@/lib/wallet/hedera";

export function ConnectWalletButton() {
  const { status, accountId, connect, disconnect } = useWallet();

  if (status === "no-project-id") {
    return (
      <span
        className="border-accent-amber/40 text-accent-amber cursor-help rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
        title="Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to frontlineapp/.env.local — get one free at cloud.reown.com"
      >
        No WC project ID
      </span>
    );
  }

  if (status === "connected" && accountId) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--accent-mint)]">{accountId}</span>
        <button
          type="button"
          onClick={disconnect}
          className="border-border text-muted hover:text-primary rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const loading = status === "initializing" || status === "connecting";

  return (
    <button
      type="button"
      onClick={connect}
      disabled={loading}
      className="bg-accent-cyan text-surface-base hover:bg-accent-cyan/80 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 sm:px-4"
    >
      {status === "initializing"
        ? "Loading…"
        : status === "connecting"
          ? "Connecting…"
          : "Connect wallet"}
    </button>
  );
}
