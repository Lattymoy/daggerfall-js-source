-- KETCH (2026-10-24, the owner: "A proper dwarven airship flies in once a week over the skies of daggerfall, and you,
-- along with other players venture into it in a raid like format"; bible/11-Multiplayer/Sky-Ketch.md section 9) - THE
-- KETCHMASTER'S HOLD, ONCE A VOYAGE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it (acct180). The relay runs each crew's ship and, at the Tonal Warden's fall, signs a receipt for each member who
-- earned it (src/net/ketch/ketchReceipt.js - `y1`, under the relay's GATE_SIGNING_KEY). The account it names carries it
-- here (server-account/src/ketch.js claimKetch), and it is counted.
--
-- ONE ROW A VOYAGE AN ACCOUNT: the primary key is (voyage, account) - the hold pays a hand once a week. `owner` is the
-- ship the row was paid on (its captain's digest): a receipt of the same voyage from that ship again is the same kill
-- (another device, a lost answer - its spoils still the page's to roll), one from ANOTHER crew's ship is answered
-- `taken` (the account helped a second crew this week; the hold had paid it already). `earned` how ('dealt' | 'stood'),
-- `lv` the level the fight admitted, `body` the relay's count of its body (INT14), `nonce` the claim that wrote it, `cid`
-- the device's claim id it was written under - a `claimed` pays its share to that claim id alone (AUDIT KETCH L2-1: the
-- relay hands a receipt to every hello of its account, so a second browser rolled the share again).
-- A guest's row is written too: the week's share is the account's, registered or not.
--
-- CASCADE: an account that is gone takes its voyages with it.
CREATE TABLE IF NOT EXISTS ketch_voyages (
  voyage  INTEGER NOT NULL,
  account TEXT NOT NULL,
  owner   TEXT NOT NULL,
  earned  TEXT NOT NULL,
  lv      INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  body    TEXT,
  cid     TEXT,
  PRIMARY KEY (voyage, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ketch_voyages_account ON ketch_voyages (account);
