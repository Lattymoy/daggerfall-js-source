# FIELD BUGS 2026-10-20 - the questlines' givers: "the name mentioned in the quest text doesn't match"

A player's report on the Discord's bug-reports, handed over by the owner on 2026-10-20 (Harlander, "NPC names in new
quests don't match the NPCs you talk to in the world"):

1. *"I've been trying out the new quests that just appeared, and for some of them, the name mentioned in the quest text
   doesn't match the name of the NPC you talk to to progress it."*

Read on main at `016dba12d` (#1063's merge), under the owner's standing word on these threads: no band aids, the root
cause. The "new quests" are QUESTLINES' (#1047, #1073, `06-Systems/Questlines-Arc.md`). The pin is
`test/systems/fb1020_questnameone.test.js`, the mutants `tools/mutants/questnameone.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "the name mentioned in the quest text doesn't match the name of the NPC you talk to" | `ql name` (QL12) renamed four givers' Persons over the name their seed drew. The NPC stood for a quest Person names itself as every static NPC does, drawing its name again from the seed (StaticNPC.GetDisplayName), so it answered to the drawn stranger | QUEST-NAME-ONE: the stand answers to its Person's own name |

## QUEST-NAME-ONE: the NPC stood for a quest Person answers to the Person's own name (1)

`src/systems/quest/person.js` (personOwnName), `src/characters/staticNpc.js` (staticNpcName),
`src/scenes/worldModes.js` (questStandNpcData, one entry).

FOUND. A quest Person is named twice, by two derivations that DFU only ever lets agree:

- **The Person** draws its name at the quest's setup: its seed, the bank of the region the quest began in
  (`Person.cs:579`, `:626-627`; `person.js` _assignDisplayName). The words (`_corvane_` and the messages' own
  "Corvane Tull"), the journal, the Quest Guide and the topic tree read this one.
- **The NPC stood for it** (`place npc`) is laid out from the Person - its seed and faction, the marker's hash
  (`StaticNPC.cs:245-255` SetLayoutData; the host's one builder, `questStandNpcData`) - and names itself as every static
  NPC does: the seed drawn again, with the bank of the region it stands in (`StaticNPC.cs` GetDisplayName). The plate,
  the Info line, World Tooltips' plaque and the talk partner's `nameNPC` - the topic tree's same-person key
  (TalkManager.cs:3159) - read this one.

In DFU the two meet, because nothing renames a Person and a quest's places are in the region it began in. The
questlines' `ql name` (QL12, `systems/questlines/qlActions.js` QlName) writes the Person's `displayName` after the draw:
Ysolde Marnhel (the Dagon Cycle's Breach Diaries and Children of the Hour), Prior Anselm Vey (The Hour That Was Not),
Hamid al-Rasheen (The Old Coil) and Corvane Tull (The Weir Road) - sixteen steps in all. Their NPCs answered to the
seed's name. The talk partner's name did not match the Person's either, so the giver could speak of themselves as
someone else.

FIXED. The stand's one builder carries its Person's own name (`personOwnName`: the Person's name, drawn or given; none
for a Person named after their faction record - an Individual or a Daedra - whom DFU's faction path names, its
translation shown as L10N3e shows it), and `staticNpcName` answers it. Every reader downstream of the layout data - the
plate, the Info line, the plaque, the talk partner - now says what the words say. The seed's draw still runs before the
answer, so DFRandom stands where GetDisplayName leaves it and every roll after a naming is DFU's (CAT-MEOW's lesson).
A departure from GetDisplayName, recorded as departure 11 of Port-Ledger's QUESTLINES row. It also closes the case
DFU leaves open: a Person who drew their name in one region's bank, stood where another region's bank names them -
a received copy of a shared quest, for one.

PINS. `fb1020_questnameone.test.js` (5): every `ql name` the questline scripts hold (16, four names) is run through the
real quest machine with its own Person line, and its stand is laid out by the host's builder as written. The NPC's name
and the shown name are the given one in two banks, and DFU's re-draw is a stranger (the bug, held as a fact). A drawn
Person keeps their name in three banks. An Individual and a Daedra carry no name of their own, and anything that is no
Person carries none. The stream after a naming is the re-draw's. The host's builder carries the name and both namers read
its data. Mutants: `questnameone.json` 5/5 dead (the namer re-draws, the name returned before the draw, the stand
carries no name, the faction test dropped, a non-Person carries a name).

NOT VERIFIED HERE. Talking to a named giver in the running game: the four lines that name one open online, for a
registered account, after an Elite Breach or a Weir Key. The tests drive the real machine, the real `ql name`, the real
SetLayoutData and the host's own builder instead.
