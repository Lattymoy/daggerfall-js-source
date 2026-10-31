# Ambient life (AMBIENT-LIFE, 2026-10-31)

The owner, 2026-10-31: "So I want to implement some ambience. Wandering birds, droves of birds forming their flocks in
the sky, birds that perch and fly away on tall geometry. Skittering critters. And whatever else that could really add
life into the world without killing performance". Then, of the slice: "Can you audit this. Make sure its perfect?" -
`01-Overview/audits/Audit-Ambient-Life.md`.

DFU draws no wild birds or small animals, so this is the port's own (Port-Ledger A, AMBIENT-LIFE). DFU is still the
reference for when: its `AmbientEffectsPlayer` plays bird calls under the SunnyDay preset and crickets under
ClearNight (`WeatherManager.SetAmbientEffects`, ported as `systems/ambientEffects.js` presetForExterior). The birds
seen fly when DFU's ambience hears them: both exterior hosts hand the cast the word that preset reads.

Two departures from that ear, both the port's own words. The ear hears a sandstorm and an ashfall as a cloudy day
(`weatherFront.js` soundWeather), but the creatures read those falls by their own word (`wildlifeWord`) and are
grounded by them. SunnyDay still plays bird calls in snow and fog, where fewer birds fly.

## What stands

- **Lone birds** cross the sky 8 to 28 m up (6 m higher in a town). Small birds bound - a burst of wingbeats, then wings
  shut - and big ones flap and glide. One lands on a roof now and then. A bird climbs over a hill or a roof ahead of
  it, and turns back from a cliff or a tower too steep to climb in time.
- **Birds on the roofs** sit level on ridges and peaks and look about. A bird goes when the player comes within its
  kind's distance (a pigeon 8 m, a crow 14 m), and the birds within 6 m of it go within 0.6 s of it. A perch rests
  20 to 45 s before another bird takes it. A bird looks at its perch once a second: when what it sits on has gone (a
  ship sailed, a town rebuilt), it flies.
- **Flocks** start as birds scattered over 35 m that draw together over ten seconds, then wheel round an anchor that
  wanders the sky. A flock may come down to feed on open ground, each bird on its own dry patch under no roof, and
  bursts up, the nearest birds first, when the player comes within 16 m.
- **Soarers** circle high and beat their wings a few times a minute: hawks and vultures 45 to 95 m over the land below
  them, gulls lower. They drift after the player, and one left 180 m behind leaves; another rises near.
- **Bats** hunt 3 to 16 m up from the hour before dusk. A bat outrun past 78 m is let go, and another comes.
- **Runners** (a rat, a lizard, a squirrel, a crab) sit, dart a few metres and bolt from the player. A cornered one
  slips away. None stands on water, under a roof or on a slope steeper than 0.35 m in 0.4 m.
- **Butterflies** flutter round a patch of ground by day, and **fireflies** drift and blink over it at night. Neither
  rises under a roof or over water, and each turns back from one ahead.

A flushed bird flies on until it is 85 m from the player, its way pushed on ahead if the player follows. Every
creature fades out over the last 15 m before its reach, so none is lost at full size.

## Who, where and when (`systems/ambientLife/ambientCast.js`)

Each of the ten climates has a palette: the flock's kind, a lone bird's, a roof's, a town's roof bird, the soarer's,
the runner's, and how many butterflies, fireflies and bats. The woods have starlings, sparrows, pigeons, hawks and
squirrels. The deserts have vultures and lizards and no flock. Mountains have crows and hawks,
the rainforest parrots, the swamps crows, rats and the most fireflies. The haunted woods have crows, rats and nearly
twice the bats. The sea has gulls and crabs.

A town (three building boxes 3 m tall or more within 85 m) puts pigeons on its roofs - parrots in the rainforest,
crows in the haunted woods, gulls by the sea - half as many birds again, and rats in its streets at night. Built
water within 60 m brings gulls. Rain, a storm, a sandstorm or an ashfall grounds every flier, the runners and the
insects, and half the roofs' birds sit it out. Snow nearly halves the lone birds and the soarers and stops the bats,
the runners and the butterflies. Fog thins the air and keeps the butterflies in. Winter takes the insects. At night the
roofs' birds roost and let the player come to 0.6 of the day's distance.

## The whole of Tamriel

Every province reads its own climate through the same ten palettes, so Skyrim's mountains have their crows and
hawks, Elsweyr's and Hammerfell's deserts their vultures and lizards, and Black Marsh its swamp. The pins walk every
zone of every province (`world/tamriel/tamrielBiomes.js` BIOMES) beside the Bay's climates. `tools/wildlifeProbe.mjs`
boots in Daggerfall and jumps to Solitude; its run is recorded in the audit.

The roofs are found by looking, not by a list of the Bay's buildings. Each frame one ray goes down onto a building's
box, or anywhere within 75 m, and a surface 2.5 m over the ground is walked up to its ridge or peak. Any town, ruin or
wall anywhere has perches.

## The hosts (`scenes/ambientLifeHost.js`)

The two exterior hosts build it on the enhanced lane, as Windfall's: `world.js` (the streamed world) and `exterior.js`
(the fixed city). They hand it the world through `AmbientWorld`: the ground (over Deep Waters' carved sea, the sea's
top), the water (the sea, a lake tile, ground not built - `exterior.js` reads its tilemap's), the collider's roofs
(a ray down) and the buildings' boxes. The host steps it on each outdoor frame on the game's seconds. `world.js` moves
it with the floating origin at both of its origin moves.

The bodies are drawn with the opaque world. In `world.js` the fireflies' lights are drawn after the blended flats and
the veiled bodies, which would paint over them; `exterior.js` draws its people first, so it draws both at once.

The interiors and the made levels (`worldModes.js`) and the dungeons (`dungeonContext.js`) build none: the creatures
are the open world's. A move of more than 150 m between two outdoor frames (a travel, a load, a teleport) starts them
afresh; a visit indoors holds them as they were. None stands under the travel view's camera.

The switch is the Wildlife row (Settings › Graphics › Plants, wind & wildlife), pref `ambientLife`, on by default and
each player's own online. `?wildlife=off` is the kill door, and `?wildlife=0.5` (0 to 2) sets the density for a probe.

## The look (`render/ambientLifePass.js`)

No picture is loaded and no ARENA2 art is drawn. Each creature is 13 triangles, built in the vertex stage from its
kind's measures (`AL_KINDS`). A bird has a body seen from below and from the side, a tail and two wings of three
triangles that beat, lag at the tip, fold back along the body and hold out to glide. A bird with its wings shut is
lifted onto its feet, so it sits on a roof. A runner has a back, a head, a tail and four legs that step in diagonal
pairs. A face shades by its own normal, and an underside seen from below wears its kind's paler underside. Bodies are
lit by the flats' light at the player and fogged as the terrain is. Fireflies are a second, added draw of glowing
points whose hot core is never under three pixels across.

## Cost

Two instanced draws, at most 320 instances. In Node, on the sim test's made town (48 boxes, a stand-in roof ray and
ground), the sim is about 20 to 90 microseconds a frame, measured with other work on the machine; the host's collider
rays and ground reads are not in that figure. Finding perches costs at most 29 rays a frame. Once the roofs round the
player stop yielding new perches (twelve looks in a row), it looks twice a second. A flier then looks ahead twice a
second and a perched bird at its perch once a second, a ray each. A runner's dart reads its footing, up to ten rays
at most. The boids loop is quadratic in a flock, which holds 26 birds at most. The program is compiled through
`compiledPass`, at the first frame that has a creature to draw.

## Not yet

- The player's blows and spells do not startle the creatures yet. `AmbientLife.scare(at, radius)` is there for the
  host to call; until it does, running (6.6 m/s and more, between the fastest walk and the slowest run) widens every
  flush distance by 1.6.
- Trees stand no collider, so no bird perches in one.

## Pins

`test/systems/ambientLife/ambientcast.test.js` (the cast whole in each weather, DFU's presets, the climates and their
town birds, every province's zones), `test/systems/ambientLife/ambientlife_sim.test.js` (the ridges, the flush and its
neighbours, the runners off the water and out from under the roofs, a flock forming, landing and bursting up, the
floating origin, the instances, the rays a frame), `test/systems/ambientLife/ambientlife_audit.test.js` (the audit's
findings, each on the producer's own path, and the record's numbers whole), `test/render/ambientlifepass.test.js` (the
vertex stage run in JS, and the draws on a recording context) and `test/scenes/ambientlifehost.test.js` (the switch,
the lane, the falls' word, the worlds the hosts lend, the four hosts' wiring). `tools/mutants/ambientlife.json`: 56
mutants, 55 dead, one equivalent and recorded with its reason.
