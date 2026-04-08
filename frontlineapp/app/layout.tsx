import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display-family",
  subsets: ["latin"],
  display: "swap",
});

const bodySans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Frontline — Instant-settle BNPL for merchants",
  description:
    "Stablecoin-backed Buy Now, Pay Later: instant merchant settlement, short interest-free repayment windows, and on-chain credit history on Hedera.",
  openGraph: {
    title: "Frontline",
    description: "Instant-settle BNPL payment gateway for merchants.",
    siteName: "Frontline",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${bodySans.variable} ${mono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="bg-surface-base text-primary min-h-full flex flex-col">{children}</body>
    </html>
  );
}
