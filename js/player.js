/* ============================================
   player.js — 유튜브 BGM (목록 없음, 랜덤 셔플)
   재생 규칙:
   - 맨 처음엔 반드시 PULSEORIGN 재생.
   - 이후 74% 확률로 PULSEORIGN(롱폼 셔플), 26% 확률로 대체 빗소리·lo-fi.
   - PULSEORIGN 안에서 곡은 무작위(셔플), 한 바퀴 돌기 전엔 같은 곡이 다시 안 나온다.

   쇼츠 제외:
   채널 '업로드' 재생목록(UU...)을 그대로 임베드하면 쇼츠까지 섞여 나온다.
   그래서 서트레스(Shutress)와 같은 방식으로 서버 함수
   `/.netlify/functions/pulse-tracks` 가 채널 RSS에서 쇼츠(/shorts/ 링크)를 걸러낸
   롱폼 목록만 내려주고, 여기서 그 목록을 영상 단위로 재생한다.
   (함수 호출 실패 시 아래 PULSE_TRACKS 폴백 롱폼 목록을 그대로 쓴다.)
   ============================================ */
const Player = (() => {
  /* 폴백 롱폼 믹스 — 서버 함수가 최신 목록을 주면 교체된다 */
  let PULSE_TRACKS = [
    { id: '9E40d1donW4', label: '분위기 좋은 편집샵 재즈 힙합 🎷' },
    { id: 'N7XS4HasGk4', label: 'Late Night Jazz Hip Hop ☕' },
    { id: 'bAQlnYFfscE', label: 'Smooth R&B & Soul Mix' },
    { id: 'uVDR99PBFlg', label: '위험하게 분위기 좋은 둠칫 플리' },
    { id: 'G5PYccAFx3A', label: '걷다가 기분 좋아지는 도시팝 🚦' },
  ];
  const FALLBACK = ['mPZkdNFkNps', 'DSGyEsJ17cI', 'c0_ejQQcrwI', '4xDzrJKXOOY']; // 잔잔한 빗소리·lo-fi 대체곡
  const PULSE_PROB = 0.74;

  let yt = null, ytReady = false, playing = false, started = false;
  let mode = null;   // 'pulse' | 'fallback'
  let volume = 30;   // 기본 음량 30%
  let queue = [];    // 셔플된 PULSE_TRACKS 순번 — 비면 다시 채운다
  let current = null;

  const $title = document.getElementById('np-title');
  const $source = document.getElementById('np-source');
  const $play = document.getElementById('btn-play');
  const $notice = document.getElementById('yt-notice');
  const $vol = document.getElementById('vol');

  function applyVolume() { if (ytReady && yt && yt.setVolume) { try { yt.setVolume(volume); } catch (e) {} } }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* 한 바퀴 다 돌기 전엔 같은 곡이 다시 나오지 않는 셔플 */
  function refillQueue() {
    queue = PULSE_TRACKS.slice();
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    // 방금 튼 곡이 바로 이어지면 한 칸 뒤로 미룬다
    if (current && queue.length > 1 && queue[0].id === current.id) {
      queue.push(queue.shift());
    }
  }
  function nextPulseTrack() {
    if (!queue.length) refillQueue();
    return queue.shift();
  }

  function playPulse() {
    mode = 'pulse';
    $source.textContent = 'PULSEORIGN';
    const t = nextPulseTrack();
    if (!t) { playFallback(); return; }
    current = t;
    $title.textContent = t.label;
    yt.loadVideoById(t.id);
  }
  function playFallback() {
    mode = 'fallback';
    current = null;
    $source.textContent = 'Rainy Mix';
    yt.loadVideoById(pick(FALLBACK));
  }

  /* 첫 재생은 PULSEORIGN, 이후 확률에 따라.
     유튜브 API 준비 전이면 준비될 때까지 재시도. */
  function begin() {
    if (started) return;
    started = true;
    if (ytReady && yt) { playPulse(); return; }
    let tries = 0;
    const timer = setInterval(() => {
      if (ytReady && yt) { clearInterval(timer); if (!mode) playPulse(); }
      else if (++tries > 24) { clearInterval(timer); $notice.hidden = false; }
    }, 500);
  }
  function roll() {
    if (!ytReady || !yt) return;
    if (Math.random() < PULSE_PROB) playPulse();
    else playFallback();
  }

  /* PULSEORIGN 채널의 최신 롱폼 업로드로 목록 최신화 (실패 시 폴백 유지) */
  async function refreshTracks() {
    try {
      const res = await fetch('/.netlify/functions/pulse-tracks', { cache: 'no-store' });
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list) && list.length >= 3 && list.every(t => t && t.id)) {
        PULSE_TRACKS = list;
        queue = [];   // 다음 곡부터 새 목록으로
      }
    } catch (e) { /* 로컬·오프라인 등 — 폴백 목록 유지 */ }
  }

  function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => { $notice.hidden = false; };
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player('yt-player', {
        width: '100%', height: '100%',
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => { ytReady = true; applyVolume(); if (started && !mode) playPulse(); },
          onStateChange: (e) => {
            playing = (e.data === YT.PlayerState.PLAYING);
            $play.setAttribute('aria-pressed', String(playing));
            if (playing) applyVolume();
            if (playing && yt.getVideoData) {
              const d = yt.getVideoData();
              if (d && d.title) $title.textContent = d.title;
            }
            if (e.data === YT.PlayerState.ENDED) {
              // 대체곡이 끝나면 PULSEORIGN 으로 복귀, 아니면 26% 확률로 대체곡 삽입
              if (mode === 'fallback') playPulse();
              else if (Math.random() >= PULSE_PROB) playFallback();
              else playPulse();
            }
          },
          onError: () => { roll(); },
        },
      });
    };
  }

  return {
    init() {
      loadYouTubeAPI();
      refreshTracks();
      $play.addEventListener('click', () => {
        if (!ytReady || !yt) return;
        if (!started) begin();
        else if (playing) yt.pauseVideo();
        else yt.playVideo();
      });
      document.getElementById('btn-next').addEventListener('click', () => {
        if (!started) begin(); else roll();
      });
      // 음량 조절 (기본 30%)
      if ($vol) {
        volume = Number($vol.value) || 30;
        $vol.addEventListener('input', () => { volume = Number($vol.value); applyVolume(); });
      }
    },

    /* 첫 상호작용(첫 그리기 · 플레이리스트 열기) 때 BGM 시작 */
    start() { begin(); },
  };
})();
