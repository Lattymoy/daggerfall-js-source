# AUDIT 38 - THE QUEST-NAME STRIP (2026-08-31)

Mac's call: a comprehensive audit on PX28, the hour it shipped.
Method: every surface that shows a quest name traced, the strip
probed against the spellings a quest pack can actually carry, and the
port's own vendored quest data read for what it really contains.

## Finding

**F1 - THE JOINED SPELLINGS SAILED THROUGH.** PX28's pattern required
whitespace between the kind word and its noun - "Side Quest:" - so
"Sidequest:", "MainQuest:" and "Side-Quest:" kept their labels, which
is exactly the thing Mac asked to remove. A pack writes the label
however it likes. The kind and the noun may now be joined, spaced or
hyphenated; the LABEL still needs its own trailing separator, which
is what keeps "Main Quest Backbone" a name and not a stripped
"Backbone". Pinned on all four spellings and on all four keepers.
1 mutant dead.

## Verified

- **Every enhanced surface that shows a quest name goes through the
  strip.** There are exactly two - the rail row and the detail head,
  both in pauseQuests - and both are pinned. The enhanced chronicle
  has three sections (Notes, Messages, History) and titles none of
  them by a quest name; the enhanced HUD's only `displayName` read is
  the effect list, not quests.
- **The classic skin strips nothing**, and questJournal.js is swept
  for the strip's name to keep it that way. The classic chronicle
  door still opens the classic windows.
- **The data is untouched.** The strip lives at the display seam; the
  quest parser is swept clean of it. A pack's DisplayName field is
  read as written.
- **The archive rows are covered**: parseFinished lifts the name out
  of the notebook's own header, and the finished list renders through
  the same railList, so a filed quest's label comes off too.
- **The vendored quest data carries no kind labels at all** - the
  names that contain "Quest" wear it at the END ("Clavicus Vile's
  Quest") or run it into the title ("Main Quest Backbone"), and both
  are keepers by design. So on the data in this repo the strip is a
  no-op, and it exists for the packs it is not this repo's business
  to edit.

## Not covered, said plainly

A pack that labels its quests in a language other than English is not
matched. That is a real limit and a deliberate one: the kind words
are English literals, and guessing at translations of "Side Quest"
would be inventing data rather than reading it.
