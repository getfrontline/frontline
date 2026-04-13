"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

const WORKSPACE_LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/profile", label: "Profile", exact: false },
  { href: "/dashboard/token", label: "Token", exact: false },
  { href: "/dashboard/register", label: "Register", exact: false },
  { href: "/dashboard/marketplace", label: "Merchants", exact: false },
  { href: "/dashboard/checkout", label: "Pay", exact: false },
  { href: "/dashboard/reputation", label: "Reputation", exact: false },
  { href: "/dashboard/liquidity", label: "Liquidity", exact: false },
] as const;

function workspaceActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href || pathname === `${href}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname() ?? "";
  const inDashboard = pathname.startsWith("/dashboard");

  return (
    <header className="border-border/60 sticky top-0 z-40 border-b border-dashed bg-[var(--surface-base)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)] transition-colors hover:text-[var(--accent-mint)]"
        >
          Frontline
        </Link>

        {inDashboard ? (
          <nav
            className="order-3 flex w-full gap-1 overflow-x-auto pb-1 md:order-none md:flex-1 md:justify-center md:overflow-visible md:pb-0"
            aria-label="Dashboard"
          >
            {WORKSPACE_LINKS.map(({ href, label, exact }) => {
              const active = workspaceActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-accent-mint/15 text-accent-mint border border-[var(--accent-mint)]/35"
                      : "text-muted hover:text-primary border border-transparent"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <nav
            className="hidden items-center gap-8 text-sm font-medium text-[var(--text-muted)] md:flex"
            aria-label="Marketing"
          >
            <Link href="/#flow" className="transition-colors hover:text-[var(--text-primary)]">
              Flow
            </Link>
            <Link href="/#stakeholders" className="transition-colors hover:text-[var(--text-primary)]">
              Stakeholders
            </Link>
            <Link href="/#protocol" className="transition-colors hover:text-[var(--text-primary)]">
              Protocol
            </Link>
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {inDashboard ? (
            <>
              <ConnectWalletButton />
              <Link
                href="/"
                className="border-border text-muted hover:border-accent-mint/50 hover:text-primary hidden rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors sm:inline-flex sm:px-4"
              >
                Home
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard"
              className="bg-accent-mint text-surface-base hover:bg-accent-mint-dim inline-flex items-center rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Dashboard
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
