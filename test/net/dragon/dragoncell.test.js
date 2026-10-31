// DRAGON-CELL (2026-10-31, from Discord: a player decoded the omen the relay told every screen at a dragon's landing and read
// its pixel; the owner chose "Cell-scoped"; bible/11-Multiplayer/Dwarven-Dragon.md DRAGON-CELL). A watch holds
// DRAGON_CELLS_A_WATCH omens, each a seed of the watch's own seed and a cell of its own; the relay tells one only to a socket
// whose pose stands within DRAGON_TELL_PX of its cell, and the client finds its site in that cell. Pinned: the law's box,
// its omens and their spacing; the relay's answer near, far and outside a socket's cover; the client asking again from
// another pixel; a square's ground past the Bay. tools/mutants/dragoncell.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { cellRoomOfWire } from '../../../src/net/wire.js';
import { createDragonHost, DRAGON_ASK_RETRY_MS } from '../../../src/scenes/dragonHost.js';
import { createDragonLink } from '../../../src/net/dragon/dragonLink.js';
import { createTheatreGateScans } from '../../../src/scenes/gate/gateLanes.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { theatreAt } from '../../../src/world/worldWide/worldGrid.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, omenOf, dragonOmenFrom, siteOf } from '../../dragonOmen.mjs';

const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN);
const SITE = siteOf(OMEN), CELL = cellRoomOfWire(SITE.sx, SITE.sz);
const posed = (px, py) => { const c = Law.pixelCentreNative(px, py); return { x: c.sx, y: 0, z: c.sz, yaw: 0, pitch: 0 }; };
const omens = (ws) => ws.sent.filter((m) => m.t === 'dragon' && m.k === 'omen').map(({ w, s }) => [w, s]);

test('DRAGON-CELL the law: a pixel is told an omen within DRAGON_TELL_PX of its cell and no further; a watch\'s omens are seeds of its own seed, none within two cells of another, the one near a pixel and the one a site stands in found (mutants: the box\'s margin; the spacing; another omen\'s cell)', async () => {
  const { cx, cy } = Law.dragonCellOf(OMEN), x0 = cx * Law.DRAGON_CELL_PX, y0 = cy * Law.DRAGON_CELL_PX, T = Law.DRAGON_TELL_PX, E = x0 + Law.DRAGON_CELL_PX + T;
  assert.deepEqual([Law.DRAGON_CELL_PX, T, Law.DRAGON_CELLS_A_WATCH], [16, 6, 4]);
  assert.deepEqual([Law.dragonToldAt(OMEN, x0 - T, y0), Law.dragonToldAt(OMEN, x0 - T - 1, y0), Law.dragonToldAt(OMEN, E - 1, y0), Law.dragonToldAt(OMEN, E, y0)], [true, false, true, false]);
  assert.deepEqual([Law.dragonToldAt(OMEN, x0, y0 - T), Law.dragonToldAt(OMEN, x0, y0 - T - 1), Law.dragonToldAt(OMEN, x0, E - x0 + y0 - 1), Law.dragonToldAt(OMEN, x0, E - x0 + y0)], [true, false, true, false]);
  let spaced = 0;
  for (let w = W; w < W + 400; w++) {
    const o = await omenOf(w), cs = Law.dragonCandidates(o);
    assert.ok(cs.length >= 1 && cs.length <= Law.DRAGON_CELLS_A_WATCH);
    for (const c of cs) {
      assert.notEqual(c.s, o.s, 'never the watch\'s own seed');
      assert.equal(c.w, w);
      for (const d of cs) if (d !== c) { const a = Law.dragonCellOf(c), b = Law.dragonCellOf(d); assert.ok(Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) > 2); spaced++; }
      const { px, py, sx, sz } = siteOf(c);
      assert.deepEqual(Law.dragonCandidateAt(o, px, py), c, 'the one near its own cell');
      assert.deepEqual(Law.dragonCandidateOf(o, sx, sz), c, 'the one its site stands in');
    }
  }
  assert.ok(spaced > 0);
  // the spacing's own law: an omen within two cells of an earlier one is dropped
  let w = W, o, cs;
  for (;; w++) { o = await omenOf(w); cs = Law.dragonCandidates(o); if (cs.length < Law.DRAGON_CELLS_A_WATCH) break; if (w > W + 200_000) assert.fail('no watch drops an omen'); }
  const all = Array.from({ length: Law.DRAGON_CELLS_A_WATCH }, (_, i) => ({ w, s: Law.dragonRoll(o, 100 + i) }));
  const lost = all.filter((c) => !cs.some((d) => d.s === c.s));
  assert.ok(lost.length >= 1);
  for (const c of lost) assert.ok(all.slice(0, all.indexOf(c)).some((d) => { const a = Law.dragonCellOf(c), b = Law.dragonCellOf(d); return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) <= 2; }));
});

async function withRelay(fn, { start = TT.landAt + 60_000 } = {}) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const room = (key) => { const r = world.room(key); r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8; return r; };
    const say = (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    await fn({ room, say, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}

test('DRAGON-CELL the relay: a socket posed near the omen\'s cell is told its seed once it lands; one posed far is told nothing until a quiet watch would be, then null; a pose outside the socket\'s cover is far; the watch\'s own seed is never said (mutants: told to every pose; the far told at once; the cover unread; the watch\'s seed told)', async () => {
  const { cx, cy } = Law.dragonCellOf(OMEN), farPx = cx * Law.DRAGON_CELL_PX + Law.DRAGON_CELL_PX + Law.DRAGON_TELL_PX + 2, farPy = SITE.py;
  const FAR_CELL = cellRoomOfWire(posed(farPx, farPy).x, posed(farPx, farPy).z), AWAY = posed(SITE.px + 4 * Law.DRAGON_CELL_PX, SITE.py);
  const AWAY_CELL = cellRoomOfWire(AWAY.x, AWAY.z);
  assert.notEqual(FAR_CELL, CELL);
  const watchSeed = (await omenOf(W)).s;
  await withRelay(async ({ room, say, set }) => {
    const r = room(CELL), f = room(FAR_CELL), aw = room(AWAY_CELL);
    const near = r.connect(), out = r.connect(), far = f.connect(), liar = aw.connect();
    await r.hello(near, 'peer-0001', posed(SITE.px, SITE.py));
    await r.hello(out, 'peer-0002', posed(farPx, farPy));   // in this cell's room, its pose in a cell it does not cover
    await f.hello(far, 'peer-0003', posed(farPx, farPy));
    await aw.hello(liar, 'peer-0004', posed(SITE.px, SITE.py));   // a room four cells off, its pose at the site: a cell it does not cover
    set(TT.landAt - 1);
    await say(r, near, { k: 'ask', w: W });
    assert.deepEqual(omens(near), [], 'nothing before it lands');
    set(Math.min(TT.landAt + 1, Law.dragonQuietAt(W) - 1));
    for (const [rr, ws] of [[r, near], [r, out], [f, far]]) await say(rr, ws, { k: 'ask', w: W });
    assert.deepEqual([omens(near), omens(out), omens(far)], [[[W, OMEN.s]], [], []], 'near: its seed; far: nothing yet, as before a landing');
    set(Law.dragonQuietAt(W));
    await say(r, out, { k: 'ask', w: W }); await say(f, far, { k: 'ask', w: W }); await say(aw, liar, { k: 'ask', w: W });
    assert.deepEqual([omens(out), omens(far), omens(liar)], [[[W, null]], [[W, null]], [[W, null]]], 'far, or a pose its room does not cover: null, as a quiet watch is told');
    for (const ws of [near, out, far, liar]) assert.ok(!ws.sent.some((m) => m.t === 'dragon' && m.s === watchSeed), 'the watch\'s own seed is never said');
  });
});

test('DRAGON-CELL the client: a null answer is asked again only from another pixel, after the retry; a seed told is never asked again (mutants: a null asked again where it was heard; a null never asked again)', () => {
  const M = 40, S = { t: TT.landAt + 1000, sent: [], px: SITE.px };
  const link = createDragonLink({ now: () => S.t, site: () => null });
  const host = createDragonHost({
    now: () => S.t, link, sites: { of: () => null },
    online: { ready: () => true, send: (w) => { S.sent.push(w); return true; } },
    local: (nx, nz) => [nx / M, nz / M], native: (x, z) => [x * M, z * M], ground: () => 0,
    feet: () => { const c = Law.pixelCentreNative(S.px, SITE.py); return [c.sx / M, 0, c.sz / M]; }, eye: () => [0, 1.6, 0], level: () => 20,
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} }, getTexture: () => null,
  });
  const asks = () => S.sent.filter((w) => w.k === 'ask' && w.w === W).length;
  host.frame();
  assert.equal(asks(), 1);
  host.omen({ w: W, s: null });
  S.t += DRAGON_ASK_RETRY_MS; host.frame();
  assert.equal(asks(), 1, 'told none here: not asked again from here');
  S.px += 1; host.frame();
  assert.equal(asks(), 2, 'asked again from another pixel');
  host.omen({ w: W, s: OMEN.s });
  S.px += 1; S.t += DRAGON_ASK_RETRY_MS; host.frame();
  assert.equal(asks(), 2, 'told: never asked again');
});

test('DRAGON-CELL a square\'s ground past the Bay (groundIn): its towns every place of a town\'s kind about it - one the theatre lists not - its ground in the square alone and on a lane that stands (never Cyrodiil\'s); kept for the square (mutants: the towns the listed alone; the square unbounded; any lane)', () => {
  const town = { px: 2001, py: -98, name: 'Helbenar', type: LOCATION_TYPES.TownVillage, area: 100, theatre: 3, mapId: 1 };
  const imperial = { ...town, px: 2504, py: 804, name: 'Bruma Road', mapId: 2 };   // Cyrodiil: the open zone's theatre, no lane
  let asks = 0;
  const places = {
    generation: () => 1, theatres: () => [], inTheatre: () => [],
    at: (x, y) => { asks++; return [town, imperial].find((p) => p.px === x && p.py === y) ?? null; },
  };
  const scans = createTheatreGateScans({ places: /** @type {any} */ (places), wet: () => false, spawnSalt: 1, idle: null });
  assert.equal(theatreAt(town.px, town.py), 3);
  assert.equal(theatreAt(imperial.px, imperial.py), 9);
  const g = scans.groundIn(2000, -100, 16);
  const ground = [...g.byArea.values()].flatMap((l) => [...l]);
  assert.ok(ground.length > 0, 'a countryside village\'s ring');
  for (const k of ground) {
    const x = (k % 16384) - 8192, y = Math.floor(k / 16384) - 8192;
    assert.ok(x >= 2000 && x < 2016 && y >= -100 && y < -84, `${x},${y} in the square`);
    const d = Math.max(Math.abs(x - town.px), Math.abs(y - town.py));
    assert.ok(d >= 2 && d <= 4, 'on its ring');
  }
  assert.equal(g.towns[0].name, 'Helbenar');
  const n = asks;
  assert.equal(scans.groundIn(2000, -100, 16), g, 'kept');
  assert.equal(asks, n);
  assert.deepEqual([...scans.groundIn(2496, 800, 16).byArea.values()].flatMap((l) => [...l]), [], 'never on a lane that stands no gate');
});
