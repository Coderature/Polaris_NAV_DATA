import type { RawDocument, RiskExtraction, SectorDef, StockRow, TreemapDataFile } from '../types';

function tickerDailyChg(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  const u = (Math.abs(h) % 10000) / 10000;
  return +((u * 7.5 - 3.25)).toFixed(2);
}

function tickerDemoPrice(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  const base = 30 + (Math.abs(h) % 970);
  return +base.toFixed(2);
}

export function applyMarketSnapshot(stocks: StockRow[]): void {
  for (const st of stocks) {
    if (st.halted) { st.chg = 0; st.price = 0; continue; }
    if (st.chg == null)   st.chg   = tickerDailyChg(st.t);
    if (st.price == null) st.price = tickerDemoPrice(st.t);
  }
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
  try { return await fetchJson<PolarisNavDataFile>('/polaris_nav_data.json'); }
  catch { return null; }
}

export async function loadTreemapData(): Promise<{
  sectors: SectorDef[];
  stocks: StockRow[];
  generatedAt: string;
  documents: RawDocument[];
  extractedRisks: RiskExtraction[];
}> {
  const pipelineData = await loadPipelineData();
  const data: TreemapDataFile = (pipelineData?.sectors && pipelineData?.stocks)
    ? pipelineData
    : await fetchJson<TreemapDataFile>('/treemap_data.json');

  const stocks: StockRow[] = data.stocks.map((row) => ({ ...row }));
  applyMarketSnapshot(stocks);

  const snap = 'generated_at' in data
    ? (data as { generated_at: string }).generated_at
    : pipelineData?.generatedAt ?? new Date().toISOString();

  for (const st of stocks) {
    if (st.source == null)      st.source      = 'mock';
    if (st.sourceLabel == null) st.sourceLabel = '데모 스냅샷 기준';
    if (st.asOf == null)        st.asOf        = snap;
  }

  const documents      = pipelineData?.documents      ?? [];
  const extractedRisks = pipelineData?.extractedRisks ?? [];

  return { sectors: data.sectors, stocks, generatedAt: snap, documents, extractedRisks };
}
