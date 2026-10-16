# AUDIT FB1013d (2026-10-13) - the fallen's remains, audited

The owner, of PR #874 (FIELD BUGS 2026-10-13d - REMAINS-STAND and LIVE-FIGHT, `Field-Bugs-2026-10-13d.md`; the branch at
c8901bc4a, its batch then named 2026-10-13c): **"Audit this"**. This page is the findings, each with its verdict. What the
audit changed is written into the record's sections as they now stand (`Field-Bugs-2026-10-13d.md`,
`06-Systems/Legacy-Arc.md` section 7), each change marked AUDIT FB1013d and its id.

## How it was run

Three cold lanes, each an adversarial reader of a FROZEN snapshot (a git worktree at c8901bc4a, per Home.md's DO NOT FIX
WHILE THE VERIFIER IS READING), each told to prove a finding against the code before reporting it; then the author's own
lane, and every finding reproduced again by the author before it was acted on:

| Lane | Over | How |
|---|---|---|
| A - the law and the state | the claim law and its lapse, AUDIT LEGACY H1, H4 and H5, every save, load and mode path for a piece laid twice or lost, what a list takes in, the guards | the real Legacy host, ground pool, stand and transfer laws, `mergeFamily` through the save door and the store's merge, world.js's reads off its text; every probe run on the branch and on its base (8b0d093a7) |
| B - the world's wiring | which dungeon, the coordinates, the four hosts, LIVE-FIGHT in every mode, the lifecycles, the cost | world.js's and dungeonContext.js's own text over the made places' real producers (the spawns, the Undercroft, the Arena's floor, the Court, the Hour); the cost timed against the base over the landforms audit's synthetic world |
| C - fidelity, pins and records | every claim of the record and the comments against the code and DFU's source, the fixtures against their producers, the records' aim, and what the pins cannot fail | 28 scratch mutants of the changed lines run against the slice's test, the 259 test files that read world.js's Legacy and height reads, and the 31 that import the Legacy host; five scenarios over the branch's code; the gates and the DFU sources read again |
| The author | the slice's own suspicions, then the fixes | the wrong dungeon (O1) found before the lanes reported; each lane's probes run again over the fixed tree; every pin and mutant below |

No lane found a piece laid twice or lost by one player in one tab. The findings are a body that stood in the wrong
dungeon - every spawn of the fallen's region, and the castle over the Arena's Undercroft - a stall the height read added
to the tick on every new pixel, a fight read blind to duels and hostile ships, a claim one tab could hand another, a body
and a window that outlived a load's new lists, bones put back that stranded the death quest, and holes older than the
slice in the store and in what a list takes in, which the body gives a second door to - those the owner's. And the
pins held less than they said: nine plausible mutants of the changed lines survived the slice's test (lane C), among
them one that stood no outdoor body at all and one that let the heir empty another member's search.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A4 | HIGH | Older than the slice and outside its diff: two tabs of one line can each claim the same remains and each take the heirloom - the store's merge (`systems/legacy/store.js mergeFacts`) only adds the rows it lacks, so each tab's row is written whole and the claim is whichever wrote last (on the branch and on the base: one heirloom with a living member in each tab) | OPEN, the owner's: the store's own law - a claim checked against the store at its first change, or the store's claimed row winning the merge. REMAINS-STAND neither widens nor narrows it |
| B1 / O1 | MED | The fallen's dungeon was `abyss.location()`'s row alone. Every made dungeon - a spawn, a hall, the Arena's floor, the Court, the Hour - is `locationIndex: -1` of its region, and the Undercroft wears Daggerfall's own row on its pixel: the body (and, older, the list's six paces) stood in every spawn of the region at the fallen's coordinates, on a floor there or in the rock, and in the castle over a death in the Undercroft and back. Smaller Dungeons builds one location at three layouts | FIXED: the place keeps the row, the pixel, the dungeon's own key (`dungeonCtx.locationKey()`, its save's and its room's) and the size it was built at (`builtDungeonSize`); a row from before keeps its row and its pixel (the author's lane found the spawns first, O1; lane B the Undercroft and the sizes) |
| A2 | MED | A load replaces every list (`adopt` -> `mergeFamily`). A body stood over an old list held it until the next tick (a save made at another size skips the dungeon's pool restore), and the slow tick ran under the world load's awaits, so a window opened over the old list there outlived it: a take from it was a take from no record, the heirloom twice. The window's part is older than the slice; its reach in a browser is unverified | FIXED: `adopt` lets every body go (`letGoRemains`), and the slow tick asks nothing while the world is moved (`worldMoveBusy`, AUDIT 68 S22's one question) |
| A3 | MED | Older, the body a new door: the bones taken through a window held open across the step that marked them carried, then put back, left the row `taken` with its bones in a list no door opened, no ring marked and no temple could lay to rest - the heirloom and the purse with it | FIXED: the state follows the bones - back in their own list and in no keeping, they lie again, the claim kept, the line said |
| A5 | MED | Older: a remains list takes anything in, gold without bound through the window's gold arm; once its depositor dies or retires, the next member takes it all - past ESTATE_MAX, REMAINS_GOLD_MAX and the online birth's cap, and a lineage past 128 KiB is refused by the realm (`lineage-too-large`) | OPEN, the owner's: an accept rule for a remains list (only its own laid pieces back in) is new law, and DFU's loot window takes a store into any container |
| C1 | MED | The outdoor reads' spot was never pinned: every fake the world reads ignored (x, z) - the ground, the lift and its inverse - so a ground read at native coordinates (no outdoor body would ever stand), the lift's x and z swapped, or the lift at no spot passed every test | FIXED in the pins: the ground built about the scene alone, the lift the spot's own, a roof with a floor over it; four mutants, dead |
| C3 | MED | `remainsToStand`'s rows - the ones the one played may seek (`openRemains`) - unpinned: every row stood would let the heir empty another living member's claimed search through its body | FIXED in the pins |
| C4 | MED | `readyList`'s once-only note unpinned: noted again at every step, a take through the body on the very spot - its list's own door refused while the body's window holds the slot - was never the heir's claim | FIXED in the pins |
| C2 | MED | "In no other dungeon" was pinned by the row's index alone; its region's comparison by nothing | KEPT, recorded equivalent: since O1 the pixel is compared beside it, and a region is its pixels' |
| A1 | LOW | New: `remainsToStand` lapsed a dead claimant's claim itself and noted the list before the bones they carried off were laid again; the next step laid them, and the one played was handed a claim on a list they never touched (two tabs of one line: the death merged in between the tick and the stand) | FIXED: the lapse lays the bones at once |
| B2 | LOW | New: `legacyHere` asked the landforms lift on every call - a field's kernel pass on the first pixel the main thread asks it of (median 66 ms in the synthetic world against the base's 0.03; 16 to 37 ms a field on the real woods), from the slow tick every second | FIXED: the height is the death's to ask (`legacyHere({ height: true })`) |
| B3 | LOW | Older, and the record overclaimed it: Legacy's fight read neither a duel (or the player's own bout) nor a hostile ship in reach, both of which the host's rest refusal reads beside the pools - the remains' window, Play as, Pass the mantle and a wedding went through them | FIXED: `duelEnemyNear() || areEnemiesNearby(...) || navalHostileNear()` |
| A6 | LOW | Older: the store's person re-key (`rekeyClashes`) moves a row's `of` and id but not its pieces' marks, so a second set of bones is laid and the stray one never goes back | OPEN, the owner's: the marks re-keyed with the row, and the pieces a character's save carries mapped the same way |
| C5 | LOW | LIVE-FIGHT's watch outdoors unpinned (the guards' pool always empty) | FIXED in the pins |
| C6 | LOW | The outdoor landing unpinned (a death in the air stood in the air), and the dungeon's `floorAt` fake read no height | FIXED in the pins: a death in the air lands; the dungeon's own `floorAt`, off its text, over two levels |
| C7 | LOW | Test 2 claimed guards it never asserted (the past), and test 1 named a mutant with no record | FIXED: chargen's guard and the dead's pinned (chargen runs inside the world, and a page with no character yet is anyone's); the past's recorded equivalent (it is never the line's current); the titles say what they assert |
| C8 | LOW | "Seen across a hall" unpinned: the line was drawn from 1.6 m | FIXED in the pins: from thirty metres |
| C14 | LOW | `legacyRemainsFeet` wrote `anchorLanding`'s read a second time; the stand's `count` had no caller but the tests (and `clear` none until A2) | FIXED: the remains' height is `anchorLanding`'s read - one home; `count` gone, `clear` the load's |
| O2 | NIT | The slice's comment over `inFight` stopped mid-sentence | FIXED with B3 |
| O3 | NIT | Found while verifying B3: the giant notice's `wildFight.inFight?.()` (GIANT-FALL) reads a member `net/wild/wildFight.js` never had - always undefined; lane B's probe gave its fake one | OPEN, not this slice's: no open-zone fight latch exists to read |
| B4 | NIT | A death on a ship's deck at sea: the row keeps the deck's height, and the body lies on the seabed under where she fell (no mesh in reach); the list's own sixty metres open from the deck | KEPT, recorded here |
| R1 | NIT | The record said a load's merge stood the body over the new list (only from the next tick), and that the tick lapsed every claim before a list was made ready (the stand can lapse its own) | FIXED: the record as A1 and A2 made it |
| O4 | NIT | The PR's description gave the merged tree's anchors as 2,332: the cite tool counts `git ls-files`, which lists an unresolved file once a stage; the clean tree's are 2,216 | FIXED in the description |
| C9 | NIT | The record put the latched walker within 102.4 m of the door: `wouldBeSpawnedInClassic` returns false past 1094 classic units first - 27.35 m | FIXED in the record and the comment |
| C10 | NIT | "Turned on the player" left out DFU's trespass door (a private door tried again past its warning) | FIXED in the record and in what is asked of the reporter |
| C11 | NIT | ESTATE-WIDER quoted the arc's reading as the owner's words | FIXED: "the heir inherits" alone |
| C12 | NIT | "End to end through the producers" overstated: the death was a bare SetHealth(0), the world's reads ran over fakes, a foe's senses were set by hand | FIXED: the death runs the collapse's own law (`exhaustionOutcome` over `areEnemiesNearby`), and the test and the record say what is real and what is faked |
| C13 | NIT | Two laws had exceptions the slice never wrote: Legacy-Arc's "never in a fight" (the body is pressed in one) and Loot-Arc's "off, no line of light" (WILD1's line, and now the house's) | FIXED: both narrowed |
| C15 | NIT | Two claims stated as facts: the reporter's 3,000 as the estate, and Castle Wayrest's guards as passive | FIXED: worded as what fits, and as the law with the castle's own markers unread |
| O5 | NIT | The audit's run of every list aimed at the Legacy host (twenty, 712 records): one record no longer parsed on main (AUDIT-LEGACY-III-A2-newer-save-drops-the-stores-facts - AUDIT FB1007b T3 hung an `else if` on the line it deletes), and one survives on main as here (LEGACY7W-partner-dead-or-lineless, the account service's wedding) | FIXED the first (re-aimed by content, dead); OPEN the second, the wedding's own |

## Pinned

`test/systems/fb1013d_remains.test.js` (11): O1 and B1 (spawns of her region minted by their producer on other pixels, the
Arena's floor and the Undercroft on Daggerfall's pixel, a keep built at the medium size by `generateMediumDungeon` -
none stands her or opens her list, her own does, a row from before included; the summary and the key off
`dungeonContext.js`'s own text), B2 (the lift counted: none on the tick's reads, one at the death), B3 (a duel and a
hostile ship, in every mode), A1 (a claim lapsed at the stand), A2 (the real save door: the body let go at the load;
the world's own `legacyStep` off its text, holding while the world is moved), A3 (the bones put back), C1 and C6 (the
outdoor reads at the spot's own ground and lift, a roof with a floor over it, a death in the air landed, the dungeon's
own `floorAt` over two levels), C3, C4, C5, C7, C8; the death as the collapse decides it (C12). Mutants:
`tools/mutants/fb1013d_remains.json` - the audit's 32 records (30 dead, C2's and C7's past equivalent as recorded) and
7 of the slice's own and O1's 4 re-aimed by content, 66 run: 64 dead, 2 equivalent as recorded;
`auditlegacy2.json` AUDIT-LEGACY-II-A3-lapse-keeps-first-laid and `auditlegacy3.json`
AUDIT-LEGACY-III-A2-newer-save-drops-the-stores-facts re-aimed by content, dead; every list aimed at the Legacy host -
twenty, 712 records - run over the fixed tree: 708 dead, 3 equivalent as recorded, and LEGACY7W-partner-dead-or-lineless
surviving as it does on main (O5).
