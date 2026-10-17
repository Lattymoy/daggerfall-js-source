# FIELD BUGS 2026-10-16 - the horse in first person, in the light

One report from Mac, 2026-10-16, read on the code as it stands at main's `7e0424e0`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Horses in first person should be affected by lighting" | MAC-I tinted every first-person sprite of the weapon's seam with the room's light; the riding sprite is drawn by the mount rig, outside that seam, and stayed white | fixed (HORSE-LIT) |

## HORSE-LIT: the mount wears the room's light

`src/player/mountRig.js` frame, drawNeckBand.

FOUND. TransportManager.OnGUI (:285-318) draws the ridingTexture untinted, and TR2 ported it so: `mountRig.frame` drew
MRED00I0 (the horse) or MRED01I0 (the cart) through `drawScreenQuad` with no colour, which is white. MAC-I
(`10-UI/UI-Arc.md`) gave the weapon, its widget clone, the casting hands and the torch hand `FPSWeapon.Tint` from
`renderer.flatLightAt` - the light a flat takes, sampled at the camera - but that read lives in `combat/weapon/weaponRig.js`'s
draw, and the mount is drawn one call before it, by its own rig. So at night, in a cave mouth or under a storm the
weapon darkened with the world and the horse's neck under it stayed as bright as noon.

FIXED. The mount rig reads the same tint, the same way: `fpLightingOn() ? flatLightAt() : white`, once a frame, at the
camera. The sprite takes it, and so does RR2's neck band (EnhancedRiding fills the gap under a lifted sprite with a strip
of the same picture - a white strip under a dark neck otherwise). The cart's sprite takes it with the horse's. The
switch is MAC-I's (Features -> First-person lighting, `?fplight=off`), so the horse and the weapon light and unlight
together; a renderer with no clock's answer (the test room, a probe) draws white, as its flats do.

Not changed: the 3D horse (COATS3D, `mwViewDrawSaddle`) is rendered from the world's own camera at its world position,
so it already takes the world's sun, ambient and every point light - it needs no tint. The Eye Of The Beholder lane hides
the first-person horse (`mwViewHides`), as before. Both hosts that ride (`scenes/world.js`, `scenes/exterior.js`) draw the
mount through the one rig (MAC-K3), so neither host changed; `worldModes.js` and `dungeonContext.js` draw no mount
(no riding indoors or underground).

`test/player/fb1016_horselit.test.js` (2), `tools/mutants/fb1016_horselit.json` (6, 6 dead). Two source pins re-aimed at the
tinted draw: `test/scenes/hc1_horsecart.test.js` HC1/MAC-K3 and `test/systems/auditrr.test.js` AUDIT-RR F14/F25. Ledger A: THE MOUNT TAKES THE
ROOM'S LIGHT. Not seen in play here (this container has no ARENA2); the pins drive the real rig.
