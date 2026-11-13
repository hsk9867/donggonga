// 로컬 미리보기 서버 (이 PC 에서는 wrangler dev 가 뜨지 않아 Node 로 Worker 를 직접 돌린다)
//   node dev/serve.mjs        → http://localhost:8795  (관리자 비밀번호: admin1234)
// D1 은 node:sqlite, R2 는 .dev/files 폴더, 정적 파일은 public/ 으로 흉내 낸다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/worker.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devDir = process.env.DG_DEV_DIR || path.join(root, '.dev');
const PORT = Number(process.env.PORT || 8795);
fs.mkdirSync(path.join(devDir, 'files'), { recursive: true });

// ── D1 흉내 ──
const sqlite = new DatabaseSync(path.join(devDir, 'db.sqlite'));
for (const f of fs.readdirSync(path.join(root, 'migrations')).sort()) sqlite.exec(fs.readFileSync(path.join(root, 'migrations', f), 'utf8'));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => sqlite.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
  run: async () => { const r = sqlite.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } }; },
});
const DB = { prepare: (sql) => stmt(sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };

// ── R2 흉내 ──
const fileOf = (key) => path.join(devDir, 'files', key.replace(/[\\/]/g, '__'));
const FILES = {
  put: async (key, body) => { fs.writeFileSync(fileOf(key), Buffer.from(body)); },
  get: async (key) => (fs.existsSync(fileOf(key)) ? { body: fs.readFileSync(fileOf(key)) } : null),
  delete: async (key) => { fs.rmSync(fileOf(key), { force: true }); },
};

// ── 정적 파일 ──
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg' };
const ASSETS = {
  fetch: async (req) => {
    const p = path.join(root, 'public', decodeURIComponent(new URL(req.url).pathname));
    if (!p.startsWith(path.join(root, 'public')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return new Response('Not Found', { status: 404 });
    return new Response(fs.readFileSync(p), { headers: { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' } });
  },
};

// DG_NO_R2=1 이면 R2 없이(D1 조각 저장) 동작을 확인한다
const env = { DB, ...(process.env.DG_NO_R2 ? {} : { FILES }), ASSETS, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin1234', SESSION_SECRET: 'local-dev-secret' };

http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  headers.set('CF-Connecting-IP', req.socket.remoteAddress || '127.0.0.1');
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
  // 스크린샷 타이밍 조절용: /__sleep?ms=3000 은 그만큼 늦게 응답한다 (페이지 load 이벤트를 붙잡아 둠, 로컬 전용)
  if (req.url.startsWith('/__sleep')) {
    const ms = Math.min(15000, Number(new URL(req.url, 'http://x').searchParams.get('ms')) || 0);
    await new Promise((r) => setTimeout(r, ms));
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    return res.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
  }
  // 모바일 화면 확인용: /__m?u=/exams → 390px 폭 프레임 (로컬 전용)
  if (req.url.startsWith('/__m')) {
    let u = new URL(req.url, 'http://x').searchParams.get('u') || '/';
    if (!u.startsWith('/') || u.startsWith('//') || u.includes('\\')) u = '/';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#888;display:flex;gap:16px;justify-content:center"><iframe id="f" src="${u.replace(/"/g, '')}" style="width:390px;height:100vh;border:0;background:#fff"></iframe></body>`);
  }
  const r = await worker.fetch(request, env);
  const out = {};
  r.headers.forEach((v, k) => { if (k !== 'set-cookie' && k !== 'x-frame-options') out[k] = v; });
  const sc = r.headers.getSetCookie();
  if (sc.length) out['set-cookie'] = sc;
  res.writeHead(r.status, out);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`동공아 미리보기: http://localhost:${PORT}  (관리자: /admin , 비밀번호 ${env.ADMIN_PASSWORD})`));
