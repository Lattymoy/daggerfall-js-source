// CH3-slice (AUDIT 23 characters-8/13): enemy FALL DAMAGE and the
// EQUIP DELAY consumer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { FALL_DAMAGE_THRESHOLD, FALL_HP_PER_METRE } from '../src/player/motor.js';
import { EQUIP_DELAY_TIMES } from '../src/characters/weaponStates.js';
import { equipItem, unequipSlot, EQUIP_SLOTS } from '../src/systems/equip.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

test('ch3 characters-8: the fall tracker - grounded refreshes, a past-threshold landing reports once', () => {
  // drive the tracker directly over a minimal state record
  const s = { feet: [0, 10, 0], lastGroundedY: 10, landedFall: 0, _airborne: false };
  const track = (grounded) => EnemyAI.prototype._trackFall.call(s, grounded);
  assert.equal(FALL_DAMAGE_THRESHOLD, 5.0);
  assert.equal(FALL_HP_PER_METRE, 5);
  // walking on level ground: refresh, never a report
  track(true); s.feet[1] = 10.2; track(true);
  assert.equal(s.lastGroundedY, 10.2);
  assert.equal(s.landedFall, 0);
  // an 8.2-unit drop: airborne frames, then the landing reports the drop
  track(false); s.feet[1] = 6; track(false); s.feet[1] = 2; track(true);
  assert.ok(Math.abs(s.landedFall - 8.2) < 1e-9, 'the landing reports LastGroundedY - y');
  assert.equal(s.lastGroundedY, 2, 'and the grounded height re-anchors');
  // the host's formula on that report - double math, exactly as the
  // C# cast does it: 8.2 - 5 = 3.1999..., x5 = 15.999..., trunc 15
  assert.equal(Math.trunc(FALL_HP_PER_METRE * (s.landedFall - FALL_DAMAGE_THRESHOLD)), 15);
  // a 4-unit hop stays under the threshold: silent
  s.landedFall = 0;
  track(false); s.feet[1] = -2; track(true);
  assert.equal(s.landedFall, 0, '4 units is under the 5.0 threshold');
});

/** The `{ ... }` block containing index `i`, matched rather than
 *  guessed at by character count. */
function braceBlock(text, i) {
  const open = text.lastIndexOf('{', i);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    if (text[k] === '{') depth++;
    else if (text[k] === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  return text.slice(open);
}

test('ch3 characters-8: both pools bill the landing through their damage doors with the clip', () => {
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js']) {
    const t = src(f);
    const i = t.indexOf('f.ai.landedFall > 0');
    assert.ok(i > 0, `${f}: the landing report is consumed`);
    // AUDIT 24 (wave 39): this used to slice a fixed 500 characters,
    // which is a window, not a block - one added comment pushed
    // damageFoe out of it and the pin failed on unchanged behaviour.
    // Brace-match the arm instead, so it cannot drift again.
    const arm = braceBlock(t, i);
    assert.ok(arm.includes('FALL_HP_PER_METRE * (f.ai.landedFall - FALL_DAMAGE_THRESHOLD)'), `${f}: the shared formula`);
    assert.ok(arm.includes('SOUND.FallDamage'), `${f}: the landing rings`);
    assert.ok(arm.includes('damageFoe(f, '), `${f}: through the pool's damage door`);
  }
});

test('ch3 characters-13: the swap pause - both halves bill, the table quirk, the rig block and drain', () => {
  const e = { items: [], stats: {} };
  const dagger = { group: 'Weapons', templateIndex: 113 };
  // equipping into an empty hand bills the arriver alone (Dagger = 500)
  equipItem(e, dagger);
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[0]);
  assert.equal(e.equipCountdown, 500);
  // swapping to a Katana bills the leaver AND the arriver (+= sum)
  const katana = { group: 'Weapons', templateIndex: 123 };
  equipItem(e, katana);
  assert.equal(e.equipCountdown, 500 + 500 + EQUIP_DELAY_TIMES[10], 'dagger out + katana in accumulate');
  // a bare unequip bills the leaver
  e.equipCountdown = 0;
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[10], 'the katana leaving bills alone');
  // the verbatim quirk: a shield indexes its ARMOR group index into
  // the WEAPON delay table (Buckler 109 -> armor index 7 -> 1700)
  e.equipCountdown = 0;
  equipItem(e, { group: 'Armor', templateIndex: 109 });
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[7]);
  // a non-hand piece bills nothing
  e.equipCountdown = 0;
  equipItem(e, { group: 'Armor', templateIndex: 102 });   // cuirass -> chest
  assert.equal(e.equipCountdown, 0, 'only hand slots pause the swing');
  // the rig: the block + the classic 980/s drain
  const rig = src('src/combat/weaponRig.js');
  assert.ok(rig.includes("(entity?.equipCountdown ?? 0) > 0) return;"), 'a running pause blocks the attack input');
  assert.ok(rig.includes('entity.equipCountdown - dt * 980'), 'and drains at the classic approximation');
});
