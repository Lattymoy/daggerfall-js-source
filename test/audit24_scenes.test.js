// AUDIT 24 (the full-codebase parity sweep), scenes + render.
// The guard pool and the magic host both need ARENA2 to drive end to
// end, so the laws that changed are pinned where they are written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRESS_BUTTON_TO_FIRE_SPELL } from '../src/systems/mysticism.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('audit24 scenes: seenByGuard rides ANY raycast hit, not a clear line', () => {
  // PlayerEntity.cs:722-728 - `if (Physics.Raycast(ray, out hit,
  // 77.5f)) { ...if (entity == PlayerEntityBehaviour) seen = true;
  // if (npc.IsGuard) seenByGuard = true; }`. Only `seen` is gated on
  // the ray reaching the player; seenByGuard needs only that the ray
  // hit something, which at <=77.5m aimed at the player's eye it
  // always does. A guard behind a market stall still raises the watch.
  const t = rd('src/scenes/cityGuards.js');
  const i = t.indexOf('const hit = collider.raycast(eye, dir, dist);');
  assert.ok(i > 0);
  const arm = t.slice(i, i + 1100);
  assert.match(arm, /const clear = !Number\.isFinite\(hit\) \|\| hit >= dist - 1e-3;/);
  assert.match(arm, /if \(clear\) seen = true;/);
  // DFU's raycast always hits SOMETHING (the player, or the wall
  // between), so seenByGuard is unconditional once the NPC is a guard
  // in range and facing. The port's collider carries no player, so a
  // clear line and a blocked one are both "hit something".
  assert.match(arm, /if \(p\.guard\) seenByGuard = true;/);
  assert.equal(/if \(clear\) \{\s*\n\s*seen = true;\s*\n\s*if \(p\.guard\)/.test(arm), false,
    'seenByGuard no longer sits inside the cleared-LOS branch');
});

test('audit24 scenes: the guard countdown is the INT Random.Range overload', () => {
  // `Random.Range(5, 10 + 1)` with two int literals is the int
  // overload - one of {5,6,7,8,9,10} (PlayerEntity.cs:739).
  assert.match(rd('src/scenes/cityGuards.js'),
    /countdown = 5 \+ Math\.floor\(rand\(\) \* 6\);/);
  const draw = (r) => 5 + Math.floor(r * 6);
  assert.equal(draw(0), 5);
  assert.equal(draw(0.999999), 10, 'ten is REACHABLE, which the float draw never made it');
  const seen = new Set();
  for (let i = 0; i < 600; i++) seen.add(draw(i / 600));
  assert.deepEqual([...seen].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10]);
});

test('audit24 scenes: the ready-spell HUD line is SetReadySpell\'s own string', () => {
  assert.equal(PRESS_BUTTON_TO_FIRE_SPELL, 'Press button to fire spell.');
  const t = rd('src/scenes/hostMagic.js');
  assert.match(t, /say\(PRESS_BUTTON_TO_FIRE_SPELL\);/);
  assert.equal(/say\(`\$\{sp\.name\} readied\.`\)/.test(t), false);
});

test('audit24 scenes: lastCastCost is stamped AFTER the CasterOnly cast lands', () => {
  // PlayerSpellCasting_OnReleaseFrame assigns the CasterOnly bundle at
  // :2117 and stamps lastReadySpellCastingCost only at :2138, so
  // AssignBundle's absorption cap (:603, gated `> 0`) reads the
  // PREVIOUS cast's cost - and on the first cast of a session there is
  // no cap at all.
  const t = rd('src/scenes/hostMagic.js');
  const apply = t.indexOf('const r = applySpellToPlayer(sp, playerEntity.level, playerCaster());');
  const stamp = t.indexOf('lastCastCost = cost;');
  assert.ok(apply > 0 && stamp > 0);
  assert.ok(stamp > apply, 'the stamp follows the self-cast, as C# orders it');
});

test('audit24 render: the two citations point at the lines they quote', () => {
  // No runtime difference - but in a port whose comments ARE the parity
  // ledger, a citation that lands on a bare closing brace costs the
  // next reader the whole derivation again.
  const sky = rd('src/render/skyRenderer.js');
  assert.match(sky, /DaggerfallSky\.cs:554\/:617 `colors\.west\[0\]`/);
  assert.match(sky, /Verbatim DaggerfallSky\.cs:617 `skyColors\.clearColor = skyColors\.west\[0\]`/);
  assert.equal(/DaggerfallSky\.cs:611|LoadVanillaNightSky:605-610/.test(sky), false,
    ':611 is the seam loop\'s closing brace, and the loop is :606-611');
  const flat = rd('src/render/flatAnimation.js');
  assert.match(flat, /DaggerfallBillboard\.cs:38-39, :46/);
  assert.match(flat, /framesPerSecond \(:46\)/);
  assert.equal(/:110-165|framesPerSecond \(:45\)/.test(flat), false);
});
