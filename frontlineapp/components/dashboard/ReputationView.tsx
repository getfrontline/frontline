"use client";

import Link from "next/link";
import { useState } from "react";
import { FLT_DECIMALS } from "@/lib/session/catalog";
import { fmtFlt } from "@/lib/session/format";
import { tierHint } from "@/lib/session/reputation";
import { useFrontlineSession } from "@/lib/session/session-store";
import { useWallet } from "@/lib/wallet/hedera";
import { buildApprovePool, buildRepay } from "@/lib/wallet/transactions";

const TIER_COLORS: Record<string, string> = {
  Recovering: "text-[var(--accent-amber)]",
  Fair: "text-[var(--text-secondary)]",
  Good: "text-[var(--accent-cyan)]",
  Strong: "text-[var(--accent-mint)]",
  Elite: "text-[var(--accent-mint)]",
};

export function ReputationView() {
  const { state, tier, repayLoan, refreshFromChain } = useFrontlineSession();
  const { status, accountId, sendTx } = useWallet();
  const connected = status === "connected" && !!accountId;
  const { reputationScore, onTimeStreak, loans, ledger } = state;
  const activeLoans = loans.filter((l) => l.status === "active");
  const paidLoans = loans.filter((l) => l.status === "repaid");
  const pct = Math.min(100, Math.max(0, ((reputationScore - 300) / (850 - 300)) * 100));

  const [repaying, setRepaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRepay = async (loanId: string, principalFlt: number) => {
    if (!accountId) return;
    setError(null);
    setRepaying(loanId);
    try {
      const rawAmount = BigInt(Math.round(principalFlt * 10 ** FLT_DECIMALS));
      const overdue = Date.now() > (loans.find((l) => l.id === loanId)?.dueAt ?? 0);
      const lateFee = overdue ? (rawAmount * 500n) / 10_000n : 0n;
      const totalApproval = rawAmount + lateFee;

      const approveTx = await buildApprovePool(accountId, totalApproval);
      await sendTx(approveTx);

      const repayTx = await buildRepay(accountId, BigInt(loanId.replace(/\D/g, "") || "0"), rawAmount);
      await sendTx(repayTx);

      repayLoan(loanId);
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Repay failed: ${msg}`);
    } finally {
      setRepaying(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-amber text-[10px] font-bold uppercase tracking-[0.25em]">Credit profile</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        Reputation
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border-border bg-surface-card relative overflow-hidden rounded-2xl border p-6 lg:col-span-2">
          <div className="from-accent-mint/10 pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br to-transparent blur-2xl" />
          <div className="relative">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Score</p>
                <p className="font-display mt-1 text-5xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">
                  {reputationScore}
                </p>
                <p className={`mt-1 text-sm font-bold uppercase tracking-wide ${TIER_COLORS[tier] ?? ""}`}>{tier}</p>
              </div>
              <div className="w-full sm:max-w-[180px]">
                <div className="border-border bg-surface-base h-2.5 overflow-hidden rounded-full border">
                  <div
                    className="from-accent-mint h-full rounded-full bg-gradient-to-r to-[var(--accent-cyan)] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-muted mt-1.5 font-mono text-[10px]">300 — 850</p>
              </div>
            </div>
            <p className="text-muted mt-4 max-w-md text-xs leading-relaxed">{tierHint(tier)}</p>
          </div>
        </div>

        <div className="border-border bg-surface-elevated/80 rounded-2xl border p-6">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Factors</h2>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-muted text-xs">On-time streak</dt>
              <dd className="font-display mt-0.5 text-lg font-bold text-[var(--text-primary)]">{onTimeStreak}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Active exposure</dt>
              <dd className="font-display mt-0.5 text-lg font-bold text-[var(--text-primary)]">
                {activeLoans.length > 0 ? fmtFlt(activeLoans.reduce((s, l) => s + l.principalFlt, 0), 0) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Loans repaid</dt>
              <dd className="font-display mt-0.5 text-lg font-bold text-[var(--text-primary)]">{paidLoans.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {error ? (
        <div className="border-accent-amber/25 bg-accent-amber/5 mt-6 rounded-xl border p-4 text-sm text-[var(--accent-amber)]">
          {error}
        </div>
      ) : null}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Open loans</h2>
          <Link href="/dashboard/checkout" className="text-accent-mint text-xs font-semibold hover:underline">← Checkout</Link>
        </div>
        {activeLoans.length === 0 ? (
          <div className="border-border mt-4 rounded-xl border border-dashed py-12 text-center">
            <p className="text-muted text-sm">No active loans</p>
            <Link href="/dashboard/marketplace" className="text-accent-mint mt-1 inline-block text-xs font-semibold hover:underline">
              Browse marketplace →
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeLoans.map((loan) => {
              const overdue = Date.now() > loan.dueAt;
              const isRepaying = repaying === loan.id;
              return (
                <div
                  key={loan.id}
                  className={`border-border bg-surface-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${overdue ? "border-[var(--accent-amber)]/40" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-display text-xl font-bold tabular-nums text-[var(--text-primary)]">
                      {fmtFlt(loan.principalFlt, 0)}
                    </p>
                    <p className={`text-xs ${overdue ? "text-accent-amber font-semibold" : "text-muted"}`}>
                      {overdue ? "Overdue — " : "Due "}
                      {new Date(loan.dueAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      {overdue ? ` · +5% late fee (${fmtFlt(loan.principalFlt * 0.05)})` : ""}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[10px] text-[var(--text-muted)]">
                      {loan.payouts.map((p) => (
                        <li key={p.merchantId}>{p.merchantName}: {fmtFlt(p.netFlt, 0)} net</li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRepay(loan.id, loan.principalFlt)}
                    disabled={!connected || isRepaying}
                    className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim shrink-0 rounded-lg px-5 py-2 text-xs font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRepaying ? "Repaying…" : "Repay"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {ledger.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Activity</h2>
          <ul className="mt-4 space-y-2">
            {ledger.slice(0, 10).map((ev) => (
              <li key={ev.id} className="border-border flex items-center gap-3 rounded-lg border bg-[var(--surface-card)]/60 px-4 py-2.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  ev.kind === "repayment" ? "bg-[var(--accent-mint)]"
                    : ev.kind === "bnpl_opened" ? "bg-[var(--accent-amber)]"
                    : ev.kind === "token_buy" ? "bg-[var(--accent-cyan)]"
                    : "bg-[var(--text-muted)]"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{ev.title}</p>
                  <p className="text-muted truncate text-[10px]">{ev.detail}</p>
                </div>
                <time className="text-muted shrink-0 font-mono text-[10px]">
                  {new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
