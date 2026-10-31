# Ambient life (AMBIENT-LIFE, 2026-10-31)

The owner, 2026-10-31: "So I want to implement some ambience. Wandering birds, droves of birds forming their flocks in
the sky, birds that perch and fly away on tall geometry. Skittering critters. And whatever else that could really add
life into the world without killing performance".

DFU draws no wild birds or small animals, so this is the port's own. DFU is still the reference
for when: its `AmbientEffectsPlayer` plays bird calls under the SunnyDay preset and crickets under ClearNight
(`WeatherManager.SetAmbientEffects`, ported as `systems/ambientEffects.js` presetForExterior). The birds seen fly when
DFU's ambience hears them: both exterior hosts hand the cast the same weather word the ambience's preset reads.

## What stands

- **Lone birds** cross the sky 8 to 28 m up (6 m higher in a town). Small birds bound - a burst of wingbeats, then wings
  shut - and big ones flap and glide. One lands on a roof now and then.
- **Birds on the roofs** sit on ridges and peaks and look about. A bird goes when the player comes within its kind's
  distance (a pigeon 8 m, a crow 14 m), and the birds within 6 m of it follow 0.1 to 0.6 s later. A perch rests 20 to
  45 s before another bird takes it. A bird looks at its perch once a second: when what it sits on has gone (a ship
  sailed, a town rebuilt), it flies.
- **Flocks** start as birds scattered over 35 m that draw together over ten seconds, then wheel round an anchor that
  wanders the sky. A flock may come down to feed on open ground and bursts up, nearest bird first, when the player
  comes within 16 m.
- **Soarers** circle high and beat their wings a few times a minute: hawks and vultures 45 to 95 m up, gulls lower.
- **Bats** hunt 3 to 16 m up from the hour before dusk.
- **Runners** (a rat, a lizard, a squirrel, a crab) sit, dart a few metres and bolt from the player. A cornered one
  slips away. None stands on water, under a roof or on a slope steeper than 0.35 m in 0.4 m.
- **Butterflies** flutter round a patch of ground by day, and **fireflies** drift and blink over it at night.

## Who, where and when (`systems/ambientLife/ambientCast.js`)

Each of the ten climates has a palette: the flock's kind, a lone bird's, a roof's, the soarer's, the runner's, and how
many butterflies, fireflies and bats. The woods have starlings, sparrows, pigeons, hawks and squirrels. The deserts
have vultures and lizards and no flock. Mountains have crows and hawks, the rainforest parrots, the swamps crows,
rats and the most fireflies. The haunted woods have crows, rats and nearly twice the bats. The sea has gulls and crabs.

A town (three building boxes or more near the player) puts pigeons on the roofs, rats in the street at night, and half
as many birds again on its roofs. Water within 60 m brings gulls. Rain, a storm, a sandstorm or an ashfall grounds
every flier, and half the roofs' birds sit it out. Snow halves what flies and stops the runners, fog thins the air,
winter takes the insects. At night the roofs' birds roost and let the player come to 0.6 of the day's distance.

## The whole of Tamriel

Every province reads its own climate through the same ten palettes, so Skyrim's mountains have their crows and
hawks, Elsweyr's and Hammerfell's deserts their vultures and lizards, and Black Marsh its swamp. The pins walk every
zone of every province (`world/tamriel/tamrielBiomes.js` BIOMES) beside the Bay's climates. `tools/wildlifeProbe.mjs`
boots in Daggerfall and jumps to Solitude.

The roofs are found by looking, not by a list of the Bay's buildings. Each frame one ray goes down onto a building's
box, or anywhere within 75 m, and a surface 2.5 m over the ground is walked up to its ridge or peak. Any town, ruin or
wall anywhere has perches.

## The hosts (`scenes/ambientLifeHost.js`)

The two exterior hosts build it: `world.js` (the streamed world) and `exterior.js` (the fixed city). They hand it the
world through `AmbientWorld`: the walk ground, the water (the sea, a lake tile, ground not built), the collider's roofs
(a ray down), and the buildings' boxes. The host steps it on each outdoor frame on the game's seconds and draws it with
the opaque world. `world.js` moves it with the floating origin at both of its origin moves. The interiors
(`worldModes.js`) and the dungeons (`dungeonContext.js`) build none: there is no sky there. A move of more than 150 m
between two frames (a door, a travel, a load) starts the creatures afresh. None stands under the travel view's camera.

The switch is the Wildlife row (Features, Graphics, "Plants, wind & wildlife"), pref `ambientLife`, on by default and
each player's own online. `?wildlife=off` is the kill door, and `?wildlife=0.5` (0 to 2) sets the density for a probe.

## The look (`render/ambientLifePass.js`)

No picture is loaded and no ARENA2 art is drawn. Each creature is 13 triangles, built in the vertex stage from its
kind's measures (`AL_KINDS`). A bird has a body seen from below and from the side, a tail and two wings of three
triangles that beat, lag at the tip, fold back along the body and hold out to glide. A runner has a back, a head, a
tail and four legs that step in diagonal pairs. A face shades by its own normal, and an underside seen from below
wears its kind's paler underside. Bodies are lit by the flats' light at the player and fogged as the terrain is.
Fireflies are a second, added draw of glowing points, never under three pixels across.

## Cost

One instanced draw for the bodies and one for the lights, at most 320 instances. The sim is 20 to 55 microseconds a
frame on the CPU, measured on a town of 48 houses. Finding perches costs at most 29 rays a frame, and only until 28
are found. After that a flier looks ahead twice a second and a perched bird at its perch once a second, a ray each. The boids loop is quadratic in a flock, which holds 26 birds at most. The program is compiled through
`compiledPass`, at the first frame that has a creature to draw.

## Not yet

- The player's blows and spells do not startle the creatures yet. `AmbientLife.scare(at, radius)` is there for the
  host to call; until it does, running (4.5 m/s and more) widens every flush distance by 1.6.
- Trees are pictures with no collider, so no bird perches in one.

## Pins

`test/systems/ambientLife/ambientcast.test.js` (the cast whole, DFU's presets, the climates, every province's zones),
`test/systems/ambientLife/ambientlife_sim.test.js` (the ridges, the flush and its neighbours, the runners off the water
and out from under the roofs, a flock forming, landing and bursting up, the floating origin, the instances, the rays a
frame), `test/render/ambientlifepass.test.js` (the vertex stage run in JS: the heading, the bank, the wings, the feet)
and `test/scenes/ambientlifehost.test.js` (the switch, the world a host lends, the four hosts' wiring).
