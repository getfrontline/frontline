import type { Metadata } from "next";
import { TokenView } from "@/components/dashboard/TokenView";

export const metadata: Metadata = {
  title: "Token — Frontline",
  description: "Associate FLT and buy from the Frontline bonding curve on Hedera testnet.",
};

export default function TokenPage() {
  return <TokenView />;
}
