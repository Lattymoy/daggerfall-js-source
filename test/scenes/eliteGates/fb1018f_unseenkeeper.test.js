// FIELD BUGS 2026-10-18f UNSEEN-KEEPER (Low_Poly_Gaming, "Weir Key Generated Elite Breach bugs": "Enemy which needed to be beat
// to spawn the gate to the next hall was not visible but they were still able to attack. I could see their AOE on the ground
// but not the enemy"). NOT PROVEN - the record (bible/01-Overview/bugs/) says what would prove it. What is pinned here is what
// the trace measured, so it can be run again: (1) on the law as it stands, every keeper a hall's door waits on - a Proving
// Walk's champion and its escort, a Court's lord, a Rampart's Ward-Bearers - and every add beside it, as the real relay stands
// and walks them, folded through the real link into the real fight driver (scenes/eliteGates/egFight.js) over a stub renderer
// whose art lands, is drawn every frame at its own place on its own floor, at a size, and offered as a body my blows meet;
// (2) art that will not load is held failed for the session and every body of its mobile then stands undrawn and unoffered
// while its blows still draw - which it said nowhere; it says so once now, on the console, naming the mobile and the archive.
import '../../modsOff.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { foldEg, EG_STATE_EMPTY, egBodyPlace, egBodyHeight } from '../../../src/net/eliteGates/egLink.js';
import { egFightFloorAt } from '../../../src/net/eliteGates/egFair.js';
import { validEgOut } from '../../../src/net/wire.js';
import { createEgFight, egLookOf } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';

const T0 = 1_800_000_000_000, ME = 'acct-0', NOOP = () => {};
const tex = (archive) => ({ archive, recordCount: 30, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) });
const tick = () => new Promise((r) => setImmediate(r));
const hallOf = (seed, kind) => { for (let h = 1; h <= 15; h++) if (egHallOf(seed, h, 0).kind === kind) return h; return 0; };

/** A breach of two in hall `h` of `seed`, the company on the fight floor (or the arrival), the relay's frames folded into the
 *  real fight driver; `art(archive)` answers its texture. Runs `frames` beats of 100 ms, calling `each(t)` after each. */
async function run(seed, h, art, frames, each) {
  const spec = egHallOf(seed, h, 0);
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [[ME, 'M0', 30], ['acct-1', 'M1', 30]];
  let now = T0;
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'M0', ew: 0, rh: 0, seed, op: now - EG_SEALED_MS - 1000, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const f0 = (spec.fl ?? []).find((f) => f.t === 'd'), at = f0 ? { x: f0.x, z: f0.z, y: f0.y ?? 0 } : { x: spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  const pos = { [ME]: { sx: spec.x0 + at.x, z: at.z, y: at.y }, 'acct-1': { sx: spec.x0 + at.x + 1, z: at.z, y: at.y } };
  let E = { ...EG_STATE_EMPTY, b: B.b, seed: B.seed, geo: 0 };
  const tell = (w) => { if (!w || (w.to && w.to !== ME)) return; const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) E = foldEg(E, v, now); };
  const centre = egHallCentre(spec), feet = [centre[0] + at.x, centre[1] + at.y, centre[2] + at.z];
  const fight = createEgFight({ renderer: { textures: { has: () => true }, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 1] }), destroyBillboardBatch: NOOP },
    link: { state: () => E }, now: () => now, feet: () => feet, cam: () => [feet[0], feet[1] + 1.6, feet[2] - 6], player: () => ({ health: 100, maxHealth: 100 }), me: () => ME,
    getTexture: async (a) => art(a), uploadRecordFrame: NOOP, strike: NOOP, save: () => 0 });
  const beat = async () => { now += 100; for (const w of egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng)) tell(w); fight.frame(); await tick(); fight.frame(); };
  for (let k = 0; k < 600 && B.sg !== 'trial'; k++) await beat();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  for (let k = 0; k < frames; k++) { await beat(); each({ B, E, spec, centre, fight, now }); }
  return { B, E, fight };
}

test('UNSEEN-KEEPER THE DRAW HOLDS (the trace, run again): a Proving Walk\'s champion and escort, a Court\'s lord, a Rampart\'s Ward-Bearers and the adds beside them, as the relay stands and walks them, are drawn every frame at their own place on their own floor, at a size, and offered as bodies my blows meet - from the frame after their art lands', async () => {
  const seen = new Map();
  for (const kind of ['proving', 'court', 'rampart']) {
    const h = hallOf(12345, kind);
    assert.ok(h > 0, `a ${kind} in the first circles`);
    await run(12345, h, tex, 260, ({ E, spec, centre, fight, now }) => {
      if (E.fight.h !== E.h) return;
      const bs = fight.batches(), tg = fight.hostTargets();
      for (const b of E.fight.bodies) {
        if (b.role === EG_ROLE.obj || b.goneAt || b.fellAt || (b.fl & (EG_FL.hidden | EG_FL.friend)) !== 0) continue;
        if (now - (b.born ?? 0) < 1000) continue;   // a body's first frame waits on its art, and a rising add stands sunk in its floor
        const [px, pz] = egBodyPlace(b, now), bat = bs.find((q) => Math.hypot(q.origin[0] - centre[0] - px, q.origin[2] - centre[2] - pz) < 0.01);
        const key = `${kind}:${b.role === EG_ROLE.lord ? 'lord' : 'add'}:${b.k}`;
        assert.ok(bat, `${key} drawn at its place`);
        assert.ok(Math.abs(bat.size.h) > 0.1 && Math.abs(bat.size.w) > 0.1, `${key} at a size`);
        const fl = egFightFloorAt(spec, px, egBodyHeight(b, now), pz), look = egLookOf(b, spec.band ?? 0);
        if (fl) assert.ok(bat.origin[1] - centre[1] - (fl.y ?? 0) >= -0.05, `${key} never under its floor`);
        assert.equal(bat.archive, ENEMY_BASICS[look.mobile].maleTexture, `${key} in its own mobile's art`);
        assert.ok(tg.some((q) => q.i === b.i), `${key} offered as a body my blows meet`);
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    });
  }
  for (const want of ['proving:lord', 'court:lord', 'rampart:add:2']) assert.ok([...seen.keys()].some((k) => k.startsWith(want)), `${want} checked (${[...seen.keys()]})`);
});

test('UNSEEN-KEEPER ART THAT WILL NOT LOAD (the one path the trace found that hides a keeper while its blows draw): its mobile\'s bodies stand undrawn and unoffered for the session while their blows still draw, and the console says so once, naming the mobile and the archive - before, it said nothing (mutants: the warning dropped; an empty answer unsaid)', async () => {
  const h = hallOf(12345, 'court');
  const lordArt = ENEMY_BASICS[egLookOf({ role: EG_ROLE.lord, k: 0, fl: 0, pt: 0 }, 0).mobile].maleTexture;
  const warned = [], was = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  let lordSeen = 0, lordBlows = 0;
  try {
    const R = await run(12345, h, (a) => { if (a === lordArt) throw new Error('read failed'); return tex(a); }, 400, ({ E, fight }) => {
      const L = E.fight.bodies.find((b) => b.role === EG_ROLE.lord && !(b.fl & EG_FL.mirror));
      if (!L || E.fight.h !== E.h) return;
      lordSeen++;
      assert.equal(fight.batches().some((q) => q.archive === lordArt), false, 'never drawn');
      assert.equal(fight.hostTargets().some((q) => q.i === L.i), false, 'never offered');
      if (E.fight.blows.some((bl) => bl.o === L.i)) lordBlows++;
    });
    assert.ok(R.B.F.bodies.some((b) => b.role === EG_ROLE.lord && b.up2), 'the lord woke and fought');
  } finally { console.warn = was; }
  assert.ok(lordSeen > 0 && lordBlows > 0, `its blows still drawn (${lordBlows} frames)`);
  const said = warned.filter((w) => w.startsWith('[eg] the art of mobile'));
  assert.equal(said.length, 1, 'said once');
  assert.match(said[0], new RegExp(`TEXTURE\\.${lordArt}\\) would not load - its bodies stand undrawn and unstruck read failed`));
  // a reader that answers nothing says so the same way
  warned.length = 0;
  console.warn = (...a) => warned.push(a.join(' '));
  try { await run(12345, h, (a) => (a === lordArt ? null : tex(a)), 20, NOOP); } finally { console.warn = was; }
  assert.deepEqual(warned.filter((w) => w.startsWith('[eg] the art of mobile')).map((w) => w.endsWith('no texture')), [true], 'an empty answer: said once');
});
