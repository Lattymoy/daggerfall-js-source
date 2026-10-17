# FIELD BUGS 2026-10-17 - one report from the Discord's bug-reports channel

One thread Mac handed over as a screenshot, 2026-10-17, read on the code as it stands at main's `dcac4e4ff`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Boar, "Interface of enchanting workbench" (2026-10-13, bumped twice): "As you can see, buttons are on on another" - the Holdings tab's Stores page at a home's enchanting station, the Reforge with Essence's rows a name a word a line beside one press a piece | Every line's press was a child of the piece's row, and the row's button track is one cell: each press drew on the first, and the track squeezed the name | fixed (REFORGE-STACK) |

## REFORGE-STACK: a press a line, under the piece

`src/ui/professions/profPages.js` drawEssenceReforge; `src/ui/enhanced/enhancedPlusStyle.js` PROF_CSS.

FOUND. CRAFT4's Reforge with Essence (`06-Systems/Professions-Arc.md` 41.7) draws a `.prof-smelt` row a piece the
Reforge takes - its name, "N Arcane Essence a line", the Essence short if it is - and appended a `Reforge: <line>` press
a reforgeable line to that row. PROF_CSS places a row's button in one cell (`.prof-smelt .act { grid-column: 3;
grid-row: 1; }`, AUDIT 32 P7's placement: the name, the count and the button one row, the inputs under them), which is
right for the station's other rows - a disenchant, a temper, a smelt each have one press - and wrong for this one, the
only row with a press per line: a Magic piece's two, a Rare's three or four all drew in that cell, one on another, and
the `auto` button track grew to the widest press and took the name's track down to its longest word (the report's
screenshot: a piece's name a word a line). Measured in Chromium off the station drawn with the game's own pieces
(`applyRarity`, `reforgeableLines`, `affixLine`, the host's offer as `scenes/world.js` makes it) under ENHANCED_CSS
and PLUS_CSS, at a detail pane 260 and 428 px wide: every press of a row at one box (1, 3 and 6 overlapping pairs in pieces
of 2, 3 and 4 lines, at both widths), the name 0 px wide. Beside it, the row's Essence-short word ("Needs 2 Arcane Essence; your Stores
hold 1.") had no placement and flowed into the first free cell - the count's 64 px track - as the disenchant's
Stores-full word and the temper's input-short word did in theirs.

DFU has no station or Reforge with Essence (the item maker is `DaggerfallItemMakerWindow`, untouched); this is our own
window's layout, and no DFU member or ledger row moves.

FIXED. The presses stand in a block of their own (`.prof-lines`), the row's last child, spanning the row under the
piece's words, a press a line down it (`flex-direction: column`) - as the Mages Guild's Reforge lays a piece's lines
(`ui/reforgeWindow.js`, a `.reforge-line` each). A `.prof-smelt` row's `.prof-short` spans the row, under its line,
in every row that says one (the disenchant's, the temper's and this one's). The button track's own rule is unchanged,
so the one-press rows draw as they did. Measured again at both widths: no two presses meet, each its own box the pane's
width, the name its whole track (152 px at 260, 320 at 428), the short word the row's width.

`test/ui/fb1017_reforgestack.test.js` (2): PROF_CSS's two rules and the button track's cell; the station drawn off the
game's own Magic and Rare pieces - no press a child of the row, one block of a press a line in the lines' order and
last, and with the Essence short its word said above the presses, every press closed. `tools/mutants/fb1017.json`: 5
mutants, all dead (the presses back in the track, the block above the words, the block in the track, the presses
abreast, the short word unplaced).
