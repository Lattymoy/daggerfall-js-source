# FIELD BUGS 2026-10-13d - one thread from the bug-reports channel

One Discord thread from 2026-10-13, handed over as a screenshot, read on the code as it stands at main's `8b0d093a`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "[ANGRY] Died of fatigue in wayrest palace, character aged past limit and remains did not appear" (TheHalfinStream) - "Because of this horrible bug, I have lost: My caravan, horses, and all wagon stored goods; All of my gear and items; My bank account with all of my gold; All my progression. I got to keep: My house and windmill, 3000g" | an Enduring member whose span was spent fell for good in Castle Wayrest - the palace's door is its dungeon's entrance - and the line's Succession passed the mantle. The remains were laid where she fell as a list the record owns, and nothing was ever drawn for them: the list opens by itself within six paces of the very spot underground, and nothing said where the spot was. And the gate that keeps it shut "in a fight" read the street's foe pools, frozen while the castle stood, so a street walker sensed on the way in kept it shut on the spot | fixed (REMAINS-STAND, LIVE-FIGHT); the collapse and the final death are the laws as written (THE DEATH); what passes to the heir answered, the wagon and the bank's balance the owner's call (ESTATE-WIDER, planned) |

## THE DEATH: the collapse, and the span (1) - NOT CHANGED, the laws as written

THE COLLAPSE IS DFU'S. At no fatigue left, `PlayerEntity_OnExhausted` (PlayerEntity.cs:2380-2441) asks
`AreEnemiesNearby` (GameManager.cs:684-732): none, and the player drops to the ground for an hour (TEXT.RSC 1071); a
hostile foe that sees the player or stands inside classic's spawn band, and it is `SetHealth(0)` (1072). The port's is
`systems/rest/rest.js exhaustionOutcome`, and underground `dungeonContext.js onExhausted` takes the one damage door's
SetHealth(0) arm (`hurtPlayer`, `bypassShield`), which the Legacy host hears as any death (`setDeathListener`). Castle
Wayrest's guards stand passive - RDBLayout.AddEnemy's Passive reaction for a marker so flagged, `isHostile` false (the
law; the castle's own markers are not read here: no BLOCKS.BSA in the tree) - and count for nothing until the castle is
turned on the player: a door bashed inside it (`world/actionSystem.js attemptBash`, DaggerfallActionDoor's
`MakeEnemiesHostile`), a private door tried again past its warning (DaggerfallAction.cs's DoorText trespass, the port's
`actionSystem.js` `onTrespass` - AUDIT FB1013d C10), or a blow. So a collapse that kills in the castle is one with a
hostile foe near. SWIM-SPENT
(`Field-Bugs-2026-09-30b.md`) changed the water's arm of this law and no other. (SPENT-ASHORE, `Field-Bugs-2026-10-13e.md`, a batch of
the same day merged after this one, changed the dry arm too: a collapse with a foe near costs a tenth of the health at
each drain to nothing, so the elder dies of the collapses as they come, through the same door - and has the bar's warning
to get clear. `test/systems/fb1013d_remains.test.js`'s fall moved with it.)

THE SPAN IS THE ENDURING MODEL'S. Each death took Arkay's toll, years off a span (a Breton's 90, born at 23, five
years a death at the Standard toll); spent, the next death is the last (`systems/legacy/age.js payToll`), and she
died of her years (`cause: 'years'`). It was said: the rise that spent it ("... and Arkay will not grant another"),
the Stats page's sheet ("Your span is spent: your next death is your last."), the elder's line once a load. The
mantle then passed exactly as in a Bloodline (Legacy-Arc section 6).

WHAT PASSES (Legacy-Arc sections 5, 7 and 10c). The estate - a quarter of the gold she CARRIED, at most 9,900, as a
letter of credit (the reporter's 3,000 fits it - a quarter of 12,000 carried - though the report does not say it was a
letter, and a newborn starts with 100 of their own); her houses, deed and all (PERMADEATH-HOUSES: the house and the
windmill); and the remains - the bones (laid to rest, their blessing), the heirloom (always, for an Enduring elder dead
of their years: the best weapon or armour she wore) and a tenth of her purse (at most 2,500). THE REMAINS NEVER
REACHED THE HEIR: that is the bug (REMAINS-STAND). The rest - the wagon with its horses and its hold, the pack, the
bank's balance, the levels and skills - stays in her own save, which the line refuses to play (THE PAST, section 3), as
her house did before PERMADEATH-HOUSES (ESTATE-WIDER).

## REMAINS-STAND: the remains are seen where they lie (1)

`src/scenes/legacyRemainsStand.js` createRemainsStand; `src/scenes/legacyHost.js` readyList, remainsToStand;
`src/scenes/world.js` legacyHere, legacyInDungeonOf, legacyRemainsFeet, the stand, legacyStep;
`src/scenes/droppedLoot.js` lootFinds; `src/scenes/lootLines.js` setLootMarksLive; `src/systems/silverFinds.js`.

FOUND. AUDIT LEGACY H1 (`Audit-Legacy.md`) found the remains' world pile laid again at every visit and every reload,
the heirloom in each, and made the remains a list the RECORD owns, opened as a container where they lie - and the
pile's picture went with the pile: NOTHING WAS EVER DRAWN FOR THEM. The death records where they lie
(`legacyHost.js onDeath` -> `layDeathRemains`; the place is `world.js legacyHere`'s - underground the dungeon by its
location and the fallen's own floor position), and the slow tick opens the list (`remainsStep`) only where
`legacyAtPlace` answers: underground within six paces (`LEGACY_REMAINS_NEAR_DUNGEON`) of that position, in its own
dungeon. The world map rings the dungeon's pixel - for a castle, its city's - and the journal says "deep inside"; in the
castle nothing marks the spot, nothing stands on it, and the heir walks past it. Reproduced through the producers: a
founder of an Enduring house, her span spent, killed in a castle by the collapse's own SetHealth(0) door, the newborn
heir landing through the birth's door - thirty metres from where she fell nothing opened and nothing stood in any pool.

FIXED. THE REMAINS STAND AS A BODY where they lie, in the ground pool of the host the one played stands in - the
street's, or a dungeon's through worldModes' `droppedPool` - their own picture (`REMAINS_FLAT`) on the floor under the
fallen's last position (the dungeon's `floorAt`) underground, and outdoors at the native spot where they fell, at the
height they stood at (the death's place keeps it now: a roof, a bridge; an older row stands on the ground) - a record's
height, so in DFU's frame on the ground it was measured on, as the Recall anchor keeps its own (AUDIT LANDFORMS C1 and
TERRAIN-SCALE1: `groundFrameHeight` in, `restandHeight` with its stamp out), asked by the death alone (`legacyHere({
height: true })`, AUDIT FB1013d B2: the lift is a field's kernel pass on the first pixel the main thread asks it of, and
the slow tick asks where the one played stands every second) - once its pixel is built and dying with its pixel. THE BODY'S LIST IS THE RECORD'S: the same array, so a take from it is a take from the record, as the list's own
window always was - claimed by the member who changes it (AUDIT LEGACY II H5), the bones going back into it and into no
other pile (H4: it wears its mark). It is `unsaved`: no save, no scene cache and no room's memory carries it, so nothing
is laid twice (H1 stands) - stood afresh at each visit, and let go when its place is left, its pool goes (a door, a
load, a pixel collected), its list is taken home, laid to rest or replaced (a load's merge lets every body go at once
and the next tick stands them over the new lists - AUDIT FB1013d A2; the slow tick asks nothing while the world is
moved), or the switch is off. The plaque names it ("The remains of Ysolde Hlaalu" - the map's ring's own words, one home:
`LEGACY_TEXT.remainsName`, so no new English reaches the L10N4 ratchet), a line of light stands over it with the
loot-rarity row on or off (`REMAINS_MARK`, the open zone's own remains' way, WILD1), and it holds no silver find
(`noFind`: the line's list, stood afresh at every visit, would have paid for coming back). The host hands the world only
the rows it may stand (`remainsToStand`: the slow tick's own guards - never for the past played back, a waiting
Succession or a page not the one played's), each list made ready as its window makes it (`readyList`, one home: its
mark, the load's repairs once, and nobody's list noted as it stands - a change from there is a claim). The world frames
the stand once a second, after the tick (which lays the bones again before a list is made ready; a claim that lapses at
the stand itself - its claimant's death merged in from another tab between the two - lays the bones they carried off at
once, AUDIT FB1013d A1, so no return of theirs reads as a claim of the one played's).
The lines' liveness is each kind's own word now (`setLootMarksLive(on, by)`): the open zone says its own every frame
online, and one word for every kind would have put the house's line out.

THE LIST'S OWN WINDOW STANDS (Legacy-Arc section 7: within six paces underground, sixty metres outdoors, anywhere on its
town's pixel for a death in a building; once a visit, never in a fight). The body is a second door to the same list,
pressed as any body - in a fight too, where DFU's loot window pauses the world.

THE BONES PUT BACK LIE AGAIN (AUDIT FB1013d A3; older than the body, through the list's own window held open): taken
from the list, the step marks them carried (`taken`, the taker's claim) - and a window still open over the list lets
them back in, its own mark (AUDIT LEGACY II H4). The step had no word for that: the row stayed `taken` with its bones in
a list no door opened, no ring marked and no temple could lay to rest, the heirloom and the purse with it. The state
follows the bones now (`remainsStep`): back in their own list and in no keeping, they lie again where they are, the claim
the claimant's (AUDIT LEGACY II H2), and the line says so (`LEGACY_TEXT.remainsReturned`, its own words).

A DEATH IN A BUILDING STANDS NO BODY: its law is the street's - the place names no building, and the list opens anywhere
on its town's pixel in the street, the moment the heir walks it.

WHICH DUNGEON IS THEIRS (AUDIT FB1013d O1 and B1, `Audit-FB1013d.md`): the dungeon's ROW, ITS PIXEL, ITS OWN KEY AND
THE SIZE IT WAS BUILT AT (`world.js legacyInDungeonOf`). The row alone - `abyss.location()`'s regionIndex and
locationIndex, the place's since LEGACY4 - is no identity for a MADE dungeon: a spawn (`world/spawnedDungeons.js
synthesizeDungeonLocation`), a hall, the Arena's floor, the Hour and the Court are each `locationIndex: -1` of their
region, so the body stood in every spawn of the fallen's region, at their coordinates (on a floor there or in the rock),
and its list opened on that spot. Inside, the GPS is the dungeon's own pixel (`playerTravelPixel` underground is the
streamer's, which a load and a Recall stand at the dungeon's; Ocean Holes' abyss its template's - the save's and the
anchor's law), and every row has kept it since LEGACY1 - the map's ring reads it. The row still counts beside it: the
Arena's floor stands on Daggerfall's pixel, whose castle is the city's own row. And neither tells the Arena's Undercroft
from Castle Daggerfall - `world/arena/arenaCity.js undercroftLocation` wears its city's row on its city's pixel - so the place
keeps the dungeon's own key now (`dungeonCtx.locationKey()`, `dungeon:<locationId>`: its save's and its room's), and the
size it was BUILT at (`smallerDungeons.js builtDungeonSize`: Smaller Dungeons lays a five- or eight-block plus of the
location's own blocks, drawn on its map id - another layout, where the fallen's floor position is some other room or
none; the port's save warps a load made at another size to the start, and its room is the layout's, SD-ONLINE). A row
written before keeps its row and its pixel - right for a spawn, a hall and the made places; for a death in the Undercroft
before this audit, the castle above stands it too (nothing in such a row tells them apart). Ocean Holes' abyss shares its
template's key, as its save and its Recall do: one place.

## LIVE-FIGHT: the fight is the place the one played stands in (1)

`src/scenes/world.js` the Legacy host's `inFight`.

FOUND. The remains' "never in a fight" - and Play as, Pass the mantle and a wedding with it (`switchRefusal`,
`mantleRefusal`, `wedRefusal`) - asked `areEnemiesNearby` over the street's pools (the watch, the street's foes) and the
dungeon's, in every mode. A mounted mode's frame returns before the street's, so the street's foes are not stepped while
a dungeon or a building stands, and their senses stay as they were when the player went in - `wouldBeSpawned` latched
for a hostile walker within 1094 classic units (27.35 m: `characters/enemy/enemyMotor.js wouldBeSpawnedInClassic`'s first test,
EnemySenses.cs's own - the exterior band past it, 102.4 m, is never reached; AUDIT FB1013d C9). DFU walks the ACTIVE
enemies alone (`ActiveGameObjectDatabase.GetActiveEnemyBehaviours`, GameManager.cs:690), and underground the street is
not active. So one hostile walker near the castle's door - a city at night - kept the whole visit "in a fight": the
list stayed shut on the very spot. A building's own foes (IF) were never read at all. Reproduced: the heir two metres
from where she fell, a street foe latched: the list did not open.

FIXED. The street's pools outdoors, the place's own inside (`modes.insideFoes` - the dungeon's, or the building's foes and
its watch), as the host's other fight reads already ask (the giant's notice, the time scale's) - and beside them the two
fights the host's rest refusal reads too (AUDIT FB1013d B3): a duel or the one played's own bout (`duelEnemyNear`, DUEL1
and ARENA2) and a hostile ship in reach (`navalHostileNear`, NAV-H). Before this audit Legacy read neither, in any mode.

## ESTATE-WIDER: the wagon and the bank's balance (1) - NOT CHANGED, the owner's call

The reporter's list is the design's: what the fallen held that is no estate, house or remains stays in the past's save.
PERMADEATH-HOUSES was the owner's answer for houses alone (2026-10-09: "now all that needs to be looked at is what
happens to houses owned by dead permadeath characters", then, asked, "the heir inherits" - the arc's reading: the deed is
the estate's, as the gold is; Legacy-Arc section 10c). Handing more down is new law. THE PLAN, if taken:

- THE WAGON. The fallen's wagon - its kind's item, its hold (`wagonItems`), its horses (Horse Cart and Cargo's stable) -
  taken up by whoever carries the line, as a deed is (`takeDeeds`' shape: the taker's save's word, so a reload never
  loses it and never gives it twice), read out of the fallen's newest save offline and their tombstone's realm record
  online. One wagon a character: a taker who holds one finds the other WAITING, as a second house in a region does.
- THE BANK. Some share of the fallen's balance into the estate. Online the birth law (`realm.js firstSaveRefusal`: a
  newborn's liquid wealth at most 10,000) holds the first save, so it would be paid into the heir's bank account after
  it, as the deeds are taken up the first tick after the birth.

## THE FOUR HOSTS (1)

`scenes/world.js`: wired - the stand, its pool and its places, and the Legacy host's fight. `scenes/worldModes.js`: wired
through its pool (`droppedPool`: the dungeon's, and the building's - where no body stands, its law the street's) and its
fight (`insideFoes`). `scenes/dungeonContext.js`: wired through its pool, its floor (`floorAt`) and its loot door (a
dropped pile's `takeLoot` opens the body as any pile). `scenes/exterior.js`: FLAGGED (Legacy-Arc section 3) - the fixed
city keeps DFU's death: no house, no remains.

## ASKED OF THE REPORTER

Which heir carried the line on (a newborn, or a living member); whether they went into the castle, and how near the spot
she fell on; whether the castle had been turned on her before the collapse (a door bashed, a private door tried again, a blow); and whether they
play online.

## Pins (1)

- `test/systems/fb1013d_remains.test.js` (11): the report through the producers it can run - the Legacy host (its death as the
  collapse decides it, `exhaustionOutcome` over `areEnemiesNearby`, at the one damage door's SetHealth(0); the
  Succession and the birth; the save door), a real ground pool, the transfer laws, the made dungeons' producers - and the
  world host's own `legacyHere`, `legacyInDungeonOf`, `legacyAtPlace`, `anchorLanding`, `legacyRemainsFeet`, the stand,
  `inFight`, the let-go and the slow tick `legacyStep`, and the dungeon's summary, key and `floorAt`, run off their own
  text over fakes of the world they read (the streamer's frame, the colliders' floors, the ground and its lift - the
  spot's own - and the foe pools, a foe's sense fields set by hand: AUDIT FB1013d C12) - the body stands in the
  castle's pool on the floor under her last position, its list the record's own array, named, marked, on the ray, in no
  save, never laid twice, in no other dungeon and not in the street; a take through it is the heir's claim, the bones go
  back into it and into no other pile, carried home it is let go and laid again it stands again, and it is stood afresh
  at every change of its pool, its pile or its list, never for a waiting Succession, a page not the one played's or with
  the switch off; in the open at the height she stood (written in DFU's frame with its stamp, stood again through them),
  once its pixel is built, dying with its pixel, an older row on the ground and a building's none; the fight read off
  the place (a latched street walker no fight underground, the list opening on the spot; the dungeon's and the
  building's own foes a fight); its line with the rarity row off under the house's own word, no silver find, and the
  hosts by source. And the audit's (`Audit-FB1013d.md`): which dungeon is hers (O1, B1 - spawns of her region minted by
  their producer on other pixels, the Arena's floor and the Undercroft on Daggerfall's pixel, the keep built at the
  medium size: none of them stands her or opens her list, her own does, a row written before included); the height the
  death's to ask, never the tick's (B2 - the lift counted); a duel and a hostile ship a fight in every mode (B3); a claim
  lapsed at the stand lays its bones at once and hands the one played nothing (A1); a load lets every body go at once
  and the world's slow tick asks nothing while the world is moved (A2); the bones put back lie again, the claim kept
  (A3); the spot the outdoor reads take - the ground built about the scene alone, the lift the spot's own, a roof with a
  floor over it, a death in the air landed (C1, C6); the dungeon's floor under the height she fell at, over two levels
  (C6); the watch outdoors a fight (C5); another member's claimed search stands none (C3); a take through the body on the
  very spot, its list's own door refused, the heir's claim (C4); none before chargen or for a dead current (C7); the
  line seen from thirty metres (C8).
- `tools/mutants/fb1013d_remains.json` (66: 64 dead, 2 equivalent as recorded - thirty-two of them the audit's: O1 four,
  B1 five, B2 two, B3 two, A1 one, A2 three, A3 one, C1 four, C6 two, C5, C3, C4, C7 two, C8, and the equivalents C2 (the
  region beside the pixel) and C7's past (never the line's current); seven of the slice's own and O1's four re-aimed by
  content where the audit moved their lines). Re-aimed by
  content for the slice: `auditlegacy2.json` AUDIT-LEGACY-II-H5-claimed-at-the-open and `itemwalk.json`
  ITEM-WALK-B-remains-unrepaired (a list's readiness has one home now, `readyList`); `loot11.json` LOOT11-pass-off and
  LOOT11-drop-pool-no-finds (the lines' word, each kind's own; a pile's own mark); for the audit, `auditlegacy2.json`
  AUDIT-LEGACY-II-A3-lapse-keeps-first-laid (the lapse's line split by A1), and `auditlegacy3.json`
  AUDIT-LEGACY-III-A2-newer-save-drops-the-stores-facts (it no longer parsed on main: AUDIT FB1007b T3 hung an `else if` on
  the line it deleted - now it empties the arm, and dies). Each list run whole: `auditlegacy2.json`
  and `itemwalk.json` 59 dead, `loot11.json` and `silverfinds.json` 101 dead; after the audit, every list aimed at the
  Legacy host (twenty, 712 records) run over the fixed tree: 708 dead, 3 equivalent as recorded, and one (LEGACY7W-partner-dead-or-lineless, the account service's wedding) surviving as it does on main - `Audit-FB1013d.md` O5. No relay or account file is touched: RELAY_VERSION and
  ACCOUNT_VERSION stand.

## REVIVE: the reporter's own character, given back (2026-10-14) - the owner's call

Mac, after the fixes above: *"I want to roll back this specific account"* (TheHalfinStream), then *"Undo the death"*,
then *"Full revive"*. The laws stand as written - her death was the span's - and ESTATE-WIDER stays unbuilt; this is
one account, put back by hand. A death taken back now holds (the `revived` stamp - `06-Systems/Legacy-Arc.md` REVIVE),
and the operator's "Realm revive" run gives her back her tombstone cleared, her checkpoint (and with it the caravan,
the gear and the bank), her line's record, her house and windmill, her guild seat and the pieces her heir holds. Her
heir stays; her years stay spent. Run by hand after acct132 is live: a dry run first, then `apply`.
