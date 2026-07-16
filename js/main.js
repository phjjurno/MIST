/* ============================================
   main.js — 초기화 · 고해상도 렌더 · 루프 · UI 연결 · 캡처/공유
   ============================================ */
(() => {
  const $scene = document.getElementById('scene-canvas');
  const $fog = document.getElementById('fog-canvas');
  const $rain = document.getElementById('rain-canvas');
  const sceneCtx = $scene.getContext('2d');
  const $playerBar = document.getElementById('player-bar');
  const $toast = document.getElementById('toast');
  const $btnPlaylist = document.getElementById('btn-playlist');
  const $hero = document.getElementById('hero');
  const $below = document.getElementById('below');

  /* 사이트 홍보 정보 — 캡처/공유 이미지에 워터마크로 새겨집니다.
     ※ 실제 배포 도메인으로 url 을 바꿔 주세요. */
  const SITE = { name: 'MIST : 비밀창문', url: 'mist.ws-qf.web.app' };

  // 기기 픽셀 배율 (고해상도/4K 대응, 성능 위해 2로 제한)
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);

  let dirtied = false;      // 배경 자동 로테이션 상태
  let revealAmt = 0;        // 하단 닦임에 따른 노출량
  let playlistOpen = false; // 버튼으로 연 상태
  let sampleTick = 0;
  let toastTimer = null;

  function dims() {
    const s = DPR();
    return { w: Math.round(window.innerWidth * s), h: Math.round(window.innerHeight * s), s };
  }

  function paintScene() { sceneCtx.drawImage(Scene.sharp, 0, 0); }

  function sizeSceneCanvas(w, h) { $scene.width = w; $scene.height = h; }

  // 히어로 높이를 실제 뷰포트 높이에 정확히 맞춤 (캔버스와 어긋나지 않도록)
  function sizeHero() { if ($hero) $hero.style.height = window.innerHeight + 'px'; }

  function resize() {
    sizeHero();
    const { w, h, s } = dims();
    sizeSceneCanvas(w, h);
    Scene.rebuild(w, h);
    paintScene();
    Fog.resize(w, h, s);
    Rain.resize(w, h, s);
  }

  function newBackground() {
    const { w, h } = dims();
    Scene.randomize(w, h);
    paintScene();
    Fog.clearMarks();
    Fog.refog();          // 김이 스르륵 페이드인되며 새로 차오름
    dirtied = false;
  }

  function loop() {
    try {
      if (Scene.fogImage) {
        Fog.update();
        Rain.update();
        Rain.draw();

        // 김이 자리잡은 뒤에만 하단 투명도 판정 (페이드인 중 오판 방지)
        if ((sampleTick++ % 10) === 0 && Fog.isSettled()) {
          const clarity = Fog.bottomClarity();
          const target = clarity > 0.45 ? 1 : 0;
          revealAmt += (target - revealAmt) * 0.25;
          applyReveal();

          if (clarity > 0.4) dirtied = true;
          else if (dirtied && clarity < 0.05) newBackground();
        }
      }
    } catch (err) { window.__loopErr = (err && err.stack) || String(err); }
    requestAnimationFrame(loop);
  }

  /* 플레이리스트 팝업을 '플레이리스트 버튼' 바로 위에 배치(버튼을 피해서 그 위로).
     좌우로는 버튼 중심에 맞추되 화면을 벗어나지 않게 clamp, 화살표는 버튼을 가리키게. */
  function placePlayerBar() {
    const btn = $btnPlaylist.getBoundingClientRect();
    const vw = window.innerWidth;
    const pw = $playerBar.offsetWidth || 320;
    const center = btn.left + btn.width / 2;
    const left = Math.max(8, Math.min(center - pw / 2, vw - 8 - pw));
    $playerBar.style.left = left + 'px';
    $playerBar.style.right = 'auto';
    $playerBar.style.bottom = Math.round(window.innerHeight - btn.top + 12) + 'px';
    $playerBar.style.setProperty('--arrow-x', Math.round(center - left) + 'px');
  }

  /* 플레이리스트 노출 = 닦임(revealAmt) 또는 버튼(playlistOpen) 중 큰 값 */
  function applyReveal() {
    const amt = Math.max(revealAmt, playlistOpen ? 1 : 0);
    const shown = amt > 0.06;
    if (shown) placePlayerBar();
    $playerBar.style.opacity = amt.toFixed(3);
    $playerBar.style.pointerEvents = shown ? 'auto' : 'none';
    $playerBar.dataset.open = shown ? '1' : '0';
    $playerBar.setAttribute('aria-hidden', String(!shown));
  }

  function toast(msg) {
    $toast.textContent = msg;
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.hidden = true; }, 2400);
  }

  /* 캡처 이미지 하단에 사이트 홍보(로고 + 링크) 워터마크를 새김 */
  function drawBranding(o, w, h) {
    const barH = Math.round(Math.max(48, h * 0.072));
    const y0 = h - barH;
    const g = o.createLinearGradient(0, y0, 0, h);
    g.addColorStop(0, 'rgba(10,14,20,0)');
    g.addColorStop(0.35, 'rgba(10,14,20,0.42)');
    g.addColorStop(1, 'rgba(10,14,20,0.72)');
    o.fillStyle = g;
    o.fillRect(0, y0, w, barH);

    const pad = Math.round(w * 0.028);
    const cy = h - barH / 2;
    const nameSize = Math.round(barH * 0.34);
    const urlSize = Math.round(barH * 0.26);

    // 물방울 로고 마크
    o.fillStyle = '#1D9BF0';
    o.beginPath();
    const r = barH * 0.16, lx = pad + r, ly = cy;
    o.moveTo(lx, ly - r * 1.4);
    o.bezierCurveTo(lx + r * 1.2, ly, lx + r, ly + r * 1.1, lx, ly + r * 1.1);
    o.bezierCurveTo(lx - r, ly + r * 1.1, lx - r * 1.2, ly, lx, ly - r * 1.4);
    o.fill();

    o.textBaseline = 'middle';
    o.fillStyle = '#FFFFFF';
    o.font = `700 ${nameSize}px Montserrat, "Malgun Gothic", sans-serif`;
    o.textAlign = 'left';
    const tx = pad + r * 2 + Math.round(w * 0.016);
    o.fillText(SITE.name, tx, cy - urlSize * 0.55);
    o.fillStyle = 'rgba(190,220,245,0.95)';
    o.font = `500 ${urlSize}px Montserrat, "Malgun Gothic", sans-serif`;
    o.fillText(SITE.url, tx, cy + nameSize * 0.55);

    // 오른쪽: 해시태그
    o.textAlign = 'right';
    o.fillStyle = 'rgba(255,255,255,0.9)';
    o.font = `700 ${urlSize}px Montserrat, "Malgun Gothic", sans-serif`;
    o.fillText('#비오는창문 🌧', w - pad, cy);
  }

  /* ---- 캡처: 레이어를 전부 합쳐 이미지로 (+ 사이트 홍보) ---- */
  function captureBlob(cb) {
    const { w, h } = dims();
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const o = out.getContext('2d');
    o.drawImage($scene, 0, 0);
    o.drawImage($fog, 0, 0);
    o.drawImage($rain, 0, 0);
    drawBranding(o, w, h);
    out.toBlob((b) => cb(b, out), 'image/png');
  }

  function download(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mist-rain.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function doCapture() {
    captureBlob((blob) => { if (blob) { download(blob); toast('창문을 이미지로 저장했어요 📸'); } });
  }

  /* ---- 썸네일 캡처: URL 해시에 담을 소형 JPEG (브랜딩 없음) ---- */
  function captureThumbBlob(cb) {
    const MAX = 400;
    const { w, h } = dims();
    const scale = Math.min(MAX / w, MAX / h);
    const TW = Math.round(w * scale), TH = Math.round(h * scale);
    const out = document.createElement('canvas');
    out.width = TW; out.height = TH;
    const o = out.getContext('2d');
    o.drawImage($scene, 0, 0, TW, TH);
    o.drawImage($fog, 0, 0, TW, TH);
    o.drawImage($rain, 0, 0, TW, TH);
    out.toBlob((b) => cb(b), 'image/jpeg', 0.42);
  }

  /* ---- 그린 화면을 해시에 담은 공유 링크 생성 ---- */
  function buildShareUrl() {
    return new Promise((resolve) => {
      captureThumbBlob((blob) => {
        if (!blob) { resolve(location.href); return; }
        blob.arrayBuffer().then((buf) => {
          const bytes = new Uint8Array(buf);
          let s = '';
          const CHUNK = 8192;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
          }
          const b64 = btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          resolve(location.origin + location.pathname + '#s=' + b64);
        }).catch(() => resolve(location.href));
      });
    });
  }

  /* ---- 공유 링크로 접속 시: 스냅샷 오버레이 표시 ---- */
  function loadFromHash() {
    const hash = location.hash;
    if (!hash.startsWith('#s=')) return;
    const b64 = hash.slice(3);
    history.replaceState(null, '', location.pathname);
    try {
      const pad = b64.length % 4;
      const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
      const bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));

      const overlay = document.createElement('div');
      overlay.id = 'share-overlay';
      overlay.innerHTML = `<img src="${blobUrl}" alt="공유된 창문 그림" /><span class="share-hint">누군가의 비밀창문 🌧️<br><small>터치하면 나만의 창문이 열려요</small></span>`;
      document.body.appendChild(overlay);

      const dismiss = () => {
        overlay.classList.add('out');
        setTimeout(() => { overlay.remove(); URL.revokeObjectURL(blobUrl); }, 800);
      };
      overlay.addEventListener('click', dismiss, { once: true });
      setTimeout(dismiss, 5000);
    } catch (e) { /* 해시 디코드 실패 시 무시 */ }
  }

  /* ---- 공유: 그린 화면이 담긴 링크 + 이미지를 함께 ---- */
  function doShare() {
    captureBlob(async (blob) => {
      if (!blob) return;
      toast('공유 링크를 만드는 중…');
      const shareUrl = await buildShareUrl();
      const text = '비밀창문에 남긴 그림 🌧️';
      const file = new File([blob], 'mist-rain.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: SITE.name, text, url: shareUrl }); }
        catch (e) { /* 사용자가 취소 */ }
      } else if (navigator.share) {
        try { await navigator.share({ title: SITE.name, text, url: shareUrl }); download(blob); }
        catch (e) { download(blob); }
        toast('링크를 공유했어요. 저장된 이미지를 함께 올려 주세요');
      } else {
        download(blob);
        try { await navigator.clipboard.writeText(shareUrl); } catch (e) {}
        toast('이미지 저장 · 링크 복사 완료. 카톡·인스타에 붙여넣어 주세요');
      }
    });
  }

  /* ---- UI 배선 ---- */
  function bindUI() {
    const $hint = document.getElementById('hint');

    // 손 그림 손가락 선택 (각 손끝 히트존 = 버튼)
    const fingers = Array.from(document.querySelectorAll('.finger-picker .fzone'));
    const selectFinger = (g) => {
      fingers.forEach((f) => f.setAttribute('aria-checked', 'false'));
      g.setAttribute('aria-checked', 'true');
      Fog.setFingerBase(Number(g.dataset.size));
    };
    fingers.forEach((g) => {
      g.addEventListener('click', () => selectFinger(g));
    });
    // 초기 선택값(검지)의 굵기를 Fog 에 반영
    const preset = fingers.find((f) => f.getAttribute('aria-checked') === 'true');
    if (preset) Fog.setFingerBase(Number(preset.dataset.size));

    // 미세 크기 슬라이더
    const $size = document.getElementById('size-scale');
    $size.addEventListener('input', () => Fog.setSizeScale(Number($size.value)));

    // 액션 버튼
    document.getElementById('btn-refog').addEventListener('click', newBackground);
    document.getElementById('btn-wipe').addEventListener('click', () => Fog.wipeAll());
    document.getElementById('btn-capture').addEventListener('click', doCapture);
    document.getElementById('btn-share').addEventListener('click', doShare);

    // 플레이리스트 열기/닫기 — 열 때 음악도 바로 시작
    $btnPlaylist.addEventListener('click', () => {
      playlistOpen = !playlistOpen;
      $btnPlaylist.setAttribute('aria-expanded', String(playlistOpen));
      applyReveal();
      if (playlistOpen) Player.start();
    });
    // 팝업 닫기(X)
    const closePlayer = () => {
      playlistOpen = false; revealAmt = 0;
      $btnPlaylist.setAttribute('aria-expanded', 'false');
      applyReveal();
    };
    document.getElementById('pl-close').addEventListener('click', closePlayer);

    // 아래(후원/푸터)로 스크롤
    const scrollToBelow = () => { if ($below) $below.scrollIntoView({ behavior: 'smooth' }); };
    const $cue = document.getElementById('scroll-cue');
    const $toSupport = document.getElementById('to-support');
    if ($cue) $cue.addEventListener('click', scrollToBelow);
    if ($toSupport) $toSupport.addEventListener('click', scrollToBelow);

    // 첫 그리기: 힌트 숨김 + BGM 시작
    Fog.onFirstDraw(() => { $hint.classList.add('is-faded'); Player.start(); });
  }

  /* ---- 시작 ---- */
  sizeHero();
  Fog.init($fog);
  Rain.init($rain);

  const { w, h, s } = dims();
  sizeSceneCanvas(w, h);
  Fog.resize(w, h, s);
  Rain.resize(w, h, s);

  Scene.load(() => {
    const d = dims();
    Scene.randomize(d.w, d.h);
    paintScene();
    Fog.resize(d.w, d.h, d.s);
    Rain.resize(d.w, d.h, d.s);
    Fog.refog();   // 첫 로드에도 김이 스르륵 차오르며 시작
    loadFromHash(); // 공유 링크로 접속 시 스냅샷 오버레이
  });

  bindUI();
  Player.init();
  Legal.init();
  BelowRain.init(document.getElementById('below-rain'));
  applyReveal();
  loop();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); BelowRain.resize(); placePlayerBar(); }, 250);
  });
})();
