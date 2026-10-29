// AUDIT TAMRIEL-WIDE, the relay's findings (2026-10-28, bible/01-Overview/audits/Audit-Tamriel-Wide.md): B1, B2, B5 and
// E3, fixed in one relay (world281). Each is run through the real hub or the real law past the Bay beside the Bay's own.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';
import {
  SOCIAL_ROOM, SD_KEY, CHAT_BAY_REGIONS, PIXEL_UNITS, RAID_CLEANS_MAX, RAID_INTERNAL_CLEAN, validRaidOut, validSerpentIn,
  wallMsForClassicMinutes, INBOUND_FRAME_MAX,
} from '../../../src/net/wire.js';
import { sdRise, sdRoomKey, SD_NO_FALLEN } from '../../../src/net/superDungeon/sdLaw.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { sdAcctKey, sdNewcomerWord, sdAcctTell, SD_NO_WON } from '../../../server/src/sdCopy.js';
import { validStaffDestination, validStaffTeleportOut } from '../../../src/net/staffTeleport.js';
import { newAbyssSaveData } from '../../../src/scenes/oceanHolesAbyss.js';
import { buildDungeonName, getAbyssMapId, isAbyssMapId, pitPixelOk } from '../../../src/world/oceanHoles.js';
import { RAID_SLOTS_MAX, RAID_LANES_BEYOND, RAID_BAY_REGIONS, RAID_DAY_MINUTES, raidSig } from '../../../src/net/raid/raidLaw.js';
import { findSerpentSite, serpentLaneEnds, serpentLaneTries, pointAlong, SITE_LANE_MIN_M } from '../../../src/systems/serpent/serpentSite.js';
import { serpentAlongAt, serpentLaneScore, serpentTimes, isSerpentDay, SERPENT_SITE_LAW, SERPENT_LANE_TRIES } from '../../../src/net/serpent/serpentLaw.js';
import { agreedSerpentSite, SERPENT_SITE_RECORD } from '../../../src/net/serpent/serpentHerald.js';
import { foldGateSite } from '../../../src/net/gate/gateHerald.js';
import { worldPixelKey } from '../../../src/world/worldWide/worldGrid.js';

const quiet = async (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; try { return await fn(); } finally { console.warn = warn; console.info = info; } };

test('AUDIT TAMRIEL-WIDE B1: SD-PARTY\'s one life and one win hold in a province\'s Hollow as in the Bay\'s - the hub reads the slot\'s own lane\'s record, death and receipt, and keeps the Bay\'s death under its old key (mutants: the Bay\'s record read; the Bay\'s receipt read; one death key for every lane; the Bay\'s key moved)', async () => {
  const T0 = 1_800_000_000_000;
  const world = fakeRooms({ now: () => T0 });
  const hub = world.room(SOCIAL_ROOM);
  const env = { ROOMS: world.ROOMS };
  const O = await instanceOwnerOf('acct-ann'), B = await instanceOwnerOf('acct-bo');
  const slots = [];
  await quiet(async () => {
    for (const lane of [0, 3]) {
      const rec = /** @type {any} */ (sdRise(null, T0, lane ? CHAT_BAY_REGIONS - 1 + lane : 17, lane));   // the lane's first Hollow, as the director raises it
      await hub.room._sdSave(rec);   // the director's own write: a province's Hollow under its lane's key
      slots.push(rec.s);
      const where = lane ? 'Skyrim\'s Hollow' : 'the Bay\'s Hollow';
      assert.equal(await sdNewcomerWord(env, rec.s, 'acct-ann', O), null, `${where}: a newcomer`);
      await sdAcctTell({ env, state: null }, /** @type {string} */ (sdRoomKey(rec.s, O)), 'acct-ann');   // a death in her party's copy
      assert.equal(await sdNewcomerWord(env, rec.s, 'acct-ann', B), SD_NO_FALLEN, `${where}: another party's copy refuses the dead`);
      assert.equal(await sdNewcomerWord(env, rec.s, 'acct-ann', O), null, `${where}: her own copy takes her back`);
      await hub.room._sdSpent('acct-cy', rec.s, T0);   // the hub's own receipt write for this slot (its lane's key)
      assert.equal(await sdNewcomerWord(env, rec.s, 'acct-cy', B), SD_NO_WON, `${where}: one win a Hollow`);
    }
    assert.equal(await sdNewcomerWord(env, slots[0], 'acct-ann', B), SD_NO_FALLEN, 'the Bay\'s death stands beside the province\'s');
  });
  assert.deepEqual(hub.store.get('sdac:acct-ann'), { s: slots[0], d: 1, o: O }, 'the Bay\'s key byte for byte');
  assert.deepEqual(hub.store.get('sdac:acct-ann.3'), { s: slots[1], d: 1, o: O }, 'a province\'s under its lane');
  assert.equal(sdAcctKey('acct-ann'), 'sdac:acct-ann');
});

/** The hub with signed staff and players (test/net/staffTeleport.test.js's harness). */
async function staffHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM), realNow = Date.now; let now = 1e12; Date.now = () => now;
  const tick = (ms = 1000) => { now += ms; };
  const join = async (id, name, glyphs = []) => { const ws = r.connect(); await r.hello(ws, id, null, { name, glyphs, acct: `acct-${id}`, asecret: `secret-${id}` }); tick(); return ws; };
  const send = (ws, m) => r.raw(ws, JSON.stringify({ t: 'stp', ...m }));
  try { await fn({ join, send, tick }); } finally { Date.now = realNow; }
}
const stp = (ws, k) => ws.sent.filter((m) => m.t === 'stp' && m.k === k);

test('AUDIT TAMRIEL-WIDE B2: staff /tp @player reaches a player in an Ocean Hole\'s abyss past the Bay - its pit on the world\'s grid (PITS-WORLD), through the relay to the staff\'s game; the template stays a Bay dungeon\'s (mutants: the pit held to the Bay\'s map; its row unbounded)', () => staffHub(async ({ join, send, tick }) => {
  const staff = await join('peer-staff', 'Mac', ['dm']), bran = await join('peer-bran', 'Bran');
  const abyssAt = (px, py, over = {}) => ({ kind: 'abyss', pixel: { x: 412, y: 220 }, pos: [1.5, -20.25, 3.75], yaw: 0.5, pitch: 0,
    abyss: { ...newAbyssSaveData(), Active: true, PitMapX: px, PitMapY: py, TemplateMapX: 412, TemplateMapY: 220, TemplateRegionIndex: 17, TemplateLocationIndex: 33,
      ReturnWorldX: (px + 0.5) * PIXEL_UNITS, ReturnWorldZ: (499 - py + 0.5) * PIXEL_UNITS, HasReturnPitDepth: true, ReturnPitDepth: 40, DungeonName: buildDungeonName(px, py), ...over } });
  let n = 0;
  for (const [px, py] of [[600, 140], [2441, 1500], [-500, 250], [1215, -40]]) {
    assert.ok(pitPixelOk(px, py) && isAbyssMapId(getAbyssMapId(px, py)), `a pit stands at (${px}, ${py})`);
    const dest = validStaffDestination(abyssAt(px, py));
    assert.ok(dest, `the target's game answers (${px}, ${py})`);
    await send(staff, { k: 'ask', name: 'Bran', nonce: `n${++n}` });
    await send(bran, { k: 'answer', ticket: stp(bran, 'capture').at(-1).ticket, dest });
    const result = stp(staff, 'result').at(-1);
    assert.equal(result.nonce, `n${n}`);
    assert.deepEqual(result.dest, dest, `the relay hands it to staff (${px}, ${py})`);
    assert.deepEqual(validStaffTeleportOut(result).dest, dest, 'and staff\'s game takes it');
    tick();
  }
  for (const bad of [{ PitMapX: 8192 }, { PitMapY: 9000 }, { PitMapX: 1.5 }, { TemplateMapX: 1000 }, { TemplateRegionIndex: 62 }]) assert.equal(validStaffDestination(abyssAt(2441, 1500, bad)), null, JSON.stringify(bad));
}));

test('AUDIT TAMRIEL-WIDE B5: the hub keeps two days of every lane\'s cleansed raids - the Bay\'s and each province\'s past it, every slot - and a joiner hears them all, the oldest let go past them (mutants: the cap the Bay\'s; the hub\'s shift at 64; the client\'s read stopping at 64; the hello oldest first)', async () => {
  const D = 600;
  const r = fakeRoom(SOCIAL_ROOM), realNow = Date.now;
  Date.now = () => wallMsForClassicMinutes(D * RAID_DAY_MINUTES + 600);
  try {
    await quiet(async () => {
      const cleanse = (key, at) => {
        const [region, loc, day] = key.split(':').map(Number);
        const g = raidSig({ st: day * RAID_DAY_MINUTES + 60, tg: 20, ty: 1, px: region < RAID_BAY_REGIONS ? 100 + loc : 2400 + region, py: region < RAID_BAY_REGIONS ? 200 : -400 - loc });
        return r.room.fetch(new Request(`https://relay.internal${RAID_INTERNAL_CLEAN}`, { method: 'POST', body: JSON.stringify({ key, at, top: [], n: 1, g }) }));
      };
      const keys = [];
      for (const day of [D - 1, D]) for (const lane of [0, ...RAID_LANES_BEYOND]) for (let i = 0; i < RAID_SLOTS_MAX; i++) {
        keys.push(lane ? `${RAID_BAY_REGIONS - 1 + lane}:-${i + 1}:${day}` : `${i}:${i + 1}:${day}`);
      }
      let at = 1e12;
      for (const key of keys) assert.equal((await cleanse(key, ++at)).ok, true, key);
      const late = r.connect(); await r.hello(late, 'peer-late');
      const cls = late.sent.find((m) => m.t === 'raid' && m.k === 'cls');
      assert.deepEqual(cls.l.map((e) => e[0]), [...keys].reverse(), 'every lane\'s two days, newest first');
      // AUDIT TAMRIEL-WIDE II R1: a build before world281 stops its read at 64 - the newest it keeps are today's
      assert.ok(cls.l.slice(0, 64).every((e) => e[0].endsWith(`:${D}`)), 'an older build keeps today\'s cleanses');
      assert.equal(keys.length, RAID_CLEANS_MAX);
      assert.deepEqual(validRaidOut(cls).l, cls.l, 'the joiner\'s game reads every one');
      assert.ok(JSON.stringify(cls).length < INBOUND_FRAME_MAX, 'one frame a game reads');
      await cleanse(`61:99:${D}`, ++at);
      const next = r.connect(); await r.hello(next, 'peer-next');
      const l = next.sent.find((m) => m.t === 'raid' && m.k === 'cls').l.map((e) => e[0]);
      assert.deepEqual(l, [`61:99:${D}`, ...keys.slice(1).reverse()], 'past the cap the oldest is let go');
    });
  } finally { Date.now = realNow; }
});

// ═══ E3: THE SERPENT'S SITE ════════════════════════════════════════════════════════════════════════════

const P = (id, px, py) => ({ id, name: `Port${id}`, px, py, region: 17, road: { x: px, y: py } });
const nativeOf = (px, py) => ({ x: (px + 0.5) * PIXEL_UNITS, z: (499 - py + 0.5) * PIXEL_UNITS });
const wayOf = (lane) => {
  const pts = [nativeOf(lane.a.road.x, lane.a.road.y), nativeOf(lane.b.road.x, lane.b.road.y)];
  return { pts, len: (Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z) / PIXEL_UNITS) * 819.2 };
};
const laneOf = (i, ax, ay, bx, by) => ({ key: `L${i}`, a: P(2 * i, ax, ay), b: P(2 * i + 1, bx, by) });
/** Twenty lanes on the Bay's map and twenty past it (west, north and south of its corner). */
const LANES = Array.from({ length: 40 }, (_, i) => (i < 20 ? laneOf(i, 40 + 40 * i, 100, 40 + 40 * i, 140) : laneOf(i, -900 + 60 * i, i % 2 ? 1300 : -300, -860 + 60 * i, i % 2 ? 1340 : -340)));
const DAYS = [];
for (let d = 2001; DAYS.length < 40; d++) if (isSerpentDay(d)) DAYS.push(d);
const open = () => true;
const siteKey = (s) => (s ? `${s.lane}@${s.sx},${s.sz}` : 'none');
const sitesOf = (lanes) => DAYS.map((d) => findSerpentSite(d, { lanes, wayOf, open }));

test('AUDIT TAMRIEL-WIDE E3: the serpent\'s lane is the day\'s highest-scored by its two ends, and its place along is that lane\'s own - a list reordered moves no site, a lane added moves only the days it wins, a better lane with no site moves none (mutants: the list\'s order; the place along the rank\'s, not the lane\'s)', () => {
  const base = sitesOf(LANES);
  assert.ok(base.every(Boolean), 'an open sea: a site every day');
  assert.ok(base.some((s) => Number(s.lane.slice(1)) < 20) && base.some((s) => Number(s.lane.slice(1)) >= 20), 'its days on the Bay\'s lanes and on lanes past it');
  for (const [s, d] of base.map((s, j) => [s, DAYS[j]])) {
    const lane = LANES.find((l) => l.key === s.lane), [ka, kb] = /** @type {number[]} */ (serpentLaneEnds(lane));
    const p = pointAlong(wayOf(lane), serpentAlongAt(d, ka, kb));
    assert.deepEqual([s.sx, s.sz], [p.x, p.z], `day ${d}: the lane's own place along`);
    assert.ok(LANES.every((l) => serpentLaneScore(d, ...serpentLaneEnds(l)) <= serpentLaneScore(d, ka, kb)), `day ${d}: the day's best lane`);
  }
  assert.deepEqual(sitesOf([...LANES].reverse()).map(siteKey), base.map(siteKey), 'the list reversed: every site where it was');
  assert.deepEqual(sitesOf([...LANES.slice(17), ...LANES.slice(0, 17)]).map(siteKey), base.map(siteKey), 'the list turned: every site where it was');
  const added = [laneOf(90, 300, 300, 300, 340), laneOf(91, 2000, 900, 2040, 940), laneOf(92, -1200, 600, -1160, 640), laneOf(93, 700, 450, 740, 450), laneOf(94, 1500, -900, 1540, -940), laneOf(95, 150, 20, 190, 20)];
  const grown = sitesOf([...added.slice(0, 3), ...LANES.slice(0, 20), ...added.slice(3), ...LANES.slice(20)]);
  const moved = grown.filter((s, j) => siteKey(s) !== siteKey(base[j]));
  assert.ok(moved.length > 0 && moved.length < DAYS.length / 2, `some days move to the new lanes (${moved.length} of ${DAYS.length})`);
  assert.ok(moved.every((s) => added.some((l) => l.key === s.lane)), 'and only to a new lane: no other day moves');
  const short = Array.from({ length: 12 }, (_, i) => laneOf(70 + i, 200 + 9 * i, 400, 202 + 9 * i, 400));
  assert.ok(wayOf(short[0]).len < SITE_LANE_MIN_M);
  assert.deepEqual(sitesOf([...short, ...LANES]).map(siteKey), base.map(siteKey), 'better-scored lanes too short for a site: every site where it was');
});

test('AUDIT TAMRIEL-WIDE II R5: a lane is scored by both its ports - lanes out of one port score apart, so the list reordered keeps their days - and a day tries SERPENT_LANE_TRIES lanes at most (mutants: one end keyed twice; the tries unbounded)', () => {
  const hub = P(500, 300, 200);
  const fan = Array.from({ length: 8 }, (_, i) => ({ key: `F${i}`, a: hub, b: P(600 + i, 300 + 40 * (i + 1), 260) }));
  for (const l of fan) assert.deepEqual(serpentLaneEnds(l), [worldPixelKey(l.a.px, l.a.py), worldPixelKey(l.b.px, l.b.py)], `${l.key}: both its ports`);
  const lanes = [...fan, ...LANES];
  assert.deepEqual(sitesOf([...lanes].reverse()).map(siteKey), sitesOf(lanes).map(siteKey), 'lanes out of one port, the list reversed: every site where it was');
  assert.equal(serpentLaneTries(DAYS[0], LANES).length, SERPENT_LANE_TRIES, `${LANES.length} lanes, ${SERPENT_LANE_TRIES} tried`);
});

/** The hub with accounts and Date.now before a serpent day's bells (test/world/worldWide/ww7_longer.test.js's harness). */
async function serpentHub(fn, day) {
  const r = fakeRoom(SOCIAL_ROOM);
  r.room._heraldBeat = async () => {}; r.room._heraldNextAt = () => null; r.room._serpentHeraldBeat = async () => {};
  const realNow = Date.now;
  let clock = serpentTimes(day).omenAt - 10 * 60_000;
  Date.now = () => clock;
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
  const site = (ws, s) => r.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d: day, ...s }));
  try { await quiet(() => fn({ r, join, site })); } finally { Date.now = realNow; }
}

test('AUDIT TAMRIEL-WIDE E3: the site law rides the `site` word, and the hub folds its own law\'s words into its own law\'s record alone - an older build\'s site, or the older record, never outvotes it; a build\'s word of the law after an older one counts (mutants: every law folded; the record the older law\'s)', async () => {
  const DAY = DAYS[3];
  const SITE = { sx: 81_000, sz: -42_001, pl: 'Sentinel' }, OLD = { sx: 5_000, sz: 6_000, pl: 'Wayrest' };
  assert.deepEqual(validSerpentIn({ k: 'site', d: DAY, ...SITE, sl: SERPENT_SITE_LAW }), { k: 'site', d: DAY, ...SITE, sl: SERPENT_SITE_LAW });
  assert.deepEqual(validSerpentIn({ k: 'site', d: DAY, ...SITE }), { k: 'site', d: DAY, ...SITE }, 'an older build\'s word, as it was');
  for (const sl of [0, 1.5, '2', 1000]) assert.equal(validSerpentIn({ k: 'site', d: DAY, ...SITE, sl }), null, String(sl));
  await serpentHub(async ({ r, join, site }) => {
    let older = null;
    for (const who of ['x', 'y', 'z']) older = foldGateSite(older, DAY, `acct-${who}`, OLD.sx, OLD.sz, OLD.pl);
    r.store.set('serpentsite', older);   // the older law's record, from before the deploy
    const [a, b, c, d, e] = [await join('a'), await join('b'), await join('c'), await join('d'), await join('e')];
    for (const ws of [c, d, e]) await site(ws, OLD);   // three tabs on the older build
    await site(a, { ...SITE, sl: SERPENT_SITE_LAW });
    await site(b, { ...SITE, sl: SERPENT_SITE_LAW });
    await site(c, { ...SITE, sl: SERPENT_SITE_LAW });   // c reloaded
    assert.deepEqual(agreedSerpentSite(r.store.get(SERPENT_SITE_RECORD), DAY), { sx: SITE.sx, sz: SITE.sz, place: SITE.pl });
    assert.deepEqual(r.store.get(SERPENT_SITE_RECORD).c.map((x) => x[3].length), [3], 'its law\'s three words, no other');
    const late = await join('late');
    assert.deepEqual(late.sent.filter((w) => w.t === 'serpent' && w.k === 'at'), [{ t: 'serpent', k: 'at', d: DAY, ...SITE }], 'every game told the site its law agrees');
    assert.deepEqual(r.store.get('serpentsite'), older, 'the older record left as it was');
  }, DAY);
});
