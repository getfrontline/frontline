"use client";

import Link from "next/link";
import { useState } from "react";
import { BNPL_FEE_BPS, REPAYMENT_DAYS, FLT_DECIMALS } from "@/lib/session/catalog";
import { fmtFlt } from "@/lib/session/format";
import { useFrontlineSession } from "@/lib/session/session-store";
import { useWallet } from "@/lib/wallet/hedera";
import { buildOpenBnpl } from "@/lib/wallet/transactions";

export function CheckoutView() {
  const { cartPreview, checkoutBnpl, state, clearCart, refreshFromChain, merchantByAddr } = useFrontlineSession();
  const { status, accountId, sendTx } = useWallet();
  const { lines, gross } = cartPreview();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const connected = status === "connected" && !!accountId;

  const totalFee = (gross * BNPL_FEE_BPS) / 10_000;
  const merchantNet = gross - totalFee;
  const activeLoans = state.loans.filter((l) => l.status === "active");

  const handleCheckout = async () => {
    if (!accountId || lines.length === 0) return;
    setSuccess(null);
    setError(null);
    setSubmitting(true);

    try {
      const payouts = new Map<string, bigint>();

      for (const { product, qty } of lines) {
        const merchantAddr = product.merchantAddress?.trim();

        if (!merchantAddr) {
          const merchantName = merchantByAddr(product.merchantId)?.name ?? product.merchantId;
          throw new Error(`Merchant \"${merchantName}\" is not configured with an on-chain address`);
        }

        const lineRaw = BigInt(Math.round(product.priceFlt * qty * 10 ** FLT_DECIMALS));
        payouts.set(merchantAddr, (payouts.get(merchantAddr) ?? 0n) + lineRaw);
      }

      const tx = await buildOpenBnpl(accountId, [...payouts.keys()], [...payouts.values()]);
      await sendTx(tx);

      checkoutBnpl();
      refreshFromChain();
      setSuccess(
        `Merchants received ${fmtFlt(merchantNet)} net. You owe ${fmtFlt(gross)}, due in ${REPAYMENT_DAYS} days.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`BNPL failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <p className="text-accent-cyan text-[10px] font-bold uppercase tracking-[0.25em]">Settlement</p>
      <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
        BNPL Checkout
      </h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
        Merchants get paid instantly from the pool. You repay the principal interest-free within {REPAYMENT_DAYS} days.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="border-border bg-surface-card overflow-hidden rounded-2xl border lg:col-span-3">
          <div className="border-border border-b border-dashed px-5 py-3 sm:px-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">Cart</h2>
          </div>
          {lines.length === 0 ? (
            <div className="px-5 py-16 text-center sm:px-6">
              <p className="text-muted text-sm">Cart is empty</p>
              <Link href="/dashboard/marketplace" className="text-accent-mint mt-2 inline-block text-sm font-semibold hover:underline">
                Browse marketplace →
              </Link>
            </div>
          ) : (
            <ul className="divide-border divide-y divide-dashed">
              {lines.map(({ product, qty }) => (
                <li key={product.id} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{product.name}</p>
                    <p className="text-muted font-mono text-[10px]">{product.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">{qty} × {fmtFlt(product.priceFlt, 0)}</p>
                    <p className="font-mono text-sm font-bold tabular-nums text-[var(--text-primary)]">{fmtFlt(product.priceFlt * qty, 0)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="border-border bg-surface-elevated/80 rounded-2xl border p-5 sm:p-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider">Summary</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Gross</dt>
                <dd className="font-mono font-semibold tabular-nums">{fmtFlt(gross, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Fee ({BNPL_FEE_BPS / 100}%)</dt>
                <dd className="font-mono tabular-nums text-[var(--accent-amber)]">−{fmtFlt(totalFee)}</dd>
              </div>
              <div className="border-border flex justify-between border-t border-dashed pt-2.5">
                <dt className="font-medium text-[var(--text-primary)]">Net to merchants</dt>
                <dd className="font-mono font-bold tabular-nums text-[var(--accent-mint)]">{fmtFlt(merchantNet, 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">You repay</dt>
                <dd className="font-mono font-bold tabular-nums">{fmtFlt(gross, 0)}</dd>
              </div>
            </dl>
            <p className="text-muted mt-3 text-[10px]">Due in {REPAYMENT_DAYS} days · interest-free</p>

            <button
              type="button"
              disabled={lines.length === 0 || !connected || submitting}
              onClick={handleCheckout}
              className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim mt-5 w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Submitting…" : !connected ? "Connect wallet first" : "Confirm BNPL"}
            </button>

            {lines.length > 0 && !submitting ? (
              <button type="button" onClick={() => clearCart()} className="text-muted hover:text-primary mt-2 w-full text-center text-[10px] font-bold uppercase tracking-wide">
                Clear cart
              </button>
            ) : null}

            {error ? (
              <div className="border-accent-amber/25 bg-accent-amber/5 mt-4 rounded-xl border p-3 text-xs text-[var(--accent-amber)]">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="border-accent-mint/25 bg-accent-mint/5 mt-4 rounded-xl border p-3 text-xs text-[var(--text-secondary)]">
                {success}{" "}
                <Link href="/dashboard/reputation" className="text-accent-mint font-semibold hover:underline">Repay →</Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {activeLoans.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider">Open loans</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeLoans.map((loan) => (
              <div key={loan.id} className="border-border bg-surface-card flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-primary)]">{fmtFlt(loan.principalFlt, 0)}</p>
                  <p className="text-muted text-xs">Due {new Date(loan.dueAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                </div>
                <Link href="/dashboard/reputation" className="text-accent-mint text-xs font-semibold hover:underline">Repay →</Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
