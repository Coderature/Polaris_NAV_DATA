import type { MarketCode, SectorDef, StockRow, TreemapDataFile } from '../types';
import { fetchAll } from './finnhubClient';

/** Deterministic demo % change per ticker (fallback when JSON has no `chg`). */
function tickerDailyChg(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  const u = (Math.abs(h) % 10000) / 10000;
  return +((u * 7.5 - 3.25)).toFixed(2);
}

function tickerDemoPrice(t: string, m: MarketCode): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  const base = 30 + (Math.abs(h) % 970);
  return m === 'KR' ? +(base * 1.2).toFixed(0) : +base.toFixed(2);
}

/** Apply daily change % and price from JSON snapshot, or stable per-ticker fallbacks. */
export function applyMarketSnapshot(stocks: StockRow[]): void {
  for (const st of stocks) {
    if (st.halted) {
      st.chg = 0;
      st.price = 0;
      continue;
    }
    if (st.chg == null) st.chg = tickerDailyChg(st.t);
    if (st.price == null) st.price = tickerDemoPrice(st.t, st.m);
  }
}

/** @deprecated Use applyMarketSnapshot — kept for tests/tools that need a full re-roll. */
export function seedReturns(stocks: StockRow[], seed = 42): void {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (const st of stocks) {
    if (st.halted) {
      st.chg = 0;
      st.price = 0;
      continue;
    }
    const r = (rand() - 0.45) * 0.08;
    st.chg = +(r * 100).toFixed(2);
    st.price = +(50 + rand() * 950).toFixed(2);
  }
}

function mergeFinnhubQuotes(stocks: StockRow[], quotes: Awaited<ReturnType<typeof fetchAll>>): void {
  const byTicker = new Map(quotes.map((q) => [q.symbol, q]));
  for (const st of stocks) {
    const quote = byTicker.get(st.t);
    if (!quote) continue;

    st.price = quote.price;
    st.chg = quote.changePercent;
    st.source = quote.source === 'live' ? 'live' : 'mock';
    st.sourceLabel = quote.label;
    st.asOf = quote.fetchedAt.toISOString();
  }
}

export interface RiskExtraction {
  source: string;
  sourceUrl: string;
  company: string;
  ticker?: string;
  riskType: string;
  riskSeverity: 'low' | 'medium' | 'high';
  summary: string;
  keywords: string[];
  upstream: string[];
  downstream: string[];
  asOf: string;
}

export interface RawDocument {
  source: string;
  title: string;
  date: string;
  url: string;
  text: string;
  metadata?: Record<string, unknown>;
}

interface PolarisNavDataFile extends TreemapDataFile {
  generatedAt?: string;
  documents?: RawDocument[];
  extractedRisks?: RiskExtraction[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`시장 데이터를 불러오지 못했습니다 (${url} ${res.status})`);
  return (await res.json()) as T;
}

async function loadPipelineData(): Promise<PolarisNavDataFile | null> {
  try {
    return await fetchJson<PolarisNavDataFile>('/polaris_nav_data.json');
  } catch {
    return null;
  }
}

async function loadTreemapFile(): Promise<TreemapDataFile> {
  return await fetchJson<TreemapDataFile>('/treemap_data.json');
}

export async function loadTreemapData(): Promise<{
  sectors: SectorDef[];
  stocks: StockRow[];
  generatedAt: string;
  extractedRisks: RiskExtraction[];
  documents: RawDocument[];
}> {
  const pipelineData = await loadPipelineData();
  const data = pipelineData && pipelineData.sectors && pipelineData.stocks
    ? (pipelineData as TreemapDataFile)
    : await loadTreemapFile();

  const stocks: StockRow[] = data.stocks.map((row) => ({ ...row }));
  applyMarketSnapshot(stocks);

  const quotes = await fetchAll();
  mergeFinnhubQuotes(stocks, quotes);

  const snap = 'generated_at' in data ? data.generated_at : pipelineData?.generatedAt ?? new Date().toISOString();
  for (const st of stocks) {
    if (st.source == null) st.source = 'mock';
    if (st.sourceLabel == null) st.sourceLabel = '데모 스냅샷 기준';
    if (st.asOf == null) st.asOf = snap;
  }

  const latestFetch = quotes.reduce((max, q) => Math.max(max, q.fetchedAt.getTime()), 0);
  const generatedAt = latestFetch > 0 ? new Date(latestFetch).toISOString() : snap;

  return {
    sectors: data.sectors,
    stocks,
    generatedAt,
    extractedRisks: pipelineData?.extractedRisks ?? [],
    documents: pipelineData?.documents ?? [],
  };
}
