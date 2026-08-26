// AUDIT 26 - F027's HOST half. player/motor.js has carried
// LevitateMotor.cs:83-89's forced sink since P11, but the law reads a
// `carriedWeight` thunk from the constructor's options and no host
// passed one, so `this.carriedWeight?.() ?? 0` answered 0 kg forever
// and no swimmer in the game was ever over-encumbered.
//
// These pins drive the motor through the HOSTS' OWN constructor
// expression - the `carriedWeight:` argument text is lifted out of
// each scene file and evaluated - so dropping the argument from a
// host fails the test rather than quietly re-arming the bug.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PlayerMotor, walkSpeed, swimSpeed, OVER_ENCUMBERED_QUARTER_KG } from '../src/player/motor.js';
import { totalWeight, goldStack, GOLD_PIECE_WEIGHT_KG } from '../src/systems/inventory.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');
const approx = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} !~ ${b}`);

// The three hosts that construct a PlayerMotor. worldModes.js and
// dungeonContext.js are N/A - neither constructs one; they are handed
// the motor these hosts built.
const HOSTS = ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js'];

const DT = 1 / 60;
const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const recorder = () => {
  const moves = [];
  return {
    moves,
    penetrationAt: () => 0,
    move(pos, dx, dy, dz) { pos[0] += dx; pos[1] += dy; pos[2] += dz; moves.push(dy); return { grounded: false }; },
  };
};

/** Lift the host's own `carriedWeight:` argument out of its
 *  `new PlayerMotor(...)` call and compile it, so the pin below runs
 *  the SHIPPED expression rather than a hand-made options bag. */
function hostCarriedWeight(file, entity) {
  const s = src(file);
  const i = s.indexOf('new PlayerMotor(');
  assert.ok(i > 0, `${file} constructs a PlayerMotor`);
  const end = s.indexOf('});', i);
  assert.ok(end > i, `${file}: the PlayerMotor call closes`);
  const m = /carriedWeight:\s*(.+?)\s*$/.exec(s.slice(i, end));
  assert.ok(m, `${file} passes carriedWeight (LevitateMotor.cs:83 reads PlayerEntity.CarriedWeight)`);
  return new Function('playerEntity', 'totalWeight', `return (${m[1]});`)(entity, totalWeight);
}

test('audit26 F027: every motor-building host feeds PlayerEntity.CarriedWeight, and the over-encumbered swimmer sinks', () => {
  // CarriedWeight (PlayerEntity.cs:184) = Items.GetWeight() +
  // goldPieces * 0.0025. Gold is a Currency stack INSIDE items in this
  // port, so the coins ride the items sum and are counted once.
  assert.equal(OVER_ENCUMBERED_QUARTER_KG, 250);
  assert.equal(GOLD_PIECE_WEIGHT_KG, 0.0025);
  // 250 quarter-kg = 62.5 kg = exactly 25000 gold pieces, and the C#
  // test is a strict `>`, so 25000 floats and 25001 sinks.
  approx(totalWeight([goldStack(25000)]), 62.5, 'DaggerfallBankManager.goldPieceWeightInKg x 25000');
  const sinkSpeed = swimSpeed(walkSpeed(50), 30);

  for (const host of HOSTS) {
    const entity = { items: [goldStack(25000)] };
    const carriedWeight = hostCarriedWeight(host, entity);
    approx(carriedWeight(), 62.5, `${host}: the thunk weighs the purse`);

    const rec = recorder();
    const m = new PlayerMotor(rec, undefined, { carriedWeight });
    m.spawn(0, 0, 0);
    m.swimming = true;
    const floatUp = { ...IDLE, up: true };

    // At the line exactly he still floats (LevitateMotor.cs:83's `>`).
    m.update(DT, floatUp, 0, 0);
    approx(rec.moves.at(-1), sinkSpeed * DT, `${host}: 250 quarter-kg floats`);

    // One more coin crosses it. The thunk is read LIVE at the move, as
    // LevitateMotor.Update reads CarriedWeight - no reconstruction.
    entity.items[0].stackCount = 25001;
    approx(carriedWeight(), 62.5025, `${host}: the thunk is live`);
    m.update(DT, floatUp, 0, 0);
    approx(rec.moves.at(-1), -sinkSpeed * DT,
      `${host}: over-encumbered, FloatUp cannot lift him (:83-85)`);
    m.update(DT, { ...IDLE, down: true }, 0, 0);
    approx(rec.moves.at(-1), -sinkSpeed * DT, `${host}: FloatDown is the same forced sink`);

    // The two exclusions the C# ladder names (:84), through the same
    // host-built motor.
    m.waterWalking = true;
    m.update(DT, floatUp, 0, 0);
    assert.ok(rec.moves.at(-1) > 0, `${host}: a water-walking swimmer floats`);
    m.waterWalking = false;
    // `&& !playerLevitating` on the overEncumbered term itself (:83).
    m.levitating = true;
    m.update(DT, floatUp, 0, 0);
    assert.ok(rec.moves.at(-1) > 0, `${host}: levitation exempts`);
    m.levitating = false;

    // A light pack never sinks, no matter the load's shape.
    entity.items = [goldStack(100)];
    m.update(DT, floatUp, 0, 0);
    approx(rec.moves.at(-1), sinkSpeed * DT, `${host}: a light swimmer floats`);
  }
});

test('audit26 F027: the hosts weigh the whole pack, gold counted exactly once', () => {
  // If the coins were dropped from the sum, 25001 gold would float; if
  // they were added twice (an items sum PLUS a separate goldPieces
  // term), 12501 would sink. Both are pinned here through the hosts'
  // own expression.
  for (const host of HOSTS) {
    const entity = { items: [goldStack(12501)] };
    const carriedWeight = hostCarriedWeight(host, entity);
    approx(carriedWeight() * 4, 125.01, `${host}: half a sinking purse is half the weight`);
    entity.items = [goldStack(25001)];
    approx(carriedWeight() * 4, 250.01, `${host}: the purse alone crosses the line`);
    // and a non-currency item adds on top of it, not instead of it
    entity.items = [goldStack(25001), { group: 'Armor', templateIndex: 102, material: 0x0201 }];
    approx(carriedWeight(), 62.5025 + 15.5, `${host}: items and coins both counted`);
  }
});
