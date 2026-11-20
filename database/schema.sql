-- Campus Lost & Found - PostgreSQL schema
-- Run with:  npm run db:init   (from /backend)   or   psql -d campus_lost_found -f database/schema.sql

CREATE SEQUENCE IF NOT EXISTS lost_seq  START 125;
CREATE SEQUENCE IF NOT EXISTS found_seq START 87;
CREATE SEQUENCE IF NOT EXISTS match_seq START 1;
CREATE SEQUENCE IF NOT EXISTS claim_seq START 1;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  student_id    VARCHAR(30)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lost_items (
  id                     SERIAL PRIMARY KEY,
  report_code            VARCHAR(40) NOT NULL UNIQUE,          -- e.g. LOST-DRAW-2025-00125
  user_id                INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category               VARCHAR(60) NOT NULL,
  brand                  VARCHAR(80),
  color                  VARCHAR(40),
  last_seen_location     VARCHAR(160) NOT NULL,
  date_lost              DATE NOT NULL,
  description            TEXT NOT NULL,
  identifiers            TEXT[] NOT NULL DEFAULT '{}',          -- ticked checkboxes (Scratch, Sticker, ...)
  identification_details TEXT,                                  -- secret details only owner/admin can see
  photo_path             TEXT,
  status                 VARCHAR(20) NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','claim_pending','returned')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS found_items (
  id             SERIAL PRIMARY KEY,
  report_code    VARCHAR(40) NOT NULL UNIQUE,                   -- e.g. FOUND-DRAW-2025-00087
  user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       VARCHAR(60) NOT NULL,
  brand          VARCHAR(80),
  color          VARCHAR(40),
  found_location VARCHAR(160) NOT NULL,
  date_found     DATE NOT NULL,
  condition      VARCHAR(120),
  description    TEXT NOT NULL,                                 -- public description
  hidden_details TEXT,                                          -- NOT visible to public (admin only)
  photo_path     TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','claim_pending','returned')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  match_code    VARCHAR(20) NOT NULL UNIQUE DEFAULT ('MATCH-' || lpad(nextval('match_seq')::text, 3, '0')),
  lost_item_id  INT NOT NULL REFERENCES lost_items(id)  ON DELETE CASCADE,
  found_item_id INT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  score         INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  status        VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','claimed','approved','rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lost_item_id, found_item_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id                SERIAL PRIMARY KEY,
  claim_code        VARCHAR(20) NOT NULL UNIQUE DEFAULT ('CLM-' || lpad(nextval('claim_seq')::text, 3, '0')),
  match_id          INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  lost_item_id      INT NOT NULL REFERENCES lost_items(id)  ON DELETE CASCADE,
  found_item_id     INT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  student_user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  student_response  TEXT,                                       -- student's answer to the verification question
  verification_note TEXT,                                       -- admin's verification question / notes
  verified_by       INT REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_user    ON lost_items(user_id);
CREATE INDEX IF NOT EXISTS idx_found_user   ON found_items(user_id);
CREATE INDEX IF NOT EXISTS idx_lost_status  ON lost_items(status, category);
CREATE INDEX IF NOT EXISTS idx_found_status ON found_items(status, category);
CREATE INDEX IF NOT EXISTS idx_claims_user  ON claims(student_user_id);
