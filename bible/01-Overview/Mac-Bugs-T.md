# MAC-T - the ball over the torch-bearer, and the chat line's H, 2026-09-18

Mac, on the deployed build (main 502cdd7, the JAN1 merge):

> There's this ball of light that hovers over the third person character
> when having a torch equipped
>
> Also when typing in chat, if typing H, it triggers you switching your
> weapon hand

## T1 - the ball is the glare sprite, and "the hand" was measured from the camera

There is no light-ball object. The ball is EL7's bloom **glare sprite**
(`render/airPass.js` `GLARE_VS`), a camera-facing additive quad
`0.25 * sqrt(range)` across - for a torch of range 14, a torso-sized
ball - drawn for the player's own carried torch light.

The exemption meant to stop that was written as a distance from the
**camera**: "no glare within 1.5 of the eye" (`AIR_GLARE_MIN_DISTANCE`).
In first person the torch is 0.8 from the eye and the rule holds. In
third person the Morrowind camera stands 2.74 behind the hand (192 MW
units) and the EOTB camera further, so the exemption lapsed; the glare's
seven-tap presence test then found a surface at the light's depth - the
third-person **body billboard**, opaque and depth-writing - and took it
for a flame flat. JAN1's veto at the light's own pixel needs a surface
*nearer* than the lantern by more than the slack, and the body sits at
or behind the light, so it never fired.

**The same camera-distance proxy governed two sibling laws** - F3's
"the light in the hand takes no caster slot" (`shadowPass.js`
`SHADOW_CASTER_MIN_DISTANCE`, pinned to be the same number) and the
contact march's "never for the light in the hand"
(`enhancedLighting.js`). In third person the torch was the nearest
light and took the first caster slot: F3's "large shadow when you peek
round a corner" was back, unreported.

LIGHT-NEAR1 (2026-09-23): the proxy is gone from all three (the constants deleted) - it was dropping the lamp overhead as well as the hand (`07-Rendering/Enhanced-Lighting-Arc.md`, LIGHT-NEAR1).

**DFU's PlayerTorch is a bare point light. It has no flare in any
camera.** Morrowind's third-person torch is the mesh in the hand with
its own particle fire, and the port's third-person body is a 2D sprite
doll with no hand node, so there is nothing to hang a fire on; both
references agree that no ball belongs.

The fix says the fact **by name**, at the seam the four hosts already
share:

- `systems/playerTorch.js` - the torch record carries `carried: true`;
  `scenes/magicCandle.js` - the Light effect's candle too.
- `withPlayerLights` (`scenes/magicCandle.js`), the ONE composer every
  host goes through (six call sites: `world.js` twice, `exterior.js`,
  `worldModes.js` twice, `dungeon.js` - **no host edit**), builds a
  per-light `Uint8Array` mask riding the composed array. Per LIGHT, not
  "the first N": the same vararg list carries the dropped and thrown
  torches and the burning foes, which sit over real billboards and keep
  their glare.
- `render/renderer.js` lifts the mask BEFORE its cap cut (`subarray`
  returns a fresh view without it), shifts it by one under the lightning
  flash, and hands it to both passes.
- `render/airPass.js` - the glare skips a carried light.
  `render/shadowPass.js` - the caster pick skips it, and it stands `-2`
  in the caster table. `render/enhancedLighting.js` - the contact march
  reads `-2` off the same table. The camera-distance tests stay beside
  the flag as a belt for a light the player does not carry at the eye.

## T2 - the chat line's H is Janome's hand switch, from the field

The chat panel stops the field's keydown in the window's capture phase
(CG2 / AUDIT CHAT D2), so the host's bubble listener never fills its
ring from a typed line - and it listens to keydown alone. The host's
keyup listener was ungated, so a typed H's release reached `noteKeyUp`
and the frame read it as SwitchHand's up edge (DFU fires SwitchHand on
ActionComplete). **JAN1 paid this root** the same day, from the transport
window: the ring releases only what it captured. The build Mac reported
on had not yet deployed it. The pin drives the real panel and the real
ring through both phases, so the chat case is held by name.

## The campaign

`test/mact_bugs.test.js` (5). `tools/mutants/mact.json`: **10 mutants,
10 killed** - the flag dropped from the record, the mask marking every
appended light, the mask lifted after the cut, the flash forgetting to
shift it, the glare, the pick, the table and the march each forgetting
the flag, the up ring taking a release it never captured, the chat
letting the field's down through.

## Not seen on a GPU

The glare count and centres are driven on the fake GL; the shader by
source. Nobody has stood in third person with a torch. Worth a pass: T
to third person, light a torch, walk past a wall lantern - the lantern
glows, the character does not; the character's shadow is the sun's.
