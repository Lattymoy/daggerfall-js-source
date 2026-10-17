# FIELD BUGS 2026-10-15b - the Morrowind bodies, looted and at the walls

The owner's report, read on the code as it stands at main's `1242f035`. Each is traced on the real modules first; the
fixes are pinned one to a tag.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "When looting dead marrowind enemies, they turn to a sprite." | Both dungeon hosts return before drawFoes - the only place a foe's body was drawn - while a window is up, and AUDIT MW-NPC C6 showed every corpse flat on that branch; the loot window is such a window, so the body it was opened on stood as its classic corpse until it closed. Above ground nothing changed: world.js and exterior.js draw their pools under a window (WINFOE1) | fixed (LOOT-BODY) |
| 2 | "The models also clip through geometry" | Every Morrowind body is a picture composited as one quad, and the quad was depth-tested as itself - a flat card through the body's middle: a corpse lying toward the eye had its near half cut off by the floor, a body at a wall was cut where the card crossed it | fixed (BODY-DEPTH) |

## LOOT-BODY

The lane's bodies stand as its last sync left them - no sync runs under a window - so the window's frame draws them,
frozen, before the level's flats, and marks each corpse flat cast-only where its body stands
(`src/characters/foeBodies.js` drawBodiesUnderWindow; `src/scenes/dungeonContext.js` drawWindowBodies, which replaces
showBodyFlats; called by `src/scenes/worldModes.js`'s dungeon arm and `src/scenes/dungeon.js`). A corpse with no body
standing keeps its flat (C6's law); the living foes' bodies are drawn with them, as the people's lane already is.
THE FOUR HOSTS: dungeonContext.js the door, worldModes.js wired (its dungeon arm; its interior arm draws its pools under
a window already), world.js and exterior.js unchanged (they draw their pools under a window already).

## BODY-DEPTH

The sprite target's depth is a texture now (a renderbuffer before), and the quad writes each texel's own depth: the
picture is an ortho down the eye's ray from `reach` behind the box's centre, so a texel's depth names its point along
the ray, and the quad's own point moved there is where the texel stands (`src/render/characterSprite.js` pictureDepth,
`src/render/renderer.js` drawCharacterSpriteQuad `depth`). A card of its own vertical - the travel view's lean, the
Billboard Look - keeps the quad's depth. Every body through the one pass takes it (foes, people, the watch, peers, the
player's third-person body, the voxel rigs). Ground-truthed in a real WebGL2 context: the program links, the target is
complete, and a texel passes and fails the depth test within 0.0005 of the depth pictureDepth names.

Not reproduced in play here (this container has no ARENA2 or Morrowind data); the record and the pins are the code's.
`bible/04-Characters/Morrowind-NPCs.md` section 29; `test/render/fb1015_lootbody.test.js` (7),
`tools/mutants/fb1015_lootbody.json` (13, 13 dead).
