# The Abyss Dungeon's Look

The visual law of the Abyss Dungeon (`Super-Dungeons.md`): the Hollow's Rift and Return, the step through, and the
Shattered Hour with its sky, islands, Orrery, Unmoored Steps, arena and the Brass Remnant. The Hour is one broken clock,
seen at a man's scale, that shows you its state. The lore and every gameplay law stay; this page governs how it looks.

## How it works

**Four rules.** The void is black. Metal and stone are structure, and do not glow. Light appears only where it means
something. Every surface reads as Daggerfall pixel art.

**Five lights, and no others** (`src/world/superDungeon/sdLook.js` `SD_LIGHT`, each imported from its existing home so no
pinned colour moves):

| Light | Means | Examples |
|---|---|---|
| Gold | the machine is live; it holds | an open Rift, lamps, a solid Beat plate, your waystone |
| Mantella | the Hour's soul, what the fight turns on | the heart, the Hearts, the Pulse, the Orrery's gem |
| Ember | about to fail | a Beat plate's last moment, a shaking Crumble, fray tabs |
| Moon | the way out, and only the way out | the Return, the way back, the way home |
| Red | refused, or the End | the End's fissures, the face cracking |

A white-gold flash (`SD_BEAM_CORE`) marks a beat landing. No meaning rides hue alone: shape, place and motion carry it
too, and the lab's `?grey` check separates every pair, because some Endings' lights sit near Moon and Mantella.

**The value ladder** (`SD_LADDER`). The void at or under 0.04; structure 0.06-0.25 (the arena floor never past 0.25);
ambient light to 0.45; signals 0.5-0.8; critical reads at least 0.7, peaking past 0.85. Only signals and critical
reads bloom. The Hour's grade is `SD_HOUR_GRADE`.

**Palette and pixels** (`SD_RAMP`, `src/world/superDungeon/sdPixelKit.js`). Textures are painted in code from ramps of at
least five steps - void, basalt, cobble, brass, verdigris, bronze, silver, pale stone, and the Bay's sky only inside the
windows home. A final `quantize` forces every texel into the palette. Floors are about 32 texels a metre with contrast in
features 4-8 texels wide, since there are no mips. Shader surfaces go through `SD_PIXEL_GLSL`, which snaps to Retro
Mode's own pixels when it is on.

**Motion.** The machine ticks on the realm's anchored second (`sdTick`). Smooth motion is danger. Inside the Hour hands
run backwards; on every way out they run forward (`handToTwelve`), checked through the camera's one mirror. Things
appear and vanish by dither, never fade. Nothing flashes past `TELEGRAPH_THROB_MAX_HZ`; heartbeats stay at or under
2.5 Hz (`SD_BEAT_BLINK_HZ`, `src/scenes/superDungeon/sdSteps.js`).

**The set pieces**, each built in its own module:

- The Rift and the Return: `sdRiftFace` and `sdReturnPlace` (`src/world/superDungeon/sdDungeon.js`), the Rift's art and
  pass (`src/world/superDungeon/sdRiftArt.js`, `src/render/superDungeon/sdRiftPass.js`).
- The step through: `src/render/superDungeon/sdVeil.js`.
- The Hour's sky: `src/render/superDungeon/sdSky.js`, `src/world/superDungeon/sdSkyArt.js`.
- The islands, floors and the Works: `src/world/superDungeon/sdIslandModel.js`, `src/world/superDungeon/sdWorksModel.js`,
  `src/scenes/superDungeon/sdHang.js`.
- The Orrery: `src/world/superDungeon/sdOrreryModel.js`.
- The Unmoored Steps: `src/world/superDungeon/sdStepsModel.js`, `src/render/superDungeon/sdStepsPass.js`.
- The arena: `src/render/superDungeon/sdArenaGlow.js`, `src/render/superDungeon/sdStompWall.js`.
- The Brass Remnant: `src/world/superDungeon/sdRemnantModel.js`, `src/scenes/superDungeon/sdRemnantRig.js`.

## Rules

- Keep the lore, rebuild the fidelity (Mac).
- The Orrery's rings turn in mode A, never following each stone's hour; the gearing is learned by turning, never shown
  (`SD_ORRERY_MODE_B` false) (Mac's ruling at its law-safe default).
- No safe wedges behind the arena's pillars (Mac's ruling at its default).
- No Numidium in the sky: the last of the Brass God is the Remnant.
- Nothing that turns may cast a shadow; anything that moves is `noShadow` or casts through a still stand-in.
- No `GL_LINES` for anything a player must read; no camera moves (no pitch, FOV or roll); no brighter fog.
- Pinned colours (`SD_FX_COLOR`, `SD_GLOW_COLORS`, `SD_BLOW_COLOR`, the Ending lights) stay where they are.
- Seven rig parts and their states stay; no visual larger than the law where the law reads shape.

## Daggerfall Unity

DFU has no Abyss Dungeon. The ramps are painted to Daggerfall's pixel art, and the Hollow's crater reads the player's
own ARENA2 floor texture at runtime, with a fallback in the lab.

## Code and tests

- `src/world/superDungeon/sdLook.js` - ramps, lights, ladder, tick, grade, pixel shader
- `src/world/superDungeon/sdPixelKit.js` - painting helpers and `quantize`
- `src/world/superDungeon/` - the set pieces' models and art
- `src/render/superDungeon/` - the passes: rift, veil, sky, steps, arena glow, stomp wall, halo, motes
- `src/scenes/superDungeon/` - the hosts: hall, hang, steps, remnant, end
- `abyss.html` - the lab: every view, knob and probe
