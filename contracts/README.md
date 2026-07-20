# PayGram Contracts — Test & Deploy

On-chain vaults for pots, ROSCA circles, bills, tabs (borrow/lend), and allowances.  
**Goal:** every deposited USDC has an exit path. Tests enforce `balance == totalEscrowed`.

## Safety rules (non-negotiable)

1. **Accounting invariant** — `token.balanceOf(contract) == totalEscrowed` after every user action.
2. **User exit paths** — claim / release / refund / expire / guardian withdraw. No “admin seize escrow”.
3. **`rescueToken`** — only **excess** above `totalEscrowed` (mistaken transfers), never escrowed principal.
4. **ReentrancyGuard** + SafeERC20 on all external token moves.
5. **Mainnet** only after: full `npm test`, Sepolia rehearsal with funded testers, Arbiscan verify.

## Contracts

| Contract | Feature |
|----------|---------|
| `PayGramPot` | Collection pot → release / cancel+refund |
| `PayGramBillEscrow` | Split bill shares → release / cancel+refund |
| `PayGramRosca` | ROSCA rounds → auto-payout / timeout refund / member dissolve vote |
| `PayGramTab` | Lend USDC + debt ledger → repay / forgive |
| `PayGramAllowance` | Guardian purse + spend cap → close & withdraw |

Token: **USDC** (6 decimals). Arbitrum One: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`.

> **ROSCA** is the global product name (Rotating Savings and Credit Association). Regional names like ajo, esusu, susu, partner are UX copy only — not the contract name.

## Folder

```
contracts/
  contracts/     # Solidity
  test/          # Hardhat tests + no-stuck-funds invariants
  scripts/       # wallets, fund, deploy
  .wallets/      # gitignored secrets (created locally)
  deployments/   # address JSON per network
```

## Setup

```bash
cd contracts
npm install
cp .env.example .env
npm run compile
npm test
```

## Live Sepolia rehearsal (MockUSDC + stuck-funds check)

Deploys **MockUSDC** + all vaults, funds 3 testers, runs every lifecycle, asserts `balance == totalEscrowed == 0`:

```bash
npm run rehearse:sepolia
```

Addresses → `deployments/arbitrumSepolia.json`.

## Create funding + tester wallets

```bash
npm run wallets:create
```

This writes `contracts/.wallets/wallets.local.json` (gitignored) and prints:

- **Funding address** — send **Arbitrum ETH** (gas) + **USDC** here  
- **5 tester addresses** — used as Alice/Bob/… in live tests  

Copy `FUNDING_PRIVATE_KEY` into `contracts/.env`.

### Fund testers from the funding wallet

```bash
# Sepolia first (set USDC_ADDRESS to a Sepolia USDC or mock you deploy)
npm run wallets:fund:sepolia

# Mainnet Arbitrum (real USDC) — only when ready
npm run wallets:fund
```

Defaults: `0.002 ETH` + `25 USDC` per tester (`FUND_ETH_EACH` / `FUND_USDC_EACH`).

## Production harden (pre–Arbitrum One)

| Vault | Claim / exit |
|-------|----------------|
| **Pot / Bill** | Deadline; pull `withdraw*`; soft `cancel`; `releaseIfFunded`; `setRescueGuardian`. |
| **Rosca** | Pull `claimRoundRefund`; period bounds; guardian. |
| **Tab / Allowance** | `setRescueGuardian` (excess rescue only). |

`npm test` must be green before you fund and deploy.

## Deploy

```bash
npm run deploy:local          # MockUSDC + all vaults
npm run deploy:sepolia        # needs USDC_ADDRESS + FUNDING_PRIVATE_KEY
npm run deploy:arb            # Arbitrum One native USDC
npm run verify:arb            # Publish source on Arbiscan (needs ARBISCAN_API_KEY)
```

Addresses → `deployments/<network>.json`.

### Arbitrum One (Particle UA — required for the Mini App)

Particle only supports mainnets. Deploy vaults on **Arbitrum One** before wiring escrow features in the app.

**Deployer wallet:** `0x77539C4ec616360751b97563Dd6B4A9dE5D1E578` (from `npm run wallets:create`)

1. Send **~0.01 ETH on Arbitrum One** to the deployer (gas only — USDC not needed to deploy).
2. Confirm balance:
   ```bash
   npm run funding:check
   ```
3. Deploy all vaults against native USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`:
   ```bash
   npm run deploy:arb
   ```
4. Print app env lines and paste into the **repo-root** `.env`:
   ```bash
   npm run env:app
   ```
5. Restart the Vite app. Gift create → `approve` + `createGift` via Particle `createUniversalTransaction`.

Optional: set `RESCUE_GUARDIAN` in `contracts/.env` to a cold wallet before deploy (defaults to deployer).

## Test matrix (before mainnet)

| Step | Command / action |
|------|------------------|
| 1 | `npm test` — all unit + invariant suites green |
| 2 | `npm run verify:invariants` — stuck-fund suite |
| 3 | Deploy Sepolia → fund 5 testers → manual claim/refund/ROSCA round |
| 4 | Peer review escape hatches (cancel, expire, closeAndWithdraw) |
| 5 | Deploy Arbitrum with small amounts → full lifecycle → confirm contract USDC = 0 |
| 6 | Verify on Arbiscan |

## Mainnet checklist

- [ ] All tests pass locally  
- [ ] Sepolia dry-run with **multiple EOAs** funded from funding wallet  
- [ ] Confirmed no path leaves `totalEscrowed > 0` without a callable exit  
- [ ] `RESCUE_GUARDIAN` is a cold/multisig you control (excess only)  
- [ ] Frontend uses deployed addresses from `deployments/arbitrum.json`  
- [ ] Start with low caps; monitor first real pots / circles  

## Linking to app

See `docs/FEATURE-ROADMAP.md`. Wire via Particle `createUniversalTransaction` against these addresses (USDC approve + call).

## Threats we explicitly reject

- Owner `sweep()` of escrowed balances  
- Pause that blocks user withdrawals forever  
- Upgradeable proxy without timelock (these deploys are **non-upgradeable** for clarity)  
- Open-ended “admin fix later” for stuck funds — use cancel/expire/refund instead  
