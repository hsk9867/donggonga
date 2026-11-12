-- 동공아 (동탄공부잘하는아이) 초기 스키마

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'parent',          -- parent | student
  username TEXT NOT NULL UNIQUE,
  pw_hash TEXT NOT NULL,
  pw_salt TEXT NOT NULL,
  student_name TEXT NOT NULL,
  school TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  student_phone TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  agree_sms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 시험지 업로드 1건 = (학교, 연도, 과목, 시험지) 한 칸
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL,
  user_id INTEGER,
  school TEXT NOT NULL,
  year TEXT NOT NULL,
  subject TEXT NOT NULL,
  paper TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | approved | rejected
  reject_reason TEXT NOT NULL DEFAULT '',
  file_count INTEGER NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT '',         -- '' (미입력) | bank | coupon | none
  amount INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  bank TEXT NOT NULL DEFAULT '',
  holder TEXT NOT NULL DEFAULT '',
  account_no TEXT NOT NULL DEFAULT '',
  coupon_name TEXT NOT NULL DEFAULT '',
  coupon_code TEXT NOT NULL DEFAULT '',
  admin_memo TEXT NOT NULL DEFAULT '',
  paid_at TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_uploads_slot ON uploads (school, year, subject, paper);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads (status, paid_at);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads (user_id);

CREATE TABLE IF NOT EXISTS upload_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_files_upload ON upload_files (upload_id);

CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seminars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',                -- YYYY-MM-DD (정렬·종료 판단)
  when_text TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  sessions TEXT NOT NULL DEFAULT '',            -- 줄바꿈으로 구분한 신청 회차
  body TEXT NOT NULL DEFAULT '',
  closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seminar_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seminar_id INTEGER NOT NULL,
  user_id INTEGER,
  student_name TEXT NOT NULL,
  school_grade TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL,
  session TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_seminar ON seminar_apps (seminar_id);

CREATE TABLE IF NOT EXISTS consults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_phone TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_phone TEXT NOT NULL DEFAULT '',
  school TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- 간단한 요청 횟수 제한 (로그인·가입·업로드·신청)
CREATE TABLE IF NOT EXISTS hits (
  k TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hits ON hits (k, ts);
