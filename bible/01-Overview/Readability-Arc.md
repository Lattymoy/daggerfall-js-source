# LEGIBLE - code a person can read

Opened 2026-10-19. The owner: *"So how can we alter variables and codebase stuff to make it less assembly and more
human readable?"*, then *"I wanna take this all on. No band aids. A true and accurate overhaul"*.

HOST-SPLIT (`Host-Split.md`) takes the hosts apart: it is the structure half of this work. LEGIBLE is the other
half - the names, the lines, the comments and the shapes inside every file - and the tooling that has to change
first so that work can happen at all.

## Why

Measured on main at a75fcd062e (2026-10-19):

| What | Measure |
|---|---|
| JavaScript under `src/` | 830,313 lines in 2,156 files, 54 MB (about 13.5M tokens) |
| Lines longer than 200 characters | 9,979 |
| Lines whose comment is led by a slice or audit tag (`// AUDIT WATER-NEXT P1`, `// DW-C`) | about 36,000 |
| Logical lines per code line in the hosts | 1.2 to 1.9 - two statements on most lines |
| Mutant records that quote source text exactly | 65,940, in 2,206 lists, covering 2,140 files |
| Cites in the bible that quote a line of our code | about 1,640 |
| Commits to main, the fourteen days before | about 3,400 |

A line of `bootWorld`, as it stood:

```js
if (p.dwTerrain) { renderer.destroyWaterSurface(p.dwTerrain); p.dwTerrain._dead = true; p.dwTerrain = null; }   // DW-C
```

Four statements, a one-letter name for the object everything hangs off, a two-letter abbreviation for the system
(`dw`, Deep Waters), a field invented on a plain object (`_dead`), and a comment that names a ticket instead of
saying why. Every one of those is a choice the tooling rewarded:

- **The ceiling counted physical lines**, so splitting that line for a reader cost four lines of room and cramming
  it saved them (fixed by LEGIBLE 1, below).
- **Mutant records and cites quote text exactly.** Reformatting a line, or renaming a variable in it, stales every
  record and cite that quotes it, so the cheapest change was always the one that left old text alone - and a
  comment explaining the code was sometimes kept on the same line on purpose, "so no cite below it moves".
- **Nothing owns layout.** There is no formatter, and lint has no rule on line length or statements per line.

## The standard

What LEGIBLE leaves behind, in every file it has been through:

1. **One statement per line**, laid out by the formatter, never by hand.
2. **Names say what a thing is.** No abbreviation a newcomer would have to look up, unless it is in the glossary
   (`DFU`, `HUD`, `UV` - words the field uses). `pixel`, not `p`; `deepWaters`, not `dw`.
3. **Comments say why, in plain words.** The slice or audit that made a line is history: it lives in git and in
   this bible, and the code's comment says what a reader needs - the reason, the trap, the DFU member it follows
   or departs from.
4. **Shapes are declared.** An object that travels between functions has a typedef or a class; no field is
   invented on a plain object where it is used.
5. **A file and a function fit in a head.** That is HOST-SPLIT's work, and LEGIBLE does not duplicate it.

## Accuracy - how each change proves it changed nothing

"Accurate" means the game behaves the same after every slice. How a slice proves that depends on the kind of
change:

- **A mechanical change** (the formatter, a rename) is proved, not tested: the program before and after is
  compared as a syntax tree - identical apart from layout and comments for the formatter, identical apart from the
  renamed names for a rename (`node tools/sameProgram.mjs --against <rev>`, LEGIBLE 2). A slice that cannot pass
  that comparison is not mechanical, and is judged as a rewrite.
- **A rewrite by hand** (a function made readable) is held by the suite and by the mutation lists: every mutant
  the file's records name must still apply and still die. A record the rewrite moves is re-aimed by content, in the
  same change, as `mutantdrift.test.js` demands.
- **The pins move with the text.** A mechanical change carries every mutant record and cite with it by running
  the same change over both sides: the record's file with and without its mutant, both transformed, then compared
  again to find the record's new text (`node tools/carryPins.mjs --transform <module>`, LEGIBLE 2). Nothing is
  re-aimed by hand that a tool can carry.

## The order

Each slice is one pull request. A slice that touches every file needs a quiet window on main, and that window is
the owner's to call.

| Slice | What | Needs |
|---|---|---|
| LEGIBLE 1 | The ceiling counts logical lines, so it is blind to layout | shipped (below) |
| LEGIBLE 1b | Testing.md's file table closed; the suite counts itself | shipped (below) |
| LEGIBLE 2 | The syntax-tree comparison that proves a mechanical change, and the carrier that moves mutant records and cites through one | shipped (below) |
| LEGIBLE 3 | The formatter: one pinned version and configuration, the whole tree formatted folder by folder with its pins carried, a `--check` in CI and `.git-blame-ignore-revs` | the tool, the pilot and the rollout shipped (below); 548 files aside, a window for each |
| LEGIBLE 4 | Lint that holds the line: one statement per line, no comma sequences, a ratchet on new short names | shipped (below; the short names with LEGIBLE 5's glossary) |
| LEGIBLE 5 | The glossary (`Glossary.md`) and the renames, one abbreviation per slice (`dw`, `csa`, `wod`, `lpt`, ...), by the language service and carried like the formatter | the glossary and the short names' ratchet shipped (below); each rename a quiet window per abbreviation |
| LEGIBLE 6 | Comments: a register of every tag and the page that records it, then tag-led comments rewritten as reasons, file by file | - |
| LEGIBLE 7 | Shapes: typedefs for the objects that travel (a terrain pixel, a face, a foe, an item), `// @ts-check` as each file is done | - |
| LEGIBLE 8 | Rewrites by hand, function by function, most-read files first (by commits touching them), held by the suite and the mutants | - |

LEGIBLE 3 depends on LEGIBLE 2: formatting 830,000 lines without a carrier stales most of the 65,940 records at
once. LEGIBLE 5 and later depend on 3, so their diffs are names and words, not layout.

## Cost

Measured against the per-token prices of 2026-10-19, before any fix rounds:

- LEGIBLE 1 to 5 are tools and scripts - the work of writing them, not of reading 13.5M tokens. Well under $300 in
  all, at API prices.
- LEGIBLE 6 and 8 read and write by hand: about 400 sessions of 2,000 lines each, $3,000 to $10,000 at API
  prices, or that share of a subscription's capacity.
- CI costs nothing: the repository is public, and every runner it uses is GitHub's standard one.

## Decisions the owner holds

- **The quiet windows.** LEGIBLE 3 and each rename in LEGIBLE 5 touch most files; a pull request open across one
  will conflict on nearly every file it touches. When, and for how long, is the owner's call.
- **The formatter as a dependency** (LEGIBLE 3).
- **The three new ceilings** LEGIBLE 1 added (below) - a tightening, made because the old count let crowded
  modules pass under the line.

## LEGIBLE 1 - the ceiling counts logical lines (2026-10-19)

THE CEILING IS BLIND TO LAYOUT. `test/scenes/hostceiling.test.js` measured each host in code lines - physical
lines holding anything but comments - so the same code crowded onto one line cost a quarter of the room it took
spread out, and splitting a crowded line for its reader cost room. It now measures LOGICAL lines
(`tools/hostScope.mjs` `logicalLines`): a statement, an entry of an object literal or a class, a switch case, or an
expression arrow's implicit return. Braces, blank lines, comments and the declaration in a loop's head are no
weight. A fixture of every kind of logical line, crowded onto one line and spread over twenty-six with a comment,
measures 20 both ways.

A plain statement count was the first candidate and was not enough: a host grows by entries in the objects it
returns (`onSomething: () => ...`), which hold no statement at all.

The conversion gave no host room it did not have. Each ceiling is the host's logical length plus the room it
already had, converted at its own ratio; `ROOM` went from 250 to 400 and the slack line from 500 to 800, at the
1.6 logical lines per code line the hosts measured:

| Host | Code lines | Old ceiling | Room | Logical lines | New ceiling |
|---|---|---|---|---|---|
| `bootWorld` | 21,153 | 21,186 | 33 | 36,177 | 36,233 |
| `createWorldModes` | 7,137 | 7,138 | 1 | 10,996 | 10,998 |
| `buildDungeonContext` | 5,322 | 5,446 | 124 | 8,405 | 8,601 |
| `bootExterior` | 3,198 | 3,446 | 248 | 5,049 | 5,441 |
| `createNavalHost` | 3,710 | 3,942 | 232 | 6,089 | 6,470 |
| `createComeSailAwayRuntime` | 2,066 | 2,315 | 249 | 2,484 | 2,783 |
| `_message` | 904 | 1,093 | 189 | 1,693 | 2,046 |
| `createExteriorFoes` | 1,769 | - | - | 2,943 | 3,343 |
| `createFpArm` | 1,999 | - | - | 2,852 | 3,252 |
| `createEgClient` | 1,432 | - | - | 2,775 | 3,175 |

KNOT, the length past which any function is a knot that must hold a ceiling, went from 2,000 code lines to 2,400
logical lines - not 3,200, the plain conversion, because at 3,200 Come Sail Away's runtime (2,484, the least
crowded knot) would have stopped being one and dropping its ceiling would have failed nothing. At 2,400 every knot
the old line held is still held, and three modules the old count passed because their lines are crowded
(`createFpArm` stood at 1,999 code lines against 2,000) are held now too, at their length plus `ROOM`.

The walk for knots used to skip any file shorter than KNOT physical lines. A crowded file can hold more logical
lines than it has physical ones, so that bound no longer held: it skips a file shorter than two characters per
logical line instead (`a;` is the shortest), and a fixture of a knot crowded onto one line is found. The test
takes about five seconds longer, from parsing every file large enough to hold a knot.

Mutants: `tools/mutants/legible1.json`, eight, all dead - a loop head counted; a destructuring entry counted;
object entries not counted; class members not counted; switch cases not counted; expression arrows not counted;
braces counted; a crowded file skipped by its line count. Six records of `tools/mutants/hostsplit.json` were re-aimed
by content at the converted rows and the new walk, all dead. One was retired: `HOST-SPLIT-the-ceiling-counts-comments`
mutated `codeLines`, which is gone - a syntax tree holds no comments, so there is nothing left for that mutant to
break.

## LEGIBLE 1b - Testing.md's file table closed (2026-10-19)

The owner: *"Should we get rid of testing.md"*, then *"Do both"*.

`Testing.md` was 5.7 MB, 99% of it one table: a row for every test file, with its test count, and one line with the
suite's total. `test/bible/manifest.test.js` failed the suite unless every count and the total matched the tree, so
every pull request that added a test edited the same line, and any two of them conflicted on it. 2,167 of the 3,407
commits to main in the fortnight before touched the page.

What a row said, its test file mostly says already: for half the rows, at least 80% of the row's words are in the file
it describes, and the rest is paraphrase, dates and cross-references. Copying the rows into the files' header comments
would have added 5.4 MB of mostly repeated prose to the tests, so the table was closed instead, whole:

- **`09-Testing/Testing-Rows-2026-10-19.md`** holds the 3,571 rows as they stood, in their order, under their own
  headings, with the 14 main added before this merged. It is a record: nothing adds a row, and `manifest.test.js` holds it at 3,571. It cannot be frozen byte
  for byte, because its rows carry 55 cites into our code and 5 into `Port-Ledger.md`, which `npm run cites` keeps
  true like any other page's.
- **`Testing.md`** keeps its prose - how the suite runs, the two tiers of data, PY1 and EF1 - and says where the
  table went. The suite counts itself: the runner reports what ran, and the landing page counts the declared tests
  from the tree when it builds.
- **`manifest.test.js`** holds three things now: test file names stay unique (the bible names a test by its file name
  alone), `Testing.md` grows no table or total again, and the closed table keeps its 3,571 rows. Its second test, that
  a row whose count moved names its newest pins, went with the counts it guarded.
- **The pins that read the table** were kept, pointed where the text now stands. A slice's "records" pin that its
  testing row exists (WW3, WEATHER2a-d, WIND3/4, HT2, TEX1, BA1, IF1, AUDIT-DW) reads the closed table; a pin that a
  page may not teach a retired claim (AUDIT 39r, the lycanthropy timer, WORLD6b-iii's suppressed tick, ROAD-G's
  struck rationale, D1-NEAR's California) reads `Testing.md` and the closed table together; `citedrift`'s two cites
  read the closed table. AUDIT 58 kept its claims about Port-Status, a record of 2026-09-02, and dropped the two that
  read the manifest's Suite line, which this slice retired on purpose.
- `test/ui/enhanced/landing.test.js` held the landing page's test count equal to the Suite line; it holds it to an
  independent walk of `test/` now.

## LEGIBLE 2 - the proof and the carrier (2026-10-19)

The owner: *"Do both"*, then *"build everything in one PR"*. Two tools that every mechanical slice after this one
stands on, and no slice of their own yet to use them - the formatter is LEGIBLE 3.

**`tools/sameProgram.mjs`** compares two versions of a file as syntax trees (acorn, with eslint-scope for names) and
says whether they are the same program, and where they first differ if not:

- Layout, comments, quote style, redundant parentheses and trailing commas are not in the tree. A literal is its
  value (`1e3` and `1000`), a template its text, a regular expression its pattern and flags.
- A variable is compared by the declaration it resolves to, and the two versions must pair their variables one to
  one. It may change its name only where the change was asked for (`--rename old=new`), and a rename that makes a
  name reach a different binding - a parameter renamed onto a module constant's name - breaks the pairing and fails.
- Names other code reads keep their spelling: exported declarations, the outer names of import and export
  specifiers (`import { dw as deepWaters }` is a rename; `import { deepWaters }` is not), property keys, member names,
  labels. A shorthand property (`{ dw }`) is both a key and a variable, so its rename is `{ dw: deepWaters }`.
- A file with `with` or a direct `eval(` takes no rename. And one change no tree holds: a renamed function or class
  carries its new `name` at run time, which the slice making the rename must check nothing reads.
- `node tools/sameProgram.mjs --against <rev>` proves every changed file in the working tree against a revision; a
  file added, deleted or renamed is not a mechanical change to it, and says so.

**`tools/carryPins.mjs`** carries the mutant records and the cites through any change written as a
`transform(source, file)` function:

- A record is carried by running the transform over the file with and without its mutant: the outputs differ only
  where the mutant does, so the stretch between their common start and end, widened to whole lines and then until it
  stands once, is the record's new text. Every carried record is checked to reproduce the transformed mutant exactly.
  What cannot be carried - a stale record, a mutant the transform erases or cannot run on - is reported, never
  guessed. A record whose text stands twice is carried at its first copy, as `tools/mutate.mjs`
  applies it, and comes out naming that site alone.
- A cite is carried by lining the two versions up token by token (comments included): the token where the quote
  starts finds its new line, and a line inside a block comment keeps its offset in the comment. The new anchor is
  written by `tools/citeAnchor.mjs`'s own rules, as `npm run cites -- --apply` would write it; where a crowded line
  became several and the first takes no quote, the next one that does is used. An anchor written in code outside a
  comment is a person's to write (citeAnchor's own rule), and is reported.
- The records are carried on worker threads (`--jobs`, every core by default), each heap capped.

Proved on the tree, with `test/breakLines.mjs` - a layout-only change, a line break after every `;`, `{` and `}`
that has code after it, which splits crowded lines as a formatter would - standing in for the formatter:

- The 577 mutant records on eight files (`gambitPatrons.js`, `stir.js`, `foeBodies.js`, `partyTravel.js`,
  `smithItems.js`, `revenantUnquiet.js`, `hostScope.mjs`, `hostceiling.test.js`) carried, none refused, and every
  transformed file the same program.
- The anchors into the eight most-cited files under 120 KB (`townTalk.js`, `input.js`, `dungeon.js`,
  `spellbookWindow.js`, `save.js`, `notebook.js`, `listPicker.js`, `enchantments.js`): 231 carried, 374 records with
  them, and 4 reported - three anchors written inside test strings, and one line the stand-in transform splits inside
  a parameter pattern (`magicRound({` / `round, entity, item, ctx }) {`), which no line of it can quote.
- `world.js`, the biggest file and the most pinned: 3,781 records carried in 263 seconds on four cores, and 271 of its
  272 anchors - the one left is another call the stand-in splits after its `({`. Two of those records are on
  mutantdrift's CARRIED_AIM, naming two sites each; carried at their first copy, as `tools/mutate.mjs` applies them,
  they come out naming one, and the slice that carries them takes them off that list.

The carrier's first run on `world.js` was killed at 13 GB. A carried record's text was a slice of the transformed
mutant, and in V8 a slice keeps the whole string it was cut from alive: 3,781 records held 3,781 copies of a 3 MB
file. The records are copied out of their file now, and the same run peaks at 1.2 GB.

## LEGIBLE 3 - the formatter, and its pilot folder (2026-10-30)

Taken in the cleanup session of 2026-10-30, the owner: *"I want to take this all on. A full session and take
autonomy"* - the two decisions this page left to the owner, the dependency and the window, taken for one folder.

- **One version, one configuration.** Prettier 3.9.10, pinned exactly in `package.json`, with `.prettierrc.json`
  (120 columns, single quotes, trailing commas, semicolons). `tools/format.mjs` is the carrier's transform: Prettier 3
  answers asynchronously, so it runs on a worker and `transform` waits on a shared flag.
- **The folders it owns.** `tools/formatted.json` lists them; `.prettierignore` is written from that list (`node
  tools/format.mjs --ignore`), so an editor's format-on-save leaves every other file alone.
- **The check.** `test/tooling/legible3_format.test.js` fails on a listed file the formatter would change, so CI's
  suite is the `--check` (four mutants, all dead).
- **The pilot, `src/poi/`.** 23 files, quiet that week. `node tools/carryPins.mjs --transform tools/format.mjs
  src/poi/*.js --write` carried all 299 mutant records and 22 cites; `node tools/sameProgram.mjs --against HEAD` proved
  all 23 files the same programs. The seventeen lists holding them, 578 records, all dead after the format. The
  commit is in `.git-blame-ignore-revs`.

The next folder is the same three commands, in a window the owner calls. A folder's tests that match source text by
regular expression are not carried; the pilot's 19 test files passed unchanged.

## LEGIBLE 3b - the rollout (2026-10-31)

The owner, the same session: *"Finish the not done"*. The tree was formatted folder by folder, each in its own
commit with its pins carried, and main merged in over it.

- **Coverage.** 3,268 of 3,816 code files (`src/`, `server/src/`, `server-account/src/`, `tools/`, `scripts/`) are on
  `tools/formatted.json`. A folder whose files did not all carry lists the ones that did, file by file.
- **The proof.** Each commit ran `node tools/carryPins.mjs --transform tools/format.mjs <files> --write`, then
  `node tools/sameProgram.mjs` against the pre-format copies: every file the same program.
- **The text pins.** A test that reads a source's text by regular expression is not a mutant record.
  `tools/carryTextPins.mjs` carries such a pin token by token. 139 files whose pins it could not carry were taken
  back to their old text, with their records.

**Set aside: 548 files.** 18 are the files with more than 400 mutant records each, `world.js` (3,941) the largest;
`net/npcChapterLaw.js` (451) is the one that heavy which carried. A branch open across one of them stales most of its
records, so each needs a quiet window on main of its own. A host's ceiling is in logical lines, so formatting moves no
ceiling. 139 are the files taken back for their text pins. 318 the rollout's runner set aside: the carrier refused one
of their records or cites, a test that quotes them failed after the format, or their chunk failed whole. 74 are files
added since it began, in folders not yet on the list: 71 of main's, and three of the five modules moved out of
`bootWorld`, kept in the host's own layout, which their pins read through `hostText`.

**The relay.** 150 of the relay's 181 files are formatted, so its bytes changed though nothing it does did:
world299, world298 until main's LITANY-STAND took it (`test/net/relayversion.test.js`). The 312 formatting commits are in `.git-blame-ignore-revs`.

**The audit's tool findings** (2026-10-31, an independent read of the tools; each fixed with its tests and mutants,
all dead). `.prettierignore` opened every file of a listed folder, so format-on-save rewrote two READMEs `--check`
never reads: it opens only `.js` and `.mjs` now, and Prettier formats exactly the 3,268 listed files. A listed path
gone named itself instead of crashing the check. The text-pin carrier's literal run could come from inside a group,
an alternation, an escape or a counted repeat, or ignore the `i` flag, and skip a pin silently. `unreached.mjs` read
a glob by its prefix and lost an import that followed a line with no semicolon. `shortNames.mjs` counts a class
expression's name; an import's it leaves to the export, said in its header.

## LEGIBLE 4 - lint that holds the line (2026-10-30)

- **No comma sequence** in shipped code (`no-sequences` over `src/`, the two Workers, `tools/` and `scripts/`). The
  tree held eight. Seven are now the statements they hid (`quickslots.js` twice, `dungeonContext.js` landOnRival,
  `townTalk.js` askWork, `world.js` bayScan, `tamrielTrace.js`, `pixelBuildSweep.mjs`); their five text pins and four
  mutant records were re-aimed, all dead. bayScan's two statements raised `bootWorld`'s ceiling by one, said beside it.
  The eighth, `egFragLaw.js`, is in the relay's bundle: it rode the undeployed `world295`, re-hashed in place (the
  live relay answered `world294`), and is `world298` since the merge of main.
- **And in parentheses** (AUDIT, 2026-10-31). At its default the rule lets `(act(), answer)` pass, the form the
  formatter writes, so the eight were the bare ones only: 49 parenthesized stood in 26 files. The rule is strict now,
  and `eslint.config.js` holds those 26 files at their counts (`SEQUENCES_HELD`). `test/tooling/legible4_sequences.test.js`
  fails a count that rises or falls without its number (four mutants, dead), so the list only shrinks.
- **One statement a line** (`max-statements-per-line`, 1) in the folders the formatter owns. `eslint.config.js` reads
  `tools/formatted.json`, so a folder takes the rule in the change that formats it. The rest of the tree held 37,500
  crowded lines when this was written; they go folder by folder with LEGIBLE 3.
- **The short names** are held with LEGIBLE 5's glossary (below).

## LEGIBLE 5 - the glossary, and the short names held (2026-10-30)

`Glossary.md` lists the short names code may use (loop counters, coordinates, `dt`, `px`/`py`, `id`, `e`, a
comparator's `a`/`b`, the WebGL2 `gl`, English words used as words), the field's words, and the abbreviations being
retired (`dw`, `csa`, `wod`, `lpt`, `hcc`, `mwv`). `tools/shortNames.mjs` reads it: a binding of one or two characters
the glossary does not allow, or an abbreviation it retires, is counted per file. On the day it was written the tree held
85,984 of them in 2,776 files - `p`, `r`, `s`, `c`, `t` and their kind. `test/tooling/legible5_shortnames.test.js`
holds each file to `tools/shortNamesBaseline.json`, which only goes down (twelve mutants, all dead). A merge from a base
without the law admits that base's own counts (`--seed REF`), as PLAIN-TEXT's does, and `tools/hostMove.mjs` carries
a move's names to its new module (`carried`: never more than the host held).

The renames are still one abbreviation a slice, by the language service, carried like the formatter, each in a window
the owner calls.

