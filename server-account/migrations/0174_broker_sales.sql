-- AUDIT FB1024 (2026-10-25, the owner: "Audit this", of FIELD BUGS 2026-10-24's EMBERS-OWED - #bug-reports: "I now have 52
-- deadlands embers on me, and it will not let me buy the aura, it says I have too few"; bible/01-Overview/bugs/
-- Field-Bugs-2026-10-24.md, BROKER-RID) - THE BROKER'S SALES BY THEIR REQUEST IDS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it (acct182). A press of the Broker's insignia (accounts.js buyInsignia) or her Panoply piece (egEconomy.js egSink)
-- carries a request id (`rid`, src/net/insignia.js BROKER_RID_RE); the sale writes its row here in its own batch, so the
-- id names the sale. A client whose answer was lost asks `/v1/broker/settle` by that id (brokerSales.js settleBrokerSale):
-- a row the id wrote answers the sale; an id with no row is FENCED - a `fence` row written in its place - so the press,
-- landing late, writes nothing. `settled` counts the asks and `asked_by` keeps the first ask's nonce: the piece a sale owes is
-- handed to that ask alone (a save loaded again holds the same owed sale, and asks again).
--
-- ONE ROW A REQUEST ID AN ACCOUNT. `kind` 'insignia' | 'panoply' | 'fence'; `item` the insignia's id or the piece's (null
-- for a fence); `at` the write.
--
-- CASCADE: an account that is gone takes its sales with it.
CREATE TABLE IF NOT EXISTS broker_sales (
  account TEXT NOT NULL,
  rid     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  item    TEXT,
  at      INTEGER NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0,
  asked_by TEXT,
  PRIMARY KEY (account, rid),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
