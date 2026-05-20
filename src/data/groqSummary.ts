import type { RawDocument, RiskExtraction } from '../types';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

export async function generateStockSummary(params: {
  name: string;
  sector: string;
  market: string;
  cap: string;
  chg: number;
  per: number | null;
  pbr: number | null;
  div: number;
  vol: number;
  risks: RiskExtraction[];
  documents: RawDocument[];
  sectorPeers: Array<{ name: string; cap: number; chg: number }>;
}): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY가 설정되지 않았습니다.');

  const { name, sector, market, cap, chg, per, pbr, div, vol, risks, documents, sectorPeers } = params;

  // 관련 리스크 블록
  const riskBlock = risks.length > 0
    ? risks.slice(0, 4).map((r) => {
        const chain = [
          r.upstream.length ? `상류(upstream): ${r.upstream.join(', ')}` : '',
          r.downstream.length ? `하류(downstream): ${r.downstream.join(', ')}` : '',
        ].filter(Boolean).join(' / ');
        return `• [${r.riskSeverity.toUpperCase()}] ${r.riskType} — ${r.summary}${chain ? `\n  공급망: ${chain}` : ''}`;
      }).join('\n')
    : '• 수집된 리스크 신호 없음';

  // DART 정기공시 루틴 제목 패턴 — 이슈가 아니므로 뉴스 블록에서 제외
  const ROUTINE_DART_PATTERNS = [
    '소유 상황 보고서', '소유상황보고서', '분기보고서', '반기보고서', '사업보고서',
    '자기주식 처분', '자기주식 취득', '주식등의대량보유상황보고서',
    '임원·주요주주 특정증권', '임원 및 주요주주', '정기주주총회',
    '증권발행실적보고서', '기업설명회', 'IR 개최',
  ];
  const isRoutineDart = (d: RawDocument) =>
    d.source === 'dart' && ROUTINE_DART_PATTERNS.some((p) => d.title.includes(p));

  // 뉴스 블록: naver 기사 + 비루틴 dart 공시 (이슈성 공시만)
  const newsDocs = documents.filter((d) => d.source !== 'dart' || !isRoutineDart(d));
  const newsBlock = newsDocs.length > 0
    ? newsDocs.slice(0, 4).map((d) =>
        `[${d.source.toUpperCase()} · ${d.date}] ${d.title}\n  ${d.text.slice(0, 200).replace(/\s+/g, ' ')}…`
      ).join('\n')
    : '• 수집된 뉴스 없음';

  // 동일 섹터 비교 블록
  const peerBlock = sectorPeers.length > 0
    ? sectorPeers.map((p) =>
        `• ${p.name}: 시총 $${p.cap}B, 등락 ${p.chg >= 0 ? '+' : ''}${p.chg.toFixed(2)}%`
      ).join('\n')
    : '• 비교 대상 없음';

  const prompt = `당신은 베테랑 주식 애널리스트입니다. 아래 데이터를 바탕으로 투자자가 스스로 판단을 내릴 수 있도록 구조화된 분석을 한국어로 작성하세요.

[분석 대상]
기업명: ${name} (${market})
섹터: ${sector}
시가총액: ${cap} / 거래량: ${vol.toFixed(1)}M
오늘 등락: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%
PER: ${per ?? '정보없음'} / PBR: ${pbr ?? '정보없음'} / 배당수익률: ${div.toFixed(2)}%

[최근 리스크 신호 (LLM 추출)]
${riskBlock}

[최근 뉴스·공시 원문 발췌]
${newsBlock}

[동일 섹터 경쟁사 현황]
${peerBlock}

[출력 형식 — 반드시 아래 4개 섹션을 순서대로 작성하세요]

**회사 개요**
이 회사가 어떤 사업을 하고, 주요 수익원과 경쟁 우위가 무엇인지 2문장 이내로 설명하세요.

**최근 핵심 이슈**
뉴스·공시·리스크 신호에서 포착된 최근 주요 이슈 2~3가지를 핵심만 간결하게 나열하세요. 없으면 "특이 이슈 없음"으로 표기하세요.

**종합 평가**
밸류에이션 수치, 섹터 내 상대 위치, 최근 이슈를 종합하여 현재 이 기업의 상태를 2~3문장으로 평가하세요. 근거 없는 낙관·비관은 금지입니다.

**투자 전략 고려사항**
매수/매도 추천 없이, 투자자가 스스로 판단하기 위해 반드시 확인해야 할 핵심 변수(기회 요인·위험 요인 각 1~2개)와 모니터링 포인트를 제시하세요.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 900,
    }),
  });

  if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content?.trim() ?? '';
}
