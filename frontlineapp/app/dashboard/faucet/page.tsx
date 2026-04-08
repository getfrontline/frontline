import type { Metadata } from "next";
import { FaucetView } from "@/components/dashboard/FaucetView";

export const metadata: Metadata = {
  title: "Faucet — Frontline",
  description: "Mint testnet Frontline Token (FLT) to your connected wallet.",
};

export default function FaucetPage() {
  return <FaucetView />;
}
