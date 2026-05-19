import Groq from 'groq-sdk';
import type { RawDocument, RiskExtraction } from '../types.js';
import { buildRiskExtractionPrompt } from './promptTemplates.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is required in environment variables');
}

const client = new Groq({ apiKey: GROQ_API_KEY });

function safeParseJson(value: string): unknown {
  try {
    const trimmed = value.trim().replaceAll('\n', ' ').replaceAll('```json', '').replaceAll('```', '').trim();
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function normalizeExtraction(item: any): RiskExtraction | null {
  if (!item || typeof item !== 'object') return null;
  if (!item.company || !item.riskType || !item.summary) return null;

  return {
    source: item.source ?? 'unknown',
    sourceUrl: item.sourceUrl ?? item.url ?? 'unknown',
    company: String(item.company),
    ticker: item.ticker ? String(item.ticker) : undefined,
    sector: item.sector ? String(item.sector) : undefined,
    riskType: String(item.riskType),
    riskSeverity: ['low', 'medium', 'high'].includes(String(item.riskSeverity))
      ? (String(item.riskSeverity) as 'low' | 'medium' | 'high')
      : 'medium',
    summary: String(item.summary),
    keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
    upstream: Array.isArray(item.upstream) ? item.upstream.map(String) : [],
    downstream: Array.isArray(item.downstream) ? item.downstream.map(String) : [],
    asOf: item.asOf ? String(item.asOf) : new Date().toISOString().slice(0, 10),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function extractFinancialRisks(docs: RawDocument[]): Promise<RiskExtraction[]> {
  const results: RiskExtraction[] = [];
  for (const doc of docs) {
    const prompt = buildRiskExtractionPrompt(doc);
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 900,
    });

    const text = response.choices[0]?.message?.content ?? '';
    const parsed = safeParseJson(text);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const normalized = normalizeExtraction(item);
        if (normalized) results.push(normalized);
      }
    } else {
      const normalized = normalizeExtraction(parsed);
      if (normalized) results.push(normalized);
    }

    await sleep(2000);
  }
  return results;
}
