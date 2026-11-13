// 동공아 (동탄공부잘하는아이) — Cloudflare Worker 진입점
import {
  html, json, redirect, cookies, setCookie, secretOf, signToken, readToken, randomToken, hashPw, safeEq,
  limited, ipOf, str, phone, nowIso, getSettings, allSchools, subjects, doneKeys, GRADES, d1Files, levelOf, papersFor,
} from './lib.js';
import * as V from './views.js';
import { handleAdmin } from './admin.js';

const MAX_FILES = 16;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BODY_BYTES = 45 * 1024 * 1024;
const USER_TTL = 30 * 86400;

export default {
  async fetch(req, env) {
    if (!env.FILES) env = { ...env, FILES: d1Files(env.DB) }; // R2 가 없으면 D1 에 저장
    const url = new URL(req.url);
    // www.dtcenter.co.kr 로 들어오면 dtcenter.co.kr 로 옮김 (주소 하나로 통일 → 로그인 쿠키·검색 노출이 한 곳에 모임)
    if (url.hostname.startsWith('www.')) { url.hostname = url.hostname.slice(4); return Response.redirect(url.toString(), 301); }
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    try {
      if (/^\/(css|js|img)\//.test(path) || path === '/robots.txt') return env.ASSETS.fetch(req);
      if (path === '/favicon.ico' || path === '/favicon.svg') return Response.redirect(new URL('/img/favicon.png', req.url).toString(), 301);

      // 다른 사이트에서 보낸 POST 차단
      if (req.method === 'POST') {
        const origin = req.headers.get('Origin');
        if (origin && new URL(origin).host !== url.host) return json({ ok: false, message: '잘못된 요청입니다.' }, 403);
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      const S = await getSettings(env.DB);
      const ctx = { S, env, req, url, path, secure: url.protocol === 'https:', user: null };

      if (path === '/admin' || path.startsWith('/admin/')) return await handleAdmin(ctx);

      ctx.user = await currentUser(ctx);
      return await route(ctx);
    } catch (e) {
      console.error(e && e.stack ? e.stack : e);
      return html('<!doctype html><meta charset="utf-8"><title>오류</title><p style="font-family:sans-serif;padding:40px">일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>', 500);
    }
  },
};

async function currentUser(ctx) {
  const id = await readToken(secretOf(ctx.env), cookies(ctx.req).dg_s);
  if (!id || !id.startsWith('u:')) return null;
  return await ctx.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(Number(id.slice(2))).first();
}
const safeNext = (n) => (typeof n === 'string' && /^\/[^/\\]/.test(n) ? n : '');
const form = async (req) => { try { return Object.fromEntries([...(await req.formData())].filter(([, v]) => typeof v === 'string')); } catch { return {}; } };
const notFound = (ctx) => { const m = V.messagePage(ctx, { title: '페이지를 찾을 수 없습니다', message: '주소가 바뀌었거나 삭제된 페이지입니다.', status: 404 }); return html(m.body, 404); };

async function route(ctx) {
  const { req, path, url, env, S } = ctx;
  const db = env.DB;
  const GET = req.method !== 'POST';
  let m;

  if (path === '/' && GET) return html(V.homePage(ctx, await homeData(ctx)));

  // ── 시험지 ──
  if (path === '/exams' && GET) {
    const school = url.searchParams.get('school') || '';
    return html(V.examsPage(ctx, { done: await doneKeys(db, S), preset: allSchools(S).includes(school) ? school : '' }));
  }
  if (path === '/exams/missing' && GET) {
    const level = url.searchParams.get('level') === 'middle' ? 'middle' : 'high';
    const year = S.years.includes(url.searchParams.get('year')) ? url.searchParams.get('year') : S.years[0];
    const subs = subjects(S, level);
    const subject = subs.includes(url.searchParams.get('subject')) ? url.searchParams.get('subject') : subs[0];
    return html(V.missingPage(ctx, { level, year, subject, done: await doneKeys(db, S) }));
  }
  if (path === '/exams/upload' && !GET) return examUpload(ctx);
  if (path === '/exams/claim' && !GET) return examClaim(ctx, false);
  if (path === '/exams/claim/skip' && !GET) return examClaim(ctx, true);

  // ── 회원 ──
  if (path === '/signup') return GET
    ? html(V.signupPage(ctx, { type: url.searchParams.get('type') || 'parent', next: safeNext(url.searchParams.get('next')) }))
    : signup(ctx);
  if (path === '/login') return GET
    ? (ctx.user ? redirect('/my') : html(V.loginPage(ctx, { type: url.searchParams.get('type') || 'parent', next: safeNext(url.searchParams.get('next')), notice: url.searchParams.get('joined') ? '가입이 완료되었습니다. 로그인해 주세요.' : '' })))
    : login(ctx);
  if (path === '/logout' && !GET) return redirect('/', { 'Set-Cookie': setCookie('dg_s', '', { maxAge: 0, secure: ctx.secure }) });
  if (path === '/find') return GET ? html(V.findPage(ctx, {})) : findId(ctx);

  if (path === '/my' || path.startsWith('/my/')) {
    if (!ctx.user) return redirect('/login?next=' + encodeURIComponent(path));
    return my(ctx);
  }

  // ── 공지 ──
  if (path === '/notice' && GET) {
    const { results } = await db.prepare('SELECT id, title, pinned, views, created_at FROM notices ORDER BY pinned DESC, id DESC LIMIT 200').all();
    return html(V.noticeListPage(ctx, { notices: results }));
  }
  if ((m = path.match(/^\/notice\/(\d+)$/)) && GET) {
    const n = await db.prepare('SELECT * FROM notices WHERE id = ?').bind(+m[1]).first();
    if (!n) return notFound(ctx);
    await db.prepare('UPDATE notices SET views = views + 1 WHERE id = ?').bind(n.id).run();
    n.views += 1;
    return html(V.noticePage(ctx, { n }));
  }

  // ── 설명회 ──
  if (path === '/seminars' && GET) {
    const { results } = await db.prepare('SELECT * FROM seminars ORDER BY date DESC, id DESC LIMIT 200').all();
    return html(V.seminarListPage(ctx, { seminars: results }));
  }
  if ((m = path.match(/^\/seminars\/(\d+)(\/apply)?$/))) {
    const s = await db.prepare('SELECT * FROM seminars WHERE id = ?').bind(+m[1]).first();
    if (!s) return notFound(ctx);
    if (GET && !m[2]) return html(V.seminarPage(ctx, { s, done: url.searchParams.has('done') }));
    if (!GET && m[2]) return seminarApply(ctx, s);
  }

  // ── 상담·문자 ──
  if (path === '/consult') return GET ? html(V.consultPage(ctx, { done: url.searchParams.has('done') })) : consult(ctx);

  if (path === '/privacy' && GET) return html(V.docPage(ctx, 'privacy'));
  if (path === '/terms' && GET) return html(V.docPage(ctx, 'terms'));

  return notFound(ctx);
}

// ── 홈 데이터 ─────────────────────────────────────────────────────────
async function homeData(ctx) {
  const { S, env } = ctx;
  const db = env.DB;
  const done = new Set(await doneKeys(db, S));
  const multi = new Set(S.multi || []);
  const schools = allSchools(S);
  // 학교급마다 시험지 수가 달라 학교별로 계산한다 (여러 번 받는 과목은 제외)
  const subsOf = (school) => Object.keys(papersFor(S, school)).filter((s) => !multi.has(s));
  const totalOf = (school) => S.years.length * subsOf(school).reduce((n, s) => n + papersFor(S, school)[s].length, 0);

  const count = Object.fromEntries(schools.map((s) => [s, 0]));
  for (const k of done) { const s = k.split('|')[0]; if (s in count) count[s]++; }
  const bySchool = schools.map((school, i) => ({ school, done: count[school], total: totalOf(school) || 1, i }))
    .sort((a, b) => b.done - a.done || a.i - b.i).slice(0, 6);

  // 모집 중인 시험지 예시: 고등학교·중학교를 번갈아, 학교마다 과목을 돌려 가며 아직 비어 있는 첫 칸
  const highs = schools.filter((s) => levelOf(s) === 'high'), middles = schools.filter((s) => levelOf(s) === 'middle');
  const mixed = [];
  for (let i = 0; i < Math.max(highs.length, middles.length); i++) { if (highs[i]) mixed.push(highs[i]); if (middles[i]) mixed.push(middles[i]); }
  const need = [];
  const year = S.years[0];
  for (let i = 0; i < mixed.length && need.length < 5; i++) {
    const subs = subsOf(mixed[i]);
    if (!subs.length) continue;
    const subject = subs[Math.floor(i / 2) % subs.length];
    const paper = papersFor(S, mixed[i])[subject].find((p) => !done.has([mixed[i], year, subject, p].join('|')));
    if (paper) need.push({ school: mixed[i], subject, paper });
  }

  const collected = (await db.prepare("SELECT COUNT(*) AS n FROM uploads WHERE status = 'approved'").first()).n;
  const seminars = (await db.prepare("SELECT * FROM seminars WHERE closed = 0 AND (date = '' OR date >= ?) ORDER BY CASE WHEN date = '' THEN '9999' ELSE date END, id LIMIT 3")
    .bind(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)).all()).results;
  const notices = (await db.prepare('SELECT id, title, pinned, created_at FROM notices ORDER BY pinned DESC, id DESC LIMIT 4').all()).results;
  return {
    stats: { collected, open: Math.max(0, schools.reduce((n, s) => n + totalOf(s), 0) - done.size), schools: schools.length },
    need, bySchool, seminars, notices,
  };
}

// ── 시험지 업로드 ─────────────────────────────────────────────────────
function sniff(bytes) {
  const b = bytes;
  const ascii = (o, n) => String.fromCharCode(...b.slice(o, o + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ['image/jpeg', 'jpg'];
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return ['image/png', 'png'];
  if (ascii(0, 4) === '%PDF') return ['application/pdf', 'pdf'];
  if (ascii(0, 4) === 'GIF8') return ['image/gif', 'gif'];
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return ['image/webp', 'webp'];
  if (ascii(4, 4) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heif)/.test(ascii(8, 4))) return ['image/heic', 'heic'];
  return null;
}

async function examUpload(ctx) {
  const { req, env, S, user } = ctx;
  const db = env.DB;
  if (Number(req.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return json({ status: 'error', message: '파일이 너무 커요. 사진 수를 줄이거나 나눠서 올려 주세요.' }, 413);
  if (await limited(db, 'up:' + ipOf(req), 20, 3600)) return json({ status: 'error', message: '잠시 후 다시 시도해 주세요. (업로드 횟수 초과)' }, 429);

  let fd;
  try { fd = await req.formData(); } catch { return json({ status: 'error', message: '업로드를 읽지 못했어요. 다시 시도해 주세요.' }, 400); }
  const school = str(fd.get('school')), year = str(fd.get('year')), subject = str(fd.get('subject')), paper = str(fd.get('paper'));
  if (!allSchools(S).includes(school) || !S.years.includes(year) || !(papersFor(S, school)[subject] || []).includes(paper)) {
    return json({ status: 'error', message: '학교·연도·과목·시험지를 다시 선택해 주세요.' }, 400);
  }
  if (!user && fd.get('agree_no_reason') !== 'on') return json({ status: 'error', message: '안내 사항에 동의해 주세요.' }, 400);

  const files = fd.getAll('photos').filter((f) => typeof f !== 'string' && f.size > 0);
  if (!files.length) return json({ status: 'error', message: '시험지 사진을 한 장 이상 올려 주세요.' }, 400);
  if (files.length > MAX_FILES) return json({ status: 'error', message: `최대 ${MAX_FILES}장까지 올릴 수 있어요.` }, 400);

  const prepared = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return json({ status: 'error', message: '파일 하나가 15MB를 넘어요. 더 작은 파일로 올려 주세요.' }, 400);
    const buf = await f.arrayBuffer();
    const kind = sniff(new Uint8Array(buf.slice(0, 16)));
    if (!kind) return json({ status: 'unreadable', reason: '사진(JPG·PNG·HEIC) 또는 PDF 파일만 올릴 수 있어요.' }, 400);
    prepared.push({ buf, mime: kind[0], ext: kind[1], name: str(f.name, 100) });
  }

  const isMulti = (S.multi || []).includes(subject);
  const taken = () => db.prepare("SELECT id FROM uploads WHERE school = ? AND year = ? AND subject = ? AND paper = ? AND status != 'rejected' LIMIT 1")
    .bind(school, year, subject, paper).first();
  if (!isMulti && await taken()) return json({ status: 'duplicate' });

  const token = randomToken();
  const ins = await db.prepare(`INSERT INTO uploads (token, user_id, school, year, subject, paper, file_count, amount, name, phone, created_at, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(token, user ? user.id : null, school, year, subject, paper, prepared.length, S.reward.amount,
      user ? user.student_name : '', user ? (user.parent_phone || user.student_phone) : '', nowIso(), ipOf(req)).run();
  const id = ins.meta.last_row_id;

  try {
    let i = 0;
    for (const p of prepared) {
      const key = `u/${id}/${String(++i).padStart(2, '0')}-${randomToken(6)}.${p.ext}`;
      await env.FILES.put(key, p.buf, { httpMetadata: { contentType: p.mime } });
      await db.prepare('INSERT INTO upload_files (upload_id, r2_key, mime, size, name) VALUES (?, ?, ?, ?, ?)')
        .bind(id, key, p.mime, p.buf.byteLength, p.name).run();
    }
  } catch (e) {
    console.error('upload store failed', e);
    await removeUpload(env, id);
    return json({ status: 'error', message: '파일 저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' }, 500);
  }
  return json({ status: 'accepted', id, token, member: !!user });
}

export async function removeUpload(env, id) {
  const { results } = await env.DB.prepare('SELECT r2_key FROM upload_files WHERE upload_id = ?').bind(id).all();
  for (const f of results || []) { try { await env.FILES.delete(f.r2_key); } catch { /* 이미 없으면 무시 */ } }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM upload_files WHERE upload_id = ?').bind(id),
    env.DB.prepare('DELETE FROM uploads WHERE id = ?').bind(id),
  ]);
}

// 보상 받을 방법 검증 → { error } 또는 저장할 값
function readReward(S, b) {
  const type = b.type === 'coupon' ? 'coupon' : 'bank';
  if ((type === 'bank' && !S.reward.bank) || (type === 'coupon' && !S.reward.coupon)) return { error: '선택할 수 없는 지급 방법입니다.' };
  const name = str(b.name, 20), ph = phone(b.phone);
  if (!name) return { error: '이름을 입력해 주세요.' };
  if (!ph) return { error: '연락처를 정확히 입력해 주세요. (예: 010-0000-0000)' };
  if (type === 'coupon') return { type, name, phone: ph, bank: '', holder: '', account_no: '' };
  const bank = str(b.bank, 20), holder = str(b.holder, 20), account_no = str(b.account_no, 30).replace(/[^\d-]/g, '');
  if (!bank || !holder || account_no.replace(/-/g, '').length < 8) return { error: '은행, 예금주, 계좌번호를 정확히 입력해 주세요.' };
  return { type, name, phone: ph, bank, holder, account_no };
}
const saveReward = (db, id, r) =>
  db.prepare('UPDATE uploads SET reward_type = ?, name = ?, phone = ?, bank = ?, holder = ?, account_no = ? WHERE id = ? AND paid_at IS NULL')
    .bind(r.type, r.name, r.phone, r.bank, r.holder, r.account_no, id).run();

async function examClaim(ctx, skip) {
  const { req, env, S } = ctx;
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, message: '잘못된 요청입니다.' }, 400); }
  const u = await env.DB.prepare('SELECT id, token, paid_at, status FROM uploads WHERE id = ?').bind(Number(b.id) || 0).first();
  if (!u || !safeEq(u.token, String(b.token || '')) || u.paid_at || u.status === 'rejected') return json({ ok: false, message: '접수 정보를 찾을 수 없어요.' }, 404);
  if (skip) {
    await env.DB.prepare("UPDATE uploads SET reward_type = 'none' WHERE id = ? AND reward_type = ''").bind(u.id).run();
    return json({ ok: true });
  }
  const r = readReward(S, b);
  if (r.error) return json({ ok: false, message: r.error }, 400);
  await saveReward(env.DB, u.id, r);
  return json({ ok: true, message: '보내 주셔서 감사합니다! 확인 후 보상을 보내 드릴게요.' });
}

// ── 회원 ──────────────────────────────────────────────────────────────
async function signup(ctx) {
  const { req, env, S } = ctx;
  const db = env.DB;
  const b = await form(req);
  const type = b.type === 'student' ? 'student' : 'parent';
  const next = safeNext(b.next);
  const v = {
    username: str(b.username, 20), cafe_nick: str(b.cafe_nick, 30),
    school: str(b.school_custom, 30) || str(b.school, 30), grade: str(b.grade, 10),
    phone: phone(b.phone), agree_sms: b.agree_sms === 'on',
  };
  const fail = (error) => html(V.signupPage(ctx, { type, next, error, v: { ...v, phone: str(b.phone, 20) } }), 400);

  if (await limited(db, 'join:' + ipOf(req), 10, 3600)) return fail('잠시 후 다시 시도해 주세요.');
  if (!/^[A-Za-z0-9]{4,20}$/.test(v.username)) return fail('아이디는 영문·숫자 4~20자로 입력해 주세요.');
  const pw = String(b.password || '');
  if (pw.length < 8 || pw.length > 72) return fail('비밀번호는 8자 이상으로 입력해 주세요.');
  if (pw !== b.password2) return fail('비밀번호 확인이 일치하지 않습니다.');
  if (!v.school) return fail('학교를 선택하거나 직접 입력해 주세요.');
  if (!GRADES.includes(v.grade)) return fail('학년을 선택해 주세요.');
  if (!v.cafe_nick) return fail('동공아 카페 아이디 또는 닉네임을 입력해 주세요.');
  if (b.phone && String(b.phone).trim() && !v.phone) return fail('휴대폰 번호를 정확히 입력해 주세요. 입력하지 않아도 가입할 수 있어요.');
  if (b.agree_privacy !== 'on') return fail('개인정보 수집·이용에 동의해 주세요.');
  if (await db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').bind(v.username).first()) return fail('이미 사용 중인 아이디입니다.');

  const { salt, hash } = await hashPw(pw);
  // 휴대폰 번호는 하나만 받는다: 학부모 회원은 학부모 번호 칸, 학생 회원은 학생 번호 칸에 저장
  const r = await db.prepare(`INSERT INTO users (type, username, pw_hash, pw_salt, student_name, cafe_nick, school, grade, student_phone, parent_phone, agree_sms, created_at)
    VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)`)
    .bind(type, v.username, hash, salt, v.cafe_nick, v.school, v.grade, type === 'student' ? v.phone : '', type === 'parent' ? v.phone : '', v.agree_sms ? 1 : 0, nowIso()).run();
  return redirect(next || '/my?ok=joined', { 'Set-Cookie': await userCookie(ctx, r.meta.last_row_id) });
}

const userCookie = async (ctx, id) =>
  setCookie('dg_s', await signToken(secretOf(ctx.env), 'u:' + id, USER_TTL), { maxAge: USER_TTL, secure: ctx.secure });

async function login(ctx) {
  const { req, env } = ctx;
  const b = await form(req);
  const type = b.type === 'student' ? 'student' : 'parent';
  const next = safeNext(b.next);
  const username = str(b.username, 20);
  const fail = (error) => html(V.loginPage(ctx, { type, next, error, username }), 400);
  if (await limited(env.DB, `login:${ipOf(req)}:${username.toLowerCase()}`, 8, 600)) return fail('로그인 시도가 너무 많습니다. 10분 뒤에 다시 시도해 주세요.');
  const u = await env.DB.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').bind(username).first();
  // 아이디가 없어도 같은 시간이 걸리도록 해시는 항상 계산한다
  const { hash } = await hashPw(String(b.password || ''), u ? u.pw_salt : 'no-such-user-salt');
  if (!u || !safeEq(hash, u.pw_hash)) return fail('아이디 또는 비밀번호가 올바르지 않습니다.');
  return redirect(next || '/my', { 'Set-Cookie': await userCookie(ctx, u.id) });
}

async function findId(ctx) {
  const { req, env } = ctx;
  const b = await form(req);
  if (await limited(env.DB, 'find:' + ipOf(req), 6, 600)) return html(V.findPage(ctx, { error: '잠시 후 다시 시도해 주세요.' }), 429);
  const ph = phone(b.phone), name = str(b.cafe_nick, 30);
  if (!ph || !name) return html(V.findPage(ctx, { error: '카페 아이디·닉네임과 휴대폰 번호를 정확히 입력해 주세요.' }), 400);
  // 예전 회원은 학생 이름으로 가입했으므로 그 이름으로도 찾는다
  const { results } = await env.DB.prepare('SELECT username FROM users WHERE (cafe_nick = ? OR student_name = ?) AND (parent_phone = ? OR student_phone = ?)').bind(name, name, ph, ph).all();
  const mask = (s) => s.slice(0, 2) + '*'.repeat(Math.max(1, s.length - 4)) + s.slice(-2);
  return html(V.findPage(ctx, { found: (results || []).map((r) => mask(r.username)) }));
}

async function my(ctx) {
  const { req, env, path, url, S, user } = ctx;
  const db = env.DB;
  const GET = req.method !== 'POST';
  const render = async (extra = {}) => {
    const uploads = (await db.prepare('SELECT * FROM uploads WHERE user_id = ? ORDER BY id DESC LIMIT 200').bind(user.id).all()).results;
    const apps = (await db.prepare('SELECT a.*, s.title FROM seminar_apps a JOIN seminars s ON s.id = a.seminar_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 50').bind(user.id).all()).results;
    return V.myPage(ctx, { uploads, apps, ...extra });
  };
  const OK = { joined: '가입을 환영합니다!', saved: '저장되었습니다.', pw: '비밀번호가 변경되었습니다.', reward: '보상 받는 방법이 저장되었습니다.' };

  if (path === '/my' && GET) return html(await render({ ok: OK[url.searchParams.get('ok')] || '' }));

  if (path === '/my' && !GET) {
    const b = await form(req);
    const nick = str(b.cafe_nick, 30);
    const ph = phone(b.phone);
    if (!nick) return html(await render({ error: '동공아 카페 아이디 또는 닉네임을 입력해 주세요.' }), 400);
    if (b.phone && String(b.phone).trim() && !ph) return html(await render({ error: '휴대폰 번호를 정확히 입력해 주세요.' }), 400);
    const isP = user.type !== 'student';
    await db.prepare('UPDATE users SET school = ?, grade = ?, cafe_nick = ?, parent_phone = ?, student_phone = ?, agree_sms = ? WHERE id = ?')
      .bind(str(b.school_custom, 30) || str(b.school, 30) || user.school, GRADES.includes(b.grade) ? b.grade : user.grade, nick, isP ? ph : '', isP ? '' : ph, b.agree_sms === 'on' ? 1 : 0, user.id).run();
    return redirect('/my?ok=saved');
  }

  const checkPw = async (pw) => safeEq((await hashPw(String(pw || ''), user.pw_salt)).hash, user.pw_hash);

  if (path === '/my/password' && !GET) {
    const b = await form(req);
    if (!(await checkPw(b.current))) return html(await render({ error: '현재 비밀번호가 올바르지 않습니다.' }), 400);
    const pw = String(b.password || '');
    if (pw.length < 8 || pw.length > 72) return html(await render({ error: '새 비밀번호는 8자 이상으로 입력해 주세요.' }), 400);
    if (pw !== b.password2) return html(await render({ error: '새 비밀번호 확인이 일치하지 않습니다.' }), 400);
    const { salt, hash } = await hashPw(pw);
    await db.prepare('UPDATE users SET pw_hash = ?, pw_salt = ? WHERE id = ?').bind(hash, salt, user.id).run();
    return redirect('/my?ok=pw');
  }

  if (path === '/my/delete' && !GET) {
    const b = await form(req);
    if (!(await checkPw(b.current))) return html(await render({ error: '비밀번호가 올바르지 않습니다.' }), 400);
    await db.batch([
      db.prepare('UPDATE uploads SET user_id = NULL WHERE user_id = ?').bind(user.id),
      db.prepare('UPDATE seminar_apps SET user_id = NULL WHERE user_id = ?').bind(user.id),
      db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ]);
    return redirect('/', { 'Set-Cookie': setCookie('dg_s', '', { maxAge: 0, secure: ctx.secure }) });
  }

  const m = path.match(/^\/my\/reward\/(\d+)$/);
  if (m) {
    const u = await db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').bind(+m[1], user.id).first();
    if (!u || u.paid_at || u.status === 'rejected') return redirect('/my');
    if (GET) return html(V.rewardPage(ctx, { u }));
    const b = await form(req);
    const r = readReward(S, b);
    if (r.error) return html(V.rewardPage(ctx, { u: { ...u, ...b, reward_type: b.type }, error: r.error }), 400);
    await saveReward(db, u.id, r);
    return redirect('/my?ok=reward');
  }
  return notFound(ctx);
}

// ── 설명회 신청 · 상담 신청 ───────────────────────────────────────────
async function seminarApply(ctx, s) {
  const { req, env, user } = ctx;
  let fd;
  try { fd = await req.formData(); } catch { return html(V.seminarPage(ctx, { s, error: '입력 내용을 다시 확인해 주세요.' }), 400); }
  const b = Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string'));
  const v = { student_name: str(b.student_name, 20), school_grade: str(b.school_grade, 30), parent_phone: str(b.parent_phone, 20), session: str(b.session, 100), question: str(b.question, 1000) };
  const fail = (error) => html(V.seminarPage(ctx, { s, error, v }), 400);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if (s.closed || (s.date && s.date < today)) return fail('신청이 종료된 설명회입니다.');
  if (await limited(env.DB, 'sem:' + ipOf(req), 10, 3600)) return fail('잠시 후 다시 시도해 주세요.');
  const ph = phone(v.parent_phone);
  if (!v.student_name || !v.school_grade) return fail('학생 이름과 학교·학년을 입력해 주세요.');
  if (!ph) return fail('휴대폰 번호를 정확히 입력해 주세요. (예: 010-0000-0000)');
  if (!v.session) return fail('설명회 신청일을 선택해 주세요.');
  if (b.agree !== 'on') return fail('개인정보 수집·이용에 동의해 주세요.');
  if (await env.DB.prepare('SELECT 1 FROM seminar_apps WHERE seminar_id = ? AND parent_phone = ? AND session = ?').bind(s.id, ph, v.session).first()) {
    return fail('이미 같은 번호로 신청되어 있습니다.');
  }
  await env.DB.prepare('INSERT INTO seminar_apps (seminar_id, user_id, student_name, school_grade, parent_phone, session, question, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(s.id, user ? user.id : null, v.student_name, v.school_grade, ph, v.session, v.question, nowIso()).run();
  return redirect(`/seminars/${s.id}?done=1#apply`);
}

async function consult(ctx) {
  const { req, env } = ctx;
  let fd;
  try { fd = await req.formData(); } catch { return html(V.consultPage(ctx, { error: '입력 내용을 다시 확인해 주세요.' }), 400); }
  const b = Object.fromEntries([...fd].filter(([, v]) => typeof v === 'string'));
  const v = {
    parent_phone: str(b.parent_phone, 20), student_name: str(b.student_name, 20), student_phone: str(b.student_phone, 20),
    school: str(b.school, 30), grade: GRADES.includes(b.grade) ? b.grade : '',
    interests: fd.getAll('interests').filter((x) => typeof x === 'string').map((x) => str(x, 30)).slice(0, 10), memo: str(b.memo, 1000),
  };
  const fail = (error) => html(V.consultPage(ctx, { error, v }), 400);
  if (await limited(env.DB, 'consult:' + ipOf(req), 6, 3600)) return fail('잠시 후 다시 시도해 주세요.');
  const pp = phone(v.parent_phone), sp = phone(v.student_phone);
  if (!pp) return fail('학부모 전화번호를 정확히 입력해 주세요. (예: 010-0000-0000)');
  if (v.student_phone && !sp) return fail('학생 전화번호를 정확히 입력해 주세요.');
  if (!v.student_name) return fail('학생 이름을 입력해 주세요.');
  if (b.agree !== 'on') return fail('개인정보 수집·이용 및 문자 수신에 동의해 주세요.');
  await env.DB.prepare('INSERT INTO consults (parent_phone, student_name, student_phone, school, grade, interests, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(pp, v.student_name, sp, v.school, v.grade, v.interests.join(', '), v.memo, nowIso()).run();
  return redirect('/consult?done=1');
}
