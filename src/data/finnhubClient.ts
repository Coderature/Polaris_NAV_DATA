import { SYMBOLS, type Symbol } from './symbols';

export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface QuoteResult {
  symbol: string;
  price: number;
  changePercent: number;
  source: 'live' | 'mock-snapshot';
  label: string;
  fetchedAt: Date;
}

const MOCK_SNAPSHOT: Record<Symbol, { price: number; changePercent: number }> = {
  AAPL: { price: 189.84, changePercent: 0.42 },
  MSFT: { price: 418.52, changePercent: -0.31 },
  GOOGL: { price: 175.23, changePercent: 0.18 },
  NVDA: { price: 132.65, changePercent: 1.24 },
  TSLA: { price: 248.91, changePercent: -0.87 },
  AMZN: { price: 195.37, changePercent: 0.55 },
};

function mockQuote(symbol: Symbol): QuoteResult {
  const snap = MOCK_SNAPSHOT[symbol];
  return {
    symbol,
    price: snap.price,
    changePercent: snap.changePercent,
    source: 'mock-snapshot',
    label: '데모 스냅샷 기준',
    fetchedAt: new Date(),
  };
}

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_FINNHUB_API_KEY;
  return key?.trim() || undefined;
}

async function fetchLiveQuote(symbol: Symbol): Promise<QuoteResult> {
  const key = getApiKey();
  if (!key) {
    throw new Error('VITE_FINNHUB_API_KEY is not set');
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub quote failed for ${symbol}: ${res.status}`);
  }

  const data = (await res.json()) as FinnhubQuote;
  if (!data.c || data.c <= 0) {
    throw new Error(`Finnhub returned invalid quote for ${symbol}`);
  }

  return {
    symbol,
    price: data.c,
    changePercent: data.dp ?? 0,
    source: 'live',
    label: '실시간',
    fetchedAt: data.t ? new Date(data.t * 1000) : new Date(),
  };
}

export async function fetchAll(): Promise<QuoteResult[]> {
  if (!getApiKey()) {
    return SYMBOLS.map(mockQuote);
  }

  const settled = await Promise.allSettled(SYMBOLS.map((symbol) => fetchLiveQuote(symbol)));
  return settled.map((result, index) =>
    result.status === 'fulfilled' ? result.value : mockQuote(SYMBOLS[index]),
  );
}
