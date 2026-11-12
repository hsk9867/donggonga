// 시험지 올리기: 학교 → 연도 → 과목 → 시험지 → 사진 선택 → 업로드 → 보상 받을 방법 입력
(() => {
  const EXAM = window.EXAM;
  const { papers, methods } = EXAM;
  const multi = new Set(EXAM.multi || []);
  const done = new Set(EXAM.done); // '학교|연도|과목|시험지'
  const st = { school: '', year: '', subject: '', paper: '' };
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keyOf = (paper) => [st.school, st.year, st.subject, paper].join('|');
  const markDone = () => { if (!multi.has(st.subject)) done.add(keyOf(st.paper)); };
  const reward = Number(EXAM.reward).toLocaleString('ko-KR');

  function bind(groupId, field, after) {
    $(groupId).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      pick(groupId, field, b.dataset.v);
      after();
    });
  }
  function pick(groupId, field, value) {
    st[field] = value;
    $(groupId).querySelectorAll('button').forEach((x) => {
      const on = x.dataset.v === value;
      x.classList.toggle('active', on);
      x.setAttribute('aria-pressed', String(on));
    });
  }
  function resetFrom(field) {
    const order = ['year', 'subject', 'paper'];
    order.slice(order.indexOf(field)).forEach((f) => {
      st[f] = '';
      $('ex-' + f).querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    });
  }
  function renderPapers() {
    $('ex-paper').innerHTML = (papers[st.subject] || []).map((p) => {
      const isDone = done.has(keyOf(p));
      return `<button type="button" data-v="${esc(p)}" class="${isDone ? 'done' : ''} ${st.paper === p ? 'active' : ''}" ${isDone ? 'disabled' : ''}>${esc(p)}<small>${isDone ? '업로드 완료' : '모집중'}</small></button>`;
    }).join('');
  }
  function show() {
    $('ex-year-wrap').hidden = !st.school;
    $('ex-subject-wrap').hidden = !st.year;
    $('ex-paper-wrap').hidden = !st.subject;
    $('ex-form').hidden = !st.paper;
    if (st.subject) renderPapers();
    $('ex-summary').innerHTML = st.paper ? `<b>${esc(st.school)}</b> · ${esc(st.year)} · <b>${esc(st.subject)} · ${esc(st.paper)}</b>` : '';
    updateSubmit();
  }
  const into = (id, block) => $(id).scrollIntoView({ behavior: 'smooth', block });
  bind('ex-school', 'school', () => { resetFrom('year'); show(); into('ex-year-wrap', 'center'); });
  bind('ex-year', 'year', () => { resetFrom('subject'); show(); });
  bind('ex-subject', 'subject', () => { resetFrom('paper'); show(); into('ex-paper-wrap', 'start'); });
  bind('ex-paper', 'paper', () => { show(); into('ex-form', 'center'); });

  // 고른 파일을 계속 모은다 (카카오톡 안 브라우저 등은 한 번에 한 장만 고를 수 있어서)
  const MAX_FILES = 16;
  const files = $('ex-files');
  let picked = [];
  function updateSubmit() {
    const agree = $('ex-agree'); // 비회원만 있음
    $('ex-submit').disabled = !(st.paper && picked.length && (!agree || agree.checked));
    $('ex-count').textContent = picked.length ? `${picked.length}장 선택됨 · 더 추가할 수 있어요 (최대 ${MAX_FILES}장)` : '';
  }
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
    updateSubmit();
  }
  function clearFiles() { picked = []; files.value = ''; renderThumbs(); }
  if ($('ex-agree')) $('ex-agree').onchange = updateSubmit;
  files.onchange = () => {
    const add = [...files.files];
    files.value = ''; // 같은 파일을 다시 골라도 change가 일어나게
    if (picked.length + add.length > MAX_FILES) alert(`최대 ${MAX_FILES}장까지 올릴 수 있어요. 앞의 ${MAX_FILES}장만 담았어요.`);
    picked = picked.concat(add).slice(0, MAX_FILES);
    renderThumbs();
  };

  // 휴대폰 사진은 한 장에 5~10MB라 올리기 전에 긴 변 2000px JPEG로 줄인다. 실패하면 원본 그대로.
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

  function modal(html) {
    $('modal-body').innerHTML = html;
    $('modal').hidden = false;
    $('modal').querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => { $('modal').hidden = true; }; });
    const first = $('modal').querySelector('button, input');
    if (first) first.focus();
  }
  const finish = () => { $('modal').hidden = true; clearFiles(); resetFrom('paper'); show(); };

  $('ex-form').onsubmit = async (e) => {
    e.preventDefault();
    $('ex-submit').disabled = true;
    modal('<div class="spinner"></div><p class="center">시험지를 올리고 있어요…<br><span class="muted small">사진이 많으면 1분 정도 걸릴 수 있어요.</span></p>');
    let r;
    try {
      const fd = new FormData();
      Object.entries(st).forEach(([k, v]) => fd.append(k, v));
      if ($('ex-agree') && $('ex-agree').checked) fd.append('agree_no_reason', 'on');
      for (const f of picked) fd.append('photos', await shrink(f), f.name);
      const res = await fetch('/exams/upload', { method: 'POST', body: fd });
      r = await res.json();
    } catch {
      r = { status: 'error', message: '업로드 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' };
    }
    updateSubmit();

    if (r.status === 'accepted') {
      markDone();
      show();
      const skip = () => {
        // 서버에 '받지 않음'을 알린다 (카카오톡 안 브라우저는 confirm 창이 막혀 있어 버튼 이름으로 안내)
        fetch('/exams/claim/skip', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, token: r.token }) }).catch(() => {});
        finish();
      };
      const both = methods.bank && methods.coupon;
      const me = EXAM.me || {};
      modal(`<div class="m-icon ok">✓</div><h2>시험지가 접수됐어요!</h2>
        <p class="center">관리자가 확인한 뒤 <b>${reward}원</b>을 보내 드려요.<br>받을 방법을 알려 주세요.</p>
        <form id="claim" class="form">
          ${both ? `<div class="seg seg-radio">
            <label><input type="radio" name="type" value="bank" checked><span>계좌로 받기</span></label>
            <label><input type="radio" name="type" value="coupon"><span>${esc(methods.couponLabel)}</span></label></div>`
            : `<input type="hidden" name="type" value="${methods.coupon ? 'coupon' : 'bank'}">`}
          <label class="f"><span class="f-l">이름</span><input name="name" required maxlength="20" value="${esc(me.name)}"></label>
          <label class="f"><span class="f-l">연락처</span><input name="phone" type="tel" inputmode="tel" required placeholder="010-0000-0000" value="${esc(me.phone)}"></label>
          <div data-bank-only${methods.bank ? '' : ' hidden'}>
            <div class="row2"><label class="f"><span class="f-l">은행</span><input name="bank" maxlength="20" placeholder="예: 국민"></label>
            <label class="f"><span class="f-l">예금주</span><input name="holder" maxlength="20"></label></div>
            <label class="f" style="margin-top:16px"><span class="f-l">계좌번호</span><input name="account_no" inputmode="numeric" maxlength="30" placeholder="숫자만 입력"></label>
          </div>
          <p class="muted small" id="claim-msg" role="alert">입력하신 정보는 보상 지급에만 사용됩니다.${EXAM.member ? ' 나중에 마이페이지에서 입력해도 돼요.' : ' 지금 입력하지 않으면 보상을 받을 수 없어요.'}</p>
          <button class="btn btn-brand btn-block">보내기</button>
          <button type="button" class="btn btn-line btn-block" id="claim-close">${EXAM.member ? '나중에 입력하기' : '받지 않고 닫기'}</button>
        </form>`);
      if (window.bindRewardForm) window.bindRewardForm($('claim'));
      $('claim-close').onclick = EXAM.member ? finish : skip;
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
        modal(`<div class="m-icon ok">✓</div><h2>${esc(j.message)}</h2><button class="btn btn-brand btn-block" id="claim-done">확인</button>`);
        $('claim-done').onclick = finish;
      };
    } else if (r.status === 'duplicate') {
      markDone();
      show();
      modal(`<div class="m-icon warn">!</div><h2>이미 올라온 시험지예요.</h2>
        <p class="center">다른 과목이나 <a href="/exams/missing">아직 안 올라온 시험지</a>를 올려 주세요.</p><button class="btn btn-brand btn-block" data-close>확인</button>`);
    } else if (r.status === 'unreadable') {
      modal(`<div class="m-icon bad">!</div><h2>올릴 수 없는 파일이에요.</h2>
        ${r.reason ? `<p class="center">${esc(r.reason)}</p>` : ''}<button class="btn btn-brand btn-block" data-close>다시 고르기</button>`);
    } else {
      modal(`<div class="m-icon bad">!</div><h2>${esc(r.message || '오류가 발생했어요.')}</h2><button class="btn btn-brand btn-block" data-close>확인</button>`);
    }
  };

  // 메인에서 학교를 골라 들어온 경우
  if (EXAM.preset) { pick('ex-school', 'school', EXAM.preset); show(); }
})();
