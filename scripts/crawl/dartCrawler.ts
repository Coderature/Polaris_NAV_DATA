import axios from 'axios';
import type { RawDocument } from '../types.js';

const DART_API_KEY = process.env.DART_API_KEY?.trim();
if (!DART_API_KEY) throw new Error('DART_API_KEY is required in environment variables');

const DART_LIST_URL = 'https://opendart.fss.or.kr/api/list.json';

// DART 고유번호 (corp_code) — 종목 코드(stock_code)와 다름
const KR_CORP_CODES: Record<string, string> = {
  삼성전자:       '00126380',
  'SK하이닉스':  '00164779',
  현대자동차:     '00164742',
  NAVER:         '00768461',
  카카오:         '00918444',
  삼성바이오로직스: '00877059',
  셀트리온:       '00421045',
  KB금융:        '00399449',
};

interface DartListItem {
  corp_name: string;
  report_nm: string;
  rcept_no: string;
  rcept_dt: string;
  stock_code?: string;
}

function dateStr(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86400_000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function fetchDartReportList(corpCode: string, pageCount = 5): Promise<DartListItem[]> {
  const params = new URLSearchParams({
    crtfc_key: DART_API_KEY!,
    corp_code:  corpCode,
    bgn_de:     dateStr(60),
    end_de:     dateStr(0),
    page_no:    '1',
    page_count: String(pageCount),
  });

  const response = await axios.get(DART_LIST_URL, { params, timeout: 20_000 });
  const status = response.data?.status;
  if (!['000', '013'].includes(status)) {
    throw new Error(`DART API 오류 (status=${status}): ${JSON.stringify(response.data)}`);
  }
  if (status === '013' || !Array.isArray(response.data?.list)) return [];
  return response.data.list as DartListItem[];
}

function buildDartUrl(rceptNo: string) {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(rceptNo)}`;
}

function makeRawDoc(item: DartListItem): RawDocument {
  return {
    source: 'dart',
    title: `${item.corp_name} · ${item.report_nm}`,
    date: item.rcept_dt,
    url: buildDartUrl(item.rcept_no),
    text: `${item.corp_name}의 공시 제목은 ${item.report_nm}이며, 접수일은 ${item.rcept_dt}입니다. 공시 원문: ${buildDartUrl(item.rcept_no)}`,
    metadata: {
      corpName:   item.corp_name,
      receiptNo:  item.rcept_no,
      stockCode:  item.stock_code,
    },
  };
}

export async function fetchDartReports(companyName: string, _page = 1, pageCount = 5): Promise<RawDocument[]> {
  const corpCode = KR_CORP_CODES[companyName];
  if (!corpCode) {
    console.warn(`  DART: '${companyName}' 고유번호 없음 — 건너뜀`);
    return [];
  }
  const items = await fetchDartReportList(corpCode, pageCount);
  return items.map(makeRawDoc);
}

if (import.meta.main) {
  (async () => {
    const docs = await fetchDartReports('삼성전자', 1, 5);
    console.log(JSON.stringify(docs, null, 2));
  })().catch((err) => { console.error(err); process.exit(1); });
}
