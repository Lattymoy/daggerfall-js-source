# Weapon Techniques - the key a weapon answers (TECH1)

`src/combat/techniqueRoster.js` (the roster, a leaf) + `src/combat/techniques.js` (the runner) +
`src/combat/techniqueBlow.js` (the blow, a leaf) + the line in `src/systems/lootRarity.js` (`AFFIX_KINDS.technique`)
(the owner, 2026-10-10)

> "I want to talk about implementing detailed weapon skill affixes for each weapon type. For example, a bow could
> roll with an attack that allows you to aim and place a telegraph that shoots a volley of arrows, or a sword attack
> that allows you to leap and attack your opponent, etc. This would have its own keybinding. What do you think?"

> "This is your baby. I want you to be as detailed as possible and take your time. No exceptions"

**Daggerfall has no such thing.** A DFU weapon swings, and a bow looses; there is no second verb on a weapon and no key
for one. Everything on this page is the port's own, a declared departure (Ledger A, TECH1), and it hangs off the loot
ladder's one switch, so a player who turns the ladder off plays DFU's combat exactly.

## What it is

A weapon - or a pair of Gauntlets, for the bare-handed - can be found carrying a **technique**: one line on the item,
like every rolled line, naming one of twelve techniques its weapon family may know. Pressing the **Weapon technique**
key (the mouse's back side button by default) with that weapon in hand does it: a Volley of arrows falling on a disc
you aim, a Leap Strike onto the foe you look at, a dash behind a foe's back, a Whirlwind that strikes all around you.
Each has a fatigue price and a cooldown, each is a real blow resolved by DFU's own damage formula, and each goes
through the doors a swing or a shot already goes through, in every host.

## The laws

1. **The formula decides.** A technique never deals a flat number. What it deals is a MULTIPLIER on DFU's own
   CalculateAttackDamage for the weapon in hand - the skill, the material, the to-hit roll against the foe's armour, a
   backstab, the Physical Combat overhaul's model when it is on, every power and line the weapon already carries. A
   miss is still a miss; the technique's own `toHit` term is a committed blow's edge, never a guarantee.
2. **One runner, every host.** The four hosts that own a motor each build a weapon rig, and the rig steps the one runner
   (`combat/techniques.js` `stepTechnique`) ahead of its gesture; no host grows a second performer of any part of it
   (THE FOUR HOSTS RULE, below).
3. **Never at a player.** A technique meets no player's body: a swing's blow takes the plain swing's test and number on
   one, and a technique's shaft passes one by (`techniqueBlow.js` `playerBody` - a body marked `duel`, a duel's, a
   siege's or the open zone's, or an arena rival's stand-in, `rival`). And in a duel or a bout between players
   (`sigilDueling()`) the key says so and does nothing - every power that sleeps in a duel sleeps.
4. **A line, not a class.** A technique is found, never chosen or trained: it is rolled by the loot ladder at a door's
   END (Loot-II law 9 - every draw a door already made is still its seed's), reforged and honed like every line, and
   judged by the item law. Shops and quest rewards do not roll one (Loot-II law 2).
5. **Off is DFU exactly** (Loot-II law 6). With the ladder off nothing rolls one, and a found line sleeps: the key says
   "Weapon techniques need the loot ladder, which is off." rather than doing nothing silently (Loot-II law 8, no dead
   lines).
6. **Nothing it moves outruns the referee.** A leap or a dash flies at most `TECHNIQUE_MAX_SPEED` (16 m/s) along the
   ground; a refereed room clips a body's step at 18 m/s (`net/siegeRef.js`). A Volley's six shafts fall over 0.85 s,
   under the relay's ten hits a second on a puppet (`HIT_HZ_MAX`).
7. **Paid like a swing.** Fatigue through the host's own drain (its exhaustion law with it), arrows through
   `spendAmmoFor` - one a shaft - and the skill through `tallySwingSkills`, a tally a shaft; then the cooldown, in
   seconds of play.

## The roster

`combat/techniqueRoster.js` `TECHNIQUES` - the one table. The multiplier is `base`, raised by the line's value:
`base * (1 + value/100)` (`techniqueMult`). `strike` is the screen weapon's state the swing plays, the one DFU's
CalculateSwingModifiers reads (`combat/playerWeapon.js` `SWING_MODS`) - so a StrikeDown's +4 damage and -10 to hit ride
a technique as they ride a click.

| technique | family | does | x | to hit | fatigue | cooldown |
| --- | --- | --- | --- | --- | --- | --- |
| **Volley** | bows | aim a disc 6-28 m off; the bow looses and 6 real arrows fall on 3.5 m from above, 0.55 s after, over 0.85 s | 0.5 each | (the shot's) | 6 | 16 s |
| **Piercing Shot** | bows, the Thunderlock | aim a lane; one shot at 1.6x speed through up to 5 foes, each struck once | 1.2 | (the shot's) | 4 | 10 s |
| **Leap Strike** | long blades | aim a foe (or the ground) 3-9 m off; leap onto it, StrikeDown on every foe within 2.5 m of the landing | 1.4 | +20 | 5 | 12 s |
| **Whirlwind** | long blades | StrikeLeft on every foe within 3 m, all round | 1.0 | +15 | 5 | 10 s |
| **Shadowstep** | short blades | aim a foe 2-8 m off; a low dash behind it (or beside it, or in front, the first spot the walls allow), turn on it, StrikeRight within 2.2 m | 1.2 | +20 | 4 | 9 s |
| **Lunge** | short blades | a low dash 5 m along the look, StrikeDown on every foe in the 1.8 m lane it passed | 1.1 | +15 | 4 | 8 s |
| **Cleave** | axes | StrikeRight on every foe within 3.2 m in an 80-degree half-arc about the look | 1.2 | +15 | 5 | 9 s |
| **Headsman's Chop** | axes | StrikeDown in DFU's own view, +100% more on a foe as it is wounded (x1.2 at full health, x2.2 at none) | 1.2 | +20 | 5 | 11 s |
| **Ground Slam** | blunt | StrikeDown on every foe within 3.5 m, all round | 0.9 | +15 | 6 | 12 s |
| **Skull Crack** | blunt | StrikeDown on the nearest foe in view within 2.5 m alone | 1.6 | +30 | 5 | 10 s |
| **Flying Kick** | bare hands (Gauntlets) | aim a foe (or the ground) 2-6 m off; leap onto it, StrikeDown on every foe within 2 m | 1.3 | +20 | 4 | 10 s |
| **Haymaker** | bare hands (Gauntlets) | StrikeRight on the nearest foe in view within 2.5 m alone | 1.8 | +30 | 4 | 9 s |

**The families are the skill a piece swings with** - DaggerfallUnityItem.GetWeaponSkillUsed, ported as
`characters/weapons.js` `weaponSkillUsed` (`techniqueFamily`). The **Thunderlock** is scored on Archery (its departure,
`Dwarven-Thunderlock.md`) but is a gun with a trigger: it has a family of its own, so it may roll a Piercing Shot and
never a Volley of pellets. **Arrows and every ammunition** take none. The **bare hand** has no item to carry a line, so
its techniques ride DFU's **Gauntlets** (template 103, any material) worn while fighting unarmed - the one piece the
fists are already dressed in. A werebeast's claws answer "The beast knows no technique."

**Fatigue** is in the sheet's points, FATIGUE_MULTIPLIER (64) units each, the units a swing's own drain is billed in;
`techniqueFatigue` never scales it (a technique's price is the price).

## The line

`systems/lootRarity.js` `AFFIX_KINDS.technique`, **appended last** (after `castSpeed`), on **Weapons** and **Armor**
(the Gauntlets alone, by `kindParams`): `{ id: 'technique', param: <technique id>, value: <+N%> }`. It has **no slot**
(it never names a piece) and it is **not among `AFFIX_IDS`**, the kinds the ladder's pools draw from - so the numbers'
pass, the proc line, the Exalted's line, a curse's line and the Reforge's pool are each the pool it was, and every
existing seed draws what it drew. It comes from its own pass alone.

- **The bands** (`TECHNIQUE_BANDS`, one for every technique): Magic **5-15**, Rare **15-30**, Legendary **30-50**.
  A Legendary's line reads the Legendary band whatever its record's own.
- **The chance** (`TECHNIQUE_PER_MILLE`), one roll per piece a door minted: Magic **120** per mille, Rare **300**,
  Legendary **450**. A tier with none costs the stream no draw (the socket pass's own rule). Only the three rolled
  tiers take one (`ROLLED_TIERS`): never a Common, nor a set's Aetheric piece (the Brass of Numidium's, the serpent's),
  nor a Gilded record (the Hourlock).
- **The worth**: 30 gold a point (`AFFIX_WORTH.technique`) - a Rare's +23% is 690.
- **The doors**: `rollLootRarity` (every host's list - a corpse, a pile, a chest, a searchable, World of Daggerfall's
  sites) after its late finds; the corpse kit (`foeLootCap.js` `rollCorpseKit`) after its socket pass; the gate's, the
  Abyss Dungeon's and the serpent's spoils after their card; the raid's after its last pass. Each calls `techniquePass`
  LAST, so a seeded door's earlier draws mint what they did (pinned by running every door with the pass off and on,
  piece for piece).
- **The card** prints the line as `<name> +N%` with its band (`Leap Strike +15% [15-30]`) and, under it, what a press
  does with that line's own numbers (`techniqueBrief`): `Aim: leap 9 m, strike all in 2.5 m, 161%. 5 fatigue, 12s`.
  A Rare is read once it is identified, as DFU reads it; its technique works all the same.
- **The name** never changes: with no slot, `nameAround` never puts it in a piece's name - a `Warrior's Longsword of
  Skill` that takes Leap Strike is still a `Warrior's Longsword of Skill`.
- **Its place** is the piece's last own line, before a set gem's (`addTechniqueLine`); a line added after the mint - an
  Exalted's, a curse's - goes before it (`withLine`).
- **The Reforge** turns a technique only into another of its family's (its pool is the technique alone) and makes
  nothing else one (the pools hold none); the **Hone** walks its value to its band's top; an **Exalted** Legendary's
  own line stays the Reforge's (`reforgeableLines` steps back over a gem's line, then a technique's).
- **The item law** (`systems/itemLaw.js`, `ITEM_LAW_VERSION` 2 - the account service's judge reads the same file, so
  `JUDGE_VERSION` moves with it): at most one technique line, of a technique the piece's family knows, the last of its
  own lines, its value in its tier's band. A Legendary's signature and extra-line counts are taken without it, as the
  proc and numbers counts are.

## The key

`systems/inputActions.js` **`WeaponTechnique`**, appended to `ACTIONS` and `PORT_ACTIONS` (the classic windows yield
it), in the Controls page's **Combat** group as "Weapon technique (hold to aim)".

**The default is `Mouse3`, the mouse's back side button, and only it.** Every letter and digit is already spent
(FREEMOUSE's sweep, run again: Q is DFU's RecastSpell, F the social door, R Rest, G and X the torches', E Interact), and
the free keys by the movement hand are worse than none - Caps Lock toggles on a Mac (a hold to aim is two presses
there) and a held Left Ctrl makes W the browser's close-tab. Mouse4 is TogglePerspective's. The browser's Back on both
side buttons is stopped by every host that reads them (`world.js`, `exterior.js`, `dungeon.js`: `preventDefault` on
`mousedown` and `mouseup` for buttons 3 and 4). A keyboard player rebinds it in the Controls pane (F2 and F4 ship
unbound). The phone has a **Tech** hold button among the touch corner's choices (`ui/touchButtons.js`); a pad has it among
the d-pad's choices (`ui/plusPad.js`) and Enhanced Plus's bind rows (`ui/plusPadBinds.js`).

**A press, a hold, a release.** A technique that aims (Volley, Piercing Shot, Leap Strike, Shadowstep, Lunge, Flying
Kick) shows its mark while the key is held and goes on the release; a tap goes at once at what the look holds. One that
does not aim goes on the press. The interact key (ActivateCenterObject - a drawn bow's own un-draw) sets an aim aside,
and so does a change of weapon, sheathing, a readied spell or a climb.

## The runner

`combat/techniques.js` - **one state, the player's**: the cooldowns, the aim, the act in flight. The rig that owns the
frame steps it; a door crossed mid-aim or mid-leap hands it to another rig, which finds the aim and the act set aside
(its price is paid). So walking through a door neither resets a cooldown nor runs two.

**The order in a frame** (`combat/weaponRig.js`): the runner first, on the swing's own gate (`ready`: not paralyzed,
drawn, `canAttack`, no Morrowind arm mid-loose, a camera with feet), then the gesture - a click's strike and a
technique's are one machine, so whichever starts first holds it - and at the frame's end `claimShot` takes the bow's
hit frame for a technique's loose before the host sees it.

**The refusals**, asked on the press and again on the release (a run may have spent the fatigue, a duel begun):

| in order | says |
| --- | --- |
| a werebeast's claws | The beast knows no technique. |
| no technique in hand | This weapon has no technique. |
| the ladder off | Weapon techniques need the loot ladder, which is off. |
| a duel or a bout between players | Techniques sleep in a duel. |
| sheathed | Draw your weapon first. |
| a technique in flight; mid-swing, a bow's recovery, a spell's hands | (nothing - the hands are busy) |
| cooling down | `<name>` is not ready (Ns). |
| too little fatigue | You are too tired. |
| a shot with no lane in this host / no ammunition | Not here. / You have nothing to shoot. |
| a leap or dash with no motor / climbing, swimming, levitating, slow-falling, riding, knocked down, in the air | Not here. / You cannot leap from here. |
| the aim out of reach, or no foe there | Out of reach. / No foe there. |

When a cooldown runs out with that technique in hand, the message line says "`<name>` is ready again." - the classic HUD
has no chips to say it.

**The acts.** A **swing** sets the technique's blow on the weapon (`PlayerWeapon.techniqueBlow`) and starts the
machine's own strike (`techniqueStrike` - machineAttack, the arm's fpAttack); the blow follows the feet to its hit
frame and goes when the machine is idle again. A **shot** starts the bow's StrikeDown; its hit frame is claimed as the
loose (`claimShot`), and under the Morrowind arm, whose rig holds a bow's hit for the string's release (MW-D42), the act
waits for it (`holding`) rather than giving up at idle - so a held loose can never leak a plain arrow. A **Piercing
Shot** is one shaft along the look, leaving where a plain shot leaves. A **Volley** spends up to six arrows (as many as the quiver gives),
and queues them to fall on the aimed disc from 16 m - or from under the ceiling indoors, at least 1.6 m - spread on a
sunflower's spiral and coming in from the archer's side. A **flight** (leap, dash) launches the motor
(`player/motor.js` `techniqueLaunch`) on a ballistic arc to the aimed point (`launchTo`: a leap's apex 1.6 m, a
Flying Kick's 1.2 m, a dash's 0.25 m, raised until the ground speed is under 16 m/s), and starts the strike so its hit
lands WITH the body - when the time left in the air is the swing's own time to its hit, asked of the machine's
schedule (`blowSchedule`). The collider stops the body; gravity lands it; the fall is a jump's (DFU's fall law measures
the landing). Air control does not steer a technique's flight (`techFlight`). A Shadowstep turns the view on the foe
before its strike (the door's `face`).

**The aim** (`aimFor`): a Volley's disc is where the look meets the ground within 28 m, refused under 6. A Leap Strike or
a Flying Kick lands just in front of the foe under the look (its radius and 0.55 m short), or on the ground where the
look meets it. A Shadowstep tries behind the foe, then each side, then in front - the first spot no wall stands between
and a floor stands under. A Lunge runs to the first wall less 0.6 m. A landing more than 4 m below the feet or 2.5 m
above them is refused - a body leaps down a little and up less.

## The blow

`combat/techniqueBlow.js` - a leaf both the weapon and the arrow read. `PlayerWeapon.resolveHit` - the one melee
resolution every host's hit goes through - asks it, for each foe, in place of the plain swing's reach:

- **reach** (`blowReaches`): a lane's foes are those whose feet are along it and within its half-width plus their own
  radius; 'view' is DFU's own camera-view test within the reach; otherwise the horizontal distance to the body's edge
  within the reach, on a level (2.2 m up or down) or by the eye's own distance, then the arc - all round, or within
  its half-angle of the look (a foe within 0.6 m is always in it).
- **number** (`blowMult`, `scaleBlowDamage`): the rolled damage times the multiplier (plus the wounded share), rounded,
  never under 1 - and a miss (0) or a block stays what it was.
- **to hit**: the technique's term added to the swing's.
- **single**: of every foe it reaches, the nearest alone.

A technique's shaft reads the same leaf at its impact (`combat/arrowFlight.js` `playerArrowHitFoe`), and a piercing
one goes on through (`techniquePierces`), never striking a foe twice; the dungeon's own missile lane does the same
against its foes, its boss, its crystal and its host (`dungeonContext.js`).

## The marks and the chip

**On the ground**, by the foe-telegraph pass (`render/foeTelegraph.js`) in a call of their own right after each host's
foes' (`renderer.drawFoeTelegraphs?.(techniqueMarksNow())` - an empty list draws nothing), in a cool blue (`TECH_COLOR`)
never a foe's orange, red where the aim cannot be reached: the Volley's disc and the leap's landing while aimed, a ring
under the foe a Shadowstep goes behind, the lane a Piercing Shot flies or a Lunge runs; the Volley's disc filling while
its shafts fall; a ring about the feet through a swing that strikes all round. A mark (`technique` on the record) sets
its own quad and numbers over its kind's (`techniqueQuadHalf`, `techniqueUniform`); a foe's wind-up draws exactly as
before, by the same lines.

**On the Enhanced HUD**, a chip after the set powers' (`techniqueHudChips`, handed to the HUD by `world.js` through a
seam of its own, `setHudTechniqueChips`; `TECH_CHIP_COLOUR`):
the technique's name and the seconds left, or the key's name when it is ready. The world host's rig, or the mode's
(an interior's, a dungeon's) when one owns the frame. When the world recentres, the aim, a leap's landing and a
Volley's falling shafts shift with it (`offsetTechniques`, beside the foes' own - AUDIT TACT D3).

## THE FOUR HOSTS

Every host hands its rig the technique's **door** - `{ motor(), fireArrow(from, dir, { sky, technique, speedScale }),
drainFatigue(n), face(point) }` - and draws the marks in its ground pass:

| host | motor | the shaft's lane | fatigue | the view's turn | marks |
| --- | --- | --- | --- | --- | --- |
| `scenes/exterior.js` | its PlayerMotor | `arrows.fire` | `drainExteriorFatigue` | `cam.yaw`, the look filter settled | wired |
| `scenes/world.js` | its PlayerMotor | `arrows.fire` | `drainExteriorFatigue` | `cam.yaw`, the look filter settled | wired |
| `scenes/worldModes.js` (interiors) | the shared motor | `interiorArrows.fire` | `drainInteriorFatigue` | `cam.yaw` | wired (both passes) |
| `scenes/dungeonContext.js` | its outer host's (`worldModes.js`, or `dungeon.js`'s own) | its own missiles (`fireArrow`) | `drainFatigue` | its outer host's | wired (`worldModes.js` and `dungeon.js` draw the dungeon's pass) |

A Volley's shaft starts at its own point in the sky (`sky: true` - `{ world: [...from] }` as the muzzle); a Piercing
Shot's leaves the bow hand or the Thunderlock's muzzle as a plain shot does. A host that handed no door would still
swing its techniques and say "Not here." for the rest; none of the four is such a host.

## Online

- **The foes** are hit through the doors they already have: a live foe through the player door (`playerDoor.js`), a
  puppet through its owner, a world boss through the relay's boss bucket and the referee's clip - nothing new crosses
  the wire.
- **A peer sees** what a plain swing or shot shows: the body leaping or dashing (the motor's own flight, on the pose
  stream), the swing (`swingN`), the shot (`noteShot`, once for a Volley's loose).
- **Never at a player** (law 3): a duel, an arena bout between players and any other `sigilDueling()` room refuse the
  key; a body marked `duel` (a duel's, a siege's, the open zone's) and an arena rival's stand-in take a plain swing's
  test and number and are passed by a technique's shaft.
- **The referee** (law 6): the speed cap and the hit rate are under the relay's.

## What it does not do (TECH2's)

- **A peer does not see the Volley's falling shafts, nor the marks.** The shafts are real only in the archer's own
  world (they strike through its foes' doors, as every player shot does); a peer sees the loose. Drawing them for a
  peer needs a field on the wire and a relay version - TECH2's, if it is wanted.
- **No foe has a technique.** The roster is the player's; a foe's wind-ups stay the Telegraph arc's.
- **The classic HUD has no chip**: the message line says a refusal and a technique ready again.
- **No spell has one**, and no armour but the Gauntlets carries one. (A Staff is a blunt weapon by its skill, and rolls
  the blunt techniques.)

## The Test Room

`systems/testRoom.js` `seedTestLoot` lays twelve identified Rares in the pack, one a technique, each on a piece of its
family at +23% (`TECHNIQUE_TEST_BASES`: a Long Bow's Volley and Piercing Shot, a Longsword's Leap Strike and Whirlwind,
a Dagger's Shadowstep and Lunge, a Battle Axe's Cleave and Headsman's Chop, a Mace's Ground Slam and Skull Crack, Steel
Gauntlets' Flying Kick and Haymaker) - every technique a press away.

## Tests

- `test/tech1_roster.test.js` (9) - the roster, the families (an arrow and a pellet none), the numbers and the card's
  words; the line (appended last, in no pool, no slot, its params, its label, a name it never gives); ADD (the band, the
  worth, before a gem's, one at most, another family refused); the door's LAST draw (every door with the pass off and
  on, piece for piece, over seeds; the corpse kit); the Reforge, the Hone, the Exalted; the card (a Legendary's line in
  the Legendary band); the item law (every honest shape lawful, each forgery named); the Test Room.
- `test/tech1_runner.test.js` (15) - the refusals in order and their words, asked again at the release; the aim and its
  marks; a swing's blow on the real PlayerWeapon (the formula's damage times the multiplier, the arc, single, the
  wounded share, a player's body passed); a Volley's queue, its spend, a shot's tally a shaft, and its fall; a Piercing
  Shot; the leap on the real PlayerMotor (lands on its aim, air control does not steer it); the cooldown and its line;
  the aim set aside (the Activate press; a door crossed mid-aim, the next rig holding the same weapon; another rig
  mid-swing); THE LOOSE HELD (the Morrowind arm's held hit).
- `test/tech1_hosts.test.js` (4) - the action, its key and its rows; the rig's order, its held-hit flag; THE FOUR HOSTS,
  swept from the source (each host's door, and each ground pass's marks call right after its foes'); the dungeon lane;
  the mark's own size in the pass; the world host's chip seam and recentre, the HUD's colour, the side buttons' guard.
- `test/honestItems.mjs` - the honest-producers sweep forces a technique on every weapon and Gauntlets through every
  producer (a technique, then an Exalted, a curse, a hone and a reforge after it), saved and sent over the wire, and the
  item law finds nothing.
- Mutants `tools/mutants/tech1.json` (70, all dead). The first run left five alive, and each was a gap: a Legendary's
  band on the card, a door crossed mid-aim, a shaft's tally, the release's second asking (four pins added), and an
  ammunition check that could never change an answer (an arrow and a pellet swing with no skill), deleted.

**Pins moved** (each marked `PIN MOVED (TECH1)` where it stands): the ladder's own oracles and source pins for the pass
at a door's end (`cards9_sources`, `gilded1_gilded`, `sd9e_spoils`, `set6_aetheric`, `loot2_exalted`, `loot4_procs`,
`loot14_wardrobe`, `loot16_curses`, `loot20_sockets`, `loot21_stones`), the Test Room's count (`lr1_lootrarity`), the
item law's version and its producers' count (`int1_itemlaw`), the input registry's append order and counts
(`inputactions`, `classicpages`, `modewheel`, `qs2_inputs`, `viewtoggle`), the rig's signature (`ht1_handheldtorches`,
`map3_heldpose`) and the bow's draw-time writers, four with a technique's loose (`pcaao`). Two mutation records
re-aimed by content at the lines they guard, their laws unchanged: `disc10.json` DISC10-E-L2 (the swing's options are
read into `opts` before the technique's to-hit joins them) and `auditclimbarc.json` L3 (the air arm's guard now names the
technique's flight beside the parkour leap's).

**Kept as they were.** Every other arc's pinned line stands byte for byte: the foes' telegraph call in each host, the
quad's uniforms, the dungeon lane's boss, rival, crystal, host and companion lines, the HUD's set-power chips and their
colour, the rig's wire counters, and the ladder's pool, name, curse and reforge lines - a technique's work is done on
lines of its own beside them.
