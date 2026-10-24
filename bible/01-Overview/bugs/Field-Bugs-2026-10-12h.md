# FIELD BUGS 2026-10-12h - the region that never came back

A player's bug report, "Overworld Persistence (OW6L / AUDIT OW5b D2) Causes Permanent Regional Depletion of Procedural &
Elite Dungeons", relayed by Mac with the Discord thread it came from. Read on the code as it stands at main's
`4f98083f`. Mac, on the three fixes proposed in chat: "Do all 3".

> I exhausted all of Southern Alik'r. ALL.
> What's wild is that it punishes people for walking across the map and just seeing a dungeon.
> If it says, YOU DISCOVERED AN ELITE DUNGEON! That shits on a 14 hour timer now. For EVERYONE

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Walking past a spawned dungeon starts its death clock | `scenes/world.js` spawnedDungeonAt noted every spawn it stood: a pixel streaming in (three pixels either side of the player at the default terrain distance) started TTL1's seven days - fourteen real hours at the shared clock's 12x - entered or not | the long clock starts on entry (SPAWN-REBIRTH) |
| 2 | A dead spawn never comes back; a walked region stays empty for everyone | the roll is a pure hash of the pixel, so AUDIT OW5b D2 kept a dead spawn's row as a tombstone; the cell's ledger (`net/overworldLaw.js`) kept each row sixty real days | a dead spawn stands again 24 real hours after it died (SPAWN-REBIRTH) |
| 3 | A character's save keeps its tombstones forever; a veteran refuses a newer player's spawn | the save carried every row; the ledger's min-merge kept the earlier first sight, so a later life's row never replaced a life gone by | the save drops a life that is over, and the merge gives way to a later life (SPAWN-REBIRTH) |

## SPAWN-REBIRTH (1, 2, 3)

`src/world/spawnedDungeons.js` (`REBIRTH_TTL_DAYS`, `REBIRTH_TTL_MINUTES`, `spawnDeath`, `spawnReborn`, `spawnExpired`,
`createSpawnLedger`), `src/scenes/world.js` (`spawnedDungeonAt`, `_spawnSeen`, `overworldLedgerHeard`),
`src/net/overworldLaw.js` (`OW_GENERAL_TTL_MIN`, `OW_CLEARED_TTL_MIN`, `OW_REBIRTH_MIN`, `owRowUntil`, `owRowFits`,
`owFoldRows`, `owPrune`, `toWelcome`), `src/systems/save/save.js` (comments).

**Reproduced first.** main's own host run (test/world/spawneddungeons.test.js, AUDIT OW5b D2: spawnedDungeonAt lifted and run)
asserted the lockout as its law - the first build of a spawn's pixel wrote its ledger row and owed it to the cell, seven
game days on the pixel built empty, and thirty days on it was still empty with the row kept. Run against main's
modules: `owFoldRows` took a row whose first sight was fifty-nine real days old (the cell kept that spawn dead), and a
ledger holding a first sight on day 1 merged one from day 61 and kept day 1 (`merge` answered false). On this build the
relay drops that row and the ledger takes day 61.

**1. The long clock starts on entry.** spawnedDungeonAt stands a spawn and starts nothing. The one door that starts the
seven days is the dungeon's: `onDungeonSpawned` (dungeonContext.js tells the host when it builds a synthesized
dungeon - a walk-in, a Recall, a save loaded inside, a party member following), which was already wired to `_spawnSeen`.
A dungeon nobody went into stands however long the road beside it is walked. The ledger's `seen` is the first ENTRY
now; the wire's row keeps its shape (`[px, py, seen, cleared?]`), only what `seen` means moved.

**2. A dead spawn stands again.** A spawn dies on the earlier of its two clocks (`spawnDeath`: two days from its first
clear, seven from its first entry) and the same dungeon stands again REBIRTH_TTL_DAYS later - twelve game days,
twenty-four real hours on the online clock (`spawnReborn`). Dead means dead and not yet back: `spawnExpired` answers
false once the wait is over, so the build stands it again with no clock running until a player enters it. The same
template and the same elite roll: the roll is still a pure hash of the pixel, so every client and the relay agree on
what stands there without a word, and the map id, the room and the automap keep meaning one dungeon. The cell keeps
a row exactly until then (`owRowUntil`: its death plus OW_REBIRTH_MIN, the three numbers pinned equal to the ledger's
own) - the fold lets a life that is over go BEFORE it folds, so a later life's first entry is taken whole and is never
min-merged into the life before; a heard row whose life is over is dropped, never struck; the prune and the welcome
read the same end. A row is now kept at most nineteen game days (thirty-eight real hours), where it was kept sixty
real days.

**3. No ledger keeps a life that is over.** The client ledger reads a row whose spawn has stood again as no row: `note`
and `clear` start the new life's clocks over it, `has` (new - the first-entry door's "is this already known") asks for
the current life alone, `merge` takes a clock (the host passes `_spawnClock()`) and drops a heard row whose life is
over, and replaces a held one with a later life's - the report's veteran, who held day 1 and refused day 61. `toJSON`
leaves out every row whose life is over by the latest clock the ledger was asked at, so a save carries none; with no
clock ever asked (an offline session never reads these clocks) every row is kept as it was.

`test/world/spawneddungeons.test.js` (21; four new, the AUDIT OW5b D2 host run rewritten - streamed in, no clock; entered, the
seven days; past them, empty however it is asked; a minute short of the wait, empty; the wait over, the same dungeon,
no row saved; the next entry, the new life's clocks owed to the cell), `test/net/ow6_ledger.test.js` (19; the pins, the
fits, the prune and the welcome on the new end, one new law test - a later life taken whole, a minute before its end the
same life's - and the host's merge at its clock), `tools/mutants/spawnrebirth.json` (17, 17 dead), and the records of
`tools/mutants/ow6l.json` and `ow6h.json` this moved, re-aimed by content (83 dead across the four lists). PIN MOVED: `test/systems/travel/tv6_dungeons.test.js`'s
AUDIT OW4 D5 host run enters the spawn before its clock can run out.

**RELAY_VERSION world198.** The cell's keep is the relay's law, so this needs the relay's deploy, which drops every
connected player once. Until it lands the live relay keeps rows sixty days; a client of this build reads every row
whose life is over as none, so the spawns stand again for it all the same.

## For Mac

- **Entering still starts fourteen hours.** The report's own first proposal was to drop the long clock entirely (only
  a cleared spawn dies). That changes TTL1, the creator's rule ("after 7 ingame days in general when there is no
  player in it"), so it is not done: a player who walks in to look at the foes and leaves starts the seven days, and
  the spawn stands again a day after it dies. Dropping the long clock is one line in `spawnExpired` and one in
  `owRowUntil` if you want it.
- **Older clients until they reload.** A tab still running the build before this one notes every spawn it streams
  past and says the row to its cell; the cell min-merges it, so those spawns die fourteen hours after such a tab walked
  by, for everyone, until it reloads. They come back a day after, as any other.
- **The re-roll is not done.** In chat the fix was offered as "could give a different template and a different
  elite/normal result". It stands the same dungeon again: a new template per life needs every client and the relay
  to agree on a life counter per pixel, which the keep above lets go of, and the map id, the dungeon's room and the
  automap all key on the one pixel.

## AUDIT SPAWN-REBIRTH (2026-10-12, Mac: "Lets do an audit on this")

A cold review of the branch at `bee9d484` (every finding read off the code; then each re-read here before anything
moved): eight findings, six fixed, two answered.

| | Finding | Verdict | Done |
|---|---|---|---|
| F1 | A first entry is made underground, with the socket in the dungeon's room, where `sendOverworld` says nothing (a cell's alone); `overworldLedgerFrame` let a row go after OW_SAY_KEEP_MS (10 min) there, so a run longer than that never told the cell it began - and `has()` keeps a re-entry from owing it again. Before SPAWN-REBIRTH the first sight was said from the overworld | real, this change's | fixed: what is owed waits for a cell - while the primary room is none, the owed rows' keep is held, and it is counted from the cell they are said in (`world.js` overworldLedgerFrame). A clear, made underground too, had the same hole since OW6L |
| F2 | A spawn back from the dead on a pixel built EMPTY while it was dead (the pixel still loaded): `expired` answers false, so the Overworld marked it found and walked to bare grass - FIELD BUGS 29h the other way round | real, narrow (a player near the pixel across its return) | fixed: `tvSpawnGone` takes the build's word both ways - a built pixel stands a spawn if and only if it was built with one; off the built ground, the clocks |
| F3 | A client whose clock runs up to OW_ROW_SLACK_MIN ahead can start a new life the relay still counts as the old one's last two minutes: its entry is min-merged into the old row and lost with it | real, not worth its code | answered: the window is ten real seconds once per spawn's thirty-eight hours, it needs a fast clock, and its cost is one life the cell does not hold (the spawn lives a little longer for the rest). A fix is a third arm in the relay's min-merge, which must stay the same in any order |
| F4 | `toJSON` judged a life over by a HIGH-WATER clock that `load()` never reset: a clock read fast before the shared offset landed left every row its mark had passed out of the next save | real | fixed: the clock the ledger was LAST asked at, and a load forgets it (`spawnedDungeons.js` createSpawnLedger) |
| F5 | `merge`'s `now` defaults to NaN, which min-merges as OW6L did (the veteran's bug) | answered | the one caller passes `_spawnClock()`; NaN is the boot before the ticker stands, where dropping the cell's welcome would lose more than a min-merge risks - and `expired` reads a life that is over as none whatever was merged |
| F6 | `_spawnSeen` skipped a Hollow but not a Wild Zone hall (`spawned: true` too): entering the day's hall noted a TTL1 row, and fourteen real hours on - inside its 24-hour day - `_locationToBuild` took it out and built its pixel empty; on a pixel the world's spawn roll also holds, the cell took the row, so for everyone in it | real, older than this change | fixed: no hall's entry or clear notes a row, and no row (an older build's) takes a hall out (`world.js` _spawnSeen, _noteSpawnCleared, _locationToBuild) |
| F7 | The world197 bump's note kept world196's (CHAT-LANG) inline, and this bump dropped it | real | fixed: world197 and world196 on their own history lines in `wire.js`; world198 re-hashed in place, undeployed |
| F8 | `spawnExpired` wrote the two clocks a second time beside `spawnDeath` | real, a cleanup | fixed: one law - dead from `spawnDeath`, back REBIRTH_TTL_MINUTES after it (the same answers, a negative elapsed never expiry) |

Pins: `test/net/ow6_ledger.test.js` (20; F1's host run - a run three keeps long underground, its entry said from the cell
it comes out in), `test/systems/travel/tv6_dungeons.test.js` (F2 on the AUDIT OW4 D2/D4 host), `test/world/spawneddungeons.test.js` (F4 on
the save test, F6 on the host run and the clear's source). Mutants: `tools/mutants/spawnrebirth.json` (23 - F1, F2,
F4 and F6 added; the short clock's record left to `ttl1.json`, whose three expiry records re-aim at `spawnDeath`), and
`fb0929h_spawnplate.json`, `ow4d.json` and `ow5d.json`'s `tvSpawnGone` and `_locationToBuild` records re-aimed by
content.
