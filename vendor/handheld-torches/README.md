# Handheld Torches 1.4.1 - RedRoryOTheGlen (ported 1:1, its textures vendored)

**Handheld Torches 1.4.1** for Daggerfall Unity 1.1.1, by
**RedRoryOTheGlen** (Nexus mod 780; the manifest's ContactInfo is the
author's e-mail, kept out of this note). The mod's own description:
"Auto-extinguishes torches and candles when drawing weapons with no
free hand." It is four MonoBehaviours - `HandheldTorches` (the hand
law, the keys, the first-person sprite), `HandheldTorchesProjectile`
(a thrown torch), `HandheldTorchesEnemyLight` and
`HandheldTorchesEnemyParticleEmitter` (a foe set alight) - and 39
textures of its own.

Mac (Lattymoy) handed the shipped zip (`Handheld_Torches-780-1-4-1`)
over on 2026-09-14: "Next mod to integrate 1:1 is this."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## What is here

- `handheld-torches.dfmod.json` - the shipped bundle's manifest,
  verbatim (title, version 1.4.1, author, DFUnity 1.1.1, GUID
  `5922796c-9fa0-4e2f-8aaa-7c9702015813`, and the 45 files it was built
  from: four scripts, this settings file, the manifest, 39 textures).
- `modsettings.json` - the seven sections as the bundle ships them:
  Handling, Throwing, Modules, Presentation, Bob, Inertia, Step,
  Compatibility. `src/systems/modSettings.js` restates every key under
  the vendor key `handheld-torches`, section and name joined with a dot
  (`Throwing.Chance`), with the port's own `Enabled` in front. Two key
  kinds are new to the port for it: TextKey (a Unity KeyCode name -
  the three bindings) and the two Tuple keys (a pair).
- `Textures/` - the mod's 39 PNGs, decoded from the `.dfmod`
  AssetBundle (Unity's import of each file, which is what the player
  sees): `112359_0-0..3` the first-person hand holding a lit TORCH
  (90x205, four frames) and `112359_1-0..3` a LANTERN (110x138), and
  `112358_*` the dropped lights - record 0 a torch (31x34, four frames
  with `_Emission` twins), 1 a candle (9x19, five), 2 a holy candle
  (15x21, five), and 10 / 11 / 12 the three DOUSED (one frame, no
  emission), which a light dropped into water takes.
- This note.

## Why the textures ARE here

The port's doctrine (`bible/01-Overview/Port-Doctrine.md`) keeps
ARENA2 and every render of it out of the repository - Seasons of the
Iliac Bay's and Weapon Widget's repaints are re-shaded classic sprites
and stay with the player's copy of those mods. These are not that: no
ARENA2 file shows a hand holding a torch or a torch lying on a floor;
the 39 images are the author's own pixel art, drawn in Daggerfall's
idiom. They are the mod's data the way Dynamic Skies' textures and
Windmills of Daggerfall's models are those authors' - vendored with the
author's permission (the line above), credited on the About screen,
and without them the mod's sprite and its dropped torches would not
exist at all.

## What is NOT here, and why

**The scripts.** The bundle carries `Handheld Torches.dll` (43,520
bytes), a compiled assembly; the four `.cs` files its manifest names
are not in the bundle. The port read the IL method by method - the
record is `bible/06-Systems/Handheld-Torches.md`, a table of every
method against where it lives in `src/systems/handheldTorches.js` and
`src/scenes/droppedTorches.js`. The DLL itself is the author's compiled
work and is not carried.
