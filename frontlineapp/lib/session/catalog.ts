export const BNPL_FEE_BPS = 200; // 2%
export const REPAYMENT_DAYS = 7;
export const FLT_DECIMALS = 8;
export const FLT_SYMBOL = "FLT";

export type Merchant = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  address?: string;
};

const MERCHANT_ADDRESSES: Record<string, string | undefined> = {
  "mer-north": process.env.NEXT_PUBLIC_MERCHANT_NORTH_ADDRESS,
  "mer-parcel": process.env.NEXT_PUBLIC_MERCHANT_PARCEL_ADDRESS,
  "mer-volt": process.env.NEXT_PUBLIC_MERCHANT_VOLT_ADDRESS,
};

export type Product = {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  priceFlt: number;
  sku: string;
};

export const MERCHANTS: Merchant[] = [
  {
    id: "mer-north",
    name: "North Supply Co.",
    tagline: "Tools that survive the field",
    category: "Outdoor & workwear",
    address: MERCHANT_ADDRESSES["mer-north"],
  },
  {
    id: "mer-parcel",
    name: "Parcel & Plate",
    tagline: "Small-batch pantry and dining",
    category: "Gourmet",
    address: MERCHANT_ADDRESSES["mer-parcel"],
  },
  {
    id: "mer-volt",
    name: "Volt Street",
    tagline: "Compact power and studio gear",
    category: "Electronics",
    address: MERCHANT_ADDRESSES["mer-volt"],
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "prd-tent",
    merchantId: "mer-north",
    name: "Arctic 2P tent",
    description: "Sub-4kg three-season shell with bonded floor.",
    priceFlt: 428,
    sku: "N-TNT-2P",
  },
  {
    id: "prd-pack",
    merchantId: "mer-north",
    name: "40L roll-top pack",
    description: "Laser-cut MOLLE, recycled ripstop body.",
    priceFlt: 189,
    sku: "N-PCK-40",
  },
  {
    id: "prd-oil",
    merchantId: "mer-parcel",
    name: "Basque extra-virgin 500ml",
    description: "Early harvest; polyphenol-heavy, grassy finish.",
    priceFlt: 34,
    sku: "P-OLV-500",
  },
  {
    id: "prd-cacao",
    merchantId: "mer-parcel",
    name: "Ceremony cacao block",
    description: "Single-estate, low-temp roast for sipping.",
    priceFlt: 22,
    sku: "P-CCB-250",
  },
  {
    id: "prd-mic",
    merchantId: "mer-volt",
    name: "USB condenser mic",
    description: "48 kHz / 24-bit, desk stand and shock mount.",
    priceFlt: 129,
    sku: "V-MIC-USBC",
  },
  {
    id: "prd-hub",
    merchantId: "mer-volt",
    name: "Travel GaN hub 140W",
    description: "2× USB-C PD, HDMI 2.1 pass-through, foldable prongs.",
    priceFlt: 96,
    sku: "V-HUB-140",
  },
];

export function merchantById(id: string): Merchant | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productsForMerchant(merchantId: string): Product[] {
  return PRODUCTS.filter((p) => p.merchantId === merchantId);
}

export function listMerchantsWithProducts(): { merchant: Merchant; products: Product[] }[] {
  return MERCHANTS.map((merchant) => ({
    merchant,
    products: PRODUCTS.filter((p) => p.merchantId === merchant.id),
  }));
}
