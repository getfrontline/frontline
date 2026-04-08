"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/hedera";
import { useFrontlineSession } from "@/lib/session/session-store";
import { CONTRACTS, shortAddr, hashscanUrl } from "@/lib/contracts";
import { fmtFlt } from "@/lib/session/format";
import { buildAssociateFlt, buildFaucetDrip } from "@/lib/wallet/transactions";

const DRIP_AMOUNT = 10_000;

export function FaucetView() {
  const { status, accountId, sendTx } = useWallet();
  const { faucetDrip, state, refreshFromChain } = useFrontlineSession();
  const [associating, setAssociating] = useState(false);
  const [associated, setAssociated] = useState(false);
  const [dripping, setDripping] = useState(false);
  const [lastDrip, setLastDrip] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const connected = status === "connected" && !!accountId;

  const handleAssociate = async () => {
    if (!accountId) return;
    setError(null);
    setAssociating(true);
    setTxStatus("Building association transaction…");
    try {
      const tx = await buildAssociateFlt(accountId);
      setTxStatus("Approve in your wallet…");
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

  const handleDrip = async () => {
    if (!accountId) return;
    setError(null);
    setDripping(true);
    setTxStatus("Building faucet transaction…");
    try {
      const tx = await buildFaucetDrip(accountId);
      setTxStatus("Approve in your wallet…");
      await sendTx(tx);
      faucetDrip(DRIP_AMOUNT);
      setLastDrip(Date.now());
      setTxStatus(null);
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Faucet failed: ${msg}`);
      setTxStatus(null);
    } finally {
      setDripping(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-[0.25em]">Testnet faucet</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        Mint FLT
      </h1>
      <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)]">
        Get testnet Frontline Tokens to interact with the protocol. {DRIP_AMOUNT.toLocaleString()} FLT per drip, 1 hour cooldown.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Session balance</p>
              <p className="font-display mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                {fmtFlt(state.walletBalanceFlt, 0)}
              </p>
            </div>
            <div className="border-border rounded-xl border border-dashed bg-[var(--surface-base)]/60 p-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Wallet</p>
              {connected ? (
                <p className="mt-2 truncate font-mono text-sm text-[var(--accent-mint)]">{accountId}</p>
              ) : (
                <p className="mt-2 text-sm text-[var(--accent-amber)]">Not connected</p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Step 1 — Associate FLT token</p>
            <button
              type="button"
              onClick={handleAssociate}
              disabled={associating || !connected || associated}
              className="border-accent-cyan/40 text-accent-cyan hover:bg-accent-cyan/10 w-full rounded-xl border py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {associated ? "Token associated" : associating ? "Associating…" : "Associate FLT with wallet"}
            </button>

            <p className="text-muted mt-4 text-[10px] font-bold uppercase tracking-wider">Step 2 — Mint FLT</p>
            <button
              type="button"
              onClick={handleDrip}
              disabled={dripping || !connected}
              className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dripping ? "Minting…" : `Mint ${DRIP_AMOUNT.toLocaleString()} FLT`}
            </button>
          </div>

          {txStatus ? (
            <p className="text-accent-cyan mt-3 text-sm">{txStatus}</p>
          ) : null}

          {error ? <p className="text-accent-amber mt-3 text-sm">{error}</p> : null}

          {lastDrip ? (
            <div className="border-accent-mint/25 bg-accent-mint/5 mt-4 rounded-xl border p-4 text-sm text-[var(--text-secondary)]">
              <span className="text-accent-mint font-semibold">+{DRIP_AMOUNT.toLocaleString()} FLT</span>{" "}
              minted at {new Date(lastDrip).toLocaleTimeString()} — check your wallet on{" "}
              <a
                href={hashscanUrl(accountId ?? "", "account")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan hover:underline"
              >
                Hashscan
              </a>
            </div>
          ) : null}
        </div>

        <div className="border-border bg-surface-elevated/80 rounded-2xl border p-6 lg:col-span-2">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Token info</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              { k: "Name", v: "Frontline Token" },
              { k: "Symbol", v: "FLT" },
              { k: "Decimals", v: "8" },
              { k: "Drip", v: `${DRIP_AMOUNT.toLocaleString()} FLT` },
              { k: "Cooldown", v: "1 hour" },
            ].map((row) => (
              <div key={row.k} className="flex justify-between gap-4">
                <dt className="text-muted">{row.k}</dt>
                <dd className="font-mono text-xs font-semibold text-[var(--text-primary)]">{row.v}</dd>
              </div>
            ))}
            {CONTRACTS.flt ? (
              <div className="border-border flex justify-between gap-4 border-t border-dashed pt-3">
                <dt className="text-muted">Contract</dt>
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
          </dl>
        </div>
      </div>
    </main>
  );
}
