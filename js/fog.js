/* ============================================
   fog.js — 김서림 레이어 (나이 기반, 아주 느린 소멸)
   - 손끝으로 드래그하면 김이 닦여 아래 풍경이 드러난다.
   - 닦인 자국은 찍힌 시각(born)을 기억. 15초 동안 선명히 유지되다가,
     이후 아주 오랜 시간(기본 60초)에 걸쳐 서서히 다시 김이 서린다
     → "먼저 그린 곳부터" 아주 천천히 사라짐.
   - 좌표/크기는 기기 픽셀(고해상도) 단위. 손가락 굵기는 기기 배율(scale)을 곱함.
   ============================================ */
const Fog = (() => {
  let cv, ctx, w = 0, h = 0, scale = 1;

  // ---- 타이밍(ms) ----
  const DRAW_LIFE = 180000;  // 그린 자국이 선명히 유지되는 시간 (3분)
  const DRAW_FADE = 50000;   // 그 뒤 자연스럽게 김이 다시 차오르는 시간 (50초)
  const RAIN_LIFE = 600;
  const RAIN_FADE = 2400;
  const WIPE_LIFE = 30000;
  const WIPE_FADE = 50000;

  const REFOG_MS = 3200;     // '안개 창' 때 김이 페이드인되며 차오르는 시간

  const drawDots = [];       // {x, y, born, sprite, r}
  const rainDots = [];       // {x, y, born, r}
  let wipeStamp = null;
  let fogBorn = -1e9;        // 김이 새로 서리기 시작한 시각

  // 그린 자국은 시간이 지나면 자연스럽게 김으로 다시 차오르며 사라진다(80초).
  // '개수 초과 시 오래된 것부터 즉시 삭제'하는 하드컷은 두지 않음 — 아주 큰 안전값만.
  const MAX_DRAW = 60000;

  let fingerBase = 18;       // 선택된 손가락 기본 굵기(px, 기기픽셀 아님)
  let sizeScale = 1;         // 슬라이더 미세 조절 배율
  let drawing = false, last = null, onDrawStart = null;

  const sprites = {};
  let rainSprite = null;
  let sampleCanvas = null;

  function makeSprite(radius, soft) {
    const d = Math.max(2, Math.ceil(radius * 2));
    const c = document.createElement('canvas');
    c.width = d; c.height = d;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(soft, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(radius, radius, radius, 0, Math.PI * 2); g.fill();
    return c;
  }
  // 실제 그려질 반지름(기기픽셀) = 기본굵기 × 슬라이더배율 × 기기배율
  function currentRadius() { return Math.max(2, fingerBase * sizeScale * scale); }
  function spriteFor(r) {
    const key = Math.round(r);
    if (!sprites[key]) sprites[key] = makeSprite(key, 0.62);
    return sprites[key];
  }

  /* 자국 세기: life 동안 1 유지 → fade 동안 코사인 이징으로 서서히 0
     (끝날수록 김이 '페이드인'되며 부드럽게 다시 차오르는 느낌) */
  function strength(age, life, fade) {
    if (age < life) return 1;
    if (age < life + fade) {
      const t = (age - life) / fade;
      return 0.5 + 0.5 * Math.cos(Math.PI * t);
    }
    return 0;
  }

  function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

  function addStroke(a, b) {
    const now = performance.now();
    const r = currentRadius();
    const sp = spriteFor(r);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const step = Math.max(1, Math.ceil(dist / (r * 0.35)));
    for (let i = 0; i <= step; i++) {
      const t = i / step;
      drawDots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, born: now, sprite: sp, r });
    }
    while (drawDots.length > MAX_DRAW) drawDots.shift();
  }

  // 화면(CSS) 좌표 → 캔버스(기기픽셀) 좌표
  function pointerPos(e) {
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width, sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function bindEvents() {
    cv.addEventListener('pointerdown', (e) => {
      drawing = true; last = pointerPos(e);
      addStroke(last, last);
      cv.setPointerCapture(e.pointerId);
      if (onDrawStart) { onDrawStart(); onDrawStart = null; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pointerPos(e); addStroke(last, p); last = p;
    });
    const stop = () => { drawing = false; last = null; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);
  }

  return {
    init(canvas) {
      cv = canvas; ctx = cv.getContext('2d');
      bindEvents();
    },

    resize(width, height, dpr) {
      w = width; h = height; scale = dpr || 1;
      cv.width = w; cv.height = h;
      // 고해상도 소프트 스프라이트(크게 만들어 축소 렌더 → 4K에서도 매끈)
      rainSprite = makeSprite(32, 0.35);
    },

    update() {
      const now = performance.now();
      while (drawDots.length && now - drawDots[0].born > DRAW_LIFE + DRAW_FADE) drawDots.shift();
      while (rainDots.length && now - rainDots[0].born > RAIN_LIFE + RAIN_FADE) rainDots.shift();
      if (wipeStamp && now - wipeStamp.born > WIPE_LIFE + WIPE_FADE) wipeStamp = null;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      // 새로 서리는 김은 스르륵 페이드인되며 창을 채움
      ctx.globalAlpha = smooth((now - fogBorn) / REFOG_MS);
      ctx.drawImage(Scene.fogImage, 0, 0);

      ctx.globalCompositeOperation = 'destination-out';
      if (wipeStamp) {
        ctx.globalAlpha = strength(now - wipeStamp.born, WIPE_LIFE, WIPE_FADE);
        ctx.fillRect(0, 0, w, h);
      }
      // 빗방울이 유리를 때려 김을 '도트'로 지움 (방울마다 크기 다름)
      for (let i = 0; i < rainDots.length; i++) {
        const d = rainDots[i];
        const s = strength(now - d.born, RAIN_LIFE, RAIN_FADE);
        if (s <= 0) continue;
        ctx.globalAlpha = s * 0.6;
        const rr = d.r;
        ctx.drawImage(rainSprite, d.x - rr, d.y - rr, rr * 2, rr * 2);
      }
      for (let i = 0; i < drawDots.length; i++) {
        const d = drawDots[i];
        const s = strength(now - d.born, DRAW_LIFE, DRAW_FADE);
        if (s <= 0) continue;
        ctx.globalAlpha = s;
        ctx.drawImage(d.sprite, d.x - d.r, d.y - d.r);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },

    // r 은 이미 기기픽셀 단위(호출부에서 scale 반영)
    addRainClear(x, y, r) {
      rainDots.push({ x, y, born: performance.now(), r: Math.max(2, r || 6 * scale) });
      if (rainDots.length > 2600) rainDots.shift();
    },

    wipeAll() { wipeStamp = { born: performance.now() }; },
    clearMarks() { drawDots.length = 0; rainDots.length = 0; wipeStamp = null; },
    /* '안개 창': 김이 0에서부터 페이드인되며 새로 차오름 */
    refog() { fogBorn = performance.now(); },
    /* 페이드인이 끝나 김이 완전히 자리잡았는지 (하단 투명도 판정용) */
    isSettled() { return performance.now() - fogBorn > REFOG_MS + 300; },

    bottomClarity() {
      const sw = 48, sh = 12;
      const off = sampleCanvas || (sampleCanvas = document.createElement('canvas'));
      off.width = sw; off.height = sh;
      const octx = off.getContext('2d');
      octx.clearRect(0, 0, sw, sh);
      octx.drawImage(cv, 0, h * 0.76, w, h * 0.24, 0, 0, sw, sh);
      const data = octx.getImageData(0, 0, sw, sh).data;
      let cleared = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 70) cleared++;
      return cleared / (sw * sh);
    },

    setFingerBase(px) { fingerBase = px; },
    setSizeScale(s) { sizeScale = s; },
    onFirstDraw(fn) { onDrawStart = fn; },
  };
})();
