"use client";

import {
  BNPL_FEE_BPS,
  REPAYMENT_DAYS,
  merchantById as staticMerchantById,
  productById as staticProductById,
} from "@/lib/session/catalog";
import { tierFromScore } from "@/lib/session/reputation";
import { fetchOnChainState, type OnChainState } from "@/lib/wallet/contract-reads";
import { fetchChainCatalog, type ChainMerchant, type ChainProduct } from "@/lib/wallet/chain-catalog";
import { useWallet } from "@/lib/wallet/hedera";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CartLine = { productId: string; qty: number };

export type MerchantPayout = {
  merchantId: string;
  merchantName: string;
  grossFlt: number;
  feeFlt: number;
  netFlt: number;
};

export type BnplLoan = {
  id: string;
  createdAt: number;
  dueAt: number;
  principalFlt: number;
  payouts: MerchantPayout[];
  status: "active" | "repaid";
  repaidAt?: number;
};

export type LedgerEvent = {
  id: string;
  at: number;
  kind: "bnpl_opened" | "repayment" | "stake" | "unstake" | "token_buy";
  title: string;
  detail: string;
};

/** Unified product type that works with both static catalog and chain data */
export type UnifiedProduct = {
  id: string;
  merchantId: string; // address for chain products, internal id for static
  merchantAddress: string; // always EVM address
  name: string;
  description: string;
  priceFlt: number;
  priceRaw: bigint;
  sku: string;
  source: "static" | "chain";
};

/** Unified merchant type */
export type UnifiedMerchant = {
  id: string; // address for chain merchants, internal id for static
  address: string;
  name: string;
  category: string;
  tagline: string;
  active: boolean;
  source: "static" | "chain";
};

export type FrontlineSessionState = {
  cart: CartLine[];
  loans: BnplLoan[];
  reputationScore: number;
  onTimeStreak: number;
  ledger: LedgerEvent[];
  merchantBalancesFlt: Record<string, number>;
  lpStakedFlt: number;
  lpPendingYieldFlt: number;
  bnplOutstandingFlt: number;
  walletBalanceFlt: number;
  totalPoolFlt: number;
  isMerchant: boolean;
  // Chain catalog
  chainMerchants: ChainMerchant[];
  chainProducts: ChainProduct[];
};

const initialState: FrontlineSessionState = {
  cart: [],
  loans: [],
  reputationScore: 656,
  onTimeStreak: 0,
  ledger: [],
  merchantBalancesFlt: {},
  lpStakedFlt: 0,
  lpPendingYieldFlt: 0,
  bnplOutstandingFlt: 0,
  walletBalanceFlt: 0,
  totalPoolFlt: 0,
  isMerchant: false,
  chainMerchants: [],
  chainProducts: [],
};

type Action =
  | { type: "ADD_TO_CART"; productId: string }
  | { type: "REMOVE_LINE"; productId: string }
  | { type: "SET_QTY"; productId: string; qty: number }
  | { type: "CLEAR_CART" }
  | { type: "CHECKOUT_BNPL" }
  | { type: "REPAY_LOAN"; loanId: string }
  | { type: "STAKE"; amount: number }
  | { type: "UNSTAKE"; amount: number }
  | { type: "TOKEN_BOUGHT"; amount: number }
  | { type: "SYNC_FROM_CHAIN"; data: OnChainState }
  | { type: "SYNC_CATALOG"; merchants: ChainMerchant[]; products: ChainProduct[] }
  | { type: "RESET_SESSION" };

// --- Unified lookups ---

function buildUnifiedMerchants(chainMerchants: ChainMerchant[]): UnifiedMerchant[] {
  return chainMerchants
    .filter((m) => m.active)
    .map((m) => ({
      id: m.address.toLowerCase(),
      address: m.address,
      name: m.name,
      category: m.category,
      tagline: "",
      active: m.active,
      source: "chain" as const,
    }));
}

function buildUnifiedProducts(chainProducts: ChainProduct[]): UnifiedProduct[] {
  return chainProducts
    .filter((p) => p.active)
    .map((p) => ({
      id: `chain-${p.id}`,
      merchantId: p.merchantAddress.toLowerCase(),
      merchantAddress: p.merchantAddress,
      name: p.name,
      description: "",
      priceFlt: p.priceFlt,
      priceRaw: p.priceRaw,
      sku: `P-${p.id}`,
      source: "chain" as const,
    }));
}

function unifiedProductById(
  productId: string,
  chainProducts: ChainProduct[],
): UnifiedProduct | undefined {
  // Chain product IDs are "chain-0", "chain-1" etc.
  if (productId.startsWith("chain-")) {
    const cid = Number(productId.slice(6));
    const cp = chainProducts.find((p) => p.id === cid);
    if (!cp) return undefined;
    return {
      id: productId,
      merchantId: cp.merchantAddress.toLowerCase(),
      merchantAddress: cp.merchantAddress,
      name: cp.name,
      description: "",
      priceFlt: cp.priceFlt,
      priceRaw: cp.priceRaw,
      sku: `P-${cp.id}`,
      source: "chain",
    };
  }
  // Try static catalog (for backward compat)
  const sp = staticProductById(productId);
  if (!sp) return undefined;
  const sm = staticMerchantById(sp.merchantId);
  return {
    id: sp.id,
    merchantId: sp.merchantId,
    merchantAddress: sm?.address ?? "",
    name: sp.name,
    description: sp.description,
    priceFlt: sp.priceFlt,
    priceRaw: BigInt(Math.round(sp.priceFlt * 10 ** 8)),
    sku: sp.sku,
    source: "static",
  };
}

function unifiedMerchantByAddr(
  addr: string,
  chainMerchants: ChainMerchant[],
): UnifiedMerchant | undefined {
  const cm = chainMerchants.find((m) => m.address.toLowerCase() === addr.toLowerCase());
  if (!cm) return undefined;
  return {
    id: cm.address.toLowerCase(),
    address: cm.address,
    name: cm.name,
    category: cm.category,
    tagline: "",
    active: cm.active,
    source: "chain",
  };
}

function cartTotals(
  cart: CartLine[],
  chainProducts: ChainProduct[],
): { lines: { product: UnifiedProduct; qty: number }[]; gross: number } {
  const lines: { product: UnifiedProduct; qty: number }[] = [];
  let gross = 0;
  for (const line of cart) {
    const product = unifiedProductById(line.productId, chainProducts);
    if (!product || line.qty < 1) continue;
    lines.push({ product, qty: line.qty });
    gross += product.priceFlt * line.qty;
  }
  return { lines, gross };
}

function groupPayouts(
  lines: { product: UnifiedProduct; qty: number }[],
  chainMerchants: ChainMerchant[],
): MerchantPayout[] {
  const map = new Map<string, { gross: number; name: string }>();
  for (const { product, qty } of lines) {
    const g = product.priceFlt * qty;
    const addr = product.merchantAddress.toLowerCase();
    const prev = map.get(addr);
    const merchant = unifiedMerchantByAddr(addr, chainMerchants);
    const name = merchant?.name ?? product.merchantId;
    if (prev) map.set(addr, { gross: prev.gross + g, name: prev.name });
    else map.set(addr, { gross: g, name });
  }
  const out: MerchantPayout[] = [];
  for (const [merchantId, { gross, name }] of map) {
    const feeFlt = (gross * BNPL_FEE_BPS) / 10_000;
    const netFlt = gross - feeFlt;
    out.push({ merchantId, merchantName: name, grossFlt: gross, feeFlt, netFlt });
  }
  return out;
}

function reduce(state: FrontlineSessionState, action: Action): FrontlineSessionState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const p = unifiedProductById(action.productId, state.chainProducts);
      if (!p) return state;
      const idx = state.cart.findIndex((l) => l.productId === action.productId);
      if (idx >= 0) {
        const next = [...state.cart];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return { ...state, cart: next };
      }
      return { ...state, cart: [...state.cart, { productId: action.productId, qty: 1 }] };
    }
    case "REMOVE_LINE":
      return { ...state, cart: state.cart.filter((l) => l.productId !== action.productId) };
    case "SET_QTY": {
      if (action.qty < 1) {
        return { ...state, cart: state.cart.filter((l) => l.productId !== action.productId) };
      }
      const idx = state.cart.findIndex((l) => l.productId === action.productId);
      if (idx < 0) return state;
      const next = [...state.cart];
      next[idx] = { ...next[idx], qty: action.qty };
      return { ...state, cart: next };
    }
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "CHECKOUT_BNPL": {
      const { lines, gross } = cartTotals(state.cart, state.chainProducts);
      if (lines.length === 0 || gross <= 0) return state;
      const payouts = groupPayouts(lines, state.chainMerchants);
      const principalFlt = gross;
      const now = Date.now();
      const loan: BnplLoan = {
        id: `loan-${now}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: now,
        dueAt: now + REPAYMENT_DAYS * 86400000,
        principalFlt,
        payouts,
        status: "active",
      };
      return {
        ...state,
        cart: [],
        loans: [loan, ...state.loans],
        ledger: [
          {
            id: loan.id,
            at: now,
            kind: "bnpl_opened",
            title: "BNPL settlement",
            detail: `${principalFlt.toFixed(2)} FLT · merchants paid from pool`,
          },
          ...state.ledger,
        ],
      };
    }
    case "REPAY_LOAN": {
      const loan = state.loans.find((l) => l.id === action.loanId && l.status === "active");
      if (!loan) return state;
      const now = Date.now();
      const onTime = now <= loan.dueAt;
      return {
        ...state,
        loans: state.loans.map((l) =>
          l.id === action.loanId ? { ...l, status: "repaid" as const, repaidAt: now } : l,
        ),
        ledger: [
          {
            id: `repay-${loan.id}`,
            at: now,
            kind: "repayment",
            title: onTime ? "On-time repayment" : "Late repayment",
            detail: `${loan.principalFlt.toFixed(2)} FLT`,
          },
          ...state.ledger,
        ],
      };
    }
    case "STAKE": {
      const amount = Math.max(0, Math.floor(action.amount));
      if (amount <= 0) return state;
      const now = Date.now();
      return {
        ...state,
        ledger: [
          { id: `stake-${now}`, at: now, kind: "stake", title: "Staked", detail: `+${amount.toLocaleString()} FLT` },
          ...state.ledger,
        ],
      };
    }
    case "UNSTAKE": {
      const amount = Math.max(0, Math.floor(action.amount));
      if (amount <= 0) return state;
      const now = Date.now();
      return {
        ...state,
        ledger: [
          { id: `unstake-${now}`, at: now, kind: "unstake", title: "Unstaked", detail: `−${amount.toLocaleString()} FLT` },
          ...state.ledger,
        ],
      };
    }
    case "TOKEN_BOUGHT": {
      const amount = Math.max(0, action.amount);
      if (amount <= 0) return state;
      const now = Date.now();
      return {
        ...state,
        ledger: [
          { id: `token-buy-${now}`, at: now, kind: "token_buy", title: "Curve purchase", detail: `+${amount.toLocaleString()} FLT` },
          ...state.ledger,
        ],
      };
    }
    case "SYNC_FROM_CHAIN": {
      const d = action.data;
      return {
        ...state,
        walletBalanceFlt: d.walletBalanceFlt,
        lpStakedFlt: d.lpStakedFlt,
        lpPendingYieldFlt: d.lpPendingYieldFlt,
        totalPoolFlt: d.totalPoolFlt,
        bnplOutstandingFlt: d.bnplOutstandingFlt,
        reputationScore: d.reputationScore,
        onTimeStreak: d.onTimeStreak,
        isMerchant: d.isMerchant,
        merchantBalancesFlt: d.merchantBalanceFlt > 0
          ? { self: d.merchantBalanceFlt }
          : {},
      };
    }
    case "SYNC_CATALOG":
      return {
        ...state,
        chainMerchants: action.merchants,
        chainProducts: action.products,
      };
    case "RESET_SESSION":
      return { ...initialState, chainMerchants: state.chainMerchants, chainProducts: state.chainProducts, ledger: [] };
    default:
      return state;
  }
}

type SessionContextValue = {
  state: FrontlineSessionState;
  tier: string;
  totalPoolFlt: number;
  utilizationPercent: number;
  syncing: boolean;
  merchants: UnifiedMerchant[];
  products: UnifiedProduct[];
  addToCart: (productId: string) => void;
  removeLine: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  checkoutBnpl: () => boolean;
  repayLoan: (loanId: string) => void;
  stake: (amount: number) => void;
  unstake: (amount: number) => void;
  recordTokenBuy: (amount: number) => void;
  refreshFromChain: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  resetSession: () => void;
  cartPreview: () => { lines: { product: UnifiedProduct; qty: number }[]; gross: number };
  productById: (id: string) => UnifiedProduct | undefined;
  merchantByAddr: (addr: string) => UnifiedMerchant | undefined;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function FrontlineSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const { accountId, status } = useWallet();
  const [syncing, setSyncing] = useState(false);
  const lastSyncedAccount = useRef<string | null>(null);
  const catalogLoaded = useRef(false);

  const refreshCatalog = useCallback(async () => {
    try {
      const { merchants, products } = await fetchChainCatalog();
      dispatch({ type: "SYNC_CATALOG", merchants, products });
    } catch (err) {
      console.error("[Frontline] catalog sync failed", err);
    }
  }, []);

  const refreshFromChain = useCallback(async () => {
    if (!accountId) return;
    setSyncing(true);
    try {
      const data = await fetchOnChainState(accountId);
      dispatch({ type: "SYNC_FROM_CHAIN", data });
    } catch (err) {
      console.error("[Frontline] chain sync failed", err);
    } finally {
      setSyncing(false);
    }
  }, [accountId]);

  // Fetch catalog on first mount (no wallet needed)
  useEffect(() => {
    if (!catalogLoaded.current) {
      catalogLoaded.current = true;
      refreshCatalog();
    }
  }, [refreshCatalog]);

  useEffect(() => {
    if (status === "connected" && accountId && accountId !== lastSyncedAccount.current) {
      lastSyncedAccount.current = accountId;
      refreshFromChain();
    }
    if (status !== "connected") {
      lastSyncedAccount.current = null;
    }
  }, [status, accountId, refreshFromChain]);

  const totalPoolFlt = state.totalPoolFlt;
  const utilizationPercent =
    totalPoolFlt > 0 ? Math.min(100, (state.bnplOutstandingFlt / totalPoolFlt) * 100) : 0;

  const tier = useMemo(() => tierFromScore(state.reputationScore), [state.reputationScore]);

  const merchants = useMemo(
    () => buildUnifiedMerchants(state.chainMerchants),
    [state.chainMerchants],
  );
  const products = useMemo(
    () => buildUnifiedProducts(state.chainProducts),
    [state.chainProducts],
  );

  const cartPreview = useCallback(
    () => cartTotals(state.cart, state.chainProducts),
    [state.cart, state.chainProducts],
  );

  const productByIdCb = useCallback(
    (id: string) => unifiedProductById(id, state.chainProducts),
    [state.chainProducts],
  );

  const merchantByAddrCb = useCallback(
    (addr: string) => unifiedMerchantByAddr(addr, state.chainMerchants),
    [state.chainMerchants],
  );

  const checkoutBnpl = useCallback(() => {
    const { gross } = cartTotals(state.cart, state.chainProducts);
    if (gross <= 0) return false;
    dispatch({ type: "CHECKOUT_BNPL" });
    return true;
  }, [state.cart, state.chainProducts]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      tier,
      totalPoolFlt,
      utilizationPercent,
      syncing,
      merchants,
      products,
      addToCart: (productId) => dispatch({ type: "ADD_TO_CART", productId }),
      removeLine: (productId) => dispatch({ type: "REMOVE_LINE", productId }),
      setQty: (productId, qty) => dispatch({ type: "SET_QTY", productId, qty }),
      clearCart: () => dispatch({ type: "CLEAR_CART" }),
      checkoutBnpl,
      repayLoan: (loanId) => dispatch({ type: "REPAY_LOAN", loanId }),
      stake: (amount) => dispatch({ type: "STAKE", amount }),
      unstake: (amount) => dispatch({ type: "UNSTAKE", amount }),
      recordTokenBuy: (amount) => dispatch({ type: "TOKEN_BOUGHT", amount }),
      refreshFromChain,
      refreshCatalog,
      resetSession: () => dispatch({ type: "RESET_SESSION" }),
      cartPreview,
      productById: productByIdCb,
      merchantByAddr: merchantByAddrCb,
    }),
    [state, tier, totalPoolFlt, utilizationPercent, syncing, merchants, products, checkoutBnpl, refreshFromChain, refreshCatalog, cartPreview, productByIdCb, merchantByAddrCb],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useFrontlineSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useFrontlineSession must be used within FrontlineSessionProvider");
  return ctx;
}
