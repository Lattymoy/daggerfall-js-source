// FIELD BUGS 2026-10-18d - BANNER-SHAFT (Boar, #bug-reports, "Big bugs of the spires", item 4: "Daedra lord fight, name
// starting on V: banners spawn during all stages however their effect is unclear, and they can be broken only if you stay
// close to them (I mean ranged attacks outside their postaments don't break them)"): VALKYNAZ ILTHYS'S BANNERS SHOT FROM
// THE COURT. The Conquest plants a banner on each of the Council Rotunda's balconies, 4 m over the court (Elite-Gates.md
// section 13.4), and THE ASCENT's law refused every member's blow on a body a storey over or under it (net/eliteGates/
// egBodies.js egHitBody) - a shaft or a spell from the court too, through nothing but air: the banners broke only from
// their own balconies. Pinned on the relay's own director (egBreachNew, egEnter, egStep to the Conquest, the hall the law
// lays, its blows through egBlow - the door every member's `hit` comes through): from the court clear of a balcony's plan
// a shaft and a spell land on its banner and a swing does not, however near in plan; from the court under the balcony's
// rim (the balcony stacked over the member) none lands; from the balcony every kind does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { egLordsOf } from '../../../src/net/eliteGates/egLords.js';
import { egStacked, egByHeight } from '../../../src/net/eliteGates/egWalkGraph.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };

/** The first `n` Courts of Valkynaz Ilthys the build's law lays (seeds 1-30, Redoubt 5): `{ seed, h, spec }` each. */
function rotundas(n) {
  const out = [];
  for (let seed = 1; seed <= 30 && out.length < n; seed++) {
    const plan = egCirclePlan(seed, 5);
    for (let k = 0; k < plan.length; k++) { const spec = egHallOf(seed, egFirstHallOf(5) + k, 0); if (spec.kind === 'court' && spec.lord === 'ilthys') { out.push({ seed, h: spec.h, spec }); break; } }
  }
  assert.equal(out.length, n, 'enough Rotundas laid');
  return out;
}
/** A company of two woken in Rotunda `h` on the relay's director, stood at the court's heart until the Conquest plants its
 *  banners: the breach, its banners, and the clock. */
function conquest(seed, h, spec) {
  const rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const beat = () => { now += 250; egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) beat();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const f = spec.fight;
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + f.x, z: f.z - 3, y: f.y };
  // EG-PERFECT (section 13.2): the Conquest is her second phase's, a banner planted in turn every EG_CONQUEST_EVERY_MS -
  // turned as egaudit5_b turns a lord, and the three waited for
  for (const L of egLordsOf(B.F)) L.hp = Math.floor(L.max * 0.6);
  let banners = [];
  for (let k = 0; k < 400 && banners.length < 3; k++) { beat(); banners = B.F.bodies.filter((b) => b.role === EG_ROLE.obj && b.t === 'banner'); }
  assert.equal(banners.length, 3, 'the Conquest: a banner on each balcony');
  return { B, banners, now: () => now, tick: (ms) => (now += ms) };
}

test('BANNER-SHAFT (FIELD BUGS 2026-10-18d): ILTHYS\'S BANNERS ARE SHOT FROM THE COURT - in a Rotunda of THE ASCENT\'s law, a member on the court clear of a balcony\'s plan lands a shaft and a spell on the banner 4 m over it; a swing within reach in plan does not reach a storey up; from under the balcony\'s rim (stacked under it) nothing lands; from the balcony every kind does (mutants: every kind held to its storey again; a swing let up a storey; the stack read from the higher one\'s floor; the lower and the higher swapped)', () => {
  for (const { seed, h, spec } of rotundas(2)) {
    assert.ok(egByHeight(spec), `seed ${seed}: a hall that judges by height`);
    const W = conquest(seed, h, spec);
    const court = spec.discs.find((d) => d.role === 'court');
    const ban = W.banners[0], bal = spec.discs.find((d) => d.role === 'balcony' && Math.hypot(d.x - ban.x, d.z - ban.z) < 0.5);
    assert.ok(bal && bal.y - court.y >= 4, `seed ${seed}: the banner on a balcony a storey over the court (${bal?.y} over ${court.y})`);
    const L = Math.hypot(court.x - ban.x, court.z - ban.z), ux = (court.x - ban.x) / L, uz = (court.z - ban.z) / L;
    const at = (d, y) => ({ x: ban.x + ux * d, z: ban.z + uz * d, y });
    const places = {
      clear: at(bal.r + 3, court.y),   // on the court, 3 m clear of the balcony's plan
      near: at(bal.r + 0.3, court.y),   // on the court within a swing's reach of it in plan, clear of the balcony
      under: at(bal.r - 1, court.y),   // on the court under the balcony's rim
      balcony: at(1, bal.y),
    };
    for (const [k, p] of Object.entries(places)) assert.ok(Math.hypot(p.x - court.x, p.z - court.z) <= court.r || k === 'balcony', `seed ${seed}: ${k} stands on the court`);
    const kinds = { swing: HIT_KINDS.Melee, shaft: HIT_KINDS.Shaft, spell: HIT_KINDS.Spell };
    const got = {};
    let q = 1;
    for (const [where, p] of Object.entries(places)) {
      for (const [kind, r] of Object.entries(kinds)) {
        if (where === 'clear' && kind === 'swing') continue;   // out of a swing's reach whatever the storey
        W.tick(1500);
        const hp = ban.hp;
        egBlow(W.B, 'acct-0', { k: 'hit', i: ban.i, q: q++, d: 10, r }, { sx: spec.x0 + p.x, y: p.y, z: p.z }, W.now());
        got[`${where} ${kind}`] = ban.hp < hp;
      }
    }
    assert.deepEqual(got, {
      'clear shaft': true, 'clear spell': true,
      'near swing': false, 'near shaft': true, 'near spell': true,
      'under swing': false, 'under shaft': false, 'under spell': false,
      'balcony swing': true, 'balcony shaft': true, 'balcony spell': true,
    }, `seed ${seed} hall ${h}: what lands on the banner, from where`);
    // the stack itself, either way round: the court under the rim is stacked under the balcony, the court clear of it is not
    assert.deepEqual([
      egStacked(W.B.F.view ?? spec, places.under.x, court.y, places.under.z, ban.x, bal.y, ban.z), egStacked(W.B.F.view ?? spec, ban.x, bal.y, ban.z, places.under.x, court.y, places.under.z),
      egStacked(W.B.F.view ?? spec, places.clear.x, court.y, places.clear.z, ban.x, bal.y, ban.z), egStacked(W.B.F.view ?? spec, ban.x, bal.y, ban.z, places.clear.x, court.y, places.clear.z),
    ], [true, true, false, false], `seed ${seed}: stacked under the rim, open clear of it`);
  }
});
