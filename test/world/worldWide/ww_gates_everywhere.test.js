// WW-GATES-EVERYWHERE (2026-10-26, the owner after the audit "no system left behind in the Bay": "Every single thing here
// needs to be addressed. No exceptions."; bible/03-World/World-Wide.md WW-GATES-EVERYWHERE): AN OBLIVION GATE IN EVERY
// PROVINCE - the lanes of the eight provinces past the Bay stand (net/wire.js GATE_LANES_OPEN), Cyrodiil's never; a gate
// stands, is entered and falls past the Bay through the real modules (the theatres' scans over the registry with TESA's
// places on the freeware, the omen, the relay's Room, the account service); a province's kill counts at its own
// province's seats (A2b, scenes/gate/gateSeat.js); the province scans made in the page's idle moments, never at once
// (A2c, scenes/gate/gateLanes.js, systems/gate/theatreGateSite.js theatreGateScanner). tools/mutants/ww_gates_everywhere.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import {
  gateNumber, gateLaneOf, gateTimes, gateAdmits, gateHolds, gateRoomKey, GATE_LANES_OPEN, gateLaneOpen, GATE_COLLAPSE_MS, gameDayAt, gateFrontDay,
} from '../../../src/net/gate/gateLaw.js';
import { frontStands } from '../../../src/net/frontLaw.js';
import { gateNumberOk, gatePixelOk, gateLaneKey, gateReceiptKey, validGateIn, validRiteIn, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { agreedGateSite, omenPost } from '../../../src/net/gate/gateHerald.js';
import { gateRegionOk, seatReportText, seatWeekOf } from '../../../src/net/townSeatLaw.js';
import { regionOfTheatre, REGION_NAMES } from '../../../src/formats/mapsTables.js';
import { gateSeatRegion, gateClaimWaits } from '../../../src/scenes/gate/gateSeat.js';
import { createGateLanes, createTheatreGateScans, pageIdle, SCAN_FORCED_SLICE_MS } from '../../../src/scenes/gate/gateLanes.js';
import { scanTheatreGate, theatreGateScanner, findTheatreGateSite, theatreGateAreas, THEATRE_SCAN_STEP } from '../../../src/systems/gate/theatreGateSite.js';
import { gateArenaLocation } from '../../../src/world/gate/gateArena.js';
import { createWorldPlaces } from '../../../src/world/worldWide/worldPlaces.js';
import { theatreAt, areaAt, THEATRE_KEYS } from '../../../src/world/worldWide/worldGrid.js';
import { CYRODIIL_THEATRE } from '../../../src/systems/wild/cyrodiilZone.js';
import { CITIES } from '../../../src/world/tamriel/tamrielGeography.js';
import { pictureToBay, inBay, setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { LOCATION_TYPES } from '../../../src/formats/mapsFile.js';
import { mintReceipt, verifyReceipt } from '../../../src/net/gate/gateReceipt.js';
import { COURT_CENTRE, BRAIN_TICK_MS } from '../../../src/net/gate/gateBrain.js';
import { GATE_BRAIN_V } from '../../../src/net/wire.js';
import worker from '../../../server/src/index.js';
import { fakeRoom, fakeRooms } from '../../fakeRoom.mjs';
import { standService, T0 } from '../../accountDb.mjs';
import { codeOnly } from '../../codeOnly.mjs';

const subtle = webcrypto.subtle;
const ARENA2 = process.env.ARENA2_PATH ?? '';
const HAVE = !!ARENA2 && existsSync(join(ARENA2, 'MAPS.BSA'));
const src = (p) => codeOnly(readFileSync(new URL('../../../' + p, import.meta.url), 'utf8'));
const PROVINCES = [1, 2, 3, 4, 5, 6, 7, 8];
/** FRONTS (bible/03-World/World-Wide.md FRONTS): the first gate day from `d` on whose gate stands on `lane` - its province's
 *  turn, read off the front law and the day the gate opens in (`d` itself outside the fronts). */
const stirredDay = (d, lane) => { while (!frontStands(gateFrontDay(gateNumber(d, lane)), lane)) d++; return d; };
const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };

// ─── the lanes that stand ───────────────────────────────────────────────────────────────────────

test('WW-GATES-EVERYWHERE THE LANES THAT STAND: the Bay\'s and the eight provinces\' (1 to 8), Cyrodiil\'s never - each province\'s gate admitted, held, its number and its world pixel taken on the wire, its spent word heard; the open zone\'s refused at every door (mutants: a province\'s lane shut; Cyrodiil\'s opened)', () => {
  assert.deepEqual(GATE_LANES_OPEN, [0, ...PROVINCES]);
  assert.equal(CYRODIIL_THEATRE, 9);
  const day = 900;
  for (const lane of [...PROVINCES, CYRODIIL_THEATRE]) {
    const n = gateNumber(stirredDay(day, lane), lane), t = gateTimes(n), open = lane !== CYRODIIL_THEATRE;   // PIN MOVED: FRONTS - each on its turn
    assert.deepEqual([gateLaneOpen(lane), gateNumberOk(n), gateAdmits(n, t.openAt + 1), gateHolds(n, t.sealAt + 1), gatePixelOk(n, -1200, 300),
      !!validGateIn({ k: 'site', d: n, px: -1200, py: 300, pl: 'Solitude, Skyrim' }), !!validGateIn({ k: 'spent', d: n }), !!validRiteIn({ d: n, px: -1200, py: 300, s: 0, f: 0 })],
    Array(8).fill(open), `lane ${lane}`);
    assert.equal(gatePixelOk(n, 500, 200), false, `lane ${lane}: never a pixel of the Bay's map`);
  }
  assert.equal(gateAdmits(gateNumber(day, 0), gateTimes(gateNumber(day, 0)).openAt + 1), true, 'the Bay\'s, as always');
  // FRONTS: off its turn a province's gate admits and holds no one, its lane open all the same
  for (const lane of PROVINCES) {
    let d = day;
    while (frontStands(gateFrontDay(gateNumber(d, lane)), lane)) d++;
    const n = gateNumber(d, lane), t = gateTimes(n);
    assert.deepEqual([gateLaneOpen(lane), gateAdmits(n, t.openAt + 1), gateHolds(n, t.sealAt + 1)], [true, false, false], `lane ${lane} off its turn`);
  }
});

// ─── A2b: the seats ─────────────────────────────────────────────────────────────────────────────

test('WW-GATES-EVERYWHERE A2b: A PROVINCE\'S GATE\'S KILL NAMES ITS OWN PROVINCE - the client\'s region for a lane past the Bay is its province\'s (WW-R\'s 62 to 69), with no scan asked and no wait on the Bay\'s; the Bay\'s lane\'s its scan\'s, waiting for it; the account\'s law takes exactly that (mutants: the lane\'s region the Bay\'s none; the wait the Bay\'s for every lane)', () => {
  const day = 900;
  for (const lane of PROVINCES) {
    const n = gateNumber(day, lane);
    assert.deepEqual([gateSeatRegion(n, null), gateClaimWaits(n, null), gateRegionOk(n, gateSeatRegion(n, null))], [61 + lane, false, true], `lane ${lane}`);
    assert.equal(REGION_NAMES[gateSeatRegion(n, null)], ['High Rock', 'Hammerfell', 'Skyrim', 'Morrowind', 'Sumurset Isle', 'Valenwood', 'Elsweyr', 'Black Marsh'][lane - 1]);
  }
  // the Bay's lane: its scan's region, and a wait while it is not done
  const scan = { byRegion: new Map([[17, Int32Array.from(Array.from({ length: 30 }, (_, i) => 300 * 1000 + 200 + i))]]), towns: [{ name: 'Daggerfall', px: 207, py: 213, region: 17 }], townAt: new Int32Array(1000 * 500).fill(0) };
  assert.deepEqual([gateSeatRegion(day, null), gateClaimWaits(day, null), gateSeatRegion(day, scan), gateClaimWaits(day, scan)], [null, true, 17, false]);
  assert.deepEqual([gateSeatRegion(undefined, null), gateClaimWaits(undefined, null)], [null, true], 'no number: the Bay\'s wait, as before');
  // the host's two lines (scenes/world.js gateSeatWord, gateClaimReady)
  const w = src('src/scenes/world.js');
  assert.match(w, /try \{ region = c \? gateSeatRegion\(c\.d, _gateScan\) : null; \} catch \{ region = null; \}/);
  assert.match(w, /return region != null \? \{ region, character \} : character \? \{ character \} : null;/);
  assert.match(w, /if \(!gateClaimWaits\(readReceipt\(r\)\?\.d, _gateScan\) \|\| Date\.now\(\) - _gateClaimsFrom >= GATE_SCAN_WAIT_MS\) return true;/);
  assert.match(w, /claim: \(r\) => \(gateClaimReady\(r\) \? _accountGates\.claim\(r, gateSeatWord\(r\)\)/);
});

test('WW-GATES-EVERYWHERE A2b THE SERVICE: a Skyrim gate\'s kill, its region Skyrim\'s, counts for the guild pledged at Solitude - three agreeing claims 300 influence; the same gate named in a Bay region or another province\'s is no seat\'s, its refusal named for what it is (mutants: the lane\'s province unasked; the refusal\'s word)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const SOLITUDE = { key: 0xa7_70000, name: 'Solitude', region: 64, tier: 'crown', pixel: [1600, 30] };
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(SOLITUDE.key), w.id, seatReportText(SOLITUDE), SOLITUDE.region, T0 - 86400);
  const gm = await svc.seated('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'Silver Hand', tag: 'SH' })).status, 200);
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE player = ?').run(T0 - 9 * 86400, gm.id);
  now += 120;   // the seats' kept rows read again
  const pledged = await svc.call('/v1/seats/pledge', { character: gm.character, key: SOLITUDE.key }, gm.secret);
  assert.equal(pledged.status, 200, JSON.stringify(pledged.body));
  assert.deepEqual(pledged.body.pledges.map((x) => [x.region, x.key]), [[64, SOLITUDE.key]], 'pledged at Solitude, in Skyrim');
  const skyrim = THEATRE_KEYS.indexOf('Skyrim');
  const today = gameDayAt(now * 1000, skyrim);
  const day = [today - 1, today, today - 2].find((d) => seatWeekOf(gateTimes(gateNumber(d, skyrim)).riseAt) === seatWeekOf(now * 1000));
  const n = gateNumber(day, skyrim);
  const kill = async (who, region) => svc.call('/v1/gate/claim', {
    receipt: await mintReceipt({ d: n, b: 'ruhn', s: who.id, c: 4242, x: 'dealt' }, svc.gateKey, { subtle, nowS: now }), region, character: who.character,
  }, who.secret);
  const first = await kill(gm, gateSeatRegion(n, null));
  assert.deepEqual(first.body.seat, { counted: true, key: SOLITUDE.key }, 'the kill written for the pledge at Solitude');
  const others = [];
  for (const h of ['Adala', 'Bodil', 'Cyril', 'Dinah']) others.push(await svc.seated(h));
  await kill(others[0], 64); await kill(others[1], 64);
  const standings = (await svc.call('/v1/seats/standings', { key: SOLITUDE.key, character: gm.character }, gm.secret)).body;
  assert.equal(standings.standings[0].influence, 300, 'three agree on Skyrim: 300');
  assert.deepEqual((await kill(others[2], 21)).body.seat, { counted: false, why: 'not-its-region' }, 'a Bay region for a province\'s gate');
  assert.deepEqual((await kill(others[3], 65)).body.seat, { counted: false, why: 'not-its-region' }, 'another province\'s');
  assert.equal(raw.prepare('SELECT region FROM gate_kills WHERE day = ? AND account = ?').get(n, others[2].id).region, null, 'and its row keeps no region');
});

// ─── the relay: a gate past the Bay stands, is entered and falls ────────────────────────────────

test('WW-GATES-EVERYWHERE THE RELAY: a Skyrim gate\'s court is minted at its opening and admits its fighters; its Warden falls, a receipt names the gate\'s number; the night\'s fall is kept on Skyrim\'s lane and handed at a hello; its site agreed by two accounts and its omen posted with its place; the open zone\'s court never minted (mutants: a province\'s lane shut)', async () => {
  const lane = THEATRE_KEYS.indexOf('Skyrim'), DAY = stirredDay(538, lane), n = gateNumber(DAY, lane), TT = gateTimes(n);   // PIN MOVED: FRONTS - a day of Skyrim's turn
  const realNow = Date.now;
  try {
    // THE WINDOW: the Worker mints the province's court at its opening, never the open zone's
    let minted = 0;
    const env = { ROOMS: { idFromName: () => { minted++; return 'id'; }, get: () => ({ fetch: async () => new Response('ok') }) } };
    const upgrade = (key) => new Request(`https://relay.test/room/${key}`, { headers: { Upgrade: 'websocket' } });
    Date.now = () => TT.openAt;
    assert.equal((await worker.fetch(upgrade(gateRoomKey(n)), env)).status, 200, 'Skyrim\'s court');
    const zone = gateNumber(DAY, CYRODIIL_THEATRE);
    Date.now = () => gateTimes(zone).openAt;
    assert.equal((await worker.fetch(upgrade(gateRoomKey(zone)), env)).status, 404, 'the open zone stands no gate');
    assert.equal(minted, 1);
    // THE FIGHT: in, the Warden down, the receipt
    let clock = TT.openAt + 1000;
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(gateRoomKey(n));
    const hub = world.room(SOCIAL_ROOM);
    const h9 = hub.connect(); await hub.hello(h9, 'peer-0009');
    const at = { x: COURT_CENTRE[0], y: 0, z: COURT_CENTRE[2] + 3, yaw: 0, pitch: 0 };
    const a = r.connect(); await r.hello(a, 'peer-0001', at);
    assert.equal(a.sent[0].t, 'welcome', 'admitted to Skyrim\'s court');
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    await say(a, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    const st = a.sent.find((m) => m.t === 'gate' && m.k === 'st');
    assert.equal(st.d, n, 'the fight is Skyrim\'s gate\'s');
    clock += BRAIN_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire();
    r.room._fight.hp = 5;
    await say(a, { k: 'hit', q: 1, d: 40, r: 2 });
    const fell = a.sent.filter((m) => m.t === 'gate' && m.k === 'fell');
    assert.equal(fell.length, 1, 'he fell');
    const rc = a.sent.filter((m) => m.t === 'gate' && m.k === 'rcpt');
    assert.equal(rc.length, 1, 'a receipt');
    assert.equal(JSON.parse(Buffer.from(rc[0].r.split('.')[1], 'base64url').toString()).d, n, 'naming Skyrim\'s gate by its number');
    // THE NIGHT, AT THE SEAL: kept on Skyrim's lane, never the Bay's, and handed at a hello
    clock = TT.sealAt; await r.fire();
    assert.equal(hub.store.get(gateLaneKey('gatefell', lane))?.d, n, 'on its lane\'s key');
    assert.equal(hub.store.get(gateLaneKey('gatefell', 0)), undefined, 'never the Bay\'s');
    const late = hub.connect(); await hub.hello(late, 'peer-0006');
    assert.deepEqual(late.sent.filter((m) => m.t === 'gate' && m.k === 'fell').map((m) => m.d), [n], 'a hello hears it');
    assert.equal(hub.store.has(gateReceiptKey('acct-peer-0001', lane)), true, 'the earner\'s receipt kept on its lane');
  } finally { Date.now = realNow; }
  // THE HERALD: the site two accounts agree on, the omen posted with its place
  const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
  const hr = fakeRoom(SOCIAL_ROOM);
  Object.assign(hr.env, { GATE_DISCORD_WEBHOOK: HOOK });
  for (const k of ['_serpentHeraldBeat', '_serpentHeraldArm', '_sdBeat', '_sdHeraldArm', '_ktHeraldArm', '_ktHeraldBeat', '_egHeraldBeat']) if (typeof hr.room[k] === 'function') hr.room[k] = async () => {};
  const realFetch = globalThis.fetch;
  let clock = TT.omenAt - 10 * 60_000;
  const posts = [];
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => { posts.push(JSON.parse(init.body)); return { ok: true, status: 204 }; };
  try {
    await quiet(async () => {
      const join = async (k) => { const ws = hr.connect(); await hr.hello(ws, `peer-${k}`, null, { name: k, acct: `acct-${k}`, asecret: `secret-of-acct-${k}` }); clock += 10; return ws; };
      const x = await join('x'), y = await join('y');
      const site = (ws) => hr.raw(ws, JSON.stringify({ t: 'gate', k: 'site', d: n, px: 1700, py: -20, pl: 'Morthal, Skyrim' }));
      await site(x); await site(y);
      assert.deepEqual(agreedGateSite(hr.store.get(gateLaneKey('gatesite', lane)), n), { px: 1700, py: -20, pl: 'Morthal, Skyrim' }, 'two accounts agree where Skyrim\'s gate stands');
      clock = TT.omenAt; await hr.fire();
      assert.deepEqual(posts.filter((p) => JSON.stringify(p).includes('Morthal')), [omenPost({ day: n, place: 'Morthal, Skyrim', role: null })], 'its omen posted, named');
      assert.equal(hr.store.get(gateLaneKey('herald', lane))?.omen, n);
    });
  } finally { Date.now = realNow; globalThis.fetch = realFetch; }
});

// ─── the court past the Bay ─────────────────────────────────────────────────────────────────────

test('WW-GATES-EVERYWHERE THE COURT: a province\'s gate\'s court is laid in its province (its region WW-R\'s, its name the province\'s) - the site\'s own region, which the host hands the court; the clearing stays the Bay\'s lane\'s, World of Daggerfall\'s rock standing on the Bay alone (mutants: the site\'s region past the Bay)', () => {
  const skyrim = THEATRE_KEYS.indexOf('Skyrim');
  const towns = CITIES.filter((c) => c.province === 'Skyrim').map((c, i) => { const [px, py] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { mapId: 70_000 + i, name: c.name, px, py, type: LOCATION_TYPES.TownCity }; }).filter((r) => !inBay(r.px, r.py));
  const places = createWorldPlaces();
  places.register('beyond', towns);
  const scans = createTheatreGateScans({ places, wet: () => false, idle: null });
  const n = gateNumber(900, skyrim), site = scans.siteOf(n);
  assert.deepEqual([site.region, site.regionName, site.town.region], [64, 'Skyrim', 64]);
  const court = gateArenaLocation({ day: n, near: site.near, regionIndex: site.region, regionName: site.regionName });
  assert.deepEqual([court.regionIndex, court.regionName, court.gate], [64, 'Skyrim', n]);
  const w = src('src/scenes/world.js');
  assert.match(w, /const site = gateOmen\?\.siteOf\?\.\(g\.day\);\s+const mine = site\?\.day === g\.day;\n\s+return \{ climateBase: climateType, season: INTERIOR_SEASON, climate: \{ worldClimate: ci, climateType \}, regionIndex: mine \? site\.region : -1, regionName: mine \? site\.regionName : '' \};/, 'the host lays the court in the site\'s region');
  assert.match(w, /if \(gateOmen\) _gateClearNow = \(\) => \{\n\s+if \(!_gateScan\) return null;\n\s+const day = gateAt\(Date\.now\(\) \+ _sharedOffsetMs\)\.day;/, 'the clearing the Bay\'s lane\'s');
});

// ─── A2c: the scans in the page's idle moments ──────────────────────────────────────────────────

/** A province's towns from TAMRIEL1's cities (the authored shape), off the Bay. */
const provinceRows = (province, base) => CITIES.filter((c) => c.province === province).map((c, i) => { const [px, py] = pictureToBay(c.at[0], c.at[1]).map(Math.floor); return { mapId: base + i, name: c.name, px, py, type: LOCATION_TYPES.TownCity }; }).filter((r) => !inBay(r.px, r.py));

test('WW-GATES-EVERYWHERE A2c THE SCANS A SLICE AT A TIME: a theatre\'s scan walked THEATRE_SCAN_STEP ring pixels between asks is the scan made at once, list for list and town for town; the host\'s scans in the page\'s idle moments - the first ask none, each lane standing once its scan is whole, every slice\'s work bounded, the lanes all standing at the last; a new registry generation warms again; a page with no idle callback slices on a timer, a probe with no page scans at once (mutants: the slice\'s bound; the warm\'s slice given back; the scan at once on a page)', () => {
  setTamrielTrace(null); setTamrielFit(null);
  const places = createWorldPlaces();
  places.register('tesa', [...provinceRows('Skyrim', 50_000), ...provinceRows('Morrowind', 51_000), ...provinceRows('Valenwood', 52_000)]);
  const sky = THEATRE_KEYS.indexOf('Skyrim'), mor = THEATRE_KEYS.indexOf('Morrowind'), val = THEATRE_KEYS.indexOf('Valenwood');
  // the stepper is the scan
  const opts = (t) => ({ towns: places.inTheatre(t), placeAt: places.at, inTheatre: (x, y) => theatreAt(x, y) === t, areaAt: (x, y) => areaAt(x, y, () => -1), wet: () => false, theatre: t });
  const whole = scanTheatreGate(opts(sky));
  let asks = 0, steps = 0;
  const askedAt = new Set();
  const counted = { ...opts(sky), placeAt: (x, y) => { asks++; askedAt.add(`${x},${y}`); return places.at(x, y); } };
  const sc = theatreGateScanner(counted);
  let out = null, worst = 0;
  while (!out) { const before = asks; out = sc.step(() => false); steps++; worst = Math.max(worst, asks - before); }
  assert.ok(steps > 50, `${steps} slices`);
  assert.ok(worst <= THEATRE_SCAN_STEP * 9 + 1, `a slice's asks bounded (${worst})`);
  assert.deepEqual([...out.byArea].map(([a, l]) => [a, [...l]]), [...whole.byArea].map(([a, l]) => [a, [...l]]), 'the same lists');
  assert.deepEqual([out.towns, [...out.townOf]], [whole.towns, [...whole.townOf]], 'the same towns');
  assert.equal(asks, askedAt.size, 'each pixel\'s place asked once a scan');
  // a slice the idle callback's timeout forced walks SCAN_FORCED_SLICE_MS of the clock, a step at a time
  {
    let clock = 0, made = 0;
    const qq = [];
    const forced = createTheatreGateScans({ places: { generation: places.generation, theatres: places.theatres, at: places.at, inTheatre: (t) => { made++; return places.inTheatre(t); } }, wet: () => false, idle: (fn) => qq.push(fn), clock: () => clock++ });
    forced.theatres();
    let firstSteps = 0;
    const tick = clock;
    qq.shift()({ didTimeout: true, timeRemaining: () => 0 });
    firstSteps = clock - tick;
    assert.ok(firstSteps >= SCAN_FORCED_SLICE_MS, `the forced slice walked ${firstSteps} clock ticks`);
    assert.equal(made, 1, 'one lane begun');
  }
  // a slice whose idle moment is spent gives it back on finishing a lane - the next lane's scan begins in the next one
  {
    const qq = [], log = [];
    let slice = 0;
    const lanes = createTheatreGateScans({ places: { generation: places.generation, theatres: places.theatres, at: places.at, inTheatre: (t) => { log.push([slice, 'began', t]); return places.inTheatre(t); } }, wet: () => false, idle: (fn) => qq.push(fn), clock: () => 0 });
    lanes.theatres();
    let had = 0;
    while (qq.length) {
      slice++;
      qq.shift()({ didTimeout: false, timeRemaining: () => 0 });
      const n = lanes.theatres().length;
      if (n > had) log.push([slice, 'whole', n]);
      had = n;
    }
    const wholeAt = log.filter((e) => e[1] === 'whole').map((e) => e[0]), beganAt = log.filter((e) => e[1] === 'began').map((e) => e[0]);
    assert.deepEqual(beganAt.length, 3);
    for (const w of wholeAt.slice(0, -1)) assert.ok(!beganAt.includes(w), `slice ${w}: a lane made whole, the next begun in the next slice`);
  }
  // the host's scans, warmed
  const queue = [];
  const idle = (fn) => queue.push(fn);
  const scans = createTheatreGateScans({ places, wet: () => false, idle, clock: () => 0 });
  assert.deepEqual(scans.theatres(), [], 'the first ask: none whole yet');
  assert.equal(queue.length, 1, 'the warm begun');
  assert.equal(scans.siteOf(gateNumber(900, sky)), null, 'no site off a scan not whole');
  let slices = 0;
  const seen = [];
  while (queue.length) {
    let left = 3;
    queue.shift()({ didTimeout: false, timeRemaining: () => (left-- > 0 ? 10 : 0) });
    slices++;
    const now = scans.theatres();
    if (!seen.length || seen.at(-1).join() !== now.join()) seen.push(now);
  }
  assert.ok(slices > 30, `${slices} idle moments`);
  assert.deepEqual(seen, [[], [sky], [sky, mor], [sky, mor, val]], 'a lane at a time, ascending, each once its scan is whole');
  assert.deepEqual(scans.siteOf(gateNumber(900, sky)), findTheatreGateSite(gateNumber(900, sky), whole), 'the site the scan at once draws');
  assert.equal(scans.theatres(), scans.theatres(), 'kept for the generation');
  places.register('more', provinceRows('Elsweyr', 53_000));
  assert.deepEqual(scans.theatres(), [], 'a new generation: warmed again');
  assert.equal(queue.length, 1);
  // the page's idle moments
  const g = /** @type {any} */ (globalThis);
  const had = { ric: g.requestIdleCallback, doc: g.document };
  try {
    g.requestIdleCallback = undefined; g.document = undefined;
    assert.equal(pageIdle(), null, 'no page: none - a scan made whole when asked');
    g.document = {};
    assert.equal(typeof pageIdle(), 'function', 'a page with no idle callback: a timer\'s slice');
    let asked = null;
    g.requestIdleCallback = (fn, o) => { asked = o; };
    pageIdle()(() => {}, { timeout: 4000 });
    assert.deepEqual(asked, { timeout: 4000 }, 'the browser\'s own');
  } finally { g.requestIdleCallback = had.ric; g.document = had.doc; }
  const sync = createTheatreGateScans({ places, wet: () => false, idle: null });
  assert.deepEqual(sync.theatres(), [sky, mor, val, THEATRE_KEYS.indexOf('Elsweyr')].sort((a, b) => a - b), 'no idle moments: made at once, as before');
});

// ─── the freeware: a gate stands in every province ──────────────────────────────────────────────

test('WW-GATES-EVERYWHERE (ARENA2) A GATE STANDS IN EVERY PROVINCE: over the registry the host stands (the Bay\'s rows, TESA\'s places, the countryside\'s and the lairs\' rolls) the host\'s scans find ground in all eight provinces and none in the open zone; each lane\'s gate stands in its own theatre at its own province\'s region, its omen said on its own card and its ring on the map, standing for the player beside it; the warm in idle moments finds the same', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (f) => new Uint8Array(readFileSync(join(ARENA2, f)));
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { tamrielLandVersion } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { WoodsFile } = await import('../../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { groundWoods, groundMaps, tamrielClimateAt, dropGroundCache } = await import('../../../src/world/tamriel/tamrielGround.js');
  const { gateSeaPixel } = await import('../../../src/systems/gate/gateSite.js');
  const { isMainStoryDungeon } = await import('../../../src/world/dungeon/dungeonTextures.js');
  const { isWaterPixel } = await import('../../../src/ui/overworldModel.js');
  const C = await import('../../../src/world/tamrielCountry.js');
  const D = await import('../../../src/world/tamrielDungeons.js');
  const { arenaTemplates, arenaTemplateOf } = await import('../../../src/world/arenaLocations.js');
  const { arenaPixels } = await import('../../../src/world/arenaPlaces.js');
  const { bayPlaceRows, BAY_SOURCE } = await import('../../../src/world/worldWide/bayPlaces.js');
  const { pastBayPlaceRows, PAST_BAY_SOURCE } = await import('../../../src/world/pastBayRows.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (f) => bytes(f), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
    const ground = groundWoods(woods);
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const climate = (x, y) => maps.getClimateIndex(x, y);
    const land = C.bayLand(climate, (x, y, c) => isWaterPixel(c, woods.getHeightMapValue(x, y)));
    const cT = C.countryTemplates(rows, isMainStoryDungeon), lT = D.lairTemplates(rows, isMainStoryDungeon), aT = arenaTemplates(rows, isMainStoryDungeon);
    const plateau = C.createCountryGround(ground);
    const at = { climateAt: climate, heightAt: (x, y) => ground.getHeightMapValue(x, y), ground: plateau };
    const country = { ...at, rates: C.countryRates(C.countryCounts(cT, climate), land), templates: cT };
    const lairs = { ...at, rates: C.countryRates(C.countryCounts(lT, climate), land, D.LAIR_TYPES), templates: lT };
    const places = createWorldPlaces();
    places.register(BAY_SOURCE, bayPlaceRows(rows.filter((l) => l?.exterior?.exteriorData)));
    places.registerLive(PAST_BAY_SOURCE, { stamp: () => [arenaPixels()], rows: () => pastBayPlaceRows({ pixels: arenaPixels(), templateOf: (p) => arenaTemplateOf(aT, p), capitals: true }) });
    places.registerPixels('tesa-country', (px, py) => { if (inBay(px, py)) return null; const pick = C.countryStandsAt(country, px, py); return pick && { mapId: C.countryPlaceId(C.countryOrdinal(px, py)), name: '', px, py, type: pick.type }; });
    places.registerPixels('tesa-lairs', (px, py) => { if (inBay(px, py)) return null; const a = D.lairStandsAt(lairs, px, py); return a && { mapId: D.lairPlaceId(a.c), name: '', px, py, type: a.pick.type, hasDungeon: true }; });
    // the host's wet: the one water law on the composed ground (scenes/world.js theatreGates)
    const wet = (x, y) => gateSeaPixel(tamrielClimateAt(x, y), ground.getHeightMapValue(x, y));
    const t0 = performance.now();
    const scans = createTheatreGateScans({ places, wet, land: tamrielLandVersion, idle: null });
    assert.deepEqual(scans.theatres(), PROVINCES, 'ground for a gate in all eight provinces, none in the open zone');
    const atOnce = performance.now() - t0;
    const day = 900;
    for (const lane of PROVINCES) {
      for (const d of [day, day + 1, day + 2]) {
        const n = gateNumber(d, lane), s = scans.siteOf(n);
        assert.ok(s, `lane ${lane} day ${d}: a site`);
        assert.deepEqual([s.day, s.theatre, theatreAt(s.px, s.py), s.region, inBay(s.px, s.py), wet(s.px, s.py), places.at(s.px, s.py)], [n, lane, lane, regionOfTheatre(lane), false, false, null], `lane ${lane} day ${d}`);
        assert.ok(s.place.endsWith(`, ${REGION_NAMES[regionOfTheatre(lane)]}`), s.place);
      }
    }
    // the omen of every lane: its gate standing, its lines on its own card, its ring on the map
    const lanesSaid = new Map();
    let now = 0, here = null;
    const gates = createGateLanes({
      omen: { now: () => now, say: (text, n) => { const l = gateLaneOf(n); lanesSaid.set(l, [...(lanesSaid.get(l) ?? []), n]); }, localTime: () => '20:00' },
      bayGateSite: () => null, scans, lanesOk: () => true, here: () => here,
    });
    // PIN MOVED: FRONTS - each province's gate on its turn, the lanes taken in the order their gates open, so the clock
    // runs forward and a lane's omen speaks of no gate but the one asked of it
    const turns = PROVINCES.map((lane) => gateNumber(stirredDay(day, lane), lane)).sort((a, b) => gateTimes(a).openAt - gateTimes(b).openAt);
    for (const n of turns) {
      const lane = gateLaneOf(n), s = scans.siteOf(n);
      now = gateTimes(n).openAt + 60_000; here = { x: s.px, y: s.py };
      gates.frame();
      assert.deepEqual(gates.lanes(), [0, ...PROVINCES]);
      const g = gates.standing();
      assert.deepEqual([g?.day, g?.px, g?.py, g?.phase], [n, s.px, s.py, 'open'], `lane ${lane}: its gate stands where the player is`);
      assert.ok(gates.mapMarks().some((m) => m.day === n), `lane ${lane}: its ring`);
      assert.ok((lanesSaid.get(lane) ?? []).every((x) => x === n) && lanesSaid.get(lane)?.length > 0, `lane ${lane}: its lines on its own card`);
      assert.equal(gates.siteOf(n).region, regionOfTheatre(lane));
    }
    // the warm, a slice an idle moment: the same theatres, the same sites
    const queue = [];
    const warm = createTheatreGateScans({ places, wet, land: tamrielLandVersion, idle: (fn) => queue.push(fn) });
    warm.theatres();
    let slices = 0, longest = 0;
    while (queue.length) { const s0 = performance.now(); queue.shift()({ didTimeout: false, timeRemaining: () => Math.max(0, 8 - (performance.now() - s0)) }); slices++; longest = Math.max(longest, performance.now() - s0); }
    assert.deepEqual(warm.theatres(), PROVINCES);
    for (const lane of PROVINCES) assert.deepEqual(warm.siteOf(gateNumber(day, lane)), scans.siteOf(gateNumber(day, lane)), `lane ${lane}: the warm's site the same`);
    console.log(`[ww-gates-everywhere] the eight provinces' scans at once ${atOnce.toFixed(0)} ms; warmed in ${slices} idle moments of 8 ms, the longest ${longest.toFixed(1)} ms`);
  } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
});
