# EE9 - THE SURFACE FIELD: DESIGN (2026-09-01)

Mac: "I notice the snow is still a texture on the ground. Did we not
implement the way snow builds and melts? We're going for 1:1 parity."

Not yet. EE4's snow identification is the declared bridge; this
document is the design that replaces it. Per the arc plan, the field
is designed before it is coded, because it is the one slice that
cannot be a second plane laid over the terrain the way the lab did it:
it has to feed the terrain chunker's own vertices.

## What the lab does, as laws

The lab's field is one RGBA texture over 64m around the player, one
texel to ~25cm: R water, G snow, B pack (trampled), A wear (the trail
after the print heals). Its laws, each of which ports:

1. **Water pools in hollows.** Accumulation is weighted by the terrain's
   own concavity; puddles gather in dips and run off rises.
2. **Snow lies on the flat.** Accumulation scales with flatness.
3. **Snow is a height, not a colour.** It displaces the ground; packed
   snow sits lower than fresh, so a trail reads as a trail.
4. **Walking deforms it.** A step compresses rather than deletes, throws
   a little to the rim, and leaves wear that outlasts the print. A
   step in water pushes the water out - the splash.
5. **Melt is a conversion.** Warmth turns snow into water at a third of
   its depth, and the sun dries the water, slower in a hollow.

And the rendering: fresh snow near-white and sky-lit, packed snow
duller and bluer (denser ice scatters less - the only reason a trail
is visible on a white field); a sparse sharp sparkle, killed by pack;
puddles dark, smooth and Fresnel-reflective; grass buried
geometrically (a blade shorter than the snow is gone, and the snow
line clears the tallest blade); rain ripples on standing water.

## The clock, and the two shapes

The lab has no calendar: snow falls while the dropdown says snow. The
game has Daggerfall's clock, its seasons, and the winter archives that
already turn the world white in midwinter. Two honest shapes:

**A - persistent.** Snow depth is STATE, accumulated and melted over
real play, saved with the game. A storm leaves snow that is there
tomorrow. Closest to the lab; also the most work, the most save-format
risk, and it can desync from what the season says the world should
look like (a saved summer with a foot of snow on it).

**B - calendar plus dynamics.** The BASE depth is a function of the
calendar and the climate - deep in midwinter, gone by spring, never in
the desert - and the lab's dynamics ride ON TOP: a storm adds, warmth
melts, feet deform, and the deviation from the base decays back toward
it over hours. Nothing to save; it can never disagree with the season;
the storm-and-footprint feel is intact.

RECOMMENDATION: B. It is 1:1 with what the lab makes you SEE - snow
building through a storm, prints in it, melt into puddles, puddles
drying - and it stays inside a world whose seasons are already
decided elsewhere. If Mac wants A, B is its first half regardless.

## Warmth, per climate

Mac: "climates will definitely need a sort of texture function that
determines how much snow stays/melts depending on warmth."

    warmth(climate, dayOfYear, minuteOfDay, weather)
      = base(climate)                         desert 1.0, subtropical 0.9,
                                              temperate 0.5, swamp 0.55,
                                              mountain 0.2, haunted 0.45
      + season(dayOfYear)                     -0.4 midwinter .. +0.4 midsummer
      + diurnal(minuteOfDay)                  -0.15 pre-dawn .. +0.15 mid-afternoon
      - overcast(weather)                     0.1 under a deck, 0 clear

    baseSnow(climate, dayOfYear) = clamp(0.5 - season - base, 0, 1) * flat
    melt rate  = max(0, warmth - 0.5) * k_melt
    stay       = warmth < 0.5

So a desert winter holds nothing, a mountain winter holds it all, a
temperate winter holds it on the flats and loses it on a south face
by afternoon, and a storm on a warm day makes slush that is gone by
dusk. The archives' x03 winter sets are no longer consulted for the
GROUND: the summer archive's materials draw, and the field lays the
snow. (Trees, flats and roofs keep their winter variants; this is the
ground's law.)

## Where the field lives

Per terrain PIXEL, on the chunker's own grid: 129 x 129 corner samples
per pixel is one sample per 6.4m tile corner, which is too coarse for a
footprint. The field therefore runs at 4 x 4 cells per tile - 512 x 512
per pixel, 1.6m a cell - which is coarser than the lab's 25cm and fine
enough for a trail, a drift and a puddle. A print stamps a 2 x 2 cell
disc.

The field is ONE RGBA8 texture per near-ring pixel (stride 1 only, the
same ring the grass lives on), 512 x 512, updated on the CPU at 10 Hz
and re-uploaded in whole rows that changed, never the whole texture.
Far-ring pixels carry the BASE depth only, in a uniform, so the horizon
is white in winter without a texture behind it.

## How the terrain reads it

**Displacement** is in the terrain VERTEX shader: the field is sampled
at each vertex (6.4m apart on the near ring) and the vertex rises by
snowDepth * SNOW_M. A vertex every 6.4m cannot show a footprint, so
the print is carried by the NORMAL and the ALBEDO in the fragment
shader, where the field is sampled per texel - which is exactly how
the lab ended up doing it too once its near patch was measured. The
lab's second plane is not ported.

**The fragment terms** are the lab's: fresh vs packed snow colour by
pack, sparkle gated on pack, puddle darkening and Fresnel by water
depth, ripples under rain. The tile's own normal (EE6) gives way to the
snow's slope where snow covers it.

**The grass** (EE7) reads the same field per blade: root planted on the
snow surface, height reduced by the depth, and buried entirely when
shorter than it - the lab's geometric burial, with the snow line a
uniform derived from the tallest blade so full snow always buries the
sward whatever the density door says.

## Deformation

The player's steps stamp the near-ring field at the world position of
each footfall (the same 0.75m stride alternation the lab uses). NPCs
and animals do not stamp in the first version - it is a cost question,
and the player's own trail is the effect Mac asked for. The stamp
compresses (pack up, depth down by a fraction), throws to the rim, and
sets wear; wear decays over ~5 minutes of play, pack heals under fresh
fall. Water is pushed out of the print.

## The seams, and the order

1. `src/world/surfaceField.js` - the pure field: the arrays, the tick
   (rain / snow / melt / dry), the stamp, the base-depth and warmth
   functions. Node-testable, no GL. Pinned first.
2. The renderer: a `setSurfaceField(pixelKey, tex, origin, size)` door,
   the terrain VS displacement, the terrain FS terms, the grass VS
   burial. All behind the switch; `?field=off` kill switch.
3. The world host: a field per near-ring pixel, ticked at 10 Hz from
   the sim's weather and the clock's warmth, stamped by the player,
   uploaded by changed rows, destroyed with the pixel.
4. EE4's snow identification RETIRED: the winter ground archive resolves
   to the summer archive's materials, and the field lays the snow.

GATE for each: check; bootProbe (the VS and FS change); worldRenderGate
in winter, where the terrain band must still be lit and the snow must
now come from the field - and a NEW check, the field's own census:
mean depth in midwinter above 0.6 in a mountain climate and 0 in a
desert, and a stamped print reading lower than its surround.

## Not in EE9

Rain ripples as a normal disturbance (they are cheap, but they belong
with the weather particles' impact, EE8's rate is what feeds them);
NPC footprints; snow on roofs and models (the winter archives keep
doing that, as they do today).
