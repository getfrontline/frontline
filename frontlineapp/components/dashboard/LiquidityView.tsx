"use client";

import Link from "next/link";
import { useState } from "react";
import { FLT_DECIMALS } from "@/lib/session/catalog";
import { fmtPct, fmtFlt, fmtFltCompact } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { useWallet } from "@/lib/wallet/hedera";
import { buildApprovePool, buildStake, buildUnstake, buildClaimYield } from "@/lib/wallet/transactions";

export function LiquidityView() {
  const { state, totalPoolFlt, utilizationPercent, stake, unstake, resetSession, refreshFromChain } = useFrontlineSession();
  const { status, accountId, sendTx } = useWallet();
  const connected = status === "connected" && !!accountId;
  const [stakeInput, setStakeInput] = useState("");
  const [unstakeInput, setUnstakeInput] = useState("");
  const [txPending, setTxPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { lpStakedFlt, bnplOutstandingFlt, merchantBalancesFlt } = state;
  const availableLiquidity = Math.max(0, totalPoolFlt - bnplOutstandingFlt);
  const hasAnyBalance = Object.values(merchantBalancesFlt).some((b) => b > 0);

  const onStake = async () => {
    if (!accountId) return;
    const n = Number.parseFloat(stakeInput.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return;
    const amount = Math.floor(n);
    const rawAmount = BigInt(amount) * BigInt(10 ** FLT_DECIMALS);

    setError(null);
    setTxPending("stake");
    try {
      const approveTx = await buildApprovePool(accountId, rawAmount);
      await sendTx(approveTx);

      const stakeTx = await buildStake(accountId, rawAmount);
      await sendTx(stakeTx);

      stake(amount);
      setStakeInput("");
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Stake failed: ${msg}`);
    } finally {
      setTxPending(null);
    }
  };

  const onUnstake = async () => {
    if (!accountId) return;
    const n = Number.parseFloat(unstakeInput.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return;
    const amount = Math.min(Math.floor(n), lpStakedFlt);
    const rawAmount = BigInt(amount) * BigInt(10 ** FLT_DECIMALS);

    setError(null);
    setTxPending("unstake");
    try {
      const tx = await buildUnstake(accountId, rawAmount);
      await sendTx(tx);
      unstake(amount);
      setUnstakeInput("");
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Unstake failed: ${msg}`);
    } finally {
      setTxPending(null);
    }
  };

  const onClaimYield = async () => {
    if (!accountId) return;
    setError(null);
    setTxPending("claim");
    try {
      const tx = await buildClaimYield(accountId);
      await sendTx(tx);
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("no yield")) {
        setError(`Claim failed: ${msg}`);
      }
    } finally {
      setTxPending(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-[0.25em]">Liquidity</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        Stake FLT
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
        Provide liquidity to back instant merchant payouts. Earn yield from BNPL fees.
      </p>

      {error ? (
        <div className="border-accent-amber/25 bg-accent-amber/5 mt-6 rounded-xl border p-4 text-sm text-[var(--accent-amber)]">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Pool</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">TVL</p>
              <p className="font-display mt-1.5 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {totalPoolFlt > 0 ? fmtFltCompact(totalPoolFlt) : "—"}
              </p>
            </div>
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Outstanding</p>
              <p className="font-display mt-1.5 text-xl font-bold tabular-nums text-[var(--accent-amber)]">
                {bnplOutstandingFlt > 0 ? fmtFltCompact(bnplOutstandingFlt) : "—"}
              </p>
            </div>
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Utilization</p>
              <p className="font-display mt-1.5 text-xl font-bold tabular-nums text-[var(--accent-mint)]">
                {utilizationPercent > 0 ? fmtPct(utilizationPercent) : "—"}
              </p>
            </div>
          </div>
          {totalPoolFlt > 0 ? (
            <p className="text-muted mt-4 text-[10px]">Available: {fmtFltCompact(availableLiquidity)}</p>
          ) : null}
        </div>

        <div className="border-border bg-surface-elevated/80 space-y-5 rounded-2xl border p-6">
          <div>
            <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Your stake</p>
            <p className="font-display mt-1 text-2xl font-black tabular-nums text-[var(--accent-mint)]">
              {lpStakedFlt > 0 ? fmtFlt(lpStakedFlt, 0) : "—"}
            </p>
          </div>

          <div>
            <label htmlFor="stake-amt" className="text-muted text-[10px] font-bold uppercase tracking-wider">Stake FLT</label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="stake-amt"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2"
              />
              <button
                type="button"
                onClick={onStake}
                disabled={!connected || !stakeInput || txPending === "stake"}
                className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim shrink-0 rounded-lg px-4 py-2 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
              >
                {txPending === "stake" ? "…" : "Stake"}
              </button>
            </div>
          </div>

          {lpStakedFlt > 0 ? (
            <>
              <div>
                <label htmlFor="unstake-amt" className="text-muted text-[10px] font-bold uppercase tracking-wider">Withdraw FLT</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="unstake-amt"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={unstakeInput}
                    onChange={(e) => setUnstakeInput(e.target.value)}
                    className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={onUnstake}
                    disabled={!connected || !unstakeInput || txPending === "unstake"}
                    className="border-border text-primary hover:border-accent-mint/40 shrink-0 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
                  >
                    {txPending === "unstake" ? "…" : "Withdraw"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClaimYield}
                disabled={!connected || txPending === "claim"}
                className="border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 w-full rounded-lg border py-2 text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
              >
                {txPending === "claim" ? "Claiming…" : "Claim yield"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {hasAnyBalance ? (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Merchant balances</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {Object.entries(merchantBalancesFlt).map(([key, bal]) => {
              if (bal <= 0) return null;
              return (
                <div key={key} className="border-border bg-surface-card rounded-xl border p-4">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{key === "self" ? "Your balance" : key}</p>
                  <p className="font-display mt-1 text-lg font-bold tabular-nums text-[var(--accent-cyan)]">
                    {fmtFlt(bal, 0)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-4">
        <Link href="/dashboard/marketplace" className="text-accent-mint text-xs font-semibold hover:underline">
          Marketplace →
        </Link>
        <button
          type="button"
          onClick={() => resetSession()}
          className="border-border text-muted hover:border-accent-amber/50 hover:text-accent-amber rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors"
        >
          Reset session
        </button>
      </div>
    </main>
  );
}
