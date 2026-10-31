# Enhanced AI tactics

What foes do with the Enhanced AI switch on: billboard props are real cover for sight and missiles, foes share their
target in turns and hold a ring around it, hurt foes back off and cowards flee, archers kite once and then fight, and
tougher foes throw telegraphed blows. A separate anti-grief layer, always on, keeps foes from clumping across pools
and from holding a doorway. The navmesh that routes foes is `12-Enhanced-AI/Enhanced-AI-Arc.md`; the weight of the
telegraphed blows (poise, iron, punish) is `12-Enhanced-AI/Feud-Arc.md`.

## How it works

**The switch.** `src/ai/tactics.js` `tacticsSwitchOn` reads the prefs key `enhancedAI` (Features `enhanced-ai`, on by
default, forced on online). Off, the classic motor (`src/characters/enemy/enemyMotor.js`) runs unchanged and cover
answers Infinity.

**Cover** (`src/ai/cover.js`). A flat at least `COVER_MIN_H` (1.2 m) tall and `COVER_MIN_W` (0.5 m) wide is cover,
except the editor markers, animals, lights and treasure (`NOT_COVER_ARCHIVES`). Its proxy is an upright cylinder at its
base; a tree is a trunk and a crown. The cover index rides the collider (`collider.cover`) but is never in it, so
walking and the navmesh are unchanged. Cover is read by `canSeeTarget`, a foe's clear shot, every missile (an area
spell bursts on it) and the watch's witness rays. A line of sight that ends in cover is not hidden by it. Hearing is
not blocked. Every host stands cover: the streamed world, dungeons, interiors and the single-location host.

**The brain** (`src/ai/tactics.js` `tacticsStep`, table `TACT`), for a foe that sees its target within `ENGAGE_RANGE`
(14 m; a shooter within 51.2 m):
- **Tokens.** One board per target: `MELEE_TOKENS` 2 and `RANGED_TOKENS` 2. A holder walks in and swings on DFU's
  clock, then hops back at most `RECOVER_HOP` (0.4 s) and holds its ground through the beat, and hands the token to
  whoever waited longest. A foe waiting past `PATIENCE` (6 s) goes in regardless.
- **The ring.** Waiting foes stand `RING_GAP` (1.5 m) outside their reach and circle slowly. A target who turns their
  back on a waiting foe, or walks up inside the ring's near edge, is open: it engages without a token.
- **Backing off.** A quarter of its health lost inside 3 s: it holds a farther ring for 2 s, at most once in
  `BACKOFF_COOLDOWN` (10 s).
- **Fleeing.** Animals and the cowardly classes (`COWARD_CLASSES`: Mage, Sorcerer, Healer, Bard, Burglar, Acrobat,
  Thief) below a fifth of their health run once, for 8 s. Undead, daedra, constructs, the watch and other classes
  fight on.
- **Kiting.** A shooter inside 6 m walks out one burst of at most `KITE_MAX` (2 s) to 7 m, then shoots; caught or
  cornered, it fights hand to hand. It kites again only after `KITE_COOLDOWN` (8 s). Without a ranged token it stands
  off and holds fire; it never circles.
- **Walking.** A foe walking away turns first and steps only within `WALK_FACE_DEG` (45) of its way, so no foe walks
  backwards.

The brain's clock is the foes' own time (`src/ai/tacticsClock.js`), so a paused or slow frame cannot break it.

**Telegraphed blows** (`src/ai/foeBlows.js`, shapes in `src/ai/blowShapes.js`). A foe of the tier (`blowTier`:
`BLOW_TIER_LEVEL` 10 and up, or an elite; champions and revenants too) holding a melee token in reach rolls
`BLOW_CHANCE` (1 in 10) a classic tick, off cooldown, with no other wind-up within `BLOW_NEAR` (20 m). It stands the
wind-up with its aim locked and the ground marked (`src/render/foeTelegraph.js`); the landing is judged where the
target's feet stand. Families: beasts lunge; brutes slam and sweep; blades sweep and lunge; casters, the spectral,
the small and the flying throw none. Shapes beyond these three, poise and what a landing does are Feud's. A wind-up
rides the foe stream; online, each client judges its own feet. On the arena's sand a foe may wind up at a bout-mate.

**Anti-grief, always on, both lanes** (`src/characters/foeSpacing.js`).
- Foes of different pools (the street's watch and encounters, a building's foes and the watch called in) push apart
  pair by pair (`spaceAcross`).
- No foe holds a doorway (`clearDoorways`): a threshold `DOORWAY_DEPTH` (1.4 m) deep each side and 1.2 m either way
  across; a foe in it is eased out to its own side at 1.6 m/s unless its way lies through the door. Through the
  collider, never through a wall. Swing doors and dungeon and castle doors count.
- The watch called indoors spreads into the room on its own lanes (`src/scenes/cityGuards.js` `indoorWatchSpot`).
- A foe not hostile to the player standing between the crosshair and a door does not take the press
  (`src/player/mobileEnemyActivate.js`, `src/player/activate.js`).
- The pushes sweep a body at its live height (`sweepHeight`), so a ducking foe passes under a lintel.

## Rules

- Smarter AI applies everywhere when Enhanced AI is on (dungeons, streets, interiors, guards); classic DFU AI, byte for
  byte, when it is off (Mac).
- Billboard props block sight and missiles, both ways (Mac).
- Two melee and two ranged attackers a target; the rest hold the ring and wait (Mac).
- Animals and the cowardly human classes flee; undead, daedra, constructs and guards fight to the death (Mac).
- The anti-grief spacing and doorway rule are always on, on the classic lane too (Mac).
- Telegraphed blows go to level 10 and up or elites, used sparingly, always readable and dodgeable (Mac).
- With the switch off, DFU's motor runs to the bit; a seeded pin proves it.

## Daggerfall Unity

DFU's `EnemyMotor` walks in to 2.25 m and swings; it never strafes, backs off, circles or waits, and its sight ray
ignores billboards. We keep that motor whole for the classic lane and add the brain, cover and blows on top of it with
the switch on. DFU's quirk that a guard NPC facing a crime raises the watch whatever the ray meets is kept.

## Code and tests

- `src/ai/tactics.js` - the brain, tokens, ring, kiting, fleeing
- `src/ai/cover.js` - cover proxies and the index
- `src/ai/foeBlows.js`, `src/ai/blowShapes.js` - telegraphed blows
- `src/characters/foeSpacing.js` - cross-pool spacing and doorways
- `test/scenes/tact1.test.js` - cover
- `test/characters/enemy/tact2.test.js` - the brain, including the switch-off seeded pin
- `test/player/tact3.test.js` - anti-grief
- `test/characters/enemy/tact4.test.js` - telegraphed blows
- `test/characters/enemy/tact5_feedback.test.js` - no walking backwards, one kite, no circling archers
- `test/scenes/audittact.test.js` - the audit's fixes across all four
- `tools/foeTelegraphProbe.mjs` - the ground mark in a real WebGL2 context

## Open

- The player's other open moments (mid-swing recovery, casting, drinking) are not read by the brain.
- Ranged foes do not seek a clear line around cover.
- No table of see-through flats (fences, banners); the size floor decides.
- Not yet looked at on a real install.
