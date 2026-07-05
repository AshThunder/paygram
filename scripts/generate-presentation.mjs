#!/usr/bin/env node
/**
 * Generate PayGram UXmaxx checkpoint PowerPoint.
 * Run: npm run presentation
 */
import PptxGenJS from "pptxgenjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "docs", "PayGram-UXmaxx-Checkpoint.pptx");

const BG = "0B0B0F";
const CARD = "141419";
const BRAND = "6851FF";
const TEXT = "F4F4F5";
const MUTED = "A1A1AA";
const SUCCESS = "00E6A0";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";
pptx.author = "AshThunder";
pptx.title = "PayGram — UXmaxx Checkpoint";

function titleSlide(title, subtitle, footer) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addText(title, { x: 0.6, y: 1.8, w: 8.8, h: 1, fontSize: 44, bold: true, color: TEXT, fontFace: "Arial" });
  s.addText(subtitle, { x: 0.6, y: 3.0, w: 8.8, h: 0.8, fontSize: 22, color: BRAND, fontFace: "Arial" });
  s.addText(footer, { x: 0.6, y: 4.8, w: 8.8, h: 1.5, fontSize: 12, color: MUTED, fontFace: "Arial" });
}

function sectionSlide(heading, lines, note) {
  const s = pptx.addSlide();
  s.background = { color: CARD };
  s.addText(heading.toUpperCase(), { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 12, bold: true, color: BRAND, fontFace: "Arial" });
  s.addText(lines.join("\n"), { x: 0.5, y: 0.9, w: 9, h: 4.8, fontSize: 16, color: TEXT, fontFace: "Arial", valign: "top" });
  if (note) s.addText(note, { x: 0.5, y: 5.8, w: 9, h: 0.6, fontSize: 14, color: SUCCESS, fontFace: "Arial", italic: true });
}

function tableSlide(heading, headers, rows) {
  const s = pptx.addSlide();
  s.background = { color: CARD };
  s.addText(heading.toUpperCase(), { x: 0.5, y: 0.3, w: 9, h: 0.4, fontSize: 12, bold: true, color: BRAND, fontFace: "Arial" });
  const data = [headers.map((h) => ({ text: h, options: { bold: true, color: BRAND, fill: "1E1E28" } }))];
  rows.forEach((r) => data.push(r.map((c) => ({ text: c, options: { color: TEXT } }))));
  s.addTable(data, { x: 0.5, y: 0.9, w: 9, colW: [2.5, 6.5], fontSize: 12, border: { type: "solid", color: "2A2A35", pt: 1 }, fill: "141419" });
}

titleSlide(
  "PayGram",
  "Cross-chain payments inside Telegram",
  "Type it. Tap confirm. Paid.\n\nUXmaxx Hackathon · Encode Club · 2026\nStack: Vite · Magic · Particle UA · EIP-7702 · Arbitrum\ngithub.com/AshThunder/paygram"
);

sectionSlide("The Problem", [
  "Crypto has the infrastructure. It doesn't use it.",
  "",
  "• Users pick chains, manage gas, bridge assets, remember seed phrases",
  "• P2P payments, tipping, and group splits are clunky in Web3",
  "• 900M+ Telegram users — no native cross-chain payment layer",
  "",
  "Opportunity: Make chain abstraction feel like Venmo.",
]);

sectionSlide("Our Solution", [
  "PayGram — Telegram Mini App for cross-chain money movement",
  "",
  "• One unified balance across all chains (Particle UA)",
  "• Natural language payments — chat is the primary input",
  "• Four product tabs — Chat · Activity · Collect · Me",
  "• Chains invisible — no gas, no bridging UI, no seed phrases",
]);

tableSlide("What We Built", ["Tab", "Features"], [
  ["Chat", "Send, tip, request, split, collect, gift via natural language"],
  ["Activity", "Pending requests, you owe / owed to you, pay now"],
  ["Collect", "Group pots, progress bars, contributions, share links"],
  ["Me", "Tip jar, pay links, gift links, friends, unified balance"],
]);

sectionSlide(
  "Chat → Transaction Flow",
  [
    '"send $25 to @alice for lunch"',
    "  ↓ Intent parser (heuristic + Zod)",
    "  ↓ Confirmation card in chat",
    "  ↓ Magic sign + EIP-7702 delegate",
    "  ↓ Particle UA createTransferTransaction",
    "  ↓ Receipt + Activity history",
  ],
  "User signs once. UA routes across chains automatically."
);

tableSlide("Cross-Chain Architecture", ["Layer", "Role"], [
  ["Particle Universal Accounts", "Unified balance across EVM + Solana"],
  ["EIP-7702", "EOA upgraded on Arbitrum — same address"],
  ["createTransferTransaction", "Sources any chain → settles Arbitrum USDC"],
  ["Magic", "Embedded wallet — email login, 7702 signing"],
]);

sectionSlide("Tech Stack", [
  "Telegram Mini App (Vite + React)",
  "  ↓ Magic Embedded Wallet",
  "  ↓ Particle Universal Accounts (EIP-7702)",
  "  ↓ Arbitrum execution layer",
  "  ↓ Cross-chain transfer via UA SDK",
  "",
  "Partners: Magic · Particle Network · Arbitrum",
]);

tableSlide("Hackathon Requirements", ["Requirement", "Status"], [
  ["UA SDK in EIP-7702 mode", "✅ useEIP7702: true"],
  ["Embedded wallet", "✅ Magic"],
  ["Partner tech", "✅ Magic + Particle + Arbitrum"],
  ["Cross-chain operation", "✅ createTransferTransaction"],
  ["Functional demo", "✅ Runnable + deployable"],
]);

sectionSlide(
  "Demo Script (2 min)",
  [
    "1. Login → unified balance",
    "2. Chat: send $5 to 0x... → Confirm → receipt",
    "3. Chat: split $60 with @bob @carol → Activity",
    "4. Chat: collect $200 for dinner → Collect tab",
    "5. Me tab → share tip link",
    "6. Activity → pay pending request",
  ],
  "No chain names shown at any step."
);

sectionSlide("Progress", [
  "Completed:",
  "✅ Vite Mini App + four tabs",
  "✅ Magic + Particle UA + EIP-7702",
  "✅ NL parser: send, tip, request, split, collect, gift",
  "✅ Activity inbox, pay links, tip jar, shell bot",
  "",
  "Next:",
  "🔄 Vercel deploy + Telegram BotFather",
  "🔄 Live funded cross-chain demo",
  "🔄 User registry API",
]);

tableSlide("Judging Alignment", ["Criterion", "PayGram strength"], [
  ["UX & Design (45%)", "Venmo-familiar, Telegram-native, zero jargon"],
  ["Technical (25%)", "EIP-7702 + UA SDK, Zod intents, delegation"],
  ["Creativity (20%)", "Chat→tx + split + collect + pay links"],
  ["Completeness (10%)", "End-to-end payment flows"],
]);

tableSlide("Roadmap", ["Phase", "Deliverable"], [
  ["Now", "GitHub published, checkpoint submitted"],
  ["Week 2", "Vercel deploy, Telegram live, funded wallet"],
  ["Week 3", "User registry API, polish UI, demo video"],
  ["Final", "Judge-ready walkthrough + live Telegram demo"],
]);

titleSlide(
  "Thank You",
  "Cross-chain payments. Telegram native. Chains gone.",
  "github.com/AshThunder/paygram\n@AshThunder · UXmaxx 2026\nQuestions?"
);

await pptx.writeFile({ fileName: outPath });
console.log(`Created: ${outPath}`);
