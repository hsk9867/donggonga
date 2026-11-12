// 관리자 (/admin) — 시험지 검수, 보상 지급, 공지·설명회·상담·회원·설정
import {
  esc, rich, won, html, json, redirect, cookies, setCookie, secretOf, signToken, readToken, safeEq, hashPw, randomToken,
  limited, ipOf, str, nowIso, kst, kstDay, putSetting, allSchools,
} from './lib.js';
import { removeUpload } from './worker.js';

const ADMIN_TTL = 12 * 3600;
const MENU = [
  ['/admin', '대시보드'], ['/admin/uploads', '시험지·보상'], ['/admin/notices', '공지사항'], ['/admin/seminars', '설명회'],
  ['/admin/consults', '상담·문자 신청'], ['/admin/users', '회원'], ['/admin/settings', '설정'],
];

function shell(ctx, title, body) {
  const nav = MENU.map(([h, l]) => `<a href="${h}"${ctx.path === h || (h !== '/admin' && ctx.path.startsWith(h)) ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  return html(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)} | ${esc(ctx.S.site.name)} 관리자</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/css/style.css?v=4"><link rel="stylesheet" href="/css/admin.css?v=4"></head>
<body class="adm">
<header class="adm-hdr"><a class="adm-brand" href="/admin"><span class="brand-mark">동</span> ${esc(ctx.S.site.name)} 관리자</a>
  <div class="adm-hdr-r"><a href="/" target="_blank" rel="noopener">사이트 보기</a>
  <form method="post" action="/admin/logout" class="inline"><button class="hdr-plain">로그아웃</button></form></div></header>
<nav class="adm-nav">${nav}</nav>
<main class="adm-main"><h1>${esc(title)}</h1>${body}</main>
</body></html>`);
}
const flash = (url) => {
  const ok = url.searchParams.get('ok'), err = url.searchParams.get('err');
  return (ok ? `<div class="alert alert-ok">${esc(ok)}</div>` : '') + (err ? `<div class="alert alert-bad">${esc(err)}</div>` : '');
};
const back = (to, msg, key = 'ok') => redirect(`${to}${to.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`);
const formOf = async (req) => { try { return Object.fromEntries([...(await req.formData())].filter(([, v]) => typeof v === 'string')); } catch { return {}; } };

export async function handleAdmin(ctx) {
  const { req, env, path, url, S } = ctx;
  const db = env.DB;
  const GET = req.method !== 'POST';

  // ── 로그인 ──
  if (path === '/admin/login') {
    const page = (error = '') => html(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>관리자 로그인</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/css/style.css?v=4"><link rel="stylesheet" href="/css/admin.css?v=4"></head>
<body class="adm adm-login"><form method="post" class="card form-card form">
<h1><span class="brand-mark">동</span> ${esc(S.site.name)} 관리자</h1>
${error ? `<div class="alert alert-bad">${esc(error)}</div>` : ''}
<label class="f"><span class="f-l">관리자 비밀번호</span><input type="password" name="password" required autofocus autocomplete="current-password"></label>
<button class="btn btn-brand btn-block btn-lg">로그인</button></form></body></html>`, error ? 400 : 200);
    if (GET) return page();
    if (!env.ADMIN_PASSWORD) return page('ADMIN_PASSWORD 시크릿이 아직 설정되지 않았습니다.');
    if (await limited(db, 'adm:' + ipOf(req), 6, 600)) return page('로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.');
    const b = await formOf(req);
    if (!safeEq((await hashPw(String(b.password || ''), 'adm')).hash, (await hashPw(env.ADMIN_PASSWORD, 'adm')).hash)) return page('비밀번호가 올바르지 않습니다.');
    return redirect('/admin', { 'Set-Cookie': setCookie('dg_a', await signToken(secretOf(env), 'admin', ADMIN_TTL), { maxAge: ADMIN_TTL, secure: ctx.secure, sameSite: 'Strict' }) });
  }
  if ((await readToken(secretOf(env), cookies(req).dg_a)) !== 'admin') {
    return GET ? redirect('/admin/login') : json({ ok: false, message: '로그인이 필요합니다.' }, 401);
  }
  if (path === '/admin/logout' && !GET) return redirect('/admin/login', { 'Set-Cookie': setCookie('dg_a', '', { maxAge: 0, secure: ctx.secure, sameSite: 'Strict' }) });

  let m;

  // ── 대시보드 ──
  if (path === '/admin' && GET) {
    const one = async (sql) => (await db.prepare(sql).first()).n;
    const c = {
      pending: await one("SELECT COUNT(*) AS n FROM uploads WHERE status = 'pending'"),
      unpaid: await one("SELECT COUNT(*) AS n FROM uploads WHERE status = 'approved' AND paid_at IS NULL AND reward_type != 'none'"),
      paid: await one('SELECT COUNT(*) AS n FROM uploads WHERE paid_at IS NOT NULL'),
      paidSum: await one("SELECT COALESCE(SUM(amount), 0) AS n FROM uploads WHERE paid_at IS NOT NULL AND reward_type = 'bank'"),
      consults: await one('SELECT COUNT(*) AS n FROM consults WHERE done = 0'),
      users: await one('SELECT COUNT(*) AS n FROM users'),
    };
    const recent = (await db.prepare('SELECT * FROM uploads ORDER BY id DESC LIMIT 8').all()).results;
    return shell(ctx, '대시보드', `
<div class="adm-cards">
  <a class="card" href="/admin/uploads?tab=pending"><span>검수 대기</span><b class="${c.pending ? 'accent' : ''}">${c.pending}</b></a>
  <a class="card" href="/admin/uploads?tab=unpaid"><span>지급 대기</span><b class="${c.unpaid ? 'accent' : ''}">${c.unpaid}</b></a>
  <a class="card" href="/admin/uploads?tab=paid"><span>지급 완료</span><b>${c.paid}</b><small>입금 합계 ${won(c.paidSum)}원</small></a>
  <a class="card" href="/admin/consults"><span>새 상담·문자 신청</span><b class="${c.consults ? 'accent' : ''}">${c.consults}</b></a>
  <a class="card" href="/admin/users"><span>회원</span><b>${c.users}</b></a>
</div>
<h2>최근 올라온 시험지</h2>${uploadTable(recent)}`);
  }

  // ── 시험지·보상 ──
  if (path === '/admin/uploads' && GET) {
    const TABS = {
      pending: ['검수 대기', "status = 'pending'"],
      unpaid: ['지급 대기', "status = 'approved' AND paid_at IS NULL AND reward_type != 'none'"],
      paid: ['지급 완료', 'paid_at IS NOT NULL'],
      rejected: ['반려', "status = 'rejected'"],
      all: ['전체', '1 = 1'],
    };
    const tab = TABS[url.searchParams.get('tab')] ? url.searchParams.get('tab') : 'pending';
    const rows = (await db.prepare(`SELECT * FROM uploads WHERE ${TABS[tab][1]} ORDER BY id DESC LIMIT 300`).all()).results;
    return shell(ctx, '시험지·보상', `${flash(url)}
<div class="tabs">${Object.entries(TABS).map(([k, [l]]) => `<a class="tab${k === tab ? ' active' : ''}" href="/admin/uploads?tab=${k}">${l}</a>`).join('')}</div>
${uploadTable(rows)}`);
  }

  if ((m = path.match(/^\/admin\/uploads\/(\d+)(?:\/(review|pay|unpay|delete|reward))?$/))) {
    const id = +m[1];
    const u = await db.prepare('SELECT u.*, m.username FROM uploads u LEFT JOIN users m ON m.id = u.user_id WHERE u.id = ?').bind(id).first();
    if (!u) return back('/admin/uploads', '없는 접수 건입니다.', 'err');
    const here = `/admin/uploads/${id}`;
    if (GET && !m[2]) {
      const files = (await db.prepare('SELECT * FROM upload_files WHERE upload_id = ? ORDER BY id').bind(id).all()).results;
      return shell(ctx, `접수 #${id}`, `${flash(url)}${uploadDetail(S, u, files)}`);
    }
    if (GET) return redirect(here);
    const b = await formOf(req);
    if (m[2] === 'review') {
      if (u.paid_at) return back(here, '이미 지급 처리된 건은 상태를 바꿀 수 없습니다. 먼저 지급을 취소하세요.', 'err');
      if (b.action === 'approve') {
        await db.prepare("UPDATE uploads SET status = 'approved', reject_reason = '', reviewed_at = ? WHERE id = ?").bind(nowIso(), id).run();
        return back(here, '승인했습니다. 아래에서 보상을 지급해 주세요.');
      }
      if (b.action === 'reject') {
        const reason = str(b.reason, 300);
        if (!reason) return back(here, '반려 사유를 입력해 주세요.', 'err');
        await db.prepare("UPDATE uploads SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?").bind(reason, nowIso(), id).run();
        return back(here, '반려했습니다. 이 시험지는 다시 모집중으로 바뀝니다.');
      }
      if (b.action === 'pending') {
        // 반려를 되돌릴 때, 그 사이 다른 사람이 같은 시험지를 올렸으면 막는다
        const other = await db.prepare("SELECT id FROM uploads WHERE school = ? AND year = ? AND subject = ? AND paper = ? AND status != 'rejected' AND id != ?")
          .bind(u.school, u.year, u.subject, u.paper, id).first();
        if (other && !(S.multi || []).includes(u.subject)) return back(here, `같은 시험지가 이미 접수되어 있습니다 (#${other.id}).`, 'err');
        await db.prepare("UPDATE uploads SET status = 'pending', reject_reason = '', reviewed_at = NULL WHERE id = ?").bind(id).run();
        return back(here, '검수 대기로 되돌렸습니다.');
      }
    }
    if (m[2] === 'reward') {
      if (u.paid_at) return back(here, '이미 지급 처리된 건입니다.', 'err');
      const type = ['bank', 'coupon', 'none', ''].includes(b.reward_type) ? b.reward_type : '';
      await db.prepare('UPDATE uploads SET reward_type = ?, name = ?, phone = ?, bank = ?, holder = ?, account_no = ?, admin_memo = ? WHERE id = ?')
        .bind(type, str(b.name, 20), str(b.phone, 20), str(b.bank, 20), str(b.holder, 20), str(b.account_no, 30), str(b.admin_memo, 500), id).run();
      return back(here, '지급 정보를 저장했습니다.');
    }
    if (m[2] === 'pay') {
      if (u.status !== 'approved') return back(here, '먼저 시험지를 승인해 주세요.', 'err');
      if (u.paid_at) return back(here, '이미 지급 처리된 건입니다.', 'err');
      const method = b.method === 'coupon' ? 'coupon' : 'bank';
      const amount = Math.max(0, Math.min(1000000, parseInt(b.amount, 10) || 0));
      if (method === 'bank' && !u.account_no) return back(here, '계좌 정보가 없습니다. 지급 정보를 먼저 입력하세요.', 'err');
      if (method === 'coupon' && !str(b.coupon_name, 60)) return back(here, '쿠폰 이름을 입력해 주세요. (예: 편의점 2,000원권)', 'err');
      await db.prepare('UPDATE uploads SET reward_type = ?, amount = ?, coupon_name = ?, coupon_code = ?, paid_at = ? WHERE id = ?')
        .bind(method, amount, method === 'coupon' ? str(b.coupon_name, 60) : '', method === 'coupon' ? str(b.coupon_code, 300) : '', nowIso(), id).run();
      return back(here, method === 'coupon' ? '쿠폰 지급 완료로 처리했습니다.' : '입금 완료로 처리했습니다.');
    }
    if (m[2] === 'unpay') {
      await db.prepare("UPDATE uploads SET paid_at = NULL, coupon_name = '', coupon_code = '' WHERE id = ?").bind(id).run();
      return back(here, '지급 처리를 취소했습니다.');
    }
    if (m[2] === 'delete') {
      await removeUpload(env, id);
      return back('/admin/uploads?tab=all', `접수 #${id}와 파일을 삭제했습니다.`);
    }
  }

  if ((m = path.match(/^\/admin\/file\/(\d+)$/)) && GET) {
    const f = await db.prepare('SELECT * FROM upload_files WHERE id = ?').bind(+m[1]).first();
    const obj = f && await env.FILES.get(f.r2_key);
    if (!obj) return new Response('Not Found', { status: 404 });
    return new Response(obj.body, {
      headers: {
        'Content-Type': f.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `${url.searchParams.has('dl') ? 'attachment' : 'inline'}; filename="upload-${f.upload_id}-${f.id}.${f.r2_key.split('.').pop()}"`,
        // PDF 는 브라우저 내장 뷰어가 sandbox 에서 막히므로 이미지에만 적용
        ...(f.mime === 'application/pdf' ? {} : { 'Content-Security-Policy': "default-src 'none'; sandbox" }),
      },
    });
  }

  // ── 공지사항 ──
  if (path === '/admin/notices') {
    if (GET) {
      const rows = (await db.prepare('SELECT * FROM notices ORDER BY pinned DESC, id DESC LIMIT 300').all()).results;
      return shell(ctx, '공지사항', `${flash(url)}
<details class="card adm-form"${rows.length ? '' : ' open'}><summary>+ 새 공지 쓰기</summary>${noticeForm({})}</details>
<div class="table-wrap card"><table class="adm-table"><thead><tr><th>번호</th><th>제목</th><th>작성일</th><th>조회</th><th></th></tr></thead><tbody>
${rows.map((n) => `<tr><td>${n.id}</td><td>${n.pinned ? '<span class="badge badge-brand">공지</span> ' : ''}<a href="/admin/notices/${n.id}">${esc(n.title)}</a></td><td>${kstDay(n.created_at)}</td><td>${n.views}</td>
<td><a class="btn btn-sm btn-line" href="/admin/notices/${n.id}">수정</a></td></tr>`).join('') || '<tr><td colspan="5" class="empty">등록된 공지가 없습니다.</td></tr>'}
</tbody></table></div>`);
    }
    const b = await formOf(req);
    const title = str(b.title, 120), body = str(b.body, 20000);
    if (!title) return back('/admin/notices', '제목을 입력해 주세요.', 'err');
    if (b.id) await db.prepare('UPDATE notices SET title = ?, body = ?, pinned = ? WHERE id = ?').bind(title, body, b.pinned === 'on' ? 1 : 0, +b.id).run();
    else await db.prepare('INSERT INTO notices (title, body, pinned, created_at) VALUES (?, ?, ?, ?)').bind(title, body, b.pinned === 'on' ? 1 : 0, nowIso()).run();
    return back('/admin/notices', '저장했습니다.');
  }
  if ((m = path.match(/^\/admin\/notices\/(\d+)(\/delete)?$/))) {
    if (m[2] && !GET) { await db.prepare('DELETE FROM notices WHERE id = ?').bind(+m[1]).run(); return back('/admin/notices', '삭제했습니다.'); }
    const n = await db.prepare('SELECT * FROM notices WHERE id = ?').bind(+m[1]).first();
    if (!n) return back('/admin/notices', '없는 공지입니다.', 'err');
    return shell(ctx, '공지 수정', `<a class="back" href="/admin/notices">← 목록</a><div class="card adm-form">${noticeForm(n)}</div>
<form method="post" action="/admin/notices/${n.id}/delete" data-confirm="이 공지를 삭제할까요?"><button class="btn btn-sm btn-danger">공지 삭제</button></form>${confirmScript}`);
  }

  // ── 설명회 ──
  if (path === '/admin/seminars') {
    if (GET) {
      const rows = (await db.prepare('SELECT s.*, (SELECT COUNT(*) FROM seminar_apps a WHERE a.seminar_id = s.id) AS apps FROM seminars s ORDER BY date DESC, id DESC LIMIT 300').all()).results;
      return shell(ctx, '설명회', `${flash(url)}
<details class="card adm-form"${rows.length ? '' : ' open'}><summary>+ 새 설명회 등록</summary>${seminarForm({})}</details>
<div class="table-wrap card"><table class="adm-table"><thead><tr><th>날짜</th><th>제목</th><th>대상</th><th>신청</th><th>상태</th><th></th></tr></thead><tbody>
${rows.map((s) => `<tr><td>${esc(s.date || '상시')}</td><td><a href="/admin/seminars/${s.id}">${esc(s.title)}</a></td><td>${esc(s.target)}</td><td><b>${s.apps}</b>명</td>
<td>${s.closed ? '<span class="pill pill-mute">마감</span>' : '<span class="pill pill-need">신청 중</span>'}</td><td><a class="btn btn-sm btn-line" href="/admin/seminars/${s.id}">신청자·수정</a></td></tr>`).join('') || '<tr><td colspan="6" class="empty">등록된 설명회가 없습니다.</td></tr>'}
</tbody></table></div>`);
    }
    const b = await formOf(req);
    const title = str(b.title, 120);
    if (!title) return back('/admin/seminars', '제목을 입력해 주세요.', 'err');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '';
    const vals = [title, str(b.target, 100), date, str(b.when_text, 100), str(b.place, 100), str(b.sessions, 1000), str(b.body, 20000), b.closed === 'on' ? 1 : 0];
    if (b.id) await db.prepare('UPDATE seminars SET title = ?, target = ?, date = ?, when_text = ?, place = ?, sessions = ?, body = ?, closed = ? WHERE id = ?').bind(...vals, +b.id).run();
    else await db.prepare('INSERT INTO seminars (title, target, date, when_text, place, sessions, body, closed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...vals, nowIso()).run();
    return back(b.id ? `/admin/seminars/${+b.id}` : '/admin/seminars', '저장했습니다.');
  }
  if ((m = path.match(/^\/admin\/seminars\/(\d+)(\/delete)?$/))) {
    if (m[2] && !GET) {
      await db.batch([db.prepare('DELETE FROM seminar_apps WHERE seminar_id = ?').bind(+m[1]), db.prepare('DELETE FROM seminars WHERE id = ?').bind(+m[1])]);
      return back('/admin/seminars', '삭제했습니다.');
    }
    const s = await db.prepare('SELECT * FROM seminars WHERE id = ?').bind(+m[1]).first();
    if (!s) return back('/admin/seminars', '없는 설명회입니다.', 'err');
    const apps = (await db.prepare('SELECT * FROM seminar_apps WHERE seminar_id = ? ORDER BY id').bind(s.id).all()).results;
    return shell(ctx, '설명회 신청자·수정', `${flash(url)}<a class="back" href="/admin/seminars">← 목록</a>
<h2>신청자 ${apps.length}명</h2>
<div class="table-wrap card"><table class="adm-table"><thead><tr><th>#</th><th>학생</th><th>학교·학년</th><th>학부모 연락처</th><th>신청 회차</th><th>궁금한 점</th><th>신청일</th></tr></thead><tbody>
${apps.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.student_name)}</td><td>${esc(a.school_grade)}</td><td>${esc(a.parent_phone)}</td><td>${esc(a.session)}</td><td class="wrap">${esc(a.question)}</td><td>${kst(a.created_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">아직 신청자가 없습니다.</td></tr>'}
</tbody></table></div>
<h2>내용 수정</h2><div class="card adm-form">${seminarForm(s)}</div>
<form method="post" action="/admin/seminars/${s.id}/delete" data-confirm="설명회와 신청자 목록을 모두 삭제할까요?"><button class="btn btn-sm btn-danger">설명회 삭제</button></form>${confirmScript}`);
  }

  // ── 상담·문자 신청 ──
  if (path === '/admin/consults' && GET) {
    const rows = (await db.prepare('SELECT * FROM consults ORDER BY done, id DESC LIMIT 500').all()).results;
    return shell(ctx, '상담·문자 신청', `${flash(url)}
<p><a class="btn btn-sm btn-line" href="/admin/consults.csv">엑셀(CSV)로 내려받기</a></p>
<div class="table-wrap card"><table class="adm-table"><thead><tr><th>신청일</th><th>학생</th><th>학부모 연락처</th><th>학생 연락처</th><th>학교·학년</th><th>관심</th><th>문의 내용</th><th></th></tr></thead><tbody>
${rows.map((c) => `<tr class="${c.done ? 'dim' : ''}"><td>${kst(c.created_at)}</td><td>${esc(c.student_name)}</td><td>${esc(c.parent_phone)}</td><td>${esc(c.student_phone)}</td><td>${esc(c.school)} ${esc(c.grade)}</td><td class="wrap">${esc(c.interests)}</td><td class="wrap">${esc(c.memo)}</td>
<td class="nowrap"><form method="post" action="/admin/consults/${c.id}/done" class="inline"><button class="btn btn-sm ${c.done ? 'btn-line' : 'btn-brand'}">${c.done ? '되돌리기' : '확인 완료'}</button></form>
<form method="post" action="/admin/consults/${c.id}/delete" class="inline" data-confirm="이 신청을 삭제할까요?"><button class="btn btn-sm btn-line">삭제</button></form></td></tr>`).join('') || '<tr><td colspan="8" class="empty">신청 내역이 없습니다.</td></tr>'}
</tbody></table></div>${confirmScript}`);
  }
  if (path === '/admin/consults.csv' && GET) {
    const rows = (await db.prepare('SELECT * FROM consults ORDER BY id DESC').all()).results;
    // 엑셀이 수식으로 해석하지 못하게 =,+,-,@ 로 시작하는 값 앞에 ' 를 붙인다
    const cell = (v) => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
    const csv = '﻿' + [['신청일', '학생 이름', '학부모 연락처', '학생 연락처', '학교', '학년', '관심 항목', '문의 내용', '확인'],
      ...rows.map((c) => [kst(c.created_at), c.student_name, c.parent_phone, c.student_phone, c.school, c.grade, c.interests, c.memo, c.done ? '완료' : ''])]
      .map((r) => r.map(cell).join(',')).join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="consults.csv"', 'Cache-Control': 'no-store' } });
  }
  if ((m = path.match(/^\/admin\/consults\/(\d+)\/(done|delete)$/)) && !GET) {
    if (m[2] === 'done') await db.prepare('UPDATE consults SET done = 1 - done WHERE id = ?').bind(+m[1]).run();
    else await db.prepare('DELETE FROM consults WHERE id = ?').bind(+m[1]).run();
    return back('/admin/consults', '처리했습니다.');
  }

  // ── 회원 ──
  if (path === '/admin/users' && GET) {
    const rows = (await db.prepare('SELECT u.*, (SELECT COUNT(*) FROM uploads x WHERE x.user_id = u.id) AS ups FROM users u ORDER BY id DESC LIMIT 500').all()).results;
    return shell(ctx, '회원', `${flash(url)}
<div class="table-wrap card"><table class="adm-table"><thead><tr><th>가입일</th><th>구분</th><th>아이디</th><th>학생</th><th>학교·학년</th><th>학부모 연락처</th><th>학생 연락처</th><th>문자</th><th>업로드</th><th></th></tr></thead><tbody>
${rows.map((u) => `<tr><td>${kstDay(u.created_at)}</td><td>${u.type === 'parent' ? '학부모' : '학생'}</td><td>${esc(u.username)}</td><td>${esc(u.student_name)}</td><td>${esc(u.school)} ${esc(u.grade)}</td><td>${esc(u.parent_phone)}</td><td>${esc(u.student_phone)}</td><td>${u.agree_sms ? '동의' : '-'}</td><td>${u.ups}</td>
<td class="nowrap"><form method="post" action="/admin/users/${u.id}/reset" class="inline" data-confirm="${esc(u.username)} 회원의 비밀번호를 임시 비밀번호로 바꿀까요?"><button class="btn btn-sm btn-line">비밀번호 초기화</button></form>
<form method="post" action="/admin/users/${u.id}/delete" class="inline" data-confirm="${esc(u.username)} 회원을 삭제할까요?"><button class="btn btn-sm btn-line">삭제</button></form></td></tr>`).join('') || '<tr><td colspan="10" class="empty">가입한 회원이 없습니다.</td></tr>'}
</tbody></table></div>${confirmScript}`);
  }
  if ((m = path.match(/^\/admin\/users\/(\d+)\/(reset|delete)$/)) && !GET) {
    const u = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(+m[1]).first();
    if (!u) return back('/admin/users', '없는 회원입니다.', 'err');
    if (m[2] === 'reset') {
      const temp = randomToken(6).replace(/[-_]/g, 'x');
      const { salt, hash } = await hashPw(temp);
      await db.prepare('UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?').bind(hash, salt, u.id).run();
      // 주소창·방문 기록에 남지 않도록 리다이렉트 없이 바로 보여 준다
      return shell(ctx, '비밀번호 초기화', `<div class="card adm-form"><p><b>${esc(u.username)}</b> 회원의 임시 비밀번호입니다. 이 화면을 벗어나면 다시 볼 수 없습니다.</p>
<p class="adm-temp"><code>${esc(temp)}</code></p><p class="muted small">회원에게 전달하고, 로그인 후 마이페이지에서 비밀번호를 바꾸도록 안내해 주세요.</p>
<a class="btn btn-brand" href="/admin/users">회원 목록으로</a></div>`);
    }
    await db.batch([
      db.prepare('UPDATE uploads SET user_id = NULL WHERE user_id = ?').bind(u.id),
      db.prepare('UPDATE seminar_apps SET user_id = NULL WHERE user_id = ?').bind(u.id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(u.id),
    ]);
    return back('/admin/users', '삭제했습니다.');
  }

  // ── 설정 ──
  if (path === '/admin/settings') {
    if (GET) return shell(ctx, '설정', flash(url) + settingsForm(S));
    const b = await formOf(req);
    const list = (s) => String(s || '').split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean);
    const groups = (text) => String(text || '').split('\n').map((line) => {
      const i = line.indexOf(':');
      return i < 0 ? null : { label: line.slice(0, i).trim().slice(0, 40), list: [...new Set(list(line.slice(i + 1)))] };
    }).filter((g) => g && g.label && g.list.length);

    const schools = groups(b.schools);
    const papers = Object.fromEntries(groups(b.papers).map((g) => [g.label, g.list]));
    const years = list(b.years);
    if (!schools.length || !Object.keys(papers).length || !years.length) return back('/admin/settings', '학교·과목·연도는 한 개 이상 있어야 합니다. 형식을 확인해 주세요.', 'err');

    await putSetting(db, 'site', Object.fromEntries(['name', 'full', 'tagline', 'phone', 'kakao', 'email', 'address', 'hours', 'owner', 'bizno'].map((k) => [k, str(b['site_' + k], 200)])));
    await putSetting(db, 'hero', Object.fromEntries(['line1', 'mark', 'line3', 'sub'].map((k) => [k, str(b['hero_' + k], 300)])));
    const bank = b.reward_bank === 'on', coupon = b.reward_coupon === 'on';
    await putSetting(db, 'reward', {
      amount: Math.max(0, Math.min(1000000, parseInt(b.reward_amount, 10) || 0)),
      bank: bank || !coupon, coupon, couponLabel: str(b.reward_couponLabel, 30) || '모바일 쿠폰', note: str(b.reward_note, 200),
    });
    await putSetting(db, 'schools', schools);
    await putSetting(db, 'papers', papers);
    await putSetting(db, 'years', years);
    await putSetting(db, 'multi', list(b.multi).filter((s) => s in papers));
    return back('/admin/settings', '설정을 저장했습니다.');
  }

  return back('/admin', '없는 페이지입니다.', 'err');
}

// ── 화면 조각 ─────────────────────────────────────────────────────────
const confirmScript = `<script>document.querySelectorAll('[data-confirm]').forEach(function(f){f.addEventListener('submit',function(e){if(!confirm(f.dataset.confirm))e.preventDefault();});});</script>`;

function statePill(u) {
  if (u.status === 'pending') return '<span class="pill pill-wait">검수 대기</span>';
  if (u.status === 'rejected') return '<span class="pill pill-bad">반려</span>';
  if (u.paid_at) return `<span class="pill pill-done">${u.reward_type === 'coupon' ? '쿠폰 지급' : '입금'} 완료</span>`;
  if (u.reward_type === 'none') return '<span class="pill pill-mute">보상 받지 않음</span>';
  return '<span class="pill pill-need">지급 대기</span>';
}
const rewardText = (u) => ({ bank: '계좌', coupon: '쿠폰', none: '받지 않음', '': '미입력' }[u.reward_type] || '');

function uploadTable(rows) {
  return `<div class="table-wrap card"><table class="adm-table"><thead><tr><th>#</th><th>접수일</th><th>학교</th><th>연도</th><th>시험지</th><th>장수</th><th>올린 사람</th><th>받는 방법</th><th>상태</th></tr></thead><tbody>
${rows.map((u) => `<tr><td><a href="/admin/uploads/${u.id}">#${u.id}</a></td><td>${kst(u.created_at)}</td><td>${esc(u.school)}</td><td>${esc(u.year)}</td>
<td><a href="/admin/uploads/${u.id}">${esc(u.subject)} · ${esc(u.paper)}</a></td><td>${u.file_count}</td><td>${esc(u.name) || '<span class="muted">비회원</span>'}${u.user_id ? ' <span class="badge">회원</span>' : ''}</td><td>${rewardText(u)}</td><td>${statePill(u)}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">해당하는 접수 건이 없습니다.</td></tr>'}
</tbody></table></div>`;
}

function uploadDetail(S, u, files) {
  const a = `/admin/uploads/${u.id}`;
  const fileHtml = files.map((f, i) => f.mime === 'application/pdf'
    ? `<a class="adm-file adm-pdf" href="/admin/file/${f.id}" target="_blank" rel="noopener">PDF ${i + 1}<small>${esc(f.name)} · ${(f.size / 1048576).toFixed(1)}MB</small></a>`
    : f.mime === 'image/heic'
      ? `<a class="adm-file adm-pdf" href="/admin/file/${f.id}?dl" >HEIC ${i + 1}<small>내려받아 확인 · ${(f.size / 1048576).toFixed(1)}MB</small></a>`
      : `<a class="adm-file" href="/admin/file/${f.id}" target="_blank" rel="noopener"><img src="/admin/file/${f.id}" alt="시험지 ${i + 1}" loading="lazy"><small>${i + 1} / ${files.length}</small></a>`).join('');

  const review = u.paid_at ? '' : u.status === 'pending' ? `
<div class="adm-actions">
  <form method="post" action="${a}/review"><input type="hidden" name="action" value="approve"><button class="btn btn-brand btn-lg">승인하기</button></form>
  <form method="post" action="${a}/review" class="adm-reject"><input type="hidden" name="action" value="reject">
    <input name="reason" required maxlength="300" placeholder="반려 사유 (예: 2쪽이 흐려서 문제가 보이지 않아요)"><button class="btn btn-danger">반려하기</button></form>
</div>` : `<form method="post" action="${a}/review"><input type="hidden" name="action" value="pending"><button class="btn btn-sm btn-line">검수 대기로 되돌리기</button></form>`;

  const pay = u.status !== 'approved' ? '' : u.paid_at ? `
<div class="alert alert-ok">${u.reward_type === 'coupon'
    ? `<b>쿠폰 지급 완료</b> · ${esc(u.coupon_name)} ${u.coupon_code ? `· <code>${esc(u.coupon_code)}</code>` : ''}`
    : `<b>${won(u.amount)}원 입금 완료</b> · ${esc(u.bank)} ${esc(u.account_no)} (${esc(u.holder)})`} · ${kst(u.paid_at)}</div>
<form method="post" action="${a}/unpay" data-confirm="지급 처리를 취소할까요?"><button class="btn btn-sm btn-line">지급 처리 취소</button></form>` : `
<div class="adm-pay">
  <form method="post" action="${a}/pay" class="card adm-form"><h3>계좌 입금으로 지급</h3>
    <input type="hidden" name="method" value="bank">
    <p>${u.account_no ? `<b>${esc(u.bank)} ${esc(u.account_no)}</b> · 예금주 ${esc(u.holder)}` : '<span class="accent">계좌 정보가 아직 없습니다.</span>'}</p>
    <label class="f"><span class="f-l">입금액 (원)</span><input name="amount" inputmode="numeric" value="${u.amount || S.reward.amount}"></label>
    <button class="btn btn-brand btn-block"${u.account_no ? '' : ' disabled'}>입금 완료로 처리</button>
    <p class="muted small">실제 이체는 은행 앱에서 직접 하신 뒤 눌러 주세요.</p></form>
  <form method="post" action="${a}/pay" class="card adm-form"><h3>쿠폰으로 지급</h3>
    <input type="hidden" name="method" value="coupon"><input type="hidden" name="amount" value="${u.amount || S.reward.amount}">
    <p>받는 번호: <b>${esc(u.phone) || '<span class="accent">연락처 없음</span>'}</b></p>
    <label class="f"><span class="f-l">쿠폰 이름</span><input name="coupon_name" maxlength="60" placeholder="예: 편의점 2,000원 모바일 상품권"></label>
    <label class="f"><span class="f-l">쿠폰 번호·링크 (선택)</span><input name="coupon_code" maxlength="300" placeholder="회원은 마이페이지에서 볼 수 있어요"></label>
    <button class="btn btn-brand btn-block">쿠폰 지급 완료로 처리</button>
    <p class="muted small">문자·카카오톡으로 쿠폰을 보낸 뒤 눌러 주세요. 번호를 적어 두면 회원 마이페이지에도 표시됩니다.</p></form>
</div>`;

  return `<a class="back" href="/admin/uploads">← 목록</a>
<div class="adm-detail">
  <section class="card adm-form">
    <dl class="kv">
      <div><dt>상태</dt><dd>${statePill(u)}</dd></div>
      <div><dt>시험지</dt><dd><b>${esc(u.school)} · ${esc(u.year)} · ${esc(u.subject)} ${esc(u.paper)}</b></dd></div>
      <div><dt>접수일</dt><dd>${kst(u.created_at)} · ${u.file_count}장</dd></div>
      <div><dt>올린 사람</dt><dd>${u.username ? `회원 ${esc(u.username)}` : '비회원'} ${esc(u.name)} ${esc(u.phone)}</dd></div>
      ${u.status === 'rejected' ? `<div><dt>반려 사유</dt><dd>${esc(u.reject_reason)}</dd></div>` : ''}
    </dl>
    ${review}
  </section>
  <section><h2>올라온 파일</h2><div class="adm-files">${fileHtml || '<p class="empty">파일이 없습니다.</p>'}</div></section>
  ${pay ? `<section><h2>보상 지급</h2>${pay}</section>` : ''}
  ${u.paid_at ? '' : `<section><h2>지급 정보 (올린 사람이 입력)</h2>
  <form method="post" action="${a}/reward" class="card adm-form adm-grid">
    <label class="f"><span class="f-l">받는 방법</span><select name="reward_type">${[['', '미입력'], ['bank', '계좌'], ['coupon', '쿠폰'], ['none', '받지 않음']].map(([v, l]) => `<option value="${v}"${u.reward_type === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f"><span class="f-l">이름</span><input name="name" maxlength="20" value="${esc(u.name)}"></label>
    <label class="f"><span class="f-l">연락처</span><input name="phone" maxlength="20" value="${esc(u.phone)}"></label>
    <label class="f"><span class="f-l">은행</span><input name="bank" maxlength="20" value="${esc(u.bank)}"></label>
    <label class="f"><span class="f-l">예금주</span><input name="holder" maxlength="20" value="${esc(u.holder)}"></label>
    <label class="f"><span class="f-l">계좌번호</span><input name="account_no" maxlength="30" value="${esc(u.account_no)}"></label>
    <label class="f f-wide"><span class="f-l">관리자 메모</span><input name="admin_memo" maxlength="500" value="${esc(u.admin_memo)}"></label>
    <button class="btn btn-line">지급 정보 저장</button>
  </form></section>`}
  <form method="post" action="${a}/delete" data-confirm="접수 #${u.id}와 올라온 파일을 완전히 삭제할까요? 되돌릴 수 없습니다."><button class="btn btn-sm btn-danger">이 접수 건 삭제</button></form>
</div>${confirmScript}`;
}

function noticeForm(n) {
  return `<form method="post" action="/admin/notices" class="form">
${n.id ? `<input type="hidden" name="id" value="${n.id}">` : ''}
<label class="f"><span class="f-l">제목</span><input name="title" required maxlength="120" value="${esc(n.title)}"></label>
<label class="f"><span class="f-l">내용</span><textarea name="body" rows="10" maxlength="20000">${esc(n.body)}</textarea><span class="f-h">줄바꿈은 그대로 보이고, http 주소는 자동으로 링크가 됩니다.</span></label>
<label class="check"><input type="checkbox" name="pinned"${n.pinned ? ' checked' : ''}> 상단 고정 (공지 표시)</label>
<button class="btn btn-brand">저장</button></form>`;
}

function seminarForm(s) {
  return `<form method="post" action="/admin/seminars" class="form">
${s.id ? `<input type="hidden" name="id" value="${s.id}">` : ''}
<label class="f"><span class="f-l">제목</span><input name="title" required maxlength="120" value="${esc(s.title)}"></label>
<div class="row2"><label class="f"><span class="f-l">대상</span><input name="target" maxlength="100" placeholder="예: 예비고1 학부모님" value="${esc(s.target)}"></label>
<label class="f"><span class="f-l">장소</span><input name="place" maxlength="100" value="${esc(s.place)}"></label></div>
<div class="row2"><label class="f"><span class="f-l">날짜</span><input type="date" name="date" value="${esc(s.date)}"><span class="f-h">이 날짜가 지나면 자동으로 '종료'가 됩니다. 비워 두면 상시 모집.</span></label>
<label class="f"><span class="f-l">일시 표시 문구</span><input name="when_text" maxlength="100" placeholder="예: 12월 6일(일) 오후 5시" value="${esc(s.when_text)}"></label></div>
<label class="f"><span class="f-l">신청 회차 (한 줄에 하나)</span><textarea name="sessions" rows="3" maxlength="1000" placeholder="1차 12월 6일(일) 오전 10시&#10;2차 12월 6일(일) 오후 5시">${esc(s.sessions)}</textarea></label>
<label class="f"><span class="f-l">안내 내용</span><textarea name="body" rows="8" maxlength="20000">${esc(s.body)}</textarea></label>
<label class="check"><input type="checkbox" name="closed"${s.closed ? ' checked' : ''}> 신청 마감</label>
<button class="btn btn-brand">저장</button></form>`;
}

function settingsForm(S) {
  const inp = (name, label, value, hint = '') => `<label class="f"><span class="f-l">${label}</span><input name="${name}" value="${esc(value)}" maxlength="300">${hint ? `<span class="f-h">${hint}</span>` : ''}</label>`;
  const lines = (groups) => groups.map((g) => `${g.label}: ${g.list.join(', ')}`).join('\n');
  return `<form method="post" action="/admin/settings" class="form adm-settings">
<section class="card adm-form"><h2>보상</h2>
  <div class="row2">${inp('reward_amount', '시험지 1건당 보상 금액 (원)', S.reward.amount)}${inp('reward_couponLabel', '쿠폰 이름 (화면 표시)', S.reward.couponLabel, '예: 모바일 쿠폰, 편의점 상품권')}</div>
  <label class="check"><input type="checkbox" name="reward_bank"${S.reward.bank ? ' checked' : ''}> 계좌 입금으로 받기 허용</label>
  <label class="check"><input type="checkbox" name="reward_coupon"${S.reward.coupon ? ' checked' : ''}> 쿠폰으로 받기 허용</label>
  ${inp('reward_note', '보상 안내 문구', S.reward.note)}
</section>
<section class="card adm-form"><h2>시험지 목록</h2>
  <label class="f"><span class="f-l">학교 (한 줄에 <code>묶음 이름: 학교1, 학교2</code>)</span><textarea name="schools" rows="4">${esc(lines(S.schools))}</textarea></label>
  ${inp('years', '연도 (쉼표로 구분, 앞에 쓴 것이 먼저 보임)', S.years.join(', '))}
  <label class="f"><span class="f-l">과목별 시험지 (한 줄에 <code>과목: 시험지1, 시험지2</code>)</span><textarea name="papers" rows="9">${esc(lines(Object.entries(S.papers).map(([label, list]) => ({ label, list }))))}</textarea>
  <span class="f-h">이미 접수된 시험지의 이름을 바꾸면 그 접수 건은 현황표에서 빠집니다. 새 항목은 뒤에 추가하는 것을 권장합니다.</span></label>
  ${inp('multi', '여러 번 받을 과목 (쉼표로 구분)', (S.multi || []).join(', '), '여기 적은 과목은 같은 칸에 여러 명이 올릴 수 있고, 올린 사람 모두 보상 대상이 됩니다.')}
</section>
<section class="card adm-form"><h2>메인 화면 문구</h2>
  <div class="row3">${inp('hero_line1', '첫 줄', S.hero.line1)}${inp('hero_mark', '형광펜 강조', S.hero.mark)}${inp('hero_line3', '마지막 줄', S.hero.line3)}</div>
  ${inp('hero_sub', '설명 문구', S.hero.sub)}
</section>
<section class="card adm-form"><h2>사이트 정보 (하단 표시)</h2>
  <div class="row2">${inp('site_name', '이름', S.site.name)}${inp('site_full', '풀네임', S.site.full)}</div>
  ${inp('site_tagline', '한 줄 소개', S.site.tagline)}
  <div class="row2">${inp('site_phone', '전화번호', S.site.phone)}${inp('site_email', '이메일', S.site.email)}</div>
  <div class="row2">${inp('site_hours', '상담시간', S.site.hours)}${inp('site_kakao', '카카오톡 채널 주소', S.site.kakao)}</div>
  <div class="row2">${inp('site_owner', '대표자', S.site.owner)}${inp('site_bizno', '사업자번호', S.site.bizno)}</div>
  ${inp('site_address', '주소', S.site.address)}
  <p class="muted small">비워 둔 항목은 사이트에 표시하지 않습니다.</p>
</section>
<button class="btn btn-brand btn-lg">설정 저장</button></form>`;
}
