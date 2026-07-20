#!/usr/bin/env node
/**
 * Particle UA SDK 2.0.3 ships dist/index.d.ts but omits "types" from package
 * "exports", which breaks TypeScript under moduleResolution=bundler.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const pkgPath = join(
  process.cwd(),
  'node_modules/@particle-network/universal-account-sdk/package.json',
);
if (!existsSync(pkgPath)) process.exit(0);

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = pkg.exports;
const alreadyFixed =
  current &&
  typeof current === 'object' &&
  current['.']?.types === './dist/index.d.ts' &&
  current['.']?.import === './dist/index.mjs';

if (alreadyFixed) process.exit(0);

pkg.exports = {
  '.': {
    types: './dist/index.d.ts',
    import: './dist/index.mjs',
    require: './dist/index.cjs',
  },
};
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('fixed @particle-network/universal-account-sdk exports.types');
