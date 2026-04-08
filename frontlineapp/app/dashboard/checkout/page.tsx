import type { Metadata } from "next";
import { CheckoutView } from "@/components/dashboard/CheckoutView";

export const metadata: Metadata = {
  title: "Pay — Frontline",
  description: "BNPL checkout and merchant settlement.",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
