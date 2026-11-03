/* ============================================
   player.js — 유튜브 BGM (PULSEORIGN 롱폼)

   서트레스(Shutress)와 같은 구조로 만든다.
   - YT IFrame API 객체(YT.Player)를 쓰지 않는다. www-widgetapi.js 로딩이
     느리거나 막히면 아무 소리도 안 나던 원인이라, iframe 의 src 를 직접 갈아끼운다.
   - 곡 목록을 화면에 그려서 PULSEORIGN 롱폼을 눈으로 보고 고를 수 있게 한다.
   - 상태(종료)와 음량은 postMessage 로 주고받는다.

   재생 규칙: 첫 곡은 반드시 PULSEORIGN. 이후 74% PULSEORIGN, 26% 빗소리·lo-fi.
   쇼츠 제외: 목록은 /api/pulse-tracks 가 채널 /videos 탭에서
   롱폼만 골라 내려준다. (실패 시 아래 내장 롱폼 목록)
   ============================================ */
const Player = (() => {
  const YT_ORIGIN = 'https://www.youtube.com';
  const PULSE_PROB = 0.74;

  /* 내장 폴백 — 전부 롱폼 */
  let PULSE_TRACKS = [
    { id: '9E40d1donW4', label: '분위기 좋은 편집샵 재즈 힙합 🎷' },
    { id: 'N7XS4HasGk4', label: 'Late Night Jazz Hip Hop ☕' },
    { id: 'bAQlnYFfscE', label: 'Smooth R&B & Soul Mix' },
    { id: 'uVDR99PBFlg', label: '위험하게 분위기 좋은 둠칫 플리' },
    { id: 'G5PYccAFx3A', label: '걷다가 기분 좋아지는 도시팝 🚦' },
  ];
  const RAINY = [
    { id: 'mPZkdNFkNps', label: '창문 빗소리와 천둥' },
    { id: 'DSGyEsJ17cI', label: 'Rainy Jazz & Bossa Nova' },
    { id: 'c0_ejQQcrwI', label: '비 오는 밤 카페 앰비언스' },
    { id: '4xDzrJKXOOY', label: 'synthwave radio 🌌' },
  ];

  let frame, started = false, playing = false;
  let mode = null;            // 'pulse' | 'rainy'
  let current = null;
  let volume = 30;
  let queue = [];             // 셔플 큐 — 한 바퀴 전엔 같은 곡 반복 없음
  let lastAdvance = 0;

  const $ = (id) => document.getElementById(id);
  let $title, $source, $play, $notice, $vol, $presets;

  const musicIcon = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  const rand = (a) => a[Math.floor(Math.random() * a.length)];

  function ytSrc(id, autoplay) {
    const origin = encodeURIComponent(location.origin);
    return `${YT_ORIGIN}/embed/${id}?rel=0&playsinline=1&enablejsapi=1&origin=${origin}` +
           (autoplay ? '&autoplay=1' : '');
  }

  /* 트랙을 로드할 때마다 listening 등록해야 종료 이벤트가 온다 */
  function register() {
    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: 'mist-yt', channel: 'widget' }), YT_ORIGIN);
    } catch (e) { /* 아직 로드 전 */ }
  }
  function command(func, args) {
    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: args || [] }), YT_ORIGIN);
    } catch (e) { /* 아직 로드 전 */ }
  }

  function markActive(id) {
    document.querySelectorAll('.pl-preset').forEach((p) => p.classList.toggle('is-on', p.dataset.id === id));
  }

  function renderPresets() {
    if (!$presets) return;
    $presets.innerHTML = PULSE_TRACKS
      .map((t) => `<button class="pl-preset" type="button" data-id="${t.id}">${musicIcon}<span>${t.label}</span></button>`)
      .join('');
    markActive(current ? current.id : '');
  }

  function refillQueue() {
    queue = PULSE_TRACKS.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (current && queue.length > 1 && queue[0].id === current.id) queue.push(queue.shift());
  }

  function playTrack(t, kind, autoplay) {
    if (!t) return;
    mode = kind;
    current = t;
    $source.textContent = kind === 'pulse' ? 'PULSEORIGN' : 'Rainy Mix';
    $title.textContent = t.label;
    frame.src = ytSrc(t.id, autoplay !== false);
    $notice.hidden = true;
    markActive(t.id);
    setTimeout(() => { register(); command('setVolume', [volume]); }, 900);
  }

  function playPulse() {
    if (!queue.length) refillQueue();
    playTrack(queue.shift() || PULSE_TRACKS[0], 'pulse');
  }
  function playRainy() { playTrack(rand(RAINY), 'rainy'); }

  /* 첫 상호작용 때 시작 — 첫 곡은 무조건 PULSEORIGN */
  function begin() {
    if (started) return;
    started = true;
    playPulse();
  }
  function roll() {
    if (!started) { begin(); return; }
    if (Math.random() < PULSE_PROB) playPulse(); else playRainy();
  }

  /* 곡이 끝나면 다음 곡 (종료 이벤트 중복 방지) */
  function advance() {
    const now = Date.now();
    if (now - lastAdvance < 3000) return;
    lastAdvance = now;
    if (mode === 'rainy') playPulse();
    else if (Math.random() < PULSE_PROB) playPulse();
    else playRainy();
  }

  function onMessage(e) {
    if (String(e.origin).indexOf('youtube.com') < 0) return;
    let d;
    try { d = JSON.parse(e.data); } catch (err) { return; }
    const state = d.event === 'onStateChange' ? d.info
      : (d.event === 'infoDelivery' && d.info && typeof d.info.playerState === 'number') ? d.info.playerState
      : null;
    if (state !== null) {
      playing = (state === 1);
      $play.setAttribute('aria-pressed', String(playing));
      if (state === 0) advance();        // 0 = 종료
    }
    if (d.event === 'onError') advance();
    // 유튜브가 준 실제 제목이 있으면 그걸로 갱신
    const vd = d.info && d.info.videoData;
    if (vd && vd.title) $title.textContent = vd.title;
  }

  /* PULSEORIGN 채널 최신 롱폼으로 목록 최신화 (실패 시 내장 목록 유지) */
  async function refreshTracks() {
    try {
      const res = await fetch('/api/pulse-tracks', { cache: 'no-store' });
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list) && list.length >= 3 && list.every((t) => t && t.id && t.label)) {
        PULSE_TRACKS = list;
        queue = [];
        renderPresets();
      }
    } catch (e) { /* 로컬·오프라인 — 내장 목록 유지 */ }
  }

  return {
    init() {
      frame = $('yt-player');
      $title = $('np-title'); $source = $('np-source'); $play = $('btn-play');
      $notice = $('yt-notice'); $vol = $('vol'); $presets = $('pl-presets');
      if (!frame) return;

      addEventListener('message', onMessage);
      renderPresets();
      refreshTracks();

      /* 첫 곡을 미리 걸어두되 소리는 내지 않는다 (사용자 조작 전 무음) */
      refillQueue();
      const first = queue[0] || PULSE_TRACKS[0];
      current = first;
      $source.textContent = 'PULSEORIGN';
      frame.src = ytSrc(first.id, false);
      markActive(first.id);

      $play.addEventListener('click', () => {
        if (!started) { begin(); return; }
        if (playing) command('pauseVideo'); else command('playVideo');
      });
      $('btn-next').addEventListener('click', roll);
      const $shuffle = $('btn-shuffle');
      if ($shuffle) $shuffle.addEventListener('click', roll);

      /* 목록에서 직접 고르기 */
      if ($presets) {
        $presets.addEventListener('click', (e) => {
          const chip = e.target.closest && e.target.closest('.pl-preset[data-id]');
          if (!chip) return;
          started = true;
          const t = PULSE_TRACKS.find((x) => x.id === chip.dataset.id);
          if (t) playTrack(t, 'pulse');
        });
      }

      if ($vol) {
        volume = Number($vol.value) || 30;
        $vol.addEventListener('input', () => { volume = Number($vol.value); command('setVolume', [volume]); });
      }
    },

    /* 첫 그리기 · 플레이리스트 열기 때 BGM 시작 */
    start() { begin(); },
  };
})();
