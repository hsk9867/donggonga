// 시험지 올리기 — 3단계 입력 (01 시험지 정보 → 02 사진 올리기 → 03 접수 완료)
(() => {
  const EXAM = window.EXAM;
  const { methods } = EXAM;
  const multi = new Set(EXAM.multi || []);
  const done = new Set(EXAM.done); // '학교|연도|과목|시험지'
  const reward = Number(EXAM.reward).toLocaleString('ko-KR');
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 학교 이름이 '중'으로 끝나면 중학교 시험지 목록
  const levelOf = (school) => (/중$/.test(school) ? 'middle' : 'high');
  const papersOf = (school) => (levelOf(school) === 'middle' ? EXAM.papersMiddle : EXAM.papers) || {};

  const el = { level: document.querySelectorAll('input[name="ex-level"]'), school: $('ex-school'), year: $('ex-year'), subject: $('ex-subject'), paper: $('ex-paper') };
  const st = () => ({ school: el.school.value, year: el.year.value, subject: el.subject.value, paper: el.paper.value });
  const keyOf = (s) => [s.school, s.year, s.subject, s.paper].join('|');
  const isDone = (s) => !multi.has(s.subject) && done.has(keyOf(s));

  // ── 선택 상자 채우기 ──
  const opt = (v, label, extra = '') => `<option value="${esc(v)}"${extra}>${esc(label)}</option>`;
  const level = () => [...el.level].find((r) => r.checked)?.value || 'high';
  function fillSchools(keep) {
    const lv = level();
    el.school.innerHTML = opt('', '학교 선택') + EXAM.schools.map((g) => {
      const list = g.list.filter((s) => levelOf(s) === lv);
      return list.length ? `<optgroup label="${esc(g.label)}">${list.map((s) => opt(s, s)).join('')}</optgroup>` : '';
    }).join('');
    if (keep && levelOf(keep) === lv) el.school.value = keep;
  }
  function fillSubjects() {
    const prev = el.subject.value;
    const subs = el.school.value ? Object.keys(papersOf(el.school.value)) : [];
    el.subject.innerHTML = opt('', '과목 선택') + subs.map((s) => opt(s, s)).join('');
    el.subject.disabled = !subs.length;
    if (subs.includes(prev)) el.subject.value = prev;
  }
  function fillPapers() {
    const prev = el.paper.value;
    const s = st();
    const list = s.school && s.subject ? papersOf(s.school)[s.subject] || [] : [];
    el.paper.innerHTML = opt('', '시험지 선택') + list.map((p) => {
      const d = isDone({ ...s, paper: p });
      return opt(p, d ? `${p} · 업로드 완료` : `${p} · 모집중`, d ? ' disabled' : '');
    }).join('');
    el.paper.disabled = !list.length || !s.year;
    if (list.includes(prev) && !isDone({ ...s, paper: prev })) el.paper.value = prev;
  }
  function refresh() {
    fillSubjects();
    fillPapers();
    const s = st();
    const left = s.school && s.year && s.subject
      ? (papersOf(s.school)[s.subject] || []).filter((p) => !isDone({ ...s, paper: p })).length : null;
    $('ex-hint').innerHTML = left === null ? ''
      : left ? `<b>${esc(s.school)} ${esc(s.subject)}</b> 시험지 중 <b class="accent">${left}개</b>를 모집하고 있어요.`
        : `<b>${esc(s.school)} ${esc(s.subject)}</b> 시험지는 모두 모였어요. 다른 과목을 골라 주세요.`;
    nav();
  }
  el.level.forEach((r) => r.addEventListener('change', () => { fillSchools(); refresh(); }));
  ['school', 'year', 'subject', 'paper'].forEach((k) => el[k].addEventListener('change', refresh));

  // ── 단계 이동 ──
  let step = 1;
  function go(n, scroll = true) {
    step = n;
    document.querySelectorAll('[data-step]').forEach((sec) => { sec.hidden = Number(sec.dataset.step) !== n; });
    document.querySelectorAll('.wiz-steps li').forEach((li, i) => {
      li.classList.toggle('on', i + 1 === n);
      li.classList.toggle('past', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('wiz-now').textContent = n;
    if (n === 2) {
      const s = st();
      $('ex-summary').innerHTML = `<b>${esc(s.school)}</b> · ${esc(s.year)} · <b>${esc(s.subject)} · ${esc(s.paper)}</b>`;
    }
    nav();
    if (!scroll) return;
    const top = $('exam').getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }
  function nav() {
    const prev = $('wiz-prev'), next = $('wiz-next');
    const s = st();
    prev.hidden = step !== 2;
    $('wiz-nav').hidden = step === 3;
    if (step === 1) {
      next.textContent = '다음';
      next.disabled = !(s.school && s.year && s.subject && s.paper);
    } else if (step === 2) {
      const agree = $('ex-agree');
      next.textContent = busy ? '올리는 중…' : '업로드하기';
      next.disabled = busy || !picked.length || (agree && !agree.checked);
    }
  }
  $('wiz-prev').onclick = () => go(1);
  $('wiz-next').onclick = () => (step === 1 ? go(2) : submit());

  // ── 사진 고르기 (카카오톡 안 브라우저는 한 번에 한 장만 골라져서 계속 모은다) ──
  const MAX_FILES = 16;
  const files = $('ex-files');
  let picked = [];
  let busy = false;
  const say = (msg) => { const a = $('ex-alert'); a.textContent = msg || ''; a.hidden = !msg; };
  function renderThumbs() {
    const box = $('ex-thumbs');
    box.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));
    box.textContent = '';
    picked.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'thumb-item';
      if (f.type === 'application/pdf') {
        const d = document.createElement('div');
        d.className = 'pdf-thumb';
        d.textContent = `PDF · ${f.name}`;
        item.appendChild(d);
      } else {
        const img = document.createElement('img');
        img.alt = `시험지 사진 ${i + 1}`;
        img.src = URL.createObjectURL(f);
        item.appendChild(img);
      }
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'thumb-x'; x.textContent = '✕';
      x.setAttribute('aria-label', `${i + 1}번째 파일 빼기`);
      x.onclick = () => { picked.splice(i, 1); renderThumbs(); };
      item.appendChild(x);
      box.appendChild(item);
    });
    $('ex-count').textContent = picked.length ? `${picked.length}장 선택됨 · 더 추가할 수 있어요 (최대 ${MAX_FILES}장)` : '';
    nav();
  }
  files.onchange = () => {
    const add = [...files.files];
    files.value = '';
    say(picked.length + add.length > MAX_FILES ? `최대 ${MAX_FILES}장까지 올릴 수 있어요. 앞의 ${MAX_FILES}장만 담았어요.` : '');
    picked = picked.concat(add).slice(0, MAX_FILES);
    renderThumbs();
  };
  if ($('ex-agree')) $('ex-agree').onchange = nav;

  // 휴대폰 사진은 한 장에 5~10MB 라 올리기 전에 긴 변 2000px JPEG 로 줄인다. 실패하면 원본 그대로.
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700 * 1024) return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch { return file; }
  }

  async function submit() {
    if (busy) return;
    busy = true; say(''); nav();
    const s = st();
    let r;
    try {
      const fd = new FormData();
      Object.entries(s).forEach(([k, v]) => fd.append(k, v));
      if ($('ex-agree') && $('ex-agree').checked) fd.append('agree_no_reason', 'on');
      for (const f of picked) fd.append('photos', await shrink(f), f.name);
      const res = await fetch('/exams/upload', { method: 'POST', body: fd });
      r = await res.json();
    } catch {
      r = { status: 'error', message: '업로드 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' };
    }
    busy = false;
    if (r.status === 'accepted') {
      if (!multi.has(s.subject)) done.add(keyOf(s));
      showDone(r, s);
    } else if (r.status === 'duplicate') {
      done.add(keyOf(s));
      el.paper.value = '';
      refresh();
      go(1);
      $('ex-hint').innerHTML = '<span class="bad">방금 다른 분이 먼저 올린 시험지예요. 다른 시험지를 골라 주세요.</span>';
    } else {
      say(r.reason || r.message || '오류가 발생했어요.');
      nav();
    }
  }

  // ── 03 접수 완료: 보상 받을 방법 ──
  function showDone(r, s) {
    const both = methods.bank && methods.coupon;
    const me = EXAM.me || {};
    $('ex-done').innerHTML = `
      <div class="m-icon ok">✓</div>
      <h3 class="wiz-done-title">시험지가 접수됐어요!</h3>
      <p class="center muted"><b>${esc(s.school)} · ${esc(s.subject)} ${esc(s.paper)}</b><br>관리자가 확인한 뒤 <b>${reward}원</b>을 보내 드려요. 받을 방법을 알려 주세요.</p>
      <form id="claim" class="wiz-rows">
        ${both ? `<div class="wrow"><span class="wrow-l">받는 방법</span><div class="wrow-c wrow-radio">
          <label><input type="radio" name="type" value="bank" checked> 계좌 입금</label>
          <label><input type="radio" name="type" value="coupon"> ${esc(methods.couponLabel)}</label></div></div>`
          : `<input type="hidden" name="type" value="${methods.coupon ? 'coupon' : 'bank'}">`}
        <label class="wrow"><span class="wrow-l">이름</span><span class="wrow-c"><input name="name" required maxlength="20" value="${esc(me.name)}"></span></label>
        <label class="wrow"><span class="wrow-l">연락처</span><span class="wrow-c"><input name="phone" type="tel" inputmode="tel" required placeholder="010-0000-0000" value="${esc(me.phone)}"></span></label>
        <div data-bank-only${methods.bank ? '' : ' hidden'}>
          <div class="wrow"><span class="wrow-l">계좌</span><div class="wrow-c wrow-split">
            <input name="bank" maxlength="20" placeholder="은행 (예: 국민)" aria-label="은행">
            <input name="holder" maxlength="20" placeholder="예금주" aria-label="예금주"></div></div>
          <div class="wrow"><span class="wrow-l" aria-hidden="true"></span><span class="wrow-c"><input name="account_no" inputmode="numeric" maxlength="30" placeholder="계좌번호 (숫자만)" aria-label="계좌번호"></span></div>
        </div>
        <p class="muted small center" id="claim-msg" role="alert">입력하신 정보는 보상 지급에만 사용됩니다.${EXAM.member ? ' 나중에 마이페이지에서 입력해도 돼요.' : ' 지금 입력하지 않으면 보상을 받을 수 없어요.'}</p>
        <div class="wiz-nav">
          <button type="button" class="wbtn wbtn-dark" id="claim-skip">${EXAM.member ? '나중에 입력' : '받지 않기'}</button>
          <button class="wbtn wbtn-brand">보내기</button>
        </div>
      </form>`;
    go(3);
    if (window.bindRewardForm) window.bindRewardForm($('claim'));
    $('claim-skip').onclick = () => {
      if (!EXAM.member) fetch('/exams/claim/skip', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, token: r.token }) }).catch(() => {});
      finished(EXAM.member ? '보상 받는 방법은 마이페이지에서 입력할 수 있어요.' : '올려 주셔서 감사합니다!');
    };
    $('claim').onsubmit = async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(ev.target));
      body.id = r.id; body.token = r.token;
      let j;
      try {
        const res = await fetch('/exams/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        j = await res.json();
      } catch { j = { ok: false, message: '전송 중 오류가 발생했어요. 다시 시도해 주세요.' }; }
      if (!j.ok) { const m = $('claim-msg'); m.textContent = j.message; m.className = 'alert alert-bad'; return; }
      finished(j.message);
    };
  }
  function finished(msg) {
    $('ex-done').innerHTML = `<div class="m-icon ok">✓</div><h3 class="wiz-done-title">${esc(msg)}</h3>
      <p class="center muted">다른 시험지도 있으면 이어서 올려 주세요.</p>
      <div class="wiz-nav"><a class="wbtn wbtn-dark" href="${EXAM.member ? '/my' : '/'}">${EXAM.member ? '마이페이지' : '홈으로'}</a>
      <button type="button" class="wbtn wbtn-brand" id="ex-again">다른 시험지 올리기</button></div>`;
    $('ex-again').onclick = () => {
      picked = []; renderThumbs(); say('');
      el.paper.value = ''; refresh(); go(1);
    };
  }

  // ── 시작: 메인에서 학교를 골라 들어오면 학교급·학교를 미리 채운다 ──
  const preset = EXAM.preset;
  if (preset) [...el.level].forEach((r) => { r.checked = r.value === levelOf(preset); });
  fillSchools(preset);
  refresh();
  go(1, false);
})();
