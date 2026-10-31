# LEGIBLE: code a person can read

The owner: "No band aids. A true and accurate overhaul". HOST-SPLIT (`Host-Split.md`) takes the hosts apart; LEGIBLE
is the other half: the names, lines, comments and shapes inside every file, and the tooling that lets that work happen
without breaking the thousands of pins that quote source text.

## The standard

1. **One statement per line**, laid out by the formatter, never by hand.
2. **Names say what a thing is.** No abbreviation a newcomer would look up unless `Glossary.md` allows it.
3. **Comments say why, in plain words** (PLAIN-TEXT, HISTORY-OUT). Not the ticket that made the line, not its date,
   not a quote. The reason, the trap, or the DFU member it follows or departs from.
4. **Shapes are declared.** An object that travels between functions has a typedef or a class.
5. **A file and a function fit in a head.** That is HOST-SPLIT's work.

## What holds it

- **The formatter.** Prettier at one pinned version (`package.json`) and one configuration (`.prettierrc.json`), over
  the files `tools/formatted.json` lists; `.prettierignore` is written from that list (`node tools/format.mjs
  --ignore`). `test/tooling/legible3_format.test.js` fails on a listed file the formatter would change. A new file in
  a listed folder is formatted; a new tool file joins the list. Formatting commits are in `.git-blame-ignore-revs`.
- **Lint.** `no-sequences` over shipped code and `max-statements-per-line` (1) in the formatted folders
  (`eslint.config.js`).
- **Short names.** `tools/shortNames.mjs` counts bindings of one or two characters the glossary does not allow, and
  the abbreviations it retires. `test/tooling/legible5_shortnames.test.js` holds each file to
  `tools/shortNamesBaseline.json`, which only goes down (`--seed REF` admits a base without the law).
- **History comments.** `tools/commentTags.mjs` counts comment lines with a date, a bible pointer, an owner quote, an
  audit, a moved pin or a leading slice tag. `test/tooling/commenttags.test.js` holds each file to
  `tools/commentTagsBaseline.json`, which only goes down.
- **Reachability.** `node tools/unreached.mjs` lists modules nothing ships; `test/tooling/unreached.test.js` holds
  them to `tools/unreachedBaseline.json`.

## How a change proves it changed nothing

- **A mechanical change** (formatting, comments, a rename) is proved, not tested. `node tools/sameProgram.mjs
  --against <rev>` compares every changed file as syntax trees. Layout and comments are not in the tree, literals
  compare by value, and variables compare by the declaration they resolve to. A rename is allowed only where asked
  (`--rename old=new`), and names other files read never change.
- **The pins move with the text.** `node tools/carryPins.mjs --transform <module.mjs> [paths] --write` runs a change
  written as `transform(source, file)` and carries every mutant record (`tools/mutants/*.json`) and bible anchor.
  `node tools/carryTextPins.mjs <changed ...> --tests <test ...> --write` carries a test's literal or regex that quotes
  the changed source. What either cannot carry it reports, never guesses.
- **Types read comments.** JSDoc carries types, so a comment change also runs `npm run types`.
- **A rewrite by hand** is held by the suite and the mutation lists: every mutant the file's records name still
  applies and still dies.

## The comment sweep

`node tools/commentSweep.mjs <folder> --list` names the files it would change; `node tools/carryPins.mjs --transform
tools/commentSweep.mjs <files> --write` sweeps them. It removes leading slice tags, parentheticals that hold only
references, and tag-only comments, and never touches code or JSDoc tags. It skips the relay's bundle (any byte there
is a new `RELAY_VERSION` and a deploy that drops players) and files pinned byte for byte (`KEEP_BYTES`). Then:
`sameProgram`, `npm run types`, the tests that read the swept files, `node tools/commentTags.mjs --lower`.

## Rules

- A change that touches most files needs a quiet window on main. When, and for how long, is the owner's call.
- A file with more than 400 mutant records is formatted or swept alone, in its own window.
- `test/scenes/hostceiling.test.js` counts logical lines, so layout and comments weigh nothing.

## Open

| Step | What |
|---|---|
| Formatter | 548 code files are not yet on `tools/formatted.json`: the 18 with more than 400 mutant records (`world.js` the largest), files whose text pins could not be carried, and files added since. Each heavy file takes its own window. |
| Names | The renames, one abbreviation at a time (`dw`, `csa`, `wod`, `lpt`, `hcc`, `mwv`), by the language service and carried like the formatter. |
| Comments | The sweep, folder by folder; `src/ai` is done. Then a hand pass for the reasons the sweep cannot write. |
| Shapes | Typedefs for the objects that travel (a terrain pixel, a face, a foe, an item); `// @ts-check` as each file is done. |
| Rewrites | Function by function, most-read files first, held by the suite and the mutants. |
