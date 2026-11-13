-- 회원가입 때 받는 동공아 카페 아이디·닉네임
ALTER TABLE users ADD COLUMN cafe_nick TEXT NOT NULL DEFAULT '';
