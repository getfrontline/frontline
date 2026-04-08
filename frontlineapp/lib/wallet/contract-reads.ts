import { CONTRACTS } from "@/lib/contracts";
import { FLT_DECIMALS } from "@/lib/session/catalog";

const MIRROR_RPC = "https://testnet.hashio.io/api";

const SELECTORS: Record<string, string> = {
  "balanceOf(address)": "70a08231",
  "stakes(address)": "16934fc4",
  "totalStaked()": "817b1cd2",
  "totalOutstanding()": "16078d04",
  "lpPendingYield(address)": "d206b834",
  "merchantBalances(address)": "7f3f1601",
  "registeredMerchants(address)": "f101b9cc",
  "availableLiquidity()": "74375359",
  "getProfile(address)": "0f53a470",
};

function sel(sig: string): string {
  return SELECTORS[sig] ?? "00000000";
}

function padAddress(addr: string): string {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return clean.toLowerCase().padStart(64, "0");
}

function padUint256(n: number): string {
  return n.toString(16).padStart(64, "0");
}

async function ethCall(to: string, data: string): Promise<string> {
  const toAddr = to.startsWith("0x") ? to : `0x${to}`;
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

function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean === "" || clean === "0x") return 0n;
  return BigInt(`0x${clean.slice(0, 64)}`);
}

function rawToFlt(raw: bigint): number {
  return Number(raw) / 10 ** FLT_DECIMALS;
}

async function accountToEvm(accountId: string): Promise<string> {
  const res = await fetch(
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`,
  );
  const json = await res.json();
  return (json.evm_address as string) ?? "";
}

export type OnChainState = {
  walletBalanceFlt: number;
  lpStakedFlt: number;
  lpPendingYieldFlt: number;
  totalPoolFlt: number;
  bnplOutstandingFlt: number;
  availableLiquidityFlt: number;
  reputationScore: number;
  onTimeStreak: number;
  totalRepayments: number;
  lateRepayments: number;
  isMerchant: boolean;
  merchantBalanceFlt: number;
};

export async function fetchOnChainState(accountId: string): Promise<OnChainState> {
  const evmAddr = await accountToEvm(accountId);
  if (!evmAddr) throw new Error("Could not resolve EVM address for account");

  const paddedAddr = padAddress(evmAddr);

  const calls = await Promise.allSettled([
    // 0: FLT.balanceOf(user)
    CONTRACTS.flt
      ? ethCall(CONTRACTS.flt, sel("balanceOf(address)") + paddedAddr)
      : Promise.resolve("0x0"),
    // 1: Pool.stakes(user)
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("stakes(address)") + paddedAddr)
      : Promise.resolve("0x0"),
    // 2: Pool.totalStaked()
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("totalStaked()"))
      : Promise.resolve("0x0"),
    // 3: Pool.totalOutstanding()
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("totalOutstanding()"))
      : Promise.resolve("0x0"),
    // 4: Pool.lpPendingYield(user)
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("lpPendingYield(address)") + paddedAddr)
      : Promise.resolve("0x0"),
    // 5: Pool.availableLiquidity()
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("availableLiquidity()"))
      : Promise.resolve("0x0"),
    // 6: Reputation.getProfile(user) → returns (uint16 score, uint16 streak, uint32 total, uint32 late)
    CONTRACTS.reputation
      ? ethCall(CONTRACTS.reputation, sel("getProfile(address)") + paddedAddr)
      : Promise.resolve("0x0"),
    // 7: Pool.registeredMerchants(user)
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("registeredMerchants(address)") + paddedAddr)
      : Promise.resolve("0x0"),
    // 8: Pool.merchantBalances(user)
    CONTRACTS.pool
      ? ethCall(CONTRACTS.pool, sel("merchantBalances(address)") + paddedAddr)
      : Promise.resolve("0x0"),
  ]);

  const val = (i: number): string => {
    const r = calls[i];
    return r.status === "fulfilled" ? r.value : "0x0";
  };

  const profileHex = val(6);
  let score = 656;
  let streak = 0;
  let totalRepayments = 0;
  let lateRepayments = 0;
  if (profileHex.length >= 258) {
    const clean = profileHex.startsWith("0x") ? profileHex.slice(2) : profileHex;
    score = Number(BigInt(`0x${clean.slice(0, 64)}`));
    streak = Number(BigInt(`0x${clean.slice(64, 128)}`));
    totalRepayments = Number(BigInt(`0x${clean.slice(128, 192)}`));
    lateRepayments = Number(BigInt(`0x${clean.slice(192, 256)}`));
  }

  const isMerchantRaw = decodeUint256(val(7));

  return {
    walletBalanceFlt: rawToFlt(decodeUint256(val(0))),
    lpStakedFlt: rawToFlt(decodeUint256(val(1))),
    lpPendingYieldFlt: rawToFlt(decodeUint256(val(4))),
    totalPoolFlt: rawToFlt(decodeUint256(val(2))),
    bnplOutstandingFlt: rawToFlt(decodeUint256(val(3))),
    availableLiquidityFlt: rawToFlt(decodeUint256(val(5))),
    reputationScore: score || 656,
    onTimeStreak: streak,
    totalRepayments,
    lateRepayments,
    isMerchant: isMerchantRaw !== 0n,
    merchantBalanceFlt: rawToFlt(decodeUint256(val(8))),
  };
}
