CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  role          text NOT NULL CHECK (role IN ('Admin','Teacher','Student','Parent')),
  name          text NOT NULL,
  linked_id     text,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per record. "collection" is students, attendance, marks, ...
-- "data" holds the record exactly as the React app uses it.
CREATE TABLE IF NOT EXISTS records (
  seq        bigserial,
  collection text NOT NULL,
  id         text NOT NULL,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS records_coll_seq ON records (collection, seq);
CREATE INDEX IF NOT EXISTS records_student  ON records (collection, (data->>'studentId'));
-- Receipt numbers must be unique
CREATE UNIQUE INDEX IF NOT EXISTS ledger_receipt_unique ON records ((data->>'no')) WHERE collection = 'ledger';
