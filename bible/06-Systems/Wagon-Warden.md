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
left standing by it thrown with it). A lone horse is no cart and is never thrown. Only in a town a watch keeps - a
city, a hamlet or a village (`systems/wagonWarden.js` `WARDEN_TOWN_TYPES`, MAPS.BSA's `TownCity`, `TownHamlet`,
`TownVillage`); a wagon on a road between towns, at a farm or a dungeon's mouth stands as long as it likes.

**The road.** A wagon stands ON THE ROAD when a third of its footprint (`WARDEN_ROAD_SHARE`) lies on the town's road
cells: its own box, turned as it stands, sampled on a 3 x 3 grid corners included (`roadShare`), over the town's walk
grid (`world/cityNavigation.js` - the cells its people walk; a road cell weighs `ROAD_WEIGHT`, GOTHWAY-BOARDS' one
home). A wagon on a road `WARDEN_ROAD_MS` (ten real minutes) after it came to stand there is thrown.

**The crowd.** A town holds `WARDEN_TOWN_CAP` (four) parked teams. A fifth throws the one parked longest (ties by the
cell's opaque key), and so on, until four stand. The town is the owner's own word, so a town's crowd is the teams that
name it AND stand in its map pixel (Daggerfall stands every town in one): a word naming it from elsewhere in the cell
crowds nobody's team. A team already thrown stands outside town and is not counted; neither
is one whose owner's client says no landing (an older client's - never thrown, so never counted).

**The landing.** Straight out through the town's nearest edge (the walk grid's rect - its blocks; a tie goes west, east,
south, north), `WARDEN_LAND_PAST` (40 m) past it, strayed along the edge by up to `WARDEN_LAND_SCATTER` (12 m) by the
wagon's own anchor so two thrown together do not land in one heap, never past the edge's ends (`landingOf`,
`strayOf`). The wagon keeps its cargo, its paint and its turn; the owner walks out for it or summons it (Holdings, or
the summon key).

## The cell keeps the clock (the relay - `net/wire.js` WARDEN1, `server/src/index.js`)

The cell room that keeps a parked team (HCC-PARK) keeps when it came to stand where it stands - `since`, the cell's
clock; a word that moves none of the team's parts (a new name, a new paint, a door's word) keeps it (`parkSameSpot`).
The owner's word says what the cell cannot know: the town (`tw`, its map id), the road (`rd`) and the landing (`ly`,
natives, within `WARDEN_LAND_REACH` - a map pixel - of the anchor), in the park record (`validParkData`); a word with
no landing carries neither of the others, and is never thrown.

**The round** (`Room._parkWarden`, over `wardenVerdicts`): which of the cell's teams are thrown now. It runs at every
store (a fifth team in a town is thrown out at once), at every hello before the joiner reads the cell's list, and at the
FIRST FRAME OF ANYONE IN THE ROOM past the next road team's time (`_wardenAt`, `wardenDue` - every socket keeps alive,
so whoever is in sight sees it on time; a woken object reads its teams at its first frame). Never on the alarm: a cell's
alarm is its other duties' (a drained room's firing is its world's forgetting, which an early wake would have brought
forward), and a throw nobody is in the room to see is made before the next joiner reads the cell.

**A throw** marks the record (`y`, the cell's clock), fans it to the room as every park word is (never to its owner's
own account), hands it so to every joiner (`_parkPublic`), and tells its owner's sockets in the cell - those whose last
park frame spoke for that team (the attachment's `pk`) - the new frame `parkYeet` `{ at, from, to }`: when, the spot it
stood on, where it landed (`validParkYeet`). An owner away when it happened is told when their word next reaches the
cell: re-saying the spot it was thrown from is answered with the throw. A word that moves the team clears the mark (and
starts its clock again).

**The version.** `world189` (`RELAY_VERSION` - `world188` on its branch, renumbered past INT11-INT14's `world188` when it was rebased onto main; `WARDEN_RELAY_MIN`, `relaySupportsWarden`). An older relay drops `ly`,
`tw` and `rd` and throws nothing; the client sends them to any relay. **NOT YET DEPLOYED - its deploy drops every
player once.**

## The client (`systems/wagonWarden.js`, `scenes/wagonWardenHost.js`)

**The stamp.** Every frame the save's parked wagon is read (the HCC runtime's view); a wagon parked somewhere new is
stamped once the ground under it is built (`townAt` - the streaming host's built town under the anchor, its map id and
its walk grid): `{ a, at, tw, rd, ly }` - its anchor, the wall clock it came to stand there, its town, its road and its
landing (`wardenStamp`). The stamp rides the save (`WARDEN_VENDOR`, `systems/modSaveData.js`), so the clock outlives a
load. My park word carries its fields while it is the parked wagon's (`wardenWordOf`, through
`horseCartPool.setWardenWord`).

**The owner's throw.** The cell's `parkYeet` (`online.js` `onParkYeet`): my save moves by the throw
(`systems/horseCart.js` `adoptYeet` - the wagon turned as it stood, its horse in its shafts kept there, a horse standing
by it moved with it; only while the save still parks it where it was thrown from, `thrownTo`), I am told
(`WARDEN_TEXT`), and the throw is played where my wagon was drawn if it is within `WARDEN_SHOW_REACH` (200 m) of the eye.
Played or not, the save is the landing's at once - my next park word says the landing, and the cell clears the mark.

**A reader's throw.** A park word with a `y` the pool's kept word did not have (`keptWord`, called BEFORE the pool takes
the word): the throw is played from where that team is drawn - the owner's live word if they are here, else the cell's
kept one - and then the pool moves the record to the landing (`thrownRecord`: every part by the throw, heights as said -
the reader stands it on its own ground, DISC20-C). A list (a welcome) moves it without a show: it was thrown before I
came.

**Offline** (no online session at all) the client is the watch: the road's rule alone on the stamp's own clock
(`offlineDue`) - a wagon left on a road and loaded an hour later is thrown on the load. A town holds nobody else's team
offline, so there is no crowd. Online the cell alone throws; a relay before `world189` throws nothing.

## The throw, played (`scenes/wagonWardenShow.js`)

A guard of the town's watch - the city guards' own picture (`GUARD_TEXTURE`, its walk wheel and its idle record) -
jogs (`WARDEN_GUARD_SPEED`, 3.2 m/s) up to the team along the town's streets (`findTownPath` over the walk grid, from
`WARDEN_APPROACH_FROM` back into town; straight when the grid finds no way), the last `WARDEN_APPROACH_MAX` (7) seconds
of it. It lifts the wagon - its horses with it - over its head in three heaves (`WARDEN_LIFT_S`), its floor resting at
`WARDEN_HEAD`; winds up (`WARDEN_TURN_S`); and throws it out along a high arc (`arcPoint`: `arcPeak` - a third of the
throw's reach, 15 to 90 m - over the line, `flightSeconds` 1.8 to 4.5 s), tumbling end over end a whole number of turns
(`tumbleTurns`) so it lands upright, onto the landing's ground. Then it stands a moment and walks back the way it came,
and is gone. The horse neighs as it goes up, the swing whistles, the landing thumps.

The carried team is the pool's no longer: from the throw's start to its landing it is HELD (`horseCartPool.holdTeam` -
under every key it may be drawn under: a peer's live word and the cell's kept one) - drawn nowhere by the pool, no box
for the ray, no collider of mine - and drawn here instead (`drawShowWagon` in its own paint, the horses on the flats'
axis, turned with the wagon). At the landing it is the pool's again, standing where the throw put it. A show's points
are metres off where the wagon stood, its origin in the wire frame, so a recentre or a re-anchor carries it; a teardown
(a re-anchor, a load) ends every show and sets its team down. Every billboard it made is let go at its end (EVERY
ALLOCATION HAS AN OWNER). The clock waits up to `SHOW_ART_WAIT` for the guard's picture; one that never comes plays the
throw with no guard.

## The four hosts

- `scenes/world.js` - WIRED: each town pixel's build keeps its watch's town (`wardenTown`); the warden and its shows are
  made beside the yards - the stamp off the built towns (`wardenTownAt`), the word, the cell's two words
  (`online.onPark`, `online.onParkYeet`), the offline clock, the shows framed, drawn and on the flats' axis, ended at a
  re-anchor and a load; the stamp registered with the save.
- `scenes/worldModes.js` - its interiors park nothing; a throw while the player stands in one moves the save and is told,
  unplayed.
- `scenes/exterior.js` - FLAGGED: the single-town bench runs no town watch (its wagon is never stamped nor thrown).
- `scenes/dungeonContext.js` - stands no street.

## Not seen

This container holds no ARENA2: no real town's walk grid was read here, and the show was run against a fake renderer,
not watched. Where a town's nearest edge falls (a coast, a cliff) is the town's - a throw may land in the sea; the
summon fetches it.

## Tests

`test/warden1.test.js` - the wire's law (the park word's landing, town and road; the verdicts; the round's due; the
owner's word); the relay on a fake clock (a road team thrown at the first frame past its ten minutes and told its owner,
re-said and told again, moved and cleared; an owner away - the joiner's list, the owner told on return, the alarm left
alone; a woken cell; no landing never thrown; the crowd at the store); the client's law (the towns, the road share, the
landing, the stamp, its word, the offline clock, the thrown record and the save's move); the pool (a thrown kept word
where it landed, a held team drawn nowhere, my word's fields); the runtime's adoption; the show's clock and a whole
throw over a fake renderer; the host's stamp, offline throw, owner's throw and reader's throw; the hosts. Its mutants:
`tools/mutants/warden1.json`.
