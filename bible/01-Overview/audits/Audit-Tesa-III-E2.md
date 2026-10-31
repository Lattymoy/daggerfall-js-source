# AUDIT TESA III, lane E2 (2026-10-26) - the systems, the wire, the UI and the servers past the Bay, read cold

The owner, of TESA (the land past the Iliac Bay - the provinces as regions 62..70, the gate lanes, Cyrodiil's open zone and
its halls, the provinces' resources, the ports and sea lanes, the quest world, quick save; branch `ccr-f9503f62-d9h2m1` at
8df5233181): **"Comprehensive audit on everything to ensure perfection"**. This page is lane E2's: the branch's changes
against main's merge base (b5faf20db9) in `src/systems/`, `src/net/`, `src/ui/`, `server/`, `server-account/` and
`locales/`, with their tests and records - the newest commit (GRANT-SLEEP and PROVINCE-SLEEP) among them. Lane E1 read
`src/world`, `src/scenes`, `src/render`, `src/formats` and `src/characters` beside it. What a finding changed is written
into the pages it touched and in the code beside the fix, marked `AUDIT TESA III E2-<n>`.

## How it was run

A cold read of the lane's diff (209 files, 16,413 lines in), the earlier audits read first so their verified findings
were not repeated - AUDIT TESA, AUDIT TESA II (lanes C, G, K, M, P, R, Z, marked in the code and the pages beside each
fix), AUDIT TESA-BIOME (`Audit-Tesa-Biome.md`), AUDIT WW (`03-World/World-Wide.md`), AUDIT STARTS (`Audit-Starts.md`) and
AUDIT DOMAINS - and their recorded fixes run on this head: `audittesa2z_worldwide`, `audittesa2p_laws`, `audittesa2g_jungle`,
`audittesa2z_zone`, `auditww`, `ww2_gates`, `wwr_regions`, `wwc1_ground`, `ww7_books`, `ww7_castles`, `ww7_seats`, the
grant suites and `sleepcost` (with ARENA2, `ARENA2_PATH=/home/claude/dfdata/arena2`): every one green. Each finding below
was reproduced on the branch's head before its fix - over real Rooms (`test/fakeRoom.mjs`, whose `wake()` is what a
hibernation wakes into), the account service over `node:sqlite` (`test/accountDb.mjs`), the locales' own parser and
tools, and main's tree read from `origin/main` (72bc053fc3) for the collisions.

## The findings

| Id | Sev | Finding | Status |
|---|---|---|---|
| E2-1 | MED | GRANT-SLEEP took the timer that held a quiet cell awake, and the grant gate lived in memory alone: ten silent seconds and a hibernation gave every account full buckets and the cell an empty ceiling | FIXED and pinned |
| E2-2 | LOW | WW7-4's castles past the Bay named for their province ("Castle Skyrim", its door "in Sumurset Isle"), and the Guild window's line and `castle-none` still said only Daggerfall, Wayrest and Sentinel keep one | FIXED and pinned |
| E2-3 | MED | The branch's versions collide with main's deployed and taken ones: relay world260 (main's live THE FOLD) to world263, account acct189 to acct192, migrations 0174 and 0175; GRANT-SLEEP and PROVINCE-SLEEP overlap main's HIBERNATE and COST-1 | RECORDED (the merge's renumbering) |
| E2-4 | LOW | DOMAIN2's castle gate (`GUILD_INSTANCE_RELAY_MIN`) was a free literal beside a literal pin, so the merge's renumber would leave it on 260 - on the live relay, THE FOLD, with no guild arm | FIXED and pinned (the gate held to its LAW row) |
| E2-5 | MED | The hub's halls record takes any world pixel as a hall and writes the whole record at each word: one signed-in socket grows it 69 bytes a word at two words a second, past Durable Object storage's 2 MB value in about four hours | FIXED and pinned (2026-10-26, the owner: "Take care of exclusions and gaps") - predates the branch (a Bay pixel's key did the same) |

### E2-1 - a cell's grant gate outlives its sleep (FIXED)

`server/src/index.js:"const G = await this._grantGateLoad"`, `src/net/grantLaw.js:"export function grantGateKept"`. GRANT-SLEEP (`11-Multiplayer/Spawn-Grants.md` section 22)
removed the ten-minute `setTimeout` a cell's grant measure armed at its window's first fold, so nothing pending keeps a
cell from hibernating - as its bill wanted. But a cell's gate (`_grantState`: the counter, each account's bucket per kind,
the live grants that count against GRANT_CELL_CEILING, the sockets that stood on a grant) lived in the object's memory
alone, and hibernation builds a fresh object. Before, the timer held the cell awake ten minutes past a window's first
fold - a grant's own life (GRANT_TTL_MS) and every bucket's refill but `kept`'s - so a sleep could forget nothing that
still bound. After it, a client that holds its frames back for the runtime's idle span finds every bucket full and the
ceiling empty. Reproduced on 8df5233181: a Greater Giant's third call refused `bucket`, the cell woken (`wake()`), the
same ask `ok`; 170 granted members live, 1 counted after the wake, and the same account minted another 168 on top of
them (the 192 ceiling held 339, every grant signed and unexpired); no timer armed throughout. The measure GRANT5 reads to set the rates under-counted with
it (what enforcing would have refused, read off buckets a sleep had refilled). Main's HIBERNATE (world263) made the same
change to the window and keeps the same gate in memory alone: the gap is main's relay's too, and the merge carries this
fix into it.

The fix keeps the gate in the cell's storage: `grantGateKept` (pure) packs the counter, the buckets that still bind (an
idle one is a first ask's, full), the live grants with their bodies and handed members, and the askers; `_grantGateKeep`
writes it after every ask that can move it, or lets its key go once nothing binds; `_grantGateLoad` reads it once an
instance life (its promise shared, the strip's first frame after a wake kicking it), and lays it on the cell's grants
(`grantGateOf` passes over anything malformed and lets an expired grant go). Still no timer, and a write leaves nothing
pending. Its cost: one storage row written an ask (asks are bounded per socket by `grantGate`), a value of a few hundred
bytes to some 50 KB at the ceiling, and a key left in a cell no one returns to (a stale one is let go at the next read):
at most one a cell. The measure's window stays a sample in memory.

### E2-2 - a castle past the Bay is its capital's (FIXED)

`src/ui/socialPanel.js:"const city = castleCityOf(c.region)"`, `src/net/castleLaw.js:"export const castleCityOf"`. The Guild window named a castle `REGION_NAMES[region]` - the Bay's
three crowns' regions bear their cities' names, a province's does not - so WW7-4's castles read "Castle Skyrim", "choose it
at the castle's door in Skyrim", "Castle Sumurset Isle" (Arena's spelling of the province), where the door stands in
Solitude and Alinor. Its line for a guild with neither castle nor offer, and the service's `castle-none` (`accountClient.js`
REFUSAL_WORDS), still said only Daggerfall, Wayrest and Sentinel keep one. `castleCityOf` names a castle's city off its
crown's seat (`kingdomLaw.js` kingdomSeatName - the Bay's three as they were, Solitude, Mournhold, Alinor, Falinesti,
Torval, Helstrom), and the two lines name a province's capital, the Imperial City's excepted (its halls stand open to all,
WW7-4). The two English lines moved; their thirteen whole languages' rows were drafted again in session
(`tools/l10nInSession.mjs`, recorded as the machine's), the partial languages owing them as they owe every new row.

### E2-3 - the versions collide with main's (RECORDED)

`src/net/wire.js:"export const RELAY_VERSION ="`, `src/net/wire.js:"export const WORLD_WIDE_RELAY_MIN"`, `server-account/src/service.js:"export const ACCOUNT_VERSION"`. Main has deployed its own relay
`world260` (THE FOLD, #1280 - COST-1, WILD-REJOIN, COST-2) and taken `world261` (EVENT-RULES, BOSS-TRAITS, RAID5),
`world262` and `world263` (HIBERNATE); its account service stands at `acct192` past acct189-acct191; its migrations
`0174_broker_sales.sql` and `0175_yard_town.sql` share this branch's numbers (`0174_seat_gifts`, `0175_guild_castles`;
`0176_domain_witness` and `0177_world_books` would sort after them but are owed the renumber too, `0176`-`0179`). So
today `relaySupportsWorldWide('world260')` and `relaySupportsGuildInstances('world260')` answer yes for a live relay that
reads nothing past the Bay and admits no guild: a page of this branch on main's relay would send it lane sites, province
channel keys, Cyrodiil's hall keys, grants past the Bay and castle doors it closes sockets on. The merge with main
renumbers them, as the branch has at every merge (the world-wide gates move with their LAW row, AUDIT TESA II Z2, and
E2-4 ties the castle's): not changed here (the lane was told not to). Two composings for that merge: GRANT-SLEEP beside
main's HIBERNATE (both post the grant window on the next fold or at the drain - keep one, and E2-1's kept gate with it),
and PROVINCE-SLEEP's `REGION_SPLIT` beside main's COST-1 (a region whole unless the relay's REGION_SHARDS names it).
`audittesa2z_worldwide`'s "the row before it" (259) fails at that merge by design.

### E2-4 - the castle's relay gate held to its row (FIXED)

`src/net/instanceRoom.js:"export const GUILD_INSTANCE_RELAY_MIN"`. AUDIT TESA II Z2 made the world-wide relay's four gates one number held to the LAW row that
names WORLD-WIDE, so a merge's renumber moves them. DOMAIN2 shipped in the same relay, and its gate stayed a literal
`260`, pinned by a literal (`domain2_castles.test.js`): a renumber written as the branch writes them (the rows' keys, the
`world<N>` strings) moves neither, and leaves the castle offered to main's world260 to world263, which refuse its members.
The pin now reads the one LAW row that names DOMAIN2 and holds the gate to it (PIN MOVED); a renumbered row fails it until
the gate moves.

### E2-5 - the halls record a socket can fill (FIXED)

`src/net/wild/wildLaw.js:"export function wdunEnter"`, `server/src/index.js:"const h = wdunHall"`. A hub's `wdun` `in` word names any world map pixel as a hall
(`wire.js` wdunHall - since WW-C2 the world's grid, before it any Bay pixel), each is kept in the halls record (`inside`,
then `empty` a day, `eps` two days), and every `in` writes the whole record (`_wdunSave(now, true)`). Measured over a real
hub: 1,000 words of one socket at its WDUN_HZ_MAX - 69 bytes a hall, 1,640 writes of the record. At two words a second
that is about 2 MB in four hours - Durable Object storage's limit on one value - after which the record's write fails and
every player's locks, crows, giants and fleets stand in memory alone; well before it, each word re-writes and re-reads a
record of megabytes on the one hub every player is on. The bucket is a socket's, so an account's tabs add theirs. It
predates TESA (a Bay pixel's key took 500,000 values, past a socket's day of words), so it is recorded here, not fixed.
Proposed for the relay's next change: bound the halls the record keeps (the zone stands some 840 a day; `wdunBound`
holds the accounts' locks alone) without letting a churn of made-up halls push a real hall's epoch out (an epoch lost is
its chests refilled); count an account's `in` words across its sockets; and write the record at most every WDUN_HERE_MS
as a heartbeat already is.

**FIXED** (2026-10-26, the coordinator's E2-5 item; the owner, the same day: "Take care of exclusions and gaps").
Reproduced first over the real hub (`fakeRooms`): one signed-in socket, 1,000 words at WDUN_HZ_MAX alternating `in`
and `out` over made-up halls - 1,000 writes of the record, 500 halls in each of the epochs, the empties and the locks
(47 KB after 500 s, growing without end). After: 50 writes, 64 halls, 32 locks (5 KB), every `in` answered.
- **An account stands in one hall** (`src/net/wild/wildLaw.js:"export function wdunEnter"`): going into a hall leaves
  any other the record still held it in, which counts empty from then - a crash or a lost `out` no longer keeps a body
  in two halls, and the halls one account stands in are one, never one a word. And it is ONE BODY (`wdunDie`): its way
  back is its last remains alone (`piles` held one already), so a death in another hall takes the crows over the hall
  of the remains before, unless another's lie there - a `die` word in hall after hall kept a crow over each, told to
  everyone online (the game reads 128 of them).
- **An account brings at most WDUN_NEW_HALLS_MAX (64) halls into the record a day**
  (`server/src/index.js:"const meter = (m.k === 'in' || m.k === 'die') && wdunNewHall(st, h)"`, the hub's meter by
  account, in memory, `wdunMeterOf`): a hall the record holds nothing of, past the count, is answered as a fresh hall's
  (`ok`, epoch 0) and nothing is kept - so a churn of made-up halls cannot push a real hall's epoch out (one another has
  stood in is held, and does not count). The zone stands some 840 halls a day and a hall takes minutes: 64 new halls is
  more than one player's day.
- **Every map to its count** (`src/net/wild/wildLaw.js:"export function wdunBound"`), the least recently touched
  or soonest-ending let go first: the halls (WDUN_HALLS_MAX, 2,048, each of `inside`, `empty`, `eps`, `crows`), the
  accounts standing in halls (WDUN_INSIDE_MAX, 4,096), an account's locks (WDUN_ACCT_LOCKS_MAX, 32), all locks
  (WDUN_LOCKS_MAX, 8,192), the accounts with locks (WDUN_ACCTS_MAX, as before) and the remains (WDUN_PILES_MAX, 4,096).
  With every count full and the widest keys (a 40-character account, an 11-character pixel) the record is 1.42 MB -
  under WDUN_RECORD_BYTES_MAX (1.5 MB) and storage's 2 MB value (pinned).
- **Written at most each WDUN_SAVE_MS (10 s), never once a word**
  (`server/src/index.js:"async _wdunSave(now, force = false) {"`): a word that moved the record inside the window leaves
  it owed, written by the next word past it or by the hub's drain (`_wdunFlush`); a heartbeat's at most each
  WDUN_HERE_MS as before. No timer (R4-1's census unchanged). What a restart inside the window loses is at most ten
  seconds of the halls' words - the record was never a ledger of value.
- **An account's words one bucket** (`_wdunAcctPass`, before each socket's own): the hub seats one socket an account
  (ONE-SEAT), so the gap was a reconnect's fresh bucket - ten sockets one after another, ten words each at once, were
  each heard at a socket's full burst; now at the account's one burst and rate (pinned).
Relay `world269` re-hashed in place (below).

## Findings in other streams' files (not edited; for routing)

- **Travel View pathfinding** (`src/systems/travel/travelRoute.js`, the travel stream's): the route ground's memo of the
  ground past the table (`routeGround`'s `dryBeyond`, cleared only past BEYOND_CACHE_MAX) and the sea lanes' kept water and
  joins (`_laneGround`, keyed by the ground's `isWater` for the session) are never told the land moved - and the host keeps
  one ground a session (`scenes/world.js` tvRouteGround, made again only when the zone comes or goes), while the land past
  the Bay moves with the trace's landing and the relief's (`tamrielLand.js` tamrielLandVersion). NOT REPRODUCED: it needs
  the running game to plan a route past the Bay before the relief lands. Proposed: key both memos by the land's version
  (and the relief's), or have the host make its ground again when the version moves. FIXED by AUDIT RELEASE R1-2
  (`01-Overview/audits/Audit-Release-R1.md`): reproduced on the module, both memos keyed by the land's version and the fit.

## Pins and mutants

`test/net/audittesa3e2_grantgate.test.js` (4: the gate's law, the bucket and the ceiling across a wake with no timer, a
renewal and the strip after a wake, the storage it costs); `test/net/audittesa3e2_castles.test.js` (2: the castle's
city, the window's and the service's words). PIN MOVED (AUDIT TESA III E2-4): `test/net/domain2_castles.test.js` (the
castle's relay gate held to the LAW row that names DOMAIN2). Mutants `tools/mutants/audittesa3e2.json` (20, all dead).
E2-5: `test/net/audittesa3e2_halls.test.js` (7: one hall and one body an account, every map to its count and the meters, the counts,
the widest full record's bytes, a socket's thousand words over made-up halls, the owed write and the drain, an account's
sockets one bucket); `tools/mutants/audittesa3e2_halls.json` (27, all dead).

## Versions

Relay `world260` re-hashed in place, undeployed (its row in `test/net/relayversion.test.js` says the bytes before it):
E2-1 is a relay law. No frame and no client change; the account service is unchanged (acct189 stands); no migration.
E2-5 is a relay law too: re-hashed in place on the branch's world260 row, then - after the second merge with main made
the release `world269` (`Audit-Release-R3.md` "The versions") - on `world269`'s row, its bytes before it in the row's note.

## What this lane could not check

The deployed bill (Cloudflare's GraphQL) and real hibernation timing - the fix is measured over the harness's `wake()`;
the running game past the Bay (the travel memo above); main's relay at world263 run with this fix composed in (the
merge's).
