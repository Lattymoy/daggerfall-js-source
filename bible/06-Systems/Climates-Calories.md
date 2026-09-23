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

> **SURV-TIERS (2026-09-23): THE ARC IS PLAYED AT ONE OF THREE TIERS -
> OFF, CASUAL (the default) and HARD.** Everything from here to
> SURV-TENT describes HARD, the arc at full strength and unchanged to the
> number (but for the laws both tiers share that the two AUDIT
> SURV-TIERS passes fixed). CASUAL is the same world - every clock, stage, item, camp,
> menu, hunt and word below - with five rules on what it COSTS: stamina
> only, only at the stages the HUD paints red, lent down to half the pool
> at most and repaid when the need is met, nothing refused, nothing
> rolled against the player and nothing wasted. The design, the table,
> Off, the stored values and the audit are in **SURV-TIERS** and **AUDIT
> SURV-TIERS** at the end of this page.

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
| SURV-TIERS | Off, Casual (the default) and Hard on the one key: the tiers as data, every charging law reading its tier's rules, Off stored as the old switch's own `false`; AUDIT SURV-TIERS: the loan, a rest is a rest, the house's order, Off keeping the camps and the place, four laws Hard shares | `survival/difficulty.js` (the table, the stored values), `survival/switch.js` (`survivalTier`, `survivalRules`), the laws (`needs.js`, `rest.js`, `food.js`, `hunting.js`, `tavernMenu.js`, `temperature.js`), the compositions (`env.js`, `scenes/shared.js`, `scenes/hunting.js`, `scenes/camps.js`, `useItem.js`, both tavern windows), `encounters.js` (the asks), `uiPrefs.js` (the load), the four hosts' `restKind`, the Features row |
| SURV-KIT | the new character's kit in every tier, Off's included: both mints stop asking the switch | `startingGear.js` `assignStartingGear` (chargen's two paths), `equip.js` `seedStartingEquipment` (the pre-chargen fallback) |

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
row) - on in both Casual (the default) and Hard, gone in Off
(SURV-TIERS) - but the new character's kit, which every tier packs
(SURV-KIT).

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

### The world's own fires (HEARTH1)

Mac, 2026-09-19: *"Does this version of C&C not let you use braziers as
extra campfires to cook from?"* It did not, and that was a gap rather
than a rule. `byFire` looked at exactly one pool - camps somebody had
PLACED - so every brazier, fire bowl and tavern hearth in Daggerfall was
a sprite and a point light and nothing else: a player standing over a
roaring brazier was as cold, as wet and as roughly rested as one
standing in a field, and had to burn a Campfire Kit two feet from it to
cook a fish.

`survival/hearth.js` is the law, and it is mostly its own exclusions.
Three archive-210 records are a fire you can stand over - 0 (bowl with
fire), 1 (the flame a camp itself stands, so a block that places one is
placing a campfire) and 20 (the brazier torch). Everything else in the
lights archive is out: the fourteen candles, lanterns and chandeliers
obviously, the eleven records DFU's own `AddLight` switch leaves as
unnamed "todo" arms for want of evidence, and - the one worth writing
down - the two WALL TORCHES (6, 17). Those are a real flame, and they
are excluded because they are bracketed at head height: counting them
would make every lit corridor in every dungeon a kitchen and every
torchlit street a campsite. A fire you cook on is one you can stand
over.

All four hosts collect their own, off walks they were already doing.
The two exterior hosts split theirs out of the lantern list
(`collectCityLights` carries the texture record now, in both its arms);
the dungeon reads its own flats, because a dungeon's lights are RDB
Light RESOURCES with no texture at all; the interior takes the list its
context built. The streaming host's are pixel-local and ride the
floating origin like every other coordinate it carries, and its walk is
cut at `HEARTH_NEAR` (16 m), which clears both questions the pool is
asked.

What a hearth IS: `byFire` - the fifteen degrees of warmth, the drying,
and SURV4's sleep, so a rest by a brazier is a camp's rest. And a target
under the activation ray at a camp's own reach, whose box reaches DOWN
as well as up because the position is the flame and the bowl is under
it; Info and Talk name it, and every other mode opens the cooking list.

What it is NOT: a camp. `campAt` still answers with camps alone, because
the menu, the packing and the online record all key on a camp record and
a brazier has none - it is nobody's to pack, stoke or put out, and it
does not burn down, so the cooking list skips the embers test a camp
needs.

The INTERIOR host is the one that changed shape. It has no camp pool and
may not have one (the mod refuses to pitch or light indoors), and its
survival reader had said `byFire: false` outright since AUDIT SURV B -
correct while a camp was the only fire the law knew, and wrong the
moment a tavern's hearth counts. It carries a pool now that can never
STAND anything: `place()` says `insideBuilding`, which is the camp law's
own refusal, and it is handed no texture door to mount a fire with. It
exists for two answers - `byFire`, and the ray's cooking list - and its
fires leave with the room on every way out.

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
the interior its rental record and then its own hearth - AUDIT
SURV-TIERS), rides the entity as `entity.restKind` for the needs law's
`sleeping` and the party pose (the roll takes the rest's ASKS since
SURV-TIERS, `entity.restAsks`), and with the mod off every rest is priced
as DFU's bed. Online the
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

## SURV-ART - THE ART NEVER REACHED THE SCREEN (2026-09-19)

Mac: *"the sprites aren't showing at all"*.

Sixteen of the mod's twenty PNGs are vendored at
`vendor/climates-calories/Textures/`, registered at boot by
`installSurvivalIcons`, fetched and decoded. They drew NOTHING. Both of
the port's icon doors dropped them on the last step, and each did it in
its own way - which is why nothing in the suite noticed: every pin the
SURV2 work wrote held the registration, the decode and the addressing,
and all three were correct.

**THE GL DOOR** (`ui/itemScroller.js`, `ui/nativeInventory.js`) asks the
pipeline for the archive and then gates on

```js
if (img.record < tex.recordCount) {
  icons.uploadRecord(img.archive, img.record, ...);
  sizes.set(key, tex.getSize(img.record));
}
```

For a vendored archive `getTexture` hands back `vendorTextureStandIn`,
and that object carried `getWidth`, `getHeight`, `getDFBitmap` and
`getColor32` - but neither `recordCount` nor `getSize`. So the gate read
`0 < undefined`, which is FALSE for every record of every vendored
archive, and the upload it guards never ran: no texture, no size, and
`if (!glTex || !size?.width) return false` a few lines later drew
nothing. A stand-in for a file must answer like the file. It now
carries `recordCount`, `getSize` (with `TextureFile.getSize`'s own
out-of-range answer), `getOffset`, `getScale` and `getFrameCount`.

`vendorRecordCount` reads the REGISTRY, not the decoded map. The
pipeline builds the stand-in inside the same await that preloads, and a
PNG still in flight - or one that would not decode - must not shrink
the archive underneath the caller about to ask for its record; that
reads as "no such record" and is this bug again by another route.

**THE DOM DOOR** (`ui/textureCanvas.js` `requestIcon`, which the
enhanced HUD's quickslots and the enhanced inventory's tiles both draw
through) had no vendor arm at all. It went straight to `getArchive`,
which fetches `TEXTURE.539` - a file that does not exist, for an
archive that is only ever the port's own art - warned, and cached the
failure as a PERMANENT miss, so every repaint after it drew the
two-letter initials fallback. The arm now stands FIRST, before the
fetch that cannot succeed, and takes `decodedTexture`'s color32 shape
straight to a canvas through the new `color32Canvas`, because a PNG has
no palette index to look up and no cutout rule to apply - it carries
its own alpha.

`color32Canvas` REVERSES THE ROWS, and that is not incidental. The port
stores every texture in color32 order (row 0 the picture's bottom,
`formats/color32Order.js`); a canvas is top-down. Without the reversal
every mod icon in the DOM would have drawn upside down - SW4's fault
one door along, and pinned here so it cannot arrive.

**The pins** (`test/survart_icons.test.js`, 3) drive the real modules,
because a source-text pin would have matched the broken code too: the
first walks all sixteen through the GL door's own expression, the
second runs `requestIcon` against a canvas stub and reads the pixels
back out to check which way up they landed, the third holds both doors'
arms in place. Mutants: `tools/mutants/survart.json`, 5, 5 dead.

## SURV-TENT - THE TENT'S TWO RESKINS (2026-09-19)

Mac handed over the shipped zip, so the last two of the mod's twenty
pictures could be read out of the bundle rather than guessed at.

`src/formats/unityBundle.js` opens the `.dfmod` directly - it is a
UnityFS container - and all twenty Texture2Ds come out by name. Two
checks came with that, and both were worth running:

- **The sixteen already vendored are EXACT.** Every pixel of every one
  matches the bundle's own texture, size and orientation included. No
  SW4 here: `decodeTexture2D` reverses Unity's bottom-up rows on the way
  out, and whoever extracted them first did the same.
- **The two missing ones are the tent's.** `50_7-0` is a 32x32 tan
  canvas of three colours; `67_10-0` is a 64x8 dark wooden strip. The
  camp stands the mod's model 41606 (`survival/camp.js` TENT_MODEL) and
  these are how the mod dresses it - the mod ships no other model and no
  other override, so that is what they are for. Without them the tent
  wore whatever the base game put on that model.

**THEY ARE A DIFFERENT KIND OF VENDORED FILE, and that is the whole of
the work.** An icon's archive (532-539) exists ONLY as this art: there
is no `TEXTURE.532` and never will be, so the pipeline stands a shell
in for the file. `TEXTURE.050` and `TEXTURE.067` are real files
carrying dozens of other records, and these override ONE record of
each, the way a texture pack does.

`isVendorArchive` answered true if ANY record of an archive was
vendored, which was harmless only while every vendored file happened to
be of the first kind. Registering `50_7-0` under it would have sent
`TEXTURE.050` down the stand-in branch as well, and every other record
in that archive - every wall and floor drawn from 50 - would have come
back as a 1x1 nothing. The archive NUMBER cannot tell you which kind a
file is, so the registration says: `addVendorTextures` takes a
`standIn` flag, the icons pass it, the tent's two do not, and
`isVendorArchive` and `vendorRecordCount` both read it.

Pinned in `test/survart_icons.test.js` (the files, their sizes, that
the swap arm finds both, and that 50 and 67 are still fetched while 532
and 539 are not) and in the SURV2 icon pin. Mutants:
`tools/mutants/survart.json` grew three - the flag ignored, the tent
art registered AS a stand-in, and the tent art not registered at all -
8 in total, 8 dead.

**Still not imported**, and with nowhere to go: the two tavern menu
backgrounds (`RALZARTAVERN`, `BLANKMENU_TAVERN`). The port draws its
tavern menu in its own panel.

## SURV-TIERS - OFF, CASUAL, HARD (2026-09-23)

> Mac: *"So I want to talk about adding a new tab to climates and
> calories thats on by default. Something that introduces mechanics,
> leaves some out and is overall not a punished experience for
> players"*; then, of the tiers' names, *"Off, Casual, Hard"*; of the
> players already on it, *"Yes, but still let it be able to be turned
> off for online"*; of spoilage and the stamina cost, *"Your choice"*;
> and of the whole, *"I want this to be a smart and thorough difficulty
> design. No band aids"*.

**One key, three answers.** The `survival` pref was a boolean; it is a
tier: **Off** (the classic game - no needs, no items, no camps), **Casual**
(the new default) and **Hard** (everything above this section, unchanged
but for the laws both tiers share that the two AUDIT SURV-TIERS passes
fixed - below, "Where Hard moved, all told").
The Features tile's bar reads `Off | Casual | Hard`.

### The design: the same world, different stakes

Casual is not Hard with the numbers turned down. It is five rules, and
`src/systems/survival/difficulty.js` is those rules written out as data:

1. **Same world, different stakes.** The clocks, the thresholds, the felt
   temperature, the food and its spoiling, the water, the camps, the
   tavern menus and the hunt's events are the world's and identical in
   both tiers - so the HUD strip, the status page and every notice say the
   same things about the world, and two players on different tiers stand
   in one world online. Only what the body PAYS differs - and what it is
   owed back (rule 4), which is the body's too - with the few words that
   say what a tier did: a barkeep's or a kitchen's refusal, a loan repaid,
   a hunt's safe twin, a Hard morning's Stiff.
2. **Stamina is the only price of neglect.** Casual never takes an
   attribute, a point of health, an item's condition, a disease, a coin or
   an hour. The drink's attribute swing stays in every tier - it is chosen
   at a bar, with an upside, not a need left unmet.
3. **Red means it costs.** A need charges only at the stages the HUD
   already paints red (`status.js` `HUD_NEED_WORDS`): Starving; Parched and
   Dehydrated; Exhausted; Freezing, Deadly cold and Scorching. Amber is
   information. The rates are Hard's own (`needs.js` `DRAIN`) - once the
   body is in trouble it tires as fast in both tiers. Wetness and the
   drink are no needs: Drenched is red as a warning - it works through the
   felt temperature, in both - and the drink's swing is the drink's, from
   its amber Drunk on.
4. **Borrowed, not taken.** The needs may take stamina down to half the
   pool and no further - so on their own they can never raise DFU's
   exhaustion collapse, which kills a player with a foe near
   (`systems/rest.js` `exhaustionOutcome`), and a neglected player still
   has half a pool to fight and run with - and what a need took it gives
   back the moment it is met: a meal repays the hunger, a drink the
   thirst, a sleep the exhaustion, a warm place or a lit fire the cold.
   The floor is the NEEDS' share - DFU's own walking and running drain
   still runs below it, as with the arc off - and a loan is never more
   than the pool is short: whatever else refills the pool settles that
   much of it.
5. **Nothing refused, nothing rolled against you, nothing wasted.** No rest
   gate, and a rest is always a rest - nothing is charged while the player
   rests, the cold included, so a rest can always finish; no second
   encounter ask, no stiff morning, no sickness roll, no bite, fall or
   beast from a hunt, no blackout and no wasted meal. Where Hard has a
   harmful outcome, Casual has a DECLARED safe one in its place, read off
   the same rolls - the search is the same search, and the harm never
   lands.

What Casual keeps as the reason to engage is everything that was never a
penalty: a bed or a fire pays sleep debt three times faster than the rest
window; a cooked meal feeds more than a raw one and a fresh one more than a
spoiled one; a fed hour gives a point of stamina back; the items, the
kit, the shelves, the corpse's meat, the camps, the cooking, the water
sources, the tavern's menus and the hunt's finds are all there.

### The table

| | Hard (the arc as it stood) | Casual |
|---|---|---|
| Hunger | Starving: 4 fatigue a minute; -2 to every attribute a starving day, to -20 | Starving: 4 a minute, to half the pool - lent, and repaid by the meal |
| Thirst | Parched 6, Dehydrated 12 a minute; attributes past 100; health from 120 on the harm tick - it can kill (SURV-THIRST1) | Parched 6, Dehydrated 12 a minute, to half the pool - repaid by the drink |
| Sleep | Exhausted: 8 a minute; -2 / -5 / -10 to every attribute at tired / drowsy / exhausted | Exhausted: 8 a minute, to half the pool - repaid by the sleep |
| Heat and cold | from 20 felt either way, 6 per 20 degrees, resting or not (away from a fire); exposure lowers attributes past 30; wounds past 50 - it can kill, in the minute you stand in (a jump's replayed minutes wound to the floor, SURV-THIRST1's law) | only at the red words (Scorching past 50; Freezing and Deadly cold past -30), the same 6 per 20, to half the pool, never while resting and never beside a lit fire - repaid by a warm place or a fire |
| Bare skin | naked in the cold and the sun on bare skin wound (never the last five points); bare feet 4 a minute | the lines alone - the cold and the sun are already in the felt temperature |
| Wet armour | rusts, a point on a 5% minute | never |
| Food | raw, stale or worse risks a disease on a failed luck roll | no roll - Hard's lucky branch, every time; spoiled still feeds less, putrid still will not go down |
| The rest window | half DFU's hour; two encounter asks a minute; stiff four hours (-5 speed and agility); the debt never paid below tired; too cold or too hot refuses the sleep | DFU's whole hour; one ask; no morning; the debt paid down to nothing at 0.5 an hour (a bed or a fire pays 1.5); never refused, never charged |
| The hunt | bites that poison, a foul pool that sickens, a fall, a boar, the beast | each harm's safe twin - the same search on the same rolls, the same catch, no harm |
| The tavern | past the endurance you black out: the night passes and the morning is a rough one; a meal on a stomach too full for it is charged, takes its half hour and goes to waste (the mod's quirk) | the barkeep will not pour the drink that would carry the counter past the endurance, and the kitchen will not sell a meal to a stomach too full for it - both asked after the gold and before the coin changes hands; a soft drink always pours |
| The stamina floor | none: the needs can empty the pool, and the collapse is the cost (AUDIT-DEATH1) | half the pool |
| What a need took | kept - the pool refills only as it always did | lent - repaid the minute that need is met, up to the pool; whatever else refills the pool settles it |

Spoilage and the stamina cost were Mac's to hand over ("Your choice").
**Spoilage stays**, at the world's pace, because it is what makes the food
choices mean something - bread keeps, raw fish does not - and it was never
the punishment; the sickness was, and Casual has none. **The stamina cost
stays**, bounded and lent, because it is the one price that makes a need a
need without ever endangering the player: it is legible (the fatigue bar),
it comes back the moment the need is met (the loan, rule 4), and the floor
means it can never be what kills.

### Off

Off is the classic game - no needs, no chips, no gate, no roll, DFU's own
tavern list and rest hour - but it is a setting, not an eraser, and AUDIT
SURV-TIERS closed the ways it had been one:

- **The camps are kept, not burned.** The pool keeps every camp through the
  burn, the save, the scene cache and the wire, and hides them from THIS
  player alone (`scenes/camps.js` `shown`): no sprite, light, tent, ray,
  warmth or camp's rest. A camp kit used with the arc Off is refused in
  words - "Turn Climates & Calories on to make camp." (CAMP-SILENT's law:
  a refusal the player cannot see is a bug report nobody can act on).
- **Its minutes are nobody's needs.** Hunger and wakefulness are
  timestamps, so a player back from five days Off was Starving in the first
  minute (and in Hard had lost ten from every attribute). The world tick
  pauses them as the minutes pass (`worldTick.js` `tickPlayerMinutes`,
  wherever the feed is null because the arc is Off, calls `needs.js`
  `pauseSurvival`): both markers and the last paid minute are carried by
  each span, so the needs stand where they were - a meal eaten Off
  included - and past a day Off the body has lived the classic game's days
  and starts fresh (fed, watered, rested, dry and sober: WORLD5's own rule
  for an absence). A gap the arc was ON for - a short online absence, a
  host with no reader - is not Off, and counts as it always did.
- **A leftover meal is fed, never sickened** (`useItem.js` hands Casual's
  rules when the arc is Off; it had handed none, which is Hard's roll).
- **The place is still the place.** A rest opened Off is priced as DFU's
  bed - the whole hour, one ask - but the entity carries WHERE it is, which
  the party pose broadcasts (below).
- **It is stored as the old switch's own `false`**, so a build from before
  the tiers reading the same shelf still reads Off.
- **The kit is packed anyway** (SURV-KIT, at the end of this page): a
  character made Off sets out with the same kit as a Casual one, after
  DFU's bag - the one seam where Off's bag is not DFU's - and there it
  waits.

### How it is built - rules as data, read at the compositions

- **The table** (`survival/difficulty.js`, an import-free leaf): a field
  exists only where the tiers DIFFER - the stamina floor, heat band and
  barefoot tax, whether a rest still pays the band (`duringRest`) and
  whether a met need repays its loan (`repaid`); whether the attributes,
  the health, the rust, the sickness, the hunt's harms, the gate, the
  blackout and the wasted meal apply; and the rough rest's price with the
  sleep-debt stage a rough night cannot pay below. The world's numbers
  (the stages, the drain rates, the sleep a bed pays) stay with their laws.
- **The stored values** (`SURVIVAL_STORED`): Off is `false`, Casual and
  Hard are stored by name, and the default is never stored at all (PREF1).
  `tierOfStored` reads a stored value back and anything else as the
  default - the rule the Features bar draws by (`tileStates`, BLOOD AUDIT
  5) - and the shelf's load drops any value that names no tier
  (`uiPrefs.js` `loadPrefs`), because the bar matches a stored value by
  its STRING: a hand-edited `'false'` drew Off while the laws ran the
  default.
- **The switch** (`survival/switch.js`): `survivalTier()` is
  `tierOfStored` of the shelf; `survivalOn()` is "not Off" for everything
  the arc merely switches on; `survivalRules()` is what a law that CHARGES
  reads - null for Off.
- **The laws take the rules as an argument** and run Hard when handed none
  - or null, which is what `survivalRules()` answers for Off (the minute
  law threw on `null.stamina` until AUDIT SURV-TIERS): `survivalMinute` /
  `survivalStatMods` (`deps.rules`), `restCost` / `restHour` / `stiffen`,
  `eatLaw`, `huntOutcome`, `tavernOrder` / `tavernPour` / `tavernDrink`.
  So every pin written before the tiers still pins Hard.
- **The needs' stamina leaves by one door** (`tire` inside
  `survivalMinute`): a tier with no floor hands each charge to the sink as
  before; one with a floor spends only the budget above it, read at the
  minute's first charge (after the well-fed hour's refund) and counted
  down in the law, so two needs in one minute share one budget whatever
  the host's sink does with them. In a tier that repays, what each need
  takes is written to the record's `borrowed` under the need's name
  (`hunger`, `thirst`, `sleep`, `temp`, `feet`); the minute that need
  leaves its costing stage, its loan comes back through the sink's
  `restoreFatigue`, up to the pool, and one line says so ("You feel your
  strength returning."). A rest pauses the charge, not the need - a
  starving sleeper is repaid when fed. A tier that does not repay carries
  no loan: a Casual loan is dropped at the first Hard minute, because Hard
  keeps what it takes. And a loan is never more than the pool is short
  (`settleLoan`, the top of every minute): a bed, a potion, the fed hour or
  the collapse's hour that refills the pool has paid that much of it, each
  need's share cut in proportion - or the meal after would pay it again.
- **The cap is read, not only written** (`statMods.js` `liveStat`): the
  needs' drain holds five above the stat as it stands without it wherever
  the stat is READ, so a Drain landing between two survival minutes cannot
  turn it into the live zero the 0.2-second kill check reads.
- **A lit fire answers the cold in Casual** (`stamina.fireWarms`): beside
  one, no cold is charged and the cold's loan comes back, whatever the
  strip reads - the storm is still the world's. It warms; it does not
  cool.
- **A rest is a rest** (`stamina.duringRest`): the heat and the cold
  charge a rest away from a fire only in the tier whose gate refuses the
  worst of it. Casual has no gate, and its rest in a blizzard had been
  charged the band faster than DFU's hour restored it - the sleeper woke
  more tired than they lay down (63-68% of the pool, reproduced), and a
  rest until healed never ended.
- **The hunt's safe twins** (`hunting.js` `HUNT_SAFE_TWIN`): every key
  whose outcome can carry a poison, a disease, a wound, the boar's
  fatigue or a beast names the outcome Casual takes instead, and the twin
  keeps what the search FOUND (its meat, fruit and skills). The twin is
  taken before the catch is scaled, so both tiers walk one stream of
  rolls: on the same rolls a Casual hunt IS the Hard hunt with its harms
  swapped out. The port adds one line to the mod's text - `trailCold`, the
  roar's twin, for a hunter with or without a bow.
- **The house** (`tavernMenu.js` `tavernOrder`): both tavern windows ask
  it after the gold and BEFORE the coin changes hands, so a refusal never
  costs a coin or a minute. A drink is the pour's question (`tavernPour` -
  the counter carried past the endurance, where a tier has no blackout);
  a meal is tavernEat's own test (the hunger under the meal's worth),
  refused where a tier has no `wastedMeal`. The enhanced window keeps its
  menu up after a refusal, as it does for a purse too light.
- **The compositions read the live tier once, where they already read the
  switch**: the feed (`env.js` `survivalFeed` puts `rules` in the minute
  law's deps), the rest (`scenes/shared.js` `createRestDeps`, at the open:
  the PLACE - where the sleep is, read in every tier and stamped on the
  entity as `restKind`, which the party pose broadcasts - and the PRICE,
  the place under the tier's rules, DFU's bed with the arc Off: the hour,
  the morning and the encounter asks, all at the tier the rest opened
  with), the gate (`env.js` `survivalGateOn` - Hard's alone), a meal
  (`useItem.js`), a hunt (`scenes/hunting.js`), an order (both windows).
- **The place reads the world's fire.** Each host's `restKind` asks the
  camp pool's `fireNear` - anyone's lit camp or one of the world's fires
  in reach, in EVERY tier - where everything the player USES asks `byFire`,
  which is Off's to hide. The interior host now asks it too: a room's own
  hearth is a camp's rest, as a brazier is outdoors (HEARTH1 had warmed
  the room and forgotten the sleep).
- **The resting encounter roll takes a COUNT** (`encounters.js`
  `intermittentEnemySpawn`'s `restAsks`, one when absent, as DFU has it,
  and one for anything that is no finite number - NaN had asked nothing
  and Infinity never stopped). `createRestDeps` stamps it on the resting
  player at the open (`entity.restAsks`, beside `entity.restKind`, both
  cleared when the rest ends): Hard's rough night two, every Casual or Off
  night and every bed or camp one. **The four hosts rule (17e):**
  `world.js` (the overworld, and the interiors - `worldModes.js` has no
  roll of its own; its interior rest rings `world.js`'s) and `exterior.js`
  hand `restAsks: playerEntity.isResting ? playerEntity.restAsks : 1` where
  they handed the rough flag, `dungeonContext.js`'s own rest roll hands the
  stamp; `worldModes.js` is named and needs nothing. Every host's rest runs
  through the one `createRestDeps` and every host's minute through the one
  `survivalFeed`, so the tier reaches all four through those two doors -
  and the three hosts change in place, a line each, no import.

### A dead constant, found on the way

`needs.js` exported `FLOOR_FATIGUE = 64` under *"rough drains cannot take
the last of a pool by themselves"*, and nothing in the tree read it: Hard's
drains always could empty the pool, and AUDIT-DEATH1 recorded the collapse
that follows as the intended cost. A constant that looks wired and is not
is worse than none (AUDIT VC6), so it is gone; the floor it described is
real now, as a tier's rule - `stamina.floor`, none in Hard, half in Casual.

### Moving the players already on it

The key is unchanged, and so is Off's stored value - the switch's own
`false`. Since PREF1 the shelf stores only choices that differ from the
default, and `true` was the default, so an old shelf carries at most
`survival: false` - a player who turned the arc off - and it reads as
**Off** with no conversion at all. Every other player - everyone who was
on it, since PREF1 cannot tell a pressed On from the default - moves to
**Casual**, as Mac asked. Any other value on the key (a hand-edited
`true`, a corrupted one) names no tier: the load drops it and it reads as
the default. (The first cut converted `false` to a new `'off'` string,
which a build from before the tiers reads as ON - AUDIT SURV-TIERS, below.)

### Online

Every tier, Off included, is the player's online (`online: 'player'`,
unchanged) - Mac's "still let it be able to be turned off for online".
MODS-ONLINE-3's reading holds tier by tier: a tier decides only what THIS
player's body pays; the counters, the camps and a corpse's food (the
killer's word) are the world's in every tier - an Off player's camps stand
for everyone else, and an Off host relays its peers' camps. A party rest's
mirror (PARTY-REST4b) takes the leader's PLACE - every tier broadcasts it -
and prices it by the member's own tier. Two world events stay the actor's
tier's, as the actor's own act: a party rest's encounter roll is the
leader's, asked at the leader's count; a Hard hunter's beast stands in the
world and fights whoever is near it.

### The pins

`test/survtiers.test.js`, 31 tests: the row, the table and the shelf agree
(the segments write the table's stored values); the switch's reads; the
shelf, through a real one (an old Off kept as `false`, the default stored
as nothing, five junk values dropped at the load); Hard's table is the arc
as it stood and a law handed no rules runs it; Casual's five rules; RED
MEANS IT COSTS - degree by degree against `temperatureWord` and the HUD's
own levels, stage by stage for hunger, thirst and sleep, and through the
law over every climate, month, hour and weather there is, shod and
barefoot, in both tiers (92,160 minutes); THE WORST DAY (starving,
dehydrated, exhausted, half naked and barefoot in a mountain blizzard in
wet plate - Casual ends it at exactly half the pool, all of it on loan,
every word still said and nothing else touched); SAME WORLD (two players,
two tiers, one night - the records identical but for the loan, which is
the body's); the floor's one budget a minute, read after the fed hour's
refund; BORROWED, NOT TAKEN (each need's loan under its own name, a rest
repaying nothing, a meal, a drink, a sleep and a warm room each repaying
its own, the pool as the ceiling, Hard lending nothing and dropping a
loan it inherits); a Hard morning lifting under Casual; the rest (a
Casual rest in a blizzard charged nothing, Off's place kept and priced as
a bed, the asks and a count that is no number); the gate; the meal (and
through the whole `useItem` ladder in each tier); the hunt (twelve
thousand seeded searches, Casual equal to Hard with the twins swapped, and
the host's own hunt composed in both tiers); the house through the
classic window (the gold first, the pour and the kitchen, the boundaries
of both, null rules); the enhanced tavern DRIVEN through a fake document,
and before six; the composed ticker; the laws both tiers share (the hour,
five live at the minute and at the read, null rules, Off paused as it
passes and a long Off a fresh start - with a gap the arc was ON for still
counting); and the second pass's own: the loan settled by whatever else
refills the pool, the lit fire, the replay floor on exposure, the
mirrored dungeon night and the wagon's tent; and SURV-KIT's two (at the
end of this page). An `afterEach` resets the tier, the clock and the gate
after every test.

The pre-tier pins moved only where their vocabulary or the source shape
did: a test that set the switch `true` sets `'hard'` (or `'casual'`); one
that set it `false` still does, since that is Off's stored value; a test
that pinned a Hard-only cost under the defaults sets `'hard'` first; the
source pins follow the reshaped lines. The FT15 notes budget rose by
exactly the row's growth - 116 characters in all: a row whose one control
became three, then the loan, in two sentences where there had been three,
then the needs that BORROW and the half that is theirs (the second pass).

Mutants: `tools/mutants/survtiers.json`, 107 records after the second pass - every Casual rule and each rule the two tiers differ on, broken one at a time, the stored values and the load, the row and its two sentences, the floor's door and budget and the refund before it, the band, the loan (never written, never repaid, repaid by a rest, repaid past the pool, carried into Hard, left owed after a refill, cut unevenly), the pause for Off and a long Off's fresh start, the rest's band, the sleep floor, the twins, the house (the pour, the kitchen, each boundary, null rules, the gold's order in both windows, the words, the menu, the kitchen before six), the place and the price, the asks and a count that never ends, the camps under Off, the fire, the replay floor, the cap at the read, the wagon's tent, the mirrored dungeon night, the partyrest1 slice, the potion cite - all 107 dead. The run that closed each pass is stated as its rule, so it can be run again: every record in the eleven survival lists (`surv1`-`surv7`, `surv_thirst1`, `auditsurv`, `hearth1`, `survtiers`), every record in any other list whose tests are a file the pass changed, and every record whose target lies within six lines of a line it changed - the first pass: 417 records over 21 lists, 416 dead and `to1.json`'s recorded equivalent; the second: 463 records over 21 lists, 462 dead and the same recorded equivalent - three had first survived and were answered (a re-aim that had landed on the thirst harm's identical line, and two assertions the law's own outputs lacked once the loan's settle and the read-time cap stood behind them).

**Not driven in the container:** no ARENA2, so the game itself was not
played at either tier. The Features tile's three segments were checked in
Chromium against the dev server with `tools/survTierProbe.mjs`, committed
so the check can be run again (fourteen checks, all passed: the three
segments in order, Casual pressed on a fresh shelf, each press's stored
value - Hard by name, Off as `false`, Casual as nothing - the rail's
words, an old Off shelf opening on Off, and a hand-edited `'false'` string
opening on the default; the second pass dropped a fifteenth that read back
its own seed); the enhanced tavern's refusals
are DRIVEN in the suite now, through a fake document (`test/invdrag.mjs`
`withDom`), not read off its source.

## AUDIT SURV-TIERS (2026-09-23)

> Mac: *"Lets first do a comprehensive audit and ensure this is perfect"*.

Four lenses over the slice, each on its own: **Hard** (is it the arc as it
stood, to the number, and does anything in it leak or regress), **Casual**
(does every rule hold at every seam, and is it ever a punished
experience), **wiring** (every caller, host, save, relay and skin), and
**tests and records** (do the pins bite, are the records true). Every
finding was reproduced before it was fixed, and every fix has a pin and a
mutant (the ones this pass claimed and did not have were added by the
second, #32).

### Found and fixed

| # | Finding | Tier | Fix |
|---|---|---|---|
| 1 | A Casual rest in a red temperature was charged the band faster than DFU's hour restored it - the sleeper woke at 63-68% of the pool, and a rest until healed never ended (HIGH: rule 5 broken) | Casual | `stamina.duringRest` - the band charges a rest only where a gate refuses the worst of it (Hard) |
| 2 | A Casual meal on a full stomach was charged, took its half hour and was wasted - a coin and an hour lost (rule 2) | Casual | `wastedMeal`; `tavernOrder` refuses it before the coin, in words |
| 3 | The design said the stamina cost "reverses completely with a meal, a drink, a sleep or a fire" - it did not; only the fed hour's point an hour came back | Casual | the loan: `stamina.repaid`, the record's `borrowed`, repaid the minute the need is met |
| 4 | The hour's band read a fractional hour raw, so 15:30 fell through every band to the night's -20 | both | `hourTemperature` floors the hour |
| 5 | The survival drain was capped against the PERMANENT stat while every other drain stacks on the live one - a Drain Agility spell and a tavern ale made a live 0, and a live 0 kills | both | capped five above the stat as it stands without its own entry; the drink's bands read the live endurance |
| 6 | Five days Off and back on: Starving at the first minute (and ten gone from every attribute in Hard) - Off's minutes were charged to the timestamps | both | `runSurvivalMinutes` moves the markers by the minutes no law paid - REPLACED in the second pass (#22): inferring Off from any gap was the wrong fix |
| 7 | An interior's hearth made no camp's rest - HEARTH1 warmed the room and the interior's `restKind` knew only a bed or the boards | both | `fireNear` in the interior's `restKind` |
| 8 | The minute law threw on `null` rules - `survivalRules()` answers null for Off | latent | every law takes null as no rules |
| 9 | Off stamped every rest a BED, and the party pose broadcasts it - a follower mirroring an Off leader slept a bed's night in a field | Off | the place and the price are two answers (`_place`, `_kind`) |
| 10 | Off refused to restore or relay a camp - a save made Off lost them all; an Off host dropped its peers' from the room it passes on | Off | the pool keeps the data and hides it (`shown`); placing one is refused in words |
| 11 | A leftover meal under Off was Hard's sickness roll | Off | Casual's rules |
| 12 | Off stored as a new `'off'` string - a build from before the tiers reads it as ON; and junk on the key read one way in the bar and another in the laws | Off | Off is `false`, as it always was; the load drops junk |
| 13 | The barkeep was asked before the purse - a player who could not pay heard the barkeep's verdict | Casual | the gold first, then the house, then the coin |
| 14 | "will not pour you another" on a first spirit | Casual | "The barkeep shakes their head: that one would put you on the floor." |
| 15 | A NaN count asked no encounter at all, an Infinity count never stopped asking | latent | a count that is no finite number is one |
| 16 | The Features note was three sentences (FT15's title asks for one or two) | - | two, and pinned by survtiers in the second pass (#32) |
| 17 | `test/partyrest1.test.js` sliced from a declaration that had grown a parameter - the slice was empty and four assertions passed against nothing | - | the marker is the declaration as it stands, and the slice is held non-empty (and a mutant proves it) |
| 18 | The record said the sweep ran "every climate, month, hour and weather" - it ran two months, two hours and two weathers; "over twelve thousand" searches were exactly twelve thousand; the refund-first budget was claimed and unpinned | - | the sweep runs all of them (92,160 minutes); the count is exact; the refund is pinned |
| 19 | A mutant (the switch reading the old boolean) became EQUIVALENT once Off was `false` again; one named `row-default-true` made the default `'hard'`; one duplicated `modsonline1.json`'s | - | replaced, renamed, removed |
| 20 | Stale words: `shared.js`'s rest and gate comments, `world.js`'s mirror fallback, `onlineLane.js`'s "boolean switches", `status.js`'s severity note, `credits.js`'s "a costed rest", the Port Ledger's and Home's "one switch", this page's intro | - | each said now as it is |
| 21 | Cites found wrong on the way, older than the slice: `potions.js`'s `useItem.js` cite sat a line short (and `citedrift`'s pick for it baked the number in - WM3's own trap), `tavern.js`'s and `tavernWindow.js`'s TALK cites named lines that had moved | - | re-aimed by content; the citedrift entry captures each half |

### Accepted, and why

- **A rest kind that is no kind prices as rough** (two asks in Hard):
  `restCost`'s law - a bed and a camp are named; anything else is the
  ground.
- **One minute after Hard to Casual**, the floor's budget reads the pool
  as Hard left it, and a Hard save loaded into Casual carries Hard's
  attribute entry until the first minute rewrites it. A minute, then
  Casual's own.
- **The flavour lines are the world's** ("The sun burns your bare
  skin.", "Your bare feet are getting burned.") and said in every tier,
  though in Casual nothing but the felt temperature charges for them -
  rule 1.
- **The classic skin has no needs strip** - older than the tiers; the
  status page carries the needs there.
- **`wire.js` keeps "survival mode off" in two comments** about a null
  rest kind. `test/relayversion.test.js` (SLAM8) hashes the relay's
  bundle, comments included, and a comment edit there is a relay version
  and a deploy; the words ride the next wire change.

### Open, for Mac

1. **Fast travel replays the trip awake.** A cautious or inns journey
   walks its minutes as waking ones and arrives Exhausted in both tiers.
   Recommend: the nights of an inns or camping journey count as sleep and
   heal, as DFU's own travel does.
2. **Hard's own rest between the band and the gate.** Hard charges from
   twenty felt either way, and its gate refuses only freezing and deadly
   cold without a fire or a roof, and scorching anywhere - so a Hard rest
   in the warm, the hot or the cold (or freezing under a roof) still pays
   the band, and a rest until healed there may not finish. Hard is the arc
   as it stood, so it is unchanged. Recommend: a Hard rest pays the band
   only where the gate would refuse it.
3. **SURV4's brief** ("the rest window is a last resort that comes with a
   cost") stands for Hard; Casual's rough night is DFU's whole hour.
   Confirm.
4. **Mixed tiers in one party:** the leader's encounter roll and a Hard
   hunter's beast are the actor's own acts and reach everyone near
   (Online, above). Confirm, or the roll could take the gentlest tier in
   the party.
5. **DFU's tavern heal** (a meal restores health on DFU's list) is absent
   from the survival menu in both tiers - older than the tiers.
6. **Spoiled food sells for nothing** - older than the tiers.

### The second pass, before the merge (2026-09-23)

> Mac: *"One more audit before we merge"*.

`origin/main` had moved nine commits (HCC, FRIENDLY-SPELLS and seven
more) since the branch began, so it was merged in first and the merged
tree was what was audited - five conflicts, each resolved by content:
the `drinkPotion` sentence in `potions.js` had rotted on BOTH sides (its
hostMagic, world and dungeonContext halves named lines that had moved,
and no citedrift entry captured them; every half is pinned now), and the
rest were counts and index lines.

Four lenses again, each fresh, each on its own copy of the merged tree:
**the fixes themselves** (the first pass's, attacked), **integration**
(the tiers against main's nine commits, the save, the wire, both skins),
**play** (scripted sessions through the real laws and compositions, a
character's first days in each tier, jumps, taverns, hunts, tier
switches, the death risks) and **records** (every claim, count and cite,
whether each pin bites, merge-readiness). Every finding reproduced
before it was fixed; the pass found the first pass's own fixes wrong in
three places, and says so.

| # | Finding | Tier | Fix |
|---|---|---|---|
| 22 | THE FIRST PASS'S OFF-GAP FIX WAS WRONG TWICE. It inferred Off from ANY gap behind a walk's start: WORLD5's online load leaves exactly such a gap for a short absence on purpose ("an hour away keeps its hunger") and the shift forgave it, in Hard too; a host with no reader while the arc was on, and the collapse's re-entry, were forgiven the same way; and a meal eaten Off (which writes its marker inside the gap) was moved a second time, days into the future - fed for as long as the arc had been Off, a clean Hard exploit | both | the shift is gone; the world tick PAUSES the markers per span while the arc is Off (`needs.js` `pauseSurvival`, called from `worldTick.js` `tickPlayerMinutes` when the feed is null because the arc is Off) - a gap the arc was on for is untouched |
| 23 | Five days Off came back Drenched and Very drunk, the drink's penalty with them | both | an Off span past a day is a fresh start - WORLD5's own rule for an absence (`alignSurvival`); a shorter one is paused whole |
| 24 | THE LOAN PAID TWICE. A bed, a potion, the fed hour or the collapse's hour refilled the pool without meeting the need, and the loan stayed owed - a player who slept starving banked a pool of stamina a day and ate it mid-fight (up to 2.3 pools, fuzzed) | Casual | a loan is never more than the pool is short: settled at the top of each minute, each need's share cut in proportion (`needs.js` `settleLoan`) |
| 25 | THE LIVE CAP HELD ONLY AT THE MINUTE. The zero-stat kill reads every 0.2 real seconds; an ale's -2 on a live 7, then a Drain of 5 before the next minute, made a live 0 and killed | both | the needs' drain is capped where the stat is READ (`statMods.js` `liveStat`), against the stat without it |
| 26 | "A warm place or a fire repays the cold" was false in snow: the fire's fifteen degrees left a camper Deadly cold beside it, charged and never repaid | Casual | `stamina.fireWarms`: in Casual a lit fire answers the cold outright (the strip still reads the world's cold); it does not cool the heat |
| 27 | A jump could kill with the heat or the cold: a cautious fast travel through a summer desert healed the traveller whole and then replayed the trip's heat as waking minutes - dead on arrival. SURV-THIRST1's floor had covered thirst alone | Hard | a REPLAYED minute's exposure harm wounds to the floor and no further; the minute the player stands in still can (DEATHLOOP2's lethality kept) |
| 28 | A party rest mirrored in a DUNGEON paid no sleep: the mirror runs on the outer host's ticker, which read no needs underground, while its window holds the dungeon's frame - the follower woke Exhausted | both (older) | underground, a resting player's ticker reads the dungeon's own reader (`world.js`/`exterior.js` `survivalEnv`, `dungeonContext.js` `survivalEnvNow`) |
| 29 | A tent used from the WAGON never left it - both windows handed the item, every host placed it off the pack - so one tent pitched and packed into a new one each time (HCC made the wagon the gear's home) | both (older) | both windows hand the list the item was used from; the hosts place off it |
| 30 | Before six the enhanced tavern said the kitchen was shut and served nothing; the classic window's drinks still pour | both (older) | the kitchen's words, then the drinks |
| 31 | `test/partyrest1.test.js` still could not fail for `dead` or `vitals` - the first pass's fix built `dead\s*:\s*:`, two colons | - | one key, one colon, on a word boundary; mutants prove all four |
| 32 | Pins the first pass claimed and did not have: the note's two sentences (FT15 counts only characters, and a dozen other rows run longer - this row is pinned at two by survtiers), the Infinity ask (its pin could only fail by hanging - the rolls now stop answering after a thousand), the kitchen's null rules; and mutants for the exterior's and the dungeon's `fireNear`, the enhanced window's gold-first order, the barkeep's words, the refund-first budget, the potion cite | - | each added |
| 33 | The Features note said Casual "lends" stamina "never below half": the loan runs the other way (the needs borrow), and the half is the needs' share - DFU's own walking and running drain runs below it | - | "Casual's needs only borrow stamina, never past half the bar, and repay it when met" |
| 34 | Records: the first pass named three different "four laws Hard shares"; null rules were latent, not wrong since SURV1-7; rule 1 claimed every word is the same (the refusals, the repaid line, a twin's line and the Stiff chip are the tier's); rule 3 read as if Drenched cost; a camps comment blamed the save where it was the load; a probe check read back its own seed; tests left the tier and the clock set when an assert failed; stale cites beside re-aimed ones (Travel-Options' `:369`, `tavern.js`'s popup Talk, `tavernWindow.js`'s sceneCache, Port-Status item 9's four `useItem` numbers, `enhancedInventory.js`'s `nativeInventory` cite) | - | each said as it is; an `afterEach` resets the tier, the clock and the gate after every tier test |

**Where Hard moved, all told.** Hard is the arc as SURV1-7 built it but
for these laws both tiers share, each a bug and each fixed where it
lives: the hour's band (#4), the drain's cap - five live, at the minute
(#5) and at the read (#25) - the interior hearth's rest (#7), the pause
for Off (#22, which replaced #6) and a long Off's fresh start (#23), the
replay floor on exposure (#27), the mirrored dungeon night (#28), the
wagon's tent (#29) and the tavern before six (#30); and, through Off,
the place an Off leader broadcasts (#9). Null rules (#8) were a latent
crash in the tiers' own plumbing, never Hard's.

**Accepted in the second pass:**

- **The collapse comes sooner in Casual than Off.** The floor holds the
  NEEDS above half the bar; DFU's own drain runs below it, and red needs
  bring DFU's collapse forward (about a third, on the play lens's
  snowy night) - which with a foe near kills. That is what a stamina
  cost is; the needs alone still never collapse anyone.
- ~~**A player who starts Off and turns Casual on later has no kit** - the
  kit is chargen's, and the provisions shelf sells it.~~ SUPERSEDED the
  same day by SURV-KIT (below): chargen packs it in every tier.
- **A new Hard character dies of exposure on their first snowy
  evening**, and a Hard blackout night is replayed as waking hours - both
  as they were before the tiers (the play lens ran the same sessions on
  the pre-tier tree); Hard is the arc as it stood.
- **Mixed builds online:** an Off leader on a build from before the tiers
  still broadcasts every rest as a bed. It ends with that build.

**Open, for Mac** (the first pass's six stand; the first is sharper): a
cautious or inns journey still replays its minutes awake - it now
arrives at death's door in a Hard desert rather than dead, and Exhausted
in either tier.

## SURV-KIT - EVERY CHARACTER SETS OUT WITH THE KIT (2026-09-23)

> Mac: *"Oh some changes for C&C. 1. C&C characters regardless of mode
> should start with supplies"*.

The kit - two sacks of rations, a full waterskin, worn camping gear and a
fire kit with two lights left (`survival/items.js` `startingProvisions`) -
was packed only while the arc was on. Both of its mints asked
`survivalOn()`: `startingGear.js` `assignStartingGear`, which both of
chargen's paths run, and `equip.js` `seedStartingEquipment`, the
pre-chargen fallback. So a character made Off who turned the arc on later
set out with nothing but the shelf, which the second pass had accepted
(above). Neither mint asks now. The tier is a setting the player moves at
any hour; the kit is the character's, packed once, at the start.

**Every tier's new character is the same character.** Off, Casual and
Hard are born with one bag and one purse, item for item: DFU's own bag
first (the spellbook, the clothes, the class kit, the torches - 17f's
order holds), the four survival items after it, the gold in the purse.
Off's bag is DFU's with the kit after it - the one seam where Off is no
longer DFU's own. There the kit waits:

- the rations keep - they never spoil, in any tier (`food.js` `FOOD`,
  `keeps: null`);
- a meal finds no hunger to answer (Off pauses the markers) and is
  refused, not eaten: "You are not hungry enough to eat the Rations right
  now.";
- the camping gear and the fire kit are refused in words - "Turn Climates
  & Calories on to make camp." (CAMP-SILENT) - and stay in the pack;
- the skin pours, as it does in every tier;
- it weighs what it weighs in every tier: 12.5 kg (the rations 2, the skin
  0.5 and its water 2, the camping gear 5, the fire kit 3).

Turned on, the same rations feed the player the first time they are
hungry. The provisions shelf and the corpse's meat stay the arc's - Off's
general store and Off's kills are DFU's - and the Features note still
calls Off "the classic game": its rules are, and the kit is only carried.

**Not done:** a character made before this change - Off, or on a save
from before SURV2 - is given nothing now. The kit is chargen's; handing it
to a character already in play is a different change, and Mac's to ask
for.

**The pins.** `test/survtiers.test.js` 29 -> 31: every tier's new
character, through the wizard's own finish (`chargenSession.js`
`finishChargen`) and the fallback, carries the kit last with DFU's bag
untouched before it, weighs 12.5 kg of it, and the three tiers' bags and
purses are identical (Off is walked first, so a tier gate come back fails
there before anywhere); and born Off, three days through the real ticker
leave the kit as packed, the meal is refused and not eaten, both camp
kits are refused in words through the real camp pool and kept, the skin
pours, and turned on, six hours later, the same rations feed a Casual
player. The older pins that read Off as DFU's bag alone read the kit after
it now: AUDIT SURV D (`auditsurv.test.js`: the Off kit equals Casual's),
17f F12 (the names, the kit's included), U8h (`equipmechanics.test.js`:
the seed is the dagger and the kit, and a second seed adds nothing), the
settings torches (`settings.test.js`: counted by their templates, since
the kit shares their `UselessItems2` group) and SURV2's source pin (the
shelf asks the switch; neither kit mint asks any tier). Against the old
gate, five of them fail.

Mutants: `tools/mutants/survtiers.json` 107 -> 111 - the wizard's kit
gone, packed before DFU's bag, packed twice, and the fallback's gone - and
`auditsurv.json`'s chargen-kit record re-aimed by content. The run:
every record in any list whose tests are a file this change edited, and
every record whose target is a source it changed (`startingGear.js`,
`equip.js`, `survival/switch.js`) - 161 records over 7 lists, all dead.

On the way: the fallback's seam had rotted in its own words. Six line
cites named lines that had moved - `equip.js`'s `startingGear.js:70`,
`:221` and `world.js:2460`, `startingGear.js`'s `equip.js:307` and
`world.js:2460`, and `exterior.js`'s `equip.js:306` - and each names its
line again.
