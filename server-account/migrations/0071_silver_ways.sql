-- SILVER-WAYS (2026-10-03, Mac: "Do it") - SILVER OUTSIDE THE CRAFTS: GUILD DEEDS AND GUILD CONTRACTS
-- (bible/06-Systems/Professions-Arc.md 10.5; bible/06-Systems/Online-Arc.md SILVER-WAYS).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). A raid's own silver (the
-- `raid` faucet, under the day's combat cap with the gate's) needs no table: it is a ledger line keyed on the raid's
-- key, written in the raid claim's own batch (server-account/src/marks.js raidStrikeStatement).

-- A GUILD DEED'S MARKS: an account counted for its claiming character's guild on one event - a raid (`raid:<key>`) or a
-- gate (`gate:<game day>`) - where that character has been in the guild seven days. Written in the claim's own batch, by
-- the claim's own row (marks.js deedStatements); once an (event, account) - one guild an account an event, however many
-- guilds its characters are in (AUDIT SILVER-WAYS A1: a gate's re-claim in the claim's own second marked a second
-- guild, and one account's gate struck two deeds). Three of a guild's marks on one event
-- strike its deed - 25 silver into its treasury, once (the ledger's `deed:<event>` under the guild), four a guild a UTC
-- day. A guild that goes takes its marks; an account that goes takes its own.
CREATE TABLE IF NOT EXISTS guild_deed_marks (
  guild_id TEXT NOT NULL,
  event    TEXT NOT NULL,
  account  TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (guild_id, event, account),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_deed_marks_event ON guild_deed_marks (event, account);

-- A GUILD'S CONTRACTS: posted by its Guildmaster, or an Officer within the week's writ budget (`officer` 1, `week` the
-- seat week it was posted in - writLaw seatWeek; one budget with their writs); `pay` silver for each of `deeds`
-- defenders of a raid in `region`, the whole escrowed from the guild's treasury (the ledger's `escrow` end, the
-- contract's id), drawn down by each deed; closed filled, withdrawn or expired, and what is left returned once
-- (`returned`). The poster's account may go (SET NULL) - the contract is the guild's. A guild with a contract standing
-- does not disband (guilds.js guildKeepsSql), so the cascade meets only closed rows.
CREATE TABLE IF NOT EXISTS guild_contracts (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  poster      TEXT,
  poster_char TEXT NOT NULL,
  officer     INTEGER NOT NULL CHECK (officer IN (0, 1)),
  week        INTEGER NOT NULL,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 61),
  kind        TEXT NOT NULL CHECK (kind IN ('raid')),
  deeds       INTEGER NOT NULL CHECK (deeds >= 1 AND deeds <= 500),
  left_deeds  INTEGER NOT NULL CHECK (left_deeds >= 0 AND left_deeds <= deeds),
  pay         INTEGER NOT NULL CHECK (pay >= 1 AND pay <= 50),
  escrow      INTEGER NOT NULL CHECK (escrow >= 0),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  closed_by   TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  cn          TEXT,
  UNIQUE (poster, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_region ON guild_contracts (region, kind, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_guild ON guild_contracts (guild_id, state);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_week ON guild_contracts (guild_id, week, officer);
CREATE INDEX IF NOT EXISTS idx_guild_contracts_due ON guild_contracts (state, returned, expires_at);

-- A CONTRACT'S DEED PAID: one a (contract, raid, account), written in the raid claim's own batch and keyed on its nonce
-- (`n` - raid_cleanses.nonce), so every line after it moves silver for this claim alone (contracts.js
-- contractPayStatements). `pay` what the defender was paid, `tax` what was burnt from it.
CREATE TABLE IF NOT EXISTS guild_contract_pays (
  contract TEXT NOT NULL,
  event    TEXT NOT NULL,
  account  TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  pay      INTEGER NOT NULL CHECK (pay >= 0),
  tax      INTEGER NOT NULL CHECK (tax >= 0),
  at       INTEGER NOT NULL,
  day      INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (contract, event, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_contract_pays_event ON guild_contract_pays (event, account);
