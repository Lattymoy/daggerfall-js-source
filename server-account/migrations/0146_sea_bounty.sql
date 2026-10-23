-- SEA-BOUNTY (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - a freeport's
-- bounty board on the Eltheric Ocean's killers; bible/03-World/Eltheric-Ocean.md SEA-BOUNTY).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that serves
-- /v1/sea/bounty (acct168).
--
-- A KILL AT SEA is written with its fall (server-account/src/wild.js wildFall, in the fall's own batch, once - keyed by the
-- remains' id, as wild_falls is): its killer's account and character (the receipt's `kc`) and its fallen's. A POST is gold
-- off its poster's record onto a wanted captain's head; it STANDS (claimed_r null) until that captain falls at sea at
-- another player's hand, when every standing post on them is claimed by that fall and the sum OWED to its killer's
-- character, collected once (paid_at) at a freeport. Gold is never made here: owed is the sum of the posts it claimed.
CREATE TABLE IF NOT EXISTS sea_kills (
  r           TEXT PRIMARY KEY,        -- the fall's remains id (wild_falls.r)
  killer      TEXT NOT NULL,           -- the killer's account
  killer_char TEXT NOT NULL,           -- the killer's realm character
  victim      TEXT NOT NULL,           -- the fallen's account
  victim_char TEXT NOT NULL,           -- the fallen's realm character
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sea_kills_killer ON sea_kills (killer_char, at);
-- AUDIT SEA VENTURES B5: the Wanted window's own reads and the hourly sweep walk by when (never the whole history)
CREATE INDEX IF NOT EXISTS sea_kills_at ON sea_kills (at);

CREATE TABLE IF NOT EXISTS sea_bounties (
  id          TEXT PRIMARY KEY,        -- the post's id (the service's own randomness)
  poster      TEXT NOT NULL,           -- the poster's account
  poster_char TEXT NOT NULL,           -- the character whose record paid it
  rid         TEXT NOT NULL,           -- the poster's request id: one asked twice is one post
  target_char TEXT NOT NULL,           -- the wanted captain
  gold        INTEGER NOT NULL CHECK (gold > 0),
  at          INTEGER NOT NULL,
  claimed_r   TEXT,                    -- the fall that claimed it (sea_bounty_owed.r); null while it stands
  UNIQUE (poster, rid)
);
CREATE INDEX IF NOT EXISTS sea_bounties_target ON sea_bounties (target_char, claimed_r);
-- AUDIT SEA VENTURES B5: the bounties standing (the board, a head's sum), the posts a fall claimed (its owed sum, in the
-- fall's own batch), a poster's own standing posts (B4's refund) and the ended ones the hourly sweep takes
CREATE INDEX IF NOT EXISTS sea_bounties_standing ON sea_bounties (target_char) WHERE claimed_r IS NULL;
CREATE INDEX IF NOT EXISTS sea_bounties_claimed ON sea_bounties (claimed_r);
CREATE INDEX IF NOT EXISTS sea_bounties_poster ON sea_bounties (poster, poster_char) WHERE claimed_r IS NULL;
CREATE INDEX IF NOT EXISTS sea_bounties_ended ON sea_bounties (at) WHERE claimed_r IS NOT NULL;

CREATE TABLE IF NOT EXISTS sea_bounty_owed (
  r           TEXT PRIMARY KEY,        -- the fall that claimed the posts
  killer      TEXT NOT NULL,           -- the hand that ended the wanted captain: its account...
  killer_char TEXT NOT NULL,           -- ...and its character, whose record collects it
  target_char TEXT NOT NULL,           -- the captain it ended
  gold        INTEGER NOT NULL CHECK (gold > 0),
  at          INTEGER NOT NULL,
  paid_at     INTEGER                  -- null until collected
);
CREATE INDEX IF NOT EXISTS sea_bounty_owed_killer ON sea_bounty_owed (killer, killer_char, paid_at);
CREATE INDEX IF NOT EXISTS sea_bounty_owed_paid ON sea_bounty_owed (paid_at) WHERE paid_at IS NOT NULL;   -- AUDIT SEA VENTURES B5: the sweep
