# Polaris Navigator

3D GICS market treemap prototype (Capstone 2026).

## Data Setup

1. https://finnhub.io 가입 → API 키 발급
2. `.env` 생성: `VITE_FINNHUB_API_KEY=your_key`
3. `npm run dev`

## 데이터 파이프라인 & 크롤러
1. `.env` 파일을 `.env.example`에서 복사하고 필요한 키를 채웁니다.
2. `npm install`을 실행합니다.
3. `npm run build:data`로 DART, 네이버 뉴스, PDF, LLM 기반 리스크 추출을 실행합니다.
4. 생성된 데이터는 `public/polaris_nav_data.json`에 저장됩니다.

> 프론트엔드는 새 파이프라인 데이터를 자동으로 우선 로드하며, `public/treemap_data.json`은 fallback 데이터로 사용됩니다.

개별 실행 가능 명령:
- `npm run crawl:dart`
- `npm run crawl:naver`
- `npm run crawl:pdf`
