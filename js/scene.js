/* ============================================
   scene.js — 배경 사진(사용자 제공 5장)을 창밖 풍경으로 사용
   - sharp    : 선명한 풍경 (닦으면 보이는 모습) — 사진을 화면에 cover-fit
   - fogImage : 위 풍경을 블러 + 김서림 틴트로 뿌옇게 만든 "김 서린 유리"
   - 전달받는 w,h 는 '기기 픽셀'(고해상도) 단위 — 4K/레티나에서 선명하게 렌더.
   - 리셋될 때마다 5장 중 무작위로 한 장이 바뀝니다.
   ============================================ */
const Scene = (() => {
  const FILES = ['img/lake.webp', 'img/parkinglot.webp', 'img/road.webp', 'img/roof.webp', 'img/tree.webp', 'img/rainreal.webp'];
  const images = [];
  let currentIndex = -1;
  let sharp = null, fogImage = null;

  function makeRandom(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function drawCover(ctx, img, w, h) {
    const ir = img.width / img.height, cr = w / h;
    let dw, dh, dx, dy;
    if (ir > cr) { dh = h; dw = h * ir; dx = (w - dw) / 2; dy = 0; }
    else { dw = w; dh = w / ir; dx = 0; dy = (h - dh) / 2; }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function buildSharp(w, h) {
    sharp = document.createElement('canvas');
    sharp.width = w; sharp.height = h;
    const ctx = sharp.getContext('2d');
    const img = images[currentIndex];
    if (img && img.complete && img.naturalWidth) drawCover(ctx, img, w, h);
    else { ctx.fillStyle = '#101826'; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = 'rgba(10,15,25,0.12)';
    ctx.fillRect(0, 0, w, h);
  }

  function buildFog(w, h) {
    fogImage = document.createElement('canvas');
    fogImage.width = w; fogImage.height = h;
    const ctx = fogImage.getContext('2d');
    const rnd = makeRandom(77);

    // 블러 강도는 해상도에 비례 (고해상도에서도 같은 정도로 뿌옇게)
    const blur = Math.max(10, Math.round(w * 0.013));
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(sharp, -blur * 1.5, -blur * 1.5, w + blur * 3, h + blur * 3);
    ctx.filter = 'none';

    // 1차 밀키 베이스: 뿌연 흰빛 층
    ctx.fillStyle = 'rgba(218,228,236,0.28)';
    ctx.fillRect(0, 0, w, h);

    const tint = ctx.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, 'rgba(214,224,234,0.68)');
    tint.addColorStop(0.5, 'rgba(198,210,224,0.60)');
    tint.addColorStop(1, 'rgba(176,190,206,0.64)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 42; i++) {
      const x = rnd() * w, y = rnd() * h, r = (60 + rnd() * 240) * (w / 1400);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.07 + rnd() * 0.13;
      g.addColorStop(0, `rgba(228,236,244,${a})`);
      g.addColorStop(1, 'rgba(228,236,244,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vig.addColorStop(0, 'rgba(10,15,25,0)');
    vig.addColorStop(1, 'rgba(10,15,25,0.5)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  return {
    load(done) {
      let pending = FILES.length;
      const finish = () => { if (--pending === 0) done(); };
      FILES.forEach((file, i) => {
        const img = new Image();
        img.onload = finish; img.onerror = finish;
        img.src = encodeURI(file);
        images[i] = img;
      });
    },
    randomize(w, h) {
      if (images.length > 1) {
        let n; do { n = Math.floor(Math.random() * images.length); } while (n === currentIndex);
        currentIndex = n;
      } else currentIndex = 0;
      buildSharp(w, h); buildFog(w, h);
    },
    rebuild(w, h) {
      if (currentIndex < 0) currentIndex = 0;
      buildSharp(w, h); buildFog(w, h);
    },
    get sharp() { return sharp; },
    get fogImage() { return fogImage; },
    get currentName() { return FILES[currentIndex] || ''; },
  };
})();
