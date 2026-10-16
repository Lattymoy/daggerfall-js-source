# FIELD BUGS 2026-09-28 (f) - DISC29: ten screenshots, eight reports

(Written as page (d) on PR 418's branch; main's own 28d page - TRAVEL-X1 and the Overworld's keys - took the name first,
and its 28e the next, so this batch is (f) since the merge of #428-#432.)

From the Discord, through Mac: ten screenshots and no words, the rule for a batch like it - every report root-caused
on the real modules (and the real ARENA2 where the report lives in the data), the port's own faults fixed and pinned,
and what is Daggerfall's or a mod's own said plainly, with what would change it left to Mac.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| A | the throne puzzle's switch never activates when walked on | Skibbster | the walk-on pass read the object's BOX top, not its surface | fixed |
| B | a coloured-tier "iron" helmet refused for a class forbidden leather | Julian | the refusal is Roleplay & Realism: Items' design; the rarity name dropped its "Brigandine" | fixed (the name) |
| C | Climates & Calories: fatigue never below 1%, and drains in ~20 min standing still | lumin | Roleplay & Realism's overload round, the mod's own arithmetic | Mac's call |
| D | a dungeon at 99.9% CPU, 68-203 ms frames, DOM nodes climbing past 3,000 | Skeptikali | eight DOM faces rebuilt every slow frame by wall-clock watchdogs | the climb fixed |
| E | interior lights flicker; shadows cast through walls (the Mages Guild) | Kristian B | a flat's shadow faced the lamp from the world's origin; an idler cast only into the eight nearest lamps | fixed (a carried light's glow through walls recorded) |
| F | the gallop keeps looping inside a building entered while riding | Skibbster | a mode change never stopped the riding channel | fixed |
| G | ~4 swings a second at "Speed 55", faster as a wolf, online | Lynk | DISC28-D gave the swing the live Speed, and DFU's line is a hyperbola: 4 a second at the cap, where a werewolf's +40 lands | fixed (SWING-LAW, the port's own swing law) |
| H | Mages Guild membership lost mid guard-quest; the quest won't complete | Triage | the quest script's own penalty; Info mode could spring it | the port's part fixed |

## DISC29-A: a Collision01 object is stood on wherever its own surface is (Skibbster)

**Reproduced first**, on the real BLOCKS.BSA through the port's own layout, collider, motor and action system:
N0000037's two thrones (objects 22908 and 22979, model 41123) are CastSpell effects with the Collision01 trigger -
WalkOn only - chained to a tapestry (23098, a 1.6 m Translation) that stands over a Collision03 teleporter brick. A
motor walked onto the seat logged `WalkInto refused` eighteen times; the tapestry never moved.

**Why.** DaggerfallActionCollision (:68-85) calls a contact WalkOn when it is beneath the player, and on a Collision01
object also when "a ray straight down from the controller's bottom, skinWidth long" hits the object's own collider.
The port's pass read "beneath" as the top of the object's box (within 0.15 of the feet) and folded the ray into it "at
our capsule scale". A throne's box tops its backrest at 34.08; the seat is at 32.55.

**The fix** (`world/actionSystem.js standsOnAction`, `ownSurfaceUnderFeet`): the box's top, or - Collision01 alone -
the object's own surface within Unity's 0.08 skin under the feet. A mover or a door is its own bucket already; an
effect or relay is in the shared `'dungeon'` bucket, so the dungeon host keeps a copy of a Collision01 one's triangles
in a probe-only collider nothing moves against (`triggerSurfaces`). With it the whole puzzle ran on the real data:
WalkOn on the seat, the spell (record 17) cast, the tapestry aside, the brick walked into and the teleport taken.
Measured over BLOCKS.BSA: 49 of the 104 Collision01 objects had no upward face within the old band and 12 only some -
Activate relays, DoorText plaques, Hurt23/Hurt24 rooms, CastSpell rooms - and each now fires as DFU's does, which
players will notice. Every other flag keeps the box's top (they admit no WalkOn: the arm only decides a refusal).
`03-World/Player-Arc.md` DISC29-A.

**AUDIT PRE-MERGE 0929 D1/D2** (`Audit-PreMerge-0929.md`). The fix read DFU half-way. WalkOn is the contact's DIRECTION
from the controller's centre (`dir.y < -0.9`, :68-71) for EVERY flag, and the ray is only Collision01's second test: the
box's top and a ray under the capsule's centre missed a staircase, where a body rides the treads' edges (N0000007's
Hurt22 staircase, in 69 dungeons, bit 2 times walking all sixteen steps down, 4 up), and a MultiTrigger floor stood on
was WalkInto, and fired - Orsinium's castle floor (S0000020 object 10406, a DoorText with a trespass on it) turned the
castle hostile at the first steps across it, pre-existing and kept by the fix above. The pass is OnCharacterCollided
whole now (`world/actionSystem.js actionContact`, on the collider's own contact, `player/collider.js capsuleContact`):
beneath is WalkOn for every flag, a Collision01 casts its ray, else WalkInto, and a side is heard only while the body
moves into it. Every collision-trigger model's triangles are in `triggerSurfaces`. Over BLOCKS.BSA's 1,546 resting
spots the port agrees with DFU on 1,537 (983 before); the staircase bites 9 times down, 13 up.

## DISC29-B: a rarity name keeps the word the mint wrote (Julian)

**What the report is.** A light-set piece of Roleplay & Realism: Items in a plate material is BRIGANDINE, and the
class's NativeMaterialValue takes 0x0200 off "so DFU treats this item as leather for forbidden checks" - the refusal is
the mod's design, and the port's forbid check reads it correctly (`equip.js isForbiddenEquip`, AUDIT-RR F7). The port's
fault was the name: the mint named the piece "Brigandine Helmet", and the Loot Rarity ladder built "Sentinel's Helmet
of the Bear" again from the bare template - the list read "Iron Sentinel's Helmet".

**The fix.** One rule per armour class for its word (`rriItems.js lightWord`, `mailWord`, `rriVariantWord` - Fur read
before the fold or after it), which `rarityName` puts before the template's name; a save's Magic and Rare names are
given it back on load (`repairRarityNames`: only a name that is the old bare build moves). And the same class value,
read by two other mods: Immersive Footsteps and Better Ambience read `NativeMaterialValue` - the property the mod
overrides - where the port read the raw material, so brigandine boots walked in plate and a mail hauberk clanked as
plate. Both read `rriNativeMaterialValue` now. `06-Systems/Roleplay-Realism-Items.md` DISC29-B.

**AUDIT PRE-MERGE 0929 D3.** The load's repair (and DISC21-A's beside it) walked the pack, the wagon and the
repairer's alone; a piece kept in a house chest, a dropped pile, a dead foe's pack or a boat's hold kept the name its
make had lost, and kept it once carried out. Both repairs walk every list of the character's own things the save
carries now (`net/realm/realmGoldLaw.js stashedItemLists`, customs' own walk), in the save before the scene cache, the world
and the mods' data are restored from it.

## DISC29-C: fatigue at 1% is Roleplay & Realism's own round (lumin) - Mac's call

Traced through the port's own ticker, survival minutes and the world host's collapse, with a 67/63 body (a pool of
8,320). Neither symptom is Climates & Calories' - its needs drain far less than the mod's own (`needs.js`), each minute
is charged once, and the tier is honoured.

- **"Drains very fast, about 20 minutes standing still."** Roleplay & Realism's encumbrance round charges fatigue for a
  load over 75% of the ceiling, moving or not (RoleplayRealism.cs:581-600, no standing-still gate): at 92% about 26 raw
  a game minute after BALANCE1's 0.75, beside the minute's own 8 (DFU's 11 at the same scale). The Climates & Calories kit is 12.5 kg of that load, and
  hunted meat goes into the pack. With 80 kg and the kit the bar met its floor in 20.7 real minutes standing still.
- **"Never lowers past 1%."** The same round's cost is `Mathf.Min(CurrentFatigue - 100, encOver * 100)`
  (RoleplayRealism.cs:595) - negative below 100 raw, and `DecreaseFatigue` of a negative REFILLS: each round puts the
  bar back to 100 raw, 1.2% of the pool, which the HUD prints as 1%. The collapse at 0 never comes. It is the mod's own
  arithmetic, ported and pinned as such (`test/systems/rr1_realism.test.js`), and DFU with the mod shows the same floor.

What would change it is Mac's: a departure from the mod (the round never refills - then the overload runs the bar to 0
and the exhaustion collapse, which kills with foes near, returns every few minutes of carrying too much), a gentler
overload scale, a lighter kit (the 3 kg Campfire Kit is the port's own item), or an "Overloaded" chip on the status
strip so a player can see where the drain comes from. The report (09-26) predates BALANCE1's scale and ENC-CEIL.

## DISC29-D: a draw's watchdog counts frames, not milliseconds (Skeptikali)

**The climb, reproduced** in the real game at a slowed frame rate: the notice stack added and removed sixty times in
sixty frames, the tutorial's Yes/No shell fifty-three; the nodes are collectable garbage, reclaimed by a forced GC.
Eight per-frame DOM faces (the notice stack, the dialog and choice menu, the picker, a ported window, the input box, the
Yes/No card, the world plaque, the death layer) re-armed a 150-400 ms wall-clock timer per draw and took themselves down
when it fired - so a frame slower than the timer tore the face down and built it again every frame. `ui/drawWatchdog.js`
releases a face only when an animation frame came and went without its draw (its own ticker, running only while a face
is armed), or when no frame at all has come for 3 s. All eight read it.

**The CPU** has no single bad call: 15-30 ms of frame script on a desktop CPU, 62-183 ms walking with the CPU slowed
four times - the reported band - spent in the foes' motors and senses, the player's motor and collider, and the
collector. A slow frame costs more (a 0.1 s cap on a fixed 1/60 s step is six physics steps). The FPS counter could
not tell whose the frame was indoors: the indoor foot closed its token unsampled. It takes its sample now, so the
counter's script time reads in dungeons and interiors - the number to ask the next report for, beside whether the
desktop app is on the GPU. `10-UI/UI-Arc.md` DISC29-D.

## DISC29-E: a lamp's shadow of a flat faces it from the flat, and an idler casts into every lamp (Kristian B)

**Reproduced** on the real renderer over a real Mages Guild (MAGEAA00, and Daggerfall's MAGEAA08) with the view held
and one input moved at a time. Moving only the eye the shadow pass ranks its lamps by, the brazier by the smith left
the eight nearest - and 20.5% of the screen changed by 12 or more levels, the smith's whole sprite 29% darker.

**Why.** Two faults compounded, both largest in a Mages Guild (ten people a hall, nearly half idling, fourteen floor
braziers each; a tavern has six people and one idler in thirty):
- A lamp turned every flat to face it with one `right` a batch, from the batch's origin - and every interior flat has
  its centre baked into its vertices and no origin, so each card faced the lamp from the world's origin, often
  edge-on, and shadowed its own base: the sprite went dark for that lamp.
- An idling flat is a mover (its frame changes), and movers cast only into the eight 512 maps nearest the eye. As the
  view turned, a lamp left the eight and the idler's shadow went with it - once the facing is right, it is the
  silhouette on the wall that popped (12.5% of the screen).
- And the player's own card cast into the two lamps nearest the eye, which in third person circles the player.

**The fix.** Each flat faces the lamp from its own centre, in the vertex shader (`uFacePoint`); an idler whose place
is still is kept by the lo tier - the lamp outside the eight still has its shadow, at the frame its map was drawn,
and an idle is never a rebuild; the player's card casts into the two lamps nearest the card. "Through walls": the
maps do not leak (0.05% of the lit energy reached an occluded surface, emulated against ray-cast truth, and nothing
crossed a wall in the browser). What does light through a wall is a CARRIED light - a torch, a lantern, a Light
spell, a peer's - which has no shadow map: a map redrawn every frame for it is a cost left to Mac.
`07-Rendering/Enhanced-Lighting-Arc.md` DISC29-E.

**AUDIT PRE-MERGE 0929 E1-E3.** "An idler whose place is still" was every flat an origin places, the moment it stood -
a dungeon foe, a peer, the Warden - and the lo tier rebuilds two faces a frame, so each time one walked on the lamps
outside the eight kept its silhouette where it had stood (a ghost on 4.7% of a fight's frames under fourteen lamps, 49%
under thirty with six), and every stop and start rebuilt every lo map in its reach. Only a flat that cannot walk - its
centre in its vertices, no origin - is in place now (E1). The player's card is noted as it is recorded, not found by a
walk of every batch (E2), and its two lamps are the two casting lights nearest the CARD, made casters in place of the
eye's farthest picks (E3): ranked among the eight nearest the eye, a camera pulled back left them out.

## DISC29-F: a mode change stops the riding loop, as UpdateMode does (Skibbster)

**Reproduced** on the real worldModes with a real Mages Guild interior: a gallop, a door, the mode Foot - and the loop
still playing inside, zero rig frames having run between the dismount and the interior. The riding sound is one
channel that re-arms at each clip's end, and only the rig's frame ever stopped it; the door's dismount goes through
`mountRig.setMode`, which never did, and the indoor frame returns before the rig. DFU's UpdateMode stops the source
first on every change (TransportManager.cs:332-336); `setMode` does now - doors, teleports into an interior, a
quickload indoors, the ship, the deep-water dismount, a horse swapped for the cart. The fixed-city host never handed
worldModes its dismount seam at all (a rider stayed mounted through a door); it does. `06-Systems/Systems-Arc.md`
DISC29-F.

## DISC29-G: four swings a second, and the swing law that replaces DFU's line (Lynk; SWING-LAW)

**What changed.** DISC28-D (861462d2, merged in #420 the same morning) gave the rig the player's LIVE Speed: until
then the first-person weapon was built with no Speed and every player swung at the number 50 - about a second a blow,
whatever the character. DFU's line, `3 * (115 - LiveSpeed) / 980` a frame and five frames a blow, is a hyperbola in the
rate: a second a blow at 50, 1.6 a second at 75, 3.3 at 95, four at the cap. Lynk is a lycanthrope: the curse adds 40
Speed in both forms every magic round (LycanthropyEffect.ApplyLycanthropeAdvantages), so a base of 55 swings at live 95
and anything from 60 sits on the cap. This record first called that DFU's own rate and pinned it; Mac: "swing speed is
insane", and then "Do whatever is the most detailed. I dont care about departure, especially if we can do it better".

**The fix (SWING-LAW, a declared departure - Ledger A).** The player's swing is the port's own law
(`characters/weaponStates.js`): DFU's frame at Speed 50, times a TEMPO that runs straight through Speed (1.4 at 0, 1 at
50, 0.6 at 100 - the fastest character swings 1.67 times as often as the average, where DFU's line gives four), times
the HEFT of the weapon's base weight against the arm's Strength, times the HANDLING of its kind (quick daggers, fists and
claws; slower maces, flails, axes and warhammers; both hands a little slower), held to 0.45-2 s a blow. The weapon is read
off the equip table (`combat/swingLaw.js`); Roleplay & Realism's weaponSpeed and Items' weaponBalance keep their own
weight-and-Strength arithmetic as the Speed the swing is read at and answer through the same curve and handling
(AUDIT PRE-MERGE 0929 S3: Roleplay & Realism's blend has no weight in it, and takes the port's heft; S1: the body swings
once a blow - the report's werewolf clawed two and three times a blow in third person; S5, S6: the reader is registered
as its module loads, and reads without writing). A foe's
machine, a peer's walker and the viewers keep DFU's line (DFU never asks it for a foe at all). Measured on the real rig
at the mods' defaults: an average fighter's longsword 1.08 s a blow; live Speed 95 with a dagger - this report's
werewolf - 1.71 a second (DFU's line: 3.3); nothing past two a second at the cap, mods on or off. Pins
`test/systems/swinglaw.test.js` (7) and `test/systems/disc29_swing.test.js` (2); `tools/mutants/swinglaw.json` (23, all dead).
`05-Combat/Combat.md` SWING-LAW.

## DISC29-H: the Mages Guild's own trap, and a way into it DFU does not have (Triage)

The quest is N0B20Y02, "Protect an Honored Mage". A click on the sleeping mage is `_S.04_` (-10 and a shielded hostile
Mage - him) and that Mage's death is `_S.07_` (-50 and the Knight, Battle-mage and Assassin waves - the "raiding mages
and knights"), so the next visit expels (TEXT.RSC 668) and JOIN reads 612, the record for a negative reputation. The
raiders' deaths change no reputation; success needs `not _S.04_`, so the only ending left is the failure seven days on.
It is the same trap KimNix met (`Field-Bugs-2026-09-26b.md` DEAD-CLOCK), and DFU springs it the same way.

The port's part: DFU clicks a quest stand only in Grab, Talk and Steal - Info is "You see <name>" and nothing else
(PlayerActivate.cs:334-338, :753-757) - and the port clicked it in every mode, so a LOOK in Info sprang the trap. Fixed.
Not changed, and Mac's: in a party, a partner's kill of a shared quest's foe is credited to every member's copy, so
`_S.07_`'s -50 also lands on a member who never touched the mage - the same credit that carries an ordinary
summon-and-kill quest forward for the party. `06-Systems/Quest-Arc.md` DISC29-H.

**For Triage:** the quest ends by itself about seven game days after the kill; to rejoin, the guild's non-member jobs
(GET QUEST) raise the reputation +5 a success until it is 0 or more, and JOIN takes it at rank 0.

## Record

`test/world/disc29_throne.test.js` (5, one on the real N0000037), `test/systems/disc29_rarity.test.js` (6),
`test/ui/enhanced/disc29_watchdog.test.js` (5), `test/systems/disc29_gallop.test.js` (4), `test/player/disc29_questinfo.test.js` (3),
`test/systems/disc29_swing.test.js` (2), `test/render/disc29_lamps.test.js` (4, 5 since AUDIT PRE-MERGE 0929 E3); one test added to
`test/systems/if1_immersivefootsteps.test.js`. E: DISC24-C's walk re-aimed (the card walks with the eye), the SC1 and WEEDS1
source pins, and seven older mutant records (auditlight, auditreach 2, el8, perfexta, perfextb, weeds1) re-aimed by
content; its two batch fields born with the batch (PERF-EXT10, `render/contract.js`; `test/systems/save/hard3_types.test.js`
counts 40 - 39 since AUDIT PRE-MERGE 0929 E1 retired `_shPlacedAt`); `test/render/el2_shadows.test.js`'s point guard pinned by `pointShadowAt`'s own head, its record aimed at one
site and off `test/tooling/mutantdrift.test.js`'s CARRIED_AIM. Re-aimed to the new laws:
`test/ui/enhancedNotice.test.js`, `test/systems/worldhover.test.js`, `test/ui/uxb1m_privateproperty.test.js`,
`test/systems/resourcesafety.test.js`, `test/render/auditretro1.test.js`, `test/scenes/dungeonquestclick.test.js`.
`tools/mutants/disc29.json` (45, all dead); `tools/mutants/ba1.json` and `tools/mutants/worldhover.json` re-aimed by
content. The committed mutants on every file this batch changed were re-run: 378 (B's files), 367 (A's), 77 (D's
faces), F's and 560 (E's render files) - all dead, the eight already recorded as equivalent standing (four of them
E's). Cites: `tools/citeShift.mjs` moved 194
into the files this batch shifted, and 38 more into E's render files; the 13 it leaves by design - struck Ledger and Settings rows the citedrift gates
(CD4, CD8) resolve by content, and a continuation on the line below its file's name (`chargenSession.js`'s `(:N)`) -
were mapped through the same diff with the base line's text checked against the tree's. `bible/10-UI/UI.md` counts 241
modules; `test/systems/audit26_talk.test.js` counts the seventh static-NPC name site (the Info look).
