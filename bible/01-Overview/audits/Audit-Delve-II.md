# AUDIT DELVE II - the dungeon's encounters, 2026-10-29

The owner, of DELVE II (`03-World/Delve-II.md`, DLV0 to DLV2, PR #1388): *"Audit this, ensure everything is as detailed
and perfect as possible. No band aids"*. Two cold lanes read it, each handed the code and not a conclusion: the pure
laws and their tests (the site law, the ledger, the words, the vault, the census), and the game's wiring (the host,
its foes, its marks, the save, the context's doors). A third read was the game's own: `tools/delveProbe.mjs` drove the
real game on the freeware's data through a Hold and a Litany, and its pictures found what neither lane could. Every
finding was reproduced before it was fixed - a script, a census or a frame named in its row - and fixed where it
began.

Severity: **Major** breaks what the slice promises for many players; **Minor** a wrong outcome for some; **Nit** a
cost, a word or a case no player meets yet.

## A - the site law (`world/dungeon/delveSites.js`, the census)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| A1 | Major | **Sites stood in a sliding wall's path.** The room was asked of the dungeon's own mesh alone; model 59006's 6.4 m wall (N0000034.RDB) reached 20 sites' discs - a plate inside it at 11 Litanies (never to be won), a gate at 9 Holds, the captain's at five. 86 sites in all had a mover, a lift or a door in the disc. | No piece but the dungeon's own may reach into a disc, 2.5 m over its floor, at its build pose (`Collider.bucketBoxes`, `boxMeetsDisc`; every client's the same, as the floor ray's). The census: 0 of 5,225. |
| A2 | Minor | **A piece could stand on a table.** The floor was asked on rings at eight bearings: a plate, a gate or the vault between them could stand on furniture or over a hole (Ruins of Krofylen Court: a 2.5 m block under the rays). | Every piece's own spot is asked: the tier's plates, the gates, the vault's four. Sixteen bearings were measured and refused: at the 121 dungeons they emptied, the points between found furniture 0.4 to 1 m high (151) or a pillar (201) with no piece on it. A room may hold what rooms hold. |
| A3 | Minor | The vault's side was settled by walls under a micron apart at 170 Holds (33 exact ties) - a last bit of one engine's trig from another plan hash. | The walls compared to the centimetre: nearer by less is a tie, the first bearing. |
| A4 | Nit | The small pass probed every 2 m candidate, those certainly within 60 m of a large site too: 61% of its time where one stood. | `tooNearTaken`, exact - a floor lands at most 4 m under its storey. |
| A5 | Nit | The census read the hearths at their centres, the host at their feet (AUDIT REST-PARTY C6's mistake, again); no plan differed. | `hostFlatSize`, the fire probe's, shared. |
| A6 | Nit | The level check read the large room's numbers for the small room (equal today). | The pass's own law. |

## B - the ledger (`net/delve/delveLaw.js`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| B1 | Minor | **The captain had no end.** A captain alive out of reach held the Hold until the party left the ward for 30 s, and nothing said so (an hour in the ward: still the captain). | `HOLD_CAPTAIN_MAX_MS`, 5 minutes of the encounter clock: the attempt ends, said as its own line ("The captain outlasted the ward."). Every phase ends now. |
| B2 | Minor | A captain killed in 8 s won 12 s later, in silence: its fall was believed only 20 s after it stood. | One kill's least time (`STAR_KILL_MIN_MS`, 2.5 s), the floor the waves already keep against a word faster than any blow. |
| B3 | Minor | The fold that ended an attempt ran on: a step in at the 30 s mark answered `[failed, gather]`, the line and the toll said twice. | An ended ledger moves nothing more; its caller drops it. |
| B4 | Nit | A moment of no number froze the clock for good (`stepAt` NaN). | Moves nothing, in the law and in the host's frame. |
| B5 | Nit | A wave was sized by who stood in the ward at the step, not at its own moment: 3 foes or 9 for one party (DLV3's case). | Sized at the moment the clock stood when it rose (`clockTo`). |
| B6 | Nit | DLV3's cases: an account named `constructor` or `__proto__`; a late word moving presence back; a ledger never woken kept for ever. | A map with no prototype; presence never moves back; an idle ledger lets go after 60 s. |
| B7 | Nit | The Abyss's numbers could never run: an Abyss dungeon stands no site. | Gone; the record says Elite. |

## C - the host and its foes (`scenes/delve/`)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| C1 | Major | **The Hold's foes fought dumb.** The leash was the companions' `follow`, and a follower takes no Enhanced AI fight (`ai/tactics.js`). | No leash. An ended attempt crumbles its foes wherever they are. |
| C2 | Minor | **A foe removed counted as killed.** The Wabbajack on the captain won the Hold, its new body standing outside the count; There's a Hole in the Bottom of the Ocean's replacements cleared every wave. | Each foe carries a stamp, which the context's two replace doors pass on. A kill is a foe downed: killed, executed, spared or put to flight. A captain gone without its fall stands again after 2 s. |
| C3 | Minor | A captain or a foe that would not stand left the Hold stuck. | Three picks a foe; a lost captain asked again; a dungeon whose table stands no foe stands no Hold (`delveKindsFor`). |
| C4 | Minor | An attempt ended mid-spawn drove the in-flight count below zero, and every later wave of that Hold ran its full 90 s. | The count is its own attempt's. |
| C5 | Minor | The foes were drawn without the dungeon's place: a mod's table (DEX3) could answer for another dungeon. | `dungeonPlace`, as the layout's foes. |
| C6 | Minor | The ward reached through walls: a corridor behind the room could wake it. | Past the disc, a clear line to the heart. |
| C7 | Minor | A ward gone dark woke at once under the player standing in it, over its own line. | Dark until a step back in. |
| C8 | Nit | 50 to 80 objects made a frame for each site near the eye. | Its word, looks, marks and pass entry kept and filled in place. |

## D - the pieces seen and the vault

| ID | Sev | Finding | Fix |
|---|---|---|---|
| D1 | Major | **The marks were dark stains** (the probe's frames): they used burning ground's grammar, which darkens the floor and greys its colour. | The telegraph's lit grammar: a bright line in the mark's colour, a dark keyline, filled where it is live. |
| D2 | Minor | The marks ignored fog and glowed through it to 48 m. | The renderer's fog, as the look round's glow takes it. |
| D3 | Minor | The chest had no collision: a player stood inside the Litany's. | A collider bucket of its own, gone with it. |
| D4 | Minor | Online the chests stood, and nothing else did. | Stood on the first frame offline. |
| D5 | Minor | Leaving any dungeon compiled and built the marks' pass only to delete it. | Only a pass it built is destroyed; `warm` was dead code, and is gone. |
| D6 | Minor | The vault was a name: the plaque never listed it, quick loot could not take from it, the look round called it a thing to work. | `delve:` itemises (`systems/worldHover.js`), the context's `lootContents` reads a won vault, the press takes through quick loot, and it is a find (`systems/dungeon/dungeonSense.js`). |

## E - the save and the record

| ID | Sev | Finding | Fix |
|---|---|---|---|
| E1 | Major | **The won vaults were never saved.** `snapshotPlayer` keeps only the options it names (TTL1's trap): every load sealed every vault again, and a Hold could be won again for a fresh roll. The tests read the host's own snapshot, never the envelope. | The vaults ride in the dungeon's own world record; a pin drives them through the real envelope. |
| E2 | Minor | A load stood a Hold's foe up again (the world record's restore revives a foe the save held alive), and once the Hold had ended nothing took it. | The restore takes every living foe a site stood, whatever attempt. |
| E3 | Minor | The pull request ran no CI: it conflicted with main. | Main merged in. |
| E4 | Nit | The record said things the code did not: the gates "on the ward's rim", "no site stands on a marker", law 3's "at the start", the Abyss's numbers, "the pile's gold", "Nothing below is built yet". | Each sentence rewritten to the code. |

## The open items, closed

- **Won in the real game.** The Hold (three waves and the captain) and the vault, at Bedard Laboratory; the Litany
  woke and showed its order there. The probe now closes the windows the fight opens and fails on one left open.
- **The look.** Pictured before and after D1: the ward, its gates, the plates and the seal now read on a dark floor.
- **Frame cost.** The encounters' frame 0.21 ms and their marks 0.22 ms at the mean (section 12).

## The real data (MAPS.BSA, BLOCKS.BSA; read whole, kept out of the repository)

- **THE CENSUS.** 5,225 of 5,698 sites stand in 3,838 dungeons (90.7%); 390 stand none; 1,381 stand two or three,
  every one a wave and a puzzle. A1's rule moved sites and lost none.
- **WHAT A DISC HOLDS.** At the sites sixteen bearings would refuse, the points between found furniture (151, 0.4 to
  1 m high), a pillar or a hole (201), a slope (36) and no dip. So the pieces' own spots are asked, and the rest of a
  room is left as Daggerfall built it.
- **THE COST.** The plan, every dungeon on one core: 7.4 ms at the median, 48 ms at the 99th percentile, 101 ms at
  worst - in the dungeon's load, beside a fire plan of 1.3 ms. A4's pruning took 61% off the small pass where it ran.

## Pins and mutants

`test/net/delve/dlv1_law.test.js`, `test/world/dlv1_sites.test.js`, `test/systems/delve/dlv2_words.test.js`,
`test/scenes/delve/dlv2_host.test.js`, and the pins this pass moved (`worldhover`, `sense1_dungeonsense`,
`auditrest2_camps`). Mutation-proven: `tools/mutants/dlv1.json` and `dlv2.json` - 197 records (122 and 75), every one dead, the one
once recorded equivalent (`DLV2-failed-keeps-the-ledger`) dead now that a dark ward waits for a step - and the records
of other lists whose code this pass moved, re-aimed by content and run again (`sense1`, `wb9f`, `worldhover`,
`auditrest2_camps`, `navaudit_frame`): 277, dead but for one equivalent as recorded and `NAVF-grid-stop-early`, which
survives on main too (`world/prefabColliders.js`, untouched here) and is left to its own list.
