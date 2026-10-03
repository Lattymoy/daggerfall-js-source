# Naval Combat - the sea fight (NAV-A to NAV-H, 2026-09-28)

Mac, 2026-09-28: "We have a lot of cool updates on the way. Today were going to be doing something extremely
detailed. We're going to enhance the newly integrated ships by adding proper navel combat with a huge reference to
assiasins creed black flag. Being able to aim and fire when viewing from the side. Along with this, I want to
introduce actual sailing ships to the world yhat players can encounter and pillage, with should also directly
enhance and integrate into the pirate quest system. All UI elements should follow enhanced plus UI. This task is to
be extremely detailed, authentic and easy to use. This is your baby and I want it to be as detailed as possible and
directly integrate into online mode."

**THE PORT'S OWN.** Daggerfall has no sea fight and Daggerfall Unity none either; nothing here is transcribed from a
mod's IL, so no `[IL]` citation points into any assembly and the arc carries no credits row - Port-Ledger section A
carries its row instead. It stands on three things the port already had:

- **Come Sail Away's hulls** (`03-World/Come-Sail-Away.md`): the player's boats are the ones that carry guns, and the
  sea's ships are built on the same five prefabs (`scenes/comeSailAwayPool.js` `spawnSeaNow`: drawn, baked and lit as
  a boat of the player's, in the pool's own SEA list - never `boats`, so no helm is taken on one and no deed places
  one). With the mod off there is no sea fight (`world.js navalOn`).
- **Warm Ashes - Ships' quests** (`03-World/Warm-Ashes-Ships.md`): the pirate quest system Mac named. A crewed boat a
  pirate grapples meets the mod's own raid on its own planks, and a pirate FLAGSHIP brings `WAQ_SHIP_ATTACK_PIRATE` -
  the quest the mod registers and never starts - with the Spellsword leader it was written around.
- **DFU's own law, loot and foes**: Piracy is `Crimes.Piracy` through `LowerRepForCrime`; a hold is the DFU loot
  tables' roll; boarders and defenders are the classic mobile classes on the exterior foe pool.

## The slices

| slice | what | modules |
|---|---|---|
| NAV-A | THE GUNS: closed-form ballistics, the batteries each hull carries, the aim from the look, the reload, the brace; what a ball does to a ship (hull, sails, crew, fire, the waterline) and the states a ship goes through | `systems/naval/navalBallistics.js`, `navalShips.js` (HULL_BUILDS, GUNS), `navalGunnery.js`, `navalDamage.js`, `navalShots.js` |
| NAV-B | THE PICTURE: the naval pass (smoke, muzzle flame, spray, splinters, the founder's foam, the balls in flight, the aim's arcs and splash zone), the deck fires on Daggerfall's own fire flat, a sea ship's colours on her flag; and the root fix of Come Sail Away's soft drop (below) | `systems/naval/navalEffects.js`, `render/navalRender.js`, `scenes/navalFlames.js`, `render/comeSailAwayRender.js` (flagRuns, softParticleTexture) |
| NAV-C | THE SHIPS OF THE ILIAC BAY: nine classes in three trades, their names and captains off the region's name bank, the crowns their navies serve; the captains' seamanship; the traffic | `systems/naval/navalShips.js` (SHIP_CLASSES, CROWNS), `navalAI.js`, `navalDirector.js`, `scenes/comeSailAwayPool.js` (seaBoats, spawnSeaNow) |
| NAV-D | BOARDING, PLUNDER, THE LAW AND THE QUESTS: grapples, musters, the prize window's model, holds and flotsam, notoriety and the crowns' law, Warm Ashes' raids started and gated | `systems/naval/navalBoarding.js`, `navalPlunder.js`, `navalLaw.js`, `systems/warmAshesShips.js` (the gate) |
| NAV-E | THE SOUNDS: six synthesised clips baked to DAGGER.SND's own format (a seventh and an eighth, the run-out and the ready, with AUDIT NAV1), and the distances every naval sound carries | `tools/navalSfx.mjs`, `tools/sfxSynth.mjs`, `systems/naval/navalSounds.js`, `public/sfx/naval-*.wav` |
| NAV-F | THE UI, ENHANCED PLUS: the helm's readout (ship plate, battery rose, aim, target card) and the plunder window, in the stone-and-brass kit on either skin | `ui/navalHud.js`, `ui/navalPlunderDoor.js`, `ui/navalPlunderWindow.js`, `ui/enhancedFrame.js` (FRAME_ROLES, scopeRules) |
| NAV-G | ONLINE: one player stands the sea for everyone near; the ships, volleys and barrels ride the foes frame; a blow on another's ship goes to its owner; a boarding claims the ship | `systems/naval/navalWire.js`, `scenes/exteriorFoes.js` (setOnNaval), `scenes/comeSailAwayPeers.js` (helmBoats) |
| NAV-H | THE HOST: the sea fight stood in the streaming world - the frame, the input, the activation, the draw, the lights, the origin, the colliders, the save, the transitions, the quests, the settings | `scenes/navalHost.js`, `scenes/world.js` (the NAV-H block) |
| AUDIT NAV1 | THE DEEP AUDIT (2026-09-29): six lenses measured the arc against Black Flag on its own harnesses; the captains' seamanship rebuilt (below), the hulls kept apart, a galley's ram, the sea on the world's clock; THE GUNS - the captains' gunnery and the run-out that tells a broadside is coming, the rig a target, fire, the prize kept a prize, the readout's warning and tally | `systems/naval/navalAI.js`, `navalShips.js` (the hulls' extents and rigs, the classes' pace, the carriages), `navalDirector.js` (the berths), `navalDamage.js`, `navalShots.js`, `navalGunnery.js`, `navalWire.js` (the run-out's bits, a barrel's fire), `navalSounds.js` and `tools/navalSfx.mjs` (the run-out), `navalEffects.js` (the glint, the shreds), `scenes/navalHost.js` (`stepSea`, `separateHulls`, `checkShipRams`, `strike`, the tell and the tally), `ui/navalHud.js` (the warning, the tally), `scenes/comeSailAwayPeers.js` (helmBoats' hull and heading); THE HELM - the aim a look lays and its red, the broadside camera, the brace, the ram, her hurts in her handling, the shipwright and the mending at sea: `navalGunnery.js` (lookReach), `navalYard.js`, `systems/comeSailAway.js` (wayScale, sailRefused), `render/navalRender.js` (the posts, the strikes, the tones), `ui/navalYardWindow.js`, `ui/navalPlunderDoor.js` (one door for both windows) |
| NAV-R | WARM ASHES' RAIDERS AS SHIPS (merged OWS3): a raider near the player at sea stood as a pirate of her seed's own class and name, sailing her seeded course until her lookout sights a boat, then fighting and boarding as any pirate; spent for her life; one copy between two players | `systems/naval/navalRaiders.js`, `scenes/navalHost.js` (`raiders`, `raiderShipOf`), `systems/naval/navalAI.js` (`sight`, `course`), `scenes/world.js` (`raidShips`, the marks) |
| AUDIT NAV2 | THE SECOND PASS'S DEEP AUDIT (2026-09-30, Mac: "Let's do a deep comprehensive audit on everything developed thus far"): seven lenses over SEA-PEACE, HELM-KEYS, DECK-FIELD, HELM-WAY, DECK-WALK, SHIPMATES and LIVING CREW and the merges that carried them - sixty-two findings, each pinned red first, fixed and mutation-proven: the captain's temper and a boat's hands on the word, a boarding shared with the room, the stern chase, the way round land, the dead zone, a fighting power the duels bear out (Mac's call), the helm's handling and its advice, a shipmate no mark, a deck of every level, the crew at a boarding at hand (`01-Overview/Audit-NAV2.md`) | `systems/naval/navalWire.js` (`k`, `m`), `navalAI.js` (`strikeTime`, `odds`, `layMin`, `routeTo`), `navalDeck.js` (levels, pieces, `mainLevel`), `crewLife.js`, `scenes/navalHost.js`, `scenes/navalCrew.js`, `scenes/world.js`, `systems/comeSailAway.js`, `systems/helmWay.js`, `player/mobileEnemyActivate.js`, `scenes/hostEnchant.js`, `characters/enemyCasting.js` |
| SHIP-LIFE | SHIPS THAT BERTH AND GO SOMEWHERE (Mac's item 1, slice E): a port's harbour found off the terrain, its berths and mouth; a bounded A* over the water; the errands - moored, depart, voyage, arrive, patrol, lurk - drawn off a ship's seed; the harbour roll of moored ships, the port's and the day's | `systems/naval/shipLife.js`, `navalAI.js` (the cruise branch's errand, `moor`), `navalDirector.js` (`berthed`), `scenes/navalHost.js` (`harbourFrame`, the errands' door), `scenes/world.js` (`navalHarbourNear`) |

## How it plays

- **At the helm of an armed boat, look to a side.** The look's bearing off the bow picks the battery
  (`navalGunnery.js` sideForBearing: within BOW_ARC of the bow the bow chasers, within STERN_ARC of the stern the stern,
  else port or starboard). The rose on the ship plate lights that battery gold.
- **Hold Attack** (the SwingWeapon action - right mouse by default, RT on a pad, the swipe on a phone): the guns are
  LAID under the look - on the sea where it meets the water (out to where that point would move more than AIM_SLOPE a
  degree, then AIM_SLOPE a degree on to the battery's longest), and ON A SHIP for her very point: the crosshair on her
  side lays the broadside into her side, on her canvas round shot into her hull and chain into the canvas. Every
  muzzle's arc is drawn to where it stops - a splash ringed on the sea with a post of light standing over it, or a
  mark on her side where the ball will meet her - all turning red when the guns will strike a ship as she will stand
  when the balls get there, and the range read under the crosshair ("Starboard broadside - 138 m", "(longest)" at the
  battery's reach, "on target"; or why it will not fire yet - "reloading 6.1 s", "braced", "no barrels", "guns
  silent" - the zone grey). THE BROADSIDE CAMERA eases the eye out over that side while a broadside is laid - her
  ports, the zone and the enemy on one screen - and home on the release (the Broadside camera part of the row).
  **Let go and they fire**, a ripple down the side (RIPPLE_S apart), the smoke drifting down the wind. Black Flag's
  "viewing from the side" is exactly this: the look IS the aim, in first person or over Eye of the Beholder's
  shoulder - so while the attack is held at the guns the mouse's drag, the pad's right stick and the finger's drag all
  TURN THE VIEW (the swing's look law, which drops the look under a held swing, stands down there, and the pad and the
  finger hold the attack plainly - `aimHold`). A readied spell still eats the press first. A window opened over the
  aim puts it down unfired; the release itself is never gated.
- **Crouch braces** (C, LB on a pad - R3 under Enhanced Plus's pad layout, whose bumpers are the crossbar's; on a
  phone the plate's own BRACE press, held): the crew ducks behind the rail - half the hull and sail damage while held,
  no gun fires and no gun is loaded (AUDIT NAV1: the reload waits). It is the Crouch action because that is what
  bracing is, and at the helm it is nothing else (AUDIT NAV1: the stance stays as it was); see the departures.
- **Watch for the run-out** (AUDIT NAV1): an enemy's battery is RUN OUT before it fires - its ports glint along her side,
  the gun trucks rumble across the water, and when it bears on you BROADSIDE and the brace's key stand over the
  crosshair, from the run-out until her balls are down. That is the moment to brace, or to turn out of her arc.
- **The tally**: once your volley's last ball is down, the line under the aim counts it - how many struck, how many
  below her waterline, how many through her rigging.
- **Interact boards** (E): a ship that has struck her colours within BOARD_RANGE of the helm, the way under
  BOARD_SPEED - the grapples fly, she is hauled alongside, and you go over her rail. On foot (swimming up, or from a
  deck alongside) the same press within FOOT_BOARD_M of her side with the look on her. The target card and the plate's
  hint say the key ("Colours struck - E: board her"). Too fast beside her, the same press HEAVES TO (AUDIT NAV1): the
  sails struck and her way taken off at HEAVE_TO_ACCEL times her own rate until she is under BOARD_SPEED, HEAVE_TO_S at
  most ("Colours struck - E: heave to", then "heaving to").
- **Taken, she opens**: the plunder window - her hold, one thing to take from her, and her fate. Shut it and she lies
  taken where she is; Interact opens her again.
- **The sea at a glance** (AUDIT NAV1): a tag stands over each ship in sight out to NAVAL_TAG_RANGE - her name, what
  she is to you, her hull and her state - and the lookout calls "Sail ho!" as a ship turns hostile, naming where she
  bears. A battered ship shows it: she smokes, lists, loses her canvas from the top down and sheds planks where a ball
  holes her; one going down groans until she is gone.

## The guns (NAV-A)

Each hull's batteries are measured off its own model (`navalShips.js` HULL_BUILDS - muzzles at the gunports, the
rail's height, the beam); the table is what each carries, a side at a time:

| hull | hull / sails / crew | batteries |
|---|---|---|
| Rowboat | 96 / 0 / 0 | none - it rams, it does not fight |
| Large Boat | 240 / 96 / 0 | 3 swivels a side, 1 on the bow |
| Small Ship | 672 / 256 / 24 | 6 long guns a side, 2 chain-shot chasers, a fire barrel over the stern |
| Large Galley | 832 / 144 / 60 | 4 long guns a side, 3 great guns on the bow - and the ram (GALLEY_RAM) |
| Carrack | 896 / 352 / 30 | 7 long guns a side, 2 chain-shot chasers, a fire barrel over the stern |

TOUGHER-SHIPS (2026-10-03, below): the hulls and sails are SHIP_TOUGHNESS (1.6) times the 60 / 150 / 420 / 520 / 560
and 0 / 60 / 160 / 90 / 220 they were built with (`firstBuildOf`).

The guns (`GUNS`), their muzzle speed and the ranges that gives from a 4.5 m deck (the lowest elevation to the
highest):

| gun | speed | range | reload | hull / sails / crew a ball |
|---|---|---|---|---|
| long gun | 62 m/s | 26 - 211 m | 9 s | 14 / 3 / 1 |
| swivel | 55 m/s | 21 - 161 m | 4 s | 5 / 2 / 2 |
| great gun | 68 m/s | 32 - 251 m | 12 s | 30 / 4 / 2 |
| chain shot | 58 m/s | 30 - 196 m | 7 s | 3 / 16 / 1 |
| fire barrel | rolled over the stern | where it drifts (FLOAT_DRIFT of the wind) | BARREL_DROP_S (1.2 s), BARREL.stock aboard | 45 / 6 / 3, and always a fire - BARREL.burnPerSecond for BARREL.burn |

TOUGHER-SHIPS (2026-10-03, below): the crew a ball takes is the gun's (`shotMen` - what the wire says) over
SHIP_TOUGHNESS, on the ball's own roll (`ballMen`): a long gun's one man 0.625 of a man on the average.

AUDIT NAV1 set the carriages' depression (-8 long, -6 great and chase, -10 swivel - a sloop alongside to grapple was
out of every broadside's reach at -3) and made the great guns heavy (68 m/s to 15 degrees: from a galley's deck 263 m
against her long guns' 231 - they fell 50 m short of them). AUDIT NAV2 F24: so a galley's high deck has a DEAD ZONE
on a low hull (`navalAI.js layMin`) - her great guns cannot lay on a Large Boat inside 91 m, her broadside inside 57 -
and she fights one from outside it: her stem turned on her only where the great guns can strike, her fighting range
never inside her dead zones, and inside the broadside's she opens the range (a war galley on a wary sloop lay 1439 s
of 2400 inside it; a corsair galley fired no volley at a Large Boat in 300 s).

**The flight is closed form** (`navalBallistics.js`): `p(t) = p0 + v0 t - g t^2 / 2`, no integration and no step
size, so a ball's path is the same on every machine and a peer can fly a volley from its word alone. The aim solves
the LOW arc for the look's range (`elevationForRange`), clamped to the gun's elevation band; past its reach the gun
lies at its highest. The boat's own way is carried by every ball. A volley's spread is the gun's own (`yawSpread`,
`pitchSpread`) scaled by the crew's skill (`volleyLaunches`: x1.5 unskilled down to x0.4), from a SEED - the volley's
balls are reproducible from `(seed, skill)`.

**The reload** is the gun's seconds over the crew left (`reloadSeconds`): an undermanned crewed ship reloads
RELOAD_UNDERMANNED slower as it thins, a crewless boat single-handed at RELOAD_SINGLEHANDED.

## What a ball does (NAV-A)

A ship is three numbers (`navalDamage.js`): HULL (at nought an AI ship sinks), SAILS (its way: BARE_POLES of its best
under bare poles, the rest in proportion to the canvas left) and CREW (the reload, the boarders). A ball that strikes
her HULL box holes her - HOLED (HOLED_BONUS more) when the point it struck is within WATERLINE_BAND of the sea - and
one that passes through her RIG (HULL_BUILDS `rig`: her canvas and spars as boxes over her roof, riding her hull's own
matrix so the masts heel with her) tears canvas and takes a man aloft, and FLIES ON; chain shot is for the rig. A hull
hit above the waterline may start a FIRE (FIRE_CHANCE; a barrel's always does, hotter and longer); each fire burns its
own bite for its own seconds and eats canvas (FIRE_SAIL) and men (one each FIRE_CREW_S) as well as timber, up to
FIRE_STACK at once. At STRUCK_AT of her hull an AI ship STRIKES HER COLOURS - her bell rings, she heaves to, her crew
puts her fires out - and can be boarded, or shot on until she SINKS over SINK_SECONDS as her casks float free:
listing, going down by the head or the stern, until her highest spar is under the sea (`sinkAngles`, `sinkDepth`;
AUDIT NAV1, "The presentation"), her fires burning on until the sea reaches them. The rest of the volley that struck
her cannot sink her (STRUCK_GRACE_S): sinking a prize is a new volley, never the click that took her.

**The player's boat never sinks.** At nought it is WRECKED: no sail will set, the oars at WRECKED_OARS, the guns
silent, until it is repaired - at a port's shipwright, with a prize's timber, or by her own hands at sea. A boat
is a possession bought for up to two hundred thousand gold; losing one to a lucky broadside is a punishment
Daggerfall never deals.

**The shipwright** (AUDIT NAV1, `systems/naval/navalYard.js`, `ui/navalYardWindow.js`): at the helm in a port town's
waters (the host's `nearPort`), her way under YARD_SPEED and no hostile ship near, Activate opens his yard - the
plate's hint names him. He sells her HULL and CANVAS back by the point (REPAIR_PRICE), HANDS by the man and FIRE
BARRELS by the barrel (BARREL_PRICE) - each as much as the purse pays for (coins and letters of credit, DFU's
DeductGoldAmount), never past her whole; MAKE HER WHOLE buys the four in YARD_ORDER as far as the purse goes. **Her
own hands mend her at sea**: no hostile ship near HER and nothing struck her for FIELD_QUIET_S (AUDIT NAV2 F29: the
quiet is measured from the boat, wherever the player stands - over the side or ashore, her fight went on and she
mended through it), her hull and canvas come
back FIELD_MEND_PER_S of their whole a second times her crew's share (FIELD_MEND_ALONE with none aboard), up to
FIELD_MEND_CAP and never past it, never while she burns (a fire strikes her every moment it burns); a wreck floats
again past FIELD_REFLOAT of her hull. Hands
are never mended - they are hired, or pressed from a prize. The plate says MENDING while they work.

**Rams**: a stem striking a hull - her own bow's (`bowZ`) within RAM_REACH of the other's box - at a closing speed of
RAM_SPEED or more (the way she came in with, the most of the last RAM_MEMORY_S, less the other's along her course)
deals RAM_DAMAGE a metre a second (a galley's ram GALLEY_RAM times that) and takes RAM_RECOIL of it back - BOW_RECOIL
times that for a stem not built to ram, a GALLEY_RAM-th of it for a galley's, half braced (AUDIT NAV1). AUDIT NAV2
F26: one captain's ram on another's sound ship brings her to strike and never under (`checkShipRams` caps it at
STRUCK_AT) - a corsair galley's stem sank a coaster outright, her prize and her plunder with her.

## The ships of the Iliac Bay (NAV-C)

Nine classes in three trades (`SHIP_CLASSES`), each on one of Come Sail Away's hulls:

| class | trade | hull | from level | boarders | cargo lots | tactic |
|---|---|---|---|---|---|---|
| pirate sloop | pirate | Large Boat | 1 | 8 | 1 | broadside |
| pirate brig | pirate | Small Ship | 4 | 13 | 2 | broadside |
| pirate galley | pirate | Large Galley | 7 | 13 | 2 | bow (steers her great guns on) |
| pirate flagship | pirate | Carrack | 9 | 20 | 4 (the last her strongbox) | broadside; never runs |
| coaster | merchant | Large Boat | 1 | 5 | 1 | runs |
| galleon | merchant | Small Ship | 3 | 9 | 3 | runs |
| carrack | merchant | Carrack | 5 | 11 | 4 | runs |
| navy cutter | navy | Small Ship | 1 | 14 | 2 | broadside |
| navy galley | navy | Large Galley | 6 | 18 | 2 | bow |

**Names**: ~~a pirate or a merchantman a line from her trade's list, a navy ship her crown's own~~ SHIP-NAMES (below):
each drawn off her seed from her trade's forms over the Bay's word banks, a navy ship's of her crown
(`CROWNS` - Daggerfall's under Gothryd, Wayrest's under Eadwyre, Sentinel's under Akorithi), and every captain
DFU's `NameHelper.FullName` over the region's name bank on the ship's own seed (the global DFRandom stream put back as
it stood). The crown of any water is the nearest of the three capitals (`crownOf`).

**The captains** (`navalAI.js stepCaptain`, rebuilt by AUDIT NAV1 - below) sail the wind at the player's own pace
(`windFactor`: in irons nothing, a broad reach best; `windShare`: Come Sail Away's linear wind), never nearer it than
close-hauled - a course into the eye is beaten on a TACK, a slow ship WEARS; they turn on their hull's own turning
circle, eased and heeling on a spring; they keep off the land (the hull's own width sounded every SCAN_STEP past the
turning circle, swinging by AVOID_SWINGS and holding a swing) and off each other (the rule of the road); and they
fight as Black Flag's do: far off they INTERCEPT (a true intercept on the enemy's smoothed way); in reach they show
the broadside that will bear SOONEST - its lead laid dead abeam while it is loaded, bent to work the range while it
reloads; a galley steers her bow guns at the LEAD. A gun fires when the lead bears (`leadPoint`: where the target will
be when the ball arrives). A merchantman RUNS from anything that would take her, on her fastest point of sail; a pirate
under PIRATE_RUNS_AT of her hull runs too - a flagship never. A pirate with GRAPPLE_CREW men to send COMES ALONGSIDE a
player's boat that is crippled, under GRAPPLE_HULL of its hull, or has lain under GRAPPLE_STILL m/s for GRAPPLE_STILL_S,
her broadsides held, and GRAPPLES across GRAPPLE_GAP of water (GRAPPLE_RANGE where a hull is unknown). A navy HUNTS a
player whose notoriety in its waters is NAVY_HUNTS or more, and turns on anyone who struck a lawful ship in its sight
(PROVOKED_S).

**The traffic** (`navalDirector.js`): while the player is on open water, a roll every SPAWN_EVERY seconds (the first
FIRST_ROLL_S after reaching it) stands a ship SPAWN_RING away - out of sight, never nearer than SPAWN_CLEAR to any
player - up to the setting's DENSITY (few 2, some 3, many 5); by trade (FACTION_WEIGHTS; near a port PORT_WEIGHTS - a
port's waters are a merchant's and a navy's), by class (`classFor`: the player's level, the class weights), and a
navy HUNTER (HUNTER_WEIGHT) once the player's notoriety passes HUNTER_AT. A ship past DESPAWN_BEYOND of every player,
not fighting, is gone. The seeds are the waters' (`seedBaseOf`: the pixel and the day).

## Boarding, plunder and the quests (NAV-D)

**Boarding** (`navalBoarding.js`): grapples thrown (GRAPPLE_S of haul, the two hulls BERTH_GAP apart), then the
FIGHT on her deck: her MUSTER - her class's boarders thinned by her crew's losses, never under MUSTER_MIN nor over
MUSTER_MAX, led by her CAPTAIN (a pirate's a Spellsword, a merchantman's a Ranger, a navy's a Knight) - against the
player and, from a crewed boat, their HANDS (Warm Ashes' `_ally_` Warriors, one for every CREW_PER_HAND of the crew,
HANDS_MAX at most). The captain down and SURRENDER_SHARE of the muster with him - or every man - and she is a PRIZE.
Swim or sail ABANDON_RANGE from her and the fight is given up. The dead lie on her deck (lootable) and go down with
her - AUDIT NAV2 F11: they ride her deck (`navalCarry` carries the dead too) and are taken off when her hull leaves the
pool; a body killed on her deck had lain where it fell, over open water once she sailed. Every body stands a spot of
its own, none within BODY_GAP of another or of the player's landing, and each of her men as himself (F44/F32: the
rail answered one cell again and again on a short deck, hands stood on her men and on the player, and an Archer
thrown back and boarded again stood as the muster's next Rogue); a hand who falls is his CREW_PER_HAND of the boat's
crew when the fight ends (F49: a boarding's losses touched no crew).

**Repelling boarders**: a pirate that grapples the player's boat hauls alongside and comes over the rail. A crewed
boat meets them with WARM ASHES' OWN RAID on its own deck - `WAQ_SHIP_SMALLRAID`, or from a pirate flagship
`WAQ_SHIP_ATTACK_PIRATE` (its waves, its healers, its Spellsword leader, its 5,000-10,000 gold and its repute) - the
quests' foes stood on the boarded deck (`world.js` tryPlaceFoe asks `navalHost.placeQuestFoe` first). A boat with no
crew meets a party of the arc's own (REPEL_PARTY). Thrown back - the small raid's "Leave Ship", or the quest ending
won (`raidQuestWon`: the tasks `winner`, `endquestproper`, `endquestproper2`, `endquestproper5`) - and their ship,
her boarders spent, lies struck alongside: board her in turn. AUDIT NAV2: the raid's own `_ally_` are the crew (NAV1
B2's law), so the living crew is held off the deck while it is fought (F43: the fight took the Galley's four hands off
her deck and fielded none, and her other four walked and sang among the raiders); its waves come over the rail first,
the rest at the deck's spots (F37: one shuffle of both put two of the first eight at the rail); and thrown back, she
strikes by her hull, her fires out, before her crew is gone over the rail (F19: the crew line struck her unmanned at
95% and burning, and the hull line never ran).

**Warm Ashes' voyage ambush**, the mod's own raid on the ship you own at sea: when its raiders are beaten its "Leave
Ship" WAITS (`leaveShipGate`: 'wait') while the raiders' vessel's hold is laid open in the plunder window, and sails on
when the window shuts - the voyage never waits on a closed window. The switch "Raiders' plunder" turns it off.

**One raid at a time** (THE MERGE with OWS3): beside the mod's own fast travel, two starters make Warm Ashes' raid -
the boarders above on a crewed deck, and main's Overworld raiders alongside (`warmAshesShips.js raidAtSea`) - and
neither saw the other's, so one could start a raid over the other's (the mod's ship boarded under a fight on a Come
Sail Away deck). Warm Ashes' module is the one answer now: `raidUnderWay()` - an ambush armed or boarding, a lent ship
out, or a raid quest running whoever started it (the host's `raidRunning`, off the quest machine's live table:
WA_RAID_QUESTS, neither complete nor tombstoned). `raidAtSea` says 'busy' while one runs, and the sea fight's
`startRaid` starts none while one is under way - the boarders come over as the arc's own party instead.

**THE GATE** (DECLARED, the Warm Ashes page's own departure): the mod's `LeaveShip.Update` asks the host's
`leaveShipGate(quest)` first - 'naval', a raid the sea fight started (on the player's own boat, where the IL would lend
a ship and set the player on it): complete, nothing sailed; 'wait': not yet; 'proceed': the IL's own body. A raid
the sea fight started is remembered by its quest's UID in the save, so a load mid-raid is still the sea fight's.

**The prize** (`navalPlunder.js`): her HOLD is one LOT for each tier of her cargo, each a draw of DFU's treasure
tables under a key that fits her trade (HOLD_KEYS: a pirate's plunder gold, jewels and arms; a merchantman's cloth,
spices and books; a navy's armoury), rolled at the player's level and given its rarity at the lot's tier (HOLD_RARITY_TIER
- a merchantman's a mine's, a pirate's a stronghold's, a navy's a giant's hold's; a flagship's strongbox
STRONGBOX_RARITY_TIER, a barbarian chief's). Drawn once from her seed: whoever opens her again finds what is left.
TAKE ALL goes into the captor boat's own hold (Come Sail Away's cargo, whose weight slows her as the mod weighs it),
or into the pack as far as it carries; OPEN HER HOLD lays it in the pack's own loot window.

**The captor's one choice** (Black Flag's, in Daggerfall's words): **Timber and cordage** (REPAIR_SHARE of the hull
and canvas made good), **Powder and shot** (every battery loaded, the fire barrels to BARREL.stock) or **Press her
crew** (PRESS_SHARE of the losses made good). Each tile says what it would make good NOW and stands greyed, with why,
when it would make nothing good. **Her fate**: SCUTTLE her (she burns to the waterline) or CAST HER ADRIFT.

**Flotsam**: a ship SUNK rather than taken gives up FLOTSAM_OF her lots as casks afloat; a boat sailing through one
hauls it into its hold.

## Warm Ashes' raiders as ships (NAV-R)

Mac, of main's Overworld raiders (OWS3, `bible/06-Systems/Travel-View.md`): "Definitely want them to appear as ships".
OWS3 sails one raider a cell a life on the Overworld (`systems/seaRaiders.js`: seeded, so every player sees the same
sail at the same minute), and drew none in play - alongside, the mod's raid carried the player onto a borrowed ship.
With the sea fight on, a raider IS a pirate of the sea (`systems/naval/navalRaiders.js`, `scenes/navalHost.js`
`raiders`):

- **Stood near the player at sea.** Each TV_RAID_LIST_MS the Overworld's frame hands the naval host the raiders about
  the traveller - where each sails now and where its seeded course is RAIDER_LEAD_S on (`raiderAt`), in the scene -
  and the lookout's reach (`raiderSight`: a day's 1,000 m, a night's 500). A raider within RAIDER_STAND_M stands as a
  ship, the nearest RAIDER_SHIPS_MAX at most; a spent one never.
- **Her seed's own ship.** Her class is a pirate the player's level has met, drawn off the raider's seed by the
  classes' weights (`raiderClassOf`) - a sloop, a brigantine or a corsair galley, never the flagship (the small raid's
  crew); her name and her captain are her seed's (`shipNames`).
- **Her course, then her fight.** She steers for her course's lead (`ship.course`, navalAI.js cruiseCourse), so the
  sail on the map is the sail met on the water, and her lookout reaches as far as the raiders' does (`ship.sight` in
  place of ENGAGE_RANGE). Sighting a boat she is a captain like any pirate's: the broadsides, the grapple of a boat
  crippled or lying still, and Warm Ashes' own raid on the boarded deck (`WAQ_SHIP_SMALLRAID`, one raid at a time).
- **Spent for its life** (OWS3's own law): sunk, struck, taken or boarded, or chased and given the slip - said once to
  the world host (`raiderSpent`, `tvRaid.spent`). Given the slip she sheers off RAIDER_SHEER_M away and looks for no
  one. She leaves only out of sight - past RAIDER_DROP_M and fighting no one - whether spent, struck or her life over:
  a ship on the water never vanishes in view. The director counts her in the density and never despawns her.
- **The map finds her where she sails** (`raiderShipOf`): the Overworld's mark rides the ship, and says she chases
  when her captain has the player for a target.
- **One copy.** A raider is stood by the client she is near - the chased traveller's own, as OWS3's chase was - and
  said in that client's word like any ship; a peer's copy of the same seed with the lower id keeps her (TV7b's
  `chaseYields`), and mine goes.
- With no sea fight (the switch off), OWS3 stands as it was: the chase on the Overworld and the mod's raid alongside.

**THE MERGE with main's OW6 (2026-09-29).** Main shared the Overworld's raider chase on the cell's foes frames (OW6,
`bible/06-Systems/Travel-View.md`: a chase said where it sails, a spent raider said and kept by the cell's ledger, never
a sail a peer's chase holds, the lower id keeping one two players chase) and made a fast journey slow as enemies close
(`systems/travelThreat.js`) - both on the Overworld's own chase, which a sea fight does not run. So the ships join them:

- **Spent through the Overworld's own spend.** A raider ship spent here goes through `seaRaidSpend` (`raiderSpent`):
  spent for its life, said on my word to the cell's others and owed to the cell's ledger (OW6L) - a late joiner never
  sees a sunk raider's sail again.
- **Held, and said so.** The ships my sea stands and has not spent are said on my raider word as held, where each
  sails (`naval.raiderHeld`, world.js `seaRaidHeld`), so a peer's client - with the sea fight or without it - holds off
  a raider I hold as it holds off one a peer chases: never a chase of its own on her, and her mark where she sails.
- **Never a sail a peer holds.** The raiders a peer's word holds reach the plan with the peer's id (`held`): never
  stood here, and one stood here that a lower id holds too - by a copy or by a word - goes, as to a peer's copy
  (`raiderPlan`).
- **A journey slows for every hostile ship.** NAV-H made a hostile ship within HOSTILE_NEAR_M an enemy nearby that
  stops a journey; OW6's governor slows a journey before an enemy's reach so the stop never comes unwarned - and read
  no ship. The naval host now hands it its hostile ships afloat (`threats`, raiders stood as ships among them), each
  where she sails with the ring the journey stops at, or her lookout past it (`lookoutOf`, the captain's own law) while
  she has not sighted me, closing at her pace once she comes for me - on either skin, as the stop is. A raider stood as
  a ship is counted as the ship, never her seeded sail beside it.

## The law (NAV-D)

`navalLaw.js`: striking a lawful ship (a merchantman or a navy) in a crown's waters is PIRACY - `Crimes.Piracy`
through DFU's own `LowerRepForCrime` in that crown's region (the court's table's legal loss, half of it off the
region's People), once per act per ship; no watch stands at sea, so no crime is COMMITTED for one to arrest. NOTORIETY
in the crown's waters rises with each act (NOTORIETY: fire, sink, board) and decays a day at a time
(decayPerDay); the plate shows it as four anchors. Past NAVY_HUNTS a navy engages on sight; past HUNTER_AT the
director sends hunters. Sinking or taking a PIRATE is lawful: PIRATE_REWARD - legal repute with the crown, and the
Knightly Order's and the temples' regard (KNIGHTLY_FACTION, TEMPLE_FACTION), a flagship's the most. Online a player's
notoriety is their own: it rides their word, and the navy another player stands judges them by it (Online, below).

## An enemy nearby (NAV-H)

A hostile ship in reach (`navalHost.js hostileNear`: afloat, within HOSTILE_NEAR_M, and hostile to the player by
`navalAI.js hostile`) is an ENEMY NEARBY wherever the game asks it outdoors, as DUEL1's opponent is: Come Sail Away's
time scale will not run past one, the travel map and a party's trip refuse ("You cannot travel with enemies
nearby."), a Travel Options journey stops for her - so main's Overworld crossing (OWS2) is brought up short by a pirate
bearing down, as a road journey is by a bandit - and nobody rests under her guns (`world.js navalHostileNear`, one
helper at the five doors). A merchantman, a navy that is not hunting the player, a struck or sinking ship is no enemy.
SEA-PEACE: and none at all while the player stands aboard no ship (`aboardShip`, below) - ashore her guns cannot reach
them, and no captain takes them for a contact.

## Online (NAV-G)

- **One player stands the sea**: the lowest id within NAVAL_SHARE_RADIUS (DEEP-SHARE's greedy election,
  `campEncounters.js amGroupRollOwner`, with SHARE_HYSTERESIS) runs the director and the captains for everyone near;
  the others see puppets eased toward the owner's word (PUPPET_EASE, PUPPET_SNAP_M) - AUDIT NAV1: toward where the word
  puts her NOW, sailed on along her course at her way since it was said (PREDICT_MAX_S at most; a brig at 7 m/s had
  stepped a word and more behind). Its seeds are salted with its id (`idSalt`, the waters' own offline): two standers
  in the same waters on the same day launched the same three ships side by side.
- **A ship is her seed** (AUDIT NAV1, online): the same ship in every client's sea, whoever stands her. Her word carries
  her HANDOVER'S COUNT (`gen`), and of two players saying one seed, the greater count holds her, on a tie the lower id
  (`claimBeats`) - the weaker copy YIELDS into the stronger's puppet, the same entry and hull, never a second ship. A
  ship is TAKEN OVER at one past her count: by the heir (`heirOf`: whoever would stand the sea without her stander)
  when her stander leaves the cell, goes silent, or falls quiet past OWNER_STALE_S - she sails on under the heir's
  captain, where she vanished mid-fight - and by her BOARDER at the grapple. Anyone else keeps a departed stander's
  ships where they lie for ORPHAN_S, for the heir's word to claim the same entries, and lets them go after; one going
  down finishes going down. A raider taken over is known by her seed (her raider id, held and spent by the heir's law).
  Her names are drawn in the region her word carries (`region`), so a navy ship is her stander's crown's to everyone.
- **The traffic is launched by a player on the water** (SEA-TRAFFIC, 2026-09-30, Mac: "players arent seeing boats"):
  only a player at a helm, on a deck or swimming launches ships, so the launcher is elected among those alone
  (`navalHost.js launchesTraffic`, the share's election and hysteresis) - elected among every player near, a lower id
  still ashore in the port town launched nothing and the one sailing out met an empty sea.
- **Every player lets its own ships go** out of sight (the director's despawn, standing or not - two standers who met
  kept six ships for good); only the stander launches, and it counts the whole shared sea near it against the density.
- **The word** (`navalWire.js`): the ships an owner stands (NAVAL_WIRE_SHIPS, nineteen fields each - the run-out, the
  handover's count and the names' region last; an older word's sixteen or seventeen read as none, the first claim and
  the reader's own region), its volleys
  (NAVAL_WIRE_VOLLEYS: the shooter, the hull, the side, the pose, the elevation, the seed and the skill - everything a
  peer needs to fly the same balls - and, AUDIT NAV1 online #15, her AGE when the word is said, so a reader flies her
  from as far along as she is, in step with her shooter's: she landed late by the word's cadence, or by a word and more
  when a later one first carried her; the shot field walks a flight it came late to BALL_STEP_S at a time, along its
  arc) and its barrels (each with its ship's number, AUDIT NAV1 online: an older word's four fields read as the
  owner's own), kept NAVAL_VOLLEY_KEEP_MS and moved with the world when its origin shifts; AUDIT NAV1 (online), its
  player's own boat at sea (`p`: her hull, whether she is a wreck, whether they let pirates board them), notoriety (`n`:
  each crown they are owed in, by its row, 0..NOTORIETY.max), Ships at sea (`t`, only when it is not the default) and
  the casks afloat in their sea (`f`, below); it rides the owner's foes frame (`nv`,
  beside Come Sail Away's `sa`) on every full frame and whenever it changed. AUDIT NAV2: and two keys of their own -
  an older build's door counts `s` and `p` by their fields, so it passes these and reads none, and a newer door reads
  a longer entry's first fields: `k`, each ship's captain - her temper, her mode and the ship she struck to (F1, SEA-PEACE
  above; F3: her mode, so her crew is at battle on every screen; F5: her victor, kept through a handover, where the navy
  had sailed off and her prize lay struck for good) - and `m`, the owner's boat - her crew, her battle and her hull (F2:
  the stander sized a peer's boat at a full crew and the peer herself single-handed, 3,300 against 2,357, so a wary
  pirate took on one screen what she left on the other; the living crew counts her men off it, F9). AUDIT BAY A18: and
  `l`, a key of its own the same way - the lanes' packets the owner has seen spent, each her voyage's seed, the last
  NAVAL_WIRE_SPENT (8), said on by every reader (a player who never saw her go stood her afresh where she went down).
  `validNavalRecord` takes it whole or not at all, every number bounded (the pose bounds are `net/wire.js`'s own). NO
  RELAY CHANGE: the relay passes the foes
  frame through and routes a cell's hit by its `to`.
- **The victim resolves**: a ball that strikes MY boat is mine to take, from any ship's volley flown here; a blow on a
  ship another player stands goes to them as a hit frame (`navalHitData`: `to`, the ship's number, the damage,
  bounded by NAVAL_HIT_MAX), and they land it. **No fight between players at sea**: a peer's own volley never hurts my
  boat. A pirate's fire barrel is a ship's, whoever stands her (AUDIT NAV1, online #7: its word named no ship, so it
  read as a player's - it blew under another player's boat for no hurt and floated on on her stander's screen). On
  the stander's screen another player's boat stops a ship's ball, tears on her canvas and sets off her barrels as the
  stander's own boat would - the splinters and the blast seen and heard there, the hurt hers to take on her own client -
  and a player's shot passes her by (`hitBy`). **A blow is never lost** (AUDIT NAV1, online #9): a blow on another's
  ship, a grapple and a cask's claim and answer go out through the world's hit retry queue (`sendHit`, AUDIT FOES
  FOE2's `net/hitPend.js`), so one the wire refused, or sent while the socket was away, goes a frame later instead of
  never (they went out bare, and every refusal threw the blow away); and one player's words fly at most
  PEER_VOLLEYS_MAX new volleys here in NAVAL_VOLLEY_KEEP_MS (#14: nothing bounded a word that said twelve new ones every
  time), the rest seen and never flown.
- **Each player answers to their own law** (AUDIT NAV1, online #6): the captains another stands judge each player by
  the notoriety their own word says - a navy hunts a wanted peer and leaves a lawful one be, whoever is wanted of her
  stander; the stander's director draws the navy after the most notorious player in its waters; and any player's blow
  on a lawful ship provokes the navy that saw it (`strike`'s `byPlayer`). (The navy judged every player by its
  stander's notoriety, and a peer's piracy beside a navy provoked no one.)
- **A boarding takes the ship over** (AUDIT NAV1, online): the boarder adopts her at the grapple, so the haul, the fight,
  the prize and her fate are one world - the boarder's - and her fire and her sinking ride his word to every screen.
  (Four board claims marked her in her stander's world while all of it happened in the boarder's: his copy hauled 17 m,
  hers left at 40; after the win the prize slid 20 m from under him; her scuttling burned on his screen alone; and a
  lost or abandoned claim left her unboardable for good.) A blow finds a ship of mine by her number (`ownByN`), whatever
  id she was minted under (one launched while the socket was away stood as `local:n`). AUDIT NAV2 F7: adopted, her
  word's `boarded` clears - her boarder gone, she is boardable again (never again, her crew held for good).
- **The striker answers for what they sank**: the stander lands the hurt, so the sinking happens in their world - it
  reaches mine in their next word, and a ship that goes down within SINK_CREDIT_S of my last blow on her is charged to
  me too (`lawOf('sink')`: a lawful ship's notoriety, a pirate's reward). Two players who both fired on her both
  answer for her.
- **A ship going down goes down on every screen** (AUDIT NAV1): her sinking runs on each peer's own clock between her
  stander's words (`sinkOn`; a word that says she still sinks never starts her over), and one their word lets go of
  while she sinks - her stander drops her the moment she is under, a word or two before a peer's clock has her there -
  finishes going down before she is gone (`letGo`). A room left takes every peer's ship at once.
- **A sunk ship's casks are every player's** (AUDIT NAV1, online #15): they are dropped in her stander's world and said
  in its word (`f`: the lot's key and her class by their rows, the place to half a metre), so every player sees them
  where they float, and any player's boat hauls one in - CLAIMED of their owner (`navalHitData`'s `k`): the owner
  answers the first claim (`a`) and lets the cask go, and the claimer draws its lot on the answer alone, so one cask is
  one haul whoever reached it; a claim is said again every CLAIM_AGAIN_S while it waits (an answer lost is answered
  again - the owner keeps its answers GRANT_KEEP_S - and drawn once), the cask kept from the claimer's screen meanwhile,
  and given up past CLAIM_WAIT_S. A departed owner's casks are their heir's, the same casks taken over where they
  float, kept ORPHAN_S by everyone else for the heir's word; an owner's word that says nothing leaves no cask behind
  for anyone to raise again. (Only the stander's boats could haul them in: a peer who sank her saw none.)
- **The pirates fight every player's boat** - a peer at their helm is a contact (`comeSailAwayPeers.js helmBoats`),
  led by the way their own word says: CSA-K's `m` on the boats' word, the velocity the boat at the helm says on the
  wire, carried through the frame as the lead carries it (the frame is affine, so a way is the difference of two
  converted points). A word that says no way - a boat brought up short, a moored fleet, an older build's - has none,
  and a snap (a summons, a fast travel) moves her place and never her speed, which is never measured off her places.
  (Before the merge with CSA-K the port measured the way off the eased places and threw a snap's step away; the
  owner's own word is the truth that measure stood in for.) A pirate BOARDS any player's boat
  their own word lets her (AUDIT NAV1, online #10): crippled, holed or lying still, and the player letting pirates
  board them - their own setting, never the stander's. She comes alongside as her stander's captain brings her, and her
  GRAPPLE goes to them as a claim (`navalHitData`'s `g`, no hurt, said every GRAPPLE_CLAIM_S while she lies alongside):
  they take her over, one past her count as a boarder does, and fight her boarders on their own deck - a boarding is
  one client's fight, the victim's (its bodies the room's to see and join: AUDIT NAV2 F12, DECK-WALK's Online below). They refuse her at no helm, mid-fight, with their setting off, or she no pirate
  afloat. (A pirate beside a peer's wreck sat 76 m off for two minutes and never boarded - the peer could neither
  travel nor rest - and pirates grappled their stander alone.)
- **The switch is forced ON online** (the Features row): the ships at sea are the room's world, and a room where one
  player sees the pirate boarding another and the other does not is two worlds. A voyage raid's plunder stays each
  player's own, and a boarding's bodies are the room's (AUDIT NAV2 F12); a shared sea's traffic is the lowest Ships at sea among the players who share it
  (AUDIT NAV1, online #15 - `trafficDensity`: its stander's alone sailed everyone's sea).

## The UI (NAV-F) - Enhanced Plus

- **The helm's readout** (`ui/navalHud.js`) is a READOUT, not a window (the gate bar's law): built once, updated in
  place, hidden with the HUD and under every window. The SHIP PLATE (bottom right): the hull, sails and crew as the
  vitals' banded bars with brass clasps (the hull in health's red, the canvas in bone, the crew in fatigue's green; a
  hull under a quarter pulses), chips for fire, brace and a crippled ship, the crown's waters and four notoriety
  anchors, the BATTERY ROSE (bow over stern, port and starboard either side - each its guns, filling as it reloads
  and FULL brass when loaded, flashing as it comes ready - AUDIT NAV1 - gold when the look lays it, brass-edged when it
  can fire) and the hint (the key that matters most first - a ship in reach
  to board or plunder, then the guns). The AIM under the crosshair (AUDIT NAV1: dimmed, with why, while the battery
  cannot fire; one stack with THE TALLY under it, below). The TARGET CARD under the compass: her name, class and captain, the distance, her hull and sails,
  whether she is hostile (its red over her trade's colour), her state and the key that boards her - while a broadside is
  laid, the ship its guns strike; her hull bar reads a hit as the foe bar does (AUDIT NAV1: `ui/barLoss.js` - the ghost
  where it was, a piece breaking off, the card flashing). On
  foot, the card alone - while a struck ship or a prize is in reach. AUDIT NAV1: THE SEA'S SHIPS ON THE COMPASS, both skins
  (a bow's triangle in what she is to me); THE WARNING over the crosshair -
  BROADSIDE and the brace's key, pulsing in the kit's blood edge - while a run-out bears on you and until its balls are
  down; THE TALLY under the aim for TALLY_S once your volley's last ball is down.
- **The ships' tags and the lookout** (AUDIT NAV1, the presentation, #14): a TAG over each ship within NAVAL_TAG_RANGE
  of the eye and past NAVAL_TAG_NEAR (nearer, she fills the view), NAVAL_TAG_MAX of them nearest first (the host's
  `tags`): her name in her trade's colour (a hostile ship's red), her hull's bar, her state in the card's words
  (Colours struck, Taken, Boarded, Going down - none while she sails: her red says hostile; SHIP-STANCE, below: a
  friendly ship's bar green, and SHIP-TAGS' second line within TAG_DETAIL_M on the one tag SHIP-CLUTTER picks, no tag drawn over another), the card's ship ringed - TAG_LIFT over her highest spar as she stands, so it settles as she
  goes down. The world projects them through the frame's own matrices behind a sight cache of their own (the peers'
  names' law, NAME1) and hides them under every window, a pause, the HUD hidden and the travel view (`navalTags`);
  the readout's tag layer wears them (`drawNavalTags`: one node a slot, moved, never rebuilt, at the HUD's scale,
  fading from TAG_FADE_FROM to TAG_FADE_TO at the tags' reach). THE LOOKOUT (`hailSails`, every SAIL_HO_CHECK_S):
  "Sail ho! A Pirate Brigantine on the starboard beam!" as a ship afloat turns hostile within SAIL_HO_RANGE - her
  class, and at the helm where she bears off the bow (`bearingWords`) - the nearest first, once while she stays
  hostile, SAIL_HO_GAP_S after the last.
- **Where the card stands** (THE MERGE with CSA-L): by the house law for what stands under the compass (the journey
  bar's PLUS8, the helm panel's CSA-L) - the compass's foot times the HUD scale and a gap (NAVAL_CARD_TOP), a step
  lower while the foe's bar is up under the compass and further under its blade. Come Sail Away's HELM PANEL stands
  there too on Enhanced Plus, and its bar is as tall as its buttons wrap, so while it stands the card is placed
  NAVAL_CARD_GAP under its measured foot (`drawNavalHud`'s `under`, `enhancedHelm.js enhancedHelmBar` - the panel is
  drawn earlier in the frame, and its foot is read only while a card stands or the layout is due). The layer copies
  the HUD scale onto its root, so every part follows the player's HUD scale together - the card at it capped by its
  column's room (The layout, below).
- **On a finger's screen** (`touch`): no key is named - "Hold and drag to aim", "Lift to fire", "Tap: board her" (the
  host's one activation arm answers a key, a click and a tap alike), "hold Brace" (AUDIT NAV1: the readout's own
  BRACE, shown at an armed helm - the touch table's three slots hold no Crouch - its own press beside the plate's foot,
  NAVAL_BRACE_H by NAVAL_BRACE_W at any scale; the warning names it, "Broadside - Brace") - and the plate stands
  NAVAL_PLATE_TOUCH_BOTTOM up, over the touch corner's presses rather than on them. With A PAD in hand (AUDIT NAV1,
  the presentation) the readout names the pad's own buttons (`hdGlyphName` off the attack's pad binding, else the
  swing's right-click button; Activate's click; the brace's) - "Hold RT to aim - LB: brace" - and at an armed helm the
  Plus pad's prompt bar shows the guns' rows beside the d-pad's (`navalPadPrompts`: the attack laying and firing, the
  brace, Activate for the ship in reach), a row only for a button bound.
- **The layout** (AUDIT NAV1, the presentation - measured in a real browser over the real HUD and helm panel, 1920x1080
  to a 667x375 phone at HUD scale 0.5 to 2, aim up and down): no part covers another or the HUD, and a finger's press
  never shrinks. THE PLATE stands over the vitals where she would reach into their rows, rather than shrinking
  (`platePlace`); her scale the HUD's capped by the room under what stands over her columns (the helm panel's bar, the
  card's band - held for her whether or not a card stands, so she never jumps as the look finds a ship) and clear of
  the centre column's bands (the warning's, the stack's: narrower or lower, whichever costs her less), never under
  PLATE_SCALE_MIN; on the classic skin her foot over the compass box (the host's `classicCompassBox`), and the kit's face
  loaded by the readout itself. A SHORT screen (NAVAL_SHORT_H tall or less in the HUD's own pixels: a phone on its side,
  720 lines at scale 1.5) packs her - her bars side by side, her rose in two rows, port and starboard either side of
  bow over stern. THE CARD in its column at the HUD's scale capped by the room above the warning's band (`cardScale`;
  on foot the crosshair's arms); where that holds it at less than CARD_SCALE_MIN, or the screen is short, it stands
  ASIDE - slim, at the plate's foot beside her and her Brace, no wider than the room right of the quick block. THE AIM
  AND THE TALLY one stack under the crosshair, no wider than the room either side of the centre line, wrapped balanced
  (a range and its seconds kept whole); on a short screen closer, the aim its range and state alone (the rose's lit
  side is the battery), the tally its count alone and waiting while the aim is up, the warning closer too. The places
  are read (`placeParts`) on a change of the screen, the scale, the skin or her rows and every PLATE_LAYOUT_S - never
  every frame. The helm panel's bar is as wide as its buttons (it wrapped at half the screen), and a finger's stands
  centred in the room right of the corner's two presses (its 60 px reserve left the menu's press under it).
- **The plunder window** (`ui/navalPlunderWindow.js`, a lazy chunk behind `ui/navalPlunderDoor.js`, the Sigil
  Broker's door's shape): her colours, name, class and captain; HER HOLD (the first HOLD_ROWS by name, Take all, Open
  her hold); TAKE FROM HER (the three tiles); HER FATE (Scuttle her - the warn role's blood edge - and Cast her adrift);
  a raid's prize has Sail on. The back key and the scrim leave; the pad lands on the press the window is for.
- **The shipwright's window** (AUDIT NAV1, `ui/navalYardWindow.js`, a lazy chunk behind the plunder window's own door -
  one door shape for the sea fight's two windows, `openNavalWindow`): the purse; HER NEEDS - her hull, canvas, hands
  (a crewed ship's) and fire barrels (a ship whose stern rolls them), each what she has, what is wanting at what a
  piece, and its press (all of it, as much as the purse pays, or greyed - "Whole", or the price a piece); MAKE HER
  WHOLE or "Make good what your purse pays"; the last press's word under the title. The same kit and sheet as the
  plunder window (`injectNavalWindowStyle`), the rows its list well's.
- **The kit's roles** (`ui/enhancedFrame.js` FRAME_ROLES, each `body .dfnaval-*`): window `dfnaval-win`, panel
  `dfnaval-plate` and `dfnaval-card`, button `dfnaval-btn`, primary `dfnaval-take`, warn `dfnaval-scuttle`, tile
  `dfnaval-choice`, chip `dfnaval-chip` and `dfnaval-gun`, well `dfnaval-holdlist`, header `dfnaval-winhead`,
  headerRule `dfnaval-sechead`, listRow `dfnaval-item`. On Enhanced Plus the Plus sheet carries the kit; on the
  classic skin the readout and the window lay the kit's rules cut to their own selectors (`injectNavalKit`,
  `scopeRules` - moved into the kit's module so a HUD in the main bundle never imports the Broker's lazy chunk for it).

## The sounds (NAV-E)

Nine clips, OURS, synthesised from noise and sine by `tools/navalSfx.mjs` on the gun lab's kit (`tools/sfxSynth.mjs`,
moved out of `tools/gunSfx.mjs` unchanged - its three clips come out byte for byte as before) and baked to DAGGER.SND's
own 11025 Hz 8-bit mono by `tools/sndify.mjs`: the long gun near, a broadside across the bay (past NEAR_BOOM_M), the
swivel, a ball into oak, a powder barrel, the grapnels - and AUDIT NAV1's seventh, a battery RUNNING OUT (four gun
carriages' trucks rumbling over the deck seams one after another, the tackles creaking, the carriages brought up hard
against the sills: the tell before a broadside, carried to 900 m), and its eighth, a battery of mine READY (the rammer's
head rapped twice on the muzzle, the gun captain's iron tapped on the breech - heard at my own helm), and its ninth, a
ship GOING DOWN - a loop: the sea rushing into her, her timbers groaning under it, the air leaving her in bubbles, its
tail crossfaded into its head so it joins itself - played from her founder until she is gone at its own profile
(NAVAL_SINK_LOOP, linear to 420 m: further than her fire's loop, short of a ball's crack). DAGGER.SND's own play by
index: the splashes, the ship's bell as the colours come down, the bubbles of a ship going down (her first gurgle),
the burning loop. Every sound carries its own range (`navalSounds.js` NAVAL_SOUND_RANGE: the bus's footstep profile would have made
a broadside at 300 m silence), and none is played past its range's end (AUDIT NAV1: the bus's inverse law never
reaches silence). THE MIX (AUDIT NAV1, "The presentation"): each report its own pitch and level, my own ripple at one
over the root of its guns, the far roll once a volley and crossfaded in equal power with the near reports over
FAR_FADE_M either side of NEAR_BOOM_M; a ball of mine striking her heard at HIT_CONFIRM_REF_M.

## The picture (NAV-B)

One program (`render/navalRender.js`): soft quads premultiplied, the muzzle flame and the aim additive, the fog the
world's (FOG_GLSL); depth tested, never written, drawn after the sea's transparent top. The aim (AUDIT NAV1): the
zone's discs on the sea, a post of light over each (AIM_POST_HALF_W by AIM_POST_HALF_H, turned to the eye - a disc
150 m off was 3.7 px tall), a mark where a ball meets a hull (AIM_STRIKE_HALF), in the tones of `aimTone` - brass laid,
red on her, grey while the battery cannot fire - and each ball's ARC a LINE (#4): ARC_WIDTH_VH of the view's height
across at each segment's own distance (`writeRibbon`'s `vh`), in the line picture (NAVAL_TEXTURES `line`: solid across
its middle, nothing at its edge texels, the same along it but for the dash), repeated along the arc by its metres
flown (ARC_DASH_M, the second half ARC_DASH_DIM; `repeatS`, the one picture wrapped) and marching out on the sea's
clock (the frame's `time`) at ARC_DASH_SPEED. The textures are procedural
(white, the shape in alpha). The deck fires are Daggerfall's own fire flat (TEXTURE.210 record 1, FLAME_SCALE the
camp's size), carried on her deck as she heels, lists and trims, and out as the sea reaches each (FLAME_AWASH); a
muzzle flash and a burning deck light the scene (MUZZLE_FLASH_COLOR, BURN_COLOR,
BURN_LIGHTS). A sea ship's flag flies her colours (`navalShips.js` NAVAL_FACTIONS' `flag`, the one table; the renderer
draws the flags in runs of one colour - `flagRuns` - the player's boats keeping FlagMaterial's orange) - by her state
(AUDIT NAV1): her faction's while she sails, down when she strikes or founders, the captor's orange once taken; a hull the
mod gave no flag (the Carrack) is given the Small Ship's at her tallest mast's truck (`comeSailAwayPool.js`
graftColours, FLAG_DONOR_HULL). A hull hit's burst is grown for an eye far off (HIT_BURST_M, HIT_BURST_MAX). HER HURTS
(AUDIT NAV1, #15): under SMOKE_FROM of her hull, grey smoke along SMOKE_SPAN of her deck each way from amidships
(`navalEffects.js` smolder, SMOLDER_RATE puffs a second at the worst) from the part the sea has not reached
(`lineOver`); under DAMAGE_LIST_FROM a list to her going-down side (to DAMAGE_LIST_MAX, over DAMAGE_LIST_EASE_S; the
sinking's own list takes it on); her canvas down with her sail share, her highest sails first (`sailsShown` - a sail
node holds its skinned canvas alone, so her yards stand); and a ball into her hull sheds TIMBER_PER_HIT planks, laid
long on the sea (a particle's `aspect`), drifting, gone after TIMBER_LIFE or so. FAR SHIPS (#17): past NEAR_LIFE_M of
the eye a ship's animators and particle systems step every FAR_LIFE_EVERY frames with the time they missed, each ship
on her own frame of the stride; her animators found once; an idle particle system (stopped, nothing alive) returns
before any question (`unityParticles.js` stepSystem).

**Found on the way, fixed at the root**: Come Sail Away's stand-in for Unity's Default-Particle was a WHITE disc with
its shape in alpha, sampled by the drops' "Alpha Blended Premultiply" material (One, OneMinusSrcAlpha), whose `One`
takes the texel's colour whole - every oar's and rudder's drop drew as a white square. The disc is premultiplied now
(its colour its coverage), and its pin says so.

## The frame's cost (AUDIT NAV1, the online audit's #11-#14)

A sea fight is hulls, balls, smoke and bodies on decks, and none of it may cost a frame what the port's town of them
does not. The laws that carry it, each the port's own machinery made to do it rather than a thing skipped:

- **A SHIP IN THE WORLD'S COLLIDER IS CARRIED, NOT BAKED** (`player/collider.js` A MOVER'S BUCKET; `world.js`
  csaSyncColliders, `csaCarry`). Each collider of a boat is a bucket baked once; every sync carries it by the rigid
  motion its object made since - the bake's matrix undone and the new one done, a turn and a translation - and the
  collider's every query takes its point, and a ray its direction, into the bucket's frame, and brings a contact, a
  normal or a push back out: the world's up read as it stands (a deck rolled 30 degrees is ground, rolled 80 a wall, as
  the same deck baked rolled answers). A bucket is baked again only for a motion no turn carries (a scale), another
  shape (another collider, a box resized, another mesh) or the mode's collider changed. The sea's ships are synced
  again after the sea's own frame poses them (they stood a frame behind the hulls drawn). Every boat of the mod rides
  it - the player's own at her helm, rolling on the swell, re-baked every frame before.
- **A SHIP'S RAY, BOUNDS FIRST** (`world/prefabColliders.js`). A tree's colliders are indexed by its shape
  (`prefabShapeStamp`: a node hung elsewhere or given a component), what is on read live; a collider is asked only when
  the ray passes within its chain's reach of the tree's root (each link's length plus its largest scale times what
  hangs below - true at any turn of any node: the swell, a boom's trim, a sinking's list), then its box before its
  triangles, and a mesh of more than MESH_GRID_FROM triangles through its own grid (`rayMeshEntryWithin`: the cells the
  ray crosses, stopped past the nearest hit). The same hit, to the bit, as the walk it replaced.
- **A NODE'S MATRIX KEPT WHILE IT READS THE SAME** (`world/prefabNode.js` worldMatrix, rotation) - Unity's kept
  Transform: made again only when the node's own position, rotation or scale reads otherwise (their values, never the
  arrays' identity), its parent is another, or its parent's own was made again; the same product of the same values.
  A hull's box, her rig, her spars, her fires and her emitters asked it some 240 times a frame with eight ships near.
- **THE BOATS CULLED AS THE WORLD'S MESHES ARE** (`comeSailAwayPool.js` draw): a mesh off screen is not drawn, and is
  recorded for the shadow maps where it would cast into them (SHADOW-REACH, the world's law); one under CULL_DETAIL_PX
  across is not drawn. **A BOAT'S STILL PARTS AS ONE MESH**: the bundle meshes under her MeshObject whose chain has read
  the same STILL_FRAMES frames running are merged a texture a group (render/staticBatch.js, PERF4's builder, the
  town's own) and drawn once at her hull's matrix; a part that moves in her frame (a flag to the wind, a boom trimmed,
  a galley's oars rowing) leaves the batch that frame and is drawn on its own until it has been still again; a part
  switched on or off makes the batch again; the batch goes with her.
- **THE EFFECTS ON ONE SHEET** (`render/navalRender.js` NAVAL_SHEET): the four particle pictures in cells of their own,
  a clear texel round each (NAVAL_SHEET_GUTTER), a quad its picture's cell - a fight's frame three draws, the arcs'
  dashed line a picture of its own. **PAST THE BUDGET** (`systems/naval/navalEffects.js` EVICT_RANK): a splash's spray
  and foam and a port's glints first, then the splinters, scraps and embers, the flashes and the planks, and the smoke
  last - the broadside's wall - within a kind the nearest its end.
- **THE SEA'S WORD ONCE A TICK** (`world.js` navalWord): the moved test and the frame it rides ask one word.

## THE FOUR HOSTS RULE

Only the streaming world's host (`scenes/world.js`) has a sea: the naval host is made there and its frame runs in the
exterior branch alone. A building's host and a dungeon's (`scenes/worldModes.js`, `scenes/dungeonContext.js`) have no
broadside, and every transition into them, every teleport and every load empties the sea (`navalTransition`); the
`?exterior` bench's host (`scenes/exterior.js`) has no Come Sail Away runtime and so no sea fight.

## The save

`NavalCombat` in DFU's per-mod slot (`systems/modSaveData.js`, the Sigil Broker's precedent), version 1: each boat's
hull, sails, crew, fire and state by its deed's UID (a boat restored later picks its record up when it is first seen),
the crowns' notoriety and the day it was last decayed, and the raids the sea fight started. The sea's ships are never
a save's: they are the waters', rolled again.

## The settings

The Features row **Naval Combat** (group Combat, the port's own): the switch (`naval`, on; FORCED ON online), and in
its drawer Ships at sea (`naval-ships`: few, some, many), Pirates board you (`naval-boarders`), Raiders' plunder
(`naval-raid-prize`), Broadside camera (`naval-aim-camera`, AUDIT NAV1) and Ship handling (`naval-handling`: Responsive
or Classic, HELM-WAY - AUDIT NAV2 F14: taken once a helm, the next time the player takes it; a Carrack under way when
it flipped froze at 10.81 m/s for good) and Crew repairs on their own (`naval-auto-repair`, on: QUICK-REPAIRS) - each
the player's own online; a shared
sea is sailed at the lowest Ships at sea among the players who share it (Online, above).

## Departures (Port-Ledger section A)

- **The arc itself** is the port's own design, on Come Sail Away's hulls and Warm Ashes' quests.
- **Brace is the Crouch action at the helm**, not an action of its own. Every letter key is spent; Left Ctrl is free
  but a held Ctrl turns the helm's W into the browser's close-tab; ducking behind the rail is what bracing is, and a
  pad's LB crouches already. AUDIT NAV1: at the helm it is the brace alone - the motor's stance and a levitating
  descent are not fed while sailing (world.js `helmBrace`).
- **Come Sail Away's way and its sails take the sea fight's word** (AUDIT NAV1): the mod has no hurt, so the port's
  runtime asks the naval host three things it never asked - `wayScale` (its moveSpeed times the host's share: the canvas
  a shot-up rig still sets, a wreck's oars, nothing while she heaves to), `sailRefused` (RaiseSails refused with that
  line, before the mod's own obstruction) and `accelScale` (its moveAccel times HEAVE_TO_ACCEL while she heaves to).
- **Warm Ashes' LeaveShip asks a gate first** (above).
- **A pirate flagship starts `WAQ_SHIP_ATTACK_PIRATE`**, which the mod registers and never starts.
- **The player's boat is wrecked, never sunk.**
- **At a helm with guns the attack is the broadside's** (How it plays): the press lays them after a readied spell, the
  release fires as its own ungated statement beside the rig's, and the drag and the look under the held attack are
  the aim's - `scenes/world.js`'s five attack doors, `ui/gamepadInput.js` and `ui/touch.js` (`aimHold`); the pins that
  hold the old doors were re-pinned with the law they state intact.
- **Come Sail Away's soft drop premultiplied** (above) - a fix, recorded because the pin moved.

## AUDIT NAV1 (2026-09-29) - the deep audit

Mac, 2026-09-28, of the arc: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
and combat to flow perfectly, just like assisins creed black flag. This is your baby."

**THE AUDIT.** Six lenses, each run against a frozen snapshot of the arc on its own harness - the real naval host over
Come Sail Away's real pool, frames driven as `world.js` drives them - and each measuring rather than reading: THE
CAPTAINS' MOVEMENT (25 five-minute scenarios at 30, 60 and 144 fps and on jittered frames, seeded and on a constant
draw), THE HELM (the player's boat on Come Sail Away's runtime, the aim's sight lines ray-cast on the hull colliders),
THE GUNS (a thousand AI volleys at the player, 6,000 balls against a fine-step ground truth), BOARDING (Warm Ashes'
real quest files through the port's real parser and machine), THE PICTURE (the real HUD and pass in headless
Chromium) and ONLINE (two real hosts over a stand-in relay). About ninety findings; this section records what each fix
answered, slice by slice, and what was measured before and after.

### The captains (the seamanship)

The movement audit's twelve findings, and the guns' and boarding's that were the captains' own:

| finding | before (the audit's measure) | the law now | after (the same harness) |
|---|---|---|---|
| ships stall head to wind - no tack (M2) | a brig 600 m downwind of an anchored player made 0.3 m/s for 300 s and never fired; 108-147 s in irons in duels | no course nearer than CLOSE_HAULED: `tackCourse` beats on a tack, put about when the goal bears TACK_FLIP past the eye; a turn through the eye decided once - TACK with way (TACK_CARRY of her rate through it), WEAR the long way round without; in irons she PAYS OFF (PAYOFF_TURN) | first broadside at 159-184 s; the anchored duel 0 s in irons |
| the coast stall (M3) | 101 s loaded and in reach without firing, bow to the wind | the side that bears SOONEST: turn time against reload, a course past close-hauled presented close-hauled (`sailable`, BEAR_COST_S), a side onto the land never taken, the side held unless the other is SIDE_HOLD_S better | 0 s of hull on land; no side-dithering |
| half the player's pace (M4) | 2.5-4.4 m/s against the player's 6.2-9 | the classes rated at the player's own hulls (a brig 7.6, a cutter 8.0; `windShare` linear in the wind) | the pirate catches a boat beating or rowing, loses one running free |
| tops that snap into turns (M5) | a brig turned in 0.53 of her length, full rate in one frame, the heel stepping 18-20 deg/s | TURN_RADIUS_K lengths, eased over TURN_TAU, critically damped, a hard turn costing TURN_SPEED_LOSS; heel by way and turn and to leeward on a spring (HEEL_OMEGA, HEEL_ZETA) | a brig at 7 m/s turns 5.7 deg/s (the player's pace); heel steps 0.1 |
| hulls through each other (M6) | two merchantmen head-on overlapped 14.6 s; duels 16-52 s | `trafficCourse`: room given inside AVOID_SHIP_S, starboard for one met ahead (AVOID_HEAD_ON - the guns' audit found the rule run out to 112.5 degrees, steering her into a hull on her starboard beam), else away from the side one passes on; the host's `separateHulls` pushes overlapping hulls apart and takes their way into it | head-on 35 m apart; duels under 1.1 s |
| land crossed and scraped (M7) | an 18 m spit crossed; an island hugged with the hull on land 38.8 s | the hull's width sounded every SCAN_STEP past the turning circle; swings held; the course retried; a stem never stood on land (AGROUND_WAY, warped round); a big turn round the open side; waypoints never upwind nor across land, one reached let go | 0 s on land (a dead-end channel's quarter 12 s while it pivots) |
| the sea falls behind the time scale (M8) | 60% of the world's pace at x10, 20% at x30 | FRAME_STEP_S steps, FRAME_STEPS_MAX a frame (`stepSea`) | one long frame = ten short ones |
| the intercept minutes ahead, range overshot (M11) | the brig led a 5 m/s player by 162 s, 810 m | `intercept` solves the meeting (PURSUIT_LEAD_S past it); the enemy's way smoothed (TARGET_VEL_TAU); the bend (RANGE_BEND) only while reloading | first broadside at 92 s against a 3 m/s player (was 206-222) |
| never alongside - a wreck shelled forever (M1, G3) | a sloop 55 m off a wreck for 300 s, 59 broadsides, never grappled | a pirate comes ALONGSIDE on the side she approaches from, her way falling to stop her short, broadsides held; grapples across GRAPPLE_GAP; no captain fires on a wreck, and one that will not board her leaves it (WRECK_SPARE_S); AUDIT NAV2 F22: the berth sounded (one on land swapped for the open side), a way round land by one sounded waypoint, and a boarding that gains nothing in CHASE_GIVE_UP_S given up | the sloop grapples at 94 s, the brig at 69 s |
| still never alongside in a third of the winds (the online audit's #10, offline too) | a brig 60 m off a wreck lying still - her stern to the wind's eye, or the berth to windward - beat and wore round it (a brig wears through a circle of 150 m): 180 of 512 approaches (8 winds by 8 bearings by 4 headings, from 60 and 150 m) never grappled in 120 s, the rest at a median 42 s; the player sat with a hostile ship in sight, so no journey and no rest | HER SWEEPS (`navalAI.js` SWEEP_RANGE, SWEEP_WAY, SWEEP_TURN): within SWEEP_RANGE of the berth of a boat lying still she gets out her long oars - pulled round the short way at SWEEP_TURN at least, through the wind's eye as readily as from it, SWEEP_WAY of way whatever the wind, paced to stop her short of the berth - and makes straight for the berth, never the point astern of it that a boat under way is met from | 512 of 512 grapple, at a median 34 s, the worst 96 s |
| no giving up (M12) | a chase ended only at 750 m | DISENGAGE hysteresis; a chase that gains nothing in CHASE_GIVE_UP_S (past her fighting range) given up, the chased left SPARE_S; AUDIT NAV2 F21: the gain measured against the farthest mark of the last CHASE_GIVE_UP_S | the 7 m/s runner given up at 150 s |
| paths depend on frame rate | a galley duel ended 0.7-1.5 km apart between 60 and 144 fps | the lookout on her own clock (NAV_EVERY_S), the heel stepped at 0.05 s | 5 m at most on the same draw (a spit 43 m) |
| a galley never rams (G9) | - | `checkShipRams`: a galley's stem into a hull at RAM_SPEED is the ram's own law (braced, half); AUDIT NAV2 F26: one captain's on another's sound ship stops at the strike | - |
| prizes fill the sea (B1) | three prizes emptied the sea until the next transition | `boarded` cleared on a win; engaged only while fighting, alongside or boarded; only a ship afloat fills a berth; a prize cast adrift drifts off (ADRIFT_SPEED); AUDIT NAV2 F23/F27: engaged means fighting afloat, or targeted by a ship that is | a new ship rolls with two prizes lying by |

### The guns (the gunnery, the tell, the ball)

The gunnery audit's fifteen findings, and what the slice's own harness found on the way (`nav2` in the session's
scratch: the audit's duel re-pointed at the live tree - the player's Small Ship on a scripted course, a captain on
her own, every AI volley re-flown against the player's real hull box; and the time-to-wreck and fire-interval runs):

| finding | before (the audit's measure) | the law now | after (the same harness) |
|---|---|---|---|
| the AI fires at the edge of its window (G1) | the first frame the lead came within 13 degrees: 12.9 degrees off at the median, 0% of balls at 150-200 m (270 volleys) | the lead laid abeam; the FIRE WINDOW (`fireWindow`): her half-extent across the line of fire - her length turned to it, her half beam - times the crew's share (FIRE_EXTENT_K, FIRE_EXTENT_SKILL more at no skill) over the range, never inside the gun's spread nor past BEAR_DEG; laid at AIM_FREEBOARD of her height, chain shot through the middle of her rig; the crew's range error LAY_ERR | 79-81% of balls on a Small Ship inside 150 m, 65% at 150-200 m; the near misses pass her bow or stern, the far ones fall short and long too |
| no warning, and the brace free (G6) | the flash and boom 1.0-3.3 s before impact the only cue; holding Crouch for ever doubled the time to wreck | THE RUN-OUT: a battery runs out RUN_OUT_S before it can fire - begun only when the lead will bear inside RUN_OUT_S (`bearsWithin`) and within RUN_OUT_REACH of its reach, run in unfired past RUN_OUT_WAIT_S or RUN_IN_DEG and not again for RUN_IN_S; the glint at her ports, the trucks' rumble (`naval-runout.wav`), BROADSIDE over the crosshair from the run-out through the balls' flight; a peer's ship's run-out on the wire as bits; the brace stops the reload | every volley warned 1.30-2.90 s ahead (median 1.33 s); bracing on the warning alone: a brig's time to wreck 77-288 s becomes 305-454, a flagship's 201-304 becomes 346-574 |
| pirates feud (G5) | 3,227 hull lost to sisters' balls in 16 fights; six feuds | a friend within FRIEND_CLEAR of the line from her guns out past the lead holds the battery (`lineFoul`); a stray from her own trade, or between two lawful ones, provokes nothing (the host's `strike`) | no feud |
| one volley strikes and sinks a prize (G7) | 99.7% of Small-Ship broadsides that struck a sloop sank her too | the rest of the volley that struck her floors at one hull (STRUCK_GRACE_S, the same striker); striking puts her fires out | a prize stays a prize; a new volley sinks her |
| the guns cannot reach down (G8) | every broadside 0% on a Large Boat inside 25 m, a galley's inside 60 | the carriages to -8 (long), -6 (great, chase), -10 (swivel); a lay that passes over her or falls short is never run out nor fired (`layPasses`) | a sloop alongside to grapple under a Small Ship's broadside at 25 m; the galley holds a volley that would fly over a boat under her side |
| chain shot slows nothing; a plunge does no harm (G4) | 4.5-5.7 of 144 canvas a volley on her waterline; laid at her sails, 0 at 60-100 m; 48% of plunging balls "rig" for 0 hull | the RIG a target of its own (HULL_BUILDS `rig`, measured off the prefabs' spars and riding the hull's matrix): a ball through the canvas tears it and flies on, once a ship; the hull box's roof is her deck, hull | a chain volley through a brig's lateens tears about 64 of her 144 canvas |
| the ripple fires from where she was (G10) | a Carrack's last gun 4.9 m behind its port at 9 m/s | each gun from its port carried by the deck's way over its wait (`volleyLaunches`) | 0 |
| dead constants, and fire does little (G11) | FIRE_CHANCE read by nothing - the host's own 6% on every zone; a barrel's fire a ball's; one fire topped up | FIRE_CHANCE of a hull hit above the waterline only; a barrel's fire BARREL.burnPerSecond for BARREL.burn; fires stack to FIRE_STACK and eat canvas and men | - |
| the waterline by the box's axis (G13) | 65 of 2,121 hits misjudged on a heeled hull | the height of the point it struck | 0 |
| every hull box rebuilt for every ball (G14) | 1.5 ms a frame for 30 balls and 6 hulls | the targets read once a step | one reading a step |
| barrels only bob (G9) | "where it drifts", and it did not | FLOAT_DRIFT of the wind a second | downwind |
| no long reach (G15) | the great guns 157 m, the long 211 | the great guns HEAVY: 68 m/s to 15 degrees | 263 m against 231 from a galley's deck |
| no count of a volley (G15) | - | THE TALLY under the aim: struck, below her waterline, through her rigging | - |
| (the slice's own) presented at a flat PRESENT_SAILS | fell astern of a boat under way and chased her again | her way matched to the enemy's along her course (PRESENT_GAIN on the lead's draw), PRESENT_SAILS the floor | kept abeam |
| (the slice's own) a side the wind will not let bear | close-hauled, the lead 8-26 degrees abaft her beam for a minute, unfired | NO_BEAR_S in the side's weighing; not presented (full sail to go round) | she wears or tacks to show the other side at once |
| (the slice's own) the helm trailed the orbit | a steady orbit held the lead 4 TURN_TAU times its rate (8 degrees) aft of the beam | presented, the helm leads by the heading's own rate (TRACK_TAU, a jump past TRACK_JUMP a new course) | a still boat's second broadside from the same side 23 s after the first, where it came 100 s later from the other |
| (the slice's own) the rule of the road steered into a beam hull | "starboard for one ahead" ran to 112.5 degrees | AVOID_HEAD_ON; else away from the side one passes on | - |
| (the slice's own) slugging hull to hull | loaded, she held a boat 18-28 m off her side | loaded, she still opens the range inside POINT_BLANK of her fighting range | - |

THE BALANCE, measured (the player's Small Ship circling at 3 m/s and never firing, boarders off): a brig wrecks her in
77-288 s unbraced and 305-454 s braced on the warning; a flagship 201-304 and 346-574; a corsair galley 172-220 and
258-452. A boat making way slowly is broadsided every 12 s (median; 21 s at the ninetieth), one circling at 5 m/s
every 16 s (44), and one running free at 7 m/s outruns a brig. The player's side is the audit's own (a same-level brig
takes 4-5 good broadsides): the fight is the player's to win, and the tell is how.

### The helm (the aim)

The helm audit's aiming findings (the player at the guns; 1080p, DFU's default FOV 65 degrees and mouse sensitivity 2.0 -
0.286 degrees a count):

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| the lay too sensitive to aim with (H2) | where the look met the sea: the Large Boat's lays a count apart from the horizon 150, 150, 150, 131, 98, 78, 65 m - none inside a sloop's red window at 120 m (108-116); the Small Ship's first 11 counts "(longest)", then 11-18 m a count | `lookReach`: where the look meets the sea while that point moves out less than AIM_SLOPE (30 m) a degree - the seam where sin^2 = h / slope, one value and one rate either side - then AIM_SLOPE a degree through the horizon and over it; the lay measured from the guns along the fire | the Large Boat 8-9 m a count (141, 132, 124, 115, 107 ...); the Small Ship 8-9 m a count, "(longest)" 7 counts under the horizon |
| a look on a ship laid past her (H2, H7) | the ray through her side met the sea behind her: the lay flew over | THE LOOK ON A SHIP (`lookOnShip`): the nearest of her hull's box and her rig's the look meets within the battery's reach (+LOOK_REACH_PAD) lays the guns for that point, at its height (`look.at`); on her canvas round shot is laid for her hull's centre and chain for the canvas; her way along the fire led over the ball's flight | the crosshair on her side: all six of a Small Ship's arcs end in it |
| red judged from the crosshair, and wrong (H3, H7) | red when a landing fell in her footprint +-2 m: against a beam-on Small Ship at 150 m, red laid 132-152 m, balls striking laid 134-198 m (23 lays that hit never red, one red that missed); five red lays missed a ship sailing away at 3.7 m/s; only the ship under the crosshair asked - a galley laid square on a sloop 14.7 degrees off it: no red, no card | `aimStrikes`: each gun's unscattered arc walked HOT_STEP_S at a time against every ship's hull box (and her rig's for chain) moved on by her way over the ball's time aloft; red when a gun strikes and the battery can fire; each arc drawn to where it stops, a mark where it meets her; the card is the ship the guns strike | red exactly when the unscattered balls strike, wherever the look is |
| no broadside camera (H4) | the Small Ship's rail hid the sea for every lay under 82-84 m from the helm; the head on the crosshair | THE BROADSIDE CAMERA (`aimEye`): while a broadside is laid the eye eases (AIM_CAM_TAU, smoothstepped) to AIM_CAM_OUT past the battery's ports, AIM_CAM_UP over them, AIM_CAM_AFT toward the stern - AIM_CAM_CLEAR short of a ship alongside - and home on the release; the look's ray starts from it (`_dwEyeOffset`); never for the chasers or a crippled ship; the row's Broadside camera part | the eye outboard of her own hull: nothing of her between it and the zone |
| the aim looks ready when it is not (H9) | the zone drawn braced, reloading ("Starboard broadside - 164 m" at 12% loaded) and wrecked; a braced release silent; no time on the reload | the aim's STATE (`aimState`): the line's tail says why - "reloading 6.1 s", "braced", "no barrels", "guns silent" - dimmed, the zone grey, never red; a braced release says so; the reload's message its seconds | - |
| the zone a sliver on screen (H10) | discs 6 cm over the sea: 3.7 px tall at 150 m from the Small Ship's helm, 0.7 px at 100 m from the Large Boat's | a post of light over each splash, turned to the eye (AIM_POST_HALF_H: 3.4 m) | about 19 px at 150 m |
| no way to mend her (H1) | the page promised a shipwright and none stood: `repairCost` written into the readout and read by nothing, the one mend a prize's timber - a Small Ship shot to nought still wrecked at hull 0 after a reload and an hour at sea, its unread quote 5,940 gold; with "Pirates board you" off a wreck stayed one for ever | THE SHIPWRIGHT (`yardHere`, `yardModel`, `navalYard.js`, `navalYardWindow.js` behind the plunder window's own door): a port's waters, still, no hostile near - hull, canvas, hands and barrels by the piece as far as the purse pays, MAKE HER WHOLE in order; HER HANDS' MENDING at sea to FIELD_MEND_CAP after FIELD_QUIET_S, a wreck afloat past FIELD_REFLOAT; the wreck's hint "Crippled - make port for a shipwright" | a wrecked Small Ship floats again after 75 s of quiet at a full crew, and a port makes her whole |
| boarding needs a near-stop, and nothing says so (H11) | refused above BOARD_SPEED with the card at "Colours struck" - no key, no reason; under sail W/S do nothing, and a Small Ship at 8.2 m/s with her sails struck took 28.4 s and 151 m to come under 2.5 m/s | HEAVE TO (`heaveFor`, `startHeaveTo`): a struck ship in reach and the helm too fast - the card "Colours struck - E: heave to", the hint "E: heave to beside her"; the press strikes the sails and takes her way off at HEAVE_TO_ACCEL times her own rate (Come Sail Away's `accelScale`, nothing driving her on) until she is under BOARD_SPEED, HEAVE_TO_S at most, and never for a ship no longer struck | about 3 s from 8 m/s to boarding way |
| no ship bearings on the compass (H14) | the card only within 6 degrees of the crosshair; "There are enemies nearby" and no direction | THE SEA'S SHIPS ON THE COMPASS (`compassShips`, `hud.js drawShipCompassMarks`, `enhancedHud.js` the strip's `hud-ship` marks): within COMPASS_SHIP_RANGE, afloat or struck, by what she is to me - hostile red, a ship bone, struck grey - a triangle turned up (a bow; the party's and a Detect's point down) | - |
| a fire on my own deck invisible (H15) | only `damage.fire`: a chip on the plate | my own boat's fire as a sea ship's (`poseMyFires`): the flames along her deck with her, the embers and smoke, the burning loop, her glow first among the host's lights; out with the fire | - |
| (minor) my volley skill fixed | 0.6 whatever was left of the crew | `crewSkill`: PLAYER_SKILL at a full crew or my own hand, down to PLAYER_SKILL_THIN at none | - |
| the brace is the Crouch toggle (H5) | the press toggled the motor's crouch under the helm's freeze: the first brace left the player crouched (the eye 1.7 m over the feet to 0.8 - the lay 6.1 m shorter at 150 m), the next stood them; a phone had no brace - the touch table's slots hold none by default, and the hint said "Crouch: brace" | at the helm the Crouch action is the brace alone (`helmBrace`: the stance and the descent never fed while sailing); under a finger the plate's own BRACE, held (`navalTouchBrace`), named "hold Brace" in the hint and the warning; under Enhanced Plus the pad layout puts Crouch on R3 (its bumpers are the crossbar's) and the hint names it | - |
| the ram cannot land (H6) | the bow point `beam x 2.4` from the root: a stem 1.0 m (Large Boat), 1.2 (Small Ship), 5.0 (Carrack) and 29.2 m (galley) inside her box before it counted - and Come Sail Away takes the way off a bow at the planking it meets: no ram ever landed; its recoil `RAM_RECOIL * 2`, the page's RAM_RECOIL | the STEM (`bowZ`) within RAM_REACH of her box, read after the hulls are posed; the way she came in with (the most of the last RAM_MEMORY_S) less hers along the course; the way spent on the first; BOW_RECOIL named - a plain stem takes twice RAM_RECOIL, a galley's ram a GALLEY_RAM-th - half braced | a Small Ship at 6 m/s rams for 84 and takes 50; a galley's ram from her own stem for 252 |
| her hurts never in her handling (H8) | WRECKED_OARS read by nothing; a shot-up rig kept its whole way to the last of its canvas; wrecked, the host struck the sails every frame they went up - a line a press on top of the mod's own | Come Sail Away's seams: `wayScale` (moveSpeed times `wayShare` under sail - BARE_POLES and the rest by the canvas left - and WRECKED_OARS on a wreck's oars) and `sailRefused` (RaiseSails refused with one line: a wreck, a rig shot away); a rig lost with the canvas set struck once | - |
| (the slice's own) the aim and the ram read the last frame's hulls | computed before the ships were posed: a ship's way behind | both after the poses | - |

### Boarding (the grapple, the raid, the prize)

The boarding audit's findings (Warm Ashes' real quest files through the port's own parser and machine; the host over
Come Sail Away's real pool) - B1, prizes filling the sea, was the captains' (above); B8, a boarding online, is the
online slice's:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| Warm Ashes' raid never starts on the open sea (B2) | both raids threw in the sea's region - 31 holds no house for the raid's `_KnightlyGuard_` (message 1013's "on your way to ...") - so the sea fight's boarders fell back to the arc's own party and a crewed Small Ship (24 men) met 4 boarders with no hand of hers beside the player | `waRaidQuest`: a raid parsed while the player's region is the sea's (Warm Ashes' WA_SEA_REGION) reads the crown of these waters' region for the length of its parse alone - the mod parses it on a voyage's arrival, in the destination's land region; both starters through it (the sea fight's boarders, and Warm Ashes' own coroutine for an Overworld raider alongside); every repel the raid does not run brings her hands (`handsOf`) | both raids parse in a crown's region; a refused raid's repel has 4 hands beside the player |
| the flagship's raid invisible, and endless (B5) | its file WAQ_SHIP_ATTACK_PIRATE names itself WAQ_SHIP_PIRATEATTACK: "one raid at a time" never read it running. Slower than its hour after the second wave, its `_retreat_` cleared the waves and stopped its own end - no leader, no end, and the boarding that waited on it held every other off; a win reached the sea fight 25 s after its leader fell | WA_RAID_QUESTS the machine's own names (each file's `Quest:` header); the raid WON the frame a winning task fires (`raidQuestWon`, polled); its retreat - the mod's own unfinished clock - the boarders falling back (`raidQuestRetreated`, `castOff`) | - |
| a raid let go of runs on (B6) | swimming 200 m away, a transition or a respawn: its quest kept running, its waves round the player (8 Rogues grown to 10 in ten game minutes) | `board.endRaid` - QuestMachine's own TombstoneQuest - from every early end: the cast-off, my deck left to them, the sea emptied, her ship gone; its living boarders withdrawn by their quest's UID (a tombstone leaves the foes it made standing), except her stranded ones | - |
| boarders who cast off stay alongside (B7) | swimming away: "Her crew stands down" (a line for boarding her), and a fresh grapple at once; the raid's hour out: "cast off", and she grappled again | `castOff`: her boarders withdrawn, SPARE_S before she will take me again, and she sheers off RAIDER_SHEER_M (`sheerOff`, NAV-R's own); my own deck left: "You leave your deck to them" | no grapple in the next 20 s |
| "her crew surrenders", and fights on (B3) | the prize window opened over three survivors still swinging; rest and travel refused while they stood | `board.standDown` for each living man before her window - the quest system's own restrain (hostile no more, where he stands); one still standing up yields as he arrives | - |
| the fire's finish unannounced (B4) | a burning struck brig went struck, sinking, sunk: no bell, no "going down", no cask, no reward; boarded and burning, she foundered 6 s in, the fight ran 22 s on a sinking deck and ended without a word | one arm for a ball's change and her fires' own (`stateChanged`), charged to who set her afire (`fireBy`) - another's fire never mine; the grapple puts her fires out; a boarded ship going down ends the fight, her men over the side and the player set on their own deck ("Back to your ship!", `founderUnderFight`) | - |
| nothing on screen in the fight (B9) | `hudModel` answered null on foot during a boarding, in a board and a repel fight alike; the captain the win asks for a plain Spellsword among the rest | THE FIGHT'S CARD in the target card's place (`fightOf`, navalHud.js `fightCard`): whose deck, her captain standing or down, her crew down and the count they yield at (SURRENDER_SHARE); the boarders and where from, their tally (a raid's its own); the haul; her captain by name on the target bar (`spawnFoe`'s `name`) | - |
| a wave on a heap (B10) | a raid's spot drawn at random from 12 with no test: of a wave's opening 13, a median of 5 on a spot already taken | the deck DEALT (`dealer`): DECK_SPOTS shuffled once, taken round, for her muster, my hands, the arc's boarders and a raid's waves; the world passes over a spot a body holds or one standing up there (the ring's own `entityOccupancy`, `holdSpotWhile`); every spot held, the wave waits; a raid of mine whose fight is over is stood nowhere - never the open ground's ring round the player | a wave of 13 on 13 spots |
| after the prize, not at the helm (B11) | "Leave her" left the player on her deck with 2.2 m of water between the hulls; back aboard at a deck spot, off the wheel | her fate decided, "Leave her" pressed ('leave', its own way out - the back key and the scrim only shut the window, her deck still to walk) or her going down under the fight: over my rail and at my wheel (`takeHelm`, Come Sail Away's StartSailing) | - |
| too fast to board, and nothing says so (B12) | the card stayed at "Colours struck" | answered by the helm's HEAVE TO (H11): "Colours struck - E: heave to" | - |
| no "lower your wanted level" (B13) | notoriety fell only by its day's decay; a taken lawful ship added more and no choice lowered it | the prize's FOURTH CHOICE (`papers`): a lawful prize's papers burned, a pirate's crew handed to the crown - PAPERS_NOTORIETY (the boarding's own weight) off my notoriety in her crown's waters, greyed where no one hunts me; the one choice as ever; the tiles two by two | - |
| a save mid-fight loads into the sea (B14) | F9 in a boarding: loaded at her deck's height over open water, the prize gone | `saveRefused`: a boarding under way, or feet on a ship of the sea's deck (DECK_REACH_M), and "You cannot save now." - F9, the checkpoints and the pause window's Save | - |
| (minors) | a hostile ship lost the player off the helm (a second pirate 18 m off went to cruise); only a hull collected a cask; a rowboat's powder tile said "Your guns are loaded" | the boat the sea takes me by (`boatInPlay`): at her helm, the one I boarded from, the one under my feet; a swimmer's cask into the pack (SWIMMER, the world's `swimming`); "No guns aboard" | - |

### The presentation (what a sea fight looks and sounds like)

The presentation audit's findings (the real HUD, helm panel, readout and naval pass in headless Chromium; the host over
Come Sail Away's real pool). Of its seventeen, the guns' and the helm's slices had already answered the broadside's
warning (#6: the run-out and BROADSIDE over the crosshair), a fire on the player's own deck (#7's third part), the
sea's ships on the compass (#14's second) and the aim's reasons (#5's readout); the rest, as each is fixed:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| a ship vanishes with her masts standing (#1) | she settled her deck and 8 m (`(deck + 8) k²`), then was removed: the last frame drawn left a brig's highest spar 19.5 m over the sea, a galley's 24.5, a carrack's 32.2 - only the Large Boat was under | GOING DOWN (`navalDamage.js` SINK_LIST, SINK_PITCH, SINK_CLEAR; `sinkAngles`, `sinkDepth`): she lists to her seed's side and goes down by the head or the stern (her seed's next bit) as the time grows, and her root settles by its square to `sinkUnder` - her highest point at her last pose, SINK_CLEAR under the sea. Her spars measured as they stand (`sparsOf`: every rigid mesh of her rig and hull under her mesh object - a skinned sail's bind pose is not where it hangs, the Carrack's reads 101 m - once a hull and rig, the Large Boat's 6 to 9.4 m apart) | every hull 1.6-2.3 m under at the last frame drawn; half her height still stands at half time |
| a peer never sees a sinking (#1) | a puppet's damage was never stepped and every word's `restore` set her sinking clock to nought: a peer's brig stood whole at the surface for 22 s, then was removed from 40 m | her sinking run on the peer's own clock between the words (`sinkOn`, to SINK_SECONDS at most); `restore` starts it only on a new sinking; one the word lets go of while she sinks finishes going down (`letGo`, `lost`) - an afloat one goes at once, a room left takes them all; a second scuttle never starts her over | a peer's brig settles with the stander's; let go of at 18 s, gone at 21.9 s, 1.9 m under |
| fire and sinking disagree (#7) | a burning ship holed to nought lost her flames and her loop within 0.1 s (`settle` doused her); a scuttled prize "burns to the waterline" kept hers at her deck's height as she settled - at 20 s they burned 5.1 m under the sea, and 62 embers and puffs were born under it (the sea writes no depth: they showed through) | her fires burn on as she goes down (the sinking douses nothing - a scuttling's torch), each flame on her deck as she lies (through her mesh object: heel, list and trim) and out as the sea reaches its place (FLAME_AWASH), no ember nor smoke born under the sea; the loop out with her last flame | holed: out at 7.9, 8.5, 9.1 s; scuttled: 6.9, 7.5, 8.1 s; nothing under the sea |
| her colours as she goes down (#8, its sinking part) | her faction's flag flew on from a masthead under the sea | the flag's emitter stopped as she founders | - |
| a hit barely registers (#3) | her hull struck at 150 m came to the helm at -19 to -20 dB (the hit's reference 16 m), 2.4 s after the ripple, under its roll; splinters 0.18-0.4 m (two pixels), the flash eight for 0.08 s; her card's bar slid for 160 ms | a ball of mine striking her heard at HIT_CONFIRM_REF_M; the burst grown for a far eye (HIT_BURST_M to HIT_BURST_MAX: the splinters, flash and puff by it, thrown faster, a few more); her card's hull bar reads it as the foe bar does - the ghost where it was, a piece breaking off over the span, the card's frame flashing CARD_HIT_S (`ui/barLoss.js`, the vitals' law in a home of its own) | at 150 m -8 dB; a splinter up to 1.2 m |
| the reload silent and backwards (#5) | nothing played as a side came ready (9.2 s: only a class changed); the fill read 97% at 97% and dropped to nought, loaded; its wash 1.4-1.6:1 on its chip | the gun captain's word as a battery of mine comes ready (NAVAL_SFX.ready, the eighth clip), its chip's flash for READY_FLASH_S, never for a side loaded when I take the helm; a loaded side FULL brass; the wash with a lit level line - the aim's reasons and the braced release are the helm's | the wash 2.2-3.0:1 on every theme, its line more; the text on it over 4:1 |
| a ship's colours (#8) | struck, taken and sinking flew her faction's flag; the Carrack's prefab had no FlagObject - the pirate flagship and the merchant carrack flew no colours; a hostile navy or merchantman's card kept its trade's colour (`.hostile` lost by source order) | her colours by her state - hers afloat, down struck or going down, the captor's orange taken; the Small Ship's FlagObject grafted at a flagless sea hull's tallest truck (`graftColours`), a player's Carrack the mod's own; the hostile red last | the Carrack's black at 47.5 m |
| the mix clips, and far guns get louder (#9) | my ripple of six summed to +3.4 dBFS at the default volume (11% of samples clipped at full); every gun one clip at pitch 1; the far roll 6.5 dB over the near at the switch, and played once a GUN; the inverse law never silent (0.006 at 5 km) | THE MIX: my own ripple at one over the root of its guns, each report GUN_PITCH_JITTER and GUN_GAIN_JITTER_DB its own; the far roll once a volley at FAR_MATCH times the root of her guns (the clips' own RMS through their references), crossfaded in equal power over FAR_FADE_M either side of NEAR_BOOM_M; nothing past its range | my ripple -4.4 dBFS at the default volume; at full 0.27% of samples (a single report is 0.95 - the bus has no limiter: a bus-wide change, not the arc's to make) |
| the broadside's feel (#16) | the release shook the camera once, 1.2 (a Thunderlock pistol 3); a powder barrel on my deck 1.6 to a holed ball's 2.5; each launch 2.8 m aft of its port at 6 m/s | each gun of mine kicks as it goes (GUN_KICK, along the ripple); a barrel's blast BLAST_SHAKE; the launch carry the guns' slice's (`volleyLaunches` carry) | six kicks of 1.1 a Small Ship's broadside |
| a phone's helm stack covers the aim (#2) | at 844x390 the helm panel's bar 188 px tall; the card over the band under the crosshair (204-299, the aim printed inside it); the plate 272x263, 67% of the screen's height (73% at 740x360), over the helm panel's buttons | THE LAYOUT (The UI, above): a SHORT screen packs the plate and caps her by the room under the bar; the card ASIDE at her foot; the aim and the tally one stack under the crosshair, the aim its range and state alone; the Brace a finger's own press at any scale (under her rose it shrank to 23 px); the bar as wide as its buttons (it wrapped at half the screen) and a finger's clear of the corner's presses (the menu's stood under it once it was) | at 844x390 the bar 138 px, the plate 214x156 at 0.79 under it, the card at 259-314, the aim at 215; nothing over anything on 16 screens, aim up and down - but the warning, for its seconds, over the bar's foot on the two shortest phones (14 px at 740x360, 6 at 667x375) |
| the classic skin's plate (#10) | she stood on the classic compass (91% of its width and 57% of its height at 1280x720; 79% by 74% at 1920x1080), the readout in monospace (the face was the enhanced HUD's to load) | her foot over the compass box (`classicCompassBox`: COMPBOX at the classic scale); the readout loads the kit's face itself | clear of the compass; the pixel face on every skin |
| the HUD scale (#11) | the plate over the vitals at 1.5 on a 1280 or 1366 screen and at 2 on 1920; the card, the aim and the helm panel's bar one size at every scale; three of the HUD's notice lines over her at 1.5 on 1280x720 | the plate over the vitals where she would meet them, never shrunk for them; her scale capped by her room and clear of the centre column's bands; the card, the aim, the tally and the warning at the HUD's scale, the card capped by its column's room above the warning (`cardScale`), aside under CARD_SCALE_MIN; the stack no wider than its room | nothing over anything from 0.5 to 2 at 1280x720, 1366x768 and 1920x1080 (the card at 1.21 in 1366x768's column; at 2 on 1280x720 the plate 1.57, the aim in two lines); the notices (ENH-NOTICE3's panel, over every HUD part by its own z) still meet her top at 1.5 on 720 lines for their seconds |
| contrast off Slate, two wording slips (#12) | the plate's hint (which carries "E: board her") 1.9:1 on Stone, 3.7 on Iron, 4.1 on Forest; on Stone the waters 2.9, the labels and the card's sub-line 3.8, the plunder window's sub-line, lede and counts 3.3-3.5; a refused choice's reason 2.3 (3.2 on Slate); "The Crimson Gannet are coming alongside"; the card's "Taken - E: her hold" to the plate's "open X's hold" | the hint in the waters' tone; the sea fight's dim words joined to MERGE-PLUS D3's Stone rule; a refused tile greyed by its title and ground, its reason whole; "X is coming alongside"; the hold one wording, "open her hold" | the hint 5.1 on Stone, 5.5 on Iron, 6.2 on Forest; the plunder window's 5.8 on Stone, a refused reason 6.5 (10.8 on Slate) |
| a pad player told keyboard keys (#13) | "Hold RIGHT CLICK to aim - C: brace", "E: board The Red Wake"; the helm's pad prompts the d-pad's alone | with a pad in hand the readout names its buttons (`hdGlyphName`); at an armed helm the prompt bar shows the guns' rows (`navalPadPrompts`) | "Hold RT to aim - LB: brace", "A: board The Red Wake"; the bar's RT, LB and A |
| the firing zone at range (#4) | each ball's arc a 0.12 m ribbon: 0.7 px across at 150 m, ~30 px beside the eye where the broadside's arcs leave her side; drawn in the soft dot a segment (beads, nought at every joint); its 2.5 m dash judged once a segment - each 8 m of it - aliasing to 1, .35, 1, .35, .35, 1 | THE ARCS AS LINES (`navalRender.js` ARC_WIDTH_VH, `writeRibbon`'s `vh`): ARC_WIDTH_VH of the view's height across at each segment's own distance, in the LINE picture (solid across its middle, the same all along it), repeated along the arc by its metres flown (ARC_DASH_M, the second half ARC_DASH_DIM) and marching out on the sea's clock at ARC_DASH_SPEED | 3.2 px across on 1080 lines at any distance; the dash one run from the muzzle to the splash |
| the sea says nothing (#14) | one card, for the ship within 6 degrees of the look, was all the sea said: a ship off the look was nameless, and a pirate turning on me said nothing | THE SHIPS' TAGS (The UI, above: the host's `tags`, the world's `navalTags`, `drawNavalTags`) over each ship in reach, nearest first, her name, hull and state, the card's ringed; THE LOOKOUT's "Sail ho!" (`hailSails`) as a ship afloat turns hostile within SAIL_HO_RANGE, where she bears | eight ships tagged to 700 m; "Sail ho! A Pirate Brigantine on the starboard beam!" |
| a ship's hurts unseen (#15) | her hurts showed nowhere but the card - no smoke, no list, no canvas lost, no wreckage; a gurgle at her founder was all, then silence for the rest of her going | HER HURTS SEEN (The picture, above): smoke along her deck under SMOKE_FROM, a list under DAMAGE_LIST_FROM taken on as she fills and taken on in turn by the sinking's (her last pose unchanged), her canvas down with her sail share from the top, planks off a holed hull; SHE GROANS AS SHE GOES DOWN - the ninth clip, a loop at NAVAL_SINK_LOOP from her founder until she is gone (asked again each frame until the bus has it), a peer's ship too | a Small Ship at a fifth of her hull lists 4 degrees and smokes along 26.5 m of her deck; a carrack at 40% of her canvas shows her two lowest sails; two planks a ball, three a heavy one |
| the far ships' cost (#17) | five war galleys 650-1,900 m off cost 5.7 ms of a frame on the CPU: their rigging stepped as a near one's, each ship's tree walked for her animators every frame (0.44 ms a galley), and each of a galley's 224 particle systems (one live) asked whether it was active before doing nothing (0.45 ms) | an idle system (stopped, nothing alive) returns before any question; a ship's animators found once; past NEAR_LIFE_M her rigging stepped every FAR_LIFE_EVERY frames with the time it missed, each ship on her own frame of the stride | 0.9 ms for the five far galleys (five galleons 0.67; five galleys alongside, stepped every frame, 2.1) |

### Online (the shared sea)

The online audit ran two and three real hosts over a stand-in relay carrying each player's word at the world's cadence
and their blows as directed frames (`test/navalRoom.mjs` now). Its fifteen findings, as each is fixed:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| the sea goes with its stander (#2) | a stander who died at the rail, went indoors or dropped took every ship with it for everyone within 2.5 s, mid-fight; two standers who met kept six ships between them, and the three of the one who stopped standing sailed on at 1.35 to 5.2 km for good | THE SEA HANDED ON (Online, above): the heir takes a departed or quiet stander's ships over where they lie, one past their count; anyone else keeps them ORPHAN_S for its word; every player lets its own ships go out of sight, standing or not, and the stander counts the whole shared sea against the density | the heir sails the two ships near it on 2.6 s after their stander left (the third, 1.9 km out, sailed out of the world); a quiet stander's copies yield to the heir's when it speaks again; the far ships of two who met let go at once |
| boarding another's ship happens in two worlds (#3; #1's scuttle; #4's claims) | the boarder's copy hauled 17 m while her stander's lay at 40, then after the win the prize slid 20 m from under him; her scuttling burned on his screen alone (her stander's fires out at its next word); a claim lost or a boarding given up left her unboardable for good | the boarder takes her over at the grapple; the four board claims retired | one world: the prize 4.2 m under his feet throughout; her stander's copy follows the haul a word behind and lies within 0.5 m once alongside; she sinks and burns on both screens (settled 1.16 and 1.21 m at 4 s) |
| twins (#5) | two standers in the same waters on the same day launched The Bountiful, The Honest Scale and The Eadwyre's Vigil side by side - three of six ships twins | the stander's traffic salted with its id (`idSalt`) | no ship twice |
| a ship minted with the socket away (#8) | `local:1` took nothing from a peer's blow (378 hull kept), a ship minted after it the same blow | a blow finds her by her number (`ownByN`) | the blow lands |
| a ship named by the reader (#6, its crown) | the same cutter The Illessan Guard of Wayrest to her stander and The Daggerfall Vigilant of Daggerfall to a peer a pixel over | her names drawn in the region her word carries | one name, one captain, one crown |
| another's ship a word behind | a brig at 7 m/s eased toward a word 200-280 ms old - stepping, a word and more behind | sailed on along her course at her way since the word (PREDICT_MAX_S) | within 1.2 m of where her stander has her; a word gone quiet, she stops PREDICT_MAX_S on |
| the law by the stander (#6) | the navy judged every player by its stander's notoriety: it cruised 350 m past a peer at 80 (whose own client, a hostile ship near, could neither travel nor rest) and engaged a lawful peer when the stander was the wanted; a peer who fired on a merchantman beside a navy provoked the merchantman alone | each word says its player's notoriety (`n`) and the captains judge each by their own; the director draws the navy after the most notorious; any player's blow provokes the witnesses | the navy engages the wanted peer within 3 s and never the lawful one beside a wanted stander; the navy that saw a peer fire on a merchantman is provoked by them |
| a pirate's barrel under another's boat (#7) | a peer who sailed onto a brig's barrel heard it blow and kept a whole hull (the stander's own fell 1.00 to 0.90), and it floated on on the stander's screen | the barrel says its ship's number (`b`'s fifth field); another's boat a target on the stander's screen, for a ship's shot alone | her own barrel, dropped as her captain drops one for a pursuer close under her stern, took the peer's hull from 1.00 to 0.88 on their own client, and blew on her stander's screen too; a player's barrel still never hurts another |
| another's wreck (#10) | a pirate beside a peer's wreck sat 76 m off for 120 s and never boarded: no travel, no rest, the guns silent | each word says its boat (`p`); a pirate comes alongside another's wreck as her stander's and her grapple is said to them (`g`); they take her over and fight her boarders | boarded in 28 to 97 s from 60-130 m (three approaches); a player who does not let pirates board is spared, and the wreck left after WRECK_SPARE_S |
| a blow lost (#9) | every naval blow and claim went out bare: a refusal - the rate gate, a reconnect, a cell-seam crossing - was a blow that never happened, and a lost claim did lasting harm | through the world's hit retry queue (`sendHit`, AUDIT FOES FOE2) | a refused blow, grapple or cask's word goes a frame later, held 2 s at most |
| a volley heard late (#15) | fired on arrival: landed late by the word's cadence, up to 1.5 s when a later word first carried it, where her mark no longer lay | each volley says its age; the reader flies it from as far along, walking the flight it came late to along its arc | a volley heard 600 ms late flies in step with its shooter's: every ball where the prompt reader's is, to the millimetre |
| a sunk ship's casks (#15) | in the stander's world alone: a peer who sank her saw none | said in the stander's word, hauled by any player's boat, claimed of their owner and drawn on the answer | every player sees them; two boats reaching them at once: one haul each cask; a lost answer answered again and drawn once |
| a word after the world moved (#15) | the volleys and barrels it kept were said where they were before an origin shift - an origin's move away | they move with the world | said where they are |
| whose traffic (#15) | the stander's Ships at sea sailed everyone's sea, the bible's "each player's own" untrue | each word says its player's; the lowest of those who share the sea | a group of many and few sails at few; a player out of reach counts for nothing |
| a flood of volleys (#14) | nothing bounded how many new volleys a word could say: twelve more every word | PEER_VOLLEYS_MAX of one player's in NAVAL_VOLLEY_KEEP_MS, the rest seen and never flown | at most 24 in 1.5 s |

The frame's cost (#11-#14), the online slice's last (The frame's cost, above) - the audit's measures and the port's
own, on the same probes:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| posing the ships (#11) | 4.4 MB of garbage and 5-6 ms a frame with eight ships, 96% of it posing them (5d found the animators once and strode the far ships' rigging); eight ships in a melee 160-360 m off still 5.1 ms a frame, a fifth of it matrices made afresh | a node's matrix and rotation kept while it reads the same (`prefabNode.js`) | naval.frame 2.9 ms for the same eight |
| the collider rebuilt (#12) | three ships near: 21 buckets and 4,334 triangles re-baked a frame, ~7 ms and 380 KB (the host's frame and the sync 10.5 ms) | A MOVER'S BUCKET, carried by its object's rigid motion (`csaCarry`); synced again after the sea's frame | not a triangle baked after the first frame; the sync 0.04 ms, the frame and the sync 1.8 ms; carried against a fresh bake within 0.7 mm (the half-millimetre law let a hull's ends stand ~1 cm off) |
| a ray walks every hull (#12) | 64-478 us a missed hull (32-176 here), a boarding's sixteen foes a ray each beside four hulls 8.8 ms a frame | bounds first: the tree's colliders indexed, a chain's reach, a box before triangles, a big mesh's grid | a missed hull 1.3-5.8 us; the boarding's rays 0.32 ms; 16,000 rays against the old walk, none apart |
| the effects' draws (#13) | 234-296 draws and as many texture binds a frame at the particle budget; the oldest particle dropped first, so the smoke went first | THE EFFECTS ON ONE SHEET, the runs merged; EVICT_RANK | two draws and two binds at the budget, three with the aim's arcs; a broadside's smoke kept whole through the splashes |
| the hulls drawn (#13) | every sea hull drawn whole every frame, all round, out to 1.9 km; a war galley 136 meshes, 107 of them her oars | culled as the world's meshes are; her still parts as one mesh | eight ships round the eye: 382 mesh draws, now four (the four astern none, each one ahead one); a batch made again in under a millisecond |
| the minors (#14) | targets built for every ball; the land sounded every frame; the word built and keyed twice a tick; a word's twelve new volleys | the targets once a step (the wire's slice); the soundings every NAV_EVERY_S (the captains' slice) - the three a ship a frame left are her grounding; the word once a tick; PEER_VOLLEYS_MAX (the wire's slice) | the HUD's model (26 KB a frame) and its draw's (16-42 KB) measured and kept: young garbage, no collection in the measure |

## SEA-PEACE (2026-09-29) - the sea's guns for those aboard, a captain's temper, the Bay's own fights

The player: "People shouldnt get attacked if not on a ship, some ships should be passive, not all should be hostile.
Enemy AI and Friendly AI should engage in their own encounters naturally". Measured first on the real host over Come
Sail Away's hulls (`test/navalSea.mjs`): a player on the beach with a pirate brig 400 m off heard "Sail ho!", could
neither rest nor travel ("enemies nearby") and saw a journey stop; every pirate took every player's boat on sight; and
a fight between two ships ended with the winner sailing off and the loser lying struck for good (a navy took a pirate
to 24% in 180 s, then cruised away).

- **THE SEA'S GUNS ARE FOR THOSE ABOARD** (`navalHost.js aboardShip`: at a helm, on a boat of mine - `boatInPlay` - or on
  a sea ship's deck). The captains' contacts already asked it; now so does everything else that asked a pirate's
  hostility alone - `hostileNear` (the time scale, a rest, the five doors, the shipwright, the mending's quiet), the
  journey's `threats`, and the lookout's "Sail ho!" (hailed once the player is aboard). Ashore, on a quay or in the
  water, nobody at sea is an enemy of theirs. AUDIT NAV2: aboard is standing on a floor of hers within DECK_REACH_M,
  at any level (`deck.under`: F36 - the hull's box grown a metre read a quay 19.6 m off a moored hull's end as aboard,
  332 m2 round a Small Ship), a ship far off never asked (F60), and another player's boat I ride is aboard too, the
  contact sized as her (F4: a pirate closing on the boat a rider stood on was no threat to the rider - rest, travel and
  the time scale stayed open).
- **A CAPTAIN'S TEMPER** (`navalAI.js temperOf`, off her seed on its own salt, so every client reads the same): a
  merchantman PEACEFUL, a navy DUTIFUL (every pirate; a player by the law), a pirate BOLD - the flagship, Warm Ashes'
  raiders (the host's), a hand-launched one (the Sea battle's foe) and BOLD_SHARE of the rest - or WARY. The host's own
  bold rides her stander's word (`k`, Online below - AUDIT NAV2 F1: a peer read a raider's seed's wary, got no "Sail
  ho!" and could rest while she closed to board them). A wary pirate
  takes only a prize she OUTGUNS WARY_ODDS to one (AUDIT NAV2 F25: by the odds, below), or one crippled or holed under GRAPPLE_HULL; one she cannot size up
  (a player off every boat) she leaves be; from a threat that outguns her she RUNS. Every temper answers a blow.
- **FIGHTING POWER** (`fightingPower`) - AUDIT NAV2 F25, Mac: "Model crew losses": a MEASURE of her (her hull and its
  hurts, her men and whether they load her guns, her gunners' skill, the range she fights at, her turn), and of two
  ships the ODDS (`odds`): how many times sooner one makes the other strike than the other makes her (`strikeTime`: her
  hull to STRUCK_AT or - one that strikes when her hands are down - her last man, whichever her fire does first; a volley
  each reload, slower as her men fall, TURN_PER_VOLLEY of her turn between; each ball striking at the other's size,
  `hitShare`; nothing from a battery that cannot lay at the range the other fights at, `layMin`). The Lanchester
  product it replaces (`metalOf` x the gunners' hit share x the crew's share x the hull left) counted the hull a salvo
  takes and never the men, while every hurt kills men and, since HELM-WAY, a ship with no hands strikes: its favourite
  lost four of the eight navy-pirate matchups (a sloop beat a cutter 6 of 8, a war galley 7 of 8). Now wherever the
  odds lean WARY_ODDS or better the favourite wins six of eight, and every duel is fought to a strike (the table:
  `01-Overview/Audit-NAV2.md`). A player's boat is sized off her build, her hurts and her hands (`myPowerOf`; single-
  handed without a crew node; a player's boat never strikes by her men), a peer's off their word's (`peerPowerOf`,
  AUDIT NAV2 F2). So a wary brig leaves a Large Boat, a Small Ship and a Carrack, and takes a crewless Large Galley (1.31
  to one) but not a crewed one (1.12); she takes a galleon or a merchant carrack, never a coaster; a wary sloop takes
  any merchantman; a sloop no longer runs from a cutter (0.95).
- **THE STERN CHASE** (`engageCourse`): a quarry running from her - her way along the line of sight, away, over
  CHASE_AWAY of the pursuer's own pace - with the pursuer abaft her beam (past ABAFT_DEG off her bow) is run down dead
  astern (the intercept of the quarry herself: the chasers bear) and, within CHASE_SHEER of the pursuer's range, by a
  berth her range off the quarry's beam on the side she lies - so the broadside is presented from abeam. A side turned
  to a runner from astern gave the chase up: a pirate on a fleeing galleon fell back from 169 m to 220 and quit after
  CHASE_GIVE_UP_S; now she closes at her own margin, cuts the galleon's canvas with chain from the bow (sail 0.87 to
  0.44) and takes her. A slow quarry is presented to as ever. AUDIT NAV2 F21: a quarry in flight (`flee`) is run down
  at any pace - the CHASE_AWAY gate caught only a runner dead on the line and faster than half the pursuer's pace (a
  cutter first fired on a runner at 0.45 of her pace at 91.8 s, and 8 degrees off the line one chaser volley in 90 s);
  past her range she bends in to close by CHASE_MARGIN of her pace at least, running one down she steers for her bow
  guns' own lead (`chaserLead`), she lays the lead abeam only when it will be inside RUN_OUT_REACH once she is round and
  holds it while laying, and a chase is kept while it closes on the farthest mark of the last CHASE_GIVE_UP_S (a mark
  every CHASE_MARK_S: a chase that lost ground and closed again was given up at 151 s).
- **THE ENDS OF A FIGHT** (`stepCaptain`'s prize; the host's `lashPrize`, `stepPrizes`): a ship that struck to a captain
  of mine is her prize - listed to her alone (`struckTo`), she comes alongside on the board course and grapples across
  GRAPPLE_GAP, the two lie LASHED PRIZE_TAKE_S, then the prize is fired (she burns and founders) and the victor's crew is
  thinned by PRIZE_COST of the men the prize had left (never her last man). A struck ship has surrendered, so any men
  to send will do (GRAPPLE_CREW is for carrying a deck that fights - a player's). A victor struck by a ball CASTS OFF to
  fight; a prize I board is never hers; a prize her taker comes for, or takes, and the taker are in a fight - the
  director lets neither go. AUDIT NAV2: a merchantman takes no prize - one that makes a pirate strike sails on (F30,
  Mac: "No, they sail on"); a prize she cannot reach is given up and spared SPARE_S (F22: her berth sounded - one on
  land swapped for the open side - and one sounded waypoint round a spit, `routeTo`; a boarding that does not shorten
  its way in CHASE_GIVE_UP_S is given up - a boat lying still behind a spit had been a refuge, and a prize in a lagoon
  kept her victor for good); a ship that strikes or sinks fights no one, her target, berth and chase cleared (F23: two
  ships struck to each other lay so for ever); and the director keeps a ship in the fight while she fights afloat or an
  engaged ship targets her (F27: a fleeing quarry was let go mid-chase, her pursuer kept).
- **THE GUNS ARE HEARD** (`heardGuns`; the host keeps every volley's first report GUNFIRE_KEEP deep for HEAR_S): a navy
  with no enemy in sight sails for gunfire within HEAR_GUNS_M (mode `answer`) - never her own, never a stale report,
  never one inside half her lookout, where the table decides. A pirate raiding a merchantman draws the crown's ship.
  AUDIT NAV2 F8: the reports move with the world when its origin shifts, and a transition empties them (a navy steered
  for a phantom).
- **THE BAY'S OWN FIGHTS** (`navalDirector.js encounterSpawn`): ENCOUNTER_CHANCE of the rolls that launch with room for
  two launch a PAIR already at it - a pirate on a merchantman she outguns WARY_ODDS to one by the odds (`plunder`;
  AUDIT NAV2 F25: the corsair galley has no such prey now), or a navy on a
  pirate (`patrol`), ENCOUNTERS' weights - the quarry ENCOUNTER_GAP ahead of her hunter on the hunter's course, crossing
  the player's waters as any ship does. Drawn on the spawn's own ENCOUNTER_SALT stream, so a roll that launches one ship
  draws what it always drew.
- **THE NEWS** of a fight between ships (her colours struck, going down, a grapple, a prize fired) reaches my HUD only
  within NEWS_RANGE of it, or when it is mine; the bell and the sinking are heard where they happen.

Measured after, over 30 minutes of the director's own traffic at level 8 (`some`): a player idle at a Small Ship's
helm met a peaceful coaster, a wary sloop that ran down a coaster, took and fired her on her own, and one bold corsair
galley that came for them; on foot beside the same waters nobody engaged or hailed, and no rest or journey was held.

## DECK-FIELD (2026-09-29) - the deck's own sounds, no hunt at sea, and HOLD FIRE

Mac, from one sailing session: "Walking on the deck gives water sounds, hunting notifications appear when sailing,
shooting cannons should have attack canceling." Each one root-caused (`test/deckfield.test.js`):

- **SHIP-DECK** (DECLARED): Immersive Footsteps read the terrain tile under the feet and nothing else - its own noted
  IsOnShip bug - so a deck over the sea (tile 0) stepped in deep water all voyage. The host's down probe now keeps the
  collider bucket it struck, and a hull's bucket (`csaBoat:`) is a deck: the mod's own wooden-floor rule. AUDIT NAV2
  F38: and a quay or a bridge over a shallow-water tile is a floor too (the model-over-water rule took tile 0 alone). The helm's
  footsteps-off reaches the mod's stride too (`bible/06-Systems/Immersive-Footsteps.md` SHIP-DECK).
- **SEA-HUNT** (DECLARED): the hunt asked outdoors-and-not-swimming, and the coast's first sea pixels read as land's
  climate, so a helm rolled the hunt. `huntRoll` takes `afloat` - off the host's one predicate, `playerAfloat` (a helm,
  a boat's deck, another's boat, a sea ship's deck, the water) - which a bounty's trail and a wilderness band now read
  too (`bible/06-Systems/Climates-Calories.md` SEA-HUNT).
- **GUN-HOLD**: a laid broadside could only be fired - press to lay, release to fire, and no way to put it down but a
  window over it or bracing. ACTIVATE WHILE THE GUNS ARE LAID HOLDS FIRE (`navalHost.js holdFire`): the aim put down,
  "Hold fire." said, the release owes nothing and the guns stay loaded - the bow's own cancel (`playerWeapon.js`
  cancelHeld: Activate un-draws a drawn bow). The world hands Activate to the hold first - before the click casts a
  readied spell or the helm's ladder boards, heaves to or opens the yard - and the readout says it while they are laid
  ("Let go to fire - E: hold fire"; a finger's "Tap: hold fire"; the pad's Activate row "Hold fire"), over any ship in
  reach. AUDIT NAV2 F31: E itself - the Interact key the readout names - holds fire (the frame's gate reads `useEdge`
  first); it went to the activation ladder, whose naval arm grappled a struck ship in reach with the guns still laid,
  and the ladder's board refuses while they are laid (`navalHost.js activate`). The attack's own order stays the cast law's: a readied spell takes the press before the guns (NAV-H's pin,
  `tools/mutants/nav_h.json` NAV-H-the-guns-before-the-spell) - readying one is the player's own choice of what the
  press does.

Mutants: `tools/mutants/deckfield.json` (19), all dead; three records re-aimed onto the new text (OW5-B1, NAV-F's board
hint, SURV6's night gate), all dead.

## HELM-WAY (2026-09-29) - the ships handle, and a ship with no hands strikes

Mac: "Improve the overall mobility and maneuverability of ships." The player's own boat is Come Sail Away's runtime
(`bible/03-World/Come-Sail-Away.md` HELM-WAY: the responsive helm - way on in 7 s not 24, off in 8 not 24, a rudder that
answers at rest and bites hardest at half sail, the Carrack that could not move); the captains sail at the player's own
helm (`systems/helmWay.js`, one law):

- **They turn by the same steerage** (`navalAI.js maxTurnRate`/`turnRateAt`): her hull's helm (HULL_HELM, the prefab's
  rudder x sail-turn modifiers) times `steerage(her way)`, capped by her class's handiness, never under TURN_FLOOR - a
  brig turned on a 70.6 m least circle at every way (3.7 deg/s at half her way), and now at 9 there. The lookout's room
  is the circle she sails at her class's own way (`turnRadius`), whatever way she has on - a ship lying still is about
  to gather it.
- **Their way comes and goes at the player's rates**: ACCEL 1 m/s^2 (0.35 was 22 s to a brig's way), DECEL 0.6 (the
  coast) - AUDIT NAV2 F28: each hull's as the player's own hull of her kind (`HULL_BUILDS.sailWay`, the Large Galley's
  half: the captains' Carrack gained way at half the player's, and the galley lost it at twice); a galley rows round at OARS_TURN 6, and a ship's sweeps turn her at SWEEP_TURN 10 - the player's own Small
  Ship's oars.
- **A SHIP WITH NO HANDS STRIKES** (`navalDamage.js`, `unmanned`): a crewed AI hull whose every man is down strikes her
  colours - nobody lays her guns or trims her sails - and her fires burn on (nobody fights them; a hull strike still
  douses: her crew fights them then). Found by the handling: a pirate sloop with no men aboard went on loading and
  firing (her crew's reload was only RELOAD_UNDERMANNED slower "at none") and gunned a navy cutter's twenty-six down to
  none, so the cutter had no man to take her. Timber without hands keeps her struck; hands back, she fights. A
  player's boat never strikes - the player works her guns.
- The heave-to brakes at its own HEAVE_TO_DECEL (m/s^2, Come Sail Away's `brake`), never a multiple of a rate the Ship
  handling moves.

Pins: `test/helmway.test.js` (8); the captains' turn (M5), the lookout, the land, the broadside onto the land, the
sweeps' pace, the raider's day sight, the chasers' stern chase, the fire's long guns and the navy's hearing re-aimed
with their laws intact (each fixture's reason in its own line). Mutants: `tools/mutants/helmway.json` (19), all dead;
eight records re-aimed onto the new text (the coast, the rudder's two, the radius, the brake's four), all dead.

## DECK-WALK and SHIPMATES (2026-09-29) - the bodies on a deck stay on it, and the player's crew is spared

Mac: "Boarding scenarios should be seamless, with crew naturally getting into position and fighting enemies. There's an
issue where enemies/allys can navigate on the railing of ships." and "Ally crew member's should have green health bars
above their head, and not be able to engage in friendly fire."

**Why they walked the rail.** A hull's collider is its whole visual mesh, and a Come Sail Away bulwark is a ramp: the
Small Ship's rises 43-49 degrees from her 6.77 m deck to a rail top at 7.7, the Carrack's 50-56 from her deck - every
face under the capsule's SLOPE_LIMIT_DEG 70 (motor.js), so the collider let a body up it, and the enemy motor's own
obstacle probe read it as climbable. Nothing told a body where the deck was: the boarding's spots were blind rays over
the hull's box (one of the Small Ship's sixteen stood on her outer bow at 5.21 m, others on her lower deck and in the
Carrack's hold).

- **THE DECK** (`systems/naval/navalDeck.js buildDeck`, baked once a hull by `comeSailAwayPool.js deckOf` while the
  world loads - every rig of a hull shares her deck; AUDIT NAV2 F57: keyed by rig too, a Large Boat's rig first seen
  was baked mid-voyage, 7-15 ms, and the rigs' colliders are proven equal): her colliders' triangles in her mesh node's frame on a DECK_CELL grid - the floors (within
  DECK_FLAT of level) with DECK_HEADROOM clear above and no wall through the cell rising more than a tread off them (a
  wall's footprint marks every cell its edges cross: a 0.4 m mast between two cells' centres, a gun's side, a cabin's),
  joined to her main level cell to cell within DECK_STEP, a cell in from every edge, and of that her open deck alone -
  the largest piece a walk joins. Measured: the Small Ship's 651 cells at 6.77 m (her poop cabin aft of 12.8 m walled
  off), the Large Galley's 4013 at 10.25, the Carrack's 515 at 3.64 (her rooms under the half deck walled off); every
  cell a floor her colliders stand under a head's height clear. AUDIT NAV2: EVERY FLOOR AT HER MAIN DECK OR OVER IT
  (F34: one level a cell cut the Small Ship's forecastle stair at 8.55, and the leash dragged a body on her forecastle
  2.5 m down - a player there was out of every boarder's reach): her floors join cell to cell within DECK_JOIN, the
  motors' step; her open deck is the grid's `y`, a cell's highest floor, and her poop, her cabins and the room under
  her forecastle are pieces beside it (`more`; `heightAt`, `pieceAt` and `clamp` answer per piece) - the Small Ship's
  690 (her forecastle and its stair joined; her poop cabin 259, her poop 247 and under her forecastle 19 as pieces),
  the Galley's 4013, the Carrack's 515 with 1586 floors in 31 pieces. NEVER INSET AGAINST A BENCH (F32: the Large
  Boat's thwarts ate 18 of her waist's 30 cells - her deck 12 cells to 18 now, the Rowboat's 4 to 13), and no inset
  that would cost half her deck. Under her main deck nothing is deck; every floor of hers at any level is what
  standing aboard her is (`under`, SEA-PEACE above).
- **Her frame is her mesh node's** (`intoDeck`, `outOfDeck`): the swell rolls and pitches `Boat.MeshObject`, never her
  root, so a body on a rolled deck is read where it stands (the root's frame read it as off her deck).
- **THE LEASH** (`scenes/world.js navalLeash`, after the foes move): a deck body whose step carried it off her cells (up
  the bulwark, over the side, off her end) is put on the deck's edge nearest it (`clamp` - sliding along it as it
  presses, never snapped to a cell's centre), and one off her height by more than a tread (climbed, fallen through) is
  set back on it. **THE CARRY** (`navalCarry`, before the foes move): every deck body where the leash last left it,
  taken through her pose now - a ship under way no longer sails out from under her boarders (the player's own body
  rides a deck the motor's way; a foe had nothing to).
- **The musters stand on the deck**: `navalDeckSpots` spreads a muster across her open deck (`spots`, farthest-point
  from her middle - AUDIT NAV2 F58: made once a count and kept, the Large Galley's spots(24) 1.3 ms and 3.7 MB each
  time), each set on her live colliders by a ray from under her headroom (F33: from 3 m up it stood 26 of the
  Carrack's cells on top of her bow structure; a classic model's colliders on her deck are her deck's walls too, F39); a boarding's captain and men, a repel's party and a raid's waves
  are one crew (`navalBoarding.js crewTeamOf` - a pirate's the Criminals', a merchantman's and a navy's the Knights and
  Mages': a pirate's Spellsword captain fought her own barbarians with infighting on) on the deck they stand on
  (`deckBoat`), the player's hands too. A walk across her deck is `path` (A* cell to cell within a tread, no corner
  cut past a blocked cell, the legs straightened only over cells a grid walk finds on deck) - the living crew's to use.
- **SHIPMATES** (`combat/friendlyFire.js`): an ally of the player's on a deck - or a room's crew its owner names - is
  passed by every door of the player's harm: the swing (`exteriorFoes.js resolvePlayerHit` - the one pool a shipmate
  stands in never offers him, even alone in reach, where the vanilla arm strikes a lone protected ally), the shaft (`arrowFlight.js`), the spell, its area and its blast (`hostMagic.js`), the
  thrown torch and a mount's charge (`world.js`); a crewman's own blast passes the player and the rest of the crew, his
  missile flies past the player. AUDIT NAV2: A SHIPMATE IS NO MARK (F54: a failed pickpocket on a hand turned him on
  the player while every blow of theirs passed through him - struck 4 times for 22 hp, 20 swings back landing none):
  the steal refuses a shipmate, and a town's defender, and any other ally a failed attempt makes fair game (the ally
  revert runs); THE DRAIN IS NO ATTACK (F55: a worn Vampiric Effect at range drained a shipmate beside the player and
  turned him, and un-surrendered a prize's yielded men): the drain passes the spared and hurts as DFU's writes
  health, and a player's blow is refused a shipmate at the pool's own door (`exteriorFoes.js damageFoe`); a crewman's
  area spell knows whose it is (F56: its caster named no foe, so it struck the player and his mates). Still so: a
  crewman's missile flies past the player but meets no pirate - an enemy's missile meets the player alone (no crewman
  casts today). A town's defender keeps his own laws (the shaft and spell spare him, the swing by the
  setting - DISC19 W5).
- **The crew's bars** (`ui/navalHud.js drawCrewBars`, `world.js navalCrewBars`): a green bar a shipmate - the party's
  one green (PARTY_GREEN_CSS) - over his head within CREW_BAR_RANGE, whole to CREW_FADE_FROM, behind the land by a sight
  cache of the crew's own, under the covers the ships' tags keep; every clear hides them.
- **Online**: the owner's foes frame names its crew (`cw`, `exteriorFoes.js`), and a reader stands each as its own ally
  and shipmate (`crewPuppet`), spared its harm and wearing its bar - RAID2's `al` law for a watchman. AUDIT NAV2 F12
  (Mac: "Share it now"): a boarding's bodies ride that frame now - they were PLACED foes, which never ride it, so this
  was true of no body on a deck: her men stand in the room as foes and my hands as the reader's shipmates, never saved
  (`transient`, F13: a won prize's men stood over open water on a load).

Pins: `test/deckwalk.test.js` (17): the deck on a little ship made of her faces (the ramp, the rail, a crate, a boom's
shadow, a thin mast, a walled cabin, the stairs to a forecastle), the clamp and the ring search against every cell, the
spots and the walk, the corner and the ledge, her frame, the real hulls (every cell under a ray from a head's height, the
Large Boat's node 0.1 m up her root, the Carrack's rail), the leash and the carry lifted from the world host, the five
doors of the player's harm, the crew's bars, a room's crew, and the musters' crews on their decks. Re-aimed with their
laws intact: the spawn's stand-down (navaudit_boarding), the world's sync (navaudit_frame: one box's faces now
`prefabColliders.js boxColliderTriangles`), the tags' clear (navaudit_presentation), the torch's defenders (auditdisc19).
Mutants: `tools/mutants/deckwalk.json` (60), all dead; twelve records re-aimed onto the new text (DISC19's shaft, spell
and torch, B9 and B10, the tags' scale, cover, fade and clear, RAID2's ally two), all dead.

## LIVING CREW (2026-09-29) - the crew at their work, and a boarding that starts where they stand

Mac: "Crew members shouldnt be the static sprites and instead the enemy type sprites with multiple animations, they
should navigate the deck, talk with each other, blurb, sing chantys, etc" and "Boarding scenarios should be seamless,
with crew naturally getting into position and fighting enemies".

- **WHO STANDS** (`systems/naval/crewLife.js crewRoster`): a sea ship's crew is her muster (`musterOf`, by what her crew
  has left) - her captain then her men, the first CREW_SHOWN of them (a Small Ship 6, a Galley or a Carrack 8), fewer as
  the guns thin her (`trim`, the last first); a player's crewed boat is the hands' mix (PLAYER_CREW, a Bard among them to
  lead the song), a man for every CREW_PER_HAND of her crew. Each seeded by the ship (her `seed`, a boat's uid, a room's
  boat by whose and which), so every player sees her same crew; `crewCount` is their number without making them.
  AUDIT NAV2: her Bard is among any crew of two or more, second in line (F51: four starts of PLAYER_CREW's eight had
  none among the first few); a player's boat is seeded by whose and which on both sides - her owner as the room does,
  her place among his word's boats, her deed's uid offline - and a reader counts her crew and her fight off her
  owner's word (`naval.peerBoat`, the word's `m`; F9: the owner seeded by the uid and the room by the key, two crews for
  one boat); a mending brings a crew back to her count (`restore`), never the men a fight took, who come home with its
  end, and a boat with every hand down stands nobody (F42: a crew only ever thinned, and her first man never went).
- **WHERE** (`createCrewLife`): the mod's own people flats are where a hull's crew stood - one on her deck starts a
  walker there, one off it (her helmsman's pair on the poop) is a STATION who keeps his post; the rest spread across her
  deck (DECK-WALK's `spots`). AUDIT NAV2 F35: a man taken into a fight is answered with his feet on her deck (her
  captain at the Small Ship's wheel was answered at his post on the poop, and the leash snapped him 7 m onto her main
  deck).
- **THEIR WORK**: a walker walks her deck by its own `path` (never off it), stands, turns; one crosses to another and they
  talk (CREW_TALKS - each his line in turn, facing each other); a man's own word now and then (CREW_BLURBS - her trade's
  among them); every CHANTY_S the chanty (CHANTIES, the port's own words: the leader - her Bard - the verse, the whole
  crew the chorus). Her guns out (`battle`: she engages, boards, runs, answers; my boat with the aim laid or a hostile
  near): no song, the battle's words, a run from post to post. A grapple thrown (`muster`): every man to the rail facing
  the other ship, evenly fore and aft (`deck.rail` - the outermost deck cell of the row, never the clamp from far abeam,
  which lands every man on her widest cell), facing out, shouting. The player on her deck is never walked through (a
  walker waits, then goes elsewhere after CREW_BLOCKED_S). AUDIT NAV2: THE MUSTER IS CALLED AT BOARDING RANGE (F40: the
  grapple's 2.2 s alone saw nobody but the stations ready - at a repel's start 0 of 2 of my walkers, at my boarding 1
  of her 4) - a ship closing to board her, a struck ship in my reach (my helm within BOARD_RANGE past both beams, my
  feet within FOOT_BOARD_M) or the grapple, within CREW_MUSTER_M of her: her walkers to the rail on the side the other
  will lie once alongside, dealt fore to aft by where they stand (by roster index they ran 190.9 m a muster on the
  galley), her stations ready at their posts; along her main deck's rail, never past her centreline (F62, found at the
  merge: F34's raised decks put the Small Ship's foremost man on her forecastle's top row, 0.68 m to port in a
  starboard muster). A walk to a talk or to the muster gives up after CREW_BLOCKED_S too, and a walk starts along the
  deck's own line from where he stands (F48: 23-29 s held by the player; a walk crossed a hole); walkers let a shipmate
  earlier in the roster by, and no two stand on one spot (F41: two men stood merged in one sprite up to 110.8 s, and a
  talk begun on one point talked in place). The guns end every talk at once, and a struck or sinking crew is quiet: no
  song, no talk, a few surrender lines (F46: 5 to 13 talk lines under the guns a run, and 2856 frames of chanty and
  "Gold, lads" after she struck). A song dropped waits CHANTY_S for the next, and her leader takes no talk while he
  sings (F47: the next began 0.03 s later).
- **THE HOST** (`scenes/navalCrew.js`): within CREW_RANGE of the eye (kept to CREW_KEEP) her crew stands as DFU's own
  mobile units (the classes' sprites, idle and walking, turned to the eye - `MobileUnit`), carried by her mesh node, and
  the mod's people flats on and above her deck stand down in their places (their renderer off - the pool's flats pass
  skips them; a galley's rowers below never touched); past it they stand again. The lines over their heads go to the
  naval HUD (`ui/navalHud.js drawCrewLines`: the CREW_SAY_MAX nearest, a song's in brass, a shout's in red, fading to
  CREW_SAY_RANGE, behind the land by the crew's own sight cache). CREW-SAY (FIELD BUGS 2026-10-02, Mac: "your crew
  mates speaking sometimes seems like gibberish"): laid by `layoutCrewLines` - a line two or more say at once once,
  over the nearest and by no name; a line said alone by its speaker's first name; each foot clear of a mate's bar and
  name; each farther bubble lifted over every nearer one it would cover, the nearest drawn over the rest. They had
  stood over each other in 56% of the frames with two lines up, the chorus up to six deep. Its audit (FIELD BUGS
  2026-10-02b): only a line SUNG or SHOUTED by many is laid once - two hands' talk is each his own, by his name; a stack
  stands in the order its lines were first said (`crewSayMemory`), so the eye's drift never turns it over (bubbles
  swapped places, up to 247 px in a frame), and a bubble comes down to its place at CREW_SAY_EASE px a second, held
  where it stands while its way down is barred, up at once - never over another; a lifted bubble that would stand over
  the screen's top is not drawn. AUDIT NAV2: a re-keyed ship keeps her crew and a hold
  let go stands her again whole (F6: a room's hand-over stood a second crew beside the flats the first switched back
  on, down for good once she left); a ship going down keeps her living crew to the end, her flats down (F45: dropped
  at the sinking, the mod's static flats in their place); with the arc off no living crew stands - Come Sail Away as
  the mod stands (F52); under a window the crews hold with the sea (F53: they walked and sang on while the ships stood
  still); a concealed owner's crew wears his look (F50). A deck's main level is sorted once and a hull's flats walked
  once a rig (F58: at every crew's first sight), and a crewman's frame makes nothing new but his unit's own answer (F59:
  about 550 bytes a crewman a frame - a `{moving}`, two key strings, a `{w,h}`).
- **SEAMLESS BOARDING** (`scenes/navalHost.js beginFight`, the world's doors `crewOf`, `landing`, `railSpots`): I land on
  her deck across from where I stood (her point nearest me), never her middle; her muster fights where her crew stands -
  each man his class, his sex and his place, the rest up from below at her spots; my hands are my own crew, off my deck
  and landed at her rail across from my ship. A repel: her party is her own men - never her captain - over my rail
  across from her; my hands stand to where they stand. A raid's waves come over my rail first. Her crew held (`hold`: a
  prize, her men the fight's, or another's boarding in a room - the wire's `boarded`) stands nobody, her flats down; the
  fight's end brings my hands home (my boats' crews stood again whole). AUDIT NAV2 F43: and my own crew is held off my
  deck while Warm Ashes' raid is fought there - its `_ally_` are them (NAV-D above).

Found on the way and fixed: a room's boats carried no owner or uid, so every one would have seeded the same crew - each
is stamped with whose and which at its build (`comeSailAwayPeers.js peerKey`); the rail point clamped from far abeam was
her widest cell whatever `z` was asked (the new `deck.rail`).

Pins: `test/livingcrew.test.js` (13); AUDIT NAV2's `test/auditnav2_crew.test.js` (26, `tools/mutants/auditnav2_crew.json`
64, all dead - `01-Overview/Audit-NAV2.md`). Mutants: `tools/mutants/livingcrew.json` (54), all dead; twelve records re-aimed
onto the new text (the spawn's crew and deck, the muster's, the hands', the repel's, the tags' and bars' clears, B2's
hands, B9's captain, B10's stack), all dead.

## SHIP-LIFE (2026-09-30) - ships that berth, depart, voyage and keep their own errands

Mac's item 1 of the six-part sea ask, slice E (`01-Overview/Handoff-Naval-Crew-and-Ship-Life.md`): "ships that berth at
ports, depart, voyage and keep their own errands". Before it the sea stood ships on a ring round the player and let each
cruise to random waypoints; a port had no ships at all. `systems/naval/shipLife.js`, pure, and the host's harbours:

- **THE HARBOUR OFF THE TERRAIN** (`findHarbour`). No dock data exists - a port town is a flag in its exterior data -
  so the world hands the host the port town within a pixel of the player and its footprint in the scene
  (`world.js navalHarbourNear`: `locationWorldRect` through the floating origin's `localFromWorld`), and the host finds
  its harbour once: the town's rect grown HARBOUR_REACH walked on a SHORE_STEP grid for water beside land; each shore
  point stood off the land along the shore's normal by her half width and BERTH_MARGIN is a BERTH lying parallel to the
  shore - kept only where her whole footprint (sized for BERTH_HULL, the Carrack) floats, and BERTH_SPACING of her
  length from every other, the nearest the town first, HARBOUR_BERTHS at most. Each berth has its APPROACH, open water
  APPROACH_LENGTHS astern of it and APPROACH_OUT off the shore. The MOUTH is the first point out along the berths' mean
  normal with MOUTH_CLEAR of open water all round. A town with no shore, or a harbour with no way out, has none.
- **A WAY THROUGH THE WATER** (`createWaterGrid`): WATER_CELL cells, open where her hull floats at the centre and at
  eight points WATER_CLEAR of a cell round it, met lazily; a bounded A* (PATH_NODES expansions at most - a query's
  cost is fixed, and a way not found in them is none), eight neighbours with no corner cut; the corners straightened
  wherever the line keeps LEG_MARGIN of water either side (the captains' lookout swings off land nearer than that) save
  within LEG_END_M of its own ends, where a berth lies by the shore.
- **THE ERRANDS** (`errandFor`, `stepErrand`), drawn off her seed on ERRAND_SALT and where she is - so any client that
  takes her over draws the same one again and nothing new rides the word: MOORED at her berth for a DWELL_S draw, her
  way off and her sails stowed (eased onto the berth over MOOR_EASE_S); DEPART, berth to mouth; VOYAGE, to another
  known harbour within VOYAGE_REACH, or out of the world VOYAGE_DIST on a bearing with OUTBOUND_OPEN of open water ahead;
  ARRIVE, through the mouth to her berth's approach and along the shore into it, her sail shortened from ARRIVE_EASE_M
  to ARRIVE_SAILS - the last leg into a sounded berth free of the lookout's land swing - moored within BERTH_SNAP_M
  under BERTH_WAY; PATROL, a navy's PATROL_POINTS round the mouth at PATROL_R for PATROL_S, then a voyage; LURK, a
  pirate on a ring LURK_R off the mouth where merchantmen pass. Into or out of a harbour with the wind in her teeth she
  is warped on her sweeps (SWEEP_WAY), as a boarding's pirate is pulled alongside - a coaster beat forty minutes in the
  lee of a headland and never came in. A ship that makes no way under sail for STALL_S (a hulk across her way) takes a
  DETOUR_M detour abeam where the water is open - the other side if that one holds her too - and plans anew past it.
- **A FIGHT COMES FIRST** (navalAI.js stepCaptain): the errand is the cruise branch's - an enemy, a threat, a prize or
  the guns heard decide first, so a navy at her berth answers a pirate and a merchantman flees one; after the fight
  her way is planned anew from where it left her, and a ship off her berth sails back to it.
- **THE HARBOUR ROLL** (navalHost.js `harbourFrame`): while a harbour's mouth is within HARBOUR_STAND of the player -
  ashore too - the stander stands HARBOUR_ROLL of its berths with ships moored, HARBOUR_NAVY of them the crown's (no
  galley: she rows in and out), each seeded by the port, the day and her berth (HARBOUR_SALT - never the stander's id),
  so every player in that port sees the same ships at the same berths and a new stander stands no twin. They are the
  harbour's own count: the sea's density never counts a moored ship (navalDirector.js `berthed`). Past HARBOUR_LEAVE
  they go, to be stood again the same on the player's return - save the ones that sailed that day.
- **THE SEA NEAR A PORT GOES SOMEWHERE**: the director's ships launched while a harbour is known are given errands by
  their trade (a merchantman arrives at a free berth, a navy patrols, a pirate lurks); a hunter and a pair already at
  it keep their fight; with no harbour known the traffic keeps its cruise, as before.
- **The world moves**: `offsetAll` moves the harbours, every errand's way, goal and detour, and makes the grids again;
  a transition forgets the harbours, found again where the world is next. **Online**: a ship taken over (`adopt`)
  draws her errand again where she lies.

Not built: fishing boats (no fishing class exists), a harbour's own lights and quays, ~~ships at anchor off a harbour
with no berth, and a voyage's port-to-port route beyond the loaded terrain~~ (SEA-LANES, below: the Bay's packets sail
the map's water between its ports, and lie off a port whose harbour no one has sounded).
Pins: `test/shiplife.test.js` (11). Mutants: `tools/mutants/shiplife.json` (32).

## KEEP-PLUNDER and KEEP-BOATS (2026-09-30) - nothing of the player's goes with the sea

Mac: ship ownership *"less punishing"*, and of the choices put to him, *"Keep boats & cargo"*. The sea is never a
save's, and a transition, a jump or a fast travel empties it (`scenes/navalHost.js clear`). Two things the player had
won went with it: a prize's hold not yet emptied, and the casks of the ships the player sank.
- **The crew stows them first** (`stowPlunder`). A prize's hold goes into the boat that took her through the prize
  window's own `takeInto`; if her captor no longer stands in the world it goes to the helm's boat, else into the pack
  as far as the pack carries. A cask goes into the helm's boat, or the player's boat nearest it, its lot drawn as a
  cask hauled in by hand is. The tally is said once ("Your crew stows the plunder left at sea (N things).").
- **Only what was the player's.** A scuttled prize keeps her hold, since she goes down and her casks float. A cask of
  a ship another player or the sea's own fight sank is not the player's: the host keeps the ids of the casks floated
  by the ships the player sank (`myCasks`, `onSinking`).
- **Where it runs** (`scenes/world.js navalStow`): ahead of Come Sail Away's own transition in every one of the four
  transition hooks, while the boats still stand; before a jump's `csaOnTeleport`; and before a fast travel's
  `OnPreFastTravel`, so the stowed hold is packed with her. It never runs on a load, where the loaded save's hold is the
  one that stands.
- **A boat left in a dungeon is kept** (`systems/modSettings.js`, DECLARED). The mod's
  `Compatibility.PersistentDungeonBoats` ships off: a boat placed indoors or underground was destroyed once the player
  was back outside, a packable one and its hold for good, and a crewed one's hold with it. The port ships the key ON; it
  stays the player's switch. `test/csa_registration.test.js` names it among the DEPARTED defaults.

AUDIT PR478 (`01-Overview/Audit-PR478.md`): off the helm the stow goes into the player's boat nearest them before the
pack, and what will not fit is said (D1); naval combat switched off stows before it takes the sea (D3); a boat kept in a
dungeon stands in that dungeon alone, never a building on its pixel (D2). SHIP-LIFE's own findings (A1-A5, B1-B7) are
recorded there too.

Pins: `test/keepplunder.test.js` (the real host's prize and sinkings, the world's wiring, the default).
`tools/mutants/keepplunder.json`: 12 mutants, all dead.

## SHIP-CREW and SEA-REPAIR (2026-09-30) - named crew with spirits, deck orders, and repairs on the high seas - DECLARED

Mac: *"Let's do #1 and a way to repair ships on the high seas"* - named crew with morale and deck orders, the
immersion list's first; and of the choices put to him, morale *"Gentle"* (no wages, no desertion) and the repairs by
*"Carpenter's stores"*. Daggerfall has no ships and Come Sail Away's crew is a count; all of this is the port's own.

- **Named hands** (`systems/naval/shipCrew.js` `createShipCrew`, one per boat of the player's). The hands a crewed boat
  stands on her deck (`crewLife.js playerCrewCount`) each have a name - DFU's `NameHelper.FullName` over the waters' bank
  (as `navalShips.js` names a captain), off the boat's crew seed (the one her living crew stands on) and the hire's
  number - and a role: her First Mate, her Bard (the roster's Bard), then Bosun, Gunner, Carpenter, Lookout, Cook,
  Deckhand. Each counts the fights won and the boardings stood with her. A hand the guns take FALLS by name ("Aldric
  Wayrest, Gunner, has fallen.") - the last to join first - and a hire signs on with a new name. A hand of hers speaks
  by his first name over his head (`world.js navalCrewLines`); the sea's crews and another player's by none.
- **Spirits, gently.** MORALE 0-100 (`MORALE_START` 60). Up: a ship struck to her, a prize taken, a hold filled, a
  round of grog at the shipwright. Down: a hand lost (a fight's losses at most `LOSSES_CAP`), a wreck. The sea wears a
  point every `SEA_DECAY_S` away from port; a port lifts one every `PORT_RISE_S` to `PORT_CAP`. They nudge: the reload
  (`reloadScaleOf`, `MORALE_RELOAD` either way - the gun deck's `reloadScale`), her hands' mending (`mendScaleOf`), a
  boarding's hands (`handsBonusOf` - one more at `HIGH_SPIRITS`, one fewer at `LOW_SPIRITS`), their lines (high, low)
  and their song (none under `SING_MIN`). No wages, no desertion.
- **Deck orders** (`CREW_ORDERS`): *Man the guns* (a quicker reload, `GUNS_RELOAD`; her crew at the guns as in a fight),
  *All hands to the rail* (a boarding's hand more; the crew musters at the rail), *Make repairs* (below), *Stand down*.
  Her First Mate answers by name. Given from the Plus helm panel's Orders button (`enhancedHelm.js`, a `hook`) or the
  boat's menu (`csaBoatMenu.js` Crew and Give orders, with the naval arc on); a boat with no crew has the repairs and
  standing down alone. The crew's card (Crew) lists her spirits, her order and each hand with his deeds. DECLARED: no
  keybinding - the port's key registry pins its actions' order and defaults, and the panel and the menu give the orders.
- **Repairs at sea** (`navalYard.js seaRepair`, the host's `repairStep`). CARPENTER'S STORES (`navalStores.js`, template
  1330, 10 kg, stacking) are bought at the shipwright's and sit in her hold as Come Sail Away's cargo. AUDIT CREW CC-D1
  (Mac: *"Priced per hull, no port use"*): a store makes good `STORE_POINTS` of WORK - a hull point a point, canvas at
  its yard price's share of the hull's (`SAIL_WORK`) - and costs `STORE_YARD_SHARE` (70%) of what the yard asks for that
  work (`storePrice`); the yard stocks her hold to what her wreck takes to be whole (`storesToWhole`, at least
  `STORES_STOCK`), so a bigger ship carries more of them. *Make repairs*, out of port and while nothing threatens her
  (the free mending's own quiet), sets her hands to work: `SEA_REPAIR_PER_S` of the whole a second by her crew's share
  (`SEA_REPAIR_ALONE` with none aboard - and with every hand lost, her captain at it alone) and spirits, her hull first
  then her canvas, **all the way to whole**, a store spent for every `STORE_POINTS` made good (the part-spent store's
  `credit` kept in the save; QUICK-REPAIRS, 2026-10-03, below: and with a hostile ship near, DAMAGE CONTROL at a share
  of the pace). In port the order is refused in her First Mate's words - the shipwright is there. A wreck
  floats again past `FIELD_REFLOAT`. Whole, or her stores spent, the order stands down with a word; the plate says
  REPAIRING, and a wreck's hint says when the order stands in the quiet before the work.
- **The yard** sells PROVISIONS apart from her needs (never part of making her whole): the stores, and a round of grog
  (`grogPrice`, a gold a hand, at least `GROG_MIN`) for a crewed boat whose spirits are short of the top - one round a
  port day (AUDIT CREW CC-D5, Mac: *"Once per port day"*). A prize's hold cheers her crew once, however it is emptied.
- **The save**: her crew (`mates` - the damage's own `crew` is her count; with it her standing order and the grog's
  day) and her store's credit beside her hurts, by her deed's UID; an older save's boat musters a new crew. A fight's
  losses count as one while each comes within `LOSSES_WINDOW_S` of the last. Her deck stands each hand as he was named
  (his class and sex off `mates`, not the session's crew seed).

Pins: `test/shipcrew.test.js` (the laws, the living crew's answer on her real deck, the real host's repairs, falls,
spirits, orders, yard and save). `tools/mutants/shipcrew.json`: 40 mutants, all dead.

## CREW-COMPANIONS (2026-09-30) - the crew ashore, following and fighting through every door - DECLARED

Mac: *"Just to add to this. I think this is a good opportunity to introduce the ability to take them along as
companions in the world that travel with you and can fight by your side"* - and of the choices put to him, *"Up to 2"*,
*"Knocked out"* (never killed), and through every door: *"#2, maybe this is a time for a refactor?"*. Daggerfall has no
followers and Come Sail Away's crew never leaves the boat; all of this is the port's own.

- **The party** (`systems/naval/crewCompanions.js`, pure; the host keeps one, saved as the naval save's `party`). Up to
  `COMPANION_MAX` of the player's named hands ashore at once, each by his boat's deed UID and his name (a name is his
  for life - `shipCrew.js handName`). Taken and sent back from the boat's menu (**Companions** - a crewed boat of mine,
  the naval arc on: `companionRows`, the host's `companionPress`). A hand ashore is off her deck (`crewLife.js away`:
  no walk, no talk, no song, no muster, never mended back or sent to a boarding) and home again stands on it.
- **Knocked out, never killed.** Both pools' death arms (`exteriorFoes.js`, `dungeonContext.js damageFoe`) hold a
  companion at 1 and mark him `_knockedOut` before every other arm - the soul trap, the kill notice, the corpse, the
  loot. The layer carries him back aboard: he rests `REST_MIN` (8 hours of the world's clock) before he will come
  ashore again, and his crew's spirits take `MORALE_EVENT.knocked` (her saved crew's, when a load has not yet stood
  her). A hand fallen from her roster leaves the party (`prune`, once a second). While the player sails, every hand is
  aboard - the party lifted, walking her deck with the rest (Mac: *"Back on deck while sailing"*), and ashore again
  behind the player at the first step off.
- **THE REFACTOR: one layer over the places' own pools** (`scenes/crewAshore.js`). The street and a building share one
  pool factory (`exteriorFoes.js`, minted per building), a dungeon has its own (`dungeonContext.js`); each hands the
  layer an ADAPTER (`world.js companionPlace`: its key - the pool itself - how a companion stands there, how he goes,
  and where behind the player a body may stand, the place's collider swept from the player's feet). Each frame, in
  every mode, the layer reads the place's key: a new key (a door, a dungeon, the helm) lifts every body out of the old
  place - his health already in the party, as a SHARE of his whole (each place rolls his pool afresh) - and stands the
  party behind the player in the new one. No door hook; a body a place swept itself - culled, removed, or (AUDIT CREW
  CC-A1) cleared out of its list with nobody marked, as the street's `clearLive` does on a fast travel, a Recall, a
  passage or a respawn - is missing from the place's `has` and stands again the same way. A stand that lands after its
  place was left is taken back, and a quickload lifts the party before the save lands. A pause holds the layer.
- **The follow brain** is the motor's: `ai.follow` (the leader's live feet and how near to keep - `HEEL_M`, a pace
  further for the second). No foe to fight - or a fight that has drawn him past `FOLLOW_LEASH` - a companion turns and
  walks to the leader (`enemyMotor.js _followTicks`: the pursuit's own turn-then-walk, standing inside `stop`, off
  again past `stop + FOLLOW_SLACK`); the pathing motor routes it round walls on the navmesh (`enhancedMotor.js
  _followGoal`, the route dropped as he turns between following and fighting). AUDIT CREW CC-B3/B4: he fights only a
  foe within the leash of his LEADER that he can pursue; drawn past the leash he is RETURNING - every target dropped,
  the secondary one too - until he is home; a foe never seen, or given up on, leaves him following. Left `CATCH_UP_M`
  behind, or `CATCH_UP_DY` a floor away while the leader stands on one, he is stood behind the player again, his motor
  resumed (no fall billed from the ledge he left).
- **Fighting.** Each stands as the player's ally (`allied`: team PlayerAlly), a `shipmate` none of the player's blows
  reach (`combat/friendlyFire.js`, now the dungeon's swing, door and shaft, and a torch indoors and underground too),
  whose team no blow of the player's turns (both pools' attack door - AUDIT CREW CC-B1 - and the layer puts it back
  regardless), a `companion` every hostile may fight - with infighting off as well (`enemyTargets.js getTargets`'
  else-arm; a plain summon keeps DFU's chain) - and a quest's foes too; never the player's foe nor an ally's. A monster
  fighting him keeps the town's watch. The layer's catch-up (`CATCH_UP_M`) comes long before the street's cull
  (`ENCOUNTER_CULL_DISTANCE`); he takes no encounter slot; he is `transient` (no place's save) and the room's save skips
  him. His green bar shows in every mode (`navalCrewBars`, the host's `drawCompanionBars`, under a dungeon window too),
  a peer's companion's indoors and underground as well.
- **CO-OP** (AUDIT CREW CC-E, Mac: *"Full co-op combat now"*). The owner simulates and the striker reports, as for the
  player's own blows: a companion's blow on a foe another client stands goes to its owner as an ALLY's (`al`, `ac` his
  number - the owner's foe turns on him, never on his player); a foe's blow on another's companion goes to the
  companion's owner (`fb`, `sf` the striker's number), where he is real and his knock-out is. The frames name each
  owner's companions (`cp`) - the street's and a building's foes frames, and the room's own lane underground, which a
  dungeon companion now rides as a loose stand, stood by everyone as that player's ally; the other clients' bodies
  join each side's hunt. A lifted companion makes the next street frame whole. Nothing of `server/src` or `src/net`:
  the hit and the frame carry what they always passed through. Said: another's foe fighting my companion swings at him
  only on its owner's screen (a record names no companion as its target).

Pins: `test/crewcompanions.test.js` and `test/auditcrew.test.js` (AUDIT CREW, `01-Overview/Audit-Crew.md`) (the party's laws, the follow brain on a flat and round a wall on a real navmesh,
the targets, the layer through doors, sweeps, knocks and catch-ups, the deck, the menu, the wiring by source).
`tools/mutants/crewcompanions.json`: 47 mutants, all dead.

## COMPANION-KIT (2026-10-01) - the companions' gifts, pack, bar and card - DECLARED

Mac: *"crew member companions need the ability to gain the players healing spells/buffs, act as storage, improved
detailed health bar with buffs and their name, and also an integration into the party UI"*. Daggerfall has no
followers; all of this is the port's own, over CREW-COMPANIONS.

- **The gifts** (`scenes/hostMagic.js`, its `companionBodies` seam - my companions' bodies in the scene, handed to each
  host's cast engine: `world.js`'s (the street, and a building's mode through `worldModes.js`), `dungeonContext.js`'s
  own; `exterior.js`'s FLAGGED - no Come Sail Away runtime stands there, so no companion does). A spell ALLY-CAST would
  give a party mate reaches my companion the same ways, when it carries something he can use (`allyCast.js
  companionCastable` - every real effect beneficial, and never Light, Detect or Comprehend Languages alone,
  `COMPANION_UNREAD_TYPES`: only a player reads them): under the crosshair within the cast's reach (`allyReachFor`: a
  CasterOnly or ByTouch one at touch reach, a SingleTargetAtRange one at range), armed while one stands within
  `ALLY_ARM_RADIUS` (`COMPANION_ARMED_LINE`; a party mate under the crosshair or near first, `ALLY_ARMED_LINE`), by
  touch (his whole height - `companionInReach` at the click's gate too), in my AreaAroundCaster blast, struck by my
  beneficial missile or its burst. It lands HERE - he is mine to simulate - as ALLY-CAST's receiver's own record
  (`allyCastSpell` with `companion`: what he can use, the beneficial effects as a self-cast, so no save scales it), with
  no caster, so nothing of his reflects it back (AUDIT ALLY-CAST B6's law), tagged an ally's bundle (`allyCast`: a buff
  on his bar and card), through his own sinks as no blow of mine. The crosshair, the arming and the touch never cross a
  wall; a blast and a burst meet him as they meet a foe (DFU's OverlapSphere). Never a harmful or mixed spell, a free
  ready, a companion knocked out (`_knockedOut`, the frame before he is carried aboard), or another player's companion
  (a puppet - his effects are his owner's). His spells and his whole ride with him from place to place
  (`crewAshore.js`: each new body stands with the last one's live entries and its max health) - not through a save.
- **The pack** (`crewCompanions.js` - each companion's live `items`, saved with the party through the host's item
  codec, `packedItemsCodec`, the cargo's own). Activating my companion in Info, Grab or Talk within
  `TREASURE_ACTIVATION_DISTANCE` (else "You are too far away", as any storage) opens it (`player/
  mobileEnemyActivate.js openCompanion`; every host's foe arm - `world.js`'s street, `worldModes.js`'s building and
  dungeon) as a Backpack storage over whatever the mode draws, his list read by his key at every look; a tap never
  locks onto him (each host's tap pick passes him by). Sent back aboard he gives it up (`takePack`); knocked out or
  fallen from her roster, the host empties it; and the host stows it (`stowPack`): his boat's hold first (the board's
  `giveItems`), what will not go in into my pack - past its weight if it must, said ("more than you can carry") - his
  gold to my purse. Never thrown away. Realm customs and the account service's first save count his pack as the hold
  (`net/realmGoldLaw.js stashedItemLists`). **COMPANION-WEIGHT (2026-10-01, the field: "make the crew companions
  have a balanced inventory weight")**: it carries what a person of his strength can - DFU's MaxEncumbrance over his
  body's live strength (`systems/naval/crewCompanions.js packCapacityKg`: 1.5 kg a point and any weight allowance -
  67-97 kg by his class's strength, a Bard's 45 67 and a Warrior's 60 90, more under a Fortify of mine). The storage
  target hands it in (`capacity`, read at every store from his LIVE body, looked up by his key - AUDIT ECON C5), both
  windows' store and gold doors take what fits and refuse the rest in his name (`itemTransfer.js` `packFullText`,
  `packFullGoldText`; `inventorySession.js storeCapacityOf`) - above the quest arm, so a refused letter is never
  marked dropped (C1) - and both windows show his load against it (the enhanced header; the classic remote panel,
  C2). A pack filled past it before the limit keeps everything and takes nothing more; a companion gone from the party
  under his open window (a quickload that left him aboard) takes nothing at all (`packGoneText`, C5 - it had taken into
  a list nothing kept); taking out is never gated, and stowing it in the hold or my pack is untouched. THE FOUR HOSTS: the
  limit lives in the one door every host opens his pack by (`scenes/world.js openCompanionPack`) - the street's
  activation (`world.js`), a building's and the dungeon's (`scenes/worldModes.js`, through `host.openCompanionPack`;
  the dungeon's companion bodies are `scenes/dungeonContext.js`'s own records, found by that activation);
  `scenes/exterior.js` stands no crew companion and has no pack door - FLAGGED, CREW-COMPANIONS' own.
  `test/companion_weight.test.js`.
- **The bar** (`ui/navalHud.js drawCrewBars`): a companion's is wider (`MATE_BAR_W`), his name and health in digits
  over it and his live effects' icons under it (`MATE_FX_MAX`, the party card's own row: `composePartyFx`; fitted by
  `iconFit.js`'s law, a harmful one ringed as the card rings it); a deck hand's stays bare. Another player's companion:
  his name (his owner's foes frame names him, `cn` beside `cp`, on the street's lane and the dungeon's) and no digits
  or effects.
- **The party panel** (`ui/partyPanel.js`, its `companions` seam - `setCompanions` after the build): a card each under
  the party's seats, in their own list the seats give way to at the panel's height - the green name, the role where a
  member's place goes, the role's letter on the plate (the crew have no portrait; full contrast, hidden from a screen
  reader), the health bar (no stamina or magicka), its digits while low, the flare and the "+N" (a new whole a new
  baseline, never a blow or a heal), the effects row - repainted only when his card's words move (`companionKey`), and
  once as a window lifts. None while I sail: the party is aboard. Offline, the panel stands for my companions alone;
  online it stands down only for the social one (`world.js makePartyPanel`, the one place a panel is made).

Pins: `test/companionkit.test.js`; AUDIT WATCH-KIT's `test/auditwatchkit_magic.test.js`, `auditwatchkit_ui.test.js`,
`auditwatchkit_world.test.js`. `tools/mutants/companionkit.json`: 43 mutants, all dead.

## SHIP-WATCH (2026-10-01) - life aboard between fights, and the sea by night - DECLARED

Mac: *"Do #3"* - the list's *"Life aboard between fights. Crew sleep below at night, and a lookout up the mast calls
'Sail ho!'. The crew swab decks, haul lines and patch damage after a fight"* - with *"If not already, ships at night
should use their lanterns (AI)"* and *"I also want to keep improving the AI"*. Neither Daggerfall nor Come Sail Away has
any of it; all of this is the port's own (`systems/naval/shipWatch.js`, pure, and the crews', captains' and host's
arms below).

- **The night watch** (`crewLife.js`, `ctx.asleep` - the world's hour through `shipWatch.js asleepHour`,
  `SLEEP_FROM_HOUR` to `SLEEP_TO_HOUR`). Every crew turns in but its watch (`watchCount`, a third of her whole crew, one
  at least): her stations, her lookout, then the roster's first. The rest walk to her HATCH (the middle of her whole
  deck's extent) and go below - `below`, never `gone`: the count stands whole, the guns' trim and the mending's restore
  read them as they were (one the guns take below is up again when mended), a man taken off her deck while below comes
  up out of her hatch and one going ashore comes home on her deck. A crew first stood by night (a ship come into range,
  a load, my hands home after a fight) has its sleepers below at once, no walk. Below is not drawn (`navalCrew.js`). No
  song in the night watch; the watch talks low (`CREW_BLURBS.night`). The guns, a muster or her colours struck bring
  every hand up at once to `ALL_HANDS` ("All hands on deck!") - at the hatch or a clear point beside it, at a run; the
  morning brings them up quietly, one at a time out of her hatch (never two on one point, nor into the player standing
  on it), each straight to a free spot. Under a repair order every hand stays up.
- **The lookout** - one walker (never her Bard, who leads the song, nor her station, nor a man on his way below; her
  first man only if none else), asked at every step, by day as by night - another takes the bow the step he falls, goes
  ashore or below; on my boat the hand her card names Lookout (SHIP-CREW's role, `ctx.lookout` - the host's `myCrew`)
  whenever he can keep it. At her BOW (`LOOKOUT_BACK` from her stem, the deck's foremost cell nearest her centre line -
  the Carrack's waist is decked forward only at its sides, so hers stands 1.68 m to port), facing out over her stem;
  nobody draws him into talk. At the guns he is a gunner like the rest: they end his watch at once. AUDIT NAV1's SAIL
  HO! (`navalHost.js hailSails`) is cried by him from the bow now - handed over once through the host's `myCrew` `call`
  and shouted over his head beside the HUD's line. Not up the mast, as the list put it: Come Sail Away's masts carry no
  top to stand him on.
- **At work** (`ctx.work`, 0..1 - `navalHost.js workOf`: her hull's loss and half her canvas's; all hands under a
  repair order, by night too). An idle man takes up a job at a free spot of her deck - `WORK_SHARE` of his choices at
  the most, plus a `CHORE_SHARE` chore at peace - for `WORK_S`, swinging at it every `WORK_SWING_S` (his class's
  attack, `swing` -> the mobile unit's `striking`), saying the work's words (`CREW_BLURBS.work`, `chore`). By night
  the watch works her hurts and takes no chore. The guns end it, a walk to it too; a struck or sinking crew takes up
  neither. The sea's ships as well as mine, and another player's boat by her word's hull (`peerBoat`'s `work`).
- **The lanterns by night.** Every sea ship lights hers at the city lights' hour (as Come Sail Away's boats do) - the
  lanterns she carries (`carriesLanterns`: Come Sail Away's carrack carries none, so she sails dark) - but `runsDark`:
  a pirate afloat keeps hers out, and a merchantman running (`flee`) douses hers (`navalHost.js shipLit`). A lit ship
  past `LAMP_NEAR_M` of the eye is drawn as up to `LAMP_MAX` added points of light at her lanterns (`lampsInto`, on the
  naval pass - `lampSize`: `LAMP_ANGLE` of the view, never under `LAMP_MIN_M`; `lampAlpha` fading in over
  `LAMP_FADE_M`): her lantern flats are a pixel at range and the light list holds the nearest eight, so a ship at night
  was her black hull against the black water. Mine too, and another player's, as their switch has them.
- **The captains by night** (`navalAI.js`, `world.night` - the dark's own hours, DFU's `isNight` through
  `where().night`; the lanterns keep theirs; AUDIT NAV1's lookout reach otherwise unchanged). A contact is seen by night
  only as far as its lanterns show it (`nightSight`: a lit one `NIGHT_LIT_SIGHT`, a dark one `NIGHT_DARK_SIGHT`, never
  farther than by day - `c.lit`: a sea ship's `shipLit`, my boat's lantern switch, a peer's as their word lights her); a
  ship that fired within `GUNS_SEEN_S` is seen by her flashes (her report heard under her contact's own id, `gunfireBy`
  - mine and a peer's too); and a threat to run from no farther - a merchantman that ran by night runs on `RUN_ON_S`
  from where she last saw it, dark, the day ending it. A pirate running dark comes up on a merchantman unseen; a player
  who douses their lanterns slips past a pirate at a cable's length. The guns are heard as ever (`HEAR_GUNS_M`), and
  sailed for until within half the lookout the night lets her see a dark ship by. My lookout's SAIL HO! keeps the same
  law, lanterns and flashes (`showsLight`), and so does my crew's call to the guns by night (`crewAlarm`): a hostile the
  night shows, or one coming for me - a rest and a journey still read every hostile near.
- **The errands by night** (`shipLife.js`, `ctx.night`, the same dark). A merchantman whose dwell is spent after dark
  keeps her berth till the morning; a navy does not wait. A pirate's lurk closes on the mouth to `NIGHT_LURK_K` of her
  day's reach, her ring laid afresh at the turn and back out by day.

Said: a player's boat stands dark until its lanterns are lit (Come Sail Away's own switch, off when she is built), so
by night a pirate sees her only close aboard unless they are.

Pins: `test/shipwatch.test.js` (the laws, the watch below and every hand up, the lookout, the work and its swing, the
host drawing none below, the captains and the errands by night, the lanterns, the cry and the lamps on the real host,
the world's wiring); AUDIT WATCH-KIT's `test/auditwatchkit_crew.test.js` and `auditwatchkit_sea.test.js`.
`tools/mutants/shipwatch.json`: 54 mutants, all dead.

## SEA-EASE (2026-10-01) - a quieter, safer bay, and the crown's ships at the player's side - DECLARED

Mac: *"Also, too many ships are appearing. Friendly AI should help the player in combat. The sea is too dangerous right
now"*. All of it the port's own, over NAV-C's traffic and SEA-PEACE's tempers (`systems/naval/navalDirector.js`,
`navalAI.js`, `navalRaiders.js`, `scenes/navalHost.js`).

- **Fewer ships.** The densities keep one, two or four ships near a player (`DENSITY` few, some, many - they kept two,
  three and five), rolled for every `SPAWN_EVERY` (60-140 s, was 30-65) and the first `FIRST_ROLL_S` (30 s, was 12)
  after the water is reached; one raider of Warm Ashes' at a time (`RAIDER_SHIPS_MAX`, was two). Measured by the
  director's own law (a straight course at 6 m/s for twenty hours, `test/seaease.test.js`): at the default "Some" 18
  ships an hour where it launched 31, and 6 pirates where it launched 15.
- **A safer sea.** The open bay's weights 30 pirates, 45 merchantmen, 25 crown's ships (`FACTION_WEIGHTS`, were 45, 38
  and 17), and within `PORT_PIXELS` of a port the pirates' weight cut to `PORT_PIRATE_K` (a half) - the crown's own
  waters; a quarter of the pirates bold (`BOLD_SHARE`, was two in five) - the rest wary, taking only a prize they
  outgun; a boat lying still grappled after `GRAPPLE_STILL_S` (15 s, was 5) - a captain who stops to look about is not
  boarded for it.
- **THE RELIEF** (`navalDirector.js`). While a pirate I stand fights a lawful player - engaged on them or coming
  alongside - and no crown's ship that does not hunt them sails within `RELIEF_NEAR_M` of them (`navalHost.js
  distressAt`: me at my helm, a peer at theirs; their notoriety in the waters' crown under `NAVY_HUNTS`), the
  director's next roll comes within `RELIEF_WAIT_S` and, on `RELIEF_CHANCE` of it (its own `RELIEF_SALT` stream), launches
  a navy ship on the ring about them, facing them - in a berth past the density's own, one relief at a time, and while
  they fight it launches nothing else: the sea sends help, never more strangers. Her course is laid for where they
  were (`ship.course`), kept until her lookout has a fight (the guns she sails for are not one) or she is within
  `RELIEF_REACHED_M` of it; no errand of her own. She is a crown's ship like any, and sails on when it is done.
- **A crown's ship stands by a lawful player** (`navalAI.js standsBy`, `fightsAny`). Of the pirates in her lookout,
  one fighting a player she does not hunt (in her fight with them, or coming alongside) is hers first - chosen as if
  `AID_PRIORITY` (a half) nearer than she is. A navy ship that takes on a pirate fighting me says so, once: "*her name*
  comes to your aid!".
- **THE STRAY** (`navalHost.js strayOnAlly`). A ball of mine that strikes a crown's ship of mine fighting a pirate is a
  stray, not a feud, while what I have struck her for stays under `ALLY_STRAY_SHARE` (15%) of her hull: no Piracy, no
  notoriety, no provocation and no witness, and "Check your fire! *her name* fights on your side." said once; past it,
  the law as ever. A peer's ball on her is weighed the same (their own client charges their own law).

Said: the Ships at sea setting keeps its three tiers - their numbers moved; a player who wants the old sea picks
"Many" (four). Not done: merchantmen do not come to anyone's aid (a merchant fights no one - SEA-PEACE); a relief is
sent only by the player who stands the sea (SEA-TRAFFIC's election).

Pins: `test/seaease.test.js` (the numbers, the measured hour, the relief's law, standing by, the host's relief and its
cry, no relief, the stray and the peer's stray). `tools/mutants/seaease.json`: 37 mutants, all dead.

## SHIP-PRICE (2026-10-01) - a boat about a quarter of the price - WITHDRAWN before the merge

Built on the branch for Mac's *"make ship prices more reasonable"* ("About a quarter": the hulls at 1,000 to 50,000) and
withdrawn at the review before the merge, never shipped: *"Remove the changes to ship reduction cost."* Come Sail
Away's own prices stand - 4,000 (Rowboat), 8,000 (Large Boat), 100,000 (Small Ship), 200,000 (Large Galley) and
150,000 (Carrack) (`systems/comeSailAwayBoat.js HULL_PRICES`). Its pin and its two mutants went with it;
`test/csa_items.test.js` reads the shelf's literal prices again. SHIP-CREDIT and SHIP-CLAIM stand on the mod's prices.

## SHIP-CREDIT (2026-10-01) - a boat bought on the bank's credit - DECLARED

Mac's second pick of the same ask: *"Buy on credit - Pay part now; the bank lends you the rest under Daggerfall's own
loan rules."* At a shop's counter a lot of boats and nothing else (Come Sail Away's parts or deeds - `tradeModes.js
lotAllBoats`) that the purse falls short of is offered on credit, in both trade skins (`ui/nativeTrade.js`,
`ui/enhancedTrade.js`):
the purse pays what it holds - `CREDIT_DOWN_SHARE` (a fifth) of the price at least - and the bank of the shop's region
lends the rest under BorrowLoan's own law (`banking.js creditDecision`): borrowDecision's refusals (a loan or a
default standing there; online the Empire's one loan a character, in its own words), `LOAN_MINIMUM` at least (a
shortfall under it borrows the minimum and the purse pays the less), CalculateMaxBankLoan at most (level x 50,000;
online a tenth); repaid with its 10% within the year, LoanChecker's reminders and default as for any loan
(`takeCredit`). The lent gold goes to the shop, never into the account. The box: what the purse holds against the
price, what the bank lends, what is paid now and owed within the year, and "Buy on credit?"; a refusal says why under
the gold's own. The host asks the bank again at the Yes (`worldModes.js commitTrade`) and buys nothing on a credit no
longer given.

THE BOAT ALONE (the review before the merge, 2026-10-01): a basket that held a boat put the whole basket on the bank's
credit - a sword and a cask of wine lent on beside the hull. The bank lends on boats bought by themselves: a lot that
holds a boat among other goods is refused under the gold's own refusal ("The bank lends on a boat bought by itself.",
`CREDIT_BOAT_ALONE`), and the Yes buys nothing on credit for more than boats.

Pins: `test/shipcredit.test.js` (5). `tools/mutants/shipcredit.json`: 33 mutants, all dead (SHIP-PRICE's two withdrawn
with it; five for the boat alone).

## SHIP-CLAIM (2026-10-01) - a prize claimed as the captor's own boat - DECLARED

Mac: *"provide more accessibility options to acquiring"* ships - and of the choices put to him, *"Claim captured prizes -
Keep a ship you take by boarding as your own boat, instead of scuttling her or casting her adrift"*. Daggerfall has no
ships and Come Sail Away no captured one; the claim is the port's own, and the boat she becomes is the mod's.

- **Her third fate** (`ui/navalPlunderWindow.js`): HER FATE has CLAIM HER beside Scuttle her and Cast her adrift, and
  under the three a line saying what she becomes ("Keep her as your own Small Ship: her deed to your pack, her hold
  aboard her. She has no crew."; a small boat's "Keep her as your own Large Boat where she lies, her hold aboard
  her."). Offered (the model's `claimOffer`, `navalHost.js claimable`) for a prize I stand - one another player stands
  is theirs to settle - and only where Come Sail Away can place her: its runtime's placing and the world's mint and
  pack (none with the mod off). A voyage raid's window has none (its one way on is Sail on). The press asks the host
  again; a refusal stays, with a word. Her fate answers a boolean from every exit (THE MODAL CONTRACT).
- **Her deed** (`systems/comeSailAwayItems.js mintDeed`): the shelf's own deed - the mod's items' UID off the world's
  mint (`mintUid`), her hull and variant in its message and name ("Deed to Small Ship 'I'") - worth `PRIZE_DEED_SHARE`
  (a quarter) of her hull's shelf price (`navalPlunder.js prizeDeedValue`: 2,000 a Large Boat, 25,000 a Small Ship,
  50,000 a Large Galley, 37,500 a Carrack): her papers - a taken ship is no bought one, and a full-price deed would make
  every pirate a fortune to sell. Into the pack as the mod adds its items (`packDeed`: AddItem, no weight's gate).
- **Her boat where she lies** (`systems/comeSailAway.js LaunchFromDeed`, LaunchFromParts' sibling for a deed):
  PlaceBoat at her place, her bow along her heading, on the terrain under her (`terrainAt`), then the item's half
  (takePlaceItem): the deed's UID on her, so the deed answers her. A bought deed's port rule is untouched - a deed whose
  boat stands is refused there, the port's to move. A hull the mod spends a deed on placing (not `crewed`: the Large
  Boat - a pirate sloop or a coaster) spends this one too: she is the mod's small boat, picked up into her parts and
  placed again like any other - and since SHIP-PACK (`03-World/Come-Sail-Away.md`) so is every claimed ship, her deed
  in the pack, her parts at her papers' worth.
- **Her hold**, what is left of it, aboard her as her cargo.
- **Her hurts, as shares**, on her state as a boat of mine (`myBoatState`, by her deed's UID): her hull - never under
  one point, she floats - and her canvas, so she wants a shipwright; her crew gone - NO hands aboard (the yard sells
  them), and a crewed hull with nobody aboard mends nothing alone; her fire barrels what she has left; no hand of hers
  counted against her spirits. WHAT WAS TAKEN FROM HER IS GONE FROM HER: her timber that made good my hull and canvas
  is out of hers, and her powder taken leaves her no barrels.
- **ALL OR NOTHING**: a placing that throws or stands no boat takes her deed back out of the pack; she lies a prize
  still.
- **Let go from the sea unsunk** (`drop`): no bell, no casks, no reward. Her living crew go with her record; her dead
  lie on her deck still (the world's `redeck` - my hull stands where hers was). A harbour's moored ship claimed is not
  stood at her berth again that day. I am back at my own helm, as her other fates put me. Said: "The Red Wake is yours
  - her deed is in your pack. She has no crew: hire hands at a shipwright." - a small boat's "... is yours - she lies
  where you took her."
- **The saves**: the naval save keeps her state by her UID as every boat of mine (`NavalCombat` v1, no new field);
  Come Sail Away's keeps her boat (UID, hull, variant, place, heading, hold).
- **Online**: only my own stood prize. My word stops saying her and every other player lets her go at once (a prize
  is no sinking); her boat is one of mine on Come Sail Away's own word. Nothing under `server/src` or `src/net`.
- **THE FOUR HOSTS RULE**: the seams are the naval host's board in `scenes/world.js` (`mintUid`, `packDeed`,
  `terrainAt`, `redeck`); `scenes/exterior.js` (no Come Sail Away runtime), `scenes/worldModes.js` and
  `scenes/dungeonContext.js` (no sea) stand none - pinned by a sweep.

~~OPEN for Mac: a claimed Large Boat is the mod's small boat to the letter - her deed spent on placing, and Pick up packs
her into Parts at PackBoat's full price, not her papers' quarter.~~ CLOSED by SHIP-PACK at the review before the merge:
a boat's parts carry the worth of what placed her (`itemValue`), so a claimed prize of any hull packs at her papers'
quarter - a pirate sloop's 2,000, never the shelf's 8,000 - and a taken ship is no fortune in parts.

Pins: `test/shipclaim.test.js` (14 - the two SHIP-PACK ones: a claimed ship picked up and placed again is the same
ship, her hurts and her empty crew kept by her number; a claimed Large Boat packs at her papers' worth).
`tools/mutants/shipclaim.json`: 58 mutants, all dead; `tools/mutants/shippack.json` holds the pick-up's.

## SHIPS OF THE BAY (2026-10-02) - SHIP-NAMES, SHIP-STANCE, SHIP-TAGS, SHIP-FADE, SEA-LANES - DECLARED

Mac: *"2. Improve the enemy and friendly UI substationally. Ships should just disappear into the void. If theyre going
out to open sea, they should fade away, ships should be more persistant and actively engage with multiple docks and
multiple pathways around daggerfall 3. Friendly ships should have green Healthbars unless provoked 4. Enemy and
Friendly vessels need a large assortment of generated names"*. All of it the port's own, over NAV-C's ships, NAV-F's
tags and card, SHIP-LIFE's harbours and NAV-R's shared clock.

- **SHIP-NAMES** (`systems/naval/navalShips.js shipNameOf`, `NAME_WORDS`, `CROWN_LORE`). A name was a line of her
  trade's list - sixteen merchantmen's, eighteen pirates', six a crown's - and a possessive took an article ("The
  Dagon's Tooth"). Now each is drawn off her seed from her trade's FORMS, each a weight: a crown's ship of her crown's
  list, her royals' virtues ("Eadwyre's Fury"), her crown and a martial word ("The Daggerfall Resolute"), a divine's
  favour ("Stendarr's Peace"), an emblem of her crown's places ("The Eagle of Cybiades") or a martial word alone
  (3 : 5 : 5 : 3 : 3 : 3); a pirate of the old list, a dark beast ("The Blind Gale"), a Daedric prince's boon
  ("Azura's Grin"), a deed of heads ("The Goldreaver"; "The Bone-eater", hyphened where a letter would double) or a
  scourge of a port (2 : 6 : 4 : 3 : 3); a merchantman of the old list, her port and calling ("The Daenia Packet"), her
  fortune and wares ("The Patient Wren"), her port's goods ("The Menevia Mead") or a lady of her port ("The Maid of
  Phrygias") (2 : 5 : 5 : 4 : 4). Three thousand seeds name over 2,100 merchantmen, 1,800 pirates and 600 of each
  crown's. A name in the possessive takes no article. On its own stream (`SHIP_NAME_SALT`): her captain, drawn after one
  draw of the ship's stream as ever, is the captain she always had; a peer's copy - her seed and waters - bears her name.
- **SHIP-STANCE** (`scenes/navalHost.js stanceOf`, the tags' and the card's one reading). A ship flying a lawful flag
  (a merchantman, a crown's ship), afloat and not hostile to me (`navalAI.js hostile`: she would take me, a crown hunts
  me by my notoriety, or a blow of mine within PROVOKED_S) is FRIENDLY: her tag's bar green (`CREW_GREEN`, the
  party's), her card's hull green and its state "Friendly" in green. Provoked, hunting me or struck she is not - a
  hostile ship's red as before, "Hostile" in red; a pirate not after me now is neither (her bar red still: no lawful
  flag); a struck ship is neither (the card read a struck ship provoked once hostile, her tag never did). The blow
  forgotten, she is friendly again.
- **SHIP-TAGS** (`navalHost.js boundOf`, `ui/navalHud.js tagLine`). Within TAG_DETAIL_M (400 m) of the eye the one tag
  SHIP-CLUTTER picks (below) reads a second line under her name: her class (a crown's by her crown, "Wayrest War Galley") and where she is bound -
  moored at, leaving, patrolling off or bound for a harbour by its town's name (the world hands the name with the
  port's footprint, `navalHarbourNear`), a lane's packet bound for her next port or lying off it, a relief coming to
  your aid, a voyage out of the harbours bound out to sea; nothing while she fights or runs, nor struck. Past
  TAG_DETAIL_M none (the line hidden by its `:empty` rule). The card's state line says the same after her stance
  ("Friendly - bound for Sentinel"), on one line cut at the card's edge (AUDIT BAY A10: the aside card's ran to a
  second). AUDIT BAY: a crown's ship answering the guns says nothing of where she was bound - a relief still comes to
  your aid (A11: she read "bound out to sea"); a packet leaving a harbour with no name reads her lane's next port
  (A16); another player's packet, known by her seed, reads her lane along her own leg (A22, below), and another's ship
  lying still at a berth of a harbour I know reads moored at it (A9: both read nothing).
- **SHIP-CLUTTER** (FIELD BUGS 2026-10-02c, `01-Overview/Field-Bugs-2026-10-02c.md`; `ui/navalHud.js layoutNavalTags`,
  `navalTagBox`; `scenes/world.js navalTags`). Off a harbour every tag stood on its own spar and every one within
  TAG_DETAIL_M read its second line - five names through five lines (Discord: "an overabundance of ship text on the
  high seas"). The tags are laid before they are worn: ONE second line - the card's ship's, else the tag nearest the
  crosshair (the world strip's middle, handed in as `focus`) within TAG_FOCUS_PX (140 px at the HUD's scale), else none
  (with no `focus` handed in, the nearest ship's); and NO TAG OVER ANOTHER - laid the line's ship first, then the
  hostile, then the nearest, a tag whose box (read off its words, the 11px face's advances measured in Chromium) would
  come within TAG_CLEAR (3 px) of one laid is not drawn that frame, and one left out needs TAG_HOLD (8 px) more to come
  back. `test/shipclutter.test.js`.
- **SHIP-FADE** (`navalHost.js retire`, `fadeStep`; `scenes/comeSailAwayPool.js`; `render/orderedDither.js
  DISSOLVE_GLSL`, `render/renderer.js setDissolve`, `render/enhancedLighting.js EL_MESH_FS`). A
  ship let go by her range was dropped where she sailed - the director's past DESPAWN_BEYOND, a raider past
  RAIDER_DROP_M, a harbour's moored ships the moment the port was left, a peer's ship out of their word - and every ship
  came into the world whole. Now she comes in over SHIP_FADE_S (4 s) and goes out over SHIP_FADE_S from the share she
  has (one never seen goes at once): RETIRED, she sails on, dissolving, and is dropped when she has gone; back in range
  as she fades (a raider, a packet, a harbour's ship, a peer's ship said again) she stays; one of mine fired on as she
  fades - engaged, alongside or boarded - comes about and stays; a peer's fades whatever her word said. A ship sunk,
  taken or yielded into a peer's copy of her (OW6) goes as she always went. Drawn: the pool sets the renderer's
  dissolve to her share about her meshes and puts it back after her (`setDissolve`: clamped, uploaded at once on the
  installed mesh program, nothing asked when unchanged - no pass uploads it, so the frame's cost is LA-COST1's as it
  was); both mesh shaders - the classic and Enhanced Lighting's, the classic shadows' lane with it - cut her fragments
  after their slice by the port's one `bayer4` (`dissolveCut`: a fragment kept where the screen's 4x4 threshold stands
  under her share, exactly k of 16 at k/16 - no blending, no sorting, the depth written as any opaque's). The uniform
  is the share CUT, so nought - every uniform's own start - is whole: no program needs a word to draw everything. Under
  FADE_FLATS (a half) her flats (her crew, her lanterns) stand down; one faded away draws nothing; her tag's opacity is
  its distance's times her share. Compiled in Chromium's WebGL2 (all three mesh shaders), and the cut measured there:
  a sixteenth, a quarter, a half and three quarters of an 8x8 target kept, to the pixel. AUDIT BAY: everything of her
  goes with her - her SHADOW by the same cut in the depth maps (A12: `render/shadowPass.js DEPTH_CUT_FS`, the lit
  pass's own `dissolveCut` over the map's texels; a record carries the renderer's `cut`, is never a cache's, and is
  drawn with the cutting program, its cut uploaded once a record a replay - a whole one's the plain program, nothing
  uploaded); and under FADE_FLATS her lanterns' light and far lamps (A13), her deck fires (a flame is a flat:
  `scenes/navalFlames.js show`), embers, smoke, founder and burning glow, and her wake, splashes and colours (A14).
- **SEA-LANES** (`systems/naval/seaLanes.js`, pure; `navalHost.js liners`, `steerLiner`; `world.js laneShips`).
  THE LANES: every port town of Travel Options' list with the ocean's water (never a lake's) within ROADSTEAD_PX (3)
  of it - its ROADSTEAD, the nearest such pixel, ring by ring - runs lanes to its LANE_NEIGHBOURS (2) nearest such
  ports within LANE_MAX_PX (30 pixels, some 25 km): each pair once, the lower id first, the same lanes on every client
  whatever order the ports are read in - a coast a chain, every port two lanes at least. A lane's way is the water's:
  an A* over the map's water pixels, eight neighbours with no corner cut past land, the shortest, no longer than
  LANE_PATH_PX (60), straightened wherever a line holds to the water (LANE_STRAIGHT_STEPS a pixel). THE PACKETS: a
  lane sails one every LANE_HEADWAY_S (30 min) each way, each a merchantman or on LANE_NAVY (a quarter) of them a
  crown's ship, at LANE_LEVEL for every player and never a galley, her cruise LANE_CRUISE of her class's best; she sails
  out, lies LANE_DWELL_S (10 min) at the far port, sails home and lies LANE_DWELL_S at hers, for ever, on the SHARED
  CLOCK (`raidNowMs`, NAV-R's) - so where she is is the clock's alone: every player meets her in the same water, a port
  left and come back to finds her further on, and the ship watched out of one port is the one that berths at the next.
  Her VOYAGE is her cycle: her id names her lane, her place and her voyage, and the next voyage is another ship -
  AUDIT BAY A17: unless she is on the water as it turns: her `seeds` are her place's last LANE_LINEAGE (24) voyages',
  hers first, and any of them afloat is her place's packet - she sails the next voyage as herself (she faded out at her
  berth in the port's sight, and another was stood at the roadstead). Her `region` her home port's (A8).
  THE HOST: a packet under way within LINER_STAND_M (1,200 m) stands where her lane puts her, fading in - LINERS_MAX of
  them by the Ships at sea (one, two, three; none with it off), the shared sea's traffic, every player their own (AUDIT
  BAY A5: only the elected launcher stood any - a packet by another player was stood by nobody; two standers' twins
  are the claim rule's), the nearest first, never twice, never one whose voyage's ship or place's packet is in my sea,
  never off the water; one lying at a port whose harbour I know stands moored at its LAST open berth (A7: the
  harbour's own are stood at its first; a berth another's ship lies at is none) - no galley moors - named by her home
  port's region wherever she is met (A8). Each ship in my sea is known by her seeds (A3/A9/A17): mine, taken over or
  sailing on into her next voyage, steered by her lane; another's read on her tag - followed along her own leg by where
  she lies (A22: a peer's copy kept the leg she was first known on for good, and taken over sailed it again): first
  known under way heading back along her clock's leg, on the leg before it (behind her clock by a leg, for the port it
  left - fighting, lying at a berth or off her clock's port, her clock's); at her port (a berth of it, or her leg's
  end) as her clock sails her on, on its next. A ship of mine her lane takes up - taken over, or met in it again -
  keeps her lane's errand alone: lying at a berth or on her way out of a harbour she keeps to it, SHIP-LIFE's own
  never (it sent one taken over mid-lane for the nearest harbour's berth, the port behind her). STEERED (A6, A22):
  under way along
  her OWN leg from where she is (`seaLanes.js pursue`, LINER_LOOKAHEAD_M (300 m) on - never for her place on the
  clock, which took her across the land a lane goes round), out of any berth through its harbour's mouth first; within
  LINER_PORT_M (500 m) of her leg's end (by its own remainder) she is at her port - into its last open berth, moored
  till her clock sails her on (come early, she waits for it), else lying off her leg's end; her clock gone on (she
  behind it) she sails at once for where it has her bound: the leg she sails is hers till she has sailed it (her clock
  turned under one behind it, and she came about for home short of her port). At her port is by her errand there too
  (into a berth of it, moored at one however far it lies from her leg's end, lying off it though a fight carried her
  from it); fighting, her leg is hers till her fight is done. Past LINER_DROP_M (1,700 m) she sails on
  and fades unless she fights (no lane steers a fight); back as she fades, she stays; held ORPHAN_S for a player
  within LINER_DROP_M of her, who takes her over where she lies (A4: she faded out of their sea and was stood in it
  anew - a raider likewise, and a harbour's own for the one who rolls the port, A20). Out of the list (her lineage
  past) she is the sea's as any ship - moored, her own dwell; lying off a port, an errand of her own (A19). One no
  longer afloat - sunk, struck, taken, boarded - is spent for her voyage by every player who sees her go, said in the
  word (`l`, A18), and is her lane's no more: the sea's own law lets her hulk go out of sight (A2: the lane kept a
  struck one for good). A packet counts in the sea's density and is never the director's to let go. THE WORLD: every
  LANE_LIST_MS (2 s), outdoors and running, before the frame poses the sea's ships, the world hands the host EVERY
  packet of every lane with a port within LANE_PATH_PX / 2 + LANE_NEAR_PX (34 pixels) of the player - a ship on a way
  within reach has one there (A19: only those whose place on the clock lay within 1,600 m, and one fallen that far
  behind was let go beside the player) - the lanes made once from the map's own ports, water and climate, a lane's way
  sounded once and only near the player - each in the scene with her seeds, her leg, her ports by key and name and her
  home port's region. Measured (AUDIT BAY): a packet makes 31-66% of her best way by her heading in a wind of 1 (the
  game's runs 1 to 2, a tenth of it in fog), her schedule LANE_CRUISE (70%): she falls behind it - 1 km in 20 minutes -
  and sails her own leg out; one that outsails it waits at her port.

Said: the lanes are made from the real map's ports and water, which no test here reads (the game's data is not in the
tree): a port with no ocean pixel within three of it has no lane, and a lane longer than sixty pixels of water none.
Online: every player stands the packets near them and each rides its stander's word as any ship of theirs, twins
settled by the claim rule; a packet another lets go of by their range within mine is taken over where she lies; a
spent packet's voyage rides the word (`l`, a key of its own: an older build's door passes it and reads none); her
place being the clock's, a new stander stands the same ship where she sails. Nothing under `server/src` or `src/net`.
THE FOUR HOSTS RULE: the feed is world.js's alone (`navalFrame`); the other hosts stand no sea (NAV-H).
Not seen in a browser.

Pins, each red on 168bf2587: `test/shipnames.test.js` (5), `test/shipstance.test.js` (4), `test/shipfade.test.js` (8),
`test/sealanes.test.js` (9). Mutants: `tools/mutants/shipnames.json` (36), `shipstance.json` (39), `shipfade.json` (34), `sealanes.json` (71) - 178
dead, two equivalent as recorded (a roadstead ring's inner pixels asked again, found closed before; a tie of distances,
which a stable sort over ports walked in id order keeps the lower id's). PINS MOVED, each by content: `nav_c_ships` (a navy ship's name is
her crown's forms, never another crown's words; a pirate's possessive takes no article), `nav_f_ui` (the card's
`friendly` and its hostile state's own kind), and the fade's (each waits SHIP_FADE_S, or reads `retiring`, where a
ship was dropped at once): `auditnav2_captains` F23 (two), `auditshiplife_host` B2, `nav_r_raiders` (two),
`navaudit_captains` B1, `navaudit_online` #2, `navaudit_presentation` (an afloat ship out of her stander's word),
`shipclaim`, `shiplife` (the harbour roll). Records re-aimed by content, all dead: `nav_c.json` NAV-C-the-crown-ignored,
`nav_r.json` NAV-R-the-director-takes-her, `navaudit_captains.json` NAV1-a-prize-engaged, `navaudit_helm.json`
NAV1H-the-last-frames-hulls, `navaudit_presentation.json` NAVP-letgo-drops-at-once, NAVP-letgo-keeps-afloat and
NAVP-tags-hostile-unread, `shiplife.json` SHIPLIFE-HOST-moored-kept-far; `survtiers3.json`'s two world.js cites, moved with the lanes' import. Judged again (the
records on navalHost.js, navalHud.js, navalShips.js and comeSailAwayPool.js, and the moved pins' lists - 1,014): the
first 491 as this commit lands - 483 dead, two equivalent as recorded, and six that survive on 168bf2587 alike, none
of this change's (A0928-R5-flat-scale-walks-again, NAV-B-her-colours-struck, NAV-C-the-tactic-ignored,
NAV1-the-tacks-carry-dropped, NAV1-no-pay-off, NAV1-never-warped); the rest are judged after it. AUDIT BAY judged the
rest (`01-Overview/Audit-Ships-of-the-Bay.md`): of all 1,014, 1,004 dead, the two equivalent and the six, and two the
change's own - SEAPEACE-the-prize-let-go-before-the-grapple surviving (pins the fade weakened, A15) and
SHIPLIFE-AI-no-hold hanging its suite for good (A21) - each dead now.

THE MERGE with main (2026-10-02, the branch's own, for its pull request): FONT3's floor met SHIP-TAGS' second line,
which stands at 11px as every enhanced line now does (its 9px is under the floor); SILVER met SHIP-NAMES' wares, whose
coin "Drake" - the old currency's name, gone from every word a player reads - is an Ingot now, at its own place in the
bank (so every other name stands); main's FIELD BUGS 2026-10-02 met this branch's of the same name, both kept on one
page as its convention keeps them (`01-Overview/Field-Bugs-2026-10-02.md`, part three); the cites each side moved were
mapped by citeMerge, CD4's struck ones by hand.

## TOUGHER-SHIPS, QUICK-REPAIRS and SALVAGE (2026-10-03) - ships that last, repairs that need no port - DECLARED

Mac: *"For naval combat and such I want to buff health of ships, allow for more streamlined repairs, allow sunken
vessels to provide nessecary materials so you dont have to rely on the port"*. Daggerfall has no ships; all of this is
the port's own. Audited the same day (`01-Overview/Audit-Tougher-Ships.md`, AUDIT TOUGHER-SHIPS): what follows is the
law as the audit left it.

- **Tougher ships** (`navalShips.js` SHIP_TOUGHNESS, 1.6). Every hull stands that many times her first build's hull and
  canvas (`tough`, `firstBuildOf`), the classes scaling it as ever - and her MEN that many times the harm to thin: a
  ball's men are its gun's (`navalDamage.js shotMen`) over the toughness, whole men on the ball's own roll (`ballMen`);
  a ram's a man each RAM_A_MAN (40) of the hull it deals, the same way (`navalHost.js ramMen`); a fire's a man's worth
  every FIRE_CREW_S (10 s) of burning, of which a toughened crew loses 1/SHIP_TOUGHNESS of a man, carried in the
  damage's `wound` from fire to fire (AUDIT TS1: stretched to 16 s, one fire took nobody). Her hull alone toughened made
  a ship strike by her men long before her hull, and a duel's odds moved with it (the cutter on the sloop from 0.95 to
  0.66); toughened whole, `strikeTime` divides her men's loss by the same toughness and every pairing's odds are what
  they were (all 81, to 0.07%). A fight lasts about that much longer and costs as many men. What a fight's length
  stretched is stretched back: the casks and the wreckage float FLOTSAM_LIFE 240 s (150 x the toughness, AUDIT TS3), and
  a pirate runs at PIRATE_RUNS_AT 0.3 of her hull (0.33 - her band before she strikes as many balls as it was, TS4).
- **Online** (AUDIT TS6): a blow on another's ship says its men BEFORE the toughness (`shotMen`, `ramMenSaid`), and her
  stander reckons it (`applyPeerHit`, `ballMen`) - an older build's word says them so too, so a room of mixed builds
  thins a crew at one pace whichever fired.
- **The yard and the stores went down with it.** A hull point 7 gold, a yard of canvas 4 (REPAIR_PRICE, 12 and 6
  before) - a wrecked Small Ship whole for 5,728 against 6,000 - and a store makes good 64 points of work (STORE_POINTS,
  40 before): thirteen stores for a wrecked Small Ship, as before, at 314 gold each (a Carrack's eighteen, seventeen
  before: canvas at 4 to a hull point's 7, where it was 6 to 12).
- **The save** (AUDIT O1, R4). A boat is saved ON HER FIRST BUILD'S SCALE - her hull, canvas and part-spent store's
  credit the share of it they are, to the hundredth, that whole said (`maxHull`, `maxSail`: `navalHost.js
  savedRecord`) - so an older build reads her points as they always were (half a Small Ship 210 of 420, never 336 of
  420: a save carried back neither heals nor wrecks her), and this one reads every record as the share it says, or one
  from before as the share of her first build's (`savedHurts`).
- **Quick repairs.** Her hands turn to sooner and work faster: FIELD_QUIET_S 15 (30 before), FIELD_MEND_PER_S 0.4% a
  second (0.2%), SEA_REPAIR_PER_S 1.6% (0.8%). Once a fight is over **her hands spend her stores on their own** - no
  order - and pay for what the free mending cannot reach alone (`navalYard.js paidDamage`: a part under FIELD_MEND_CAP
  reads whole, AUDIT R2; with every hand of a crewed boat lost there is no free mending, and all of it is owed), all the
  way to whole: a wrecked Small Ship in 178 s on 7 stores, where the order takes 96 s on 12. A crewed boat's hands work
  wherever she lies; a boat with no hand aboard only under her captain's own, the boat in play; and only the boat in
  play is heard - a word once when the work is done or the stores give out (AUDIT R1). Features > Naval Combat > **Crew
  repairs on their own** (`naval-auto-repair`, each player's own, on) turns it off.
- **Damage control.** The order *Make repairs* is the quick way now - her stores spent from the first plank (her hull
  whole in 54 s from a wreck) - and works with a hostile ship near: at SEA_REPAIR_UNDER_FIRE (0.125) of the pace, her
  fires left burning (`createShipDamage`'s `repair`, `douse` false - a patch is no bucket chain) and a wreck left a wreck
  until the fight is over (refloated under fire, the next ball wrecked her again). That makes good about a third of what
  a ship her size deals her (AUDIT TS2: at 0.3, against fights 1.6 times as long, 70% to 102%). With no enemy near and
  a fire aboard or a ball lately in her, the order waits for the quiet as it did (AUDIT R3).
- **Salvage** (`navalPlunder.js` SALVAGE_LOT, `salvageOf`). A sunk ship leaves her WRECKAGE afloat beside her casks (a
  floater as a cask is, larger and paler on the sea - `navalRender.js`, the host's `wreck` mark). A boat that sails
  through it, or a swimmer who reaches it, hauls in her timber, pitch and canvas as carpenter's stores - SALVAGE_SHARE
  (40%) of her hull in a store's work, at least one: a sloop 2, a brig or a cutter 4, a flagship 6 - into the hold as a
  cask's things go (a swimmer's into the boat he is alongside, else his pack a store at a time, what it cannot carry
  said: AUDIT R5, R6), and her powder as SALVAGE_BARRELS (2) fire barrels for a stern that rolls them, never past
  BARREL.stock. KEEP-PLUNDER stows the player's own before the sea goes. Online, the wreckage rides the word on a key
  of its own (`w`: an older build reads none of it, where a lot past its LOT_KEYS would fail its door and the word with
  it), and is claimed as a cask is; a ship an older build stands leaves none (AUDIT O2).
- **The bar** (`test/auditnav2_captains.test.js` F25). Its eight duels re-rolled with the toughness. Over 32 duels each,
  the cutter on the sloop went 20-12 before and 16-16 after (the model 0.95), the war galley on the corsair galley 26-6
  and 30-2 (1.18), the war galley on the brig 21-11 and 20-12 (0.89). The time the duels are given goes up by the
  toughness, and a pairing within COIN_TOSS (1.1) of even is a coin toss - it fails at seven of eight, not six (AUDIT
  T1). The galley's station outside her great guns' dead zone, which the duels pinned only by a stall none of the
  eight now makes, is pinned at its source (F24, a Large Boat lying still).

## The tests

One suite a slice - `test/nav_a_guns.test.js` (the flight, the aim, the volley, the reload, a ball's hurt, a ship's
life, the shot field), `nav_b_picture` (the effects, the pass on a recording GL, the deck fires, the colours),
`nav_c_ships` (the classes, names and crowns, the captains, the traffic), `nav_d_boarding` (the muster, the berth, the
reckoning, the raids' win, the hold, the choice, the law, notoriety, THE GATE, one raid at a time), `nav_e_sounds` (the nine files, the
bake regenerated byte for byte, the ranges, the one registration), `nav_f_ui` (the readout's words and node, the kit's
cut, the plunder window driven on the suite's DOM, its door, the card's place, a finger's screen), `nav_g_online` (the word, its door, the blow frame, the
helm boats, the doors) and `nav_h_host` (the host through real frames over Come Sail Away's real pool - the guns, the
traffic, the law, boarding, boarders and Warm Ashes' raids, the voyage's wait, the save, the stander and the striker -
and the world host's wiring, a hostile ship an enemy nearby at its five doors) - and `nav_r_raiders` (Warm Ashes'
raiders as ships: the class law, the plan, a raider stood, sighting and spent, the director and a peer's copy, the world
host's wiring, and the merge with OW6 - a peer's hold, the held ships said, the spend said and owed, the sea's
hostile ships as a journey's threats and the map, run through the world host's own lifted code; the governor's own
run in `ow6_slowdown`) - and the audit's own suites: `navaudit_captains` (the way, the turn and the heel, the wind's eye, other
hulls and the land, the intercept, the side that bears soonest, giving up, alongside to board, the wreck, the cruise,
a prize adrift, the berths, the hulls kept apart, a galley's ram, the sea's time, a boarder chasing, her sweeps) and
`seapeace` (SEA-PEACE: aboard or not, the tempers, the power, the odds, the host's sizing, a wary pirate's flight, the
stern chase, a prize taken and cast off, the guns heard, the director's pairs, the host standing a pair) and
`navaudit_guns` (the run-out and its promise, the fire's window, never over her nor short, no friend across the line,
the lay, station alongside, the helm's lead, the prize kept a prize, no feud from a stray, fire, the rig, the shots'
own, the guns' reach, the warning, the tell heard and seen, the tally) and `navaudit_helm` (the look's reach, a look
on a ship, the red where the balls strike her as she will stand, why the guns will not fire yet, the aim drawn, the
broadside camera, the world's wiring) and `navaudit_boarding` (the raids' names and their retreat, the real parser in
the sea's region and a crown's, the world host's pin and endRaid and stand-down run, a crewed boat's hands, the win
polled, the cast-off, the surrender, the fire's finish, the founder, no save mid-fight, the helm on return, the dealt
deck, the fight's card, the prize's papers, the minors) and `navaudit_presentation` (going down - every hull under,
her list and trim, her spars as they stand, a peer's sinking on their own clock and let go of, her fires to the
waterline, her colours; the mix, a hit that registers, the ready, her bar's loss, her colours by her state and the
Carrack's; the plate's place, the card's column, the draw by the screen, the places written, the Brace's press, the
centre column's sheet, the pad at the guns, the skins and the words; the arcs as lines, the far ships' cost, the
ships' tags, the lookout, the tags drawn, her list and canvas, her smoke and planks, and her groan going down), on the
shared sea of `test/navalSea.mjs` - and `navaudit_online` (the claim, the sea handed on, a quiet stander, boarding
another's ship in one world, no twins, one number and one name, a ship between words, two standers meeting, a raider
taken over, each player's own law, a pirate's barrel and ball at another's boat, another's wreck boarded through the
grapple's word, a volley heard late and a late ball's arc, the word after the world moved, one sea's traffic, a
peer's volleys bounded, a sunk ship's casks every player's and a cask's claim held to its end) over several players'
seas in the room of `test/navalRoom.mjs` - and `navaudit_frame` (a mover's bucket and the world's up through its turn,
a ship's ray bounds first to the bit - a stretching chain's box too - a mesh's triangles filed where they stand, the
index and the kept matrices, the world's sync carrying her buckets and baking a new shape, the boats culled and their
still parts one mesh at her hull's matrix, the effects on one sheet, what goes first past the budget, the sea's word
once a tick).
Mutants: `tools/mutants/nav_a.json` to `nav_h.json`, `nav_r.json`, `navaudit_captains.json`, `navaudit_guns.json`,
`navaudit_helm.json`, `navaudit_boarding.json`, `navaudit_presentation.json`, `navaudit_online.json` and
`navaudit_frame.json`, 852 records, every one dead (149 at the arc's close; 23 more at the merge with main - the
card's place and the finger's screen, one raid at a time, a hostile ship an enemy nearby, a peer's way read off its
word; 21 with NAV-R; 54 with the audit's captains, and eight of the arc's own re-aimed by content at the laws the
rebuilt captains keep; 60 with the audit's guns, and eight more re-aimed at the laws the guns keep; 131 with the
audit's helm, and seven of other suites' re-aimed by content at the laws the helm keeps; 14 with the merge with
main's OW6, and eight of the arc's own re-aimed by content at the lines the merge rewrote; 56 with the audit's
boarding, and NAV-R's sheer-off and NAV-F's card foot re-aimed at the lines the boarding rewrote; 27 with the
audit's presentation, going down; 32 with its feedback, and NAV-H's reload record re-aimed at the line the kick
left; 41 with its layout and words, and five of the arc's own - the card under the panel, the panel read with no card,
the plate over the presses, the finger's root, the warning - re-aimed by content at the lines the layout rewrote; 61
with the sea at a glance, whose one survivor was a lookout test whose nearer ship was also the first seen, and six of
the arc's own - the flat quad, the quad's u, the build, the last frame's hulls, the ram before the poses, the card's own
key - re-aimed by content at the lines it rewrote, two more made single again by the code: the tag's words the card's,
the spars' measure one helper's; 10 with a boarding pirate's sweeps, whose two survivors named a test that never
checked her sweeps' way at the berth nor her head into the wind's eye, and the captains' turn-cost record re-aimed at
the line the sweeps split; 28 with the online slice's handover, whose three survivors named what no test checked - a
player not standing the sea launching into a short one, the director's own law that another's ship is never its to
let go, a yielded raider still mine to spend - and fourteen of the arc's own re-aimed at the lines it rewrote, three
retired with the laws they checked: the board claims' door, the claim's mark, and the first of two holders a raider
now has one of; 52 with each player's own law online, a pirate's barrel and ball at another's boat, and another's
wreck boarded through the grapple's word, and four of the arc's own - her own planking, the crown asked, the zones'
codes, a peer's blow - re-aimed by content at the lines it rewrote; 50 with the wire's reliability - the blows through
the retry queue, a volley's age and a late ball's arc, the casks every player's, one sea's traffic, a peer's volleys
bounded - whose one survivor named a test whose owner's word was never empty straight from its casks, and ten of the
arc's own re-aimed by content at the lines it rewrote; 46 with the frame's cost, whose three survivors named what no
test checked - a stretching link's reach (a hull's trigger boxes stand in a band past what the links' lengths reach,
and no ray asked of the hulls crossed it), a box resized (no hull ships a solid box: the test's case never ran), the
batch drawn at its first part's matrix (every hull's own mesh is her first part) - and five of the arc's own (the
budget's cut, the quad's cap and its v, the aim's post, the arcs' run) with thirteen of other suites' re-aimed by
content at the lines it rewrote);
the first run's four survivors each named a test that was not checking its law (two hulls in one sweep, a moored boat
once built, a stale owner masking the sink window, the sea off the player's shore), and each test was mended.
AUDIT NAV2's own suites - `test/auditnav2_online.test.js`, `auditnav2_boarding`, `auditnav2_captains`,
`auditnav2_helm`, `auditnav2_combat`, `auditnav2_deck` and `auditnav2_crew` - and their mutant lists
(`tools/mutants/auditnav2_*.json`) are the audit's record's (`01-Overview/Audit-NAV2.md`).
SHIPS OF THE BAY's (2026-10-02) - `test/shipnames.test.js`, `shipstance`, `shipfade`, `sealanes` - and their lists
(`tools/mutants/shipnames.json`, `shipstance.json`, `shipfade.json`, `sealanes.json`) are recorded in its section above;
AUDIT BAY's - `test/auditbay_lanes.test.js`, `auditbay_render` and `tools/mutants/auditbay.json` - are the audit's
record's (`01-Overview/Audit-Ships-of-the-Bay.md`).

## THE MERGE with main (2026-09-28)

Main had moved on under the arc - Come Sail Away's CSA-K (sailing together) and CSA-L (the helm on screen), the
Overworld's sea (OWS1-OWS3), the raids (RAID1-RAID4), the 3D dungeon map, the gate's work - and the merge carried both
sides whole. What each met of the other, and what was decided:

- **A peer's way** (CSA-K): the boat at the helm says its velocity on the wire now (`sa`'s `m`), so the sea's contacts
  are led by that word instead of a way measured off the eased places (Online, above). The measure, its settling rate
  and the snap it threw away are gone with the need for them.
- **The collider** (CSA-K): the deck of another player's boat I stand aboard joins MY boats and the sea's ships near
  enough to board (`csaSyncColliders`), and nothing else of a peer's stands in it (PR-WAGON1).
- **The foes frame**: my boats' word, my place aboard another's (`ab`), the Overworld's bands' (`bd`, TV7b - taken in
  by the second merge of main the same day, with TV6-TV8), the sea's word (`nv`) and the raids' (`rk`) ride one frame,
  each changed word asking for it.
- **The top of the screen** (CSA-L): the helm panel and the target card both stand under the compass - the card under
  the panel's foot while it stands (The UI, above); and on a phone the plate stands over the touch corner.
- **One raid at a time** (OWS3): above, in Boarding.
- **An enemy nearby** (OWS2): a journey across the sea stops for a hostile ship (above).
- OPEN: main's Overworld raiders are Warm Ashes' own raid seen coming - on the Overworld they are marks, and in play
  their hull is not drawn (a ship's length off, `seaRaiders.js` RAIDER_CONTACT_PLAY_M) before the mod's raid boards the
  player's ship. The sea's pirates are drawn ships on Come Sail Away's hulls. FOLD: an Overworld raider that closes
  in play could be stood as one of the sea's pirates (seeded from its cell, so every player still meets the same
  sail), her boarding the raid - one pirate of the Bay, seen from the map and met at the rail.

## Not seen

Not seen on a GPU in this session: the pass, the flags' colours and the deck fires are verified by their pins and by
the Node harness, not by eye. The aim's arcs as lines (AUDIT NAV1, #4) were drawn by the pass itself in headless
Chromium's SwiftShader - WebGL2 in software - and read off its pixels; the tags' layer was laid in the same browser.
