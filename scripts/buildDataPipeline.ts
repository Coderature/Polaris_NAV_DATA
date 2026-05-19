import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fetchDartReports } from './crawl/dartCrawler.js';
import { fetchNaverFinanceNews } from './crawl/naverNewsCrawler.js';
import { extractPdfDocuments } from './crawl/pdfExtract.js';
import { extractFinancialRisks } from './llm/extractor.js';
import type { PipelineOutput, SectorDef, StockRow } from './types.js';

async function loadExistingTreemapData() {
  const sourcePath = path.resolve('public', 'treemap_data.json');
  if (!fs.existsSync(sourcePath)) return null;
  try {
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const parsed = JSON.parse(raw) as { sectors?: SectorDef[]; stocks?: StockRow[]; generated_at?: string };
    return parsed;
  } catch (error) {
    console.warn('기존 treemap_data.json을 읽는 중 오류가 발생했습니다.', error);
    return null;
  }
}

async function main() {
  console.log('1/4 DART 공시 크롤링 시작...');
  const dartDocs = await fetchDartReports('삼성전자', 1, 8);

  console.log('2/4 네이버 금융 뉴스 크롤링 시작...');
  const newsDocs = await fetchNaverFinanceNews('반도체', 8);

  console.log('3/4 PDF 자료 추출 시작...');
  const pdfDocs = await extractPdfDocuments([
    // 여기에는 실제 PDF URL을 추가하세요.
    'https://example.com/sample-report.pdf',
  ]);

  const documents = [...dartDocs, ...newsDocs, ...pdfDocs];
  console.log(`총 ${documents.length}건 문서를 확보했습니다.`);

  console.log('4/4 LLM 기반 리스크 추출 수행...');
  const extractedRisks = await extractFinancialRisks(documents.slice(0, 8));

  const existing = await loadExistingTreemapData();
  const output: PipelineOutput = {
    generatedAt: existing?.generated_at ?? new Date().toISOString(),
    sectors: existing?.sectors,
    stocks: existing?.stocks,
    documents,
    extractedRisks,
  };

  const outPath = path.resolve('public', 'polaris_nav_data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`성공: ${outPath}에 크롤링 결과를 저장했습니다.`);
}

main().catch((error) => {
  console.error('데이터 파이프라인 실행 중 오류가 발생했습니다:', error);
  process.exit(1);
});
