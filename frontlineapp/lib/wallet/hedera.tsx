"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type WalletStatus = "disconnected" | "initializing" | "ready" | "connecting" | "connected" | "no-project-id";

export type WalletState = {
  status: WalletStatus;
  accountId: string | null;
  network: string;
};

type WalletContextValue = WalletState & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendTx: (tx: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSigner: () => Promise<any | null>;
};

const WalletContext = createContext<WalletContextValue>({
  status: "disconnected",
  accountId: null,
  network: "testnet",
  connect: async () => {},
  disconnect: async () => {},
  sendTx: async () => {},
  getSigner: async () => null,
});

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [network] = useState("testnet");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hcRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const initedRef = useRef(false);
  const accountIdRef = useRef<string | null>(null);

  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  useEffect(() => {
    if (initedRef.current || typeof window === "undefined") return;
    initedRef.current = true;

    if (!WC_PROJECT_ID) {
      console.warn(
        "[Frontline] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set.\n" +
        "Get one free at https://cloud.reown.com and add it to frontlineapp/.env.local",
      );
      setStatus("no-project-id");
      return;
    }

    setStatus("initializing");

    initPromiseRef.current = (async () => {
      try {
        const [{ HashConnect }, { LedgerId }] = await Promise.all([
          import("hashconnect"),
          import("@hashgraph/sdk"),
        ]);

        const appMetadata = {
          name: "Frontline",
          description: "Instant-settle BNPL gateway on Hedera",
          icons: ["/frontline-icon.png"],
          url: window.location.origin,
        };

        const hc = new HashConnect(LedgerId.TESTNET, WC_PROJECT_ID, appMetadata, true);
        hcRef.current = hc;

        hc.pairingEvent.on((data: { accountIds?: string[] }) => {
          if (data.accountIds && data.accountIds.length > 0) {
            setAccountId(data.accountIds[0]);
            setStatus("connected");
          }
        });

        hc.disconnectionEvent.on(() => {
          setAccountId(null);
          setStatus("ready");
        });

        await Promise.race([
          hc.init(),
          new Promise((_, reject) => {
            window.setTimeout(() => {
              reject(new Error("HashConnect initialization timed out"));
            }, 10000);
          }),
        ]);
        setStatus("ready");
      } catch (err) {
        console.error("[Frontline] HashConnect init failed", err);
        setStatus(hcRef.current ? "ready" : "disconnected");
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    if (initPromiseRef.current) {
      await initPromiseRef.current;
    }
    const hc = hcRef.current;
    if (!hc) return;
    setStatus("connecting");
    try {
      await hc.openPairingModal("dark");
      if (!accountIdRef.current) {
        setStatus("ready");
      }
    } catch (err) {
      console.error("[Frontline] openPairingModal failed", err);
      setStatus("ready");
    }
  }, []);

  const disconnect = useCallback(async () => {
    const hc = hcRef.current;
    if (!hc) return;
    try {
      await hc.disconnect();
    } catch {
      /* swallow */
    }
    setAccountId(null);
    setStatus("ready");
  }, []);

  const sendTx = useCallback(async (tx: unknown) => {
    const hc = hcRef.current;
    if (!hc || !accountId) throw new Error("Wallet not connected");
    const signer = await hc.getSigner(accountId);
    if (!signer) throw new Error("Wallet signer unavailable");

    const txWithSigner = tx as {
      isFrozen?: () => boolean;
      freezeWithSigner?: (signer: unknown) => Promise<unknown>;
      executeWithSigner?: (signer: unknown) => Promise<unknown>;
    };

    if (typeof txWithSigner.freezeWithSigner !== "function" || typeof txWithSigner.executeWithSigner !== "function") {
      throw new Error("Unsupported Hedera transaction object");
    }

    const executable = txWithSigner.isFrozen?.()
      ? txWithSigner
      : await txWithSigner.freezeWithSigner(signer);

    return txWithSigner.executeWithSigner.call(executable, signer);
  }, [accountId]);

  const getSigner = useCallback(async () => {
    const hc = hcRef.current;
    if (!hc || !accountId) return null;
    return hc.getSigner(accountId);
  }, [accountId]);

  const value = useMemo<WalletContextValue>(
    () => ({ status, accountId, network, connect, disconnect, sendTx, getSigner }),
    [status, accountId, network, connect, disconnect, sendTx, getSigner],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  return useContext(WalletContext);
}
