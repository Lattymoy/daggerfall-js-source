# FIELD BUGS 2026-09-27d - the ghosts only one player could see

A screenshot from the Discord (! OG, to lattymoy):

1. *"Monsters aren't syncing"* - *"The ghost on daggerfall"*, *"We all had to kill them"*, *"And everyone had to kill
   thier ow[n]"*.

## CURSE-SYNC: a world quest's foes are the world's (1)

The ghosts are S0000977, the Curse of Daggerfall (`vendor/dfu-quests/Quests/S0000977.txt`). The tutorial starts it for
every character (`_TUTOR__`: `start quest 977 977`), and at night in Daggerfall's streets it stands a wraith every 21
minutes and a ghost every 31, one time in two, for as long as the player walks them. Online every player runs their own
copy, and a quest's foe rode nowhere - Multiplayer.md's first lock, which QUEST-PARTY opened only for a quest the party
shared, and a main quest cannot be shared. So each player in the streets fought a haunting nobody else could see, and
swung at air in everyone else's view.

The curse is no player's story - no task counts its foes - so its foes are the world's now: they ride the cell as an
encounter's do (their spawner's, everyone else's puppet), anyone may strike them, they hunt every player, and a player
who leaves or falls hands them to the nearest player. Their quest holds them while their spawner does. Every other
quest's foe stays its player's own. `06-Systems/Online-Arc.md` CURSE-SYNC.

## For Mac

- **Every copy still rolls its own.** Three players in the streets at night face three players' ghosts and wraiths, as
  a cell's encounters already do (WORLD6b) - they now see them and fight them together. One haunting for everyone near
  (one copy standing it, the way a quest marker's foe stands once for a party) is a design call, not taken here.
- **"They just don't allow placement"** is the tail of a message the screenshot cuts off; nothing was changed for it.

## Verification

Lint, types, the build and the full suite green: 13159 tests across 1378 files, 0 failing (the ones that need ARENA2
skipped). New pins `cursesync` (7); mutants `cursesync` 9, all dead. Re-aimed by content: the handover pins in
`auditpscale1`, `questparty2`, `questparty3b` and `summonsync`, and ten mutant records (`auditpace`, `auditqp`,
`pscale1` four, `questparty`, `questparty2`, `questparty3b`, `summonsync`), re-run, all dead; 11 line cites moved by
tools/citeShift.mjs. Not proven in a browser or with two players.

## AUDIT CURSE-SYNC (2026-09-27: "audit this")

Main had not moved (07ca0b30), so nothing to merge. A review at high effort over the branch - seven findings, each
checked against the code before anything moved - and this audit's own read. Three fixes and two of the audit's own;
three findings not taken, one of them refuted; one left open.

**Fixed.**
- **F1 - the world answer was asked of the live quest table on every read** (the review's first and fourth findings).
  A ghost whose quest left the table would turn private mid-fight, its puppets gone from every other screen with no
  fall. An ended quest is kept a game week (fourteen real hours online), so that path is not reached in play, but a
  save's foe stood before its quest is restored read private until then, and the stream's gates ask several times a
  foe a frame. The answer is kept per behaviour once its quest is known (`_worldOf`) and asked again while it is not.
- **F2 - "its quest still holds it" held only while its spawner does** (the second finding). A foe handed on at a door
  or a death is its heir's plain foe (`letGo` and `adopt` bind no quest), so no quest counts its fall. That is harmless
  for the curse, since no task counts its foes, and it is now the list's rule: a quest joins WORLD_QUESTS only if no
  task counts its foes. A pin reads every entry's own script, with S0000002's `injured` lines as the check's negative
  control. The docs say what is true.
- **F3 - two copies of IsProtectedQuest's name test** (the sixth finding). `questNameIn` in `systems/quest/machine.js`,
  read by `isProtectedQuest` and `isWorldQuestFoe`. IsProtectedQuest had no pin at all; it has one now (a faulting
  spine quest is kept, whatever its case).
- **The audit's own: two pool comments** still said "a quest's foe" where a private quest's is meant (`_sharedFoe`, the
  take arm's A5).
- **The audit's own: the name the running game mints was unpinned.** The suite scheduled the curse by its file; the game
  starts it by number from the tutorial's close (`start quest 977 977`). StartQuest names it `S0000977`, the list's
  spelling - pinned through the real action.

**Not taken.**
- **Every copy rolls its own** (the third finding): three players together see three players' ghosts, each weighed by
  who fights it. PSCALE1's answer for encounters is one roll per party (`amGroupRollOwner`), but that election assumes
  every member can roll the same table. The curse rolls only for a character still under it, and no member's quest
  state is on the wire, so electing a member who has lifted the curse would end the haunting for the whole party.
  Weighing by fighters is PSCALE1's law for every shared foe. Left open (O1).
- **The dungeon's handover disagrees with its own lane** (the fifth finding): refuted. `ownFrame` passes over a foe that
  is neither a shared quest's nor a loose stand before it asks `heirOf`, so no dungeon handover names an heir for a world
  quest's foe. The dungeon stays flagged.
- **Mark the wave at the mint instead of reading a name** (the seventh finding): the mint is one of three doors a quest
  foe comes through (the mint, a save's revive, a partner's adopt). The answer kept per behaviour (F1) is stable for the
  foe's life whichever door it came through, and the list stays an explicit decision, as PROTECTED_QUESTS is, with its
  admission rule pinned.

**Left open.**
- **O1 - one haunting per party.** A pose bit saying "the curse stands for me here" would let the party run PSCALE1's
  election over the members it stands for. That is a wire change and a design call, so it is Mac's.

Pinned: `cursesync` 10 (three new: the admission rule with the name the game mints, the kept answer, IsProtectedQuest).
Mutants `cursesync` 13, all dead (five new, one re-aimed to the moved name test). 12 line cites moved by tools/citeShift.mjs.
Lint, types, the build and the full suite green at the audit (the runner's 13181 tests, 0 failing, the ARENA2 ones
skipped), the protected-quest pin added after it and run with its file, the manifest and its 13 mutants. Still not
proven in a browser or with two players.
