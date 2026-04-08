# Payfrontline Project Development

## Project Summary

Payfrontline is an instant-settle BNPL payment gateway for merchants.

The product lets merchants offer Buy Now, Pay Later at checkout while receiving immediate settlement from a stablecoin-backed liquidity pool. Users repay within a short interest-free window, and repayment history is recorded on-chain to support a portable credit profile.

## Product Goals

- Let merchants offer BNPL without taking settlement delay risk.
- Keep merchant payouts effectively instant.
- Give users a short repayment window, currently designed around `15` days.
- Build a reusable on-chain repayment and credit history.
- Create a sustainable fee model for merchants and liquidity providers.

## Core Flow

1. Customer chooses BNPL at checkout.
2. Merchant receives immediate payout from the liquidity pool.
3. Customer repays later.
4. Repayment events are logged on-chain.
5. Default handling can trigger token-level controls and off-chain recovery.

## Stakeholders

### Merchants

- Need fast settlement.
- Need lower cash-flow risk.
- Are charged a flat `2%` BNPL transaction fee.

### Users

- Need short-term interest-free repayment.
- Build a credit profile through repayment behavior.

### Liquidity Providers

- Fund instant merchant settlement.
- Earn yield from protocol activity.

## Revenue Model

1. Merchant transaction fee: `2%` per BNPL transaction.
2. Late repayment fees for overdue users.
3. Enterprise SDK or integration fees for larger merchants.

## Current Progress

- Prototype architecture for instant merchant settlement and repayment tracking is defined.
- The full BNPL flow has been designed around Hedera services.
- Risk management and credit-profile mechanics have been designed.
- Success metrics and pilot roadmap have been defined.
- Early merchant and user intent data has been collected.

## Development Scope

### Frontend / Product Surface

- Checkout plugin for web.
- Checkout support for mobile.
- Merchant/admin dashboard.
- Demo and survey dashboard already exist publicly.

### Protocol / Backend Logic

- Liquidity pool logic for instant merchant settlement.
- Repayment scheduling and tracking.
- Credit-limit and default logic.
- Merchant settlement reporting.

### Smart Contract / Hedera Layer

- Tokenized credit and compliance controls using `HTS`.
- Repayment and dispute logging through `HCS`.
- Settlement transfers using `USDC` on Hedera.
- Analytics and reporting through Mirror Nodes.

## Hedera Architecture Notes

### HTS

- Used for tokenized credit lines.
- Supports compliance and freeze logic for defaults.
- Can support future native credit-token mechanics.

### HCS

- Used for immutable repayment logs.
- Used for timestamped dispute records.
- Used for repayment adherence history.

### Mirror Nodes

- Used for analytics dashboards.
- Used for compliance and settlement reporting.
- Used for monitoring merchant performance and defaults.

## Risk Management Model

### Customer Approval

- Assign a credit line to each user.
- Require KYC-linked onboarding.
- Adjust credit limits using repayment history and optional off-chain scoring.

### Risk Controls

- Cap exposure through the liquidity pool.
- Trigger token-level controls on default.
- Optionally require collateral or stake for riskier users.

### Default Handling

- Log repayment events on-chain.
- Notify users before due dates.
- Freeze token activity on missed repayments when applicable.
- Use off-chain collection or partner processes when needed.
- Maintain a reserve buffer for small defaults.

### Fraud Controls

- Map wallets to verified identities.
- Detect anomalies from repayment and usage patterns.
- Restrict users to one active BNPL line until repayment completes.

## Success Metrics

- Merchant adoption.
- Total transaction volume.
- Settlement latency.
- Repayment adherence.
- Default rate.
- Revenue captured from fees.

## Near-Term Roadmap

### Next 3-6 Months

1. Launch MVP checkout plugin for web and mobile.
2. Deploy the liquidity pool with stablecoin funding.
3. Onboard `1-3` pilot SMEs.

Primary success measures:

- Successful pilot transactions.
- Total instant payout volume.
- Repayment adherence above `90%`.

### 12-Month Targets

- `50-100` active merchants.
- `$500K+` transaction volume.
- Merchant payout latency below `1` second.
- Repayment adherence above `90%`.

## Go-To-Market Notes

- Start with merchants who already showed strong survey intent.
- Focus on SMEs in retail, F&B, and D2C.
- Use merchant distribution as the primary user acquisition channel.
- Offer zero-fee instant payouts during pilot onboarding.
- Use referrals and Hedera ecosystem exposure to widen distribution.

## Public References

- Website: `https://payfrontline.xyz`
- Demo: `https://payfrontline.xyz/demo`
- Survey dashboard: `https://payfrontline.xyz/dashboard`
- GitHub: `https://github.com/payfrontline`

## Notes For Future Development

- The current repo contains a Next.js frontend in `frontlineapp/` and a separate Foundry project in `contract/`.
- Product development should treat merchant checkout, dashboard UX, liquidity logic, and repayment tracking as the main execution tracks.
- Hedera-specific implementation should preserve the distinction between on-chain logging/compliance and off-chain scoring, notifications, and collections.
