import type { Metadata } from "next";
import { ReputationView } from "@/components/dashboard/ReputationView";

export const metadata: Metadata = {
  title: "Reputation — Frontline",
  description: "Shopper reputation and repayments.",
};

export default function ReputationPage() {
  return <ReputationView />;
}
