// PX30 - THE GAMEPLAY HUD, in the pixel language.
//
// Mac's reference is ESO's Clean UI: a compass across the top, the
// target named beneath it, three vitals along the bottom and the
// effects under those.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compassPlace, COMPASS_POINTS, COMPASS_SPAN } from '../src/ui/enhancedHud.js';
import { markFoeStruck, foeTarget, tickFoeTarget, clearFoeTarget, FOE_TARGET_SECONDS } from '../src/ui/hudFoeTarget.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('PX30 compass: the shortest way round, and off the strip is HIDDEN', () => {
  // A point at 0.98 is just LEFT of a player facing 0.02, not most of
  // a turn to the right - the wrap is the whole geometry here.
  assert.ok(Math.abs(compassPlace(0, 0.02) - 0.42) < 0.01, 'north sits just left of centre');
  assert.equal(compassPlace(0.02, 0.02), 0.5, 'dead ahead is the middle');
  assert.ok(Math.abs(compassPlace(0.98, 0.02) - 0.34) < 0.01, 'and 0.98 is LEFT, not right');
  // Off the visible span is NULL, never clamped: a marker pinned to the
  // rim says "north is exactly there", which is a lie.
  assert.equal(compassPlace(0.5, 0.02), null, 'south is behind you and not drawn');
  assert.equal(compassPlace(0.25, 0), null, 'east, a quarter turn away, is off a quarter-turn strip');
  // The edges are inclusive and symmetric.
  assert.equal(compassPlace(COMPASS_SPAN / 2, 0), 1);
  assert.equal(compassPlace(-COMPASS_SPAN / 2, 0), 0);
  assert.equal(COMPASS_POINTS.length, 8, 'eight points, the circle a player turns through');
  assert.deepEqual(COMPASS_POINTS.map(([l]) => l), ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
});

test('PX30 target: the blow you landed, and it FADES', () => {
  // Daggerfall tells you nothing about a foe's health, ever - this is a
  // DEPARTURE, and its source is the strike rather than the reticle,
  // because a reticle target wants a foe raycast every frame for an
  // answer the player only wants while fighting.
  clearFoeTarget();
  assert.equal(foeTarget(), null);
  const foe = { entity: { name: 'Grizzly Bear', health: 30, maxHealth: 50 } };
  markFoeStruck(foe, { fromPlayer: false });
  assert.equal(foeTarget(), null, 'a foe hitting ANOTHER foe is not your target');
  markFoeStruck(foe, { fromPlayer: true });
  assert.deepEqual({ ...foeTarget(), fade: 1 }, { name: 'Grizzly Bear', health: 30, maxHealth: 50, fade: 1 });
  // It goes. A bar that never leaves is furniture.
  tickFoeTarget(FOE_TARGET_SECONDS - 1);
  assert.ok(foeTarget(), 'still there a second before its time');
  assert.ok(foeTarget().fade < 1, 'and fading');
  tickFoeTarget(2);
  assert.equal(foeTarget(), null);
  // A dead thing has no health to report.
  markFoeStruck(foe, { fromPlayer: true });
  foe.dead = true;
  assert.equal(foeTarget(), null);
  clearFoeTarget();
});

test('PX30: the HUD rides the ONE host-agnostic call, and the classic keeps its own', () => {
  const hud = read('src/ui/hud.js');
  // drawHud is what all four hosts already make, "last, over the
  // viewmodel" - the same reasoning the damage flash rides.
  // PX30b gave the call the two hands; the shape it guards is
  // unchanged - one branch, on the skin, and it RETURNS.
  assert.match(hud, /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{\s*\n\s*drawEnhancedHud\(vitals, heading01, dt, \{/);
  const branch = hud.slice(hud.indexOf('if (isEnhanced() && typeof document'));
  assert.ok(branch.indexOf('return;') < branch.indexOf('if (!art) return;'), 'the enhanced branch returns');
  // ABOVE the `!art` return, like the flash: the enhanced HUD reads no
  // ARENA2, and a player whose HUD art failed still has vitals.
  assert.ok(hud.indexOf('drawEnhancedHud(') < hud.indexOf('if (!art) return;'), 'above the art gate');
  // ...and it RETURNS, so the classic bars, compass and icons do not
  // draw underneath it. Two HUDs at once is not a skin.
  const classic = hud.slice(hud.indexOf('if (!art) return;'));
  assert.ok(classic.includes('vitalsSkin(art)'), 'the classic HUD is still all there, below');
  // Both damage paths mark the target, and neither was asked for
  // anything new: `fromPlayer` is the flag each already took.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    assert.match(read(f), /markFoeStruck\((foe|f), \{ fromPlayer \}\);/, `${f} marks the struck foe`);
  }
});

test('PX30: it is a READOUT, and it is updated rather than rebuilt', () => {
  const src = read('src/ui/enhancedHud.js');
  const css = read('src/ui/enhancedStyle.js');
  // Nothing is pressed, nothing registers with the overlay stack, and
  // Tab does not close it - it is the game's own face.
  assert.match(css, /\.hud \{ position: fixed; inset: 0; z-index: 4; pointer-events: none;/);
  assert.match(src, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(src, /registerOverlay|addEventListener/, 'a readout listens to nothing');
  // UPDATED, NOT REBUILT: a per-frame innerHTML is PX19k's entrance
  // replay at sixty times a second. Every write is guarded.
  assert.match(src, /const put = \(node, key, value\) => \{\s*\n\s*if \(last\[key\] === value\) return;/);
  assert.match(src, /const width = \(node, key, pct\) => \{[\s\S]{0,160}if \(last\[key\] === v\) return;/);
  assert.match(src, /if \(last\.effects !== key\) \{/, 'the effect row is rebuilt only when the SET changes');
  // THE ONE BUNDLE WALK. The first draft invented a second one that
  // read a shape nothing produces, and the row came back empty.
  assert.match(src, /import \{ liveBundles \} from '\.\.\/systems\/mysticism\.js'/);
  assert.doesNotMatch(src, /entity\?\.effects\?\.bundles/, 'no second walk');
  assert.match(read('src/ui/hudActiveSpells.js'), /import \{ liveBundles \} from '\.\.\/systems\/mysticism\.js'/,
    'the same one the classic icons read');
});

test('PX30b: the breath bar and the two hands - each only when there is one', () => {
  const src = read('src/ui/enhancedHud.js');
  const css = read('src/ui/enhancedStyle.js');
  // THE BREATH is DFU's own two laws, imported rather than restated:
  // drawn only while holding breath (Amount 0 draws nothing) and RED
  // below (endurance >> 3) + 4.
  assert.match(src, /const showBreath = held > 0;/);
  assert.match(src, /breathShortThreshold\(liveStat\(vitals, 'endurance'\)\) > held/);
  assert.match(src, /import \{ compassScroll, breathShortThreshold \} from '\.\/hud\.js'/,
    'the threshold is the classic HUD\'s own');
  assert.match(read('src/ui/hud.js'), /export const breathShortThreshold = \(liveEndurance\) => \(liveEndurance >> 3\) \+ 4;/);
  assert.match(src, /maxBreath\(vitals\) \|\| 1/, 'and the ceiling is statMods\', not a number typed here');
  assert.match(css, /\.hud-breath \{ display: none;[\s\S]{0,80}\.hud-breath\.on \{ display: flex; \}/);
  // THE HANDS. The reference's ability bar has no Daggerfall
  // equivalent - there are no hotkeyed abilities - but the two things
  // it would hold do exist. Each plaque draws only when filled: an
  // empty one is PX14's drawn door, and a HUD is the worst place for
  // furniture that says nothing.
  assert.match(src, /parts\.readied\.classList\.toggle\('on', !!readyName\);/);
  assert.match(src, /parts\.weapon\.classList\.toggle\('on', !!weaponName\);/);
  assert.match(css, /\.hud-hand \{ display: none;/);
  assert.match(css, /\.hud-hand\.on \{ display: flex; \}/);
  // The host hands them over through drawHud's own options bag, so a
  // host that knows neither passes neither.
  assert.match(read('src/ui/hud.js'), /readied = null, weapon = null \} = \{\}\)/);
  assert.match(read('src/ui/hud.js'), /readied: readied \?\? null,\s*\n\s*weapon: weapon \?\? null,/);
  // ...and both are still GUARDED writes, like everything else here.
  assert.match(src, /if \(last\.readied !== readyName\) \{/);
  assert.match(src, /if \(last\.weapon !== weaponName\) \{/);
});
