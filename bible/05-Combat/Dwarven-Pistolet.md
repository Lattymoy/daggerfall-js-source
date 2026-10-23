# The Dwarven Pistolet - the second gun, and the first a pair of can be carried

`src/systems/pistolet.js` + `characters/thunderlockIds.js` (its numbers) + `combat/gun/pistoletArt.js`,
`combat/gun/pistolStrip.js`, `combat/gun/gunPair.js` + `tools/pistoletArt.mjs`, `tools/bakePistolet.mjs`
(PISTOLET, 2026-10-21)

The owner, in three steps:
1. *"this spritesheet is to be for our new weapon type, which can also be duel wielded. Its a dwarven flintlock style
   pistol. We need to use the same prototype testing we did for the thunderlock"* - the pistol lab, `Pistol-Lab.md`.
2. *"Must be these values/sounds exactly"* - the lab's panel, tuned (Pistol-Lab.md, PISTOL-LAB 2).
3. *"Next this is the paperdoll model/inventory. The gun should use the same ammo the thunderlock uses"*. Asked:
   - The full weapon, pair and all, in this step.
   - The hand's gap cut on the doll.
   - Damage 4-15, 2.5 kg, 260 gold, Archery.
   - *"make the thunderlock in general more rare along with the new hand cannon"*.
   - A lore name: **Dwarven Pistolet**.
   - *"replace the serpent boss gilded weapon with this new weapon"*.
   - For the Morrowind arm, *"Build one from the sprite"*.

DFU has no gun and no dual wielding (SCOPE1: this is our own). The Dwarven Thunderlock is the worked example
(`Dwarven-Thunderlock.md`), and every law here names the one of its laws it follows. What the Pistolet adds is a gun in
ONE hand, and so a PAIR.

## The item

| | Value | Where |
|---|---|---|
| Template / art archive | 562 / 562 - past the Thunderlock's 560/561 | `characters/thunderlockIds.js` |
| Name, weight, price | Dwarven Pistolet, 2.5 kg, 260 gold (the Thunderlock 6 kg, 480) | `systems/pistolet.js` PISTOLET_TEMPLATES |
| Damage | 4-15 (`PISTOLET_SPAN`, once, on the leaf; `characters/weapons.js` answers it) | the Thunderlock's arm, one row along |
| Skill | Archery (`weaponSkillUsed`) | |
| Hands | Either (`characters/equipTable.js`) - one-handed, so a second one in the other hand is a pair | |
| Ammunition | the **Dwemer Pellet** (`ammoTemplateFor` answers 561 for either gun), flying as the same shock orb | |
| Found | the Thunderlock's unique find, half its mints, from source tier 4, arriving with 6-18 Pellets; never on a shelf | `systems/thunderlock.js` |

**The rarity.** There is ONE gun find, the Thunderlock's own at its old weight (`systems/thunderlock.js`). Its one mint
draw picks the gun - the Pistolet at or over `GUN_SHARE` 0.5, the Thunderlock under it - and what is left of the draw,
stretched back to a whole unit, counts the Pellets. So each gun turns up exactly half as often as the Thunderlock did, at
every source, the find's cap and Luck's nudge included, and every seeded loot list draws what it always drew (Loot-II-Arc
law 9). `systems/pistolet.js` hands the find its mint (`setSecondGun`).

AUDIT PISTOLET (A5, A8, C2, C3, D6, D29) found the first cut, two finds at `FIND_WEIGHT` 0.5, neither half nor stable:
- `uniqueFindChance` caps each find at 6 per mille and adds Luck's nudge per find, neither scaled by the weight, so a
  tier-14 boss turned up a gun twice as often and the Thunderlock no rarer at all;
- the second find's roll moved every later draw of every seeded list at tier 4 and up (seed 43 grew a Welkynd Stone).

**Every reader that asks about a gun and not about one gun** answers for both:
- `isGunTemplate` (the leaf) and `isGunType` (`combat/fpsWeapon.js`).
- The technique family - the guns share Piercing Shot.
- The siege referee's reach and its "a shot is a bow's blow" (`net/siege/siegeRef.js` SIEGE_PISTOLET).
- The item law's Weapons group (`systems/item/itemLaw.js`), the pseudo-archive registry, the test room (two rows, a
  pair's worth).
- The icons' install, beside the Thunderlock's (`systems/worldTick.js`), and its own picture in every list - the pack,
  the Enhanced grid, the hotbar, the pickup feed, the loot banner (`registerOwnItemImage`, THUNDERLOCK-ART's door).
- **The element** (WEAPON-GLOW1, `systems/weaponGlow.js`, checked 2026-10-22 at the owner's "just to make sure"): an
  element line - rolled as a Magic's or a Rare's proc line, or a socketed gem's (a Pistolet takes two sockets, a
  one-hander's; the Thunderlock three) - glows its look in the classic hand and on the Morrowind arm, each pistol of a
  pair its own, and rides the online look for other players; its damage lands on a shot as on a swing (`lootBlow`).
  `pistoletRig.test.js` pins each pistol's own outline.
- **Its name** says its metal once (`systems/item/itemInfo.js` itemLongName): the Dwarven Pistolet is minted Dwarven, and
  a Magic's or a Rare's name read "Dwarven Soldier's Dwarven Pistolet" - AUDIT PISTOLET C9 asked whether the whole name
  began with the metal, which a prefix hides; it asks the item's own template name now (PISTOLET-NAMES), and the
  Thunderlock's names with it. `pistolet_pins.test.js` C9.

## The pictures

**The owner's sprite was a screenshot**, an editor's canvas over its checkerboard, scaled up non-integrally (about 8.9
screen pixels to an art pixel). Its native pixels were recovered like this:
- The grid's pitch and phase were fitted by minimising each cell's spread over the art cells (pitch 8.89).
- Each cell was read as the median of its non-checker pixels, the checker told apart pixel by pixel (neutral at 255 or
  200).
- The result was redrawn on the grid and diffed against the screenshot. The interiors match to a median of 0 and a 95th
  percentile of 2 levels; the only misses are one screen column where the grid's last cell meets the next checker
  square.

The result, `public/art/pistolet-icon.png`, is 24x17 and 1-bit, at Daggerfall's own scale: one of its pixels is one of
the doll's. (It is not a dagger's doll record's size, as this page first said - those are 56x17 and 36x45: AUDIT PISTOLET
D15.)
If the owner has the original file, it replaces this one byte for byte and `node tools/pistoletArt.mjs` re-derives the
rest.

**One picture per job**, the Thunderlock's THUNDERLOCK-ART rule. The list shows the whole gun, the sprite as it is. The
doll wears a layer with the fist's gap cut out:
- `tools/pistoletArt.mjs` cuts it as a band square to the grip (the Thunderlock's `punchBand`, imported - and
  `tools/gunPaperdoll.mjs` gained the `isMain` guard AUDIT 68 asks of a tool another imports).
- The frame of the gun stays above the fist and the butt below it.
- Then each hand's layer is posed (`HAND_POSE`). The doll's left hand (the picture's right) wears the sprite as drawn,
  tilted 45 degrees barrel-down to the picture's left (`DOLL_ANGLE`). The doll's RIGHT hand (the picture's left) wears
  it FLIPPED left to right, tilted 60 degrees barrel-down to the picture's right, toward the other gun. That one layer
  is a mirror of the owner's drawing, by the owner's choice (below).
- The tilt is RotSprite (`rotSprite`): Scale2x three times, the turn sampled nearest at 8x, read back at 1x. A nearest
  turn at 1x is the staircase-and-holes the Gun-Lab record warns of. RotSprite adds no colour the sprite does not
  have, and `pistolet.test.js` checks every one.

**How it got here - the owner's eye, 2026-10-22.** The owner names hands as the picture shows them.
1. The gun hung level: "Paperdoll example is not holding them correctly". Each pistol stuck straight out from the hip,
   its grip below the fist.
2. A quarter turn, straight down, the left hand's a mirror: "Still wrong. It should be at a downward angle in the right
   hand in the picture. Not mirrored".
3. One 45-degree layer for both hands: "Much better but its not fittest correctly in the left hand" - the picture's
   left. The picture's right has stayed round 3's, byte for byte, ever since.
4. Read as the doll's left hand, that gun was moved by eye: "Now the right hand is screwed up. Dude stop band aid
   fixing". Undone.
5. "The left gun should be upside down and held in the hand": rolled over on its barrel, still pointing down and out.
6. "Not quite, the left hand needs to be angled towards the the right hand gun": upside down by a half turn, the
   barrel down and in at 45 degrees. "Still wrong".
7. Guessing stopped there. The picture's left gun was rendered on the real doll in five ways, then six, then four, and
   the owner picked: "#4 is the closest but needs adjusting" (right side up - the sprite flipped - at 45 degrees
   toward the other gun), "C but lower" (60 degrees), "Sorry I meant #2" (2 px lower). This cut.

**Two hands on the doll.** A classic Either-hand weapon carries two doll records, TEXTURE.234's base for the left hand
and +1 for the right (`ui/paperDoll.js`). The Pistolet carries each hand's own layer (`PISTOLET_ART_RECORDS`: doll 0, icon 1,
gold 2 and 3, left 4 and 5), chosen by the slot it is worn in (`pistoletImageRecord`). A single Pistolet is worn in the
right hand, so it shows flipped, angled in toward where the other would be.

**Where they hang.** The fist's gap in every clean one-handed classic doll record (dagger, mace, shortsword, war axe;
the player's own ARENA2 via `tools/fetch-data.sh`) closes at panel (27, 96) on the right hand and (69, 95) on the left.
- The left hand's band centre (`dollGrip('left')`) is on its gap (`PISTOLET_PAPERDOLL_OFFSET.left`).
- The right hand's sits 2 px below its own, at (27, 98) - the owner's pick, not a rule (`PISTOLET_PAPERDOLL_OFFSET.right`). The
  doll's right fist is not the left's mirror (the right arm hangs straight, the left is bent at the hip), and no one
  rule seated both: the attempts at one are rounds 4 to 6.
- `pistolet.test.js` holds both places, each barrel's direction (the layer's pixels beyond the fist: down-left for the
  left hand's, down-right for the right hand's) and `HAND_POSE`.
- Checked on six bodies (Breton male and female, Nord male, Dark Elf female, Khajiit male, Argonian female): the hands
  are drawn in the same place, and each holds its gun the same way.

`tools/pistoletDollProbe.mjs` draws it on the real doll, beside a dagger pair and the gold pair, one row a body. The
bodies are its argument (`--body=DarkElf:female`, a Breton male unless named), so the six-body check is one command -
it drew one body until AUDIT PISTOLET D17. It judges what needs no eye - every body's three dolls drawn, each pair worn in both hands, no page errors - and exits 1 on a failure (M9). The owner's eye is the gate, as Mac's was on the Thunderlock's FIELD-GUN9.

## First person - one gun

Weapon types **Pistolet 19 / Pistolet_Magic 20**, past DFU's enum like the Thunderlock's 17/18. The same table
(THUNDERLOCK_ANIMS: an idle, six frames on every direction), and the same machine (`combat/playerWeapon.js`: the melee
one-shot with the ranged cooldown).

Its cadence is the owner's panel (`combat/gun/gunFeel.js` **PISTOLET_FEEL**):
- 12 fps, a 1400 ms reload, the hit on frame 2.
- The spring at kick 3; the room shake at 2 (the Thunderlock's 3, scaled as the lab's 20 is to 30).
- The three sounds `fire-shotgun`, `open-shell` and `close-ready`.
- The reload dip at 0.7 of its height.
- A flash that throws a torch's 14 (the rifle's 20).

**The lab reads that row back** (`src/tools/pistolLab.js` PISTOL_OPENING), FIELD-GUN6's one-way arrow. Tuning the lab
tunes the game.

**The art** (`combat/gun/pistoletArt.js`) is the lab's strip, cut at a fixed stride and hardened to 1 bit, at NATIVE
size: one art pixel is one pixel of the 320-wide surface, times the owner's 1.05. Its `pose` (width and raise) rides on
the art, and the Thunderlock's art carries its own now too, so the rig asks the art rather than a table. Two findings
were the strip's own:
- **The muzzle is read off the flash alone.** The Thunderlock's reading (`muzzlePoint`, the brightness the shot frame
  gained) assumes the gun stands still in its sheet. The owner's shot frame kicks the pistol and arm back inside the
  canvas, so "what got brighter" was 735 texels across the frame, centred on nothing. The flash is the only thing in the
  strip drawn at luminance 215 or more, so `flashPoint` takes the centroid of those: (0.16, 0.14) of the union box, on
  the flame.
- **The gilded frames gild the pistol, never the hand** (`pistoletGildKeep`). The Thunderlock's hand mask is tuned to
  its painting (a 10 px blur at full resolution, the fist from the bottom-left), and the Pistolet's frames move the
  pistol. So the rule is the pistol's colours: its brass, its teal grip, its steel and outlines. The leather, the skin
  and the brown shadows are never gilded. The grey sleeve shares the steel's greys, so it is told apart by WHERE it is:
  the grey reached from the frame's bottom-right corner, where the forearm leaves every frame.

**Weapon Widget's Bob and Inertia, tuned** (the owner's Bob.Length 146, SizeY 0.7, Inertia 2/2/0):
`gunWidgetSettings(null, PISTOLET_FEEL.widget)` keeps the player's module SWITCHES and takes the weapon's MAGNITUDES.
It parses them with the mod's own reader (`readWidgetSettings`, which gained a `preset: false` door) and lays them
AFTER Diverse Weapons' preset, which would otherwise put its own Bob and Inertia over them. **A departure from the mod:
a weapon's own tuning over a preset's.** The Thunderlock carries no tuning and reads exactly what it read.

The rig (`combat/weapon/weaponRig.js`) keeps its gun functions' names - `thunderlockHeld`, `drawThunderlock`,
`thunderlockMuzzle`, the host's door - and they serve either gun now. `heldFeel()` and `heldSfx()` hand each its own
row and clips; the voice, the toggle's clack, the spring, the dip, the slide and the flash's tint all read them. The
out-of-Pellets guard asks only whether the weapon is a gun (`isGunType`), which both are.

## First person - the pair

**The law** (`combat/twoHands/handsLaw.js`). `DUAL_GUN_TYPES` [19, 20] beside the melee `DUAL_TYPES`, and **a pair is
two of a kind** - two melee weapons or two Pistolets, never one of each. A swing and a shot are two machines' worth of
difference, and the sprite lane draws them through two doors. The mixed pair is a later slice's. The Thunderlock is
two-handed and never in a pair.

**The machine** (`combat/playerWeapon.js` `gunPair`). It is ONE machine, as a sword pair's is: one shot at a time, and
the hands take turns by the law's flurry (the lead opens, the other answers within FLURRY_WINDOW).
- What a gun adds is its RELOAD, and a pair's point is that each hand has its own. At a shot's end the machine's ranged
  cooldown moves onto the hand that fired (`_reload`), and the machine's own gate is left at the soonest either hand is
  loaded again.
- The pistol lab's one departure, carried: **a pull the law gives to a hand still reloading falls to the loaded one.**
  A sword can always swing; a pistol mid-reload cannot fire.
- A gun's flurry never starts a frame in (DUAL.FLURRY_FROM_FRAME): its six frames are a mechanism's.
- The off hand's shot carries DUAL's terms (0.8 damage, Agility's to-hit, its weight's held ticks, 0.8 of a blow),
  untouched. A shot's damage is rolled where it LANDS, after its strike is over, so the impact asks the gun it left
  (`PlayerWeapon.isOffHandItem`, read in `combat/arrowFlight.js playerArrowHitFoe`), and the duel's roll takes `off`
  for a shot as for a swing (`combat/duelCombat.js`). Every host weighs the shot's skill tally by the hand's blow.
  AUDIT PISTOLET A1/A2/D7: until then an off-hand shot landed whole - the terms were written here and applied nowhere.
- Each hand's reload is KEPT through a pair broken for a frame (a light lit, one pistol taken off) and a pair formed:
  the pistol left waits out its own reload, and a second pistol drawn beside a reloading one is loaded (AUDIT PISTOLET
  A3/B9). A technique is the lead hand's, never thrown by the off hand while the lead reloads (A6).

**The sprite** (`combat/gun/gunPair.js`, the module the rig wires - HOST-SPLIT). Each hand has its own widget rig,
spring, guard and reload clacks, on one clock:
- The left hand's rig steps FLIPPED, which gives Two-Hands' two sway rules for free: Bob outward, Inertia in the
  screen's direction.
- The resting pistol lowers GUARD.LOWER of its height while the other fires (the guard's rule is the hand that is not
  striking - the pistol lab's probe found the lab lowering both, and that rule is what the module carries).
- The draw is the rig's own `drawThunderlock` with a `hand`: the gun's frame, the left one in the mirror, the striking
  one drawn over. Each hand keeps its own muzzle record, and the shot leaves the barrel that fired it.
- The flash's light is thrown from the side the firing gun is DRAWN on (`systems/thunderlock.js
  thunderlockMuzzleLight`, which reads the side and reach the rig parks) - for a left-handed player, whose pair and
  single gun are drawn in the mirror, too (AUDIT PISTOLET A9/B1/D14: the side was the hand's, so a left-handed
  player's shots lit the wrong side of the screen).
- The pair's branch stands ahead of the melee pair's in the draw ladder.

**The balance, measured in the game** (`test/combat/pistolet_law.test.js` A4): the shots through the machine, the off
hand's share through the impact a shot lands on (`playerArrowHitFoe`, the span's top: 14 of 17, 0.82 - the integer
roll's rounding of DUAL's 0.8):

| | Shots a minute | Damage a second (the mean of the span, the off hand's measured share) |
|---|---|---|
| one Pistolet | 32 (1.9 s a shot) | 5.1 |
| a pair | 64 | 9.2 |
| the Thunderlock | 28 | 7.7 |

A pair lands about 20% more than the Thunderlock a second (the test holds it under x1.25). It pays for that with more
than twice its Pellets (64 a minute to 28), and both hands: no shield and no light. One Pistolet is the cheap gun, and
the pair is its reason. (Until AUDIT PISTOLET A4 the test multiplied by 0.8 itself and touched no damage code, while the
game landed the off hand's shot whole: 10.1 a second, x1.32, past the ceiling the test held.)

## The Sunken Sovereign is a Pistolet

`systems/gilded.js`: the serpent's Gilded record is an Ebony **Dwarven Pistolet**, where it was an Ebony Saber.
- It keeps its id (every hoard and save that holds one reads it), its make, damage, Agility and leech lines, its power
  Undertow (which charges on a shot that lands as on a swing) and its one-in-a-hundred drop.
- Its skill line is Archery. Its lore reads as a pistolet's.
- Its gold is the Pistolet's own pictures through the Gilded ramp, and in first person the pistol's pixels only.
- A saber minted before this keeps its template, as every save's item does, and stays LAWFUL: it is the record's
  saber era (`SOVEREIGN_SABER_ERA` - the Saber, Long Blade, its own saber lore), which the item law and the lore read
  through `gildedRecordOf`. AUDIT PISTOLET A7/C1/D8: until then a saber minted before this read as a forgery to the item
  law - a trade hold at every checkpoint, a market refusal, dropped from the siege arms. The item law moved to 10 and the
  account service with it. `Gilded.md` section 7 records it.
- A Legendary Pistolet is The Last Lock, the Thunderlock's record, which claims both guns (AUDIT PISTOLET C5: claimed by
  no record, every Legendary Pistolet rolled up as Wyrmbane, "Forged for a dragon hunt"). Its own Legendary is the
  owner's call.

## The Morrowind arm

The model is **built part by part and painted** (`tools/modelPistolet.mjs`, PISTOLET-MODEL, 2026-10-22). The first bake
extruded the inventory sprite a block deep, and the owner's answer was: "Uhhh can you make an actual 3d model and
texture it. This is bad".
- Every part is lofted from its own cross-sections, read off the owner's first-person frames:
  - an octagonal steel barrel with a muzzle swell and a dark bore, three brass bands and three steel bosses;
  - a ramrod in two brass pipes, under a brass reinforce at the breech;
  - a rounded brass lock with a teal enamel medallion (a Dwemer wheel) in a bezel on each side;
  - the pan, the frizzen and a curled hammer holding its flint;
  - a brass trigger guard and a steel trigger;
  - a teal grip raked 12 degrees back, a brass wrist band and a flared brass butt.
- Each surface is its own island in a 256x256 atlas (the Thunderlock's size), packed at one texel density.
- The texture is painted texel by texel from the surface it covers (`meshTexture.mjs bakeAttributes`: the texel's place,
  normal and baked occlusion). The paint has engraved brass (a Dwemer key pattern and rivets on the lock, the butt and
  the reinforce; a groove at each part's ends), brushed steel, teal enamel under brass scrollwork, and the dark bore.
- The Sunken Sovereign's texture is the same paint in gold leaf: every metal gold, and the enamel a deep gold under
  brighter scrolls.
- 2,226 triangles and 29 cm long - a stout horse pistol. The frame is the one the arm holds: +Y the barrel, +Z up, the
  grip's middle at the origin.
- The same NIF and DDS writers as the Thunderlock's bake. The bake is deterministic, and `pistolet.test.js` re-runs it
  against the committed bytes. It also checks that every part is modelled, every material painted, no two islands
  overlap, and the gold paint holds no teal.

Its rows (`characters/ownModels/ownWeaponModels.js`):
- It hangs on the Weapon Bone, and a pair's second on the Weapon Bone Left (`fpArm.js resolveOffWeaponParts` reads the
  same table).
- `PISTOL_GRIP_ATTITUDE` puts the grip through the fist at its own 12-degree rake, the fist high on it under the guard
  (PISTOL-STANCE, below).
- Morrowind has no pistol, so it borrows **MarksmanThrown (11)**, Morrowind's one one-handed ranged act. It shoots
  rather than swings (the shot rides the arm's "shoot release", as the Thunderlock's does) and has no ammunition arm, so
  nothing is drawn through the pistol. The throw clip only TIMES the shot and the draw: while the pistol is drawn the
  arms are the pistol's own stance's (`holdAs: 'pistol'`, PISTOL-STANCE).
- `fieldgunmw.test.js` walks every row: each preloads and resolves through the arm against the skeleton fixture.

**Not seen on a Morrowind body.** Morrowind's data is not freeware and is not in this container, so the model was
checked:
- read back through the port's own NIF reader;
- looked at by the author: renders of the mesh off the tree, and the painted atlas the baker's `--sheet` writes - an
  eye, not a committed check;
- BOUND in the tests, both NIFs, plain and gilded: each binds to the Weapon Bone and its texture resolves from the
  shipped archive (`fieldgunmw.test.js`), and `PISTOL_GRIP_ATTITUDE` is pinned (AUDIT PISTOLET D16: the Pistolet's
  meshes were only path-resolved before). The pair's left pistol keeps the grip's attitude on the Weapon Bone Left (C6:
  it hung in the raw mesh's frame).

It was not seen on Morrowind's own bodies: the stance below was chosen on renders of the vendored retail skeleton.

## PISTOL-STANCE (2026-10-22): held as a pistol, the idle and the aim

The owner, of the borrowed throw: "Yeah it needs its own stance. Same workflow we did to detail all the other
animations. It needs an idle and active state just like the thunderlock."

**Solved onto the gun** (`combat/gun/pistolStance.js`, RIFLE-STANCE's way - `Dwarven-Thunderlock.md`). While the pistol
is drawn, each frame places the gun in one of two stances, eased between them, and the climb rig's own solver puts the
hands on it through `poseAssembly`'s `hold` slot. Nothing about any skeleton is a number here: the body's frame is read
off its shoulders and spine (third person) or the eye (first person), every distance a share of the right arm's length.
- **One pistol**: the right hand on the grip; the empty left hand placed too (`free`), hanging at the side - so the
  throw clip's empty hand never shows.
- **A pair**: each hand on its own pistol, the left the right's mirror, on the Weapon Bone Left the mirror makes. That
  part is placed mirrored in x before its bone (rule 13, `placeAtBone`), so the solver aims the reflected frame - a
  first cut that aimed the right's frame missed the left wrist by 3 to 4.5 units.
- **The door** is `combat/gun/gunHold.js`: the row's `holdAs` picks the stance (`'rifle'` the Thunderlock's, `'pistol'`
  the Pistolet's); `combat/fpArm.js` reads it (`holdsRifle`, `rifleHold` - two expressions, no new lines in
  `createFpArm`, HOST-SPLIT), and passes `pair` (`offShown`). When the hold stands and when the aim comes up are the
  rifle's law, unchanged: on once drawn, off for the draw, the sheathe, the stone, a seat or a spell; the aim while it
  shoots, for 6 s after, and while a foe's harm on the player stands (`rifleStanceStep`, `setCombatReady`).

**Chosen by the owner's eye.** `tools/pistolStanceSheet.mjs` (and its first cut, the option sheets) drew the retail
biped in the port's steel plate holding the shipped pistol, posed by the real solver, from three sides and through the
first-person lens. Three idles, three aims, two pairs and three free hands; the owner picked, and said what was wrong:
- "You can definitely tell the grip is too high up when held" - the fist closed on the grip's LOWER half, the lock and
  barrel riding over it. Measured in the gun's own frame, retail's upper knuckles stood 0.16 under the grip's middle and
  the trigger's tip 3.4 over it. `PISTOL_FIST_UP` (2.4, `ownWeaponModels.js`) moves the mesh down the grip's own way in
  the attitude, so the fist closes from just under the guard to above the butt's flare, the thumb behind the tang. It
  holds in every pose, the clip's too.
- "the arms should be protruding more, not as scrunched up to the face" - the first aims stood the grip 0.92 of the arm
  out, and because the grip rides well ahead of the wrist that bent the elbow to 97 degrees. The aim stands it 1.12 out
  now (the arm reaches 1.17 straight): the elbow near straight, the gun far before the face.
- "when duel wielding the mirror is too close together" - the single aim turns in toward the body's middle, and its
  mirror met the two muzzles before the face. A pair holds its own rows (`pair`): each gun before its own shoulder.

| stance | third person (from the shoulder) | first person (from the eye) |
|---|---|---|
| IDLE, "low, muzzle down" | the arm at rest at the side, the muzzle 60 degrees down at the ground ahead | low in the right of the picture, 45 down, turned 22 in |
| AIM, "arm out, turned in to the eye line" | the arm out to 1.12 of its length (the elbow 148 degrees), the pistol level at eye height, in toward the middle and turned 7 degrees in | right of the crosshair and under it (its top 0.085 of the half-height below), the barrel turned 12 in so its side shows |
| A PAIR, "each straight out from its own shoulder" | idle: both muzzles down at each side; aim: both arms out (1.15), the guns level and parallel, a shoulders' width apart | one in each lower corner, each turned 8 in; idle low at each side |
| THE FREE HAND, "at the side" (one pistol) | hanging by the thigh, the fingers loose | low and out of the picture |

**Measured** (the sheet tool prints it): every wrist on its hold in every stance - the reach misses 0 - in both views,
single and pair.

**Not verified here, and said plainly.** This container has no Morrowind data: the stances were picked on the retail
biped's own rest and the MW-STEEL4 stand-in (retail's third-person bones with a camera at the eye), not on
`xbase_anim.1st.nif` or the female and beast bodies. The table is one frozen row for whoever has the data to move it;
`node tools/pistolStanceSheet.mjs` draws it again. The throw clip still times the shot; no recoil is added to the
third-person body (the first person keeps MW-GUN-FEEL's kick over the whole view model).

**Pins** (`test/combat/pistolstance.test.js`, 6): the row and the door; the fist high on the grip and closed round it;
third person (the idle's muzzle down, the aim level with the arm out and turned in, the free hand at the side, a share
between); a pair (both level, parallel, a shoulders' width apart, each top up); first person (the aim under the crosshair
and turned in, a pair one each side, the idle lower); the live arm with the shipped pistol (held drawn, the fight up and
down, a pair's left hand on its own pistol, off when sheathed). `tools/mutants/pistolstance.json`, 15 dead. PIN MOVED:
`pistolet.test.js` (the row held no stance) and `pistolet_pins.test.js` D16 (the grip's middle at the bone).

## Departures (Port-Ledger section A, PISTOLET)

- The arms solved onto the pistol while drawn, not the borrowed throw clip's (PISTOL-STANCE, RIFLE-STANCE's departure).
- The pair of guns: `DUAL_GUN_TYPES` and two of a kind beside Two-Hands' melee law.
- A gun pair's reload, hand by hand, and the pull that falls to the loaded pistol.
- A weapon's own Weapon Widget tuning laid over Diverse Weapons' preset.
- The doll's two hands for a custom weapon, by slot.

## What is still open

- **The stance on Morrowind's own bodies**: picked on the vendored retail skeleton (PISTOL-STANCE, above).
- **The mixed pair**: a Pistolet beside a sword.
- **A pistol's own sounds**: the owner picked from the gun lab's clips; a flintlock's pan and ramrod were never searched
  for.
- **The doll's placement**, measured on the classic records; the owner's eye is the gate.
- **A Legendary of the Pistolet's own**: it borrows The Last Lock (above).

AUDIT PISTOLET, 2026-10-22: `01-Overview/audits/Audit-Pistolet.md`.
