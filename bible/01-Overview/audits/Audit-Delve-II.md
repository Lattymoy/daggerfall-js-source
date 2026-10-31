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
| A2 | Minor | **A piece could stand on a table.** The floor was asked on rings at eight bearings: a plate, a gate or the vault between them could stand on furniture or over a hole (Ruins of Krofylen Court: a 2.5 m block under the rays). | Every piece's own spot is asked: the tier's plates, the gates, the vault's four. Sixteen bearings were measured and refused: they emptied 121 dungeons, and at 400 of the sites they refused the points between found furniture 0.4 to 1 m high (151), a pillar or a hole (201) or a slope (36) where no piece stands. A room may hold what rooms hold. |
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

- **Won in the real game.** At Bedard Laboratory, on the audited code: the Hold (three waves and the captain, 409 s)
  and the Litany (its order shown, then walked, 91 s), each vault opened (3 and 4 items), no page error. The probe now
  closes the windows a fight and a vault open, and fails on one left open.
- **The look.** Pictured before and after D1: the ward, its gates, the plates and the seal now read on a dark floor.
- **Frame cost.** The encounters' frame 0.09 ms and their marks 0.15 ms at the mean over 675 frames (section 12).

## The real data (MAPS.BSA, BLOCKS.BSA; read whole, kept out of the repository)

- **THE CENSUS.** 5,225 of 5,698 sites stand in 3,838 dungeons (90.7%); 390 stand none; 1,381 stand two or three,
  every one a wave and a puzzle. A1's rule moved sites and lost none.
- **WHAT A DISC HOLDS.** At 400 of the sites sixteen bearings would refuse, the points between found furniture (151,
  0.4 to 1 m high), a pillar or a hole (201), a slope (36) and no dip. So the pieces' own spots are asked, and the rest
  of a room is left as Daggerfall built it.
- **THE COST.** The plan, every dungeon on one core: 7.4 ms at the median, 48 ms at the 99th percentile, 101 ms at
  worst - in the dungeon's load, beside a fire plan of 1.3 ms. A4's pruning took 61% off the small pass where it ran.

## F - DLV4, the five new kinds (2026-10-29)

A cold lane read DLV4's law and host with the code alone and drove each finding with a script; the real-game probe read
the crystal seam. Fixed where each began, each pinned and its mutants dead (`tools/mutants/dlv4.json`).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F0 | Major | **No blow reached a source or a seal in the real game.** The seam took `opts.gateCrystals?.() ?? delve.breakables()`, and outside a Reckoning the court answers an empty list, which `??` never passes. The tests drove `host.hit` and never met it. | The seam takes both lists, numbered apart (`dungeonCrystals`), held by a behavioural pin on the court's own answer. |
| F1 | Major | **A flame let fall was taken up the next frame.** The host took any flame within reach, so a blow or a readied weapon never freed the hands, and each taking renewed its 20 s. | The host takes a fallen flame only once its carrier has stepped off it; the law keeps the flame's life and walk from the heart. |
| F2 | Major | **A piece carried out of the ward stuck for up to 60 s.** A let-go from outside the ward was refused, and the flame's life ran on a clock that stops when the party is away. | A word or a let-go from outside the ward, or a carrier silent 15 s, sends the piece home; the flame lives on wall time. |
| F3 | Minor | A lying client dropped the flame at a brazier and took it up there, skipping the step law. | A flame taken up where it lies keeps its first take's place and moment. |
| F4 | Minor | A word could say level 1 as the pieces rose and 60 as it struck. | A record keeps the level it was made at: lower, never higher, while the attempt stands. |
| F5 | Minor | `delveState`'s fields are not the ledger's, which the looks read. | DLV3: the client makes a ledger-shaped view of the room's word, one adapter pinned against both. |
| F6 | Minor | The Vigil's blows were one count for every machine: a new owner's were lost. | Each account's machine is credited from its own count. |
| F7 | Nit | The bible gave the Weighing a 3 s rise it does not have. | The sentence names the Brazier Rite and the Seals. |
| F8 | Nit | A weight lifted off a plate was set back on it the next frame. | Set back only once its carrier steps off and on. |
| F9 | Nit | The Vigil's rest lives in the offline host alone. | DLV3: the room keeps it with the site. |
| F10 | Minor | The rite's foes drifted in on the gates, onto the pedestals (model 74237, 1.2 m square, 0.9 m high). | They drift in off the rim on the axes the vault does not take (`driftSpots`). |
| F11 | Nit | Thirteen of a Wellsprings' foes may live at once (four sources' three and the captain) against a `delve` grant of 12. | No change: a grant's most is one ask's, and each pour asks its own (DLV3 sizes the kind's rate to the pours). |
| F12 | Nit | `hit` answered true for a refused blow, so a spell kept rounds on the piece; the bible put the Seals' vault at a wall. | It answers whether the blow landed; the bible says the heart. |
| P1 | Minor | The host judged my blows and acts in the ward by the disc alone, my words by the disc and a line to the heart. | One reading for all three (`holds`). |
| P2 | Nit | The brazier's flame stood at 0.8 m, in the pedestal: its top face is 36 units, 0.9 m, over its lowest point. | Measured from ARENA2 and pinned. |
| P3 | Major | **Found in the real game** (`tools/delveProbe.mjs`, the Weighing): **a weight pressed from 1.3 m took nothing, and said nothing.** The press reaches 3.2 m (DFU's treasure distance, to the weight's box); the law took a weight within 1.2 m, the walking reach. | A weight is taken from as far as a press reaches (`DELVE_PRESS_M`, the box's half shared with the host's target); the flame, braziers and plates, walked to, keep 1.2 m. |

## G - DLV3, the encounters online (2026-10-29)

A cold lane read the relay's room, the wire, the session, the link and the host's online paths with the code alone, and
drove each finding through the real Room (`test/fakeRoom.mjs`) and the real host wired to it. Two were found before it,
in the session. Each is fixed where it began and pinned; the pins that missed them fed the host frames the room never
mints, so the room's words are now read through the wire's own law before the host hears them
(`test/scenes/delve/dlv3_e2e.test.js`).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| G1 | Major | **The Seals could never be won online.** The law kept their window in `wz`, a wave's size, and the wire, which bounds `wz` so, dropped every state of a risen site. | The window is the ledger's own `sw`; the page reads it off the law (`sealWindowMs`), so the wire says nothing new. |
| G2 | Major | **Any page could replace the room's plan**, and every honest page was then stood down for the whole visit. | The room keeps four plans side by side, each with its own ledgers; past four, the least used with nothing at stake gives way, or the page waits and says its plan again. Each frame names its plan (`ph`). |
| G3 | Major | **A second Vigil went dark with no blow struck**: the page's blow count ran on from the first attempt. | A fresh attempt online starts the page's counts from nothing, as offline. |
| G4 | Major | **The foes' machine flipped on every word** at a puzzle: a machine with no foes host said it held none. | A named machine keeps holding them. |
| G5 | Minor | A frame that returned early (a silent hub, a vault's ask) dropped what the site's step had moved. | The step is said and kept first. |
| G6 | Minor | A stranger's every word asked the hub. | The hub's no is kept 30 s and its silence 5 s; the stranger's page is told once and holds its words there until the site's state moves. |
| G7 | Minor | A mentor's lower level was overridden by the token's. | The lower of the two, as the serpent's. |
| G8 | Minor | Online, the wrong plate stayed red through the replay. | Its mark is timed on the page's own clock. |
| G9 | Minor | Twelve mutant records no longer applied and two named two sites. | Re-aimed by content; the frame's shared end is one function. |
| G10 | Minor | A frame that waited on the hub could fold into a ledger another frame had begun. | It folds only into the ledger it read. |
| G11 | Minor | A machine leaving by a door handed its wave to an heir while the next machine stood the wave again; one named with nothing left never said it clear. | An encounter's foe is never handed on; the next machine counts on from the room's deaths and says a spent wave clear. |
| G12 | Minor | One page could hold every site of a room. | One running attempt an account, told so. |
| G13 | Major | **After a reconnect, a word went down a socket not yet welcomed**, and the relay closes the socket for it. | Ready only on a welcomed socket (SD-HELLO). |
| G14 | Minor | The pose made current before a word was not the one `sendPose` says: a body lying down was said standing. | One home for the pose frame's body (`_poseOut`). |
| G15 | Nit | The room told a guest it had no party. A guest's token names an account, which the hub's party may hold. | The hub is asked of every account; the dead branch is gone. |

- **NOT A FINDING.** A window held open online does not stop the words: online the world runs on under a window
  (WINDOW-ONLINE), and so do the encounters. The token's level now stamped in a world room reaches the grant's `l`,
  which the levelled kinds alone read (`enc`, `camp`, `band`, `encr`), and no stand in a dungeon asks one: its every
  ask names its own kind (`loose`, `quest`, `rev`, `ally`, `delve` - scenes/dungeonContext.js spawnLooseFoe).

## H - DLV5 and DLV6, the curated blocks (2026-10-29)

A cold lane read the record's law, the made block, the splice, the anchors, the fires, the lab and the four shipped
records, and measured them on the freeware's data: 2,232 spawned-style clones spliced. Each finding is fixed where it
began and pinned (`test/world/dlv56_audit.test.js`, `tools/mutants/dlv56.json`, 47 records, every one dead).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| H1 | High | **A quest's things stood in a block no longer laid.** The layout spliced; the quests read the location's own list. 2,156 of the 2,232 replaced blocks held quest markers, 79% of them with no floor under them. | The location as built carries the block (`smallerDungeons.js dungeonLocationFor`, `curatedSplice.js curatedLocation`), which the world host and both quest worlds read; the layout lays the list it is given. The dungeon whole - an instance's, an online quest's - is its own blocks. |
| H2 | High | **The game's own path for the anchors was untested**: the context passes none, and both laws read their defaults. Emptied, every test stayed green. | Pinned through the defaults with a laid curated block. |
| H3 | Medium | **An older page lays the slot as Daggerfall's** in the same room, and a record joining a pool re-dealt every dungeon of its type. | The room's size word names the block (`full+2`) and the room carries it, `.c2` after the size's (`net/wire.js` WORLD_ROOM, `dungeonRoomTag`); online the public room counts as relaid, so a quest's things stand in its instance. Each record weighs on its own lane: a new one takes only the dungeons it outweighs. |
| H4 | Medium | The lab's template loop read MAPS.BSA's regions (TAMRIEL-WIDE). | The Bay's own templates, said so (`BAY-OWN:`): every lair past the Bay is cloned from them. |
| H5 | Medium | **Export and Rebuild kept one type and a new number**: throne-hall would have lost four types and become NDLV0005. | A draft keeps every type (a list field) and the number it ships as. |
| H6 | Medium | **One draft slot** - a typo, a shipped record opened, or no storage lost the designer's work, and the next boot threw. | Drafts kept by id (`labKeep`, `labKept`), never one the law refuses; delve.html resumes them; no storage, nothing leaves the page. |
| H7 | Medium | A Super dungeon's Hollow took a block and stood no encounter in it. | No Hollow and no zone hall takes one (`curatedTakes`). |
| H8 | Medium | **A chain's head could be dropped** (138 levers, wheels and teleport doors), and a flat drop could take a quest marker or the start marker that carries the water level. | What acts and what an action names are kept; editor markers by name alone; the way in never. |
| H9 | Minor | The lab judged a 3 m ward by its own law, the game by the large one. | An anchor gives way to a fire or the way in by its own ward's law (8 m and 12 m for 3 m; 12 m and 20 m for 4 m). |
| H10 | Low | The lab laid its draft as the start, so its base's exit door stood; the bench's spawn laid whole; a base missing crashed unnamed; 51.2 sat in two blocks; an empty `at` field read 0; an added model took a base reference's `DOR`; a mod's block of the base's name was read; two anchors stood 8 m apart; the way in was never asked; a 0 could ship. | Each fixed: never the start; built as the world builds it; named; half-open; refused; its own reference; BLOCKS.BSA's own; one anchor a block; asked; refused. |
| H11 | Medium | **Found in the real game after the audit** (`tools/delveProbe.mjs --lab`): the lab stood a draft with no spot on its first anchor's heart, so the ward woke at the boot. | The bench reads `?at` alone; the host's `firstFloor` gives the grid's floor nearest the first site, on its storey and a step past every ward (`inWard`). |
| H12 | Medium | **Found by CI:** a played page imported the lab's panel from `src/tools/`, which AUDIT ANTICHEAT A2's sweep leaves out on the premise that none does; the lab read storage past the seam. | The panel stands with the bench that mounts it (`scenes/delve/delveLab.js`, `delveBench.js` mountLabPanel and labStand); storage through `appStorage`. |

- **NOT A FINDING.** The fire law keeps 12 m from an anchor that a fire or the way in then stands down: a campfire
  fewer in a block whose encounter gave way, never one in a ward.

## I - LITANY-STAND and DELVE-VAULT (2026-10-31)

The owner: *"Audit"*, of `cb7def4b6` and `b2b3faf53` (`03-World/Delve-II.md` section 16). One cold lane read the diff
with the code alone; the session ran the new pins six times, the whole suite and the census for a Litany to probe.
Each finding below is fixed; I1 to I5 are pinned, and each pin failed on the code it was found in. On the audited code the
probe won The Agryn Prison's Litany again in the real game (83 s, the vault 8 items).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| I1 | Major | **In a party, a lit plate stood on through another member's wrong plate never lit again**: the law kept it as judged, so its member had to step off and on - the field bug again, in a party. | A plate a member stays on is heard again when it would light (`delveLaw.js` litanyWord). |
| I2 | Major | At a relay before `world298`, the new page's words would make an Elite Litany wake two foes at each showing while a member stood on a wrong plate. The record said the site may deploy first. | DELVE_RELAY_MIN is 298: a page at an older relay stands no site online. Deploy the relay first. |
| I3 | Minor | A plate stood on as the order ended was judged with no step: in an Elite fight, a member on a wrong plate woke two more foes. | A plate stood on through the show counts only when it would light. |
| I4 | Minor | A Legendary from a vault did not empty the drought: the piece was never marked as a source door's. | Marked `untaken`, as a pile's piece. |
| I5 | Minor | Online, the vault's weapon took no sigil, though the pile's weapons do (SIGIL1). | `stampWonWeapons`, last. |
| I6 | Nit | Section 13's row was rewritten instead of marked, and section 12's left saying a step is said once. | Both marked as history. |

- **OPEN, THE OWNER'S CALL: THE RATE.** A Litany is won in about two minutes, and its vault now always holds a Magic or
  better piece and 40 gold a level. A dungeon stands one to three sites, each back in 20 minutes, and online every
  earner takes a share. That is more pieces an hour than the Starfall gives (three stars an hour, one piece each). The
  reward is the owner's ask and is not changed here. The ways open: the piece once a day, as the Rite chest; the piece
  by the kind's work (waves always, puzzles by chance); or as it stands.
- **NOT A FINDING.** `sendPose` keeps the pose every frame even when it sends none, and `sendDelve` says it before the
  word, so the room hears last frame's feet. The wire takes `st` from -1 to 5. A ledger kept by `world297` holds `pl`
  -1, and no plate lights twice. The piece takes no curse, socket, finder or the opener's luck, as the raids' spoils.
  The whole suite at the audit's head, in eight shards: 39,197 tests, three failing and none of them this change's.
  `fb1002_audit`'s step-back fails the same on main at `1ecc2e5c7`; `staffpanel5message_client` and `staffpanel5bench`
  pass alone.

## Pins and mutants

`test/net/delve/dlv1_law.test.js`, `test/world/dlv1_sites.test.js`, `test/systems/delve/dlv2_words.test.js`,
`test/scenes/delve/dlv2_host.test.js`, and the pins this pass moved (`worldhover`, `sense1_dungeonsense`,
`auditrest2_camps`). Mutation-proven: `tools/mutants/dlv1.json` and `dlv2.json` - 197 records (122 and 75), every one dead, the one
once recorded equivalent (`DLV2-failed-keeps-the-ledger`) dead now that a dark ward waits for a step - and the records
of other lists whose code this pass moved, re-aimed by content and run again (`sense1`, `wb9f`, `worldhover`,
`auditrest2_camps`, `navaudit_frame`): 277, dead but for one equivalent as recorded and `NAVF-grid-stop-early`, which
survives on main too (`world/prefabColliders.js`, untouched here) and is left to its own list.

DLV4: `test/net/delve/dlv4_law.test.js`, `test/scenes/delve/dlv4_host.test.js`, `test/render/delvecrystalscale.test.js`;
`tools/mutants/dlv4.json`, 119 records, every one dead.

DLV3: `test/net/delve/dlv3_relay.test.js`, `test/scenes/delve/dlv3_online.test.js`, `test/scenes/delve/dlv3_e2e.test.js`,
`test/tooling/dlv3_probe.test.js`; `tools/mutants/dlv3.json`, 154 records, every one dead.

DLV5 and DLV6: `test/world/dlv5_curated.test.js`, `test/world/dlv6_blocks.test.js`, `test/world/dlv56_audit.test.js`;
`tools/mutants/dlv5.json`, `dlv6.json` and `dlv56.json`, 45, 28 and 47 records, every one dead.

LITANY-STAND, DELVE-VAULT and their audit: `test/net/delve/dlv1_law.test.js`, `test/scenes/delve/dlv2_host.test.js`,
`test/scenes/delve/dlv3_e2e.test.js`, `test/net/delve/dlv3_relay.test.js`, `test/systems/delve/delvevault.test.js`;
`tools/mutants/litanystand.json` and `delvevault.json`, 5 and 12 records, every one dead.