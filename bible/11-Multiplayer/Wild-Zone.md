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
> inside the zone costs 2,5k gold and has a 10minute coold down. you cant fast travel out and into the zone. Same for
> all other fast travel options except the overworld map. Giants you meet there are also 4 times bigger(not in
> dungeons only outside). i hope there are giants to meet :D ... Youre also slower in this zone max 20x in the wilds
> and 40x on the roads and when other players are near you they are counted as enemies bright red and its called
> stranger when you near them Like 600m away. and when youre near them like 200m it slows you down like normal
> enemies. And no player nameplates should be visible in the zone except the ones out of your party and guild.

READ AS: the centre's "+100%" is the flat "twice" of WILD1 - the heart pays what the whole zone paid, the outer rings
less; the foes are four times as strong in every ring.

This is the second door through Multiplayer.md's "It is not PvP" - the first is the duel (DUEL1). Not a DFU member:
Daggerfall Unity has no other players. Ledger A (ONLINE).

## 1. What the zone is

Every map pixel the politic map gives to region 16 (`MapsFile.getRegionIndexAt`, its bad byte 105 folded in) and
every place on it - its streets, its buildings, its dungeons. NEAR it is within `WILD_NEAR_PX` (6) map pixels of its
edge. ONLINE ALONE: offline the mountains are Daggerfall's own (the death penalty's law). The law is
`src/systems/wildZone.js` (a leaf: the region test, the mask and its edge, the numbers, the live flag the pools read
at a spawn, and the death screen's state); the world host sets the flag each frame from the region under the player
(`_questRegionIndex`) and says the crossing.

## 2. Foes and loot

- WILD2: THE RINGS. A pixel's depth is its chamfer distance from the zone's edge (`buildWildMask`'s `depth`), over the
  deepest pixel's; the outer quarter of that depth is ring I (the Foothills, +25%), then II (the Passes, +50%), III (the
  High Crags, +75%) and the heart, IV (+100%) - `WILD_RING_LOOT`, `wildRingAt`. Everything below is at the ring's
  multiplier (`wildRingLoot`): a street foe takes the ring the player stands in at its spawn (`wildRing`, the world host's
  each frame), a dungeon the ring of its own map pixel (`wildRingAtPlace`, over the mask the world host registers -
  every client of the room alike). Crossing a ring is said ("Deeper - The Passes: +50% loot.") and the HUD's zone tile
  names it.
- A foe of the zone stands four times its health and hits four times as hard - over whatever it already is (an
  elite, a champion, a revenant), so "even elites and champions" (`applyWildFoe`). A street puppet scales its blows
  alone; its maximum is its owner's word. A dungeon's foes scale on every client alike (the dungeon's own region,
  read once at the build), so the room's maximum agrees.
- Its loot at its ring's multiplier: every category's chance (`lootDropMult`) and the rarity ladder's odds
  (`lootQualityMult`) through `wildLootOpts` - the doors spawnEnemyLoot already has, whose chain is untouched - its gold
  after the chain (hostCombat.js `wildLootAfter`) and a plain foe's cap as much wider (foeLootCap.js, by `wildRing`). A
  dungeon's treasure pile rolls its ring's share of a SECOND roll through its one home (`wildPileMore`: the heart's
  always, the foothills' one time in four) - so its drops, its gold and its odds of a rare piece are the ring's on average.

## 3. The fights

Two players standing in the zone, outdoors, may strike each other - never a member of my party, never my duel's
opponent. The frames are the duel's own (`strike`, `spell`, `result` on the `wild` frame) and THE DEFENDER RESOLVES
EVERY BLOW on its own sheet (`src/net/wildFight.js`); there is no floor - a blow can kill. The melee arm, the arrows
and the cast engine's marks reach fair players through the duel's own arms (each falls through to the zone when no
duel or battle stands). The last fair attacker whose blow landed within `WILD_KILL_CREDIT_MS` (10 s) of a death is
the killer. Inside buildings and dungeons there is no player fighting: the zone's danger there is its foes.

## 4. A death in the zone

Either death, at the first dead frame, while the room is still the player's:

- KEPT: potions, light sources, the camp's kit and fire, food and water, the rest consumables, ammunition, bandages -
  and everything that never changes hands (a quest's item, a summoned or bound piece, a boat's deed or parts, the
  Materials Bag, a vehicle, a deed, the spellbook, a letter of credit). `src/systems/wildDeath.js`.
- DROPPED: every other thing in the bag and in the cart, taken out, the character saved, and the records deposited in
  the room's remains (section 5). The purse is the death penalty's, unchanged.
- WORN: kept on a death to a foe. At another player's hand the killer may take ONE worn piece: the fallen's game
  offers the list (`worn`), the killer's body window picks (`pick`), and the fallen's game takes the piece out,
  saves, and gives it (`gave`). The killer's game holds nothing until the gift arrives (fail toward loss). While the
  body lies the fallen's socket stays in the cell (a cell has no host to hand over), so the pick reaches them.
- THE DEATH CHECKPOINT. A dead character is never the realm's save, but a death in the zone puts things in the room
  that anyone may take - so a game closed on the death screen must not come back holding them. The character is
  saved AS IT WILL RISE: one health, where it fell, without what it dropped (`wildDeathCheckpoint`).
- THE WAIT: the death screen holds `WILD_DEATH_HOLD_S` (120 s) and takes no Enter; the killer's body lies as long.
- THE RISE: the nearest town or temple outside the zone and its band (`wildRiseSite`), the team called to follow
  whatever Follow Fast Travel says (`forceNextFastTravel`, spent by the journey's `handlePreFastTravel`/`handlePostFastTravel` pair - a waiting team is called first), the
  player stood clear of every other body and facing open ground for the team behind (`wildSpawnSpot`).

## 5. The remains

The room's object keeps them (`src/net/wildLaw.js`, server `_wild*`): each remains its records and its owner, for
`WILD_REMAINS_MS` (10 minutes), at most `WILD_REMAINS_ITEMS_MAX` records and `WILD_ROOM_REMAINS_MAX` remains a room.
The first `take` of a record wins it; the record goes to its taker alone (`got`) and the room hears what left (`rm`).
On a player's side (`src/net/wildRemains.js`) each remains is an ordinary ground pile in the pool of the host they
stand in - the street's, a building's, a dungeon's - so it is drawn, aimed at and opened with the very loot window
every pile opens with. A take the window makes is lifted back out of the pack at once and asked of the room; the
room's record arrives with `got`. Nothing can be put on remains (`noStore`, the capacity door). MY remains wear their
own red line of light (`WILD_MINE_MARK`) and a pulsing mark on the world map with the minutes left.

## 6. The maps

- WILD2: THE RINGS ON THE WORLD MAP: three thin dashed lines inside the red one where each deeper ring begins (Chaikin-
  smoothed contours, `wildRingChains`), and past the far band each ring's bonus in a small tag up the column north of
  the heart (`wildRingAnchors`) - `ui/wildZoneMap.js` paintWildRings.
- WILD2: THE ZONE MAP. A press on the zone's bare ground on the world map - or the key's "Zone map" button - holds the
  world sheet to the Wrothgarian Mountains (`_openZoneMap`): the same paper, ink and marks, the view fitted to the zone
  in the room the legend leaves (`zoneMapView`, the clamp `zoneMapLimits` - never back out to the bay), the rest of the
  bay sunk under a wash, each ring filled in its tone (amber at the foothills to dried blood at the heart) with its line
  heavy, the zone's towns and dungeons named, a plaque on each ring (numeral, name, bonus; mine edged in brass), and a
  legend panel (`buildZoneLegend`, enhancedStyle.js `.hmwild`) - the rings, where I stand, the zone's laws, and the way
  back (its button, or Escape). The classic page (GrimoireUI) draws each ring's tone in its fog and a dark line where a
  deeper ring begins, and a key of the four in the page's lower left (`_drawWildKey`).

- THE WORLD MAP (enhanced, `src/ui/heldMap.js`): the zone under a drifting fog, built once on its own canvas
  (`src/ui/wildMapInk.js` - the feathered mask times three octaves of value noise, in ash and dried blood) and drawn
  between the land and the marks, so a town in it still reads; its edge a red line over a dark halo, dashed brighter
  past the far band; a key row "Open PvP zone".
- THE CLASSIC MAP (`src/ui/travelMapWindow.js`, which GrimoireUI dresses): the same zone as a dithered fog layer and a
  red rim, over the province map and over the Wrothgarian Mountains' own page, under the dots.
- WHO IS SEEN: in or near the zone only my party and my guild (`wildHidesPlayer`) - on the world map and the
  Overworld alike; and a player with no guild sends no region mark there at all.

## 7. The HUD and the windows

- A crossed-blades glyph (`STATUS_GLYPHS.wild`) stands first on the status widget while the player is in the zone, on
  the enhanced skin and on the classic row (`hudActiveSpells.js`), and the crossing is said mid-screen.
- The body's window is the pack in choose-one - the reward tray both skins already draw (Enhanced Plus, and the
  classic window GrimoireUI re-dresses) - titled with the fallen's name.
- The death screen says the killer's claim, what was left behind and the wait, on both faces.

## 8. The wire and the deploy

One frame, `{t:'wild', data}` (`validWildData`), relay `world175` (`WILD_RELAY_MIN`); `src/net/wildLaw.js` joins the
relay's bundle. Deploy the relay first, then the site. A client on an older relay plays the mountains as they were - the
zone is not raised there at all (`wildFrame` reads `online.wildOk`).

## 9. The journeys (WILD3)

`wildJourney` (systems/wildZone.js): a fast journey never goes into or out of the zone; one that starts and ends inside
it costs WILD_TRAVEL_FEE (2,500) gold in coin and may go once every WILD_TRAVEL_COOLDOWN_MS (ten minutes,
`playerEntity.wildTravelAt`). Asked at every fast door - the travel map's journey and the carriage drivers' and the
ships' and a party's to its leader (`fastTravelTo`), Recall (`recallToAnchor`), the guild's teleport (`teleportTo`) -
through `wildTravelGate` (said when refused) and `wildTravelPaid`. The Overworld map's journeys are walked, never asked.

## 10. The pace (WILD3)

In the zone the travel dials run under a cap (systems/travelPace.js `setPaceZoneCap`, `WILD_PACE_CAP`): at most x20 off
the road and x40 on it. A cap, never a write - the player's choice comes back the moment they leave.

## 11. Giants and strangers (WILD3)

- GIANTS: in the zone's open country one wanderer roll in WILD_GIANT_CHANCE (15%) stands a Giant (MobileTypes 16), and
  a giant of the street's pool there stands WILD_GIANT_SIZE (four) times its size, its body too (`wildGiantSize`) -
  never a dungeon's.
- STRANGERS: every other player in the zone outside my party and my guild. Within WILD_STRANGER_M (600 m) of me they
  are marked on the Overworld in an enemy's bright red as "Stranger" (travelViewHud.js `stranger`), and their coming
  is said; within WILD_STRANGER_SLOW_M (200 m) they hold a journey as any foe does (`journeyThreats`); and over their
  heads no name - a red "Stranger" with none of their badges (`wildNameMask`, net/remotePlayers.js nameFrame's `mask`).

## 12. Known limits

- A modified client can still refuse to give a picked piece or to deposit what it should drop - the realm's budgets
  and item ids are the check, as for every client-held pack.
- The maps' hiding is the receiving client's; a guildless player's own mark is never sent in the zone.
- No player fighting inside the zone's buildings and dungeons.

## Pins

`test/wild1_zone.test.js`, `test/wild1_wire.test.js`, `test/wild1_fight.test.js`, `test/wild2_rings.test.js`.
