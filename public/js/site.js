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
