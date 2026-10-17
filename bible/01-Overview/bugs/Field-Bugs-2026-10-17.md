# FIELD BUGS 2026-10-17 - two reports from the Discord

One thread Mac handed over as a screenshot, 2026-10-17, read on the code as it stands at main's `dcac4e4ff`; and (KEY-LAW)
a post in the general channel Mac handed over the same night, read at main's `399fe1605`, the Elite Breach's deploy.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Boar, "Interface of enchanting workbench" (2026-10-13, bumped twice): "As you can see, buttons are on on another" - the Holdings tab's Stores page at a home's enchanting station, the Reforge with Essence's rows a name a word a line beside one press a piece | Every line's press was a child of the piece's row, and the row's button track is one cell: each press drew on the first, and the track squeezed the name | fixed (REFORGE-STACK) |
| 2 | slick, in #general, minutes after the Elite Breach went live (relay `world213`, `acct149`): "Playing a new character I made last night and it's flagged by the new key thing" - the notice: "The realm is reviewing this character: a Weir Key it carries is not as the game makes it. Trading is frozen until it is gone." | The account service judges a checkpoint with the item law, which it loads headless: the Weir Key's home (`systems/eliteGates/weirKey.js`) pulls the Spire's law and its picture in, and the law imported none of it, so template 575 was a `template` finding there - every character carrying a key was held, with a strike. The tests ran the law in a process that had imported the key's home, where the registry knew it | Fixed - KEY-LAW below: item law 7, `acct151`, migration 0125 |

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

## KEY-LAW: the Weir Key, known to the service's law

`src/systems/eliteGates/weirKeyRow.js` (new); `src/systems/eliteGates/weirKey.js` WEIR_KEY_ROW; `src/systems/item/itemLaw.js`
LAW_ONLY and ITEM_LAW_VERSION; `server-account/migrations/0125_key_law.sql`; `server-account/src/service.js` ACCOUNT_VERSION.

FOUND. The account service judges every realm checkpoint's items with the item law (`server-account/src/judge.js`), and
loads it headless: the law imports the homes of the port's own templates that register at import, and reads the rows of
the four whose homes pull the UI in beside the registry (LAW_ONLY). The Weir Key (EG-PLAY, template 575) registers in
`systems/eliteGates/weirKey.js`, which imports the Spire's law (`net/eliteGates/egLaw.js`), its picture
(`world/eliteGates/egKeyArt.js`) and the texture door - and the law did neither. So on the service `lawTemplate(575)` was
null, `itemFindings` answered `['template']` for every key, and the verdict held the character's trade with a strike
(`server-account/src/verdict.js` lawCountOf) - the hour relay `world213` and `acct149` went live, a key found off an
elite foe was a frozen trade. The client named the piece from its own registry, which knows the key: the report's
"a Weir Key it carries is not as the game makes it". Reproduced through the real Worker: a checkpoint carrying three
keys held, `law_sig` `template:575`.

Why no test saw it: `test/systems/item/int1_itemlaw.test.js` asked `lawTemplate` of every custom template the producer
sweep mints, in the sweep's own process - which had imported every producer's home, so the registry answered for rows
the service never registers; and the sweep minted no Weir Key.

DFU has no Weir Key and no realm; this is our own law, and no DFU member or ledger row moves.

FIXED. The key's row, but its name and its picture, is a leaf that imports nothing (WEIR_KEY_LAW_ROW); `weirKey.js` lays its name and
picture over it and registers it as before, and the law reads it beside the registry, as it reads the rest's rows - item
law 7 (`acct151`; tech1_roster's LAW_SERVICE names it). Migration 0125 lifts, as MAKER-KEPT's 0123 did, every character
not staff's whose law findings were only `template` on 575: the hold, a timed end, the strikes and the timed holds
served, written as a staff act (`by: 'key-law'`), `law_sig` kept so a checkpoint the old Worker judges before it moves is
no new strike. A character with any other finding, or one past its kept list, is left as it was. The account deploy's
path list names the leaf (`test/server/accountdeploy.test.js` walks the Worker's graph).

`test/systems/item/int1_itemlaw.test.js`: the sweep mints the Weir Key (87 producers), and its template check now runs
`lawTemplate` in a child process that imports the service's judge and nothing else - every custom template the sweep
mints known there - and pins the leaf to the registered row. `test/server/fb1017_keylaw_lift.test.js`
(2): a checkpoint carrying keys through the real Worker holds nothing; migration 0125 executed over a timed hold, a law
hold, a strike with the keys gone, and the five rows it must not touch. Both fail on main. `tools/mutants/fb1017.json`:
6 mutants, all dead (the row unread, the law unmoved, the lift's code, its template, its count guard, staff's).
