"use client";

import { useEffect, useState } from "react";
import { fetchCurveTransactions, type CurveTx } from "@/lib/wallet/curve-transactions";
import { HEDERA_HASHSCAN_NETWORK } from "@/lib/wallet/network-config";

function hashscanTxUrl(hash: string): string {
  return `https://hashscan.io/${HEDERA_HASHSCAN_NETWORK}/transaction/${hash}`;
}

function fmtHbar(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 0 })} HBAR`;
}

function fmtFlt(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })} FLT`;
}

export function CurveTransactions() {
  const [txs, setTxs] = useState<CurveTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchCurveTransactions(20);
        if (!cancelled) setTxs(data);
      } catch (err) {
        console.error("[Frontline] curve transactions fetch failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalVolume = txs.reduce((sum, t) => sum + t.hbarAmount, 0);
  const buyCount = txs.filter((t) => t.type === "buy").length;
  const sellCount = txs.filter((t) => t.type === "sell").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-3 text-center">
          <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Recent volume</p>
          <p className="font-display mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]">
            {fmtHbar(totalVolume)}
          </p>
        </div>
        <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-3 text-center">
          <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Buys</p>
          <p className="font-display mt-1 text-lg font-bold tabular-nums text-[var(--accent-mint)]">
            {buyCount}
          </p>
        </div>
        <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-3 text-center">
          <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Sells</p>
          <p className="font-display mt-1 text-lg font-bold tabular-nums text-[var(--accent-amber)]">
            {sellCount}
          </p>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <p className="text-muted py-4 text-center text-xs">Loading recent transactions…</p>
        ) : txs.length === 0 ? (
          <p className="text-muted py-4 text-center text-xs">No recent curve transactions found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted py-2 pr-2 font-semibold uppercase tracking-wider">Type</th>
                <th className="text-muted py-2 pr-2 font-semibold uppercase tracking-wider">FLT</th>
                <th className="text-muted py-2 pr-2 font-semibold uppercase tracking-wider">HBAR</th>
                <th className="text-muted py-2 font-semibold uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx, i) => (
                <tr key={i} className="border-border border-b border-dashed last:border-0">
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        tx.type === "buy"
                          ? "bg-[var(--accent-mint)]/10 text-[var(--accent-mint)]"
                          : tx.type === "sell"
                            ? "bg-[var(--accent-amber)]/10 text-[var(--accent-amber)]"
                            : "bg-[var(--surface-elevated)] text-[var(--text-muted)]"
                      }`}
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-2 pr-2 font-mono tabular-nums">{fmtFlt(tx.tokenAmount)}</td>
                  <td className="py-2 pr-2 font-mono tabular-nums">{fmtHbar(tx.hbarAmount)}</td>
                  <td className="py-2">
                    <a
                      href={hashscanTxUrl(tx.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-cyan)] hover:underline"
                    >
                      {tx.timestamp}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
