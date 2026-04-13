const DEFAULT_NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "mainnet").toLowerCase();

export type HederaNetwork = "mainnet" | "testnet";

export const HEDERA_NETWORK: HederaNetwork =
  DEFAULT_NETWORK === "testnet" ? "testnet" : "mainnet";

export const HEDERA_RPC_URL =
  process.env.NEXT_PUBLIC_HEDERA_RPC_URL ??
  (HEDERA_NETWORK === "mainnet" ? "https://mainnet.hashio.io/api" : "https://testnet.hashio.io/api");

export const HEDERA_MIRROR_NODE_URL =
  process.env.NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL ??
  (HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com/api/v1"
    : "https://testnet.mirrornode.hedera.com/api/v1");

export const HEDERA_HASHSCAN_NETWORK =
  process.env.NEXT_PUBLIC_HEDERA_HASHSCAN_NETWORK ?? HEDERA_NETWORK;

const DEFAULT_NODE_IDS =
  HEDERA_NETWORK === "mainnet" ? "0.0.3,0.0.4,0.0.6" : "0.0.3,0.0.4,0.0.5";

export const HEDERA_NODE_IDS = (process.env.NEXT_PUBLIC_HEDERA_NODE_IDS ?? DEFAULT_NODE_IDS)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
