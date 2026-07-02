-- ==================================================
--  মেস হিসাব ম্যানেজার (Mess Accounts Manager)
--  PostgreSQL schema — run this once against your Vercel/Neon database
-- ==================================================

-- ── Months ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS months (
  id       SERIAL PRIMARY KEY,
  label    VARCHAR(100) NOT NULL UNIQUE,
  rent     NUMERIC(10,2) NOT NULL DEFAULT 2000,
  created  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Members ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
);

-- ── Meal / bazar records (per member, per month) ─
CREATE TABLE IF NOT EXISTS meal_records (
  id         SERIAL PRIMARY KEY,
  month_id   INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  meals      INT NOT NULL DEFAULT 0,
  bazar      NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE (month_id, member_id)
);

-- ── Extra / shared costs (per month) ─────────────
CREATE TABLE IF NOT EXISTS extra_costs (
  id        SERIAL PRIMARY KEY,
  month_id  INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  label     VARCHAR(150) NOT NULL,
  amount    NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ── Payment status (per member, per month) ───────
CREATE TABLE IF NOT EXISTS payments (
  id         SERIAL PRIMARY KEY,
  month_id   INT NOT NULL REFERENCES months(id) ON DELETE CASCADE,
  member_id  INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  paid       BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (month_id, member_id)
);

-- ==================================================
--  Optional seed data (same as the original app's
--  first-run seed). Delete this block if not wanted.
-- ==================================================
DO $$
DECLARE
  v_month_id INT;
BEGIN
  INSERT INTO months (label, rent) VALUES ('May 2026', 2000) RETURNING id INTO v_month_id;

  INSERT INTO members (name) VALUES
    ('জয়'), ('অনিক দেবনাথ'), ('বিশাল নন্দী'),
    ('কৌষিক'), ('প্রান্ত অধিকারী'), ('বিশ্বজিৎ');

  INSERT INTO meal_records (month_id, member_id, meals, bazar)
  SELECT v_month_id, id,
    CASE name
      WHEN 'জয়' THEN 46
      WHEN 'অনিক দেবনাথ' THEN 21
      WHEN 'বিশাল নন্দী' THEN 37
      WHEN 'কৌষিক' THEN 44
      WHEN 'প্রান্ত অধিকারী' THEN 4
      WHEN 'বিশ্বজিৎ' THEN 40
    END,
    CASE name
      WHEN 'জয়' THEN 1478
      WHEN 'অনিক দেবনাথ' THEN 1580
      WHEN 'বিশাল নন্দী' THEN 1131
      WHEN 'কৌষিক' THEN 1050
      WHEN 'প্রান্ত অধিকারী' THEN 850
      WHEN 'বিশ্বজিৎ' THEN 1544
    END
  FROM members;

  INSERT INTO extra_costs (month_id, label, amount) VALUES
    (v_month_id, 'মাসী', 2500),
    (v_month_id, 'ওয়াইফাই', 500),
    (v_month_id, 'ময়লা', 150),
    (v_month_id, 'সিরি মোছা', 200),
    (v_month_id, 'গ্যাস বিল', 500);
END $$;
