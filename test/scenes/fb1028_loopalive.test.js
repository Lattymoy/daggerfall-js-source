// LOOP-ALIVE (FIELD BUGS 2026-10-28, the owner: "chopping trees and general interaction outside the bay can lock up your
// character"). Two ways one throw locked a character for the rest of the session. A host's frame re-arms at its foot,
// so a throw anywhere in a frame ended the loop. And the gathering host's tick runs inside the hosts' catch, so an act
// whose frame threw was never stepped or walked off again: every press, click and swing stayed the act's.
// tools/mutants/fb1028_loopalive.json.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loopFrame, runFrame, _resetFrameLoopForTests } from '../../src/scenes/frameLoop.js';
import { trees, utcDayOfMs } from '../../src/net/nodeLaw.js';
import { createProfBook } from '../../src/net/profBook.js';
import { CHOP_ACT } from '../../src/net/professionLaw.js';
import { treeKind } from '../../src/scenes/treeHost.js';
import { createGatherHost, aimAt, ACT_STOPPED_LINE } from '../../src/scenes/gatherHost.js';
import { setForagingHost } from '../../src/systems/foraging/foragingInstall.js';
import { FT } from '../../src/systems/foraging/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../../src/world/terrain/terrainSampler.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** The page's frame queue, run by hand, and the faults it was told of (main.js's `error` listener reads reportError's). */
function page() {
  const queue = [], told = [];
  const was = { raf: globalThis.requestAnimationFrame, report: globalThis.reportError, error: console.error };
  globalThis.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  globalThis.reportError = (e) => told.push(e.message);
  console.error = () => {};
  _resetFrameLoopForTests();
  return {
    queue, told,
    /** The frames armed now, each run once (a throw out of one is the page's). */
    step() { const now = queue.splice(0); for (const cb of now) cb(16); return now.length; },
    restore() { globalThis.requestAnimationFrame = was.raf; globalThis.reportError = was.report; console.error = was.error; },
  };
}

test('LOOP-ALIVE: a frame loop that throws before its foot is armed again and its fault said once; a loop that re-armed before it threw is not armed twice (mutants: the catch never re-arms; armed whether or not the frame did; said every frame)', () => {
  const p = page();
  try {
    let n = 0, broken = true;
    function frame() {
      n++;
      if (broken && n >= 2) throw new Error('a frame threw');   // the throw comes before the foot
      loopFrame(frame);
    }
    loopFrame(frame);
    assert.equal(p.step(), 1);
    for (let i = 0; i < 3; i++) assert.equal(p.step(), 1, 'one frame armed after each, the throwing ones too');
    assert.equal(n, 4);
    assert.deepEqual(p.told, ['a frame threw'], 'said once, not each frame');
    broken = false;
    p.step();
    assert.equal(p.queue.length, 1, 'mended, it arms itself as before');
    // a frame that arms at its head and throws after: one frame armed, never two
    let m = 0;
    function early() { m++; loopFrame(early); if (m >= 2) throw new Error('after the arm'); }
    p.queue.length = 0;
    loopFrame(early);
    p.step(); p.step(); p.step();
    assert.equal(p.queue.length, 1, 'armed once a frame');
    assert.deepEqual(p.told, ['a frame threw', 'after the arm']);
  } finally { p.restore(); }
});

test('LOOP-ALIVE: a callback never seen arming itself throws as it always did - a one-off, or a loop\'s first frame (mutant: every callback\'s throw kept)', () => {
  const p = page();
  try {
    loopFrame(() => { throw new Error('one-off'); });
    assert.throws(() => p.step(), /one-off/);
    assert.equal(p.queue.length, 0, 'nothing armed again');
    assert.throws(() => runFrame(() => { throw new Error('first'); }, 0), /first/);
    assert.deepEqual(p.told, []);
  } finally { p.restore(); }
});

test('LOOP-ALIVE: the three frame hosts arm their loop through the guard (mutant: a host back on the bare requestAnimationFrame)', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js']) {
    assert.match(rd(f), /^import \{ loopFrame as requestAnimationFrame \} from '\.\/frameLoop\.js';/m, `${f} arms its frame through frameLoop.js`);
  }
});

// ─── THE GATHERING HOST ─────────────────────────────────────────────────────────────────────────────────────────────

const PX = 1395, PY = 1442, WOODS = 231, SKYRIM = 64;   // a wood past the Bay, as the report's
const NOON = 20500 * 86_400 + 43_200;
/** A host over one wooded pixel past the Bay with the Wood-Axe in the pack; `view` throws while `broken.on`. */
async function rig({ kinds = [] } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const law = trees({ x: PX, y: PY, day, climate: WOODS, region: SKYRIM, confirmed: false });
  const forest = { trees: law.map((t, i) => ({ id: i, group: 'g', i, x: t.u * TERRAIN_SIZE, y: 0, z: t.v * TERRAIN_SIZE, wood: 1 })), groups: new Map(), base: 504, archive: 504 };
  const entry = { px: PX, py: PY, samples: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25), tilemap: new Uint8Array(128 * 128).fill(2), batches: [], rocks: [], forest };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'logging', xp: 0, rank: 0, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'log:pine', qty: 3, xp: 15, track: { profession: 'logging', xp: 15, rank: 1 }, today: 1 } }),
  };
  const m = new Map();
  const book = createProfBook({ door, storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }, character: () => 'c1', now: () => NOON * 1000, sleep: () => Promise.resolve() });
  const said = [];
  const hud = { setPrompt: () => {}, setMeter: () => {}, toast: (t) => said.push(t), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const built = new Map([[`${PX},${PY}`, entry]]);
  const entity = { items: [{ templateIndex: FT.WoodAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0], view = { yaw: 0, pitch: 0 }, broken = { on: false };
  const input = { held: false, attack: false, choice: false };
  const rad = (d) => (d * Math.PI) / 180;
  const host = createGatherHost({
    book, hud, kinds: [treeKind({ book }), ...kinds],
    renderer: { createBillboardBatch: () => ({ tip: [0, 0, 0] }), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: SKYRIM }), nowMs: () => NOON * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin(rad(view.yaw)) * Math.cos(rad(view.pitch)), Math.sin(rad(view.pitch)), Math.cos(rad(view.yaw)) * Math.cos(rad(view.pitch))] }),
    view: () => { if (broken.on) throw new Error('the view threw'); return view; },
    feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => true,
  });
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: SKYRIM, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  await book.refresh();
  host.onBuilt(entry);
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  const tree = host.nodesOf(PX, PY).find((n) => n.what === 'tree');
  const [x, y, z] = tree.local;
  feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
  const at = aimAt([feet[0], feet[1] + 1.6, feet[2]], [x, y + (tree.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
  view.yaw = -at.yaw; view.pitch = -at.pitch;
  /** The hosts' own call: world.js's `try { gatherHost?.tick(dt); } catch`. */
  const tick = (dt = 0.016) => { try { host.tick(dt); return null; } catch (e) { return e; } };
  return { host, said, broken, input, tick };
}

test('LOOP-ALIVE: an act whose frame throws ends at the next tick - its meter down, said, and E is the world\'s again; an act whose frames run is never ended by it (mutants: the faulted act kept; the mark never cleared at the frame\'s end)', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const t = await rig();
    t.tick();
    assert.equal(t.host.press(), true, 'E at the tree starts the chop');
    assert.equal(t.host.acting(), true);
    for (let i = 0; i < 5; i++) assert.equal(t.tick(), null, 'its frames run');
    assert.equal(t.host.acting(), true, 'a playing act is left alone');
    t.broken.on = true;
    assert.match(String(t.tick()?.message), /the view threw/, 'the premise: the act\'s frame throws into the host\'s catch');
    t.tick();
    assert.equal(t.host.acting(), false, 'the act ended');
    assert.equal(t.said.at(-1), ACT_STOPPED_LINE);
    assert.equal(t.host.press(), true, 'E starts an act again - it was the act\'s for ever');
    t.broken.on = false;
    for (let i = 0; i < 12 && t.host.acting(); i++) { t.input.attack = true; t.tick(CHOP_ACT.swingS + 0.01); t.input.attack = false; t.tick(0.01); }
    assert.equal(t.host.acting(), false, 'chopped to its end');
    assert.equal(t.said.filter((l) => l === ACT_STOPPED_LINE).length, 1, 'and never stopped early');
  } finally { console.warn = warn; setForagingHost(null); }
});

test('LOOP-ALIVE: one kind\'s frame that throws is that kind\'s - the chop under way plays on to its end (mutant: the kinds\' frames unguarded, so the act\'s frame never ran)', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const sour = { id: 'sour', professions: Object.freeze([]), nodesOf: () => [], flatsOf: () => [], gone: () => false, plan: () => null, start: () => null, frame() { throw new Error('a kind threw'); } };
    const t = await rig({ kinds: [sour] });
    t.tick();
    assert.equal(t.host.press(), true);
    for (let i = 0; i < 12 && t.host.acting(); i++) { t.input.attack = true; assert.equal(t.tick(CHOP_ACT.swingS + 0.01), null); t.input.attack = false; t.tick(0.01); }
    assert.equal(t.host.acting(), false, 'chopped to its end');
    assert.ok(!t.said.includes(ACT_STOPPED_LINE), 'never stopped early');
  } finally { console.warn = warn; setForagingHost(null); }
});
