# The Firmament

A passive tree for everything a character does online, in Path of Exile's shape laid on Tamriel's sky: 518 stars and
589 lines. The inner sky is combat, the outer ring is the life trades (gathering, crafting, trading, the sea), paid
for by Renown and profession ranks. The player meets it on the Firmament page of the pause window's Growth tab. Offline
it sleeps, and the game is Daggerfall's.

## How it works

**The sky** (`src/net/firmament/firmamentTree.js`). Seven birthsigns stand where Path of Exile's classes do:

| Sign | Attributes | Battle keystone | Life wedge | Life keystone |
|---|---|---|---|---|
| The Mage | Intelligence | Atronach's Pact | Enchanting, healing, Alchemy | Scholar's Seclusion |
| The Shadow | Agility, Intelligence | Night Mother's Embrace | Trading, the caravan, the fence, the courts | Merchant Prince |
| The Thief | Agility | Wind Runner | Hunting, Outfitting, climbing | Lord of the Hunt |
| The Steed | Speed, Strength | Steed's Charge | Seafaring, Fishing, the road | Master and Commander |
| The Warrior | Strength, Endurance | Berserker's Fury | Mining, Smithing, Building, Logging | Stonebreaker's Oath |
| The Ritual | Willpower, Strength | Martyr's Vow | Herbalism, Provisioning, the weather | Hermit's Covenant |
| The Serpent | Luck | (walks to every sign) | none | none |

Each sign's spoke runs out to a ring road and on to its battle keystone; clusters of notables lie along the way. The
outer life ring holds each sign's trades. The Wayfarer's Roads run between signs from the inner ring to the life ring,
so a character with only Craft points can reach the trades. Battle keystones give much and cost a little; no life star
carries any cost. Every star has a fixed key; a star removed from the sky is refunded, with every star that reached the
start only through it.

**The purses** (`src/net/firmament/firmamentLaw.js`). Stars: 2 for each Renown level past the first (98 at Renown
50), spent anywhere. Craft points: 1 for every 8 profession ranks summed over the ten tracks (125 at ten Masters),
spent on the life ring only. A tree is judged whole (`treeFault`): one start, every star joined to it, within the purses.
At most 223 of the 518 stars can ever be held.

**Changing it.** A refund is free below Renown 10; after that it costs 10 silver a star (Marks, burnt). Changing sign
takes every star back. A full respec, sign included, costs 10,000 gold (`FIRM_RESPEC_GOLD`). A build code
(`FIRM-<sky>-<stars>`) can be copied and pasted to load a build as pending changes; a code made for an older sky is
refused.

**What a star gives.** Key stars (starts, notables, keystones) give raw points; small stars give a share of the
character's own attribute, skill, Health or Spell Points. A gain on an attribute lifts that attribute's ceiling past
100 by itself.

**The budget, so PvE balance holds.**
1. Every channel is capped for the whole sky: an attribute +15, a combat skill +15, spell damage +30%, spell price 25%
   off at most, casting speed +15%, blows at most 15% lighter, +75 health and magicka, and so on (`STAT_DEFS`).
2. At the blow, weapon, melee, family and foe kind together are capped at +30%, conditions included at +50%
   (`BLOW_CAP`, `BLOW_TOTAL_CAP`); the spell's price likewise (`CAST_COST_CAP`).
3. Keystones count against the same caps, and their costs are paid after the cap.
4. Craft points never reach a fight: life stars carry life channels only.
5. The sky sleeps offline and in a refereed fight (duel, arena), and never touches a blow or spell at a player. In the
   Wrothgarian Mountains it acts against the zone's beasts, while any strike at a player is rolled without it.
6. Stars come slowly, with Renown.

**The service** (`server-account/src/firmament.js`). It counts the purses from the Renown and profession tracks and
judges every whole tree it is asked to set, once a request id. Harvests read the tree for yield and XP, and smelts,
crafts, tempers, brews and disenchants for XP. Refunds burn into the Marks ledger. The switch is `FIRMAMENT_OPEN` in
`server-account/wrangler.toml`, and it is `on`.

**The client.** `src/net/firmament/firmamentBook.js` reads the state at the first Renown, every rise, the window opening
and the seat taken back; a read the service never answered is retried from 15 seconds, doubling to 2 minutes. A Renown
rise is announced like an Ascend. `src/systems/firmamentPowers.js` lays the channels on the game's seams through the one
cast engine, so every host reads them.

**The window** (`src/ui/firmamentWindow.js`). Choose a sign; hover to read a star and light the way to it; press to
allocate the way; right-press or long-press to take a star back with everything beyond it. Every change is pending
until Confirm. The side panel sums the sky and says whether the stars act now, and if not, the first reason. Enhanced
Plus draws it in brass and gold, the DFO Grimoire as an inked star chart. Learned lines are red; only the six outer
keystones are named on the sky.

## Rules

- **Path of Exile's structure, with everything online attached; must not break PvE balance** (the lead dev, with the
  owner's switch to on).
- **2 Stars a Renown level; raw points on key stars, percentages on small ones; battle keystones' costs halved; life
  stars carry no negatives; a 10,000 gold respec; build sharing; a Renown rise announced as an Ascend** (the lead dev).
- **The sky fights in the Wrothgarian zone against the beasts** (the lead dev).
- **The Firmament has its own place in the Growth tab** (the owner).

## Daggerfall Unity

DFU has no passive tree. Trading, swimming, climbing, lockpicking and pickpocketing stay DFU's own formulas, reading
the skills the sky raises. One departure: an attribute's sky gain lifts its live ceiling past DFU's `MaxStatValue`,
for the sky's own gains only.

## Code and tests

- `src/net/firmament/firmamentTree.js`, `src/net/firmament/firmamentLaw.js` - the sky and its law
- `src/net/firmament/firmamentBook.js`, `src/systems/firmamentLive.js`, `src/systems/firmamentPowers.js` - client
- `src/ui/firmamentWindow.js` - the window; `firmament.html` - the lab
- `server-account/src/firmament.js` - the service
- `test/net/firmament/firm1_law.test.js`, `test/net/firm1_service.test.js`, `test/systems/firm1_powers.test.js`,
  `test/net/firmament/firm2_balance.test.js`, `test/net/firmament/firm_book_retry.test.js`

## Open

- Guild-wide stars, the market's fee and the courier read by a trader's stars, riding pace and naval gunnery, and a
  Sigil set socketed in the sky are not built.
- The single-town bench (`src/scenes/exterior.js`) has no sky, as it has no Renown.
