// FIELD BUGS 2026-10-18d - WINCH-PLATES (Boar, #bug-reports, "Big bugs of the spires", item 7: "Corridor with winch plates is
// very confusing. It's said to hold winch plates, and they are not marked. I guessed that platforms near gate were winch
// plates."): THE WINCH'S PLATES, MARKED. A Winch Rampart's portcullis rises only while `min(2, n)` members stand on its winch
// plates (Elite-Gates.md section 8.3), the objective says "Hold the winch plates.", and the relay counts a member within
// EG_TOUCH_M of each (net/eliteGates/egBrain.js) - but a plate is no body of the fight, so the screen's stood-on errands
// (scenes/eliteGates/egFight.js drawGround - a rune, a gem, the relic, an Orrery's stone) never drew one: they stood as two of
// the walkway's plain floor discs by the gate. Pinned on the producers: the halls the law lays, the relay's director woken
// in each, its state through the wire (validEgOut) into a member's (foldEg), the screen's fight and its floor plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, EG_TOUCH_M } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { TELEGRAPH_KIND } from '../../../src/render/gate/gateTelegraph.js';
import { lookAt, perspective, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** The first `n` Ramparts of variant `v` the build's law lays (seeds 1-40, circles 1-24): `{ seed, h, spec }` each. */
function ramparts(v, n) {
  const out = [];
  for (let seed = 1; seed <= 40 && out.length < n; seed++) for (let c = 1; c <= 24 && out.length < n; c++) {
    const plan = egCirclePlan(seed, c);
    for (let k = 0; k < plan.length && out.length < n; k++) { const spec = egHallOf(seed, egFirstHallOf(c) + k, 0); if (spec.kind === 'rampart' && spec.variant === v) out.push({ seed, h: spec.h, spec }); }
  }
  assert.equal(out.length, n, `enough ${v}s laid`);
  return out;
}
/** Rampart `h` woken on the director for a company of two on its arrival plate; the member's screen state, folded. */
function woken(seed, h, spec) {
  const rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, co.map(([sub], i) => ({ sub, sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z, dead: false, at: now })), rng); }
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const { k: _k, ...st } = egStateOf(B, now);
  return { E: foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now), now };
}
/** One frame of the screen's fight over state `E`, my feet on the walkway 10 m short of the gate, looking at it: its shapes
 *  (copied - the fight keeps its slots) with whether the floor plan draws each. */
function frameOf(spec, E, now) {
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => egToDungeon(spec, spec.walk.x, 0, spec.gate.z - 10), peerAt: () => null });
  fight.frame();
  const eye = egToDungeon(spec, spec.walk.x, 1.6, spec.gate.z - 10);
  fight.drawPass(mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500)), lookAt(eye, egToDungeon(spec, spec.walk.x, 0, spec.gate.z), UP_Y), eye, 1);
  const plan = fight.plan();
  return fight.shapes().map((s) => ({ kind: s.kind, x: s.origin[0], z: s.origin[1], r: s.r, y: s.y, color: [...s.color], drawn: plan.draws.some((d) => d.sh === s) }));
}
const atPlate = (shapes, q) => shapes.filter((s) => s.kind === TELEGRAPH_KIND.disc && Math.hypot(s.x - q.x, s.z - q.z) < 1e-6);

test('WINCH-PLATES (FIELD BUGS 2026-10-18d): A WINCH\'S PLATES ARE MARKED - in every Winch the law lays, through its trial each winch plate the room counts stands on the screen as a stood-on errand does: one gold disc of EG_TOUCH_M on its own surface, which the floor plan draws (the plates stand off the walkway\'s fight floor); the Siege-Walk, which has none, draws none; the closing, once the portcullis is up, none (mutants: the plates never drawn; drawn on no surface of their own, so cut away; short of the room\'s reach; drawn past the trial)', () => {
  for (const { seed, h, spec } of ramparts('winch', 3)) {
    const { E, now } = woken(seed, h, spec);
    assert.equal(E.fight.pg.obj, 'winch', `seed ${seed} hall ${h}: the winch's errand`);
    const plates = spec.spots.winch;
    assert.equal(plates.length, 2, 'two winch plates laid');
    const shapes = frameOf(spec, E, now);
    for (const q of plates) {
      assert.deepEqual(atPlate(shapes, q).map(({ r, y, color, drawn }) => ({ r, y, color, drawn })), [{ r: EG_TOUCH_M, y: (q.y ?? 0) / 100, color: [1.0, 0.82, 0.38], drawn: true }],
        `seed ${seed} hall ${h}: the plate at (${q.x}, ${q.z}) marked gold at the room's reach, on its own surface, drawn`);
    }
    assert.deepEqual(plates.flatMap((q) => atPlate(frameOf(spec, { ...E, sg: 'closing' }, now), q)), [], 'the closing: the portcullis up, no plate marked');
    assert.deepEqual(plates.flatMap((q) => atPlate(frameOf(spec, { ...E, sg: 'arrive' }, now), q)), [], 'AUDIT FB1018D L3-M3: arriving, before the trial (the hall\'s fight already on the screen), no plate marked');
  }
  for (const { seed, h, spec } of ramparts('siege', 1)) {
    const { E, now } = woken(seed, h, spec);
    assert.equal(spec.spots.winch, undefined, 'a Siege-Walk lays no winch plate');
    assert.deepEqual(frameOf(spec, E, now).filter((s) => s.kind === TELEGRAPH_KIND.disc && s.r === EG_TOUCH_M && Number.isFinite(s.y)), [], 'and the screen marks none');
  }
});
