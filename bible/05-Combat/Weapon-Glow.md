# Weapon Glow - a weapon's element, drawn in the hand (WEAPON-GLOW1)

`src/systems/weaponGlow.js` (the law) + `src/render/weaponGlowGlsl.js` (the drawing, a leaf) + `src/render/renderer.js`
(`drawScreenQuadGlow`, `_glowField`, `_drawWeaponGlow`) + `src/render/characterSprite.js` (`drawRigSpriteBox`'s
`glowLook`) + the hands: `src/combat/weapon/weaponRig.js`, `src/combat/fpsWeapon.js`, `src/combat/weapon/weaponWidget.js`,
`src/combat/diverseWeapons/diverseWeapons.js`, `src/combat/fpArm.js` + the wire: `src/net/wire.js` (`LOOK_GLOW_RE`, `lookGlowOk`),
`src/net/remotePlayers.js`, `src/net/peer/peerBodies.js` + the switch: `src/systems/features.js` (`weapon-glow`),
`src/ui/settings/settingsMap.js` (the owner, 2026-10-16; audited the same day - `01-Overview/audits/Audit-Weapon-Glow.md`)

> "So you know how theres the weapons that have that magic outline with the sprites? What if we designed our own sort
> of animated outline for each element? And even introduced the same, more detailed design for the morrowind
> weapons?"

> "No, this is your baby. I want you to make the decisions and take this on. Im not worried about DFU parity. Keep
> everything in one PR."

## What it is

A weapon whose blow carries fire, frost or shock - the loot ladder's `elemental` line (LOOT4,
`06-Systems/Loot-Arc.md` section 6) or a Ruby's or a Sapphire's gem (`06-Systems/Gem-Sockets.md`) - wears an animated
outline of its element in the hand: fire's tongues climb off it, frost's rime breathes and glints, shock's edge
crackles and throws arcs. The classic sprite draws it in the sprite's own pixels; a Morrowind weapon draws it round its
model, and lights its own surface with the element besides. A Morrowind weapon that is enchanted and shows no element
takes the arcane glow - the enchanted look the classic hand takes off its WEAPO1xx sheet. Other players see a glowing
weapon on a Morrowind body as its owner sees it.

## Before

Daggerfall says one thing about a weapon in the hand: enchanted or not. ItemHelper.ConvertItemToAPIWeaponType promotes
an enchanted item to its `*_Magic` type, and the rig swings the WEAPO1xx sheet - the same frames, painted with a glow
(`combat/fpsWeapon.js` `weaponTypeForItem`). The port's ladder weapons carry more than that, and the hand said none of
it: a Magic blade with "+3 Fire damage" carries no DFU enchantment, so it swung the plain sheet; a Rare swung the blue
glow whatever its element; and every Morrowind weapon swung bare - `02-Formats/Morrowind-Rules.md` recorded the
reference's enchantment glow as not ported.

## The laws (`systems/weaponGlow.js`)

1. **The element is the blow's.** A weapon's element is what its blow carries: its `elemental` lines, rolled or
   socketed, read as the blow reads them (`lootRarity.js` `readLines` - a gem's line within its piece's cap; the same
   reader `lootPowers.js` `linesOf` hands `lootBlow`). Nothing else names one: a Legendary's power (Venom, Dragonfire,
   Chain Lightning) is its record's own, and a cast-when-strikes enchantment is a spell.
2. **One element shows** - the most of it; a tie goes in `PROC_ELEMENTS`' order (fire, frost, shock).
3. **Its strength is the band it reads in**: level 1 to 3, 2 to 6, 3 past 6 - a Legendary line above its floor, or a
   line and its gems together (`GLOW_LEVEL_EDGES`, the Magic and Rare bands' own tops). A Rare line of 3 reads 1, and a
   Legendary's at its floor (6) reads 2: the total says it, not the tier (AUDIT WEAPON-GLOW DOC-9).
4. **The outline says no more than the card.** An unidentified piece's lines are hidden (`rarityKnown`), and the hand
   hides its element with them: the classic hand swings what DFU swings (the WEAPO1xx sheet - the piece is enchanted),
   the Morrowind hand the arcane glow.
5. **Arcane is the Morrowind hand's own**: an enchanted weapon (`inventory.js` `isEnchanted`) with no element showing,
   at its one strength (`ARCANE_LEVEL`, 2 - the wire's `arcane2`). The classic hand's enchanted look is its sheet; a
   Morrowind model has no second sheet, so it is drawn. It is DFU's enchantment that answers, the ladder's switch or
   not: a MAGIC.DEF blade glows with the ladder off, as its sheet is swung either way. An Aetheric or a Gilded piece
   carries none - its powers are its record's - so with no element it swings bare in the Morrowind hand, as it swings
   the plain sheet in the classic one (AUDIT WEAPON-GLOW LAW-2: named in Not done).
6. **The switch**: the Features row Weapon glow (`weaponGlow`, on by default; `?weaponglow=off` the kill door), read
   every frame. The loot ladder's own switch answers first: off, no line is read, so no element shows.

The frame asks every frame (the held weapon's, and the arm's), so the ask builds nothing: the element is summed into
arrays kept for it, and every spec - `{ look, code, level, word, ramp, win }` - is built once, frozen whole, and
handed back as it stands (`glowSpec`; AUDIT WEAPON-GLOW LAW-3/LAW-5). The ten words are exactly the specs' (`glowWord`,
`glowFromWord`).

## The looks (`render/weaponGlowGlsl.js`)

An element's glow is an outline that lives: a band round the weapon's silhouette, hottest at the edge and cooling
outward in four steps of the element's ramp (`weaponGlow.js` `GLOW_RAMPS` - Daggerfall's way with light, a few palette
shades, never a smooth blend), its REACH - how far the band stands off the edge - moving:

| Look | Metric | Reach | Its life |
|---|---|---|---|
| fire | stretched up 1.8x, cut to 0.6x below | (1.2 + level) x two octaves of value noise, scrolled up the screen | tongues climb; an ember drifts up off the top now and then |
| frost | square (Chebyshev - ice is angular) | 0.8 + 0.8 x level, still spikes where a cell's hash says, a 3 s breath | a crystal glints white for a fifth of a second |
| shock | diamond (Manhattan - jagged) | 1.6 + 0.3 x level, arcs out where a stepped noise peaks, a surge on one in five of its thirds of a second | the band crackles in 2x2 blocks twelve times a second |
| arcane | round | 1.6 + 0.6 x level, a slow wave | an even halo that turns |

Inside the silhouette the weapon's own edge takes the element's light (the rim), so the outline reads as the weapon's
and not a sticker behind it.

**The clock** wraps at `GLOW_CLOCK_PERIOD` (240 s), and every rate is whole over it: a scroll's noise is periodic in y
over exactly the cells a period scrolls (`gwNoise`'s `py`), every pulse - and the arcane charge's swirl, 24 s a turn -
turns a whole number of times, every stepped
hash counts whole steps - so the wrap is a frame like any other. A wall clock (`renderer.js` `glowSeconds`), as the
elite foes' glow is: a look, the same in every pass.

## The two drawers

**The classic sprite** (`Renderer.drawScreenQuadGlow` - THE FOURTH 2D PRIMITIVE, beside `drawScreenQuad`,
`drawScreenQuadRun` and `drawScreenOverlayQuad`; `test/render/glstate.test.js`'s source law lists it and its bake,
`_glowField`). Drawn over the frame `drawScreenQuad` just drew, on the same rect and mirror; premultiplied, blended ONE,
ONE_MINUS_SRC_ALPHA; emissive - the room's light (MAC-I's tint) never dims it. All three classic drawers take it: the
sprite (`drawFpsWeapon`), Weapon Widget's clone (`weaponWidget.js` `draw`) and the Thunderlock (`weaponRig.js`
`drawThunderlock`).

- **The field, baked once** (AUDIT WEAPON-GLOW SPR-1). What a cell of the frame is - inside, its edge, or open and how
  far from the nearest solid cell in the look's metric, and whether that cell is below it - never changes, so it is
  measured once a frame, look and cut (`GLOW_FIELD_FS`, a small RGBA8 picture, drawn inside the primitive's own run and
  the frame's target and viewport handed back as a sprite pass hands them back), and the outline reads it once a pixel
  and moves its band over it. It was a search run for every screen pixel of every frame - up to 234 texel reads each:
  a fire outline at lv3 cost 80 times its sprite under SwiftShader (649 ms against 8). Read off the field, it costs 6
  (46 ms; `tools/weaponGlowProbe.mjs`'s frames, the lane's own probe). `GLOW_FIELDS_MAX` (128) fields are kept, the
  least recently drawn deleted first - two weapons' sheets and the Thunderlock's.
- **In the frame's own pixels** (SPR-4). A cell is a Daggerfall pixel of the frame - the drawer says the frame's size
  in them (`art`: a record's `width` x `height`, the Thunderlock's union box), solid when the texel at its middle is at
  half alpha - so an HD replacer's frame or the Thunderlock's 3.7 texels a pixel wears the classic outline's size, and
  its noise, shock's blocks and the embers' rise with it. A texel its cell disagrees with (an HD frame's antialiased
  edge) draws nothing: the frame shows there as it is.
- **The window holds the whole reach** (SPR-2). `GLOW_REACH_MAX` is each look's reach at level 3 with its noise at the
  top (fire 7.35, frost 6.1, shock 10, arcane 2.8 cells), the shader clamps there, and `GLOW_SPRITE_WINDOW` is every
  cell within it in the look's metric - fire looks eighteen rows DOWN for a solid cell (a flame stands over its weapon,
  and an ember rises `GLOW_EMBER_SLACK` past the band) and four up. The windows were a guess, and shock's band ran
  into its box's edge in every frame at level 3.
- **A cut is no silhouette** (SPR-3). A first-person frame rises off the bottom of the view, so its bottom row is the
  arm's cut, and a frame flush with the screen's side (`view`) is cut there: a cell past a cut reads as the edge cell
  beside it, so the arm takes no rim along the screen's edge, and the quad grows no pad there - no band hung under the
  arm or drawn into a retro pillar.

**While an element shows, the classic hand swings the PLAIN sheet** (`fpsWeapon.js` `plainWeaponType`, the `*_Magic`
promotion undone, and Diverse Weapons asked its plain set - `diverseWeapons.js` `moddedWeaponFilename`'s `enchanted`):
a fire outline round the blue-painted WEAPO1xx frames said two things at once. The rig asks once a frame
(`weaponRig.js` `askHeld`, beside `syncWorn`) and the art's choice, its cache key, its loader and the clone's type all
read that one answer.

**The Morrowind mesh** (`Renderer._drawWeaponGlow`, inside `drawCharacter`, in a sprite pass that is not read back -
the arm's picture and a third-person body's tile, `_spriteDepth`; the world pass draws none, and nor does the studio
bake: `renderCharacterSpriteImage` raises `_studioDepth`, so a still - the inventory's figure, an item icon, a head
portrait - bakes no moment of the glow; AUDIT WEAPON-GLOW DOC-11). `fpArm.js` `setWeaponGlow(spec, item)` hands the
arm the spec and the weapon it is of; the arm lays it on the mesh it draws (`mesh.weaponGlow`, first person and third)
only while the mesh holds THAT weapon and it is in hand (`glowShown`: AUDIT NET-1 - a swap waits on its archives, and
the arm still drawing the last weapon wore the next one's glow; NET-2 - a sheathed blade's glow drew nothing but still
grew a picture). The renderer lights the weapon's own shown ranges (`slot` 'weapon' - never the nocked arrow, never a
sheathed blade):

- **The outline** - BEFORE the body. The weapon's ranges again, one INSTANCED draw a range for every ring and ember
  (`glowRingDraws`, its rows in `uGlowDraw`; AUDIT MW-5 - it was a draw a range a ring, fire's 57 each re-binding its
  texture): shifted in screen space round twelve directions at each of four distances (`GLOW_RINGS`, in glow units),
  so the union of a ring's copies is the silhouette dilated to its band and the ring's fragment knows its band without
  searching; fire's shifts stretched up, and its embers nine more shifts above it - three heights (`GLOW_EMBER_RISE`),
  each straight up and a hair to either side (DOC-1). At the BACK of the pass, depth-written, an outer ring farther than
  an inner (`GLOW_RING_FAR` 0.999, `GLOW_RING_STEP` 1e-4): a shifted copy of a tilted blade can stand nearer than the
  blade's own surface at a pixel, and drawn after the body the rings painted over the weapon they outline (the probe
  saw it, below). The sprite target's depth is 16-bit, and its rings stand at least `GLOW_DEPTH_STEPS` of its steps
  apart (MW-2: they were 1e-5 apart and the two inner ones fell on one value, so the hottest band never drew). Opaque,
  because the arm's composite cuts at half alpha (`drawScreenOverlayQuad`). A third-person body's quad places each
  texel at the depth its picture says (BODY-DEPTH's `bodyDepth`), which stood a ring's texel a reach behind the body,
  under a wall's or a floor's - so a texel at `GLOW_DEPTH_FLOOR` or past it keeps the quad's own depth (MW-1).
- **The charge** - after the body. The ranges once more, additive with alpha masked (the composite's cut stays the
  body's), at the body's own depth with none written (LEQUAL, a hair toward the eye - `GLOW_CHARGE_PULL`: its vertex
  shader is another program's arithmetic): lit at its rim off the face's own normal (its derivatives taken before any
  discard - MW-7), and patterned by its element - fire boils up the screen, frost is facets that glint in turn, shock is
  veins that jump twelve times a second, arcane a slow swirl. The detail a model can carry that a 2D frame cannot.
- **Its unit** is a Daggerfall pixel: the first-person LENS's rows over 200 (`fpArm.js` lays `mesh.glowUnit`, so a
  Weapon Widget scale grows the outline with the arm - MW-8), a third-person picture's own rows otherwise, never under
  half a texel nor over eight (`glowUnit`). A batched body's place is counted from its own tile (`uGlowOrigin` - MW-4: a
  tile moves in the target from frame to frame, and its glow moved with it).

The program is the character program's skinned vertex shader with the glow's lines after its own position
(`glowMeshVs`, which refuses a source without exactly one of each needle, as `skinFaceFs` does), so a GPU-skinned
body's weapon glows where it is drawn. A third-person body's picture is padded for the outline (`characterSprite.js`
`drawRigSpriteBox`'s `glowLook`, `glowPad`: the reach in texels at the unit the PADDED picture draws at, a texel the size
it was; the larger of it and a foe's tells' room - MW-3: the window grew by a share of its height, which at a far
body's few rows was no texel at all). Both glow programs are warmed at idle (`lazyWarmSteps` - MW-6, SPR-6). Every
state is handed back as `drawCharacter` keeps it.

**A pair** (TWO-HANDS, merged after this slice - `05-Combat/Two-Hands.md` "Weapon glow on two hands"): each hand wears
its OWN weapon's element. The classic pair draws each hand's outline over that hand's own picture (`twoHands.js`
`drawClassicHand` - its rect and its mirror), each Weapon Widget clone is handed its own item's (`weaponRig.js`
`cloneFrame`), and the Morrowind arm lights its left blade's `offweapon` ranges with the left item's glow
(`mesh.offWeaponGlow`, `Renderer._drawWeaponGlows`: each slot its own pass) under the held glow's NET-1 law for the
second hand (`offGlowShown`: the blade bound, the pair drawn). The arm's held glow is the item the arm HOLDS (in a pair
the right hand's, whichever hand strikes - the weapon in use changes mid-blow, and the key guard would drop it for every
left blow). A third-person picture is padded for the larger of the two outlines.

## Online

The affixes that decide a glow never travel, so the look says it: a weapon in a hand carries `glow`, one of ten words -
`fire2`, `arcane2` (`weaponGlow.js` `glowWord`; `wire.js` `LOOK_GLOW_RE`, `lookGlowOk`, `validLookItem`) - written by
`remotePlayers.js` `composeLook` on every weapon of a player's look in a hand (`LOOK_GLOW_SLOTS`, the equip table's
RightHand and LeftHand) from the owner's card (law 4 holds: the owner's knowledge), whatever the owner's own switch
says. A weapon in a hand's alone (AUDIT NET-4: a weapon anywhere else is in no hand; the pattern takes the ten words a
client can say and no other), a PLAYER's look's alone (a foe's kit is said on its record - `foeBodies.js` `encodeWorn`
- which carries no glow, so a foe's weapon glowing on the host's screen alone would be one fight seen two ways), and
OMITTED when none, `class`'s law: a plain weapon's item keeps the bytes it always had. A glow changing (a piece
identified, a gem set) is a new look, sent by `setLook`'s compare. A peer's Morrowind body reads the word off the look
NOW (`peerBodies.js` `_arm` - the same template in the same hand is a new look), for the hand in use, never for a
gatherer's tool, a werewolf's claws or a creature, and glows by the VIEWER's switch; the stand-in entity keeps it by the
wire's one law (`peerStubEntity`, `lookGlowOk`).

**Relay world209** (`src/net/wire.js` RELAY_VERSION; its law row in `test/net/relayversion.test.js`; world208 on its branch, renumbered past main's INSTANCES world208 at the merge), NOT YET DEPLOYED. The
order does not matter: an older relay builds its look items from the fields it knows and strips the word (a peer's
weapon draws bare until the relay is deployed, and nothing else changes), and an older client never says it and drops
it on receipt (AUDIT DOC-8).

## Departures, named

- **ConvertItemToAPIWeaponType's promotion is undone while an element shows** (`plainWeaponType`): DFU has no element
  to show. With the switch off, or an element hidden by the card, the hand swings exactly what DFU swings. Diverse
  Weapons' `WeaponBasics.GetModdedWeaponFilename` reads the item's enchantment for its MAGIC set; the port's
  (`moddedWeaponFilename`) takes it as `enchanted`, the item's own by default, so the outline asks the plain set too
  (AUDIT DOC-13).
- **The outline wraps the frame's silhouette - the hand on the hilt with it** (AUDIT WEAPON-GLOW SPR-5, decided): a
  classic frame carries no mask of what is weapon and what is hand (the metal dye band marks the metal alone - a staff
  or a bow has none), and a hand holding a burning blade stands in its light. The Morrowind hand lights the weapon's
  own ranges, which a model has.
- **The Morrowind enchantment glow is the port's own.** The reference (`02-Formats/Morrowind-Rules.md`:
  npcanimation.cpp's weapon part, `addOrReplaceIndividualPart(..., enchantedGlow, &glowColor)` with `glowColor` the
  enchantment's effect colour) lays an animated texture from the player's archives over an enchanted part, coloured by
  its first effect. The port draws its own, from no archive: an element's look where the blow carries one, the arcane
  glow where it does not.
- Ledger A, WEAPON-GLOW1.

## Not done

- **The holstered weapon** (Weapon Sheathing, `06-Systems/Weapon-Sheathing.md`) does not glow: it is a part of its
  own, not the `weapon` slot, and the reference's glow on it is not ported either.
- **A classic-lane peer** (a billboard, Eye Of The Beholder's sprite) draws no glow; nor does a foe's weapon, nor the
  inventory's figure.
- **A Legendary's elemental power** (Venom's poison, Dragonfire) shows nothing of its own (law 1), and an **Aetheric or
  a Gilded weapon** with no element line is bare in the Morrowind hand - it carries no DFU enchantment for the arcane
  look to say (law 5; AUDIT LAW-2).
- **Enchanted armour and clothing.** The reference glows an enchanted part of any kind (npcanimation.cpp's
  `addPartGroup` / `insertBoundedPart` with `enchantedGlow`, `02-Formats/Morrowind-Rules.md`); the port glows the
  weapon alone (AUDIT DOC-15).

## THE FOUR HOSTS RULE

Nothing in a host changed. Every host builds its rig through the one construction seam, `createWeaponRig` - the
exterior bench (`scenes/exterior.js`), the streaming world (`scenes/world.js`), the interiors
(`scenes/worldModes.js`) and the dungeons (`scenes/dungeonContext.js`) - and the rig asks the glow, draws the sprite
and hands the arm its spec in every one. A peer's body glows wherever `peerBodies.js` draws it.

## Verification

- `test/systems/weaponglow1.test.js` (21 tests) - the law off producer-minted weapons (`applyRarity`, `addProcLine`, `setGem`,
  `exaltLegendary`, `mintHourlock`, `mintGilded`, DFU's own `createRegularMagicItem` off MAGIC.DEF bytes), the plain
  sheet, the sprite drawer's order, rect and measure, the fourth primitive's bake and its field cache, the windows
  against the reach, the Morrowind pass against a recording GL stub (the instanced rows, the unit, a tile's origin),
  the rings' depths at 16 bits, the third-person pad, the arm's own glow on the fixture rig, the shaders' edits, the
  clock's rates, the wire both ways, and a peer's body through `PeerBodies._arm`. Its mutants:
  `tools/mutants/weaponglow1.json`, fifty-eight, all dead.
- `tools/weaponGlowProbe.mjs` - the looks through the REAL renderer in headless Chromium (SwiftShader), on art that is
  not game data: a pixel sword drawn by the probe and a sword mesh built by it. Top row the sprite's outline (fire,
  frost, shock, and fire again on the same sword painted at three texels a pixel - its outline the first's size),
  bottom row the Morrowind pass (fire, frost, shock, arcane), at levels 1 and 3. It is how the rings were found painting
  over the blade (drawn after the body) and moved to the back of the pass, and how fire's reach and shock's arcs were
  tuned. Not run on ARENA2's frames or the Morrowind archives here: neither is in this repository. It writes to
  `weapon-glow-probe/` by default, which git ignores.
