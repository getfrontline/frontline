"use client";

import Link from "next/link";
import { fmtFlt } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { useWallet } from "@/lib/wallet/hedera";

export function MarketplaceView() {
  const { addToCart, state, setQty, removeLine, merchants, products } = useFrontlineSession();
  const { status, accountId } = useWallet();
  const connected = status === "connected" && !!accountId;

  const linesInCart = state.cart.length;

  // Group products by merchant address
  const merchantsWithProducts = merchants.map((m) => ({
    merchant: m,
    products: products.filter((p) => p.merchantId === m.id),
  }));

  const hasProducts = merchantsWithProducts.some((g) => g.products.length > 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-accent-mint text-[10px] font-bold uppercase tracking-[0.25em]">Marketplace</p>
          <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Merchants &amp; products
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Browse on-chain merchants and their products — checkout splits instant payouts per merchant from the pool.
          </p>
        </div>
        {linesInCart > 0 ? (
          <Link
            href="/dashboard/checkout"
            className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim shrink-0 rounded-xl px-5 py-2.5 text-center text-xs font-bold uppercase tracking-wide"
          >
            Checkout ({linesInCart}) →
          </Link>
        ) : null}
      </div>

      {!connected ? (
        <div className="border-accent-amber/30 bg-accent-amber/5 mt-8 rounded-xl border p-4 text-sm text-[var(--text-secondary)]">
          Connect your wallet to add products to cart.
        </div>
      ) : null}

      {merchants.length === 0 ? (
        <div className="border-border bg-surface-card mt-8 rounded-2xl border p-10 text-center">
          <p className="text-muted text-sm">No merchants registered on-chain yet.</p>
          <Link
            href="/dashboard/register"
            className="text-accent-mint mt-2 inline-block text-sm font-semibold hover:underline"
          >
            Register as merchant →
          </Link>
        </div>
      ) : !hasProducts ? (
        <div className="mt-8 space-y-6">
          {merchantsWithProducts.map(({ merchant }) => (
            <section key={merchant.id} className="border-border overflow-hidden rounded-2xl border bg-[var(--surface-card)]">
              <div className="border-border border-b border-dashed px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{merchant.name}</h2>
                    <p className="text-muted text-xs">
                      <span className="text-accent-amber">{merchant.category || "Uncategorized"}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-5 py-8 text-center sm:px-6">
                <p className="text-muted text-sm">No products yet</p>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {merchantsWithProducts.map(({ merchant, products: mProducts }) => {
            if (mProducts.length === 0 && merchantsWithProducts.length > 3) return null;
            return (
              <section key={merchant.id} className="border-border overflow-hidden rounded-2xl border bg-[var(--surface-card)]">
                <div className="border-border border-b border-dashed px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-[var(--text-primary)]">{merchant.name}</h2>
                      <p className="text-muted text-xs">
                        <span className="text-accent-amber">{merchant.category || "Uncategorized"}</span>
                        {merchant.tagline ? ` · ${merchant.tagline}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
                {mProducts.length === 0 ? (
                  <div className="px-5 py-8 text-center sm:px-6">
                    <p className="text-muted text-sm">No products yet</p>
                  </div>
                ) : (
                  <div className="grid gap-px bg-[var(--border-color)]/30 sm:grid-cols-2">
                    {mProducts.map((p) => {
                      const line = state.cart.find((l) => l.productId === p.id);
                      const qty = line?.qty ?? 0;
                      return (
                        <div key={p.id} className="bg-[var(--surface-card)] p-5 sm:p-6">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</p>
                          {p.description ? (
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{p.description}</p>
                          ) : null}
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="font-mono text-sm font-bold text-[var(--accent-mint)]">{fmtFlt(p.priceFlt, 0)}</p>
                            <div className="flex items-center gap-2">
                              {qty > 0 ? (
                                <>
                                  <label className="sr-only" htmlFor={`qty-${p.id}`}>Qty</label>
                                  <input
                                    id={`qty-${p.id}`}
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={qty}
                                    onChange={(e) => setQty(p.id, Number.parseInt(e.target.value, 10) || 0)}
                                    className="border-border bg-surface-base text-primary focus:ring-accent-mint/40 h-8 w-14 rounded-lg border px-2 font-mono text-xs outline-none focus:ring-2"
                                  />
                                  <button type="button" onClick={() => removeLine(p.id)} className="text-muted hover:text-accent-amber text-[10px] font-bold uppercase">
                                    ×
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => addToCart(p.id)}
                                disabled={!connected}
                                className="bg-surface-elevated text-primary border-border hover:border-accent-mint/50 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
