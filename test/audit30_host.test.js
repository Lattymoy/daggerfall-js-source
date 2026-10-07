// AUDIT 30 (2026-09-29, Mac: "Do it") - LOGGING IN THE STREAMING WORLD, AS THE AUDIT FOUND IT (scenes/treeHost.js,
// scenes/gatherHost.js, render/renderer.js): a Lumberjack's prompt its own chops; a felled tree's flat risen with the
// day under a shut switch; a logs pile never laid for a pixel gone; a fall whose pixel was stood again under the ask the
// node as it stands now, its failure its own; a static wood moved gridded where it is, its shadow told. A real gather
// host with Logging's kind over a real book and a fake door (the harness the audit's probes stood on). Each pin failed
// on the code before its fix. bible/06-Systems/Online-Arc.md AUDIT 30.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfBook } from '../src/net/profBook.js';
import { trees, nodeKey, utcDayOfMs } from '../src/net/nodeLaw.js';
import { xpForRank, CHOP_ACT, chopsFor } from '../src/net/professionLaw.js';
import { treeKind, FALL_S, LOGS_RECORD, STUMP_RECORD } from '../src/scenes/treeHost.js';
import { createGatherHost, aimAt } from '../src/scenes/gatherHost.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { Renderer } from '../src/render/renderer.js';
import { ShadowPass } from '../src/render/shadowPass.js';

const WOODS = 231, GLENUMBRA = 59;
const DAYS = 86_400;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function noonAfter(fromS) {
  for (let s = fromS; s < fromS + 4 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
}
const tick = () => new Promise((r) => setImmediate(r));
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

function forestOf(px, py, day, climate) {
  const law = trees({ x: px, y: py, day, climate });
  const flats = law.map((t, i) => ({ id: i, group: '504_12', i, x: t.u * TERRAIN_SIZE + 1, y: 0, z: t.v * TERRAIN_SIZE }));
  const batch12 = { archive: 504, record: 12, size: { w: 4, h: 8 } };
  const groups = new Map([['504_12', { batch: batch12, centers: flats.map((f) => [f.x, f.y, f.z]), size: batch12.size }]]);
  return { law, forest: { base: 504, archive: 504, trees: flats, groups } };
}

/** A standing world: one pixel, a real book over a fake door, the real host with Logging's kind. */
async function stand({ nowS, specs = { 50: null, 100: null }, slowTexture = false, rank = 10 } = {}) {
  setForagingHost({ world: () => ({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' }) });
  const clock = { s: nowS };
  const day = () => utcDayOfMs(clock.s * 1000);
  const { forest } = forestOf(400, 150, day(), WOODS);
  const entry = { px: 400, py: 150, samples: new Float32Array(4), tilemap: new Uint8Array(4), locationRect: null, batches: [], forest };
  let taken = [];
  const door = {
    account: () => 'acct-1',
    state: async () => (door.shut ? { ok: false, error: 'prof-closed' } : { ok: true, data: { day: day(), character: 'c1', tracks: [{ profession: 'logging', xp: xpForRank(rank), rank, specs }], today: {}, taken, stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => { taken = [`${b.node}|logs`]; return { ok: true, data: { node: b.node, kind: b.kind, material: 'log:oak', qty: 3, xp: 30, track: { profession: 'logging', xp: xpForRank(rank) + 30, rank }, today: 1 } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.s * 1000, sleep: () => Promise.resolve() });
  const said = [];
  const hud = { setPrompt: (p) => { said.prompt = p; }, setMeter: (m) => { said.meter = m; }, toast: (x) => said.push(x), banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {} };
  const made = [], destroyed = new Set(), moved = [];
  const renderer = {
    createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers }; made.push(b); return b; },
    destroyBatch: (b) => destroyed.add(b), moveBillboardBatch: (b, c) => { moved.push([b, c.map((x) => x.slice())]); return true; },
  };
  const texGate = { release: null };
  const getTexture = slowTexture
    ? () => new Promise((r) => { texGate.release = () => r({ recordCount: 99 }); })
    : async () => ({ recordCount: 99 });
  const deps = { renderer, getTexture, uploadRecord: () => {}, billboardSize: () => ({ w: 1, h: 0.4 }), flatBatchAabb: () => [0, 0, 0, 1, 1, 1] };
  const axe = { templateIndex: FT.WoodAxe, currentCondition: 50, maxCondition: 50 };
  const entity = { items: [axe], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  const input = { v: { held: false, attack: false, choice: false } };
  const built = new Map([['400,150', entry]]);
  // stand's own getTexture for the stump must not hang on the gate: the kind's is the slow one
  const hostDeps = { ...deps, getTexture: async () => ({ recordCount: 99 }) };
  const host = createGatherHost({
    book, hud, kinds: [treeKind({ book, ...deps })], ...hostDeps,
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.s * 1000,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input.v, active: () => true,
  });
  await book.refresh();
  host.onBuilt(entry);
  await tick(); await tick();
  /** Aim at a node and fell it with a clean ring. */
  async function fell(n) {
    const [x, y, z] = n.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([x, y + 1.6, z - 1.5], [x, y + n.lift, z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    host.tick(0.016);
    if (!host.press()) throw new Error('press refused: ' + JSON.stringify(said.prompt));
    for (let i = 0; i < 10 && host.acting(); i++) {
      input.v = { held: false, attack: false, choice: false };
      host.tick(CHOP_ACT.ringS);
      input.v = { held: false, attack: true, choice: false };
      host.tick(0.001);
    }
    input.v = { held: false, attack: false, choice: false };
    await tick(); await tick(); await tick();
  }
  return { host, book, door, entry, forest, made, destroyed, moved, said, clock, day, fell, feet, view, built, texGate, input };
}

const T0 = 1_800_000_000;
const NOON = noonAfter(Math.floor(T0 / DAYS) * DAYS + 3600);
const aim = (w, n) => {
  const [x, y, z] = n.local;
  w.feet[0] = x; w.feet[1] = y; w.feet[2] = z - 1.5;
  const at = aimAt([x, y + 1.6, z - 1.5], [x, y + n.lift, z], { yaw: 0, pitch: 0 });
  w.view.yaw = -at.yaw; w.view.pitch = -at.pitch;
  w.host.tick(0.016);
};

test('AUDIT 30 A8: a Lumberjack\'s prompt says the chops the act will ask - two fewer', async () => {
  const w = await stand({ nowS: NOON, specs: { 50: 'lumberjack', 100: null }, rank: 50 });
  const n = w.host.nodesOf(400, 150)[0];
  aim(w, n);
  assert.match(w.said.prompt?.rest ?? '', new RegExp(`- ${chopsFor(n.tier, true)} chops$`), `the unreduced ${chopsFor(n.tier)}`);
  w.host.dispose();
});

test('AUDIT 30 A7: the day turns under a shut switch - the felled tree\'s flat rises with it, as the wood every other player sees', async () => {
  const w = await stand({ nowS: NOON });
  const n = w.host.nodesOf(400, 150)[0];
  await w.fell(n);
  const g = w.forest.groups.get(n.flat.group);
  const last = () => w.moved.filter(([b]) => b === g.batch).at(-1)?.[1]?.[n.flat.i]?.[1];
  assert.ok(last() < 0, 'felled: sunk');
  w.door.shut = true;
  await w.book.refresh({ force: true });
  assert.equal(w.book.state.open, false);
  w.clock.s += DAYS;
  for (let i = 0; i < 4; i++) { w.host.tick(0.016); await tick(); }
  assert.equal(last(), g.centers[n.flat.i][1], 'yesterday\'s tree still sunk until the switch opened again');
  w.host.dispose();
});

test('AUDIT 30 A11: a pixel torn down while its fall waits for the Logs picture lays no pile - a batch nobody would free', async () => {
  const w = await stand({ nowS: NOON, slowTexture: true });
  const n = w.host.nodesOf(400, 150)[0];
  await w.fell(n);
  w.host.onDestroyed(w.entry);
  for (const b of w.entry.batches) w.destroyed.add(b);
  w.built.delete('400,150');
  w.texGate.release();
  await tick(); await tick();
  assert.equal(w.made.some((b) => b.record === LOGS_RECORD), false);
  w.host.dispose();
});

test('AUDIT 30 A5: an answer landing on a pixel stood again under the ask falls the node as it stands now - a flat its wood no longer has throws nothing, and the pixel stands again', async () => {
  const w = await stand({ nowS: NOON });
  const nodes = w.host.nodesOf(400, 150);
  const n = nodes.reduce((a, b) => (b.flat.i > a.flat.i ? b : a));
  const fresh = forestOf(400, 150, w.day(), WOODS).forest;
  const g2 = fresh.groups.get(n.flat.group);
  g2.centers = g2.centers.slice(0, n.flat.i);
  fresh.trees = fresh.trees.slice(0, n.flat.i);
  const entry2 = { ...w.entry, batches: [], forest: fresh };
  let unhandled = null;
  const onRej = (e) => { unhandled = e; };
  process.on('unhandledRejection', onRej);
  aim(w, n);
  assert.ok(w.host.press());
  for (let i = 0; i < 10 && w.host.acting(); i++) {
    w.input.v = { held: false, attack: false, choice: false };
    w.host.tick(CHOP_ACT.ringS);
    w.input.v = { held: false, attack: true, choice: false };
    const before = w.host.acting();
    w.host.tick(0.001);
    if (before && !w.host.acting()) { w.host.onDestroyed(w.entry); w.built.set('400,150', entry2); w.host.onBuilt(entry2); }
  }
  for (let i = 0; i < 8; i++) await tick();
  process.off('unhandledRejection', onRej);
  assert.equal(w.book.taken(n.key, 'logs'), true);
  assert.equal(unhandled, null, `the act-start node's flat read in the new wood: ${unhandled}`);
  assert.equal(w.made.filter((b) => b.tip).length, 0, 'no fall of a flat the new wood does not have');
  w.host.dispose();
});

test('AUDIT 30 A6: a static batch moved (a wood with a tree sunk) is gridded where it is now, and its shadow is told it moved; a dynamic one (a gib\'s) keeps none', () => {
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, nm) => nm;
    if (['createShader', 'createProgram', 'createBuffer', 'createVertexArray', 'createTexture', 'createFramebuffer', 'createRenderbuffer'].includes(k)) return () => ({ id: Math.random() });
    if (k === 'getParameter') return () => new Float32Array(4);
    if (typeof k === 'string' && k.toUpperCase() === k) return 1;
    return () => {};
  } });
  const r = new Renderer({ getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 });
  const centers = [];
  for (let i = 0; i < 30; i++) { centers.push([i * 27, 0, 0]); centers.push([0, 0, i * 27]); }
  const wood = r.createBillboardBatch(504, 12, { w: 4, h: 8 }, centers);
  wood.origin = [0, 0, 0];
  const sp = new ShadowPass(gl, { build: () => ({ id: 1 }), vs: { mesh: '', bb: '', terrain: '', char: '' } });
  const lantern = new Float32Array([400, 3, 400, 30]);
  const sig = () => {
    sp.discard();
    sp.recordBillboards([wood], new Float32Array([0, 0, 0, 0]), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]));
    const out = new Float64Array(2);
    sp._staticSignatures(lantern, 1, out, true);
    return [out[0], out[1]];
  };
  const built = sig();
  assert.equal(built[1], 0, 'the wood\'s grid keeps it out of a lantern\'s cube in the pixel\'s middle');
  const near = new Float32Array([27 * 7, 3, 0, 30]);
  const signed = () => { sp.discard(); sp.recordBillboards([wood], new Float32Array([0, 0, 0, 0]), new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0])); const o = new Float64Array(2); sp._staticSignatures(near, 1, o, true); return [o[0], o[1]]; };
  const before = signed();
  r.moveBillboardBatch(wood, centers.map((c, i) => (i === 14 ? [c[0], c[1] - 9, c[2]] : c)));
  assert.ok(wood._place, 'one tree sunk dropped the grid for good');
  assert.equal(sig()[1], 0, 'judged by its pixel-wide sphere, near every lantern of its pixel');
  assert.notDeepEqual(signed(), before, 'the lantern\'s cached shadow kept the fallen tree\'s');
  const gib = r.createBillboardBatch(504, 2, { w: 0.8, h: 1.2 }, centers.slice(0, 5), { dynamic: true });
  r.moveBillboardBatch(gib, centers.slice(5, 10));
  assert.equal(gib._place, null);
});

test('AUDIT 30 A5: the fall is the node\'s as its pixel stands NOW - a wood re-laid in another order under the ask falls the tree that was chopped, not the flat at the act\'s old index', async () => {
  const w = await stand({ nowS: NOON });
  const nodes = w.host.nodesOf(400, 150);
  const n = nodes.reduce((a, b) => (b.flat.i < a.flat.i ? b : a));   // the lowest index: the farthest from itself reversed
  const rev = forestOf(400, 150, w.day(), WOODS).forest;
  const g = rev.groups.get(n.flat.group);
  g.centers = [...g.centers].reverse();
  rev.trees = rev.trees.slice().reverse().map((t, i) => ({ ...t, id: i, i }));
  const entry2 = { ...w.entry, batches: [], forest: rev };
  aim(w, n);
  assert.ok(w.host.press());
  for (let i = 0; i < 10 && w.host.acting(); i++) {
    w.input.v = { held: false, attack: false, choice: false };
    w.host.tick(CHOP_ACT.ringS);
    w.input.v = { held: false, attack: true, choice: false };
    const before = w.host.acting();
    w.host.tick(0.001);
    if (before && !w.host.acting()) { w.host.onDestroyed(w.entry); w.built.set('400,150', entry2); w.host.onBuilt(entry2); }
  }
  for (let i = 0; i < 8; i++) await tick();
  const falls = w.made.filter((b) => b.tip);
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].centers[0], n.local, 'another tree fell - the flat at the chopped node\'s old index');
  w.host.dispose();
});
