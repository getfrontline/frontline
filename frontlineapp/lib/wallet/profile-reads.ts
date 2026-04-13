import { CONTRACTS } from "@/lib/contracts";
import { FLT_DECIMALS } from "@/lib/session/catalog";
import { HEDERA_MIRROR_NODE_URL, HEDERA_RPC_URL } from "@/lib/wallet/network-config";

const MIRROR_NODE_REST = HEDERA_MIRROR_NODE_URL;
const MIRROR_RPC = HEDERA_RPC_URL;
const contractAddressCache = new Map<string, string>();

type MirrorAccountResponse = {
  account?: string;
  evm_address?: string;
  balance?: {
    balance?: number;
  };
};

type MirrorAccountTokenResponse = {
  tokens?: Array<{
    automatic_association?: boolean;
    balance?: number;
    created_timestamp?: string;
    freeze_status?: string;
    kyc_status?: string;
    token_id?: string;
  }>;
};

type MirrorTokenResponse = {
  decimals?: number;
  name?: string;
  symbol?: string;
  token_id?: string;
  type?: string;
};

export type HtsTokenBalance = {
  tokenId: string;
  name: string;
  symbol: string;
  type: string;
  decimals: number;
  balanceRaw: bigint;
  balanceFormatted: string;
  automaticAssociation: boolean;
  freezeStatus: string;
  kycStatus: string;
};

export type WalletProfile = {
  accountId: string;
  evmAddress: string;
  longZeroAddress: string;
  hbarBalanceTinybar: bigint;
  hbarBalanceFormatted: string;
  htsTokens: HtsTokenBalance[];
  fltContractBalanceRaw: bigint;
  fltContractBalanceFormatted: string;
  fltLongZeroBalanceRaw: bigint;
  fltLongZeroBalanceFormatted: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Mirror Node request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function formatDecimalBalance(raw: bigint, decimals: number): string {
  if (decimals <= 0) return raw.toString();
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  const fractionPadded = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fractionPadded ? `.${fractionPadded}` : ""}`;
}

function formatHbar(tinybar: bigint): string {
  return `${formatDecimalBalance(tinybar, 8)} HBAR`;
}

function hederaAccountToLongZeroAddress(accountId: string): string {
  const [shardRaw, realmRaw, numRaw] = accountId.split(".");
  const shard = BigInt(shardRaw ?? "0");
  const realm = BigInt(realmRaw ?? "0");
  const num = BigInt(numRaw ?? "0");
  const value = (shard << 96n) | (realm << 64n) | num;
  return `0x${value.toString(16).padStart(40, "0")}`;
}

function padAddress(addr: string): string {
  const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
  return clean.toLowerCase().padStart(64, "0");
}

async function normalizeContractAddress(addr: string): Promise<string> {
  if (addr.startsWith("0x")) return addr;
  const cached = contractAddressCache.get(addr);
  if (cached) return cached;

  const json = await fetchJson<{ evm_address?: string }>(`${MIRROR_NODE_REST}/contracts/${addr}`);
  const evmAddress = json.evm_address;
  if (!evmAddress) throw new Error(`Could not resolve EVM address for contract ${addr}`);
  contractAddressCache.set(addr, evmAddress);
  return evmAddress;
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

function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean === "" || clean === "0x") return 0n;
  return BigInt(`0x${clean.slice(0, 64)}`);
}

export async function fetchWalletProfile(accountId: string): Promise<WalletProfile> {
  const [account, tokenBalances] = await Promise.all([
    fetchJson<MirrorAccountResponse>(`${MIRROR_NODE_REST}/accounts/${accountId}`),
    fetchJson<MirrorAccountTokenResponse>(`${MIRROR_NODE_REST}/accounts/${accountId}/tokens?limit=100`),
  ]);

  const tokenRows = tokenBalances.tokens ?? [];
  const tokenDetails = await Promise.all(
    tokenRows.map(async (token) => {
      const tokenId = token.token_id ?? "";
      if (!tokenId) return null;
      const meta = await fetchJson<MirrorTokenResponse>(`${MIRROR_NODE_REST}/tokens/${tokenId}`);
      const decimals = meta.decimals ?? 0;
      const balanceRaw = BigInt(token.balance ?? 0);
      return {
        tokenId,
        name: meta.name ?? tokenId,
        symbol: meta.symbol ?? "HTS",
        type: meta.type ?? "UNKNOWN",
        decimals,
        balanceRaw,
        balanceFormatted: formatDecimalBalance(balanceRaw, decimals),
        automaticAssociation: Boolean(token.automatic_association),
        freezeStatus: token.freeze_status ?? "UNKNOWN",
        kycStatus: token.kyc_status ?? "UNKNOWN",
      } satisfies HtsTokenBalance;
    }),
  );

  const hbarBalanceTinybar = BigInt(account.balance?.balance ?? 0);
  const evmAddress = account.evm_address ?? "";
  const longZeroAddress = hederaAccountToLongZeroAddress(account.account ?? accountId);
  let fltContractBalanceRaw = 0n;
  let fltLongZeroBalanceRaw = 0n;

  if (CONTRACTS.flt) {
    if (evmAddress) {
      fltContractBalanceRaw = decodeUint256(
        await ethCall(CONTRACTS.flt, `70a08231${padAddress(evmAddress)}`),
      );
    }
    fltLongZeroBalanceRaw = decodeUint256(
      await ethCall(CONTRACTS.flt, `70a08231${padAddress(longZeroAddress)}`),
    );
  }

  return {
    accountId: account.account ?? accountId,
    evmAddress,
    longZeroAddress,
    hbarBalanceTinybar,
    hbarBalanceFormatted: formatHbar(hbarBalanceTinybar),
    htsTokens: tokenDetails.filter((token): token is HtsTokenBalance => token !== null),
    fltContractBalanceRaw,
    fltContractBalanceFormatted: `${formatDecimalBalance(fltContractBalanceRaw, FLT_DECIMALS)} FLT`,
    fltLongZeroBalanceRaw,
    fltLongZeroBalanceFormatted: `${formatDecimalBalance(fltLongZeroBalanceRaw, FLT_DECIMALS)} FLT`,
  };
}
