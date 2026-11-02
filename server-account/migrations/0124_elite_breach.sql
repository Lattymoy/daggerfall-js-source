-- EG-PLAY (2026-10-11, the Elite Gates arc) - THE ELITE BREACH, AS THE SERVICE KEEPS IT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service
-- (acct136) with the relay (world205 opens the breaches and signs their `e1` receipts) and the site.
--
-- Mac: "an endless procedural breach for a party of 8 ... keys ... checkpoints". Design:
-- bible/11-Multiplayer/Elite-Gates.md sections 5 and 23.
--
-- THE BALANCE IS THE ACCOUNT'S (section 5): every dungeon drop is the client's own die, and a key from a forged drop
-- would open a real relay instance - so a Weir Key is a count on the account's row, and the item in the pack is its face
-- (the client restacks it to every answer that carries the count).
--   eg_keys      the Weir Keys held
--   eg_key_miss  the recorded gate kills in a row that rolled no key (the pity: the sixth gives one)
--   eg_live_b    the breach the account is in or holds (one at a time, opener or member), with eg_live_until its
--                bound - a lapsed one counts as clear, so no lost receipt locks an account out
--   eg_rh_day    the UTC day of the account's last Rehearsal (section 27.7: one a real day, no key)
--   eg_mercy     1 once the first breach's mercy has returned a stake (once ever)
ALTER TABLE players ADD COLUMN eg_keys INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN eg_key_miss INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN eg_live_b TEXT;
ALTER TABLE players ADD COLUMN eg_live_until INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN eg_rh_day INTEGER NOT NULL DEFAULT -1;
ALTER TABLE players ADD COLUMN eg_mercy INTEGER NOT NULL DEFAULT 0;
-- THE STAKES (section 23): a key held against a breach until it settles - SPENT by its first Redoubt or an end that is
-- not a void, RETURNED by a relay-signed void or the first breach's mercy. One row an open order (`ez`); the client's
-- request id `rq` makes an open idempotent (a crashed client asking again gets the same order back). `rh` a Rehearsal's
-- (no key held).
CREATE TABLE IF NOT EXISTS eg_stakes (
  ez      TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  b       TEXT NOT NULL,
  rq      TEXT NOT NULL,
  rh      INTEGER NOT NULL DEFAULT 0,
  at      INTEGER NOT NULL,
  until   INTEGER NOT NULL,
  state   TEXT NOT NULL DEFAULT 'held',
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_eg_stakes_rq ON eg_stakes (account, rq);
CREATE INDEX IF NOT EXISTS idx_eg_stakes_account ON eg_stakes (account);
-- THE REDOUBTS TAKEN: one row a (breach, account, Redoubt) - a receipt counts once whatever happens to it.
CREATE TABLE IF NOT EXISTS eg_redoubts (
  b       TEXT NOT NULL,
  account TEXT NOT NULL,
  w       INTEGER NOT NULL,
  h       INTEGER NOT NULL,
  t       INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (b, account, w),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_eg_redoubts_account ON eg_redoubts (account);
-- THE ENDS: one row a (breach, account) - the deepest hall cleared and how the member's breach ended.
CREATE TABLE IF NOT EXISTS eg_runs (
  b       TEXT NOT NULL,
  account TEXT NOT NULL,
  h       INTEGER NOT NULL,
  why     TEXT NOT NULL,
  t       INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (b, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_eg_runs_account ON eg_runs (account);
-- THE LAUNCH GIFT (section 5): every account that has closed a Dagon's Breach (a recorded kill, never the rite alone)
-- holds one key when this lands.
UPDATE players SET eg_keys = eg_keys + 1 WHERE EXISTS (SELECT 1 FROM gate_kills g WHERE g.account = players.id AND g.earned != 'rite');
-- AUDIT EG IV (lane3 #4, lane9 #24): AND ITS LETTER - the same accounts, one piece of the server's post each (0093's table,
-- HOURS-FIRST's send in 0094: INSERT OR IGNORE over its one-a-batch index), batch `spire-launch`, no item - the key is the
-- balance's, counted above. Its words are server-account/src/eg.js EG_LAUNCH_POST's (test/egaudit4_net_service.test.js).
INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
SELECT lower(hex(randomblob(12))), p.id, 'spire-launch', 'The Developers', 'From the Battlespire', 'For the Dagon''s Breach you closed, the Battlespire sends you a Weir Key - one of its portal keys, surrendered to the Kyn in 3E 398. It is already in your pack.

Use it under open sky, away from any town, to open an Elite Breach: your party is called with you, and the Spire''s halls go down as deep as you can take them.

- The Developers', NULL, CAST(strftime('%s', 'now') AS INTEGER)
FROM players p WHERE EXISTS (SELECT 1 FROM gate_kills g WHERE g.account = p.id AND g.earned != 'rite');
-- EG-E2 (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md sections 19 and 20) - THE FEATS, THE ANNALS, THE
-- HONOURS AND THE BOARDS (server-account/src/egHonours.js).
--   eg_annals   the Annals of 3E 398's pages the account was given (bit p page p - net/egAnnals.js), OR'ed at each end
--   eg_honours  the Spire's honours (egHonours.js EG_HONOUR: Spirewalker ... the four Masters), OR'ed at a recorded
--               non-Rehearsal Redoubt, held for good
ALTER TABLE players ADD COLUMN eg_annals INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN eg_honours INTEGER NOT NULL DEFAULT 0;
-- THE ENDS AS THE BOARDS RANK THEM: the company's size (`n`), the start Redoubt (`ew`), the Wager (`wg`, 1 wagered), the
-- falls (`fl`), the seconds from Hall 1's wake to the deepest hall's door (`td`, where the receipt says it), a
-- Rehearsal's (`rh`, never on a board) and the arena season of the receipt's issue (`season`).
ALTER TABLE eg_runs ADD COLUMN n INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN ew INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN wg INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN fl INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN td INTEGER;
ALTER TABLE eg_runs ADD COLUMN rh INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN season INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_eg_runs_season ON eg_runs (season, h);
-- THE FEATS: one row an (account, lord) - the lord's three feat bits (net/egFeats.js) the account has held, OR'ed.
CREATE TABLE IF NOT EXISTS eg_feats (
  account TEXT NOT NULL,
  lord    TEXT NOT NULL,
  bits    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, lord),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- SPIRE CHAMPION: one row a (season, Descent bracket, account) - each bracket's top ten companies at the season's end,
-- every member, holding the title through the next season; written the first time a read in the new season finds the
-- last one unkept.
CREATE TABLE IF NOT EXISTS eg_champions (
  season  INTEGER NOT NULL,
  bracket TEXT NOT NULL,
  account TEXT NOT NULL,
  PRIMARY KEY (season, bracket, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_eg_champions_account ON eg_champions (account);
-- EG-E1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19) - WHAT A REDOUBT
-- PAYS, AND THE BROKER'S PANOPLY SINK (server-account/src/egEconomy.js).
--
-- A Redoubt's number pays once an account an arena week (src/net/arenaLaw.js arenaWeekOf); taken again that week it pays
-- its gold alone. The row says what the claim that wrote it paid, so a claim asked again answers the same:
--   wk      the arena week the row was claimed in (-1: a row from before EG-E1)
--   paid    1 for the account's first row of that Redoubt that week (never a Rehearsal's)
--   stones  the Deadlands Embers it paid (src/net/egPay.js egEmbersOf - a Valkynaz's, and a first this season); the
--           insignia's and the sink's purse (accounts.js EMBERS_EARNED_SQL) counts them
--   nonce   the claim that wrote it (the service's own draw - a refused re-claim of the same receipt carries none): the
--           Marks, the guild's deed, the pity and the key are written only while the row this claim wrote stands; AUDIT
--           EG V: and the spoils roll on the receipt's seed mixed with it (src/net/egPay.js egSpoilsSeed), answered with
--           the claim, so no page reads a receipt's spoils before the service has said which receipt the week pays
--   forced  the Panoply passes the pity forced, a bit a pass
--   wkey    1 when a Valkynaz's Redoubt found its Weir Key
ALTER TABLE eg_redoubts ADD COLUMN wk INTEGER NOT NULL DEFAULT -1;
ALTER TABLE eg_redoubts ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_redoubts ADD COLUMN stones INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_redoubts ADD COLUMN nonce TEXT;
ALTER TABLE eg_redoubts ADD COLUMN forced INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_redoubts ADD COLUMN wkey INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_eg_redoubts_pay ON eg_redoubts (account, w, wk, paid);
--   eg_pity     the Panoply passes in a row that drew no piece (EG_PANOPLY_PITY of them, and the next is forced)
--   eg_valk_wk  the arena week a Valkynaz's Redoubt last found the account a Weir Key (at most one a week)
ALTER TABLE players ADD COLUMN eg_pity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN eg_valk_wk INTEGER NOT NULL DEFAULT -1;
-- THE SINK: one Panoply piece of the buyer's choosing, once an account an arena week, for EG_SINK_EMBERS embers out of the
-- insignia's purse (`insignia_spent`) - one row a (account, week).
CREATE TABLE IF NOT EXISTS eg_sink (
  account TEXT NOT NULL,
  wk      INTEGER NOT NULL,
  piece   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, wk),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- EG-E3 (2026-10-12, Mac: "I said I want everything") - THE DUNGEON'S FIND (bible/11-Multiplayer/Elite-Gates.md
-- section 5). No relay witnesses an ordinary dungeon, so an elite's killer asks and the service rolls - bounded: one row
-- an account's asks of a tier (`super`, `elite`, `regular`) a real UTC day (`asks`, at most EG_FIND_PER_DAY -
-- server-account/src/eg.js findEg) and the keys they found (`found`), `wk` the arena week the day falls in (finds pay
-- at most EG_FIND_KEYS_PER_WEEK keys a week, summed by it).
CREATE TABLE IF NOT EXISTS eg_finds (
  account TEXT NOT NULL,
  day     INTEGER NOT NULL,
  tier    TEXT NOT NULL,
  wk      INTEGER NOT NULL,
  asks    INTEGER NOT NULL DEFAULT 0,
  found   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, day, tier),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_eg_finds_week ON eg_finds (account, wk);
-- EG-F (2026-10-12, the Elite Gates arc) - THE START WINDOW AND THE WAGER (bible/11-Multiplayer/Elite-Gates.md sections 5,
-- 16.6 and 18). A stake keeps where its breach starts and what it wagered: `ew` the start Redoubt (0 Hall 1 - every
-- admission is held to it, no carries), `wg` the Wager (its decrees' numbers joined by commas, '' none). Admissions find
-- a breach's stake by its id.
ALTER TABLE eg_stakes ADD COLUMN ew INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_stakes ADD COLUMN wg TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_eg_stakes_b ON eg_stakes (b);
-- EG-ZA (2026-10-12, Mac: "I said I want everything") - THE RECEIPTS SAY EVERYTHING (bible/11-Multiplayer/Elite-Gates.md
-- sections 20, 21 and 23's table). The relay now mints what the table asked: an end's `td` (eg_runs.td, above, was
-- already read where a receipt said it) and its company, `co` - the entrants' count and a 48-bit tag of their accounts
-- (src/net/egReceipt.js egCompanyTag), which every member's receipt of one breach says alike - by which the Descent keeps
-- a company one row (server-account/src/egHonours.js egDescentCompanies); a Redoubt's `sh` (the member's share of the
-- circle's damage, thousandths) and `m` (THE FAIR TRAIL's six measures over the circle, JSON - read by staff, gating
-- nothing until EG21) beside it.
ALTER TABLE eg_runs ADD COLUMN co_n INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eg_runs ADD COLUMN co_h TEXT;
ALTER TABLE eg_redoubts ADD COLUMN sh INTEGER;
ALTER TABLE eg_redoubts ADD COLUMN m TEXT;

-- EG-ZF (2026-10-12, Mac: "I said I want everything") - THE FIRST-TIME LINES ONCE AN ACCOUNT (bible/11-Multiplayer/
-- Elite-Gates.md section 27.7: "First-time lines, once an account (service bits, EG_TEXT_FIRST)"). `eg_first` holds the
-- lines the account has been shown, a bit a line in src/ui/egBeats.js EG_FIRST_KEYS' order (the Rehearsal's after them),
-- OR'ed by `/v1/eg/first` as a client shows one and answered on `/v1/eg/keys` (server-account/src/eg.js egFirstSay) - a
-- new device says none of them again.
ALTER TABLE players ADD COLUMN eg_first INTEGER NOT NULL DEFAULT 0;

-- EG-ZM (2026-10-12) - THE STAKE'S CLOCK (bible/11-Multiplayer/Elite-Gates.md section 23, "The clock"). A stake no receipt
-- ever settled is spent by the service's hourly clock once nothing can name it (server-account/src/eg.js
-- spendLapsedStakes, EG_STAKE_CLOCK_S past its `until`), its opener's letter written with it; the clock asks the held
-- stakes by their end, oldest first, by this index - never a walk of every stake ever staked.
CREATE INDEX IF NOT EXISTS idx_eg_stakes_held ON eg_stakes (state, until);

-- AUDIT EG V (2026-10-15; bible/11-Multiplayer/Elite-Gates.md sections 16.3, 19 and 20) - WHAT AN END'S CLAIM KEEPS.
--   eg_runs.nonce  the claim that wrote the end's row (the service's own draw): its Reliquaries roll on the receipt's seed
--                  mixed with it (src/net/egPay.js egSpoilsSeed), answered with the claim - no page reads them before
--   eg_runs.wgs    the Wager's decrees (their numbers joined by commas, '' none - eg_stakes.wg's form): the Depths' row
--                  names them (server-account/src/egHonours.js egBoardOf)
-- THE RELIQUARIES OPENED: one row an (account, arena week, circle) - the end whose claim first opened that circle's
-- Reliquaries that week (`b`); no other end of the account's opens them that week (server-account/src/egEconomy.js
-- egReliquariesOf).
ALTER TABLE eg_runs ADD COLUMN nonce TEXT;
ALTER TABLE eg_runs ADD COLUMN wgs TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS eg_reliqs (
  account TEXT NOT NULL,
  wk      INTEGER NOT NULL,
  w       INTEGER NOT NULL,
  b       TEXT NOT NULL,
  PRIMARY KEY (account, wk, w),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_eg_reliqs_b ON eg_reliqs (account, b);
