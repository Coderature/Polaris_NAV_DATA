import axios from 'axios';
import type { RawDocument } from '../types.js';

const DART_API_KEY = process.env.DART_API_KEY;
if (!DART_API_KEY) {
  throw new Error('DART_API_KEY is required in environment variables');
}

const DART_LIST_URL = 'https://opendart.fss.or.kr/api/list.json';

interface DartListItem {
  corp_name: string;
  report_nm: string;
  rcept_no: string;
  rcept_dt: string;
  stock_code?: string;
}

async function fetchDartReportList(page = 1, pageCount = 20, query = ''): Promise<DartListItem[]> {
  const params = new URLSearchParams({
    crtfc_key: DART_API_KEY,
    page_count: String(pageCount),
    page_no: String(page),
    bsn_tp: 'A',
    pblntf_ty: 'A',
    corp_name: query,
  });

  const response = await axios.get(DART_LIST_URL, { params, timeout: 20_000 });
  const status = response.data?.status;
  // '000' = 정상, '013' = 조회 결과 없음 (둘 다 정상 응답)
  if (!['000', '013'].includes(status)) {
    throw new Error(`DART API 오류 (status=${status}): ${JSON.stringify(response.data)}`);
  }
  if (status === '013' || !Array.isArray(response.data?.list)) {
    return [];
  }

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
    text: `${item.corp_name}의 공시 제목은 ${item.report_nm}이며, 접수일은 ${item.rcept_dt} 입니다. 공시 원문은 ${buildDartUrl(item.rcept_no)}에서 확인할 수 있습니다.`,
    metadata: {
      corpName: item.corp_name,
      receiptNo: item.rcept_no,
      stockCode: item.stock_code,
    },
  };
}

export async function fetchDartReports(query = '', page = 1, pageCount = 10): Promise<RawDocument[]> {
  const items = await fetchDartReportList(page, pageCount, query);
  return items.map(makeRawDoc);
}

if (import.meta.main) {
  (async () => {
    const docs = await fetchDartReports('삼성전자', 1, 8);
    console.log(JSON.stringify(docs, null, 2));
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
