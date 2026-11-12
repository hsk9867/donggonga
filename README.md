# 동공아 (동탄공부잘하는아이)

학부모·학생이 학교 내신 시험지를 올리면 관리자가 확인한 뒤 쿠폰이나 계좌 입금으로 보상하는 사이트.
기능은 ij-js.com 의 시험지 관련 메뉴, 디자인은 sejungedu.com 을 참고했다.

- Cloudflare Worker (`src/`) + D1 (데이터) + R2 (시험지 파일) + 정적 파일 (`public/`)
- 화면은 모두 Worker 가 서버에서 그린다. `src/views.js`(공개), `src/admin.js`(관리자), `src/worker.js`(주소·처리), `src/lib.js`(공통)

## 로컬 미리보기

```
node dev/serve.mjs        # http://localhost:8795 , 관리자 /admin (비밀번호 admin1234)
node dev/smoke.mjs        # 전체 흐름 자동 점검 (빈 DB 에서 실행: .dev 폴더를 지우고 서버를 다시 띄운 뒤)
```

로컬 데이터는 `.dev/` 에 쌓인다 (git 제외). 모바일 화면은 `http://localhost:8795/__m?u=/exams` 로 확인.

## 배포

https://donggonga.hsk9867.workers.dev 에 배포되어 있다 (D1 `donggonga-db`, 시크릿 `ADMIN_PASSWORD`·`SESSION_SECRET` 등록됨).

```
npx wrangler deploy                                        # 수정 반영
npx wrangler d1 migrations apply donggonga-db --remote     # migrations/ 에 새 파일을 추가했을 때
```

시험지 파일은 지금 D1 `file_chunks` 테이블에 900KB 조각으로 저장한다 (계정에 R2 가 켜져 있지 않아서).
D1 무료 요금제는 DB 하나에 500MB 까지라 시험지가 수백 건 쌓이기 전에 R2 로 옮겨야 한다:
Cloudflare 대시보드에서 R2 활성화 → `npx wrangler r2 bucket create donggonga-files` → `wrangler.jsonc` 의 `r2_buckets` 주석 해제 → 배포.
(기존 파일은 D1 에 남으므로 옮기는 작업이 한 번 필요하다.)

## 관리자가 하는 일

1. `/admin` → 시험지·보상 → **검수 대기** 에서 파일을 보고 승인 또는 반려(사유 입력)
2. **지급 대기** 에서 계좌로 직접 이체하거나 쿠폰을 문자로 보낸 뒤 "지급 완료" 처리
3. 설정에서 보상 금액, 지급 방법(계좌/쿠폰), 학교·과목·시험지 목록, 메인 문구, 연락처를 바꾼다

## 아직 없는 것

- 문자(SMS) 본인 인증과 자동 문자 발송 — 문자 업체(알리고·솔라피 등) 계약 후 추가
- 시험지 사진 자동 판독 — 지금은 관리자가 직접 확인
