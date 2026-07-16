/* ============================================
   belowrain.js — 아래 섹션(우산 소녀 ~ 개인정보처리방침)에 내리는 비
   - 비스듬히 떨어지는 빗줄기(길이·속도·각도·투명도 랜덤)
   - 바닥 근처에서 가끔 튀는 스플래시
   ============================================ */
const BelowRain = (() => {
  let cv, ctx, w = 0, h = 0, S = 1;
  const streaks = [];
  const splashes = []; // {x, y, t}
  let running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeStreak(spread) {
    const ang = rand(0.1, 0.28);                 // 수직 기준 기울기(rad)
    return {
      x: rand(-h * 0.3, w),
      y: spread ? rand(-h, h) : -rand(0, h * 0.4),
      len: rand(24, 86) * S,
      sp: rand(8, 20) * S,
      ang,
      o: rand(0.1, 0.34),
      th: rand(0.7, 1.7) * S,
    };
  }

  function seed() {
    streaks.length = 0;
    const n = Math.round(w / (26 * S)) + 24;
    for (let i = 0; i < n; i++) streaks.push(makeStreak(true));
  }

  function step() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';

      for (const s of streaks) {
        const dx = Math.sin(s.ang), dy = Math.cos(s.ang);
        s.x += dx * s.sp;
        s.y += dy * s.sp;
        if (s.y - s.len > h) {
          // 가끔 바닥에서 스플래시
          if (Math.random() < 0.18) splashes.push({ x: s.x, y: h - rand(2, 26) * S, t: 0 });
          Object.assign(s, makeStreak(false));
        }
        ctx.strokeStyle = `rgba(196,216,236,${s.o})`;
        ctx.lineWidth = s.th;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - dx * s.len, s.y - dy * s.len);
        ctx.stroke();
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        const p = splashes[i];
        const life = 12, t = p.t / life;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (1.5 + p.t * 0.9) * S, (0.6 + p.t * 0.3) * S, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(210,228,244,${0.35 * (1 - t)})`;
        ctx.lineWidth = Math.max(0.5, S * 0.8);
        ctx.stroke();
        if (++p.t > life) splashes.splice(i, 1);
      }
    }
    requestAnimationFrame(step);
  }

  return {
    init(canvas) {
      cv = canvas; ctx = cv.getContext('2d');
      this.resize();
      if (!running) { running = true; requestAnimationFrame(step); }
    },
    resize() {
      const rect = cv.parentElement.getBoundingClientRect();
      S = Math.min(2, window.devicePixelRatio || 1);
      w = cv.width = Math.max(1, Math.round(rect.width * S));
      h = cv.height = Math.max(1, Math.round(rect.height * S));
      seed();
    },
  };
})();
