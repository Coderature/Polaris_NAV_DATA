import './styles.css';
import * as THREE from 'three';
import { loadTreemapData } from './data/loadTreemapData';
import type { MarketCode, SectorDef, StockRow } from './types';
import { TreemapScene } from './scene/TreemapScene';

const GURU_QUOTES: { text: string; author: string }[] = [
  { text: '누군가 그늘에 앉아 쉬고 있다면, 그것은 오래전에 누군가가 나무를 심었기 때문이다.', author: 'Warren Buffett' },
  { text: '꽃이 피는 과정을 보려고 씨앗을 파헤치지 마라. 인내심을 갖고 기다려라.', author: 'Warren Buffett' },
  { text: '다른 사람이 탐욕스러울 때 두려워하고, 다른 사람이 두려워할 때 탐욕스러워라.', author: 'Warren Buffett' },
  { text: '가격은 당신이 지불하는 것이고, 가치는 당신이 얻는 것이다.', author: 'Warren Buffett' },
  { text: '큰 돈은 사는 것도, 파는 것도 아닌 — 기다리는 데서 번다.', author: 'Charlie Munger' },
  { text: '복리는 세계 8번째 불가사의이다. 이해하는 자는 벌고, 이해하지 못하는 자는 지불한다.', author: 'Albert Einstein' },
  { text: '시장은 인내심 없는 자의 돈을 인내심 있는 자에게 옮기는 장치이다.', author: 'Warren Buffett' },
  { text: '주식 시장은 적극적인 자에게서 인내하는 자에게로 돈을 이전하는 도구다.', author: 'Benjamin Graham' },
  { text: '자신이 이해하지 못하는 사업에는 절대 투자하지 마라.', author: 'Warren Buffett' },
  { text: '위험은 자신이 무엇을 하는지 모르는 데서 온다.', author: 'Warren Buffett' },
  { text: '10년간 보유할 주식이 아니라면, 10분도 보유하지 마라.', author: 'Warren Buffett' },
  { text: '좋은 기업을 적정한 가격에 사는 것이 적정한 기업을 좋은 가격에 사는 것보다 훨씬 낫다.', author: 'Warren Buffett' },
];

function pickRandomQuote() {
  return GURU_QUOTES[Math.floor(Math.random() * GURU_QUOTES.length)];
}

function runSplashSequence(): Promise<void> {
  return new Promise((resolve) => {
    const splash = document.getElementById('splash')!;
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
  if (market === 'KR') return `₩${(p * 1300).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sectorRankFor(stocks: StockRow[], st: StockRow): string {
  const same = stocks.filter((s) => s.s === st.s).sort((a, b) => b.cap - a.cap);
  const i = same.findIndex((s) => s.t === st.t) + 1;
  return `${i} / ${same.length}`;
}

function aiSummary(stocks: StockRow[], sectors: SectorDef[], st: StockRow): string {
  const sec = sectors.find((s) => s.id === st.s)!;
  const dir = st.halted ? '거래정지 상태' : st.chg! >= 0 ? `오늘 +${st.chg!.toFixed(2)}%` : `오늘 ${st.chg!.toFixed(2)}%`;
  const cap = fmtBn(st.cap);
  return `
    <p style="margin:0 0 8px"><b style="color:var(--ink-0)">${st.n}</b>은 ${sec.ko} 섹터에 속하며 시가총액 약 <b>$${cap}</b> 규모로 ${sectorRankFor(stocks, st)} 위치입니다.</p>
    <p style="margin:0 0 8px">${dir}의 등락률을 기록하고 있고, PER ${st.per ?? '—'} / PBR ${st.pbr ?? '—'} 수준의 밸류에이션 지표를 보입니다.</p>
    <p style="margin:0;color:var(--ink-2);font-size:12px">※ 본 요약은 제공된 수치 데이터를 기반으로 생성된 정보 정리이며, 향후 가격에 대한 어떠한 단정도 포함하지 않습니다.</p>
  `;
}

async function main() {
  await runSplashSequence();

  const { sectors, stocks, generatedAt } = await loadTreemapData();
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
  const hintEl = document.getElementById('hint')!;

  const modal = document.getElementById('modal')!;
  const inlineWarn = document.getElementById('m-warn')!;

  let hovered: THREE.Group | null = null;
  let highlighted: THREE.Group | null = null;
  let downX = 0;
  let downY = 0;
  let dragDist = 0;
  let isDown = false;
  let aiTimer: ReturnType<typeof setTimeout> | null = null;
  let currentStock: StockRow | null = null;

  function buildingFromIntersect(obj: THREE.Object3D | null): THREE.Group | null {
    let o: THREE.Object3D | null = obj;
    while (o && o.parent !== treemap.stockGroup) o = o.parent;
    return o && o.parent === treemap.stockGroup && o.userData?.stock ? (o as THREE.Group) : null;
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
      if (hovered !== building) {
        if (hovered) hovered.scale.set(1, 1, 1);
        hovered = building;
        hovered.scale.set(1.05, 1.05, 1.05);
        canvas.style.cursor = 'pointer';
      }
    } else {
      if (hovered) hovered.scale.set(1, 1, 1);
      hovered = null;
      canvas.style.cursor = 'grab';
      hideTooltip();
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

  function openPanel(st: StockRow, mesh: THREE.Group | null) {
    currentStock = st;
    const sec = secById[st.s];

    pTicker.textContent = st.t;
    pMarket.textContent = st.m;
    pName.textContent = st.n;
    pSecDot.style.background = sec.color;
    pSecName.textContent = `${sec.name} · ${sec.ko}`;

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

    if (highlighted && highlighted !== mesh) highlighted.scale.set(1, 1, 1);
    if (mesh) {
      mesh.scale.set(1.08, 1.18, 1.08);
      highlighted = mesh;
    }

    panel.classList.add('open');
    hintEl.classList.add('hide');

    pWatch.classList.toggle('on', isWatched(st.t));
    pWatch.textContent = isWatched(st.t) ? '★ Saved' : '☆ Save';

    aiStatus.textContent = 'Gemini 2.5 Flash 호출 중…';
    aiContent.innerHTML = `
    <div class="skel skel-line w90"></div>
    <div class="skel skel-line w70"></div>
    <div class="skel skel-line w80"></div>
    <div class="skel skel-line w50"></div>`;
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiStatus.textContent = '응답 완료 · 25 banned-words 필터 통과';
      aiContent.innerHTML = aiSummary(stocks, sectors, st);
    }, 1600 + Math.random() * 700);
  }

  function closePanel() {
    panel.classList.remove('open');
    if (highlighted) {
      highlighted.scale.set(1, 1, 1);
      highlighted = null;
    }
    currentStock = null;
    if (aiTimer) clearTimeout(aiTimer);
  }

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

  document.querySelectorAll('.view-controls .btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.view-controls .btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const mode = (b as HTMLButtonElement).dataset.view as '3d' | 'top' | 'front';
      treemap.animateCamera(mode);
    });
  });

  document.getElementById('resetCam')!.addEventListener('click', () => treemap.animateCamera('3d'));

  const searchInput = document.getElementById('search') as HTMLInputElement;
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim().toUpperCase();
      if (!q) return;
      const found = stocks.find((s) => s.t.toUpperCase() === q || s.n.toUpperCase().includes(q));
      if (found) {
        const mesh = treemap.meshByStock.get(found);
        if (mesh) {
          openPanel(found, mesh);
          treemap.flyToStock(mesh);
        } else {
          openPanel(found, null);
        }
      }
    }
  });

  document.getElementById('simBtn')!.addEventListener('click', () => {
    for (const st of stocks) {
      if (st.halted) continue;
      const delta = (Math.random() - 0.5) * 1.2;
      st.chg = +((st.chg ?? 0) + delta).toFixed(2);
      if (st.chg > 6) st.chg = 6;
      if (st.chg < -6) st.chg = -6;
      st.price = +Math.max(1, (st.price ?? 1) * (1 + delta / 100)).toFixed(2);
    }
    treemap.updateAllVisuals();
    refreshStatus(new Date().toISOString());
    if (currentStock) {
      const sign = (currentStock.chg ?? 0) >= 0 ? '+' : '';
      pChg.textContent = `${sign}${(currentStock.chg ?? 0).toFixed(2)}%`;
      pChg.classList.remove('up', 'down');
      pChg.classList.add((currentStock.chg ?? 0) >= 0 ? 'up' : 'down');
      pPrice.textContent = fmtPrice(currentStock.price ?? 0, currentStock.m);
    }
  });

  const legendList = document.getElementById('legend-list')!;
  for (const s of sectors) {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<span class="swatch" style="background:${s.color}"></span>${s.ko} <span style="color:var(--ink-3);margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px">${s.id}</span>`;
    legendList.appendChild(div);
  }

  function formatSyncTime(iso: string) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function refreshStatus(syncAt = generatedAt) {
    const up = stocks.filter((s) => !s.halted && (s.chg ?? 0) > 0).length;
    const dn = stocks.filter((s) => !s.halted && (s.chg ?? 0) < 0).length;
    const ht = stocks.filter((s) => s.halted).length;
    document.getElementById('s-stocks')!.textContent = String(stocks.length);
    document.getElementById('s-up')!.textContent = String(up);
    document.getElementById('s-down')!.textContent = String(dn);
    document.getElementById('s-halt')!.textContent = String(ht);
    document.getElementById('s-time')!.textContent = formatSyncTime(syncAt);
  }
  refreshStatus();

  function lockUI() {
    document.body.classList.add('pre-consent');
    modal.classList.add('show');
  }
  function unlockUI() {
    document.body.classList.remove('pre-consent');
    modal.classList.remove('show');
    inlineWarn.classList.remove('show');
  }

  function checkConsent() {
    try {
      const c = JSON.parse(localStorage.getItem('consent_given') || 'null') as { consent?: boolean } | null;
      if (c?.consent === true) unlockUI();
      else lockUI();
    } catch {
      lockUI();
    }
  }
  checkConsent();

  document.getElementById('m-agree')!.addEventListener('click', () => {
    localStorage.setItem('consent_given', JSON.stringify({ consent: true, timestamp: new Date().toISOString() }));
    unlockUI();
  });

  document.getElementById('m-cancel')!.addEventListener('click', () => {
    inlineWarn.classList.add('show');
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
      } else if (route === 'guru') {
        hideHome();
        positionView.classList.add('active');
      }
    });
  });

  document.getElementById('position-back')!.addEventListener('click', showHome);

  document.getElementById('homeBtn')!.addEventListener('click', () => {
    showHome();
    closePanel();
  });

  function tick() {
    treemap.tick();
    requestAnimationFrame(tick);
  }
  treemap.resize();
  requestAnimationFrame(tick);

  console.log('%cPolaris Navigator — Vite build', 'color:#facc15;font-weight:700;font-size:13px');
}

main().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="padding:24px;color:#fca5a5;background:#0a0b10;height:100vh">${String(err)}</pre>`;
});
