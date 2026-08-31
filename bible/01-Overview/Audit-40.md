# AUDIT 40 - THE SKY AND WEATHER LAB (2026-08-31)

Mac: a deep comprehensive audit over everything in this prototype,
ensuring perfection. Method: the lab read against the game it claims
to be 1:1 with - enhancedSky.js and its shader - term by term, and
against itself for the seams the front introduced.

## Findings

**F1 - THE CPU CLOUD OCCLUSION WAS A LOOKALIKE.** enhancedSky's own
comment says the point of sunOcclusion is that the disc and the
ground cannot disagree, "because it is one field evaluated at one
direction". The lab rebuilt that field out of ITS OWN periodic noise
and a LINEAR ramp where the game uses smoothstep - up to 0.096 of
cover wrong mid-transition, on the term that dims the entire world
when a bank crosses the sun. It is the game's hash, the game's fbm
with its per-octave (17.1, 9.7) offsets, and the game's smoothstep
now.

**F2 - TWO CLOCKS FOR ONE FIELD.** The shader's clouds ran on the
frame's own `now`; the CPU occlusion ran on a `performance.now()`
read a moment later. The drift grows with frame cost, so the sky and
the ground disagree WORST exactly when the machine is busy. One
clock.

**F3 (the big one) - THE GAME PREPARES ITS SKY STATE, AND THE LAB WAS
SKIPPING ALL OF IT.** enhancedSky computes six things before the
shader ever runs, and the lab handed the shader raw palette rows:

  1. weather greys the dome by `grey * (0.35 + 0.65*day)`, so a storm
     at noon is grey and a storm at midnight is still night;
  2. the clouds go to NIGHT colours through a twilight term - the lab
     lit them with day colours at every hour, so midnight had bright
     white banks over a black sky;
  3. THE LIT SIDE TAKES THE SUN'S OWN COLOUR near the horizon, which
     is the thing that makes sunset clouds burn orange, and it was
     simply absent - in the exact feature Mac asked for;
  4. grey eats the glow (`glowAmount * (1 - grey*0.7)`), so an
     overcast dawn does not blaze;
  5. cover eats the stars (`stars * (1 - cover*0.5)`);
  6. the moons are faint by day and dimmed by cover.

All six ported. The sun-visibility threshold was -0.05 in the lab and
is -0.02 in the game; corrected.

## Verified

- The sky FRAGMENT SHADER is the game's own text, lifted whole - dome
  exponent, below-horizon fall-off, azimuth glow, two decks, rim and
  belly, cube snap, retro posterise, star wheel, moons.
- The front's easing feeds the SAME weather row into the shader, the
  occlusion and the world terms, so a transition cannot desync.
- The particles' wind vector and the sky's cloud wind are separate on
  purpose: one is a wind at ground level in m/s, the other is the
  deck's drift in dome units, and the game has always kept them apart.
- The blades' pixel-art pass is fully removed - snap, ramp, cutout,
  uniforms and toggle - with no dead uniforms left bound.

## Not covered, said plainly

The front, the fine sunset keys, the two-scale detail tiling, the
normal-mapped ground and the instanced grass are all LAB work and
none of it is in the game. Bringing any of it across is its own arc:
the terrain shader has no normal or lighting path, the tile array has
no mipmaps, and the renderer has no instanced draw.
