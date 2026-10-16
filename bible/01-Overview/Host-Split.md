# HOST-SPLIT - taking the hosts apart

Opened 2026-10-15, off the codebase audit of 2026-10-14 (AUDIT DEPS1). Mac: *"Refactor time?"*, then
*"I wanna take all of this head on and do this right"*, then *"Continue"* on the plan
below.

## Why

Each host keeps its whole state in ONE function's scope. Measured 2026-10-14
(`node tools/hostScope.mjs <file>`):

| Host | Function | Lines | Members | Host-scope `let`s |
|---|---|---|---|---|
| `src/scenes/world.js` | `bootWorld` | 35,251 | 2,787 | 571 |
| `src/scenes/worldModes.js` | `createWorldModes` | 13,505 | 515 | 84 |
| `src/scenes/dungeonContext.js` | `buildDungeonContext` | 10,223 | 560 | 89 |
| `src/scenes/exterior.js` | `bootExterior` | 6,083 | 472 | 62 |
| `server/src/index.js` | `Room` `_message` | 1,428 | 58 | 2 |

A member of one of these can read and write every other member's state, so
nothing in them can be imported, tested or reviewed alone; every change lands in
the same file (the conflicts CITE-ANCHOR was built against); and THE FOUR HOSTS
RULE exists because a seam wired into one host is so easily missed in another.
The relay's `Room` is already 473 methods - its knot is the one dispatcher.

And they grow. Line counts of the files on main:

| File | 2026-09-14 | 2026-09-28 | 2026-10-07 | 2026-10-14 |
|---|---|---|---|---|
| `world.js` | 8,897 | 21,245 | 30,410 | 36,374 |
| `worldModes.js` | 8,299 | 10,953 | 12,421 | 13,984 |
| `dungeonContext.js` | 6,151 | 8,501 | 9,931 | 10,662 |
| `exterior.js` | 4,525 | 5,644 | 6,021 | 6,426 |
| `server/src/index.js` | 594 | 3,184 | 5,600 | 8,879 |

`world.js` grew ~850 lines a day. Moving code out of a scope that grows faster
than it can be taken apart is a race that cannot be won, so the first rule is
the one that stops the growth.

## THE HOSTS DO NOT GROW

New behaviour goes into a module the host wires - `fishHost.js` and
`merchantYardsHost.js` are the shape: the module owns its state and its frame,
the host constructs it once and calls it. The host's own function gains the
wiring, not the feature. (Not every one of the 28 `*Host.js` modules is that
shape: `navalHost.js`'s `createNavalHost` is itself a single scope of 4,865
lines - the same knot, one size down, with no ceiling of its own yet.) On the
relay the new code goes into a Room method of its own, as the SCALE5 arms did.

`test/hostceiling.test.js` holds it: each host function - the four hosts and
the relay's `_message` - has a ceiling in CODE lines, its length when measured
plus 250 - a fix's room, not a feature's. Comments and blank lines do not count
(AUDIT HOST-SPLIT 0: a third of bootWorld is the bible's own explanation, and a
ceiling on raw lines made deleting it the cheapest room). A change that pushes
a host over fails with where to put the code instead. A fix
that truly cannot live elsewhere raises the ceiling with its reason written
beside it, in the same change, where review sees it. And a ceiling comes down
with its host: a slice that moves code out lowers it in the same change (the
suite fails a ceiling left more than 500 lines over its host), so the room a
slice frees never becomes room to grow back into.

THE CEILING GATES A CHANGE, NEVER A DEPLOY. Every open pull request is measured
against the base it last saw, so two that each fit can land together and
overflow - and the deploys run the suite. So the ceiling holds on a pull request
and on a contributor's machine, and stands aside on the push that deploys: an
overflow on main is the next pull request's to fix, by moving code out or by a
raise with its reason, never a held deploy.

## The map

`tools/hostScope.mjs` reads a host's scope instead of guessing it. Each
statement of the host function's body is a member; for a member or a group it
counts what the group READS from the host's scope, the host `let`s it WRITES
(shared mutable state - the hard part of a cut), and the members that USE what
it declares. Few writes and a small used-by make a cheap cut. It matches names by
spelling, so shadowing over-counts reads; its writes are the assignments,
updates and for-in/of heads it sees, and a parameter or a hoisted `var` counts
as host state (AUDIT HOST-SPLIT 0 added those three). It is a map for choosing a
cut - what is live and what is a copy is decided by the move itself, by scope
(the method, below). Read the group before moving it.

The first reading of `bootWorld` (2026-10-14, main at 911429f13b; lines raw;
tests are the test files that hold the name as a word, `git grep -lw`):

| Group | Lines | Reads | Writes | Used by | Tests naming it |
|---|---|---|---|---|---|
| `travelViewMarks` | 227 | 63 | 0 | 1 | 3 |
| `questWorld` | 370 | 46 | 1 | 4 | 15 |
| `buildPixelNow` | 1,232 | 111 | 3 | 1 | 11 |
| `worldQuickLoad` | 307 | 75 | 6 | 5 | 34 |
| `onlineStart` + `chatStart` + `socialStart` + `onlineFrame` | 1,214 | 291 | **68** | 1 | 29 |
| `frame` | 3,204 | 553 | 60 | 18 | (too common a word to count) |

The online group is NOT a move: it writes 68 of the host's `let`s, so cutting it
out is a redesign of who owns that state, and it waits until the cheaper cuts
have taught the method. `frame` is already partly split inside itself
(`frameMotor`, `framePixelWalk`, `frameGrass`, `frameHud`); it comes apart by
stage - input, simulation, network, render - once its callees have left.

## The method - MOVE, DON'T REWRITE

One group per slice, one pull request each, behaviour unchanged:

1. **Read the map** for the group: its reads, writes and users.
2. **Move the code verbatim** into a module (`src/scenes/<name>.js`) exporting a
   constructor that takes the host's handles - `createX(host)`, as
   `createWorldModes(host)` already does. A `const` the group reads, a function
   declaration nothing reassigns, and a `let` nothing ever reassigns (a constant
   in all but name) are handed over as themselves. A binding anyone writes is
   handed over LIVE - a getter (and a setter, for a write) on the handles
   object - never a copy:
   the code moved from a scope where it saw every assignment, and an async
   member sees them across its awaits. The handles object is built where the
   host builds it today, and a getter reads at the call, never at construction,
   so no name is touched inside its temporal dead zone.
3. **The pins move with the code.** A test that quotes the moved lines from
   `world.js` reads the new module instead, in the same change - the pin keeps
   its claim and names where the code now lives. A cite into the moved lines
   names the new file (`npm run cites -- --check`, then `citeanchor`).
4. **Lower the ceiling** to the host's new length in code lines plus 250.
`tools/hostMove.mjs` does 2 and the mechanical half of 3 (HOST-SPLIT 1): it
decides every name by those rules (by value, live, import, refused), writes the
module and the host's construction, drops the imports the host no longer reads,
and points every mutant record and doc anchor that named the moved text at the
module - in place, the records' own layout kept. The test pins are the half it
leaves: their assertions are read and moved by hand (`PIN MOVED`).

5. **Prove it**: lint, types, the bible's gates, every test that reads the host
   or the module, `tools/mutate.mjs` over the mutant lists that name the moved
   code - and, since CI has no ARENA2, Mac plays the slice and runs
   `npm run perf` before it merges.

Where two or more hosts build the same thing, the moved module becomes its ONE
CONSTRUCTION SEAM (`Home.md`) for all of them - the slice names all four hosts
(THE FOUR HOSTS RULE), each wired or flagged.

## Order

1. HOST-SPLIT 0 - this page, the ceiling, the map. SHIPPED with this page.
2. HOST-SPLIT 1 (the pilot) - `travelViewMarks`: no writes, one user, three
   tests. It proves the method end to end before anything large moves.
   SHIPPED - below.
3. `buildPixelNow` (the world's pixel build, 1,232 lines, 3 writes), then
   `questWorld`, `worldQuickLoad`, and down the map by cost.
4. `frame` by stage, then the online group's state, owned.
5. The same for `createWorldModes`, `buildDungeonContext`, `bootExterior` and the
   relay's `_message`.

Each slice records itself here: the group, its numbers before and after, the
ceiling it lowered to.

## HOST-SPLIT 1 - travelViewMarks (SHIPPED, 2026-10-15)

The pilot. `tvBadgeOf`, `TV_PEER_HEAD_M` and `travelViewMarks` - the Overworld's
marks, 229 lines, three contiguous members nothing else used - left `bootWorld`
for `src/scenes/travelViewMarks.js` (`createTravelViewMarks(host)`), moved by
`tools/hostMove.mjs`:

- 46 names by value - `const`s above the group, never-written `let`s, function
  declarations; 15 live, read as `host.<name>` - `let`s written elsewhere
  (`_sharedOffsetMs`, `bountyHost`, `livingRoads`, `online`, `social`...) and one
  `const` made 230 lines below the group, `navalRaidersOn`, which a copy at
  construction would have read in its temporal dead zone and thrown at boot.
- 28 imports came along; the host dropped the 9 it no longer read.
- 35 mutant records over 20 lists and one doc anchor (`Wild-Zone.md`, PVPGIANT)
  followed the code, by the tool; after it, `tools/mutate.mjs` over the 35:
  35 dead.
- The pins, by hand: 21 test files and the TIME1 census fixture. Most were text
  pins that now read the module (a live name as `host.<name>`, and where the
  host hands one over, a second pin that it does). Three were HOST RUNS - the
  boat markers, the raiders, the party - that lift the marks' code out of the
  file and run it against stubs; they lift it from the module now, with `host`
  standing for the stubs, and they pass - the moved code still does what it
  did. What they cannot see is the seam itself: a stub hands every name over
  the same way, so a live name handed over as a copy passes them (AUDIT
  HOST-SPLIT 1, below). Two pinned the host's own imports
  (`NAME_RANGE`, `TV_DUNGEON_TYPES`) and follow their one reader.
- `bootWorld` 21,589 -> 21,445 code lines (35,251 -> 35,042 raw); its ceiling
  21,839 -> 21,695.
- The full suite on the slice: 27,336 pass, 0 fail.

WHAT THE PILOT MEASURED: the code moved itself, by rule; the pins did not. 229
lines cost 22 files of pin moves, because the suite reads `world.js` as text
(1,444 files read it, 523 slice it between anchors). That is the price of every
slice, in proportion, and the order above stands on it: a group the map calls
cheap is cheap to move; whether it is cheap to land is how many pins quote it.
The next slice counts its pins first (the pins-to-lines ratio beside the map's
numbers), and a group with many pins and few lines waits.

AUDIT HOST-SPLIT 1 (2026-10-15) read the move against the original - the module
equal to the moved lines but for the 19 rewrites of the 15 live names, every
by-value name written nowhere in bootWorld, the construction reading exactly the
46 it destructures - and found the move sound and two things around it not:

- THE SEAM WAS UNPINNED. `host` is `any` to lint and types, so a live name
  handed over as a copy (`get social()` -> `social,` - null at construction,
  the party's marks gone for good) or a name dropped passed the whole suite.
  `test/hostseam.test.js` now holds every module the tool moved, found by the
  header it writes, to its construction: each settled name handed over, each
  live read a getter, each write a setter, nothing handed over unread.
- THE TOOL had holes the pilot did not fall into and a bigger move would: a
  for-in/of head's write and a reassigned function or class declaration missed
  (a stale copy), an inner binding named `host` capturing the rewrites, a
  parameter default resolved in the body's scope, a host `var` in a block, a
  shorthand with a default and `new.target` rewritten into syntax errors, an
  import dropped with its neighbour on one line, a mutant record found by
  position and an anchor matched inside a longer file name. Each is fixed and
  is a fixture of `test/hostmove.test.js`: the fixture moved for real and both
  versions run, the same answer. After the fixes the tool reproduces the
  pilot's module and world.js byte for byte from the pre-move tree.

## PARTY-LOOT's block - roomLootHost (FIELD BUGS 2026-10-14, at the merge)

Not a slice of the order above: a fix that landed past the ceiling. PARTY-LOOT (`06-Systems/Online-Arc.md`) was
written on main at 7c291d36, before HOST-SPLIT 0, and put its room-loot block - 48 members, the room's base, its word,
its claims and the host's verdicts - into `buildDungeonContext`, which took the dungeon host 204 code lines over its
ceiling (5,650 against 5,446) once it met main in the field-bugs pull request. A raise was not taken: the map read the
block as a clean cut - 0 host `let`s written, 30 names read - so it is a module, not room to grow.

- THE MOVE. The block left for `src/scenes/roomLootHost.js` (`createRoomLoot(host)`) by `tools/hostMove.mjs`: 15 names
  by value, 18 live (`_authority`, `_foesFrom`, the loot sets, `_wallNow`, `onlineRoom` and the block's three counters,
  two of them written through setters), 23 returned and destructured where it stands; 16 import lines came along and
  the host dropped the 40 names it no longer read. 21 mutant records followed the code, by the tool.
- WHERE IT STANDS. The tool constructs a group where it stood, and this one stood below its first caller: the build's
  `for (const e of enemies) await buildFoeAt(e)` reads `lootBuiltOf` and `forgetRoomContainer` thousands of lines above
  the block - hoisted function declarations until now, a destructured `const` in its temporal dead zone after. So the
  block was first moved verbatim above `buildFoeAt` (its members are function declarations, arrow `const`s and empty
  `Map`s, none reading the host at construction), and its three `let` counters above it - `_roomMintHold` is written by
  the host's restore, so it stays the host's and the module reads it live. Then the tool found no member used above it.
- THE TOOL had a hole the move fell into: a comment ending a code line above a group was read as the group's doc, so
  that line - a host `let` - went into the module and out of the host, and the host's own write of it would have thrown.
  `tools/hostMove.mjs` stops at a comment that does not begin its own line; `test/hostmove.test.js` holds the fixture
  (`trailing-comment-above`, the original and the moved host run alike) and `tools/mutants/hostmove.json` its mutant.
- THE PINS, by hand: `test/partyloot.test.js` mounted the block's own lines out of the host; it mounts the host's
  counters and construction (from `dungeonContext.js`) over the module's `createRoomLoot` (from `roomLootHost.js`) now,
  the module's imports - the player, the mid-screen line - still each peer's own, and reads the base's two pins in the
  module. `test/audit18_hosts_dungeon.test.js`'s count of the one enemy-loot seam reads two in the host and the room
  body's one in the module, and that the host constructs it. The harnesses that spread `test/roomLootOff.mjs` into
  their host mounts were untouched: the host's names are the same names.
- `buildDungeonContext` 5,650 -> 5,263 code lines; its ceiling stays 5,446 (the block was never in the measure the
  ceiling was set from). `tools/mutate.mjs` over `partyloot.json`: 30 dead; over `hostmove.json`: 11 dead. As every
  slice: CI has no ARENA2, so the room's loot is Mac's to play before it merges.

## FB1015's merge - a raise, by the overflow alone (2026-10-15)

Not a slice: a ceiling a pull request found already broken. Merging main into FB1015 (`01-Overview/Field-Bugs-2026-10-15b.md`)
measured main's own `bootWorld` at 21,750 code lines against its 21,695 - ten field-bug merges between 1242f035 and
4f3fb37a added 251 lines and took 56 out of `world.js`, each inside the ceiling on its own, together 55 over it (the
gate's header names the case: it gates a change, never a deploy). FB1015 adds no line to `bootWorld`, and no one block of
the growth is a cut of its own, so the ceiling was raised by exactly the overflow - 21,695 -> 21,750, with the reason
beside it in `test/hostceiling.test.js` - and no room: the next pull request that lengthens `bootWorld` moves code out
first (`buildPixelNow` is next in the order above).

## FIELD BUGS 2026-10-15c - the overflow taken back out (2026-10-15)

PVP-ESCROW's two sides - my pieces held in the service's escrow, asked back once my killer can no longer collect them,
and my collects carried to the service (`11-Multiplayer/Wild-Zone.md` section 4) - leave `bootWorld` whole for
`src/scenes/wildEscrowHost.js` (`createWildEscrowHost`). `node tools/hostScope.mjs` measured the group: eight members,
63 lines, reads five host names (`modes`, `onlineCheckpoint`, `realmSession`, `townTalk`, `wildAccount`), writes
none, used by three (the drop's receipt, the zone's frame, the room's collect) - handed in, the three calls go through
the module's `held`, `frame` and `collectHeard`. `bootWorld` 21,750 -> 21,688 code lines, and its ceiling back to
21,695, where it stood before FB1015's raise. The pins that read the block by source (`test/fb1014_pvpescrow.test.js`)
read the module, and the bible's anchors name it (`01-Overview/Field-Bugs-2026-10-15c.md`).
