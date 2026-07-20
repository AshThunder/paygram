#!/usr/bin/env ts-node
/**
 * Prints VITE_* lines from deployments/arbitrum.json for the app .env
 * Usage: npx ts-node scripts/printAppEnv.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const file = path.join(__dirname, '..', 'deployments', 'arbitrum.json');
if (!fs.existsSync(file)) {
  console.error('Missing deployments/arbitrum.json — run: npm run deploy:arb');
  process.exit(1);
}

const d = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;

const lines = [
  '# Paste into repo-root .env after Arbitrum One deploy',
  'VITE_PAYGRAM_NETWORK=arbitrum',
  `VITE_USDC_ADDRESS=${d.usdc}`,
  `VITE_POT=${d.PayGramPot}`,
  `VITE_BILL_ESCROW=${d.PayGramBillEscrow}`,
  `VITE_ROSCA=${d.PayGramRosca}`,
  `VITE_TAB=${d.PayGramTab}`,
  `VITE_ALLOWANCE=${d.PayGramAllowance}`,
];

console.log(lines.join('\n'));
