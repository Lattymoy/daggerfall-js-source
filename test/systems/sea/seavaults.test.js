// SEA-VAULTS (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Wrothgarian
// Mountains' daily elite halls in the Eltheric Ocean's Deep Aether and Abyss; bible/03-World/Eltheric-Ocean.md SEA-VAULTS):
// the vaults of the deep - the wire's key and its room (net/wire.js), the hub's lock, reset and crows over a sea key end to
// end, the day's picks (systems/sea/seaVaults.js), the world host's wiring (scenes/seaVenturesHost.js and its seams in
// scenes/world.js), the chart's marks (ui/etherChartWindow.js). tools/mutants/seavaults.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOCIAL_ROOM, parseClient, validWdunIn, validWdunOut, wdunHall, wdunRoomKey, isWorldRoom, seaVaultKey, seaVaultCell, seaVaultMapId, seaRoomCell, seaVaultRoomMapId,
  WDUN_SEA_CELLS_W, WDUN_SEA_CELLS_H, WDUN_SEA_RELAY_MIN, relaySupportsWdunSea, RELAY_VERSION, WDUN_LOCK_MS, WDUN_RESET_MS, WDUN_DAY_MS,
} from '../../../src/net/wire.js';
import { CELLS_W, CELLS_H, isleOfCell, etherBandAt, BANDS, VEIL_X, LEAGUE_PX, veilhaven, etherCellOf } from '../../../src/world/ethericSea.js';
import { etherPlaceId } from '../../../src/world/etherPlaces.js';
import { HAUNT_SPREAD, ABYSS_HAUNT_LEAGUES } from '../../../src/systems/naval/etherShips.js';
import {
  SEA_VAULTS, SEA_VAULT_SPACING_CELLS, SEA_VAULT_SEARCH_CELLS, SEA_VAULT_TRIES, SEA_VAULT_SALT, seaVaultPicks, seaVaultAt, seaVaultByKey, vaultWaters, _resetSeaVaultsForTests,
} from '../../../src/systems/sea/seaVaults.js';
import { createSeaVentures } from '../../../src/scenes/seaVenturesHost.js';
import * as M from '../../../src/ui/etherChartWindow.js';
import { createInstanceDoor } from '../../../src/scenes/instanceDoor.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { instanceOwnerOf, instanceRoomOf, instanceWord, INSTANCE_DOOR_WORD } from '../../../src/net/instanceRoom.js';
import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const DAY = 20400;

test('SEA-VAULTS the wire: a vault of the deep is keyed by its cell, `"e<cx>,<cy>"` - inside the lattice, never a mountain hall\'s; its room its ruin isle\'s own place\'s, a world room; the words in and out carry it; the lattice and the place\'s id the sea\'s own (mutants: the bounds, the room, the id)', () => {
  assert.deepEqual([WDUN_SEA_CELLS_W, WDUN_SEA_CELLS_H], [CELLS_W, CELLS_H], 'the relay\'s copy of the lattice is the sea\'s');
  assert.equal(seaVaultKey(723, 240), 'e723,240');
  assert.deepEqual(seaVaultCell('e723,240'), [723, 240]);
  assert.deepEqual(seaVaultCell('e0,0'), [0, 0]);
  for (const bad of ['e806,1', 'e1,499', 'e-1,2', 'e1,2,3', 'e1234,1', '723,240', 'E1,2', 'e1,2 ', null, 5]) assert.equal(seaVaultCell(bad), null, String(bad));
  assert.deepEqual([CELLS_W - 1, CELLS_H - 1].map(String), ['805', '498']);
  assert.deepEqual(seaVaultCell(`e${CELLS_W - 1},${CELLS_H - 1}`), [CELLS_W - 1, CELLS_H - 1], 'the last cell');
  assert.equal(wdunHall('e723,240'), 'e723,240');
  assert.equal(wdunHall('512,88'), '512,88', 'a mountain hall as ever');
  assert.equal(wdunHall('e806,1'), null);
  for (const [cx, cy] of [[723, 240], [0, 0], [805, 498], [400, 13]]) {
    assert.equal(seaVaultMapId(cx, cy), etherPlaceId({ cx, cy }), `${cx},${cy}: the isle's own place's id`);
    // PIN MOVED (AUDIT SEA VENTURES D7, D8): a vault's room is its isle's lane of its own - never the plain ruin's
    assert.equal(wdunRoomKey(seaVaultKey(cx, cy)), `dungeon:m${seaVaultRoomMapId(cx, cy)}`, 'its world room, the one its vault is stood in');
    assert.notEqual(seaVaultRoomMapId(cx, cy), etherPlaceId({ cx, cy }), 'never its plain ruin\'s');
  }
  assert.ok(isWorldRoom(wdunRoomKey('e723,240')));
  assert.notEqual(wdunRoomKey('e723,240'), wdunRoomKey('e724,240'));
  assert.notEqual(wdunRoomKey('e723,240'), wdunRoomKey('723,240'), 'never a mountain hall\'s room');
  assert.deepEqual(validWdunIn({ k: 'in', h: 'e723,240' }), { k: 'in', h: 'e723,240' });
  assert.deepEqual(validWdunIn({ k: 'die', h: 'e1,2' }), { k: 'die', h: 'e1,2' });
  assert.equal(validWdunIn({ k: 'in', h: 'e900,1' }), null);
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'cr', crows: [['e1,2', 5], ['1,2', 6], ['e9999,1', 3]] }), { k: 'cr', crows: [['e1,2', 5], ['1,2', 6]] });
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'ok', h: 'e1,2', ep: 3 }), { k: 'ok', h: 'e1,2', ep: 3 });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'wdun', k: 'in', h: 'e1,2' }), { hasHello: true }), { t: 'wdun', k: 'in', h: 'e1,2' });
  assert.equal(WDUN_SEA_RELAY_MIN, 246);   // PIN MOVED: world246 (world241 on its branch, then world242 and world245, renumbered past SD-THROUGH, LEASE1, PARTY-PING, SPAWN-THIN and AUDIT PISTOLET at the merges)
  assert.ok(relaySupportsWdunSea(RELAY_VERSION), 'this relay reads it');
  assert.ok(!relaySupportsWdunSea('world245'), 'an older one closes the socket on it - never asked');
});

test('SEA-VAULTS the hub, end to end over the fake relay: a sea key\'s lock an hour, its empty vault\'s room wiped (the isle place\'s own) and a new epoch, the crows told to everyone online (mutants: the key\'s room)', async () => {
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const join = async (n) => { const ws = hub.connect(); await hub.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-${n}` }); clock += 700; return ws; };
    const a = await join('a'), b = await join('b'), c = await join('c');
    const wd = (ws, o) => hub.raw(ws, JSON.stringify({ t: 'wdun', ...o }));
    const got = (ws, k) => ws.sent.filter((m) => m.t === 'wdun' && (!k || m.k === k));
    const H = 'e723,240';
    await wd(a, { k: 'hi' });
    assert.equal(got(a, 'st').at(-1).day, Math.floor(clock / WDUN_DAY_MS));
    await wd(a, { k: 'in', h: H }); clock += 700;
    assert.deepEqual(got(a, 'ok').at(-1), { t: 'wdun', k: 'ok', h: H, ep: 0 });
    await wd(a, { k: 'out', h: H }); clock += 700;
    assert.equal(got(a, 'lk').at(-1).left, WDUN_LOCK_MS, 'an hour\'s lock on the vault');
    await wd(a, { k: 'in', h: H }); clock += 700;
    assert.equal(got(a, 'no').at(-1).h, H, 'locked out');
    // PIN MOVED (AUDIT SEA VENTURES D7, D8, A5): the vault's own room wiped, at every size it is laid at - never the plain ruin's
    const dun = world.room(`dungeon:m${seaVaultRoomMapId(723, 240)}`), med = world.room(`dungeon:m${seaVaultRoomMapId(723, 240)}.m`);
    const plain = world.room(`dungeon:m${etherPlaceId({ cx: 723, cy: 240 })}`);
    for (const r of [dun, med, plain]) r.store.set('world:snap', { foes: [1, 2, 3] });
    clock += WDUN_RESET_MS + 1000;
    await wd(b, { k: 'in', h: H }); clock += 700;
    assert.equal(dun.store.get('world:snap'), undefined, 'reset: the vault\'s room wiped');
    assert.equal(med.store.get('world:snap'), undefined, 'and laid medium');
    assert.deepEqual(plain.store.get('world:snap'), { foes: [1, 2, 3] }, 'its plain ruin\'s room never');
    assert.equal(got(b, 'ok').at(-1).ep, 1, 'a new epoch');
    await wd(b, { k: 'die', h: H }); clock += 700;
    const cr = got(c, 'cr').at(-1);
    assert.ok(cr?.crows.some(([h]) => h === H), 'the crows told to everyone online');
  } finally { Date.now = realNow; }
});

test('SEA-VAULTS the picks: the Deep Aether\'s four and the Abyss\'s three a day - each a ruin isle of its own band, near a point its waters draw (the haunts\' corridor), SEA_VAULT_SPACING_CELLS apart; the ring the band\'s (3, 4); the same every call and every client, another set another day (mutants: the counts, the kind, the band, the spacing, the ring, the day)', () => {
  _resetSeaVaultsForTests();
  assert.deepEqual({ ...SEA_VAULTS }, { deep: 4, abyss: 3 });
  assert.deepEqual([SEA_VAULT_SPACING_CELLS, SEA_VAULT_SEARCH_CELLS, SEA_VAULT_TRIES, SEA_VAULT_SALT], [6, 10, 8, 0x5ea7]);
  const deepW = vaultWaters('deep'), abyssW = vaultWaters('abyss');
  assert.deepEqual(deepW, { x0: Math.ceil(VEIL_X - BANDS[3].from * LEAGUE_PX), x1: Math.floor(VEIL_X - BANDS[2].from * LEAGUE_PX), y0: veilhaven().py - HAUNT_SPREAD.deep, y1: veilhaven().py + HAUNT_SPREAD.deep });
  assert.deepEqual(abyssW, { x0: Math.ceil(VEIL_X - (BANDS[3].from + ABYSS_HAUNT_LEAGUES) * LEAGUE_PX), x1: Math.floor(VEIL_X - BANDS[3].from * LEAGUE_PX), y0: veilhaven().py - HAUNT_SPREAD.abyss, y1: veilhaven().py + HAUNT_SPREAD.abyss });
  const reach = SEA_VAULT_SEARCH_CELLS * 10 + 10;
  const seen = new Set();
  for (let d = DAY; d < DAY + 30; d++) {
    const v = seaVaultPicks(d);
    assert.equal(v, seaVaultPicks(d), 'kept a day');
    assert.deepEqual(v.map((x) => x.band), ['deep', 'deep', 'deep', 'deep', 'abyss', 'abyss', 'abyss'], `day ${d}`);
    for (const x of v) {
      const isle = isleOfCell(x.cx, x.cy);
      assert.equal(isle.kind, 'ruin', `${x.key}: a ruin`);
      assert.deepEqual([x.x, x.y, x.name], [isle.px, isle.py, isle.name], 'its place\'s pixel and name the isle\'s own');
      assert.deepEqual(etherCellOf(x.x, x.y), [x.cx, x.cy]);
      assert.equal(etherBandAt(isle.px).id, x.band, 'of its own band');
      assert.equal(x.ring, x.band === 'deep' ? 3 : 4);
      assert.equal(x.key, seaVaultKey(x.cx, x.cy));
      const w = x.band === 'deep' ? deepW : abyssW;
      assert.ok(x.x >= w.x0 - reach && x.x <= w.x1 + reach && x.y >= w.y0 - reach && x.y <= w.y1 + reach, `${x.key}: within its waters' reach`);
    }
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      assert.ok(Math.max(Math.abs(v[i].cx - v[j].cx), Math.abs(v[i].cy - v[j].cy)) >= SEA_VAULT_SPACING_CELLS, `${v[i].key} and ${v[j].key} apart`);
    }
    seen.add(v.map((x) => x.key).join('|'));
  }
  assert.ok(seen.size >= 29, 'a new set each day');
  _resetSeaVaultsForTests();
  const again = seaVaultPicks(DAY);
  assert.deepEqual(again.map((x) => x.key), seaVaultPicks(DAY).map((x) => x.key), 'drawn again, the same');
  assert.equal(seaVaultAt(again, again[2].x, again[2].y), again[2]);
  assert.equal(seaVaultAt(again, again[2].x + 1, again[2].y), null, 'its place\'s pixel alone');
  assert.equal(seaVaultByKey(again, again[5].key), again[5]);
  assert.equal(seaVaultByKey(again, 'e0,0'), null);
});

test('SEA-VAULTS the world host\'s wiring (seaVenturesHost.js): a vault at the player\'s pixel while the open sea is an open zone, none otherwise; the chart\'s word - every vault, my padlock (never over my own remains), its crows; the crows\' news named and banded, a mountain hall\'s none (mutants: the live gate, the lock, the way back, the crows)', () => {
  const v = seaVaultPicks(DAY);
  const st = { live: true, px: { x: v[0].x, y: v[0].y }, mine: null };
  const locks = new Map(), crows = new Map();
  const sea = createSeaVentures({ live: () => st.live, day: () => DAY, pixel: () => st.px, locks, crows, mine: () => st.mine });
  assert.equal(sea.vaultHere(), v[0]);
  st.px = { x: v[0].x + 1, y: v[0].y };
  assert.equal(sea.vaultHere(), null, 'a pixel off');
  st.px = { x: 500, y: 250 };
  assert.equal(sea.vaultHere(), null, 'the Bay');
  st.px = { x: v[4].x, y: v[4].y };
  assert.equal(sea.vaultHere().ring, 4);
  st.live = false;
  assert.equal(sea.vaultHere(), null, 'offline - or a relay that raises no zone - no vault: the ruin is itself');
  assert.deepEqual((({ pvp, vaults }) => ({ pvp, vaults }))(sea.chartWord()), { pvp: false, vaults: [] });   // SEA-EVENTS: beside the storm's and the fleet's words (test/systems/sea/seaevents.test.js)
  st.live = true;
  const now = 1_800_000_000_000;
  locks.set(v[1].key, now + 60_000); crows.set(v[2].key, now + 9e5);
  const w = sea.chartWord(now);
  assert.equal(w.pvp, true);
  assert.equal(w.vaults.length, 7);
  assert.deepEqual(w.vaults[1], { key: v[1].key, x: v[1].x, y: v[1].y, name: v[1].name, band: 'deep', ring: 3, locked: true, crows: false });
  assert.equal(w.vaults[2].crows, true);
  assert.equal(w.vaults[0].locked, false);
  locks.set(v[3].key, now + 60_000);
  st.mine = { dungeon: v[1].key, until: now + 1000 };
  assert.equal(sea.chartWord(now).vaults[1].locked, false, 'my remains lie there: my way back is open');
  assert.equal(sea.chartWord(now).vaults[3].locked, true, 'there alone');
  st.mine = { dungeon: v[1].key, until: now - 1 };
  assert.equal(sea.chartWord(now).vaults[1].locked, true, 'gone: the lock again');
  assert.equal(sea.chartWord(now + 61_000).vaults[1].locked, false, 'the hour run');
  const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
  assert.equal(sea.crowLine(v[5].key), `Crows gather over ${cap(v[5].name)} (The Abyss). Someone has fallen there.`);
  assert.equal(sea.crowLine('e0,0'), 'Crows gather over a vault of the deep. Someone has fallen there.', 'a vault no day names');
  const y = seaVaultPicks(DAY - 1).find((x) => !v.some((t) => t.key === x.key));
  if (y) assert.match(sea.crowLine(y.key), new RegExp(`over ${cap(y.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(The `), 'yesterday\'s: a body outlives the day\'s turn');
  assert.equal(sea.crowLine('512,88'), null, 'a mountain hall\'s is the mountains\'');
});

test('SEA-VAULTS the chart: every vault on the canvas marked in the halls\' oxblood whether its isle is charted or not, named from x4, my padlock and its crows through the mountains\' painters on the chart\'s paper; keyed while the word carries any (mutants: the mark, the paper\'s view, the name\'s zoom)', () => {
  const v = seaVaultPicks(DAY);
  const word = { px: v[0].x, py: v[0].y, yaw: 0, charted: [], legends: [], stats: {}, pvp: true, vaults: v.map((t, i) => ({ ...t, locked: i === 0, crows: i === 0 })) };
  const W = 1000, H = 600;
  const view = { cx: v[0].x + 0.5, cy: v[0].y + 0.5, zoom: 2 };
  const m = M.chartModel(word, view, W, H);
  const at = m.vaults.find((t) => t.key === v[0].key);
  assert.deepEqual([at.sx, at.sy, at.icon, at.named], [W / 2, H / 2, M.ICON_PX[2], true]);
  const k = M.CHART_ZOOMS[2];
  assert.deepEqual(m.paperView, { ox: view.cx - W / (2 * k), oy: view.cy - H / (2 * k), scale: k });
  const [px, py] = [(v[0].x + 0.5 - m.paperView.ox) * m.paperView.scale, (v[0].y + 0.5 - m.paperView.oy) * m.paperView.scale];
  assert.deepEqual([px, py], [W / 2, H / 2], 'the paper\'s view lays a pixel where the chart does');
  assert.equal(M.chartModel(word, { ...view, zoom: 1 }, W, H).vaults.find((t) => t.key === v[0].key).named, false);
  assert.equal(M.chartModel({ ...word, vaults: undefined }, view, W, H).vaults.length, 0);
  const log = [];
  const g = new Proxy({}, { get: (_, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => log.push([k, ...a])), set: (_, k, val) => { log.push(['=', k, val]); return true; } });
  M.paintChart(g, m, W, H);
  const hw = M.ICON_PX[2] + 2;
  const door = log.findIndex((c) => c[0] === 'arc' && c[1] === W / 2 && c[2] === H / 2 - M.ICON_PX[2] - 4 + hw && c[3] === hw && c[4] === Math.PI && c[5] === 0);
  assert.ok(door >= 0, 'the vault\'s arched door over its isle');
  assert.ok(log.slice(door).some((c) => c[0] === '=' && c[1] === 'fillStyle' && c[2] === '#7a1f14'), 'in the halls\' oxblood');
  assert.ok(log.some((c) => c[0] === 'fillText' && c[1] === v[0].name.replace(/^./, (s) => s.toUpperCase())), 'named');
  const halo = (c) => c[0] === 'fillRect' && c[1] === W / 2 + 6 - 1 && c[2] === H / 2 - 7 - 4 && c[3] === 8 && c[4] === 10;
  assert.ok(log.some(halo), 'my padlock at its door (ui/wild/wildMapInk.js paintWildLocks)');
  log.length = 0;
  M.paintChart(g, M.chartModel({ ...word, vaults: word.vaults.map((t) => ({ ...t, locked: false })) }, view, W, H), W, H);
  assert.ok(!log.some(halo), 'none where no lock holds');
  assert.deepEqual([...M.CHART_VAULT_KEY], ['vault', 'A vault of the deep, open today']);
  assert.match(src('src/ui/etherChartWindow.js'), /vaultItem\.hidden = !word\.vaults\?\.length;/);
});

test('SEA-VAULTS the seams by source: the world host builds the sea\'s ventures over the halls\' own locks, crows and remains, live with the open sea; the hall here a vault first; the door keeps a vault\'s gate past the mask; the crows told on their own ground; the chart\'s word the sea\'s; the social socket asks a sea key of a hub that reads it alone (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const seaVentures = createSeaVentures\(\{\n\s+live: \(\) => etherSea && _onlineWorldSession\(\) && !!online\?\.wildOk, day: wdunDayNow, pixel: playerTravelPixel, locks: _wdunLocks, crows: _wdunCrows, mine: \(\) => _wildMine,\n/);
  assert.match(w, /return seaVentures\.vaultHere\(\) \?\? \(a && p \? wildHallAt\(a, p\.x, p\.y\) : null\);/);
  assert.match(w, /if \(!wildInside\(mask, p\.x, p\.y\) && !seaVentures\.vaultHere\(\)\) return true;/);
  assert.match(w, /const sea = seaVentures\.crowLine\(h\);[^\n]*\n\s*if \(!wildHere\(\) \|\| !!sea !== \(wildZoneKind\(\) === ETHER_KIND\)\) return;/);
  assert.match(w, /const line = sea \?\? `Crows gather over/);
  assert.match(w, /const wdKey = \(\) => \{ const p = playerTravelPixel\(\); return seaVentures\.vaultHere\(\)\?\.key \?\? `\$\{p\.x\},\$\{p\.y\}`; \};/, 'a death after a load names the vault, never its pixel');
  assert.match(w, /return \{ \.\.\.etherHost\.chart\(p\.x, p\.y, heading\(\)\), \.\.\.seaVentures\.chartWord\(\) \};/);
  const o = src('src/net/online.js');
  assert.match(o, /if \(\(seaVaultCell\(w\.h\) \|\| w\.k === 'fk'\) && !this\.wdunSeaOk\) return false;/);   // PIN MOVED (AUDIT SEA VENTURES A10): and a fleet's sinking
  assert.match(o, /this\.wdunSeaOk = relaySupportsWdunSea\(relayV\);/);
  assert.match(src('src/systems/sea/seaSpoils.js'), /export const seaPileSource = \(loc\) => \(loc\?\.ether && loc\.wildRing > 0 \? 'vault' : 'ruin'\);/);
});

test('SEA-VAULTS the open sea keeps no instance: an isle\'s dungeon room read back to its cell (seaVaultMapId\'s inverse) and nothing else\'s; the relay refuses an instance of one to everyone, staff and owner alike, its public room as it was; the page\'s door never keys one; the host\'s `wild` the open sea\'s too (mutants: the inverse\'s bounds, the relay\'s refusal, the door, the open sea)', async () => {
  for (const [cx, cy] of [[723, 240], [0, 0], [805, 498], [400, 13]]) assert.deepEqual(seaRoomCell(`dungeon:m${seaVaultMapId(cx, cy)}`), [cx, cy], `${cx},${cy}`);
  assert.equal(seaRoomCell(wdunRoomKey('210,99')), null, 'a mountain hall\'s');
  assert.equal(seaRoomCell('dungeon:m187853213'), null, 'a dungeon of the map\'s');
  assert.equal(seaRoomCell(`dungeon:m${(0xe6 << 20) | 500005}`), null, 'another lane\'s, though its low bits read as a cell');
  assert.equal(seaRoomCell(`dungeon:m${(0xe7 << 20) | 499999}`), null, 'under the isles\' 500,000');
  assert.equal(seaRoomCell(`dungeon:m${(0xe7 << 20) | (500000 + WDUN_SEA_CELLS_W * WDUN_SEA_CELLS_H)}`), null, 'past the lattice\'s last row');
  assert.deepEqual(seaRoomCell(`dungeon:m${(0xe7 << 20) | (500000 + WDUN_SEA_CELLS_W * WDUN_SEA_CELLS_H - 1)}`), [WDUN_SEA_CELLS_W - 1, WDUN_SEA_CELLS_H - 1], 'its last cell');
  for (const bad of [`dungeon:m${seaVaultMapId(1, 2)}.m`, `interior:m${seaVaultMapId(1, 2)}`, 'dungeon:m0', 'dungeon:m', null, 7]) assert.equal(seaRoomCell(bad), null, String(bad));

  const base = `dungeon:m${seaVaultMapId(723, 240)}`;
  const key = instanceRoomOf(base, { owner: await instanceOwnerOf('acct-alice'), epoch: '89abcdef' });
  assert.ok(key, 'the law keys it (the page never asks one)');
  const r = fakeRoom(key);
  const refusal = (ws) => ws.sent.find((m) => m.t === 'error')?.m ?? null;
  const alice = r.connect(); await r.hello(alice, 'alice');
  assert.equal(refusal(alice), INSTANCE_DOOR_WORD, 'its owner');
  const staff = r.connect(); await r.hello(staff, 'mod1', null, { glyphs: ['dev'] });
  assert.equal(refusal(staff), INSTANCE_DOOR_WORD, 'staff');
  const pub = fakeRoom(base);
  const carol = pub.connect(); await pub.hello(carol, 'carol');
  assert.ok(carol.sent.some((m) => m.t === 'welcome'), 'its public room is as it was');

  const d = createInstanceDoor({ online: () => true, instanceOk: () => true, account: () => 'acct-alice', character: () => 'char_alice', members: () => [], questMachine: () => null, openOverlay: () => true, say: () => {}, wild: () => false });
  const isle = { siteType: SITE_TYPES.Dungeon, mapId: seaVaultMapId(723, 240), buildingKey: 0, layout: null, isHold: false, home: false, name: '' };
  const word = instanceWord({ owner: await instanceOwnerOf('acct-alice'), epoch: '89abcdef' });
  assert.deepEqual(await d.entryFor(isle, { ins: word, staff: true }), { instance: null, whole: true }, 'an isle\'s dungeon keeps none, at the peace\'s edge as past it');

  const st = { live: true };
  const sea = createSeaVentures({ live: () => st.live, day: () => DAY, pixel: () => null, locks: new Map(), crows: new Map(), mine: () => null });
  const v = seaVaultPicks(DAY);
  assert.equal(sea.openSeaAt({ x: v[0].x, y: v[0].y }), true, 'a vault\'s isle');
  assert.equal(sea.openSeaAt({ x: v[0].x + 3, y: v[0].y }), true, 'any water of the deep');
  assert.equal(sea.openSeaAt({ x: veilhaven().px, y: veilhaven().py }), false, 'Veilhaven\'s peace');
  assert.equal(sea.openSeaAt({ x: 500, y: 250 }), false, 'the Bay');
  assert.equal(sea.openSeaAt(null), false);
  st.live = false;
  assert.equal(sea.openSeaAt({ x: v[0].x, y: v[0].y }), false, 'offline: the sea is no zone');
  assert.match(src('src/scenes/world.js'), /wild: \(\) => \{ const m = wildMapMask\(\), p = playerTravelPixel\(\); return \(!!m && wildInside\(m, p\.x, p\.y\)\) \|\| seaVentures\.openSeaAt\(p\); \}/);
});
