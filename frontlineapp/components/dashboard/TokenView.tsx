"use client";

import { useEffect, useState } from "react";
import { CONTRACTS, hashscanUrl, shortAddr } from "@/lib/contracts";
import { fmtFlt } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { fetchTokenStats, quoteCurveBuyExactTokens } from "@/lib/wallet/contract-reads";
import { useWallet } from "@/lib/wallet/hedera";
import { buildAssociateFlt, buildBuyCurveTokens } from "@/lib/wallet/transactions";

const FLT_DECIMALS = 8;

type TokenPanelState = {
  curveLiquidityFlt: number;
  soldSupplyFlt: number;
  spotPriceHbar: number;
};

function fmtHbar(amount: number, digits = 4) {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} HBAR`;
}

export function TokenView() {
  const { status, accountId, sendTx } = useWallet();
  const { recordTokenBuy, state, refreshFromChain } = useFrontlineSession();
  const [associating, setAssociating] = useState(false);
  const [associated, setAssociated] = useState(false);
  const [buying, setBuying] = useState(false);
  const [tokenAmountInput, setTokenAmountInput] = useState("250");
  const [quoteTinybar, setQuoteTinybar] = useState<bigint>(0n);
  const [stats, setStats] = useState<TokenPanelState>({
    curveLiquidityFlt: 0,
    soldSupplyFlt: 0,
    spotPriceHbar: 0,
  });
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = status === "connected" && !!accountId;
  const tokenAmount = Number.parseFloat(tokenAmountInput.replace(/,/g, ""));
  const parsedBuyAmount = Number.isFinite(tokenAmount) && tokenAmount > 0 ? Math.floor(tokenAmount) : 0;
  const quoteHbar = Number(quoteTinybar) / 1e8;

  useEffect(() => {
    let cancelled = false;

    async function syncStats() {
      try {
        const next = await fetchTokenStats();
        if (!cancelled) setStats(next);
      } catch (err) {
        if (!cancelled) {
          console.error("[Frontline] token stats failed", err);
        }
      }
    }

    syncStats();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncQuote() {
      if (!parsedBuyAmount || !CONTRACTS.curve) {
        setQuoteTinybar(0n);
        return;
      }

      try {
        const rawAmount = BigInt(parsedBuyAmount) * BigInt(10 ** FLT_DECIMALS);
        const quote = await quoteCurveBuyExactTokens(rawAmount);
        if (!cancelled) setQuoteTinybar(quote);
      } catch (err) {
        if (!cancelled) {
          setQuoteTinybar(0n);
          console.error("[Frontline] curve quote failed", err);
        }
      }
    }

    syncQuote();
    return () => {
      cancelled = true;
    };
  }, [parsedBuyAmount]);

  const refreshAll = async () => {
    await refreshFromChain();
    const next = await fetchTokenStats();
    setStats(next);
  };

  const handleAssociate = async () => {
    if (!accountId) return;
    setError(null);
    setAssociating(true);
    setTxStatus("Building FLT association transaction…");
    try {
      const tx = await buildAssociateFlt(accountId);
      setTxStatus("Approve in HashPack…");
      await sendTx(tx);
      setAssociated(true);
      setTxStatus(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("TOKEN_ALREADY_ASSOCIATED") || msg.includes("ALREADY_ASSOCIATED")) {
        setAssociated(true);
        setTxStatus(null);
      } else {
        setError(`Association failed: ${msg}`);
        setTxStatus(null);
      }
    } finally {
      setAssociating(false);
    }
  };

  const handleBuy = async () => {
    if (!accountId || parsedBuyAmount <= 0 || quoteTinybar <= 0n) return;
    setError(null);
    setBuying(true);
    setTxStatus("Building bonding-curve buy transaction…");
    try {
      const rawAmount = BigInt(parsedBuyAmount) * BigInt(10 ** FLT_DECIMALS);
      const tx = await buildBuyCurveTokens(accountId, rawAmount, quoteTinybar);
      setTxStatus("Approve in HashPack…");
      await sendTx(tx);
      recordTokenBuy(parsedBuyAmount);
      setTxStatus(null);
      await refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Buy failed: ${msg}`);
      setTxStatus(null);
    } finally {
      setBuying(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-[0.25em]">Token access</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        FLT bonding curve
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
        Associate FLT to your Hedera wallet, then buy launch inventory directly from the curve. This replaces the
        old faucet flow for testnet usage.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Wallet balance</p>
              <p className="font-display mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {fmtFlt(state.walletBalanceFlt, 0)}
              </p>
            </div>
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Connected wallet</p>
              {connected ? (
                <p className="mt-2 truncate font-mono text-sm text-[var(--accent-mint)]">{accountId}</p>
              ) : (
                <p className="mt-2 text-sm text-[var(--accent-amber)]">Not connected</p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Step 1 — Associate FLT</p>
            <button
              type="button"
              onClick={handleAssociate}
              disabled={associating || !connected || associated}
              className="border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 w-full rounded-xl border py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {associated ? "Token associated" : associating ? "Associating…" : "Associate FLT with wallet"}
            </button>

            <div className="mt-5 rounded-2xl bg-[var(--surface-base)]/70 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Step 2 — Buy from curve</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Quotes are fetched live from the Hedera testnet bonding curve.
                  </p>
                </div>
                <p className="font-mono text-xs text-[var(--accent-cyan)]">
                  {quoteTinybar > 0n ? fmtHbar(quoteHbar, 6) : "No quote"}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <label className="flex-1">
                  <span className="text-muted text-[10px] font-bold uppercase tracking-wider">FLT amount</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tokenAmountInput}
                    onChange={(e) => setTokenAmountInput(e.target.value)}
                    placeholder="250"
                    className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 mt-1.5 w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none focus:ring-2"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleBuy}
                  disabled={buying || !connected || parsedBuyAmount <= 0 || quoteTinybar <= 0n}
                  className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:self-end"
                >
                  {buying ? "Buying…" : `Buy ${parsedBuyAmount > 0 ? parsedBuyAmount.toLocaleString() : ""} FLT`}
                </button>
              </div>
            </div>
          </div>

          {txStatus ? <p className="text-accent-cyan mt-3 text-sm">{txStatus}</p> : null}
          {error ? <p className="text-accent-amber mt-3 text-sm">{error}</p> : null}
        </div>

        <div className="border-border bg-surface-elevated/80 rounded-2xl border p-6 lg:col-span-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Curve stats</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              { k: "Available liquidity", v: fmtFlt(stats.curveLiquidityFlt, 0) },
              { k: "Sold supply", v: fmtFlt(stats.soldSupplyFlt, 0) },
              { k: "Spot price", v: fmtHbar(stats.spotPriceHbar, 6) },
              { k: "Launch inventory", v: "50,000 FLT" },
            ].map((row) => (
              <div key={row.k} className="flex justify-between gap-4">
                <dt className="text-muted">{row.k}</dt>
                <dd className="font-mono text-xs font-semibold text-[var(--text-primary)]">{row.v}</dd>
              </div>
            ))}

            {CONTRACTS.flt ? (
              <div className="border-border flex justify-between gap-4 border-t border-dashed pt-3">
                <dt className="text-muted">FLT token</dt>
                <dd>
                  <a
                    href={hashscanUrl(CONTRACTS.flt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--accent-cyan)] hover:underline"
                  >
                    {shortAddr(CONTRACTS.flt)}
                  </a>
                </dd>
              </div>
            ) : null}

            {CONTRACTS.curve ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Bonding curve</dt>
                <dd>
                  <a
                    href={hashscanUrl(CONTRACTS.curve)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--accent-cyan)] hover:underline"
                  >
                    {shortAddr(CONTRACTS.curve)}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </main>
  );
}
