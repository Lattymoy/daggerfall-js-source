# Climates & Calories

Survival: a felt temperature, hunger, thirst, sleep and wetness, the food and water that answer them, camps and the
world's own fires, where a rest is worth what, and regional tavern menus. It is an overhaul, not a port, of Ralzar's DFU
mod **Climates & Calories** 1.7.1, made with the author's permission (`01-Overview/Own-Work.md` holds the record); the
mod's rules are read off its DLL and rebuilt as our own, and its items, pictures and words are ours. It is played at a
tier: Off, Boons (the default), Casual or Hard. The player meets it on the HUD's needs strip and temperature plate, in
food, waterskins and campfire kits, at fires and beds, and at the tavern.

## How it works

**The tiers** (`src/systems/survival/difficulty.js` `SURVIVAL_RULES`; one key, `SURVIVAL_DEFAULT` `boons`). Every law
that can charge the player reads its tier's rules; a law handed none runs Hard. The world is the same in every tier -
clocks, stages, food, camps and words - only what the body pays differs, so players on different tiers share one world.
- **Off**: the classic game. Off still sees other players' camps but uses none.
- **Boons**: nothing is ever taken; a body kept fed, watered and rested earns bonuses (`src/systems/survival/needs.js`
  `BOON`): Well fed +5 Strength and Endurance, Quenched +5 Agility and Speed, Well rested +5 Intelligence and Willpower
  (banked only by sleep in a bed or by a fire), all three together Thriving +5 Luck, and the Hearth refills stamina
  beside a lit fire. No chip goes past amber.
- **Casual**: stamina is the only price of neglect, charged only at the red stages, lent down to half the pool at most
  and repaid when the need is met. Nothing refused, nothing rolled against the player, nothing wasted.
- **Hard**: the arc at full strength: stat drains, health loss, a rest gate, a rough rest's second encounter roll and
  stiff morning, sickness and blackouts.

**The temperature** (`src/systems/survival/temperature.js` `feltTemperature`). The climate's own (`CLIMATE_TEMP`:
Desert 40, Desert2 50, Subtropical 30, Rainforest 20, Swamp 10, Ocean 0, Woodlands -10, Haunted -20, Mountain Woods -30,
Mountain -40), plus the month, the hour (stronger in deserts and mountains) and the weather. Indoors the reading is
softened under the roof; underground it eases toward a dungeon's own air. Resistances (race, spells, vampire,
lycanthrope) pull the world's reading toward zero. Then the body: clothing warms by piece (eased above a natural ten,
reduced by wetness), armour warms a little and its metal heats in sun unless a cloak or robe covers it, a fire gives 15,
and a drink in the pack cools a hot reading. Rain, storm and snow soak by how hard they actually fall.

**The needs** (`entity.survival`, `survivalMinute` once a game minute; `NEED`):
- Hunger: peckish at 240 minutes since a meal, hungry 720, starving 1440. Rations in the pack are eaten by themselves
  when hungry.
- Thirst: thirsty 50, parched 80, dehydrated 100, costing health from 120. It rises faster in heat.
- Sleep debt: tired 4, drowsy 8, exhausted 12 hours; it grows past sixteen hours awake.
- Wetness: damp 5, wet 30, soaked 100, drenched 200.
- Heat and cold charge fatigue by the band, build exposure past 30 and cost health past 50.

Drains are one `survival` active effect rewritten each minute, never taking a stat under five. A player away longer than
a day comes back fed, watered and rested (`alignSurvival`). A long jump (fast travel, a rest) is replayed minute by minute
at each minute's own hour offline, capped at two days. Fatigue at nought brings DFU's exhaustion collapse.

**The items** (`src/systems/survival/items.js`, templates 530 up): Camping Equipment, Rations, Apple, Orange, Bread, Raw
and Cooked Fish, Meat and Raw Meat, the Waterskin (its water weighs what it is), the Skillet and the port's Campfire.
Food spoils by stage on a heat-driven clock. Corpses of humanoids may carry food, rolled on the pool's own stream. General
stores sell provisions; the starting kit carries some. The rows follow our rules: a name is the plain word for the
thing; a weight is one in life, to the nearest of 0.1, 0.25, 0.5 or a half kilo (a fruit a quarter, a loaf or a meal of
rations a half, a skillet two); a food costs two gold an hour of its worth, four for meat, half again for rations
(`foodPrice`). The tent costs a fifth of a Campfire's night for each of its fifty uses; the skin the classic Decanter's
7. A food's condition is its keeping; rarity is 1, since nothing rolls these.

**The pictures** (`src/systems/survival/itemIcons.js` `OWN_ICONS`). The icons are ours, at the mod's keys and sizes.
Raw meat and the waterskin are painted by our painter (`src/systems/survival/survivalArt.js`). A spoiled face is our
rot (`src/systems/survival/rotPicture.js`; `MOULDY` for the first stage) over the fresh food: the player's own apple,
orange, bread, fish or meat, or our raw meat. The mould is soft, irregular patches (`mouldField`): seeded noise,
thicker toward the rim and in the hollows of the food's own shading, grey-green to white, lit as the food is lit, and
never brighter than the food's highlight. The tent's canvas and pole are the classic records, built from specs
(`src/systems/survival/derivedIcons.json`).

**Camps** (`src/systems/survival/camp.js`, pool `src/scenes/camps.js`). A tent and fire are placed objects with a menu
under the activation ray at `CAMP_REACH`: rest here, cook raw food (faster with a skillet), stoke, pack up. Water
sources (fountains, wells, troughs) fill skins and quench thirst. Online a camp in the open world rides its owner's foes
frame; in a dungeon it is the room's, so a fire one player lit stays lit for the next.

**The world's fires** (`src/systems/survival/hearth.js`). Fire bowls, braziers and a camp's own flame count as a fire:
warmth, drying, a fire's rest and a cooking list. Wall torches and candles do not. All four hosts collect them, within
`HEARTH_NEAR` (16 m).

**The rest** (`src/systems/survival/rest.js`). A bed (a rented room, a house, a ship) or a camp by a lit fire is a full
sleep: DFU's whole recovery and the sleep debt paid at 1.5 an hour. Anywhere else is rough: half the recovery, the debt
paid at half and never below tired, and on Hard a second encounter ask and a stiff morning. On Hard freezing without a
fire or roof, or scorching anywhere, refuses sleep (DFU's `RegisterPreventRestCondition` seam).

**What the player is told** (`src/systems/survival/status.js`). The enhanced HUD's needs strip (a chip a felt need, boons
in green), a temperature plate by the compass (the felt number, its word and a scale), the felt temperature on the pack's
figure, each wearable's card saying what it would change, the Stats page's breakdown of every part
(`src/ui/temperatureCard.js`) and the Status page's number.

**The tavern** (`src/systems/survival/tavernMenu.js`). The mod's regional menus with meals and drinks; drinking makes the
player drunk, with an attribute swing in every tier and a blackout on Hard. On Casual and Boons the barkeep stops before
a blackout and the kitchen will not sell a full stomach a meal, both asked before any coin moves.

## Rules

- Overhaul, not a 1:1 port: fix the bugs and build it to the port's design (Mac, with the author's permission).
- Tents are shared world objects online; campfires and beds are the go-to rest, with a purchasable campfire; the rest
  window is a last resort that costs, offline and online; on by default (Mac).
- A difficulty design that is not a punished experience: Off, Casual, Hard (Mac), and Boons, which rewards upkeep
  instead of punishing neglect (the owner).
- Boons is the default (Mac). Stored as `false` (Off) or by name; the default is never stored.
- Rations are eaten automatically when hungry (Mac).
- Braziers and the world's fires count as campfires (Mac).
- Boons online are kept: every tier is each player's own, and a boon is earned.
- Red means it costs: only the stages a tier charges at are painted red.
- Each tier is the player's own online (`online: 'player'`); the felt temperature is the same for everyone.

## Daggerfall Unity

The mod runs on DFU's magic round with a temperature, hunger on DFU's tavern clock, an auto-drinking waterskin, a sleep
counter, camping, a hunting pop-up and a replacement tavern window. Departures:
- Thirst costs health on its own; the mod asked for heat too.
- The mod's quadratic sleep counter, never-resetting starvation counter and free reset of every need on fast travel and
  prison are not kept.
- The sea's temperature is 0 (the season, hour and weather alone), as the mod's published source answers.
- Only robes and cloaks shade a cuirass from the sun, by DFU's own doll draw order; the mod's three gowns do not.
- Rain soaks by how hard it falls, not by the weather's word.
- The text hunting minigame is removed. Hunting as a profession is separate.
- The four mod-message calls to mods the port does not carry are dropped.

## Code and tests

- `src/systems/survival/` - tiers (`difficulty.js`), the switch, temperature, needs, food, items, camps, hearth, rest,
  status, tavern menu, the feed (`env.js`)
- `src/scenes/camps.js` - the camp pool in each host
- `test/systems/survival/surv1_model.test.js`, `test/systems/surv2_items.test.js`, `test/systems/survival/surv3_camps.test.js`,
  `test/systems/surv4_rest.test.js`, `test/systems/survival/surv5_ui.test.js`, `test/systems/surv7_feed.test.js` - the
  model, items, camps, rest, what the player is told, the feed
- `test/systems/survival/survtiers.test.js`, `test/systems/survival/survtiers3.test.js`,
  `test/systems/survival/survboons.test.js` - the tiers and Boons
- `test/systems/survival/tempui.test.js` - the temperature shown
- `test/systems/survival/hearth1_worldfires.test.js` - the world's fires
- `test/systems/auditcc.test.js`, `test/systems/auditcc_ui.test.js`, `test/systems/auditcc_pvp.test.js`,
  `test/systems/survival/auditcc_items.test.js`, `test/systems/survival/auditcc_tavern.test.js`,
  `test/systems/survival/auditsurv.test.js` - the audits
- `test/systems/survival/fb1015f_wetfall.test.js` - rain by how hard it falls
- `test/systems/surv2_items.test.js`, `test/systems/survival/nobethesda3_rotfish.test.js`,
  `test/systems/nobethesda2_torchesicons.test.js`, `test/systems/ownwork4_pictures.test.js` - the rows and the pictures

## Open

- About 100 dish and drink names in `src/systems/survival/tavernMenu.js` and the meal and camp lines
  (`SURVIVAL_USE_TEXT`, `CAMP_TEXT`) are still the mod's words (`01-Overview/Own-Work.md`).
