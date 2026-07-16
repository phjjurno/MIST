/* ============================================
   legal.js — 개인정보처리방침 · 이용약관 모달
   ※ 아래 문구는 표준 템플릿입니다. 실제 서비스 운영 전 사업자·수집항목·보관기간 등을
     상황에 맞게 반드시 수정하세요. (문의: vspo2@yonsei.ac.kr)
   ============================================ */
const Legal = (() => {
  const CONTACT = 'vspo2@yonsei.ac.kr';
  const TODAY = '2026-07-16';

  const PRIVACY = `
    <p class="muted">시행일: ${TODAY}</p>
    <p>MIST : 비밀창문(이하 '서비스')는 이용자의 개인정보를 소중히 다루며, 아래와 같이 처리방침을 둡니다.</p>
    <h3>1. 수집하는 개인정보 항목</h3>
    <p>본 서비스는 회원가입이나 로그인 없이 이용할 수 있으며, 기본적으로 개인정보를 수집하지 않습니다.
       유튜브 음악 재생을 위해 YouTube 임베드 플레이어가 사용되며, 이 과정에서 YouTube(Google)의
       쿠키·이용 데이터가 Google 정책에 따라 처리될 수 있습니다.</p>
    <h3>2. 개인정보의 이용 목적</h3>
    <p>수집되는 정보가 없으므로 별도의 이용 목적이 없습니다. 문의를 위해 이메일을 보내주신 경우,
       해당 내용은 문의 응대 목적으로만 사용됩니다.</p>
    <h3>3. 보관 및 파기</h3>
    <p>문의 응대가 완료된 이메일은 관련 법령에 따른 보관 의무가 없는 한 지체 없이 파기합니다.</p>
    <h3>4. 제3자 제공</h3>
    <p>이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, YouTube 임베드 재생 시 Google의
       개인정보처리방침이 함께 적용됩니다.</p>
    <h3>5. 이용자의 권리</h3>
    <p>이용자는 언제든지 개인정보 열람·정정·삭제를 요청할 수 있습니다.</p>
    <h3>6. 문의처</h3>
    <p>개인정보 관련 문의: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
  `;

  const TERMS = `
    <p class="muted">시행일: ${TODAY}</p>
    <h3>제1조 (목적)</h3>
    <p>본 약관은 MIST : 비밀창문 서비스의 이용과 관련하여 서비스와 이용자 간의 권리·의무 및 책임사항을 규정합니다.</p>
    <h3>제2조 (서비스 내용)</h3>
    <p>본 서비스는 비 오는 창문 감성 인터랙션과 배경 음악(YouTube 임베드)을 제공하는 무료 웹 서비스입니다.</p>
    <h3>제3조 (저작권)</h3>
    <p>재생되는 음악·영상의 저작권은 각 권리자 및 YouTube에 있으며, 본 서비스는 임베드 형태로만 제공합니다.
       배경 이미지 등 서비스 내 콘텐츠의 무단 복제·배포를 금합니다.</p>
    <h3>제4조 (면책)</h3>
    <p>본 서비스는 천재지변, 외부 서비스(YouTube 등) 장애 등 불가항력으로 인한 서비스 중단에 대해
       책임을 지지 않습니다.</p>
    <h3>제5조 (문의)</h3>
    <p>서비스 관련 문의: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
  `;

  const $modal = document.getElementById('modal');
  const $title = document.getElementById('modal-title');
  const $body = document.getElementById('modal-body');

  function open(title, html) {
    $title.textContent = title;
    $body.innerHTML = html;
    $modal.hidden = false;
    document.getElementById('modal-close').focus();
  }
  function close() { $modal.hidden = true; }

  return {
    init() {
      document.getElementById('link-privacy').addEventListener('click', () => open('개인정보처리방침', PRIVACY));
      document.getElementById('link-terms').addEventListener('click', () => open('이용약관', TERMS));
      document.getElementById('modal-close').addEventListener('click', close);
      $modal.addEventListener('click', (e) => { if (e.target === $modal) close(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$modal.hidden) close(); });
    },
  };
})();
