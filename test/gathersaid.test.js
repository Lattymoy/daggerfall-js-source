// GATHER-SAID (the PROF7 merge, 2026-09-30; Mac: "Also not sure if XP works when you gather nodes, also had reports of
// people not getting materials when using a profession"). Driven end to end - the gathering host over the real book
// over a real Worker - a harvest credits its goods to the Stores and its XP to the track, every profession. What the
// players met was what the HUD SAID of it:
//   1. an answer said one line a good (the ore, a gem, a tree's Resin, a body's part and butchery), its XP, a rank's rise
//      and a specialisation's hint - five and six lines into the four the toasts hold (PROF0 8), so the goods' line, the
//      oldest, went first: a harvest that looked as if it gave nothing. The goods are one line now, kept past the rest;
//   2. the goods are in the Stores, never the pack - the session's first harvest says where;
//   3. "slow to answer" was said once a session (a flag never reset), so the second kept act said nothing; a signed-out
//      account's acts were kept in silence and lapsed; the lapse said "with the day" of a ten-minute lapse;
//   4. an act that ended before its end (let go, walked off, a window over it, the dungeon left) only lost its meter;
//   5. the service's maintenance minute (RESTORE's 503, answered before any route) let the act go instead of keeping it.
// bible/06-Systems/Online-Arc.md, THE PROF7 MERGE.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createProfBook } from '../src/net/profBook.js';
import { veins, utcDayOfMs } from '../src/net/nodeLaw.js';
import { MINE_ACT, xpForRank } from '../src/net/professionLaw.js';
import { mineKind } from '../src/scenes/mineHost.js';
import { herbKind } from '../src/scenes/herbHost.js';
import {
  createGatherHost, aimAt, storesLine, storesWhereLine, ACT_STOPPED_LINE, KEPT_LINE, KEPT_SIGNED_OUT_LINE, LAPSED_LINE,
} from '../src/scenes/gatherHost.js';
import { createToastQueue, PROF_TOASTS_MAX } from '../src/ui/profHud.js';
import { setForagingHost } from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { HEIGHTMAP_DIMENSION, TERRAIN_SIZE } from '../src/world/terrainSampler.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { accountRefusalText } from '../src/net/accountClient.js';

const noWait = () => Promise.resolve();
const tick = () => new Promise((r) => setImmediate(r));
const DAY = 86_400;
const WOODS = 231, GLENUMBRA = 59;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
/** A shared-clock noon on day 20500 - daylight, so Foraging's checks let the Pick-Axe work. */
const NOON = (() => {
  const d0 = 20500 * DAY;
  for (let s = d0 + 3600; s < d0 + 3 * 7200; s += 30) if (hourAt(s) === 12 && hourAt(s - 60) === 12 && hourAt(s + 60) === 12) return s;
  throw new Error('no noon');
})();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const OUTSIDE = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: WOODS, region: GLENUMBRA, enemiesNear: false, carriedWeight: 0 });

/** The gathering host over one flat pixel with its veins on rock, its book a real one over a scripted door, its HUD's
 *  toasts the real queue (`lines` what a player would read). `answer(body, n)` is the door's n-th harvest answer. */
function rig({ answer, rank = 49 } = {}) {
  const day = utcDayOfMs(NOON * 1000);
  const samples = new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.25);
  const law = veins({ x: 400, y: 150, day, climate: WOODS, region: GLENUMBRA });
  const rocks = law.map((v) => [v.u * TERRAIN_SIZE - 2, 0, v.v * TERRAIN_SIZE + 4, v.u * TERRAIN_SIZE + 2, 6, v.v * TERRAIN_SIZE + 8]);
  const entry = { px: 400, py: 150, samples, tilemap: new Uint8Array(128 * 128).fill(2), locationRect: null, batches: [], rocks };
  const asked = [];
  const clock = { ms: NOON * 1000 };
  const door = {
    account: () => 'acct-1',
    state: async () => ({ ok: true, data: { day, character: 'c1', tracks: [{ profession: 'mining', xp: xpForRank(rank), rank, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000 } } }),
    pixels: async (c, px) => ({ ok: true, data: { pixels: px.map(([x, y]) => ({ x, y, state: 'none' })), dungeons: [] } }),
    harvest: async (b) => { asked.push(b); return answer(b, asked.length); },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: noWait });
  const queue = createToastQueue();
  const said = [];
  const hud = {
    setPrompt: () => {}, setMeter: () => {}, banner: () => {}, setChip: () => {}, frame: () => {}, dispose: () => {},
    toast: (t, o) => { said.push(t); queue.push(t, o); },
  };
  const built = new Map([['400,150', entry]]);
  const entity = { items: [{ templateIndex: FT.PickAxe, currentCondition: 50, maxCondition: 50 }], stats: {} };
  const feet = [0, 0, 0];
  const view = { yaw: 0, pitch: 0 };
  let input = { held: false, attack: false, choice: false };
  const world = { active: true };
  const host = createGatherHost({
    book, hud, kinds: [herbKind({ book }), mineKind({ book })],
    renderer: { createBillboardBatch: () => ({}), destroyBatch: () => {} }, getTexture: async () => ({ recordCount: 999 }), uploadRecord: () => {},
    billboardSize: () => ({ w: 0.3, h: 0.3 }), flatBatchAabb: () => [0, 0, 0, 0, 0, 0],
    built: () => built, pixelTranslation: (x, y, out) => { out[0] = 0; out[1] = 0; out[2] = 0; return out; },
    pixelInfo: () => ({ climate: WOODS, region: GLENUMBRA }), nowMs: () => clock.ms,
    eye: () => ({ pos: [feet[0], feet[1] + 1.6, feet[2]], dir: [Math.sin((view.yaw * Math.PI) / 180), Math.sin((view.pitch * Math.PI) / 180), Math.cos((view.yaw * Math.PI) / 180)] }),
    view: () => view, feet: () => feet, entity: () => entity, keyLabel: () => 'E', input: () => input, active: () => world.active,
  });
  const setInput = (i) => { input = { held: false, attack: false, choice: false, ...i }; };
  /** Stand 1.5 m south of a node, looking at it; the host finds it. */
  const face = (node) => {
    const [x, y, z] = node.local;
    feet[0] = x; feet[1] = y; feet[2] = z - 1.5;
    const at = aimAt([x, y + 1.6, z - 1.5], [x, y + (node.lift ?? 0.3), z], { yaw: 0, pitch: 0 });
    view.yaw = -at.yaw; view.pitch = -at.pitch;
    host.tick(0.016);
  };
  /** The i-th vein struck through to its end, and its answer heard. */
  const mine = async (i) => {
    const vs = host.nodesOf(400, 150).filter((n) => n.kind === 'mine' && n.what === 'vein');
    face(vs[i]);
    assert.equal(host.target?.node.key, vs[i].key, `vein ${i} targeted`);
    assert.equal(host.press(), true, `vein ${i}: E starts the act`);
    for (let k = 0; k < 12 && host.acting(); k++) {
      setInput({ attack: true });
      host.tick(MINE_ACT.swingS + 0.01);
      setInput({});
      host.tick(0.01);
    }
    assert.equal(host.acting(), false, `vein ${i}: the strikes ended the act`);
    for (let k = 0; k < 4; k++) await tick();
  };
  const stand = async () => {
    await book.refresh();
    host.onBuilt(entry);
    await tick(); await tick();
    assert.ok(host.nodesOf(400, 150).filter((n) => n.kind === 'mine' && n.what === 'vein').length >= 2, 'two veins to work');
  };
  return { host, book, said, queue, asked, clock, world, setInput, face, mine, stand };
}
const ironWithAmber = (b) => ({ ok: true, data: { node: b.node, kind: b.kind, material: 'metal:iron', qty: 3, xp: 33, track: { profession: 'mining', xp: xpForRank(50), rank: 50 }, today: 1, gem: 'gem:amber', gemStore: { material: 'gem:amber', own: 1, bought: 0 }, store: { material: 'metal:iron', own: 3, bought: 0 } } });
const outside = (fn) => async () => { setForagingHost({ world: () => OUTSIDE }); try { await fn(); } finally { setForagingHost(null); } };

// ─── THE LAWS ────────────────────────────────────────────────────────

test('GATHER-SAID the toasts\' law: a line pushed `keep` outlasts every unkept line past four; unkept lines go oldest first as before; all kept, the oldest goes', () => {
  const q = createToastQueue();
  q.push('+3 Iron and an Amber to your Stores', { keep: true });
  for (const w of ['where', 'xp', 'rise', 'spec']) q.push(w);
  assert.equal(q.lines.length, PROF_TOASTS_MAX);
  assert.deepEqual(q.lines.map((l) => l.text), ['+3 Iron and an Amber to your Stores', 'xp', 'rise', 'spec'], 'the goods stand; the oldest unkept went');
  const p = createToastQueue();
  for (const w of ['a', 'b', 'c', 'd', 'e']) p.push(w);
  assert.deepEqual(p.lines.map((l) => l.text), ['b', 'c', 'd', 'e'], 'PROF1\'s law for unkept lines, unchanged');
  const k = createToastQueue();
  for (const w of ['a', 'b', 'c', 'd', 'e']) k.push(w, { keep: true });
  assert.deepEqual(k.lines.map((l) => l.text), ['b', 'c', 'd', 'e'], 'kept alike: the oldest goes - never more than four');
});

test('GATHER-SAID the goods\' line: one line - the Stores\' own, a gem with its article, a second find by its count', () => {
  const base = { qty: 3, material: 'metal:iron' };
  assert.equal(storesLine(base), '+3 Iron to your Stores');
  assert.equal(storesLine({ ...base, gem: 'gem:amber' }), '+3 Iron and an Amber to your Stores', 'a gem, "an" before a vowel');
  assert.equal(storesLine({ qty: 3, material: 'log:oak', extra: 'wood:resin', extraQty: 1 }), '+3 Oak Logs and Resin to your Stores');
  assert.equal(storesLine({ qty: 1, material: 'hide:bear', gem: 'part:tooth', extra: 'food:meat', extraQty: 2 }), '+1 Bear Hide, a Big Tooth and 2 Raw Meat to your Stores', 'three goods: a list');
});

// ─── THE HOST, THE REPORTS ───────────────────────────────────────────

test('GATHER-SAID the report, reproduced: Iron and an Amber at a rank\'s rise to 50 - five lines into four, and the Stores\' line is still what the player reads; the first harvest says where the Stores are', outside(async () => {
  const r = rig({ answer: ironWithAmber });
  await r.stand();
  await r.mine(0);
  assert.equal(r.asked.length, 1, 'the harvest asked');
  assert.equal(r.book.held('metal:iron'), 3, 'the Stores applied');
  assert.equal(r.said.length, 5, r.said.join(' | '));
  assert.deepEqual([r.said[0], r.said[1], r.said[3], r.said[4]], [
    '+3 Iron and an Amber to your Stores', storesWhereLine('E'), 'Mining 49 -> 50',
    'A specialisation may be chosen on the Professions page (the pause menu\'s Stats).',
  ], 'the goods, where they went, the rise and the hint: five lines');
  assert.match(r.said[2], /^\+33 Mining XP/);
  const reading = r.queue.lines.map((l) => l.text);
  assert.equal(reading.length, PROF_TOASTS_MAX);
  assert.ok(reading.includes('+3 Iron and an Amber to your Stores'), `the goods are on the screen: ${reading.join(' | ')}`);
  assert.ok(reading.some((t) => /^\+33 Mining XP/.test(t)), 'and the XP beside them');
  // a second harvest this session: the goods and the XP, the Stores' way said once
  await r.mine(1);
  assert.equal(r.said.filter((t) => t === storesWhereLine('E')).length, 1, 'where the Stores are, once a session');
}));

test('GATHER-SAID kept: every kept act says so - the second slow answer too; a signed-out account is told it is signed out', outside(async () => {
  let first = null;
  const r = rig({ answer: (b) => { first ??= b.node; return { ok: false, error: b.node === first ? 'offline' : 'auth' }; } });   // the second vein's act: signed out
  await r.stand();
  await r.mine(0);
  assert.equal(r.book.pendingHarvests, 1, 'kept');
  assert.deepEqual(r.said, [KEPT_LINE]);
  await r.mine(1);
  assert.equal(r.book.pendingHarvests, 2, 'kept');
  assert.deepEqual(r.said, [KEPT_LINE, KEPT_SIGNED_OUT_LINE], 'the second act said too - and why');
}));

test('GATHER-SAID lapsed: a kept harvest let go after its ten minutes says it was not counted - never "with the day"', outside(async () => {
  const r = rig({ answer: () => ({ ok: false, error: 'offline' }) });
  await r.stand();
  await r.mine(0);
  assert.deepEqual(r.said, [KEPT_LINE]);
  r.clock.ms += 11 * 60_000;
  r.host.tick(0.016);
  for (let k = 0; k < 4; k++) await tick();
  assert.equal(r.book.pendingHarvests, 0, 'let go');
  assert.deepEqual(r.said, [KEPT_LINE, LAPSED_LINE]);
  assert.doesNotMatch(LAPSED_LINE, /with the day/);
}));

test('GATHER-SAID maintenance: the service\'s maintenance minute keeps the act and asks again - it never reached a route', outside(async () => {
  let held = true;
  const r = rig({ answer: (b) => (held ? { ok: false, error: 'maintenance' } : ironWithAmber(b)) });
  await r.stand();
  await r.mine(0);
  assert.equal(r.book.pendingHarvests, 1, 'kept, not let go');
  assert.deepEqual(r.said, [KEPT_LINE]);
  assert.ok(!r.said.includes(accountRefusalText('maintenance')), 'never the refusal');
  held = false;
  r.clock.ms += 3_000;
  r.host.tick(0.016);
  for (let k = 0; k < 6; k++) await tick();
  assert.equal(r.book.pendingHarvests, 0, 'counted once the minute is over');
  assert.equal(r.book.held('metal:iron'), 3);
  assert.ok(r.said.includes('+3 Iron and an Amber to your Stores'));
}));

test('GATHER-SAID stopped: an act a window came over ends said, and asks nothing; Escape ends one unsaid (the player\'s own)', outside(async () => {
  const r = rig({ answer: ironWithAmber });
  await r.stand();
  const vs = r.host.nodesOf(400, 150).filter((n) => n.kind === 'mine' && n.what === 'vein');
  r.face(vs[0]);
  assert.equal(r.host.press(), true);
  assert.equal(r.host.acting(), true);
  r.world.active = false;   // the pause menu, a shop, a talk - the streaming world is not the one in front of the player
  r.host.tick(0.016);
  assert.equal(r.host.acting(), false);
  assert.deepEqual(r.said, [ACT_STOPPED_LINE]);
  assert.equal(r.asked.length, 0, 'nothing asked');
  r.world.active = true;
  r.face(vs[0]);
  assert.equal(r.host.press(), true);
  assert.equal(r.host.cancel(), true);
  assert.deepEqual(r.said, [ACT_STOPPED_LINE], 'Escape: unsaid');
}));
