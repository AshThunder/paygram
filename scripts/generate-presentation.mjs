#!/usr/bin/env node
/**
 * PayGram judge pitch deck — theme primary #00486d
 * Includes judging criteria, tech requirements, Chat, Arbitrum proof.
 * Run: npm run presentation
 */
import PptxGenJS from "pptxgenjs";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "docs", "PayGram-Pitch-Deck.pptx");
const logoPath = join(__dirname, "..", "public", "paygram-logo-512.png");

const PRIMARY = "00486d";
const BG = "F9F9FA";
const CARD = "FFFFFF";
const TEXT = "1A1C1D";
const MUTED = "707880";
const VARIANT = "40484F";
const BORDER = "E2E2E3";
const TERTIARY = "004F1C";
const ON_PRIMARY = "FFFFFF";
const LIGHT = "CBE6FF";
const LIGHT2 = "8ECDFF";

const TOTAL = 13;

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "PAYGRAM_16x9", width: 13.333, height: 7.5 });
pptx.layout = "PAYGRAM_16x9";
pptx.author = "PayGram";
pptx.title = "PayGram — UXmaxx Judge Pitch Deck";
pptx.subject = "Peer-to-peer payments in Telegram · Magic · Particle UA · EIP-7702 · Arbitrum";

function brandBar(s) {
  s.addShape(pptx.shapes.RECTANGLE, {
    x: 0, y: 0, w: 13.333, h: 0.1,
    fill: { color: PRIMARY }, line: { color: PRIMARY },
  });
}

function footer(s, page) {
  s.addText("PayGram  ·  Type it. Tap confirm. Paid.  ·  @paygram_bbot", {
    x: 0.55, y: 7.1, w: 10, h: 0.25,
    fontSize: 11, color: MUTED, fontFace: "Arial",
  });
  s.addText(`${page} / ${TOTAL}`, {
    x: 11.4, y: 7.1, w: 1.3, h: 0.25,
    fontSize: 11, color: MUTED, fontFace: "Arial", align: "right",
  });
}

function eyebrow(s, label) {
  s.addText(label.toUpperCase(), {
    x: 0.6, y: 0.35, w: 12, h: 0.3,
    fontSize: 12, bold: true, color: PRIMARY, fontFace: "Arial",
  });
}

function title(s, text, y = 0.7) {
  s.addText(text, {
    x: 0.6, y, w: 12.1, h: 0.55,
    fontSize: 26, bold: true, color: TEXT, fontFace: "Arial",
  });
}

function body(s, text, y, opts = {}) {
  s.addText(text, {
    x: 0.6, y, w: opts.w ?? 12.1, h: opts.h ?? 0.9,
    fontSize: opts.size ?? 15, color: opts.color ?? VARIANT, fontFace: "Arial",
  });
}

function card(s, x, y, w, h, fill = CARD) {
  s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: fill === PRIMARY ? PRIMARY : BORDER, pt: 1 },
    rectRadius: 0.14,
  });
}

function logo(s, x, y, size = 0.75) {
  if (existsSync(logoPath)) s.addImage({ path: logoPath, x, y, w: size, h: size });
  else {
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x, y, w: size, h: size, fill: { color: PRIMARY }, rectRadius: 0.14,
    });
  }
}

function lightSlide() {
  const s = pptx.addSlide();
  s.background = { color: BG };
  brandBar(s);
  return s;
}

// 1 Title
{
  const s = pptx.addSlide();
  s.background = { color: PRIMARY };
  logo(s, 0.65, 1.35, 0.95);
  s.addText("PayGram", {
    x: 0.65, y: 2.55, w: 12, h: 0.75,
    fontSize: 48, bold: true, color: ON_PRIMARY, fontFace: "Arial",
  });
  s.addText("Peer-to-peer payments inside Telegram", {
    x: 0.65, y: 3.35, w: 12, h: 0.45,
    fontSize: 22, color: LIGHT, fontFace: "Arial",
  });
  s.addText("One USD balance. Chat-first. Zero chain jargon.", {
    x: 0.65, y: 3.9, w: 12, h: 0.35,
    fontSize: 16, color: ON_PRIMARY, fontFace: "Arial",
  });
  s.addText(
    "Live: paygram-rust.vercel.app   ·   Bot: @paygram_bbot\nStack: Magic · Particle Universal Accounts + EIP-7702 · Arbitrum One (verified USDC vaults)\nUXmaxx Hackathon · Encode Club · 7702 Collective",
    {
      x: 0.65, y: 5.0, w: 12, h: 1.2,
      fontSize: 14, color: LIGHT2, fontFace: "Arial",
    }
  );
}

// 2 Problem
{
  const s = lightSlide();
  eyebrow(s, "Problem");
  title(s, "Crypto infra works. Consumer UX doesn’t.");
  body(s, "Telegram already holds the social graph. Paying a friend still forces chain pickers, gas tokens, bridges, and seed phrases — before anyone can send $5.", 1.35, { h: 0.7 });

  const items = [
    ["Chain pickers", "Users must choose networks before a simple P2P send"],
    ["Gas & bridges", "Hold gas, bridge assets, learn jargon just to tip a friend"],
    ["Wrong surface", "900M+ Telegram users — money still lives in other apps"],
    ["Hackathon thesis", "“No thinking about chains. No gas accounting. No seed phrases.”"],
  ];
  items.forEach((it, i) => {
    const y = 2.2 + i * 1.0;
    card(s, 0.6, y, 12.1, 0.85);
    s.addText(it[0], { x: 0.9, y: y + 0.15, w: 3.2, h: 0.55, fontSize: 15, bold: true, color: PRIMARY, fontFace: "Arial", valign: "middle" });
    s.addText(it[1], { x: 4.2, y: y + 0.15, w: 8.2, h: 0.55, fontSize: 15, color: TEXT, fontFace: "Arial", valign: "middle" });
  });
  footer(s, 2);
}

// 3 Solution
{
  const s = lightSlide();
  eyebrow(s, "Solution");
  title(s, "PayGram — pay friends in Telegram");
  body(s, "A full Mini App payment product: one unified USD balance, natural-language Chat, Activity inbox, Collect pots, Circles (ROSCA), Loans, Friends, Checkout, and Me — powered by Magic + Particle UA + EIP-7702, settled on Arbitrum.", 1.35, { h: 0.85 });

  const pills = [
    ["One balance", "Holdings across chains roll into one USD total"],
    ["Chat or forms", "Type send $25 to @alice — or use dedicated screens"],
    ["Group + credit", "Split · Collect · Circles · Lend/borrow tabs"],
    ["Invisible stack", "No chain picker · no seed phrase · gas not deducted from send amount"],
  ];
  pills.forEach((p, i) => {
    const x = 0.6 + (i % 2) * 6.2;
    const y = 2.45 + Math.floor(i / 2) * 1.85;
    card(s, x, y, 5.9, 1.65);
    s.addText(p[0], { x: x + 0.35, y: y + 0.35, w: 5.2, h: 0.4, fontSize: 18, bold: true, color: PRIMARY, fontFace: "Arial" });
    s.addText(p[1], { x: x + 0.35, y: y + 0.85, w: 5.2, h: 0.55, fontSize: 14, color: VARIANT, fontFace: "Arial" });
  });
  footer(s, 3);
}

// 4 Chat (detailed)
{
  const s = lightSlide();
  eyebrow(s, "Chat — core UX");
  title(s, "Type it. Tap confirm. Paid.");
  body(s, "Chat is how PayGram feels native to Telegram: plain-English money intents → structured confirm → one payment → receipt in-thread.", 1.3, { h: 0.55 });

  const steps = [
    ["1. Type", "send $25 to @alice for lunch\ntip · request · split · collect · swap · balance"],
    ["2. Understand", "Parser → amount, recipient, note\n@username → wallet registry"],
    ["3. Confirm", "Compact card + balance preview\nConfirm & pay / Edit / Cancel"],
    ["4. Settle", "UA routes/converts if needed\nReceipt → Activity history"],
  ];
  steps.forEach((st, i) => {
    const x = 0.55 + i * 3.2;
    card(s, x, 2.05, 3.05, 3.55, i === 3 ? PRIMARY : CARD);
    s.addText(st[0], {
      x: x + 0.2, y: 2.3, w: 2.65, h: 0.45,
      fontSize: 16, bold: true, color: i === 3 ? ON_PRIMARY : PRIMARY, fontFace: "Arial",
    });
    s.addText(st[1], {
      x: x + 0.2, y: 2.95, w: 2.65, h: 2.3,
      fontSize: 13, color: i === 3 ? LIGHT : VARIANT, fontFace: "Arial",
    });
  });
  s.addText("Deep links (pay / request / split / pot / circle / checkout) open the same confirm flows from any Telegram chat.", {
    x: 0.6, y: 5.8, w: 12.1, h: 0.4, fontSize: 13, color: MUTED, fontFace: "Arial",
  });
  footer(s, 4);
}

// 5 Product map
{
  const s = lightSlide();
  eyebrow(s, "Product surface");
  title(s, "Everything the Mini App does");

  const rows = [
    ["Home", "Unified balance · service grid · friends · net with friends"],
    ["Chat", "NL payments · confirm cards · receipts · voice · clear history"],
    ["Activity", "Open requests/loans · Pay all · Remind · History filters · Refresh"],
    ["Collect", "Group pots with goals, contributions, share links, on-chain release"],
    ["Circles", "ROSCA rotating savings — invite, contribute, on-chain rounds"],
    ["Loans", "Lend / borrow ledger · repay · forgive · net balance"],
    ["Friends", "PayGram contacts · quick send / request"],
    ["Me", "Fund QR · EIP-7702 unlock · tip/pay links · allowances · About + Arbiscan"],
  ];
  rows.forEach((r, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i % 4;
    const x = 0.55 + col * 6.4;
    const y = 1.45 + row * 1.2;
    card(s, x, y, 6.15, 1.05);
    s.addText(r[0], { x: x + 0.25, y: y + 0.2, w: 1.6, h: 0.65, fontSize: 14, bold: true, color: PRIMARY, fontFace: "Arial", valign: "middle" });
    s.addText(r[1], { x: x + 1.95, y: y + 0.2, w: 3.95, h: 0.65, fontSize: 13, color: TEXT, fontFace: "Arial", valign: "middle" });
  });
  footer(s, 5);
}

// 6 Architecture
{
  const s = lightSlide();
  eyebrow(s, "Architecture");
  title(s, "Three partners. One invisible stack.");

  const layers = [
    ["Telegram Mini App + Bot", "Distribution · deep links · @username social graph"],
    ["Magic", "Email OTP · embedded EOA · no seed phrases · sign7702"],
    ["Particle Universal Accounts + EIP-7702", "Unified USD balance · createUniversalTransaction · cross-chain convert/route · one-time unlock"],
    ["Arbitrum One", "USDC settlement · escrow vaults for pots / splits / ROSCA / tabs / allowances"],
  ];
  layers.forEach((L, i) => {
    const y = 1.5 + i * 1.2;
    const dark = i === 3;
    card(s, 0.6, y, 12.1, 1.05, dark ? PRIMARY : CARD);
    s.addText(L[0], { x: 0.95, y: y + 0.15, w: 11.4, h: 0.35, fontSize: 16, bold: true, color: dark ? ON_PRIMARY : PRIMARY, fontFace: "Arial" });
    s.addText(L[1], { x: 0.95, y: y + 0.55, w: 11.4, h: 0.35, fontSize: 14, color: dark ? LIGHT : VARIANT, fontFace: "Arial" });
  });
  footer(s, 6);
}

// 7 Particle + EIP-7702 technical
{
  const s = lightSlide();
  eyebrow(s, "Particle UA + EIP-7702 — technical proof");
  title(s, "How cross-chain becomes one confirm");

  const left = [
    ["User sees", "One USD total — never picks Base / Eth / Arb"],
    ["SDK mode", "useEIP7702: true — EOA address = UA address"],
    ["Unlock once", "ensureDelegated / Magic sign7702 on Arbitrum"],
    ["Pay", "createUniversalTransaction (+ convert / expectTokens)"],
    ["Gas UX", "Fees covered separately — send amount ≠ gas"],
  ];
  left.forEach((r, i) => {
    const y = 1.45 + i * 0.9;
    card(s, 0.55, y, 6.0, 0.8);
    s.addText(r[0], { x: 0.8, y: y + 0.2, w: 1.8, h: 0.4, fontSize: 13, bold: true, color: PRIMARY, fontFace: "Arial" });
    s.addText(r[1], { x: 2.7, y: y + 0.15, w: 3.6, h: 0.5, fontSize: 13, color: TEXT, fontFace: "Arial", valign: "middle" });
  });

  card(s, 6.85, 1.45, 5.85, 4.5, PRIMARY);
  s.addText("Why this wins the UA track", {
    x: 7.2, y: 1.8, w: 5.2, h: 0.4, fontSize: 16, bold: true, color: LIGHT2, fontFace: "Arial",
  });
  s.addText(
    "• Chain abstraction is the product, not a settings toggle\n\n• Cross-chain funding → same balance\n\n• First send may unlock once; after that, chat stays simple\n\n• Profile: “Powered by Particle Universal Accounts + EIP-7702”\n\n• Me → About explains stack for judges",
    {
      x: 7.2, y: 2.4, w: 5.2, h: 3.2, fontSize: 14, color: ON_PRIMARY, fontFace: "Arial",
    }
  );
  footer(s, 7);
}

// 8 Arbitrum contracts detailed
{
  const s = lightSlide();
  eyebrow(s, "Arbitrum One — settlement & escrow");
  title(s, "Particle moves value. Arbitrum enforces rules.");
  body(s, "Simple P2P can route via UA. Group pots, splits, ROSCA, loans, and allowances use verified USDC vaults — auditable on Arbiscan, invariant-tested (balance == totalEscrowed).", 1.3, { h: 0.6, size: 14 });

  const data = [
    [
      { text: "Contract", options: { bold: true, color: ON_PRIMARY, fill: { color: PRIMARY } } },
      { text: "Job", options: { bold: true, color: ON_PRIMARY, fill: { color: PRIMARY } } },
      { text: "Address (Arb One)", options: { bold: true, color: ON_PRIMARY, fill: { color: PRIMARY } } },
    ],
    ["PayGramPot", "Collection pot escrow", "0x6D58…E2cF"],
    ["PayGramBillEscrow", "Split / bill escrow", "0xe927…86A8"],
    ["PayGramRosca", "ROSCA circle rounds", "0xd6aC…5a45"],
    ["PayGramTab", "Lend / borrow ledger", "0xcfbb…A4bE"],
    ["PayGramAllowance", "Spend-limit purses", "0x1d19…8B7b"],
  ].map((row, idx) => {
    if (idx === 0) return row;
    return row.map((c) => ({ text: c, options: { color: TEXT, fill: { color: CARD } } }));
  });

  s.addTable(data, {
    x: 0.55, y: 2.1, w: 12.2,
    colW: [3.2, 4.0, 5.0],
    border: [{ type: "solid", pt: 0.5, color: BORDER }],
    fontFace: "Arial",
    fontSize: 13,
    color: TEXT,
    align: "left",
    valign: "middle",
  });

  s.addText("Token: native USDC 0xaf88…5831  ·  All five ✅ source-verified  ·  Me → About PayGram links each contract", {
    x: 0.6, y: 5.85, w: 12.1, h: 0.35, fontSize: 13, color: TERTIARY, fontFace: "Arial",
  });
  footer(s, 8);
}

// 9 On-chain vs off-chain
{
  const s = lightSlide();
  eyebrow(s, "Clarity for judges");
  title(s, "What’s on-chain vs off-chain");

  card(s, 0.55, 1.5, 6.0, 4.6);
  s.addText("On-chain", { x: 0.9, y: 1.75, w: 5.3, h: 0.4, fontSize: 18, bold: true, color: PRIMARY, fontFace: "Arial" });
  s.addText(
    "• P2P / tip settlement via Particle UA\n• Pot deposits & release (PayGramPot)\n• Bill split escrow (BillEscrow)\n• ROSCA rounds (Rosca)\n• Lend / repay / forgive (Tab)\n• Allowance purses\n• EIP-7702 delegation on Arbitrum",
    { x: 0.9, y: 2.35, w: 5.3, h: 3.4, fontSize: 14, color: TEXT, fontFace: "Arial" }
  );

  card(s, 6.8, 1.5, 6.0, 4.6);
  s.addText("Off-chain (speed / UX)", { x: 7.15, y: 1.75, w: 5.3, h: 0.4, fontSize: 18, bold: true, color: PRIMARY, fontFace: "Arial" });
  s.addText(
    "• @username → wallet registry (Redis)\n• Activity metadata & sync API\n• Local chat history (clearable)\n• Friends list\n• Deep-link routing into confirms\n\nMoney still moves on-chain — registry is identity glue, not a fake ledger.",
    { x: 7.15, y: 2.35, w: 5.3, h: 3.4, fontSize: 14, color: TEXT, fontFace: "Arial" }
  );
  footer(s, 9);
}

// 10 Judging criteria
{
  const s = lightSlide();
  eyebrow(s, "UXmaxx judging — how we score");
  title(s, "Mapped to the 45 / 25 / 20 / 10 rubric");

  const criteria = [
    ["UX & Design — 45%", "No chain picker · Magic email login · Chat + forms · Activity inbox · compact confirms · Telegram-native Mini App"],
    ["Technical — 25%", "useEIP7702 · Magic embedded wallet · createUniversalTransaction · 5 verified Arb vaults · invariant tests · live Vercel deploy"],
    ["Creativity — 20%", "NL chat→pay · deep links · Collect/Circles/Tabs · tip jar & checkout — not a DeFi dashboard cosplay"],
    ["Completeness — 10%", "End-to-end flows shipped · bot + Mini App · username registry · About → Arbiscan · runnable demo"],
  ];
  criteria.forEach((c, i) => {
    const y = 1.45 + i * 1.2;
    card(s, 0.55, y, 12.2, 1.05);
    s.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: 0.75, y: y + 0.25, w: 3.4, h: 0.55,
      fill: { color: PRIMARY }, rectRadius: 0.1,
    });
    s.addText(c[0], {
      x: 0.75, y: y + 0.3, w: 3.4, h: 0.45,
      fontSize: 12, bold: true, color: ON_PRIMARY, align: "center", fontFace: "Arial",
    });
    s.addText(c[1], {
      x: 4.4, y: y + 0.2, w: 8.1, h: 0.65,
      fontSize: 13, color: TEXT, fontFace: "Arial", valign: "middle",
    });
  });
  footer(s, 10);
}

// 11 Requirements checklist + tracks
{
  const s = lightSlide();
  eyebrow(s, "Hard requirements");
  title(s, "CompeteHub checklist — all met");

  const reqs = [
    ["✅", "Universal Accounts SDK in EIP-7702 mode (useEIP7702: true)"],
    ["✅", "Embedded wallet — Magic email OTP"],
    ["✅", "Partner tech — Magic + Particle + Arbitrum"],
    ["✅", "≥1 cross-chain operation — UA transfer/convert into Arb settlement"],
    ["✅", "Functional demo — live at paygram-rust.vercel.app + @paygram_bbot"],
  ];
  reqs.forEach((r, i) => {
    const y = 1.45 + i * 0.7;
    card(s, 0.55, y, 7.5, 0.6);
    s.addText(`${r[0]}  ${r[1]}`, {
      x: 0.8, y: y + 0.12, w: 7.0, h: 0.4,
      fontSize: 13, color: TEXT, fontFace: "Arial",
    });
  });

  card(s, 8.3, 1.45, 4.45, 4.4, PRIMARY);
  s.addText("Tracks we claim", {
    x: 8.65, y: 1.8, w: 3.8, h: 0.4, fontSize: 15, bold: true, color: LIGHT2, fontFace: "Arial",
  });
  s.addText(
    "1. Universal Accounts\n   Particle + EIP-7702\n   + cross-chain UX\n\n2. Arbitrum\n   Settlement + 5 verified\n   USDC vaults\n\n3. Magic\n   Embedded wallet\n   onboarding",
    { x: 8.65, y: 2.4, w: 3.8, h: 3.1, fontSize: 14, color: ON_PRIMARY, fontFace: "Arial" }
  );
  footer(s, 11);
}

// 12 Demo script
{
  const s = lightSlide();
  eyebrow(s, "Live demo — ~3 minutes");
  title(s, "What judges must see");

  const demo = [
    ["0:00", "Open @paygram_bbot → Mini App → Magic login"],
    ["0:15", "Home / Me → unified USD balance (multi-chain rollup)"],
    ["0:45", "Fund from Base/Eth QR — same total (call out: no chain picker)"],
    ["1:30", "EIP-7702 unlock once (or show already unlocked)"],
    ["1:50", "Chat: send $5 to @friend → Confirm → receipt → Activity"],
    ["2:30", "Split or Collect or Loans — then Me → About → Arbiscan"],
  ];
  demo.forEach((d, i) => {
    const y = 1.45 + i * 0.75;
    card(s, 0.55, y, 12.2, 0.65);
    s.addText(d[0], { x: 0.85, y: y + 0.15, w: 1.2, h: 0.35, fontSize: 14, bold: true, color: PRIMARY, fontFace: "Arial" });
    s.addText(d[1], { x: 2.2, y: y + 0.15, w: 10.2, h: 0.35, fontSize: 14, color: TEXT, fontFace: "Arial" });
  });
  footer(s, 12);
}

// 13 Close
{
  const s = pptx.addSlide();
  s.background = { color: PRIMARY };
  logo(s, 0.65, 1.1, 0.85);
  s.addText("Try it. Ask anything.", {
    x: 0.65, y: 2.2, w: 12, h: 0.65,
    fontSize: 36, bold: true, color: ON_PRIMARY, fontFace: "Arial",
  });
  s.addText(
    "Chat is how you ask.\nParticle moves the balance.\nArbitrum enforces the rules.\nAll inside Telegram.",
    {
      x: 0.65, y: 3.05, w: 12, h: 1.6,
      fontSize: 18, color: LIGHT, fontFace: "Arial",
    }
  );
  s.addText(
    "Type it. Tap confirm. Paid.\n\nhttps://paygram-rust.vercel.app\nhttps://t.me/paygram_bbot\n\nDocs: EXPLAINER-PITCH.md · SUBMISSION.md · README (contracts)",
    {
      x: 0.65, y: 4.9, w: 12, h: 1.8,
      fontSize: 14, color: LIGHT2, fontFace: "Arial",
    }
  );
}

await pptx.writeFile({ fileName: outPath });
console.log(`Created: ${outPath} (${TOTAL} slides)`);
