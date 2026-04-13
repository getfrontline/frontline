"use client";

import { useEffect, useState } from "react";
import { hashscanUrl, shortAddr } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet/hedera";
import { fetchWalletProfile, type WalletProfile } from "@/lib/wallet/profile-reads";

export function ProfileView() {
  const { status, accountId } = useWallet();
  const connected = status === "connected" && !!accountId;
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!accountId) {
        setProfile(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const next = await fetchWalletProfile(accountId);
        if (!cancelled) setProfile(next);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-[0.25em]">Wallet</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        Profile
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)]">
        View your connected Hedera account, HBAR balance, and any native HTS tokens currently held by the wallet.
      </p>

      {!connected ? (
        <div className="border-accent-amber/30 bg-accent-amber/5 mt-8 rounded-2xl border p-6 text-sm text-[var(--text-secondary)]">
          Connect your HashPack wallet to load your Hedera profile and HTS token balances.
        </div>
      ) : null}

      {error ? (
        <div className="border-accent-amber/30 bg-accent-amber/5 mt-8 rounded-2xl border p-6 text-sm text-[var(--accent-amber)]">
          Failed to load wallet profile: {error}
        </div>
      ) : null}

      {connected ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">Account</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-muted text-[10px] font-bold uppercase tracking-wider">Hedera account</dt>
                <dd className="mt-1 font-mono text-sm text-[var(--accent-mint)]">{profile?.accountId ?? accountId}</dd>
              </div>
              <div>
                <dt className="text-muted text-[10px] font-bold uppercase tracking-wider">EVM address</dt>
                <dd className="mt-1 font-mono text-xs text-[var(--text-primary)]">
                  {profile?.evmAddress ? shortAddr(profile.evmAddress) : "Loading…"}
                </dd>
              </div>
              <div>
                <dt className="text-muted text-[10px] font-bold uppercase tracking-wider">HBAR balance</dt>
                <dd className="font-display mt-1 text-2xl font-black text-[var(--text-primary)]">
                  {profile?.hbarBalanceFormatted ?? (loading ? "Loading…" : "—")}
                </dd>
              </div>
            </dl>

            {profile?.accountId ? (
              <a
                href={hashscanUrl(profile.accountId, "account")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-cyan mt-6 inline-flex text-xs font-semibold hover:underline"
              >
                Open account in HashScan →
              </a>
            ) : null}
          </section>

          <section className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-3">
            <div className="border-border rounded-xl border bg-[var(--surface-base)]/50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Contract tokens
                  </h2>
                  <p className="text-muted mt-1 text-xs">
                    Smart-contract balances such as FLT bought from the bonding curve appear here.
                  </p>
                </div>
                <div className="grid gap-2 text-left sm:text-right">
                  <div>
                    <p className="font-display text-2xl font-black text-[var(--accent-mint)]">
                      {profile?.fltContractBalanceFormatted ?? (loading ? "Loading…" : "0 FLT")}
                    </p>
                    <p className="text-muted font-mono text-[10px]">EVM wallet address balance</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-[var(--accent-cyan)]">
                      {profile?.fltLongZeroBalanceFormatted ?? (loading ? "Loading…" : "0 FLT")}
                    </p>
                    <p className="text-muted font-mono text-[10px]">Hedera long-zero address balance</p>
                  </div>
                </div>
              </div>

              {profile && profile.fltLongZeroBalanceRaw > 0n && profile.fltContractBalanceRaw === 0n ? (
                <div className="border-accent-amber/30 bg-accent-amber/5 mt-4 rounded-xl border p-3 text-xs text-[var(--accent-amber)]">
                  This FLT appears to have been sent to your Hedera account-form address
                  {" "}
                  <span className="font-mono">{shortAddr(profile.longZeroAddress)}</span>
                  {" "}
                  instead of your EVM alias. Future buys will use the EVM address path.
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="mt-6">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  HTS tokens
                </h2>
                <p className="text-muted mt-1 text-xs">
                  Only native HTS token balances appear here. ERC-20 balances from smart contracts do not.
                </p>
              </div>
              <span className="text-muted font-mono text-xs">
                {loading ? "Refreshing…" : `${profile?.htsTokens.length ?? 0} token(s)`}
              </span>
            </div>

            {!loading && profile && profile.htsTokens.length === 0 ? (
              <div className="border-border mt-6 rounded-xl border border-dashed px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                No native HTS token balances found for this account.
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {profile?.htsTokens.map((token) => (
                <article key={token.tokenId} className="border-border rounded-xl border bg-[var(--surface-base)]/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display text-lg font-bold text-[var(--text-primary)]">
                        {token.name}
                        <span className="text-muted ml-2 font-mono text-xs">{token.symbol}</span>
                      </p>
                      <p className="text-muted mt-1 font-mono text-xs">{token.tokenId}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-display text-2xl font-black text-[var(--accent-cyan)]">{token.balanceFormatted}</p>
                      <p className="text-muted font-mono text-[10px]">{token.type}</p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-muted uppercase tracking-wider">Association</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-primary)]">
                        {token.automaticAssociation ? "Automatic" : "Manual"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted uppercase tracking-wider">Freeze</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-primary)]">{token.freezeStatus}</dd>
                    </div>
                    <div>
                      <dt className="text-muted uppercase tracking-wider">KYC</dt>
                      <dd className="mt-1 font-semibold text-[var(--text-primary)]">{token.kycStatus}</dd>
                    </div>
                  </dl>

                  <a
                    href={hashscanUrl(token.tokenId, "token")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-cyan mt-4 inline-flex text-xs font-semibold hover:underline"
                  >
                    View token in HashScan →
                  </a>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
