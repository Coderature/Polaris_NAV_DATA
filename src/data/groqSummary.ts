import type { RawDocument, RiskExtraction } from './loadTreemapData';

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

  // 관련 뉴스·공시 블록 (본문 앞 200자)
  const docBlock = documents.length > 0
    ? documents.slice(0, 4).map((d) =>
        `[${d.source.toUpperCase()} · ${d.date}] ${d.title}\n  ${d.text.slice(0, 200).replace(/\s+/g, ' ')}…`
      ).join('\n')
    : '• 수집된 문서 없음';

  // 동일 섹터 비교 블록
  const peerBlock = sectorPeers.length > 0
    ? sectorPeers.map((p) =>
        `• ${p.name}: 시총 $${p.cap}B, 등락 ${p.chg >= 0 ? '+' : ''}${p.chg.toFixed(2)}%`
      ).join('\n')
    : '• 비교 대상 없음';

  const prompt = `당신은 베테랑 한국 주식 애널리스트입니다. 아래 제공된 데이터를 종합적으로 분석하여 투자자에게 실질적으로 도움이 되는 인사이트를 한국어로 제공하세요.

[분석 대상]
기업명: ${name} (${market})
섹터: ${sector}
시가총액: ${cap} / 거래량: ${vol.toFixed(1)}M
오늘 등락: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%
PER: ${per ?? '정보없음'} / PBR: ${pbr ?? '정보없음'} / 배당수익률: ${div.toFixed(2)}%

[최근 리스크 신호 (LLM 추출)]
${riskBlock}

[최근 뉴스·공시 원문 발췌]
${docBlock}

[동일 섹터 경쟁사 현황]
${peerBlock}

[요청사항]
위 데이터를 모두 종합하여 다음 3가지를 포함한 분석을 3~5문장으로 작성하세요:
1. 현재 기업의 핵심 상황 (수치 기반)
2. 공급망·뉴스·공시에서 포착된 주목할 리스크 또는 기회
3. 섹터 내 상대적 위치

투자 권유·매수/매도 조언은 절대 하지 마세요. 근거 없는 낙관론도 금지입니다.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content?.trim() ?? '';
}
