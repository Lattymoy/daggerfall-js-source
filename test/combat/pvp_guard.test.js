// PVP-GUARD (the PvP rework, 2026-10-28, "Real health + armour"): a player's blow on a player is taken through the struck
// player's armour - the overhaul's reduction (combat/pcaao.js) for the blow's kind, averaged over the body parts - before
// PVP-HIT's cap. The struck player reports the shares (`g` on the vit frame); the referee bounds them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EQUIP_SLOTS, equipTableOf } from '../../src/systems/equip.js';
import { pvpArmorKept } from '../../src/combat/pvpGuard.js';
import { PVP_GUARD, guardedBlow, takeHealthReport, HEALTH_SHARE_WHOLE } from '../../src/net/siege/refereeHealthShare.js';
import { SIEGE_HIT, SIEGE_UNITS_PER_M, newFighter, refereeBlow, pvpBlowKind } from '../../src/net/siege/siegeRef.js';
import { validVitIn, VIT_GUARD_MAX } from '../../src/net/wire.js';
import { createRefereeHealthMirror } from '../../src/net/siege/refereeHealthMirror.js';

const stats = (v) => ({ strength: v, intelligence: 50, willpower: v, agility: 50, endurance: v, personality: 50, speed: 50, luck: 50 });
const body = (v = 50) => ({ isPlayer: true, level: 5, stats: stats(v), skills: {}, items: [], health: 50, maxHealth: 60 });
const PIECES = [[102, 'ChestArmor'], [103, 'LegsArmor'], [107, 'Head'], [104, 'LeftArm'], [105, 'RightArm'], [106, 'Gloves'], [108, 'Feet']];
const suit = (e, material, condition = 1000) => {
  const t = equipTableOf(e);
  for (const [templateIndex, slot] of PIECES) t[EQUIP_SLOTS[slot]] = { group: 'Armor', templateIndex, material, maxCondition: 1000, currentCondition: condition };
  return e;
};
const at = (m) => ({ x: m * SIEGE_UNITS_PER_M, y: 0, z: 0 });

test('PVP-GUARD: the shares a body reports - bare is whole, Daedric plate keeps the overhaul\'s rows, the natural resistance on top (mutants: a kind\'s row swapped; the resistance unread)', () => {
  assert.deepEqual(pvpArmorKept(body(50)), [100, 100, 100], 'bare, at 50s');
  assert.deepEqual(pvpArmorKept(body(100)), [80, 80, 80], 'bare, at 100s: the resistance alone');
  assert.deepEqual(pvpArmorKept(suit(body(50), 0x209)), [34, 40, 30], 'Daedric: edged, blunt, unarmed');
  assert.deepEqual(pvpArmorKept(suit(body(100), 0x209)), [14, 20, 10], 'Daedric at 100s');
  assert.deepEqual(pvpArmorKept(suit(body(50), 0)), [88, 72, 90], 'leather');
  const worn = pvpArmorKept(suit(body(50), 0x209, 100));
  assert.ok(worn[0] > 34, 'a worn suit keeps less off');
});

test('PVP-GUARD: the kind of a blow, and the referee takes the reported share before PVP-HIT (mutants: the guard unread; blunt read as edged)', () => {
  assert.deepEqual([pvpBlowKind(-1), pvpBlowKind(124), pvpBlowKind(115), pvpBlowKind(120), pvpBlowKind(130)], ['unarmed', 'blunt', 'blunt', 'edged', 'edged']);
  const now = 1_000_000;
  const a = newFighter(10, now);
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  assert.equal(guardedBlow(b, 'edged', 200), 200, 'unreported: nothing worn');
  assert.equal(takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], max: 1000, guard: [34, 40, 30] }, now), true);
  assert.deepEqual(b.share.guard, [34, 40, 30]);
  const blow = (w, d, t) => refereeBlow(a, b, { from: at(0), at: at(2), held: { w, m: 0 }, d, r: SIEGE_HIT.Melee }, t);
  assert.equal(blow(120, 200, now).dealt, 68, 'a longsword: 34%');
  assert.equal(blow(124, 200, now + 1000).dealt, 80, 'a mace: 40%');
  assert.equal(blow(-1, 200, now + 2000).dealt, 60, 'a fist: 30%');
  assert.equal(blow(120, 2000, now + 3000).dealt, 450, 'the armour first, then the 45% cap');
  assert.equal(guardedBlow(b, 'edged', 1), 1, 'a blow that lands takes at least 1');
  assert.equal(guardedBlow(b, 'edged', 0), 0);
});

test('PVP-GUARD: the referee bounds a claim - never under PVP_GUARD.min, never over its max; the wire takes three shares or none (mutants: the floor unread)', () => {
  assert.deepEqual(PVP_GUARD, { min: 10, max: 150, bare: 100 });
  const now = 1_000_000;
  const b = newFighter(50, now); b.max = 1000; b.hp = 1000;
  takeHealthReport(b, { report: 1, share: HEALTH_SHARE_WHOLE, seen: [], guard: [0, 3, 150] }, now);
  assert.deepEqual(b.share.guard, [10, 10, 150]);
  const base = { n: 1, s: 5000, seen: [] };
  assert.deepEqual(validVitIn({ ...base, g: [34, 40, 30] })?.guard, [34, 40, 30]);
  assert.equal(validVitIn({ ...base }).guard, undefined);
  assert.equal(validVitIn({ ...base, g: [34, 40] }), null, 'three or none');
  assert.equal(validVitIn({ ...base, g: [34, 40, VIT_GUARD_MAX + 1] }), null);
  assert.equal(validVitIn({ ...base, g: [34, 40, 1.5] }), null);
});

test('PVP-GUARD: the mirror sends my shares and reports again when my armour changes (mutants: the change unseen)', () => {
  let t = 0, g = [100, 100, 100];
  const sent = [];
  const me = { health: 50, maxHealth: 100 };
  const m = createRefereeHealthMirror({ read: () => me, write: (h) => { me.health = h; }, send: (r) => { sent.push(r); return true; }, now: () => t, guard: () => g });
  m.frame(true);
  assert.deepEqual(sent.at(-1).g, [100, 100, 100]);
  t += 1000; m.frame(true);
  assert.equal(sent.length, 1, 'nothing moved, nothing sent');
  g = [34, 40, 30]; t += 1000; m.frame(true);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.at(-1).g, [34, 40, 30]);
});
