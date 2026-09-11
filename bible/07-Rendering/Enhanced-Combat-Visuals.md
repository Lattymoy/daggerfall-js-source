# Enhanced Combat Visuals (ECV1, 2026-09-07)

**Mac (2026-09-07): "I notice the imp enemy type goes invisible and
still can be attacked."** Then, once it was traced: "so maybe this is
the chance to somehow improve it? how could we make chameleon not seem
like a bug" - "ill let you lead this. This can fold into a new toggle
Enhanced Combat Visuals." Ledger row ECV1.

## What Mac saw, and why it is the rule

The imp's classic spell list is Wizard's Fire, Free Action, Toxic
Cloud and **Chameleon** (`EnemyEntity.cs` `ImpSpells = { 0x07, 0x0A,
0x1D, 0x2C }`, SPELLS.STD records; `systems/enemySpells.js` carries the
table byte for byte). Classic combat AI picks a touch spell from the
ByTouch AND CasterOnly targets (`EnemyMotor.cs:794-812`), so at melee
range the imp casts Chameleon on itself. The effect lands on the
enemy's own entity exactly as it would on the player, and DFU's
`EntityConcealmentBehaviour` - "Handles magical concealment for
entities other than player" - disables the enemy's mesh renderer while
`IsMagicallyConcealed` is true (`EntityConcealmentBehaviour.cs:36-43,
:56-62`): any of the six flags, normal or true power. The enemy keeps
moving, attacking and taking hits; its collider never went anywhere.
When it lands a blow its normal-power concealment breaks
(`EnemyAttack.cs:316-318` for a foe's blow on anything, `:255-257` on
the player; `WeaponManager.cs:549-552` for the player's own), and
when the spell's rounds run out it reappears. Between the cast and either, there is nothing on screen.

The port carries all of that verbatim: the spell table, the touch
pick (`characters/enemyCasting.js`), the concealment flags
(`systems/effects.js`) and the A5 skip in every foe draw - the classic
lane draws what DFU draws. Two things worth knowing beside it: DFU
ships with Enhanced Combat AI ON, and that branch of its touch pick
skips CasterOnly spells with a TODO in the source, so a default DFU
install never sees an imp vanish; the port implements the classic AI
only (Ledger A), which is also what original Daggerfall does. And only
two enemy spell lists carry a concealment spell at all - the imp's
Chameleon and the Orc Shaman's Invisibility (the class casters take
the shaman's list at levels 6 to 8); ghosts, wraiths, liches, daedra
and vampires cast damage, silence, paralysis and drains.

## What the enhanced skin draws instead

Nothing about the rules changes - the cast, the detection gate, the
hits, the break. Only what is DRAWN for a concealed foe, and only on
the enhanced skin with the switch on:

| Concealment | Draw |
|---|---|
| Invisibility (normal or true) | hidden, as DFU draws it - invisible means invisible, and the Orc Shaman's spell stays stronger than the imp's - except for the hit flash below |
| Chameleon | the sprite at `BLEND_ALPHA` 0.22 opacity, a slow shimmer (`BLEND_SHIMMER` 0.08 at `BLEND_HZ` 1.3, phased per foe so a pack does not breathe in step) and a horizontal ripple across the sprite in the shader - blending in, trackable up close |
| Shadow | a dark translucent silhouette: `SHADE_ALPHA` 0.55, the lit colour pulled to `SHADE_DARK` 0.12 of itself - a shade |
| any of them, just HIT | the sprite at `REVEAL_ALPHA` 0.8 fading over `REVEAL_SECONDS` 0.35 - a connecting swing on an unseen foe reads as a hit, not a glitch. THIS IS THE ONE PLACE THE DEPARTURE SHOWS SOMETHING DFU'S DRAW NEVER DOES: for a third of a second the player sees where an invisible foe stands. Mac's call, in the list he approved ("Any hidden enemy you hit: a brief flash"); recorded here rather than hidden in "draw only" |

When two flags are up the stronger concealment wins: invisible over
blending over shade. The reveal overrides all three while it runs. The
player's own concealment keeps no visual: DFU draws none in first
person and neither does the port.

## Where it lives

- **`systems/concealDraw.js`** - a LEAF holding the seven draw
  constants (the chameleon's alpha, shimmer and rate; the shade's
  alpha and its pull toward black; the reveal's seconds and alpha).
  It imports nothing: `render/renderer.js` interpolates SHADE_DARK
  into the billboard shader rather than restating 0.12, and reaching
  it through `combatVisuals.js` would have taken the renderer's
  static closure from 13 modules to 69 (AUDIT 65 PN-3).
  `systems/combatVisuals.js` re-exports all seven and stays their one
  public home - every other reader imports them from there.
- **`systems/combatVisuals.js`** - pure. `concealVisual(flags, clock)`
  is the law above; `foeDraw(entity, on, clock)` is the host's one
  question per foe per frame (`plain`, `hidden`, or `conceal` with the
  visual), reading the entity's own effects and answering `hidden` for
  a concealed foe when the switch is off - the A5 skip, in one place;
  `combatVisualsOn()` is the switch; `markConcealedHit` and `foePhase`
  the two per-foe stamps.
- **`render/renderer.js`** - the billboard shader takes `uConceal`
  (mode, opacity, seconds, phase) and a THIRD phase in `drawBillboards`
  draws the batches carrying a `conceal` after the opaque and spectral
  phases: blended, depth-writes off, one uniform per batch, cleared
  after. The spectral batches share the phase, and the whole blended
  set draws back to front by distance from the camera, so a
  translucent foe behind another shows through it.
- **The three foe hosts** - `scenes/dungeonContext.js`,
  `scenes/exteriorFoes.js`, `scenes/cityGuards.js` - ask `foeDraw`
  where the A5 skip stood, hand the visual to the foe's batch, stamp
  `markConcealedHit` where their damage function lands a blow, and
  tick a clock in seconds for the shimmer and the reveal. The clock is
  wrapped to one turn before it reaches the shader's `sin`; the shimmer
  phase is minted deterministically (the golden angle times a running
  count) and only on the concealed draw, so the classic path consumes
  no random draw.
- **The switch** - `enhancedCombatVisuals` in `systems/uiPrefs.js`,
  on by default like the other enhanced visuals, the row in the
  Enhanced menu's live pane; `?combatvisuals=off` the kill switch. The
  classic skin never reads it.

## Verification

`test/combatVisuals.test.js` (7 tests): the switch, the law, the
reveal, `foeDraw` off real effect kinds, the renderer's phase on a
recording GL, the shader's declarations and each mode's line, and the
three hosts' seams. Not seen in a browser: the container has no
ARENA2, so no foe has been drawn. The shader compiles under the AUDIT
47 sweep (every uniform declared where it is used) and the build.
