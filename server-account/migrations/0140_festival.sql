-- WITCH1 (2026-10-20, the owner: "With Halloween on the horizon. I think its fair to develop our first live event.
-- Daggerfall lore style") - THE WITCHES' FESTIVAL, AS THE SERVICE KEEPS IT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service
-- (acct165) after the relay that knows the festival's titles, aura and icons (world235) - THE RELAY FIRST, as WIKIMAID's.
--
-- bible/06-Systems/Witches-Festival.md. The law both ends share is src/net/festivalLaw.js; the service is
-- server-account/src/festival.js.
--
-- THE ACCOUNT'S SOUL CAKES AND WHAT THEY BOUGHT, on the row:
--   fest_cakes  the cakes the account holds - the pack's Soul Cakes are its face (systems/festival/soulCake.js restacks)
--   fest_bowls  the Hearth Offerings the account holds, not set out - the pack's bowls are its face, as the cakes'
--   fest_wares  the account wares bought (space-separated ware ids - a title, an aura, an icon), held for good
--   fest_given  cakes other accounts took from this account's offerings (Hearthkeeper at festivalLaw HEARTHKEEPER_GIVEN)
--   fest_taken  cakes this account took from other accounts' offerings (the Soul Cake icon at SOULCAKE_TAKEN)
--   icon        the profile icon worn (net/identityToken.js ICONS), signed as `pi`; NULL wears the character's face
ALTER TABLE players ADD COLUMN fest_cakes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN fest_bowls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN fest_wares TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN fest_given INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN fest_taken INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN icon TEXT;

-- A DAY'S FINDS, an account a UTC day: the asks heard and the cakes the service's die gave (festivalLaw
-- FIND_ASKS_PER_DAY, FIND_CAKES_PER_DAY).
CREATE TABLE IF NOT EXISTS fest_finds (
  account TEXT NOT NULL,
  day     INTEGER NOT NULL,
  asks    INTEGER NOT NULL DEFAULT 0,
  found   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, day),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- A SALE, by the request id the client minted: asked twice, it is one sale, and the second answer names the ware it sold.
CREATE TABLE IF NOT EXISTS fest_sales (
  account TEXT NOT NULL,
  rid     TEXT NOT NULL,
  ware    TEXT NOT NULL,
  price   INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, rid),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- A HEARTH OFFERING set out at a home's door: whose (the home's account and character), and the cakes in its bowl. One a
-- home. An offering outlives no home: one whose home its character no longer owns stands nowhere, and its bowl and its
-- cakes go back to its account on that account's next read (festival.js orphansHome); the account deleted, the cascade
-- takes it.
CREATE TABLE IF NOT EXISTS fest_offerings (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  player       TEXT NOT NULL,
  char_id      TEXT NOT NULL,
  stock        INTEGER NOT NULL DEFAULT 0,
  placed_at    INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fest_offerings_owner ON fest_offerings (player, char_id);

-- A CAKE TAKEN from an offering: one an account an offering a UTC day.
CREATE TABLE IF NOT EXISTS fest_takes (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  taker        TEXT NOT NULL,
  day          INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key, taker, day),
  FOREIGN KEY (taker) REFERENCES players(id) ON DELETE CASCADE
);
-- an account's own takes, by the account (its deletion's cascade, and nothing else, reads them so)
CREATE INDEX IF NOT EXISTS idx_fest_takes_taker ON fest_takes (taker);
