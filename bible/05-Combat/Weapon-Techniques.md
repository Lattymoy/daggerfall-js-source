# Weapon Techniques - the key a weapon answers (TECH1)

`src/combat/techniqueRoster.js` (the roster, a leaf) + `src/combat/techniques.js` (the runner) +
`src/combat/techniqueBlow.js` (the blow, a leaf) + the line in `src/systems/lootRarity.js` (`AFFIX_KINDS.technique`) +
`src/combat/techniqueFx.js` (THE FEEL) (the owner, 2026-10-10)

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
6. **Nothing it moves outruns the referee.** A leap or a dash flies at most `TECHNIQUE_MAX_SPEED` (12 m/s) along the
   ground, under every referee's step: the arena's 12.5 m/s pose to pose (`net/arenaLaw.js` `ARENA_SPEED_MAX`), the
   siege's and the open zone's 18 (`net/siegeRef.js`). A Volley's six shafts fall 0.27 s apart, over 1.35 s - never
   five in a second, so an arena's referee (four blows a second, `ARENA_HIT_HZ_MAX`) and the relay's puppets (ten,
   `HIT_HZ_MAX`) land them all. (AUDIT TECH1: it was 16 m/s and 0.85 s, and an arena bout refused a Lunge's poses and
   two of a Volley's six.)
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
| **Volley** | bows | aim a disc 6-28 m off; the bow looses and 6 real arrows fall on 3.5 m from above, 0.55 s after, over 1.35 s | 0.5 each | (the shot's) | 6 | 16 s |
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

**Fatigue** is in the sheet's points, FATIGUE_MULTIPLIER (64) of the entity's own units each (a plain swing's drain is
eight units, an eighth of a point - `SWING_FATIGUE_COST`); `techniqueFatigue` never scales it (a technique's price is the
price), and a technique never spends the last of a body: the key refuses while the price and the blow's own drain after
it would leave nothing (exhaustion with a foe near is death - `systems/rest.js`).

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
  sites) after its late finds, the weapons' own sockets, the world's gem find (GEM1, GEM2) and the damning
  (TRUE-CURSE); the corpse kit (`foeLootCap.js` `rollCorpseKit`) after its socket passes and its damning; the gate's, the Abyss Dungeon's and the serpent's spoils
  after their card, their socket passes and their boss gems; the raid's after its last pass. Each calls
  `techniquePass` LAST, so a seeded door's earlier draws mint what they did (pinned by running every door with the
  pass off and on, piece for piece).
- **The card** prints the line as `<name> +N%` with its band (`Leap Strike +15% [15-30]`) and, under it, what a press
  does with that line's own numbers (`techniqueBrief`): `Aim: leap 9 m, strike all in 2.5 m, 161%. 5 fatigue, 12s`.
  A Rare is read once it is identified, as DFU reads it; its technique works all the same.
- **The name** never changes: with no slot, `nameAround` never puts it in a piece's name - a `Warrior's Longsword of
  Skill` that takes Leap Strike is still a `Warrior's Longsword of Skill`.
- **Its place** is the piece's last own line, before a set gem's (`addTechniqueLine`); a line added after the mint - an
  Exalted's, a curse's - goes before it (`withLine`).
- **The Reforge** turns a technique only into another of its family's (its pool is the technique alone) and makes
  nothing else one (the pools hold none); the **Hone** walks its value to its band's top; an **Exalted** Legendary's
  own line stays the Reforge's (`reforgeableLines` steps back over a gem's line, then a technique's). On a Legendary that
  is not Exalted the technique's line is the find's alone - neither honed nor reforged, as the item law has it (`honed`
  is an Exalted Legendary's) - though its card shows the Legendary band it was rolled in.
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
Shot** is one shaft along the look, leaving where a plain shot leaves. A **Volley** spends up to six arrows (as many as
the quiver gives), and queues them to fall on the aimed disc from 16 m - or from under the ceiling indoors, at least
1.6 m - spread on a sunflower's spiral and coming in from the archer's side, each pulled down its own line to start
short of a beam, a wall or a ceiling over its point, and each carrying the bow that loosed it whatever is in hand when it
falls. A **flight** (leap, dash) launches the motor
(`player/motor.js` `techniqueLaunch`) on a ballistic arc to the aimed point (`launchTo`: a leap's apex 1.6 m, a
Flying Kick's 1.2 m, a dash's 0.25 m - each at least 0.4 m over the landing - raised until the ground speed is under
12 m/s; lowered, where a ceiling stands over the path, to the highest that fits, `flightApex`), and starts the strike so its hit
lands WITH the body - when the time left in the air is the swing's own time to its hit, asked of the machine's
schedule (`blowSchedule`). The collider stops the body; gravity lands it; the fall is a jump's (DFU's fall law measures
the landing). Air control does not steer a technique's flight (`techFlight`), and no click starts a swing while it is in
the air (`techniqueFlying` - the rig asks no gesture), so the landing's strike is never thrown away; at the strike the
swing's own gate is asked again (sheathed, a spell readied, paralyzed, a weapon changed in the air: no blow). A
Shadowstep turns the view on the foe from where the body lands behind it (the door's `face(point, from)`), and its blow
is that foe's alone, all round within its reach (`blow.target`). A paralysis freezes a swing's or a shot's clock with the
machine, so a long one never lets the hit it waits on leak as a plain shot. A window over the street (the outdoor
doors' `blocked`, the host's `gamePaused`) holds the key, sets an aim aside unloosed and stops the clock; a building's and
a dungeon's rigs are not stepped under one at all.

**The aim** (`aimFor`): every look it casts meets the world through `rayHit` - the nearer of the collider's meshes and
the terrain, marched along the look in quarter metres and halved down to the crossing (outdoors the ground is the
collider's `surfaceAt`/`heightAt`, never a mesh; indoors and underground the meshes alone). A Volley's disc is where
the look meets the ground within 28 m, refused under 6. A Leap Strike or
a Flying Kick lands just in front of the foe under the look (its radius and 0.55 m short), or on the ground where the
look meets it. A Shadowstep tries behind the foe, then each side, then in front - the first spot no wall stands between
and a floor stands under. A Lunge runs to the first wall (or a rise it cannot run) less 0.6 m. A landing more than 4 m
below the feet or 2.5 m above them is refused - a body leaps down a little and up less - and so is a flight with no room
over its path ("No room to leap."). The foe a leap or a Shadowstep picks is never an ally, a companion or a foe at peace
(friendly protection, `friendlyProtected`), and a body's radius is read where its stand-in keeps it (`bodyRadius`: a
record's own, or a big body's `ai.radius`). The court's boss is not among the player door's foes, so a leap is aimed at
the ground beside him - and its landing ring strikes him there.

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

## THE FEEL (TECH-FX, 2026-10-10, the owner: "lets do code driven design for each technique, like real detail and ensure performance remains in tact")

A technique swings, shoots and leaps with the weapon's own animation (the classic sprite's strike frames, the Morrowind
arm's chop, slash or shoot - `fpAttack`), so on its own a Whirlwind reads as one plain slash. THE FEEL gives each one a
body of its own, drawn in code from what the engine already has - no new art, no new draw pass, nothing a peer is sent.
It is the technique's: it plays wherever a technique does (the ladder's own gate - "Off is DFU exactly"), on either
skin, its sound under Sound Enhancements as every added sound is.

**The moments** (`combat/techniques.js` cues them; `combat/techniqueFx.js` holds what each technique does at each):

| moment | when |
| --- | --- |
| `release` | the press goes: a swing starts, a shot is drawn, a leap or a dash leaves the ground |
| `hit` | the weapon machine's own `hit` event, as the rig hands its frame's events back (`claimShot`) - a leap's and a dash's strike land with the body, so this is the landing too; a climb that swallows the hit (AUDIT CLIMB-ARC F7) cues none |
| `loose` | a Piercing Shot's or a Volley's arrow leaves the string (`claimShot`) |
| `shaft` | each of a Volley's arrows (up to six, as the quiver gives) meets what is under it: its own line cast at the loose, timed at its loose plus its flight at `MISSILE_SPEED` |
| `close` | a Volley's last arrow down |

**The channels**, each through a seam that already carries its kind in all four hosts:

- **The camera** - a pitch, a roll, an eye dip and a field-of-view kick, each a critically damped spring kicked at the
  moment and settling back (`techniqueView`). It rides the climb's own view step (`player/climbFeel.js`
  `createClimbFeelHost`: its `view` folds the pitch, roll and eye into the view matrix first person only, its `fovRad`
  adds the field-of-view kick to every lens in every view - as the climb's own does - and its `pitch` hands the sky the
  same pitch) - the four view lines, pinned by CLIMB4, are untouched. The springs step on every frame the host draws,
  a held one too (a window, the death screen), so no hold keeps a blow's tilt; the host's `reset` (its load and its
  teleport) rests them at once.
- **The shake** - `betterAmbience.weaponKick` (the dungeon's `opts.shakeCamera`), the one shaker every host already
  applies, under Better Ambience's own switch and `maxShake` (and its fade-in: the shake swells for a moment after the
  blow, as the gun's own kick does).
- **The hands** - a DIP of the first-person layer, down only (`techniqueHands().y`, screen heights of the layer's own
  canvas): every sprite sits flush on the screen's bottom edge or a side, so a push up or across showed where its art
  ends; a dip only takes it further off the screen. The classic lane (the weapon, the clone, the gun, the shield, the
  torch hand, the spell's hands) takes it through the renderer's screen offset, the seam retro mode's pillarbox places
  it with (the rig's `drawInner` wraps its draw, `drawLayer`, in it and puts the offset back however the layer
  leaves; the gun's muzzle is measured where the dip drew it). The Morrowind arm takes it through its own screen
  transform (`techniqueDipRect`, beside the widget's channels and the climb's lowering), so its frame window
  (`fpArm.js fpFrameWindow`) grows over the edge the dip opens. The classic draw itself - `drawFpsWeapon`, the clone's
  quad, the gun's frame - is untouched, as FIELD-GUN12 wants it.
- **The world** - sparks, shock rings, ground glow and a brief light from the spells' own impact engine
  (`render/spellImpactFx.js` `technique(recipe, at, o)`, through each host's cast engine, `techniqueFx`): the one pass
  the engine draws while anything lives (built on its first burst, a spell's or a technique's), its caps (1500 sparks,
  161 rings and pools) over a technique's few dozen. The technique's blue (`TECH_FX_LOOK.energy`, its `TECH_COLOR`) and
  warm stone-dust thrown off the ground (`TECH_FX_LOOK.stone` - the pass is additive, so it glows as grit, never grey).
- **The sound** - a layer over the swing's own, from the game's own table (`SOUND`): a whoosh at the release, a
  landing's thud, each at its own pitch; under the Sound Enhancements switch (`enhancedSoundsOn`, the enhanced skin's),
  as the climb's whoosh is. A bow's loose has none of its own: the host's `bowSound` is the same ArrowShoot a tick
  earlier, and a Thunderlock's loose is its shot.

**Each technique** - the table's numbers, as the screen shows them: a pitch up positive, a ROLL leaning the view right
positive (a head tilted to the right shoulder: the horizon's right end rises), a field of view wider positive, the eye
down negative, the hands' dip in screen heights. A roll is at most 3 degrees: the sky's backdrop does not roll
(`render/skyRenderer.js` `draw(yaw, pitch, fovY, aspect)` - the climb's roll shares it), so a larger one tilts the land
against a level sky. A swing's roll leans with the blade's travel: a StrikeLeft (Whirlwind) leans left into it; a
StrikeRight (Cleave, Shadowstep, Haymaker) winds up leaning left and lands leaning right.

| technique | release | hit (the landing, for a leap or a dash) | the world |
| --- | --- | --- | --- |
| Volley | look lifts 0.9°, field narrows 2°; hands dip 0.03 | loose: a flare at the bow; each arrow: 5 sparks of stone-dust and a small ring where its line meets the ground; the last: a light shake (0.5) | the circle closes in a ring over the disc with the last arrow |
| Piercing Shot | field narrows 1.5° | loose: look kicks up 1.4°, field narrows 3.5°, hands dip 0.05, a light shake (0.8) | a flare at the bow and a tracer of sparks down the look, to the first thing it meets at the loose |
| Leap Strike | field widens 7°, look dips 1°; a low whoosh | look slams down 3°, the eye dips 12 cm, field narrows 4°, hands dip 0.08, a heavy shake (2.6), a thud | a shock ring to its 2.5 m, a glow under it, stone thrown up and blue racing out (25 sparks) |
| Flying Kick | field widens 6°, look dips 0.8°; a whoosh | look down 2.2°, the eye dips 9 cm, hands dip 0.06, a shake (1.8), a lighter thud | the same ring to its 2 m, its sparks thrown less far |
| Whirlwind | the view leans 3° left, into the spin; a deep whoosh | leans back past level, 2° right; hands dip 0.04; a light shake (0.9) | a ring to its 3 m and sparks flung round it, carried left with the blade |
| Ground Slam | look lifts 2° (the raise); a low whoosh | look slams down 3.5°, the eye dips 14 cm, field narrows 3°, hands dip 0.11, the heaviest shake (3.2), a deep thud | two shock rings (to its 3.5 m and 0.7 of it), a glow, the most stone thrown and blue racing out along the floor (39 sparks) |
| Skull Crack | look lifts 1.2°; a whoosh | look down 2.2°, hands dip 0.07, a sharp shake (1.6) | a star of light where the blow falls and a spray of sparks |
| Haymaker | field narrows 3°, the view leans 2° left (the wind-up); a whoosh | look down 1.2°, field opens 2°, leans 1.5° right, hands dip 0.05, a shake (1.4) | a star, sparks and a ring standing in the air, facing you |
| Cleave | the view leans 2.5° left (the wind-up); a whoosh | leans 2.5° right with the cut, look down 0.8°, hands dip 0.05, a shake (1.1) | a fan of sparks along its own 160° arc (the roster's `arc`) |
| Headsman's Chop | look lifts 1.6°; a whoosh | look down 2.8°, the eye dips 6 cm, hands dip 0.09, a shake (2) | a star where it falls, sparks, a small ring under it |
| Shadowstep | field widens 8°, the view leans 2° left; a quick high whisk | field narrows 3°, leans 2° right, hands dip 0.05, a shake (1) | a ring and rising sparks where you left; a star where you strike |
| Lunge | field widens 7°, look dips 0.6°; a whoosh | look down 1.4°, field narrows 3°, hands dip 0.06, a shake (1.2) | a trail of sparks down the lane you ran |

**Comfort.** `techniqueMotion` (Settings > Accessibility > Motion, "Technique camera motion": Full, 75%, Half, Low,
Off; Full by default) scales the camera's springs, the shake and the hands' dip; at Off a technique moves nothing on
the screen - its burst (the sparks, rings, glow and light) and its sound stay. Better Ambience's switch and `maxShake`
still bound the shake. The pitch, roll and eye are first person only (the climb's own rule); the field-of-view kick
reaches every view, as the climb's does; in third person the hands' dip has no hands to move.

**Performance.** THE FEEL costs nothing while no technique is in the air: its springs are a preallocated typed array
(critically damped, stepped by their closed form - the same curve at any frame rate, put to exact rest from below a
pixel), its outputs two class instances filled in place, its step and the view fold return at once at rest, and the
marks' and the chip's empty lists are one frozen list. A moment allocates at the moment, never a frame: its place, a
burst into the impact engine's one pass (at most 39 sparks - Ground Slam's; a Volley arrow's 5 - up to three rings and
one light, under the engine's own caps), a sound, and a Volley's six landing lines cast once at its loose.
`test/techfx1.test.js` measures the frame (L2 F9's measure, the least of six windows in a child with a 64 MB young
space, against a control that must show) - at rest: the springs' step, the fold, the lens, the sky's pitch, the
hands, the hosts' own marks call, the chip with nothing in hand, the runner's frame with a technique in hand and with
its cooldown running, the chip ready and recovering, the technique key's held poll; with all five springs in flight:
the step, the fold and the hands - each under 2 bytes a frame. The measure found these, and each is gone:

- **The outputs' shape.** The outputs were object literals, `{ x, y }` and `{ pitch, roll, eye, fov }` - shapes the
  engine shares with every such literal the game makes; once one of those held anything but a number, the field went
  general and every write here boxed its number (32 bytes a frame in flight). They are a class each now
  (`TechView`, `TechHands`): their own shape, their number fields only ever numbers, written in place.
- **The fold's eye.** `applyClimbView` read the eye with a destructure (`const [ex, ey, ez] = fx.eye`), which made an
  iterator a call - 16 bytes a frame whenever the climb or a technique moved the view. It reads by index now.
- **AUDIT TECH-FX's** (below): the held poll's walk of every binding (7.5 KB and 8 µs a frame, every poll of an action
  bound late in the dict - the technique key is the last), the HUD chip's key lookup (10 KB and 11 µs a frame), the
  rig's technique context made anew (about 450 bytes a frame, every player), the technique line's `find` closure, the
  cooldowns' Map, the marks call's clock read at rest, and the renderer's offset pair made anew a set.

The lens's two numbers (`fovRad`, `pitch`) are returned as numbers: at rest 0, which costs nothing; while a spring
moves, a call the engine does not inline boxes its answer (16 bytes, as the climb's own kick has since CLIMB4). What
still allocates, only while a technique is held or in the air: the aim's own rays and points while the key is held
(TECH1's: about 0.9 KB a frame for a Volley to about 7 KB for a Shadowstep, its ten rays and its height samples), a swing act's feet copy, the marks while they
show.

## THE FOUR HOSTS

Every host hands its rig the technique's **door** - `{ motor(), fireArrow(from, dir, { sky, weapon, technique,
speedScale }), drainFatigue(n), face(point, from) }` (and, on the street, `blocked()` - its window's hold), and THE
FEEL's three ends, `fx(recipe, at, o)` (its cast engine's `techniqueFx`), `shake(k)` (`betterAmbience.weaponKick`; the
dungeon's `opts.shakeCamera`, its outer host's) and `sound(clip, volume, pitch)` (its `audio.playOneShot`) - and draws
the marks in its ground pass:

| host | motor | the shaft's lane | fatigue | the view's turn | marks |
| --- | --- | --- | --- | --- | --- |
| `scenes/exterior.js` | its PlayerMotor | `arrows.fire` | `drainExteriorFatigue` | `cam.yaw`, the look filter settled | wired |
| `scenes/world.js` | its PlayerMotor | `arrows.fire` | `drainExteriorFatigue` | `cam.yaw`, the look filter settled | wired |
| `scenes/worldModes.js` (interiors) | the shared motor | `interiorArrows.fire` | `drainInteriorFatigue` | `cam.yaw` | wired (both passes) |
| `scenes/dungeonContext.js` | its outer host's (`worldModes.js`, or `dungeon.js`'s own) | its own missiles (`fireArrow`) | `drainFatigue` | its outer host's | wired (`worldModes.js` and `dungeon.js` draw the dungeon's pass) |

THE FEEL in each (AUDIT TECH-FX - the FOUR HOSTS RULE names all four):

| host | the burst (`fx`) | the shake | the sound | the camera's springs (stepped by, folded by) |
| --- | --- | --- | --- | --- |
| `scenes/exterior.js` | its cast engine (`magic.techniqueFx`), drawn in its world pass | `betterAmbience.weaponKick` | `audio.playOneShot` | its own climb handle; not on horseback (its view line's `!riding`) |
| `scenes/world.js` | its cast engine, drawn in its world pass | `betterAmbience.weaponKick` | `audio.playOneShot` | its own climb handle; on horseback too (its view line has no riding gate - CLIMB4's seam, inherited) |
| `scenes/worldModes.js` (interiors) | the world's cast engine (`magic?.techniqueFx`), drawn in the interior's pass | `betterAmbience.weaponKick` | `audio.playOneShot` | the world's climb handle (`host.climbFeel`) |
| `scenes/dungeonContext.js` | its own cast engine, drawn in its own pass | `opts.shakeCamera` (its outer host's `betterAmbience.weaponKick`) | `audio.playOneShot` | its outer host's handle (`dungeon.js`'s own, or the world's) |

A Volley's shaft starts at its own point in the sky (`sky: true` - `{ world: [...from] }` as the muzzle); a Piercing
Shot's leaves the bow hand or the Thunderlock's muzzle as a plain shot does. A host that handed no door would still
swing its techniques and say "Not here." for the rest; none of the four is such a host.

## Online

- **The foes** are hit through the doors they already have: a live foe through the player door (`playerDoor.js`), a
  puppet through its owner, a world boss through the relay's boss bucket and the referee's clip - no new message. An
  item record does carry a new kind of line: an older build reads a list holding a technique piece as from a newer
  version (`loot.js` `validLootList`'s own message), and the account service's judge must know the law - so the item
  law's version 2 moved `ACCOUNT_VERSION` to acct106 (acct105 on this branch, renumbered past THE INTEGRITY ARC lane 3's acct105 at the #745 merge), and a site deploy waits for that service (AUDIT TECH1; a law moved
  without it ships the site first, and an honest technique piece reads as a forgery - a hold and a strike - in the gap).
  `test/tech1_roster.test.js` holds each law version to the first service that carries it.
- **What a referee counts.** The arena's and the court's referees count a blow by its sequence. A Piercing Shot is one
  shaft and one blow to both: the court's `blowQ` keeps a blow's sequence until a body repeats, and the arena's lane
  gives a piercing shaft's later bodies its first one's (`arrowFlight.js` `shaftSequence`, while that is still the
  newest - any blow between, and the body is its own). A watchman's owner measures a melee blow from the striker's pose
  (`WEAPON_REACH` and the pose's slack), so the last half-metre or so of a Lunge's lane can pass a watchman it ran by -
  kept: the owner's reach is the watch's guard against every melee claim, and widening it for a Lunge widens it for
  all. Nothing records a strike - the number is not dealt.
- **A peer sees** what a plain swing or shot shows: the body leaping or dashing (the motor's own flight, on the pose
  stream), the swing (`swingN`), the shot (`noteShot`, once for a Volley's loose).
- **Never at a player** (law 3): a duel and an arena bout between players (`sigilDueling()`) refuse the key; in a siege,
  the Royal Tourney and the open zone it works against the room's other foes, and every player's body there - marked
  `duel`, or an arena rival's stand-in, `rival` - takes a plain swing's test and number and is passed by a technique's
  shaft. A leap's flight stays under those rooms' 18 m/s; the Royal ring pulls back a contender who leaps out of it.
- **The referee** (law 6): the speed cap and the hit rate are under the relay's.

## What it does not do (TECH2's)

- **A peer does not see the Volley's falling shafts, nor the marks.** The shafts are real only in the archer's own
  world (they strike through its foes' doors, as every player shot does); a peer sees the loose. Drawing them for a
  peer needs a field on the wire and a relay version - TECH2's, if it is wanted.
- **No foe has a technique.** The roster is the player's; a foe's wind-ups stay the Telegraph arc's.
- **The classic HUD has no chip**: the message line says a refusal and a technique ready again.
- **No spell has one**, and no armour but the Gauntlets carries one. (A Staff is a blunt weapon by its skill, and rolls
  the blunt techniques.)

## AUDIT TECH1 (2026-10-10, the owner: "Audit this and ensure perfection")

Four lanes read the change against the running game, not its tests - the hosts' wiring and units, the online
referees and the services, the item's every path, the runner's own logic - and one finding came from the first read of
the real collider. What they found, and what was done:

| finding | severity | done |
| --- | --- | --- |
| The outdoor ground was invisible to every aim: `raycast` meets meshes alone, and outdoors the ground is the collider's terrain sampler - a Volley outdoors, a ground leap, answered "Out of reach" (the tests' fake collider let its ray meet the ground) | blocker | `rayHit` marches the terrain; THE GROUND OUTDOORS on the real Collider |
| `ACCOUNT_VERSION` did not move with the item law: a site deploy could ship before the judge that knows a technique line, and an honest piece read as a forgery (a hold, a strike) | blocker | acct106 (acct105 until the #745 merge renumbered it past INT11-INT14's); the law-to-service pin (`test/tech1_roster.test.js`) |
| Shadowstep turned the view from mid-dash, so the body landed behind the foe looking away, and its 'view' blow struck nothing - its price paid; its `target` was read by nothing | major | the turn from the landing (`face(point, from)`); a target's blow is the target's alone |
| A leap under a ceiling turned back at it and landed metres short (2.8 m: a 9 m leap came down at 3.75 m) | major | `flightApex` lowers the apex to fit, or refuses with "No room to leap." |
| A click in the air (or the touch Attack button) started a plain swing, and the landing's strike had no machine to start on | major | no gesture and no touch swing while `techniqueFlying()` |
| An all-round reach widened DFU's protected fallback (the look ray's stand-in) to the whole ring: a foe at peace behind, an ally beside, struck | major | a protected foe only on the plain look; the pick skips allies, companions, foes at peace |
| The street's rig steps under a window, and the mouse's side button reaches `keys` there: a press behind a talk window or the pack ran the technique in the street | major | the outdoor doors' `blocked` (`gamePaused`) holds the key, the aim and the clock |
| An arena bout: a Lunge or a Shadowstep past the referee's 12.5 m/s, and two of a Volley's six past its four blows a second | major | 12 m/s; 0.27 s a shaft |
| A long paralysis mid-shot gave up the act and let the frozen hit loose a plain arrow | minor | the clock stops with the machine |
| The leap's strike skipped the swing's gate (sheathed, a spell, a bow swapped in) | minor | asked again at the strike |
| A Morrowind arm's held plain hit could be claimed as a technique's loose | minor | `!_heldHit` in the gate |
| A Volley's shafts took the weapon in hand when they fell, and could be born inside a wall or over a beam | minor | the loosing bow carried; each shaft pulled into the open |
| A big body's radius read from the wrong field (`ai.radius`) | minor | `bodyRadius` |
| The open water let a leap launch; a technique could spend the last of a body; a load kept the moment before it - the cooldowns, a held aim, a flight or a volley in the air (the player's entity is one object, refilled in place, so a new character is a load too) | minor | refused; price plus the blow's drain; the state starts fresh at each load (`systems/save.js` `restoresSoFar`, the count every load passes) |
| An area technique outdoors met the watch's pool only (a struck watchman kept it from the bandits in the ring) | minor | every pool is offered a technique's blow, one token |
| A Roleplay & Realism weapon lost its family with its mod's switch off - its line a forgery to the law, its Reforge refused | minor (offline) | the family from the class table |
| An unidentified piece's technique was named by the chip and the lines its card hides; "One sure blow" contradicted law 1; the Gauntlets' line said nothing of bare hands; a chat post spent its length on the detail line | minor | "Your technique"; "One heavy blow, +30 to hit"; "Bare-handed"; the detail stays on the card |

**Left as they were at the audit** - and settled by THE FOLLOW-UP below: a Piercing Shot counted a blow per body by the
arena's referee, two overlapping court bodies, the reforge window's word, the Lunge past a watchman (kept, and why), and
a finding outside this change (`test/importGraph.mjs` - fixed there). The corpse kit's callers that draw after
it (the street's sigil stamps and death rolls) draw later in their stream by the technique pass's draws, as the socket
pass already made them - the kit's own pieces are what they were (law 9).

**Tests** `test/tech1_audit.test.js` (11 at the audit, 13 after THE FOLLOW-UP) - one a finding, on the real classes; the outdoor ground in
`test/tech1_runner.test.js` THE GROUND OUTDOORS. **Mutants** 39 audit records in `tools/mutants/tech1.json`, all dead (the
first run left the walled shaft alive: its test's flat ceiling was the one the middle's ray already saw - a beam over
part of the disc kills it). `TECH1-the-cap-past-the-referee` (16 m/s raised past the siege's 18) is retired: the cap is 12
now, and `TECH1-AUDIT-the-run-past-the-arena` (12 raised to 16) is the stricter record on the same line. Re-aimed by content, their laws unchanged: `fb1009g_bowclock.json` (the gesture's gate
carries the flight's), `gatekeys.json` and `fb1004d_knight_house.json` (acct105, then acct106 at the #745 merge), and this list's own `TECH1-the-turn-unmade`
(the turn now takes the landing point). One pin moved, marked `PIN MOVED (AUDIT TECH1)`: `test/mwattackclip.test.js`
MW-D12 reads the gesture's gate with the flight's term (no line around it could carry the term without breaking the
pin's own shape).

## THE FOLLOW-UP (2026-10-10, the owner: "Make your own decisions and take care of any issues")

What the audit had left, and what it found outside this change, each decided:

| item | decision |
| --- | --- |
| A Piercing Shot through the arena's fighters spent the referee's rate a body each (a Grand Melee's three: three of its four blows a second, ARENA4b's own law says one) | fixed: `arrowFlight.js` `shaftSequence` - a piercing shaft's later bodies ride its first one's sequence while it is the newest; the lane's pinned `nextArenaQ()` stands, the shaft's sequence on the line after it. THE ONE SHAFT runs it on the real referee |
| Two court bodies overlapping under a piercing shaft: the first, struck, hid the second (`find` met it first, every frame) | fixed: the court's crystal and host `find`s pass a struck body; their `if` lines are what they were before TECH1 (`wb11_gate_host` WB11's host pin `PIN MOVED`) |
| The Reforge's card named a technique's line and not what it does | fixed: the line's "what a press does" under it (`reforge-detail`), as the item card says it |
| A Lunge's last half-metre past a watchman on another's watch | kept: the owner's melee reach is the watch's guard against every claim; a Lunge's lane is 5 m and the reach with its slack about 4.5 m plus the watchman's own motion |
| `test/importGraph.mjs` (found by the audit, outside this change): nine files the account Worker bundles never reached its deploy filter | fixed (IMPORT-GRAPH1, `06-Systems/Accounts-And-Cloud-Saves-Arc.md`): the walk parses, the nine are listed, and each Worker's graph is held to esbuild's own inputs |
| `loot16.json` LOOT16-a-row-of-nothing, surviving on main | recorded `equivalent` with its reason: three drawback rows fit every piece, so the filter it removes is never empty |
| Other players do not see a Volley's falling shafts or the marks (TECH2) | not in this change: it needs a wire field and a relay version bump - its own slice |

Tests: THE ONE SHAFT and THE REFORGE'S WORD in `test/tech1_audit.test.js`; the court's `find`s and the lane's sequence in
`test/tech1_hosts.test.js`. Mutants: six more in `tools/mutants/tech1.json` (the shaft each body, the newest unasked, the
lane unsequenced, a struck crystal and a struck host in the way, the word left off), all dead; IMPORT-GRAPH1's six in
`tools/mutants/importgraph1.json`, all dead.

## AUDIT TECH-FX (2026-10-10, the owner: "Please audit everything and ensure perfection")

Five lanes read THE FEEL against the running code, not its tests: the moments and the runner's state, the view and the
screen in every host, the bursts, shakes and sounds in all four hosts, the frame's cost and the tests' strength, and
the doctrine and the records. Every finding below was reproduced before it was fixed, and each fix is pinned
(`test/techfx1_audit.test.js`, one test a finding, and `test/techfx1.test.js`) and mutated (`tools/mutants/techfx1.json`).

| finding | what was wrong | now |
| --- | --- | --- |
| BLOCKER: no burst in any host | `fxPlace` asked `Array.isArray` of the feet - and the motor's feet are a `Float32Array` (`player/motor.js` `pos`), which every host hands the rig; every test had handed a plain array | a point is any three finite numbers (`vec3`), in the runner and the impact engine; every runner test hands a `Float32Array`, and one ties it to the real motor |
| MAJOR: the Morrowind arm and the push | the arm's frame window (`fpFrameWindow`) covers the screen exactly, so the renderer's offset laid on after it cut a bare band across the screen; with the Weapon Widget off the arm's overlay never read the offset at all | the arm takes the dip through its own screen transform (`techniqueDipRect`): its window grows over the edge the dip opens; the classic lane keeps the offset |
| MAJOR: the sprites' edges | a push up or across lifted a sprite off the edge it sits on (the weapon's bottom, a right-aligned Idle, a left-aligned StrikeRight) - the torch clamps and the widget's bob signs exist for exactly this | the hands only dip (`FX_CH.hands`, `y` > 0 only): every rise and sweep left the table |
| MAJOR: a Volley's puffs on a slope | the disc's points stand at its centre's height, so on any slope or step a puff hung in the air or sank (0.7 m on a 17° grade) | each shaft's own line is cast at the loose (`rayHit`), the puff where it meets what is under it, timed by that distance at `MISSILE_SPEED` |
| MAJOR (TECH1): the HUD chip's key | the world host looked the key's name up every frame (`getBinding`'s walk of every binding: 10 KB and 11 µs a frame, a technique in hand or none) | a word the chip asks only when ready, cached on the bindings store and its `rev` |
| MINOR: the roll mirrored | every host's lens mirrors the camera's x (`mirrorProjectionX`), so the camera's roll, positive, leans the view LEFT on screen - the table's "right" was the screen's left | the table speaks the screen and the cue kicks the roll negated; `techfx1_audit` projects the horizon through the hosts' own lens |
| MINOR: the sky does not roll | the sky's backdrop takes no roll (`draw(yaw, pitch, fovY, aspect)`), so a 7° lean tilted the land against a level sky | a roll is at most 3° (the climb's own roll shares the backdrop - rolling the sky is three sky passes and the cloud decks, not this arc's) |
| MINOR: the hit's moment | the runner's own clock ran a frame or two behind the machine's hit, kept on under a climb that swallows the hit, and stopped under a street window that does not stop the machine | the `hit` moment is the machine's own `hit` event, as the rig hands its frame's events to `claimShot` |
| MINOR: the Whirlwind's spin | the sweep's sparks spun right; a StrikeLeft carries the blade left (`weaponWidget.js` `leanFor`, `bloodDecals.js` `SWING_PUSH`) | a sweep spins the way its strike travels (`spin` off the roster's `strike`); an arc spans the roster's own `arc` |
| MINOR: a recentre | the floating origin's shift moved neither where a Lunge began (its trail strung across a kilometre) nor a fallen-loose shaft's landing (aliased to its queue entry) | both moved, each its own point |
| MINOR: the tracer | its length was the aim's flat lane at the release; the player may turn before the string goes | the look at the loose, cast to the first thing it meets (3-D) |
| MINOR: the bow's loose | the technique's ArrowShoot doubled the host's own `bowSound` (the same clip a tick earlier), and a Thunderlock's Piercing Shot twanged over its gunshot | a bow's loose plays no layer of its own |
| MINOR: a held frame | the springs stood under a held frame, so a window or the death screen opened in a blow's first moment kept its tilt as long as it stood; a load's reset waited for the runner's next step | the springs step on every frame (the climb's own feel still stands under the hold); the climb host's `reset` (its load, its teleport) rests them |
| MINOR (TECH1): the frame's cost | the held poll walked every binding a call (7.5 KB and 8 µs a frame for the technique key, last in the dict - and every other action bound late), the rig's technique context was made anew each frame (~450 B, every player), the technique line's `find` made a closure a call, the cooldowns' Map boxed its numbers (96 B a frame for 8-16 s after each use), the marks call read the clock at rest, the flight re-asked its hit time each frame, and the renderer made a fresh offset pair a set | the poll reads an index of each action's codes built once a binding change (`ui/input.js` `actionCodes`, on the store's `rev` - the law `comboModifiers` rides); the context and its camera are filled in place; a loop; a `Float64Array`; no clock read at rest; asked once a flight; the pair moved in place |
| NIT: the gun's muzzle | measured where the sprite would stand without the dip | where the dip drew it |
| NIT: a lost facing | `technique()` guarded every input but the yaw | a non-finite yaw faces ahead |
| ONE DFU MEMBER, ONE EXPORT | `TECH_ARROW_MPS = 25` and TECH1's `h / 25` were second and third literals of DFU's `MISSILE_SPEED` | the runner imports `MISSILE_SPEED` |
| records | the page's door, a Piercing Shot's row, a Flying Kick's "fewer sparks", "third person" against the lens's kick, "one draw every frame", "0 to 100%", the stone's "grey", no FOUR HOSTS columns for THE FEEL, the ledger row, the Tests list | corrected above and below |

Kept, with the reason:

- **A double thud on a big drop.** A Leap Strike or a Flying Kick that lands more than 2.5 m below its take-off also
  plays the motor's own hard landing (`applyFallLanding`): the body's fall and the strike's landing are two events, and
  on level ground - where the fall is measured from just after the launch - there is one.
- **The shake swells after the blow.** Better Ambience's shaker fades every kick in over 0.3 s, the gun's included; the
  shaker is shared, and its feel is its own arc's.
- **A shaft stopped by a body still puffs on the ground.** The puff is the line's, cast at the loose; the lane's own
  impact (a foe struck, a wall) is the host's and plays its own.
- **The technique camera on horseback in the world host** (and not in the exterior host) - each host's climb view line
  decides, as it does for the climb (CLIMB4's seam).
- **The climb's own roll is mirrored too** (`player/climbFeel.js` - a side leap leans away from its side on screen; CLIMB4
  F6 pins the camera's axis). It is the climb's, not this arc's: noted here for its own audit.
- **No reduced-motion default.** The setting is the player's own and Off moves nothing; no project rule binds an OS
  preference to an in-game camera.
- **The aim's own cost while the key is held** (TECH1's rays and points, under 8 KB a frame) - only while held.

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
- `test/tech1_runner.test.js` (16) - the refusals in order and their words, asked again at the release; the aim and its
  marks; a swing's blow on the real PlayerWeapon (the formula's damage times the multiplier, the arc, single, the
  wounded share, a player's body passed); a Volley's queue, its spend, a shot's tally a shaft, and its fall; a Piercing
  Shot; the leap on the real PlayerMotor (lands on its aim, air control does not steer it); the cooldown and its line;
  the aim set aside (the Activate press; a door crossed mid-aim, the next rig holding the same weapon; another rig
  mid-swing); THE LOOSE HELD (the Morrowind arm's held hit); THE GROUND OUTDOORS (on the real Collider).
- `test/tech1_hosts.test.js` (4) - the action, its key and its rows; the rig's order, its held-hit flag; THE FOUR HOSTS,
  swept from the source (each host's door, and each ground pass's marks call right after its foes'); the dungeon lane;
  the mark's own size in the pass; the world host's chip seam and recentre, the HUD's colour, the side buttons' guard.
- `test/honestItems.mjs` - the honest-producers sweep forces a technique on every weapon and Gauntlets through every
  producer (a technique, then an Exalted, a curse, a hone and a reforge after it), saved and sent over the wire, and the
  item law finds nothing.
- Mutants `tools/mutants/tech1.json` (70 at TECH1, all dead; AUDIT TECH1 retired one and added 39 - 108; THE FOLLOW-UP added 6 - 114). The first run left five alive, and each was a gap: a Legendary's
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
**Merging GEM1-GEM3 (#741).** The gem arc added its own last draws at the same doors - the weapons' sockets and the
world's gem find at the host door, the socket passes and the boss's gems in a boss's spoils - so the technique pass now
draws after them (law 9 both ways: every draw the gem arc shipped is its seed's, and the technique is a door's last).
Its pins moved with it, each marked `PIN MOVED (TECH1)`: `gem1_sockets` (the weapons' pass and the bosses' "the same but
the sockets" set a technique's line and worth aside; the find's "nothing after it" holds the technique off; the gate's
source pin reads the pass after its gems), `serpentset` (seed 2's broadsword now rolls Leap Strike after the last
pass's castSpeed line), and in `loot16_curses`, `loot20_sockets`, `loot21_stones`, `gilded1_gilded`, `sd9e_spoils` and
`lr1_lootrarity` both arcs' moves together (`cards9_sources` reads the gem arc's passes after the card, as the gem arc
moved it). `TECH1-the-pass-before-the-late-finds` is re-aimed as `TECH1-the-pass-before-the-gem-find`.
**Merging FIELD BUGS 2026-10-10 (#743).** TRUE-CURSE's `damnPass` is another last draw at the host door and the corpse
kit, so the technique pass follows it too, and `test/fb1010_truecurse.test.js` reads it there (`PIN MOVED (TECH1)`: the
two doors' source pins, and the Test Room's damned weapon last but the twelve technique pieces). The order record is
re-aimed as `TECH1-the-pass-before-the-damning`; the first run left it alive (a door's seeds seldom made a cursed
Legendary weapon, so the damning seldom drew), and THE DOOR now forces the curse over 399 seeds and holds every piece,
damned or not, to its seed. THE LAW adds the shape the merge makes possible - a damned Legendary weapon whose technique
is rolled after its damning, lawful. The Reforge's
Exalted line on a Legendary counts back from the gems' lines (GEM1) and then past a technique's (TECH1).
The ledger row, set at the foot of section A, moved sections B, C and D down one line: their line cites were
re-resolved by `tools/citeShift.mjs` (and the numbered and inline `:NNN` identifiers of Port-Status section 2 by hand,
with section A's tally, now 300 rows) - `test/citedrift.test.js` CD1, CD3 and CD5.

**Kept as they were.** Every other arc's pinned line stands byte for byte: the foes' telegraph call in each host, the
quad's uniforms, the dungeon lane's boss, rival, crystal, host and companion lines, the HUD's set-power chips and their
colour, the rig's wire counters, and the ladder's pool, name, curse and reforge lines - a technique's work is done on
lines of its own beside them.
