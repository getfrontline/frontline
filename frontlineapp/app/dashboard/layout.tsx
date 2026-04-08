import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FrontlineSessionProvider } from "@/lib/session/session-store";
import { WalletProvider } from "@/lib/wallet/hedera";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <FrontlineSessionProvider>
        <DashboardShell>{children}</DashboardShell>
      </FrontlineSessionProvider>
    </WalletProvider>
  );
}
