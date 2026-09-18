# Climates & Calories - the survival arc (SURV), an overhaul

**Ralzar's Climates & Calories 1.7.1**, handed over by Mac on
2026-09-17 with the author's permission to overhaul it: "Instead of a
1:1 port, we have been given permission to completely overhaul this
mod, figure out bugs and implement it to our desire." Mac's brief for
the rebuild (2026-09-18): tents are shared world objects online;
campfires (in dungeons and outside) and beds are the go-to rest, with a
new purchasable campfire item; consumables are the other mitigation;
the rest window is a last resort that costs, offline and online; all of
it on by default; "we're going to tackle everything here properly."

The zip carries a compiled DLL and no source, so the mod was read off
its IL (`tools/ilDump.py`; the reading is in `Systems-Arc.md` under
SURV) and rebuilt as the port's own laws. The vendored folder
(`vendor/climates-calories/`, its README carrying the permission) holds
the manifest, the mod's item templates and sixteen of its item icons.

## What the mod was (read off the DLL)

Six systems on DFU's magic round (one game minute): a **temperature**
(climate + month + hour + weather, then race, clothes, armour, wetness,
resistances), **hunger** riding DFU's own tavern clock with food as
minutes of satiety and a rot stage per item, **thirst** answered by an
auto-drinking waterskin, a **sleep** counter, **camping** (a tent and
fire from one item; rest, cook, pack), **hunting** as a modal pop-up
with a time skip, and a replacement **tavern** window with regional
menus and drunkenness. Its bugs and cliffs, from the code: a quadratic
sleep counter (exhaustion after one long day), a starvation counter
that never resets, fast travel and prison resetting every need for
free, a thirst that rises even when freezing, a race cliff on heat
loss, six mod-message calls a round into a mod the port does not
carry, and everything static.

## What the port built

| Slice | What | Where |
|---|---|---|
| SURV1 | the model: felt temperature, five needs, food and water, one entry of stat drains | `src/systems/survival/temperature.js`, `needs.js`, `food.js`; the world-minute hook in `worldTick.js`; the record on `entity.survival`, saved |
| SURV2 | the items: templates 530-541, minting, spoilage, the use handlers, the general store's provisions, the starting kit, the corpse's meat, the mod's icons through a vendor-only archive | `survival/items.js`, `loot.js`, `switch.js`; `itemTemplates.js` custom rows; `textureReplacement.js` vendor art; `useItem.js`, `shopStock.js`, `equip.js` |
| SURV3 | camps: the tent and the fire as placed objects with a menu, cooking, the water sources, shared online | `survival/camp.js` (the law), `scenes/camps.js` (the pool), the three hosts' mounts, `player/activationRace.js`, both inventory skins, `sceneCache.js` |
| SURV4 | the rest law: beds and campfires sleep, the window is costed | (in progress) |
| SURV5 | the HUD strip, the status page, the tavern menus, the switch | (in progress) |
| SURV6 | hunting and foraging as real-time events | (in progress) |
| SURV7 | online alignment, records, the probe | (in progress) |

### The temperature (SURV1)

`feltTemperature(env, worn, ctx)`: the natural temperature is the
climate's own (Desert 40, Desert2 50, Subtropical 30, Rainforest 20,
Swamp 10, Woodlands -10, Haunted -20, Mountain Woods -30, Mountain
-40) plus the month's swing (-20 in Morning Star, +20 in Mid Year),
the hour's (evening and dawn -10, the small hours -20, times 3-4 in
the deserts and 2 in the mountains) and the weather's (overcast -8,
fog -5, rain and snow -10, a storm -15, the sandstorm +5); indoors
half the climate and season with no sky or hour, underground no hour
or sky and then the dungeon correction (cool, -20..0). Resistance is
degrees toward zero: race flags (25/50, -25/-50), spell resistances as
degrees, a vampire 25 of frost, a were-beast in its form 100/80.
Clothing warms by piece (1-12), the cloaks by variant (a formal cloak
three times a casual one), less the wetness one for one, never below
nothing; a hood shades ten in strong sun. Armour warms a little and its
metal heats in sun (unless a cloak or a robe covers it) or chills in
cold. The felt temperature is the resisted world plus the resisted body
(race, clothes, armour, a fire's 15, less a twentieth of the wetness,
less the naked offset 5), and a drink in the pack takes ten off a hot
reading.

### The needs (SURV1)

One record on the entity: `lastAte` (a classic minute), `thirst`
(0..150), `wet` (0..300), `sleepDebt` (hours), `awakeSince`,
`exposure`, `fed`, `drunk`, the rot day counter. `survivalMinute` is
the whole per-minute law; `runSurvivalMinutes` walks a span capped at
two days; `alignSurvival` is WORLD5's law for these markers (a player
away longer than a day comes back fed, watered and rested rather than
charged). Stages: hunger peckish at 240 minutes, hungry at 720,
starving at 1440 (then -2 to seven stats a day and rations eaten by
themselves); thirst thirsty 50, parched 80, dehydrated 100 (fatigue
taxes, then stats, then health in heat); sleep tired 4, drowsy 8,
exhausted 12 (the debt grows past sixteen hours awake; a bed pays 1.5
an hour, a rough rest 0.5 and never below tired); wet damp 5, wet 30,
soaked 100, drenched 200. Heat and cold charge fatigue by the band (16
units per 20 degrees), build an exposure drain past 30, and cost health
past 50; bare skin in the cold, bare feet, the sun on bare skin and wet
metal all have their lines. The drains are one `activeEffects` entry
of kind `survival` rewritten each minute, never a duration, capped so
no stat goes under five.

### The items (SURV2)

The mod's templates as the port's custom rows above DFU's 288
(`registerCustomTemplates`), every reader through `templateByIndex`:
Camping Equipment (50 uses), Rations (250 minutes, stackable), Apple
and Orange (60, and ten off the thirst), Bread (180), Raw Fish (90,
raw), Cooked Fish (200), Meat (240), Raw Meat (100, raw), the Waterskin
(two kilos of water that weigh what they are; a drink is a tenth), the
Skillet, and the port's own Campfire Kit (five fires). A food spoils by
stage on a heat-driven day count against its keeping (bread 95, raw
fish 50); past stale it wears the mod's own picture through DFU's
item-level world-texture override, served from a vendor-only archive
the pipeline stands in for. Eating: a meal must find at least its own
worth of hunger, banks four hours ahead, and raw or spoiled food risks
the stomach on a failed luck roll (stomach rot; mouldy and worse, swamp
rot or yellow fever - never the plague). The general store shelves
provisions after the horse and cart; a new character sets out with two
sacks of rations, a full skin, worn camping gear and a fire kit with
two lights left. An animal's corpse carries raw meat by its kind (a rat
one, a bear six to ten and luck, half of it turning), the slaughterfish
raw fish, and a humanoid a meal on a high roll. All of it behind the
one switch (`survival/switch.js`, the `mod-climates-calories` feature
row, on by default).

### The camps (SURV3)

Two placeables off the pack, decided by `survival/camp.js` and stood
by `scenes/camps.js` (the dropped torches' shape, one pool per host).
Camping Equipment pitches a TENT: the mod's model 41606 behind a fire,
the gear leaving the pack with its uses as the camp's wear and coming
back with it when packed. A Campfire Kit lights a FIRE alone: one use
off the kit, the last one taking the kit with it. Both go
two-and-a-half metres ahead of the feet on the ground a probe finds,
and nowhere indoors, in a town (the mod's "illegal to camp" line), with
enemies near (DFU's resting AreEnemiesNearby), in water, or - for a
tent - underground (Mac: "campfires in dungeons/outside"). Four camps
an owner. The fire is TEXTURE.210 record 1 on the lights archive's
twelve frames a second with a point light over it, and it burns eight
world-clock hours from the lighting; a tent's fire can be stoked (a
rest will), a kit's cannot, and a kit's camp is swept when its fire
dies while a cold tent stands. Within four metres of a lit fire you
are BY it - the needs law's warmth and drying, and SURV4's sleep.

Under the one activation ray (the race takes it, at 3.2) Info and Talk
name the camp and any other mode opens a list picker: rest here, cook
food (the raw fish and meat, cooked a stage nearer fresh in half an
hour, a quarter with a skillet; offline the minutes pass), stoke a
cold tent, and pack up your own (or put out your own fire). The water
sources are the mod's list - the fountain and well flats (212: 0, 2,
8, 9; 85: 0), the dry fountain (212: 3, which only says so) and the
three trough models (41220-41222) - under the same ray, filling every
skin and quenching the thirst. Both inventory skins close and hand a
placeable to the host's ground, and a host with no ground says so.

Online, two doors. In a CELL (the open world) my camps ride my full
foes frame (`c`) and a peer's arrive with theirs - validCampRecord is
the door, an owner's word replaces that owner's alone, and an owner
gone quiet is swept as their puppets are: a tent lives while its owner
does, which is the cell's law for everything its players stand. In a
WORLD ROOM (a dungeon) a placed fire goes out as an act beside the
doors and the loot, and the room's memory carries every camp standing
with its owner - a fire one player lit is lit for the next, as a door
stays open. Outdoors a camp survives a building visit, goes with its
pixel and comes back from the scene cache (which had been dropping
HT1's torches at that door since HT1, fixed here) and rides the save
in natives.
