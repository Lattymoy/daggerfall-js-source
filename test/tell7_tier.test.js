// TELL7 - THE TIER AND THE COOLDOWNS (bible/12-Enhanced-AI/Feud-Arc.md section 9; Mac, 2026-10-04: "breath more depth
// into it", then "Go" on every call). TACT4's tier was level 10 and up, or an elite, each with its family's one or two
// shapes every 8-15 s. Now a champion and a revenant (at any level) telegraph too; an elite, a champion or a revenant
// throws its family's WHOLE set (the ring, the charge, the leap as TELL6 brings each - an ordinary foe of the tier
// keeps its one or two, Mac's call of 2026-10-02); and the cooldown is the tier's: a champion's 7-13, an elite's 6-11,
// a revenant's less 8% a rank.
// The law (the tier, the whole set and what it adds, the cooldowns); on the real motor (a level-1 revenant winding up,
// an elite's cooldown, a level raised live, an ordinary foe's set unchanged).
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, noteLocalPlayer } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, blowTier, throwsBlows, blowShapesOf, extraShapesOf, BLOW, BLOW_COOLDOWN_MIN, BLOW_COOLDOWN_MAX } from '../src/ai/foeBlows.js';
import { TELL, blowCooldown, wholeSet } from '../src/ai/tells.js';

const DT = 1 / 60;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); });

test('TELL7: the tier - level 10 and up, an elite (either flag), a champion, a revenant at any level; the level read live (mutants: the champion or the revenant left out)', () => {
  assert.equal(blowTier({ level: 9 }), false);
  assert.equal(blowTier({ level: 10 }), true);
  assert.equal(blowTier({ level: 2, eliteFoe: true }), true);
  assert.equal(blowTier({ level: 2, elite: true }), true);
  assert.equal(blowTier({ level: 2, champion: 'mighty' }), true);
  assert.equal(blowTier({ level: 1, revenant: { rank: 1 } }), true, 'a revenant at any level');
  assert.equal(blowTier(null), false);
  const e = { level: 5, mobileType: M.Orc };
  assert.equal(throwsBlows(e), false);
  e.level = 12;   // Meaner Monsters, or any raise after the row
  assert.equal(throwsBlows(e), true, 'the live level');
  assert.equal(throwsBlows({ level: 30, mobileType: M.Rat }), false, 'a kind with no shape never does');
});

test('TELL7: the whole set - an elite, a champion or a revenant adds its kind\'s ring, charge and leap as each exists; an ordinary foe keeps TACT4\'s one or two (mutants: the set for everyone; a shape before it exists)', () => {
  assert.deepEqual(extraShapesOf(M.Giant), ['ring']);
  assert.deepEqual(extraShapesOf(M.IronAtronach), ['ring']);
  assert.deepEqual(extraShapesOf(M.DaedraLord), ['ring']);
  assert.deepEqual(extraShapesOf(M.OrcWarlord), ['charge']);
  assert.deepEqual(extraShapesOf(M.SabertoothTiger), ['charge', 'leap']);
  assert.deepEqual(extraShapesOf(M.Vampire), ['leap']);
  assert.deepEqual(extraShapesOf(M.Orc), []);
  assert.deepEqual(extraShapesOf(M.Daedroth), [], 'a brute neither massive nor an atronach: no ring');
  for (const ent of [{ eliteFoe: true }, { elite: true }, { champion: 'mighty' }, { revenant: { rank: 1 } }]) assert.equal(wholeSet(ent), true, JSON.stringify(ent));
  assert.equal(wholeSet({ level: 40 }), false);
  // the shapes that exist join; the ones to come wait for TELL6
  for (const t of [M.Giant, M.OrcWarlord, M.SabertoothTiger, M.Vampire, M.Orc]) {
    const plain = blowShapesOf(t);
    assert.deepEqual(blowShapesOf(t, { level: 40 }), plain, 'an ordinary foe of the tier: its family\'s');
    const whole = blowShapesOf(t, { eliteFoe: true });
    assert.deepEqual(whole, [...plain, ...extraShapesOf(t).filter((k) => k in BLOW)], `${t}: its family's and what exists of its set`);
  }
  assert.deepEqual(blowShapesOf(M.Rat, { eliteFoe: true }), [], 'no family: no set');
});

test('TELL7: the cooldowns - an ordinary foe 8-15 s, a champion 7-13, an elite 6-11 (the best of its tiers), a revenant less 8% a rank (rank 5: 4.8-9) (mutants: any tier\'s range; the rank ignored)', () => {
  assert.equal(BLOW_COOLDOWN_MIN, 8);
  assert.equal(BLOW_COOLDOWN_MAX, 15);
  assert.equal(blowCooldown(null, 0), 8);
  assert.equal(blowCooldown({}, 1), 15);
  assert.equal(blowCooldown({ champion: 'mighty' }, 0), 7);
  assert.equal(blowCooldown({ champion: 'mighty' }, 1), 13);
  assert.equal(blowCooldown({ eliteFoe: true }, 0), 6);
  assert.equal(blowCooldown({ elite: true, champion: 'mighty' }, 1), 11, 'an elite champion: the elite\'s');
  assert.ok(near(blowCooldown({ revenant: { rank: 5 } }, 0), 4.8));
  assert.ok(near(blowCooldown({ revenant: { rank: 5 } }, 1), 9));
  assert.ok(near(blowCooldown({ revenant: { rank: 2 }, eliteFoe: true }, 0), 6 * 0.84), 'an elite revenant: the elite\'s, less its rank');
  assert.equal(TELL.COOLDOWN_RANK, 0.08);
});

// ── on the real motor ───────────────────────────────────────────────

function foe({ level = 12, mobileType = M.Orc, at = [0, 0, 8], ent: extra = {} } = {}) {
  const c = new Collider(() => 0);
  const ent = { health: 300, maxHealth: 300, mobileType, level, ...extra };
  const ai = new EnemyAI(c, [...at], Math.atan2(-at[0], -at[2]), { vitals: () => ent });
  const atk = new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 });
  return { ai, atk, ent };
}
function run(f, secs, player) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    T += DT;
    noteLocalPlayer(player, [0, 0, 1]);
    f.ai.update(DT, player); f.atk.update(DT, f.ai, player);
  }
}
function untilWindup(f, player, secs = 60) {
  for (let s = 0; s < Math.round(secs / DT); s++) {
    run(f, DT, player);
    if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai) ?? null;
  }
  return null;
}

test('TELL7: ON THE MOTOR a level-1 revenant telegraphs; an ordinary level-1 orc never does (mutants: the revenant out of the tier)', () => {
  const r = foe({ level: 1, ent: { revenant: { id: 'r1', rank: 1 } } });
  assert.ok(untilWindup(r, [0, 0, 0]), 'it wound one up');
  resetTactics(); resetBlows();
  const o = foe({ level: 1 });
  assert.equal(untilWindup(o, [0, 0, 0], 20), null);
});

test('TELL7: ON THE MOTOR an elite\'s next blow waits its tier\'s 6-11 s, a champion\'s 7-13, an ordinary foe\'s 8-15 (mutants: every tier on the ordinary clock)', () => {
  const had = Math.random;
  Math.random = () => 0.05;   // the blow's chance, its shape, its roll on the tier's range
  try {
    for (const extra of [{ eliteFoe: true }, {}, { champion: 'mighty' }]) {
      resetTactics(); resetBlows(); T = 0;
      const f = foe({ ent: extra });
      const b = untilWindup(f, [0, 0, 0]);
      assert.ok(b);
      run(f, b.land - T + 0.1, [0, 0, 0]);
      const wait = f.ai._tac.blowReady - (b.cut ?? f.ai._blowLandedAt);   // a higher-tier blade may have feinted (TELL5): cut, not landed
      assert.ok(near(wait, blowCooldown(f.ent, 0.05), 1e-6), `${JSON.stringify(extra)}: ${wait.toFixed(3)}`);
    }
  } finally { Math.random = had; }
});
