// Supported wholesale currencies
export type SupportedCurrency = 'USD' | 'EUR' | 'GBP';

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['USD', 'EUR', 'GBP'];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// ── Exchange rates (Frankfurter API, ECB-sourced, free, no key needed) ────────

type RateCache = { rates: Record<string, number>; fetchedAt: number };
let rateCache: RateCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchRates(): Promise<Record<string, number>> {
  const res = await fetch('https://api.frankfurter.app/latest?base=USD&symbols=EUR,GBP', {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
  const data = await res.json() as { rates: Record<string, number> };
  return { USD: 1, ...data.rates };
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (rateCache && now - rateCache.fetchedAt < CACHE_TTL_MS) {
    return rateCache.rates;
  }
  // Fallback rates used if the API is unreachable (updated periodically)
  const fallback: Record<string, number> = { USD: 1, EUR: 0.92, GBP: 0.79 };
  try {
    const rates = await fetchRates();
    rateCache = { rates, fetchedAt: now };
    return rates;
  } catch {
    return rateCache?.rates ?? fallback;
  }
}

/**
 * Convert an amount to USD for internal reconciliation / analytics.
 */
export async function convertToUsd(amount: number, fromCurrency: SupportedCurrency): Promise<number> {
  if (fromCurrency === 'USD') return amount;
  const rates = await getExchangeRates();
  const rate = rates[fromCurrency];
  if (!rate) return amount;
  return amount / rate;
}

/**
 * Convert a USD amount to a target currency.
 */
export async function convertFromUsd(usdAmount: number, toCurrency: SupportedCurrency): Promise<number> {
  if (toCurrency === 'USD') return usdAmount;
  const rates = await getExchangeRates();
  const rate = rates[toCurrency];
  if (!rate) return usdAmount;
  return usdAmount * rate;
}

/**
 * Format a monetary amount for display.
 * e.g. formatCurrency(1250, 'EUR') → '€1,250.00'
 */
export function formatCurrency(amount: number, currency: string): string {
  const code = (currency ?? 'USD').toUpperCase() as SupportedCurrency;
  return new Intl.NumberFormat('en-US', {
    style                : 'currency',
    currency             : code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Convert a currency amount to Stripe cents (all supported currencies are 2-decimal).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Stripe-compatible lowercase currency code.
 */
export function stripeCode(currency: string): string {
  return (currency ?? 'USD').toLowerCase();
}
