import Link from "next/link";
import { PageBackdropFixed } from "@/components/layout/PageBackdrop";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

const FLOW_STEPS = [
  {
    n: "01",
    title: "BNPL at checkout",
    body: "The customer selects Pay Now Later instead of paying the full cart upfront.",
  },
  {
    n: "02",
    title: "Merchant paid now",
    body: "Liquidity from the pool settles the merchant in stablecoin—no waiting on repayments.",
  },
  {
    n: "03",
    title: "7-day window",
    body: "Interest-free for the shopper inside the designed repayment period.",
  },
  {
    n: "04",
    title: "On-chain history",
    body: "Repayment events log immutably, building a portable credit profile over time.",
  },
  {
    n: "05",
    title: "Risk controls",
    body: "Defaults can trigger token-level controls and coordinated off-chain recovery.",
  },
] as const;

const STAKEHOLDERS = [
  {
    tag: "Merchants",
    headline: "Instant payout, predictable fee",
    body: "Offer BNPL without carrying settlement delay. Flat 2% BNPL fee per transaction.",
    accent: "from-[var(--accent-mint)]/25 to-transparent",
  },
  {
    tag: "Shoppers",
    headline: "Short-term, interest-free",
    body: "Breathing room at checkout with a clear due date—behavior that compounds into on-chain credit history.",
    accent: "from-[var(--accent-amber)]/20 to-transparent",
  },
  {
    tag: "Liquidity",
    headline: "Fund settlement, earn yield",
    body: "Back instant merchant settlement from a stablecoin pool aligned with protocol activity and fees.",
    accent: "from-[var(--accent-cyan)]/20 to-transparent",
  },
] as const;

const HEDERA_LAYERS = [
  { abbr: "HTS", label: "Tokenized credit & compliance hooks" },
  { abbr: "HCS", label: "Repayment & dispute logs" },
  { abbr: "FLT", label: "Settlement on Hedera" },
  { abbr: "Mirror", label: "Analytics & reporting" },
] as const;

export function HomeLanding() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <PageBackdropFixed />

      <a
        href="#main"
        className="focus-visible:ring-accent-mint sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--surface-elevated)] focus:px-4 focus:py-2 focus:text-sm focus:outline-none focus:ring-2"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
          <div className="border-accent-mint/30 absolute -left-px top-24 hidden h-32 w-px bg-gradient-to-b from-[var(--accent-mint)] to-transparent lg:block" />
          <p className="reveal text-accent-amber mb-6 text-xs font-bold uppercase tracking-[0.25em]">
            Instant-settle BNPL gateway
          </p>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <h1 className="font-display reveal reveal-delay-1 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                Merchants get paid{" "}
                <span className="text-[var(--accent-mint)]">now</span>. Shoppers repay on their timeline.
              </h1>
              <p className="reveal reveal-delay-2 mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
                Frontline is a token-backed liquidity layer for Buy Now, Pay Later: instant merchant settlement, a
                short interest-free repayment window, and on-chain history that supports portable credit profiles.
              </p>
              <div className="reveal reveal-delay-3 mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/dashboard"
                  className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Dashboard
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/dashboard/marketplace"
                  className="border-border text-primary hover:border-accent-mint/40 inline-flex items-center rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
                >
                  Merchants
                </Link>
              </div>
            </div>
            <aside className="relative lg:col-span-5">
              <div className="border-border bg-surface-card/80 reveal reveal-delay-2 relative overflow-hidden rounded-2xl border p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur-sm sm:p-8">
                <div className="from-accent-mint/15 pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br to-transparent blur-2xl" />
                <p className="text-muted text-xs font-bold uppercase tracking-wider">At a glance</p>
                <ul className="mt-6 space-y-5">
                  {[
                    { k: "Repayment window", v: "7 days", hint: "interest-free by design" },
                    { k: "Merchant BNPL fee", v: "2%", hint: "flat per transaction" },
                    { k: "Settlement rail", v: "FLT", hint: "Frontline Token on Hedera" },
                  ].map((row) => (
                    <li
                      key={row.k}
                      className="border-border flex items-baseline justify-between gap-4 border-b border-dashed pb-5 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-muted text-xs uppercase tracking-wider">{row.k}</p>
                        <p className="font-display mt-1 text-2xl font-bold text-[var(--text-primary)]">{row.v}</p>
                        <p className="text-muted mt-1 text-sm">{row.hint}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <section
          className="border-border border-y border-dashed bg-[var(--surface-ribbon)]/60 py-4"
          aria-label="Highlights"
        >
          <div className="animate-marquee-slow flex w-max gap-12 whitespace-nowrap px-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] sm:gap-16">
            {[...Array(2)].map((_, copy) => (
              <span key={copy} className="flex gap-12 sm:gap-16">
                <span className="text-[var(--accent-mint)]">Instant merchant payout</span>
                <span>Portable on-chain credit history</span>
                <span className="text-[var(--accent-amber)]">Pilot-ready checkout surface</span>
                <span>Hedera HTS · HCS · Mirror</span>
              </span>
            ))}
          </div>
        </section>

        <section id="flow" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Core flow
            </h2>
            <p className="mt-4 text-[var(--text-secondary)]">
              From checkout selection to repayment logging—one continuous line from shopper intent to protocol
              observability.
            </p>
          </div>
          <ol className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step.n}
                className="border-border bg-surface-card group relative overflow-hidden rounded-xl border p-6 transition-colors hover:border-[var(--accent-mint)]/35"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
                    i % 3 === 0
                      ? "from-[var(--accent-mint)]/8"
                      : i % 3 === 1
                        ? "from-[var(--accent-cyan)]/8"
                        : "from-[var(--accent-amber)]/8"
                  } to-transparent`}
                />
                <span className="font-display text-accent-mint/90 text-4xl font-black tabular-nums">{step.n}</span>
                <h3 className="font-display mt-4 text-lg font-bold text-[var(--text-primary)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="stakeholders" className="bg-[var(--surface-elevated)] py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Built for three rhythms at once
            </h2>
            <p className="mt-4 max-w-2xl text-[var(--text-secondary)]">
              Merchants optimize cash flow. Shoppers optimize timing. Liquidity providers align capital with volume—all
              under the same settlement fabric.
            </p>
            <div className="mt-14 grid gap-6 lg:grid-cols-3">
              {STAKEHOLDERS.map((card) => (
                <article
                  key={card.tag}
                  className="border-border relative overflow-hidden rounded-2xl border bg-[var(--surface-card)] p-8"
                >
                  <div
                    className={`pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-gradient-to-br ${card.accent} blur-2xl`}
                  />
                  <p className="text-accent-mint text-xs font-bold uppercase tracking-[0.2em]">{card.tag}</p>
                  <h3 className="font-display mt-4 text-xl font-bold text-[var(--text-primary)]">{card.headline}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="protocol" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
                Hedera-native observability
              </h2>
              <p className="mt-4 text-[var(--text-secondary)]">
                Tokenized credit lines, immutable repayment logs, and mirror-backed analytics keep compliance and
                reporting close to the ledger—without collapsing off-chain scoring, notifications, and collections.
              </p>
            </div>
            <ul className="flex flex-wrap gap-3">
              {HEDERA_LAYERS.map((layer) => (
                <li
                  key={layer.abbr}
                  className="border-border bg-surface-card hover:border-accent-cyan/40 rounded-full border px-4 py-2 transition-colors"
                >
                  <span className="text-accent-cyan font-mono text-xs font-bold">{layer.abbr}</span>
                  <span className="text-muted ml-2 text-xs">{layer.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-border border-t border-dashed py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="font-display text-2xl font-extrabold text-[var(--text-primary)] sm:text-3xl">
              Explore the product
            </h2>
            <p className="text-muted mt-4 text-sm sm:text-base">
              The dashboard covers merchants, BNPL checkout, reputation, and LP staking in one place.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide"
              >
                Open dashboard
              </Link>
              <Link
                href="/dashboard/liquidity"
                className="border-border text-primary hover:border-accent-mint/40 rounded-full border px-6 py-3 text-sm font-semibold"
              >
                Liquidity
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
