// 동공아 로고 → "동공아 Dt센터" 를 사이트 메인 제목과 같은 글씨체로 만든다
// 글씨체: Pretendard 800, 자간 -0.03em, 색 #2b3a67 (사이트 --ink-soft, .hero h1 과 동일)
// - logo.png / logo-white.png : 상단·관리자용 글자 로고
// - logo-full.png             : 윗줄만 새 글자로 바꾸고, 아래 문구('배움의 깊이를 더하다', 'SINCE 2018')는 원본(dev/logo-src) 그대로
// 실행: node dev/make-logo.mjs [출력폴더]   (헤드리스 크롬 + 인터넷 연결 필요: Pretendard 웹폰트)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dev', 'logo-out');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const TEXT = '동공아 Dt센터';
const INK = '#2b3a67';
const fullSrc = 'data:image/png;base64,' + readFileSync(join(root, 'dev', 'logo-src', 'logo-full.png')).toString('base64');

const html = `<!doctype html><meta charset="utf-8">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" rel="stylesheet">
<pre id="out">pending</pre>
<script>
const TEXT = ${JSON.stringify(TEXT)}, INK = ${JSON.stringify(INK)}, FULL = ${JSON.stringify(fullSrc)};
const FONT = (px) => '800 ' + px + 'px "Pretendard Variable"';
const LS = (px) => (-0.03 * px) + 'px';
const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
function pixels(im) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); }
function bbox(d, y0 = 0, y1 = d.height - 1) {
  let x0 = d.width, x1 = -1, t = d.height, b = -1;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < d.width; x++) if (d.data[(y * d.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < t) t = y; if (y > b) b = y; }
  return { x: x0, y: t, w: x1 - x0 + 1, h: b - t + 1 };
}
// 글자를 잉크 영역에 딱 맞춰 그린 캔버스. size = { h } (잉크 높이) 또는 { w } (잉크 너비)
function textCanvas(color, size, pad) {
  const t = document.createElement('canvas').getContext('2d');
  t.font = FONT(100); t.letterSpacing = LS(100);
  let m = t.measureText(TEXT);
  const px = size.h ? 100 * size.h / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent)
                    : 100 * size.w / (m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
  t.font = FONT(px); t.letterSpacing = LS(px);
  m = t.measureText(TEXT);
  const w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight), h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d');
  g.font = t.font; g.letterSpacing = t.letterSpacing; g.fillStyle = color; g.textBaseline = 'alphabetic';
  g.fillText(TEXT, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  return c;
}
(async () => {
  await document.fonts.load(FONT(40), TEXT);
  await document.fonts.ready;
  const res = {};
  // 상단 로고: 높이 104px 이미지 (화면에서는 32px 로 줄여 표시 → 레티나에서도 선명)
  res['logo.png'] = textCanvas(INK, { h: 88 }, 8).toDataURL('image/png');
  res['logo-white.png'] = textCanvas('#ffffff', { h: 88 }, 8).toDataURL('image/png');
  // 전체 로고: 원본 윗줄(붓글씨) 자리를 새 글자로 교체
  const full = await load(FULL);
  const d = pixels(full), top = bbox(d);
  const inkRow = (y) => { for (let x = 0; x < d.width; x++) if (d.data[(y * d.width + x) * 4 + 3] > 40) return true; return false; };
  let split = top.y; while (split < d.height && inkRow(split)) split++;
  const rest = bbox(d, split, d.height - 1);           // 아래 문구 영역
  const line = textCanvas(INK, { w: rest.w }, 0);      // 윗줄 너비 = 아래 문구 줄 너비
  // split 부터 복사하면 원본의 윗줄-아래문구 사이 빈 공간이 그대로 따라온다
  const H = top.y + line.height + (d.height - split);
  const c = document.createElement('canvas'); c.width = full.width; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(line, Math.round(rest.x + (rest.w - line.width) / 2), top.y);
  g.drawImage(full, 0, split, full.width, full.height - split, 0, top.y + line.height, full.width, full.height - split);
  res['logo-full.png'] = c.toDataURL('image/png');
  res.fontOk = document.fonts.check(FONT(40), TEXT);
  document.getElementById('out').textContent = JSON.stringify(res);
})().catch((e) => { document.getElementById('out').textContent = 'ERR ' + e; });
</script>`;

const tmp = join(tmpdir(), 'donggonga-logo-' + Date.now());
mkdirSync(tmp, { recursive: true });
const page = join(tmp, 'logo.html');
writeFileSync(page, html);
const dom = execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(tmp, 'profile')}`,
  '--virtual-time-budget=20000', '--dump-dom', 'file:///' + page.replace(/\\/g, '/')], { maxBuffer: 64 * 1024 * 1024 }).toString();
const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m || !m[1].startsWith('{')) throw new Error('render failed: ' + (m ? m[1].slice(0, 200) : dom.slice(0, 200)));
const res = JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
if (!res.fontOk) throw new Error('Pretendard 웹폰트를 불러오지 못했습니다.');
mkdirSync(out, { recursive: true });
for (const f of ['logo.png', 'logo-white.png', 'logo-full.png']) {
  const buf = Buffer.from(res[f].split(',')[1], 'base64');
  writeFileSync(join(out, f), buf);
  console.log(f, buf.length + 'B', buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20));
}
rmSync(tmp, { recursive: true, force: true });
