# Enhanced Combat Visuals

Enhanced Combat Visuals is a switch on the enhanced skin that changes how a magically concealed foe or player is drawn.
Classic Daggerfall hides a concealed enemy's sprite entirely, so an imp that casts Chameleon on itself at melee range
turns invisible while it keeps fighting. With the switch on, the player sees a faint shimmer or a dark shade instead.

## How it works

Only the draw changes. The cast, the detection gate, the hits and the break of concealment on a landed blow are the
classic rules (`src/systems/effects.js` concealment flags, `src/characters/enemy/enemyCasting.js` touch pick,
`src/systems/enemySpells.js` spell lists).

| Concealment | Draw |
|---|---|
| Invisibility (normal or true) | hidden, as DFU draws it |
| Chameleon | sprite at 0.22 opacity, a slow shimmer (0.08 at 1.3 Hz, phased per foe) and a horizontal ripple |
| Shadow | a dark translucent silhouette: 0.55 opacity, colour pulled to 0.12 of itself |
| any, just hit | sprite at 0.8 opacity fading over 0.35 s |

- When two flags are up, the stronger wins: invisible over blending over shade. The hit reveal overrides all three.
- Another player who is concealed (the pose's `cv` bits) is drawn as a concealed foe, except that invisibility takes the
  Chameleon shimmer. A peer gets no hit reveal; all three bits at once is a staff member inside an event boss, drawn
  nowhere.
- The player's own concealment has no visual, as in DFU's first person.
- Off, or on the classic skin, every host hides a concealed foe or peer.

## Rules

- The hit reveal is the one place the switch shows something DFU never draws: for a third of a second the player sees
  where an invisible foe stands (Mac).
- A concealed player is drawn with the transparent look foes get, invisibility included (Mac).
- Invisibility stays stronger than Chameleon for foes: the Orc Shaman's spell hides fully, the imp's shimmers.
- The shimmer phase is minted without a random draw (the golden angle times a running count, or a peer's id hashed), so
  the classic lane's random sequence is untouched.
- The switch is `enhancedCombatVisuals` in `src/systems/uiPrefs.js`, on by default, a row in the Enhanced menu;
  `?combatvisuals=off` is the kill switch (`src/systems/combatVisuals.js` `combatVisualsOn`).
- The seven draw constants live in the leaf `src/systems/concealDraw.js`, which imports nothing, so the renderer can read
  `SHADE_DARK` without pulling in the effects graph. `src/systems/combatVisuals.js` re-exports them for every other reader.

## Daggerfall Unity

DFU's `EntityConcealmentBehaviour` disables an enemy's mesh renderer while `IsMagicallyConcealed` is true, for any of the
six concealment flags. The enemy keeps moving, attacking and taking hits. Normal-power concealment breaks when it lands a
blow (`EnemyAttack.cs`, `WeaponManager.cs`). We keep all of that and change only the draw, behind the switch.

DFU ships with Enhanced Combat AI on, and that branch of its touch pick skips CasterOnly spells, so a default DFU install
never sees an imp vanish. We implement the classic AI only, as original Daggerfall does. Only two enemy spell lists carry
a concealment spell: the imp's Chameleon and the Orc Shaman's Invisibility.

## Code and tests

- `src/systems/combatVisuals.js` - `concealVisual` (the law), `foeDraw` (the host's question per foe per frame),
  `peerDraw`, `markConcealedHit`, `foePhase`, `peerPhase`
- `src/systems/concealDraw.js` - the draw constants
- `src/render/renderer.js` - the billboard shader's `uConceal`; `drawBillboards` draws concealed batches in a third,
  blended phase with the spectral ones, back to front
- `src/scenes/dungeonContext.js`, `src/scenes/exteriorFoes.js`, `src/scenes/cityGuards.js` - ask `foeDraw`, stamp
  `markConcealedHit` on a landed blow, tick the clock
- `src/scenes/world.js` - draws concealed peers through `peerDraw`
- `test/systems/combatVisuals.test.js` - the switch, the law, the reveal, the renderer's phase, the shader and the hosts'
  seams
