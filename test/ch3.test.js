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
import { equipItem, unequipSlot, EQUIP_SLOTS, equipDelaySnapshot, billEquipDelayOnClose } from '../src/systems/equip.js';

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
  // MT-iv: the arm's OWN opening brace - the one at or after the
  // match - not the last one before it. `lastIndexOf` picked up
  // whatever statement happened to sit above the arm, so a helper
  // declared just before it shadowed the block this pin means to
  // read. Same intent the wave-39 comment states ("brace-match the
  // arm instead, so it cannot drift again"), now actually anchored
  // to the arm.
  const open = text.indexOf('{', i);
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

test('ch3 characters-13 -> FX1 (F128): the swap pause bills PER INVENTORY VISIT, at the window seam', () => {
  const e = { items: [], stats: {} };
  const dagger = { group: 'Weapons', templateIndex: 113 };
  const katana = { group: 'Weapons', templateIndex: 123 };
  // The equip table itself bills NOTHING now - DFU's SetEquipDelayTime
  // lives on the inventory WINDOW (:667 snapshot, :729 bill), and CH3's
  // per-transition bill overcharged every multi-step swap.
  equipItem(e, dagger);
  equipItem(e, katana);
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  assert.equal(e.equipCountdown ?? 0, 0, 'transitions outside a visit are free');
  // ONE VISIT, empty hands -> katana (the dagger passes through):
  // bills the katana alone (3400), not CH3's 500 + 500 + 3400.
  let snap = equipDelaySnapshot(e);
  equipItem(e, dagger);
  equipItem(e, katana);
  let r = billEquipDelayOnClose(e, snap);
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[10]);
  assert.deepEqual(r.equipping, [katana], 'the Equipping cue names the arriver');
  // a SWAP visit bills leaver + arriver (the += sum, :1170-1176)
  e.equipCountdown = 0;
  snap = equipDelaySnapshot(e);
  equipItem(e, dagger);
  billEquipDelayOnClose(e, snap);
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[10] + EQUIP_DELAY_TIMES[0], 'katana out + dagger in');
  // re-equipping the SAME weapon bills nothing (reference compare,
  // lastRightHandItem != currentRightHandItem)
  e.equipCountdown = 0;
  snap = equipDelaySnapshot(e);
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  equipItem(e, dagger);
  r = billEquipDelayOnClose(e, snap);
  assert.equal(e.equipCountdown ?? 0, 0, 'same item back = no change = no bill');
  assert.deepEqual(r.equipping, []);
  // the verbatim quirk survives the move: a shield indexes its ARMOR
  // group index into the WEAPON delay table (Buckler 109 -> 7 -> 1700)
  e.equipCountdown = 0;
  snap = equipDelaySnapshot(e);
  equipItem(e, { group: 'Armor', templateIndex: 109 });
  billEquipDelayOnClose(e, snap);
  assert.equal(e.equipCountdown, EQUIP_DELAY_TIMES[7]);
  // a non-hand piece bills nothing (the hands did not change)
  e.equipCountdown = 0;
  snap = equipDelaySnapshot(e);
  equipItem(e, { group: 'Armor', templateIndex: 102 });   // cuirass -> chest
  billEquipDelayOnClose(e, snap);
  assert.equal(e.equipCountdown, 0, 'only hand slots pause the swing');
  // the rig: the block + the classic 980/s drain (unchanged)
  const rig = src('src/combat/weaponRig.js');
  assert.ok(rig.includes("(entity?.equipCountdown ?? 0) > 0) return;"), 'a running pause blocks the attack input');
  assert.ok(rig.includes('entity.equipCountdown - dt * 980'), 'and drains at the classic approximation');
  // the window owns the clock: snapshot in the ctor, bill in the ONE
  // close law (the B-C1 seam, so hand-offs bill too)
  const w = src('src/ui/nativeInventory.js');
  assert.ok(w.includes('this._handSnapshot = hooks.entity ? equipDelaySnapshot(hooks.entity) : null;'), 'push snapshots');
  assert.ok(w.includes('billEquipDelayOnClose(this.hooks.entity, this._handSnapshot)'), 'pop bills once');
  assert.ok(w.includes('`Equipping ${templateByIndex(it.templateIndex)?.name ?? it.name ?? \'\'}`'), 'the Internal_Strings equippingWeapon cue');
});
