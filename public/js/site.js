// 공통: 헤더 상태, 모바일 메뉴, 스크롤 등장, 학교 검색, 보상 방법 전환
(() => {
  const hdr = document.querySelector('[data-hdr]');
  if (hdr) {
    // 떠 있는 버튼은 첫 화면의 버튼을 가리지 않도록 조금 내려온 뒤에 보여 준다
    const fab = document.querySelector('.fab');
    const onScroll = () => {
      hdr.toggleAttribute('data-scrolled', window.scrollY > 8);
      if (fab) fab.classList.toggle('show', window.scrollY > 420 || !document.querySelector('.hero'));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const burger = hdr.querySelector('[data-burger]');
    const mnav = hdr.querySelector('[data-mnav]');
    if (burger && mnav) {
      burger.addEventListener('click', () => {
        const open = mnav.hidden;
        mnav.hidden = !open;
        hdr.toggleAttribute('data-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      });
    }
  }

  const items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // 메인 학교 검색
  const search = document.querySelector('[data-school-search]');
  const dataEl = document.getElementById('school-data');
  if (search && dataEl) {
    const schools = JSON.parse(dataEl.textContent);
    const input = search.querySelector('input');
    const list = search.querySelector('[data-list]');
    const render = () => {
      const q = input.value.trim().replace(/\s/g, '');
      if (!q) { list.hidden = true; return; }
      const hit = schools.filter((s) => s.includes(q)).slice(0, 8);
      list.textContent = '';
      if (!hit.length) {
        const li = document.createElement('li');
        li.className = 'none';
        li.textContent = '목록에 없는 학교예요. 상담·문자 신청으로 알려 주시면 추가해 드릴게요.';
        list.appendChild(li);
      }
      hit.forEach((s) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '/exams?school=' + encodeURIComponent(s);
        a.textContent = s;
        const go = document.createElement('span');
        go.className = 'pill pill-need';
        go.textContent = '시험지 올리기';
        a.appendChild(go);
        li.appendChild(a);
        list.appendChild(li);
      });
      list.hidden = false;
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    document.addEventListener('click', (e) => { if (!search.contains(e.target)) list.hidden = true; });
    search.addEventListener('submit', (e) => {
      const q = input.value.trim().replace(/\s/g, '');
      const hit = schools.find((s) => s === q) || schools.find((s) => s.includes(q));
      if (q && hit) input.value = hit;
      else if (q) { e.preventDefault(); render(); }
    });
  }

  // 보상 받는 방법: 쿠폰을 고르면 계좌 입력란을 숨긴다
  document.querySelectorAll('[data-reward-form]').forEach(bindReward);
  window.bindRewardForm = bindReward;
  function bindReward(form) {
    const bank = form.querySelector('[data-bank-only]');
    if (!bank) return;
    const sync = () => {
      const picked = form.querySelector('input[name="type"]:checked') || form.querySelector('input[name="type"]');
      const isBank = !picked || picked.value !== 'coupon';
      bank.hidden = !isBank;
      bank.querySelectorAll('input').forEach((i) => { i.required = isBank; });
    };
    form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', sync));
    sync();
  }
})();

// ── 타이포그래피 효과 ──────────────────────────────────────────────
// 1) 제목 글자가 한 자씩 아래에서 떠오른다 (메인 큰 제목은 바로, 나머지 제목은 화면에 들어올 때)
// 2) 형광펜(.mark)이 왼쪽에서 오른쪽으로 그어진다
// 3) 숫자(.stats b)가 0 에서 올라간다
// 움직임 줄이기 설정을 켠 사용자에게는 모두 건너뛴다.
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (reduce) { root.classList.add('typo-off'); return; }

  // 글자를 단어(.w, 줄바꿈 단위)와 글자(.ch)로 나눈다. 화면 낭독기는 원래 문장을 읽도록 aria-label 을 붙인다.
  function split(el) {
    if (el.dataset.split) return 0;
    el.dataset.split = '1';
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 1) { if (n.tagName !== 'SVG' && n.tagName !== 'svg') walk(n); return; }
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.setAttribute('aria-hidden', 'true');
          [...part].forEach((c) => {
            const ch = document.createElement('span');
            ch.className = 'ch';
            ch.style.setProperty('--i', i++);
            ch.textContent = c;
            w.appendChild(ch);
          });
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      });
    };
    walk(el);
    el.style.setProperty('--n', i);
    return i;
  }

  const play = (el) => el.classList.add('typo-in');
  const heads = [...document.querySelectorAll('.hero h1, .page-head h1, .sec-head h2, .wiz-title, .cta h2')];
  heads.forEach((el) => { el.classList.add('typo'); split(el); });

  // 큰 제목 다음에 오는 설명·형광펜은 제목 글자가 다 올라온 뒤에 이어서
  const hero = document.querySelector('.hero h1, .page-head h1');
  if (hero) {
    const n = Number(hero.style.getPropertyValue('--n')) || 0;
    root.style.setProperty('--hero-done', `${Math.min(1200, n * 32 + 380)}ms`);
  }

  // 숫자 올라가기
  const counters = [...document.querySelectorAll('.stats b')].map((b) => {
    const target = Number(b.textContent.replace(/[^\d]/g, ''));
    b.dataset.target = String(target);
    b.style.minWidth = `${b.textContent.length * 0.62}em`;
    b.textContent = '0';
    return b;
  });
  const count = (b) => {
    const target = Number(b.dataset.target) || 0;
    const t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      b.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ko-KR');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const marks = [...document.querySelectorAll('.mark')];
  const watched = [...heads.filter((h) => !h.matches('.hero h1, .page-head h1')), ...marks, ...counters];
  if (hero) setTimeout(() => play(hero), 30);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        if (el.dataset.target !== undefined) count(el); else play(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    watched.forEach((el) => io.observe(el));
  } else {
    watched.forEach((el) => (el.dataset.target !== undefined ? (el.textContent = Number(el.dataset.target).toLocaleString('ko-KR')) : play(el)));
  }
})();

// ── 눈 내리는 효과: 화면 위에 가볍게, 클릭은 그대로 통과. 움직임 줄이기 설정·관리자 화면에서는 끔 ──
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || location.pathname.startsWith('/admin')) return;
  const cv = document.createElement('canvas');
  cv.className = 'snow'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const cx = cv.getContext('2d');
  if (!cx) return;
  let W = 0, H = 0, dpr = 1, flakes = [], raf = 0, last = 0;
  const make = (top) => ({
    x: Math.random() * W, y: top ? Math.random() * H : -10,
    r: 1 + Math.random() * 2.6, s: 18 + Math.random() * 34,      // 크기, 떨어지는 속도(px/초)
    w: Math.random() * Math.PI * 2, ws: .4 + Math.random() * .9,  // 좌우 흔들림
    a: .45 + Math.random() * .45,
  });
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(70, Math.max(26, W * H / 22000)));
    while (flakes.length < n) flakes.push(make(true));
    flakes.length = n;
  };
  const tick = (t) => {
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    cx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.w += f.ws * dt; f.y += f.s * dt; f.x += Math.sin(f.w) * 14 * dt;
      if (f.y > H + 10) Object.assign(f, make(false));
      if (f.x < -10) f.x = W + 10; else if (f.x > W + 10) f.x = -10;
      cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      // 밝은 바탕에서도 보이도록 옅은 하늘색 눈 + 흰 테두리
      cx.fillStyle = `rgba(170, 196, 245, ${f.a})`; cx.fill();
      cx.lineWidth = .6; cx.strokeStyle = `rgba(255, 255, 255, ${f.a})`; cx.stroke();
    }
    raf = requestAnimationFrame(tick);
  };
  size();
  addEventListener('resize', size);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
  });
  raf = requestAnimationFrame(tick);
})();
