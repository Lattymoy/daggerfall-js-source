# MAC-U - the directions that read as two messages, 2026-09-18

Mac, on the deployed build, with a screenshot of the classic talk box:

> any directions I get look like two messages at once, like it changes
> mid-sentence

The three answers in the shot:

- "It's really easy. You'll want to go The Greensley Residence is south
  of where we're standing."
- "I guess I can tell ya. Just keep going south."
- "You'll find it The Greensley Residence is a ways south of here."

## The data, not the code

The chain is DFU's and the port runs it exactly: GetAnswerWhereIs draws
an ANSWER FRAME from `answersToDirections` (TalkManager.cs:107,
:1839-1866) - TEXT.RSC 7270-7274 for a knowing NPC, 7285-7289 for a
loyal one - and every frame carries its own subject and ends in `%hnt`:

    Sure. %key is %hnt.            It's really easy. You'll want to go %hnt.
    Ya gotta go %hnt.              You'll find it %hnt. Just ask me civilly next time.

`%hnt` is MacroHelper's DialogHint (MacroHelper.cs:112) ->
TalkManagerMCP.DialogHint (TalkManagerMCP.cs:84-103) ->
GetKeySubjectBuildingHint (TalkManager.cs:1707-1723), which for the
direction arm expands record **7333** (:1692-1696). The port's
`answerPipeline.js` is that ladder line for line, and townTalk's
mobile-townsperson chain (`answerText`) is the same fork in T4's shape.

**Classic's 7333 is nine whole sentences.** "%loc is %di of here",
"%loc is %di of where we're standing", "%loc is a ways %di of here" -
each naming the building through `%loc`. Put a sentence into a frame
that already has a subject and you get Mac's screenshot. Classic
Daggerfall fused them the same way; the T4 probe's "Vintage Elixirs is
a ways south of here" (World-Arc, 2026-08) was a frame that happened to
be bare.

**Daggerfall Unity does not read TEXT.RSC first.** TextProvider
.GetRSCTokens (TextProvider.cs:167-188) asks the `Internal_RSC` string
table by id and opens the classic file only for a key the table lacks,
and the English table ships inside every build
(`Assets/Localization/StringTables/Internal_RSC_en`). The table was
extracted from TEXT.RSC and then EDITED by the DFU project, and its
7333 is the PHRASE the frames expect:

    %di of here                    that way, just keep going %di
    %di of where we're standing    a way %di of here
    that way, %di                  not too far to the %di, if you don't mind walking
    %di of here, unless I'm mistaken    %di of here, I think    %di, with a bit of a walk

So "It's really easy. You'll want to go south of where we're
standing." - and "I guess I can tell ya it's that way, just keep going
south." is one sentence too, where classic's "Just keep going south."
had only looked like one.

## What shipped

- `vendor/dfu-text/Internal_RSC.csv` - DFU's English master of the
  table, vendored verbatim (MIT; route (a), the settings and books
  precedent; `vendor/dfu-text/README.md` has the provenance).
- `src/formats/rscTable.js` - `INTERNAL_RSC`, the rows the port carries:
  7333, verbatim from the CSV and pinned to it. Data with no imports.
  `parseRscMarkup` is the importer's markup read as plain text
  (DaggerfallStringTableImporter.cs:175-215 - a literal newline in the
  CSV is stripped, `[/record]` splits, `[/end]` closes, the three break
  markups are the break byte); `parseRscCsv` reads the master file.
- `src/formats/textRsc.js` - `load(bytes, { table = INTERNAL_RSC })`
  encodes the rows into the file's OWN byte shape (`encodeRscRecord`:
  NewLine, SubrecordSeparator, EndOfRecord) and `bytesById` answers a
  table row before the file, DFU's order - so every reader above it
  (plainText, the variant draws, the token streams, linesById) sees one
  kind of record and no consumer changed. `{ table: null }` is the
  classic file alone, for the tests that measure classic bytes and for
  the census tool.
- `src/scenes/townTalk.js` - the no-data fallback for the direction arm
  is the phrase (`'%di of here'`), not the classic sentence.
- `tools/rscTableDiff.mjs` - the census: with `ARENA2_PATH` set, every
  record whose plain text differs between the vendored table and the
  player's TEXT.RSC, so the next carried row comes from a list and not
  a screenshot. A difference is a candidate; a row is carried only once
  both texts and the seam that speaks them have been read. **Not run
  here** - this container has no ARENA2.

## The campaign

`test/macu_directions.test.js` (5): the carried row IS the vendored
CSV's row (nine compass phrases, none naming the building; 7332 the
same in both and so NOT carried); the reader answering the table before
the file through every accessor, a table-only record, `{ table: null }`
the classic bytes, the encoder's bytes; the live chain - the real
AnswerPipeline over the real talk MCP on an in-memory TEXT.RSC - speaking
"It's really easy. You'll want to go south of where we're standing." and
the classic bytes alone speaking Mac's doubled sentence, held by name;
townTalk's chain and fallback; by source the table-first read.
`tools/mutants/macu.json`: **7 mutants, 7 killed** - the reader
forgetting the table, an empty default table, hasRecord ignoring it,
the variants fusing, the row naming the building again, the markup
keeping the editor's newlines, the fallback back to the sentence.

## Not seen with game data

The fix is on the reader, so it holds for the classic box, the enhanced
panel and the mobile townsperson alike, but nobody has asked a
townsperson the way with a real TEXT.RSC under this reader. Worth a
pass: ask "Where is" for any residence three times - every answer one
sentence, the building named once.
