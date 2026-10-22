// STAND-FLAT / STAND-HORSE (2026-10-12, the owner: "Some models arent affected when morrowind is attached, like static
// NPCs, static horses, etc" - bible/04-Characters/Morrowind-NPCs.md section 28). The standing horses' manager
// (world/standingHorses.js) on a recording rig - the cut, the range, the hold, the view, the billboard cast-only while a
// horse stands and drawn again once it is let go, through the rig that made it; the stand flat's one record
// (world/standFlats.js); the Stable's horses offered whether or not their pictures are up (scenes/merchantYardsHost.js);
// and the hosts by source - world.js's streamed pixels and World of Daggerfall sites, exterior.js's location, the boats'
// crews (scenes/comeSailAway/comeSailAwayPool.js people).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createStandingHorses, isStandingHorseFlat, standingHorseYaw, standingHorseSeed,
  STANDING_HORSES_MAX, STANDING_HORSE_RANGE, STANDING_HORSE_HOLD,
} from '../../src/world/standingHorses.js';
import { outOfView } from '../../src/world/horseRig.js';
import { isStandFlat, standFlatId, standFlatRecord } from '../../src/world/standFlats.js';
import { strangerHorseLook } from '../../src/systems/horse/horseCoats.js';
import { figureLook } from '../../src/characters/peopleBodies.js';
import { createMerchantYards } from '../../src/scenes/merchantYardsHost.js';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ordered = (s, needles, what) => {
  let at = -1;
  for (const n of needles) {
    const i = s.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: "${n.slice(0, 80)}" ${i < 0 ? 'missing' : 'out of order'}`);
    at = i;
  }
};

/** A rig that records: horses made, stepped, posed, drawn and released. HORSE-VIEW II: its view the old ball at the
 *  feet (the real rig's box is pinned in test/systems/horse/fb1021b_strangers.test.js); a step leaves its pose behind
 *  its clock but for its first, and a pose catches one up, as the rig's own do. */
function fakeRig(name = 'rig') {
  const log = { made: 0, steps: [], posed: [], drawn: [], released: [] };
  const rig = {
    name, log,
    horse: (seed) => ({ id: ++log.made, seed, rig: name, posed: false }),
    step: (h, o) => {
      log.steps.push({ id: h.id, feet: [...o.feet], yaw: o.yaw, speed: o.speed, look: o.look });
      h.model = true; h.feet = [...o.feet];
      h.stale = true;
      if (o.pose !== false || !h.posed) rig.pose(h);
      return h;
    },
    pose: (h) => { if (h.posed && !h.stale) return false; log.posed.push(h.id); h.posed = true; h.stale = false; return true; },
    seen: (h, view, proj) => !outOfView([h.feet[0], h.feet[1] + 0.9, h.feet[2]], 1.6, view, proj),
    draw: (h) => { log.drawn.push(h.id); return true; },
    release: (h) => log.released.push(h.id),
  };
  return rig;
}
const batch = () => ({ castOnly: undefined });

test('STAND-HORSE the law\'s numbers, and which flat is a horse: TEXTURE.201\'s two records RMBLayout\'s animal sound names a horse - no cow, pig, cat or dog, no other archive (mutants: STAND-HORSE-any-animal)', () => {
  assert.deepEqual([STANDING_HORSES_MAX, STANDING_HORSE_RANGE, STANDING_HORSE_HOLD], [8, 60, 1.15]);
  assert.deepEqual([...Array(12).keys()].filter((r) => isStandingHorseFlat(201, r)), [0, 1]);
  assert.equal(isStandingHorseFlat(182, 0), false);
  assert.equal(isStandingHorseFlat(210, 1), false);
  // a stand flat: a horse, or any flat of a person's archive (RDBLayout.NPCFlatArchives); nothing else
  assert.deepEqual([[201, 0], [201, 1], [201, 3], [182, 5], [184, 22], [357, 6], [175, 0], [504, 1], [210, 0]].map(([a, r]) => isStandFlat(a, r)),
    [true, true, false, true, true, true, true, false, false]);
});

test('STAND-HORSE the cut: the nearest STANDING_HORSES_MAX within STANDING_HORSE_RANGE stand, each stepped still at its feet, heading and look, its billboard cast-only; the rest drawn as their billboards; the horses in a bind of their own (mutants: STAND-HORSE-no-cap, STAND-HORSE-no-range, STAND-HORSE-billboard-drawn, STAND-HORSE-bind-unflushed)', () => {
  const rig = fakeRig();
  const sh = createStandingHorses();
  const horses = Array.from({ length: 11 }, (_, i) => ({ key: { i }, feet: [i * 6, 0, 0], b: batch() }));   // 0..60 m out along x
  sh.begin(rig, [0, 1.6, 0]);
  for (const h of horses) sh.offer(h.key, h.feet, 0.5, 7, h.b, 3);
  assert.equal(sh.end(1 / 60), 8, 'eight stand');
  assert.deepEqual(horses.map((h) => h.b.castOnly), [true, true, true, true, true, true, true, true, false, false, false], 'the eight nearest, their billboards drawing nothing; the rest drawn');
  assert.equal(rig.log.made, 8);
  assert.deepEqual(rig.log.steps[0], { id: 1, feet: [0, 0, 0], yaw: 0.5, speed: 0, look: 7 }, 'still, where its billboard stood, its own heading and look');
  assert.equal(sh.draw({}, { proj: null, view: null, eye: [0, 0, 0] }), 8);
  // the bind: its own, opened once around the horses drawn and flushed whatever throws; none opened for none
  const binds = [];
  const r = { beginCharacterSpriteBatch: () => binds.push('begin'), flushCharacterSpriteBatch: () => binds.push('flush') };
  const own = createStandingHorses({ renderer: r });
  own.begin(rig, [0, 0, 0]);
  own.offer('x', [1, 0, 0], 0, 0, batch());
  own.offer('y', [2, 0, 0], 0, 0, batch());
  own.end(0);
  assert.equal(own.draw({}, { proj: null, view: null, eye: [0, 0, 0] }), 2);
  assert.deepEqual(binds, ['begin', 'flush']);
  const draw = rig.draw;
  rig.draw = () => { throw new Error('a lost context'); };
  assert.throws(() => own.draw({}, { proj: null, view: null, eye: [0, 0, 0] }));
  rig.draw = draw;
  assert.deepEqual(binds, ['begin', 'flush', 'begin', 'flush'], 'flushed though the draw threw');
  own.begin(rig, [0, 0, 0]);
  own.end(0);
  own.draw({}, { proj: null, view: null, eye: [0, 0, 0] });
  assert.equal(binds.length, 4, 'nothing standing: no bind');
  // the range: one past it stands as its billboard, cap or no cap
  const far = createStandingHorses({ max: 99 });
  const fb = batch(), nb = batch();
  far.begin(rig, [0, 0, 0]);
  far.offer('near', [STANDING_HORSE_RANGE - 0.5, 0, 0], 0, 0, nb);
  far.offer('far', [STANDING_HORSE_RANGE + 0.5, 0, 0], 0, 0, fb);
  assert.equal(far.end(0), 1);
  assert.deepEqual([nb.castOnly, fb.castOnly], [true, false]);
  // off the lane (no rig): every billboard drawn, no horse made
  const off = createStandingHorses();
  const ob = batch();
  off.begin(null, [0, 0, 0]);
  off.offer('a', [1, 0, 0], 0, 0, ob);
  assert.equal(off.end(0), 0);
  assert.equal(ob.castOnly, false);
});

test('STAND-HORSE the hold: a horse standing keeps its place past the cut by STANDING_HORSE_HOLD - a new one must be that much nearer to take it (mutants: STAND-HORSE-no-hold)', () => {
  const rig = fakeRig();
  const sh = createStandingHorses({ max: 1 });
  const a = batch(), b = batch();
  sh.begin(rig, [0, 0, 0]);
  sh.offer('a', [10, 0, 0], 0, 0, a);
  sh.end(0);
  assert.equal(a.castOnly, true);
  // b a little nearer than a now - within the hold: a keeps its place
  sh.begin(rig, [0, 0, 0]);
  sh.offer('a', [10, 0, 0], 0, 0, a);
  sh.offer('b', [9.5, 0, 0], 0, 0, b);
  sh.end(0);
  assert.deepEqual([a.castOnly, b.castOnly], [true, false], 'held');
  // b nearer by more than the hold: it takes the place
  sh.begin(rig, [0, 0, 0]);
  sh.offer('a', [10, 0, 0], 0, 0, a);
  sh.offer('b', [10 / STANDING_HORSE_HOLD - 0.1, 0, 0], 0, 0, b);
  sh.end(0);
  assert.deepEqual([a.castOnly, b.castOnly], [false, true], 'taken');
  assert.deepEqual(rig.log.released, [1], 'the first let go through its rig');
});

test('STAND-HORSE let go: a horse not offered (its pixel gone, the street left) or under a new rig is released through the rig that made it and its billboard drawn again; one out of the view stands, its clock stepped, but is not posed nor drawn (mutants: STAND-HORSE-let-go-hidden, STAND-HORSE-new-rig-kept, STAND-HORSE-unseen-stepped)', () => {
  const r1 = fakeRig('r1'), r2 = fakeRig('r2');
  const sh = createStandingHorses();
  const a = batch(), b = batch();
  sh.begin(r1, [0, 0, 0]);
  sh.offer('a', [5, 0, 0], 0, 0, a);
  sh.offer('b', [6, 0, 0], 0, 0, b);
  sh.end(0);
  sh.begin(r1, [0, 0, 0]);
  sh.offer('a', [5, 0, 0], 0, 0, a);
  sh.end(0);
  assert.equal(b.castOnly, false, 'b not offered: its billboard drawn again');
  assert.deepEqual(r1.log.released, [2]);
  assert.equal(sh.size, 1);
  sh.begin(r2, [0, 0, 0]);
  assert.deepEqual(r1.log.released, [2, 1], 'a new rig: the old one\'s horses let go through it');
  assert.equal(a.castOnly, false);
  sh.offer('a', [5, 0, 0], 0, 0, a);
  sh.end(0);
  assert.equal(r2.log.made, 1, 'stood again on the new rig');
  sh.destroy();
  assert.deepEqual(r2.log.released, [1]);
  assert.equal(a.castOnly, false);
  // the view: a camera looking down -z from the origin; a horse behind it stands (its billboard hidden) but is not posed.
  // PIN MOVED (HORSE-VIEW II): its idle's clock is stepped all the same (`pose: false`), so turned back into the view it
  // shows the pose an every-frame horse shows (fb1021b_strangers.test.js on the real rig) - it stood still before
  const r3 = fakeRig('r3');
  const v = createStandingHorses();
  const front = batch(), behind = batch();
  const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const proj = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0]);
  for (let f = 0; f < 2; f++) {
    v.begin(r3, [0, 0, 0]);
    v.offer('front', [0, 0, -5], 0, 0, front);
    v.offer('behind', [0, 0, 5], 0, 0, behind);
    assert.equal(v.end(0, { proj, view }), 2);
  }
  assert.deepEqual([front.castOnly, behind.castOnly], [true, true]);
  assert.deepEqual(r3.log.steps.map((s) => s.feet[2]), [-5, 5, -5, 5], 'both stepped, every frame');
  assert.deepEqual(r3.log.posed, [1, 2, 1], 'each posed at its first step; after it, only the one in view (5 m: every frame)');
  assert.equal(v.draw({}, { proj, view, eye: [0, 0, 0] }), 1);
  assert.deepEqual(r3.log.drawn, [1], 'and only it drawn');
});

test('STAND-FLAT the one record: a horse its heading, idle seed and look off its id (the road\'s strangers\' law), the same every build; a person their BORN flat as their piece; the id its place to the centimetre', () => {
  const id = standFlatId('3,4', 12.345, -6.789);
  assert.equal(id, 'flat:3,4:1235,-679');
  const h = standFlatRecord({ archive: 201, record: 1, x: 1, y: 2, z: 3 }, 'B', id);
  assert.deepEqual(h, { kind: 'horse', x: 1, y: 2, z: 3, batch: 'B', yaw: standingHorseYaw(id), seed: standingHorseSeed(id), look: strangerHorseLook(id), feet: [1, 2, 3] });
  assert.ok(h.yaw >= 0 && h.yaw < 2 * Math.PI);
  assert.notEqual(standingHorseYaw(id), standingHorseYaw(standFlatId('3,4', 12.345, -6.8)), 'a neighbour faces its own way');
  const p = standFlatRecord({ archive: 184, record: 22, x: 1, y: 2, z: 3 }, 'B', id);
  assert.deepEqual(p, { kind: 'person', x: 1, y: 2, z: 3, batch: 'B', piece: { id, flat: [184, 22] }, _mwFeet: null });
  // read as a placed figure is: FLATS.CFG's sex and caption, the region's race
  const flats = { getFlatData: (a, r) => (a === 184 && r === 22 ? { gender: '2', caption: 'merchant' } : null) };
  const look = figureLook(p, { flats, race: 'Redguard' });
  assert.equal(look.gender, 'female');
  assert.equal(look.race, 'Redguard');
});

test('STAND-HORSE the Stable\'s horses: offered where they stand and the way they face, in the bay their sprite is drawn in, whether or not Horse Cart and Cargo\'s pictures are up (mutants: STAND-HORSE-yard-needs-art)', async () => {
  const renderer = { createMesh: () => ({}), destroyMesh: () => {}, drawMesh: () => {}, createBillboardBatch: () => ({ origin: null }), destroyBillboardBatch: () => {}, textures: new Set(), uploadTexture: () => {} };
  const collider = { addMesh: () => {}, removeBucket: () => {} };
  const tex = { getSize: () => ({ width: 40, height: 76 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 3 };
  const y = createMerchantYards({
    renderer, collider: () => collider, getTexture: async () => tex, uploadRecordFrame: () => {},
    sites: () => [{ key: '7:stable', kind: 'stable', x: 100, z: 50, yaw: 90, comp: 0, regionIndex: 17, race: 'Breton', keeper: { name: 'Gwynara Moorhart', sex: 'female', variant: 1 } }],
    groundAt: () => 2, eye: () => [100, 3, 70], feet: () => null, horseArt: () => false, now: () => 0,
  });
  y.frame();
  const got = [];
  y.offerHorses({ offer: (key, feet, yaw, look, b, seed) => got.push({ feet: [...feet], yaw, look, b, seed }) });
  assert.equal(got.length, 3, 'the Stable\'s three, their pictures not up');
  assert.ok(got.every((g) => g.feet[1] === 2 && g.look === 0 && g.b === null), 'on the yard\'s ground, the bay, no billboard yet');
  assert.deepEqual(got.map((g) => g.seed), [1, 2, 3]);
  assert.ok(got.every((g) => Number.isFinite(g.yaw)));
  assert.notDeepEqual(got[0].feet, [0, 0, 0], 'placed, not the origin');
});

test('STAND-FLAT the streamed world by source: a town horse and a person no StaticNPC holds leave the shared groups (the block\'s and a site\'s) for a batch of their own - a person\'s picture the clothed stand-in - in the pixel\'s list; the near rings\' offered (the horses to the standing horses, the people on the street\'s lane read as a figure); the horses ended and drawn after the people, before the flats; let go indoors; the Stables\' horses and the boats\' crews offered (mutants: STAND-FLAT-block-grouped, STAND-FLAT-site-grouped, STAND-FLAT-nude, STAND-HORSE-walk-unoffered, STAND-FLAT-crew-unoffered)', () => {
  const w = hostText('src/scenes/world.js');
  ordered(w, ['if (npcFlatSet.has(flat)) continue;', 'if (flat.editor) continue;', 'if (isStandFlat(flat.archive, flat.record)) { pixelStandFlats.push(', 'addFlat(flat.archive, flat.record, fx,'], 'the block\'s flats');
  ordered(w, ['if (f.scale.x === 1 && f.scale.y === 1 && isStandFlat(f.archive, f.record)) pixelStandFlats.push({ archive: f.archive, record: f.record, x: f.base[0], y: f.base[1], z: f.base[2] });',
    'else if (f.scale.x === 1 && f.scale.y === 1) addFlat(f.archive, f.record, f.base[0], f.base[1], f.base[2]);'], 'a site\'s');
  ordered(w, ['for (const { archive, record, scale, centers } of scaledGroups.values()) {', 'for (const sf of pixelStandFlats) {',
    'const [archive, record] = horse ? [sf.archive, sf.record] : drawnFlat(sf.archive, sf.record);', 'const batch = renderer.createBillboardBatch(archive, record, size, centers);',
    'armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);', 'batches.push(batch);', 'standFlats.push(standFlatRecord(sf, batch, standFlatId(`${px},${py}`, sf.x, sf.z)));',
    'collider.cover.add(key, coverItems'], 'a batch each, before the cover (they make none)');
  assert.ok(w.includes('      standFlats,   // STAND-FLAT'), 'on the pixel');
  // a person a World of Daggerfall marker stands (a captive, a merchant, a prisoner) joins them on its pixel
  ordered(w, ["w.flat = { kind: 'billboard', archive: act.archive, record: act.record };", 'const batch = renderer.createBillboardBatch(act.archive, act.record, size, [base]);', 'p.batches.push(batch);',
    'if (isStandFlat(act.archive, act.record)) p.standFlats?.push(standFlatRecord({ archive: act.archive, record: act.record, x: base[0], y: base[1], z: base[2] }, batch, standFlatId(`${p.px},${p.py}`, base[0], base[2])));'], 'a marker\'s person');
  ordered(w, ['const _peopleOn = streetPeople.frame();', 'standingHorses.begin(tvf ? null : mwViewHorseRig(), mwv.eye);', 'const framePixelWalk = () => {',
    'streetPeople.offer(personActor(pn, look, f, mwv.eye, dt), pn.standBatch);', 'if (p.standFlats && ring <= 1) for (const sf of p.standFlats) {',
    "if (sf.kind === 'horse') {", 'standingHorses.offer(sf, sf.feet, sf.yaw, sf.look, sf.batch, sf.seed);', 'const look = _peopleOn ? figureLook(sf, yardFigureCtx) : null;',
    'streetPeople.offer(personActor(sf, look, f, mwv.eye, dt), sf.batch);', 'framePixelWalk();',
    'offerCrews(mwv.eye, townTalk.overlayActive ? 0 : dt, _peopleOn);', 'streetPeople.draw(canvas, proj, view, mwv.eye,', 'standingHorsesFrame(canvas, proj, view, mwv.eye, dt);',
    'renderer.drawBillboards(livePersonBatches, camRight, bbUp);'], 'the frame');
  // the host's own functions the frame calls (PERF-V8: the frame's bytecode kept under its quarter)
  ordered(w, ['const standingHorses = createStandingHorses({ renderer });', 'function standingHorsesFrame(canvas, proj, view, eye, dt) {', 'merchantYards.offerHorses(standingHorses);',
    'if (standingHorses.end(dt, { proj, view })) standingHorses.draw(canvas, { eye, proj, view });'], 'the horses\' end');
  ordered(w, ['function offerCrews(eye, dt, on) {', "if (!csaOn() || _mode() !== 'exterior') return;", 'csa.people(on ? offerCrewPerson : crewFlatDrawn);'], 'the crews\' offer');
  ordered(w, ['streetPeople.destroy();   // MWNPC8b', 'standingHorses.destroy();', 'csa.people(crewFlatDrawn);'], 'indoors');
  ordered(w, ['const offerCrewPerson = (f, b) => {', 'const look = b.conceal ? null : figureLook(f, yardFigureCtx);', 'if (look) streetPeople.offer(personActor(f, look, b.origin, _crewEye, _crewDt), b);', 'else b.castOnly = false;'], 'a crew member');
});

test('STAND-FLAT the location and the boats by source: exterior.js stands its town horses and its people no StaticNPC holds as the streamed world does; a boat\'s crew is every flat of a person\'s archive in her walk, named by her deed and their place, gone with their flat (mutants: STAND-FLAT-location-grouped, STAND-FLAT-crew-unnamed)', () => {
  const e = rd('src/scenes/exterior.js');
  assert.ok(e.includes('if (!_people.has(flat) && isStandFlat(flat.archive, flat.record)) locStandFlats.push({ archive: flat.archive, record: flat.record, x: flat.x + b.originX, y: flat.y, z: flat.z + b.originZ });\n      else if (!_people.has(flat)) {'), 'out of the groups');
  ordered(e, ['for (const sf of locStandFlats) {', 'const [da, dr] = isStandingHorseFlat(sf.archive, sf.record) ? [sf.archive, sf.record] : drawnFlat(sf.archive, sf.record);',
    'billboardBatches.push(batch);', 'standFlats.push(standFlatRecord(sf, batch,'], 'a batch each');
  ordered(e, ['const _peopleOn = standPeople.frame();', 'standingHorses.begin(mwViewHorseRig(), eye);', 'for (const sf of standFlats) {', 'standingHorses.offer(sf, sf.feet, sf.yaw, sf.look, sf.batch, sf.seed);',
    'const look = _peopleOn ? figureLook(sf, standFigureCtx) : null;', 'standPeople.draw(canvas, proj, view, eye,', 'if (standingHorses.end(dt, { proj, view })) standingHorses.draw(canvas, { eye, proj, view });', 'for (const b of billboardBatches) {'], 'the frame');
  const c = rd('src/scenes/comeSailAway/comeSailAwayPool.js');
  assert.ok(c.includes('if (isNpcFlat(bb.Summary.Archive)) crew.set(n, { piece: { id: `csa:${boat.uid || `h${boat.hull}`}:${i}`, flat: [bb.Summary.Archive, bb.Summary.Record] } });'));
  assert.equal(c.match(/flats\.delete\(n\); crew\.delete\(n\);/g)?.length, 2, 'gone with its flat, both ways a flat goes');
  assert.ok(c.includes('for (const [n, f] of crew) { const b = flats.get(n); if (b) fn(f, b); }'));
});
