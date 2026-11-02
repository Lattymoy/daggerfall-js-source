-- SERPENT1 (2026-10-04) - THE SERPENTS SLAIN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "A new world event that requires players with a ship to meet up
-- and take on a large scale sea serpent in the ocean." The relay holds
-- Sethrakul's fight in the cell its site stands in and, at the kill,
-- signs a receipt for each account that took a real part in it
-- (src/net/serpentReceipt.js - `l1`, under the relay's GATE_SIGNING_KEY).
-- The account the receipt names carries it here, this service verifies it
-- with the relay's public half (GATE_PUBLIC_KEY), and it is counted - and
-- pays the character that fought it its Renown (src/net/renown.js
-- renownSerpentXp).
--
-- ONE ROW A SERPENT A PLAYER SLEW, and the primary key is (day, account):
-- a serpent day holds one serpent, so a receipt counts once whatever
-- happens to it - claimed twice, from two devices, after a crash, a week
-- later - and an account counts one serpent a day however many cells a
-- modified client says it fought one in (the relay holds no map, so this
-- is the record's bound). Its own table, never the gate's: gate_kills is
-- keyed (day, account) too, and a gate and a serpent fall on the same game
-- day. `boss` is the serpent's id, `hull` the hull the receipt says it
-- fought from (-1 aboard another's ship), `char_id` and `xp` what the
-- claim paid and to whom; `nonce` names the claim that wrote the row, so
-- the one transaction that writes it credits the track by its own row
-- alone.
--
-- CASCADE: an account that is gone takes its serpents with it.
CREATE TABLE IF NOT EXISTS serpent_kills (
  day     INTEGER NOT NULL,
  account TEXT NOT NULL,
  boss    TEXT NOT NULL,
  hull    INTEGER NOT NULL,
  char_id TEXT NOT NULL,
  xp      INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (day, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_serpent_account ON serpent_kills (account);
-- A SERPENT'S HOARD, ONCE A SERPENT AND ACCOUNT (the raids' thanks' law,
-- AUDIT RAID R4): the spoils a receipt's seed rolls on the device are
-- given when THIS row says so - the first claim of a (day, account), a
-- registered account's or a guest's, writes it with that device's claim
-- id (`cid`), and a claim is answered `spoils: true` only when the row
-- carries its own cid. No count reads it.
CREATE TABLE IF NOT EXISTS serpent_spoils (
  day     INTEGER NOT NULL,
  account TEXT NOT NULL,
  cid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (day, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
