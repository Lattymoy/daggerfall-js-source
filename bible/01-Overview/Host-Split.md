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
wiring, not the feature. (Not every `*Host.js` module is that
shape: `navalHost.js`'s `createNavalHost` is itself a single scope of 4,865
lines - the same knot, one size down. HOST-SPLIT NAVAL (2026-10-15) gave it a
ceiling of its own, and any function in `src/` or the relay's `server/src/` that
grows past 2,000 code lines (2,400 logical lines since LEGIBLE 1) is now held to one too: the suite walks both and
reads every outermost function, whatever its name or shape. AUDIT HOST-SPLIT NAVAL found the first walk
read only each `*Host.js`'s first `export function create...` - five hosts never
measured - and a knot outside the folder already standing: Come Sail Away's
runtime, `createComeSailAwayRuntime`, 2,065 code lines, held now too. AUDIT
HOST-SPLIT NAVAL, the second read: "whatever its shape" was held by nothing -
every held knot is a declaration, so a walk narrowed to declarations passed - and
the walk never read the relay, where a 2,100-line Room method passed too. A
fixture of every shape a function takes is read by the walk now, the relay is
walked, and an unnamed knot is told to take a name, not handed a ceiling row
for `undefined`. Two mutants, dead. Left as found: three classes past the
line - `Renderer` 4,173 code lines, `HeldMapWindow` 2,291, `OnlineSession`
2,080 - whose state is `this`, not one function's scope; whether that is a
knot is the doctrine's call.) On the
relay the new code goes into a Room method of its own, as the SCALE5 arms did.

`test/scenes/hostceiling.test.js` holds it: each host function - the four hosts, the
two modules grown into knots of their own (`createNavalHost`,
`createComeSailAwayRuntime`) and the relay's `_message` - has a ceiling in LOGICAL lines, its length when measured
plus 400 - a fix's room, not a feature's. A logical line is a statement, an entry of an object literal or a class, a
switch case or an expression arrow's implicit return (`tools/hostScope.mjs` `logicalLines`), so comments, blank lines
and layout do not count (AUDIT HOST-SPLIT 0: a third of bootWorld is the bible's own explanation, and a
ceiling on raw lines made deleting it the cheapest room; LEGIBLE 1, `Readability-Arc.md`: a ceiling on code lines
made cramming two statements onto one line the cheapest room, and splitting them for a reader cost it). A change that pushes
a host over fails with where to put the code instead. A fix
that truly cannot live elsewhere raises the ceiling with its reason written
beside it, in the same change, where review sees it. And a ceiling comes down
with its host: a slice that moves code out lowers it in the same change (the
suite fails a ceiling left more than 800 logical lines over its host), so the room a
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
| `buildPixelNow` (HOST-SPLIT 2, moved) | 1,232 | 111 | 3 | 1 | 11 |
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
4. **Lower the ceiling** to the host's new length in logical lines plus 400.
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
3. HOST-SPLIT 2 - `buildPixelNow` (the world's pixel build, 1,237 lines, 3
   writes). SHIPPED - below. Then `questWorld`, `worldQuickLoad`, and down the
   map by cost.
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
  `test/tooling/hostseam.test.js` now holds every module the tool moved, found by the
  header it writes, to its construction: each settled name handed over, each
  live read a getter, each write a setter, nothing handed over unread.
- THE TOOL had holes the pilot did not fall into and a bigger move would: a
  for-in/of head's write and a reassigned function or class declaration missed
  (a stale copy), an inner binding named `host` capturing the rewrites, a
  parameter default resolved in the body's scope, a host `var` in a block, a
  shorthand with a default and `new.target` rewritten into syntax errors, an
  import dropped with its neighbour on one line, a mutant record found by
  position and an anchor matched inside a longer file name. Each is fixed and
  is a fixture of `test/tooling/hostmove.test.js`: the fixture moved for real and both
  versions run, the same answer. After the fixes the tool reproduces the
  pilot's module and world.js byte for byte from the pre-move tree.

## HOST-SPLIT 2 - buildPixelNow (2026-10-15)

Mac: *"2, 3 and 5"* - 2 being this slice. `buildPixelNow`, the world's pixel
build - one member, 1,237 lines - left `bootWorld` for
`src/scenes/pixelBuild.js` (`createPixelBuild(host)`), constructed where it
stood, by the tool:

- 84 names by value; 22 live, read as `host.<name>` (`state`, `season`,
  `woods`, `weather`, `travelOptions`, `legacyHost`...), three of them written
  through setters (`_homeLookV`, `doorGeneration`, `millParts`). 166 imports
  came along in 86 lines; the host dropped the 107 it no longer reads.
- `buildPixel` above the group calls it, so the tool flagged it: a function
  declaration was hoisted, and a destructured `const` is not. Read: nothing
  calls a build before the construction runs - the boot's first build
  (`world.js:"const playerPixel = await awaitedBuild(first.px, first.py);"`)
  stands below it, and `bootWorld`'s last await above the construction is
  `loadModWorldData` (`world.js:"await loadModWorldData();"`): from there
  the boot runs to the construction without yielding, so no callback reaches a
  build early either. (A build before it would have died before the move too, on
  the breather's dead zone.)
- 136 mutant records over their lists and 4 doc anchors followed the code, by
  the tool. By hand: an anchor in a code comment (`exterior.js`, which the tool
  does not read), a `citedrift` pin on a ledger citation the tool had moved, and
  a TIME1 census row.
- `bootWorld` 21,679 -> 20,940 code lines (35,447 -> 34,245 raw), measured at
  the merge with main at 448e4cf1; its ceiling 21,679 -> 21,190, the new length
  plus 250 (step 4). Main's ceiling moved three times under the slice - the
  field-bugs roll-up grew bootWorld 131 lines past it, FB1015 raised it to that
  overflow with no room, and main's own small moves (glassPadWords, PVP-ESCROW's
  handoff) lowered it to where bootWorld stood, no room again - and each merge
  measured again. (The slice first wrote
  21,445 -> 20,706 and a ceiling of 20,956: the pilot's measure less the 739
  lines, where the base it moved from measured 21,619 - so it left 76 lines of
  room, not 250. AUDIT HOST-SPLIT 2, the second read, measured again.)

THE PINS READ THE HOST WHOLE. The move broke 143 tests in 130 files - the
pilot's ratio (9.6 pins a hundred lines against 9.5), at five times the
size, and every slice after it costs the same if each pin is moved by hand. So
`test/hostText.mjs` gives a host's text WHOLE: its file, then each module moved
out of it, found by the header the tool writes. A pin that quotes the world
host reads it through `hostText('src/scenes/world.js')` and keeps quoting the
code wherever a slice puts it; the next slice's module joins without anyone
listing it. That carried most of the 130. What it cannot carry, each by its
own law:

- a quoted line with a live name quotes it as the module spells it,
  `host.<name>` (one pattern read against both exterior hosts accepts either);
- the HOST RUNS that lift moved code and run it over stubs stand `host` for
  their stubs - under `with`, every name resolves to the scope, `scope` too, so
  `host` goes into the scope itself;
- a pin that PARSES the host parses each file as the module it is (two modules
  joined declare their imports twice), and one about `bootWorld`'s own
  statements reads world.js alone;
- the censuses that walk `src/` name `pixelBuild.js`, and check its wiring
  against its host whole; the import pins read the module's import lines
  (the tool sorts them, and keeps only the names each file reads);
- BOOT-TDZ2 (`test/scenes/bootorder.test.js`), the gate that walks the boot to its
  first build and follows every call, now follows a call into a moved
  module's functions too, reading `host.<name>` there as `<name>` - a read at
  the use, as the getter makes it. Without that it stopped at
  `buildPixelNow`; with it, it reaches every name it reached before, and its
  allow-list - which fails on a name it can no longer reach - says so.
- The citation gates read the real files: an anchor names a line of the file
  it names.

Proved, not supposed: `tools/mutate.mjs` over the 136 moved records and the
523 world.js records whose tests changed - 659 dead, 0 survived. A rewritten
pin that had gone blind would have let one live.

AUDIT HOST-SPLIT 2 (2026-10-15) read the move by an independent scope analysis -
every one of the moved code's 2,812 references resolving to the same binding of
the same kind before and after, the 84 copies each a binding `bootWorld` never
writes and made before the construction, the 22 live names each a getter with
a setter exactly where the module writes - and found the move sound, and the
seam's pin short of its own law:

- A COPY THE HOST LATER WRITES WENT UNSEEN. `test/tooling/hostseam.test.js` checked that
  each name the module copies at construction is handed over, never that the
  host's binding is one that cannot change: a `const` turned `let` and
  reassigned after the construction leaves the module reading the value it
  copied, and passed everything. It holds each copy to a binding the host never
  writes now, refuses a copy handed over as a getter (the module destructures it
  once all the same), and counts a write through a destructuring target or a
  for-of head as a write (it read as a read - a missing setter would have thrown
  only when the line ran). Three mutants.
- The cost of a live name: a handle with accessors is a dictionary object to V8,
  about 18 ns a read against 1. The reads that run outside a build are the
  collider's bucket translations, `host.state.pixelTranslation` - about 5 us a
  full sweep over 300 buckets; inside a build, a few thousand a pixel, under
  0.1 ms against a 6 ms slice. Recorded, not fixed: the next slice that moves a
  per-frame reader should copy the handle's live names into locals per call, or
  hand over a plain object whose fields the host updates.

AUDIT HOST-SPLIT 2, THE SECOND READ (2026-10-15, Mac: *"Pick it up and audit
it"*) read what the first left: `test/hostText.mjs`, the boot walk's reach into
moved modules, and the rewritten pins. The move is verbatim against main's build
(the 1,237 lines equal but for the `host.` rewrites), and main has not touched
the build since. Found:

- A DESTRUCTURED BINDING HAS A DEAD ZONE TOO. BOOT-TDZ2 (`test/scenes/bootorder.test.js`)
  indexed only the declarators that are a bare name, and the slice made the
  build one that is not: `const { buildPixelNow } = createPixelBuild(...)`. A
  build reached above its construction read a binding the gate did not know was
  declared there. Today the build's own reads of `state` and `restridePending`,
  declared lower still, fail such a call by luck; with the construction moved
  below `state`, an early build passed the gate. Every slice turns a hoisted
  function into such a binding, so the walk now indexes every name a
  declaration binds. It finds nothing new on the tree. One mutant, dead.
- A PIN THAT READ ONE SPELLING. PERF-COL2's census of a pixel's bucket
  providers (`test/scenes/perfcol2.test.js`) was rewritten to the module's spelling,
  `host.state.pixelTranslation`, alone - so it counted only the build's seven, and
  a provider the host lays itself, reading `state`, went uncounted, marked or not.
  It counts both spellings now. One mutant, dead (it lived on the rewritten pin).
- FOUR MORE THE JOIN OR THE SPELLING HID, each proved by a mutant that passed the
  rewritten pin and failed main's:
  - LANDFORM4 (`test/world/terrain/landform45.test.js`) ordered the landform tables before
    `await terrainGen.generate({`, which now stands only in the module the join
    appends after all of world.js - so any place in world.js passed, below the
    first build too. It orders them before the build's construction now.
  - BLOOD1's per-call negative (`test/combat/blood1_decals.test.js`) still spelled the
    bare `state`, which the build no longer does; it reads both spellings.
  - TERRAIN-WORKER's "publish follows the collider" (`test/world/terrain/terrainworker.test.js`)
    appended the module after the door's slice, so both of its `lastIndexOf`
    landed in the module and a mesh laid after the publish in world.js
    (`standPixelNpcs`) went unread. The module is spliced in where the host
    constructs it, as the build stood.
  - WATER-NEXT m8 (`test/world/terrain/audit_waternext.test.js`) was never rewritten: a NEGATIVE
    pin cannot fail when code leaves the text it reads, so it kept reading
    world.js alone and stopped covering the build that lays the pixel's ground.
    It reads the host whole.
  Three mutants in `tools/mutants/hostseam.json`, dead; LANDFORM4's is a move of
  two sites, which a record cannot hold, and was run by hand.
- AND FOUR MORE OF THE SAME TWO KINDS. LANDFORMS II H1's census of raw height
  writers (`test/world/terrain/auditlandforms.test.js`) read `- state.compensation[1]` alone,
  blind to the build's `host.state`; GRASS-LIT2's slice (`test/render/grasslit2.test.js`)
  ended at a line now in the module, so it ran to the end of world.js; GATE-CLEAR
  (`test/world/gate/gateclear.test.js`) and AUDIT 46 A10 (`test/world/road/roads.test.js`) ordered a
  declaration before text the join appends, which held nothing. Each reads both
  spellings, ends inside world.js, or orders against the build's construction.
  The first three proved by a mutant that passed the rewritten pin and failed
  the fixed one (H1's recorded in `hostseam.json`; the other two are moves);
  A10's move is failed by its own no-await check as well.
- THE NEGATIVES NEVER MOVED. A pin that says a host does NOT do something reads
  the host's text and finds nothing - and when code leaves that text it still
  finds nothing, so it never fails, and the move's 143 breakages held none: every
  negative over world.js's raw text had quietly stopped covering the build. A
  probe ran the suite logging each not-found search over world.js's whole text
  (or a slice spanning where the build stood): 193 test files held such pins,
  and each now reads the host whole - its reads, or its reader helper, through
  `hostText` (any other file reads as itself; dungeonContext.js reads with
  PARTY-LOOT's `roomLootHost.js`, the same gap). Sweeps that walk every file of
  `src/` already read each module on its own and were left; the cite gates and
  a pin that resolves anchors keep the real files. A second probe ran every
  converted test's string operations on the host whole and on world.js alone:
  none of a positive pin's answers changed but by design (a slice to the end now
  carrying the modules, cut again before use), and it found one more pin the
  move had made blind - LAB-GRASS's slice ended at the build's line, -1 on the
  raw file, so it ran to the end and held nothing; it ends at the next door.
  Three mutants put a retired line back into the build - a per-person `hypot`,
  a hand-spelled mouse code, the old bilinear read: each lived on the pins
  before and dies now. THE LAW FOR EVERY SLICE AFTER: a negative over a host
  reads `hostText` - a pin that reads a host's file alone holds the file, not
  the host.

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
  `tools/hostMove.mjs` stops at a comment that does not begin its own line; `test/tooling/hostmove.test.js` holds the fixture
  (`trailing-comment-above`, the original and the moved host run alike) and `tools/mutants/hostmove.json` its mutant.
- THE PINS, by hand: `test/systems/partyloot.test.js` mounted the block's own lines out of the host; it mounts the host's
  counters and construction (from `dungeonContext.js`) over the module's `createRoomLoot` (from `roomLootHost.js`) now,
  the module's imports - the player, the mid-screen line - still each peer's own, and reads the base's two pins in the
  module. `test/scenes/audit18_hosts_dungeon.test.js`'s count of the one enemy-loot seam reads two in the host and the room
  body's one in the module, and that the host constructs it. The harnesses that spread `test/roomLootOff.mjs` into
  their host mounts were untouched: the host's names are the same names.
- `buildDungeonContext` 5,650 -> 5,263 code lines; its ceiling stays 5,446 (the block was never in the measure the
  ceiling was set from). `tools/mutate.mjs` over `partyloot.json`: 30 dead; over `hostmove.json`: 11 dead. As every
  slice: CI has no ARENA2, so the room's loot is Mac's to play before it merges.

## OUTDOOR-LOOT - WORLD6a's loot doors out of createWorldModes (2026-10-17)

Not a new order's slice: the second container of OUTDOOR-LOOT (`06-Systems/Online-Arc.md`) was a building's cupboard, and
`createWorldModes` stood at 7,155 code lines of its 7,159 - there was no room to put the cupboards' law in, so the slice
began by taking WORLD6a's loot block out.

- THE MOVE. `interiorPublishLoot`, `interiorLootOpened` and `interiorLootSettle` left `createWorldModes` verbatim by
  `tools/hostMove.mjs` (first as a module of their own, `createInteriorLootHost`, then folded as plain functions of the
  context, the key and the bag into `src/world/interior/interiorShared.js`: `interiorLootOpen`, `interiorLootFrame` and
  their kin) and the cupboards' room law is a module of its own, `src/world/interior/interiorRoomLoot.js`, which the bag mints (`bag.room`). The container
  arm and the shelf arm only changed their callees; `host.roomHost` and `host.selfId` were in the host's bag already.
- THE CEILING came down with the code: `createWorldModes` 7,155 -> 7,134 code lines with the cupboards' wiring in, its
  ceiling 7,159 -> 7,138 (the length plus the 4 it stood over - not the standard 250, which would have raised it). After
  main's merges it measures 7,136 (2026-10-18, AUDIT OUTDOOR-LOOT): two under the ceiling.
  `createExteriorFoes` went the other way for a smaller reason: the body block is `src/scenes/bodyLootHost.js`
  (`createBodyLoot(pool)`), and the pool went from 1,755 to 1,706 code lines under KNOT's 2,000 (1,793 -> 1,744 on main's tree
  after its merges, re-measured 2026-10-18).
- THE PINS that read the moved block read the host WHOLE (`hostText`) and spell the live names through the handle
  (`h.interiorWindows`, `h.interiorCtx`, `h._intShared`): `auditworld6a`, `world6`, `home1`, `auditsetsonline`, `autohold`,
  `fb1016b_stolengoods`, `forage3_loot`, `roada2_itemseconomy`, `audit26_discovery`, `housecontainers`, `worldhover`, `sailingcabins`,
  with the mutant records that named its text. The container harness (`test/net/containerLootHarness.mjs`) hands a mounted
  door the scope as its handle, so the cupboard files run the moved module exactly as they ran the host.

## FB1015's merge - a raise, by the overflow alone (2026-10-15)

Not a slice: a ceiling a pull request found already broken. Merging main into FB1015 (`01-Overview/bugs/Field-Bugs-2026-10-15b.md`)
measured main's own `bootWorld` at 21,750 code lines against its 21,695 - ten field-bug merges between 1242f035 and
4f3fb37a added 251 lines and took 56 out of `world.js`, each inside the ceiling on its own, together 55 over it (the
gate's header names the case: it gates a change, never a deploy). FB1015 adds no line to `bootWorld`, and no one block of
the growth is a cut of its own, so the ceiling was raised by exactly the overflow - 21,695 -> 21,750, with the reason
beside it in `test/scenes/hostceiling.test.js` - and no room: the next pull request that lengthens `bootWorld` moves code out
first (`buildPixelNow` is next in the order above).

## FIELD BUGS 2026-10-15c - the overflow taken back out (2026-10-15)

PVP-ESCROW's two sides - my pieces held in the service's escrow, asked back once my killer can no longer collect them,
and my collects carried to the service (`11-Multiplayer/Wild-Zone.md` section 4) - leave `bootWorld` whole for
`src/scenes/wildEscrowHost.js` (`createWildEscrowHost`). `node tools/hostScope.mjs` measured the group: eight members,
63 lines, reads five host names (`modes`, `onlineCheckpoint`, `realmSession`, `townTalk`, `wildAccount`), writes
none, used by three (the drop's receipt, the zone's frame, the room's collect) - handed in, the three calls go through
the module's `held`, `frame` and `collectHeard`. `bootWorld` 21,750 -> 21,688 code lines, and its ceiling back to
21,695, where it stood before FB1015's raise. The pins that read the block by source (`test/systems/fb1014_pvpescrow.test.js`)
read the module, and the bible's anchors name it (`01-Overview/bugs/Field-Bugs-2026-10-15c.md`).

## PASSAGE's merge - the wiring trimmed to fit (2026-10-19)

Not a slice: a pull request whose own wiring took `bootWorld` over. Merging main into PASSAGE and BATCH-SALVAGE
(`03-World/Passage.md`) met LEGIBLE 1's logical-line ceiling: main's `bootWorld` stood at 36,198 of its 36,233, and the
passage's wiring added 66 - 31 over. No raise: the wiring was cut to what only the host can hand. The passage host's
doors are the world's own functions handed as they are (`navalPortList`, `travelViewRouteTo`, `worldMoveBusy`,
`csaStandsOn`, `setTransportModeHere` - each declared above the construction, never in its temporal dead zone) and its
objects (`player`, `townTalk`) rather than a wrapper per field; the purse and the pack are the player entity's own,
read by `src/scenes/naval/passageHost.js` itself (`court.js`); aboard is composed there from the runtime, her deck and
the naval host's boat in play; and the voyage the planner is asked for rides the means of a booked ship's helm
(`tvSeaMeans`' `voyage`) instead of a copy of them. `bootWorld` 36,264 -> 36,230 logical lines, under its ceiling,
which stays. The pins that read the wiring by source moved with it (`passagehost.test.js`, `passageaudit.test.js`,
`ows2_crossing.test.js`), the boat in play now held by behaviour, and 21 mutant records re-aimed and dead.

## STAND-IN-WHOLE - the four spell doors out of buildDungeonContext (FIELD BUGS 2026-10-19f)

Not a slice of the order above: a fix (`11-Multiplayer/World-Bosses.md` section 26) whose door stood in `buildDungeonContext`
four times - `spellOnBoss`, `spellOnCrystal`, `spellOnHost` and `spellOnRival` (and `tellStandIn`, `spellOnStandIn`), each
counting a spell on a relay body's stand-in with its own copy of the counting sinks and popping its own number. The fix's
number - what can land - belonged in one place, so the doors left as one rather than being edited four times.

- THE MOVE, by hand and NOT verbatim: `node tools/hostScope.mjs` measured the group (6 members, 78 lines; reads 12 host
  names - the four bodies' finders, the four land doors, `nextArenaQ`, `hudText`, `opts`, `swayToldAt` - writes only
  `swayToldAt`, which went with it; used by the cast engine's seams, the enchant door and the api). The four doors are one
  door in `src/scenes/gate/standInSpell.js` (`createStandInSpell(host)`: `countOnStandIn` the count, `onBody` the court's
  three, the rival's and his own beside it), the module owning its clock and dice (`now`, `rolls`); the behaviour is the
  doors' but for the fix's number and the riders' `took`. The context constructs it where his door stood - below every
  `const` it hands over by value (the land doors, `nextArenaQ`) - and destructures the five names its seams already called;
  the seams above it call them only inside arrows the built context runs, never during the build's awaits.
- THE FOUR HOSTS: `dungeonContext.js` wired (the court, the Abyss's Hour, an Elite Breach's halls and a bout all run in a
  dungeon context); `world.js` and `exterior.js` unchanged - their `bossSpell` mounts call `modes.dungeonCtx.spellOnBoss`,
  the same api; `worldModes.js` unchanged (it hands the opts through). The serpent's own copy of the door followed with
  BOSS-DOT, below.
- THE PINS, by hand (`PIN MOVED`): the source pins that quoted the doors read the module, and two that quoted three
  copies of one line now drive the one door on the real stand-ins (`fb1018f_turnedblow.test.js`'s numbers by the body
  they met). The mutant records re-aimed by content; the two whose copies are gone retired with them.
- `buildDungeonContext` 8,450 -> 8,312 logical lines; its ceiling 8,601 -> 8,463 (the 151 of room it had, not the
  standard 400 over the new length, which would have raised it - OUTDOOR-LOOT's precedent).

## BOSS-DOT - the serpent's spell door out of bootWorld (FIELD BUGS 2026-10-19f)

BOSS-DOT (`11-Multiplayer/World-Bosses.md` section 27) carries a spell's lasting harm on every body a relay runs, and the
sea serpent's door - `serpentSpellOn`, the fifth copy of the stand-in's door, in `bootWorld` - was the one host copy left.
It went into the module rather than growing there: `createSerpentSpell` in `src/scenes/gate/standInSpell.js` (the count,
the riders, the claim to `serpentHost.handStruck`, its rounds), which `bootWorld` constructs where it stood and asks once
a frame of the serpent's fight (`serpentSpell.frame(fight)`). `bootWorld` 36,181 -> 36,157 logical lines, its ceiling
36,219 -> 36,195. `buildDungeonContext` grew by its wiring alone - the rounds' frame destructured and asked in `drawFoes`,
8,315 -> 8,317, under its 8,463. Pins moved by hand (`serpent4.test.js`, `audit_schools.test.js`).

## OW-DUNGEON-SIZE's move - the dungeons' models out of bootWorld (2026-10-19)

THE OVERWORLD REVISITED (`06-Systems/Travel-View.md`) wires six slices into the streaming host, and `bootWorld` stood at
36,230 of its 36,233 logical lines. The slice that changes OW-DUNGEONS' grow moved OW-DUNGEONS' own host code out first:
`tvDungeonModelList`, `tvDungeonModelLoad`, `_tvDngAt`, `drawTvDungeonModels` and `dropTvDungeonModels` - contiguous
members - to `src/scenes/travelViewDungeonModels.js` (`createTravelViewDungeonModels(host)`) by `tools/hostMove.mjs`:
23 names by value, four live (`_locIndexGen`, `_tvListsReady`, `season`, `tvDngModels` - written, so a getter and a
setter), the two the host draws and drops by returned. 86 logical lines freed (36,230 -> 36,144); the six slices'
wiring took 39 of them back (`bootWorld` 36,183; 36,181 after the merge with main), each slice's behaviour a module of its own
(`scenes/townWalkHost.js`, `scenes/overworldForecastHost.js`, `systems/travel/regionChase.js`, `systems/travel/townWalk.js`,
`systems/weather/owForecast.js`). The ceiling stays. The three pins that lifted the moved code read the host whole now
(`test/hostText.mjs`: `owdungeons`, `fb1009_travelperf`, `ether_ow`), their lifted functions handed `host` for the live
names; 24 mutant records re-aimed by the tool, every one dead. AUDIT OW-REVISITED (2026-10-20, `01-Overview/audits/Audit-Overworld-Revisited.md`): its fixes grew the region's
chase hearing past three lines, so it moved out too - `src/scenes/regionChaseHost.js` (`createRegionChaseHearing`), the
host wiring it in one statement; with the forecast's new inputs and the bands' and raiders' preference for a fresh cell
word, `bootWorld` 36,205 of its 36,233 (36,209 with main merged in the same day).

AUDIT DEX (2026-10-20, `01-Overview/audits/Audit-DEX.md` D11): DEX5 had put the Troll corpse prefab's reach - the rise,
the ash mint and its batch bookkeeping, the `cs` hit's composition - into `buildDungeonContext` (+66 logical lines) and
`createExteriorFoes` (+65), under their ceilings but against this page's rule (the host gains the wiring, not the
feature). It is `src/scenes/corpsePrefabHost.js` now (`createDungeonCorpsePrefabs(h)`, `createStreetCorpsePrefabs(h)`),
each host handing it its doors - its pools, its renderer, its spawn, its hit sender - and nothing more
(`dex5_audit.test.js` holds the hosts to the wiring). C1 added one statement to `bootWorld`'s jump core, where the host's
own ResetState already stood (PlayerGPS's flag beside the host's): within the room the ceiling left for a fix then.
At DEX's merge with main (2026-10-20), main's FIELD BUGS 2026-10-19f had brought the ceiling down to its host (36,183),
and C1's `if (modEvent) resetPlayerGpsState()` - two logical lines - stood `bootWorld` two over. No raise: the rule left
the host for the module whose rule it is - `world/playerGps.js` resets on the jumps PlayerGPS subscribes to (`RESET_ON`,
a load and a fast travel) and the jump core hands it every jump's kind, one statement - and the road trouble's foe
level, a lambda of the host's, left for the enemy table (`characters/enemy/enemyBasics.js` enemyLevelOf), where the
roads' harness reads it too (its own copy still asked `>= 128` after DEX1 gave the host the bit). `bootWorld` 36,185 ->
36,183 logical lines, at its ceiling, which stays; the relay re-hashed in place (world233 then, world234 since SD-SEA's merge; enemyBasics.js is in its
bundle); the C1 pin and its mutants re-aimed, two more for the subscriptions.

## STAR0's move - the exterior town map's door out of bootWorld (2026-10-20)

THE STARFALL (`11-Multiplayer/Starfall.md`) wires a new world event into the streaming host, and `bootWorld` stood at
its ceiling with no room (36,183 of 36,183 logical lines). Its own wiring comes after a move, OW-DUNGEON-SIZE's way:
`toggleExteriorAutomap` - the M key's town map outside (DFU's `DaggerfallUI.cs:633-650`), one member that writes nothing
of the host's - went to `src/scenes/exteriorAutomapToggle.js` (`createExteriorAutomapToggle(host)`) by
`tools/hostMove.mjs`: fourteen names by value, seven live (`activeQuestIds`, `hudArt`, `partyOnMaps`, `questBridge`,
`renameMapBuilding`, `topicTree`, `townBoardMarks` - consts made below it, read at their use), the toggle returned.
67 logical lines freed (36,183 -> 36,116). The ceiling stays; the Starfall's wiring takes its share back (section
STAR5 of its page). Three pin files read the host whole now (`test/hostText.mjs`: `auditdisc28_quests`, `automap_ext`,
`town_marks`), two of their quotes in the moved spelling (`host.activeQuestIds`, `host.topicTree`,
`host.townBoardMarks`); eleven mutant records re-aimed by the tool.

## The Starfall's wiring in bootWorld (STAR4-STAR7, 2026-10-20)

STAR0's 67 lines bought the room; the Starfall spends 54 of them (36,116 -> 36,170 of 36,183). Its host
(`src/scenes/starfall/starfallHost.js`) and its rewards (`starRewards.js`, made by the host) read the world's bindings by
name - one adapter object, its settled bindings by value and every live one through a getter (TDZ: `chatNotice` is made
below the construction) - so the host's scope holds the adapter and one hook at each door it uses: the frame, the
lights, the draw, the sky, the flash, the senses' candidates, the compass, the held map, the Timers, the grass, the
hub's event, the cell's words, the spoils' crash door and the realm save's two hooks, and one sound in the set powers'
voice. The spoils' one lock moved OUT of the host to its pool's own home (`src/scenes/spoilsPool.js` `spoilsLock`), so
every pool's host takes the same one. At the merge with main (2026-10-20) - main's FIRM-STARS had raised the ceiling to 36,187 for its
one statement, and DEX's audit had brought `bootWorld` down to its ceiling - the host stands at 36,174 of 36,187.

## OW-HITCH's move - the ground sets out of bootWorld (2026-10-21)

OW-HITCH (`07-Rendering/Performance-Priority.md`) changes how a ground set is made - its water marked a record a breath,
uploaded a few layers a breath, once a key - and that set's one home (R9's `groundLayersOf` and `loadGroundSet`, two
members that wrote nothing of the host's and read eight of its names) stood in `bootWorld`. It went out rather than
growing there: `src/scenes/groundSets.js` (`createGroundSets`), written as a module the host wires (fishHost.js's
shape, not a verbatim move - its new behaviour is in it), handed the renderer, the texture door, the grass switch, the
stream's breather and the five maps the grass and the water read, and answering `loadGroundSet`. `bootWorld` 36,151 ->
36,138 logical lines, its ceiling 36,171 -> 36,158. The pins that quoted the moved code read `groundSets.js` now (twelve
files, listed in the OW-HITCH record), and seven mutant records were re-aimed there.

## SEA-DECK's wiring - ten lines raised, the carry a module (2026-10-23)

SEA-DECK (`01-Overview/bugs/Field-Bugs-2026-10-23.md`) makes the sea's own ships carry whoever stands on their decks. The
carry, the place it says and the deck a reader stands a body on are a module (`scenes/naval/seaDecks.js`), wired by the
naval host (`createNavalHost` 6,213 -> 6,228, under its ceiling). What could not live there is the host's own hand on the
player and the camera: the naval deps' `deck` door (the body carried, its facing turned, the eye taken again - the sea
poses its ships after the eye is taken) and the three answers it shares with CSA-K's carry of another player's boat,
hoisted out of `csaPeersFrame` so the two are one (`deckMayCarry`, `deckGround`, `deckCarry`). DECK-POSE had left
`bootWorld` at its ceiling (36,284 of 36,284); these are ten logical lines, and the ceiling took them with the reason
beside it - 36,296 at the merge with main, whose own host had grown to 36,283 inside its room. The four rigs that lift `csaPeersFrame` lift the three answers with it.

SEA-DROPS (`07-Rendering/Performance-Priority.md`) took one more: the boats' collider sync (`csaSyncColliders`) tells the
collider its posed buckets moved (`posesMoved`) once it has carried them - the sync is the one place that moves them, and
`player/collider.js` holds the rest. 36,296 -> 36,297, the reason beside it; 36,295 at the merge with main, whose own host had come down to 36,282.

