import './styles.css';
import * as THREE from 'three';
import { loadTreemapData } from './data/loadTreemapData';
import { initQuotesClient } from './data/quotesClient';
import { generateStockSummary } from './data/groqSummary';
import {
  type MarketCode,
  type SectorDef,
  type StockRow,
  dataSnapshotBaselineLabel,
  dataSourceDetailLabel,
} from './types';
import { TreemapScene } from './scene/TreemapScene';

const GURU_QUOTES: { text: string; author: string }[] = [
  
  { text: '다른 사람이 탐욕스러울 때 두려워하고, 다른 사람이 두려워할 때 탐욕스러워라.', author: 'Warren Buffett' },
  { text: '가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것이다.', author: 'Warren Buffett' },
  { text: '큰 돈은 사는 것도, 파는 것도 아닌 — 기다리는 데서 번다.', author: 'Charlie Munger' },
  
  { text: '시장은 인내심 없는 자의 돈을 인내심 있는 자에게 옮기는 장치이다.', author: 'Warren Buffett' },
  { text: '주식 시장은 적극적인 자에게서 인내하는 자에게로 돈을 이전하는 도구다.', author: 'Benjamin Graham' },
  { text: '자신이 이해하지 못하는 사업에는 절대 투자하지 마라.', author: 'Warren Buffett' },
  { text: '위험은 자신이 무엇을 하는지 모르는 데서 온다.', author: 'Warren Buffett' },
  { text: '10년간 보유할 주식이 아니라면, 10분도 보유하지 마라.', author: 'Warren Buffett' },
  { text: '좋은 기업을 적정한 가격에 사는 것이 적정한 기업을 좋은 가격에 사는 것보다 훨씬 낫다.', author: 'Warren Buffett' },
  { text: '손실 종목을 팔고 승자 종목을 보유하는 대신, 승자를 팔고 패자를 붙드는 것은 — 꽃을 꺾고 잡초에 물을 주는 것과 같다.', author: 'Peter Lynch' },
  { text: '당신이 어디로 가는지 모른다면, 결국 다른 곳에 도착하게 된다.', author: 'Peter Lynch' },
  { text: '주식 투자에서 위장(stomach)이 두뇌보다 더 중요한 기관이다.', author: 'Peter Lynch' },
  { text: '져도 감당할 수 있는 만큼만 걸어라. 그래야 다음 판이 들어왔을 때 잡을 수 있다.', author: 'Paul Tudor Jones' },
  { text: '훌륭한 트레이더의 가장 중요한 규칙: 공격이 아니라 방어가 먼저다.', author: 'Paul Tudor Jones' },
  { text: '시장에서 영웅이 되려 하지 마라. 자존심을 버려라. 틀렸다고 생각되면 인정하고 빠져나와라.', author: 'Paul Tudor Jones' },
  { text: '맞고 틀리고가 중요한 것이 아니다. 맞았을 때 얼마를 벌고, 틀렸을 때 얼마를 잃느냐가 중요하다.', author: 'George Soros' },
  { text: '시장은 항상 틀린다. 시장의 편향이 곧 기회다.', author: 'George Soros' },
  { text: '내가 부자가 된 것은 내가 틀렸다는 사실을 인정할 줄 알았기 때문이다.', author: 'George Soros' },
];

function pickRandomQuote() {
  return GURU_QUOTES[Math.floor(Math.random() * GURU_QUOTES.length)];
}

function runSplashSequence(): Promise<void> {
  return new Promise((resolve) => {
    const splash = document.getElementById('splash')!;
    splash.style.display = '';
    const loading = document.getElementById('splash-loading')!;
    const quoteWrap = document.getElementById('splash-quote')!;
    const quoteText = document.getElementById('quote-text')!;
    const quoteAuthor = document.getElementById('quote-author')!;

    const q = pickRandomQuote();
    quoteText.textContent = q.text;
    quoteAuthor.textContent = q.author;

    setTimeout(() => {
      loading.classList.add('fade-out');

      setTimeout(() => {
        quoteWrap.classList.add('show');

        setTimeout(() => {
          quoteWrap.classList.add('fade-out');

          setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => {
              splash.style.display = 'none';
              resolve();
            }, 800);
          }, 1200);
        }, 3500);
      }, 600);
    }, 3000);
  });
}

function fmtBn(cap: number): string {
  if (cap >= 1000) return `${(cap / 1000).toFixed(2)}T`;
  return `${cap.toFixed(1)}B`;
}

function fmtPrice(p: number, market: MarketCode): string {
  if (market === 'KR') return `₩${Math.round(p).toLocaleString('ko-KR')}`;
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sectorRankFor(stocks: StockRow[], st: StockRow): string {
  const same = stocks.filter((s) => s.s === st.s).sort((a, b) => b.cap - a.cap);
  const i = same.findIndex((s) => s.t === st.t) + 1;
  return `${i} / ${same.length}`;
}

function restingFootprintXZ(g: THREE.Group): number {
  const xz = g.userData.footprintRestXZ as number | undefined;
  return xz != null && xz > 0 ? xz : 1;
}

function setBuildingInteractionScale(mesh: THREE.Group, xzFactor: number) {
  const xz = restingFootprintXZ(mesh) * xzFactor;
  mesh.scale.set(xz, 1, xz);
}

function resetBuildingInteractionScale(mesh: THREE.Group) {
  const xz = restingFootprintXZ(mesh);
  mesh.scale.set(xz, 1, xz);
}

function renderSummary(md: string): string {
  const lines = md.split('\n');
  const parts: string[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      parts.push(`<ul class="ai-bullets">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`);
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushBullets(); continue; }

    const headerMatch = line.match(/^\*\*(.+?)\*\*\s*$/);
    if (headerMatch) {
      flushBullets();
      parts.push(`<div class="ai-section-title">${headerMatch[1]}</div>`);
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s+(.+)/);
    if (bulletMatch) {
      bullets.push(bulletMatch[1].replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
      continue;
    }

    flushBullets();
    parts.push(`<p class="ai-para">${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`);
  }
  flushBullets();
  return parts.join('');
}

function aiSummary(stocks: StockRow[], sectors: SectorDef[], st: StockRow): string {
  const sec = sectors.find((s) => s.id === st.s)!;
  const dir = st.halted ? '거래정지 상태' : st.chg! >= 0 ? `오늘 +${st.chg!.toFixed(2)}%` : `오늘 ${st.chg!.toFixed(2)}%`;
  const cap = fmtBn(st.cap);
  return `
    <p style="margin:0 0 8px"><b style="color:var(--text-primary)">${st.n}</b>은 ${sec.ko} 섹터에 속하며 시가총액 약 <b>$${cap}</b> 규모로 ${sectorRankFor(stocks, st)} 위치입니다.</p>
    <p style="margin:0 0 8px">${dir}의 등락률을 기록하고 있고, PER ${st.per ?? '—'} / PBR ${st.pbr ?? '—'} 수준의 밸류에이션 지표를 보입니다.</p>
    <p style="margin:0;color:var(--text-tertiary);font-size:12px">※ 본 요약은 제공된 수치 데이터를 기반으로 생성된 정보 정리이며, 향후 가격에 대한 어떠한 단정도 포함하지 않습니다.</p>
  `;
}

function waitForConsent(): Promise<void> {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal')!;
    const inlineWarn = document.getElementById('m-warn')!;

    modal.classList.add('show');
    document.body.classList.add('pre-consent');

    document.getElementById('m-agree')!.addEventListener('click', () => {
      localStorage.setItem('consent_given', JSON.stringify({ consent: true, timestamp: new Date().toISOString() }));
      modal.classList.remove('show');
      document.body.classList.remove('pre-consent');
      inlineWarn.classList.remove('show');
      resolve();
    }, { once: true });

    document.getElementById('m-cancel')!.addEventListener('click', () => {
      inlineWarn.classList.add('show');
    });
  });
}

async function main() {
  await waitForConsent();
  await runSplashSequence();

  const { sectors, stocks, generatedAt, extractedRisks, documents } = await loadTreemapData();
  const secById = Object.fromEntries(sectors.map((s) => [s.id, s])) as Record<string, SectorDef>;

  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const wrap = document.getElementById('scene-wrap') as HTMLElement;
  const treemap = await TreemapScene.create(canvas, stocks, sectors, wrap);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tooltipEl = document.getElementById('tooltip')!;
  const ttName = document.getElementById('tt-name')!;
  const ttTicker = document.getElementById('tt-ticker')!;
  const ttChg = document.getElementById('tt-chg')!;
  const ttChgRow = document.getElementById('tt-chg-row')!;
  const ttSector = document.getElementById('tt-sector')!;
  const ttCap = document.getElementById('tt-cap')!;

  const panel = document.getElementById('panel')!;
  const pTicker = document.getElementById('p-ticker')!;
  const pMarket = document.getElementById('p-market')!;
  const pName = document.getElementById('p-name')!;
  const pSecDot = document.getElementById('p-sec-dot')!;
  const pSecName = document.getElementById('p-sec-name')!;
  const pPrice = document.getElementById('p-price')!;
  const pChg = document.getElementById('p-chg')!;
  const pWatch = document.getElementById('p-watch')!;
  const aiStatus = document.getElementById('ai-status')!;
  const aiContent = document.getElementById('ai-content')!;
  const aiDisclaimer = document.getElementById('ai-disclaimer')!;
  const hintEl = document.getElementById('hint')!;


  let hovered: THREE.Group | null = null;
  let highlighted: THREE.Group | null = null;
  let downX = 0;
  let downY = 0;
  let dragDist = 0;
  let isDown = false;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let currentStock: StockRow | null = null;

  const appDataSource = stocks.every((s) => s.source === 'live')
    ? 'live'
    : stocks.some((s) => s.source === 'live')
      ? 'cached'
      : 'mock';


  function buildingFromIntersect(obj: THREE.Object3D | null): THREE.Group | null {
    let o: THREE.Object3D | null = obj;
    const active = treemap.stockGroup;
    while (o && o.parent !== active) o = o.parent;
    return o && o.parent === active && o.userData?.stock ? (o as THREE.Group) : null;
  }

  function showTooltip(st: StockRow, x: number, y: number) {
    const sec = secById[st.s];
    ttName.textContent = st.n;
    ttTicker.textContent = `${st.t} · ${st.m}`;
    ttChgRow.classList.remove('up', 'down');
    if (st.halted) {
      ttChg.textContent = '⊘ halted';
    } else {
      const sign = (st.chg ?? 0) >= 0 ? '+' : '';
      ttChg.textContent = `${sign}${(st.chg ?? 0).toFixed(2)}%`;
      ttChgRow.classList.add((st.chg ?? 0) >= 0 ? 'up' : 'down');
    }
    ttSector.textContent = sec.ko;
    ttCap.textContent = `$${fmtBn(st.cap)}`;
    tooltipEl.classList.add('show');
    const px = Math.min(window.innerWidth - 220, x + 14);
    const py = Math.min(window.innerHeight - 140, y + 14);
    tooltipEl.style.left = `${px}px`;
    tooltipEl.style.top = `${py}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.remove('show');
  }

  function updatePointer(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, treemap.camera);
    const hits = ray.intersectObjects(treemap.stockGroup.children, true);
    const building = hits.length ? buildingFromIntersect(hits[0].object) : null;
    if (building) {
      const st = building.userData.stock as StockRow;
      showTooltip(st, e.clientX, e.clientY);
      treemap.setHoveredSector(st.s);
      if (hovered !== building) {
        if (hovered) resetBuildingInteractionScale(hovered);
        hovered = building;
        setBuildingInteractionScale(hovered, 1.05);
        canvas.style.cursor = 'pointer';
      }
    } else {
      if (hovered) resetBuildingInteractionScale(hovered);
      hovered = null;
      canvas.style.cursor = 'grab';
      hideTooltip();
      treemap.setHoveredSector(
        panel.classList.contains('open') && currentStock ? currentStock.s : null,
      );
    }
  }

  function handleClick(e: PointerEvent) {
    updatePointer(e);
    ray.setFromCamera(ndc, treemap.camera);
    const hits = ray.intersectObjects(treemap.stockGroup.children, true);
    const building = hits.length ? buildingFromIntersect(hits[0].object) : null;
    if (building) {
      openPanel(building.userData.stock as StockRow, building);
    } else {
      closePanel();
    }
  }

  const severityLabel: Record<string, string> = { high: '🔴 고', medium: '🟡 중', low: '🟢 저' };

  function renderRisksForStock(st: StockRow) {
    const newsList = document.getElementById('news-list')!;
    const dartList = document.getElementById('dart-list')!;

    const matchRisk = (r: { company: string; ticker?: string }) =>
      r.company.includes(st.n) || st.n.includes(r.company) || r.ticker === st.t;

    const risks = extractedRisks.filter(matchRisk);
    const dartDocs = documents.filter(
      (d) => d.source === 'dart' && matchRisk({ company: String(d.metadata?.corpName ?? ''), ticker: String(d.metadata?.stockCode ?? '') }),
    );
    const naverDocs = documents.filter(
      (d) => d.source === 'naver' && (d.title.includes(st.n) || (d.metadata?.query as string ?? '').length > 0),
    );

    if (risks.length > 0) {
      newsList.innerHTML = risks.slice(0, 4).map((r) => `
        <div class="news-item">
          <div class="news-title"><span class="risk-badge">${severityLabel[r.riskSeverity] ?? r.riskSeverity}</span> ${r.riskType}</div>
          <div class="news-summary">${r.summary}</div>
          ${r.keywords.length ? `<div class="news-meta">${r.keywords.slice(0, 4).join(' · ')}</div>` : ''}
          <a class="news-link" href="${r.sourceUrl}" target="_blank" rel="noopener">원문 보기 ↗</a>
        </div>`).join('');
    } else if (naverDocs.length > 0) {
      newsList.innerHTML = naverDocs.slice(0, 3).map((d) => `
        <div class="news-item">
          <div class="news-title">${d.title}</div>
          <div class="news-meta">${d.date}</div>
          <a class="news-link" href="${d.url}" target="_blank" rel="noopener">기사 보기 ↗</a>
        </div>`).join('');
    } else {
      newsList.innerHTML = '<div class="news-item"><div class="news-meta">이 종목의 리스크 데이터가 없습니다. 파이프라인을 재실행하세요.</div></div>';
    }

    if (dartDocs.length > 0) {
      dartList.innerHTML = dartDocs.slice(0, 3).map((d) => `
        <div class="news-item">
          <div class="news-title">${d.title}</div>
          <div class="news-meta">${d.date}</div>
          <a class="news-link" href="${d.url}" target="_blank" rel="noopener">공시 보기 ↗</a>
        </div>`).join('');
    } else {
      dartList.innerHTML = '<div class="news-item"><div class="news-meta">공시 데이터가 없습니다.</div></div>';
    }
  }

  function openPanel(st: StockRow, mesh: THREE.Group | null) {
    currentStock = st;
    treemap.setHoveredSector(st.s);
    const sec = secById[st.s];

    pTicker.textContent = st.t;
    pMarket.textContent = st.m;
    pName.textContent = st.n;
    pSecDot.style.background = sec.color;
    pSecName.textContent = sec.ko;

    pPrice.textContent = st.halted ? '—' : fmtPrice(st.price ?? 0, st.m);
    pChg.classList.remove('up', 'down');
    if (st.halted) {
      pChg.textContent = '⊘ halted';
    } else {
      const sign = (st.chg ?? 0) >= 0 ? '+' : '';
      pChg.textContent = `${sign}${(st.chg ?? 0).toFixed(2)}%`;
      pChg.classList.add((st.chg ?? 0) >= 0 ? 'up' : 'down');
    }

    document.getElementById('m-cap')!.textContent = `$${fmtBn(st.cap)}`;
    document.getElementById('m-vol')!.textContent = `${st.vol.toFixed(1)}M`;
    document.getElementById('m-per')!.textContent = st.per == null ? '—' : st.per.toFixed(1);
    document.getElementById('m-pbr')!.textContent = st.pbr == null ? '—' : st.pbr.toFixed(2);
    document.getElementById('m-rank')!.textContent = sectorRankFor(stocks, st);
    document.getElementById('m-div')!.textContent = `${st.div.toFixed(2)}%`;

    const pSource = document.getElementById('p-source');
    const pAsof = document.getElementById('p-asof');
    if (pSource) pSource.textContent = st.sourceLabel ?? dataSourceDetailLabel(st.source);
    if (pAsof) pAsof.textContent = formatSyncTime(generatedAt);

    if (highlighted && highlighted !== mesh) resetBuildingInteractionScale(highlighted);
    if (mesh) {
      setBuildingInteractionScale(mesh, 1.08);
      highlighted = mesh;
    } else {
      if (highlighted) resetBuildingInteractionScale(highlighted);
      highlighted = null;
    }

    panel.classList.add('open');
    hintEl.classList.add('hide');
    renderRisksForStock(st);

    pWatch.classList.toggle('on', isWatched(st.t));
    pWatch.textContent = isWatched(st.t) ? '★ Saved' : '☆ Save';

    aiStatus.textContent = 'Groq AI 요약 생성 중…';
    aiContent.innerHTML = `
    <div class="skel skel-line w90"></div>
    <div class="skel skel-line w70"></div>
    <div class="skel skel-line w80"></div>
    <div class="skel skel-line w50"></div>`;
    if (aiTimer) clearTimeout(aiTimer);
    const matchRisk = (r: { company: string; ticker?: string }) =>
      r.company.includes(st.n) || st.n.includes(r.company) || r.ticker === st.t;
    const relatedDocs = documents.filter(
      (d) => d.title.includes(st.n) || st.n.includes(String(d.metadata?.corpName ?? '')),
    );
    const sectorPeers = stocks
      .filter((s) => s.s === st.s && s.t !== st.t)
      .sort((a, b) => b.cap - a.cap)
      .slice(0, 4)
      .map((s) => ({ name: s.n, cap: s.cap, chg: s.chg ?? 0 }));

    generateStockSummary({
      name: st.n,
      sector: secById[st.s]?.ko ?? st.s,
      market: st.m,
      cap: `$${fmtBn(st.cap)}`,
      chg: st.chg ?? 0,
      per: st.per,
      pbr: st.pbr,
      div: st.div,
      vol: st.vol,
      risks: extractedRisks.filter(matchRisk),
      documents: relatedDocs,
      sectorPeers,
    }).then((summary) => {
      aiStatus.textContent = 'Groq AI · llama-3.3-70b';
      aiContent.innerHTML = renderSummary(summary);
      aiDisclaimer.textContent = '⚠ AI 생성 요약이며 투자 조언이 아닙니다.';
    }).catch(() => {
      aiStatus.textContent = '요약 · 규칙 기반 (폴백)';
      aiContent.innerHTML = aiSummary(stocks, sectors, st);
      aiDisclaimer.textContent = '⚠ 규칙 기반 요약이며 투자 조언이 아닙니다.';
    });
  }

  function closePanel() {
    panel.classList.remove('open');
    treemap.setHoveredSector(null);
    if (highlighted) {
      resetBuildingInteractionScale(highlighted);
      highlighted = null;
    }
    currentStock = null;
    if (aiTimer) clearTimeout(aiTimer);
  }

  const navViewToggle = document.getElementById('navViewToggle')!;
  const legendModeNote = document.getElementById('legend-mode-note')!;
  const legendStaticRows = document.getElementById('legend-static-rows')!;

  let navigatorView: 'overview' | 'chg' | 'marketCap' = 'overview';

  function updateLegendAndHintForView() {
    hintEl.innerHTML =
      '<span class="kbd">드래그</span> 회전 · <span class="kbd">스크롤</span> 확대 · <span class="kbd">클릭</span> 상세 패널';
    if (navigatorView === 'overview') {
      legendStaticRows.innerHTML =
        '<div class="row"><span class="swatch" style="background:#4b5563"></span>빌딩 본체 · 중립 톤 · 균일 높이</div>';
      legendModeNote.textContent =
        '바닥은 연한 초록 반투명 필드(분위기). 구역 경계는 얇은 라인 · 좌측 범례·호버·패널에서 구역을 확인하세요.';
    } else if (navigatorView === 'chg') {
      legendStaticRows.innerHTML = `
        <div class="row"><span class="swatch" style="background:var(--change-up)"></span>상승 · 높이·색</div>
        <div class="row"><span class="swatch" style="background:var(--change-down)"></span>하락 · 높이·색</div>
        <div class="row"><span class="swatch" style="background:#8a8f98"></span>보합·정지</div>`;
      legendModeNote.textContent =
        '3D: 직육면체 높이는 등락 강도, 본체 색은 등락 방향입니다. 바닥은 어둡게 두고 구역 라인을 조금 더 진하게. 타일 면적은 시총 비중.';
    } else if (navigatorView === 'marketCap') {
      legendStaticRows.innerHTML =
        '<div class="row"><span class="swatch" style="background:#4b5563"></span>높이 · Overview와 동일 (중립)</div>';
      legendModeNote.textContent =
        '3D: 타일 위치·높이는 유지. 밑면 면적만 √시총 비율로 스케일합니다. 바닥·구역선은 등락 모드와 같습니다.';
    }
  }

  function setNavigatorView(mode: 'overview' | 'chg' | 'marketCap') {
    navigatorView = mode;
    navViewToggle.querySelectorAll('.nv-btn').forEach((b) => {
      const btn = b as HTMLButtonElement;
      btn.classList.toggle('active', btn.dataset.view === mode);
    });

    treemap.setVisualMode(mode);
    updateLegendAndHintForView();
    treemap.resize();
  }

  navViewToggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-view]') as HTMLButtonElement | null;
    if (!btn?.dataset.view) return;
    setNavigatorView(btn.dataset.view as 'overview' | 'chg' | 'marketCap');
  });

  canvas.addEventListener('pointerdown', (e) => {
    isDown = true;
    dragDist = 0;
    downX = e.clientX;
    downY = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (isDown) dragDist = Math.max(dragDist, Math.hypot(e.clientX - downX, e.clientY - downY));
    updatePointer(e);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (dragDist < 5) handleClick(e);
    isDown = false;
  });
  canvas.addEventListener('pointerleave', () => {
    hideTooltip();
    treemap.setHoveredSector(null);
    if (hovered) resetBuildingInteractionScale(hovered);
    hovered = null;
    canvas.style.cursor = 'grab';
    isDown = false;
  });

  document.getElementById('p-close')!.addEventListener('click', closePanel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('pointermove', (e) => e.stopPropagation());
  panel.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });

  function watchKey() {
    return 'polaris_watchlist';
  }
  function getWatchlist(): string[] {
    try {
      return JSON.parse(localStorage.getItem(watchKey()) || '[]') as string[];
    } catch {
      return [];
    }
  }
  function isWatched(t: string) {
    return getWatchlist().includes(t);
  }
  function toggleWatch(t: string) {
    const wl = getWatchlist();
    const i = wl.indexOf(t);
    if (i >= 0) wl.splice(i, 1);
    else wl.push(t);
    localStorage.setItem(watchKey(), JSON.stringify(wl));
  }

  pWatch.addEventListener('click', () => {
    if (!currentStock) return;
    toggleWatch(currentStock.t);
    const on = isWatched(currentStock.t);
    pWatch.classList.toggle('on', on);
    pWatch.textContent = on ? '★ Saved' : '☆ Save';
  });

  document.getElementById('resetCam')!.addEventListener('click', () => {
    treemap.resetOrbitCamera();
  });

  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim().toUpperCase();
      if (!q) return;
      const found = stocks.find((s) => s.t.toUpperCase() === q || s.n.toUpperCase().includes(q));
      if (found) {
        const mesh = treemap.meshByStock.get(found);
        openPanel(found, mesh ?? null);
        if (mesh) treemap.flyToStock(mesh);
      }
    }
  });

  const simBtn = document.getElementById('simBtn')!;
  simBtn.addEventListener('click', () => {
    simBtn.textContent = '갱신 중…';
    simBtn.setAttribute('disabled', 'true');
    refreshQuotes().finally(() => {
      simBtn.textContent = '새로고침';
      simBtn.removeAttribute('disabled');
      if (currentStock) {
        const sign = (currentStock.chg ?? 0) >= 0 ? '+' : '';
        pChg.textContent = `${sign}${(currentStock.chg ?? 0).toFixed(2)}%`;
        pChg.classList.remove('up', 'down');
        pChg.classList.add((currentStock.chg ?? 0) >= 0 ? 'up' : 'down');
        pPrice.textContent = fmtPrice(currentStock.price ?? 0, currentStock.m);
      }
    });
  });

  const legendList = document.getElementById('legend-list')!;
  for (const s of sectors) {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<span class="swatch" style="background:${s.color}"></span><span class="legend-ko">${s.ko}</span>`;
    legendList.appendChild(div);
  }
  updateLegendAndHintForView();

  function formatSyncTime(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function refreshStatus(quotesAt?: string) {
    const up = stocks.filter((s) => !s.halted && (s.chg ?? 0) > 0).length;
    const dn = stocks.filter((s) => !s.halted && (s.chg ?? 0) < 0).length;
    const ht = stocks.filter((s) => s.halted).length;
    document.getElementById('s-stocks')!.textContent = String(stocks.length);
    const secCount = document.getElementById('s-sectors');
    if (secCount) secCount.textContent = String(sectors.length);
    document.getElementById('s-up')!.textContent = String(up);
    document.getElementById('s-down')!.textContent = String(dn);
    document.getElementById('s-halt')!.textContent = String(ht);
    document.getElementById('s-time')!.textContent = quotesAt ? formatSyncTime(quotesAt) : '갱신 중…';
    const srcEl = document.getElementById('s-source-line');
    if (srcEl) srcEl.textContent = dataSnapshotBaselineLabel(appDataSource);
  }
  refreshStatus();

  const refreshQuotes = initQuotesClient(stocks, (updatedAt) => {
    treemap.updateAllVisuals();
    refreshStatus(updatedAt);
  });


  const homeHub = document.getElementById('home-hub')!;
  const positionView = document.getElementById('position-view')!;

  function showHome() {
    positionView.classList.remove('active');
    homeHub.classList.remove('hidden');
  }
  function hideHome() {
    homeHub.classList.add('hidden');
  }

  document.querySelectorAll<HTMLAnchorElement>('.nav-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const route = card.dataset.route;
      if (route === 'treemap') {
        hideHome();
        navViewToggle.classList.remove('hidden');
        setNavigatorView('overview');
      } else if (route === 'guru') {
        hideHome();
        navViewToggle.classList.add('hidden');
        positionView.classList.add('active');
      }
    });
  });

  document.getElementById('position-back')!.addEventListener('click', showHome);

  document.getElementById('homeBtn')!.addEventListener('click', () => {
    showHome();
    navViewToggle.classList.add('hidden');
    setNavigatorView('overview');
    closePanel();
  });

  function tick() {
    treemap.tick();
    requestAnimationFrame(tick);
  }
  treemap.resize();
  requestAnimationFrame(tick);

  console.log('Polaris Navigator — ready');
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:24px;color:var(--accent-warn);background:var(--bg-base);height:100vh">${String(err)}</pre>`;
});
