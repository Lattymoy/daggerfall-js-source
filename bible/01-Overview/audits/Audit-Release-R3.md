# AUDIT RELEASE R3 (2026-10-26) - release mechanics: the merge with main, the versions, the relay's cost work, the deploy order

The owner (Mac, 2026-10-26): **"I want to do a comprehensive audit to ensure everything is perfect and that everything is
covered for a smooth release that expands our world seamlessly. All systems should be integrated precisely"**. This page
is lane R3's: TESA (branch `ccr-f9503f62-d9h2m1` - the land past the Iliac Bay) had diverged from main since the merge
base b5faf20db9, and a merge with main is the release's last step. Two more streams (the Imperial City, coast and border
smoothing) land on the branch after this lane, so the real merge is done again at the end: this page is the plan, the
proof (a trial merge, committed on a local branch), and the rules that make the redo mechanical.

## How it was run

The branch head 367cf11766 (then ad2a8d71de, SMOOTH-LAND, merged on top) and `origin/main` a981d29c84 (405 commits past
the merge base). `git merge origin/main` in a worktree, every conflict resolved and recorded, then the gates on the merged
tree: `npm run lint` (the whole tree), `npm run types`, the bible's gates and the ratchets, and the tests the merge's own
resolutions move. `npm run test:changed --base ad2a8d71de` names 3,987 of 4,143 files - most of the suite, so per
CLAUDE.md the merge's own test files were run and the rest left to CI's `verify`. ARENA2 at
`/home/claude/dfdata/arena2` (`ARENA2_PATH`).

## Merging main

142 files conflicted in the trial (one more, Port-Ledger.md, merging SMOOTH-LAND on top). They fall into nine kinds;
each kind has one rule, and the rules marked TOOL are `tools/mergeMain.mjs`'s (pinned by `test/tooling/mergemain.test.js`,
`tools/mutants/mergemain.json`). The redo is the recipe at the end of this section.

### The rules

| Kind | Files (trial) | Why they conflict | Rule |
|---|---|---|---|
| **V1 the version line** (TOOL) | `src/net/wire.js` RELAY_VERSION, `server-account/src/service.js` ACCOUNT_VERSION, `server-account/wrangler.toml` | both sides wrote the next version over the same base line | the branch's release takes **main's newest + 1** (world266, acct194); its declaration keeps its own notes, `(world260,` moved to `(world266,`; main's line becomes a comment and its notes follow; a note both sides carry kept once. Never relabel a deployed row. |
| **V2 a version pin** (TOOL) | 63 test files (`assert.equal(RELAY_VERSION, ...)`, `ACCOUNT_VERSION`, the toml regexes) and the mutant records' `"old"` lines | each side's PIN MOVED history prepended its own clause | main's line, its asserted version moved to the new number, the branch's own clause first in the history with `(world260 on its branch, renumbered past world260-world265 on main at the merge; ...)`. No apostrophe in the note: it lands inside single-quoted strings. |
| **V3 the relay's LAW row** | `test/net/relayversion.test.js` | both appended rows | main's rows as they stand; a new row `world266` for the branch's release whose hash is **printed by the pin** (`<new version>: '...'`), never typed; the branch's old row kept as `// Unpublished TESA branch used world260 / <hash> before the merge ... renumbered it world266`. The hash moves with every later change to the relay's bundle - re-read it last. |
| **V4 a gate on the release's number** | `src/net/wire.js` WORLD_WIDE_RELAY_MIN, `src/net/instanceRoom.js` GUILD_INSTANCE_RELAY_MIN (no conflict - git merges them silently) | the branch's gates name its own row's number, which main has now used for another relay | moved to the new row (266) with the row, and their mutants' `old`/`new` (`audittesa2z.json`, `audittesa3e2.json`, `domain2.json`). `test/net/domain2_castles.test.js` and `test/net/audittesa2z_worldwide.test.js` read the gate off the LAW row that names DOMAIN2 / WORLD-WIDE, so a missed one is red. **R3-1.** |
| **V5 migrations** | `server-account/migrations/0174-0177` (no conflict - two files share a number) | main took 0174 (`broker_sales`) and 0175 (`yard_town`) | `git mv` the branch's past main's newest, in reverse order: 0177 -> 0179, 0176 -> 0178, 0175 -> 0177, 0174 -> 0176; then every reference (`test/server/ww7_books.test.js`, `tools/mutants/ww7.json`, `03-World/World-Wide.md`, `11-Multiplayer/Domains.md`). The account tables pin (`test/server/accountworker.test.js`) is both lists unioned and sorted. D1's `d1_migrations` ledger is keyed by file name: an undeployed migration may be renamed, a deployed one never. |
| **I one-line imports** (TOOL) | `server/src/index.js` (3), `src/net/online.js`, `src/net/gate/gateLaw.js`, `src/net/grantLaw.js`, `src/net/staffTeleport.js`, `src/scenes/instanceDoor.js`, `src/ui/hud/statusTips.js`, `test/systems/realm0.test.js` | each side imported a name the other did not | each module's names unioned (main's order, the branch's extras after), a module either side added kept, both notes. **Then** drop the names the merged file no longer uses (eslint says which): in `src/scenes/world.js` the branch moved `WEAPON_REACH`, `sayRealmSave`, `createGateOmen`, `createMiasma`/`miasmaReach`, and main moved `mergeWeaponPose`, `addBonusMagicLoot`/`upgradeLoot`, into modules of their own. |
| **N a line number both sides moved** (TOOL) | `handoffs/Port-Status-2026-09-02.md` (25 hunks), `audits/Bible-Review-2026-08-25.md`, `09-Testing/Testing-Rows-2026-10-19.md`, `test/scenes/citedrift.test.js`, `test/tooling/faceuvresidue.test.js`, `test/tooling/probehygiene.test.js`, `src/systems/passiveSpecials.js`, `tools/parity/prepare.sh` | a `Port-Ledger.md:872`-style pointer, each side moved by the rows it wrote above it | with the diff3 base (`git checkout --conflict=diff3 -- <file>`): **ours + theirs - base**, number by number, where the three are one text but their numbers - correct because the Ledger itself is merged by union (D). A section-A tally (`**335 rows ... - 320 standing`) is the same arithmetic. |
| **L the languages** (TOOL `--locales`) | `locales/*/Port_Strings.csv` and `.meta.json` (27) | each side added keys | after every source conflict: `node tools/l10nExtract.mjs` writes the catalog off the merged source; each other language merged three ways from the index's stages (a key added either side kept, one deleted where the other left it gone, main's where both changed one), in the catalog's order - what `tools/l10nInSession.mjs` writes. |
| **D a doc row either side added** | `Active-Arcs.md`, `Page-Index.md`, `Host-Split.md`, `Port-Ledger.md`, `11-Multiplayer/Scale-Arc.md`, `Wild-Zone.md`, `Professions-Arc.md` | both appended rows at the same foot | union, the branch's rows first; a row one side edited and the other left as the base had it is the editing side's. |
| **M measured, never typed** | `test/scenes/hostceiling.test.js`, `test/systems/l10n4_hardcoded.test.js`, `06-Systems/Systems.md` and `10-UI/UI.md` module counts, `test/net/auditattach.test.js` | both sides moved a count | the number read off the merged tree: `logicalLines(findHostFunction(...))` from `tools/hostScope.mjs` (bootWorld **35,895**, createWorldModes **11,025**), the l10n4 failure's `actual` (world.js 325, oreMapTip.js 2), `readdirSync(dir, { recursive: true })` `.js` count (826, 422), the attachment test's printed bytes (1206, 1261). The hostsplit mutant's `old` moves with the ceiling. |
| **R mutant records' notes** | `tools/mutants/{bal9,br5,crafthold,fb1004d_knight_house,gatekeys,hackedgold,nameas,soc1,tech1,wb14g,hostsplit}.json` | both re-aimed the same record | main's note, `Re-aimed by content (TESA x MAIN, ...)` said first; `scale2b.json`'s drain record is main's (`flushAtDrain`). |
| **H by hand** | listed below | both sides changed one behaviour | composed - each side's guarantee kept, its pin passing. |

### The hand compositions (the trial's; re-check each against the streams that land after it)

- **`server/src/index.js`** - the grant window: the branch's `if (... || grantMeasureDue(G.w, now)) void this._grantFlush();`
  at all three folds (GRANT-SLEEP's law, `net/grantMeasure.js`), main's `_grantDue` dropped (it was the same law written
  twice); the drain is main's `void flushAtDrain(this)` with main's `_sweep(a.key)`, and the branch's `_grantDrained` is
  gone (COST-1's drain posts the grant window by its rows - `server/src/drainWindows.js`). The hello attachment: the
  branch's line with main's `sc: m.secret` (HIBERNATE). The gate's fall: `const lane = gateLaneOf(fell.d)` (WW2) and `if
  (!court) { ...set(lane...); put(gateLaneKey('gatefell', lane)...) }` (GATE-COURTS); the receipts keyed by lane with
  main's rite flag; the herald's `owe` with main's `w`/`cs` on the lane's state; the herald's post with main's fields
  through the branch's `siteRec`.
- **`src/net/hubShards.js`** - main's `regionsSharded`/`shardOf(bus, sub, sharded)`, with the branch's REGION_SPLIT line
  kept in `shardOf` and `regionsSharded` bounded by REGION_SPLIT, not REGION_CHANNELS (71 on the merged tree). **R3-3.**
- **`src/scenes/world.js`** - main's GROUND-AGREE and court-fell imports beside the branch's gate lanes; main's
  `ohLootUpgrades` (scenes/ohLootHost.js) beside the branch's `createOceanHolesPits` (scenes/oceanHolesPits.js - main did
  not change the pits since the base, checked); `onFell` the branch's lane site and card id with main's court line.
- **`src/scenes/pixelBuild.js`** - the branch's `capitalBuildView`/`farView`, then main's `groundLocation`; the terrain job
  on `groundLocation` (main) with the branch's `flattenAt`, graht, town ground and Arena roads; main's `sight` on the
  branch's `isSolidModel` add.
- **`src/systems/instancePlaces.js`** - main's order (the party's rooms before mine) under the branch's nine-key bound,
  with my own row's key reserved. **R3-4.**
- **`src/ui/oreMapTip.js`** - main's DEEP-OPEN card and its words through `t()`, with the branch's WW-C1 lines (a
  province's richness, Cyrodiil's line, the province's own table) in English as they were.
- **`src/net/staffTeleport.js`** - the branch's `gatePixelOk` (a gate past the Bay) and main's court number.
- **`src/scenes/soundscapeHost.js`** and its test - the branch's `townAt` with main's `rand`.
- **`test/net/grant3_asks.test.js`** the branch's; **`test/systems/disc7.test.js`** main's list with world266;
  **`test/systems/portal1_stone.test.js`** the branch's `destOf` and main's RAID5 word; **`test/ui/gate/gateux_gate.test.js`**
  main's court tell and the version pin; **`test/server/auditscale2_acct.test.js`** the new history line above main's five.
- **The Ledger's ENGINE-PRNG roster** - main's row, with the branch's `src/scenes/questWorld.js` added and the count read
  again (53); `test/scenes/citedrift.test.js` CD1 names what is missing.

### The redo, step by step

```
git fetch origin main <branch> && git merge origin/main                 # on the branch's head
node tools/mergeMain.mjs --apply                                        # V1, V2, I (and N where the hunk is diff3)
git checkout --conflict=diff3 -- bible/ test/scenes/citedrift.test.js test/tooling/faceuvresidue.test.js test/tooling/probehygiene.test.js src/systems/passiveSpecials.js tools/parity/prepare.sh
node tools/mergeMain.mjs --apply                                        # N on the diff3 hunks
# by hand: the H list above; D; R; then V3 (the LAW row), V4 (the gates), V5 (git mv the migrations)
node tools/mergeMain.mjs --locales --apply                              # L, once the source resolves
node tools/mergeMain.mjs --sweep --apply                                # pins outside the conflicts still on an old version (without --apply: listed only)
# M: measure, then write; then the relay's hash last (it moves with any bundle file)
npm run lint && npm run types && node --test test/bible/*.test.js test/tooling/citeanchor.test.js test/tooling/mutantdrift.test.js test/scenes/citedrift.test.js test/systems/ledger.test.js
```

If main has moved past a981d29c84, its own new versions push the branch's number again: the tool reads main's newest
off `MERGE_HEAD` and the rules are unchanged.

**What the trial learned beyond the conflicts** - a clean merge is not a working one. Four things git merged silently
and the gates caught, each now a rule for the redo:

- `npm run types` is the only gate that sees a name one side stopped exporting and the other side's new module imports
  (R3-7). Run it before anything else after the conflicts resolve.
- `test/tooling/mutantdrift.test.js` (QS6 F7) names every mutant record whose `old` the composition rewrote: re-aim each
  by content onto the merged line (the trial: `audit_domains` C4, `auditww` F5, `fb1011_oremap` ORE-MAP-a, `wipereturn`).
- `test/bible/audit18_bible_docs.test.js` (AUDIT 39): a new audit page is named in `Page-Index.md`.
- A merged test whose expected count is the branch's law and main's (the chat rooms: `test/net/chatchan.test.js`,
  `62 * 4` - the Bay's shard keys stay rooms under COST-1 so an older build can be told its channel).
- Imports keep main's order of modules, the branch's extra modules after (the tool's I rule does; a hand union put
  `grantLaw.js`'s `./wire.js` before main's `./cellTree.js`): `test/net/grant1_law.test.js` pins the order, and the
  relay's bundle hash walks the imports in it.
- A version pin written as a regex literal (`assert.match(ACCOUNT_VERSION, /^acct193$/ ...)`: the prof9, prof10 and
  prof12 service pins) - the tool's V2 rule reads that spelling now.
- `test/tooling/citeanchor.test.js` (CA1) reads every `wire.js` anchor as ambiguous while the index still holds the
  file's three conflict stages: run it after `git add`, never before.
- `npm run build` links every module the page loads - the check, beside `npm run types`, that a name one side removed is
  not imported by the other's (R3-7's kind). Run it on the merged tree before the merge commit.
- A pin that named main's newest relay as a literal (`test/net/audittesa2z_worldwide.test.js`, "the row before it", 259)
  fails at every merge that passes a new main row: it reads `WORLD_WIDE_RELAY_MIN - 1` now (PIN MOVED), so the redo
  finds nothing to move. The mutation run says so first - its baseline refuses a record whose tests fail unmutated.

**The redo, tried** - the branch moved twice after the trial (SMOOTH-LAND, ad2a8d71de; AUDIT RELEASE R2 and R4 with
chatchan's count, d80b5c9d23) and each was merged into the trial: three conflicts in all, each by a rule above -
Port-Ledger section A's foot (D: the row SMOOTH-LAND edited is its, each side's new rows kept), `staffTeleport.js`'s
import (I: R2's `worldPixelOk` beside main's court count - the tool's note rule widened so a note one side only
lengthened is kept once), and the LAW row (V3: R2 re-hashed TESA's world260 in place; the merged world266 takes its note,
the unpublished line its hash, and the pin's hash again). The branch-side fix (R3-2) is a commit on the branch head,
before the merge.

**The merge of main into #1184, 2026-10-27** (BOW-TOPS' world269, WOVEN-PAYS' acct196 and migration 0177, PACK-PICK,
INTRO4, STE-NOTES): 201 hunks. The tool took the account pins, the line numbers and the imports (V2, N, I). Two places
it does not reach, both done by hand: (1) the branch's relay was already past main's newest (world270 against world269),
so the pins keep world270, and `mergePinLine`'s note would have read "renumbered past world270-world269" and dropped
the branch's second clause - each pin took both of the branch's clauses, PVP-EASE's and the TESA fold's, both world270
now, before main's BOW-TOPS clause; (2) a mutant record whose `old` names the account version both sides held
(`'acct196'`, nine records) never conflicts and the sweep reads only `test/`, so those records' `old` were moved to
acct197 by hand, with the V4 gates' records (`audittesa2z.json`, `audittesa3e2.json`, `domain2.json`,
`release_r3.json`). Both sides had fixed BAL-ARCHERY's referees and shaft fixtures (ARCHERY-REF on the branch, BOW-TOPS
on main) with the same values; the fixtures are main's, the notes both (`05-Combat/Balance-Arc.md`). INTRO4's film
keeps the city it was shot on as its own set (`10-UI/UI-Arc.md` INTRO4, THE SET).

## The versions

- **Relay world266** in the trial (TESA with WORLD-WIDE folded in, world260 on the branch), past main's world260 THE
  FOLD, world261 EVENT-RULES, world263 HIBERNATE, world264 REWARD-KILLS and world265 GATE-COURTS. Its row is the merged
  bundle's hash. **Main moved on while the trial ran** (284f59cefa, 2026-10-26): world266 AUDIT KETCH II (#1306) and
  world267 KETCH-WORDS (#1308) - so the real merge numbers TESA **world268**, and WORLD_WIDE_RELAY_MIN and
  GUILD_INSTANCE_RELAY_MIN 268 with it (the tool reads main's newest off `MERGE_HEAD`). Main's account version
  (acct193) and migrations (0175) did not move: acct194 and 0176-0179 stand.
- **The real merge** (local branch `r3-release`, 2026-10-26): the branch head 4359d3fed0 (IC-GRAND, AUDIT RELEASE R1,
  R2, R4, ROAD-BEYOND, PEAKS1, R3-2 cherry-picked) merged with main bf0726620b - TESA **world268**, acct194, migrations
  0176-0179. Done in two steps folded into one merge commit: the trial merged into the branch head (its resolutions
  replayed: three conflicts - the Page-Index foot (D), `pixelBuild.js`'s IC-GRAND block pre-read beside GROUND-AGREE's
  ground (H), `sleepcost.test.js`'s R3-2 note naming COST-1's drain) and then main's commits since the trial's a981d29c84 on top (49
  conflicts: 45 by the tool - V1, V2 - and four by rule: three doc feet (D), UI.md's module count (M, 423), and the LAW
  row - the trial's world266 moved to world268 past main's own world266 AUDIT KETCH II and world267 KETCH-WORDS, its
  hash the pin's). Beyond the conflicts: the gates' numbers 266 -> 268 (V4) and AUDIT RELEASE R4's timer census moved
  onto main's HIBERNATE (the staff panel's two timers gone: twelve sites, PIN MOVED; its two mutants re-aimed by
  content). On the merged tree: lint, types and `npm run build` exit 0; the bible's gates, the ratchets, hostceiling and
  relayversion green; the merge's own 213 test files in six chunks green but `staffpanel5bench` (a timing bench at a load
  of 20 on four cores - green alone).
- **The second merge** (`r3-release`, main 70d9210c41): NIRNROOT-SAGE (#1315) took world268 and acct194 on main, so
  TESA is **world269** and **acct195** (migrations 0176-0179 unmoved). 80 conflicts, the pins by the tool once its V2
  rule read one number both sides took as a renumber too; by hand the glyph vocabulary (main's sprig in its place, the
  province crowns after it - names travel by name, so the order is shape; the vocabulary pins composed), the instance
  door (main's QUEST-FIRST public row last, under the nine keys), the attachment widths measured (1221, 1276), and
  `server-account/wrangler.toml` - both sides had written `acct194`, so git took it silently: set it to the release's
  number by hand (rule V4 again). Lint, types, `npm run build` and the moved gates green. The chunk run then named
  `nirnrootsage` - main's new file, outside every conflict - still pinning world268 and its glyph last: the second merge's
  sweep (`--sweep --apply`, the redo's step after the locales) had not been run. Run late, it named that one pin; both moved (PIN MOVED, the
  glyph as its siblings compose it). The rest of the merge's own 105 test files, in three chunks with ARENA2, green (1,184
  tests); `release_r3` 9/9 and `mergemain` 13/13 mutants dead on it (one guard recorded equivalent).
- **To re-hash the release's row after a later relay change on the branch** (a slice that re-hashed the branch's
  world260 in place - E2-5 and R2-7, staff events past the Bay): on the merge, edit the one row
  `test/net/relayversion.test.js` names `world269` (never a row of main's), put its old hash in its "re-hashed in place,
  undeployed - bytes <old>... before it: <slice>" note, and paste the hash `node --test test/net/relayversion.test.js`
  prints as `<new version>`.
- **Account acct195** (acct189 on the branch; acct194 at the first merge), past main's acct189 DAEDRIC-SMELT + DEEP-OPEN to
  acct193 COPY-LIFT and acct194 NIRNROOT-SAGE.
- **Migrations 0176-0179** (`seat_gifts`, `guild_castles`, `domain_witness`, `world_books`), past main's 0174 and 0175.
  Checked: neither of main's touches the seven tables 0179 rebuilds (0174 creates `broker_sales`; 0175 has no DDL), so
  0179's "every column a later ALTER TABLE added kept" still holds.

## The relay's cost work, composed

Main's HIBERNATE (world263) and COST-1 (in THE FOLD, world260) and the branch's GRANT-SLEEP and PROVINCE-SLEEP answer the
same two bills, written apart:

- **A cell's grant window holds no timer.** Both sides removed GRANT2's ten-minute `setTimeout`. The merged code has one
  law (`grantMeasureDue`: the window holds anything and is GRANT_MEASURE_MS old), asked at every fold, and one drain
  (`flushAtDrain`, which posts the grant window by its rows, then the staff feeds' and the reviewer's, and clears what a
  failed post armed). `test/net/sleepcost.test.js` (no timer of a minute or more armed; the fold that finds it owed posts
  it; the drain posts what is left; an idle cell posts nothing) and `test/server/cost1_drain.test.js` both pass on it.
- **A region's channel sleeps.** Main made every region whole unless the relay's `REGION_SHARDS` var names it; the branch
  made the provinces past the Bay whole always. Composed: the var names the Bay's 62 at most (`all` is the Bay's 62, a
  province's number names nothing), and `shardOf` refuses a province whatever set it is handed. **R3-3** is the bug a plain
  union made: with REGION_CHANNELS 71, `REGION_SHARDS=all` sent a province's link to `chat:region.64.k`, which no Room
  opens (`isRegionShard` is the Bay's alone). Pins: `cost1_regions` (`regionsSharded('all').size === REGION_SPLIT`,
  `'61,62,70'` names 61 alone - PIN MOVED) and `sleepcost` (every region default-whole; `all` splits the Bay's; a set
  naming all 71 still leaves a province whole; the relay test under `REGION_SHARDS: 'all'` - PIN MOVED).

## The deploy order, and what each side sees meanwhile

From `.github/workflows` on a push to main:

1. **The account service's migrations** (`account-deploy.yml`, "Apply migrations" - after `verify`, BEFORE it waits on the
   relay). 0176-0178 add tables; 0179 rebuilds seven market and guild tables with the same columns and wider CHECKs
   (`region <= 70`). The old Worker (main's acct194, NIRNROOT-SAGE; acct193 before it) runs on the migrated database
   for as long as the next step waits, and it writes regions 0-61 alone, which the wider CHECKs admit: compatible. 0179 rebuilds tables on the live primary - read
   their row counts before the merge (`SELECT COUNT(*)` of `market_listings`, `market_orders`, `market_auctions`,
   `market_bids`, `guild_writs`, `guild_contracts`, `commissions`); the deploy records a time-travel bookmark first.
2. **The relay** (`relay-deploy.yml`, triggered by the version): waits out a live siege and the Spire's hold, deploys
   world269 (dropping every connected player), verifies `/health`.
3. **The account Worker** (`account-deploy.yml` "Wait for the relay to serve this push's version" - up to 5.5 h - then
   "Deploy"): acct195, so the service never signs what the live relay would refuse.
4. **The site** (`deploy.yml`: waits for `/v1/health` to serve acct195, then Pages).
5. **The desktop release** (`release-desktop.yml`): after `verify` only - it does NOT wait on the relay or the service.

During the rollout:

- **An old client in a new room** (a cached tab or an un-updated desktop on main's world268): every word it sends is one the
  merged relay still reads - the Bay's gate is lane 0, gate number = its day, so its room keys and receipts keep their
  shape; its region link is the channel (an old build that asks for a shard is told the channel, COST-1); it asks for no
  province channel, no lane, no hall of Cyrodiil.
- **A new client in an old room** (the desktop release ahead of the relay, step 5 before step 2): every world-wide arm is
  gated on the relay's `v` (`relaySupportsWorldWide`, `relaySupportsGuildInstances`), so on world260-268 the client stands
  the Bay alone. **R3-1**: before this merge those gates read 260 - THE FOLD's number - and opened the lanes, the provinces'
  channels, the halls, the grants past the Bay and the castle door against relays that know none of them.

**A save across the line.** A Bay-only character (the live build's) loads in this build: `restorePlayer` pads its 62
bank accounts and houses to the 71 regions (`banking.js padRegionTable` - `test/world/worldWide/wwr_regions.test.js`,
`test/systems/bankwindow.test.js`), its positions and region indices are the Bay's own (unchanged: the Bay is pixels
0-999 x 0-499 on both), its inventory and quests are the same shapes (`SAVE_VERSION` 1 on both). The reverse - a character
saved past the Bay, then opened by a build from before this release - was **not probed**: it needs main's build run
against the merged save, and the rollout above never hands one to the other except on a rollback.

## Gates and tests on the trial

On `r3-release-trial` (main a981d29c84, the branch through d80b5c9d23):

- `npm run lint` over the whole tree: clean (no finding needed a lint fix; eslint does not see R3-7).
- `npm run types`: one error, R3-7; clean after its fix.
- The bible's gates (`manifest`, `audit18_bible_docs`, `citeanchor`, `mutantdrift`, `citedrift`, `ledger`) and the
  ratchets (`audit24_onehome`, `l10n4_hardcoded`, `eglook_registry`, `la_cost`, `accountdeploy`, `doctrine`,
  `hostceiling`, `rel4_release`): green once this page was indexed (AUDIT 39) and four mutant records re-aimed (QS6 F7).
- The merge's own test files - every conflicted test, the gate, grant, hub and region-channel, instance-door, world-wide,
  migration, oreMapTip, soundscape and GROUND-AGREE suites, the gates above (212 files, with ARENA2): what failed is in
  the findings and the rules above (GRANT1's import order, the prof pins' regex literal, AUDIT TESA II Z2's literal,
  AUDIT WW F5's fall line), each fixed; the run in six chunks afterwards green.
- Mutants, all on the merged code with `--jobs 2`: `release_r3` 9/9 dead, `mergemain` 12/12 dead (one guard recorded
  equivalent), `sleepcost` 9/9, `cost1` 17/17, `wipereturn`, `fb1011_oremap`, `hostsplit`, `audit_domains` dead, and
  `auditww` and `audittesa2z` after AUDIT WW F5's pin moved. The branch-side R3-2 on the branch's own tree: `sleepcost`
  9/9 dead.
- A scan of every relative named import under `src/`, `server/src/` and `server-account/src/` against its module's
  exports (acorn): none broken but R3-7's (JSON default imports aside) - so no other module of one side imports a name
  the other side removed.

## Findings

| Id | Severity | Anchor | Finding | Status |
|---|---|---|---|---|
| R3-1 | High | `src/net/wire.js:"export const WORLD_WIDE_RELAY_MIN = "`, `src/net/instanceRoom.js:"export const GUILD_INSTANCE_RELAY_MIN = "` | The branch's world-wide and castle gates named world260, which main deployed as THE FOLD: a new client on any of main's world260-268 would open lanes, province channels, halls, grants past the Bay and the castle door against relays that know none of them. git merges these lines silently. | Fixed in the merge (266 in the trial, 269 at the second merge - a gate names the release's own row); pins `audittesa2z_worldwide`, `domain2_castles`; `tools/mutants/release_r3.json` R3-1-*. |
| R3-2 | Medium | `test/net/sleepcost.test.js:"function flushesOf(r) {"` | GRANT-SLEEP's cell pin waited 200 `setImmediate` turns for a signed post; under load (13 on four cores) the post landed later and the pin failed 1 run in 3 - CI's eight shards run under the same kind of load. | Fixed on the branch (a commit before the merge): it waits on every post the cell started, a condition. |
| R3-3 | High | `src/net/hubShards.js:"? new Set(Array.from({ length: REGION_SPLIT }, (_, region) => region))"` | Main's REGION_SHARDS over the branch's 71 channels: `all` (or a province's number) sent a province's link to a shard key no Room opens. | Fixed in the merge; pins moved (`cost1_regions`, `sleepcost`); `release_r3.json` R3-3-*. |
| R3-4 | Low | `src/systems/instancePlaces.js:"const mine = questHere"` | Main's party-first door order under the branch's nine-key bound: at a castle with seven partners and a quest of mine, my own row became the tenth, which no key chooses. | Fixed in the merge; `domain2_castles` PIN MOVED; `release_r3.json` R3-4. |
| R3-5 | Medium | `server/src/index.js:"if (!court) { this._gateFells.set(lane, fell);"` | GATE-COURTS x WW2 in the hub's kill: either side taken whole loses the other's law (main's: every lane's fall written as the Bay's; the branch's: a court's kill collapsing the gate for the night's other courts and a rite receipt over a court's). | Composed in the merge; pinned by `test/net/release_r3.test.js` (a lane's fall on its own key, never the Bay's; a court's kill on none) and `gatecourts`; `release_r3.json` R3-5-*. |
| R3-7 | Critical | `src/world/spawnGroundPlace.js:"const mask = zoneMask?.() ?? null;"` | Main's GROUND-AGREE module (`world/spawnGroundPlace.js`, new on main) imports `wildMaskOf` from `systems/wild/wildZone.js`, which TESA no longer exports (WW-C2: the zone is Cyrodiil whole, past the Bay). git merges both files cleanly and eslint passes; the module fails to link, and `scenes/world.js` - which imports it - with it: the streaming world does not boot. `npm run types` alone named it. | Fixed in the merge: the zone's mask is the host's (`zoneMask`, `scenes/world.js` hands `cyrodiilMask` - one wiring entry, bootWorld 35,896 measured); `fb1024_groundagree` PIN MOVED (its zone built by `buildWildMask`; its source pin reads IC-GRAND's `capitalBuildView`). |
| R3-8 | Medium | `test/systems/legacy/auditlegacy3.test.js:"const crowns = /^crown("` | AUDIT LEGACY III O11 failed on the branch and on the merge (948 of 864): WW7-3's seven province crowns joined GLYPHS, so every claim at once beside a house at its bounds is past the hello's body bound. Measured: without the house it is 848 (the token 938 of 1024), and the mint already leaves a house unsaid past either bound (`server-account/src/index.js`) - so no token is refused and nobody is locked out; a holder of every glyph and a house at its bounds goes online with the house unshown. On main (no province crowns) the house fits: 855. | The pin moved on the merge (PIN MOVED): the house dropped past the bound, the made token inside both, the house beside every claim but the province crowns. |
| R3-6 | Info | `account-deploy.yml` "Apply migrations" | The migrations apply before the service waits on the relay; for this release that is safe (additive tables, wider CHECKs), and the order is recorded above for the next release whose migration is not. | Recorded. |
