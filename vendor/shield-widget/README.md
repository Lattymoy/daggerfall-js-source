# Shield Widget 1.6 - RedRoryOTheGlen (ported 1:1)

**Shield Widget 1.6** for Daggerfall Unity 1.1.1, by **RedRoryOTheGlen**
(Nexus mod 733; the manifest's `ContactInfo` is the author's e-mail and
is kept out of the copy here). The mod's own description: "Adds a
configurable shield sprite to first-person camera when your character
has one equipped."

It is the sibling of **Weapon Widget** (`vendor/weapon-widget/`, ported
as WW1) - same author, same DFU, same module shape. Where the weapon
mod CLONED DFU's `FPSWeapon` and hid the original, this one adds a
surface the game does not have: classic Daggerfall draws no shield at
all, so nothing is replaced and nothing is hidden.

Mac (Lattymoy) handed the shipped zip
(`Shield_Widget-733-1-6-17668108721.zip`) over on 2026-09-19: "This is
the next mod I want to integrate 1:1."

**Permission: [Mac: record the author's permission, or the link to it,
here - `vendor/weapon-widget/README.md` carries the same open line for
this author's other mod, and one answer closes both.]**

## What is here

- `shield-widget.dfmod.json` - the shipped bundle's manifest, verbatim
  but for the author's e-mail (title, version 1.6, author, DFUnity
  1.1.1, GUID `e59d8114-e9a2-4e8e-84e8-4666475dbb9f`, and the 604 files
  it was built from: the one script, the settings, the presets, the
  manifest and 600 textures).
- `modsettings.json` - the seven sections as the bundle ships them:
  Shield, Modules, Bob, Inertia, Animation, Step, Recoil, Compatibility.
  `src/systems/modSettings.js` restates every key under the vendor key
  `shield-widget`, section and name joined with a dot (`Bob.Length`),
  with the port's own `Enabled` in front.
- `modpresets.json` - the author's own presets, as shipped.
- This note.

## What is NOT here, and why

**The script.** The bundle carries `Shield Widget.dll` (24,574 bytes), a
compiled assembly; the `ShieldWidget.cs` its manifest names is not in
the bundle. The port read the IL method by method - the record is
`bible/05-Combat/Shield-Widget.md`, a table of every method against
where it lives in `src/combat/shieldWidget.js`. The DLL itself is the
author's compiled work and is not carried.

**The 600 textures.** Four archives - 112360 Buckler, 112361 Round,
112362 Kite, 112363 Tower - thirty records each, five frames each. A
record is a MATERIAL GROUP (ten of them) plus a CONDITION TIER (three),
which is what lets the sprite batter as the shield wears. They are
renders of ARENA2 art, and the port's doctrine
(`bible/01-Overview/Port-Doctrine.md`) is that A RENDER OF GAME DATA IS
GAME DATA - the same ruling `vendor/seasons-iliac-bay/README.md` records
for that mod's repainted flats and `vendor/weapon-widget/README.md` for
this author's other set. So they reach the game the way ARENA2 does:
FROM THE PLAYER'S OWN COPY OF THE MOD, at play time, and never from this
repository. Attach the mod's `.dfmod` through the textures pick (the
Mods page) and `src/combat/shieldWidgetAssets.js` reads the sprites off
it by the names the mod asks for.

**Without the bundle the widget draws nothing.** That is not a fallback
choice: there is no classic shield art to fall back TO, because classic
Daggerfall has none. The sibling can draw the vanilla weapon frame when
its own repaints are missing; this one cannot, and does not pretend to.

## The three mods it talks to

| GUID | message | in the port? |
| --- | --- | --- |
| `2942ea8c-dbd4-42af-bdf9-8199d2f4a0aa` | `onToggleOffset` | **yes** - Eye of the Beholder (`vendor/eye-of-the-beholder/`). Its third-person toggle hides the sprite. |
| `fb086c76-38e7-4d83-91dc-f29e6f1bb17e` | `onAttackDamageCalculated` | **yes** - PCAAO (`vendor/pcaao/`). The settings pane calls it "Vanilla Combat Event Handler"; it is the Recoil module's whole trigger. |
| `41284af0-81c7-4630-bbc5-a976efa162a0` | `getAnimator` | **no.** An FPS-models mod the port does not have. Its arm plays a `ShieldHand_` / `ShieldArm_` / `Unarmed_` + `Recoil` animator state and suppresses the sprite draw entirely. Recorded, not carried - the day that mod is integrated, the arm's condition becomes its own switch, as Meaner Monsters' unleveled-mobs arm does. |
