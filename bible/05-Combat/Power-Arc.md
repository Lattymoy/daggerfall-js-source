# The Power arc - one budget, chosen powers, the place, the soft cap, the group, the foe, the gate (PWR1-PWR7)

> Design page, written from the measurement before the code (2026-10-23). The slices ship in one pull request, in the
> order of section 3; each is verifiable without the next. Where this page and a shipped slice disagree, the slice's own
> section (4 to 10) is what runs.

## 1. What Mac asked for

Mac, 2026-10-23: *"I think right now theres a lot thats overpowered, advantages being a big player and just an overall
overpowered feel to characters. I want people to have power fantasy but I also want this to be balanced. What are some
large scale ideas we can take on that really bring everything together?"* Seven were offered (one power budget;
attunement; the place sets the player; wider, not taller; the group and the veteran; threat from mechanics; balance as a
test). Mac: *"Lets do all of it. 1 through 7 in its entirety and do it right. No band aids or short cuts"*.

Eight calls were put to Mac, the recommended answer first each time, and Mac took every recommendation:

| | The question | Mac's call |
| --- | --- | --- |
| 1 | How many top-tier power pieces may be awake at once, and when may they be swapped? | **3, swap out of combat** - a fourth piece's power sleeps until attuned in place of another; swapping is instant with no foe near |
| 2 | Sets and Firmament keystones awake together? | **2 sets, 2 combat keystones** - extra keystones stay allocated but sleep; a free respec is offered |
| 3 | Sigils' odds and floor rise with every fighter (SIGIL1's "Bigger fights, stronger sigils"), and party Renown is +10% a member to +70%. Change it? | **Pay by contribution** - the sigil follows a fighter's share of the fight, not the crowd's size; the party's Renown bonus at most +30% |
| 4 | Where does the place's level sync apply? | **Online only, keep a 15% edge** - above a place's band a player is synced to its ceiling and stays about 15% stronger; offline unchanged |
| 5 | At what Renown does vertical power stop, and what does Renown past it buy? | **20; past it, loadouts** - Renown's health and magicka, the sigil stages (re-spaced 1/5/10/15/20) and the active sky's Stars top out at 20; every Star past it fills up to two more saved skies and attunement sets, swapped out of combat, beside titles and cosmetics |
| 6 | How far does the referee even PvP out? | **Templates in refereed lanes** - the duel, the arena and the siege fight on a fixed template (the class and the weapon family; attributes, skills and metal normalized; flat health); the open zone keeps its gear, but a target takes only so much from several players at once, and Renown adds no health |
| 7 | Weekly lockouts on the bosses' top-tier drops? | **Weekly per boss** - each boss rolls Legendary-and-up, set and Gilded pieces for an account once an arena week; repeat kills still pay gold, Marks and Embers (the Elite Gates' weekly law the template) |
| 8 | Characters already over the new limits? | **Nothing taken, extras sleep** - no item, Star or path is deleted; what is over a limit sleeps until the player picks; everyone gets one free Firmament respec and one free specialisation reset |

The Balance arc's standard holds here (`Balance-Arc.md` section 1): a band-aid is a multiplier answering a symptom.
Every law below removes a cause the measurement found, extends a law the port already keeps to the place it did not
reach, or answers a call of Mac's.

## 2. What was measured

`tools/power/` (PWR7's harness, section 10) measures through the game's own code end to end - nothing in it is a scalar
standing in for a system. tools/heroMeasure.mjs, BAL11's measure, multiplied a stated kit (`kitAt`: a weapon line of
+8% to +30%, guards of 0.95 to 0.8) and a stated Renown layer (`onlineAt`) into its sums; the harness wears the pieces
the game's producers mint and lets every registry answer as it does in play:

- **The kits** (`tools/power/powerKit.mjs`): `plain` (heroMeasure's stated player, offline - a longsword and seven
  pieces of plate); `ladder` (the ladder's middles, offline - a Magic blade from 8, a Rare one from 15 with a Flawed
  Diamond, Ansei's Edge from 20; Rare plate from 15; two Legendary pieces and two Legendary jewels from 20); `online`
  (the ladder at Renown 1.5 a level, online - a Rare sigil's middle, Dagon's four pieces at the Renown's stage, the
  Firmament spent by a melee player's greedy route through the sky's own law, the weapon's climb past 100 two points a
  Renown past 30); `stacked` (BAL7's whole kit at Renown 50 - Ansei's Edge with two Flawless Diamonds and an Ascendant
  sigil of 12, Titanheart, Mountain's Root, Raven's Wings and the Visor, three Rares imprinted Dawnward, Last Stand and
  Bulwark, Divine Grace, Hex, Hist-Sap and First Blood, Dagon's four and Nocturnal's two at Ascendant, the whole sky,
  Long Blade, Short Blade and Critical Strike mastered and climbed to 140, the Blademaster's path).
- **The fight** (`tools/power/powerFight.mjs`): a chain of foes of DFU's own encounter band at the kit's level (the
  nineteen dungeon kinds and the three temperate wilderness tables, heroMeasure's), no rest between them, to 50 kills
  or the player's fall: the player's blow and the foe's through `combat/formulas.js` calculateAttackDamage with PCAAO
  as it ships; the foe's blow on through `characters/playerEntity.js` hurtPlayer (every evasion, guard, shield,
  FULL-GUARD and death save); the player's swing by the swing law, a foe's by DFU's melee timer at the player's level;
  the magic round every five seconds (`systems/worldTick.js` runMagicRoundsFor); each kill told as the pools tell it.
  Each foe is scaled as the spawn doors scale one (`scenes/dungeonContext.js` applyProgressionScalingTo,
  `scenes/exteriorFoes.js`): its place's share and its tier's veteran (BAL3 - a dungeon kind by DUNGEON_SHARE and
  DUNGEON_RARITY_TIER, a wilderness table by the day's), the player's climb past 100 the foes answer (the overcap,
  `systems/skillSoftcap.js` combatStanding), and in the hero column BAL11's threat. Seeded: the chain owns Math.random and
  performance.now while it runs. (A first draft of the harness stood every foe at DFU's own numbers, place and overcap
  unread: it overstated every climbing kit - the stacked kit's x1,400 below was x55 in the place - and is not quoted.)

THE MEASURE is a kill's HURT - the health the foes took per kill, as a share of the player's maximum - beside what came
back (HEAL) and the two's difference (COST, heroMeasure's "a kill's cost" with the sustain in it), the seconds a kill
took (TTK), the kills in a row (BAL7's own measure) and the landed blow. The EDGE is the plain build's hurt over the
build's, at the same level: how many times cheaper a kill is in health.

`node tools/power/powerMeasure.mjs` (8 chains a cell), on main at dab1e710d (the harness copied over it, a tree from
before PWR4 read with every Star - powerKit.mjs activeStars):

| level, build | hp | kills | hurt | heal | ttk | blow | edge | with BAL11's threat: kills, hurt, net cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 plain | 115 | 4.0 | 25.0% | 0 | 13.5 s | 7.4 | x1 | 4.0, 25.0%, 25.0% |
| 10 online (Renown 15) | 157 | 9.5 | 10.5% | 0 | 8.2 s | 13.4 | x2.4 | 9.5, 10.5%, 10.5% |
| 10 stacked | 262 | 50 | 0.2% | 0.2% | 3.3 s | 137.5 | x101 | 50, 0.8%, 0.2% |
| 20 plain | 210 | 6.1 | 16.3% | 0 | 10.6 s | 15.1 | x1 | 2.1, 47.1%, 47.1% |
| 20 ladder | 210 | 43.3 | 3.4% | 1.4% | 5.5 s | 32.3 | x4.8 | 13.5, 9.2%, 7.4% |
| 20 online (Renown 30) | 297 | 50 | 0.8% | 0.6% | 3.9 s | 56.8 | x19.3 | 42.9, 3.3%, 1.9% |
| 20 stacked | 357 | 50 | 0.3% | 0.3% | 3.4 s | 169.6 | x55 | 50, 2.0%, 0.9% |
| 30 plain | 310 | 17.3 | 5.8% | 0 | 8.8 s | 21.1 | x1 | 2.9, 34.8%, 34.8% |
| 30 ladder | 310 | 50 | 1.6% | 0.9% | 4.9 s | 39.9 | x3.7 | 7.9, 15.0%, 12.7% |
| 30 online (Renown 45) | 442 | 50 | 0.3% | 0.3% | 3.5 s | 103.0 | x17.6 | 46.4, 3.9%, 1.9% |
| 30 stacked | 457 | 50 | 0.1% | 0.1% | 3.3 s | 184.2 | x60 | 50, 2.8%, 1.1% |

(A kit that heals as fast as it is hurt says "nothing touches it" in its edge, not a size: the stacked kit's net cost is
0.0% at every level. Its TTK is the walk between foes and a swing or two. The plain player offline under BAL11's
threat at level 20 - two kills a life - is BAL11's offline level arm, not this arc's: Mac's call 4 leaves offline as
it is.)

What the table says:

1. **The real online kit is far stronger than the kit BAL11 was sized on.** BAL11 stood its threat on a stated kit of
   the ladder's middles (heroMeasure's `kitAt`, its Renown layer `onlineAt`); the real `online` kit at Renown 30 kills at
   x19 the plain player's cost at level 20, and at Renown 45 x18 at level 30 - and with BAL11's threat on the foes it
   still spends under 2% of a life a kill net of its sustain, where BAL11's own table says a sixth to a quarter. The
   report that started BAL11 ("ppl breeze through the content") is still true, and BAL11's multiplier cannot answer it:
   the gap is the kit's, and the kit is not what BAL11 reads.
2. **The blow's sources multiply.** `systems/entityMods.js` weaponBlowMods ran six registries in a chain - the sigil,
   the sets, the loot's powers, the Firmament, the weapon's mastery, the martial path - each adding its percent of the
   blow the last one left. Each was capped alone (the sky at 30 and 50, the path at 40); nothing capped them together.
   The stacked kit's six add +169% to a blow of 100 in an open fight and compose to +318%; the online kit at Renown 45
   +138% and +217% (`powerMeasure.mjs sources`). Under them the weapon's own lines lay +48% on the roll, and over them
   PCAAO's critical reads Critical Strike 192 - the climb's 140 and the folds' +52, no fold capped - for a critical of
   x2.90 (x2.35 for the online kit at 137).
3. **The guards compose too, and the evasions roll one after another.** The stacked kit turns aside 39% of the foes'
   landed blows whole (Dawnward's charges, the Raven, the sky's evade, one roll each) and lands the rest at 22% of their
   damage; the online kit turns 22% and lands the rest at 59% (`powerMeasure.mjs`, the door read alone).
4. **Every source decides alone.** Taking any one source off the stacked kit at level 20 leaves it at 50 kills and a
   hurt under 1%: the sky (the blow 170 -> 115), the climb past 100 (-> 95), the Legendary jewels (-> 126), the sets, the
   sigil, the path, the gems, the imprints (`powerMeasure.mjs ablate`). No single nerf moves the kit, which is why the
   arc's answer is a law over all of them.
5. **The Renown layer is a second kit.** Renown's +3 health and +2 magicka a level, 2 Stars a level, the sigil stages
   at 10/20/30/40 and the hero's threat keyed to it all grow until Renown 50, some 155 hours (`net/renown.js`
   RENOWN_XP_HOUR_MAX) - a veteran's edge that only time buys.

## 3. The shape

Seven slices, each answering the measurement or a call:

- **PWR1, ONE POWER BUDGET** (section 4): every source adds into a named channel - the blow, the weapon's roll, the
  guard, the evade, the spell, the cast's price, the pierce, the leech, the round's regeneration, the kill's heal, the
  thorns, and the folds' skills, armour and resistances - summed, never chained, then passed through ONE curve per
  channel: whole up to the channel's knee, and past it a hyperbola that approaches its ceiling and never reaches it.
  Every piece still adds; no stack runs away.
- **PWR2, ATTUNEMENT** (section 5): three power pieces awake (Mac's 3), two sets, two combat keystones (Mac's 2 and 2);
  a choice made out of combat; what is over a limit sleeps, never taken (Mac's 8).
- **PWR3, THE PLACE SETS THE PLAYER** (section 6): online, a place's band has a ceiling, and a player above it plays at
  it with a 15% edge (Mac's 4) - mentor mode's overlay, one law for the party and the place - and BAL11's threat
  re-derived on the real kits.
- **PWR4, WIDER, NOT TALLER** (section 7): Renown's vertical layer stops at 20 (Mac's 5); past it Renown buys breadth -
  two more saved skies and attunement sets, titles.
- **PWR5, THE GROUP AND THE VETERAN** (section 8): the sigil by contribution and the party's Renown at most +30% (Mac's
  3); a weekly lockout on each boss's top-tier roll (Mac's 7); the refereed lanes on templates and the open zone's
  many-on-one ceiling (Mac's 6).
- **PWR6, THREAT FROM MECHANICS** (section 9): every foe that can telegraph does; elites and champions carry affixes a
  player reads and answers; the raw multipliers they carried shrink by what the affixes add.
- **PWR7, BALANCE AS A GATE** (section 10): the harness above, a test that runs it at a reduced sample on every pull
  request and fails a change that moves any build's kill out of its band.

Sections 4 to 10 are each written at their slice, from the measurement taken then.

## 4. PWR1 - one power budget

THE CAUSE (section 2, findings 2 to 4): the port's systems were each capped alone and composed with nothing between
them - six blow registries in a chain, a roll an evasion, a percent a guard, the folds' skills with no ceiling at all.

THE LAW (`systems/power/powerBudget.js`, a leaf). Every source answers its percent (or its points) on a named
CHANNEL; the channel's door SUMS them - never chains them - and lands the sum through ONE curve: whole up to the
channel's KNEE, and past it `knee + e x S / (S + e)` (e the excess, S the ceiling's span over the knee) - a hyperbola
that leaves the knee at slope 1 and approaches the CEILING without reaching it. Every piece still adds; no stack runs
away. A sum at or under nothing (a keystone's price) passes whole.

- **THE KNEE is the most one system of the port's gives on that channel unconditionally** - read from that system,
  never restated (`test/systems/power/pwr1_budget.test.js` holds each to its source). A player who leans on one
  system's always-on share never meets the curve; a condition or a window that promises more (First Blood's +60 on a
  first blow, the Seer's mark of 20 off a throw, Soul Well's fifth from a trapped soul) lands on the curve as a stack
  does, and the Stats page says so (below).
- **THE CEILING is one law for every channel: half again the knee** (`CEILING_OVER_KNEE`) - every system together
  approaches half again what one gives alone.

| channel | knee | ceiling | the knee's source |
| --- | --- | --- | --- |
| blow (weapon damage from powers, %) | 30 | 45 | the sky's blow group (`firmamentLaw.js` BLOW_CAP); a Legendary slayer line's top |
| roll (the weapon's own lines, %) | 40 | 60 | a Legendary damage line's top (`lootRarity.js` AFFIX_RANGES) |
| guard (less damage taken, %) | 30 | 45 | the sky's blowTaken |
| evade (a foe's blow missed, %) | 15 | 22.5 | the Raven's Evasion |
| spell (spell damage, %) | 30 | 45 | the sky's spellPower |
| castCut (off a spell's price, %) | 25 | 37.5 | the sky's castCost group (CAST_COST_CAP) |
| pierce (off a saving throw, points) | 15 | 22.5 | Magnus's Gaze |
| absorb (a Destruction spell drunk, %) | 30 | 45 | the Eye of Mora at its top |
| castSpeed (%) | 30 | 45 | the loot's cast speed cap (CAST_SPEED_CAP) |
| pace (the swing, %) | 40 | 60 | the Short Blade's climb past 100 (MARTIAL2's x1.4) |
| leech (of a landed blow, %) | 10 | 15 | the loot's leech cap (LEECH_CAP) |
| regen / manaRegen (a round's, tenths of %) | 10 | 15 | the sky's hpRegen / mpRegen |
| killHeal / killMana (a kill's, %) | 10 / 15 | 15 / 22.5 | Orc Rage / Soul Siphon |
| skill / armor / resist (the folds, points) | 30 / 20 / 50 | 45 / 30 / 75 | a Legendary skill, armour and resistance line's top |

THE DOORS, each summing what it used to chain: `systems/entityMods.js` (weaponBlowMods - every blow modifier asked at
the blow itself, its gain summed and landed, the fraction carried on the weapon; weaponDamageMods the same on the roll;
computeEntityMods the player's folds, whole points, what the curve held back kept as `budgetCut`),
`characters/playerEntity.js` hurtPlayer (the events first; then ONE evasion roll against the evade channel's curve over
every source's chance, its voice the source the roll fell on; then every guard through the guard channel, whole points,
a carry for a foe's blows and one for every other hurt - AUDIT UICALM-FIRM1 L1 M4's law; then the modifiers that are no
percent), `combat/formulas.js` (a blow's LEDGER for the leeches), `systems/worldTick.js` (a round's for the
regenerations), `systems/playerKills.js` (a kill's for its heals) - a ledger lands the curve over its running sum, so
sources that pay one after another land the same whatever their order - `systems/spell/spellPower.js` (the spell and
the pierce), `systems/spellcost.js` (the price), `systems/castSpeed.js`, `systems/absorption.js` (the port's chances
summed, one roll) and `characters/weaponStates.js` (the pace - the leaf handed the curve by `combat/swingLaw.js`, so
`tools/neutral/build-viewer.mjs` can still paste it).

WHAT POOLS AND WHAT DOES NOT. Every source that holds while a condition does - including a window a press or a kill
opens that only adds or lightens (Rallying Cleave, Cyclone, Earthsplitter, Living Aegis, Savage Whirl, War Rhythm) - is a
NUMBER and sums; each such window is under its knee alone, so its words hold. Outside the sums:

- **EVENTS** - a power that turns a blow or a spell WHOLE on its own count, charge, cooldown or window: Dawnward's
  charges, Phantom Strike's window (`systems/martialPowers.js` martialEvade - its own roll, before the channel's), the
  Wardwright's Prismatic Ward (`absorption.js` registerAbsorptionChance `outside`); a death save and its tail (Unbroken's
  halving, at the sets' damage door); and what is no percent (Iron Hide's ward and the Reprieve's shield in points,
  Gearward's winding, Bulwark's flat, Unyielding's ceiling on one hit). Each keeps its own roll or points and its words
  whole, bound by its clock and by how few a player may wake (PWR2).
- **THE SKILL'S OWN** - the weapon's climb past 100 multiplies the landed blow (`registerWeaponBlowMod(..., { outside:
  'skill' })`), as the school's potency multiplies the landed spell (`spellPowerMult`); MARTIAL2's x1.4 is the skill's,
  and the foes answer the climb already (the overcap).
- **THE FLAT POINTS** - an element's sear and the venom (`lootPowers.js` lootSear) and the Burning Gate's sear
  (`sigilSetPowers.js` setSear) are no percent of the blow: `{ outside: 'flat' }`, added after the skill's own, as the
  sear always was "flat on every weapon blow after the per cents". Two units on one blow, as the thorns are.
- **THE THORNS** - Spite's share and the loot's points; a blow paid back never kills (BAL5), so they shorten a fight and
  never end one.
- **DFU's OWN ENCHANTMENTS** keep DFU's channel; and a refereed fight's referee (`net/siege/siegeRef.js`) holds every
  lane where players meet.

THE STATS PAGE (`systems/power/powerSheet.js`, `ui/statsCard.js`): a POWER BUDGET section - each channel with a
standing sum, what the sources add and what lands ("+108.0% -> +42.6%"), the knee and the ceiling in its tip; each skill,
body part and element the folds' curve held back. Read through the doors' own sum readers (weaponBlowGain,
weaponDamageGain, swingPaceSum, evadeChances, guardSum, castSpeedSum, spellPowerSum, spellPierceSum, portAbsorbSum), so
the page and the fight cannot disagree.

THE CEILING, CHOSEN BY MEASUREMENT. Against the stacked kit at level 20, lowering the blow channel's ceiling from 75 to
45 took its edge from x13 to x10 on the first draft of the harness and moved the online kit nothing: the online kit's
edge is many single sources' numbers, each under its knee (an ablation of it - the sky x1.19, the Renown's health x1.30,
the weapon's lines x1.45, the armour's x1.32, the jewels x1.48, the powers x1.19 - multiplies to its whole, and with
every one taken away it stands at x1.2). That edge is the place's to answer (PWR3), not the budget's. A second law was
measured and refused: the strongest source whole and the rest on the curve, which kept every lone power's words but
gave the online kit back x9.3 of its x7 (the blow +31%).

Measured after PWR1, PWR2 and PWR4: section 7's table. A DEPARTURE: Ledger A (PWR1). `test/systems/power/pwr1_budget.test.js`
(10); `tools/mutants/pwr1.json`.

## 5. PWR2 - attunement

THE CAUSE (section 2, finding 4): BAL7's kit wore twelve powers at once - Ansei's Edge, four Legendary armour powers,
three Rares imprinted, four Legendary jewels - and taking any one away left it untouched. A power that is an EVENT is no
number to sum; the answer is how many may be awake.

THE LAW (`systems/power/attunement.js`, a leaf; Mac: "3, swap out of combat", "2 sets, 2 combat keystones").

- **A PIECE THAT CARRIES A POWER** - a Legendary's record, a Rare's imprint, a Gilded record, or (the ladder on) one of
  Daggerfall's artifacts - wakes only ATTUNED; a character holds at most THREE attuned (ATTUNE_MOST). Attunement is a
  stamp on the piece (`attuned`, the order it was given in - `systems/item/itemFields.js`); of the stamped pieces a
  character holds, the three latest wake, and an older stamp (a piece put down while three others were attuned, taken
  up again) is stale and cleared at the settle.
- **A PIECE'S LINES NEVER SLEEP; ITS POWER DOES; A DRAWBACK ALWAYS BITES.** The numbers a piece rolled are its own and
  fold whatever. Its POWER sleeps unattuned: the loot's powers (`lootPowers.js` wornPowers), and DFU's GOOD enchantment
  rows - the types under VALUE_COUNTS_BELOW (`enchantments.js`: an artifact's payloads, a Legendary's held spell). A
  DRAWBACK row (a curse's, the damned blade's Health Leech) runs asleep or awake: a piece left unattuned never sheds its
  curse and keeps its lines (TRUE-CURSE's law).
- **THE RECEIVER'S MARK** - `attuned` joins `net/realm/realmTradeLaw.js` RECEIVER_MARKS: a piece given away comes to its
  new owner unattuned; the wire carries no stamp; a save keeps it.
- **CHOSEN OUT OF COMBAT** (`systems/power/attuneActions.js`): attune and release refused with enemies near (the rest's
  own question, `encounters.js` areEnemiesNearby over the running scene's foes), a fourth refused while three are
  attuned. THE SETTLE, at every equip change and as a save loads: stale stamps cleared, and - out of combat, while there
  is room - every worn piece with a power attuned for the player in the table's order, so a fresh character's first
  Legendary needs no window and a character from before PWR2 wakes its first three worn powers; the rest sleep until
  chosen (Mac: "Nothing taken, extras sleep").
- **THE SWITCH** binds while the ladder is on - and only where the doors are loaded (attuneActions.js registers it;
  lootPowers.js imports it), so no piece sleeps where nothing could attune it. With the ladder off, Daggerfall's
  artifacts are Daggerfall's own.
- **THE SCREENS**: the enhanced pack's Attune and Release on a piece's actions; the card's line ("Attuned: its power is
  awake" / "Not attuned: its power sleeps (attune it out of combat, up to 3 at once)"); the wear comparison previews a
  piece as putting it on would leave it - with room, awake (`attunePreview`, a copy, never the piece).
- **TWO SETS AWAKE** (`systems/sigil/sigilSets.js` awakeSetIds): of the sets worn, the two with the most pieces, then the
  higher stage, then the registry's order; a third sleeps, `limited`, and its card says "two other sets are awake".
- **TWO COMBAT KEYSTONES AWAKE** (`net/firmament/firmamentLaw.js` awakeKeys - the sky's own law, the service judges it
  too): walked out from the start, nearest first, a keystone ending its path, two combat keystones at most and the
  purses (PWR4's Stars to Renown 20); what an allocation holds past a limit sleeps, never taken. The service refuses a
  NEW third (`firm-keystones`), and a sky held past a limit a new law set may only shrink (treeFault's `prev`). The
  window marks a sleeping star and refuses the keystone it cannot wake.
- **NOTHING TAKEN** (Mac's call 8): every character's FIRST Firmament respec is free (migration 0163 `firmament_free`,
  spent in the respec's own batch, the record still moved on) and its first specialisation reset is free
  (`systems/specReset.js` freeSpecReset, the save's `freeSpecResetUsed`).

A DEPARTURE, the artifacts' arm: DFU's EntityEffectManager runs an equipped artifact's payloads whenever it is worn.
Ledger A (PWR2). `test/systems/power/pwr2_attunement.test.js` (9); `tools/mutants/pwr2.json`.

## 6. PWR3 - the place sets the player

(Its slice follows in this pull request.)

## 7. PWR4 - wider, not taller

THE CAUSE (section 2, finding 5): every Renown layer - its health and magicka, the Stars, the sigil stages, the loot's
ease - grew to Renown 50, some 155 hours: a veteran's edge only time buys.

THE LAW (Mac: "20; past it, loadouts"): ONE SOFT CAP, 20 (`net/renown.js` RENOWN_SOFT_CAP, restated in
`net/firmament/firmamentLaw.js` FIRM_RENOWN_SOFT_CAP so the Worker's graph stays small, the two held equal).

- **Renown's health and magicka** stop at Renown 20's (`renownPower`, `renownBonus`): +57 and +38.
- **The Stars a sky in force spends** are Renown 20's (`activeStarsFor`: 38); the window and the service count the same
  purse, and a sky held past it may only shrink, the rest asleep.
- **The sigil stages re-spaced** to 1, 5, 10, 15, 20 (`systems/sigil/sigil.js` SIGIL_STAGES - Ascendant at the soft
  cap); the sets' stage (the lowest piece's under the Renown's) with them. The loot's Renown ease (`systems/renownLoot.js`,
  RENOWN-LOOT) reads the sigils' own five stages, so it moves with them: LOOT-EASE's whole now at Renown 10, its top - one
  and a half - at Renown 20, where it was 40. Recorded, not hidden: the ease reached sooner is the same ease, topped
  where every other Renown layer tops.
- **PAST 20, BREADTH**: a second sky kept aside at Renown 30, a third at 40 (`FIRM_SKIES_AT`, `skiesFor`), each with the
  attunement set it was put aside with (the save's `attuneSkies`, by the pieces' ids); `POST /v1/firmament/swap`
  exchanges the sky in force with a slot in one batch over the tree it was asked over (migration 0164
  `firmament_skies`), free, out of combat (the window asks the rest's question); the long road's three titles -
  Renowned at 30, Paragon of the Bay at 40, Legend of the Iliac at 50 (`net/identityToken.js` RENOWN_TITLES, appended to
  the closed vocabulary - the relay's world248) - derived from the account's best Renown (`server-account/src/honours.js`,
  `titles.js`) as the founder is from a date; the Collections page lists them.

The account service is acct177 (two migrations, the swap route); the relay world248 (the vocabulary).

MEASURED AFTER PWR1, PWR2 AND PWR4 (`node tools/power/powerMeasure.mjs`, 8 chains a cell, the same harness as section
2):

| level, build | hp | kills | hurt | heal | ttk | blow | edge | with BAL11's threat: kills, hurt, net cost | before (section 2) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 plain | 115 | 4.0 | 25.0% | 0 | 13.5 s | 7.4 | x1 | 4.0, 25.0%, 25.0% | x1 |
| 10 online (Renown 15) | 157 | 7.6 | 13.1% | 0 | 9.1 s | 12.4 | x1.9 | 7.6, 13.1%, 13.1% | x2.4 |
| 10 stacked | 172 | 34.1 | 2.9% | 0.1% | 4.6 s | 56.3 | x8.6 | 19.8, 5.1%, 5.1% | x101 |
| 20 plain | 210 | 6.1 | 16.3% | 0 | 10.6 s | 15.1 | x1 | 2.1, 47.1%, 47.1% | x1 |
| 20 ladder | 210 | 23.6 | 4.2% | 0 | 6.2 s | 29.4 | x3.9 | 8.8, 11.4%, 11.4% | x4.8 |
| 20 online (Renown 30) | 267 | 45.8 | 2.1% | 0.1% | 5.0 s | 35.0 | x7.7 | 12.9, 7.9%, 7.8% | x19.3 |
| 20 stacked | 267 | 38.1 | 2.7% | 0.1% | 4.9 s | 71.4 | x6.1 | 8.9, 11.4%, 11.3% | x55 |
| 30 plain | 310 | 17.3 | 5.8% | 0 | 8.8 s | 21.1 | x1 | 2.9, 34.8%, 34.8% | x1 |
| 30 ladder | 310 | 48.6 | 1.7% | 0 | 5.2 s | 36.9 | x3.4 | 7.1, 14.0%, 14.0% | x3.7 |
| 30 online (Renown 45) | 367 | 50 | 1.1% | 0.1% | 4.5 s | 55.4 | x5.1 | 7.3, 13.9%, 13.8% | x17.6 |
| 30 stacked | 367 | 50 | 1.5% | 0.1% | 4.9 s | 77.8 | x3.9 | 5.0, 20.2%, 20.0% | x60 |

What it says:

1. **The stack no longer runs away.** The stacked kit - every system at its top - kills at x4 to x9 the plain player's
   cost where it was x55 to x101, and is no longer stronger than the online kit at levels 20 and 30: past the knees,
   more pieces buy less (its blow +169% summed lands +100% - `powerMeasure.mjs sources` - where it composed to +318%).
   Its sustain is gone with the ledgers (a kill's heal 0.1% of a life, from 0.2% to 0.3%): it pays for its kills.
2. **Under BAL11's threat every kit pays.** The online kit at level 20 spends 7.8% of a life a kill net, at 30 13.8%;
   the stacked kit 11% and 20% - inside BAL11's own sixth to a quarter at level 30, where before they spent under 2%.
   The hero's threat now meets kits it can move.
3. **The online kit's edge is the place's to answer.** x7.7 at level 20 is many single sources, each under its knee
   (section 4, the ablation): the budget bounds a stack, not a kit of honest pieces. That edge outside the hero's
   threat - the zone a level-20 character walks into - is PWR3's (the place sets the player, a 15% edge).
4. **The ablation, after**: no single source decides now - taking any one away moves the stacked kit at level 20 by a
   few kills either way (the sky 39.8 -> 35.8, the jewels -> 36.0, the climb -> 44.4 at a blow of 43, the foes'
   overcap standing down with it); the budget, not any one system, is what holds it.

A DEPARTURE: Ledger A (PWR4). `test/net/firmament/pwr4_soft_cap.test.js` (5); `tools/mutants/pwr4.json`.
