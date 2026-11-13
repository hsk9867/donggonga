// 공개 페이지 화면
import { esc, rich, won, kstDay, allSchools, subjects, schoolsOf, levelOf, LEVELS, GRADES, todayKst } from './lib.js';

const V = '13'; // 정적 파일 캐시 버전

const NAV = [
  ['/exams', '시험지 올리기'],
  ['/exams/missing', '시험지 현황'],
  ['/seminars', '설명회'],
  ['/notice', '공지사항'],
  ['/consult', '상담·문자 신청'],
];

const icon = {
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};

export function layout(ctx, { title, desc, body, scripts = '', bare = false }) {
  const { S, user, path } = ctx;
  const site = S.site;
  const pageTitle = title ? `${title} | ${site.name}` : `${site.name} · ${site.full}`;
  const description = desc || `${site.name}(${site.full}) — ${site.tagline}. 우리 학교 내신 시험지를 올리고 보상을 받아 가세요.`;
  const nav = NAV.map(([href, label]) =>
    `<a href="${href}"${path === href || (href !== '/exams' && path.startsWith(href + '/')) ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const account = user
    ? `<a class="hdr-link" href="/my">${icon.user}<span>${esc(user.student_name)} 님</span></a>
       <form method="post" action="/logout" class="inline"><button class="hdr-link hdr-plain">로그아웃</button></form>`
    : `<a class="hdr-link" href="/login">${icon.user}<span>로그인</span></a><a class="btn btn-sm btn-brand hdr-join" href="/signup">회원가입</a>`;
  const tel = site.phone ? `<a class="foot-tel" href="tel:${esc(site.phone.replace(/[^\d+]/g, ''))}">${esc(site.phone)}</a>` : '';
  const info = [
    site.hours && ['상담시간', site.hours],
    site.owner && ['대표자', site.owner],
    site.bizno && ['사업자번호', site.bizno],
    site.address && ['주소', site.address],
    site.email && ['이메일', site.email],
  ].filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="ko_KR">
<meta property="og:image" content="${ctx.url.origin}/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0a1e56">
<link rel="icon" href="/img/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<script>document.documentElement.className = 'js';</script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/css/style.css?v=${V}">
</head>
<body${bare ? ' class="bare"' : ''}>
<a class="skip" href="#main">본문 바로가기</a>
<header class="hdr" data-hdr>
  <div class="hdr-in">
    <a class="brand" href="/" aria-label="${esc(site.name)} 홈">
      <img class="brand-logo" src="/img/logo.png" alt="${esc(site.name)}" width="94" height="32">
    </a>
    <nav class="gnb" aria-label="주 메뉴">${nav}</nav>
    <div class="hdr-r">${account}
      <button class="burger" type="button" aria-label="메뉴 열기" aria-expanded="false" data-burger><span></span><span></span></button>
    </div>
  </div>
  <div class="mnav" data-mnav hidden>
    <nav aria-label="모바일 메뉴">${nav}</nav>
    <div class="mnav-acc">${user
      ? `<a href="/my">마이페이지</a><form method="post" action="/logout" class="inline"><button class="hdr-plain">로그아웃</button></form>`
      : `<a href="/login">로그인</a><a href="/signup">회원가입</a>`}</div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-in">
    <div class="foot-brand">
      <a class="foot-logo" href="/"><img src="/img/logo-full.png" alt="${esc(site.name)} · ${esc(site.full)}" width="220" height="100" loading="lazy"></a>
      ${tel ? `<p class="foot-label">문의</p>${tel}` : ''}
      ${/^https:\/\//.test(site.kakao) ? `<a class="chip" href="${esc(site.kakao)}" target="_blank" rel="noopener">카카오톡 채널 문의 ${icon.chev}</a>` : ''}
      ${info ? `<dl class="foot-info">${info}</dl>` : ''}
    </div>
    <nav class="foot-nav" aria-label="바로가기">${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
    <div class="foot-note">
      <p>${esc(site.tagline)}</p>
      <p class="muted">올려 주신 시험지는 학교별 내신 분석 자료로만 사용합니다.</p>
    </div>
  </div>
  <div class="foot-bottom">
    <span>© ${new Date().getFullYear()} ${esc(site.name)}. All rights reserved.</span>
    <span><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a></span>
  </div>
</footer>
${bare ? '' : `<div class="fab">
  <a class="fab-btn fab-dark" href="/exams">📝 <b>시험지 올리기</b><span>${won(S.reward.amount)}원 보상</span></a>
  <a class="fab-btn fab-brand" href="/consult">💬 <b>문자수신 신청</b></a>
</div>
<div class="dock">
  <a class="dock-sub" href="/consult">문자수신 신청</a>
  <a class="dock-main" href="/exams">시험지 올리고 보상 받기</a>
</div>`}
<script src="/js/site.js?v=${V}" defer></script>
${scripts}
</body>
</html>`;
}

// ── 조각 ──────────────────────────────────────────────────────────────
export const pageHead = (title, sub = '', extra = '') => `
<section class="page-head">
  <span class="shape s1" aria-hidden="true"></span><span class="shape s2" aria-hidden="true"></span>
  <div class="col">
    <h1>${title}</h1>
    ${sub ? `<p>${sub}</p>` : ''}
    ${extra}
  </div>
</section>`;

export const alertBox = (msg, kind = 'bad') => (msg ? `<div class="alert alert-${kind}" role="alert">${esc(msg)}</div>` : '');

const seminarEnded = (s) => s.closed || (s.date && s.date < todayKst());
const dateParts = (d) => {
  if (!d) return { md: '상시', dow: '' };
  const [y, m, day] = d.split('-').map(Number);
  const dow = ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return { md: `${m}.${day}`, dow };
};

function seminarCard(s) {
  const p = dateParts(s.date);
  return `<article class="card sem-card" data-reveal>
    <span class="ribbon" aria-hidden="true">설명회</span>
    <span class="sem-when">${p.md}${p.dow ? ` (${p.dow})` : ''}</span>
    <h3><a href="/seminars/${s.id}">${esc(s.title)}</a></h3>
    <p class="sem-meta">${[s.target, s.when_text, s.place].filter(Boolean).map(esc).join(' · ')}</p>
  </article>`;
}

// ── 홈 ────────────────────────────────────────────────────────────────
export function homePage(ctx, { stats, need, bySchool, seminars, notices }) {
  const { S } = ctx;
  const h = S.hero;
  const amount = won(S.reward.amount);
  const methods = [S.reward.bank && '계좌 입금', S.reward.coupon && S.reward.couponLabel].filter(Boolean).join(' 또는 ');

  const body = `
<section class="hero">
  <span class="shape s1" aria-hidden="true"></span><span class="shape s2" aria-hidden="true"></span>
  <div class="col hero-grid">
    <div class="hero-copy">
      <h1><span>${esc(h.line1)}</span> <span class="mark">${esc(h.mark)}</span> <span>${esc(h.line3)}</span></h1>
      <p class="hero-sub">${esc(h.sub)}</p>
      <form class="search" action="/exams" method="get" data-school-search autocomplete="off">
        <span class="search-ico">${icon.search}</span>
        <input name="school" placeholder="학교 이름 검색 (예: 이솔고)" aria-label="학교 검색" enterkeyhint="search">
        <button>찾기</button>
        <ul class="search-list" data-list hidden></ul>
      </form>
      <script type="application/json" id="school-data">${JSON.stringify(allSchools(S)).replace(/</g, '\\u003c')}</script>
    </div>
    <aside class="card board sheet" aria-label="모집 중인 시험지">
      <div class="sheet-top"><span>${esc(S.years[0] || '')} · 기출 모집</span><span class="sheet-live"><i aria-hidden="true"></i>실시간</span></div>
      <div class="board-head">
        <h2>지금 모집 중인 시험지</h2>
        <p>아래 시험지를 가장 먼저 올리면 <b>${amount}원</b>을 드려요.</p>
        <span class="sheet-stamp" aria-hidden="true"><small>보상</small><b>${amount}</b><small>원</small></span>
      </div>
      <ol class="board-list">
        ${need.map((n, i) => `<li><a href="/exams?school=${encodeURIComponent(n.school)}">
          <span class="q-no">${String(i + 1).padStart(2, '0')}</span>
          <span class="q-body"><span class="board-school">${esc(n.school)}</span><span class="board-paper">${esc(n.subject)} · ${esc(n.paper)}</span></span>
          <span class="omr"><i aria-hidden="true"></i>모집중</span></a></li>`).join('')}
      </ol>
      <a class="btn btn-brand btn-block btn-lg" href="/exams">시험지 올리고 ${amount}원 받기</a>
      <a class="board-more" href="/exams/missing">아직 안 올라온 시험지 전체 보기 ${icon.chev}</a>
    </aside>
  </div>
</section>

<div class="fade">
  <div class="col">
    <h2 class="stats-title">동탄 학부모님들이 함께 채워 가는 기출 자료실</h2>
    <ul class="stats">
      <li><b>${won(stats.collected)}</b><span>모인 시험지</span></li>
      <li><b>${won(stats.open)}</b><span>모집 중인 시험지</span></li>
      <li><b>${won(stats.schools)}</b><span>참여 학교</span></li>
    </ul>
  </div>
</div>

<section class="sec">
  <div class="col">
    <div class="sec-head" data-reveal><h2>이렇게 진행돼요</h2></div>
    <ol class="steps">
      <li class="card" data-reveal><span class="step-n">01</span><h3>시험지 찍어 올리기</h3>
        <p>학교·과목·시험지를 고르고 휴대폰으로 찍어 올려 주세요. 사진 여러 장과 PDF 모두 가능합니다.</p></li>
      <li class="card" data-reveal><span class="step-n">02</span><h3>관리자 확인</h3>
        <p>문제가 잘 보이는지, 고르신 시험지가 맞는지 확인합니다. 회원은 마이페이지에서 결과를 볼 수 있어요.</p></li>
      <li class="card" data-reveal><span class="step-n">03</span><h3>${amount}원 보상 지급</h3>
        <p>확인이 끝나면 ${esc(methods)}으로 보내 드립니다. ${esc(S.reward.note)}</p></li>
    </ol>
  </div>
</section>

${seminars.length ? `<section class="sec sec-amber">
  <div class="col">
    <div class="sec-head" data-reveal><h2>다가오는 설명회</h2><a href="/seminars">전체 보기 ${icon.chev}</a></div>
    <div class="grid3">${seminars.map(seminarCard).join('')}</div>
  </div>
</section>` : ''}

<section class="sec">
  <div class="col">
    <div class="sec-head" data-reveal><h2>학교별 수집 현황</h2><a href="/exams/missing">전체 보기 ${icon.chev}</a></div>
    <div class="grid3">
      ${bySchool.map((b) => `<a class="card school-card" href="/exams?school=${encodeURIComponent(b.school)}" data-reveal>
        <div class="school-top"><h3>${esc(b.school)}</h3><span class="pill ${b.done ? 'pill-done' : 'pill-need'}">${b.done ? `${b.done}건 수집` : '첫 시험지 모집중'}</span></div>
        <div class="bar"><i style="width:${Math.max(2, Math.round((b.done / b.total) * 100))}%"></i></div>
        <p>${b.done} / ${b.total} · 남은 시험지 ${b.total - b.done}개</p>
      </a>`).join('')}
    </div>
  </div>
</section>

${notices.length ? `<section class="sec sec-tint">
  <div class="col">
    <div class="sec-head" data-reveal><h2>공지사항</h2><a href="/notice">전체 보기 ${icon.chev}</a></div>
    <ul class="nlist card" data-reveal>
      ${notices.map((n) => `<li><a href="/notice/${n.id}">${n.pinned ? '<span class="badge badge-brand">공지</span>' : ''}<span class="nlist-t">${esc(n.title)}</span><time>${kstDay(n.created_at)}</time></a></li>`).join('')}
    </ul>
  </div>
</section>` : ''}

<section class="sec">
  <div class="col">
    <div class="cta" data-reveal>
      <div><h2>설명회·시험지 모집 소식을 문자로 받아보세요</h2>
      <p>학부모님 연락처만 남겨 주시면 가장 먼저 안내해 드립니다.</p></div>
      <a class="btn btn-white btn-lg" href="/consult">문자 알림 신청하기 ${icon.arrow}</a>
    </div>
  </div>
</section>`;
  return layout(ctx, { body });
}

// ── 시험지 올리기 ─────────────────────────────────────────────────────
export function examsPage(ctx, { done, preset }) {
  const { S, user } = ctx;
  const amount = won(S.reward.amount);
  const data = {
    done, schools: S.schools, papers: S.papers, papersMiddle: S.papersMiddle || {}, multi: S.multi || [], reward: S.reward.amount,
    methods: { bank: !!S.reward.bank, coupon: !!S.reward.coupon, couponLabel: S.reward.couponLabel },
    member: !!user, me: user ? { name: user.student_name, phone: user.parent_phone || user.student_phone } : null,
    preset,
  };
  const body = `
${pageHead(`우리 학교 <span class="mark">시험지</span>를 올려 주세요`,
    `시험지를 올려 주시면 우리 학교 시험을 더 정확하게 분석해 친구와 후배들에게 나눌게요.<br>${esc(S.reward.note)}`,
    `<p class="head-links"><a class="chip" href="/exams/missing">아직 안 올라온 시험지 보기 ${icon.chev}</a></p>`)}
<section class="sec sec-top">
  <div class="col wiz-col" id="exam">
    <div class="card wiz">
      <h2 class="wiz-title">시험지 올리고 <span class="mark">${amount}원</span> 받기</h2>
      <ol class="wiz-steps">
        <li class="on" aria-current="step"><b>01.</b><span>시험지 정보</span></li>
        <li><b>02.</b><span>사진 올리기</span></li>
        <li><b>03.</b><span>접수 완료</span></li>
      </ol>
      <div class="wiz-body">
        <section data-step="1" class="wiz-rows">
          <div class="wrow"><span class="wrow-l" id="lv-l">학교급</span>
            <div class="wrow-c wrow-radio" role="radiogroup" aria-labelledby="lv-l">
              <label><input type="radio" name="ex-level" value="high" checked> 고등학교</label>
              <label><input type="radio" name="ex-level" value="middle"> 중학교</label>
            </div></div>
          <label class="wrow"><span class="wrow-l">학교</span><span class="wrow-c"><select id="ex-school"></select></span></label>
          <label class="wrow"><span class="wrow-l">연도</span><span class="wrow-c wrow-half"><select id="ex-year">${S.years.map((y) => `<option>${esc(y)}</option>`).join('')}</select></span></label>
          <label class="wrow"><span class="wrow-l">과목</span><span class="wrow-c wrow-half"><select id="ex-subject" disabled></select></span></label>
          <label class="wrow"><span class="wrow-l">시험지</span><span class="wrow-c"><select id="ex-paper" disabled></select></span></label>
          <p class="wiz-hint" id="ex-hint" aria-live="polite"></p>
        </section>

        <section data-step="2" hidden>
          <div class="up-head">
            <span class="up-pill">동탄 중·고등 내신 자료실</span>
            <h3 class="up-title">학교 시험자료 <span class="up-em">업로드하기</span></h3>
            <p class="up-desc">동탄 지역 중·고등학교의 실제 시험지, 빈출문제, 정답지 등<br>학교 시험 자료를 등록하는 공간입니다.</p>
          </div>
          <div class="summary" id="ex-summary"></div>
          <label class="file-drop up-drop">
            <input type="file" id="ex-files" accept="image/*,application/pdf" multiple>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4.25 4.25 0 0 1-.25 8.5M12 12v8m0-8-3 3m3-3 3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="up-drop-t"><b>시험자료 등록하기</b><small>사진 또는 PDF 파일을 선택해 주세요.</small></span>
          </label>
          <p class="muted small center">여러 장의 시험지도 한 번에 등록할 수 있습니다.</p>
          <div class="ex-count" id="ex-count"></div>
          <div class="thumbs" id="ex-thumbs"></div>
          <ul class="up-feats">
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7Zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>승인 시<br>등록 보상 제공</span></li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>학교별<br>시험 자료실에 공유</span></li>
            <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9.2 2.2 2.2 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span>신뢰도 높은<br>학습 자료 구축</span></li>
          </ul>
          <label class="agree-box"><input type="checkbox" id="ex-agree">
            <span><b>자료 등록 및 이용 안내에 동의합니다.</b><br>
            <span class="muted small">등록한 자료의 검토 및 승인 절차에 동의하며, 운영 기준에 맞지 않는 자료는 등록이 제한될 수 있습니다.${user ? '' : ` 비회원으로 등록하면 확인 결과를 볼 수 없어요. <a href="/login?next=/exams">로그인</a> · <a href="/signup?next=/exams">회원가입</a>`}</span></span></label>
          <div class="alert alert-bad" id="ex-alert" role="alert" hidden></div>
        </section>

        <section data-step="3" hidden id="ex-done"></section>

        <p class="wiz-count"><b id="wiz-now">1</b> / 3</p>
        <div class="wiz-nav" id="wiz-nav">
          <button type="button" class="wbtn wbtn-dark" id="wiz-prev" hidden>앞 단계</button>
          <button type="button" class="wbtn wbtn-brand" id="wiz-next" disabled>다음</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
  return layout(ctx, {
    title: '시험지 올리기', body, bare: true,
    desc: `우리 학교 내신 시험지를 올리고 ${amount}원 보상을 받아 가세요.`,
    scripts: `<script>window.EXAM = ${JSON.stringify(data).replace(/</g, '\\u003c')};</script><script src="/js/exams.js?v=${V}" defer></script>`,
  });
}

export function missingPage(ctx, { level, year, subject, done }) {
  const { S } = ctx;
  const papers = (level === 'middle' ? S.papersMiddle : S.papers)[subject] || [];
  const doneSet = new Set(done);
  const q = (y, s, l = level) => `/exams/missing?level=${l}&year=${encodeURIComponent(y)}&subject=${encodeURIComponent(s)}`;
  let total = 0, open = 0;
  const rows = schoolsOf(S, level).map((g) => `<tr class="sg-row"><th colspan="${papers.length + 1}">${esc(g.label)}</th></tr>` +
    g.list.map((school) => `<tr><th>${esc(school)}</th>${papers.map((p) => {
      total++;
      if (doneSet.has([school, year, subject, p].join('|'))) return '<td><span class="pill pill-done">완료</span></td>';
      open++;
      return `<td><a class="pill pill-need" href="/exams?school=${encodeURIComponent(school)}">모집중</a></td>`;
    }).join('')}</tr>`).join('')).join('');
  const body = `
${pageHead('아직 안 올라온 시험지', `<span class="pill pill-need">모집중</span> 표시된 시험지를 올리면 ${won(S.reward.amount)}원을 받을 수 있어요.`)}
<section class="sec sec-top">
  <div class="col">
    <div class="seg seg-link">${Object.entries(LEVELS).map(([l, label]) => `<a href="${q(year, '', l)}"${l === level ? ' class="active"' : ''}>${label}</a>`).join('')}</div>
    <div class="seg seg-link">${S.years.map((y) => `<a href="${q(y, subject)}"${y === year ? ' class="active"' : ''}>${esc(y)}</a>`).join('')}</div>
    <div class="tabs">${subjects(S, level).map((s) => `<a class="tab${s === subject ? ' active' : ''}" href="${q(year, s)}">${esc(s)}</a>`).join('')}</div>
    <p class="muted"><b>${LEVELS[level]} · ${esc(year)} · ${esc(subject)}</b> — 모집중 <b class="accent">${open}</b>개 / 전체 ${total}개</p>
    <div class="table-wrap card">
      <table class="status-table">
        <thead><tr><th>학교</th>${papers.map((p) => `<th>${esc(p)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
  return layout(ctx, { title: '아직 안 올라온 시험지', body });
}

// ── 회원 ──────────────────────────────────────────────────────────────
const field = (label, input, { req = false, hint = '' } = {}) =>
  `<label class="f"><span class="f-l">${label}${req ? ' <i>*</i>' : ''}</span>${input}${hint ? `<span class="f-h">${hint}</span>` : ''}</label>`;
const typeTabs = (base, type, next) => `<div class="tabs tabs-center">
  ${[['parent', '학부모'], ['student', '학생']].map(([t, l]) =>
    `<a class="tab${type === t ? ' active' : ''}" href="${base}?type=${t}${next ? `&next=${encodeURIComponent(next)}` : ''}">${l} ${base === '/login' ? '로그인' : '회원가입'}</a>`).join('')}
</div>`;
const schoolSelect = (S, value) => {
  const list = allSchools(S);
  const custom = value && !list.includes(value);
  return `<select name="school"><option value="">선택</option>${list.map((s) => `<option${s === value ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
  <span class="f-h">목록에 없으면 아래에 직접 입력해 주세요.</span>
  <input name="school_custom" placeholder="학교 이름 직접 입력 (예: OO중)" value="${custom ? esc(value) : ''}" maxlength="30">`;
};
const gradeSelect = (value) =>
  `<select name="grade" required><option value="">선택</option>${GRADES.map((g) => `<option${g === value ? ' selected' : ''}>${g}</option>`).join('')}</select>`;

export function signupPage(ctx, { type = 'parent', next = '', error = '', v = {} }) {
  const { S } = ctx;
  const isParent = type !== 'student';
  const body = `
${pageHead('회원가입', '회원으로 올리면 시험지 확인 결과와 보상 지급 내역을 마이페이지에서 볼 수 있어요.')}
<section class="sec sec-top"><div class="col narrow">
  ${typeTabs('/signup', type, next)}
  <form method="post" action="/signup" class="card form-card form" autocomplete="on">
    ${alertBox(error)}
    <input type="hidden" name="type" value="${isParent ? 'parent' : 'student'}">
    <input type="hidden" name="next" value="${esc(next)}">
    ${field('아이디', `<input name="username" required minlength="4" maxlength="20" pattern="[A-Za-z0-9]{4,20}" placeholder="영문·숫자 4~20자" value="${esc(v.username)}" autocomplete="username">`, { req: true })}
    ${field('비밀번호', '<input type="password" name="password" required minlength="8" maxlength="72" placeholder="8자 이상" autocomplete="new-password">', { req: true })}
    ${field('비밀번호 확인', '<input type="password" name="password2" required minlength="8" maxlength="72" autocomplete="new-password">', { req: true })}
    ${field('학교', schoolSelect(S, v.school), { req: true })}
    ${field('학년', gradeSelect(v.grade), { req: true })}
    ${field(isParent ? '자녀(학생) 이름' : '학생 이름', `<input name="student_name" required maxlength="20" value="${esc(v.student_name)}">`, { req: true })}
    ${field('학부모 휴대폰 번호', `<input name="parent_phone" type="tel" inputmode="tel" placeholder="010-0000-0000" value="${esc(v.parent_phone)}"${isParent ? ' required' : ''}>`,
      { req: isParent, hint: isParent ? '아이디를 잊으셨을 때 이 번호로 찾을 수 있어요.' : '' })}
    ${field('학생 휴대폰 번호', `<input name="student_phone" type="tel" inputmode="tel" placeholder="010-0000-0000" value="${esc(v.student_phone)}"${isParent ? '' : ' required'}>`,
      { req: !isParent, hint: isParent ? '선택 입력' : '아이디를 잊었을 때 이 번호로 찾을 수 있어요.' })}
    <div class="agree">
      <label><input type="checkbox" name="agree_privacy" required> <span><b>[필수]</b> 개인정보 수집·이용 동의</span></label>
      <div class="agree-detail">· 수집 항목: 아이디, 비밀번호(암호화 저장), 학교, 학년, 학생 이름, 학생·학부모 휴대폰 번호<br>
        · 이용 목적: 회원 관리, 시험지 확인 결과 및 보상 지급 안내<br>
        · 보유 기간: <b>회원 탈퇴 시까지</b> (탈퇴 시 즉시 삭제)<br>
        · 동의를 거부할 수 있으나, 거부하시면 회원가입이 불가합니다.</div>
      <label><input type="checkbox" name="agree_sms"${v.agree_sms ? ' checked' : ''}> <span><b>[선택]</b> ${esc(S.site.name)} 문자(SMS) 수신 동의</span></label>
      <div class="agree-detail">설명회·시험지 모집 소식을 문자로 보내 드립니다. 동의하지 않아도 가입할 수 있으며, 언제든 마이페이지에서 철회할 수 있습니다.</div>
    </div>
    <button class="btn btn-brand btn-lg btn-block">${isParent ? '학부모' : '학생'} 회원가입</button>
    <p class="center muted small">이미 회원이신가요? <a href="/login${next ? `?next=${encodeURIComponent(next)}` : ''}">로그인</a></p>
  </form>
</div></section>`;
  return layout(ctx, { title: '회원가입', body, bare: true });
}

export function loginPage(ctx, { type = 'parent', next = '', error = '', notice = '', username = '' }) {
  const body = `
${pageHead('로그인')}
<section class="sec sec-top"><div class="col xnarrow">
  ${typeTabs('/login', type, next)}
  <form method="post" action="/login" class="card form-card form">
    ${alertBox(notice, 'ok')}${alertBox(error)}
    <input type="hidden" name="type" value="${type === 'student' ? 'student' : 'parent'}">
    <input type="hidden" name="next" value="${esc(next)}">
    ${field('아이디', `<input name="username" required maxlength="20" value="${esc(username)}" autocomplete="username">`)}
    ${field('비밀번호', '<input type="password" name="password" required maxlength="72" autocomplete="current-password">')}
    <button class="btn btn-brand btn-lg btn-block">로그인</button>
    <p class="center muted small">아직 회원이 아니신가요? <a href="/signup${next ? `?next=${encodeURIComponent(next)}` : ''}">회원가입</a></p>
    <p class="center muted small"><a href="/find">아이디 · 비밀번호 찾기</a></p>
  </form>
</div></section>`;
  return layout(ctx, { title: '로그인', body, bare: true });
}

export function findPage(ctx, { error = '', found = null }) {
  const { S } = ctx;
  const contact = S.site.phone ? `${esc(S.site.phone)}로 연락 주시거나 ` : '';
  const body = `
${pageHead('아이디 · 비밀번호 찾기')}
<section class="sec sec-top"><div class="col xnarrow">
  <form method="post" action="/find" class="card form-card form">
    <h2 class="card-title">아이디 찾기</h2>
    ${alertBox(error)}
    ${found ? `<div class="alert alert-ok">${found.length ? `가입된 아이디: <b>${found.map(esc).join(', ')}</b>` : '일치하는 회원 정보가 없습니다.'}</div>` : ''}
    ${field('학생 이름', '<input name="student_name" required maxlength="20">')}
    ${field('가입할 때 입력한 휴대폰 번호', '<input name="phone" type="tel" inputmode="tel" required placeholder="010-0000-0000">')}
    <button class="btn btn-brand btn-block">아이디 찾기</button>
  </form>
  <div class="card form-card">
    <h2 class="card-title">비밀번호를 잊으셨나요?</h2>
    <p class="muted">${contact}<a href="/consult">상담 신청</a>에 아이디와 함께 "비밀번호 초기화"를 남겨 주세요. 본인 확인 후 임시 비밀번호를 안내해 드립니다.</p>
  </div>
</div></section>`;
  return layout(ctx, { title: '아이디·비밀번호 찾기', body, bare: true });
}

const statusPill = (u) => {
  if (u.status === 'pending') return '<span class="pill pill-wait">확인 중</span>';
  if (u.status === 'rejected') return '<span class="pill pill-bad">반려</span>';
  if (u.paid_at) return '<span class="pill pill-done">지급 완료</span>';
  if (u.reward_type === 'none') return '<span class="pill pill-mute">보상 받지 않음</span>';
  return '<span class="pill pill-need">승인 · 지급 대기</span>';
};

export function myPage(ctx, { uploads, apps, ok = '', error = '' }) {
  const { S, user } = ctx;
  const body = `
${pageHead(`${esc(user.student_name)} 님의 마이페이지`, `${user.type === 'parent' ? '학부모' : '학생'} 회원 · ${esc(user.username)}`)}
<section class="sec sec-top"><div class="col narrow">
  ${alertBox(ok, 'ok')}${alertBox(error)}
  <div class="card form-card">
    <div class="card-head"><h2 class="card-title">내가 올린 시험지</h2><a class="btn btn-sm btn-brand" href="/exams">시험지 올리기</a></div>
    ${uploads.length ? `<ul class="mylist">${uploads.map((u) => `<li>
      <div class="my-top"><b>${esc(u.school)} · ${esc(u.year)}</b>${statusPill(u)}</div>
      <p>${esc(u.subject)} · ${esc(u.paper)} <span class="muted small">(${u.file_count}장 · ${kstDay(u.created_at)})</span></p>
      ${u.status === 'rejected' ? `<p class="reason"><b>반려 사유</b> ${esc(u.reject_reason || '사유가 입력되지 않았습니다.')}</p>` : ''}
      ${u.paid_at ? `<p class="paid">${u.reward_type === 'coupon'
        ? `<b>${esc(u.coupon_name || S.reward.couponLabel)}</b> ${u.coupon_code ? `<code>${rich(u.coupon_code)}</code>` : '문자로 보내 드렸어요.'}`
        : `<b>${won(u.amount)}원</b> 입금 완료 (${esc(u.bank)} ${esc(maskAcc(u.account_no))})`} · ${kstDay(u.paid_at)}</p>` : ''}
      ${u.status !== 'rejected' && !u.paid_at ? `<p class="muted small">받는 방법: ${rewardLabel(S, u)} · <a href="/my/reward/${u.id}">${u.reward_type ? '수정' : '입력하기'}</a></p>` : ''}
    </li>`).join('')}</ul>` : '<p class="empty">아직 올린 시험지가 없어요.</p>'}
  </div>

  ${apps.length ? `<div class="card form-card">
    <h2 class="card-title">설명회 신청 내역</h2>
    <ul class="mylist">${apps.map((a) => `<li><div class="my-top"><b><a href="/seminars/${a.seminar_id}">${esc(a.title)}</a></b></div>
      <p class="muted small">${esc(a.session)} · 신청일 ${kstDay(a.created_at)}</p></li>`).join('')}</ul>
  </div>` : ''}

  <form method="post" action="/my" class="card form-card form">
    <h2 class="card-title">내 정보</h2>
    ${field('학교', schoolSelect(S, user.school))}
    ${field('학년', gradeSelect(user.grade))}
    ${field('학생 이름', `<input name="student_name" required maxlength="20" value="${esc(user.student_name)}">`)}
    ${field('학부모 휴대폰 번호', `<input name="parent_phone" type="tel" inputmode="tel" value="${esc(user.parent_phone)}" placeholder="010-0000-0000">`)}
    ${field('학생 휴대폰 번호', `<input name="student_phone" type="tel" inputmode="tel" value="${esc(user.student_phone)}" placeholder="010-0000-0000">`)}
    <label class="check"><input type="checkbox" name="agree_sms"${user.agree_sms ? ' checked' : ''}> 문자(SMS) 수신에 동의합니다.</label>
    <button class="btn btn-brand btn-block">저장하기</button>
  </form>

  <form method="post" action="/my/password" class="card form-card form">
    <h2 class="card-title">비밀번호 변경</h2>
    ${field('현재 비밀번호', '<input type="password" name="current" required maxlength="72" autocomplete="current-password">')}
    ${field('새 비밀번호', '<input type="password" name="password" required minlength="8" maxlength="72" placeholder="8자 이상" autocomplete="new-password">')}
    ${field('새 비밀번호 확인', '<input type="password" name="password2" required minlength="8" maxlength="72" autocomplete="new-password">')}
    <button class="btn btn-line btn-block">비밀번호 변경</button>
  </form>

  <details class="card form-card danger">
    <summary>회원 탈퇴</summary>
    <form method="post" action="/my/delete" class="form">
      <p class="muted small">탈퇴하면 회원 정보가 즉시 삭제됩니다. 이미 올린 시험지는 자료로 남지만 회원 정보와의 연결은 끊깁니다.</p>
      ${field('비밀번호 확인', '<input type="password" name="current" required maxlength="72" autocomplete="current-password">')}
      <button class="btn btn-danger btn-block">탈퇴하기</button>
    </form>
  </details>
</div></section>`;
  return layout(ctx, { title: '마이페이지', body, bare: true });
}

export const maskAcc = (a) => { a = String(a || ''); return a.length > 4 ? '*'.repeat(a.length - 4) + a.slice(-4) : a; };
export function rewardLabel(S, u) {
  if (u.reward_type === 'bank') return `계좌 입금 (${esc(u.bank)} ${esc(maskAcc(u.account_no))})`;
  if (u.reward_type === 'coupon') return `${esc(S.reward.couponLabel)} (${esc(u.phone)})`;
  if (u.reward_type === 'none') return '받지 않음';
  return '<b class="accent">아직 입력하지 않았어요</b>';
}

export function rewardPage(ctx, { u, error = '' }) {
  const { S } = ctx;
  const type = u.reward_type === 'coupon' || (!S.reward.bank && S.reward.coupon) ? 'coupon' : 'bank';
  const body = `
${pageHead('보상 받는 방법', `${esc(u.school)} · ${esc(u.year)} · ${esc(u.subject)} ${esc(u.paper)}`)}
<section class="sec sec-top"><div class="col xnarrow">
  <form method="post" action="/my/reward/${u.id}" class="card form-card form" data-reward-form>
    ${alertBox(error)}
    ${rewardFields(S, { type, name: u.name || ctx.user.student_name, phone: u.phone || ctx.user.parent_phone || ctx.user.student_phone, bank: u.bank, holder: u.holder, account_no: u.account_no })}
    <button class="btn btn-brand btn-lg btn-block">저장하기</button>
    <a class="btn btn-line btn-block" href="/my">돌아가기</a>
  </form>
</div></section>`;
  return layout(ctx, { title: '보상 받는 방법', body, bare: true });
}

export function rewardFields(S, v = {}) {
  const both = S.reward.bank && S.reward.coupon;
  return `${both ? `<div class="seg seg-radio">
      <label><input type="radio" name="type" value="bank"${v.type !== 'coupon' ? ' checked' : ''}><span>계좌로 ${won(S.reward.amount)}원 받기</span></label>
      <label><input type="radio" name="type" value="coupon"${v.type === 'coupon' ? ' checked' : ''}><span>${esc(S.reward.couponLabel)}으로 받기</span></label>
    </div>` : `<input type="hidden" name="type" value="${S.reward.coupon ? 'coupon' : 'bank'}">`}
    ${field('이름', `<input name="name" required maxlength="20" value="${esc(v.name)}">`)}
    ${field('연락처', `<input name="phone" type="tel" inputmode="tel" required placeholder="010-0000-0000" value="${esc(v.phone)}">`, { hint: '쿠폰은 이 번호로 보내 드려요.' })}
    <div data-bank-only${v.type === 'coupon' ? ' hidden' : ''}>
      <div class="row2">${field('은행', `<input name="bank" maxlength="20" placeholder="예: 국민" value="${esc(v.bank)}">`)}
      ${field('예금주', `<input name="holder" maxlength="20" value="${esc(v.holder)}">`)}</div>
      ${field('계좌번호', `<input name="account_no" inputmode="numeric" maxlength="30" placeholder="숫자만 입력" value="${esc(v.account_no)}">`)}
    </div>
    <p class="muted small">입력하신 정보는 보상 지급에만 사용하며, 지급 후 1년 뒤 삭제합니다.</p>`;
}

// ── 공지 ──────────────────────────────────────────────────────────────
export function noticeListPage(ctx, { notices }) {
  let n = notices.filter((x) => !x.pinned).length;
  const body = `
${pageHead('공지사항', `${esc(ctx.S.site.name)}의 안내 사항을 알려 드립니다.`)}
<section class="sec sec-top"><div class="col narrow">
  <div class="card table-wrap">
    <table class="board-table">
      <thead><tr><th class="c-no">번호</th><th>제목</th><th class="c-date">작성일</th><th class="c-view">조회</th></tr></thead>
      <tbody>${notices.length ? notices.map((x) => `<tr>
        <td class="c-no">${x.pinned ? '<span class="badge badge-brand">공지</span>' : n--}</td>
        <td><a href="/notice/${x.id}">${esc(x.title)}</a></td>
        <td class="c-date">${kstDay(x.created_at)}</td><td class="c-view">${x.views}</td></tr>`).join('')
        : '<tr><td colspan="4" class="empty">등록된 공지가 없습니다.</td></tr>'}</tbody>
    </table>
  </div>
</div></section>`;
  return layout(ctx, { title: '공지사항', body });
}

export function noticePage(ctx, { n }) {
  const body = `
<section class="sec sec-first"><div class="col narrow">
  <a class="back" href="/notice">← 공지사항</a>
  <article class="card form-card post">
    <h1>${n.pinned ? '<span class="badge badge-brand">공지</span> ' : ''}${esc(n.title)}</h1>
    <p class="muted small">${kstDay(n.created_at)} · 조회 ${n.views}</p>
    <div class="post-body">${rich(n.body)}</div>
  </article>
</div></section>`;
  return layout(ctx, { title: n.title, body });
}

// ── 설명회 ────────────────────────────────────────────────────────────
function seminarRow(s) {
  const p = dateParts(s.date);
  const ended = seminarEnded(s);
  return `<article class="card sem-row${ended ? ' ended' : ''}" data-reveal>
    <div class="sem-date"><b>${p.md}</b><span>${p.dow ? p.dow + '요일' : ''}</span></div>
    <div class="sem-main">
      <h3>${esc(s.title)} ${ended ? '<span class="pill pill-mute">종료</span>' : ''}</h3>
      <dl>${s.target ? `<div><dt>대상</dt><dd>${esc(s.target)}</dd></div>` : ''}${s.when_text ? `<div><dt>일시</dt><dd>${esc(s.when_text)}</dd></div>` : ''}${s.place ? `<div><dt>장소</dt><dd>${esc(s.place)}</dd></div>` : ''}</dl>
    </div>
    <div class="sem-act">${ended ? '<span class="btn btn-sm btn-off">신청 종료</span>'
      : `<a class="btn btn-sm btn-brand" href="/seminars/${s.id}#apply">설명회 신청하기</a>`}<a class="btn btn-sm btn-line" href="/seminars/${s.id}">자세히 보기</a></div>
  </article>`;
}

export function seminarListPage(ctx, { seminars }) {
  const open = seminars.filter((s) => !seminarEnded(s)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const ended = seminars.filter(seminarEnded);
  const body = `
${pageHead('설명회 일정', '입시 전략·학습 로드맵 설명회 일정을 안내해 드립니다.')}
<section class="sec sec-top"><div class="col narrow">
  ${open.length ? open.map(seminarRow).join('') : '<div class="card form-card"><p class="empty">예정된 설명회가 없습니다. 문자 알림을 신청하시면 일정이 잡히는 대로 안내해 드려요.</p><a class="btn btn-brand btn-block" href="/consult">문자 알림 신청하기</a></div>'}
  ${ended.length ? `<h2 class="sub-title">종료된 설명회</h2>${ended.map(seminarRow).join('')}` : ''}
</div></section>`;
  return layout(ctx, { title: '설명회 일정', body });
}

export function seminarPage(ctx, { s, error = '', done = false, v = {} }) {
  const { user } = ctx;
  const ended = seminarEnded(s);
  const sessions = String(s.sessions || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (!sessions.length) sessions.push(s.when_text || '참석 신청');
  const body = `
<section class="sec sec-first"><div class="col narrow">
  <a class="back" href="/seminars">← 설명회 일정</a>
  <article class="card form-card post">
    <h1>${esc(s.title)} ${ended ? '<span class="pill pill-mute">종료</span>' : ''}</h1>
    <dl class="kv">${s.target ? `<div><dt>대상</dt><dd>${esc(s.target)}</dd></div>` : ''}${s.when_text ? `<div><dt>일시</dt><dd>${esc(s.when_text)}</dd></div>` : ''}${s.place ? `<div><dt>장소</dt><dd>${esc(s.place)}</dd></div>` : ''}</dl>
    ${s.body ? `<div class="post-body">${rich(s.body)}</div>` : ''}
  </article>
  <div class="card form-card" id="apply">
    <h2 class="card-title">설명회 신청</h2>
    ${done ? '<div class="alert alert-ok">신청이 접수되었습니다. 확정 안내를 문자로 보내 드릴게요.</div>'
      : ended ? '<p class="empty">신청이 종료된 설명회입니다.</p>'
      : `<form method="post" action="/seminars/${s.id}/apply#apply" class="form">
      ${alertBox(error)}
      ${user ? '' : `<p class="muted small">회원이시면 <a href="/login?next=/seminars/${s.id}">로그인</a>하시면 인적사항이 자동으로 채워져요.</p>`}
      ${field('학생 이름', `<input name="student_name" required maxlength="20" value="${esc(v.student_name ?? user?.student_name)}">`, { req: true })}
      ${field('학교와 학년', `<input name="school_grade" required maxlength="30" placeholder="예: 동탄중3" value="${esc(v.school_grade ?? (user ? `${user.school} ${user.grade}` : ''))}">`, { req: true })}
      ${field('휴대폰 번호(학부모)', `<input name="parent_phone" type="tel" inputmode="tel" required placeholder="010-0000-0000" value="${esc(v.parent_phone ?? user?.parent_phone)}">`, { req: true })}
      <fieldset class="f"><legend class="f-l">설명회 신청일 <i>*</i></legend>
        ${sessions.map((x, i) => `<label class="check"><input type="radio" name="session" value="${esc(x)}" required${sessions.length === 1 || v.session === x ? ' checked' : ''}${i ? '' : ''}> ${esc(x)}</label>`).join('')}</fieldset>
      ${field('설명회에서 궁금한 점 <small>(선택)</small>', `<textarea name="question" rows="3" maxlength="1000" placeholder="궁금하신 점이 있으시다면 남겨 주세요.">${esc(v.question)}</textarea>`)}
      <div class="agree"><div class="agree-detail">수집 항목: 학생 이름, 학교와 학년, 휴대폰 번호 / 이용 목적: 설명회 신청 확인 및 안내 문자 발송 / 보유 기간: 설명회 종료 후 1년</div>
        <label><input type="checkbox" name="agree" required> <span>개인정보 수집·이용에 동의합니다. <i>*</i></span></label></div>
      <button class="btn btn-brand btn-lg btn-block">설명회 신청하기</button>
    </form>`}
  </div>
</div></section>`;
  return layout(ctx, { title: s.title, body });
}

// ── 상담·문자 신청 ────────────────────────────────────────────────────
export function consultPage(ctx, { error = '', done = false, v = {} }) {
  const { S, user } = ctx;
  const interests = ['시험지 모집 소식', '설명회 안내', '내신 분석 자료', '학습 상담'];
  const picked = new Set(v.interests || []);
  const body = `
${pageHead('상담·문자 알림 신청', '남겨 주신 연락처로 설명회·시험지 모집·상담 소식을 문자로 안내해 드립니다.')}
<section class="sec sec-top"><div class="col narrow">
  ${done ? `<div class="card form-card center"><div class="m-icon ok">✓</div><h2 class="card-title">신청이 접수되었습니다</h2>
    <p class="muted">남겨 주신 번호로 소식을 보내 드릴게요.</p><a class="btn btn-brand" href="/">홈으로</a></div>`
    : `<form method="post" action="/consult" class="card form-card form">
    ${alertBox(error)}
    ${field('학부모 전화번호', `<input name="parent_phone" type="tel" inputmode="tel" required placeholder="010-0000-0000" value="${esc(v.parent_phone ?? user?.parent_phone)}">`, { req: true })}
    ${field('학생 이름', `<input name="student_name" required maxlength="20" value="${esc(v.student_name ?? user?.student_name)}">`, { req: true })}
    ${field('학생 전화번호', `<input name="student_phone" type="tel" inputmode="tel" placeholder="010-0000-0000" value="${esc(v.student_phone ?? user?.student_phone)}">`)}
    <div class="row2">${field('학교', `<input name="school" maxlength="30" placeholder="예: 이솔고" value="${esc(v.school ?? user?.school)}">`)}
    ${field('학년', `<select name="grade"><option value="">선택</option>${GRADES.map((g) => `<option${g === (v.grade ?? user?.grade) ? ' selected' : ''}>${g}</option>`).join('')}</select>`)}</div>
    <fieldset class="f"><legend class="f-l">관심 항목 (여러 개 선택 가능)</legend>
      <div class="checks">${interests.map((x) => `<label class="check-chip"><input type="checkbox" name="interests" value="${x}"${picked.has(x) ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div></fieldset>
    ${field('문의 내용 (선택)', `<textarea name="memo" rows="4" maxlength="1000" placeholder="궁금하신 점을 남겨 주세요.">${esc(v.memo)}</textarea>`)}
    <div class="agree"><div class="agree-detail"><b>개인정보 수집·이용 안내</b><br>수집 항목: 학부모·학생 연락처, 학생 이름, 학교, 학년, 관심 항목 / 이용 목적: 상담 및 설명회·시험지 모집 문자 안내 / 보유 기간: 수신 거부 또는 동의 철회 시까지</div>
      <label><input type="checkbox" name="agree" required> <span>개인정보 수집·이용 및 문자 수신에 동의합니다. <i>*</i></span></label></div>
    <button class="btn btn-brand btn-lg btn-block">신청하기</button>
  </form>`}
</div></section>`;
  return layout(ctx, { title: '상담·문자 알림 신청', body, bare: true });
}

// ── 약관 · 안내 ───────────────────────────────────────────────────────
export function docPage(ctx, kind) {
  const { S } = ctx;
  const name = esc(S.site.name);
  const contact = [S.site.phone, S.site.email].filter(Boolean).map(esc).join(' / ') || '상담 신청 페이지';
  const privacy = `
<h2>1. 수집하는 개인정보</h2>
<p>· 회원가입: 아이디, 비밀번호(암호화 저장), 학교, 학년, 학생 이름, 학생·학부모 휴대폰 번호<br>
· 시험지 보상 지급: 이름, 연락처, 은행명, 예금주, 계좌번호<br>
· 설명회 신청: 학생 이름, 학교와 학년, 학부모 휴대폰 번호<br>
· 상담·문자 신청: 학부모·학생 연락처, 학생 이름, 학교, 학년, 관심 항목</p>
<h2>2. 이용 목적</h2>
<p>회원 관리, 시험지 확인 결과 안내, 보상(쿠폰·입금) 지급, 설명회 신청 확인, 상담 및 문자 안내에만 사용합니다.</p>
<h2>3. 보유 기간</h2>
<p>· 회원 정보: 회원 탈퇴 시까지<br>· 보상 지급 정보: 지급 후 1년<br>· 설명회 신청 정보: 설명회 종료 후 1년<br>· 상담·문자 신청 정보: 수신 거부 또는 동의 철회 시까지</p>
<h2>4. 제3자 제공</h2>
<p>${name}은 수집한 개인정보를 외부에 제공하지 않습니다.</p>
<h2>5. 이용자의 권리</h2>
<p>언제든지 개인정보의 열람·정정·삭제와 수신 동의 철회를 요청할 수 있습니다. 문의: ${contact}</p>`;
  const terms = `
<h2>1. 서비스 내용</h2>
<p>${name}은 학부모·학생이 올린 학교 내신 시험지를 모아 학교별 시험 분석 자료로 활용하고, 올려 주신 분께 보상을 드리는 서비스입니다.</p>
<h2>2. 시험지 업로드</h2>
<p>· 직접 응시했거나 정당하게 가지고 있는 시험지만 올려 주세요.<br>· 문제를 알아볼 수 없거나 선택한 시험지와 다른 자료는 반려될 수 있습니다.<br>· 올려 주신 자료는 학교별 내신 분석 목적으로만 사용합니다.</p>
<h2>3. 보상</h2>
<p>· 보상은 관리자 확인이 끝난 시험지에 한해 지급합니다. ${esc(S.reward.note)}<br>· 보상 방법과 금액은 사정에 따라 변경될 수 있으며, 변경 시 공지사항으로 안내합니다.<br>· 지급 정보를 입력하지 않으면 보상을 받을 수 없습니다.</p>
<h2>4. 회원</h2>
<p>회원은 마이페이지에서 언제든지 탈퇴할 수 있으며, 탈퇴 시 회원 정보는 즉시 삭제됩니다.</p>`;
  const body = `
${pageHead(kind === 'privacy' ? '개인정보처리방침' : '이용약관')}
<section class="sec sec-top"><div class="col narrow"><article class="card form-card post"><div class="post-body doc">${kind === 'privacy' ? privacy : terms}</div></article></div></section>`;
  return layout(ctx, { title: kind === 'privacy' ? '개인정보처리방침' : '이용약관', body, bare: true });
}

export function messagePage(ctx, { title, message, status = 200, link = ['/', '홈으로'] }) {
  const body = `<section class="sec sec-first"><div class="col xnarrow"><div class="card form-card center">
    <h1 class="card-title">${esc(title)}</h1><p class="muted">${esc(message)}</p><a class="btn btn-brand" href="${link[0]}">${link[1]}</a></div></div></section>`;
  return { body: layout(ctx, { title, body, bare: true }), status };
}
