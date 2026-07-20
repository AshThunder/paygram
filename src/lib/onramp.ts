/** Fiat → crypto on-ramp landing on the user's deposit address (prefer Arbitrum USDC). */
export function getOnrampUrl(walletAddress: string): string {
  const custom = import.meta.env.VITE_ONRAMP_URL?.trim();
  if (custom) {
    return custom
      .replace('{address}', encodeURIComponent(walletAddress))
      .replace('{ADDRESS}', encodeURIComponent(walletAddress));
  }
  const params = new URLSearchParams({
    defaultCurrencyCode: 'usdc',
    walletAddress,
    currencyCode: 'usdc_arbitrum',
  });
  return `https://buy.moonpay.com/?${params.toString()}`;
}
