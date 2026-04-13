#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing contract/.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
source .env

: "${PRIVATE_KEY:?PRIVATE_KEY must be set in contract/.env}"

RPC_URL="${RPC_URL:-https://testnet.hashio.io/api}"
MIRROR_URL="${MIRROR_URL:-https://testnet.mirrornode.hedera.com}"
CURVE_BASE_PRICE_PER_TOKEN_TINYBAR="${CURVE_BASE_PRICE_PER_TOKEN_TINYBAR:-2000}"
CURVE_STEEPNESS_WAD="${CURVE_STEEPNESS_WAD:-2000000000000000000}"
POOL_SEED_TOKENS="${POOL_SEED_TOKENS:-1000000000000000}"
DEMO_MERCHANT_NAME="${DEMO_MERCHANT_NAME:-Demo Merchant}"
DEMO_MERCHANT_CATEGORY="${DEMO_MERCHANT_CATEGORY:-Mainnet merchant}"
DEPLOYER_EVM_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY")"
DEMO_MERCHANT_EVM_ADDRESS="${DEMO_MERCHANT_EVM_ADDRESS:-$DEPLOYER_EVM_ADDRESS}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to resolve Hedera contract IDs from Mirror Node responses." >&2
  exit 1
fi

deploy_contract() {
  local label="$1"
  shift
  local output
  output="$("$@" 2>&1)"
  echo "$output" >&2
  awk '/Deployed to:/ {print $3}' <<<"$output" | tail -n 1
}

resolve_contract_id() {
  local evm_address="$1"
  curl -fsSL "$MIRROR_URL/api/v1/contracts/$evm_address" | jq -r '.contract_id'
}

resolve_account_id() {
  local evm_address="$1"
  curl -fsSL "$MIRROR_URL/api/v1/accounts/$evm_address" | jq -r '.account'
}

send_tx() {
  cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
}

echo "Deploying Frontline contracts to Hedera testnet..." >&2

FLT_EVM_ADDRESS="$(
  deploy_contract "FrontlineToken" \
    forge create src/FrontlineToken.sol:FrontlineToken \
      --broadcast \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
)"

POOL_EVM_ADDRESS="$(
  deploy_contract "FrontlinePool" \
    forge create src/FrontlinePool.sol:FrontlinePool \
      --broadcast \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY" \
      --constructor-args "$FLT_EVM_ADDRESS"
)"

REPUTATION_EVM_ADDRESS="$(
  deploy_contract "FrontlineReputation" \
    forge create src/FrontlineReputation.sol:FrontlineReputation \
      --broadcast \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
)"

CURVE_EVM_ADDRESS="$(
  deploy_contract "FrontlineBondingCurve" \
    forge create src/FrontlineBondingCurve.sol:FrontlineBondingCurve \
      --broadcast \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY" \
      --constructor-args \
      "$FLT_EVM_ADDRESS" \
      "$CURVE_BASE_PRICE_PER_TOKEN_TINYBAR" \
      "$CURVE_STEEPNESS_WAD"
)"

echo "Running post-deploy setup..." >&2

send_tx "$POOL_EVM_ADDRESS" "setReputation(address)" "$REPUTATION_EVM_ADDRESS"
send_tx "$REPUTATION_EVM_ADDRESS" "setAuthorizedCaller(address,bool)" "$POOL_EVM_ADDRESS" true
send_tx "$FLT_EVM_ADDRESS" "setAuthorizedMinter(address,bool)" "$CURVE_EVM_ADDRESS" true
send_tx "$CURVE_EVM_ADDRESS" "activateCurve()"

if [[ "$POOL_SEED_TOKENS" != "0" ]]; then
  send_tx "$CURVE_EVM_ADDRESS" "bootstrapAllocation(address,uint256)" "$DEPLOYER_EVM_ADDRESS" "$POOL_SEED_TOKENS"
  send_tx "$FLT_EVM_ADDRESS" "approve(address,uint256)" "$POOL_EVM_ADDRESS" "$POOL_SEED_TOKENS"
  send_tx "$POOL_EVM_ADDRESS" "stake(uint256)" "$POOL_SEED_TOKENS"
fi

send_tx \
  "$POOL_EVM_ADDRESS" \
  "registerMerchantFor(address,string,string)" \
  "$DEMO_MERCHANT_EVM_ADDRESS" \
  "$DEMO_MERCHANT_NAME" \
  "$DEMO_MERCHANT_CATEGORY"

FLT_HEDERA_ID="$(resolve_contract_id "$FLT_EVM_ADDRESS")"
POOL_HEDERA_ID="$(resolve_contract_id "$POOL_EVM_ADDRESS")"
REPUTATION_HEDERA_ID="$(resolve_contract_id "$REPUTATION_EVM_ADDRESS")"
CURVE_HEDERA_ID="$(resolve_contract_id "$CURVE_EVM_ADDRESS")"
DEMO_MERCHANT_HEDERA_ID="$(resolve_account_id "$DEMO_MERCHANT_EVM_ADDRESS")"

cat <<EOF
Deployment complete.

Use these in frontlineapp/.env:
NEXT_PUBLIC_FLT_TOKEN_ADDRESS=$FLT_EVM_ADDRESS
NEXT_PUBLIC_FRONTLINE_POOL_ADDRESS=$POOL_EVM_ADDRESS
NEXT_PUBLIC_FRONTLINE_REPUTATION_ADDRESS=$REPUTATION_EVM_ADDRESS
NEXT_PUBLIC_FRONTLINE_BONDING_CURVE_ADDRESS=$CURVE_EVM_ADDRESS
NEXT_PUBLIC_MERCHANT_NORTH_ADDRESS=$DEMO_MERCHANT_EVM_ADDRESS
NEXT_PUBLIC_MERCHANT_PARCEL_ADDRESS=$DEMO_MERCHANT_EVM_ADDRESS
NEXT_PUBLIC_MERCHANT_VOLT_ADDRESS=$DEMO_MERCHANT_EVM_ADDRESS

Hedera native contract IDs:
HEDERA_FLT_CONTRACT_ID=$FLT_HEDERA_ID
HEDERA_FRONTLINE_POOL_CONTRACT_ID=$POOL_HEDERA_ID
HEDERA_FRONTLINE_REPUTATION_CONTRACT_ID=$REPUTATION_HEDERA_ID
HEDERA_FRONTLINE_BONDING_CURVE_CONTRACT_ID=$CURVE_HEDERA_ID
HEDERA_DEMO_MERCHANT_ACCOUNT_ID=$DEMO_MERCHANT_HEDERA_ID

EVM addresses:
HEDERA_FLT_EVM_ADDRESS=$FLT_EVM_ADDRESS
HEDERA_FRONTLINE_POOL_EVM_ADDRESS=$POOL_EVM_ADDRESS
HEDERA_FRONTLINE_REPUTATION_EVM_ADDRESS=$REPUTATION_EVM_ADDRESS
HEDERA_FRONTLINE_BONDING_CURVE_EVM_ADDRESS=$CURVE_EVM_ADDRESS
HEDERA_DEMO_MERCHANT_EVM_ADDRESS=$DEMO_MERCHANT_EVM_ADDRESS

Bootstrap values:
CURVE_BASE_PRICE_PER_TOKEN_TINYBAR=$CURVE_BASE_PRICE_PER_TOKEN_TINYBAR
CURVE_STEEPNESS_WAD=$CURVE_STEEPNESS_WAD
POOL_SEED_TOKENS=$POOL_SEED_TOKENS
EOF
