"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/hedera";
import { CONTRACTS, hashscanUrl } from "@/lib/contracts";
import { FLT_DECIMALS } from "@/lib/session/catalog";
import { fmtFlt } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { buildRegisterMerchant, buildUpdateMerchant, buildAddProduct, buildMerchantWithdraw } from "@/lib/wallet/transactions";

export function RegisterView() {
  const { status, accountId, sendTx } = useWallet();
  const { state, products, refreshFromChain, refreshCatalog } = useFrontlineSession();
  const connected = status === "connected" && !!accountId;

  // --- Registration form ---
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "update">("register");

  // --- Product form ---
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodPending, setProdPending] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodSuccess, setProdSuccess] = useState<string | null>(null);

  // --- Withdraw ---
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const isMerchant = state.isMerchant;
  const merchantBalance = state.merchantBalancesFlt["self"] ?? 0;

  // Get EVM address for the connected account (used for product lookups)
  // We match products by looking through chain data
  const myProducts = products.filter((p) => {
    // We need to know our own EVM address — but we only have the Hedera account ID.
    // Products are matched by merchant address. Since we don't have our EVM address client-side
    // in a simple way, we'll rely on the fact that if we're a merchant, our products were
    // added with our EVM address. The chain catalog uses lowercase addresses.
    // For now, show all products (the marketplace already filters by merchant).
    // A better approach would be to store our EVM address in session state.
    return true; // Will filter below using the chain merchant data
  });

  const handleSubmit = async () => {
    if (!accountId || !name.trim()) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const tx = mode === "register"
        ? await buildRegisterMerchant(accountId, name.trim(), category.trim())
        : await buildUpdateMerchant(accountId, name.trim(), category.trim());
      await sendTx(tx);
      setSuccess(
        mode === "register"
          ? `Registered as merchant "${name.trim()}". Your wallet address is now a registered merchant on-chain.`
          : `Updated merchant info to "${name.trim()}".`,
      );
      setName("");
      setCategory("");
      refreshFromChain();
      refreshCatalog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already registered")) {
        setError("This wallet is already registered. Switch to Update mode to change your info.");
      } else if (msg.includes("not registered")) {
        setError("This wallet is not registered yet. Switch to Register mode first.");
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  const handleAddProduct = async () => {
    if (!accountId) return;
    const trimmedName = prodName.trim();
    const priceNum = Number.parseFloat(prodPrice);
    if (!trimmedName || !Number.isFinite(priceNum) || priceNum <= 0) {
      setProdError("Enter a valid product name and price.");
      return;
    }
    setProdError(null);
    setProdSuccess(null);
    setProdPending(true);
    try {
      const priceRaw = BigInt(Math.round(priceNum * 10 ** FLT_DECIMALS));
      // The merchant passes their own account ID; the contract resolves the EVM address.
      // We need the EVM address for the addProduct call.
      // Use the mirror node lookup to get our EVM address.
      const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
      const json = await res.json();
      const evmAddr = json.evm_address as string;
      if (!evmAddr) throw new Error("Could not resolve your EVM address");

      const tx = await buildAddProduct(accountId, evmAddr, trimmedName, priceRaw);
      await sendTx(tx);
      setProdSuccess(`Product "${trimmedName}" added at ${priceNum} FLT.`);
      setProdName("");
      setProdPrice("");
      refreshCatalog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setProdError(`Add product failed: ${msg}`);
    } finally {
      setProdPending(false);
    }
  };

  const handleWithdraw = async () => {
    if (!accountId) return;
    const amount = Number.parseFloat(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError("Enter a valid amount.");
      return;
    }
    if (amount > merchantBalance) {
      setWithdrawError(`Max withdrawable: ${fmtFlt(merchantBalance)}`);
      return;
    }
    setWithdrawError(null);
    setWithdrawSuccess(null);
    setWithdrawPending(true);
    try {
      const rawAmount = BigInt(Math.round(amount * 10 ** FLT_DECIMALS));
      const tx = await buildMerchantWithdraw(accountId, rawAmount);
      await sendTx(tx);
      setWithdrawSuccess(`Withdrew ${fmtFlt(amount)}. Check your wallet balance.`);
      setWithdrawAmount("");
      refreshFromChain();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setWithdrawError(`Withdrawal failed: ${msg}`);
    } finally {
      setWithdrawPending(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-mint text-[10px] font-bold uppercase tracking-[0.25em]">On-chain</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        Merchant
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                mode === "register"
                  ? "bg-accent-mint/15 text-accent-mint border border-[var(--accent-mint)]/35"
                  : "border-border text-muted border"
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode("update")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                mode === "update"
                  ? "bg-accent-cyan/15 text-accent-cyan border border-[var(--accent-cyan)]/35"
                  : "border-border text-muted border"
              }`}
            >
              Update
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="merch-name" className="text-muted text-[10px] font-bold uppercase tracking-wider">
                Merchant name *
              </label>
              <input
                id="merch-name"
                type="text"
                placeholder="e.g. My Shop"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="merch-cat" className="text-muted text-[10px] font-bold uppercase tracking-wider">
                Category
              </label>
              <input
                id="merch-cat"
                type="text"
                placeholder="e.g. Electronics, Food, Retail"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!connected || !name.trim() || pending}
            className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim mt-6 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending
              ? "Submitting…"
              : !connected
                ? "Connect wallet first"
                : mode === "register"
                  ? "Register as merchant"
                  : "Update merchant info"}
          </button>

          {error ? (
            <div className="border-accent-amber/25 bg-accent-amber/5 mt-4 rounded-xl border p-3 text-xs text-[var(--accent-amber)]">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="border-accent-mint/25 bg-accent-mint/5 mt-4 rounded-xl border p-4 text-sm text-[var(--text-secondary)]">
              {success}
            </div>
          ) : null}
        </div>

        <div className="border-border bg-surface-elevated/80 rounded-2xl border p-6 lg:col-span-2">
          {connected ? (
            <div>
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Wallet</p>
              <p className="mt-1 truncate font-mono text-xs text-[var(--accent-mint)]">{accountId}</p>
              {isMerchant ? (
                <p className="text-accent-cyan mt-2 text-[10px] font-bold uppercase">✓ Registered</p>
              ) : null}
            </div>
          ) : (
            <p className="text-accent-amber text-sm">Connect wallet to register</p>
          )}

          {CONTRACTS.pool ? (
            <div className="border-border mt-4 border-t border-dashed pt-4">
              <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Pool contract</p>
              <a
                href={hashscanUrl(CONTRACTS.pool)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-mono text-xs text-[var(--accent-cyan)] hover:underline"
              >
                View on Hashscan →
              </a>
            </div>
          ) : null}
        </div>
      </div>

      {/* ====== Product Management (visible when registered as merchant) ====== */}
      {isMerchant && connected ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Products
          </h2>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="border-border bg-surface-card rounded-2xl border p-6 lg:col-span-3">
              <div className="space-y-4">
                <div>
                  <label htmlFor="prod-name" className="text-muted text-[10px] font-bold uppercase tracking-wider">
                    Product name *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    placeholder="e.g. Wireless Headphones"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="border-border bg-surface-base text-primary focus:ring-accent-cyan/40 mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="prod-price" className="text-muted text-[10px] font-bold uppercase tracking-wider">
                    Price (FLT) *
                  </label>
                  <input
                    id="prod-price"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 150"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="border-border bg-surface-base text-primary focus:ring-accent-cyan/40 mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddProduct}
                disabled={prodPending || !prodName.trim() || !prodPrice}
                className="bg-accent-cyan text-surface-base hover:bg-accent-cyan/80 mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {prodPending ? "Adding…" : "Add product on-chain"}
              </button>

              {prodError ? (
                <div className="border-accent-amber/25 bg-accent-amber/5 mt-4 rounded-xl border p-3 text-xs text-[var(--accent-amber)]">
                  {prodError}
                </div>
              ) : null}
              {prodSuccess ? (
                <div className="border-accent-mint/25 bg-accent-mint/5 mt-4 rounded-xl border p-3 text-xs text-[var(--text-secondary)]">
                  {prodSuccess}
                </div>
              ) : null}
            </div>

            <div className="border-border bg-surface-elevated/80 rounded-2xl border p-6 lg:col-span-2">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                On-chain products
              </h3>
              <p className="text-muted mt-1 text-xs">All registered products across merchants</p>
              {products.length === 0 ? (
                <p className="text-muted mt-4 text-sm">No products added yet.</p>
              ) : (
                <ul className="divide-border mt-4 divide-y divide-dashed">
                  {products.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-[var(--text-primary)]">{p.name}</span>
                      <span className="font-mono text-xs font-bold text-[var(--accent-mint)]">{fmtFlt(p.priceFlt, 0)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ====== Merchant Balance Withdraw ====== */}
      {isMerchant && connected && merchantBalance > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Earnings
          </h2>

          <div className="mt-6 max-w-md">
            <div className="border-border bg-surface-card rounded-2xl border p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-muted text-[10px] font-bold uppercase tracking-wider">Available balance</p>
                  <p className="font-display mt-1 text-2xl font-black tabular-nums text-[var(--accent-amber)]">
                    {fmtFlt(merchantBalance, 2)}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label htmlFor="withdraw-amt" className="text-muted text-[10px] font-bold uppercase tracking-wider">
                  Withdraw amount (FLT)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="withdraw-amt"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="border-border bg-surface-base text-primary focus:ring-accent-amber/40 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(merchantBalance.toString())}
                    className="border-border text-muted hover:text-primary shrink-0 rounded-lg border px-2 py-2 text-[10px] font-bold uppercase"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawPending || !withdrawAmount}
                className="bg-accent-amber text-surface-base hover:bg-accent-amber/80 mt-4 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {withdrawPending ? "Withdrawing…" : "Withdraw FLT"}
              </button>

              {withdrawError ? (
                <div className="border-accent-amber/25 bg-accent-amber/5 mt-3 rounded-xl border p-3 text-xs text-[var(--accent-amber)]">
                  {withdrawError}
                </div>
              ) : null}
              {withdrawSuccess ? (
                <div className="border-accent-mint/25 bg-accent-mint/5 mt-3 rounded-xl border p-3 text-xs text-[var(--text-secondary)]">
                  {withdrawSuccess}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
