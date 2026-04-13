import { CONTRACTS } from "@/lib/contracts";
import { HEDERA_MIRROR_NODE_URL, HEDERA_NODE_IDS } from "@/lib/wallet/network-config";

const GAS = 300_000;
const REGISTER_GAS = 1_000_000;
const BNPL_GAS = 1_000_000;

async function loadSdk() {
  const [sdk, Long] = await Promise.all([
    import("@hashgraph/sdk"),
    import("long"),
  ]);
  return { ...sdk, Long: Long.default };
}

async function accountMirrorRecord(accountId: string) {
  const res = await fetch(`${HEDERA_MIRROR_NODE_URL}/accounts/${accountId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mirror Node account lookup failed: ${res.status}`);
  return res.json() as Promise<{ evm_address?: string }>;
}

function nodeIds(AccountId: typeof import("@hashgraph/sdk").AccountId) {
  return HEDERA_NODE_IDS.map((n) => AccountId.fromString(n));
}

function toLong(Long: typeof import("long").default, n: number | bigint): import("long").default {
  return Long.fromString(n.toString());
}

function toContractId(
  ContractId: typeof import("@hashgraph/sdk").ContractId,
  addr: string,
) {
  if (addr.startsWith("0.0.")) return ContractId.fromString(addr);
  return ContractId.fromEvmAddress(0, 0, addr);
}

function toTokenId(
  TokenId: typeof import("@hashgraph/sdk").TokenId,
  addr: string,
) {
  if (addr.startsWith("0.0.")) return TokenId.fromString(addr);
  return TokenId.fromEvmAddress(0, 0, addr);
}

/**
 * Normalize an address to 40-char hex (no 0x prefix) for ContractFunctionParameters.addAddress.
 * Accepts: "0xABCD..." (42-char), "ABCD..." (40-char), or "0.0.XXXX" (Hedera native).
 */
function toSolidityAddr(
  AccountId: typeof import("@hashgraph/sdk").AccountId,
  addr: string,
): string {
  if (addr.startsWith("0.0.")) {
    return AccountId.fromString(addr).toSolidityAddress();
  }
  if (addr.startsWith("0x") || addr.startsWith("0X")) {
    return addr.slice(2);
  }
  return addr;
}

export async function buildAssociateFlt(userAccountId: string) {
  const { TokenAssociateTransaction, AccountId, TokenId, TransactionId } = await loadSdk();
  if (!CONTRACTS.flt) throw new Error("FLT contract address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new TokenAssociateTransaction()
    .setAccountId(acctId)
    .setTokenIds([toTokenId(TokenId, CONTRACTS.flt)])
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildBuyCurveTokens(
  userAccountId: string,
  tokenAmountRaw: number | bigint,
  maxCostTinybar: number | bigint,
) {
  const sdk = await loadSdk();
  const {
    ContractExecuteTransaction,
    AccountId,
    ContractId,
    TransactionId,
    ContractFunctionParameters,
    Hbar,
    Long,
  } = sdk;
  if (!CONTRACTS.curve) throw new Error("Bonding curve address not configured");
  const acctId = AccountId.fromString(userAccountId);
  const mirrorAccount = await accountMirrorRecord(userAccountId);
  const recipientAddr = mirrorAccount.evm_address
    ? toSolidityAddr(AccountId, mirrorAccount.evm_address)
    : toSolidityAddr(AccountId, userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.curve))
    .setGas(GAS)
    .setPayableAmount(Hbar.fromTinybars(toLong(Long, maxCostTinybar)))
    .setFunction(
      "buyExactTokens",
      new ContractFunctionParameters()
        .addUint256(toLong(Long, tokenAmountRaw))
        .addUint256(toLong(Long, maxCostTinybar))
        .addAddress(recipientAddr),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildApprovePool(userAccountId: string, amountRaw: number | bigint) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.flt || !CONTRACTS.pool) throw new Error("Contract addresses not configured");
  const acctId = AccountId.fromString(userAccountId);
  const poolAddr = toSolidityAddr(AccountId, CONTRACTS.pool);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.flt))
    .setGas(GAS)
    .setFunction(
      "approve",
      new ContractFunctionParameters()
        .addAddress(poolAddr)
        .addUint256(toLong(Long, amountRaw)),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildStake(userAccountId: string, amountRaw: number | bigint) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(GAS)
    .setFunction("stake", new ContractFunctionParameters().addUint256(toLong(Long, amountRaw)))
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildUnstake(userAccountId: string, amountRaw: number | bigint) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(GAS)
    .setFunction("unstake", new ContractFunctionParameters().addUint256(toLong(Long, amountRaw)))
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildOpenBnpl(
  userAccountId: string,
  merchantAddrs: string[],
  amounts: bigint[],
) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  const solAddrs = merchantAddrs.map((a) => toSolidityAddr(AccountId, a));
  const longAmounts = amounts.map((a) => toLong(Long, a));
  const params = new ContractFunctionParameters()
    .addAddressArray(solAddrs)
    .addUint256Array(longAmounts);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(BNPL_GAS)
    .setFunction("openBnpl", params)
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildRepay(userAccountId: string, loanId: number | bigint, amountRaw: number | bigint) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(GAS)
    .setFunction(
      "repay",
      new ContractFunctionParameters()
        .addUint256(toLong(Long, loanId))
        .addUint256(toLong(Long, amountRaw)),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildRegisterMerchant(userAccountId: string, name: string, category: string) {
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters } = await loadSdk();
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(REGISTER_GAS)
    .setFunction(
      "registerMerchant",
      new ContractFunctionParameters().addString(name).addString(category),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildUpdateMerchant(userAccountId: string, name: string, category: string) {
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters } = await loadSdk();
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(REGISTER_GAS)
    .setFunction(
      "updateMerchant",
      new ContractFunctionParameters().addString(name).addString(category),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildClaimYield(userAccountId: string) {
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters } = await loadSdk();
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(GAS)
    .setFunction("claimYield", new ContractFunctionParameters())
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildAddProduct(
  userAccountId: string,
  merchantEvmAddr: string,
  productName: string,
  priceRaw: number | bigint,
) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  const solAddr = toSolidityAddr(AccountId, merchantEvmAddr);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(REGISTER_GAS)
    .setFunction(
      "addProduct",
      new ContractFunctionParameters()
        .addAddress(solAddr)
        .addString(productName)
        .addUint256(toLong(Long, priceRaw)),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}

export async function buildMerchantWithdraw(userAccountId: string, amountRaw: number | bigint) {
  const sdk = await loadSdk();
  const { ContractExecuteTransaction, AccountId, ContractId, TransactionId, ContractFunctionParameters, Long } = sdk;
  if (!CONTRACTS.pool) throw new Error("Pool address not configured");
  const acctId = AccountId.fromString(userAccountId);
  return new ContractExecuteTransaction()
    .setContractId(toContractId(ContractId, CONTRACTS.pool))
    .setGas(GAS)
    .setFunction(
      "merchantWithdraw",
      new ContractFunctionParameters().addUint256(toLong(Long, amountRaw)),
    )
    .setNodeAccountIds(nodeIds(AccountId))
    .setTransactionId(TransactionId.generate(acctId))
    .freeze();
}
