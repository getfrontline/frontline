"use client";

import Link from "next/link";
import { BNPL_FEE_BPS, REPAYMENT_DAYS } from "@/lib/session/catalog";
import { CONTRACTS, shortAddr, hashscanUrl } from "@/lib/contracts";
import { fmtFlt, fmtFltCompact, fmtPct } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { useWallet } from "@/lib/wallet/hedera";

export function DashboardHomeView() {
  const { status, accountId } = useWallet();
  const { state, tier, totalPoolFlt, utilizationPercent, cartPreview } = useFrontlineSession();
  const connected = status === "connected" && !!accountId;
  const { gross, lines } = cartPreview();
  const cartCount = lines.reduce((s, l) => s + l.qty, 0);
  const activeLoans = state.loans.filter((l) => l.status === "active").length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {!connected ? (
        <div className="border-accent-amber/30 bg-accent-amber/5 mb-10 rounded-2xl border p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-accent-amber text-sm font-bold uppercase tracking-wider">Wallet not connected</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Connect your HashPack wallet to use the faucet, buy products, stake liquidity, and repay loans.
              </p>
            </div>
            <Link
              href="/dashboard/faucet"
              className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim shrink-0 rounded-full px-5 py-2.5 text-center text-xs font-bold uppercase tracking-wide"
            >
              Get started
            </Link>
          </div>
        </div>
      ) : (
        <div className="border-accent-mint/25 bg-accent-mint/5 mb-10 flex flex-col gap-3 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-accent-mint text-xs font-bold uppercase tracking-wider">Connected</p>
            <p className="mt-1 font-mono text-sm text-[var(--text-primary)]">{accountId}</p>
          </div>
          <p className="font-display text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fmtFlt(state.walletBalanceFlt, 0)}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/faucet"
          className="border-border bg-surface-card group rounded-2xl border p-5 transition-colors hover:border-[var(--accent-cyan)]/40"
        >
          <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-wider">Faucet</p>
          <p className="font-display mt-2 text-lg font-bold text-[var(--text-primary)]">
            {fmtFlt(state.walletBalanceFlt, 0)}
          </p>
          <p className="text-muted mt-1 text-xs">Mint testnet FLT</p>
          <p className="text-accent-cyan mt-3 text-xs font-semibold group-hover:underline">Drip tokens →</p>
        </Link>

        <Link
          href="/dashboard/marketplace"
          className="border-border bg-surface-card group rounded-2xl border p-5 transition-colors hover:border-[var(--accent-mint)]/40"
        >
          <p className="text-accent-mint text-[10px] font-bold uppercase tracking-wider">Cart</p>
          <p className="font-display mt-2 text-lg font-bold text-[var(--text-primary)]">
            {cartCount > 0 ? `${cartCount} items · ${fmtFlt(gross, 0)}` : "Empty"}
          </p>
          <p className="text-muted mt-1 text-xs">Browse & add products</p>
          <p className="text-accent-mint mt-3 text-xs font-semibold group-hover:underline">Marketplace →</p>
        </Link>

        <Link
          href="/dashboard/reputation"
          className="border-border bg-surface-card group rounded-2xl border p-5 transition-colors hover:border-[var(--accent-amber)]/40"
        >
          <p className="text-accent-amber text-[10px] font-bold uppercase tracking-wider">Score</p>
          <p className="font-display mt-2 text-lg font-bold text-[var(--text-primary)]">
            {state.reputationScore} · {tier}
          </p>
          <p className="text-muted mt-1 text-xs">
            {activeLoans > 0 ? `${activeLoans} open loan(s)` : "No active loans"}
          </p>
          <p className="text-accent-amber mt-3 text-xs font-semibold group-hover:underline">Reputation →</p>
        </Link>

        <Link
          href="/dashboard/liquidity"
          className="border-border bg-surface-card group rounded-2xl border p-5 transition-colors hover:border-[var(--accent-cyan)]/40"
        >
          <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-wider">Pool</p>
          <p className="font-display mt-2 text-lg font-bold text-[var(--text-primary)]">
            {totalPoolFlt > 0 ? fmtFltCompact(totalPoolFlt) : "—"}
          </p>
          <p className="text-muted mt-1 text-xs">
            {utilizationPercent > 0 ? `${fmtPct(utilizationPercent)} utilized` : "Stake to provide liquidity"}
          </p>
          <p className="text-accent-cyan mt-3 text-xs font-semibold group-hover:underline">Manage →</p>
        </Link>
      </div>

      <section className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-surface-card rounded-2xl border p-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
            <li className="flex gap-3">
              <span className="text-accent-mint font-mono text-xs font-bold">01</span>
              <span>Mint FLT from the <strong className="text-primary">Faucet</strong> to fund your wallet</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent-mint font-mono text-xs font-bold">02</span>
              <span>Browse <strong className="text-primary">Merchants</strong>, add products, checkout with BNPL</span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent-cyan font-mono text-xs font-bold">03</span>
              <span>Repay within {REPAYMENT_DAYS} days to build your <strong className="text-primary">Reputation</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="text-accent-amber font-mono text-xs font-bold">04</span>
              <span>Stake FLT in <strong className="text-primary">Liquidity</strong> to earn yield from {BNPL_FEE_BPS / 100}% BNPL fees</span>
            </li>
          </ol>
        </div>

        <div className="border-border bg-surface-card rounded-2xl border p-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Contracts</h2>
          <p className="text-muted mt-1 text-xs">Deployed on Hedera Testnet</p>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              { label: "Frontline Token", addr: CONTRACTS.flt },
              { label: "Frontline Pool", addr: CONTRACTS.pool },
              { label: "Reputation", addr: CONTRACTS.reputation },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between gap-4">
                <dt className="text-[var(--text-secondary)]">{c.label}</dt>
                <dd>
                  {c.addr ? (
                    <a
                      href={hashscanUrl(c.addr)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[var(--accent-cyan)] hover:underline"
                    >
                      {shortAddr(c.addr)}
                    </a>
                  ) : (
                    <span className="text-muted font-mono text-xs">not deployed</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
