# Horse care (STEED1, 2026-10-11)

The owner: "On top of this system, I want to build the new horse and wagon maintence systems. Horse should have
stamina, feeding them grows your bond and improves their stats. Every horse should have different stats." Wagons are
`06-Systems/Wagon-Upkeep.md` (WAGONS4); this page is the horse.

A departure of the port's own, the enhanced lane's alone: Features, World tab, Travel - **Horse care**, the
`horseCare` pref - three tiers since HORSE-TIERS (below): Off, Boons (the default) and Hard, each player's own online.
Off, a horse is DFU's: no stats, no walk or gallop of its own, nothing to feed - at once, at every door the tier
governs (a player's "the horse care toggle in the settings menu doesn't seem to work" was traced so,
`01-Overview/bugs/Field-Bugs-2026-10-14-riding-panel.md`, and Mac's word on it made the tiers). The saddle panel stands in
every tier: it is the ride's, and Off it shows the gait and its doors alone.

## The tiers (HORSE-TIERS, 2026-10-15)

> Mac: *"Allow turn off. Rework this system to be more in line with how we handle climates and calories boons."*

Climates & Calories' model (`06-Systems/Climates-Calories.md` - SURV-TIERS, SURV-BOONS, BOONS-DEFAULT, AUDIT C&C) laid
over the horse: **one key, three answers**, the tiers written out as data in `systems/upkeep/upkeepTiers.js` (an
import-free leaf, as `survival/difficulty.js` is - wagon upkeep's tiers stand beside them since WAGON-TIERS,
`06-Systems/Wagon-Upkeep.md`).

| Tier | Stored (the `horseCare` pref) | What the horse pays |
|---|---|---|
| Off | `false` - the old switch's own | nothing: it is DFU's horse - no stats, one pace, no gallop of its own, nothing to feed |
| Boons - the default | nothing (PREF1: a default is never stored) | nothing below DFU's horse - its care earns, its neglect costs nothing |
| Hard | `'hard'` | the system as STEED1 and HORSE-WALK built it - everything below this section, as it stood |

**Boons is not Hard with the numbers turned down.** Its rules, each a field of `HORSE_CARE_RULES` because the tiers
differ on it:

1. **Same world.** The stats, the bond, the food clock, the breath and every word are the world's in both tiers - a
   Boons rider's horse is Hungry and Starving as a Hard one's is, and a Stable's three are the same three.
2. **Nothing is ever taken.** Hunger takes no stat and slows no breath (`hungerCosts`); starving fades no bond
   (`bondFades` - the keep holds a starving horse's food clock at the starving line, so a turn to Hard owes no fade for
   the Boons days, and a Boons meal never takes one); the ride's pace is never under DFU's (`paceFloor`: Speed's scale
   never under 1, so a born-slow horse rides at DFU's pace); a team never drags a loaded wagon (`draftDrags`).
3. **A horse kept earns.** The bond every meal grows raises every stat - a fast horse's pace, a longer gallop, a quicker
   breath; a horse fed and with its breath gallops on Run. Starving or winded the gallop is not earned, and a gallop
   asked and refused rides DFU's own pace, never the walk (`refusedRunWalks`; the motor tells the walk whether Run is
   asked - `systems/transport.js` rideWalks' `runAsked`): with Run held a Boons horse is never slower than DFU's. With Run
   let go it walks - HORSE-WALK's way to ride, the owner's, every caring tier's, and no price of neglect (a tended horse
   walks too). Mac, 2026-10-15: *"Keep the walk"* - DECIDED: Boons' "never below DFU's horse" is the pace with Run held;
   the walk with Run let go stands on every caring tier.
4. **No red** (Climates & Calories' rule 4, RED MEANS IT COSTS). Where hunger costs nothing its chip stops at amber - the
   saddle panel's (`ui/enhanced/enhancedSaddle.js`) and the Stable card's (`ui/holdingsPages.js` hungerTone) - and the Stable
   page says only what Boons charges: "Hungry - it costs nothing yet.", "Starving - no gallop until it eats. Feed it."

**Off's minutes are nobody's needs** (Climates & Calories' Off, SURV-TIERS). Off, a horse is DFU's and needs nothing, so
the keep carries every horse's food clock with the clock (`systems/upkeep/upkeepRuntime.js` tick): on again it stands where
Off found it, neither starved nor faded. AUDIT STEED1's reset of the keep's own span at the switch's Off stands beside
it and now decides nothing - recorded so (`tools/mutants/steed1.json`, its equivalent record).

**One accessor.** Every reader asks the tier through `systems/upkeep/upkeepSwitch.js` horseCareRules - the live tier's rules,
null for Off and on any skin but the enhanced one: the upkeep's keep and breath, the gallop gate, the walk, the ride's
pace, the HUD's breath bar, the Stable page, the saddle panel and the oats' Use (`systems/upkeep/upkeepRuntime.js`'s doors and
registerUpkeepUses, each handed the accessor by the two hosts that ride), and a Stable's prices (`scenes/worldModes.js`,
a horse priced by what it is in any tier but Off). The laws take the rules as an argument (`systems/steedCare.js`
steedStats, stepBreath, steedSpeedScale, teamDraftScale, feedHorse, tendHorses), and a law handed none runs Hard, so
every pin written before the tiers still pins it. The boolean switch is gone; the shelf's key has one reader.

**Online.** Every tier, Off included, is the player's (`online: 'player'`) - Climates & Calories' reading (MODS-ONLINE-3):
a tier decides only what THIS player's horse pays. The horse's fields ride the wire as they always did, a Stable's
three horses are the town's in every tier, and only their price is the buyer's tier's.

**Moving the players already on it** (`systems/uiPrefs.js` loadPrefs, SURV-TIERS' way). The key is unchanged, and so is
Off's stored value: a player who turned horse care off stored `false` and is on Off with nothing converted - and a build
from before the tiers reading the same shelf still reads it as off. The old default, On, was never stored (PREF1), so a
player who never touched the switch stored nothing and plays the new default, Boons - BOONS-DEFAULT's reading. An On
written to the shelf all the same chose the system as it stood, and lands on Hard (written so at the next save). Any
other value names no tier and is dropped at the load. No save holds the switch: a horse's own fields (`horseBond`,
`horseFed`) are its world, and no tier rewrites them but by its law. The shelf is in the account Worker's bundle, so the
tiers' leaf is too, and the account deploy's path filter names it (`.github/workflows/account-deploy.yml`, ACC4's walk).

Pinned: `test/systems/horsetiers.test.js` (7 - the one key, the switch online, Boons never below DFU's horse, the shelf, Off's
minutes, no red, the one accessor); mutants `tools/mutants/horsetiers.json` (20, all dead). The pins written before
the tiers pin Hard, PIN MOVED where their vocabulary did: the upkeep is handed Hard's rules where it was handed `true`.

## The law (`systems/steedCare.js`)

### Four stats, each horse its own

A horse's seed is the horse (COATS1 - `06-Systems/Horse-Coats.md`: rolled at its birth, never changed), and its stats
are its seed's: each the mean of two draws off the seed, 20 to 80, most near 50 (`bornStats`). No field holds them,
so every horse born before STEED1 has had its stats all along, and every client reads the same horse the same.

| Stat | What it does |
|---|---|
| Speed | the ride's pace - its walk and its gallop (THE WALK) times 0.85 + 0.003 a point: 1 at 50, held to [0.85, 1.15] (`steedSpeedScale`) - on Boons never under 1 |
| Stamina | its breath: STAMINA_BASE 40 + 1.2 a point (`breathMax` - 100 at 50) |
| Endurance | how slowly a gallop spends the breath (x 1.25 - Endurance / 200) and how fast it comes back (x 0.75 + Endurance / 200) |
| Strength | a wagon's pace under its load: 1 - load x (0.3 - 0.002 x Strength), never under 0.75 - the team's mean (`teamDraftScale`) - on Hard; on Boons no team drags |

A stat as it stands is its born value, plus a point for every five of its bond (BOND_STEP), less its hunger's penalty
on Hard, held to [1, 100] (`steedStats`).

### The bond (`horseBond`, in tenths)

Grown by feeding: a day's food is three points (DAY_BOND_TENTHS 30), times the food's love. Its word: Wary (0),
Accepting (15), Familiar (35), Trusting (55), Devoted (75), Kindred (95). A Kindred horse is twenty points better on
every stat than the one bought. The bond is its OWNER's: `net/realm/realmTradeLaw.js` RECEIVER_MARKS strips it from a
traded horse, so it comes to its next owner a stranger. So is its food's clock (`horseFed` is a minute of its owner's
character's clock, AUDIT STEED1 - a buyer a year behind would have had it fed a year ahead): it comes fed as a horse
first seen, and a minute's grazing never makes an offered horse's record mismatch its checkpoint.

### Hunger (`horseFed`, the minute of the character's clock its food runs out)

Hard's (Boons charges none of it - no stat, no breath, no fade - and a starving horse there only does not gallop):

| | From | Stats | Breath back |
|---|---|---|---|
| Fed | food in it | - | x 1 |
| Hungry | its food run out | -10 | x 0.7 |
| Starving | two days on (STARVING_AFTER) | -25, and no gallop | x 0.4 |

It never dies of it - nor of anything else: HORSE-LIVES (2026-10-12, the owner: "Horses shouldnt die") pins it -
a year with its owner and no food leaves it in the pack, starving, its stats held to 1, its bond to nought, ridden at
Speed's floor; a sack of oats and it is fed again. A starving horse's bond fades two points a day - kept as the time it has starved, and taken off
ONCE, when its food clock next moves (a meal, the stable, grazing), so it is never counted twice. A horse first seen (a
purchase, a horse owned before STEED1) comes fed twelve hours ahead.

### What it eats

| Food | Hours | Love | Where |
|---|---|---|---|
| Sack of Oats (1710, STEED1's own - `systems/upkeep/upkeepItemRows.js`) | 24 | 1 | a Stable sells them; Use one, or the Stable page |
| Apple (Climates & Calories' 532, Foraging's 1608) | 4 | 1.5 | by hand, from the Stable page - a treat |

A horse fed more than FULL_AHEAD (30 hours) ahead is full and refuses; it holds FED_AHEAD_MAX (48) at most. A quest's
piece is never fed.

### The keep (`tendHorses`, once a game minute)

Where a horse is decides who feeds it (`systems/upkeep/upkeepRuntime.js` horseWhereOf, off Horse Cart and Cargo's Stable view):

- **With its owner** (ridden, pulling, following, in the harness of a wagon that follows, beside its owner on foot
  and never sent away - the mod's WithPlayer, WAGON-STABLED - or the mod off, or without its physical persistence: the
  classic transport goes where its owner goes): fed by hand; and across any span of the
  clock skipped (SKIP_MINUTES, an hour - a rest, a wait, a journey), it eats a sack of oats each time its food runs
  out, while they last, its bond grown as by hand - the pack's first, then the wagon's load where the wagon is in reach
  (the hosts' `stores`: Horse Cart and Cargo's storage reach, upkeepReach's wagonNear). The Stable page's Feed and its
  counts read the wagon's load the same way.
- **Waiting** in the world (left loose, or in the harness of a parked wagon): it grazes - hungry, never starving.
- **Stabled** (sent away from the Stable page, out of the world - the runtime's `HorseStabled`, WAGON-STABLED,
  `03-World/Holdings.md` section 2): the stable feeds it.

Grazing or stabled, a span the keep did not run across (an inn's rest, a dungeon: no frame ticks indoors) costs it no
bond - only a fade owed before the span is taken (AUDIT STEED1). The keep's clock is the character's: a load and a new
character start it afresh (`upkeepRuntime.js` reset, at every door the world host loads through), and so does the
tier turned Off - a horse is never fed back a span from a minute another character or session last kept it - and Off
carries every horse's food clock with the clock (THE TIERS: Off's minutes are nobody's needs).

### Breath (`stepBreath`, kept in memory by the horse's seed - a gallop's breath is not a thing to save)

A gallop spends it; at nought the horse is WINDED and will not gallop until WINDED_UNTIL (30%) is back. It comes back
standing or with its rider off it (BREATH_BACK 2.2 a second at Endurance 50), half as fast under a rider at its own pace
(RIDDEN_BACK - the walk, since HORSE-WALK), slower hungry, and whole across any span skipped. An average horse gallops
some thirty seconds and is back to 30% in about fifteen.

## The gallop (`systems/transport.js` setGallopGate)

The run key on a horse is the gallop. DFU forbids a run in the saddle (CanRunUnlessRiding); Roleplay & Realism's
Enhanced Riding allows it outside towns, and inside them under its Galloping In Towns, which the port ships on
(`rrCanRunRiding`; TOWN-GALLOP, below). Horse care's word comes after the mod's: where the mod says no (a town, with
Galloping In Towns off), no; where it says yes or says nothing, the horse gallops on its breath - never winded, never
starving. The gallop is the horse's breath, not the rider's fatigue: the hosts' activity bag (`running`) leaves a
gallop under horse care out of DFU's running band (`upkeepRuntime.js` riderPaysGallop).

## The walk (HORSE-WALK, 2026-10-12)

The owner: "I want to make it where when youre riding a horse, it walks by default and to gallop you must shift to
sprint, just like when you are walking as a character". DFU's horse has one pace, GetBaseSpeed's riding arm on
dfRideBase (375): 10.8 m/s at Speed 50, which every picture already drew as a gallop (Eye Of The Beholder's table
gallops past 10 m/s, `player/eyeOfTheBeholder/eotbBillboard.js` GALLOP_SPEED; the Courser from 5, `world/horseModel.js` HORSE_GAIT_FROM);
and the run galloped it faster still. Under horse care a horse WALKS, and the run gallops it:

| | The law | Speed 50, Running 50, a horse of Speed 50 |
|---|---|---|
| The walk - the default | GetBaseSpeed's riding arm on DFU's own walk base, dfWalkBase (150), undragged as every ride arm is: (Speed + 150) / 39.5 | 5.1 m/s, 18 km/h |
| The gallop - Run held, on its breath | GetRunSpeed's riding arm, as ever: (Speed + 375) / 39.5 x (1.35 + Running / 200) | 17.2 m/s, 62 km/h |

Both times the horse's Speed (the motor's rideSpeedScale, below). The walk is the horse's BASE, as a walk is its
rider's on foot, so what measures against GetBaseSpeed reads it so: IsMovingLessThanHalfSpeed - the stealth check's
gate, the clop's - is false at a walk and true at a sneak (the walk halved, less a classic unit), exactly as on foot. A
walking rider is no stealthier than a walking traveller.

`systems/transport.js` setRideWalk / rideWalks is horse care's word, the gallop gate's twin; `systems/upkeep/upkeepRuntime.js`
rideWalks gives it wherever horse care rules the gallop - a tier but Off, a horse, the one ridden born (without its stats
the gate defers to the mod, and the walk to DFU); `player/motor.js` takes it (`_rideBaseNow` - the walk's base, in the
speed's riding arm and the half-speed base; `rideWalking` - the step's gait; `slowRide` - walked, or under half its
base). Off horse care a horse is DFU's - one pace, no run in the saddle, the mod's gallop where it rules: a walk with no
gallop to shift into would hold its rider to it. A cart rolls on its own base. On Hard a winded or starving horse walks
with Run held, as does one in a town wherever Roleplay & Realism's Galloping In Towns is off (the mod's own default - the
port ships it on, below); on Boons a gallop asked and refused rides DFU's own pace (THE TIERS, rule 3) - the walk is
told whether Run is asked (rideWalks' `runAsked`, the motor's `_runMode`); autorun's latched run gallops whenever the
breath allows.

**IN A TOWN IT GALLOPS TOO** (TOWN-GALLOP, 2026-10-13, Mac: "Remove forced horse walking in towns"). Roleplay &
Realism ships Galloping In Towns off, and AUDIT HORSE-WALK kept the owner's walk under the mod's town: there the mod's
CanRun said no, so the horse walked with Run held - 5.1 m/s at Speed 50, where its rider runs 8.1 on foot - and online,
where horse care was forced on then, every rider walked every town. The port ships the switch ON (`systems/modSettings.js`,
the mod's third recorded departure - `06-Systems/Roleplay-Realism.md`), so a town is ridden as the road is: the walk
unless Run gallops it, on its breath. The room reads it on too (Roleplay & Realism is the room's whole -
`systems/online/onlineLane.js` ONLINE_WHOLE_MODS reads the port's default). No tile ever reached the switch (FT14 took the Mods
pane before RR2 brought it), so no player holds a saved off, and nothing is reset. The mod's trample rides with the
gallop into a town, as the mod pairs the two (TrampleCivilians, shipped on; `systems/roleplayRealism/rrRidingHost.js`): a gallop into a
townsperson tramples them - Assault, and the watch called - and the Horses tutorial says so ("Don't gallop into people
in town: trampling them is a crime"). Pinned through the mod's own CanRun line, lifted from `systems/roleplayRealism/rrInstall.js` and
run over the real upkeep and motor (`test/systems/horsewalk.test.js`, IN A TOWN): as the port ships it, Run gallops a horse in a
town and its release walks it; the room's on whatever a player saved; and the mod's own rule, Galloping In Towns off,
walks it in a town with Run held and gallops it out of one. A cart is unchanged - the mod never lets it run, in a town
or out - and rolls on DFU's cart base, 7.6 m/s at Speed 50: above the walk and under the gallop, as it always stood under
DFU's ride.

**ON THE ROAD THE RIDE KEEPS ITS PACE** (AUDIT HORSE-WALK, 2026-10-12, the owner: "Ensure the overworld speed isnt
affected"). The Overworld moves the real body under the travel clock (`06-Systems/Travel-View.md`), so its ground speed
is the motor's pace times the clock - and a walk would have halved a horse's (TV0's ~650 m/s at x60 to ~300), slowed a
journey's, and let a band's chase (5.2 m/s at the world's scale) close on a rider. So the walk is never the road's:
under the Overworld's view (rising, up or falling) and while a Travel Options journey's autopilot drives the motor - the
view's journeys, its journey held on the ground at x1, First-Person Travel's, a party's - the horse rides the ride's own
pace and gallops on Run exactly as before the walk (`scenes/world.js` rideOnTheRoad, over the walk's install; a
journey's panel left up over a stopped journey is no road). The clock, its governor and the pace dials read no pace of
the body's and are untouched; the steering's reach and the ground's lookahead read the motor's, the ride's again. The
fixed city (`scenes/exterior.js`) stands no Overworld and runs no journey.

What reads the gait:

- **The riding sprite and its clop** (`systems/riding.js`, `player/mountRig.js`): a walk is DFU's slow horse - the slow
  clop at half the volume - as a STATE, not the half-speed edge (a ride that starts at a walk never crosses the line,
  and UpdateMode mounts on the fast clop); its sprite nods on WALK_FRAME_TIME, 0.25 s - twice DFU's 0.125, a cycle the
  ground DFU's own ride covered in one of its. The gallop keeps every DFU arm: the fast clop off the edge, 1.2 pitch,
  0.125 s.
- **The others' clop**: the pose's `hs` carries the slow ride (`scenes/world.js`'s latch reads `slowRide`), and a peer's
  animator plays it as the rider's own plays the walk - a state (`net/remotePlayers.js`, AUDIT HORSE-WALK: on the edge
  alone, a peer first seen at a walk or mounting into one clopped fast until a first gallop) - with the gallop's 1.2
  pitch off the pose's gallop bit (mv 2; every peer's gallop had been heard at 1.0 since STEED1). So a peer hears my
  walk and my gallop as I do. The wire is unchanged; an older client swaps on the edge alone.
- **The 3D horse** (`06-Systems/Horse-Coats.md`, The 3D horse): a slow ride never gallops (`world/horseModel.js`
  gaitFor's `gallops`) - the player's off the host's word (`horse.slow`, `player/mwView.js`), a peer's off its pose's
  `hs` (`net/peer/peerBodies.js`). Daggerfall's walk stands on the gallop's own edge, inside its hold either way, so the gait
  was its history's: a trot from a stand, a slow-motion gallop after a gallop. Held under, it trots - the Courser's
  stride that carries 5 m/s (its walk covers 0.67).
- **Eye Of The Beholder's rider** draws MoveHorse at the walk and GallopHorse at the gallop, by its own speed law.
- **The saddle panel** says Walking (`ui/enhanced/enhancedSaddle.js` saddleGait - the very walk the motor took, its
  `rideWalking`, handed by the host's frame through `scenes/saddleHost.js` motion: HORSE-TIERS, since only the motor knows
  a gallop asked and refused), Galloping on the run, Trotting at DFU's ride (Off, and on Boons a gallop refused).
- **The head's bob** is DFU's Horse style at the walk, by its velocity; the gallop's is Running's (HeadBobber's order).
- **The words**: the Features row, and the Horses tutorial ("Your horse walks; hold {Run} to gallop. Don't gallop into
  people in town: trampling them is a crime." - IN A TOWN IT GALLOPS TOO, above).

Unchanged: the Overworld's and a journey's pace (above), the breath's law (under a rider at its own pace, now the walk,
half back), the gallop's gate and pace, fast travel's times (DFU's TravelTimeCalculator), a following or waiting horse.

## The motor (`player/motor.js` rideSpeedScale)

The hosts hand the motor its ride's pace each frame, before its step (`upkeep.rideScale`): a horse's Speed; a wagon's
soundness (WAGONS4) times its team's Strength under its load. It scales the ride's walk (THE WALK), the gallop and the
half-speed base IsMovingLessThanHalfSpeed reads; it never touches a walk on foot. The fastest horse's gallop at Speed
100 is under the hitch's jump (HITCH_JUMP_SPEED 30).

## The Stable page (`ui/holdingsPages.js`)

Each horse its card: the ridden one's (its name, its look, its coat rows) and every other horse owned. On each, its bond
and hunger in words - a fed horse with the hours its food lasts (STEED-UI) - its **Bond** a bar from its word to the
next with the points still to go (whole at Kindred), the ridden one's breath (Winded said in words), its four stats
with the bond's share beside and each stat's making on its tooltip (born, the bond's points, hunger's), **Feed oats**
and **Give an apple** (dark with none, full, or away), and **Ride this one** on every other - the chosen horse made the
pack's first (`chooseRiddenHorse`), so its look, its breath and its stats are the ridden ones. A horse is fed by hand
only within Horse Cart and Cargo's own mount reach (a horse waiting across the map is not), and never at the stable
(`upkeepRuntime.js` upkeepReach).

**Every horse owned, on every tier** (FIELD BUGS 2026-10-16b HORSE-CARE-OFF; a player: "turning horse care off completely
hides my other horses"). The horses are the player's whatever the tier; only their care is the tier's. Off - and on any
skin but the enhanced one, where the one accessor answers null - every other horse owned still has its card ("Another
horse of yours", its look in words) and **Ride this one**, and the choice is the same `chooseRiddenHorse`; what drops
is the care: no hunger chip, no bond, breath or stats, no Feed oats or Give an apple. The upkeep's `model()` lists every
horse on every tier (its place, whether it is ridden, its name, its look), and the care's fields beside them only
where horse care rules. Before, the model built its list only under a tier, so Off the page drew the ridden horse alone
and no other could be chosen (`01-Overview/bugs/Field-Bugs-2026-10-16b.md` HORSE-CARE-OFF). Pinned:
`test/systems/horse/fb1016b_horsecareoff.test.js`; mutants `tools/mutants/fb1016b_horsecareoff.json`.

The HUD: the ridden horse's breath in the climb's grip bar's place (a rider holds no wall) - the classic HUD's bar
(`ui/hud/hud.js` drawGripBar), the enhanced HUD's under the word Horse (`ui/enhanced/enhancedHud.js`); short when winded, under a
quarter, or starving.

## The saddle panel (STEED-UI - `10-UI/Controls.md`, THE SADDLE PANEL)

On Enhanced Plus, astride or on a wagon's bench, the horse is on screen under the compass (`ui/enhanced/enhancedSaddle.js`, off
`upkeepRuntime.js` saddle): its breath, its hunger with its food's hours, its bond to the next word, the gait and the
pace; and its doors - Feed oats, an Apple, the Stable page, Dismount. On a bench the hunger is the TEAM's (the
hungriest horse in harness, `saddle`'s `feed` - the one its Feed goes to) and the bond the lead's. It is a HUD-MOVE
piece (HUD-SADDLE, 2026-10-14): Alt+U moves it, sizes it and turns it off (`10-UI/Controls.md`, THE SADDLE PANEL).

The item: a horse's card says its four born stats and its bond (`systems/item/itemInfo.js` itemStatRows), so a Stable's
horses say theirs before they are bought.

## The Stable's horses (`systems/merchantYards.js` stableHorses)

A Stable stands STABLE_HORSES_OFFERED (3) horses a day, each born at the yard on a stream of the town's map id, the
world's day and its stall - every client in the town that day sees the same three, another day another three - and a
horse the buyer already owns is not stood again. Priced by what it is while horses are cared for (`steedValue`: DFU's
1000 at a mean of 50, a fiftieth of it a point either way, never under 400). It sells oats beside them, in a stack of
YARD_OATS_STACK.

## Online

The fields ride the wire as every item field does (`systems/item/itemFields.js` horseBond 1..1000, horseFed 1 up; the item
law holds them to DFU's Horse alone). The new templates followed REST6's law, SHIP BEFORE ANYONE CAN SEE ONE:
UPKEEP_ITEMS_ONLINE was false for the release that shipped them (#791). UPKEEP-ONLINE (2026-10-12, the owner: "We
never added oats or repair kits to the new horse/wagon system") turned it on - every release since has carried the
templates - so online a Stable sells oats as it did offline from the first (`systems/upkeep/upkeepItemRows.js`).

## The four hosts

`scenes/world.js` and `scenes/exterior.js` build the upkeep (`createUpkeep`, handed the one accessor `horseCareRules` -
HORSE-TIERS) before Horse Cart and Cargo's runtime, set
the walk (`setRideWalk`, HORSE-WALK - world.js's never on the road, the Overworld's and the journeys' host) and the
gallop gate, hand the 3D horse the motor's slow ride, register the oats' Use, hand the motor its pace and the frame's
upkeep its odometer's metres, the HUD its bar and the Stable page its acts. `scenes/worldModes.js` (interiors) and
`scenes/dungeonContext.js` (dungeons) stand no transport - a building or a dungeon puts the rider on foot
(`transport.js` dismountOnTransition) - and are named, not wired; worldModes.js reads the accessor for one thing, a
Stable's prices (its counter stands indoors).

Pinned: `test/systems/steed1_horsecare.test.js`; mutants `tools/mutants/steed1.json`, and HORSE-LIVES's and UPKEEP-ONLINE's
`tools/mutants/wagonmend.json`. THE WALK: `test/systems/horsewalk.test.js`; mutants `tools/mutants/horsewalk.json` (40, all
dead - TOWN-GALLOP retired the town walk's two with their law) and TOWN-GALLOP's `tools/mutants/towngallop.json` (7,
all dead). The saddle panel and the page's polish:
`test/systems/steedui_saddle.test.js`; mutants `tools/mutants/steedui.json`. The panel as a HUD piece:
`test/ui/enhanced/fb1014_ridingpanel.test.js`; mutants `tools/mutants/fb1014_ridingpanel.json`. THE TIERS: `test/systems/horsetiers.test.js`;
mutants `tools/mutants/horsetiers.json`.

## HORSE-VOICE (2026-10-24): the breath heard

Horse care's breath is heard on the enhanced skin with the port's own sounds on (`systems/horse/horseVoice.js`; the record is `08-Audio/Audio.md` HORSE-VOICE). The saddle's breath (`upkeepRuntime.js` `bar` - the share, `amount`) reaches the rig as `horseBreath` (`world.js:"surfaceKind: () => _lastFootstepKind, foesNear: () => areEnemiesNearby([...cityGuards.guards, ...exteriorFoes.foes]), horseBreath: () => upkeep.bar(player.transportMode),"`). A horse galloping with its breath under 0.4 breathes hard in its stride at once, where a fresh one does so only past 8 s of gallop. At the walk or standing it blows and breathes heavily every 2.2-3.4 s until the breath is back over 0.4. Its moments on DFU's neigh clock are the tired mood's, mostly blows. Off horse care there is no breath, and a long gallop leaves its own short blowing - where a rider gallops at all: with horse care off a mounted rider runs only under Roleplay & Realism's riding, so without it the gallop's breath and blowing never come (AUDIT SOUNDSCAPE H8). The walk is the slow clop's state (THE WALK), and its voices are the calm mood's: soft snorts and blows. THE FOUR HOSTS: world.js and exterior.js hand the rig the ground's kind, foes in sight and the breath; worldModes.js and dungeonContext.js stand no mount.
