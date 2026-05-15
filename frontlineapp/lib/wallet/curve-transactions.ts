import { CONTRACTS } from "@/lib/contracts";
import { HEDERA_MIRROR_NODE_URL } from "@/lib/wallet/network-config";

const MIRROR_NODE_REST = HEDERA_MIRROR_NODE_URL;

const EVENT_TOKENS_PURCHASED =
  "0x377aadedb6b2a771959584d10a6a36eccb5f56b4eb3a48525f76108d2660d8d4";
const EVENT_TOKENS_SOLD =
  "0x697c42d55a5e1fed3f464ec6f38b32546a0bd368dc8068b065c67566d73f3290";

export type CurveTx = {
  timestamp: string;
  type: "buy" | "sell" | "other";
  hbarAmount: number;
  tokenAmount: number;
  txHash: string;
};

function decodeUint256FromData(hex: string, offset: number): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const start = offset * 64;
  const chunk = clean.slice(start, start + 64);
  if (!chunk) return 0n;
  return BigInt(`0x${chunk}`);
}

function formatTimestamp(ts: string): string {
  const [seconds] = ts.split(".");
  const date = new Date(Number(seconds) * 1000);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function fetchCurveTransactions(limit = 20): Promise<CurveTx[]> {
  if (!CONTRACTS.curve) return [];

  const evmAddr = CONTRACTS.curve.startsWith("0x")
    ? CONTRACTS.curve
    : await resolveEvmAddress(CONTRACTS.curve);

  const res = await fetch(
    `${MIRROR_NODE_REST}/contracts/${evmAddr}/results?limit=${limit}&order=desc`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    console.warn("[Frontline] mirror node contract results fetch failed:", res.status);
    return [];
  }

  const json = (await res.json()) as {
    results?: Array<{
      timestamp: string;
      hash: string;
      amount: number;
      logs?: Array<{
        topics: string[];
        data: string;
      }>;
    }>;
  };

  const items = json.results ?? [];
  const txs: CurveTx[] = [];

  for (const item of items) {
    const timestamp = item.timestamp ?? "";
    const txHash = item.hash ?? "";
    let type: "buy" | "sell" | "other" = "other";
    let hbarAmount = 0;
    let tokenAmount = 0;

    if (item.amount > 0) {
      // Payable function => likely buy
      type = "buy";
      hbarAmount = item.amount / 1e8;
    }

    // Parse logs for exact amounts
    if (item.logs) {
      for (const log of item.logs) {
        const topic0 = log.topics[0]?.toLowerCase() ?? "";
        const data = log.data ?? "";

        if (topic0 === EVENT_TOKENS_PURCHASED) {
          type = "buy";
          const rawTokenAmt = decodeUint256FromData(data, 0);
          const rawCost = decodeUint256FromData(data, 1);
          tokenAmount = Number(rawTokenAmt) / 1e8;
          hbarAmount = Number(rawCost) / 1e8;
        } else if (topic0 === EVENT_TOKENS_SOLD) {
          type = "sell";
          const rawTokenAmt = decodeUint256FromData(data, 0);
          const rawPayout = decodeUint256FromData(data, 1);
          tokenAmount = Number(rawTokenAmt) / 1e8;
          hbarAmount = Number(rawPayout) / 1e8;
        }
      }
    }

    txs.push({
      timestamp: formatTimestamp(timestamp),
      type,
      hbarAmount,
      tokenAmount,
      txHash,
    });
  }

  return txs;
}

async function resolveEvmAddress(contractId: string): Promise<string> {
  const res = await fetch(`${MIRROR_NODE_REST}/contracts/${contractId}`);
  const json = (await res.json()) as { evm_address?: string };
  return json.evm_address ?? contractId;
}
