/* ============================================
   player.js — 유튜브 BGM (목록 없음, 랜덤 셔플)
   재생 규칙:
   - 맨 처음엔 반드시 PULSEORIGN 재생.
   - 이후 74% 확률로 PULSEORIGN(채널 업로드 셔플), 26% 확률로 대체 빗소리·lo-fi.
   - PULSEORIGN 안에서 곡은 무작위(셔플).

   PULSEORIGN 소스: 채널 UCLHwI49tTuxSIesBn_Zuv1w 의 '업로드' 재생목록
   (채널ID UC... → 업로드 재생목록 UU... 로 변환: UULHwI49tTuxSIesBn_Zuv1w)
   → 재생목록 임베드 + setShuffle 로 채널 곡이 무작위 재생됩니다.
   ============================================ */
const Player = (() => {
  const PULSE_UPLOADS = 'UULHwI49tTuxSIesBn_Zuv1w';   // PULSEORIGN 업로드 재생목록(셔플)
  const FALLBACK = ['mPZkdNFkNps', 'DSGyEsJ17cI', 'c0_ejQQcrwI', '4xDzrJKXOOY']; // 잔잔한 빗소리·lo-fi 대체곡
  const PULSE_PROB = 0.74;

  let yt = null, ytReady = false, playing = false, started = false;
  let mode = null;   // 'pulse' | 'fallback'
  let volume = 30;   // 기본 음량 30%

  const $title = document.getElementById('np-title');
  const $source = document.getElementById('np-source');
  const $play = document.getElementById('btn-play');
  const $notice = document.getElementById('yt-notice');
  const $vol = document.getElementById('vol');

  function applyVolume() { if (ytReady && yt && yt.setVolume) { try { yt.setVolume(volume); } catch (e) {} } }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  function playPulse() {
    mode = 'pulse';
    $source.textContent = 'PULSEORIGN';
    yt.loadPlaylist({ listType: 'playlist', list: PULSE_UPLOADS });
    // 셔플은 재생목록 로드 직후 바로 안 먹을 수 있어 약간 뒤에 재적용
    setTimeout(() => { try { yt.setShuffle(true); yt.setLoop(true); } catch (e) {} }, 800);
  }
  function playFallback() {
    mode = 'fallback';
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
    if (Math.random() < PULSE_PROB) {
      if (mode === 'pulse') { try { yt.nextVideo(); } catch (e) { playPulse(); } }
      else playPulse();
    } else playFallback();
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
