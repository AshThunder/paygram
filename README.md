# PayGram

**Cross-chain payments inside Telegram — one balance, zero chain jargon.**

PayGram is a Telegram Mini App for the [UXmaxx Hackathon](https://www.encodeclub.com/programmes/uxmaxx-hackathon). It combines Venmo-style P2P payments, creator tipping, bill splitting, group collections, and payment links — all powered by Particle Universal Accounts and EIP-7702 on Arbitrum. Users see one USD balance; bridging, gas, and chain routing stay invisible.

**Stack:** Vite + React · Magic (embedded wallet) · Particle Universal Accounts (EIP-7702) · Arbitrum

---

## What PayGram is

PayGram is **not** just a chat-to-pay demo. It is a full payment product with four tabs:

| Tab | What it does |
|-----|----------------|
| **Chat** | Natural-language payments — type what you want, confirm, done |
| **Activity** | Pending requests, what you owe, what's owed to you, transaction history |
| **Collect** | Group collection pots with progress bars, contributions, shareable links |
| **Me** | Profile, unified balance, tip jar, pay links, gift links, friends on PayGram |

Chat is the primary input — but send, request, split, collect, tip, and pay links each have their own flows and dedicated UI.

---

## Features

### Payments
- **Send** — P2P transfers to `@username` or `0x` address
- **Tip** — One-tap creator tipping (TipLink)
- **Request** — Ask someone to pay you; they settle from Activity
- **Pay request** — One-tap pay from the Activity inbox

### Groups
- **Split** — Divide a bill among friends; per-person requests auto-created
- **Collect** — Group pots for trips, gifts, events (SaveCircle-lite)
- **Contribute** — Add to any active collection pot

### Links & sharing
- **Tip jar** — Personal tip link (`t.me/bot?startapp=pay_5_you`)
- **Pay link** — Request a specific amount via deep link
- **Gift link** — Shareable pre-set amount (`create gift $20`)
- **Receipt share** — Share confirmed payments to Telegram

### Infrastructure (invisible to users)
- Unified balance across all chains via Particle UA
- Cross-chain routing on every send/tip/contribute
- EIP-7702 auto-delegation on Arbitrum (no manual "upgrade wallet" step)
- Magic embedded wallet — no seed phrases

---

## Chat commands

```
send $25 to @alice for lunch
tip @creator $5
request $30 from @bob
split $120 with @bob @carol @dave
collect $500 for Bali trip
contribute $10 to pot_abc123
create gift $20
remind @bob
balance
```

Free-form works too: `pay bob twenty five dollars for pizza`

---

## Quick start

```bash
cp .env.example .env
# Fill in Magic + Particle credentials (see .env.example)

npm install
npm run dev        # http://localhost:5173
npm run bot        # Shell bot — needs TELEGRAM_BOT_TOKEN
```

### Environment variables

| Variable | Source |
|----------|--------|
| `VITE_MAGIC_API_KEY` | [dashboard.magic.link](https://dashboard.magic.link) |
| `VITE_PROJECT_ID` | [dashboard.particle.network](https://dashboard.particle.network) |
| `VITE_CLIENT_KEY` | Particle dashboard |
| `VITE_APP_ID` | Particle dashboard (create a Web app) |
| `VITE_ARB_RPC_URL` | [dashboard.alchemy.com](https://dashboard.alchemy.com) (optional) |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `VITE_MINI_APP_URL` | Your deployed URL |

---

## Architecture

```
Telegram Bot (shell)  →  opens  →  PayGram Mini App (Vite + React)
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
                 Chat              Activity            Collect / Me
              (NL parser)      (pay requests)      (pots, links, profile)
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                              Magic (embedded wallet)
                                        ▼
                         Particle UA (EIP-7702 / Arbitrum)
                                        ▼
                         createTransferTransaction (cross-chain)
```

The bot is only a door — menu button and pay deep links. All product logic lives in the Mini App.

---

## Project structure

```
src/
  components/     # Chat UI, balance header, tabs, auth
  hooks/          # Magic, UA, Auth, PayGram store, useChat
  lib/            # Intent parser, links, storage, telegram helpers
  pages/          # Chat, Activity, Collect, Me
bot/              # Telegram shell bot
docs/
  BUILD-PLAN.md           # Full feature spec & phases
  HACKATHON-RESEARCH.md   # Hackathon requirements & stack research
```

---

## Telegram setup

1. Create bot via [@BotFather](https://t.me/BotFather) → `/newbot`
2. `/setdomain` → your deployed Mini App URL
3. Set **Menu Button** → Mini App URL
4. Add `TELEGRAM_BOT_TOKEN` and `VITE_MINI_APP_URL` to `.env`
5. Add your domain to Magic allowed origins

---

## Deploy

```bash
npm run build
# Deploy dist/ + api/ to Vercel
```

### Vercel setup (Week 2)

1. Import repo at [vercel.com](https://vercel.com) → connect `AshThunder/paygram`
2. Add env vars from `.env.example` (Magic, Particle, Telegram, RPC)
3. **Storage (required for @username lookup):** Vercel dashboard → **Storage** → **Upstash Redis** → connect to `paygram` (adds `KV_REST_API_URL` + `KV_REST_API_TOKEN`)
4. Deploy — API at `/api/user-registry` serves user registry; `/api/requests`, `/api/pots`, `/api/gifts` for shared state
5. Set `VITE_MINI_APP_URL` to your Vercel URL, redeploy

**Live app:** https://paygram-rust.vercel.app  
**Telegram bot:** [@paygram_bbot](https://t.me/paygram_bbot) — menu button opens the Mini App

### Local full-stack dev

```bash
npm run vercel:dev   # Mini App + API together (needs Vercel CLI)
npm run dev          # Frontend only — API falls back to localStorage
```

---

## Hackathon alignment

Built for [UXmaxx](https://www.encodeclub.com/programmes/uxmaxx-hackathon) — judging weights UX at 45%.

| Requirement | How PayGram satisfies it |
|-------------|--------------------------|
| UA SDK + EIP-7702 | Auto-delegate on Arbitrum, every tx via UA |
| Embedded wallet | Magic email / Telegram OAuth |
| Partner tech | Magic + Particle + Arbitrum |
| Cross-chain | All sends route via `createTransferTransaction` |
| Consumer UX | One balance, no chains, Venmo-familiar flows |

---

## Docs

- [Build plan](./docs/BUILD-PLAN.md) — Tier C feature spec, architecture, phases
- [Hackathon research](./docs/HACKATHON-RESEARCH.md) — Requirements, judging, stack notes

---

## Demo script

1. Open Mini App → login → see unified balance
2. Chat: `send $5 to 0x...` → confirm → receipt
3. Chat: `split $60 with @bob @carol` → Activity shows requests
4. Chat: `collect $200 for dinner` → Collect tab shows pot
5. Me tab → copy tip link → share
6. Activity tab → pay a pending request

*Type it. Tap confirm. Paid.*
