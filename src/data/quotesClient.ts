import type { StockRow } from '../types';

const REFRESH_INTERVAL = 5 * 60 * 1000;

interface QuoteRow {
  t: string; n: string; s: string; m: string;
  price: number; chg: number;
  cap: number; per: number | null; pbr: number | null;
  div: number; vol: number;
  source: string; sourceLabel: string; asOf: string;
}

interface QuotesResponse {
  quotes: QuoteRow[];
  fetchedAt: string;
  cached: boolean;
}

async function fetchQuotes(): Promise<QuoteRow[]> {
  const res = await fetch('/api/quotes', { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`quotes API ${res.status}`);
  const data = await res.json() as QuotesResponse;
  return data.quotes;
}

function applyQuotes(stocks: StockRow[], quotes: QuoteRow[]): void {
  const byTicker = new Map(quotes.map((q) => [q.t, q]));
  for (const st of stocks) {
    const q = byTicker.get(st.t);
    if (!q) continue;
    st.price       = q.price;
    st.chg         = q.chg;
    st.cap         = q.cap;
    st.per         = q.per;
    st.pbr         = q.pbr;
    st.div         = q.div;
    st.vol         = q.vol;
    st.source      = 'live';
    st.sourceLabel = q.sourceLabel;
    st.asOf        = q.asOf;
  }
}

export function initQuotesClient(
  stocks: StockRow[],
  onRefresh: (updatedAt: string) => void,
): () => Promise<void> {
  const apply = async () => {
    try {
      const quotes = await fetchQuotes();
      applyQuotes(stocks, quotes);
      onRefresh(new Date().toISOString());
    } catch (err) {
      console.warn('[quotes] 갱신 실패:', err instanceof Error ? err.message : err);
    }
  };

  apply();
  setInterval(apply, REFRESH_INTERVAL);
  return apply;
}
