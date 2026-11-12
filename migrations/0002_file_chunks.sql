-- R2 를 쓸 수 없을 때 시험지 파일을 D1 에 조각내어 저장한다 (조각당 900KB 이하)
CREATE TABLE IF NOT EXISTS file_chunks (
  k TEXT NOT NULL,
  seq INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (k, seq)
);
