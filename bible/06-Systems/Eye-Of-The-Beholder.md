# Eye Of The Beholder

RedRoryOTheGlen's Eye Of The Beholder 2.1, ported: a third-person camera and an eight-direction sprite body for players
without Morrowind data. The game's own third person draws a Morrowind body, which needs Morrowind data. This mod is the
body for everyone else. The player meets it by scrolling the mouse wheel out of first person. The sprites are the
player's own Daggerfall records, placed by our own measure, with our own deaths and class skins; the release's record
is in `01-Overview/Own-Work.md`.

## How it works

**One view ladder.** The mouse wheel walks one ladder from first person outward, and whichever body can answer does:
the Morrowind body where its data stands, else this sprite. The First / third person action (`TogglePerspective`,
Controls > Movement, default the mouse's forward side button) flips the view for whichever body can show
(`src/player/mwView.js` `mwViewTogglePerspective`).

**The mod's law is its IL.** Every law in `src/player/eyeOfTheBeholder/eotb*.js` cites an offset in the 2.1 assembly
(`[IL_xxxx]`). The mod's 61 authored methods are a ledger (`test/player/eyeOfTheBeholder/eotb_scope.test.js`): each is
either ported, with its symbol named, or has no twin, with a reason.

**The camera** (`src/player/eyeOfTheBeholder/eotbCamera.js`). A pivot on the body, an offset across, up and along the view, per-axis
obstacle casts that pull the eye in, a shoulder mirror with an automatic switch near a wall and a timer to revert it,
smoothing, three override sections (weapon readied, mounted, sailing) and a nine-row auto-toggle table. After the mod's
casts, one more cast runs from the head to the smoothed eye, so a wall on the diagonal never puts the camera inside it.

**The body** (`src/player/eyeOfTheBeholder/eotbBody.js`, `eotbBillboard.js`, `eotbSprite.js`). Eight orientations; a state table of
idle, move and death crossed with melee, ranged and spell, plus horse and werebeast sets; attack variants; its own
footsteps; and a first-person mode that keeps the sprite's shadow. Repaints wait three frames as the mod's do, and each
carries the view it is to paint, so a turn never paints the old view back. A melee blow plays one stroke: an even blow
the first half of the six-frame swing, an odd blow the second.

**A clip on the move plays whole.** While a swing, a cast or a loose plays, no stance repaint lands on it, and a turn
repaints the clip's own shown frame at the new view. A look changed later (a weapon or a piece) has its clips composed
before they play, `LAYERED_WARM_A_FRAME` frames a frame (`src/player/eyeOfTheBeholder/layeredWarm.js`), for the player
and for a walker's drawn weapon (`src/net/peer/peerRiders.js`).

**Facing.** The body faces its walk, and stood still its last facing, so the eye can go round it through all eight
views. A blow or a cast turns it to the camera while it plays, so it strikes where the player looks. This is
`Graphics.TurnToView` at Only When Animating (`src/systems/modSettings.js`); the pane keeps all four options.

**The cart and the lantern.** The mod's wagon follows the player (`eotbWagon.js`). A lit lantern can hang at the
sprite's hip, from Handheld Torches' own Lanterns at Waist setting (`eotbLantern.js`).

**Skins** (`src/player/classSkins.js`, `src/player/classSkinArt.js`). Each class skin is its classic sheet (`from`, the
TEXTURE file its pictures are sized by), built from the player's ARENA2 and painted by our rule, beside the mod's
sixteen on-foot and seven mount sets. ART_PAL's cloth, drape and metal ramps take the class's colours, and a trim, a
pattern, a sash, a belt, an insignia or a shield is drawn on the frame's own regions. The frame counts are the sheets'
own. A robed sheet shades a garment in the other cloth's near-black steps, so a cloth pixel in steps 13-15 joins the
garment nearest it (`shadeByNearest`, `SHADE_MARGIN`). TEXTURE.482's bare-chested figure (`BARE_SHEETS`) takes a
garment painted over the torso (`paintGarment`): `torsoOf` finds it in every frame, from the loincloth's top to two
rows under the helmet, as wide as the view's `TORSO_HALF`; the arms stay bare.

The Skin card has two panels, unmounted and mounted, each opened to pick a skin.

| class | sheet (m / f) | outer / inner / metal | marks | why |
|---|---|---|---|---|
| Acrobat | 482 / 483 | red / yellow / bronze | motley diamonds, a yellow sash; on 482 a motley jerkin | a tumbler's motley reads as a performer at any distance |
| Assassin | 490 / 489 | red / black / iron | a black belt | a blood-red hood and cloak over black, seen once and from behind |
| Burglar | 480 / 479 | grey / brown / iron | olive patches | drab for the night; the cloth is mended, not bought |
| Bounty Hunter | 482 | leather / black / iron | a studded leather harness, dark straps, brass buckles | worn leather and dark iron; the bandolier carries the trade |
| Dark Acolyte | 486 | black / olive / black | bone hems, a bone skull | necromancy's black robe and bone |
| Dark Brotherhood | 482 | black / black / black | a black wrapped tunic, a red sash, a red hand | the Brotherhood's black and its red hand |
| Daggerfall Adventurer | 483 | green / leather / steel | none | a traveller no guild has marked yet |
| Healer | 486 / 485 | white / gold / gold | gold hems, a gold sun | the temple's white, edged in gold |
| Healer with Shield | 486 | as the healer | a white shield with a sun on the left arm | the healer who stands in the line |
| Monk | 486 / 485 | saffron / brown / bronze | a rope belt | one robe and one cord |
| Nightblade | 490 / 489 | blue / black / steel | silver hems, a silver moon | the night's blue and a spellcasting thief's moon |
| Pirate | 484 | linen striped red / blue / bronze | a red waist sash | the sailor's stripes and navy |
| Sorcerer | 488 / 477 | purple / purple / gold | gold hems, a gold eye | purple for power, the armour gilded |

**The back holster** (`src/player/eyeOfTheBeholder/eotbHolster.js`). While the weapon is sheathed, a long blade, axe, blunt weapon,
staff, bow or Thunderlock in the weapon hand rides on the sprite's back and turns with it in every direction, for the
player and every other walker. Short blades and the Pistolet are not drawn yet. A flail stands with its handle upright,
cap on top, and its chain and ball hang from the cap beside the handle
(`src/player/eyeOfTheBeholder/eotbHolsterFlail.js` `uprightFlailPicture`; `loadBackPicture` is the door every body takes
the back's picture through).

**Riding with the Morrowind body.** On a horse whose 3D rig stands, the Morrowind body sits astride and the view works
as on foot. In the cart's saddle, or before the rig can draw, the Morrowind body holds first person.

**The art.** The 2,869 sprites in 23 sets are Daggerfall's own records (TEXTURE.096, .264, .269 and .475-.495, in
PAL.PAL or ART_PAL.COL). Each is a spec (`src/player/eyeOfTheBeholder/eotbDerived.json`), built from the player's own
ARENA2 when the body asks (`src/systems/classicArt.js`), a few milliseconds a task.

**The death** (`src/player/eyeOfTheBeholder/eotbDeath.js`) is ours: its first frame is the set's class struck, records
10-14 of its TEXTURE file (the werewolf's and the wereboar's too), and its second is that picture laid on the ground
by our code, a shadow under it.

**Placed by our own measure** (`src/player/eyeOfTheBeholder/eotbAnchor.js`). Each set's own pictures are measured: the
body's centre line (the median middle of each row's widest run, hips to chest) stands on the player's spot, and the
lowest foot on the ground. Records that share a picture are one family, and a family's pictures of one size share one
shift, so a swing keeps its ready stance's place and its lunge as drawn. A sheet drawn short of its view's standing
figure is scaled to it. `tools/eotbAnchors.mjs` writes `src/player/eyeOfTheBeholder/eotbAnchors.json` from ARENA2,
and `spriteOffset` takes the frame. Turning, the body's line moves 0.6 cm on average (10.5 at most); changing state,
0.2 cm. `Animation.GlobalOffsetScale`, with `FineGlobalOffsetScale`, scales each sprite's sideways and upward shift
(`src/player/eyeOfTheBeholder/eotbBody.js` `place`): 1 is the art's own.

## Rules

- **The mod, ported 1:1, for players who do not use Morrowind** (Mac). It sits beside the Morrowind camera, not in
  place of it.
- **The view scrolls like the Morrowind view** (Mac): the mod's `ScrollableZOffset` ships on here.
- **A force first person / third person toggle** is this game's own action (Mac). It shows on the mod's tile beside
  the mod's two keys (`src/systems/inputActions.js` `MOD_TILE_ACTIONS`), bound in Controls and never gated on the mod.
- **Our own sprites' placement, deaths and class skins** (OWN-WORK, the owner).
- **Retired keys:** `Camera.TogglePerspective` (the game's action is its job), `CameraScrolling.ScrollableZOffsetAxis`
  (a Unity input axis; the wheel is the page's own) and `Graphics.PingPongOffset` (the ping-pong no stroke plays). A
  saved value of a retired key is let go on load (`src/systems/modSettings.js` `RETIRED_KEYS`).
- **The shoulder switch is `B`**; the mod's `Tab` belongs to the pixel dial.
- **No third person in the Morrowind body's cart saddle** (Mac).
- **A lantern at the sprite's waist** (Mac), and **back-holstered weapons that turn with the sprite** (Mac): both this
  game's own additions.
- **A blow is one stroke, strokes alternating, no setting** (Mac).
- **Walking never cancels an attack animation** (the owner).
- **Players can see every rotation of their character** when idle, or moving with the camera facing another way (the
  owner): `Graphics.TurnToView` ships at Only When Animating.
- **A flail on the back hangs its ball and chain from the cap** (the owner).
- **Class sprites as skins in two panels** (Mac).

## Daggerfall Unity

The mod is two MonoBehaviours, `EyeOfTheBeholder` (the camera) and `PlayerBillboard` (the sprite), over DFU's own
camera and `Mathf.RoundToInt`. Departures from the assembly, each for its reason:

1. `ScrollableZOffset` on, the wheel driving one ladder for both bodies.
2. `TogglePerspective` retired; the game's own toggle action replaces it.
3. `SwitchShoulder` on `B`, because `Tab` is spent.
4. The extra cast to the smoothed eye, because the mod's three axis casts miss a diagonal wall.
5. A queued repaint carries its own view, because the mod's could paint the old view after a turn.
6. One stroke a blow; the ping-pong variant plays as None and Mixed as Mirror.
7. A clip on the move plays whole: a stance's delayed repaint is dropped while a clip plays, and a turn mid-clip
   repaints the clip's shown frame. The mod's `LoopIdleBillboard` runs beside a clip and repainted the walk between the
   swing's frames.
8. `Graphics.TurnToView` defaults to 1 (Only When Animating), not the bundle's 2 (When Weapon Readied), under which a
   readied body faced the camera and only ever showed its back.
9. Each sprite is placed by our measure of its own pictures, not the author's hand-tuned table; the deaths and the
   class skins are ours.
10. `GlobalOffsetScale` scales the shift; in the mod `get_scaleOffset` has no caller.

Not ported: Unity lifecycle and component plumbing, the mesh and material code the billboard batch replaces, Free
Rein's move vector (not in the game), the attack-from-body ray and DFU's mod bus.

## Code and tests

- `src/player/eyeOfTheBeholder/eotbCamera.js` - the camera
- `src/player/eyeOfTheBeholder/eotbBody.js`, `eotbBillboard.js`, `eotbSprite.js` - the sprite body
- `src/player/eyeOfTheBeholder/eotbAnchor.js`, `eotbDeath.js`, `eotbDerived.json` - placement, deaths, the specs
- `src/player/classSkins.js`, `src/player/classSkinArt.js` - the class skins
- `src/player/eyeOfTheBeholder/eotbWagon.js`, `eotbLantern.js`, `eotbHolster.js`, `eotbQuiver.js`, `eotbGlow.js` - the cart, lantern,
  holster, quiver and glow
- `src/player/eyeOfTheBeholder/eotbHolsterFlail.js` - a flail's picture on the back
- `src/player/eyeOfTheBeholder/layeredWarm.js` - a layered look's clips composed before they play
- `src/systems/modSettings.js` - the mod's fifty-four settings
- `tools/eotbAnchors.mjs`, `tools/backHolsterProbe.mjs` - the anchors from ARENA2, the holster probe
- `test/player/eyeOfTheBeholder/eotb_scope.test.js` - the method ledger against the IL
- `test/systems/eotb_camera.test.js` - the camera and the wall
- `test/player/eyeOfTheBeholder/eotb_billboard.test.js` - strokes and repaints
- `test/player/eyeOfTheBeholder/eotb_body.test.js` - a clip on the move, the warm, the free facing, the placement
- `test/player/eyeOfTheBeholder/ownaudit_eotb_anchors.test.js` - our anchors; mutants
  `tools/mutants/ownaudit_eotb_anchors.json`
- `test/player/ownwork4_classskins.test.js`, `test/net/skin2_class_skins.test.js` - the class skins
- `test/player/eyeOfTheBeholder/holster_flail.test.js` - the flail on the back
- `test/net/layered_peers.test.js` - a walker's warm
- `test/player/viewtoggle.test.js` - the perspective toggle
