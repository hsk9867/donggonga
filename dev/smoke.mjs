// 전체 흐름 점검: node dev/smoke.mjs  (dev/serve.mjs 가 떠 있어야 함, 빈 DB 기준)
const B = process.env.BASE || 'http://localhost:8795';
let fails = 0;
const ok = (cond, label, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${cond ? '' : '  ' + extra}`); if (!cond) fails++; };

class Client {
  jar = {};
  async req(path, { method = 'GET', form, json, body } = {}) {
    const headers = { Cookie: Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; '), Origin: B };
    if (form) { body = new URLSearchParams(form); }
    if (json) { body = JSON.stringify(json); headers['Content-Type'] = 'application/json'; }
    const r = await fetch(B + path, { method, headers, body, redirect: 'manual' });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await r.text();
    return { status: r.status, text, loc: r.headers.get('location'), json: () => JSON.parse(text) };
  }
}
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])], { type: 'image/jpeg' });
const pdf = () => new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
const upload = (c, { school = '가온고', year = '2026학년도', subject = '수학', paper = '공통수학1 중간', files = [jpeg()], agree = true } = {}) => {
  const fd = new FormData();
  Object.entries({ school, year, subject, paper }).forEach(([k, v]) => fd.append(k, v));
  if (agree) fd.append('agree_no_reason', 'on');
  files.forEach((f, i) => fd.append('photos', f, `p${i}.jpg`));
  return c.req('/exams/upload', { method: 'POST', body: fd });
};

const guest = new Client(), member = new Client(), admin = new Client();

// 공개 페이지
for (const p of ['/', '/exams', '/exams/missing', '/exams/missing?subject=' + encodeURIComponent('국어'), '/notice', '/seminars', '/consult', '/login', '/signup', '/signup?type=student', '/find', '/privacy', '/terms', '/css/style.css', '/js/exams.js', '/img/logo.png', '/img/favicon.png', '/img/og.png']) {
  const r = await guest.req(p); ok(r.status === 200, `GET ${p}`, r.status);
}
ok((await guest.req('/nope')).status === 404, '404 page');
ok((await guest.req('/my')).loc?.startsWith('/login'), '/my requires login');
ok((await guest.req('/admin')).loc === '/admin/login', '/admin requires login');
ok((await guest.req('/admin/uploads/1/delete', { method: 'POST' })).status === 401, 'admin POST blocked for guests');
{
  const r = await fetch(B + '/consult', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: new URLSearchParams({ a: 1 }) });
  ok(r.status === 403, 'cross-site POST rejected');
}

// 비회원 업로드 → 중복 → 보상 정보
let r = await upload(guest, { agree: false });
ok(r.status === 400, 'guest upload without agreement rejected');
r = await upload(guest, { files: [new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' })] });
ok(r.json().status === 'unreadable', 'non-image file rejected');
r = await upload(guest, { paper: '없는 시험지' });
ok(r.status === 400, 'unknown paper rejected');
r = await upload(guest, { files: [jpeg(), pdf()] });
const up1 = r.json();
ok(up1.status === 'accepted' && up1.id && up1.token, 'guest upload accepted', r.text);
ok((await upload(guest)).json().status === 'duplicate', 'second upload of same paper = duplicate');
ok((await guest.req('/exams')).text.includes('가온고|2026학년도|수학|공통수학1 중간'), 'slot shown as done');
r = await guest.req('/exams/claim', { method: 'POST', json: { id: up1.id, token: 'wrong', type: 'bank', name: 'a', phone: '01012345678', bank: '국민', holder: 'a', account_no: '12345678901' } });
ok(r.status === 404, 'claim with wrong token rejected');
r = await guest.req('/exams/claim', { method: 'POST', json: { id: up1.id, token: up1.token, type: 'bank', name: '김학부모', phone: '01012345678', bank: '', holder: '', account_no: '' } });
ok(r.status === 400, 'bank claim without account rejected');
r = await guest.req('/exams/claim', { method: 'POST', json: { id: up1.id, token: up1.token, type: 'bank', name: '김학부모', phone: '010-1234-5678', bank: '국민', holder: '김학부모', account_no: '123456-78-901234' } });
ok(r.json().ok === true, 'bank claim saved', r.text);

// 회원가입 / 로그인
const acct = { type: 'parent', username: 'mom1234', password: 'password1', password2: 'password1', school: '이솔고', grade: '고1', cafe_nick: '홍길동맘', phone: '010-2222-3333', agree_privacy: 'on', agree_sms: 'on' };
r = await member.req('/signup', { method: 'POST', form: { ...acct, password2: 'different' } });
ok(r.status === 400 && r.text.includes('일치하지'), 'signup password mismatch');
r = await member.req('/signup', { method: 'POST', form: { ...acct, next: '//evil.example' } });
ok(r.status === 303 && r.loc === '/my?ok=joined', 'signup ok, open redirect ignored', `${r.status} ${r.loc}`);
r = await new Client().req('/signup', { method: 'POST', form: { ...acct, username: 'MOM1234' } });
ok(r.status === 400 && r.text.includes('이미 사용'), 'duplicate username (case-insensitive)');
r = await member.req('/my'); ok(r.status === 200 && r.text.includes('홍길동'), 'my page');
const m2 = new Client();
r = await m2.req('/login', { method: 'POST', form: { username: 'mom1234', password: 'wrongpass' } });
ok(r.status === 400, 'login wrong password');
r = await m2.req('/login', { method: 'POST', form: { username: 'mom1234', password: 'password1', next: '/exams' } });
ok(r.status === 303 && r.loc === '/exams', 'login ok with next');
r = await guest.req('/find', { method: 'POST', form: { cafe_nick: '홍길동맘', phone: '01022223333' } });
ok(r.text.includes('mo***34'), 'find id shows masked id');

// 회원 업로드 → 쿠폰으로 받기
r = await upload(member, { school: '이솔고', subject: '국어', paper: '고1-1 국어 중간', agree: false });
const up2 = r.json(); ok(up2.status === 'accepted' && up2.member, 'member upload accepted', r.text);
r = await member.req(`/my/reward/${up2.id}`, { method: 'POST', form: { type: 'coupon', name: '홍길동', phone: '010-2222-3333' } });
ok(r.loc === '/my?ok=reward', 'member picks coupon');
ok((await m2.req(`/my/reward/${up1.id}`)).loc === '/my', "member cannot open someone else's upload");

// 설명회 · 상담
r = await guest.req('/consult', { method: 'POST', form: { parent_phone: '123', student_name: '테스트', agree: 'on' } });
ok(r.status === 400, 'consult bad phone');
r = await guest.req('/consult', { method: 'POST', form: { parent_phone: '010-9999-8888', student_name: '=cmd()', interests: '설명회 안내', memo: '<script>alert(1)</script>', agree: 'on' } });
ok(r.loc === '/consult?done=1', 'consult ok');

// 관리자
r = await admin.req('/admin/login', { method: 'POST', form: { password: 'nope' } }); ok(r.status === 400, 'admin wrong password');
r = await admin.req('/admin/login', { method: 'POST', form: { password: 'admin1234' } }); ok(r.loc === '/admin', 'admin login');
for (const p of ['/admin', '/admin/uploads', '/admin/uploads?tab=all', `/admin/uploads/${up1.id}`, '/admin/notices', '/admin/seminars', '/admin/consults', '/admin/users', '/admin/settings', '/admin/consults.csv']) {
  const x = await admin.req(p); ok(x.status === 200, `GET ${p}`, x.status);
}
r = await admin.req('/admin/consults'); ok(!r.text.includes('<script>alert(1)</script>'), 'consult memo escaped in admin');
r = await admin.req('/admin/consults.csv'); ok(r.text.includes(`"'=cmd()"`), 'csv formula neutralised');
r = await admin.req(`/admin/uploads/${up1.id}`);
const fileId = r.text.match(/\/admin\/file\/(\d+)/)?.[1];
ok((await admin.req(`/admin/file/${fileId}`)).status === 200, 'admin can view file');
ok((await guest.req(`/admin/file/${fileId}`)).status !== 200, 'guest cannot view file');
r = await admin.req(`/admin/uploads/${up1.id}/pay`, { method: 'POST', form: { method: 'bank', amount: '2000' } });
ok(decodeURIComponent(r.loc).includes('먼저'), 'pay before approval blocked');
await admin.req(`/admin/uploads/${up1.id}/review`, { method: 'POST', form: { action: 'approve' } });
r = await admin.req(`/admin/uploads/${up1.id}/pay`, { method: 'POST', form: { method: 'bank', amount: '2000' } });
ok(decodeURIComponent(r.loc).includes('입금 완료'), 'bank payout recorded');
r = await guest.req('/exams/claim', { method: 'POST', json: { id: up1.id, token: up1.token, type: 'bank', name: 'x', phone: '01012345678', bank: '해커', holder: 'x', account_no: '99999999999' } });
ok(r.status === 404, 'claim cannot be changed after payout');

await admin.req(`/admin/uploads/${up2.id}/review`, { method: 'POST', form: { action: 'approve' } });
r = await admin.req(`/admin/uploads/${up2.id}/pay`, { method: 'POST', form: { method: 'coupon', amount: '2000', coupon_name: '편의점 2,000원권', coupon_code: 'ABCD-1234' } });
ok(decodeURIComponent(r.loc).includes('쿠폰 지급 완료'), 'coupon payout recorded');
r = await member.req('/my'); ok(r.text.includes('ABCD-1234') && r.text.includes('지급 완료'), 'member sees coupon in my page');

// 반려 → 칸이 다시 열림 → 사유가 회원에게 보임
r = await upload(member, { school: '이솔고', subject: '영어', paper: '고1-1 영어 중간', agree: false });
const up3 = r.json();
await admin.req(`/admin/uploads/${up3.id}/review`, { method: 'POST', form: { action: 'reject', reason: '2쪽이 흐려요' } });
ok((await member.req('/my')).text.includes('2쪽이 흐려요'), 'reject reason visible to member');
ok((await upload(guest, { school: '이솔고', subject: '영어', paper: '고1-1 영어 중간' })).json().status === 'accepted', 'rejected slot reopens');
r = await admin.req(`/admin/uploads/${up3.id}/review`, { method: 'POST', form: { action: 'pending' } });
ok(decodeURIComponent(r.loc).includes('이미 접수'), 'cannot un-reject when slot was refilled');
ok((await upload(guest, { school: '동탄중', subject: '수학', paper: '중1-1 중간' })).json().status === 'accepted', 'middle school paper accepted');
ok((await upload(guest, { school: '동탄중', subject: '수학', paper: '공통수학1 중간' })).status === 400, 'high school paper rejected for middle school');
ok((await upload(guest, { school: '가온고', subject: '역사', paper: '중1-1 중간' })).status === 400, 'middle school paper rejected for high school');
r = await guest.req('/exams/missing?level=middle&subject=' + encodeURIComponent('역사'));
ok(r.status === 200 && r.text.includes('능동중') && !r.text.includes('가온고</th>'), 'missing page middle level');
ok((await upload(guest, { subject: '기타', paper: '한문' })).json().status === 'accepted' && (await upload(guest, { subject: '기타', paper: '한문' })).json().status === 'accepted', 'multi subject accepts repeats');

// 공지 · 설명회
await admin.req('/admin/notices', { method: 'POST', form: { title: '첫 공지 <b>', body: '내용\nhttps://example.com', pinned: 'on' } });
r = await guest.req('/notice'); ok(r.text.includes('첫 공지 &lt;b&gt;'), 'notice listed and escaped');
r = await guest.req('/notice/1'); ok(r.status === 200 && r.text.includes('href="https://example.com"'), 'notice detail with autolink');
await admin.req('/admin/seminars', { method: 'POST', form: { title: '예비고1 설명회', target: '예비고1 학부모님', date: '2099-12-06', when_text: '12월 6일 오후 5시', place: '동탄', sessions: '1차 오전 10시\n2차 오후 5시', body: '안내' } });
await admin.req('/admin/seminars', { method: 'POST', form: { title: '지난 설명회', date: '2020-01-01' } });
r = await guest.req('/seminars'); ok(r.text.includes('예비고1 설명회') && r.text.includes('종료된 설명회'), 'seminar list (open + ended)');
ok(!(await guest.req('/')).text.includes('다가오는 설명회'), 'home no longer shows seminar section');
r = await guest.req('/seminars/1/apply', { method: 'POST', form: { student_name: '김학생', school_grade: '동탄중3', parent_phone: '010-5555-6666', session: '2차 오후 5시', agree: 'on' } });
ok(r.loc === '/seminars/1?done=1#apply', 'seminar apply ok', `${r.status} ${r.loc}`);
r = await guest.req('/seminars/1/apply', { method: 'POST', form: { student_name: '김학생', school_grade: '동탄중3', parent_phone: '010-5555-6666', session: '2차 오후 5시', agree: 'on' } });
ok(r.status === 400, 'duplicate seminar application rejected');
r = await guest.req('/seminars/2/apply', { method: 'POST', form: { student_name: '김학생', school_grade: '동탄중3', parent_phone: '010-5555-6666', session: 'x', agree: 'on' } });
ok(r.status === 400, 'ended seminar rejects applications');
ok((await admin.req('/admin/seminars/1')).text.includes('010-5555-6666'), 'admin sees applicant');

// 설정
r = await admin.req('/admin/settings', { method: 'POST', form: {
  reward_amount: '3000', reward_couponLabel: '편의점 상품권', reward_bank: 'on', reward_coupon: 'on', reward_note: '선착순 1명',
  schools: '동탄 내 학교: 가온고, 이솔고\n동탄 외 학교: 오산고', years: '2026학년도, 2025학년도', papers: '수학: 공통수학1 중간, 공통수학1 기말\n국어: 고1-1 국어 중간', multi: '',
  hero_line1: '우리 학교 시험지,', hero_mark: '올리면 보상이', hero_line3: '돌아옵니다.', hero_sub: '설명', site_name: '동공아', site_full: '동탄공부잘하는아이', site_tagline: '소개', site_phone: '031-000-0000' } });
ok(decodeURIComponent(r.loc).includes('저장'), 'settings saved');
r = await guest.req('/exams'); ok(r.text.includes('3,000원') && !r.text.includes('동탄국제고') && r.text.includes('오산고'), 'settings applied to exams page');
ok((await guest.req('/')).text.includes('031-000-0000'), 'phone shown in footer');

// 회원 관리
r = await admin.req('/admin/users/1/reset', { method: 'POST' });
const temp = r.text.match(/<code>([^<]+)<\/code>/)?.[1];
ok(r.status === 200 && temp, 'admin resets password (shown once, not in URL)');
r = await new Client().req('/login', { method: 'POST', form: { username: 'mom1234', password: temp } }); ok(r.status === 303, 'login with temp password');
r = await member.req('/my/password', { method: 'POST', form: { current: temp, password: 'newpassword1', password2: 'newpassword1' } }); ok(r.loc === '/my?ok=pw', 'change password');
r = await member.req('/my/delete', { method: 'POST', form: { current: 'newpassword1' } }); ok(r.loc === '/', 'delete account');
ok((await member.req('/my')).loc?.startsWith('/login'), 'session dead after account deletion');
r = await admin.req(`/admin/uploads/${up3.id}/delete`, { method: 'POST' }); ok(decodeURIComponent(r.loc).includes('삭제'), 'admin deletes upload');
r = await admin.req('/admin/logout', { method: 'POST' }); ok((await admin.req('/admin')).loc === '/admin/login', 'admin logout');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
