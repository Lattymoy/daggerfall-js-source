-- AUDIT REALM (2026-09-28) - THE AUDIT OF REALM P0.1-P2.2b: A TRADE'S OUTCOME IS ITS OWN HALF'S, AND A REALM RECORD IS
-- ONLY EVER PAID BACK WHAT REALM RECORDS PAID IN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Columns, and one table - the census below.
--
-- realm_trades.b_seq / b_half (L1-F6): the second side as the first side
-- already is - the sequence its half was made at and the half itself. A
-- trade's sid is the peers' own, so a later trade may ask with the same
-- one; an outcome is now answered to the half that made it and to no
-- other (src/realmTrade.js outcomeFor).
--
-- WHAT A RECORD PAID (L1-F3). Before the realm a home's price, a placed
-- piece's cost and a treasury's gold were the client's word (the two-write
-- lane, HOME1 / DECOR1 / GUILD1), and customs carries those homes and that
-- guild into the realm. A realm record is credited only from what realm
-- records paid in - never from a price a client named:
--   homes.paid          - the gold a realm record paid for the house
--                         (src/homes.js realmClaim); a sale pays back the
--                         deed share of THIS, and a house from before the
--                         realm (0) comes back as a house, not as gold.
--   home_decor.paid     - the gold realm records paid for the piece as it
--                         stands (src/decor.js): placed, grown, shrunk; its
--                         removal or its house's sale gives back half of
--                         THIS.
--   guilds.realm_gold   - the part of the treasury realm records paid in
--                         (src/guilds.js realmTreasury); a realm withdrawal
--                         takes from it alone. The gold before the realm
--                         stays in the treasury (OPEN: Mac's call what
--                         becomes of it - bible/06-Systems/Realm-Arc.md).
ALTER TABLE realm_trades ADD COLUMN b_seq INTEGER;
ALTER TABLE realm_trades ADD COLUMN b_half TEXT;
ALTER TABLE homes ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE home_decor ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guilds ADD COLUMN realm_gold INTEGER NOT NULL DEFAULT 0;

-- realm_census (L1-F5, L3-F2): THE CHARACTERS THAT PLAYED ONLINE BEFORE THE
-- REALM, taken ONCE, as this migration is applied. Customs' gate was a
-- Renown track, and any session files one for any id at any time - a
-- Copy to offline's new id, one report, and the realm character came in
-- twice. The census is the gate now (src/realm.js customsRealm): what
-- stood here at the realm's start, never what was written after it. A
-- customs SPENDS its character's rows on every account (`spent`), so a
-- character copied onto two accounts before the realm comes in once, a
-- realm character deleted never brings its origin in again, and a
-- refusal can still say which it is (customsRefusal).
CREATE TABLE IF NOT EXISTS realm_census (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  spent    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player, char_id)
);
INSERT OR IGNORE INTO realm_census (player, char_id) SELECT player, char_id FROM renown_tracks;
