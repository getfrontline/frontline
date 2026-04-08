import type { Metadata } from "next";
import { LiquidityView } from "@/components/dashboard/LiquidityView";

export const metadata: Metadata = {
  title: "Liquidity — Frontline",
  description: "LP staking and settlement pool.",
};

export default function LiquidityPage() {
  return <LiquidityView />;
}
