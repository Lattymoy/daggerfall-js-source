# FIELD BUGS 2026-10-17e - the Orrery nobody could read

One report Mac handed over as a screenshot, 2026-10-17 ("The Elite Breach is still broken"), read on the code as it
stands at main's `619e661d2`, ORRERY-HEIGHT merged. (Main took `Field-Bugs-2026-10-17.md` to `-17d`, so this record is
`-17e`, its pins `fb1017e_*`.)

| | Report | What it was | Done |
|---|---|---|---|
| 1 | TheHalfinStream, in #general the evening ORRERY-HEIGHT merged: "so fun doing puzzles when you can't see", with a screenshot of an Athenaeum - "Turn the Orrery true. Stones true: 0 of 6 - fray 25", six gold rings on the floor and the company standing among them | The turns landed (the fray counts them: 25), but the Spire drew a gold disc a stone and nothing else - no stone's name, no hour, no riddle. The riddles fix the true hours and the hours say how far each stone is from them, so with neither on the screen the lock could only be guessed at, 48 turns a snap. A press from the far side of a handle was also sent from past the room's reach and dropped without a word | fixed (ORRERY-SIGHT) |

## ORRERY-SIGHT: the stones named, their hours shown, the riddles read

`src/systems/eliteGates/spireOrrery.js` (new: the hall's Orrery on this screen), `src/ui/eliteGates/egSpireHud.js` (the
riddles; the stone's words), `src/scenes/eliteGates/egFight.js` (the words over each stone), `src/scenes/eliteGates/egSpan.js`
(the handle's plaque), `src/scenes/eliteGates/egClient.js` (the hours to the plaque; the reach).

FOUND. An Athenaeum's lock is the Hour's Orrery (`11-Multiplayer/Elite-Gates.md` section 8.4; `net/superDungeon/sdBrain.js`
orreryOf): six stones, each at an hour of twelve, geared so a turn of one moves one or two others; six riddles that fix
the true hours ("Wayrest keeps the hour Sentinel keeps, and two more."); a dial that lights how many stand true, not which.
The Hour shows all of it (`scenes/superDungeon/sdHall.js`: a hand on each stone's dial, each stone's name and sign on its
handle's plaque, a riddle on each Ledger Plaque). The Elite Breach drew none of it. Each stone was a gold disc
(`egFight.js` drawGround), the handle's plaque said "Orrery stone 3 - Turn it forward an hour", and the HUD said "Stones
true: 0 of 6 - fray 25". The relay's word carries every stone's hour (`pz` and the fight's `pg.st`, folded by
`net/eliteGates/egLink.js`), and the client read only its count. The riddles were never on the client at all. The
relay draws the Orrery from the breach's seed and the hall (`net/eliteGates/egBrain.js`, the Athenaeum's arm of the fight's
stand), and nothing on the client drew it. ORRERY-HEIGHT's own record named the gap: "the stones are still a disc on the
floor with their handles unseen until the crosshair names one". It put the handles in reach, and the report's fray of 25
shows the turns landing. What it left was a lock that could only be guessed at: 16 to 36 turns at its shortest, gearing
nobody could see, and a snap back to the start that lashes every member a quarter of their health at the fray's end
(48, or less under The Fraying).

Beside it, THE REACH. The relay takes a turn from a member within 3.5 m of the stone in plan (`egBrain.js` egWord, `pz`).
The ray offers a handle that stands 0.9 m beside its stone from up to 3.2 m away (`player/activate.js`
DEFAULT_ACTIVATION_DISTANCE), so a member on the handle's far side reaches it from about 4.4 m. Their press was sent and
dropped, and nothing said why.

Why no test saw it: `test/net/eliteGates/egfrag_client.test.js` pressed a handle by its key from the arrival plate and
counted the `pz` sent. It never asked what the screen said or whether the room took the turn.

DFU has no Spire, no Athenaeum and no Orrery. This is our own hall's code, so no DFU member moves. The new file cites
Ledger A, as the breach's files do, and `01-Overview/Port-Ledger.md` section A's ELITE-GATES row names it
(`test/tooling/doctrine.test.js` holds every file that cites Ledger A to a row that names it - the PR's first CI run
failed there).

FIXED.
- **The draw on this screen.** `spireOrreryOf(seed, spec)` draws an Athenaeum's Orrery as the relay does: orreryOf of the
  hall's slot, `(egSeed(seed, 0x0a7e + h) % 2147483646) + 1`, on the Spire's turns range (`egOrreryTurns`). The relay
  adds The Fraying's fray when that decree is in force. The fray rolls nothing in orreryOf, so this draw is the relay's
  either way. The salt is the relay's literal, and it is written again here (`EG_ORRERY_SALT`) rather than exported from
  `egBrain.js`, because an export there is a relay change (RELAY_VERSION, a deploy that drops every connected player). The
  pin holds the two together, drawing hall for hall against the relay's own stand.
- **The riddles** stand on the HUD under the objective and its count, one a line, in the plaques' order, through an
  Athenaeum's trial (`egSpireHudModel` `riddles`, the `.eg-riddles` line - hidden for a witness, as the objective is).
- **Each stone's name and hour** stand over it (`egFight.js` sigilsFrame, a `stone` sigil in gold: *Wayrest - 4*). The
  hour is the one the room last said, so a turn moves the words over every stone it geared. Which stones stand true stays
  the dial's count: how many, never which, as the Hour keeps it (sdBrain orreryLit).
- **The handle's plaque** names the stone as the riddles do, with its sign (*Wayrest - the ship*, the Hour's own title).
  It says the hour its hand stands at (the Hour's words, sdHall SD_HALL_TEXT.hour), then the turn. The breach client's
  `objs` carries the hours (`orr`) to the span.
- **The reach.** A press from past `EG_STONE_REACH_M` (the room's 3.5 m) sends nothing, and the member is told "Stand
  closer to the stone." (the Hour's own word, SD_HALL_TEXT.closer). From within it the turn is sent as before.

No relay file changed: the relay's bundle, its version and the wire are untouched. No new prose is written into the code
- the riddles are sdBrain's, the hour's and the reach's words are the Hour's, the plaque's turn is EG-FULL's. The four
hosts: `scenes/world.js` registers the breach client's `objs` and `act` as before (`registerSpireObjs`,
`registerSpireAct`), and carries the hours and the reach without a line changed; `scenes/worldModes.js` hands an
`egstone:` press to the context as before; `scenes/dungeonContext.js` reads `egSpan.targets()` and `hoverName` as before,
so the plaque's new words reach the crosshair through it; `scenes/exterior.js` is offline, no breach (section 28).

Not changed: the stones are still drawn as discs. A stone with its dial and hand, and plaques standing in the court, are
a question for the hall's look, as the Hour's are (`11-Multiplayer/Super-Dungeons-Look.md` section 7). This fix puts
the lock's information on the screen; it does not change the look.

`test/systems/eliteGates/fb1017e_orrerysight.test.js` (3). THE DRAW: over the first six Athenaeums the build's law lays,
the hall stood on the relay, `spireOrreryOf` equals the relay's Orrery in its order, gearing, start, true hours and
riddles; it equals again under The Fraying, whose shorter fray is the relay's alone; and no other hall has one. THE REACH:
the relay takes a turn 0.05 m inside `EG_STONE_REACH_M` and drops one 0.05 m past it. The client, from the same two
places, sends the turn from inside and from outside sends nothing and says SD_HALL_TEXT.closer. THE SCREEN: the HUD's
riddles are the relay's six. The camera turned to each stone in turn finds its name and hour over it. A `pz` folded
through the wire moves the turned stone's words. The plaque gives the stone's name and sign, its hour, and the turn.
The first test fails on main (no `spireOrreryOf`); the reach test fails on main from outside the reach, where a turn
was sent. `tools/mutants/fb1017e.json`: 8 mutants, all dead (the salt, the Hour's turns range for the Spire's, the
client's reach longer and shorter than the room's, the refusal unsaid, the riddles unread, every stone one stone's
hour, the plaque's hour unread).

PIN MOVED: `test/net/eliteGates/egfrag_client.test.js` pressed the stones from the arrival plate, out of every stone's
reach. It now presses each from beside its stone, and reads the plaque's title as the stone's name ("Wayrest - the
ship"). `test/scenes/eliteGates/fb1017c_orreryheight.test.js` reads it the same way ("Daggerfall - the lion").
