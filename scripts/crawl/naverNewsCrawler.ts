import axios from 'axios';
import type { RawDocument } from '../types.js';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
  throw new Error('NAVER_CLIENT_ID and NAVER_CLIENT_SECRET are required in environment variables');
}

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function parsePubDate(pubDate: string): string {
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export async function fetchNaverFinanceNews(query: string, limit = 6): Promise<RawDocument[]> {
  const response = await axios.get<{ items: NaverNewsItem[] }>(
    'https://openapi.naver.com/v1/search/news.json',
    {
      params: { query, display: limit, sort: 'date' },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      timeout: 15_000,
    }
  );

  return response.data.items.map((item): RawDocument => ({
    source: 'naver',
    title: stripHtmlTags(item.title),
    date: parsePubDate(item.pubDate),
    url: item.originallink || item.link,
    text: stripHtmlTags(item.description),
    metadata: { query },
  }));
}

if (import.meta.main) {
  (async () => {
    const docs = await fetchNaverFinanceNews('반도체', 4);
    console.log(JSON.stringify(docs, null, 2));
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
