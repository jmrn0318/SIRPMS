-- InternTrack database schema (matches the ERD)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role          VARCHAR(12)  NOT NULL CHECK (role IN ('coordinator','student')),
  company       VARCHAR(120) NOT NULL DEFAULT '',
  need_hours    INT          NOT NULL DEFAULT 300 CHECK (need_hours >= 0),
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS requirements (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_date    DATE NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS submissions (
  id             SERIAL PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES users(id),
  requirement_id INT NOT NULL REFERENCES requirements(id),
  note           TEXT NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  remarks        TEXT,
  reviewed_by    INT REFERENCES users(id),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, requirement_id)
);
CREATE TABLE IF NOT EXISTS hour_logs (
  id          SERIAL PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES users(id),
  log_date    DATE NOT NULL,
  hours       NUMERIC(4,1) NOT NULL CHECK (hours > 0 AND hours <= 12),
  task        VARCHAR(255) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  remarks     TEXT,
  reviewed_by INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id         SERIAL PRIMARY KEY,
  actor_id   INT REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(120) NOT NULL,
  role       VARCHAR(12) NOT NULL DEFAULT '',
  action     VARCHAR(80) NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_hrs_student ON hour_logs(student_id, log_date);
