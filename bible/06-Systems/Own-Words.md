# Own Words: DFU's quests in our own words

Daggerfall Unity's MIT data carries Daggerfall's own text: the messages of DFU's quest scripts
(`vendor/dfu-quests/Quests/`) and TEXT.RSC's strings (`vendor/dfu-text/Internal_RSC.csv`;
`01-Overview/Own-Work.md`, NO-BETHESDA). The game speaks our own words instead of reading them from ARENA2 (the owner:
"We plan on moving away from arena so whatever works for future proofing"). Every one of DFU's 264 quests with
messages has an own file.

A quest stays DFU's logic. Its QBN section is DFU's conversion of the quest's script (MIT), and it runs on the machine
unchanged. Only its messages, the QRC section, are written again.

## The layer

- **Our file.** `src/systems/quest/own/NAME.txt` is a whole quest script: its notice line (`OWN_CREDIT` in
  `tools/ownQuestCheck.mjs`: the QBN is MIT, its notice in the build's licence file, and the messages are ours), DFU's
  header, our messages, and DFU's QBN byte for byte.
- **The loader.** `src/scenes/quest/questData.js` reads our file in place of DFU's file of the same name, so the build
  needs no DFU quest text. The port's patches (`src/systems/quest/questPatches.js`) and the questlines' branches
  (`src/systems/questlines/qlPatches.js`) are applied to it as to any quest. A mod's quest of a DFU name still wins.
- **The patches on DFU's words** live in the own files: `_BRISIEN`'s and `A0C00Y10`'s. `C0B00Y02`'s journal entry stays
  a patch, anchored on the `QBN:` line, so it applies to both files and keeps its translations.
- **Set in the Bay.** The main quest, `_TUTOR__`, `$CUREWER` and `K0C01Y10` say why with a `-- BAY-OWN:` header line.
- **The node twin.** `test/qlSources.mjs` reads the same way: `QUEST_FILES` keeps the quest's `dir: 'dfu'` and points
  its `path` at our file (`own: true`).
- **Saves.** A quest saves its message lines (`message.js` getSaveData), so a quest saved with DFU's words keeps them
  until it ends; a new one speaks ours.

## How to write a quest in our own words

1. Start from the scaffold: `node tools/ownQuestCheck.mjs --scaffold NAME`. It writes DFU's header and QBN, and for each
   message its header and a `TODO` line naming the macros it must keep.
2. Read DFU's message for its facts: who, where, what, how long, how much. Then write it fresh, in the game's voice
   (`10-UI/Voice.md`): plain whole sentences, American spelling, dry humor where a character speaks. Never paraphrase
   line by line and never keep a Bethesda sentence.
3. Keep every message id. Keep each message's set of `%macro`, `_symbol_`, `__symbol_` and `=symbol_` tokens, its
   `<ce>` centring and its `<--->` variants, as DFU's message has them. A pronoun (`%g`, `%g3`) follows the person it
   stands for, as in DFU's message; its capital (`%G`) is the sentence's choice. A person whose sex the script does not
   fix (`Person _x_ face 1 group ...`) gets a pronoun macro or none, never a plain he or she.
4. Keep the last place and the last person each message names: the journal's way and the next message's pronouns read
   them. A letter's last line is its signer (`Letter: ...` in the inventory).
5. A question asked by `prompt` stays a yes-or-no question, with yes meaning what DFU's yes meant.
6. PLAIN-TEXT: at most 40 words a message (each variant), 25 a sentence, no padding. TAMRIEL-WIDE: no Iliac Bay,
   Daggerfall, High Rock or Hammerfell for a quest that can run anywhere. A quest set there says why in a
   `-- BAY-OWN:` header line. A fixed person of the script (Sentinel's queen in M0B11Y18) keeps their place.
7. Write long lines and run `node tools/ownQuestCheck.mjs --wrap NAME`: it wraps each message to its DFU message's width.
   Centred lines flow together, and so do lines with no lead or one space. A centred line of names alone stays put.
8. Run `node tools/ownQuestCheck.mjs NAME` until it says OK, then `node tools/bethesdaWords.mjs --lower`.

## The checker

`tools/ownQuestCheck.mjs` compares our file with DFU's, through the quest parser itself (`parser.js`). It fails a
changed QBN or header field, a missing notice line, a message id lost or added, and a line the parser reads as a
header. Per message it fails a changed layout, variant count, macro set, pronoun binding or last place and person, a
letter's changed signer, and two macros in one word. For the words, it fails PLAIN-TEXT's limits and padding, a Bay
name without `BAY-OWN:`, a `TODO`, a line past the width, and any run of six words that DFU's 265 scripts also say.
With `ARENA2_PATH` set, the runs come from ARENA2's own 303 QRC files too. Last, it applies the port's patches and the
questlines' branches to our file, and fails one that no longer finds its text.

The questline patches' own messages are swept for six-word runs of DFU's and ARENA2's quest text too.
`test/tooling/ownquestcheck.test.js` runs the checker over every own quest and pins each rule on made-up data. The
40-word limit cuts the long letters and books hard: each keeps its plot facts and clues.

## The ratchet

`tools/bethesdaWords.mjs` counts what the game still reads of Bethesda's words, and
`tools/bethesdaWordsBaseline.json` holds the counts, which only go down (`test/tooling/bethesdawords.test.js`).
`quests` is DFU's scripts that have messages and no own file. `messages` is their messages. `internalRsc` is the rows
of `Internal_RSC.csv`. The counts are 0 quests, 0 messages and 1,448 rows. A count that rises fails the test. A count
that falls fails it too, until `node tools/bethesdaWords.mjs --lower` writes the baseline lower in the same change.

## The tests that read DFU's files

Most quest tests read `vendor/dfu-quests/Quests/` directly. A test of the logic reads the same logic in either file,
because our file keeps DFU's QBN. A test of what the player sees reads the pack (`test/qlSources.mjs`), as
`ql4_branches.test.js` and `guide3_herald.test.js` do. To find the tests that pin DFU's words of a quest, run the quest
tests as `node --import ./tools/ownQuestRedirect.mjs --test <files>`: every read of DFU's file reads ours. A test that
fails only that way pins DFU's text. Move it to the pack if it pins what the player sees, or leave it on DFU's file if
it pins the file on purpose.

## Translations

`locales/` holds no quest text: each language has `Port_Strings.csv` alone, and no bundled pack carries `Quests/`.
A translation of a quest comes from a player's own DFU translation pack, as a `NAME-LOC.txt` file
(`systems/quest/localizedQuest.js`), and it is read by message id (`NAME.1004`). The ids stay, so a pack still
matches our quest, and in that language the quest shows the pack's translation of DFU's words in place of ours.

## The own files, by family

`test/systems/quest/ownwords1_play.test.js` plays `M0C00Y11` end to end through the real bridge in our words.
`M0B40Y04` is commented out of `QuestList-Classic.txt` and has no file; `__DEMO01` has no messages.

| # | family | quests |
|---|---|---|
| 1 | Fighters Guild | M0C00Y11 M0C00Y12 M0C00Y13 M0C00Y14 M0B00Y00 M0B00Y06 M0B00Y07 M0B00Y15 M0B00Y16 M0B00Y17 M0B11Y18 M0B1XY01 M0B20Y02 M0B21Y19 M0B30Y03 M0B30Y04 M0B30Y08 M0B40Y05 M0B50Y09 M0B60Y10 |
| 2 | Mages Guild, specific temples | N0B00Y04 N0B00Y06 N0B00Y08 N0B00Y09 N0B00Y16 N0B00Y17 N0B10Y01 N0B10Y03 N0B11Y18 N0B20Y02 N0B20Y05 N0B21Y14 N0B30Y15 N0B40Y07 N0C00Y10 N0C00Y11 N0C00Y12 N0C00Y13 00B00Y00 D0B00Y00 E0B00Y00 F0B00Y00 G0B00Y00 H0B00Y00 I0B00Y00 J0B00Y00 |
| 3 | Temples, Witches | C0B00Y00 C0B00Y01 C0B00Y02 C0B00Y03 C0B00Y04 C0B00Y14 C0B10Y05 C0B10Y06 C0B10Y07 C0B10Y15 C0B20Y08 C0B3XY09 C0C00Y10 C0C00Y11 C0C00Y12 C0C00Y13 Q0C00Y01 Q0C00Y03 Q0C00Y04 Q0C00Y06 Q0C00Y07 Q0C00Y08 Q0C0XY02 Q0C10Y00 Q0C20Y02 Q0C4XY04 |
| 4 | Knightly Orders, Vampires | B0B00Y00 B0B00Y01 B0B10Y04 B0B20Y07 B0B40Y08 B0B40Y09 B0B50Y11 B0B60Y12 B0B70Y14 B0B70Y16 B0B71Y03 B0B80Y17 B0B81Y02 B0C00Y05 B0C00Y06 B0C00Y10 B0C00Y13 P0A01L00 P0B00L01 P0B00L03 P0B00L04 P0B00L06 P0B01L02 P0B10L07 P0B10L08 P0B10L10 P0B20L09 |
| 5 | Thieves Guild, Dark Brotherhood | O0A0AL00 O0B00Y00 O0B00Y01 O0B00Y11 O0B00Y12 O0B10Y00 O0B10Y03 O0B10Y05 O0B10Y06 O0B10Y07 O0B20Y02 O0B2XY04 O0B2XY08 O0B2XY09 O0B2XY10 L0A01L00 L0B00Y00 L0B00Y01 L0B00Y02 L0B00Y03 L0B10Y01 L0B10Y03 L0B20Y02 L0B30Y03 L0B30Y09 L0B40Y04 L0B50Y11 L0B60Y10 |
| 6 | Merchants, the Daedra | K0C00Y00 K0C00Y02 K0C00Y03 K0C00Y04 K0C00Y05 K0C00Y06 K0C00Y07 K0C00Y08 K0C00Y09 K0C01Y00 K0C01Y10 K0C0XY01 K0C30Y03 10C00Y00 20C00Y00 30C00Y00 40C00Y00 50C00Y00 60C00Y00 70C00Y00 80C0XY00 90C00Y00 T0C00Y00 U0C00Y00 V0C00Y00 W0C00Y00 X0C00Y00 Y0C00Y00 Z0C00Y00 |
| 7 | Commoners, the cures, DFU's own | A0C00Y00 A0C00Y06 A0C00Y07 A0C00Y08 A0C00Y10 A0C00Y11 A0C00Y12 A0C00Y14 A0C00Y15 A0C00Y16 A0C00Y17 A0C01Y01 A0C01Y03 A0C01Y06 A0C01Y09 A0C01Y13 A0C0XY04 A0C10Y02 A0C10Y05 A0C41Y18 $CUREVAM $CUREWER CUSTOM01 _TUTOR__ |
| 8 | Nobility | R0C10Y00 R0C10Y01 R0C10Y02 R0C10Y04 R0C10Y05 R0C10Y06 R0C10Y08 R0C10Y09 R0C10Y10 R0C10Y11 R0C10Y12 R0C10Y13 R0C10Y14 R0C10Y15 R0C10Y17 R0C10Y18 R0C10Y20 R0C10Y21 R0C11Y03 R0C11Y16 R0C11Y19 R0C11Y26 R0C11Y27 R0C11Y28 R0C20Y07 R0C20Y22 R0C30Y25 R0C4XY23 R0C60Y24 |
| 9 | The main quest, I | _BRISIEN S0000001 S0000002 S0000003 S0000004 S0000005 S0000006 S0000007 S0000008 S0000009 S0000010 S0000011 S0000012 S0000013 S0000015 S0000016 S0000017 S0000018 S0000020 S0000021 S0000022 |
| 10 | The main quest, II, and DFU's demos | S0000100 S0000101 S0000102 S0000103 S0000104 S0000106 S0000107 S0000500 S0000501 S0000502 S0000503 S0000977 S0000988 S0000999 __DEMO02 __DEMO03 __DEMO04 __DEMO05 __DEMO06 __DEMO07 __DEMO08 __DEMO09 __DEMO10 __DEMO11 __DEMO12 __DEMO13 __DEMO14 __DEMO15 __DEMO16 __DEMO17 __DEMO18 __DEMO19 __DEMO20 __DEMO21 |

## Open items

- **`Internal_RSC.csv`** (1,448 rows, TEXT.RSC's strings). The game reads TEXT.RSC from the player's own ARENA2. The
  table feeds the translation pipeline and the pins, and `formats/rscTable.js` carries one of its rows (7333). Our own
  words for the system messages are work still to do. The baseline holds the count until then.
- **DFU's tables of Bethesda's names.** `Internal_Locations.csv` (places), `Internal_Factions.csv` (factions),
  `Internal_Items.csv` and `Internal_MagicItems.csv` (items), `Internal_Spells.csv`, `Internal_Flats.csv`,
  `Internal_Strings.csv`, the `Quests-*.txt` tables and `vendor/dfu-books/books.txt` (titles). Names are proper nouns of
  the setting, and keeping or replacing them is the owner's separate decision. Our files do not change them.
- **What stays DFU's in an own file:** its `DisplayName`, its header comments and its QBN.
- **Our own words in another language** need our own `-LOC` files, drafted from our English.
- DFU's quest files stay in `vendor/` as the checker's reference and the tests' fixture.
