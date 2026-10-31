# LEGIBLE: code a person can read

The owner: "No band aids. A true and accurate overhaul". HOST-SPLIT (`Host-Split.md`) takes the hosts apart; LEGIBLE
is the other half: the names, lines, comments and shapes inside every file, and the tooling that lets that work happen
without breaking the thousands of pins that quote source text.

## The standard

1. **One statement per line**, laid out by the formatter, never by hand.
2. **Names say what a thing is.** No abbreviation a newcomer would look up unless it is a word the field uses
   (`DFU`, `HUD`, `UV`). `pixel`, not `p`; `deepWaters`, not `dw`.
3. **Comments say why, in plain words** (PLAIN-TEXT, HISTORY-OUT). Not the ticket that made the line, not its date,
   not a quote. The reason, the trap, or the DFU member it follows or departs from.
4. **Shapes are declared.** An object that travels between functions has a typedef or a class.
5. **A file and a function fit in a head.** That is HOST-SPLIT's work.

## How a change proves it changed nothing

- **A mechanical change** (formatting, comments, a rename) is proved, not tested. `node tools/sameProgram.mjs
  --against <rev>` compares every changed file with the revision as syntax trees. Layout and comments are not in the
  tree, literals compare by value, and variables compare by the declaration they resolve to. A rename is allowed only
  where asked (`--rename old=new`), and names other files read (exports, keys, members) never change.
- **The pins move with the text.** Mutant records (`tools/mutants/*.json`) and bible anchors quote source text
  exactly. `node tools/carryPins.mjs --transform <module.mjs> [paths] [--write] [--jobs N]` runs a change written as
  `transform(source, file)` over each file with and without each mutant, and writes every record's and anchor's new
  text. What it cannot carry it reports, never guesses.
- **Tests that quote comments** are not carried by the tool. A change to comments runs the tests that read the files
  it touched, and moves each such assertion to the code it was really about, or drops it if it only pinned prose.
- **A rewrite by hand** is held by the suite and the mutation lists: every mutant the file's records name still
  applies and still dies.

## Rules

- `test/scenes/hostceiling.test.js` counts logical lines (statements and entries), so layout and comments weigh
  nothing and splitting a crowded line costs nothing.
- A change that touches most files needs a quiet window on main. When, and for how long, is the owner's call.
- Adding a formatter is a new dev dependency and the owner's call.

## Open

| Step | What |
|---|---|
| Formatter | One pinned formatter and configuration, the tree formatted folder by folder with its pins carried, a `--check` in CI, and `.git-blame-ignore-revs`. |
| Lint | One statement per line, no comma sequences, a ratchet on new short names. |
| Names | A glossary, then the renames one abbreviation at a time (`dw`, `csa`, `wod`, `lpt`), carried like the formatter. |
| Comments | Tag-led, dated and quoted comments rewritten as reasons or removed, folder by folder, with a ratchet so they do not return (`test/tooling/commenttags.test.js`). |
| Shapes | Typedefs for the objects that travel (a terrain pixel, a face, a foe, an item); `// @ts-check` as each file is done. |
| Rewrites | Function by function, most-read files first, held by the suite and the mutants. |
