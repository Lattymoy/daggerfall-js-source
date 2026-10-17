# The Town Watch Throws a Parked Team Out (WARDEN1)

THE PORT'S OWN (2026-10-10). Asked: *"So I want to do something extremely funny. Anytime there are too many
carts/wagons in a city or they are parked on the road for a long time. I want a gaurd to navigate, lift the wagon/horse
on top of their sprite and yeet it far away."* Asked where it lands, who sees it, how long is too long and how many is
too many: **outside town, fetched or summoned** (its cargo with it); **everyone sees it** (the relay keeps the clock - a
relay deploy, which drops every player once); **ten real minutes** on a road; **four a town, the longest parked
thrown first**.

Daggerfall has nothing of it: Horse Cart and Cargo parks a wagon anywhere for ever, and HCC-PARK
(`06-Systems/Horse-Cart-And-Cargo.md`) keeps another player's parked team in its cell for 72 hours. Ledger A (WARDEN1).

## The law

**Who is watched.** A PARKED WAGON (Horse Cart and Cargo's `Deployed`, with or without its horse in its shafts, a horse
left standing by it - within `WARDEN_HORSE_BY_NATIVES`, 12 m, `horseThrownWith` - thrown with it; one left further off,
or following its owner, stays its own). A lone horse is no cart and is never thrown: only a wagon's record carries a
landing (`validParkData`) and only a wagon's is judged (`wardenVerdicts`). Only in a town a watch keeps - a
city, a hamlet or a village (`systems/wagon/wagonWarden.js` `WARDEN_TOWN_TYPES`, MAPS.BSA's `TownCity`, `TownHamlet`,
`TownVillage`); a wagon on a road between towns, at a farm or a dungeon's mouth stands as long as it likes.

**The road.** A wagon stands ON THE ROAD when a third of its footprint (`WARDEN_ROAD_SHARE`) lies on the town's road
cells: its own box, turned as it stands, sampled on a 3 x 3 grid corners included (`footprintRoadShare`), over the town's walk
grid (`world/city/cityNavigation.js` - the cells its people walk; a road cell weighs `ROAD_WEIGHT`, GOTHWAY-BOARDS' one
home). A wagon on a road `WARDEN_ROAD_MS` (ten real minutes) after it came to stand there is thrown.

**The crowd.** A town holds `WARDEN_TOWN_CAP` (four) parked teams. A fifth throws the one parked longest (ties by the
cell's opaque key), and so on, until four stand - but ONE ACCOUNT IS ONE TEAM A TOWN: an account's later teams there are
thrown before anyone's (a socket names its characters itself, and `PARK_ACCOUNT_MAX` is four too - one socket's four
made-up characters threw every other player's team out; AUDIT WARDEN1 R1). The town is the owner's own word, so a
town's crowd is the teams that name it AND stand in its map pixel (Daggerfall stands every town in one): a word naming
it from elsewhere in the cell crowds nobody's team. A team already thrown stands outside town and is not counted; neither
is one whose owner's client says no landing (an older client's - never thrown, so never counted).

**The landing.** Straight out through the town's nearest edge (the walk grid's rect - its blocks; a tie goes west, east,
south, north) WHOSE LANDING KEEPS THE TEAM IN ITS OWN MAP PIXEL, else in its own cell, else the nearest (`landingsOf`,
the host's choice - AUDIT WARDEN1 R6: HCC draws a parked wagon in its owner's pixel alone, and a word from another
cell's ground drops the cell's record, so readers saw a team land and vanish), `WARDEN_LAND_PAST` (40 m) past it,
strayed along the edge by up to `WARDEN_LAND_SCATTER` (12 m) by the wagon's own anchor so two thrown together seldom
land in one heap, never past the edge's ends (`strayOf`; two by a corner, or one behind the other on a street to the
edge, can). The wagon keeps its cargo, its paint and its turn; the owner walks out for it or summons it (Holdings, or
the summon key).

## The cell keeps the clock (the relay - `net/wire.js` WARDEN1, `server/src/index.js`)

The cell room that keeps a parked team (HCC-PARK) keeps when it came to stand where it stands - `since`, the cell's
clock; a word that keeps the team on its spot keeps it (`parkSameSpot` - its wagon within `WARDEN_SPOT_NATIVES`, a metre:
a new name, a new paint, a door's word, a ground solved again or a horse whose picture is not yet in move nothing; AUDIT
WARDEN1 R2 - an exact match of every part let an owner's first word back undo a throw, unheard). The owner's word says
what the cell cannot know: the town (`tw`, its map id), the road (`rd`) and the landing (`ly`, natives, within
`WARDEN_LAND_REACH` - a map pixel - of the wagon, where the throw is measured from, and inside the world), in the park
record (`validParkData`); a word with no landing carries neither of the others, and is never thrown.

**The round** (`Room._parkWarden`, over `wardenVerdicts`): which of the cell's teams are thrown now. It runs at every
store (a fifth team in a town is thrown out at once), at every hello before the joiner reads the cell's list, and at the
FIRST FRAME OF ANYONE IN THE ROOM past the next road team's time (`_wardenAt`, `wardenDue` - every socket keeps alive,
so whoever is in sight sees it on time; a woken object reads its teams at its first frame - a round that fails, its
list refused, is asked again `WARDEN_RETRY_MS` on and never fails the frame, AUDIT WARDEN1 R4). Never on the alarm: a cell's
alarm is its other duties' (a drained room's firing is its world's forgetting, which an early wake would have brought
forward), and a throw nobody is in the room to see is made before the next joiner reads the cell.

**A throw** marks the record (`y`, the cell's clock), fans it to the room as every park word is (never to its owner's
own account), hands it so to every joiner (`_parkPublic`), and tells its owner's sockets in the cell - those whose last
park frame spoke for that team (the attachment's `pk`) - the new frame `parkYeet` `{ at, from, to, k }`: when, the spot
it stood on, where it landed, and whose team (`validParkYeet`; a session that has since loaded another character takes
none of the first one's - AUDIT WARDEN1 C6). An owner away when it happened is told when their word next reaches the
cell: re-saying the spot it was thrown from is answered with the throw. A word that moves the team clears the mark (and
starts its clock again).

**The version.** `world191` (`RELAY_VERSION` - `world188`, `world189` then `world190` on its branch, renumbered past INT11-INT14's `world188` when it was rebased onto main, past SCALE5a's `world189` at the merge after it and past AUDIT MW-NPC II's `world190` at the next, and re-hashed by AUDIT WARDEN1 before any deploy; `WARDEN_RELAY_MIN` - `relaySupportsWarden` had no caller and is gone). An older relay drops `ly`,
`tw` and `rd` and throws nothing; the client sends them to any relay. **NOT YET DEPLOYED - its deploy drops every
player once.**

## The client (`systems/wagon/wagonWarden.js`, `scenes/wagon/wagonWardenHost.js`)

**The stamp.** Every frame the save's parked wagon is read (the HCC runtime's view); a wagon parked somewhere new is
stamped once the ground under it is built (`townAt` - the streaming host's built town under the anchor, its map id and
its walk grid): `{ a, at, tw, rd, ly }` - its anchor, the wall clock it came to stand there, its town, its road and its
landing (`wardenStamp`). The stamp rides the save (`WARDEN_VENDOR`, `systems/modSaveData.js`), so the clock outlives a
load. My park word carries its fields while it is the parked wagon's (`wardenWordOf`, through
`horseCartPool.setWardenWord`).

**The owner's throw.** The cell's `parkYeet` (`online.js` `onParkYeet` - my character's team's, `k` against my park key):
KEPT FOR THE NEXT STREET FRAME (the host's `tick`, which runs on the street alone and never under a load - AUDIT WARDEN1
C4: one taken in a door's load wiped the horse left at the door, one in my caravan's room let me out onto empty ground);
then my save moves by the throw (`systems/horse/horseCart.js` `adoptYeet` - the wagon turned as it stood, its horse in its
shafts kept there, a horse standing by it moved with it; a building's reach to its load let go; only while the save
still parks it where it was thrown from, `thrownTo`), I am told (`WARDEN_TEXT`), and the throw is played where my wagon
was drawn if it is within `WARDEN_SHOW_REACH` (200 m) of the eye. Played or not, the save is the landing's at once - my
next park word says the landing, and the cell clears the mark. With the Horse Cart and Cargo mod off nothing is stamped
or thrown (the pool draws no wagon, and the cell holds none).

**A reader's throw.** A park word with a `y` the pool's kept word did not have (`keptWord`, called BEFORE the pool takes
the word): the throw is played from where that team is drawn - the owner's live wagon where it stands on the spot thrown
from, else the cell's kept one (AUDIT WARDEN1 C9: a peer id's other wagon was lifted) - and then the pool moves the
record to the landing (`thrownRecord`: the wagon by the throw and a horse standing by it, heights as said - the reader
stands it on its own ground, DISC20-C). A caravan's visitor walks in where it landed (`caravanVisitLink.js`
`caravanRecordOf` - AUDIT WARDEN1 R9: every visitor was put out at once). A list (a welcome) moves it without a show: it was thrown before I
came.

**Offline** (no online session at all) the client is the watch: the road's rule alone on the stamp's own clock
(`offlineDue`) - a wagon left on a road and loaded an hour later is thrown on the load (on the street: loaded indoors,
as the player steps out). A town holds nobody else's team
offline, so there is no crowd. Online the cell alone throws; a relay before `world191` throws nothing.

## The throw, played (`scenes/wagon/wagonWardenShow.js`)

A guard of the town's watch - the city guards' own picture (`GUARD_TEXTURE`, its walk wheel and its idle record) -
jogs (`WARDEN_GUARD_SPEED`, 3.2 m/s) up to the team along the town's streets (`findTownPath` over the walk grid, from
`WARDEN_APPROACH_FROM` back into town; straight when the grid finds no way), the last `WARDEN_APPROACH_MAX` (7) seconds
of it. It lifts the wagon - the horses the throw moves with it (its harness's, and a lone one only standing by it; never
one following its owner - AUDIT WARDEN1 C2) - over its head in three heaves (`WARDEN_LIFT_S`), its floor resting on the
top of the guard's standing picture ("on top of their sprite"; `WARDEN_HEAD` until the picture is read); winds up (`WARDEN_TURN_S`); and throws it out along a high arc (`arcPoint`: `arcPeak` - a third of the
throw's reach, 15 to 90 m - over the line, `flightSeconds` 1.8 to 4.5 s), tumbling end over end a whole number of turns
(`tumbleTurns`) so it lands upright, onto the landing's ground. Then it stands a moment and walks back the way it came,
and is gone. The horse neighs as it goes up, the swing whistles, the landing thumps.

The carried team is the pool's no longer: from the throw's start to its landing it is HELD (`horseCartPool.holdTeam` -
under every key it may be drawn under: a peer's live word and the cell's kept one) - drawn nowhere by the pool, no box
for the ray, no collider of mine, no seat to ride (a rider in its back is stood down - AUDIT WARDEN1 C10) - and drawn
here instead (`drawShowWagon` in its own paint, load, wheels and hitch - AUDIT WARDEN1 C8; the horses on the flats'
axis, turned with the wagon, concealed as their owner is). The hold is counted (two shows over one key each set it down
once) and leaves a lone horse it does not carry drawn. At the landing it is the pool's again, standing where the throw
put it - framed before the pool's step, so posed that frame (C11). A show whose team is no longer the one thrown (a
summon, a drive off, the cell's word that it moved) ends where it stands (C7). A show's points are metres off where the
wagon stood, its origin in the wire frame, so a recentre carries it; a teardown (a re-anchor, a load) ends every show
and sets its team down. Every billboard it made is let go at its end (EVERY
ALLOCATION HAS AN OWNER). The clock waits up to `SHOW_ART_WAIT` for the guard's picture; one that never comes plays the
throw with no guard.

## Beside MW-NPC (the merge of #750, 2026-10-10)

MW-NPC stands the city watch's guards in Morrowind bodies (`scenes/cityGuards.js`, MWNPC6), and its census
(`test/scenes/mwnpc_census.test.js`) holds every source that draws a living actor's sprite to a body lane or a declared reason.
The thrower keeps its sprite, DECLARED there: the ask was the wagon "on top of their sprite", the gag is the sprite
under the wagon, and a body has no lift to stand it in - with the bodies on, the watch that patrols is in bodies and the
one that throws is the guards' picture. Standing the thrower in a body (a carry and a throw clip) is its own work.

## Beside PERF-TEAMS and PERF-WAGON (the merge of #763, 2026-10-10)

PERF-TEAMS cuts another player's team past `PEER_TEAM_DRAW_M` (400 m) from the eye (`p.far` - stepped by its word
alone) and asks every wagon the pool draws the street's view test (`07-Rendering/Performance-Priority.md`). The watch
meets it at two seams, both left as they stand. A throw is played within `WARDEN_SHOW_REACH` (200 m) of the eye, inside
that reach, so a team the reach cuts is never played - its record simply moves to the landing. A HELD team is out of the
pool's draw before the cut asks (`drawnFrameOf` answers none for it), and the carried wagon is the show's
(`drawShowWagon`), drawn whole like the cart's pass's landmarks: one team for the seconds of its throw, near the eye,
its box tumbling through the air rather than standing round its wheels (PERF-TEAMS' `peerTeamBox`).

## The four hosts

- `scenes/world.js` - WIRED: each town pixel's build keeps its watch's town (`wardenTown`); the warden and its shows are
  made beside the yards - the stamp off the built towns (`wardenTownAt`), the word, the cell's two words
  (`online.onPark`, `online.onParkYeet`), the offline clock, the shows framed, drawn and on the flats' axis, ended at a
  re-anchor and a load; the stamp registered with the save.
- `scenes/worldModes.js` - its interiors park nothing. Indoors online the player holds no socket on the wagon's cell
  (the halo closes), so a throw made then is told as they step out and re-say the spot - and played then, on the
  street; offline the clock runs on the street alone. (AUDIT WARDEN1 D2: this line said "moves the save and is told,
  unplayed" - it was never so.)
- `scenes/exterior.js` - FLAGGED: the single-town bench runs no town watch (its wagon is never stamped nor thrown).
- `scenes/dungeonContext.js` - stands no street.

## Not seen

This container holds no ARENA2: no real town's walk grid was read here, and the show was run against a fake renderer,
not watched. Where a town's nearest edge falls (a coast, a cliff) is the town's - a throw may land in the sea; the
summon fetches it.

## AUDIT WARDEN1 (2026-10-11, Mac: "Audit this")

Five cold lanes over the PR (the relay and the wire's law with its abuse; the client's law, host and save; the show, the
pool's hold and the rendering; the records; the whole play, end to end), every finding reproduced from a real caller
before it was fixed, each fixed in its slice, pinned (`test/systems/wagon/warden1_audit.test.js`) and mutated
(`tools/mutants/warden1_audit.json`, 71, all dead).

**The relay and the wire.** R1 one account one team a town (above - MAJOR, one socket cleared a town). R2 the spot by
`WARDEN_SPOT_NATIVES` (MAJOR - an owner back whose horse's picture was not in undid the throw, unheard, and in a full town
threw the next team instead). R3/R5 a landing a wagon's alone, from the wagon, inside the world. R4 a refused round retried,
never every frame's. C6 `parkYeet` names its team.

**The client.** C1 a horse thrown only standing by its wagon (MAJOR - one ridden off and left at a shop leapt hundreds of
metres, in the save and in readers' records). C3 a building's reach to a thrown wagon's load let go. C4 the cell's throw
taken on the street. C5 the mod off throws nothing. R6 the landing kept in its pixel, else its cell. R9 a thrown caravan
visited where it landed (MAJOR).

**The show and the pool.** C2 the throw lifts the horses it moves (a following horse was lifted and hidden). C7 a show
ends when its team is no longer the one thrown (MAJOR - a wagon summoned during the throw stayed held, drawn nowhere and
unpressable, until the landing). C8 the carried wagon in its own load, wheels and hitch. C9 the live wagon lifted only on
the spot thrown from; the hold counted. C10 a rider stood down. C11 the team set down before the pool's step. C12 an
idle frame does nothing. C13 a concealed owner's horses concealed. The wagon rides on the top of the guard's picture.

**The records.** The world.js wiring the patch notes stand on is pinned (the eye, the street, the HUD, the town's name,
the save both ways, my park key); the town under a point has one pure home (`wardenTownIn`); the guard's way is run (round
a wall, from inside the town, to the lift); the reader's usual throw, the reach, the stray, each check's second axis, the
stamp's parts guard and the anchor's guards are pinned; the 38 `RELAY_VERSION` pins carry their PIN MOVED note; a test
fixture's texture scale is the shape `textureFile.js` mints; the worldModes line and the re-anchor sentence corrected.

**Left as they are, with their reasons.** An account per team stops one socket; several ACCOUNTS can still crowd a town
(a town's four is the ask). In a city that fills its map pixel every landing is in the next pixel, so the owner's own
wagon is drawn there once they walk into it (HCC's own rule, IL_82f8). Two throws can still land near one another. A
cell forgets a throw with its record (72 h with no word from its owner), and its owner is then never told. A thrown
team's landing is the owner's word; the town's road is too. `WARDEN_TOWN_TYPES` stays the watch's own list beside the
gates', the raids' and the yards' (each feature's own policy, the repo's idiom). The re-sayer-alone tell (`only`) and
the pool's own `peerSeat`/`peerRide` hold checks have no mutant of their own: the first tells only a socket that spoke
for the team either way, and the riders' stand-down is pinned where it acts.

## Tests

`test/systems/horse/warden1.test.js` - the wire's law (the park word's landing, town and road; the verdicts; the round's due; the
owner's word); the relay on a fake clock (a road team thrown at the first frame past its ten minutes and told its owner,
re-said and told again, moved and cleared; an owner away - the joiner's list, the owner told on return, the alarm left
alone; a woken cell; no landing never thrown; the crowd at the store); the client's law (the towns, the road share, the
landing, the stamp, its word, the offline clock, the thrown record and the save's move); the pool (a thrown kept word
where it landed, a held team drawn nowhere, my word's fields); the runtime's adoption; the show's clock and a whole
throw over a fake renderer; the host's stamp, offline throw, owner's throw and reader's throw; the hosts. Its mutants:
`tools/mutants/warden1.json`. `test/systems/wagon/warden1_audit.test.js` - AUDIT WARDEN1's pins (above); its mutants
`tools/mutants/warden1_audit.json`.
