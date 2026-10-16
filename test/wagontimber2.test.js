// WAGON-TIMBER PASS 2 (2026-10-16, Mac, of the wagon's wood and of its wheels: "Ok so there is a separation of all the
// wooden parts which is cool. Lets make a selector for each of them and send them over the wire using the same system
// that already exists"; "I want the wheel options to be separate from the wood options") - THE TIMBER AND THE WHEELS GO
// ON THE WIRE, AND GET THEIR SELECTORS - `ww` and `wr` beside the paint's `wl` (src/systems/horseCartWire.js,
// src/net/wire.js validParkData), the pool's own door opened for the five lists (src/scenes/horseCartPool.js
// ensureLook/lookRemap), and the driven kind's swatch rows on the Stable card (src/ui/holdingsPages.js), driven through the real
// pool and the real card over the tests' stand-in ARENA2 (test/classicArtFake.mjs).
//
// WHAT IS PINNED, AND WHY THE STALENESS TEST IS THE BIG ONE. Five things, and the third is the one that would have
// shipped broken: (1) `ww` and `wr` are a round trip - what one client dyes, another reads, with all NINE keys and no
// half of the look dropped between; (2) the park record's gates, and the two bounds are the LAW's own numbers written
// out beside `wl`'s, which this bump did not move; (3) THE STALENESS CASE - a wagon that has already built its
// textures dyes its beams mid-session, and the pool rebuilds instead of handing back the map it cached for the paint
// alone: the emblem's known staleness is a different shape (its arms are painted INTO the built picture, uploaded
// once) and a dyed board must not inherit it; (4) the rows shown are SWATCH rows, because `choiceRow`'s
// `colours.every(Boolean)` demotes a whole row to a stepper over ONE missing hex - so all seven names are pinned;
// (5) hccRecordKey moves on the wood and on the wheels and stands still when nothing did.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TIMBER_CHOICES, TIMBER_PARTS, TIMBER_FIELDS, TIMBER_LOOKS, WHEEL_LOOKS, TIMBER_LOOK_NAMES, TIMBER_CHOICE_LISTS,
  readWagonTimber, readWagonLookAll, wagonTimberCode, wagonTimberOfCode, wagonWheelCode, wagonWheelOfCode, wagonLookOfWire,
  WAGON_TIMBER_CODE_MAX, WAGON_WHEEL_CODE_MAX, timberedDrivenWagon, timberRows, TIMBER_TEXT, timberChoiceName,
} from '../src/systems/wagonTimber.js';
import { LOOK_COUNT, LOOK_NAMES, WAGON_OUTSIDE_LOOKS, wagonLookCode, wagonLookOfCode, WAGON_LOOK_CODE_MAX } from '../src/systems/wagonLooks.js';
import { hccWireRecord, validHccRecord, hccRecordKey } from '../src/systems/horseCartWire.js';
import { validParkData, PARK_WAGON_LOOK_MAX, PARK_WAGON_TIMBER_MAX, PARK_WAGON_WHEEL_MAX, RELAY_VERSION } from '../src/net/wire.js';
import { newWagonItem } from '../src/systems/wagonKinds.js';
import { wagonPoolDeps } from '../src/world/wagonModels.js';   // WAGON-TIMBER PASS 3: the regression test builds the pool through the production dep, not a hand-fed look
import { WAGON_ARCHIVE, TEX, LOOK_RECORDS, LOOK_RECORD_STRIDE, lookRecord, TIMBER_LISTS, wagonLookSources, WAGON_SOURCES, CART_DYES } from '../src/world/wagonArt.js';
import { createHorseCartPool } from '../src/scenes/horseCartPool.js';
import { setTextureDeriveContext } from '../src/systems/textureReplacement.js';
import { LOOK_SWATCHES, stableProviderFor, drawStablePage, setHoldingsProvider, resetHoldingsPages, _setHoldingsIconForTests } from '../src/ui/holdingsPages.js';
import { classicPictures } from '../src/world/classicArt.js';
import { toColor32 } from '../src/formats/color32Order.js';
import { fakeClassicRgba } from './classicArtFake.mjs';

setTextureDeriveContext({ classicRgba: fakeClassicRgba() });

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async (n = 8) => { for (let i = 0; i < n; i++) await tick(); };
const bakeOf = (kind) => JSON.parse(readFileSync(new URL(`../src/assets/wagons/${kind}.json`, import.meta.url), 'utf8'));
function fakeRenderer() {
  const r = { textures: new Map(), draws: [], evicted: [] };
  r.uploadTexture = (a, rec, px, o) => { const k = `${a}_${rec}`; if (!r.textures.has(k)) r.textures.set(k, { px, o }); };
  r.evictTexture = (k) => { r.evicted.push(k); r.textures.delete(k); };
  r.createMesh = (model) => ({ model });
  r.drawMesh = (gpu, m, remap, o) => r.draws.push({ gpu, remap, o });
  r.createBillboardBatch = () => ({ origin: [0, 0, 0] });
  r.destroyBillboardBatch = () => {};
  return r;
}
const parked = { isGrounded: true, position: [10, 1, 10], rotation: [0, 0, 0, 1], cargoTier: 0 };
const runtime = { view: () => ({ state: { HorseName: '', HorseMode: 0, Mode: 2, WorldX: 10, WorldZ: 10 }, moving: null, deployed: parked, horse: null, teamFollowing: false, horseFollowing: false, persistence: true }), lateUpdate() {}, actionRows: () => [] };
/** A look of the wagon's own: `over` writes fields over the wagon as built. */
const lookOf = (over) => ({ o: 0, w: 0, f: 0, c: 0, ...over });
/** The pool a host would build for a wagon wearing `look` - a closure, so the test may dye it mid-session. */
const poolFor = (r, kind, look, extra = {}) => createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: () => kind, wagonLook: () => look, bakedWagon: async (k) => bakeOf(k), ...extra });
/** The remap a wagon's body was drawn through last (the first draw is the body; the wheels follow it). */
const bodyOf = (r) => r.draws[0];

// ── a fake DOM, the Stable page's (test/holdings.test.js's) ──────────────────────────────────────────────────────────
function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, parent: null, title: '', isConnected: true, value: '', type: '', maxLength: 0,
    style: { _p: /** @type {Record<string, string>} */ ({}), setProperty(k, v) { this._p[k] = String(v); }, getPropertyValue(k) { return this._p[k] ?? ''; } },
    classList: { add: (...c) => c.forEach((x) => classes.add(x)), contains: (c) => classes.has(c), remove: (...c) => c.forEach((x) => classes.delete(x)) },
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (t) => el('h4', 'px-divider', t), meter: (now, max) => el('div', 'px-meter', `${now}/${max}`) };
/** Every node under `root` wearing `cls`. */
const nodesWith = (root, cls) => { const out = []; const walk = (x) => { if ((x.className ?? '').split(/\s+/).includes(cls)) out.push(x); for (const c of x.children ?? []) walk(c); }; walk(root); return out; };
/** Every button under `root` saying `text`. */
const pressesWith = (root, text) => nodesByTag(root, 'button').filter((b) => b.textContent === text || b.title === text);
/** Every node of `tag` under `root`. */
const nodesByTag = (root, tag) => { const out = []; const walk = (x) => { if (x.tag === tag) out.push(x); for (const c of x.children ?? []) walk(c); }; walk(root); return out; };
_setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
globalThis.document = undefined;

// ═══ 1. THE WIRE ═══════════════════════════════════════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PASS 2 THE WIRE ROUND TRIPS IT: `ww` (four wood digits) and `wr` (the wheels\' own) beside the paint\'s `wl` on the hv word and through the reader\'s door, and what one client dyes another reads - all NINE keys, none dropped between (mutants: the wheels answered out of the wood\'s code, a wood digit packed at the wrong weight, the reader dropping the paint, a digit past the law\'s width)', () => {
  // the ladder, spelled out against the law's own, at every weight
  assert.equal(wagonTimberCode(lookOf({ floor: 1 })), 1);
  assert.equal(wagonTimberCode(lookOf({ inner: 1 })), 6);
  assert.equal(wagonTimberCode(lookOf({ beam: 1 })), 36);
  assert.equal(wagonTimberCode(lookOf({ bench: 1 })), 216);
  assert.equal(wagonTimberCode(lookOf({ floor: 5, inner: 5, beam: 5, bench: 5 })), WAGON_TIMBER_CODE_MAX);
  assert.equal(WAGON_TIMBER_CODE_MAX, 1295, 'the SAME bound `wl` has - the same ladder over the same width');
  assert.equal(WAGON_WHEEL_CODE_MAX, 5);
  assert.equal(TIMBER_CHOICES, LOOK_COUNT, 'one digit for every list a wagon carries; the width is TAKEN, not written');

  // EVERY code, both ways, over the whole ladder - 1296 is nothing to walk and a packing bug lives at a weight
  const seen = new Set();
  for (let code = 0; code <= WAGON_TIMBER_CODE_MAX; code++) {
    const t = wagonTimberOfCode(code);
    assert.equal(wagonTimberCode(t), code, `code ${code} unpacked and packed again`);
    seen.add(JSON.stringify(t));
  }
  assert.equal(seen.size, WAGON_TIMBER_CODE_MAX + 1, 'every code a DIFFERENT wood - no two choices the same wagon');
  for (let d = 0; d <= WAGON_WHEEL_CODE_MAX; d++) {
    assert.equal(wagonWheelCode(lookOf({ wheels: d })), d);
    assert.equal(wagonWheelOfCode(d), d);
  }
  assert.deepEqual(wagonTimberOfCode(WAGON_TIMBER_CODE_MAX + 1), readWagonTimber(null), 'a code past the law: the wagon as built');
  assert.deepEqual(wagonTimberOfCode(-1), readWagonTimber(null));
  assert.deepEqual(wagonTimberOfCode(1295.5), readWagonTimber(null), 'and one that is not an integer');
  assert.equal(wagonWheelOfCode(WAGON_WHEEL_CODE_MAX + 1), 0);
  assert.equal(wagonWheelOfCode('4'), 0, 'the wheels are a DIGIT');

  // THE ROUND TRIP, over a wagon wearing all nine keys at once
  const look = lookOf({ o: 2, w: 1, f: 3, c: 5, floor: 3, inner: 1, beam: 5, bench: 2, wheels: 4 });
  const rec = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 0, angle: 0, look } });
  assert.equal(rec.wl, wagonLookCode(look), 'the paint, as it always rode');
  assert.equal(rec.ww, wagonTimberCode(look));
  assert.equal(rec.wr, 4);
  assert.deepEqual(validHccRecord(rec).w.look, readWagonLookAll(look), 'every key comes back - the paint\'s four and this law\'s five');
  // and the nine are the nine: the two halves never collide on a key, so neither can drop the other
  assert.deepEqual(Object.keys(readWagonLookAll(look)).sort(), ['beam', 'bench', 'c', 'f', 'floor', 'inner', 'o', 'w', 'wheels']);

  // THE WAGON AS BUILT, AND EVERY WORD BEFORE THIS BUMP
  const bare = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 0, angle: 0, look: lookOf({}) } });
  assert.equal(bare.ww, undefined, 'no wood, no field');
  assert.equal(bare.wr, undefined, 'and no wheels');
  const old = validHccRecord({ ...rec, ww: undefined, wr: undefined });
  assert.deepEqual(old.w.look, readWagonLookAll(lookOf({ o: 2, w: 1, f: 3, c: 5 })), 'a word from a tab on the old build: the paint, and the wagon as built');
  // a code past the law is that half as built, and the WORD IS NEVER REFUSED for it - a look is not worth a team
  assert.deepEqual(validHccRecord({ ...rec, ww: 1296 }).w.look.floor, 0);
  assert.deepEqual(validHccRecord({ ...rec, wr: 6 }).w.look.wheels, 0);
  assert.ok(validHccRecord({ ...rec, ww: 1296, wr: 6 }).w, 'and the team still stands');
  // the wheels answer OUT OF THEIR OWN list - 'silvered' is in no wood table
  const silvered = lookOf({ wheels: WHEEL_LOOKS.indexOf('silvered') });
  assert.equal(TIMBER_LOOKS.includes('silvered'), false, 'no silvered board');
  assert.equal(wagonTimberCode(silvered), 0, 'and a silvered wheel moves no wood digit');
  assert.equal(wagonWheelCode(silvered), WHEEL_LOOKS.indexOf('silvered'));
});

// ═══ 2. THE PARK RECORD AND hccRecordKey ═════════════════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PASS 2 THE PARK RECORD KEEPS IT, AND THE CHANGE KEY SEES IT MOVE: both fields gated beside `wl`, the relay\'s two bounds the law\'s own, `wl` untouched; hccRecordKey changes when the wood or the wheels change and does NOT change when nothing did (mutants: `ww` outside the gate - the whole park word refused; a bound off by one; `wl` widened; the key blind to the wood)', () => {
  const c = 'char-0001', a = [10, 10];
  const r = { w: [2, 10, 1, 10, 0, 0, 0, 1, 0, 0], h: [12, 1, 12, 0, 1, 0], n: 'Bay' };
  const word = (extra) => validParkData({ c, a, r: { ...r, ...extra } });

  // THE GATES. A field with no gate is a record the relay refuses WHOLE, so this half is not decoration:
  assert.equal(word({ ww: wagonTimberCode(lookOf({ beam: 3 })), wr: 4 }).r.ww, wagonTimberCode(lookOf({ beam: 3 })));
  assert.equal(word({ ww: wagonTimberCode(lookOf({ beam: 3 })), wr: 4 }).r.wr, 4);
  // an unrecognised or out-of-range value is dropped ALONE, and the rest of the record stands
  assert.equal(word({ ww: PARK_WAGON_TIMBER_MAX + 1 }).r.ww, undefined, 'a wood code past the law');
  assert.ok(word({ ww: PARK_WAGON_TIMBER_MAX + 1 }).r.w, 'and the team, the horse and the name are still there');
  assert.equal(word({ ww: 0 }).r.ww, undefined, 'as built: no field');
  assert.equal(word({ ww: 2.5 }).r.ww, undefined, 'a code that is not an integer');
  assert.equal(word({ ww: '3' }).r.ww, undefined);
  assert.equal(word({ wr: PARK_WAGON_WHEEL_MAX + 1 }).r.wr, undefined, 'a wheel digit past the law');
  assert.ok(word({ wr: PARK_WAGON_WHEEL_MAX + 1 }).r.h, 'and the horse still stands');
  assert.equal(word({ wr: 0 }).r.wr, undefined, 'the built wheel: no field');
  // THE BOUNDS ARE THE LAW'S OWN, written out beside `wl`'s rather than imported - the relay bundle is wire.js and the
  // mat4 it reaches, and a relay that had to pull in a wagon's law to check a number would be carrying the wagon
  assert.equal(PARK_WAGON_TIMBER_MAX, WAGON_TIMBER_CODE_MAX);
  assert.equal(PARK_WAGON_WHEEL_MAX, WAGON_WHEEL_CODE_MAX);
  // AND `wl` IS NOT WIDENED. Two numbers beside one, never inside it.
  assert.equal(PARK_WAGON_LOOK_MAX, WAGON_LOOK_CODE_MAX, 'the paint\'s own bound is where it was');
  assert.equal(PARK_WAGON_LOOK_MAX, 1295);
  assert.equal(LOOK_COUNT, 6, 'and no list grew');
  assert.equal(word({ wl: PARK_WAGON_LOOK_MAX + 1 }).r.wl, undefined, 'the paint\'s gate stands where it was');
  assert.equal(word({ wl: wagonLookCode(lookOf({ c: 5 })) }).r.wl, wagonLookCode(lookOf({ c: 5 })));

  // THE CHANGE KEY. Without a field here, changing it publishes NOTHING and no peer ever learns.
  const base = hccRecordKey(hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 0, angle: 0, look: lookOf({ o: 1 }) } }));
  const at = (over) => hccRecordKey(hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 0, angle: 0, look: lookOf({ o: 1, ...over }) } }));
  assert.equal(at({}), base, 'a word twice over: the same key');
  assert.equal(hccRecordKey(at({})), hccRecordKey(at({})), 'nothing moved, and the key stands still');
  for (const over of [{ floor: 1 }, { inner: 1 }, { beam: 1 }, { bench: 1 }, { wheels: 1 }]) {
    assert.notEqual(at(over), at({}), `${JSON.stringify(over)}: the key moved`);
  }
  assert.notEqual(at({ floor: 1 }), at({ floor: 2 }), 'one part to another moves it too');
  assert.notEqual(at({ wheels: 1 }), at({ wheels: 2 }), 'and one finish to another');
  // the key stands still through everything else about the record
  const rec = hccWireRecord({ wagon: { kind: 2, position: [1, 2, 3], rotation: [0, 0, 0, 1], tier: 0, angle: 0, look: lookOf({ beam: 2 }) }, horse: { position: [4, 1, 4], forward: [1, 0, 0], walking: false }, name: 'Bay' });
  assert.equal(hccRecordKey(rec), hccRecordKey({ ...rec }), 'the same record, read twice');
  assert.equal(hccRecordKey(null), '');
});

// ═══ 3. THE POOL'S OWN DOOR, AND THE STALENESS CASE ══════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PASS 2 THE FIVE LISTS GO THROUGH THE PAINT\'S OWN DOOR: each part\'s choice uploads its records on first wear exactly as a painted wagon uploads its paint records, and the drawn body is remapped onto them; the wheels take their tread AND their face in one finish (mutants: a list not in the remap, the records never uploaded, the wood list answering with the wheels\' records)', async () => {
  for (const part of TIMBER_FIELDS) {
    const names = TIMBER_CHOICE_LISTS[part];
    for (let i = 1; i < names.length; i++) {
      const r = fakeRenderer();
      const pool = poolFor(r, 'openWagon', lookOf({ [part]: i }));
      pool.attach(runtime);
      pool.partsOf('openWagon');
      await flush();
      r.draws.length = 0;
      assert.equal(pool.draw(r), 1, `${part} ${names[i]}: drawn`);
      await flush();
      const remap = bodyOf(r).remap;
      for (const rec of LOOK_RECORDS[TIMBER_LISTS[part]]) {
        assert.equal(remap.get(`${WAGON_ARCHIVE}_${rec}`), `${WAGON_ARCHIVE}_${lookRecord(rec, i)}`, `${part} ${names[i]}: record ${rec} drawn as ${lookRecord(rec, i)}`);
        assert.ok(r.textures.has(`${WAGON_ARCHIVE}_${lookRecord(rec, i)}`), `${part} ${names[i]}: its record uploaded on first wear`);
      }
      assert.equal(remap.size, LOOK_RECORDS[TIMBER_LISTS[part]].length, `${part} ${names[i]}: only what this part repaints`);
    }
  }
  // the wheels are ONE choice wearing TWO records - a wheel is turned and fitted whole
  const rw = fakeRenderer(), pw = poolFor(rw, 'openWagon', lookOf({ wheels: 3 }));
  pw.attach(runtime); pw.partsOf('openWagon'); await flush(); rw.draws.length = 0; pw.draw(rw); await flush();
  assert.deepEqual([...bodyOf(rw).remap.entries()].sort(), LOOK_RECORDS.wheels.map((rec) => [`${WAGON_ARCHIVE}_${rec}`, `${WAGON_ARCHIVE}_${lookRecord(rec, 3)}`]).sort(), 'the tread and the face, one finish');
  // as built, nothing is remapped at all
  const rb = fakeRenderer(), pb = poolFor(rb, 'openWagon', lookOf({}));
  pb.attach(runtime); pb.partsOf('openWagon'); await flush(); rb.draws.length = 0; pb.draw(rb); await flush();
  assert.equal(bodyOf(rb).remap, null, 'a wagon as it was built wears its own pictures');
// …AND THE PICTURE IS THE ONE ITS OWN LIST NAMES. This is the half a record-count cannot see: a door handed the
  // wheels the WOOD's list still uploads every record and still remaps every one of them, so six swatches and six
  // remaps read perfectly while a silvered wheel is drawn with the wood's fifth choice's picture. The two tables
  // differ at index 1 (pine against ash) and index 4 (mahogany against silvered), and silvered is the operator's own
  // word for a grey - so the wheels at those two choices are pinned against the wood's answer at the same index.
  const wanted = async (list, i, name) => Buffer.from(toColor32((await classicPictures(wagonLookSources(list, i, name), fakeClassicRgba())).find(([rec]) => rec === lookRecord(TEX.tyre, i))[1]).colors).toString('base64');   // the pool uploads through toColor32, which flips the rows; both sides go through it or neither is the upload
  for (const i of [1, 4]) {
    const r2 = fakeRenderer(), p2 = poolFor(r2, 'openWagon', lookOf({ wheels: i }));
    p2.attach(runtime); p2.partsOf('openWagon'); await flush(); r2.draws.length = 0; p2.draw(r2); await flush();
    const got = Buffer.from(r2.textures.get(`${WAGON_ARCHIVE}_${lookRecord(TEX.tyre, i)}`).px.colors).toString('base64');
    assert.equal(got, await wanted('wheels', i, WHEEL_LOOKS[i]), `wheels ${i} (${WHEEL_LOOKS[i]}): the tread the WHEEL'S list names`);
    assert.notEqual(got, await wanted('wheels', i, TIMBER_LOOKS[i]), `wheels ${i}: and not the wood's ${TIMBER_LOOKS[i]} - the two tables answer separately`);
  }
});

test('WAGON-TIMBER PASS 2 THE STALENESS CASE - CHANGING A LOOK MID-SESSION REBUILDS (Mac: "send them over the wire using the same system that already exists"): a wagon that has ALREADY built its textures dyes its beams with its paint UNCHANGED, and the pool rebuilds instead of handing back the map it cached for the paint alone - for the player who dyed them and for every peer reading their word (mutants: the remap key blind to the timber, the timber dropped by the reader, a peer\'s word not re-derived)', async () => {
  // THE BUG THIS EXISTS TO CATCH. The remap map is CACHED, so its key has to move when the timber does. Set the paint
  // FIRST (so a map IS cached under the paint's key), then dye the beams with the paint untouched: under a key that
  // carried only the kind and the paint, the second draw found the cached map and the wagon kept the wood it had.
  const look = lookOf({ o: 1 });
  const r = fakeRenderer();
  let asked = 0;
  const pool = poolFor(r, 'openWagon', look, { onChanged: () => { asked++; } });
  pool.attach(runtime);
  pool.partsOf('openWagon');
  await flush();
  r.draws.length = 0;
  pool.draw(r);
  pool.frame(0.016, [10, 2, 10]);
  await flush();
  const painted = bodyOf(r).remap;
  assert.ok(painted?.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), 'first: the blue cloth, through its own records');
  assert.equal(painted.get(`${WAGON_ARCHIVE}_${TEX.beam}`), undefined, 'and the beams still the built beam');
  const askedAfterPaint = asked;
  assert.ok(askedAfterPaint > 0, 'the paint published a frame when it moved');

  // …NOW DYE THE BEAMS, mid-session, with the paint where it was
  look.beam = 4;
  r.draws.length = 0;
  pool.draw(r);
  pool.frame(0.016, [10, 2, 10]);
  await flush();
  const dyed = bodyOf(r).remap;
  assert.equal(dyed.get(`${WAGON_ARCHIVE}_${TEX.beam}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 4)}`, 'the beams ARE dyed on the next frame');
  assert.equal(dyed.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), painted.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), 'and the cloth is untouched');
  assert.ok(r.textures.has(`${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 4)}`), 'the dye\'s record built on the frame that wanted it');
  assert.ok(asked > askedAfterPaint, 'and the pool ASKED for a frame - hccRecordKey saw the wood move, which is what puts it on the wire');

  // …AND THE WHEELS, AND THE OTHER THREE PARTS, ON THE SAME WAGON, one after another
  for (const [part, i] of [['wheels', 3], ['floor', 2], ['inner', 5], ['bench', 1]]) {
    look[part] = i;
    r.draws.length = 0;
    pool.draw(r);
    await flush();
    for (const rec of LOOK_RECORDS[TIMBER_LISTS[part]]) {
      assert.equal(bodyOf(r).remap.get(`${WAGON_ARCHIVE}_${rec}`), `${WAGON_ARCHIVE}_${lookRecord(rec, i)}`, `${part} -> ${i} on a wagon already wearing everything else`);
    }
  }
  // and back again: a part put to as built comes off the map
  look.beam = 0;
  r.draws.length = 0;
  pool.draw(r);
  await flush();
  assert.equal(bodyOf(r).remap.get(`${WAGON_ARCHIVE}_${TEX.beam}`), undefined, 'the beams put back wear the built beam again');

// A PEER'S SIDE, which is the half that matters: their word carries the timber, and this client re-derives the
  // draw from the word rather than from anything it built once. `wk` 1 is the open wagon - the kind THIS pool warmed,
  // so its parts are up and a peer of that kind is the one thing standing at all.
  const rp = fakeRenderer();
  const pp = poolFor(rp, 'openWagon', lookOf({}));
  pp.attach(runtime);
  pp.partsOf('openWagon');
  await flush();
  const theirs = (over) => ({ w: [2, 12, 1, 12, 0, 0, 0, 1, 0, 0], wk: 1, wl: 2, ...over });   // stood beside mine, in the draw's reach
  const peerDraw = async () => {
    for (let i = 0; i < 3; i++) pp.frame(1 / 60, [10, 2, 10]);
    rp.draws.length = 0;
    pp.draw(rp);
    await flush();   // the pictures are read out of this client's own ARENA2 and land a moment after they are asked
    return rp.draws.filter((d) => d.remap).map((d) => d.remap).at(-1);
  };

  assert.equal(pp.applyOwner('peer-1', theirs({}), (p) => p, 0), true);
  const first = await peerDraw();
  assert.ok(first, 'their wagon stands, in their livery');
  assert.equal(first.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.openSide, 2)}`, 'and is drawn in it');
  assert.equal(first.get(`${WAGON_ARCHIVE}_${TEX.beam}`), undefined, 'their beams are still the built beam');

  // …they dye them, and say so on the same frame
  pp.applyOwner('peer-1', theirs({ ww: wagonTimberCode({ beam: 5 }) }), (p) => p, 1000);
  const second = await peerDraw();
  assert.equal(second.get(`${WAGON_ARCHIVE}_${TEX.beam}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 5)}`, 'their beams ARE dyed here, without a reload');
  assert.equal(second.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), first.get(`${WAGON_ARCHIVE}_${TEX.openSide}`), 'and their livery stood');
  assert.ok(rp.textures.has(`${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 5)}`), 'the dye built here, out of this client\'s own ARENA2');

  // a word from a tab on the old build carries no `ww`: the wagon is as built, and the team still stands
  assert.equal(pp.applyOwner('peer-2', theirs({}), (p) => p, 2000), true);
  assert.ok(await peerDraw(), 'the old-build peer\'s wagon stands, in their livery and no timber');
  // and a peer who dyes only their WHEELS moves no board of their wagon
  pp.applyOwner('peer-3', theirs({ wr: wagonWheelCode({ wheels: 4 }) }), (p) => p, 3000);
  const third = await peerDraw();
  assert.equal(third.get(`${WAGON_ARCHIVE}_${TEX.tyre}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.tyre, 4)}`, 'their tread');
  assert.equal(third.get(`${WAGON_ARCHIVE}_${TEX.wheel}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.wheel, 4)}`, 'and their face');
  assert.equal(third.get(`${WAGON_ARCHIVE}_${TEX.beam}`), undefined, 'and not one board of their wagon');
});
// ═══ 4. THE FIVE SELECTORS ON THE STABLE CARD ═══════════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PER-KIND ROWS THE STABLE CARD SHOWS ONLY WHAT THE DRIVEN KIND WEARS, AND ALL OF THEM ARE SWATCH ROWS: behind the one press beside the paint, a row a part the kind wears (an open wagon: floor, beams, bench, wheels - no inner) and the wheels, each a row of little colours - NOT a stepper - and a press writes the item and tells the host (mutants: a name with no swatch demoting its row, the wheels missed, a press that dyes nothing, a press the host is not told of)', () => {
  // EVERY name of BOTH tables has a colour. `choiceRow` asks `colours.every(Boolean)`, so ONE missing hex takes the
  // WHOLE row to a stepper - six selectors, five of them little squares and one a pair of arrows, for one missing hex.
  for (const name of [...TIMBER_LOOKS, ...WHEEL_LOOKS]) assert.match(LOOK_SWATCHES[TIMBER_LOOK_NAMES[name]] ?? '', /^#[0-9a-f]{6}$/, `${name}: a swatch of its own`);
  for (const kind of Object.keys(WAGON_OUTSIDE_LOOKS)) for (const k of WAGON_OUTSIDE_LOOKS[kind]) assert.ok(LOOK_SWATCHES[LOOK_NAMES[k]], `${kind} ${k}: the paint's own row is not demoted`);
  assert.equal(TIMBER_LOOK_NAMES.oak, 'Oak', 'and the wood\'s own name is its own - \'Weathered oak\' is the paint\'s and a different swatch');

  // THE CARD, through the host's own seam
  const items = [newWagonItem('openWagon')];
  let told = 0;
  setHoldingsProvider(stableProviderFor({ runtime: null, on: () => false, hasHorse: () => false, hasCart: () => true, items: () => items, onPainted: () => { told++; } }));
  resetHoldingsPages();
  const draw = () => { const d = el('div', 'px-qdetail'); drawStablePage(d, () => {}, kit); return d; };

  const closed = draw();
  assert.equal(nodesWith(closed, 'hld-swatches').length, 0, 'nothing until the press');
  const press = pressesWith(closed, 'Change look');
  assert.equal(press.length, 1, 'ONE press for the wagon - the paint and the timber are one question');
  assert.match(closed.textContent, /Timber: as built/, 'and the line says so');

  press[0].onclick();
  const open = draw();
  const rows = nodesWith(open, 'hld-pick');
  const words = rows.map((x) => x.children.find((c) => (c.className ?? '').includes('hld-picklabel'))?.textContent);
  assert.deepEqual(words, ['Paint', 'Floor', 'Beams', 'Bench', 'Wheels'], 'the paint\'s row and the open wagon\'s four (no inner)');
  assert.equal(nodesWith(open, 'hld-swatches').length, 5, 'FIVE swatch rows, one a row');
  assert.equal(nodesWith(open, 'hld-step').length, 0, 'and NOT ONE stepper - every name of both tables has a colour');
  for (const row of rows) {
    const set = row.children.find((c) => (c.className ?? '').includes('hld-swatches'));
    assert.equal(set.children.length, 6, `${words[rows.indexOf(row)]}: six choices`);
    assert.ok(set.children.every((b) => /^#[0-9a-f]{6}$/.test(b.style?.getPropertyValue?.('--sw') ?? '')), 'and every one a colour');
  }

  // A PRESS DYES, AND THE HOST IS TOLD - `onPainted` is the ONLY thing that republishes, so it is the whole of the
  // door between a card and a peer seeing it.
  const beamRow = rows[2], beamSet = beamRow.children.find((c) => (c.className ?? '').includes('hld-swatches'));
  beamSet.children[4].onclick();
  assert.equal(items[0].wagonLook.beam, 4, 'the beams dyed');
  assert.equal(told, 1, 'and the host told its word moved');
  const wheelRow = rows[4], wheelSet = wheelRow.children.find((c) => (c.className ?? '').includes('hld-swatches'));
  wheelSet.children[WHEEL_LOOKS.indexOf('silvered')].onclick();
  assert.equal(items[0].wagonLook.wheels, WHEEL_LOOKS.indexOf('silvered'), 'and the wheels, out of their own list');
  assert.equal(told, 2);
  // the card reads the wagon back - the row a player pressed is the wagon they saw
  const again = draw();
  assert.match(again.textContent, /Timber: beams, wheels/, 'the line names the parts that are dyed');
  assert.equal(timberRows(items).find((r) => r.part === 'beam').current, 4);

  // AND THE ACT, on the law's own terms: free, any time, the mod off, and a part put back drops its field
  assert.deepEqual(timberedDrivenWagon(items, 'beam', 0), { ok: true, text: TIMBER_TEXT.dyed('beam', timberChoiceName('beam', 0)) });
  assert.equal(items[0].wagonLook.beam, undefined, 'the beams put back keep no field');
  assert.equal(items[0].wagonLook.wheels, WHEEL_LOOKS.indexOf('silvered'), 'and the wheels are their own');
  assert.deepEqual(timberedDrivenWagon([], 'beam', 1), { ok: false, text: TIMBER_TEXT.noWagon }, 'no wagon, no dye');
  assert.deepEqual(timberedDrivenWagon(items, 'keel', 1), { ok: false, text: TIMBER_TEXT.noWagon }, 'and not a part this law knows');
  assert.equal(timberedDrivenWagon(items, 'wheels', 1).text, "The wagon's wheels are now ash.", 'the two many are read off the names table');
  assert.equal(timberedDrivenWagon(items, 'floor', 1).text, "The wagon's floor is now pine.", 'and the three one');
});

// ═══ 4b. THE PER-KIND TABLE (2026-10-16, operator correction) ════════════════════════════════════════════════════════

test('WAGON-TIMBER PER-KIND ROWS THE CARD OFFERS WHAT THE DRIVEN KIND WEARS: a cart floor, inner, beam, wheels (NO bench - its bake has no bench role); an open wagon floor, beam, bench, wheels (NO inner); a caravan keeps all five untouched by standing order; a kind the card does not know all five, so a selector is never stranded - and the law stays permissive (a hidden part set programmatically still dyes)', () => {
  const parts = (items) => timberRows(items).map((r) => r.part);
  assert.deepEqual(parts([newWagonItem('cart')]), ['floor', 'inner', 'beam', 'wheels'], 'the Small Cart, unmarked: no bench');
  assert.deepEqual(parts([{ ...newWagonItem('cart'), wagonKind: 'cart' }]), ['floor', 'inner', 'beam', 'wheels'], 'and marked a cart: no bench');
  assert.deepEqual(parts([newWagonItem('openWagon')]), ['floor', 'beam', 'bench', 'wheels'], 'the open wagon: no inner');
  assert.deepEqual(parts([newWagonItem('caravan')]), ['floor', 'inner', 'beam', 'bench', 'wheels'], 'the caravan: untouched, all five as before');
  assert.deepEqual(parts([{ ...newWagonItem('cart'), wagonKind: 'balloon' }]), ['floor', 'inner', 'beam', 'bench', 'wheels'], 'a mark naming no kind: all five, never strand a selector');
  // THE DRIVEN WAGON DECIDES, not the first in the pack: a cart first, the open wagon second, and the card lists the open wagon's rows
  assert.deepEqual(parts([newWagonItem('cart'), newWagonItem('openWagon')]), ['floor', 'beam', 'bench', 'wheels'], 'two wagons: the driven one\'s rows');
  // every row still reads the wagon it lists
  assert.deepEqual(timberRows([newWagonItem('openWagon')]).map((r) => [r.part, r.current]), [['floor', 0], ['beam', 0], ['bench', 0], ['wheels', 0]], 'as built: every current 0');
  // AND THE LAW STAYS PERMISSIVE: a hidden part set programmatically still dyes (the cart's bench)
  const cart = [newWagonItem('cart')];
  assert.equal(timberedDrivenWagon(cart, 'bench', 2).ok, true, 'the cart\'s bench, hidden from the card, still dyes by hand');
});

// ═══ 5. THE RELAY'S WORDS, AND WHAT A DEPLOY OWES ═════════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PASS 2 THE RELAY IS world207 AND SAYS ITS DEPLOY ORDER: the version moved for the two gates, the house comment says the relay goes before the account service and before the clients, and no wagon module was pulled into the bundle (mutants: a version not moved, the bounds imported into the bundle, a frame reshaped)', async () => {
  assert.equal(RELAY_VERSION, 'world208');
  const wire = read('src/net/wire.js');
  assert.match(wire, /export const RELAY_VERSION = 'world208';\s+\/\/ WAGON-ARMS \(2026-10-16, Mac,/);
  assert.match(wire, /DEPLOY THE RELAY BEFORE THE ACCOUNT SERVICE/, 'the house order is in the comment that is the law, and it is the relay first');
  assert.match(wire, /BEFORE THE ACCOUNT SERVICE[^]*?and before the clients/, 'then the account service, then the clients - that ORDER is the part that matters and it is pinned as words, not as a sentence that drifts');
  // …AND CI ENFORCES THE FIRST HALF. account-deploy.yml waits on the relay's /health for the version wire.js names
  // and deploys NOTHING if it never arrives, because the service signs the tokens this relay verifies. A relay bumped
  // by hand with no deploy step would otherwise leave the two jobs racing, and the last three paired deploys landed
  // either way round.
  const acct = read('.github/workflows/account-deploy.yml');
  assert.match(acct, /Wait for the relay to serve this push.s version/, 'the account deploy waits for the relay');
  assert.ok(acct.includes('RELAY_VERSION') && acct.includes('src/net/wire.js'), 'and it reads the version out of wire.js, so a bump is what it waits for');
  // `wl` UNMOVED - a widened paint would re-sign every token and every kept record on the relay
  assert.match(wire, /export const PARK_WAGON_LOOK_MAX = 1295;/);
  assert.doesNotMatch(wire, /export const PARK_WAGON_LOOK_MAX = (?!1295)\d+;/);
  // the relay bundle is wire.js and the one mat4 it reaches: a wagon's law is NOT pulled in to check a number
  const { graph } = await import('./importGraph.mjs');
  assert.deepEqual(graph('server/src/index.js').filter((f) => /wagon|horse|timber/i.test(f)), [], 'no wagon module in the relay bundle');
});

// ═══ 6. THE PRODUCTION PATH (PASS 3) ═══════════════════════════════════════════════════════════════════════════════════

test('WAGON-TIMBER PASS 3 THE PRODUCTION PATH CARRIES THE DYE: the pool is built through the REAL `wagonPoolDeps` look over a pack holding a cart FIRST and the open wagon second, and the timber act dyes the DRIVEN wagon (the open wagon, not the first in the pack) - then the pool\'s drawn remap carries the dyed records, and the cart\'s paints dye its grain instead of swapping a flat swatch (mutants: the dep stripping the timber, the act dyeing the first wagon, the cart painted flat)', async () => {
  // THE PACK: a cart first, the open wagon second. The driven wagon is the BEST owned (wagonKinds.js activeWagonItem),
  // so the pool draws the open wagon - and the old act (`items.find(isWagonItem)`) would have dyed the cart instead.
  const items = [newWagonItem('cart'), newWagonItem('openWagon')];
  const deps = wagonPoolDeps(() => items);
  assert.equal(deps.wagonKind(), 'openWagon', 'the pool draws the driven wagon');
  const r = fakeRenderer();
  const pool = createHorseCartPool({ renderer: r, meshes: null, collider: () => null, now: () => 0, wagonKind: deps.wagonKind, wagonLook: deps.wagonLook, bakedWagon: async (k) => bakeOf(k) });
  pool.attach(runtime);
  pool.partsOf('openWagon');
  await flush();
  r.draws.length = 0;
  assert.equal(pool.draw(r), 1, 'the driven wagon stands');
  await flush();
  assert.equal(bodyOf(r).remap, null, 'as built: no remap');

  // DYE THROUGH THE PRODUCTION ACT - on the DRIVEN wagon, never the first in the pack
  const said = timberedDrivenWagon(items, 'beam', 4);
  assert.equal(said.ok, true, 'the press dyes');
  assert.equal(items[1].wagonLook.beam, 4, 'the driven wagon (the open wagon) dyed');
  assert.equal(items[0].wagonLook, undefined, 'and the cart first in the pack untouched');
  assert.equal(timberRows(items).find((row) => row.part === 'beam').current, 4, 'and the card reads the wagon it dyed');

  // …AND THE POOL DRAWS THE DYE THROUGH THE PRODUCTION DEP. A dep that stripped the timber (the old four-key read)
  // hands the pool a look with no `beam`, and the wagon keeps the built beam with nothing thrown anywhere.
  r.draws.length = 0;
  pool.draw(r);
  await flush();
  const remap = bodyOf(r).remap;
  assert.equal(remap?.get(`${WAGON_ARCHIVE}_${TEX.beam}`), `${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 4)}`, 'the drawn body wears the dyed beams');
  assert.ok(r.textures.has(`${WAGON_ARCHIVE}_${lookRecord(TEX.beam, 4)}`), 'the dye\'s record built on first wear');
  assert.equal(remap.size, 1, 'and nothing else moved');

  // …AND THE CART'S PAINT IS A DYE OF ITS GRAIN. Each choice past as built names the side's dyed record - the built
  // boards (DF.hullPlanks) through its own CART_DYES row - never a flat swatch over them.
  for (const [i, name] of WAGON_OUTSIDE_LOOKS.cart.entries()) {
    if (i === 0) { assert.deepEqual(wagonLookSources('cart', 0, name), {}, 'as built names nothing'); continue; }
    assert.deepEqual(wagonLookSources('cart', i, name), { [lookRecord(TEX.side, i)]: { dyed: { from: WAGON_SOURCES[TEX.side], dye: CART_DYES[name] } } }, `cart ${name}: its grain, dyed`);
  }
});