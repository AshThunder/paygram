import type { IAssetsResponse } from '@particle-network/universal-account-sdk';
import { formatUsd } from './constants';
import { getTokenBreakdown } from './assets';
import { arbUsdcUsd, spendHint } from './uaTransfer';

export type RoutePreview = {
  summary: string;
  sources: string[];
  destination: string;
};

/** User-facing route hint — unified balance first, holdings as detail. */
export function explainPaymentRoute(
  assets: IAssetsResponse | null,
  amountUsd: number,
): RoutePreview {
  const destination = 'your PayGram balance';
  const hint = spendHint(assets, amountUsd);
  const arbUsdc = arbUsdcUsd(assets);

  if (arbUsdc >= amountUsd - 0.01) {
    return {
      summary: hint ?? 'Pays from your balance — ready to go.',
      sources: [],
      destination,
    };
  }

  const tokens = getTokenBreakdown(assets).filter(
    (t) => /USDC|USDT|USD/i.test(t.symbol) && t.amountInUSD >= 0.01,
  );
  const sources = tokens
    .slice(0, 3)
    .map((t) => `${t.symbol} ${formatUsd(t.amountInUSD)}`);

  return {
    summary: hint ?? 'Converting from your balance · leave ~$1 spare for fees.',
    sources,
    destination,
  };
}
