# AUDIT TIDY (2026-10-16) - the tree filed into folders, audited

The owner, of TIDY (pull request #948; `01-Overview/Code-Map.md`; branch `ccr-59ab6f1a-tv9pb1` at 46f0270c): **"Audit
this. Ensure perfection"**. This page is the findings, each with its verdict. What the audit changed is written into
the pages and the code as they now stand, each marked AUDIT TIDY and its id.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN snapshot (a worktree at 46f0270c - `Home.md`'s DO NOT FIX WHILE
THE VERIFIER IS READING: the fixes went into the branch while the lanes read the snapshot), each told to prove a
finding - a repro against the real code, or the code quoted with a concrete trace - before reporting it; then the
author's pass, every finding reproduced before it was acted on, and every fix proven by planting what it guards and
watching it go red:

| Lane | Over | How |
|---|---|---|
| TOOL - the move tool | `tools/moveModule.mjs`, its pins and its mutants | adversarial inputs through the exported functions; 15 probe mutants in a scratch copy (13 survived); the real tree searched for each false-rewrite class |
| SRC - the code's moves | 762 modules into 134 folders, "no behaviour moved" | 3,919 changed files normalized through the ledger and diffed; 42,468 relative specifiers resolved; both production builds counted file by file; the relay and the account Worker bundled with esbuild and compared |
| TEST - the moved tests | 3,242 test files out of one folder | the whole suite on main and on the snapshot, per file (pass, fail, skip, assertion counts); an fs watch on both; 125 negative pins read against their subjects; every list of tests |
| MERGE - the merge of main | c7e89a2b, main's 37 commits into a tree that had moved | main's 10,536 added lines found in the snapshot, a three-way line count over 240 files, the merge redone independently and compared byte for byte |
| DOC - the record | Code-Map, Home.md, Testing.md, the PR's text | every number recounted, every path resolved, every statement about a tool read against its code |

What reached a player: nothing (the branch is unmerged, the relay undeployed). On the branch, the production build
went out without the quest pack, Dynamic Skies' presets and every Eye of the Beholder and class-skin sprite (SRC-1),
and eleven tests passed while checking less than on main (TEST-1..TEST-5, TOOL-1).

## Findings

### The author's pass

| # | Sev | Finding | Verdict |
|---|---|---|---|
| A-1 | HIGH | `intro-quality.yml` ran on `src/ui/intro*.js`; the four intro modules moved to `src/ui/intro/`, where the glob matches none - an intro change would have stopped running its workflow, silently. A glob is no path the tool rewrites | FIXED: `src/ui/intro/**`; the tool names a workflow glob that matched a moved file where it stood and not where it goes (`globRe`); every other workflow and config glob checked against main's tree - none lost a file; pinned, mutants |
| A-2 | NOTE | The intro workflow's `cinematic` job was cancelled on the PR at its 25-minute limit | NOT TIDY'S: it has been cancelled at that limit on every pull request that ran it since 2026-10-10 (runs 20-27) - `npm run check` in series outgrew it. Left, and named to the owner |

### Lane SRC - the code's moves

| # | Sev | Finding | Verdict |
|---|---|---|---|
| SRC-1 | HIGH | Three moved modules kept eleven `import.meta.glob` patterns a folder short (`../../vendor/...` from a folder deeper: `src/vendor/`, no such folder). Vite ships an empty map and says nothing; each module guards the glob with `IN_BROWSER`, so node and the suite saw `{}` before and after. The build went from 20,525 files to 16,675: no quest pack (`questData.js`), no Dynamic Skies presets (`dynamicSkiesAssets.js`), no Eye of the Beholder or class-skin sprite (`eotbSprite.js`, whose static import five lines up WAS re-based) | FIXED: re-based (the build is 20,525 files again); the tool re-bases a moved module's globs (GLOBBED) and names a staying glob a move empties; `tidy1_codemap` holds every glob in the code to a folder that stands and files in it (the locale packs' patterns empty on purpose, named); RR3's and WA1's pins had quoted the short spelling; mutants |
| SRC-2 | LOW | `tools/mutation/selfref.mjs`, `teststruct.mjs` and `graph.mjs` read `test/` one level - 0 tests where there were 951 | FIXED: recursive, `selfref`'s import pattern at any depth |
| SRC-3 | NIT | "Only specifiers and paths changed" was not literally true of five tooling files (their sweeps were made to recurse) | FIXED in the pull request's text |
| SRC-4 | NIT | `tools/profReticleProbe.mjs` still went to the profession HUD's old address on the dev server (two lines above one that was re-based); a comment in `net/guild/guildBook.js` named the online homes' module one folder short | FIXED: both; the tool reads a root path after a host; pinned, mutant |
| SRC-5 | LOW | `worldOfDaggerfall.js` loose beside its own folder; `paperdollViewer.js` beside `src/tools/paperdoll/`; four `src/tools/enhanced*` labs with no folder; `src/systems/grammar/` and `src/tools/paperdoll/` hold fewer than three; Code-Map's arena count said 2 in `src/ui/` (4) | FIXED: moved into their folders (the lab pages follow), `src/tools/enhanced/` mapped, the two small folders named as older than the map, the count corrected |

### Lane TOOL - the move tool

| # | Sev | Finding | Verdict |
|---|---|---|---|
| TOOL-1 | HIGH | Four negative pins passed whatever their subject imported: each quoted a spelling (`from './hudLayout.js'`, `/from '\.\.\/ui\//`, ...) that no longer resolves from where the subject moved, and the tool re-bases what a file HAS, never what a pin says it must not (hudhelm twice, lootbanner, tamriel) | FIXED: each spelled at any depth and proven red on a planted import; the tool names a negative pin whose quoted spelling names nothing from its moved subject; pinned, mutant |
| TOOL-2 | MED | QUOTED rewrote quotes about files that never changed (a named file that KEPT the spelling was no veto - the pin for it fed a case `planMove` never builds), and could rewrite a test's own import | FIXED: a named file that kept a spelling vetoes it (named, not guessed); a text's own import lines are never a quote; pinned, mutants |
| TOOL-3 | MED | Moving a frozen file rewrote its fixtures (25 lines of `tidy1`'s, one into a syntax error) | FIXED: a frozen file re-bases its top-level lines alone; pinned, mutant |
| TOOL-4 | MED | A file directly under `src/` or `bible/` had its bare name treated as its src spelling - moving `main.js` would have rewritten 366 mentions, name-only cites among them | FIXED: a bare name is a name, kept; pinned, mutant |
| TOOL-5 | MED | A moved `.css`, `.sh` or `.glsl` was looked for by a fixed list of extensions - none of them, silently | FIXED: the moves' own extensions; pinned, mutant |
| TOOL-6 | LOW | `require.resolve`, `import.meta.resolve`, a path after a host or in a GitHub link were not read, and the "no address left" gate checked the tool with the tool | FIXED: the two resolve forms and the host form read; the gate also searches every gone path as a word in every text (a GitHub link caught that way, proven on a plant); pinned, mutants |
| TOOL-7 | MED | The command line was unpinned: 13 of 15 probe mutants survived (the relay's refusal off, BROKEN's refusal off, `--fixup`'s filter, a rename allowed, and nine guards) | FIXED: the command line run in a scratch git repo (refused without `--relay`, a rename, colliding moves, a BROKEN import; a move made with its ledger; `--fixup` mending a branch and leaving a path whose destination is gone; a REVIVED path refused) and a pin for each guard; every probe now a dead mutant |
| TOOL-8 | MED | `--plan` did not check its moves against each other: two to one place moved one and failed the second with nothing rewritten | FIXED: refused before any move; pinned, mutant |
| TOOL-9 | LOW | `--fixup` re-based an old path tracked again beside its moved file (a merge kept both), keeping the duplicate alive | FIXED: REVIVED, refused; pinned, mutant |
| TOOL-10 | LOW | A `../net/x.js` in `server/` (its own tree's) could be rewritten as the client's | FIXED: a server tree's own spelling is its own; pinned, mutant |
| TOOL-11 | LOW | The gate spent 32 of its 43 seconds computing BLIND lines it threw away | FIXED: `planMove(..., { blind: false })` |
| TOOL-12 | NIT | The tool's header and Code-Map disagreed with the code (an escaped path "no path to rewrite", "only those four forms", two stale test paths) | FIXED: both rewritten to the tool as it stands |

### Lane TEST - the moved tests

| # | Sev | Finding | Verdict |
|---|---|---|---|
| TEST-1 | HIGH | HARD3's `@ts-check` gate read `src/render` and `src/net` one level (`jsIn`): 82 and 94 files where there were 97 and 175 - a module in a feature folder could drop its `@ts-check` unseen; the batch writers' sweep the same over four layers | FIXED: `jsIn` recurses; proven red on a deleted `@ts-check` |
| TEST-2 | HIGH | ENH-NOTICE3 swept `src/systems` one level, and its spelling fit depth one only | FIXED: recursive, at any depth; proven on a planted import |
| TEST-3 | HIGH | HARD1's `destroy()` sweep, G3's held-keys owners and the keydown hosts read `src/scenes` one level (95 of 142) | FIXED: recursive; each proven red on a planted file in `scenes/decor/` |
| TEST-4 | HIGH | = TOOL-1 | FIXED there |
| TEST-5 | MED | retro1's settings arm and modsonline's `net/` arm lost one alternative each to depth | FIXED: at any depth; proven on plants |
| TEST-6 | MED | = SRC-2 | FIXED there |
| TEST-7 | NIT | Four comments name tests that do not exist | NOT TIDY'S: absent on main too (`auditpartyrest`, `waterback`, `datasourcepicker`, `eotb_playerbillboard`) |

A sweep's narrowing is what the fs watch could not see, so the author's pass ran every test that sweeps under a
preload logging each non-recursive `readdirSync` of a folder a move emptied, with the line that called it: six call
sites read such a folder and never its new subfolders - TEST-1..3's five, and `tidy1`'s own check that no Come Sail
Away module is loose, which is meant to read one level.

### Lane MERGE - the merge of main

| # | Sev | Finding | Verdict |
|---|---|---|---|
| MERGE-1 | NIT | auditbounty1's message still said world210 over a world211 assert | FIXED |
| MERGE-2 | NIT | `soc1.json`'s S38 note had no line for world211 | FIXED |
| MERGE-3 | NIT | A fixture string in `l10n4_hardcoded` (the import of a temporary tree's `ui/a.js`) was re-based by the move | FIXED: put back by hand. A fixture's text that spells a subject's import reads exactly as a pin's quote of it; the tool now leaves it when a file the test names kept that spelling (TOOL-2), and otherwise cannot tell - the move's diff is read for it |

Nothing main did was lost, garbled or doubled: 10,490 of its 10,536 added lines are verbatim in the tree and the 46
others are the relay pins carried to world211 with main's text intact, the Suite line and the recursive module count;
the merge redone independently equals c7e89a2b in 193 files byte for byte, and in the 47 that conflicted keeps every
line outside the conflicts in order.

### Lane DOC - the record

| # | Sev | Finding | Verdict |
|---|---|---|---|
| DOC-1 | MED | "No game behaviour moves" was false (SRC-1), and Code-Map's list of forms had no glob | FIXED with SRC-1; the list rewritten |
| DOC-2 | MED | Enhanced-AI-Arc's law "before filing an audit, `ls bible/01-Overview/Audit-*.md`" listed nothing | FIXED: `audits/Audit-*.md` |
| DOC-3 | MED | CLAUDE.md named `test/manifest`; Code-Map called `test/bible/` "the bible's gates" (two of the six are there) | FIXED: `test/bible/manifest`; the row names where the other four run |
| DOC-4 | MED | "Every list of tests walks test/ recursively" overclaimed (SRC-2), and the l10n route brief said `grep test/*.test.js` | FIXED with SRC-2; the brief greps recursively |
| DOC-5 | LOW | Code-Map and the PR said 258 dated records among 16 overview pages | FIXED: 263 among 11 then (12 with this map) |
| DOC-6 | LOW | = SRC-5's arena count | FIXED there |
| DOC-7 | LOW | "testTimes and the bible's mentions find a test by its name" - they spell its folder | FIXED |
| DOC-8 | LOW | 38 folder rows shared one sentence per feature across layers, and three were wholly wrong (`world/dungeon`, `ui/item`, `ui/map`) | FIXED: every shared row and eight more written from what the folder holds |
| DOC-9 | NIT | "`wire.js` names most of `src/systems/`" - it names 46 of 653; the bundle names files in 28 of 49 folders | FIXED, recounted |
| DOC-10 | NIT | The map's test reach overstated; rule 4's "the table above" ambiguous; the two small folders unnamed | FIXED |
| DOC-11 | NIT | Stale paths (`tools/moveModule.mjs`'s header, a `tidy1` comment, `siegeRef.js`'s split `test/relayversion`), "holds 274" for "held", 18 `travel*` for 19, `Audit-Log.md` filed among the audits though it is one of Home.md's index pages | FIXED: each; `Audit-Log.md` back beside `Page-Index.md` |

## After the audit

Main moved 30 commits while the audit ran (TWO-HANDS and its audit, AUDIT GUILD-WORDS II, DEV6, SMOKE-HANG), and the
pull request conflicted - so no workflow ran on the audit's pushes until it was merged in (`Code-Map.md`'s rule: a
conflicting pull request runs nothing). Merged twice as the first merge was: main's and the base's text of every
moved or conflicted file run through the ledger, then merged with `git merge-file`; `--fixup` mended 242 addresses;
main's new tests and records filed, and TWO-HANDS's three modules into `src/combat/twoHands/` by the map's rule.
`--fixup`'s BLIND lines on the merged tree showed TOOL-1's new rule reading the wrong subject - every moved file a
test names - and flagging sound pins about files that never moved: it now takes the file a pin reads (on its line,
or bound to a name it tests; a `from` before a quote is the keyword, not a name), and a path a pin reads is no
spelling. Pinned both ways; the full suite on the merged tree: 28,560 tests, 0 failing.

A third merge (13 commits: AUTO-HOLD and its audit, a G3 deploy fix) went the same way: 62 files re-merged clean and
two count lines by hand, `--fixup` mended 43 addresses, main's `possessedItems.js` filed into `src/systems/item/` and
`autohold.test.js` into `test/server/`. Both of the move's BLIND lines were real. Three reads handed a path through a
variable (they would have thrown, not passed). AUTO-HOLD's negative pin - `interiorShared.js` never imports the item
law - was spelled for the depth both files had on main, one folder short of where they stand here, so it passed on
anything. It is spelled at any depth now, and goes red on a planted import.

## What stands

- `test/tooling/tidy1_movetool.test.js`: 10 tests (split from `tidy1_codemap` so the tool's mutants are judged in
  seconds); `test/tooling/tidy1_codemap.test.js`: 5. `tools/mutants/tidy1.json`: 63 mutants (16 before TIDY5, 32 at
  the audit's start), all dead.
- The relay: `siegeRef.js`'s comment (DOC-11) is a byte of the bundle, so world211 - undeployed - is re-hashed in place;
  still one relay deploy on the merge.
- Not verified here: the production build was counted, not played - the quest pack, the skies and the sprites are
  present in the output by file and by chunk, not seen in a browser.
