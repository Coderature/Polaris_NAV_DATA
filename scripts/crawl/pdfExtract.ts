import axios from 'axios';
import pdfParse from 'pdf-parse';
import type { RawDocument } from '../types.js';

async function downloadPdfBuffer(url: string): Promise<Buffer> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  return Buffer.from(response.data);
}

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  return parsed.text.replace(/\s+/g, ' ').trim();
}

export async function extractPdfDocuments(urls: string[]): Promise<RawDocument[]> {
  const docs: RawDocument[] = [];
  for (const url of urls) {
    try {
      const buffer = await downloadPdfBuffer(url);
      const text = await extractTextFromPdfBuffer(buffer);
      docs.push({
        source: 'pdf',
        title: `PDF 문서: ${url}`,
        date: new Date().toISOString().slice(0, 10),
        url,
        text: text || `PDF 텍스트를 추출하지 못했습니다: ${url}`,
      });
    } catch (error) {
      docs.push({
        source: 'pdf',
        title: `PDF 다운로드 실패: ${url}`,
        date: new Date().toISOString().slice(0, 10),
        url,
        text: `PDF 다운로드 또는 파싱 실패: ${String(error)}`,
      });
    }
  }
  return docs;
}

if (import.meta.main) {
  (async () => {
    const docs = await extractPdfDocuments([
      'https://example.com/sample-report.pdf',
    ]);
    console.log(JSON.stringify(docs, null, 2));
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
