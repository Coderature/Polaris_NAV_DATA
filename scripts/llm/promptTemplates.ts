import type { RawDocument } from '../types.js';

export function buildRiskExtractionPrompt(document: RawDocument): string {
  return `아래 금융 텍스트에서 핵심 기업, 산업, 리스크, 공급망 연결, 영향을 받는 주체를 추출하세요.

제약 조건:
- 결과는 반드시 JSON 형식으로만 반환합니다.
- 중복 데이터는 제거합니다.
- 추출하지 못하면 빈 문자열 대신 "unknown"을 사용하지 않습니다.
- 날짜는 ISO 8601 형식(YYYY-MM-DD)으로 작성합니다.

입력 텍스트:
Title: ${document.title}
Source: ${document.source}
URL: ${document.url}
Date: ${document.date}
Text: ${document.text}

출력 스키마:
{
  "source": "${document.source}",
  "sourceUrl": "${document.url}",
  "company": "회사 이름",
  "ticker": "티커(가능하면)",
  "sector": "산업군",
  "riskType": "리스크 유형(예: 공급망, 재무, 규제, 수요 등)",
  "riskSeverity": "low|medium|high",
  "summary": "핵심 요약 한 문장",
  "keywords": ["키워드1", "키워드2"],
  "upstream": ["상류 기업1", "상류 기업2"],
  "downstream": ["하류 기업1", "하류 기업2"],
  "asOf": "${new Date().toISOString().slice(0, 10)}"
}

예시:
{
  "source": "naver",
  "sourceUrl": "https://...",
  "company": "LG전자",
  "ticker": "066570",
  "sector": "전자부품",
  "riskType": "부품 수급",
  "riskSeverity": "high",
  "summary": "OLED 공급망 병목으로 인해 TV 생산에 차질이 우려됩니다.",
  "keywords": ["OLED", "공급망", "부품 부족"],
  "upstream": ["삼성전기"],
  "downstream": ["애플"],
  "asOf": "${new Date().toISOString().slice(0, 10)}"
}

이제 JSON 객체만 반환하세요.`;
}
