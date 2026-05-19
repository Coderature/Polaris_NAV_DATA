export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RawDocument {
  source: 'dart' | 'naver' | 'pdf' | string;
  title: string;
  date: string;
  url: string;
  text: string;
  metadata?: Record<string, unknown>;
}

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

export interface SectorDef {
  id: string;
  name: string;
  ko: string;
  color: string;
}

export interface StockRow {
  t: string;
  n: string;
  m: 'US' | 'KR';
  s: string;
  cap: number;
  per: number | null;
  pbr: number | null;
  vol: number;
  div: number;
  halted?: boolean;
  chg?: number;
  price?: number;
  source?: string;
  sourceLabel?: string;
  asOf?: string;
}

export interface PipelineOutput {
  generatedAt: string;
  sectors?: SectorDef[];
  stocks?: StockRow[];
  documents: RawDocument[];
  extractedRisks: RiskExtraction[];
}
