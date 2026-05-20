import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fetchDartReports } from './crawl/dartCrawler.js';
import { fetchNaverFinanceNews } from './crawl/naverNewsCrawler.js';
import { extractPdfDocuments } from './crawl/pdfExtract.js';
import { fetchKrStocks } from './crawl/krStockCrawler.js';
import { extractFinancialRisks } from './llm/extractor.js';
import type { PipelineOutput, RawDocument, SectorDef, StockRow } from './types.js';

const KR_COMPANIES = ['삼성전자', 'SK하이닉스', '현대자동차', 'NAVER', '카카오'];

async function loadExistingTreemapData() {
  const sourcePath = path.resolve('public', 'treemap_data.json');
  if (!fs.existsSync(sourcePath)) return null;
  try {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    return JSON.parse(raw) as { sectors?: SectorDef[]; stocks?: StockRow[]; generated_at?: string };
  } catch {
    return null;
  }
}

async function main() {
  console.log('1/5 DART 공시 크롤링 시작...');
  const dartDocs: RawDocument[] = [];
  for (const company of KR_COMPANIES) {
    const docs = await fetchDartReports(company, 1, 3);
    dartDocs.push(...docs);
    console.log(`  ✓ ${company}: ${docs.length}건`);
  }

  console.log('2/5 네이버 금융 뉴스 크롤링 시작...');
  const newsDocs = await fetchNaverFinanceNews('코스피 주식', 6);
  console.log(`  ✓ ${newsDocs.length}건`);

  console.log('3/5 PDF 자료 추출 시작...');
  const pdfDocs = await extractPdfDocuments([]);

  console.log('4/5 KR 실시간 주가 수집 시작...');
  const krStocks = await fetchKrStocks();
  console.log(`  ✓ ${krStocks.length}개 종목 시세 수집`);

  const documents = [...dartDocs, ...newsDocs, ...pdfDocs];
  console.log(`총 ${documents.length}건 문서 확보`);

  console.log('5/5 LLM 기반 리스크 추출 수행...');
  const extractedRisks = await extractFinancialRisks(documents.slice(0, 8));

  const existing = await loadExistingTreemapData();

  // KR 실시간 시세를 기존 stocks에 병합
  const baseStocks: StockRow[] = existing?.stocks ?? [];
  const krTickerSet = new Set(krStocks.map((s) => s.t));
  const mergedStocks: StockRow[] = [
    ...baseStocks.filter((s) => !krTickerSet.has(s.t)),
    ...krStocks,
  ];

  const output: PipelineOutput = {
    generatedAt: new Date().toISOString(),
    sectors: existing?.sectors,
    stocks: mergedStocks,
    documents,
    extractedRisks,
  };

  const outPath = path.resolve('public', 'polaris_nav_data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ 완료: ${outPath}`);
  console.log(`   종목 ${mergedStocks.length}개 (KR ${krStocks.length}개 실시간) · 문서 ${documents.length}건 · 리스크 ${extractedRisks.length}건`);
}

main().catch((err) => {
  console.error('파이프라인 오류:', err);
  process.exit(1);
});
