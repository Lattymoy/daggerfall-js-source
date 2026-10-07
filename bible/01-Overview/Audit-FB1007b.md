# AUDIT FB1007b - FIELD BUGS 2026-10-07b audited, 2026-10-07

The owner, of the batch (`01-Overview/Field-Bugs-2026-10-07b.md`, pull request #667): *"audit this"*. Five lenses read the
batch at `e75fbfae`, each on its own frozen worktree, read-only, verifying its findings before reporting them (a node run
for every claim it could run), with the player's ARENA2 (the DFU freeware set) and DFU's source in scratch:

- **the towers** - TOWER-FLOORS' law against the whole corpus, every consumer of a moved model, the rooms it touched,
  the state saved in them;
- **the seat** - FAMILY-SEAT's move, its guards, every merge and every reader of the seat, the House page;
- **the hold** - HOLD-SOLO's identification, play without a room, every shared lane, deaths, loads, staff and parties;
- **the climb** - CLIMB-TRAVEL's gate in both lanes, every time-scale writer, the keys' travel, a hold across a load;
- **the tests and the record** - the pins (29 mutants of its own), every claim of the record, the ledger and the pull
  request's patch notes.

Nothing was fixed in the snapshot (Home.md, 17l); the fixes went to the branch while the lenses read their copy. Each fix
carries an `AUDIT FB1007b <ID>` comment and is pinned; `tools/mutants/fb1007b.json` holds **59 mutants, all dead** without
game data (23 of the batch's, re-aimed by content where a fix moved their line, one retired with the repair it tested,
and 37 of the audit's - every survivor the lenses found among them), beside `tv_wasd.json` (12) and `legacyname.json`
(21), all dead.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | MAJOR | A false public record: the second patch note ("a library and a bookshop in the desert had the same fault, and they are fixed too") and the record's "two shops". LIBRAM00 #7 and BOOKAS00 #8 are House2 rooms (DFLocation's 18) of blocks no location places - none of MAPS.BSA's 15,251, neither town pack - and not in the desert (the desert's blocks are the B set). VOID-ENTRY's 16 classic voids are in ten more such unplaced A-set blocks, not "the desert blocks". | The note's line deleted from the pull request; the record, the ledger's rows, World-Arc, Active-Arcs, FB1004d's note, Testing.md, interiorLayout.js, enterExit.js and both tests say what they are. A gated pin reads MAPS.BSA and the two rooms' building types. |
| F1 | minor | The hall 28703's repair table (a storey lower in those two rooms) fixed its height alone - its record's X/Z is its stair shaft's, and one of the "two enter markers" it was said to floor had no floor - in rooms no player can enter. And the towers' marker pins read flat records the layout never moves: they could not fail. | The repair dropped with its claim (the law alone; VOID-ENTRY stays 16, measured). Every tower marker is pinned standing on a floor the room's own collider holds, within 0.1 m of it. |
| F2 | minor | The two rooms' second doors "land at their own doors": on a cut-off entrance cell (its walls crossed at its centre, no ceiling over it). Plane 2700 was called a floor plane - it faces down, a ceiling. | Said as it is. |
| S1 | minor | THE NAME FOLLOWED THE SEAT. A nameless copy (a tab still in Privateer's Hold, a single-named founder) merged with a named one whose seat had moved named itself for the moved seat: the house "of Tamhope" became "of Wayrest", its founder with it - and online `houseOfRecord` signs every player's view of the house with it. Found beside it, LEGACY-NAME's own: a named house merged with a stale save that saved its founder last left the founder nameless. | `store.js` mergeFacts: a copy that never learned the name takes the other's, and every nameless member of its blood with it (`family.js` nameHouse, nameAtSeat's own half); and the blood a stale save left nameless takes the house's. Pinned through two real host tabs over one storage, the realm line's and the save's merges both ways. |
| S2 | minor | The move was stamped by the wall clock alone: a later move made on a clock behind the stamp of the seat it moved (another device's, a day ahead) lost every merge. | Stamped after the seat it moves, as writeCurrent's `savedAt` is. |
| T3 | minor | "The later move stands in every merge ... the save's against the store's" was false one way round: mergeFamily takes the save's facts in only when the save's copy is the newer, so a save carrying a move its store never took (another device's) lost it. And no pin held a base keeping its own later move (an earlier move standing over a later survived). | mergeFamily: the store's copy the newer, the save's later move stands all the same; both directions and the base's later move pinned. |
| S3 = T4, T5 | minor | Unpinned: the seat's guards (the past played back, Legacy off, the one played dead, another character in the world - AUDIT LEGACY II A1's class), the region term of "not the seat already", "the house keeps its name", the House page's refusal (said as a move made survived) and its word's lifetime (outliving another page's press, or the visit). Ten mutants survived. | Each pinned; their mutants recorded, dead. |
| T2 | minor | Both fixture towns were in different regions: refusing every town of the seat's own region - the commonest move - survived. | Another town of the seat's region pinned offered, beside another region's town of the seat's name. |
| S4 | nit | After the second press the keyboard fell to the page (the pressed button goes with the move), and the next Tab went back to the tabs. | The move's word holds it, AUDIT LEGACY II U7's way (`tabindex`, `data-focus`); armed, it stays on the button. |
| S5 | nit | `seatNowhere` never reached a player: where the move was not offered the page said nothing, and the seat looked fixed for good. | A hint where the house could move but the player stands in no other town - the host's own refusal's words ("another town"), never in the past or while a Succession waits. |
| H1 | minor | AN EXPLOIT: the solo dungeon was the player's own configured start cell, a setting (the settings screen, the New Game pane) - online any dungeon a player named left the shared world, fresh at every entry and its loot rolled anew, and the real Hold was the old shared room again for them. | The dungeon no one shares is the SHIPPED cell's (`startDungeon.js` isTutorialHold); the classic start, PH1 and D-ONLINE2 read the configured cell as ever. |
| H2 | minor | No room remembers the Hold, so every entry built it whole - its dead risen, the containers emptied full again, rolled at the player's level: the LOOT-REGEN report's "all the guys I killed before have loot again", and the one online dungeon outside WORLD8's hour. | Online the page keeps its memory as a room keeps one (the place's own record, stamped on the relay's clock): taken at the door out, laid back at the next door in, WORLD8's hour on it; a load forgets it. |
| H3 | minor | A staff `/tp` to a player in the Hold landed in the staff's own empty copy, told "Teleported to X's exact position." | Refused as `unavailable` (an existing code - no relay change). |
| H4 | minor | In the Hold the presence session keys no room and hears no welcome, so no relay clock: a session loaded or born there ran on the device's clock until the player walked out - the time away paid late, over the time in the Hold (two real hours of it a fresh start), a banishment's term, a receipt's life and the timers blank. | The hub's link hears it - its welcome carries the relay's clock (AUDIT SOC B7) - into the presence session's own handler. Pinned through a real session. |
| H5 | minor | In the Hold the game said the wrong thing: a Local line went nowhere in silence, a page held out said "You are not connected.", two party members each in their own Hold were drawn "with me", and the Online pane said every dungeon is shared. | The Local tab, a roll asked there and a typed line say "Nobody can hear you here: Privateer's Hold is yours alone."; a page held out says nobody is near; the party card draws them apart; the pane says the Hold is each player's own. |
| C1 | minor | The motor's journey was read in every mode, and only the exterior frame's governor clears the keys' travel: a load (or a teleport, a door) taken with the keys held left it standing, and no wall indoors could be climbed, in either lane, until the player walked out. | The motor's journey is out of doors alone (`world.js` travellingOutdoors - the wild gate's own rule). |
| C2 | minor | A journey could set out from a wall: the gate let the hold go, a fall its height - a fresh character's health is a 12.5 m drop. (No worse than before the batch, whose x60 climb raced to the roof first.) | Refused and said (`climbingNow`, TRAVEL_VIEW_TEXT.climbing): the view's click and the map's walked trip, the pick answered so its callers never put DFU's fast travel in its stead. |
| C3 | minor | A hold a save (or a re-anchor) carried waits a step to be taken again: with the keys held under the view the host read the body as on foot, sped the travel up under it and the travel let the hold go - AUDIT CLIMB2 H1's fall, back (a quickload with W held; a pixel rebuilt under a climber). | The motor says a hold waits (`holdPending`); TV-WASD's `onFoot` and the journey's refusal read it. |
| C4 | nit | The host's wiring was pinned by text alone; a load's hold taken mid-journey (to be let go the same step - a hold and a release said) survived. | The host's own lines executed (C1, C2, C3); the mutant recorded, dead. |
| C5 = T6 | nit | The record's numbers: "eight to ten holds ... six or seven falls" is the free climb's 8 and 7; the classic climb's 59 to 62 rolls are chance's for the rest (6 to 16 holds, 4 to 8 falls); "no start of any kind" (a move under way finishes); the furniture 1.625 m over the floor, not 1.58; the stair 1.975 m short, not 1.9; and the standalone `scenes/dungeon.js` builds a motor too (it writes no time scale). | Said as measured. |

## Stood, and why

- **F3 - a tower home bought before the fix (Mac's call).** The towers are House6, which the home market sells. On the
  broken layout only the ground storey was reachable, at -1.575; a home's dropped piles and torches are restored raw and
  its decor stood as loaded, so what an owner left there stands 1.575 m under the new ground floor - the decor reachable
  through the decor panel's "In this room", the piles out of sight and reach; a save made there is stood at the door by
  VOID-ENTRY's failsafe. Nothing in a scene or a decor record says which layout wrote it: a migration would lift the
  two towers' old-frame things by 63 units, keyed to the deploy, through the account service's records too. Not built
  on a guess at how many such homes exist.
- **H2's reach - the Hold's memory is the page's.** A reload of the page forgets it, as offline DFU builds every
  dungeon whole at every entry. Keeping it in the save is a save-format change for one dungeon; Mac's call if the
  reload is ever the farm.
- **H6 - the relay's tests keep `dungeon:m187853213`** as their example of a world room (auditworld34, ol3, oncrash1,
  auditfoes). The wire and the relay are unchanged and an older client still joins that room; re-aiming four files'
  example buys nothing.
- **A custom start cell, online, elsewhere.** PH1's in-place respawn, D-ONLINE2 and ONLINE-UNDERGROUND-LOAD1 read the
  configured cell online as they did before the batch (a save inside that dungeon reloads inside it); only the shared
  room is the shipped Hold's now. Forcing the start cell online (ONLINE_FORCED_SETTINGS) would decide where every online
  character begins - the owner's.

## Not verified here

Nothing was played in the live game: the towers through Castle Daggerfall's own door, the House page in a browser, the
travel gate on the live Overworld, HOLD-SOLO and the Hold's memory against the deployed relay. The lenses' scripts and
outputs are in the session's scratch, not the tree.
