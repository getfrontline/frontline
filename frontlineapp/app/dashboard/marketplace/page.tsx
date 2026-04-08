import type { Metadata } from "next";
import { MarketplaceView } from "@/components/dashboard/MarketplaceView";

export const metadata: Metadata = {
  title: "Merchants — Frontline",
  description: "Merchant catalog and cart.",
};

export default function MarketplacePage() {
  return <MarketplaceView />;
}
