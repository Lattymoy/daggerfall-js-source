-- DOMAIN3 (2026-10-24, the owner: "A transition to tamriel region control instead of just city control"; asked, "Replace
-- seats"): A REGION'S SEAT OF POWER, WITNESSED (bible/11-Multiplayer/Domains.md section 7; server-account/src/domains.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads it.
--
-- ONE ROW A WITNESS A REGION: the seat of power a client derived for the region it stood in (net/domainLaw.js
-- domainReportText, `[region, key]`), its first answer standing (the witnesses' INSERT OR IGNORE, as a seat's). Its own
-- table, not `world_witness`'s kind: that table names its kinds in a CHECK, and a new kind would rebuild the service's
-- largest table - its lean column, triggers and indexes - for some hundred rows. An answer that agrees with the region's
-- confirmation is written only while fewer than a dozen do (domains.js witnessDomain, DOMAIN_AGREEING_KEPT), so the rows
-- stay a dozen a region and the dissenters.
CREATE TABLE IF NOT EXISTS town_domain_witness (
  region   INTEGER NOT NULL CHECK (region >= 0 AND region <= 70),   -- WW7-3, before its deploy: the provinces' regions too (62-70)
  account  TEXT NOT NULL,
  report   TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (region, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
