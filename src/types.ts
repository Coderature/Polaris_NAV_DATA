export type MarketCode = 'US' | 'KR';

export interface RawDocument {
  source: 'dart' | 'naver' | 'pdf' | string;
  title: string;
  date: string;
  url: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskExtraction {
  source: string;
  sourceUrl: string;
  company: string;
  ticker?: string;
  sector?: string;
  riskType: string;
  riskSeverity: RiskSeverity;
  summary: string;
  keywords: string[];
  upstream: string[];
  downstream: string[];
  asOf: string;
}

/** Sprint 2+ provider wiring; Sprint 1 stays on `mock`. */
export type DataSourceType = 'live' | 'delayed' | 'cached' | 'mock';

export interface SectorDef {
  id: string;
  name: string;
  ko: string;
  color: string;
}

export interface StockRow {
  t: string;
  n: string;
  m: MarketCode;
  s: string;
  /** Market cap in billions USD */
  cap: number;
  per: number | null;
  pbr: number | null;
  /** Volume in millions */
  vol: number;
  div: number;
  halted?: boolean;
  /** Runtime: daily change % */
  chg?: number;
  /** Runtime: simulated price */
  price?: number;
  /** Data honesty layer — optional until real feeds land */
  source?: DataSourceType;
  sourceLabel?: string;
  /** ISO snapshot time for this row (defaults to dataset `generated_at`) */
  asOf?: string;
}

export interface TreemapDataFile {
  schema_version: string;
  /** ISO timestamp of the market snapshot in this file (chg / price). */
  generated_at: string;
  sectors: SectorDef[];
  /** Static fields + optional same-day `chg` (%) and `price` loaded on entry. */
  stocks: (Omit<StockRow, 'chg' | 'price'> & Partial<Pick<StockRow, 'chg' | 'price'>>)[];
}

export function dataSourceDetailLabel(source?: DataSourceType): string {
  switch (source) {
    case 'live':
      return '실시간 데이터';
    case 'delayed':
      return '지연 데이터';
    case 'cached':
      return '캐시 데이터';
    case 'mock':
    default:
      return '데모 데이터';
  }
}

/** Status bar baseline phrase */
export function dataSnapshotBaselineLabel(source?: DataSourceType): string {
  switch (source) {
    case 'live':
      return '실시간 데이터 기준';
    case 'delayed':
      return '지연 데이터 기준';
    case 'cached':
      return '캐시 데이터 기준';
    case 'mock':
    default:
      return '데모 스냅샷 기준';
  }
}
