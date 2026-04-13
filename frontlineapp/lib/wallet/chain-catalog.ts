/**
 * Reads merchant and product catalog from on-chain FrontlinePool contract.
 * Replaces the hardcoded catalog.ts data with live chain data.
 */

import { CONTRACTS } from "@/lib/contracts";
import { FLT_DECIMALS } from "@/lib/session/catalog";
import { HEDERA_MIRROR_NODE_URL, HEDERA_RPC_URL } from "@/lib/wallet/network-config";

const MIRROR_RPC = HEDERA_RPC_URL;
const MIRROR_NODE_REST = HEDERA_MIRROR_NODE_URL;
const contractAddressCache = new Map<string, string>();

// --- Function selectors (from `forge inspect FrontlinePool methodIdentifiers`) ---
const SEL = {
  merchantCount: "89105185",
  merchantList: "1b795d56",
  merchantInfo: "08aebd9a",
  productCount: "e0f6ef87",
  productIdList: "9b695b37",
  products: "7acc0b20",
} as const;

function padAddress(addr: string): string {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return clean.toLowerCase().padStart(64, "0");
}

function padUint256(n: number | bigint): string {
  return BigInt(n).toString(16).padStart(64, "0");
}

async function ethCall(to: string, data: string): Promise<string> {
  const toAddr = await normalizeContractAddress(to);
  const res = await fetch(MIRROR_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: toAddr, data: `0x${data}` }, "latest"],
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result as string;
}

async function normalizeContractAddress(addr: string): Promise<string> {
  if (addr.startsWith("0x")) return addr;
  const cached = contractAddressCache.get(addr);
  if (cached) return cached;

  const res = await fetch(`${MIRROR_NODE_REST}/contracts/${addr}`);
  const json = await res.json();
  const evmAddress = json.evm_address as string | undefined;
  if (!evmAddress) throw new Error(`Could not resolve EVM address for contract ${addr}`);
  contractAddressCache.set(addr, evmAddress);
  return evmAddress;
}

function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean === "" || clean === "0x") return 0n;
  return BigInt(`0x${clean.slice(0, 64)}`);
}

// --- ABI string decoding ---

function hexToString(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Decode an ABI-encoded string from a result hex blob.
 * @param dataHex - hex string without 0x prefix
 * @param wordIndex - the word position where the offset to the string is stored
 */
function decodeStringAt(dataHex: string, wordIndex: number): string {
  // Read the offset (in bytes) from the word at wordIndex
  const offset = Number(BigInt(`0x${dataHex.slice(wordIndex * 64, (wordIndex + 1) * 64)}`));
  // Convert byte offset to hex char offset
  const start = offset * 2;
  // Read string length (32 bytes = 64 hex chars)
  const length = Number(BigInt(`0x${dataHex.slice(start, start + 64)}`));
  if (length === 0) return "";
  // Read actual string data
  const strHex = dataHex.slice(start + 64, start + 64 + length * 2);
  return hexToString(strHex);
}

// --- Types ---

export type ChainMerchant = {
  address: string;
  name: string;
  category: string;
  active: boolean;
};

export type ChainProduct = {
  id: number;
  merchantAddress: string;
  name: string;
  priceRaw: bigint;
  priceFlt: number;
  active: boolean;
};

// --- Fetch functions ---

export async function fetchChainCatalog(): Promise<{
  merchants: ChainMerchant[];
  products: ChainProduct[];
}> {
  if (!CONTRACTS.pool) {
    return { merchants: [], products: [] };
  }

  const pool = CONTRACTS.pool;

  // 1. Fetch merchant count
  const countHex = await ethCall(pool, SEL.merchantCount);
  const merchantCountNum = Number(decodeUint256(countHex));

  // 2. Fetch each merchant address, then their info
  const merchants: ChainMerchant[] = [];
  for (let i = 0; i < merchantCountNum; i++) {
    try {
      const addrHex = await ethCall(pool, SEL.merchantList + padUint256(i));
      const raw = addrHex.startsWith("0x") ? addrHex.slice(2) : addrHex;
      const address = "0x" + raw.slice(24, 64); // last 20 bytes of 32-byte word

      // Get merchantInfo
      const infoHex = await ethCall(pool, SEL.merchantInfo + padAddress(address));
      const infoRaw = infoHex.startsWith("0x") ? infoHex.slice(2) : infoHex;

      if (infoRaw.length >= 192) {
        const name = decodeStringAt(infoRaw, 0);
        const category = decodeStringAt(infoRaw, 1);
        const active = BigInt(`0x${infoRaw.slice(128, 192)}`) !== 0n;

        merchants.push({ address, name, category, active });
      }
    } catch (err) {
      console.warn(`[Frontline] Failed to fetch merchant ${i}`, err);
    }
  }

  // 3. Fetch product count
  const prodCountHex = await ethCall(pool, SEL.productCount);
  const productCountNum = Number(decodeUint256(prodCountHex));

  // 4. Fetch each product
  const products: ChainProduct[] = [];
  for (let i = 0; i < productCountNum; i++) {
    try {
      // Get the product ID at this index
      const pidHex = await ethCall(pool, SEL.productIdList + padUint256(i));
      const pid = Number(decodeUint256(pidHex));

      // Get product info: (address merchant, string name, uint256 price, bool active)
      const prodHex = await ethCall(pool, SEL.products + padUint256(pid));
      const prodRaw = prodHex.startsWith("0x") ? prodHex.slice(2) : prodHex;

      if (prodRaw.length >= 256) {
        const merchantAddress = "0x" + prodRaw.slice(24, 64);
        const name = decodeStringAt(prodRaw, 1);
        const priceRaw = BigInt(`0x${prodRaw.slice(128, 192)}`);
        const priceFlt = Number(priceRaw) / 10 ** FLT_DECIMALS;
        const active = BigInt(`0x${prodRaw.slice(192, 256)}`) !== 0n;

        products.push({
          id: pid,
          merchantAddress: merchantAddress.toLowerCase(),
          name,
          priceRaw,
          priceFlt,
          active,
        });
      }
    } catch (err) {
      console.warn(`[Frontline] Failed to fetch product ${i}`, err);
    }
  }

  return { merchants, products };
}
