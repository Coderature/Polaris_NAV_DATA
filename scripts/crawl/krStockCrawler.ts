import YahooFinance from 'yahoo-finance2';
import type { StockRow } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)();

const KR_STOCK_DEFS = [
  { t: '005930', n: '삼성전자', s: 'IT' },
  { t: '000660', n: 'SK하이닉스', s: 'IT' },
  { t: '005380', n: '현대자동차', s: 'CONS_DISC' },
  { t: '035420', n: 'NAVER', s: 'COMMS' },
  { t: '035720', n: '카카오', s: 'COMMS' },
  { t: '207940', n: '삼성바이오로직스', s: 'HEALTH' },
  { t: '068270', n: '셀트리온', s: 'HEALTH' },
  { t: '105560', n: 'KB금융', s: 'FINANCIALS' },
];

const KRW_PER_USD = 1300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchKrStocks(): Promise<StockRow[]> {
  const results: StockRow[] = [];
  for (const def of KR_STOCK_DEFS) {
    try {
      const q = await yf.quote(`${def.t}.KS`);
      results.push({
        t: def.t,
        n: def.n,
        m: 'KR',
        s: def.s,
        cap: +((q.marketCap ?? 0) / KRW_PER_USD / 1e9).toFixed(1),
        per: q.trailingPE != null ? +q.trailingPE.toFixed(1) : null,
        pbr: q.priceToBook != null ? +q.priceToBook.toFixed(2) : null,
        vol: +((q.regularMarketVolume ?? 0) / 1e6).toFixed(1),
        div: +((q.trailingAnnualDividendYield ?? 0) * 100).toFixed(2),
        price: +((q.regularMarketPrice ?? 0) / KRW_PER_USD).toFixed(2),
        chg: +((q.regularMarketChangePercent ?? 0)).toFixed(2),
        source: 'live',
        sourceLabel: 'Yahoo Finance 실시간',
        asOf: new Date().toISOString(),
      });
      console.log(`  ✓ ${def.n} (${def.t}): ₩${q.regularMarketPrice?.toLocaleString()}`);
    } catch (err) {
      console.warn(`  ✗ ${def.n} (${def.t}) 실패:`, err instanceof Error ? err.message : err);
    }
    await sleep(300);
  }
  return results;
}

if (import.meta.main) {
  (async () => {
    const stocks = await fetchKrStocks();
    console.log(JSON.stringify(stocks, null, 2));
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
