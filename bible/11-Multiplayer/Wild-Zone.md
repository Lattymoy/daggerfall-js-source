# The Open Zone - the Wrothgarian Mountains (WILD1)

2026-10-07. The owner:

> Wrothgarian mountains need to be turned into a open pvp zone where ppl when killed cant get looted all of the
> items they have, except campfires, torches, potions etc. And players can choose 1 item of the equipped ones the
> killed player has by clicking the dead body (which opens their inventory in simple form next to the player who
> loots the killed ones inventory) the body disappears in 2 minutes and with it the player can only then respawn.
> The zone needs to be marked on the map players cant see each others near and in that zone. Mobs are 4x stronger
> (even elites and champions) and drop 100% better loot. Same goes for dungeons. When a player dies by mobs he has to
> wait 2mins till respawn and drops the loot he has in his bags not except campfires, torches, potions etc, (you dont
> drop your equipped stuff) no carts allowed in this area.

Asked four things, the owner answered: a player's death at another's hand drops the bags too ("2") and "the players
can take the cart in to the zone and it also loses all loot in it. when the players respawns in a town near the zone
the cart comes with him, make sure it doesnt stuck the player when he spawns and other players"; what a death drops
"lay around for 10 minutes and are marked for you to get them back and other players can take em"; on the maps "only
parties and guilds can see each other"; and "100% better" is "twice gold and twice the dropchance for rarity items
and double drops". Then: "make sure the high risk area is marked with a highquality fog of war on the world map and
red lines around it, make sure the ui for it (like looting others) is enhanced plus and grimoireui conform".

The same morning, WILD2 and WILD3:

> also give the zone 4 levels from the outerside to the inside 25% of the zone are 25% more loot when you go in deeper
> 50% more loot then 75 and when youre in the middle 25% 100% more loot this needs to be also shown on the world map
> when clicking on this zone it opens its own extremely well made map same layout as the worldmap only wrothgarian
> mountain enlarged with its higher tiered loot zones i just explained and so on. Also fast traveling via carriage
> inside the zone costs 2,5k gold and has a 10minute cold down. you cant fast travel out and into the zone. Same for
> all other fast travel options except the overworld map. Giants you meet there are also 4 times bigger(not in
> dungeons only outside). i hope there are giants to meet :D ... Youre also slower in this zone max 20x in the wilds
> and 40x on the roads and when other players are near you they are counted as enemies bright red and its called
> stranger when you near them Like 600m away. and when youre near them like 200m it slows you down like normal
> enemies. And no player nameplates should be visible in the zone except the ones out of your party and guild.

READ AS: the centre's "+100%" is the flat "twice" of WILD1 - the heart pays what the whole zone paid, the outer rings
less; the foes are four times as strong in every ring (and, since PVPDUNGEONS, a ring's own share more - section 2).

This is the second door through Multiplayer.md's "It is not PvP" - the first is the duel (DUEL1). Not a DFU member:
Daggerfall Unity has no other players. Ledger A (ONLINE).

THE LATER PASSES (2026-10-08). The patch the owner uploaded as THE WROTHGARIAN ZONE (merged in one relay version,
world177) carries a day of further asks on top of WILD1-WILD3, each tagged in its code with the owner's words. The
zone's own are told in sections 1-11 where they changed what those sections said, and in sections 12-20 where they
are new: the halls (PVPDUNGEONS), the Greater Giants (ZONE-GIANTS and its passes), the zone's other laws, /unstuck
(PVPUNSTUCK), the maps' later ink, the mountains walkable everywhere (MOUNTAINS WALKABLE) and the test build's switch
(TESTBUILD). The asks that rode in with it but are not the zone's are section 21.

## 1. What the zone is

The owner's CUT of the Wrothgarian Mountains, not the whole region: every map pixel the politic map gives to region 16
(`MapsFile.getRegionIndexAt`, its bad byte 105 folded in) that also lies inside `WILD_CUT`
(`wildZone.js:"export const WILD_CUT"`), a polygon in fractions of the region's own bounding box - drawn in red over
the zone map by the owner (ZONE-CUT, 2026-10-07), then snapped onto the roads it was drawn along with the south edge's
bump taken straight across (ZONE-CUT2, 2026-10-08: "thats what the borders form should be normaly try to not use this
bump"). `buildWildMask` (`wildZone.js:"export function buildWildMask"`) takes the cut as its `cut` option (`WILD_CUT`
by default; `cut: null` is the whole region - the pins' plain shape) and keeps the whole region beside it (`region`).
Then WILD-KEEPOUT (2026-10-08, the owner: "can we place the zone still in the mountain region but keep wrothgaria out
of it?", then WILD-KEEPOUT2: "can you move the exact borders to right so wrothgaria is out"): the towns of
`WILD_KEEPOUT_TOWNS` (`wildZone.js:"export const WILD_KEEPOUT_TOWNS"`, Wrothgaria alone), each with `WILD_KEEPOUT_PX`
(2) pixels of ground about it, are read off the map files every client holds (`wildMaskOf`,
`wildZone.js:"export function wildMaskOf"`) and the WHOLE west border moves east by the longest run of zone pixels
found on that ground (`wildZone.js:"you move the exact"`) - never a notch; the east, the top and the south stay as
cut. Every place on what is left - its streets, its buildings, its dungeons - is the zone's. NEAR it is within
`WILD_NEAR_PX` (6) map pixels of that edge. ONLINE ALONE: offline the mountains are Daggerfall's own (the death
penalty's law). The law is `src/systems/wildZone.js` (a leaf: the region test, the mask and its edge, the numbers, the
live flag the pools read at a spawn, and the death screen's state); the world host sets the flag each frame
(`wildFrame`, `world.js:"const wildFrame ="`) from the region under the player AND the ring of the pixel under them
(`world.js:"const here = _onlineWorldSession"` - region 16 outside the cut is not the zone), and says the crossing. A
dungeon reads its own map pixel (`dungeonContext.js:"const _wildDungeon"`): one of region 16 outside the cut is an
ordinary dungeon.

## 2. Foes and loot

- WILD2: THE RINGS. A pixel's depth is its chamfer distance from the zone's edge (`buildWildMask`'s `depth`), over the
  deepest pixel's; the outer quarter of that depth is ring I (the Foothills, +25%), then II (the Passes, +50%), III
  (the High Crags, +75%) and the heart, IV (+100%) - `WILD_RING_LOOT`, `wildRingAt`. Everything below is at the ring's
  multiplier (`wildRingLoot`): a street foe takes the ring the player stands in at its spawn (`wildRing`, the world
  host's each frame), a dungeon the ring of its own map pixel (`wildRingAtPlace`, over the mask the world host
  registers - every client of the room alike). Crossing a ring is said ("Deeper - The Passes: +50% loot.") and the
  HUD's zone tile names it.
- A foe of the zone stands four times its health and hits four times as hard - over whatever it already is (an elite,
  a champion, a revenant), so "even elites and champions" (`applyWildFoe`,
  `wildZone.js:"export function applyWildFoe"`) - and, since PVPDUNGEONS (the owner: "With the tier, enemies also get
  stronger on top of what they are in the zone based on the tier percentage"), its ring's multiplier more on both
  (`wildTierMult`): x5 in the foothills to x8 in the heart. A street puppet scales its blows alone; its maximum is its
  owner's word. A dungeon's foes scale on every client alike (the dungeon's own region and pixel, read once at the
  build), so the room's maximum agrees.
- THE PACKS (PVPDUNGEONS, the owner: "4x more enemies per pack that can attack you on the world map"): in the zone the
  encounter cap is `WILD_PACK_MULT` (4) times `MAX_ACTIVE_ENCOUNTER_FOES`
  (`exteriorFoes.js:"export const WILD_PACK_MULT"` `encounterCap`), a camp's members are allowed it, and an Overworld
  band born on a zone pixel is four times its size (`world.js:"gameMinutes: b.night"`, `wildBornHere` - the mask every
  client builds alike, so a band's size is the same everywhere).
- Its loot at its ring's multiplier: every category's chance (`lootDropMult`) and the rarity ladder's odds
  (`lootQualityMult`) through `wildLootOpts` - the doors spawnEnemyLoot already has, whose chain is untouched - its
  gold after the chain (hostCombat.js `wildLootAfter`) and a plain foe's cap as much wider (foeLootCap.js, by
  `wildRing`). A dungeon's treasure pile rolls its ring's share of a SECOND roll through its one home (`wildPileMore`:
  the heart's always, the foothills' one time in four) - so its drops, its gold and its odds of a rare piece are the
  ring's on average.

## 3. The fights

Two players standing in the zone may strike each other - never a member of my party, never my duel's opponent - in the
open country and, since PVPDUNGEON (2026-10-08, the owner: "players should be able to attack each other in dungeons
too in the pvp zone"), in its dungeons (`wildCan`, `world.js:"const wildCan = ()"`). The frames are the duel's own
(`strike`, `spell`, `result` on the `wild` frame) and THE DEFENDER RESOLVES EVERY BLOW on its own sheet
(`src/net/wildFight.js`); there is no floor - a blow can kill. Outdoors the melee arm, the arrows and the cast
engine's marks reach fair players through the duel's own arms (each falls through to the zone when no duel or battle
stands). Underground the dungeon's own swing takes a fair player in reach, in view and in sight before any foe
(`dungeonContext.js:"function resolvePlayerHit"` resolvePlayerHit, over the host's `wildBodies`/`wildStrike`), and its
cast engine's marks are the fair players (`wildSpellMarks`/`wildSpellOut`); no arrow is aimed at a player there. The
last fair attacker whose blow landed within `WILD_KILL_CREDIT_MS` (10 s) of a death is the killer. Inside buildings
there is no player fighting: the zone's danger there is its foes.

ZONE-WATCH (2026-10-08, the owner: "attacking other players in cities will call the guards"): my blow or my spell on a
player in a town of the zone is Assault, the watch's own crime - set and answered (`zoneWatchCall`,
`world.js:"const zoneWatchCall"`) at most once each ten seconds, so a fight keeps the watch called without a storm of
posts. And the watch is ten times as strong there (the owner: "Guards in the cities are 10x times as strong"):
`ZONE_WATCH_SCALE` (`world.js:"const ZONE_WATCH_SCALE"`) through the street host's `guardScale`
(`world.js:"guardScale: () =>"`) - a watchman's health and every blow it lands (`cityGuards.js:"the zone's watch"`).

## 4. A death in the zone

Either death, at the first dead frame, while the room is still the player's (`wildDeathBegin`,
`world.js:"const wildDeathBegin"`):

- KEPT: potions, light sources, the camp's kit and fire, food and water, the rest consumables, ammunition, bandages -
  and everything that never changes hands (a quest's item, a summoned or bound piece, a boat's deed or parts, the
  Materials Bag, a vehicle, a deed, the spellbook, a letter of credit). `src/systems/wildDeath.js`.
- DROPPED: every other thing in the bag and in the cart, taken out, the character saved, and the records deposited in
  the room's remains (section 5). WILD GOLD: and half the gold - `WILD_GOLD_LOSS` (0.5) of the purse and of the cart's
  gold stack, as ONE pile record in the same remains (`takeWildGold`, `wildDeath.js:"export function takeWildGold"`),
  for anyone to take; the usual death penalty is not taken on top (`world.js:"const goldLost ="`).
- WORN: kept on a death to a foe. At another player's hand, in the open country (a cell room), the killer may take
  ONE worn piece: the fallen's game offers the list (`worn`), the killer's body window picks (`pick`), and the
  fallen's game takes the piece out, saves, and gives it (`gave`). The killer's game holds nothing until the gift
  arrives (fail toward loss). While the body lies the fallen's socket stays in the cell (a cell has no host to hand
  over), so the pick reaches them. A death at a player's hand underground drops the bag and the gold as any death
  there does, and offers no worn piece.
- THE DEATH CHECKPOINT. A dead character is never the realm's save, but a death in the zone puts things in the room
  that anyone may take - so a game closed on the death screen must not come back holding them. The character is
  saved AS IT WILL RISE: one health, where it fell, without what it dropped (`wildDeathCheckpoint`).
- A DEATH IN A HALL (HALL-CROWS, the owner: "i dont see the crows circleling around the dungeon where i died on the
  zone map"): always locks the hall for the hour and sets the crows over it, whether or not the pack had anything to
  drop (`world.js:"if (modes?.mode === 'dungeon' && _wdunInside)"`; section 13).
- THE WAIT: the death screen holds `WILD_DEATH_HOLD_S` (120 s) and takes no Enter; the killer's body lies as long.
- THE RISE: the nearest town or temple outside the zone and its band (`wildRiseSite`,
  `world.js:"const wildRiseSite"`) - except a death in one of the zone's dungeons (PVPDUNGEONS, the owner: "Dying in a
  dungeon respawns you in city near the dungeon"), which rises in the city nearest it, in the mountains too, so the
  way back to the remains is a run and not a journey. The team is called to follow whatever Follow Fast Travel says
  (`forceNextFastTravel`, spent by the journey's `handlePreFastTravel`/`handlePostFastTravel` pair - a waiting team is
  called first), the player stood clear of every other body and facing open ground for the team behind
  (`wildSpawnSpot`).

## 5. The remains

The room's object keeps them (`src/net/wildLaw.js`, server `_wild*`): each remains its records and its owner, for
`WILD_REMAINS_MS` (`wire.js:"export const WILD_REMAINS_MS"` - twelve minutes since PVPDUNGEONS: the owner's ten to get
back to them AFTER the two minutes' wait, since the despawn does not wait for the rise), at most
`WILD_REMAINS_ITEMS_MAX` records and `WILD_ROOM_REMAINS_MAX` remains a room. The first `take` of a record wins it; the
record goes to its taker alone (`got`) and the room hears what left (`rm`). On a player's side
(`src/net/wildRemains.js`) each remains is an ordinary ground pile in the pool of the host they stand in - the
street's, a building's, a dungeon's - so it is drawn, aimed at and opened with the very loot window every pile opens
with. A take the window makes is lifted back out of the pack at once and asked of the room; the room's record arrives
with `got` (a take of coin, WILD GOLD's, out of the purse it went to). Nothing can be put on remains (`noStore`, the
capacity door). MY remains wear their own red line of light (`WILD_MINE_MARK`) and a pulsing mark on the world map
with the minutes left.

- NOT A FRIEND'S (PVPDUNGEONS, the owner: "Party/guildmembers cant pick it up"): a fallen's remains are theirs and
  their foes', never their party's or their guild's. The room refuses the take
  (`server/src/index.js:"a fallen's remains are theirs and their"`) - a guildmate read off the sockets' own verified
  guilds (the remains keep the fallen's `gi`), a party member asked of the hub (`_wdunKinOf`,
  `server/src/index.js:"async _wdunKinOf"`, over `WDUN_INTERNAL_KIN`, kept a minute a pair, the stalest pair let go first past 512 - never the whole cache) - and a member's game
  never seeds the pile at all (`canTake`, `world.js:"canTake: (rec) =>"` and `wildRemains.js:"if (!canTake(rec))"`).
- BESIDE THE BODY (PVPFIX, the owner: "place the pile next to the body not on top of it"): the pile stands a fixed
  step to the side of where they fell, the same on every client (`wildRemains.js:"- on top it was hidden"`) - on top
  it was inside the body and could not be aimed at.

## 6. The maps

- WILD2: THE RINGS ON THE WORLD MAP: three thin dashed lines inside the red one where each deeper ring begins
  (`wildRingChains`, smoothed - section 18) - the lines alone since PVPDUNGEONS (the owner: "The 25%,50,75,100% marker
  shown on the world map when not clicking on the zone have to be removed",
  `wildZoneMap.js:"25%,50,75,100% marker shown"`): the zone map and its legend name each ring and its bonus.
  `ui/wildZoneMap.js` paintWildRings.
- WILD2: THE ZONE MAP. A press on the zone on the world map - anything there since ZONE-ZOOM (section 18) - or the
  key's "Zone map" button holds the world sheet to the Wrothgarian Mountains (`_openZoneMap`): the same paper, ink and
  marks, the view fitted to the zone in the room the legend leaves (`zoneMapView`, the clamp `zoneMapLimits` - never
  back out to the bay), the rest of the bay sunk under a wash, each ring laid in its tone as a light wash (ZONEINK2,
  section 18 - the rings' plaques it had are gone), its places named as the zoom comes in, and a legend panel
  (`buildZoneLegend`, enhancedStyle.js `.hmwild`) - the rings with their swatches, where I stand, the zone's laws
  (`ZONE_RULES`, `wildZoneMap.js:"export const ZONE_RULES"`), Begin journey when a destination is picked, the names'
  switch, and the way back (its button, or Escape). The classic page (GrimoireUI) draws each ring's tone in its fog
  and a dark line where a deeper ring begins, and a key of the four in the page's lower left (`_drawWildKey`).

- THE WORLD MAP (enhanced, `src/ui/heldMap.js`): the zone under a drifting fog, built once on its own canvas
  (`src/ui/wildMapInk.js` - the feathered mask times three octaves of value noise, in ash and dried blood) and drawn
  between the land and the marks, so a town in it still reads; its edge a red line over a dark halo, dashed brighter
  past the far band, never drawn along the map's own upper edge where the map ends; a key row "Open PvP zone". Over
  it since the later passes: the day's halls, the crows, my locks, the Greater Giants' skulls, and the border alight
  under the pointer (sections 12-18).
- THE CLASSIC MAP (`src/ui/travelMapWindow.js`, which GrimoireUI dresses): the same zone as a dithered fog layer and a
  red rim, over the province map and over the Wrothgarian Mountains' own page, under the dots. CLASSIC-CUT
  (2026-10-08): on the province map too it is the cut alone, never the whole region - the picker bitmap's region laid
  over the map's by their two boxes (`wildPictureZone`, `wildZone.js:"export function wildPictureZone"`, over the
  mask's `regionBox`; `travelMapWindow.js:"const isZone = wildPictureZone("`); pinned in `test/wild1_zone.test.js`.
- WHO IS SEEN: in or near the zone only my party and my guild (`wildHidesPlayer`) - on the world map and the
  Overworld alike; and a player with no guild sends no region mark there at all.

## 7. The HUD and the windows

- A crossed-blades glyph (`STATUS_GLYPHS.wild`) stands first on the status widget while the player is in the zone, on
  the enhanced skin and on the classic row (`hudActiveSpells.js`), and the crossing is said mid-screen.
- WILD-LINE-HOLD (2026-10-08, the owner: "the warning message for the zone doesnt stay long enough right now only a
  part of a second"): the mid-screen label counts GAME seconds and the zone is crossed at a journey's pace - at x20
  its 1.5 s were 75 ms. A crossing's line (and a ring's, and CROW-NEWS's) is held `WILD_LINE_HOLD_MS` (7 s,
  `world.js:"const WILD_LINE_HOLD_MS"`) of REAL time: put back whenever the label has gone blank, so a later message
  of its own still shows.
- The body's window is the pack in choose-one - the reward tray both skins already draw (Enhanced Plus, and the
  classic window GrimoireUI re-dresses) - titled with the fallen's name.
- The death screen says the killer's claim, what was left behind and the wait, on both faces.

## 8. The wire and the deploy

Relay `world177` (`RELAY_VERSION`, `wire.js:"export const RELAY_VERSION ="`): THE WROTHGARIAN ZONE's one version,
renumbered past main's SUPER-DUNGEONS (world176) - its parts written on their branch as world175 (WILD1) and world176
(PVPDUNGEONS) before ZONE-GIANTS joined them. Two frames:

- `{t:'wild', data}` (`validWildData`), from a hello'd socket in a PLACE room (a cell or a world room), gated on
  `WILD_RELAY_MIN` (177, `wire.js:"export const WILD_RELAY_MIN"`): the blows, a fallen's gear, a remains' deposit and
  its takes (section 3-5).
- `{t:'wdun', k, ...}` (`validWdunIn`/`validWdunOut`, `wire.js:"export function validWdunIn"` and
  `wire.js:"export function validWdunOut"`), to the social hub alone, from a socket whose social hello named its
  verified account, gated on `WDUN_RELAY_MIN` and `WDUN_GIANTS_RELAY_MIN` (177,
  `wire.js:"export const WDUN_RELAY_MIN"`), `WDUN_FRAME_MAX` 160 bytes, `WDUN_HZ_MAX` 2 a second. In: `hi`,
  `in`/`out`/`here`/`die` with a hall `h` (`"px,py"`), `gk` a giant `g` (0-7). Out: `st` (the day, the relay's clock,
  my locks, the crows, the giants down), `ok`/`no` (an entry's answer, its epoch or the lock's time left), `lk` (my
  new lock), `cr` (the crows, and `who` - the account whose death set them), `gd` (the giants down). Sections 12-15.
- Three internal doors between the relay's objects: `WDUN_INTERNAL_RESET` (the hub wipes a hall's world room,
  `wire.js:"export const WDUN_INTERNAL_RESET"`), `WDUN_INTERNAL_KIN` (a place room asks the hub whether two accounts
  share a party, `wire.js:"export const WDUN_INTERNAL_KIN"`) and `WDUN_INTERNAL_GONE` (a place room says a fallen's
  remains are gone, `wire.js:"export const WDUN_INTERNAL_GONE"`).
- And one field on the foe stream: `gg` (`wire.js:"if (r.gg !== undefined)"`), the Greater Giant a foe record is
  (0-7) - section 15.

`src/net/wildLaw.js` joins the relay's bundle (the remains' law and the halls' record, `wdun*`). Deploy the relay
first, then the site. A client on an older relay plays the mountains as they were - the zone is not raised there at
all (`wildFrame` reads `online.wildOk`), and no `wdun` word is sent to a hub that would close the socket on it
(`online.wdunOk`, `online.wdunGiantsOk`).

## 9. The journeys (WILD3, PVPTIERS)

`wildJourney` (`wildZone.js:"export function wildJourney"`): a fast journey never goes into or out of the zone; one
that starts and ends inside it may go once every WILD_TRAVEL_COOLDOWN_MS (ten minutes, `playerEntity.wildTravelAt`),
in coin, for the fee of the TIER IT LANDS IN (PVPTIERS: `WILD_TRAVEL_FEES`,
`wildZone.js:"export const WILD_TRAVEL_FEES"` - 2,500 gold into the foothills, 5,000 the passes, 10,000 the high
crags, 15,000 the heart; WILD3's flat `WILD_TRAVEL_FEE`, the owner's "2,5k", is the foothills' now). Asked at every
fast door - the travel map's journey and the carriage drivers' and the ships' and a party's to its leader
(`fastTravelTo`) - through `wildTravelGate` (`world.js:"const wildTravelGate"`, said when refused) and
`wildTravelPaid`. The Overworld map's journeys are walked, never asked.

- NO TELEPORT (PVPDUNGEONS, the owner: "Teleport to leader etc and of any kind into, in the zone should not be
  possible (except the carriage inside of tiers ofc)"): Recall (but to an anchor in the same interior), the guild's
  teleport and the party's teleport to its leader neither leave from, land in nor go about inside the zone
  (`wildTeleportRefused`, `world.js:"const wildTeleportRefused"`); the zone's own roads between its tiers (the journey
  above) are the one way about it. WILD3 had let a teleport that started and ended inside go for the fee.
- PVPJOURNEY: a journey picked on the zone map is always Cautiously, by land, at inns - no choices (`_forceZoneOpts`,
  `heldMap.js:"_forceZoneOpts(o)"`); a press on the zone map's ground or on a place is a destination, and the legend's
  Begin journey starts it.

## 10. The pace (WILD3)

In the zone the travel dials run under a cap (systems/travelPace.js `setPaceZoneCap`, `WILD_PACE_CAP`): at most x20
off the road and x40 on it. A cap, never a write - the player's choice comes back the moment they leave. A stranger
near holds the journey slower still (STRANGER-PACE, section 11).

## 11. Giants and strangers (WILD3)

- GIANTS: WILD3 stood a Giant (MobileTypes 16) for one wanderer roll in WILD_GIANT_CHANCE (15%) in the zone's open
  country. ZONE-GIANTS retired the roll (the owner: "dont use the 15% anymore"): a Giant the tables roll there is
  passed by (`world.js:"if (hit.mobileType === WILD_GIANT)"`), and the zone's giants are its eight Greater Giants
  (section 15). `WILD_GIANT_CHANCE` and PVPGIANT's `WILD_GIANT_MAX` (`wildZone.js:"export const WILD_GIANT_MAX"`) are
  no longer read. WILD3's size stands: a giant of the zone stands WILD_GIANT_SIZE (four) times its size, its body too
  (`wildGiantSize`) - never a dungeon's.
- STRANGERS: every other player in the zone outside my party and my guild (`wildStrangersFrame`,
  `world.js:"const wildStrangersFrame"`, four times a second). Marked on the Overworld in an enemy's bright red as
  "Stranger" within `WILD_STRANGER_SEE_M` (1,500 m, `wildZone.js:"export const WILD_STRANGER_SEE_M"` - STRANGER-SEE,
  2026-10-08, the owner: "make strangers visible at 1,5km"); their coming said within WILD_STRANGER_M (600 m, as WILD3
  had it); within WILD_STRANGER_SLOW_M (200 m) they hold a journey as any foe does (`journeyThreats`); and over their
  heads no name - on the Overworld a red "Stranger" with none of their badges, in the 3D scene no plate at all
  (`wildNameMask`, `world.js:"const wildNameMask"`; PVPNEAR, the owner: "the red stranger name should not appear when
  in 3d mode").
- STRANGER-PACE (PVPNEAR, the owner: "near a stranger 300m 10x, 200m 5x speed", then: "10x 600m 5x 300 3x 200m and
  1x 100m"): the nearest stranger sets the journey's pace whatever the foe dial says - x10 within 600 m, x5 within
  300, x3 within 200, x1 within 100 (`journeyThreatCap`, `world.js:"function journeyThreatCap"`, its `strangerRate`).
- 3D AT 100 M (PVPNEAR, the owner: "when 70m near the stranger it also auto puts both in 3d mode"): each client
  brings its own Overworld view down when a stranger is within 100 m - the code's distance, not the 70 m asked
  (`wildStrangersFrame`).
- THE MARK AS A FOE'S (PVPNEAR): a stranger's Overworld mark is an enemy's (`tvEnemyMarkKey`,
  `world.js:"const tvEnemyMarkKey"`): a press on it is a journey straight at them, and the one attacked holds the
  journey no slower. STRANGER-HELM (the owner: "a stranger should have a knights helmet in the same art as the dots"):
  the mark is a great helm in the dots' own art - the stranger's red, the dots' black edge
  (`travelViewHud.js:"STRANGER-HELM: a"`). STRANGER-LINE (the owner: "Stranger nearby looks totaly missplaced"): the
  journey box says "stranger near" in red in the ground line's own place while a stranger holds the journey
  (`enhancedTravelControl.js:"in the time box itself"`).

## 12. The halls (PVPDUNGEONS)

2026-10-08. The owner:

> Tier 1 has 10 dungeons evenly split in the tier 1 zone so you can reach a dungeon doesnt matter from where you
> approach the zone - Tier 2 8, tier 3 6, tier 4 4. All dungeons that are set are elite dungeons. Those dungeons
> positions change every 24h realtime hours and are shown on the map and zone map.

Then "as centered as possible not on the border to the other tier... dont override towns or other POIS.",
"Cemeteries cannot be zone dungeons!", and of the rules that follow, "THOSE HAVE TO WORK!".

- SPAWNED, NOT CHOSEN: every real dungeon inside the zone is SEALED ("The way in is sealed - only the halls marked on
  the map are open today.", `wildDungeonGate`, `world.js:"const wildDungeonGate"`, asked by the interior door,
  `worldModes.js:"(host.wildDungeonGate && !(await host.wildDungeonGate(hit, fromLoad)))"`), and the wandering spawner
  stands none there (`world.js:"{ const _wm = wildMaskOf"`). A hall is a clone of a real dungeon on an EMPTY pixel -
  never a place's, never beside one, never the sea (`wildHallFree`, `world.js:"const wildHallFree"`) - so a tier
  always has its count wherever its places are. `src/systems/wildDungeons.js`, pure: the mask, a pixel test and a day
  in, the halls out.
- WHERE: `WILD_DUNGEONS_PER_RING` (10, 8, 6, 4 - `wildDungeons.js:"export const WILD_DUNGEONS_PER_RING"`). Each
  pixel's distance to another ring's or the outside (`wildRingBorderDistance`,
  `wildDungeons.js:"export function wildRingBorderDistance"`) puts the candidates in the ring's middle band (the
  deepest that still holds three candidates a hall); among them a farthest-point walk spreads the halls
  `WILD_HALL_SPACING` (3) pixels apart at least, each next one of the best few by the day's own roll - eased (two
  pixels, one, the whole ring) before the tier is ever short of its count (`wildHallPicks`,
  `wildDungeons.js:"export function wildHallPicks"`).
- WHEN: by the DAY - `wdunDay`, the relay's clock (`WDUN_DAY_MS`, `wire.js:"export const WDUN_DAY_MS"`; the hub's `st`
  carries it, and the client keeps the skew), never a client's own: every player sees the same halls (`wildActiveNow`,
  `world.js:"const wildActiveNow"`). A day gone, its halls leave the index (the one I stand in stays until I leave
  it). With no hub to ask, the day falls back to this machine's clock.
- WHAT: `wildHallStand` (`world.js:"const wildHallStandOf = (mask, px, py) =>"`, over the mask it is handed) stands the day's hall in the index - a clone of a template
  on the zone's own lane of map ids (`WDUN_SALT` 7, `wire.js:"export const WDUN_SALT"`; `spawnedHallMapId`), never a
  graveyard's (LocationTypes 12) nor a cemetery's dungeon type (`wildHallTemplateOk`,
  `wildDungeons.js:"export const wildHallTemplateOk"`), named "Elite <template> (x,y)", always ELITE, its tier on it
  (`wildHall`); the host marks the dungeon elite with its ring and its epoch at the door (`wildDungeonElite`,
  `wildHallRing`, `wildHallEpoch`).
- ITS FOES (the owner: "THE DUNGEONS IN THE ZONE HAVE TO HAVE ONLY HIGH TIER ENEMIES! NO RATS/BATS OR OTHER LOWTIER
  ENEMIES!"): every monster of the template's tables outside `WILD_HALL_FOES`
  (`wildDungeons.js:"export const WILD_HALL_FOES"`) is swapped for one of its ring's - the deeper, the worse, the
  heart's Daedra Lords and Ancient Liches - a pure pick by the hall's id and the foe's index (`wildHallFoes`,
  `wildDungeons.js:"export function wildHallFoes"`; `dungeonContext.js:"PVPDUNGEONS: a hall of"`); a water marker
  keeps a water foe (Dreugh, Lamia); the human classes stand at the player's level as ever. Then the elite dungeon's
  scaling, the zone's four times and the ring's share (section 2).
- ON THE MAPS: the halls are place rows of their own (`wildHallSummaries`, `world.js:"const wildHallSummaries"`) - an
  arched door in its frame, the dungeon's footprint, in `HALL_INK`'s oxblood (`inkMap.js:"export const HALL_INK"`) -
  marked for everyone in the zone, explored or not, on the world map and the zone map; a new day re-marks the sheet.

## 13. The hub's record of the halls (PVPDUNGEONS)

What no client may decide the social hub keeps (`server/src/index.js` `_wdun*`, `_wdunWord` at
`server/src/index.js:"async _wdunWord(ws, acct, m, now)"`), in one small record (`WDUN_KEY`,
`wildLaw.js:"export const WDUN_KEY"` - `{ locks, piles, inside, empty, crows, eps, giants }`), read once a wake and
pruned as it is read (`wdunPrune`, `wildLaw.js:"export function wdunPrune"`). The law is pure (`src/net/wildLaw.js`
wdun*); the hub reads, calls it and writes.

- THE LOCK: an account that leaves a hall - walks out, is unstuck, falls - may not go in again for `WDUN_LOCK_MS` (an
  hour, `wdunLeave`, `wildLaw.js:"export function wdunLeave"`), UNLESS its own remains still lie in that hall: the way
  back to them (`wdunEnter`, `wildLaw.js:"export function wdunEnter"`; `piles`). The client asks at the door and
  awaits the hub's `ok`/`no` (four seconds, then its own memory); HALL-LOCK: its own memory of the lock (set as it
  leaves, `wdunLeft`, `world.js:"const wdunLeft ="`) answers first, so a hub that never heard my way out (a word lost
  on a closed socket) cannot open the door again - and TESTBUILD's god mode, which walks into a sealed door, keeps a
  hall's lock (the owner: "i can still leave and reenter the dungeon as much as i want in the zone").
- WHO IS INSIDE: a heartbeat every `WDUN_HERE_MS` (a minute, `wdunFrame`, `world.js:"const wdunFrame ="`); one silent
  `WDUN_STALE_MS` (three minutes) has left at its last word.
- THE RESET: a hall that has stood empty `WDUN_RESET_MS` (twenty minutes) is wiped as the next account comes in - its
  world room's stored foes and loot forgotten (`_wdunWipe`, `server/src/index.js:"async _wdunWipe(h)"`; the room
  refuses while anyone stands in it, `server/src/index.js:"async _wdunResetInternal"`) - and its EPOCH moves on: every
  client keys the hall's chests by it (`searchLocationKey`, `dungeonContext.js:"function searchLocationKey"`), so a
  reset fills them again for everyone. The halls keep WORLD8's hour for the rest (DUNGEON-RESPAWN, section 21).
- THE CROWS: a death in a hall (`wdunDie`, `wildLaw.js:"export function wdunDie"`) sets crows over it until the last
  remains in it go (`wdunGone`, `wildLaw.js:"export function wdunGone"`, told by the place room over
  `WDUN_INTERNAL_GONE`), said to everyone online (`cr`). On both maps three small black birds circle each such hall
  (`paintWildCrows`, `wildMapInk.js:"export function paintWildCrows"` - THE CROWS, the owner: "use the first ones we
  had thats enough"). CROW-NEWS (the owner: "Players should get a message about the crows when a player dies"): crows
  over a hall that had none are told to everyone in the zone - "Crows gather over <hall> in <tier> - someone has
  fallen there." on the screen and in the chat (`crowsSay`, `world.js:"const crowsSay ="`) - never to the fallen nor
  the fallen's party (`cr`'s `who`, `wdunWord`, `world.js:"const wdunWord ="`).
- HALL-LOCK MARK (the owner: "It should also show locked dungeons for you with a tiny lock symbol next to it"): a
  padlock beside each hall my lock still shuts, on both maps (`paintWildLocks`,
  `wildMapInk.js:"export function paintWildLocks"`) - none while my own remains lie in it.
- THE HELLO: `wdunState` (`wildLaw.js:"export function wdunState"`) - the day, my locks, the crows, the giants down -
  at the hub's hello (again every ten minutes, and on a new link). The record is bounded (`WDUN_ACCTS_MAX` accounts
  with locks; an empty hall's stamp and an epoch let go after a day and two).

## 14. Journeys to a hall

A hall is no row of the map files (it is spawned, by the day), so every door that reads a place by its row missed it:

- HALL-JOURNEY (the owner: "when i want to travel there with begin journey nothing happens"): the Overworld's place
  summary is the hall's own, always known (`tvPlaceSummary`, `world.js:"const tvPlaceSummary"`), so it walks to its
  door as to any place's.
- HALL-ARRIVE (the owner: "when i arrive at the Dungeon it shows this thats wrong" - the journey ran on at the door):
  the journey's arrival rect is read off the hall's spawned location (`world.js:"i arrive at the Dungeon"`).
  HALL-ARRIVE2 ("sometimes this still happens make sure this can never happen to appear this travel bar up there"): a
  watch on every journey to a hall, whichever door began it - at its door (its pixel, its ground grown by 40 m) or
  underground the journey is over, the bar closed and the clock back to one, "You have arrived." (`hallArrivalWatch`,
  `world.js:"const hallArrivalWatch"`).
- HALL-HERE (the owner: "happens only when youre already on the dungeon and press begin journey on the pixel where you
  are"): a journey to the hall I stand at is no journey - "You are already there."
  (`world.js:"only when youre already"`).
- HALL-PLATE (the owner: "it also shows as town right now too in white fonts"): on the Overworld a hall wears the
  dungeons' plate alone, never a place's as well (`world.js:"if (!summary || summary.loc?.wildHall)"`).

## 15. The Greater Giants (ZONE-GIANTS)

2026-10-08. The owner: "can you always spawn 2 giants per tier and make em show on the map where they wander around?
dont use the 15% anymore if this is possible" - then "Name the giant Greater Giant which spawns 10 normal gants when
half health", "everyone in the zone should see the same ... that the big giant is a Greater Giant".

- EIGHT, ALWAYS: `WILD_GIANTS_PER_RING` (2) a tier (`wildGiants.js:"export const WILD_GIANTS_PER_RING"`). Each WANDERS
  a pure walk of the relay's clock and the mask (`wildGiantsAt`, `wildGiants.js:"export function wildGiantsAt"`;
  `src/systems/wildGiants.js`): a day's HOME, a free pixel of its own tier (the second of a tier kept apart from the
  first), and legs of `WILD_GIANT_LEG_MS` (twenty minutes) between waypoints within `WILD_GIANT_ROAM_PX` (5) of it
  (`waypointOf`, `wildGiants.js:"function waypointOf"`), each giant's legs out of step with the others'. So every
  client sees every giant in the same place, walking the same way.
- GIANT-FIELDS (the owner: "make sure the giants dont spawn on top of mounts only in a free field"): a tier's walkable
  pixels are the lower half of its free ones by the height map (`WILD_GIANT_LOW_SHARE`,
  `wildGiants.js:"export const WILD_GIANT_LOW_SHARE"`), and a giant stood in the world stands on the flattest open
  spot within 160 m of its place - no slope over ~22 degrees, no crest, never the water, never outside the zone
  (`giantFieldSpot`, `world.js:"const giantFieldSpot"`).
- GIANT-LEASH (the owner: "giant should not be able to walk out of the zone"): every waypoint is one it can walk to in
  a straight line inside the zone (GIANT-LEASH2 - a bay in the border is walked round, never across), a line that cuts
  the edge holds it at the nearer waypoint, and a giant stood in the world that steps over the edge is put back where
  it last stood inside (`giantLeashFrame`, `world.js:"const giantLeashFrame"`). GIANT-RETREAT (the owner: "when
  players try to leash out the giants out of the zone into the non zone area make the giant leash back 200m into the
  zone, as soon as the player steps out of the zone", then: "The giant should heal then yes"): the moment I step out,
  every giant stood here drops me and walks `GIANT_RETREAT_M` (200 m, `world.js:"const GIANT_RETREAT_M"`) back in -
  the deepest of sixteen ways whose whole line stays inside (`giantRetreatGoal`,
  `world.js:"const giantRetreatGoal"`) - and is whole again when it gets there; pressed at the border while I stay
  out, it turns back again every ten seconds.
- STOOD ONCE FOR ALL (GREATER-GIANT ONE-FOR-ALL): each half second outdoors in the zone, a giant whose walk has come
  within `WILD_GIANT_STAND_M` (320 m) of me stands on the ground - by the lowest peer id among the players as near,
  every client asking the same question of the same peers, and never one already streamed to me (`wildGiantsFrame`,
  `world.js:"const wildGiantsFrame"`). Its puppets carry `gg` on the foe stream
  (`exteriorFoes.js:"if (!onWatch && Number.isInteger(f.entity?.zoneGiant))"`), so every client stands it at its size
  and its name; one handed to me as an heir is mine.
- WHAT IT IS: a "Greater Giant" (`GREATER_GIANT_NAME`, `wildZone.js:"export const GREATER_GIANT_NAME"`;
  `foeTitle.js:"if (entity?.wildGiant)"`), four times its size (WILD3), the zone's four times and its tier's share,
  then PVPGIANT's `WILD_GIANT_HEALTH_MULT` (10) on its health and `WILD_GIANT_DAMAGE_MULT` (4) on its blows
  (`exteriorFoes.js:"if (wild && mobileType === WILD_GIANT && zoneGiant != null && !puppet)"`), and twice an elite's
  drop (`exteriorFoes.js:"if (entity.wildGiant)"`). At half its health (`GREATER_GIANT_CALL_AT`), once a life, it
  calls `GREATER_GIANT_CALL` (10) giants of the ordinary kind - the zone's four times, never an elite or a champion -
  in a ring 10 to 18 m about it, each on the zone's own ground, on the fight at once; the ground shakes and it is said
  (`greaterGiantCall`, `world.js:"const greaterGiantCall"`).
- ITS DEATH IS THE HUB'S: a stood giant that falls is told (`gk`); the hub keeps it down `WDUN_GIANT_DOWN_MS` (half an
  hour, `wdunGiantDie`, `wildLaw.js:"export function wdunGiantDie"` - a second report moves nothing) for everyone,
  says so to everyone online (`gd`), and it walks again for everyone at once from wherever its path has got to.
- GIANT-FALL (the owner: "when a giant dies players in the zone get a screen shake and a message popup which they have
  to click away when not in a fight that a giant has fallen. Then the giant skull is crossed"): to everyone in the
  zone the ground shakes, the chat says which tier, and a Plus box with one OK - held while I fight, shown the moment
  the fight ends (`giantFell`, `world.js:"const giantFell ="`; `giantNoticeFrame`,
  `world.js:"const giantNoticeFrame"`; `DecisionBoxWindow`'s `ok`).
- ON THE MAPS (ZONE-GIANTS, the owner: "show the giants as skulls high quality pixel ones please and dont use the same
  method those circly around them look cheap"): each giant a pixel skull where it walks, on both maps, under the
  waypoints (a flag set on one stands over it), its embers burning bright while it stands in my world
  (`paintWildGiants`, `wildMapInk.js:"export function paintWildGiants"`; `wildGiantMarks`,
  `world.js:"const wildGiantMarks"` - a stood one at its body's own place); eleven by ten since GIANT-SKULL2 (the
  owner: "make the skulls a bit smaller", `wildMapInk.js:"the skulls a bit"`); a fallen one crossed out in red where
  it fell until it walks again. On the Overworld a Greater Giant stood near is marked "Giant", as the enemy it is
  (PVPGIANT, `world.js:"PVPGIANT: the zone's"`).

## 16. The zone's other laws (PVPDUNGEONS)

- NO BANKS, NO HOUSES (the owner: "Players cant use banks in zone and cant buy houses"): the bank's door says "There
  are no banks in the mountains." (`wildNoBank`, `world.js:"wildNoBank: () =>"`;
  `worldModes.js:"if (host.wildNoBank?.())"`) and a home's purchase "No house is for sale in the Wrothgarian
  Mountains." (`wildNoHouse`, `world.js:"wildNoHouse: () =>"`; `worldModes.js:"if (host.wildNoHouse?.())"`).
- NO WORLD EVENTS (the owner: "Do not spawn world events in the PVP zone!"): the Oblivion Gate never takes region 16
  (`gateRegions`, `gateSite.js:"export const gateRegions"`) and every client drops its towns from the day's raids
  alike (`raidingParties.js:"state.raids = raidsForDay"`) - the whole region, cut or not.
- NO REVENANTS (the owner: "No elite or any monster in the zone can be a revenant", then "Only 1 revenant allowed to
  summon in the zone"): a foe of the zone or a Greater Giant is never a revenant's candidate
  (`revenant.js:"if (entity.wildFoe || entity.wildGiant)"`), none returns and no lair stands while I am in the zone,
  and only `WILD_REVENANTS_MAX` (1, `revenantCompanions.js:"export const WILD_REVENANTS_MAX"`) sworn revenant walks at
  my side there - the rest wait outside it.
- NO TELEPORT into, out of or inside the zone (section 9), and no /unstuck outdoors there (section 17).

## 17. /unstuck (PVPUNSTUCK)

2026-10-08, the owner: "3 m forward wont help, to the next town will". The chat's `/unstuck`
(`world.js:"PVPUNSTUCK: outside"`):

- OUTSIDE THE ZONE: at once, once every `UNSTUCK_COOLDOWN_MS` (30 minutes, `world.js:"const UNSTUCK_COOLDOWN_MS"`).
  Indoors and underground it is the door out, as before; OUTDOORS it is now the walk to the nearest town - arrived at
  as the guild's teleport arrives, never asked of the zone's travel law, and never a town in the zone or its band
  (`unstuckOutdoors`, `world.js:"const unstuckOutdoors"`).
- IN THE ZONE: refused outdoors ("/unstuck does not work outdoors in the mountains."); in its buildings and dungeons
  after a five-minute wait (`UNSTUCK_WAIT_MS`) under a bar with a Cancel - a second `/unstuck` or `/unstuck cancel`
  cancels too, a death ends it - once every `UNSTUCK_COOLDOWN_ZONE_MS` (an hour,
  `world.js:"const UNSTUCK_COOLDOWN_ZONE_MS"`; `unstuckBegin`, `world.js:"const unstuckBegin"`). Refused, at the start
  and again at the end, while a stranger is within `UNSTUCK_ENEMY_M` (600 m).
- ITS WORDS: the chat's list says both ways out and the cancel ("/unstuck - out by the door you came in, or outdoors
  to the nearest town (/unstuck cancel stops a wait)"), and a line with anything else after it is refused as "/unstuck
  takes nothing after it but cancel." (`hostMisuseText`, `chatCommands.js:"export const hostMisuseText"`).

## 18. The maps, later

- SMOOTHZONE (the owner: "the zone how it is cut out right now smooth it better"): the edge's and the rings' contours
  are drawn as a pen would - resampled, relaxed toward their neighbours, corner-cut (`smoothContour`,
  `wildZoneMap.js:"export function smoothContour"`); the fog is clipped by the same curve, and a wide soft shadow lies
  under the red line.
- ZONEINK2 (the owner: "The tier colors when zoomed in on the zone map are overwriting the map too much make it look
  waaaay more high quality and take care of the performance"): the tiers are a WASH - `TIER_WASH`
  (`wildZoneMap.js:"export const TIER_WASH"`), a light pigment each laid with `multiply`, so the sheet's relief, roads
  and grain read through, drawn ONCE a mask into a canvas of its own (`tierWash`); a frame is one drawImage and the
  tiers' thin lines. The rings' plaques are gone from the zone map (its legend names each). And "dont show all
  location names from the beginning when you zoom in": the cities are named at the zone map's fit, the towns from
  `ZONE_NAMES_TOWNS` (1.5, `wildZoneMap.js:"export const ZONE_NAMES_TOWNS"`) of it, every other place from
  `ZONE_NAMES_ALL` (2.2); the legend's "Hide place names" turns them off.
- TIER-SWATCH (the owner: "the tiered colors in the legend look way too similiar", then "change the tier colors
  accordingly to the map in the legend"): four pigments apart - sand, amber, madder rose, plum, each deeper than the
  last - and the legend's swatch is the tier AS THE MAP SHOWS IT, its wash and its shade multiplied on the parchment
  (`tierSwatch`, `wildZoneMap.js:"export function tierSwatch"`).
- ZONE-FIRST (the owner: "when iam in the zone and press V it should open the zone map", then "when you press V in the
  zone it should also center to you same on the world map"): standing in the zone (not underground), the map opens on
  the zone map centred on me, and its World map button opens the world map centred on me
  (`heldMap.js:"iam in the zone and"`).
- ZONE-ZOOM (the owner: "when you click a town or any other POI in the zone out from the world map it dosent zoom you
  in it should always zoom you into the zone map doesnt matter what you click there"): on the world map ANY press
  inside the zone - a town, a hall, a quest's mark, bare ground - opens the zone map first
  (`heldMap.js:"you click a town"`).
- LEGEND-FIT (the owner: "now i have to scroll down in the legend for begin journy make it so that i dont have to do
  that"): the legend's laws scroll in their own box; its foot - Begin journey first - is always in view
  (`wildZoneMap.js:"i have to scroll"`).
- THE BORDER ALIGHT (PVPDUNGEONS, the owner: "the border only burns when you hover over it on the world map not when
  youre already zoomed in on the zone"): a fire of square pixels along the red line while the pointer is on the zone,
  on the world map alone (`paintWildFlames`, `wildMapInk.js:"export function paintWildFlames"`; `_flamesUp`,
  `heldMap.js:"_flamesUp() { return"`). The crows, the giants and the flames redraw the overlay alone, and only while
  something moves.
- FINDME (the owner's screenshot: a full-width red cross): a "Find me" button left of Close - the view glides to my
  pixel and a red cross blinks over it for three seconds (`_findMe`, `heldMap.js:"_findMe() {"`), on the world map and
  the zone map. Not the zone's alone.

## 19. The mountains walkable (MOUNTAINS WALKABLE)

The Overworld's on-foot mountain rule is gone, everywhere: `openStepBlocked` answers false for every step
(`travelRoute.js:"export function openStepBlocked"`), and the planner's ground refuses no open step and calls no pixel
a peak (`travelRoute.js:"const openBlocked"`), so "The mountains cannot be crossed on foot." never fires. This retires
OW-MOUNTAINS (2026-09-28, Mac: "You shouldnt be able to navigate mountains" - the Mountain climate and a steep rise
refused, `06-Systems/Travel-View.md`) and the World of Daggerfall massifs OW-WOD-PATH made peaks: the host still hands
the planner its rock table (`tvWodRocks`, `world.js:"function tvWodRocks"`, which says the Wrothgarian Mountains'
on-foot rule outside the zone is removed - the patch had for a while let only roads and tracks be walked in region 16
outside the cut), and the planner no longer reads it. Offline too: the law is the planner's, not the zone's. The
words that promised the old rule say the new one: First Person Travel's roads switch is "planned by land"
(`modSettings.js:"GeneralOptions.FirstPersonTravelFollowsRoads"`) and the Overworld's Free path is "straight across
country" (`travelPathMode.js:"tipFree:"`), neither "round the mountains" any more.

## 20. The test build (TESTBUILD)

`TEST_GODMODE` (`world.js:"const TEST_GODMODE"`), false as merged. True, every player is given the staff's /god, /fly,
/heal and /tp (`isStaffT`), and god mode lifts the zone's travel law (`wildTravelGate` free, `wildTeleportRefused`
never), makes a map journey instant (a teleport, from anywhere to anywhere), takes /unstuck at once with no cooldown,
and walks into a sealed door - but never past a hall's hour (section 13). `/godmode` is `/god` for the staff either
way (`world.js:"const staffCmd ="`).

## 21. Riding along (the same merge, outside the zone)

The patch carried the owner's other asks of the same day. Each is the whole game's, online and off unless it says so;
each is a line here, findable by its tag.

- DUNGEON-RESPAWN (the owner: "normal dungeons outside the zone 20mins respawn timer (which timer doesnt reset when
  someone was in and left) for everything and the same for elite dungeons 40 mins respawn timer for everything"):
  WORLD8's respawn (`06-Systems/Online-Arc.md`: a dead foe and an emptied container each back on their OWN clock from
  when it fell or was emptied) at the dungeon's own pace - a normal dungeon twenty minutes, an elite one forty; the
  zone's halls and a Super dungeon keep the hour (`dungeonRespawnMs`,
  `dungeonRespawn.js:"export const dungeonRespawnMs"`; `dungeonContext.js:"const _respawnMs"`). Online alone, as
  WORLD8 is.
- HEAL-CURSE (the owner: "Add a button to the temple services under heal disease named heal curse it removes being a
  werewolv and vampire and also removes their positive effects/negative effects and buffs ofc."): the Cure Disease
  priest's second row (key H), under Cure Disease - a row lower where LOOT16's Lift Curse stands - on both skins
  (`guildServiceWindow.js:"HEAL-CURSE: the temple's second row, under its"`, enhancedPorts.js): vampirism and
  lycanthropy cured through DFU's own CureVampirism and CureLycanthropy, and either still in the blood ended with the
  turn it counted toward (`healCurseLift`, `healCurse.js:"export function healCurseLift"`) - every gift and weakness with it -
  for `HEAL_CURSE_BASE` (12,000, `healCurse.js:"export const HEAL_CURSE_BASE"`) through the region's price adjustment
  and the temple's quality (`healCursePrice`, `healCurse.js:"export function healCursePrice"`), a Yes/No box
  (`healCurseBox`, `worldModes.js:"function healCurseBox"`). `src/systems/healCurse.js`.
- REST-WARN (the owner: "Poison/Disease warning on rest, there should be one for when you attempt to rest"): a rest
  begun while a poison or a plain disease works asks first - "You are poisoned." / "Resting will not cure it." / "Rest
  anyway?" (`restAilmentLines`, `restWarning.js:"export function restAilmentLines"`; `src/systems/restWarning.js`),
  the rest window opening on its Yes once the box has left the slot (`world.js:"const restNow = ()"`). Wired in all
  four hosts' rests - the street's, the interior's, the dungeon's and the fixed city's (world.js, worldModes.js,
  dungeonContext.js, exterior.js; the last left out by the patch and wired after it, 2026-10-08, THE FOUR HOSTS RULE -
  `test/pvpdungeons_game.test.js` sweeps all four). REST-WARN2 (the owner: "those are not enhanced
  plus ui button and window"): THE DECISION BOX (`DecisionBoxWindow`,
  `decisionBox.js:"export class DecisionBoxWindow"`; `src/ui/decisionBox.js`) - DFU's message box with its YesNo
  buttons, drawn as the Plus decision dialog under the enhanced skin and DFU's parchment on the classic; Y / N, Return
  is No. GIANT-FALL uses its one-button `ok` face.
- STATS-RESIST (the owner: "Resistances on the stat screen please"): the Stats page's Resistances - each of the seven
  harms' chance to be turned away (`RESIST_ROWS`, `statsCard.js:"export const RESIST_ROWS"`): any Resist effect
  running first, then the saving throw's own chance before its roll (`savingChance`,
  `spellcast.js:"export function savingChance"` - savingThrow's whole law but the dice, so the page and the throw
  never disagree).
- SHOP-HOVER (the owner: "hovering over items in all shops shows the same it does in your inventory"): the pack's own
  hover card over both lists of the shop counter (`showItemHover`,
  `enhancedInventory.js:"export function showItemHover"`), the same comparison against what is worn. SHOP-SIDES (the
  owner: "tooltip of hovering on item in your inventory should be on the left side of shop window and what the shop
  has on the right"): the card stands outside the window, mine to its left, the shelf's to its right. TRADE-STEADY
  (the owner: "when you click on an item a bar with info appears.... its super annoying when you try to sell the
  buttom items cause clicking them causes the bar to appear over them"): the detail strip's room is always kept under
  the lists, so a click never moves the row under the pointer
  (`enhancedTrade.js:"you click on an item a bar with info appears.... its super annoying"`).
- THE HANDS. SWAP-HANDS (the owner: "the game should also let you swap out left and right hand in the inventory (right
  now you have to put both in the inventory again and requip it)"): the two hands' pieces trade by the equip table's
  own hand law - a shield never leaves the left, a right-only or two-handed weapon never the right, one piece crosses
  to an empty hand - one equip act (`canSwapHands`, `equip.js:"export function canSwapHands"`). HAND-DRAG (the owner:
  "dragging and dropping the left hand weapon to the right hand one or when empty should be possible in the
  inventory"): a hand's own panel is a drop target (`handIntent`, `enhancedInventory.js:"function handIntent"`).
  HANDS-COMPARE (the owner: "Damage comparison should now show left and right hand in the item info when hovering"): a
  weapon's card sets it against each hand's (`armourCard.js:"comparison should now show left"`).
- TRACK-ONLY (the owner: "When you dont track a quest it should never appear on the screen! right now when i dont
  track the main quest it still is shown tracked."): the quest on screen - the card, the compass's mark, the map's
  filled diamond - is the TRACKED one and nothing else (`shown`, `questTracker.js:"shown() {"`); the journal still
  opens on the quest it follows (`06-Systems/Quest-Guide-Arc.md` WHICH QUEST).
- RARE-REAGENTS (the owner: "please add Unicorn horn, Basilisk eye and a Pearl. I couldn't find any of those on any
  Alchemist shop"): every Alchemist's counter shelf always carries one Basilisk Eye, Unicorn Horn and Pearl, minted
  and priced as every row is (`ALCHEMIST_ALWAYS`, `shopStock.js:"export const ALCHEMIST_ALWAYS"`).
- GOTHWAY-BOARDS (the owner: "is it possible to put a bounty board on each site of gothway gardens so newbies have a
  direction!"), GOTHWAY-NORTH ("place them to the north on the border of the town so new player coming from privateers
  hold can see them") and GOTHWAY-LIFT ("the boards are in the ground"): Gothway Garden stands two bounty boards at
  its north entrance, one each side of the road in from Privateer's Hold, a few paces inside the border, facing
  north - the road read off the town's own walk grid (`gothwayNorthSpots`,
  `gothwayBoards.js:"export function gothwayNorthSpots"`; `src/systems/gothwayBoards.js`), stood in the town's build
  each with its foot on the ground (`world.js:"if (isGothwayGarden(dfLocation.name))"`) and counted a bounty board
  always (`boardSplitOf`, `world.js:"const boardSplitOf"`).
- PVPFIX (the owner: "Undeniable Access/lockpicking should actually work on locked crates"): an armed Open spell fires
  on the next lock touched, a crate's as a door's, and the pick is tried in Grab mode too
  (`dungeonContext.js:"Access/lockpicking"`).

## 22. Known limits

- A modified client can still refuse to give a picked piece or to deposit what it should drop - the realm's budgets
  and item ids are the check, as for every client-held pack.
- The maps' hiding is the receiving client's; a guildless player's own mark is never sent in the zone.
- No player fighting inside the zone's buildings; underground no arrow is aimed at a player and no worn piece is
  claimed.
- The halls' day, locks and crows are the hub's: with no hub (an older relay, a lost socket) a client stands the
  halls by its own clock and keeps its own session's locks, and hears no one else's crows.
- ZONE-WATCH's door reads a town's buildings too, but no player blow is struck indoors, so in practice it is the
  street's.

## 23. What the suite caught (WILD-SUITE, 2026-10-08)

The zone landed without a run of the suite. Four of what it caught were the source's, fixed there:

- THE HALLS STAND FROM ABOVE THE FIRST BUILD (BOOT-TDZ2). The boot's first pixel build asks `spawnedDungeonAt`, and
  in the zone that is a hall's stand - which, with its day, its picks and its templates, was declared fifteen thousand
  lines below the build: on an online boot on a hall's pixel each read was a dead zone, the builder's `try` swallowed
  it and no hall stood. They are declared above the builder now (world.js:"const wildHallStandOf = (mask, px, py) => {"),
  handed the mask the builder just read; play's callers keep the session's (`wildActiveNow`, `wildHallStand`).
- THE HALL'S GATE WAITS INSIDE THE DOOR'S (AUDIT 68 X3). The hub's word on my lock (up to four seconds) was awaited
  before the transition gate, so a teleport, a Recall or a load inside it did not stale the door; it is asked inside
  the gated build now, and the build re-validated after it (worldModes.js:"the world moved during the hub's word").
- `/unstuck`'s bar stands at the HUD's z 30, not 9999 - over the asset picker (MWFIX 1); the Heal Curse hotkey plays
  the hotkey arm's one click, not a second of its own (AUDIT 26 D1); and the temple's blood curse is `bearsCurse` /
  `healCurseLift`, not the item curse's `isCursed` / `liftCurse` (AUDIT 24, one name one home).

## Pins

`test/wild1_zone.test.js`, `test/wild1_wire.test.js`, `test/wild1_fight.test.js`, `test/wild2_rings.test.js`,
`test/pvpdungeons_game.test.js` (the halls' placement and foes, HEAL-CURSE, REST-WARN, SWAP-HANDS, GOTHWAY-BOARDS,
ZONE-GIANTS' walks and the hub's giants, GIANT-FIELDS, GIANT-LEASH, CROW-NEWS, DUNGEON-RESPAWN, GREATER-GIANT,
WILD-KEEPOUT), `test/pvpdungeons_hub.test.js` (the `wdun` wire, the lock, the way back, the reset, the crows, the
relay's hub and no friend's take); the host seams of section 23 in `test/bootorder.test.js`,
`test/audit68_worldmodes.test.js`, `test/mapkeep.test.js`, `test/mwattach.test.js`, `test/audit26_uiwindows.test.js`
and `test/audit24_onehome.test.js`; `tools/mutants/wildsuite.json`.
