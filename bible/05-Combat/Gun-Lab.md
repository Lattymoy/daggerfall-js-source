# The gun lab — a new weapon type, prototyped before it exists

`gun-proto.html` + `src/tools/gunLab.js` + `tools/gunProtoProbe.mjs`
+ `vite.config.gun.js` (Mac, 2026-09-19)

## What it is, and what it is not

A lab. Mac has art for a weapon Daggerfall does not have — a gun, one
idle pose and a six-frame fire sheet — and the question a lab answers
is the one no source sweep can: what does it FEEL like on the classic
surface, at a real window size, with a real cadence.

**Nothing here touches the game.** `combat/fpsWeapon.js`,
`combat/weaponRig.js` and `characters/weapons.js` are untouched; no
module the game runs imports `src/tools/gunLab.js`, and
`test/gunLab.test.js` fails if one ever does. This port is a 1:1 DFU
translation — a gun is a DEPARTURE, and a departure gets prototyped
and judged before it is built, which is the same door
`grass-proto.html` and `water.html` came through.

## What it borrows, on purpose

The placement law, so the numbers tuned here transfer if the type is
ever built for real:

- **The 320x200 design surface.** `placeSprite` is FPSWeapon's OnGUI
  rect (FPSWeapon.cs:378-388, ported at `drawFpsWeapon`):
  bottom-anchored, stretched to the window, aligned
  Left/Center/Right with a fractional offset, with the large-HUD
  offset lifting it. The alignment enum is the port's OWN — asserted
  identical, not equal — and it moved to a leaf
  (`src/combat/weaponAlign.js`, which `fpsWeapon.js` re-exports, so
  its surface is unchanged) because three integers living in a module
  that reaches the CIF reader, the inventory and the Morrowind arms
  cost the lab's standalone build four megabytes of `.nif` it never
  loads. 656KB now, one chunk.
- **The handedness mirror** (:459-464): AlignRight becomes AlignLeft
  under the flip, AlignLeft is left alone.
- **The 1-bit cutout.** `drawScreenQuad` discards texels under 0.5
  alpha, so the background key here is hard-edged. A soft mask would
  look right in the lab and wrong in the game.

ONE declared departure: the sprite's width is a fraction of the
screen, not a CIF record's native size — these frames are PNG/WebP,
not `WEAPON*.CIF` records sized in native pixels.

The weapon sits on the **right** (`AlignRight`, offset 0), which is
where the classic weapons sit and where Mac asked for it. The page's
opening numbers are HIS, off the panel (2026-09-19): size 49, raise
-8, fire 14fps, reload 1700ms, hit frame 1; the screenshake at the top
of every slider it has — 30 native units, 4 degrees of roll, the
fastest rattle — with decay at 5, which is what makes a shake that
large survivable (it is over in well under a second); and a recoil
that is the opposite shape — kick 5, back 0, stiffness 400, damping
36. Small, fast, straight up, home inside a tenth of a second. Worth
knowing that is a CHOICE: a big slow kick is what a first pass reaches
for, and it fights the shake for the same moment and the reload for
the frame after it. The module's defaults follow the panel, so the two
open on the same weapon.

## Weapon Widget's own movement, on the gun

Mac: *"all the idle, bob enhancements from our in-game weapon mods
need to be applied"*. They are — by **running** them. `Offset`, `Bob`
and `Inertia`, and `GetWeaponRect`'s transform, are imported from
`src/combat/weaponWidgetMotion.js`, which is WW1's 1:1 port of
FPSWeaponClone's own modules; the settings come from the mod's
declared defaults through `readWidgetSettings`, so every multiplier
LoadSettings applies (Offset.Speed ×10, Bob.Length ÷100, SizeX/Y ×2,
SpeedMove ×4, SpeedState ×500, Inertia.Scale/Speed ×500, Forward
×0.2) is applied here too. The sliders in the lab's panel ARE the
mod's switches.

**The split.** Those four functions were inline in
`combat/weaponWidget.js`; the arithmetic is untouched, the component
imports them back and calls them where it used to do the work itself,
and `test/ww1_weaponwidget.test.js` passes unchanged. They are their
own file for two reasons: a second copy of a bob pinned to an IL
offset would be a second copy to drift, and the component reaches the
inventory, the equip tables and a vendored mod's mesh folder — four
megabytes of `.nif` the lab has no use for. `offsetStep` gained one
parameter, `hiddenTarget`, defaulted to the mod's own `[2, 2]`.

Three departures, all of them the gun's:

- **Inertia is ON.** The mod ships it off ("requires double-scaled
  weapon textures"); this art *is* high resolution, so the lab is the
  case that warning is about.
- **The reload lower** rides the Offset module's easing to a target of
  the lab's own — straight down, not the mod's diagonal sheathe.
- **The recoil** is not a channel at all (below).

## The recoil, the reload, and the shake

None of the three is something a mod could lend.

The mod's `Recoil` module recoils a **swing** — it replays the strike
animation in reverse when the blow lands — and a gun has no swing to
replay. So `createRecoil` is the lab's own, and it is a **spring**
rather than a curve keyed to the frame: the shot is a DISPLACEMENT
(the barrel is already up on the frame the trigger breaks; an impulse
puts the peak two frames late and a third of the size, which is the
first thing the probe caught), and the spring's job is the ride down.
A second shot fired into the recovery stacks on what is left, which a
per-frame curve cannot do. It is applied AFTER `widgetTransformRect`,
because the mod's transform ends in a floor — the rect may never rise
above its resting place — and a kick rises. Sub-stepped at 4ms so a
slow frame does not blow the spring up.

There is no reload animation, so the reload is the **Offset module**
with `shown` false: the weapon drops out of frame on the mod's own
easing and comes back up when it is ready. `Reload ms` is the
machine's cooling phase; `drop` is the target in units of the sprite's
own height.

**The screenshake is the CAMERA, not the weapon** (Mac, 2026-09-19).
The obvious build is wrong: a shake that moves the sprite is the
recoil again, louder. A gun going off kicks the *head* — so the room
and the target are drawn through the offset and the weapon, carried by
that head, does not move on screen at all. The crosshair is
screen-space and stays put. The probe pins exactly that pair: with the
kick, the bob, the inertia and the lower all off, the camera moves and
the weapon's rect moves 0.00px.

It is **trauma**, not a timer (Eiserloh, *Juicing Your Cameras With
Math*): a shot adds trauma capped at 1, trauma decays linearly, and
the shake is trauma **squared** — so two shots close together are much
more than twice one shot, and the tail falls away instead of stopping
dead. The displacement is three sines per axis rather than a fresh
random per frame, because per-frame randomness reads as static at
60fps and shakes twice as hard on a machine drawing twice the frames;
the pins hold both (a quarter of the shake at half the trauma, and
identical trauma after a second at 30fps and at 60fps), and that it
returns to *exactly* zero — the room is drawn through this every
frame, and a jitter with no shot behind it is an hour of chasing.

## What the lab has that the classic machine does not

A gun is not a sword. WeaponManager's six directional strikes and the
drag-to-swing gesture have nothing to say about one, so
`createGunMachine` is the smallest machine that can be judged —
`Idle -> Firing (6 frames) -> Cooling (the pump) -> Idle` — keeping
the two things the classic machine has that DO matter: a hit frame the
damage would land on (FPSWeapon.GetHitFrame) and a one-shot that
cannot be interrupted (FPSWeapon.OnAttackDirection).

## The art, and why it is sliced in the browser

`public/art/gun-idle.png` and `public/art/gun-fire-sheet.webp` are
OURS — on `test/doctrine.test.js`'s allow-list with that reason, no
ARENA2 pixel in them. The sheet is cut at runtime rather than
pre-exported as six PNGs, because that makes the background key a LIVE
CONTROL, and the key is the whole problem:

- The page white must die and the MUZZLE FLASH must live. A threshold
  sweep punches a hole through the flash core, so `keyBackground` is a
  flood fill from the border with a neutrality guard — background is
  reachable from the edge AND grey; the warm flash core is art even
  where it touches the edge.
- **The gun must not move.** Trim each frame to its own content and
  bottom-anchor it and the weapon slides a dozen pixels a frame,
  because the flash and smoke grow up and to the left across the
  cycle. So: ONE union box for all six frames (they are registered to
  each other in the sheet by construction), with the layout computed
  from the ANCHOR box — frame 1, the gun with no flash on it — so
  Center centres the WEAPON and the flash overflows around it.
  `tools/gunProtoProbe.mjs` measures the drawn rect on every frame of
  a live shot and fails on any drift.

## The sound

Mac handed over a Freesound key: *"comprehensively find some great
sounds to fit in for shooting and reloading. Needs to match the
daggerfall aesthetic."*

**The aesthetic is not a search term.** Every classic effect is raw
unsigned 8-bit mono at 11025 Hz — `DAGGER.SND`'s parameters, stated at
`src/formats/sndFile.js:3` — and that grit and that missing top octave
are what the ear reads as this game. A 48kHz shotgun sample sits on
top of this world rather than in it. So the search looks for a good
*recording* and `tools/sndify.mjs` makes it Daggerfall's:

    trim → lowpass at 4961Hz → resample to 11025 → quantise to 8 bits

No dither. The quantisation noise is not a defect to smooth away — it
is the texture every classic effect has, and a dithered bake sounds
cleaner *and* more wrong. The trim matters as much: a field recording
routinely carries 50–400ms of room before the shot, and a trigger that
answers 200ms late does not feel late, it feels *broken*.

**The pipeline**, all four steps re-runnable:

| tool | what it does |
| --- | --- |
| `tools/freesoundPick.mjs` | searches Freesound over 27 curated queries across three slots, CC0 only, ranks by damped rating × downloads × brevity, downloads the previews. `npm run gunsfx:find` |
| `tools/sfxBake.mjs` | decodes them **in headless Chromium** (`decodeAudioData` — there is no ffmpeg here, and Freesound's token auth only reaches the mp3 preview), bakes each one, and measures what it *is* |
| `tools/gunSfxInstall.mjs` | the curated end: 13 picks → `public/sfx/`, with `SOURCES.md` written from the search report |
| `tools/gunSfx.mjs` | our own synthesised set, through the same bake — nothing recorded, nothing to attribute. `npm run gunsfx` runs both |

**Judged on four numbers before it is judged by ear**, because the
bake changes what matters: *attack* (a shot is under 10ms; the bake
blunts a 200ms onset into a swell), *crest* (a single event is 15dB+;
a squashed one goes flat once 8 bits take the top off), *tail* (past a
second it smears the next shot, and the cap fades over 30ms so the cut
is not a click), and *brightness after the bake* (a recording whose
character lives at 6kHz arrives thin, because that octave is gone).
The picks sit between 900Hz and 1.8kHz of centroid, which is where the
classic effects sit.

**Three slots, because the reload has two ends.** A gun that goes
clack… clack across 1.7 seconds reads as a mechanism; one clip fired
at the start of a long reload reads as a sound effect that finished
early. `fire` plays on the shot, `reload-open` as the weapon starts
down, `reload-close` timed off the machine's own `cooledMs` so the
lock-up lands *with* the sprite arriving.

**Every pick is CC0** — the only license that clears
`public/README.md`'s bar for what ships out of `public/` without an
attribution trail to maintain. All 16 files are on
`test/doctrine.test.js`'s allow-list, `public/sfx/SOURCES.md` names
every one with its uploader and link, and the probe fetches all 16 and
fails if any is not RIFF / 11025 / 8-bit / mono.

The one liberty is **pitch variance** (±6% by default): Daggerfall
plays a clip at its own rate every time, but a gun fired six times in
four seconds is exactly where the ear catches a sample repeating. Zero
the slider and the clip is the file.

## The paperdoll and the inventory

Mac: *"treat this like the other weapon sprites, it needs a gap for it
to fit into the paperdoll's right hand."*

**One sprite does both jobs, which is why the gap is not optional.** A
weapon's paperdoll layer and its inventory icon are the *same record*
in Daggerfall — `GetInventoryTextureArchive` hands back the item's
`PlayerTextureArchive`, the very field the doll draws from
(`src/characters/paperdollArt.js`) — so whatever is cut out of the
sprite is cut out of both. That is exactly why classic weapon icons
have a notch in them: it is not an icon with a hole, it is a doll
layer being shown in a list.

**The gap.** The doll composites bottom-up and weapons carry
`drawOrder` 100, so the weapon lands *on top of* the body, hand
included. Transparent pixels are the only way the fist reads through.
It is cut as a **band across the grip at the grip's own angle**, not
as a circle punched into it, and the reason is what it leaves behind:
a band severs the grip cleanly so the receiver stays above the hand
and the butt stays below it, and the eye reads two ends of one grip
with a fist between them. A circle leaves a ragged crescent and reads
as damage — which is how the first pass looked.

`tools/gunPaperdoll.mjs` (`npm run gunart`) does it, with
`tools/pngIO.mjs` for the PNG (no image library in this container, and
two functions that are mostly zlib are not worth a dependency):

- **trim** to the alpha box, then **box-average downscale weighted by
  alpha**. Nearest-neighbour is the reflex for pixel art and it is
  wrong in this direction — 1790px to 72 keeps one pixel in
  twenty-five and turns every rivet into aliasing confetti. The alpha
  weighting is what stops the outline bleeding toward black at the
  edge.
- **harden the alpha to 1 bit**, because the port's own law is 1 bit:
  `drawScreenQuad` discards texels under 0.5 and the classic art is an
  indexed bitmap where index 0 is simply absent. A soft edge looks
  right in a PNG viewer and wrong the moment the game draws it.
- **punch the band**, then write `public/art/gun-paperdoll.png` (72×22)
  and `public/art/gun-ammo.png` (22×22 — it has to fit the 50×38 list
  cell).

**72px wide is not a look, it is the grip.** The doll's fist is about
8px across and the grip is a quarter of the art's height; the gun has
to be big enough that a fist-sized hole lands *on the grip* instead of
eating the receiver with it. At 56px the first attempt severed the
receiver and left the butt as a floating chip.

**What this container cannot answer:** there is no ARENA2 here, so
there is no real doll to lay the sprite over and the exact hand pixel
is a judgement call. `--sheet` renders four candidate bands side by
side with a stand-in fist behind the gap, for whoever has the game to
pick; `--band=cx,cy,deg,thick,length` sets it (cx,cy as fractions of
the trimmed art, so they survive a change of `--width`).

## Running it, and deploying it on its own

    npx vite            # then open /gun-proto.html
    npm run gunproto    # the probe: boots vite, drives Chromium, writes
                        # idle, the six frames, the bob and the reload
                        # to scratch/gun-proto/

Controls: click fires, and the same click asks for the pointer lock
(the Inertia module needs a look to lag; where the lock is refused —
an embedded frame, headless — the shot still goes off). Space fires
too, hold either for auto. W walks, Shift runs, C crouches, S stops.
Arrows scrub frames while idle, G draws the slice boxes, Tab hides the
panels.

**Its own deploy** (Mac: *"I want to test this as its own deploy"*).
`vite.config.gun.js` builds the lab AND NOTHING ELSE into `dist-gun/`
— the page, its module, its art, its sounds, an `index.html` — with a
RELATIVE base, so the output runs from any directory:

    npx vite build --config vite.config.gun.js

`deploy.yml` mounts that build at **`/preview/gun-lab/`**, the same
shape the exact-face-atlas preview uses and for the same reason: Pages
serves one site per repository and only `main` may publish. The lab
builds from its own config, so a broken game build cannot take the
lab's link down with it. The page asks for its art and its sounds
relative to `document.baseURI`, which is what makes one build work at
the site root and under a preview path.

## If it graduates

What the lab does NOT answer, and what building the type for real
would have to: an `itemTemplates.json` entry and a template index, the
damage/skill table rows, ammunition, the hitscan or projectile the
shot becomes, loot and shop reachability, and the sound. None of that
is prototyped here, and none of it should be written until the pose
and the cadence are settled.
