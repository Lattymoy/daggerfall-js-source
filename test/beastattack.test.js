// ATTACKS FOR BODIES WITH NO ARMS.
//
// enemyAttack.js is a verbatim DFU port and its timing is right for
// everything: a bear and a knight attack on the same clock. But its own
// comment says it plays "the authored 1H strike clips", which are ARM
// animations — and nine enemies collapse their arm groups to a POINT.
// The timer fired, the hit landed, the damage applied, and the bear did
// not move.
import test from 'node:test';
import assert from 'node:assert';
import { BEAST_ATTACKS, beastAttackPose, hitPointOf, hitCountOf } from '../src/characters/beastAttack.js';
import { BEAST_DESIGNS } from '../src/characters/beasts.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

/** Everything with no arms to swing. */
const ARMLESS = BEAST_DESIGNS.filter((d) => d.beast || d.arachnid || (d.fish && (d.collapse || []).length === 0));

test('every armless enemy says how it reaches you', () => {
  for (const d of ARMLESS) {
    assert.ok(d.attack, `${d.name} has no arms and no attack — it would hit without moving`);
    assert.ok(
      Object.values(BEAST_ATTACKS).includes(d.attack),
      `${d.name} attacks with "${d.attack}", which is not a kind that exists`,
    );
  }
});

test('a design with arms does NOT get a beast attack', () => {
  // The lamia has a fish tail and a woman's arms: she swings, and giving
  // her a lunge as well would be two attacks on one enemy.
  const lamia = BEAST_DESIGNS.find((d) => d.name === 'Lamia');
  assert.ok(lamia.fish, 'the lamia lost her tail');
  assert.ok(!lamia.attack, 'the lamia has a beast attack — she has arms to swing');
});

test('the motion peaks on the frame the game says the blow lands', () => {
  // The timing is not invented. Every enemy carries
  // primaryAttackAnimFrames, with -1 marking the connecting frame, so a
  // clip is a curve over the game's own data rather than a guess about
  // how long a bear takes.
  for (const d of ARMLESS) {
    const frames = ENEMY_BASICS[d.id].primaryAttackAnimFrames;
    const hit = hitPointOf(frames);
    let best = -1;
    let at = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = beastAttackPose(d.attack, t, hit);
      const reach = Math.abs(p.z) + Math.abs(p.pitch) * 0.4;
      if (reach > best) {
        best = reach;
        at = t;
      }
    }
    assert.ok(
      Math.abs(at - hit) < 0.08,
      `${d.name}: hit lands at ${hit.toFixed(2)} but the motion peaks at ${at.toFixed(2)}`,
    );
    assert.ok(best > 0.1, `${d.name}'s attack barely moves it — that is the bug this file exists for`);
  }
});

test('a slaughterfish bites twice, because the data says so', () => {
  const fish = ENEMY_BASICS[BEAST_DESIGNS.find((d) => d.name === 'Slaughterfish').id];
  assert.equal(hitCountOf(fish.primaryAttackAnimFrames), 2, 'the second -1 frame has been lost');
  // And nothing else in the armless set does.
  for (const d of ARMLESS) {
    if (d.name === 'Slaughterfish') continue;
    assert.equal(hitCountOf(ENEMY_BASICS[d.id].primaryAttackAnimFrames), 1, `${d.name} suddenly hits twice`);
  }
});

test('the clip returns to rest, and does not drift', () => {
  // A pose that ends anywhere but zero leaves the animal displaced after
  // every swing, and after three attacks it is standing somewhere else.
  for (const kind of Object.values(BEAST_ATTACKS)) {
    const end = beastAttackPose(kind, 1, 0.45);
    for (const [k, v] of Object.entries(end)) {
      assert.ok(Math.abs(v) < 0.02, `${kind} ends with ${k}=${v.toFixed(3)} — it will walk away from itself`);
    }
  }
});

test('the kinds are actually different motions', () => {
  // Five names for one curve would be five enemies attacking identically.
  const sig = (kind) => {
    let s = '';
    for (let t = 0; t <= 1; t += 0.1) {
      const p = beastAttackPose(kind, t, 0.45);
      s += `${p.z.toFixed(2)},${p.y.toFixed(2)},${p.pitch.toFixed(2)};`;
    }
    return s;
  };
  const seen = new Map();
  for (const kind of Object.values(BEAST_ATTACKS)) {
    const s = sig(kind);
    assert.ok(!seen.has(s), `${kind} moves identically to ${seen.get(s)}`);
    seen.set(s, kind);
  }
  // And a sting must go BACKWARD as it strikes: the tail does the
  // reaching, so the body's job is to get out of its way.
  assert.ok(beastAttackPose('sting', 0.45, 0.45).z < 0, 'the scorpion lunges instead of rearing');
});
