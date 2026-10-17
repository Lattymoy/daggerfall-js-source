// NAV-FAR-AI (2026-10-12, an allocation profile of a player's live client walking the coast: the sea's captains were
// 12% of the main thread and some 29% of what it allocated, the adopted ships hundreds of km off among them;
// bible/07-Rendering/Performance-Priority.md NAV-FAR-AI) - A FAR CAPTAIN KEEPS HER WATCH EVERY FAR_LIFE_EVERY FRAMES, on
// the time she missed: her clock the same at the end, never more than FRAME_STEP_S at once; every frame near, in a
// fight (hers, or one that targets her), lashed to a prize, or not afloat. The sea of test/navalSea.mjs, on foot on a
// speck of land at the eye (no director: its despawn is the water's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { FAR_WATCH_M, FAR_LIFE_EVERY, FRAME_STEP_S, watchesFar } from '../../../src/scenes/naval/navalHost.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';

const DT = 0.01;
async function landed() {
  const h = await sea({ hull: null, water: (x, z) => Math.hypot(x, z) > 30 });
  return h;
}
/** The frames a ship's captain stepped on, over `n` frames of DT: her clock moved. */
function watches(h, e, n, dt = DT) {
  const on = [];
  for (let i = 0; i < n; i++) { const c = e.ship.clock; h.host.frame(dt); if (e.ship.clock !== c) on.push(i); }
  return on;
}

test('NAV-FAR-AI: a captain past FAR_WATCH_M keeps her watch one frame in FAR_LIFE_EVERY, on the time she missed - her clock the same; a near one every frame', async () => {
  assert.ok(FAR_WATCH_M >= 5000, 'past where a hull stands to be seen');
  const h = await landed();
  const far = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: FAR_WATCH_M + 3000, bearing: 1 }));
  const near = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 2000, bearing: 2 }));
  const c0 = far.ship.clock, n0 = near.ship.clock;
  const on = watches(h, far, 40);
  assert.equal(on.length, 40 / FAR_LIFE_EVERY, `one frame in ${FAR_LIFE_EVERY}: ${on}`);
  assert.ok(on.every((f, i) => i === 0 || f - on[i - 1] === FAR_LIFE_EVERY), 'on her own stride');
  assert.ok(Math.abs(far.ship.clock - c0 - (on.at(-1) + 1) * DT) < 1e-9, 'the time she missed, every second of it');
  assert.ok(Math.abs(near.ship.clock - n0 - 40 * DT) < 1e-9, 'the near one every frame');
});

test('NAV-FAR-AI: never more than FRAME_STEP_S at once - at a slow frame a far captain keeps her watch sooner', async () => {
  const h = await landed();
  const far = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: FAR_WATCH_M + 3000, bearing: 1 }));
  const dt = FRAME_STEP_S * 0.6;
  let most = 0;
  for (let i = 0; i < 20; i++) { const c = far.ship.clock; h.host.frame(dt); most = Math.max(most, far.ship.clock - c); }
  assert.ok(most <= FRAME_STEP_S + 1e-9, `the most at once ${most.toFixed(3)} s`);
});

test('NAV-FAR-AI watchesFar: past FAR_WATCH_M, afloat, in no fight, lashed to nothing and no fight\'s target - nothing else', () => {
  const far = [FAR_WATCH_M + 10, 0, 0];
  const e = (o = {}, pos = far) => ({ id: 'a', ship: { pos, mode: 'cruise', lashed: null, damage: { state: SHIP_STATES.afloat }, ...o } });
  const none = () => new Set();
  const eye = [0, 0, 0];
  assert.equal(watchesFar(e(), eye, none), true, 'a ship about her business, far off');
  assert.equal(watchesFar(e({}, [FAR_WATCH_M - 10, 0, 0]), eye, none), false, 'within FAR_WATCH_M');
  assert.equal(watchesFar(e({}, [FAR_WATCH_M - 10, 0, FAR_WATCH_M - 10]), [0, 900, 0], none), true, 'measured on the flat');
  assert.equal(watchesFar(e(), null, none), false, 'no eye');
  assert.equal(watchesFar(e({ mode: 'engage' }), eye, none), false, 'engaging');
  assert.equal(watchesFar(e({ mode: 'board' }), eye, none), false, 'boarding');
  assert.equal(watchesFar(e({ lashed: { id: 'b' } }), eye, none), false, 'lashed to a prize');
  assert.equal(watchesFar(e({ damage: { state: SHIP_STATES.struck } }), eye, none), false, 'struck');
  assert.equal(watchesFar(e({ damage: { state: SHIP_STATES.sinking } }), eye, none), false, 'sinking');
  assert.equal(watchesFar(e(), eye, () => new Set(['a'])), false, 'a fight\'s target');
  let asked = 0;
  watchesFar(e({ mode: 'engage' }), eye, () => { asked++; return new Set(); });
  assert.equal(asked, 0, 'the fights asked last, only of a ship that would keep a far watch');
});

test('NAV-FAR-AI: a far captain come near keeps the time she missed - her first frame near steps it, then every frame', async () => {
  const h = await landed();
  const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: FAR_WATCH_M + 3000, bearing: 1 }));
  const c0 = e.ship.clock;
  for (let i = 0; i < 6; i++) h.host.frame(DT);
  assert.ok(e.ship.clock - c0 < 6 * DT - 1e-9, 'some of it missed, far off');
  h.view.feet = [e.ship.pos[0] - 500, 0, e.ship.pos[2]]; h.view.look = { origin: [e.ship.pos[0] - 500, 5, e.ship.pos[2]], dir: [1, -0.05, 0] };
  h.host.frame(DT);
  assert.ok(Math.abs(e.ship.clock - c0 - 7 * DT) < 1e-9, `every second of it kept, come near: +${(e.ship.clock - c0).toFixed(3)} s`);
  const on = watches(h, e, 6);
  assert.equal(on.length, 6, 'then every frame');
});
