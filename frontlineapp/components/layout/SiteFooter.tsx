import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-border border-t border-dashed py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="text-muted text-sm">
          © {new Date().getFullYear()} Frontline · BNPL with instant merchant settlement.
        </p>
        <div className="flex flex-wrap gap-6 text-sm font-medium text-[var(--text-muted)]">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <Link href="/dashboard" className="hover:text-primary">
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  );
}
