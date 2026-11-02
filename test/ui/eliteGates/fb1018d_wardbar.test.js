// FIELD BUGS 2026-10-18d - WARD-BAR (Boar, #bug-reports, "Big bugs of the spires", item 4: "banners spawn during all stages
// however their effect is unclear"): WHAT VALKYNAZ ILTHYS'S BANNERS DO, TOLD. The Conquest's banners burn a third of the floor
// each and, while two stand, hold her ward (Elite-Gates.md section 13.4) - a ward no blow lands through. The burning was
// drawn; the ward was nowhere on the screen, though the page gives it its look (section 25.2: "the cage on the lord's bar is
// red-bronze and hatched"), and the Conquest's word said only "Banners claim the floor. Break them!". Pinned on the
// producers: the Rotunda the law lays, the relay's director stepping Ilthys to her Conquest, every frame through the wire
// (validEgOut) into a member's state (foldEg), the HUD's model and its drawing (ui/eliteGates/egSpireHud.js), the screen's
// fight's words (scenes/eliteGates/egFight.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, egCirclePlan, egFirstHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { validEgOut } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egLordBars, egSpireHudModel, drawEgSpireHud, destroyEgSpireHud } from '../../../src/ui/eliteGates/egSpireHud.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** A fake document with the calls the HUD makes (test/net/eliteGates/egpres_hud.test.js's shape, cut to them). */
function fakeDocument() {
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', textContent: '', className: '' };
    n.style = { _p: {}, setProperty(k, v) { this._p[k] = String(v); } };
    n.append = (...cs) => { for (const c of cs) if (typeof c !== 'string') { c.parent = n; n.children.push(c); } };
    n.replaceChildren = () => { n.children = []; };
    n.remove = () => {};
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); };
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    return n;
  };
  const doc = { createElement: node, head: node('head'), body: node('body') };
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

test('WARD-BAR (FIELD BUGS 2026-10-18d): ILTHYS\'S BANNERS\' WARD ON HER BAR - at the Conquest the room wards her while two banners stand, and every screen\'s bar says it: the model\'s `ward`, *Warded* after her name and phase, the track caged (its `ward` class - red-bronze, hatched); 25 s on the ward lapses and so do they; the Conquest\'s word says what the banners do (mutants: the ward never read; the cage never drawn; the word unsaid; the first bar\'s cage on the second\'s track)', () => {
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const plan = egCirclePlan(seed, 5);
    for (let k = 0; k < plan.length && !found; k++) { const spec = egHallOf(seed, egFirstHallOf(5) + k, 0); if (spec.kind === 'court' && spec.lord === 'ilthys') found = { seed, spec }; }
  }
  assert.ok(found, 'a Rotunda laid');
  const { seed, spec } = found, h = spec.h, rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  const f = spec.fight;
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + f.x, z: f.z - 3, y: f.y };
  const said = [];
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', strike: () => {},
    feet: () => egToDungeon(spec, f.x, f.y ?? 0, f.z - 3), peerAt: () => null, say: (t) => said.push(t) });
  const beat = () => { for (const fr of step()) if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now); fight.frame(); };
  const banners = () => E.fight.bodies.filter((b) => b.role === EG_ROLE.obj && b.k === EG_OBJ.banner).length;
  const L = () => B.F.bodies.find((b) => b.role === EG_ROLE.lord);
  // her wake, unwarded
  for (let k = 0; k < 20; k++) beat();
  let bar = egLordBars(E)[0];
  assert.deepEqual([bar?.name, bar?.ward], ['Valkynaz Ilthys', false], 'awake, her bar, no ward');
  // the Conquest - EG-PERFECT (section 13.2): her second phase's, turned as egaudit5_b turns a lord, its banners planted in turn
  L().hp = Math.floor(L().max * 0.6);
  for (let k = 0; k < 200 && !(banners() === 3 && egLordBars(E)[0]?.ward); k++) beat();
  assert.equal(banners(), 3, 'three banners on my screen');
  assert.ok((L().fl & EG_FL.ward) !== 0, 'the room wards her');
  bar = egLordBars(E)[0];
  assert.equal(bar.ward, true, 'her bar says the ward');
  const doc = fakeDocument();
  destroyEgSpireHud();
  try {
    drawEgSpireHud(egSpireHudModel(E, 'acct-0', now), { doc });
    const [track, track2] = find(doc.body, 'eg-lord-track');
    assert.deepEqual([find(doc.body, 'eg-lord-name')[0].textContent, track.className, track2.className], ['Valkynaz Ilthys - II - Warded', 'eg-lord-track ward', 'eg-lord-track'], 'drawn: the word, the cage on her own track alone');
    assert.ok(said.includes('Banners claim the floor, and it burns. Two standing ward the lord. Break them!'), `PIN MOVED (VOICE2): the Conquest's word says what they do, in two sentences, no dash aside (${JSON.stringify(said)})`);
    // the ward lapses at 25 s, the banners still burning
    for (let k = 0; k < 120 && egLordBars(E)[0]?.ward; k++) beat();
    assert.deepEqual([egLordBars(E)[0].ward, banners()], [false, 3], 'its 25 s spent, the banners standing');
    drawEgSpireHud(egSpireHudModel(E, 'acct-0', now), { doc });
    assert.deepEqual([find(doc.body, 'eg-lord-name')[0].textContent, find(doc.body, 'eg-lord-track')[0].className], ['Valkynaz Ilthys - II', 'eg-lord-track'], 'and the cage lifts');
  } finally { destroyEgSpireHud(); }
});

test('WARD-BAR (AUDIT FB1018D L5-6): THE WARD IS ITS OWN FLAG - a lord in fury, stunned or flying reads no ward on its bar (mutant: any flag read as the ward)', () => {
  let found = null;
  for (let seed = 1; seed <= 30 && !found; seed++) {
    const plan = egCirclePlan(seed, 5);
    for (let k = 0; k < plan.length && !found; k++) { const spec = egHallOf(seed, egFirstHallOf(5) + k, 0); if (spec.kind === 'court' && spec.lord === 'ilthys') found = { seed, spec }; }
  }
  const { seed, spec } = found, h = spec.h, rng = seeded(seed), co = [['acct-0', 'Mac', 1], ['acct-1', 'Ann', 2]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.pr = ''; B.dc = [];
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 400 && B.sg !== 'trial'; k++) step();
  const { k: _k, ...st } = egStateOf(B, now);
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...st }), now), wire(egFightState(B.F, now)), now);
  const f = spec.fight;
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + f.x, z: f.z - 3, y: f.y };
  for (let k = 0; k < 20; k++) for (const fr of step()) if (!fr.to || fr.to === 'acct-0') E = foldEg(E, wire(fr), now);
  assert.equal(egLordBars(E)[0]?.ward, false, 'awake, no ward');
  for (const flag of ['fury', 'stun', 'fly']) {
    const E2 = { ...E, fight: { ...E.fight, bodies: E.fight.bodies.map((b) => (b.role === EG_ROLE.lord ? { ...b, fl: b.fl | EG_FL[flag] } : b)) } };
    assert.equal(egLordBars(E2)[0]?.ward, false, `${flag}: not Warded`);
  }
});
