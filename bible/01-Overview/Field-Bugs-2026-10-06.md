# FIELD BUGS 2026-10-06 - the watchman his own blow killed

One player report, a screenshot from the desktop build. It shows the open road outside a town, two plate-armoured
watchmen (Knight_CityWatch, 399) standing over a body and its blood, a Wayrest quest running, and Nimbleness,
Slowfalling, Water Walking and Troll's Blood on the effect list. Across the bottom of the HUD is the red CRASH bar the
frame loop raises when a frame throws:

> CRASH
> TypeError: Cannot set properties of null (setting 'conceal')
> at Object.Ct [as update] (dagger://game/assets/arenaGate-B2xzuGcP.js:317:20981)
>     at yx (dagger://game/assets/world-BfE0WID5.js:2997:20957)

The cause was found in the code and reproduced headless. The change is pinned by a test that fails on the code before
it (the first pin with the field's own TypeError, at the same statement), and the pins are mutation-checked
(`tools/mutants/fb1006.json`). No ARENA2 was at hand and neither was the reporter's save, so it is not known which of
the doors below killed the watchman in the screenshot. Every one of them reaches the same statement. Nothing here was
seen in a browser.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | the CRASH bar over two watchmen and a body | the city watch was drawn while it was still being driven. A watchman's blow can kill him through his own door (the Ring of Namira's reflection; the player's damage door, where Spite of the Spurned, the loot's thorns and the Warden's Nova answer it), and that kill frees his live batch and nulls it. The draw then wrote to `null` | WATCH-SWING |

## Finding the frame

The bundle's names are Rollup's: `arenaGate-*.js` is a shared chunk named after one of the many modules in it, and the
watch's pool is another of them. A build of main (`73312bd53`, the release's own `vite build`) has this at line 317 of
that chunk: `T.batch.conceal=_e.kind==="conceal"?_e.visual:null`. It comes straight after the watch's attack voice
(`play3d?.(Le.clip, ...)`) and `if(_e.kind==="hidden")continue`, which makes it `scenes/cityGuards.js` update()'s draw.
Main's `=` is at column 21022 and the report's at 20981: the same statement, a build apart. Line 2997 of main's world
chunk is `push(...In.update(...)),c1e.frame()`, world.js's frame (`livePersonBatches.push(...cityGuards.update(...))`
then `standingWatch.frame()`), and it is the report's `yx` on the same line. The player was in the world host's street.

## WATCH-SWING (1)

`scenes/cityGuards.js` (`update`). The pool's update walked its watchmen once. Each one was skipped if dead, then
driven: the motor, the senses, the attack machine, the swing's animation, and on its -1 frame the blow (C16). Then, at
the bottom of the same iteration, he was drawn: `foeDraw` (ECV1), `g.batch.conceal`, the hit flash, the glint, the
record, size and origin, and the push into the frame's list. The skip at the top was the only test of `dead`, and a
blow can kill the man who strikes it:

- **The struck tail.** For an enemy's blow that hurt the player, `calculateAttackDamage` (combat/formulas.js) ends in
  the struck hook. The Ring of Namira (systems/artifactEffects.js `onPlayerStruckByEnemy`, DFU's
  FormulaHelper.cs:702-719) reflects the damage at the attacker according to his team. The watch's team is CityWatch,
  so it reflects all of it, and AUDIT PSCALE1's DOORS-2 lands it through the attacker's own door (`registerFoeDoor`,
  which is damageGuard for a watchman).
- **The player's damage door.** The pool's `onPlayerHurt` is the hosts' `hurtPlayer` (world.js, exterior.js), and the
  damage door's hurt listeners answer a landed blow. Spite of the Spurned and the loot's thorns strike the foe that
  struck (systems/sigilSetPowers.js `spite`, systems/lootPowers.js `lootLanded`), and the Warden's Nova strikes every
  foe around the player (`nova`). Each goes through the scene's published door (systems/playerDoor.js,
  scenes/hostMagic.js) to the host's sink and `cityGuards.hurtGuard`, which is damageGuard again.

damageGuard's kill sets `dead`, keeps the body and frees the live batch (AUDIT 24's `releaseGuardBatch`: a VAO and two GL
buffers, then `g.batch = null`). The iteration carried on through the kill notice, the landing's effect and the attack
voice to the draw, which set `conceal` on `null`. The throw left update() partway through the pool, and the frame with
it: the CRASH bar.

The same interleave had two more effects, neither of which threw:

- A watchman killed by a LATER watchman's blow (the Nova strikes every foe within its reach) had already been pushed.
  The list carried his freed batch, and the renderer bound it (its VAO deleted, so none) and drew it: a GL error and
  nothing on screen, for that frame.
- The foe arm (MT-ii, EnemyAttack.cs:199-209's split) ends in `continue`, which was written to skip the player arm. It
  skipped the draw too, so a watchman blinked out for the frame of every blow he landed on a monster.

DFU has no such window. Unity renders the scene after every Update has run, and EnemyDeath disables the dead foe before
anything draws. The interleave was the port's own.

THE FIX: the draw reads the frame's END. update() drives every watchman first, then builds the list from the ones still
standing. That is the encounter pool's own order (exteriorFoes.js `batches()`, read after its update has driven every
foe). The draw's statements move whole and unchanged. update() returns what it always did, the live batches and the
corpses, so no host changes.

`test/fb1006_watchswing.test.js` (3, new) runs the real pool on watch1.test.js's synthetic CLASS18.CFG and pins three
things:

- A 1-health watchman whose blow at a player wearing the Ring dies by its reflection is not drawn, the update does not
  throw, and the next frame draws his body.
- A watchman the host's hurt seam kills after his turn (hurtGuard, the way the Nova reaches him) leaves no freed batch
  in the list.
- A watchman whose blow lands on the encounter pool's rat is drawn that frame.

On the code before the fix, the first pin threw the field's TypeError at the same statement (`cityGuards.js` update,
`g.batch.conceal`), and the other two failed on what was drawn. Mutants (`tools/mutants/fb1006.json`, 3, all dead): the
draw's dead skip removed, the skip narrowed to a body with no corpse, and the push removed. The cites into
`cityGuards.js` that the move shifted were re-aimed by `node tools/citeShift.mjs` (9). One more, a continuation on the
line after its cite in `test/roadg_pools.test.js`, was moved by hand to the prune it names.

## THE FOUR HOSTS (17e)

- `scenes/exterior.js` and `scenes/world.js`: the street's watch is this module, and both take update()'s list as
  before.
- `scenes/worldModes.js`: the indoor watch (ROAD-B, `interiorGuards`) is also this module, minted by its own
  createCityGuards call. It draws the list as before.
- `scenes/dungeonContext.js`: no city watch (SpawnCityGuards stands down in a dungeon, PlayerEntity.cs:625). FLAGGED:
  its own foe loop has the same shape (`resolveFoeMelee`, then the draw's `f.batch.conceal` in the same iteration). A
  dungeon kill keeps the live batch, though (damageFoe spawns the corpse and frees nothing), so it cannot throw. A foe
  killed by its own blow (the Ring, through PSCALE1's door) is drawn alive for that one frame over its new body. Not
  changed here.

## FLAGGED, not changed here

- THE HOSTS READ THE WATCH BEFORE THE FOES DRIVE. world.js and exterior.js push update()'s list into the frame's flats
  and then run exteriorFoes.update. A monster's blow that kills a watchman there (MT-ii's cross-pool door,
  `hurtFromFoe`), or a Nova answering a monster's blow, frees a batch that is already in the frame's list. The result is
  the GL error above for that frame, and no throw. The encounter pool's own list is read after its update. worldModes
  draws the indoor watch's list as soon as update returns it, before any other pool acts.
- dungeonContext's one frame, above.
