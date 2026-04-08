import type { Metadata } from "next";
import { DashboardHomeView } from "@/components/dashboard/DashboardHomeView";

export const metadata: Metadata = {
  title: "Dashboard — Frontline",
  description: "BNPL operations: merchants, checkout, reputation, and liquidity.",
};

export default function DashboardPage() {
  return <DashboardHomeView />;
}
