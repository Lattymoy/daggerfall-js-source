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
loss, four mod-message calls a round into a mod the port does not
carry, and everything static.

## What the port built

| Slice | What | Where |
|---|---|---|
| SURV1 | the model: felt temperature, five needs, food and water, one entry of stat drains | `src/systems/survival/temperature.js`, `needs.js`, `food.js`; the world-minute hook in `worldTick.js`; the record on `entity.survival`, saved |
| SURV2 | the items: templates 530-541, minting, spoilage, the use handlers, the general store's provisions, the starting kit, the corpse's meat, the mod's icons through a vendor-only archive | `survival/items.js`, `loot.js`, `switch.js`; `itemTemplates.js` custom rows; `textureReplacement.js` vendor art; `useItem.js`, `shopStock.js`, `equip.js` |
| SURV3 | camps: the tent and the fire as placed objects with a menu, cooking, the water sources, shared online | `survival/camp.js` (the law), `scenes/camps.js` (the pool), the three hosts' mounts, `player/activationRace.js`, both inventory skins, `sceneCache.js` |
| SURV4 | the rest law: a bed or a fire sleeps whole, the window alone is rough - half the hour, the roll twice, a stiff morning; the felt temperature can refuse the sleep | `survival/rest.js` (the law), `scenes/shared.js` createRestDeps (the composed hour and the kind), `encounters.js` (the second ask), the four hosts' `restKind` |
| SURV5 | what the player is told: the HUD's needs strip, the status page's third box, the survival items' info box; the mod's regional tavern menus with the meal, the drink and the blackout | `survival/status.js`, `survival/tavernMenu.js`; `ui/enhancedHud.js` + `enhancedStyle.js`; `itemInfo.js`; `ui/tavernWindow.js` + the interior host's hooks; the four hosts' status chain |
| SURV6 | hunting, foraging and the water search as real-time events: the wilderness roll, the Yes/No box, the busy page, the finds and the harms, the hunted | `survival/hunting.js` (the law), `ui/huntWindow.js` (the three pages), `scenes/hunting.js` (composed), the overworld host's `createHunting` bag and its minute tick |
| SURV7 | the feed: the four hosts say where the player stands and the minute law runs in every mode; the rest gate on DFU's seam; the needs aligned at a load and an arrival; fast travel charged; the records | `survival/env.js` (the feed, the gate); `scenes/shared.js` createPlayerTicker's `survivalEnv`; the four hosts' readers; `save.js`'s load arm; `worldTick.js` tickPlayerMinutes' `survival` |

### The temperature (SURV1)

`feltTemperature(env, worn, ctx)`: the natural temperature is the
climate's own (Desert 40, Desert2 50, Subtropical 30, Rainforest 20,
Swamp 10, Woodlands -10, Haunted -20, Mountain Woods -30, Mountain
-40) plus the month's swing (-20 in Morning Star, +20 in Mid Year),
the hour's (evening and dawn -10, the small hours -20, times 3-4 in
the deserts and 2 in the mountains) and the weather's (overcast -8,
fog -5, rain and snow -10, a storm -15, the sandstorm +5); indoors
half the climate and season with no sky or hour, underground no hour
or sky and then the dungeon correction (toward -20, so a felt of
-20..+5 for the naturals the world reaches). Resistance is
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
taxes, then stats, then health at 120 - SURV-THIRST1's departure: the
mod asked for heat too and the port does not); sleep tired 4, drowsy 8,
exhausted 12 (the debt grows past sixteen hours awake; a bed pays 1.5
an hour, a rough rest 0.5 and never below tired); wet damp 5, wet 30,
soaked 100, drenched 200. Heat and cold charge fatigue by the band (16
units per 20 degrees), build an exposure drain past 30, and cost health
past 50; bare skin in the cold, bare feet, the sun on bare skin and wet
metal all have their lines. The drains are one `activeEffects` entry
of kind `survival` rewritten each minute, never a duration, capped so
no stat goes under five.

### The items (SURV2)

> **AUDIT VC6 (2026-09-18) - THE CORPSE'S FOOD ROLLED ON NOBODY'S
> STREAM, AND ON A LUCK NOBODY HAD.** Chased down from a city-guards
> pin that failed one run in eight. The three pools that raise a death
> (`cityGuards.js`, `exteriorFoes.js`, `dungeonContext.js`) handed
> `raiseEnemyDeath` an entity and nothing else, so this handler - which
> ROLLS - fell to `Math.random`: about fifteen per cent of humanoid
> kills grew one or two items nobody could predict, while
> `spawnEnemyLoot` three lines away was already taking the pool's own
> stream. And the luck it rolls against came from
> `setSurvivalPlayerReader`, **which had no caller anywhere in the
> tree** - `_player()` answered null at every kill, every player in the
> game rolled at luck 50, and the whole of the mod's luck term was
> dead. The reader is deleted, because a seam that looks wired is worse
> than one plainly absent, and every pool hands its own stream and its
> own player's luck. Pinned on all three call sites and driven through
> the live handler (`test/surv2_items.test.js`), 6 mutants.


The mod's templates as the port's custom rows above DFU's 288
(`registerCustomTemplates`), every reader through `templateByIndex`:
Camping Equipment (50 uses), Rations (250 minutes, stackable), Apple
and Orange (60, and ten off the thirst), Bread (180), Raw Fish (90,
raw), Cooked Fish (200), Meat (240), Raw Meat (100, raw), the Waterskin
(two kilos of water that weigh what they are; a drink is a tenth of a
kilo, a twentieth of the skin), the
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
sources are the mod's player-facing list - the fountain and well flats (212: 0, 2,
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

### The rest (SURV4)

Where you sleep decides what the sleep is worth (`survival/rest.js`).
A BED - a rented room, your own house, your ship - and a CAMP - within
four metres of a lit fire - are the sleep: the rested hour pays DFU's
whole recovery (scenes/shared.js's restVitals, still the one home),
the sleep debt clears at one and a half hours an hour, the night is
the night. Everything else is ROUGH - the rest window opened on a
dungeon floor, a hillside, a guild hall's boards - a last resort that
costs: the hour keeps half of what DFU's hour gained (floored, and an
hour that took some back never reports "healed"), the debt pays down
at half an hour an hour and never below tired, the resting encounter
roll asks the minute's decision twice (`encounters.js`, the first
spawn taken), and you rise stiff - four hours of speed and agility off
the survival entry, said once on the window's close. The kind is read
at the window's OPEN by the host that knows where it stands (the four
`restKind` deps: the exterior hosts and the dungeon ask the camp pool,
the interior asks its rental record), rides the entity as
`entity.restKind` for the needs law's `sleeping` and the roll's
`roughRest`, and with the mod off every rest is DFU's bed. Online the
same law under RESTX2's real-time pacing: a fire or a bed is a short
real wait for a full restore, the window alone the same wait for half
of one and a stiff morning.

The gate: too cold to sleep (freezing or worse) without a fire or a
roof, too hot to sleep (scorching) anywhere - `restBlock`, installed
on DFU's own RegisterPreventRestCondition seam by
`installSurvivalRestGate` with the host's felt-temperature reader
(SURV7 wires the reader - `survival/env.js` installSurvivalGate, one
install per ticker and per dungeon context, the felt word off the
record and the fire and the roof off the host's env; a reader that
answers null is a host that does not own the mode and says nothing,
and a torn-down dungeon takes its pair off the seam - AUDIT SURV).

### What the player is told (SURV5)

The enhanced HUD carries a NEEDS STRIP under the effects
(`survival/status.js` survivalHudChips): one chip a felt need - Peckish,
Hungry, Starving; Thirsty, Parched, Dehydrated; Tired, Drowsy,
Exhausted; Damp to Drenched; Hot, Scorching, Cold, Freezing, Deadly
cold; Stiff; Drunk - warn or danger by the stage, nothing while every
need is met, gone with the switch. The felt temperature rides the
record (`s.felt`, written by the minute law) so the strip reads no
env. The status key's chain gets a THIRD box after DFU's two (the
mod's AdviceText reborn): one line a need in the mod's own words ("You
could do with a decent meal.", "You are invigorated from your last
meal."), the stiff morning, the drunk bands (past half the endurance
"drunk", past the endurance less ten "very drunk"), and a vampire's
one line "You have no need for food or sleep." - the four hosts chain
it. A survival item's info box is built tokens, like the potion
recipe's (the custom rows have no TEXT.RSC record): the name, the
weight, a food's worth and stage and rawness, a skin's water, the
gear's uses, the skillet's word.

### The tavern (SURV5)

Climates & Calories replaced DFU's eleven-line food-and-drink list
with regional menus (read off the DLL: six keys - n, ne, se, s, b, o -
picked by region with a climate fallback, three price tiers a key, a
breakfast list, separate Food and Drinks buttons). The port keys the
same dishes by CLIMATE (`survival/tavernMenu.js` MENU_KEY_BY_CLIMATE -
the mod's region switch is not recoverable whole from the IL), tiers
by the tavern's quality (under 6 low, under 13 mid, else high), serves
breakfast from six to ten inclusive, refuses food before six in the
mod's two words (at five "Sorry, breakfast starts at dawn.", earlier
"Sorry, the kitchen is closed for the night.") while the drinks pour, and folds food and drink into the ONE picker DFU's Food
button opens, a header between (TVRN00I0 has four buttons and no
room for the mod's fifth). A meal takes half an hour and banks its
worth against the hunger marker on the mod's own law (too full under
the worth - "The rest goes to waste.", charged; four hours back past
worth + 240; the worth banked). A drink takes a quarter hour, quenches
forty of thirst, and counts by its kind - milk, tea, juice and coffee
nothing, an ale ten, a wine twenty, a spirit thirty-five - against the
endurance: past half "You are getting drunk...", past ten under it
"You are very drunk...", past it the BLACKOUT: the night passes to six
(the interior's ticker; online the clock stands, WORLD5), the counter
falls to a quarter of the endurance, and the morning is a rough one
(SURV4's stiffness). The counter sobers one a ten minutes and drains
the stats the mod's way (SURV1). With the mod off the Food button is
DFU's own chain, unchanged.

### The hunt (SURV6)

Climates & Calories' Hunting class (read off the DLL: HuntingRound
once a game minute - not paused, no enemies nearby, not night, not in
a location rect, not inside; the luck mod against Random(1, 200), or
300 in winter, then Dice100(70); HuntCheck's climate switch to five
rolls, each a Yes/No box; TimeSkip an hour; the checks by bow -
Archery, and Stealth for the sneak - or bare hands - Stealth and
Critical Strike; GiveRawMeat / GiveApples / GiveOranges / RefillWater;
InflictPoison on a bite; SpawnBeast) is restated in
`survival/hunting.js`, pure. THE ROLL (`huntRoll`): outdoors in the
overworld, off the widened town rect, by day, no foe near, not resting
or fast travelling, in a climate the mod hunted (the desert pair, the
subtropics, the swamp pair, the woods pair, the mountain pair), the
odds the mod's plus one (its roll is Random(1, 200) - luckMod < 1; the
road-following arm it asked TravelOptions for is not carried), and a cooldown of Random(100, 500) minutes riding
the survival record as `huntAt` (saved with it). Each climate has two
events on a coin: the desert's greener vegetation (WATER) or its rocks
(a snake); the subtropics' water or trees (FRUIT); the swamp's birds
or a ripple (a LIZARD); the woods' and the mountain's birds or fresh
TRACKS (deer or goat, rabbits). THE OUTCOME (`huntOutcome`): a first
d100 sorts the water by pool (a safe pool fills five kg, a small one
two, a smelly one nothing, a foul one one kg and the meal's three
curable diseases, else dust) and the fruit (easily picked, a climb by
Climbing, a strange fruit that poisons, none left), and past 90 - 95
among the rocks - says "You are not the hunter, but the hunted!"; the
bow's shot and the sneak, the hands' strike and the tree's climb are
the live skill plus the luck mod less five against Random(1, 100).
Meat by the prey (a snake one, a bird one or a volley's two or three,
the lizard two, a rabbit one, a deer or a goat four to six), a bite
that may be poison (any of the twelve, the mod's Random(128, 140)),
the woods' boar (ten fatigue) and the mountain's fall (one to four
health, never to death). THE HUNTED stands the mod's SpawnBeast table
(Random(0, 11): under 2 three, under 4 two, under 9 one, else the
alternate dragonling - scorpions in the desert and the subtropics, a
bear then spiders in the swamp, bears then a spriggan in the woods,
sabre-tooths on the mountain). `applyHuntOutcome` mints the finds into
the pack (raw meat; apples or oranges on a coin), fills the skins
(refillSkins; "You have no waterskins to fill." when none), and hands
the harm to the handlers the host passes (poisons.js inflictPoison,
diseases.js inflictDisease - the leaf imports neither, as the meal's
law does not).

THE OVERHAUL (Mac: "hunting and foraging as real-time events"): the
mod skipped the clock an hour behind a box. The port's window
(`ui/huntWindow.js`) has three pages in the overlay slot: ASK, the
mod's Yes/No box on DFU's own ServiceFlowWindow (Y, N, Escape, the
buttons); BUSY, a real-time page - the search's Random(30, 60) game
minutes run at HUNT_WAIT_PER_HOUR (eight) real seconds an hour under
the overlay's `tick(dt)`, a row of dots for the wait, no key or click
taken (the hunter is committed); RESULT, the outcome's lines and the
gains in a click-anywhere box. The outcome is rolled and applied ONCE,
at the turn from busy to result; the search's minutes pass on the
clock offline (the host's ticker - the survival minutes with them) and
online the clock stands (WORLD5) so the wait alone is the cost; the
skills the search used are tallied. The beast stands when the box
CLOSES, not under it - a foe keeps its clock under a window (WINFOE1)
and would have had the first blow free - through the overworld host's
own encounter placement (`_standEncounterFoe` on the wilderness arm,
one call a head). `scenes/hunting.js` composes it for a host from
readers (`env()`: the minute, the climate, luck, winter, outdoors,
the rect, night, foes near, resting, the bow in hand, the four skills)
and doors (the slot, the ticker, the placement, the two formulas, the
tally); it asks once a game minute and never under a window or while
its own is up. world.js alone stands it - exterior.js lives inside the
town rect and would never roll. Wildlife meat is SURV2's corpse law:
the beast that hunted you carries it when it falls.

### The feed (SURV7)

Every host owes the minute law the same question - where does the
player stand? - and none of them owes the answer's other half, which
is the body's. `survival/env.js` splits them: the host hands a reader
(`survivalEnvNow` in world.js and exterior.js: the pixel's or the
location's climate, the month and the hour off the one clock, the
weather word, the mode's roof or floor, the sun by day under a clear or
cloudy sky, swimming, riding, a lit fire within reach, resting and the
sleep's kind off the entity, the lycanthrope's state and the live fire
and frost resistances) and `survivalFeed` builds the rest from the
entity - the equip table's slots as the worn items, the race's
tolerance flags, the vampire - into tickPlayerMinutes' `survival`
argument (worldTick.js runs the minutes it crossed, two days at most,
so a fast travel charges what a jump can - the skins and the rations
answering by themselves). The mode machine's interior ticker takes the
outer host's reading with the roof it owns (sheltered, no sun, no
water, no fire); the dungeon's own tick takes it with the floor it
owns (timeless underground, its own fire on the floor); the standalone
dungeon scene, with no outer host, reads the clock itself. THE REST
GATE (SURV4's restBlock) goes on DFU's RegisterPreventRestCondition
seam once per ticker with the same reader - the felt word off the
record's last reading, the fire and the roof off the env - so "too
cold to sleep" is asked by the same seam that asks "there are enemies
nearby". THE ALIGNMENT (WORLD5's law for these markers): the load arm
under the shared clock aligns the needs to the world's time from the
save's own clock (a day or more away starts fed, watered and rested;
an hour away keeps its hunger), and the online arrival resets a record
from further along than the world. With the mod off the feed is null,
the gate answers nothing, and DFU's tick is DFU's.

### The audit (AUDIT SURV, 2026-09-18)

Mac: "Let's audit everything so far". Five opus agents read the arc -
the pure laws, the wiring walk, the player-facing surfaces, the tests
and records, and a runtime probe in Chromium (the game data is not in
the container, so the probe drove the arc's modules, the real ticker,
the rest deps, the tavern and hunt windows and the enhanced HUD on the
front door, not the 3D scene). What they found, all fixed and pinned
(`test/auditsurv.test.js`, `tools/mutants/auditsurv.json`):

- THE HARMS KILLED A STARTING CHARACTER (E, blocker). The bare-feet
  arm took a point of health every game minute past |felt| 25 with no
  floor, the exposure arm a point or more a minute past 50, and both
  ran through a rough sleep - a chargen character (short shirt, casual
  pants, no shoes, 25 health) died in two hours on a clear winter
  afternoon and a legal rough rest took 480 health a night. Now: bare
  feet cost fatigue (DRAIN.bareFeet a minute), the naked-cold and
  sunburn arms hurt once every ten minutes and never below five
  health, exposure past DAMAGE_AT hurts once every ten minutes and
  never in your sleep (the gate refuses the freezing and the scorching
  night), and no bare-skin arm runs while resting or asleep. The heat
  and cold fatigue band fell from 16 to 6 a minute (a chilly night by
  a fire emptied the pool in seven hours).
- THE KIT NEVER REACHED A CHARGEN CHARACTER (E, blocker): the
  provisions rode the retired pre-chargen seeder alone. Now
  `startingGear.assignStartingGear` adds them after the spellbook.
- A DUNGEON REST PAID ITS NIGHT AWAKE (B, blocker): the dungeon's
  `_restAdvance` ran no needs, and the frame after the window paid
  the whole night with `isResting` false, so a night by a dungeon fire
  RAISED the sleep debt. Now `_restAdvance` runs the survival minutes
  with the sleep's kind, and the record's own marker (`s.lastMinute`)
  keeps the frame from paying the span again.
- THE REST GATE LEAKED (B, C, D): two handlers per dungeon entry and
  none ever unregistered, so a dead dungeon's handler refused the
  outdoor fire. Now a reader that answers null says nothing (the
  world's under a dungeon, the interior's outdoors), and the dungeon
  context unregisters its pair at the teardown.
- THE CAMPS (B): the streaming sweep destroyed a placed camp and only a
  teleport's scene cache brought it back - the sweep spares them now
  and the cache carries none (the pool is the truth, the save envelope
  carries it, a restore merges by id); packing the last camp never
  reached peers (an empty `c` says "none stand"); the pool stands
  nothing with the mod off; a relay clock correction re-aligns the
  needs.
- THE LAWS (A): a rough nap raised a rested sleeper's debt to tired
  (the floor clamped upward); the rust arm wrote a phantom
  `condition` field; food aged from the world's first rot-day, not its
  own (every food spoiled overnight past the third month - items are
  stamped on their first day now); the drink paid +20 Personality
  (now +1..+5); the well-fed tally banked minutes as points (now a
  point of fatigue an hour spent fed); spent camping gear pitched for
  ever (refused at zero); a hood shaded below nothing; the survival
  stat entry outlived the switch (the tick with no feed clears it);
  the temperature notes had their own bands and said three lines
  every five minutes (the strip's words, once each).
- THE SURFACES (C): a hunt window dropped from under (a death screen)
  never ran its close hook and killed hunting for the scene
  (`dispose`); Escape now abandons the search; the result page is a
  click-anywhere box, not a raw-key one; the last dot draws; the
  Drinks divider closed the tavern (a header pick keeps the picker);
  the five o'clock tavern refused the drinks the law still served
  (now the mod's two refusals, then the drinks); a vampire's strip
  said Starving; the HUD's drunk band was a hard forty; the enhanced
  card never showed the survival tokens; an empty strip cost the
  bottom row a gap; the weight word was `kg` where DFU says
  kilograms; the cook line named the cooked item; the Thirsty chip
  blinked (the skin now answers at the stage); the quickslot wear
  track was an invalid SVG path logged every HUD build.
- THE RECORDS (D): the tavern kitchen hours were misread off the DLL
  (fixed above); the README counted eighteen textures (twenty); the
  save's record round-trip was pinned by nothing (now it is); twenty
  citations under-shifted by citeShift re-aimed by content; the odds,
  the mod-message count, the dungeon band, the drink's fraction and
  the water list reworded here; the mod's feature row now carries
  `'mod'` and the author's name.

The review of the shots (Mac): the enhanced card's survival rows now
wear their own words (Food, Raw, Uses, Cooking) and carry no condition
row (a food's keeping and the gear's uses are their own tokens); and
"hide Wear for non-wearables, Use for non-usables" - `localPrimaryAct`
asks the equip table for a slot and offers no Wear where none would
take the item, and `useItem.js` `usableItem` (the ladder's arms
restated as a predicate) decides the Use button on both sides of the
pack. Both pinned in `test/auditsurv.test.js`.

Not driven (no ARENA2 in the container): the 3D fire and tent, the
activation ray, the inventory windows in situ, dungeon-floor camps,
online camp sharing. The probe's scripts and screenshots are in the
session scratchpad, not the tree.

## AUDIT-DEATH1 - DEHYDRATION KILLED NOBODY, BECAUSE NOTHING KILLED ANYBODY (2026-09-19)

> Mac: *"You should also should die on dehydration and sometimes get
> stuck at 0% health and live"*, with a dungeon screenshot: **Dehydrated,
> FATIGUE 0%, HEALTH 0%, still playing.**

Two complaints, **one bug**, and it is not in this arc's code at all.

**The chain works.** Dehydrated (thirst 100+) taxes 12 fatigue units a
minute (`DRAIN.dehydrated`). Fatigue reaches nought. That raises
`onExhausted`, and `exhaustionOutcome` (systems/rest.js) answers `rest`
with dry feet and no enemies near - an hour's collapse, health back -
or **kills** near enemies or in water. So dehydration does kill; it
kills through the collapse, which is DFU's own route.

**What broke is the death itself.** `hurtPlayer`
(characters/playerEntity.js) raises the death presenter on the
TRANSITION - `wasAlive && entity.health === 0` - so a caller that writes
health directly kills the player and tells nobody: no DeathScreen, no
end of run, a corpse walking at 0%. `dungeonContext.js` wrote

```js
playerEntity.health = 0;   // SetHealth(0): the fatal collapse
```

while `world.js`, `exterior.js` and `worldModes.js` all wrote

```js
hurtPlayer(playerEntity, playerEntity.health, { bypassShield: true });
```

It was the last raw writer in the tree, **in the one host that owns the
DeathScreen**, and ninety lines above its own bug sits the note that
names the trap exactly: *"it was the only one of the four writers that
checked for death, which is exactly why the other three could go on
writing health raw and nobody noticed."* The presenter was centralised;
this host's own call was not moved with it.

`bypassShield` is the SetHealth(0) door's own flag - no shield pool
stands between a player and a lethal collapse - and dropping it is a
second, quieter bug, so the mutation campaign carries it.

**The pin is sliced to the collapse's own branch**, not the file: the
dungeon host also drowns the player through the same door two thousand
lines away, and a file-wide grep passed on THAT call while this one was
mutated back to a raw zero. `tools/mutants/audit_air1.json` carries
three DEATH1 records; 7 mutants, 7 dead.

## SURV-THIRST1 - WATER IS NOT A CLIMATE (2026-09-19) - A DEPARTURE

> Mac, asked whether the heat gate should stay: **"Do the thirst
> change"**.

The audit above named this as the one thing it would not change without
being told, because it is not a defect - it is Climates & Calories'
actual law, and this file recorded it: *"fatigue taxes, then stats, then
health in heat"*. The mod bleeds you for thirst only when
`temp.felt > NEED.EXPOSURE_AT`, so a cool dungeon taxed fatigue for ever
and never a drop of blood. **The port departs.** A body past dehydrated
fails wherever it stands.

**Measured, before and after**, walking a clothed 25-health character
with no drink (the bare-skin harms are dressed away, so this is thirst
alone):

| | dehydrated | first blood | dead |
|---|---|---|---|
| cool dungeon, the mod's gate | 6.0h | **never** | **never** |
| cool dungeon, SURV-THIRST1 | 6.0h | 7.3h | **9.2h** (46 real min) |
| desert afternoon, the mod's gate | 0.9h | 0.2h | 1.3h |
| desert afternoon, SURV-THIRST1 | 0.9h | 0.2h | 1.5h |

**HEAT STILL KILLS YOU FASTEST, through the mod's own mechanism rather
than a second rule.** The thirst RATE already scales with the felt heat
(felt 40 is four times as fast), which is why the desert reaches
dehydrated in under an hour and the cellar takes six. What heat no
longer buys is a separate, harsher damage law.

**The shape is AUDIT SURV E's, not a new one.** That audit established
that a harm which can kill comes on the HARM TICK and not every minute -
*"a starting character walked a clear winter afternoon and died in two
hours"*. The old thirst line ignored it and fired sixty times an hour;
carried straight into cool weather it would have taken a starting
character out in twenty-five game-minutes. So the new harm:

- comes every `HARM_EVERY_MINUTES`, like exposure and the bare-skin harms;
- escalates off how far past the threshold you are, as exposure escalates
  off how far past `DAMAGE_AT` the temperature is - 1 a tick at 120, 4 at
  the 150 ceiling;
- takes **no** `HEALTH_FLOOR`, because the bare-skin harms leave the last
  five points precisely *because* they are not meant to kill, and this
  one is;
- and is refused **asleep or resting**. Nothing in `systems/rest.js`
  refuses a rest for thirst, so a sleeper who cannot wake to drink would
  be killed by a window the game let him open.

`NEED.THIRST_HARM` (120) is the number the mod's own heat-only line
used, kept rather than invented: twenty past dehydrated, which leaves a
player game-hours of `Dehydrated` warnings before the first blood.

**The one cost, named:** in heat the harm is now gentler per tick
(1-4 every ten minutes, escalating) than the flat 1-a-minute it
replaced, so a desert death takes 1.5 game-hours where it took 1.3. That
is the price of one rule instead of two, and the rule that remains is
the one AUDIT SURV E wrote.

### THE AUDIT BEFORE MERGE - AND THIS DEPARTURE'S OWN REGRESSION

The slice shipped green and killed the player on arrival from a fast
travel.

`playerTicker.advance` (scenes/shared.js) runs the SAME tick with a
fabricated dt - "DFU's clock and its per-minute laws are the same loop,
so a rest, a training session and a fast travel all owe the world those
minutes" - so `runSurvivalMinutes` REPLAYS every minute a clock jump
crossed. Six game-hours is thirty-six harm ticks inside one frame.
Measured, a dressed 25-health character leaving with thirst at **zero**:

| jump | damage | arrives |
|---|---|---|
| 6h | 86 | **dead** |
| 12h | 230 | **dead** |
| 24h | 518 | **dead** |

Under the mod's heat gate this could not happen in a cool climate, so
the departure is what introduced it - and no warning ever reached the
player, because thirst had been nought when they set out.

**The fix is the walk, not the harm.** `runSurvivalMinutes` marks every
minute but the LAST as a `replay` (one object mutated for the whole
walk, not one per minute - the loop runs up to `MAX_CATCHUP_MINUTES`
times, and EV2's rule holds here as anywhere). A replayed minute may
wound only to `HEALTH_FLOOR`; the last minute is the one the player is
standing in, and that one may finish them. So a thirsty journey lands
you at death's door and the next minute you do not drink is the one
that kills - the behaviour asked for, without the arrival being a coin
flip. A longer jump now costs no more than a shorter one, because the
floor is where the replay stops whatever its length.

**PRE-EXISTING AND NOT CHANGED, named so it is a decision:** the
temperature harm (`abs > NEED.DAMAGE_AT`) has the same shape and the
same exposure to a replayed jump, in a desert or a deep winter where it
bites at all. It is older than this slice and outside what was asked
for; if it is to take the same floor it wants its own pass.

`tools/mutants/surv_thirst1.json`: 10 mutants, 10 dead - the heat gate
back, the per-minute cadence, the health floor, a flat rate, death in
your sleep, the threshold dropped to dehydrated, and four on the walk
(a jump lethal again, the replayed bite unclamped, every minute live,
every minute a replay).
