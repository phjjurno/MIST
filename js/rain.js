/* ============================================
   rain.js — 유리 위 물방울 (4K 스프라이트 프리렌더)
   레퍼런스: Rain/물방울.jpg · Rain/Rain Drop.jpg
   - 물방울을 256px 고해상도로 미리 그려두고(음영·굴절 크레센트·이중 스페큘러·림)
     매 프레임엔 스프라이트를 축소 블릿 → 4K에서도 또렷하고 훨씬 빠름.
   - 정지 방울: 모양이 제각각(원형·눌린 타원·비정형), 큰 방울일수록 드묾.
   - 흐르는 방울(간이 물리): 중력 가속, 표면장력에 멈칫, 이따금 '탁' 꺾임.
     낙하 중엔 위로 꼬리가 늘어난 티어드롭 스프라이트.
   - 비 임팩트: 유리를 톡톡 때리며 김을 도트로 지움(Fog.addRainClear) + 잔물결.
   ============================================ */
const Rain = (() => {
  let cv, ctx, w = 0, h = 0, S = 1;

  const drops = [];      // {x, y, r, v} 정지 방울 (v: 스프라이트 변형 인덱스)
  const rivulets = [];   // 흐르는 방울
  const impacts = [];    // {x, y, t}
  let MAX_DROPS = 420;
  const MAX_RIVULETS = 7;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function bias(a, b) { return a + (b - a) * Math.random() * Math.random(); }

  /* ---------- 스프라이트 프리렌더 ---------- */
  const SPR = 256;                // 스프라이트 한 변(px) — 4K 대응 고해상도
  const roundSprites = [];        // 정지 방울 변형들
  const tearSprites = [];         // 낙하 티어드롭 변형들

  /* 물방울 하나를 고해상도로 그림 (물방울.jpg 스타일)
     sx, sy: 몸통 가로/세로 비율, tail: 위로 늘어난 꼬리 비율(0=정지) */
  function renderDrop(g, cx, cy, r, sx, sy, tail) {
    const rx = r * sx, ry = r * sy;

    // 1) 유리에 드리운 부드러운 그림자 (아래로 살짝)
    let grad = g.createRadialGradient(cx, cy + ry * 0.22, r * 0.1, cx, cy + ry * 0.22, r * 1.25);
    grad.addColorStop(0, 'rgba(8,14,24,0.34)');
    grad.addColorStop(0.7, 'rgba(8,14,24,0.12)');
    grad.addColorStop(1, 'rgba(8,14,24,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx, cy + ry * 0.22, rx * 1.18, ry * 1.12, 0, 0, Math.PI * 2); g.fill();

    // 2) 몸통 (티어드롭이면 위 꼬리까지 하나의 경로로)
    const top = cy - ry - tail * r;
    g.beginPath();
    if (tail > 0) {
      g.moveTo(cx, top);
      g.bezierCurveTo(cx + rx * 0.42, top + tail * r * 0.55, cx + rx, cy - ry * 0.5, cx + rx, cy + ry * 0.12);
      g.arc(cx, cy + ry * 0.12, rx, 0, Math.PI, false);
      g.bezierCurveTo(cx - rx, cy - ry * 0.5, cx - rx * 0.42, top + tail * r * 0.55, cx, top);
    } else {
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    g.closePath();

    grad = g.createRadialGradient(cx - rx * 0.3, cy - ry * 0.35, r * 0.06, cx, cy, Math.max(rx, ry) * (1 + tail * 0.4));
    grad.addColorStop(0, 'rgba(235,244,252,0.34)');
    grad.addColorStop(0.45, 'rgba(165,188,214,0.13)');
    grad.addColorStop(0.8, 'rgba(46,62,86,0.30)');
    grad.addColorStop(1, 'rgba(12,20,34,0.46)');
    g.fillStyle = grad;
    g.fill();

    // 3) 아래쪽 굴절 크레센트 — 빛이 모여 바닥이 환하게 (레퍼런스의 핵심)
    g.save();
    g.clip();
    grad = g.createRadialGradient(cx, cy + ry * 0.62, r * 0.05, cx, cy + ry * 0.52, ry * 0.85);
    grad.addColorStop(0, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.45, 'rgba(240,248,255,0.36)');
    grad.addColorStop(1, 'rgba(240,248,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx, cy + ry * 0.5, rx * 0.85, ry * 0.62, 0, 0, Math.PI * 2); g.fill();

    // 위쪽은 배경이 비쳐 어두운 띠 (굴절 반전)
    grad = g.createLinearGradient(0, cy - ry, 0, cy);
    grad.addColorStop(0, 'rgba(15,24,40,0.34)');
    grad.addColorStop(1, 'rgba(15,24,40,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx, cy - ry * 0.4, rx * 0.94, ry * 0.6, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // 4) 얇고 어두운 림 (방울 윤곽)
    g.beginPath();
    if (tail > 0) {
      g.moveTo(cx, top);
      g.bezierCurveTo(cx + rx * 0.42, top + tail * r * 0.55, cx + rx, cy - ry * 0.5, cx + rx, cy + ry * 0.12);
      g.arc(cx, cy + ry * 0.12, rx, 0, Math.PI, false);
      g.bezierCurveTo(cx - rx, cy - ry * 0.5, cx - rx * 0.42, top + tail * r * 0.55, cx, top);
      g.closePath();
    } else {
      g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    g.lineWidth = r * 0.045;
    g.strokeStyle = 'rgba(18,28,44,0.42)';
    g.stroke();

    // 5) 스페큘러 하이라이트 — 큰 점(좌상) + 작은 점(우상)
    grad = g.createRadialGradient(cx - rx * 0.34, cy - ry * 0.42, 0, cx - rx * 0.34, cy - ry * 0.42, r * 0.3);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(cx - rx * 0.34, cy - ry * 0.42, r * 0.26, r * 0.18, -0.5, 0, Math.PI * 2); g.fill();

    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.beginPath(); g.arc(cx + rx * 0.3, cy - ry * 0.5, r * 0.07, 0, Math.PI * 2); g.fill();
  }

  function makeSprite(sx, sy, tail) {
    const c = document.createElement('canvas');
    c.width = SPR; c.height = SPR * (tail > 0 ? 1.5 : 1);
    const g = c.getContext('2d');
    const r = SPR * 0.3;
    renderDrop(g, SPR / 2, c.height - SPR / 2, r, sx, sy, tail);
    // 블릿 기준값 저장: 몸통 중심/반지름의 캔버스 내 비율
    c._r = r; c._cx = SPR / 2; c._cy = c.height - SPR / 2;
    return c;
  }

  function buildSprites() {
    if (roundSprites.length) return;
    // 정지 방울: 모양 제각각 (원형·가로 눌림·세로 눌림·비정형)
    const shapes = [[1, 1], [1.12, 0.92], [0.9, 1.08], [1.2, 0.85], [0.95, 0.95], [1.06, 1.02]];
    for (const [sx, sy] of shapes) roundSprites.push(makeSprite(sx, sy, 0));
    // 낙하 방울: 꼬리 길이 다양
    for (const tail of [0.9, 1.4, 2.0]) tearSprites.push(makeSprite(0.92, 1.0, tail));
  }

  /* 스프라이트 블릿: (x,y) = 몸통 중심, r = 몸통 반지름(기기픽셀) */
  function blit(sp, x, y, r, alpha) {
    const k = r / sp._r;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp, x - sp._cx * k, y - sp._cy * k, sp.width * k, sp.height * k);
    ctx.globalAlpha = 1;
  }

  /* ---------- 상태 ---------- */
  function maxR() { return 4.6 * S; }   // 방울이 이보다 커지지 않음 (너무 큰 방울 방지)
  function addDrop(x, y, r) {
    if (drops.length >= MAX_DROPS) drops.shift();
    drops.push({ x, y, r: Math.min(r, maxR()), v: Math.floor(Math.random() * roundSprites.length) });
  }

  function startRivulet(x, y, r) {
    if (rivulets.length >= MAX_RIVULETS) return;
    rivulets.push({
      x, y, r,
      vy: rand(0.1, 0.4) * S,
      vx: 0,
      grav: rand(0.03, 0.06) * S,
      vMax: rand(1.6, 3.4) * S,
      straight: Math.random() < 0.5,
      kinkIn: Math.floor(rand(18, 70)),
      held: Math.floor(rand(0, 30)),
      v: Math.floor(Math.random() * tearSprites.length),
    });
  }

  function spawnImpact(x, y) {
    const r = bias(1.2, 3.6) * S;
    impacts.push({ x, y, t: 0 });
    addDrop(x, y, bias(1.2, 2.6) * S);
    Fog.addRainClear(x, y, r);
    if (Math.random() < 0.5) {
      const a = rand(0, Math.PI * 2), d = rand(3, 9) * S;
      addDrop(x + Math.cos(a) * d, y + Math.sin(a) * d, bias(0.4, 1.0) * S);
    }
    if (Math.random() < 0.02) startRivulet(x, y, bias(2.0, 3.4) * S);
  }

  function drawImpact(im) {
    const life = 14, t = im.t / life;
    const rr = (2 + im.t * 0.9) * S;
    ctx.beginPath();
    ctx.arc(im.x, im.y, rr, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(0.6, 1.4 * S * (1 - t));
    ctx.strokeStyle = `rgba(230,242,252,${0.4 * (1 - t)})`;
    ctx.stroke();
  }

  return {
    init(canvas) { cv = canvas; ctx = cv.getContext('2d'); buildSprites(); },

    resize(width, height, dpr) {
      w = width; h = height; S = dpr || 1;
      MAX_DROPS = Math.round(460 * (w * h) / (1400 * 900) + 140);
      drops.length = 0; rivulets.length = 0; impacts.length = 0;
      const seed = Math.round((w * h) / 8000);
      for (let i = 0; i < seed; i++) {
        // 잔 방울 위주 + 가끔 조금 큰 방울 (상한 maxR 로 제한)
        const r = Math.random() < 0.12 ? bias(3.0, 4.6) * S : bias(0.5, 3.0) * S;
        addDrop(rand(0, w), rand(0, h), r);
      }
    },

    update() {
      if (Math.random() < 0.5) {
        const r = Math.random() < 0.1 ? bias(3.0, 4.6) * S : bias(0.4, 2.8) * S;
        addDrop(rand(0, w), rand(0, h), r);
      }

      // 비처럼 도트로 김 지우기 — 매 프레임 1~2방울이 유리를 톡톡 때림
      const hits = Math.random() < 0.55 ? 1 : (Math.random() < 0.4 ? 2 : 0);
      for (let k = 0; k < hits; k++) spawnImpact(rand(0, w), rand(0, h));

      // 흐르는 방울은 가끔만
      if (Math.random() < 0.008) startRivulet(rand(0, w), rand(-10, h * 0.35), bias(1.8, 3.8) * S);

      for (let i = rivulets.length - 1; i >= 0; i--) {
        const d = rivulets[i];

        if (d.held > 0) {
          d.held--;
          d.vy *= 0.8;
        } else {
          d.vy = Math.min(d.vy + d.grav, d.vMax);
          if (--d.kinkIn <= 0) {
            d.kinkIn = Math.floor(rand(22, 80));
            d.vx = (d.straight ? rand(-0.3, 0.3) : rand(-1.2, 1.2)) * S;
            if (Math.random() < 0.28) d.held = Math.floor(rand(6, 22));
          }
        }
        d.vx *= 0.94;
        d.x += d.vx;
        d.y += d.vy;

        Fog.addRainClear(d.x, d.y, d.r * 1.15);

        if (Math.random() < 0.3) addDrop(d.x + rand(-1, 1) * S, d.y - d.r * rand(1.4, 2.2), bias(0.4, 1.2) * S);

        for (let j = drops.length - 1; j >= 0; j--) {
          const s = drops[j];
          if (Math.abs(s.x - d.x) < d.r + s.r && Math.abs(s.y - d.y) < d.r + s.r) {
            d.r = Math.min(d.r + s.r * 0.06, 5 * S);
            drops.splice(j, 1);
          }
        }
        if (d.y > h + 14 * S || d.x < -20 * S || d.x > w + 20 * S) rivulets.splice(i, 1);
      }

      for (let i = impacts.length - 1; i >= 0; i--) if (++impacts[i].t > 14) impacts.splice(i, 1);
    },

    draw() {
      ctx.clearRect(0, 0, w, h);
      for (const s of drops) blit(roundSprites[s.v], s.x, s.y, s.r, 0.92);
      for (const d of rivulets) blit(tearSprites[d.v], d.x, d.y, d.r, 0.95);
      for (const im of impacts) drawImpact(im);
    },
  };
})();
