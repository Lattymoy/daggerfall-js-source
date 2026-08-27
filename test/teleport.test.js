// TP-slice: the Teleport (Recall) effect - Teleport.cs whole minus
// the cross-host arm (flagged loud). The (43,255) effect PROMPTS on
// a self arrival (:63-68), the anchor stores on the entity (:115),
// teleporting consumes it on arrival (:133 and :255 both null it),
// no anchor says 4001, and a cast inside a mode leaves it first
// (:151's immediate transition).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applySpell } from '../src/systems/effects.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const teleportEffect = () => ({ type: 43, subType: -1 });

test('TP: a self-cast Teleport RAISES the prompt marker; a hostile arrival never does', () => {
  const target = { stats: { willpower: 0 }, career: {} };
  // CasterOnly: the marker rises, nothing assigns (Start prompts, :63-68)
  const r = applySpell({ rangeType: 0, element: 4, effects: [teleportEffect()] }, 1, target, {}, seq(0));
  assert.equal(r.teleport, true);
  assert.equal(target.activeEffects?.length ?? 0, 0, 'the effect assigns nothing - the host owns the box');
  // TargetFlags_Self (:52): a ranged arrival is dropped silently
  const r2 = applySpell({ rangeType: 2, element: 4, effects: [teleportEffect()] }, 1, target, {}, seq(0));
  assert.ok(!r2.teleport, 'the property gate holds');
  // a bundle carrying teleport + heal still heals
  const t3 = { stats: { willpower: 0 }, career: {}, health: 5, maxHealth: 20 };
  let healed = 0;
  const r3 = applySpell({ rangeType: 0, element: 4, effects: [teleportEffect(), { type: 10, subType: 8, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] },
    1, t3, { heal: (n) => { healed += n; } }, seq(0));
  assert.equal(r3.teleport, true);
  assert.equal(healed, 3, 'the rest of the bundle processes');
});

test('TP: the anchor rides the save envelope; pre-TP saves restore null', () => {
  const entity = { stats: { endurance: 50 }, skills: [], skillUses: [], items: [], spells: [],
    anchorPosition: { mode: 'world-exterior', pixel: { x: 40, y: 100 }, nativeX: 123, nativeZ: 456, y: 7 } };
  const snap = snapshotPlayer(entity, {});
  assert.deepEqual(snap.anchorPosition, entity.anchorPosition);
  assert.notEqual(snap.anchorPosition, entity.anchorPosition, 'a copy, not an alias');
  const back = { stats: {} };
  restorePlayer(back, snap);
  assert.deepEqual(back.anchorPosition, entity.anchorPosition);
  delete snap.anchorPosition;
  const old = { stats: {} };
  restorePlayer(old, snap);
  assert.equal(old.anchorPosition, null, 'pre-TP saves restore no anchor');
});

test('TP: the engine seam, the world prompt, the consume, the mode exit', () => {
  const hm = readFileSync(new URL('../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.ok(hm.includes('if (r.teleport) onTeleport?.();'), 'every player arrival routes the prompt');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(w.includes("code: 'KeyA', label: 'A - set anchor'"), 'the 4000 box: the anchor arm');
  assert.ok(w.includes("code: 'KeyT', label: 'T - teleport'"), 'the 4000 box: the teleport arm');
  assert.ok(w.includes("townTalk.say('You must set an anchor first.')"), 'the 4001 refusal');
  assert.ok(w.includes('playerEntity.anchorPosition = null;   // consumed on arrival, both DFU arms'),
    'the arrival consumes the anchor (:133/:255)');
  // wave 37: `modes?.` - the binding is hoisted and this line is above
  // its assignment, so the guard belongs on the OBJECT (audit24_wave37).
  assert.ok(w.includes("!== 'exterior') modes?.forceExitToExterior();"), 'a cast inside a mode leaves it first (:151)');
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const i = wm.indexOf('forceExitToExterior(');   // IS1 grew the signature ({ cacheScene })
  const fn = wm.slice(i, wm.indexOf('},', i));
  assert.ok(fn.includes("mode = 'exterior';"), 'the forced exit lands the mode');
  assert.ok(fn.includes('player.collider = baseCollider();'), 'and restores the exterior collider');
  // the other hosts refuse LOUDLY (INTERIM doctrine), never silently
  for (const host of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const h = readFileSync(new URL(`../${host}`, import.meta.url), 'utf8');
    assert.ok(h.includes('onTeleport: () =>') && h.includes('Recall pends'), `${host} says the interim line`);
  }
});
