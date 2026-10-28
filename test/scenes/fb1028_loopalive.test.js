// LOOP-ALIVE (FIELD BUGS 2026-10-28, the owner: "chopping trees and general interaction outside the bay can lock up your
// character"). Two ways one throw locked a character for the rest of the session. A host's frame re-arms at its foot,
// so a throw anywhere in a frame ended the loop. And the gathering host's tick runs inside the hosts' catch, so an act
// whose frame threw tick after tick was never stepped or walked off again: every press, click and swing stayed the
// act's. AUDIT LOOP-ALIVE (bible/01-Overview/audits/Audit-Loop-Alive.md) widened these pins.
// tools/mutants/fb1028_loopalive.json.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';

import { loopFrame, runFrame, SAID_MAX } from '../../src/scenes/frameLoop.js';
import { frameBegin, frameMark, _resetFrameClock } from '../../src/systems/frameClock.js';
import { Renderer } from '../../src/render/renderer.js';
import { trees, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { createProfBook } from '../../src/net/profBook.js';
import { CHOP_ACT } from '../../src/net/professionLaw.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { createGatherHost, aimAt, ACT_STOPPED_LINE, ACT_FAULTS_MAX } from '../../src/scenes/gatherHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';
import { gatherBeatOf } from '../../src/net/peer/peerGather.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** The page: its frame queue run by hand (each callback, as a browser runs them, every throw kept), the faults it was
 *  told of (main.js's `error` listener reads reportError's), and the timers armed. */
function page({ report = true } = {}) {
  const queue = [], told = [], threw = [], timers = [];
  const was = { raf: globalThis.requestAnimationFrame, report: globalThis.reportError, error: console.error, timeout: globalThis.setTimeout };
  globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  globalThis.reportError = report ? (e) => told.push(e?.message ?? '(no words)') : undefined;
  globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  console.error = () => {};
  return {
    queue, told, threw, timers,
    /** The frames armed now, each run once. */
    step() { const now = queue.splice(0); for (const cb of now) { try { cb(16); } catch (e) { threw.push(e); } } return now.length; },
    restore() { globalThis.requestAnimationFrame = was.raf; globalThis.reportError = was.report; console.error = was.error; globalThis.setTimeout = was.timeout; },
  };
}

test('LOOP-ALIVE: a frame loop that throws before its foot is armed again, its fault said once; a loop that armed before it threw is not armed twice (mutants: the catch never re-arms; armed whether or not the frame did; said every frame)', () => {
  const p = page();
  try {
    let n = 0, broken = true;
    function frame() {
      n++;
      if (broken && n >= 2) throw new Error('a frame threw');   // the throw comes before the foot
      loopFrame(frame);
    }
    loopFrame(frame);
    for (let i = 0; i < 4; i++) assert.equal(p.step(), 1, 'one frame armed after each, the throwing ones too');
    assert.equal(n, 4);
    assert.deepEqual(p.told, ['a frame threw'], 'said once, not each frame');
    assert.deepEqual(p.threw, [], 'nothing reached the page as an uncaught throw');
    broken = false;
    p.step();
    assert.equal(p.queue.length, 1, 'mended, it arms itself as before');
    let m = 0;
    function early() { m++; loopFrame(early); if (m >= 2) throw new Error('after the arm'); }
    p.queue.length = 0;
    loopFrame(early);
    p.step(); p.step(); p.step();
    assert.equal(p.queue.length, 1, 'armed once a frame');
    assert.deepEqual(p.told, ['a frame threw', 'after the arm']);
  } finally { p.restore(); }
});

test('AUDIT LOOP-ALIVE A1-A3: any thrown value keeps the loop; a message that changes every frame is said SAID_MAX times, no more; the same words thrown from another line, or by another loop, are said again (mutants: the arm after the saying; the key a bare String(); no cap; one set for every loop; the key the message alone)', () => {
  const p = page();
  try {
    let a = 0;
    function odd() { a++; if (a >= 2) throw Object.create(null); loopFrame(odd); }
    loopFrame(odd);
    for (let i = 0; i < 4; i++) p.step();
    assert.equal(p.queue.length, 1, 'a value with no words still re-arms');
    assert.deepEqual(p.threw, []);
    p.queue.length = 0; p.told.length = 0;
    let b = 0;
    function counting() { b++; if (b >= 2) throw new Error(`frame ${b}`); loopFrame(counting); }
    loopFrame(counting);
    for (let i = 0; i < SAID_MAX + 20; i++) p.step();
    assert.equal(p.told.length, SAID_MAX, 'capped');
    p.queue.length = 0; p.told.length = 0;
    const WORDS = 'Cannot read properties of undefined (reading \'x\')';
    let c = 0;
    function twoLines() {
      c++;
      if (c === 2) throw new TypeError(WORDS);
      if (c === 3) throw new TypeError(WORDS);   // the same words, another line
      loopFrame(twoLines);
    }
    loopFrame(twoLines);
    for (let i = 0; i < 4; i++) p.step();
    assert.equal(p.told.length, 2, 'each line its own fault');
    /** Two loops of one code, their fault thrown from one line. */
    const make = () => { let d = 0; function f() { d++; if (d === 2) throw new TypeError(WORDS); loopFrame(f); } return f; };
    loopFrame(make());
    loopFrame(make());
    for (let i = 0; i < 3; i++) p.step();
    assert.equal(p.told.length, 4, 'each loop says its own');
  } finally { p.restore(); }
});

test('LOOP-ALIVE: a callback never seen arming itself throws as it always did - a one-off, a loop\'s first frame, a one-off armed again from outside (mutants: every callback\'s throw kept; the running callback never forgotten)', () => {
  const p = page();
  try {
    loopFrame(() => { throw new Error('one-off'); });
    p.step();
    assert.deepEqual(p.threw.map((e) => e.message), ['one-off']);
    assert.equal(p.queue.length, 0, 'nothing armed again');
    assert.throws(() => runFrame(() => { throw new Error('first'); }, 0), /first/);
    let fail = false;
    const once = () => { if (fail) throw new Error('later'); };
    loopFrame(once);
    p.step();
    fail = true;
    loopFrame(once);   // armed again by someone else, between frames
    p.step();
    assert.deepEqual(p.threw.map((e) => e.message), ['one-off', 'later']);
    assert.deepEqual(p.told, []);
  } finally { p.restore(); }
});

test('AUDIT LOOP-ALIVE A4, A8: a frame that threw leaves no frame open on the clock; with no reportError the fault is thrown from a timer, the loop armed (mutants: no frameAbort; no fallback)', () => {
  const p = page({ report: false });
  try {
    _resetFrameClock();
    let n = 0;
    function frame(now) { n++; frameBegin(now); if (n >= 2) throw new Error('mid-frame'); loopFrame(frame); }
    loopFrame(frame);
    p.step(); p.step();
    assert.equal(frameMark(), null, 'the thrown frame\'s sample closed');
    assert.equal(p.queue.length, 1);
    assert.equal(p.timers.length, 1, 'said from a timer');
    assert.throws(() => p.timers[0](), /mid-frame/);
  } finally { p.restore(); _resetFrameClock(); }
});

/** Each call of `name` in a host's source, as code (comments are no calls). */
function callsOf(src, name) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'CallExpression') {
      const c = n.callee;
      if ((c.type === 'Identifier' && c.name === name) || (c.type === 'MemberExpression' && c.property?.name === name)) out.push(src.slice(n.start, n.end));
    }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  };
  walk(acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }));
  return out;
}

test('LOOP-ALIVE: the four frame hosts arm their loop through the guard, every arm the bare `requestAnimationFrame(frame)` (mutants: a host back on the global; an arm on `globalThis`; an arm through an arrow, whose identity is new each frame)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    const src = rd(f);
    assert.match(src, /^import \{ loopFrame as requestAnimationFrame \} from '\.\/frameLoop\.js';/m, `${f} arms its frame through frameLoop.js`);
    const arms = callsOf(src, 'requestAnimationFrame');
    assert.ok(arms.length >= 3, `${f}: its arms are found`);
    assert.deepEqual([...new Set(arms)], ['requestAnimationFrame(frame)'], `${f}: every arm is the loop's own`);
  }
});

test('AUDIT LOOP-ALIVE A5: a world frame begins on the draw-state baseline, before its clear - whatever a pass that threw left; a bracket\'s frame keeps its caller\'s (mutants: a state left out; the baseline after the clear; on every frame)', () => {
  const st = { depthMask: false, BLEND: true, POLYGON_OFFSET_FILL: true, depthFunc: 'LEQUAL', DEPTH_TEST: false, CULL_FACE: false, colorMask: 'false,false,false,false' };
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z_]+$/.test(k) ? k : (...a) => {
    if (k === 'enable') st[a[0]] = true; else if (k === 'disable') st[a[0]] = false;
    else if (k === 'depthMask') st.depthMask = a[0]; else if (k === 'depthFunc') st.depthFunc = a[0]; else if (k === 'colorMask') st.colorMask = a.join();
  }) });
  const left = { ...st };
  Renderer.prototype._drawBaseline.call({ gl, _panelSaved: null }, { world: false });
  Renderer.prototype._drawBaseline.call({ gl, _panelSaved: {} }, { world: true });
  assert.deepEqual(st, left, 'a bracket\'s frame keeps the state its caller set (a panel\'s depth-only clear)');
  Renderer.prototype._drawBaseline.call({ gl, _panelSaved: null }, { world: true });
  assert.deepEqual(st, { depthMask: true, BLEND: false, POLYGON_OFFSET_FILL: false, depthFunc: 'LESS', DEPTH_TEST: true, CULL_FACE: true, colorMask: 'true,true,true,true' });
  const src = rd('src/render/renderer.js');
  const body = src.slice(src.indexOf('  beginFrame(proj, view, lightDir, opts = null) {'));
  const at = body.indexOf('this._drawBaseline(opts);');
  assert.ok(at > 0 && at < body.indexOf('gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);'), 'set before the frame\'s clear');
});

// ─── THE GATHERING HOST ─────────────────────────────────────────────────────────────────────────────────────────────

const PX = 1395, PY = 1442;   // a Valenwood pixel past the Bay (theatre 6)
const RAINFOREST = 227, VALENWOOD = 67;
const NOON = 20500 * 86_400 + 43_200;
/** A host over one wooded pixel past the Bay with the Wood-Axe in the pack. `broken` makes a door throw: `view` (the act's
 *  own frame), `input` (the tick's head), `meter` (a playing act's meter, after its step), `say` (the ear's beats).
 *  `acts` keeps every act the tree kind started; `meters` every meter the HUD was given. */
async function rig({ before = [], after = [], climate = RAINFOREST, region = VALENWOOD, state = 'none', rank = 0 } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const law = trees({ x: PX, y: PY, day, climate, region, confirmed: state === 'confirmed' });
  const forest = { trees: law.map((t, i) => ({ id: i, group: 'g', i, x: t.u * TERRAIN_SIZE, y: 0, z: t.v * TERRAIN_SIZE, wood: 1 })), groups: new Map(), base: 504, archive: 504 };
  const entry = { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(2), batches: [], rocks: [], forest };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'logging', xp: 0, rank, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state, climate, region })), dungeons: [] } }),
    harvest: async (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'log:pine', qty: 3, xp: 15, track: { profession: 'logging', xp: 15, rank }, today: 1 } }),
  };
  const m = new Map();
  const book = createProfBook({ door, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }, character: () => 'c1', now: () => NOON * 1000, sleep: () => Promise.resolve() });
  const said = [], meters = [], acts = [], broken = {};
  const hud = { setPrompt: () => {}, setMeter: (a) => { meters.push(a); if (broken.meter && a) throw new Error('the meter threw'); }, toast: (t) => said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const ear = { frame: () => {}, say: () => { if (broken.say) throw new Error('the ear threw'); }, stop: () => {}, hush: () => {}, rebase: () => {} };
  const built = new Map([[`${PX},${PY}`, entry]]);
  const entity = { items: [{ templateIndex: FT.WoodAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 };
  const input = { held: false, attack: false, choice: false };
  const rad = (d) => (d * Math.PI) / 180;
  const tree = treeKind({ book });
  const kind = { ...tree, start: (...a) => { const s = tree.start(...a); if (s?.act) acts.push(s); return s; } };
  const host = createGatherHost({
    book, hud, ear, kinds: [...before, kind, ...after],
    renderer: { createBillboardBatch: () => ({ tip: [0, 0, 0] }), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate, region }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(rad(view.yaw)) * Math.cos(rad(view.pitch)), Math.sin(rad(view.pitch)), Math.cos(rad(view.yaw)) * Math.cos(rad(view.pitch))] }),
    view: () => { if (broken.view) throw new Error('the view threw'); return view; },
    feet: () => feet, entity: () => entity, keyLabel: () => 'E', active: () => true,
    input: () => { if (broken.input) throw new Error('the input threw'); return input; },
  });
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate, region, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  const standing = () => host.nodesOf(PX, PY).filter((n) => n.what === 'tree');
  /** Stand 1.5 m before the tree, looking at it. */
  const face = (t) => {
    const [x, y, z] = t.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x, y + (t.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
  };
  /** The hosts' own call: world.js's `try { gatherHost?.tick(dt); } catch`. */
  const tick = (dt = 0.016) => { try { host.tick(dt); return null; } catch (e) { return e; } };
  /** E at a tree: the chop started, its act returned. */
  const start = (t) => { face(t); tick(); assert.equal(host.press(), true, 'E at the tree starts the chop'); return acts.at(-1); };
  /** Chopped to its end, a strike each swing. */
  const chop = () => { for (let i = 0; i < 12 && host.acting(); i++) { input.attack = true; tick(CHOP_ACT.swingS + 0.01); input.attack = false; tick(0.01); } };
  return { host, said, meters, acts, broken, input, tick, standing, start, chop };
}
/** The test with the console's warnings kept, not printed. */
const quiet = async (fn) => {
  const warn = console.warn, warned = [];
  console.warn = (...a) => warned.push(a.map((x) => String(x?.message ?? x)).join(' '));
  try { await fn(warned); } finally { console.warn = warn; setForagingHost(null); }
};

test('LOOP-ALIVE: an act whose own frame throws tick after tick ends - its machine ended, its meter down, its blows let go, said, and E is the world\'s again (mutants: the faulted act kept; no meter; no cancel; no letting go; no line)', () => quiet(async () => {
  const t = await rig();
  const a = t.start(t.standing()[0]);
  for (let i = 0; i < 5; i++) assert.equal(t.tick(), null, 'its frames run');
  assert.equal(t.host.acting(), true, 'a playing act is left alone');
  t.input.attack = true; t.tick(0.01); t.input.attack = false;   // a blow in the air: its pose and its hand
  assert.ok(t.host.poseAct().ga > 0 && t.host.handTool(), 'the premise: an act the others see');
  t.broken.view = true;
  for (let i = 0; i < ACT_FAULTS_MAX; i++) assert.match(String(t.tick()?.message), /the view threw/, 'the premise: the act\'s frame throws into the host\'s catch');
  t.meters.length = 0;
  t.tick();
  assert.equal(t.host.acting(), false, 'the act ended');
  assert.equal(a.act.state.cancelled, true, 'its machine ended (AUDIT FB1005 W2)');
  assert.deepEqual(t.meters, [null], 'the meter down');
  assert.equal(t.host.poseAct().ga, undefined, 'the others see no act');
  assert.equal(gatherBeatOf(t.host.poseAct().gb), 'stop', 'and its blow taken back (PEER-ACTS)');
  assert.equal(t.host.handTool(), null, 'the tool put away with its blow');
  assert.equal(t.said.at(-1), ACT_STOPPED_LINE);
  assert.equal(t.host.press(), true, 'E starts an act again - it was the act\'s for ever');
  t.broken.view = false;
  t.chop();
  assert.equal(t.host.acting(), false, 'chopped to its end');
  assert.equal(t.said.filter((l) => l === ACT_STOPPED_LINE).length, 1, 'and never stopped early');
}));

test('LOOP-ALIVE: a throw at the tick\'s head or after the act\'s step, tick after tick, ends the act too; one that passes is stepped over, as before (mutants: the mark set at the act\'s branch; cleared after the step; dropped at the first fault)', () => quiet(async () => {
  for (const where of ['input', 'meter']) {
    const t = await rig();
    t.start(t.standing()[0]);
    t.broken[where] = true;
    for (let i = 0; i < ACT_FAULTS_MAX + 1; i++) t.tick();
    t.broken[where] = false;
    t.tick();
    assert.equal(t.host.acting(), false, `${where}: the act ended`);
    assert.equal(t.said.at(-1), ACT_STOPPED_LINE, where);
  }
  const t = await rig();
  t.start(t.standing()[0]);
  t.broken.view = true;
  assert.ok(t.tick(), 'the premise: one throw');
  t.broken.view = false;
  t.chop();
  assert.deepEqual([t.host.acting(), t.said.includes(ACT_STOPPED_LINE)], [false, false], 'one passing throw: the chop runs to its end');
}));

test('LOOP-ALIVE: the slot is empty before the faulted act is told - its machine\'s end reads no act playing (mutant: the slot emptied after the cancel)', () => quiet(async () => {
  const t = await rig();
  const a = t.start(t.standing()[0]);
  let seen = null;
  const cancel = a.act.cancel.bind(a.act);
  a.act.cancel = () => { seen = t.host.acting(); cancel(); };
  t.broken.view = true;
  for (let i = 0; i <= ACT_FAULTS_MAX; i++) t.tick();
  assert.equal(seen, false);
}));

test('LOOP-ALIVE: a kind\'s frame that throws is that kind\'s - the kinds after it still run, the chop under way plays on, and the fault is said once (mutants: one try round every kind; a kind\'s fault thrown on; said every frame)', () => quiet(async (warned) => {
  const sour = { id: 'sour', professions: Object.freeze([]), nodesOf: () => [], flatsOf: () => [], gone: () => false, plan: () => null, start: () => null, frame() { throw new Error('a kind threw'); } };
  let ran = 0;
  const spy = { ...sour, id: 'spy', frame() { ran++; } };
  const t = await rig({ before: [sour], after: [spy] });
  t.start(t.standing()[0]);
  const ticks = ran;
  t.chop();
  assert.ok(ran > ticks, 'the kinds after it ran');
  assert.deepEqual([t.host.acting(), t.said.includes(ACT_STOPPED_LINE)], [false, false], 'chopped to its end, never stopped early');
  assert.equal(warned.filter((w) => w.includes('a kind threw')).length, 1, 'said once, not each frame (AUDIT B3)');
}));

test('AUDIT LOOP-ALIVE B1: a finished act\'s last swing that throws as it lands is its own fault - the act now playing strikes on that tick (mutant: the swings unguarded)', () => quiet(async () => {
  const t = await rig();
  const [one, two] = t.standing();
  t.start(one);
  for (let i = 0; i < 12 && t.host.acting(); i++) { t.input.attack = true; t.tick(0.01); t.input.attack = false; if (t.host.acting()) t.tick(CHOP_ACT.swingS - 0.02); }
  assert.equal(t.host.acting(), false, 'the first tree\'s last chop struck, its blow still in the air');
  const b = t.start(two);
  t.broken.say = true;   // the first tree's fall is heard as its blow lands - and the ear throws
  const chops = b.act.state.chops;
  t.input.attack = true;
  t.tick(0.3);
  t.input.attack = false;
  t.broken.say = false;
  assert.equal(b.act.state.chops, chops + 1, 'the new act struck on the tick the old blow landed');
}));

test('LOOP-ALIVE (AUDIT C8): past the Bay, every province region on every climate that stands a tree, on ground unconfirmed and confirmed, a chop at Logging 100 runs to its end with nothing thrown and the next press is the world\'s', () => quiet(async () => {
  let ran = 0;
  for (let region = 62; region <= 70; region++) {
    for (let climate = 226; climate <= 232; climate++) {
      for (const state of ['none', 'confirmed']) {
        const t = await rig({ climate, region, state, rank: 100 });
        const tree = t.standing()[0];
        if (!tree) continue;
        t.start(tree);
        t.chop();
        const what = `region ${region}, climate ${climate}, ${state}`;
        assert.equal(t.host.acting(), false, what);
        assert.ok(!t.said.includes(ACT_STOPPED_LINE), what);
        for (let i = 0; i < 20; i++) assert.equal(t.tick(0.1), null, what);
        assert.equal(t.host.press(), false, `${what}: E at a felled tree is not the act's`);
        ran++;
      }
    }
  }
  assert.ok(ran >= 100, `${ran} chops`);
}));
