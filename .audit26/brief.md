# AUDIT 26 surveyor brief (read fully before opening any code)

You are one surveyor in a full-codebase bug/parity audit of **project-dagger**
(`/home/user/project-dagger`), a 1:1 JavaScript port of Daggerfall, against its
source of truth **Daggerfall Unity** at `/home/user/interkarma/daggerfall-unity`
(commit 81e89e9, shallow; all C# under `Assets/Scripts/`, skip `Editor/`).
ARENA2 game data is NOT in this container — do not try to run data-gated tests.

## What "1:1" means (Port-Doctrine)

Ported faithfully, byte-exact constants: format readers, FormulaHelper and all
game math, world assembly, quest machine, items, magic, guilds, calendar,
banking, crime, save-relevant state semantics. Structure may be simplified
(fewer layers, no Unity scaffolding) — **behavior may not**.

Deliberate departures — do NOT report these as findings:
- Renderer: hand-rolled WebGL2 (no Unity rendering, no post stack).
- Characters: voxel system replaces billboard NPCs/enemies and the flat 2D
  paperdoll art. (Their DATA — enemy tables, equip laws — is still 1:1.)
- Runtime: browser/Vite/Node ESM; a mobile touch layer exists by approval.
- Audio synthesis: hand-rolled FM synth replaces the vendored SF2 midi synth
  (`AudioSynthesis/*`). The audio DIRECTOR (what plays when) is 1:1.
- The mod/asset-injection tree (`Utility/AssetInjection`, ModManager) and
  `Editor/` are out of scope. Unity engine plumbing as such (MonoBehaviour
  lifecycle, prefabs-as-mechanism, coroutine mechanics) is out of scope, but
  the BEHAVIOR Unity code expresses (what a coroutine's body does per tick,
  what a prefab's values are) is in scope.
- EnhancedCombatAI and mod-only branches: the port takes classic paths
  (EnhancedCombatAI = false). Report only classic-path divergence.

## What to hunt (both lenses, always)

PARITY (the port disagrees with the C#):
wrong constants/tables/enum defaults; missing arms and else-branches; inverted
or REORDERED conditions (order matters on the shared DFRandom LCG — every draw
consumed or skipped shifts every later consumer); unit mismatches (radians vs
degrees, seconds vs classic ticks, metres vs native units); integer truncation
vs float division; clamps applied before a later overwrite; struct-default
fields the C# omits (C# `new X() { ID = n }` fills every other field with the
STRUCT default, not null); `%` on negative numbers; Mathf semantics vs JS Math.

BUG (the port disagrees with itself):
a ported member with NO caller in src/ ("a ported function with no caller is a
comment" — grep src/ for consumers, and remember tests calling it do not
count); a law computed and thrown away at the host seam; a seam wired in one
host and missing in the others (four+ hosts own a motor: scenes/exterior.js,
scenes/world.js, scenes/worldModes.js, scenes/dungeonContext.js, plus
scenes/interior.js and the standalone scenes/dungeon.js where relevant);
async re-entrancy guards that DROP a request instead of coalescing; missing
teardown for GPU/audio allocations reachable from the object's end of life;
frame-gating functions where one exit returns undefined while others return a
value (hosts read undefined as "not handled"); optional calls on a METHOD of a
possibly-undefined object (`obj.method?.()` still dereferences obj); NaN
arithmetic paths; event listeners registered before their handler object
exists.

## Method

1. Read your chunk manifest. For each JS file, read it PROPERLY alongside the
   C# it cites (Grep the DFU tree by member name to find the right spot; a
   cited file's basename may appear in several DFU paths — pick by content).
2. Read the C# NEIGHBORHOOD, not just the cited lines: the sibling arm, the
   caller-side guard, the line after the closing brace. Most real findings in
   the previous audit lived one line outside the quoted region.
3. Check test/ for an existing pin before claiming divergence: a pin that
   asserts the port's current behavior while citing the C# is either your
   finding confirmed (the pin restates the port — say so) or your misreading.
4. Prioritize by behavioral weight: formulas, laws, tables, tick order > glue.
   If you cannot read everything, SAY exactly what you did not read in
   coverageNotes — an unread file stated is worth more than a skimmed file
   implied.

## Evidence discipline

Every finding must carry BOTH sides, read by you personally this session:
the C# behavior (file, line, what it does) and the port behavior (file, line,
what it does instead), plus the observable in-game consequence. No finding
without a concrete consequence. The refuters who read your claims are
instructed to kill by default — previous audits killed 8/62 and 84 claims.
A false gap sends a slice to rebuild working code; do not pad, do not
speculate, do not report style. If you are not sure, either verify or drop it.

Severity: `bug` = wrong behavior a player can hit; `parity` = measurable
divergence from DFU law (even if subtle); `nit` = technically divergent,
negligible impact. Confidence: how sure YOU are after reading both sides.
