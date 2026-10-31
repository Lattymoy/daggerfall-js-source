# The New Era (a live event)

A live event a developer stages with `/event newera`. The ground rumbles and the camera shakes. A giant AC-130
gunship with a horse's head for a nose flies into view, circles the sky and drops atomic bombs. The ground cracks and
the sky cracks. The picture peels away in shards to a blank white canvas, and a deep voice says "IT IS DONE. WE BEGIN
A NEW ERA." Then the world comes back. Every player online sees the same show at the same second. It is drawn and
heard only: nobody is hurt, slowed or moved. `/event off` ends it.

## How it works

**The word.** The live event door's fourth word, after the dread, the sun baby and the rocket: `src/net/wire.js`
`LIVE_EVENTS` (appended, never reordered). The relay's hub stages, keeps and fans the word; the show is the client's. A
relay older than `LIVE_EVENT_RELAY_MIN.newera` would refuse the word, so the client sends it only through a relay
that knows it (`relayKnowsLiveEvent`). `/event newera [on|off]` is read by `parseEventCommand` from the list.

**The show** (`src/world/newEraEvent.js` `NEWERA_PHASES`). One show of `NEWERA_SHOW_S` (106 s), read off the stage's
moment on the shared clock, so a joiner comes in on the same second. It plays once: a player who joins after its end
sees nothing, though the word stays staged until `/event off`.

| Phase | Seconds | What happens |
|---|---|---|
| rumble | 0-6 | the ground rumbles and the camera shakes, harder and harder |
| flyin | 6-18 | the gunship flies in from 4 km out and neighs |
| bombs | 18-48 | it circles 950 m out and drops five atomic bombs; each lands 2-3.1 km away |
| crack | 48-62 | the ground cracks round every player and the sky cracks; from 59 s the picture itself cracks |
| peel | 62-78 | the picture peels away in 35 shards, the sky's first, to white |
| canvas | 78-96 | the white canvas holds; the voice speaks at 80 s and 84.5 s, its words on the canvas |
| dawn | 96-106 | the white clears from the middle out and the world comes back |

A line is said at each cue to a player watching (`NEWERA_LINES`, through `t()`). The show fades in and out over
`NEWERA_FADE_S`.

**The gunship.** A mesh built in code (`src/render/newEraPass.js` `gunshipMesh`): a high wing, four engines with
spinning propellers, a tail, three guns out of the port side, and a horse's head with its blaze, eyes, ears and mane.
It flies `NEWERA_PLANE.scale` times a real gunship's size, in from far along its orbit's tangent, round a banked
left-hand orbit over the eye (its guns to the middle, as a gunship flies), then out and climbing. It is a sky thing:
its orbit is round each player's eye, on a bearing seeded by the stage, so every player sees it in the same quarter.

**The bombs.** Each falls `NEWERA_FALL_S` from where the gunship let go (`newEraDrops`). A blast is pinned to the world
where the player stood when the bomb fell, so its cloud stays put while they walk. A blast flashes the whole picture,
lights the sky round it, raises a mushroom cloud (a fireball, a stem, a rolling cap and a skirt of dust, cooling from
fire to smoke: `newEraCloud`) and sends out a shock dome. The boom and the big shake arrive with the shock, at
`NEWERA_SHOCK_SPEED`, seconds after the flash.

**The cracks.** The ground's cracks are cut from a grid laid on the ground round the player, along the edges of cells
of the world's own coordinates; they spread out from where the player stood and show white inside. The sky's cracks
run from three seeded points across the sky, white inside. From 59 s the picture cracks like glass along the edges of
the shards it will peel in.

**The white canvas** (`src/ui/newEraCanvas.js`). A canvas of its own over the game's, as the gate's veil: over the
world and its HUD, under the chat, with no pointer. It draws the flash, the picture's cracks, each shard peeling with
its flap folded back, the white held, the voice's words, and the dawn. It hides itself when no frame draws it, so a
step indoors never leaves the picture white.

**The sound.** The neigh is Daggerfall's own (DAGGER.SND `AnimalHorse`), pitched down. The boom is made at runtime
(`newEraBoomSamples`) under Daggerfall's thunder (`LightningThunder`, `ThunderRoll`) pitched down. The rumble, the
four engines' loop, each bomb's whistle, the cracking, the shards' tearing and the voice's deep hum are made at
runtime too. The voice is the browser's own speech in the player's language (a voice of that language, the deepest
first), as deep and slow as it goes, at the game's Sound Volume; where a browser has none, the words are still on the
canvas. Every line is translated in each language's table, as the game's other lines are.

**The shake** (`newEraShake`) goes through the camera's one shaker, Better Ambience's `weaponKick`, under the player's
own Camera Shake setting.

**The host** (`src/scenes/newEraHost.js` `createNewEraHost`). Wired by `scenes/world.js` beside the rocket. Interiors,
dungeons and the fixed-city bench stand no show, as they stand no other live event; the show keeps its place on the
clock and is there again outside.

## Rules

- `/event newera` brings the horse-headed AC-130, its atomic bombs, the cracking, the peel to a white canvas and the
  voice's line (the owner).
- The voice says "IT IS DONE. WE BEGIN A NEW ERA." word for word (the owner).
- Drawn and heard only: nothing is applied to any player.
- No line names a place: the show stands wherever a player is (TAMRIEL-WIDE).
- New behaviour lives in a host module (HOST-SPLIT).

## Daggerfall Unity

DFU has no live events; not a DFU member. The gunship and the bombs are meshes built in code, not Daggerfall's art.

## Code and tests

- `src/world/newEraEvent.js` - the show, the gunship's path, the drops, the clouds, the shards, the lines and the made sounds
- `src/render/newEraPass.js` - the sky, the meshes, the ground's cracks, the domes and the clouds
- `src/ui/newEraCanvas.js` - the white canvas over the picture
- `src/scenes/newEraHost.js` - the host module, the sounds, the shake and the voice
- `test/world/newera_event.test.js` - the wire, a relay Room staging it, the show, the sounds, the pass, the canvas, the host

## Open

- The voice depends on the browser's speech; its voices differ from one machine to the next.
- A blast's ground zero takes the ground's height where it is streamed, and the player's where it is not.
