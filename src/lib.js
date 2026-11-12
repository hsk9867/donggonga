// 공통 도구: 이스케이프, 응답, 쿠키·세션, 비밀번호, 설정, 요청 제한

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 줄바꿈 유지 + http(s) 주소 자동 링크
export const rich = (s) =>
  esc(s)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>')
    .replace(/\n/g, '<br>');

export const won = (n) => Number(n || 0).toLocaleString('ko-KR');

const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS, ...headers },
  });
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SEC_HEADERS, ...headers },
  });
}
export function redirect(to, headers = {}) {
  const h = new Headers({ Location: to, 'Cache-Control': 'no-store' });
  for (const [k, v] of Object.entries(headers)) (Array.isArray(v) ? v : [v]).forEach((x) => h.append(k, x));
  return new Response(null, { status: 303, headers: h });
}

// ── 시간 (저장은 UTC ISO, 표시는 한국 시간) ─────────────────────────────
export const nowIso = () => new Date().toISOString();
const kstDate = (iso) => new Date(Date.parse(iso || nowIso()) + 9 * 3600 * 1000).toISOString();
export const kst = (iso) => (iso ? kstDate(iso).slice(0, 16).replace('T', ' ') : '');
export const kstDay = (iso) => (iso ? kstDate(iso).slice(0, 10).replace(/-/g, '.') : '');
export const todayKst = () => kstDate().slice(0, 10);

// ── 쿠키 · 서명 토큰 ──────────────────────────────────────────────────
const enc = new TextEncoder();
const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function cookies(req) {
  const out = {};
  for (const part of (req.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
export function setCookie(name, value, { maxAge, secure = true, sameSite = 'Lax' } = {}) {
  let c = `${name}=${value}; Path=/; HttpOnly; SameSite=${sameSite}`;
  if (secure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  return c;
}

export function secretOf(env) {
  const s = env.SESSION_SECRET || (env.ADMIN_PASSWORD ? 'dg-session:' + env.ADMIN_PASSWORD : '');
  if (!s) throw new Error('SESSION_SECRET (또는 ADMIN_PASSWORD) 시크릿이 설정되지 않았습니다.');
  return s;
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
export function safeEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function signToken(secret, payload, ttlSec) {
  const body = `${payload}.${Math.floor(Date.now() / 1000) + ttlSec}`;
  return `${body}.${await hmac(secret, body)}`;
}
export async function readToken(secret, tok) {
  if (!tok) return null;
  const i = tok.lastIndexOf('.');
  if (i < 0) return null;
  const body = tok.slice(0, i);
  if (!safeEq(tok.slice(i + 1), await hmac(secret, body))) return null;
  const j = body.lastIndexOf('.');
  if (Number(body.slice(j + 1)) < Date.now() / 1000) return null;
  return body.slice(0, j);
}
export const randomToken = (n = 18) => b64u(crypto.getRandomValues(new Uint8Array(n)));

// ── 비밀번호 (PBKDF2-SHA256) ──────────────────────────────────────────
export async function hashPw(pw, salt) {
  salt = salt || randomToken(16);
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256);
  return { salt, hash: b64u(bits) };
}

// ── 요청 횟수 제한 ────────────────────────────────────────────────────
export async function limited(db, key, max, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM hits WHERE ts < ?').bind(now - 86400).run();
  const r = await db.prepare('SELECT COUNT(*) AS n FROM hits WHERE k = ? AND ts > ?').bind(key, now - windowSec).first();
  if (r && r.n >= max) return true;
  await db.prepare('INSERT INTO hits (k, ts) VALUES (?, ?)').bind(key, now).run();
  return false;
}
export const ipOf = (req) => req.headers.get('CF-Connecting-IP') || '0.0.0.0';

// ── 입력 정리 ─────────────────────────────────────────────────────────
export const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
export function phone(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (!/^01\d{8,9}$/.test(d)) return '';
  return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// ── 사이트 설정 (관리자에서 수정, D1 settings 테이블) ─────────────────
export const DEFAULTS = {
  site: {
    name: '동공아',
    full: '동탄공부잘하는아이',
    tagline: '동탄 학부모가 함께 만드는 우리 학교 기출 자료실',
    phone: '',
    kakao: '',
    email: '',
    address: '',
    hours: '',
    owner: '',
    bizno: '',
  },
  hero: {
    line1: '우리 학교 시험지,',
    mark: '올리면 보상이',
    line3: '돌아옵니다.',
    sub: '내신 시험지를 휴대폰으로 찍어 올려 주세요. 관리자 확인 후 쿠폰이나 현금으로 보답해 드립니다.',
  },
  reward: {
    amount: 2000,
    bank: true,
    coupon: true,
    couponLabel: '모바일 쿠폰',
    note: '시험지별로 가장 먼저 올린 1명에게 드려요.',
  },
  years: ['2026학년도', '2025학년도'],
  schools: [
    { label: '동탄 내 학교', list: ['가온고', '동탄국제고', '동탄중앙고', '병점고', '서연고', '세마고', '신동고', '안법고', '이산고', '이솔고', '정현고', '창의고', '치동고', '한백고', '호연고', '화성고'] },
    { label: '동탄 외 학교', list: ['김천고', '디미고', '삼괴고', '세교고', '오산고', '외대부고', '운천고', '은혜고', '태광고'] },
  ],
  papers: {
    수학: ['공통수학1 중간', '공통수학1 기말', '공통수학2 중간', '공통수학2 기말', '대수 중간', '대수 기말', '미적분1 중간', '미적분1 기말', '확통 중간', '확통 기말', '기하 중간(고2)', '기하 기말(고2)', '기하 중간(고3)', '기하 기말(고3)', '미적분2 중간', '미적분2 기말', '경제수학'],
    국어: ['고1-1 국어 중간', '고1-1 국어 기말', '고1-2 국어 중간', '고1-2 국어 기말', '고2-1 국어 중간', '고2-1 국어 기말', '고2-2 국어 중간', '고2-2 국어 기말', '고3-1 국어 중간', '고3-1 국어 기말'],
    영어: ['고1-1 영어 중간', '고1-1 영어 기말', '고1-2 영어 중간', '고1-2 영어 기말', '고2-1 영어 중간', '고2-1 영어 기말', '고2-2 영어 중간', '고2-2 영어 기말', '고3-1 영어 중간', '고3-1 영어 기말'],
    과학: ['통합과학1 중간', '통합과학1 기말', '통합과학2 중간', '통합과학2 기말', '물리학 중간', '물리학 기말', '화학 중간', '화학 기말', '생명 중간', '생명 기말', '지구 중간', '지구 기말', '역학과에너지 중간', '역학과에너지 기말', '화학반응의세계 중간', '화학반응의세계 기말', '세포와 물질대사 중간', '세포와 물질대사 기말', '지구시스템과학 중간', '지구시스템과학 기말'],
    사회: ['통합사회1 중간', '통합사회1 기말', '통합사회2 중간', '통합사회2 기말', '한국사 1학기 중간', '한국사 1학기 기말', '한국사 2학기 중간', '한국사 2학기 기말', '현대사회와 윤리 중간', '현대사회와 윤리 기말', '사회와문화 중간', '사회와문화 기말', '정치 중간', '정치 기말', '세계사 중간', '세계사 기말', '세계시민과지리 중간', '세계시민과지리 기말', '윤리와사상 중간', '윤리와사상 기말', '법과사회 중간', '법과사회 기말', '경제 중간', '경제 기말'],
    정보: ['정보 첫시험지', '정보 두번째시험지'],
    기타: ['한문', '기술가정'],
  },
  // 여기 적힌 과목은 같은 칸에 여러 번 올릴 수 있다 (학기·중간/기말이 섞여 들어오는 과목)
  multi: ['기타'],
};

export async function getSettings(db) {
  const S = structuredClone(DEFAULTS);
  const { results } = await db.prepare('SELECT k, v FROM settings').all();
  for (const row of results || []) {
    try {
      const v = JSON.parse(row.v);
      if (v && typeof v === 'object' && !Array.isArray(v) && row.k !== 'papers') S[row.k] = { ...S[row.k], ...v };
      else S[row.k] = v;
    } catch { /* 깨진 값은 기본값 유지 */ }
  }
  return S;
}
export async function putSetting(db, k, v) {
  await db.prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
    .bind(k, JSON.stringify(v)).run();
}

export const allSchools = (S) => S.schools.flatMap((g) => g.list);
export const subjects = (S) => Object.keys(S.papers);
export const slotKey = (u) => [u.school, u.year, u.subject, u.paper].join('|');

// 이미 채워진 칸(검수 중 + 승인) 목록. multi 과목은 막지 않는다.
export async function doneKeys(db, S) {
  const { results } = await db.prepare("SELECT DISTINCT school, year, subject, paper FROM uploads WHERE status != 'rejected'").all();
  const multi = new Set(S.multi || []);
  return (results || []).filter((r) => !multi.has(r.subject)).map(slotKey);
}

export const GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', 'N수'];
