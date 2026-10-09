-- AUDIT BAG-CRAFT (2026-10-09, Mac: "Audit this"; bible/06-Systems/Materials-Bag.md section 15): THE STATIONS' WALL.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE STORES' FOURTH ORIGIN: `loose`, the units a station's put-in brought from the pack that the service never handed
-- out (a `work` deposit past the carried count - src/net/bagLaw.js looseOrder). A station alone spends them - a craft, a
-- smelt, a brew, a temper; no writ, guild Stores, market listing or fill reads them, and a withdrawal gives them back to
-- the pack uncounted. GOLD-MARKET's wall turned the other way: gold's units reach nothing but the pack and gold, loose
-- units nothing but the pack and a station. SQLite cannot widen a CHECK in place: the table is rebuilt, every row
-- carried (0041's way).
CREATE TABLE IF NOT EXISTS prof_stores_new (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  origin   TEXT NOT NULL CHECK (origin IN ('own', 'bought', 'gold', 'loose')),
  qty      INTEGER NOT NULL CHECK (qty >= 0 AND qty <= 5000),
  PRIMARY KEY (player, char_id, material, origin),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO prof_stores_new (player, char_id, material, origin, qty) SELECT player, char_id, material, origin, qty FROM prof_stores;
DROP TABLE prof_stores;
ALTER TABLE prof_stores_new RENAME TO prof_stores;

-- WHAT EACH ACT MOVED OF THEM: a deposit's units put in loose, a withdrawal's taken out loose (never counted as carried),
-- a smelt's products made loose (any loose input's - its products are as walled as its goods).
ALTER TABLE prof_deposits ADD COLUMN loose INTEGER NOT NULL DEFAULT 0 CHECK (loose >= 0);
ALTER TABLE prof_withdrawals ADD COLUMN loose INTEGER NOT NULL DEFAULT 0 CHECK (loose >= 0);
ALTER TABLE prof_smelts ADD COLUMN loose INTEGER NOT NULL DEFAULT 0 CHECK (loose >= 0);
