-- SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue") - HOLDING A SEAT: THE UPKEEP, THE TITHE, THE EDICTS, THE LEVY,
-- THE BOUNTY (bible/11-Multiplayer/Seats-Arc.md 7.1-7.3, 7.6; src/net/townSeatLaw.js, server-account/src/seatHolding.js,
-- server-account/src/seatTurning.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A CHARTER'S LEVERS AND ITS DEBT: the Tithe in whole percents (palace 0-10, crown 0-15 - the law's bound, asked in the
-- write), the week it was last set (changed at most once a week), and the upkeep it owes from a week in Neglect (SEAT0
-- 5.2 step 5: "a treasury short of it puts the seat in Neglect: Standing -10 and one week's grace; a second short week
-- lapses the Charter").
-- AUDIT SEATS-2 S2: the CHECK's ceiling is 18 - TITHE_CAP.crown 15 and a tier-3 Market Hall's 3 (SEAT2b, 7.5: "the
-- Tithe's cap +1%" a tier; seatForts.js titheCapAt over fortLaw.js marketHallTitheCap). It said 15, so a crown's holder
-- with a Market Hall setting the Tithe its board allowed past 15 met a 500 (the CHECK failing the write). Widened here,
-- in place: 0046-0065 are one undeployed release (acct61), so no database holds this column yet. The write asks each
-- seat's own cap (seatHolding.js setTithe); this CHECK is the bound over every seat.
ALTER TABLE town_seat_holds ADD COLUMN tithe INTEGER NOT NULL DEFAULT 0 CHECK (tithe >= 0 AND tithe <= 18);
ALTER TABLE town_seat_holds ADD COLUMN tithe_week INTEGER;
ALTER TABLE town_seat_holds ADD COLUMN owed INTEGER NOT NULL DEFAULT 0 CHECK (owed >= 0);

-- THE EDICTS (SEAT0 7.6): one a seat a week, `week` the week it rules. Proclaimed in the week before it by the holder's
-- Guildmaster or an Officer (`set_by` the name they went by), replaced freely until its Turning; that Turning makes it
-- law (`state` 'law', its cost paid - `cost`) or lets it fall ('unpaid'; 'void' when the Charter went first). A
-- Bounty's `set_aside` is escrowed at its Turning and paid out 20 Drakes a camp (`spent`); what is left goes home at
-- the next.
CREATE TABLE IF NOT EXISTS town_seat_edicts (
  key        INTEGER NOT NULL,
  week       INTEGER NOT NULL,
  edict      TEXT NOT NULL CHECK (edict IN ('market-day', 'open-gates', 'curfew', 'festival', 'levy', 'bounty')),
  guild_id   TEXT NOT NULL,
  set_by     TEXT NOT NULL,
  set_aside  INTEGER NOT NULL DEFAULT 0 CHECK (set_aside >= 0),
  spent      INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0 AND spent <= set_aside),
  state      TEXT NOT NULL DEFAULT 'proclaimed' CHECK (state IN ('proclaimed', 'law', 'unpaid', 'void', 'returned')),
  cost       INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  at         INTEGER NOT NULL,
  PRIMARY KEY (key, week),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_edicts_week ON town_seat_edicts (week, state);

-- A SEAT'S STOCKPILE (SEAT0 4.2, 7.5): the materials the Levy took for it (and SEAT2b's fortification writs will
-- deliver) - the SEAT's, not its holder's, as its fortifications are. Never withdrawn.
CREATE TABLE IF NOT EXISTS town_seat_stockpile (
  key       INTEGER NOT NULL,
  material  TEXT NOT NULL,
  qty       INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (key, material)
);
-- the Levy's own lines: one a harvest that paid it, so a harvest asked again levies once
CREATE TABLE IF NOT EXISTS town_seat_levies (
  player    TEXT NOT NULL,
  rid       TEXT NOT NULL,
  key       INTEGER NOT NULL,
  week      INTEGER NOT NULL,
  material  TEXT NOT NULL,
  qty       INTEGER NOT NULL CHECK (qty >= 1),
  at        INTEGER NOT NULL,
  PRIMARY KEY (player, rid)
);

-- THE BOUNTY'S CAMPS PAID (SEAT0 7.6: "the treasury pays 20 Marks per camp cleared, up to the sum set aside ... an
-- account is paid for at most 5 camps a UTC day"): one row a camp an account cleared and was paid for - a camp (a World
-- of Daggerfall site, src/world/wodShared.js) paid once a day whoever cleared it.
CREATE TABLE IF NOT EXISTS town_seat_bounties (
  day       INTEGER NOT NULL,
  site      TEXT NOT NULL,
  account   TEXT NOT NULL,
  key       INTEGER NOT NULL,
  week      INTEGER NOT NULL,
  at        INTEGER NOT NULL,
  n         TEXT NOT NULL,
  PRIMARY KEY (day, site),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_bounties_account ON town_seat_bounties (account, day);

-- THE BAILIWICK (SEAT0 7.2): the board a listing and an auction were posted at - its town's map pixel - so a sale pays
-- the Tithe of the seat nearest it in its region. None (an older client's): the region's lowest seat.
ALTER TABLE market_listings ADD COLUMN board_x INTEGER;
ALTER TABLE market_listings ADD COLUMN board_y INTEGER;
ALTER TABLE market_auctions ADD COLUMN board_x INTEGER;
ALTER TABLE market_auctions ADD COLUMN board_y INTEGER;
-- an auction's Tithe, taken at its close (a listing's sale keeps its own in market_sales.tithe since PROF5)
ALTER TABLE market_auctions ADD COLUMN tithe INTEGER NOT NULL DEFAULT 0 CHECK (tithe >= 0);
