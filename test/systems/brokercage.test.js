// BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all the
// enemies are cleared"; asked, "The rite's faithful", "Stays caged", "Until midnight"): THE SIGIL BROKER CAGED AT THE
// FAITHFUL'S CIRCLE. The law (net/gate/gateRite.js riteRosterFell, cageStands), the wire (net/wire.js validRiteIn `c`,
// validRiteOut `cl`), the rite's host (scenes/riteHost.js - its word's `c`, the hub's cleared word, no faithful stood
// once it is said, isCleared), the omen's cage site (systems/gate/gateOmen.js cageSite - a Warden fallen early never takes her),
// the relay (server/src/index.js - the cell keeps the cleared rite and tells the hub, the hub says it to everyone and at
// every hello until midnight) and the cage itself (world/cageModel.js). Her place, her door, her box and her press in
// the world: test/player/set7_broker_world.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riteFaithfulOf, riteRosterFell, cageStands, riteNativeOf, riteLocalOf, RITE_UNITS_PER_M, RITE_GRACE_MS, RITE_CAREERS } from '../../src/net/gate/gateRite.js';
import { gateTimes, GATE_COLLAPSE_MS } from '../../src/net/gate/gateLaw.js';
import { validRiteIn, validRiteOut, parseClient, RITE_OUT_KINDS, worldRoom, SOCIAL_ROOM, RITE_KEY, GATE_INTERNAL_FELL, relaySupportsCage, CAGE_RELAY_MIN } from '../../src/net/wire.js';
import { createRiteHost } from '../../src/scenes/riteHost.js';
import { riteMemory, riteSeen } from '../../src/systems/riteChest.js';
import { restoreModSaveRecords } from '../../src/systems/modSaveData.js';
import { createGateOmen } from '../../src/systems/gate/gateOmen.js';
import { buildCageModel, buildCageDoor, cageHinge, CAGE_WALLS, CAGE_DOOR_WALL, CAGE_W, CAGE_D, CAGE_H, CAGE_FOOT, CAGE_BAR, CAGE_DOOR_W, CAGE_BEAM, CAGE_CAP, CAGE_LEAF_W, CAGE_SILL, CAGE_SILL_MAX, CAGE_WALL_OUT } from '../../src/world/cageModel.js';
import { GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD } from '../../src/world/gate/gateModel.js';
import { Collider } from '../../src/player/collider.js';
import { CAPSULE_RADIUS } from '../../src/player/motor.js';
import { trs } from '../../src/world/mat4.js';
import { fakeRooms } from '../fakeRoom.mjs';

const DAY = 700;
const T = gateTimes(DAY);
const PX = 300, PY = 200;
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
/** The day's faithful by career - the Summoner apart. */
const rosterOf = (day) => { const o = {}; for (const m of riteFaithfulOf(day)) if (!m.summoner) o[m.career] = (o[m.career] ?? 0) + 1; return o; };

test('BROKER-CAGE the law: every one of the day\'s faithful fallen is the Summoner and each of Dagon\'s Faithful by career, as many as the day stood - no fewer, any career short is not all; her hours are the omen to the Wrath\'s midnight (mutants: the Summoner not asked; one of each career enough; a career missed; midnight kept; the omen not waited for)', () => {
  for (const day of [DAY, 701, 812, 4071]) {
    const want = rosterOf(day);
    assert.equal(riteRosterFell(day, want, 1), true, `day ${day}: every one fallen`);
    assert.equal(riteRosterFell(day, want, 0), false, 'the Summoner standing');
    assert.equal(riteRosterFell(day, { ...want, 999: 3 }, 1), true, 'more than stood is all the same');
    for (const career of Object.keys(want)) {
      assert.equal(riteRosterFell(day, { ...want, [career]: want[career] - 1 }, 1), false, `day ${day}: one ${career} still standing`);
      const less = { ...want }; delete less[career];
      assert.equal(riteRosterFell(day, less, 1), false, `day ${day}: no ${career} seen to fall`);
    }
    assert.ok(Object.keys(want).every((c) => RITE_CAREERS.includes(Number(c))), 'the four robed careers');
  }
  assert.equal(riteRosterFell(DAY, null, 1), false);
  assert.equal(riteRosterFell(DAY, {}, 1), false);
  assert.equal(riteRosterFell(DAY, { 128: 'x' }, 1), false);
  assert.equal(cageStands(DAY, T.omenAt - 1), false, 'before the omen');
  assert.equal(cageStands(DAY, T.omenAt), true, 'the omen');
  assert.equal(cageStands(DAY, T.openAt), true, 'the breach open');
  assert.equal(cageStands(DAY, T.wrathAt - 1), true);
  assert.equal(cageStands(DAY, T.wrathAt), false, 'midnight');
  assert.equal(cageStands(-1, T.omenAt), false, 'no gate day');
});

test('BROKER-CAGE the wire: the rite word\'s `c` 0 or 1, a word from before it 0; the hub\'s `cl` its day, its circle and when - nothing else - and a kind a client before it never knew dropped there (mutants: `c` unchecked; `cl` refused; `cl` carrying the broken word\'s names)', () => {
  assert.deepEqual(validRiteIn({ d: DAY, px: PX, py: PY, s: 1, f: 1, c: 1 }), { d: DAY, px: PX, py: PY, s: 1, f: 1, c: 1 });
  assert.deepEqual(validRiteIn({ d: DAY, px: PX, py: PY, s: 0, f: 0 }), { d: DAY, px: PX, py: PY, s: 0, f: 0, c: 0 }, 'a word from before it');
  for (const c of [2, -1, '1', true, null, 0.5]) assert.equal(validRiteIn({ d: DAY, px: PX, py: PY, s: 0, f: 0, c }), null, `c ${JSON.stringify(c)}`);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY, s: 1, f: 1, c: 1 }), { hasHello: true }), { t: 'rite', d: DAY, px: PX, py: PY, s: 1, f: 1, c: 1 });
  assert.deepEqual(RITE_OUT_KINDS, ['br', 'cl']);
  assert.deepEqual(validRiteOut({ k: 'cl', d: DAY, px: PX, py: PY, at: 5, by: ['Ann'], n: 3, x: 1 }), { k: 'cl', d: DAY, px: PX, py: PY, at: 5 });
  for (const bad of [{ d: -1 }, { px: 1000 }, { py: 500 }, { at: 0 }, { at: 1.5 }]) assert.equal(validRiteOut({ k: 'cl', d: DAY, px: PX, py: PY, at: 5, ...bad }), null, JSON.stringify(bad));
  assert.equal(validRiteOut({ k: 'br', d: DAY, px: PX, py: PY, at: 5, by: ['Ann'] }).k, 'br', 'the broken word as it was');
  // THE MERGE (2026-10-02): world153 is main's REVENANT-WIRE, a relay that never says `cl` - read as the cage's, its every
  // screen would wait on a word it never hears and keep her caged; the cage's own relay is world154
  assert.equal(CAGE_RELAY_MIN, 154);
  assert.deepEqual(['world152', 'world153', 'world154', 'world157', 'acct62', null, 154].map(relaySupportsCage), [false, false, true, true, false, false, false]);
});

/** The rite's host on a fake world (test/net/gate/wb12d_rite_world.test.js's rig, cut down): its foes a list, its words recorded. */
function rig() {
  restoreModSaveRecords({});
  let clock = T.omenAt + 60_000;
  const r = { foes: [], words: [], spawned: [], dropped: [] };
  r.host = createRiteHost({
    now: () => clock, omen: () => ({ site: { day: DAY, px: PX, py: PY, near: 'Copperham' } }), pixelTranslation: () => [0, 0, 0],
    groundAt: () => 0, feet: () => { const [e, n] = riteLocalOf(DAY); return [e + 10, 0, n]; }, online: () => true,   // 10 m off the circle's heart
    foes: {
      spawn: async (career, [x, z], o) => { r.spawned.push(career); const f = { mobileType: career, site: o.site, ai: { feet: [x, 0, z], target: null }, entity: { maxHealth: 50, health: 50 }, dead: false, corpse: false }; r.foes.push(f); return f; },
      list: () => r.foes, drop: (site) => { r.dropped.push(site); r.foes = r.foes.filter((f) => f.site !== site || f.puppet); }, remove: () => {}, campId: () => 7,
    },
    send: (w) => { r.words.push(w); return true; },
  });
  r.set = (t) => { clock = t; };
  return r;
}

test('BROKER-CAGE the rite\'s host: the word says `c` once this character saw every one of them fall; the hub\'s `cl` is kept by its circle alone and none of the faithful is stood once it is said; isCleared is the hub\'s word or my own eyes, and asking it never begins a day (mutants: `c` with one standing; another circle\'s word believed; the faithful stood again after it; a day begun by the cage\'s question)', async () => {
  const r = rig();
  r.host.frame(); await settle();
  assert.equal(r.spawned.length, riteFaithfulOf(DAY).length, 'the day\'s faithful stood');
  assert.equal(r.host.isCleared(DAY, PX, PY), false);
  for (const f of r.foes.slice(1)) { f.dead = true; f.corpse = true; }
  r.set(T.omenAt + 70_000); r.host.frame();
  assert.equal(r.words.at(-1).c, 0, 'one still standing');
  r.foes[0].dead = true; r.foes[0].corpse = true;
  r.set(T.omenAt + 80_000); r.host.frame();
  assert.equal(r.words.at(-1).c, 1, 'every one fallen: said');
  assert.equal(r.host.isCleared(DAY, PX, PY), true, 'my own eyes');
  // the hub's word, for a character who saw nothing
  const q = rig();
  q.host.onBroken({ k: 'cl', d: DAY, px: PX + 1, py: PY, at: 5 });
  assert.equal(q.host.isCleared(DAY, PX, PY), false, 'another circle\'s word');
  q.host.onBroken({ k: 'cl', d: DAY, px: PX, py: PY, at: 5 });
  assert.equal(q.host.isCleared(DAY, PX, PY), true, 'the hub\'s word');
  assert.equal(q.host.isBroken(DAY, PX, PY), false, 'the cleared word is not the broken one (its line is the broken word\'s alone)');
  q.host.frame(); await settle();
  assert.equal(q.spawned.length, 0, 'none of the faithful stood once the hub says they all fell');
  assert.equal(q.host.state().cleared, true);
  // the cage's question never begins a day
  riteMemory(DAY);
  assert.equal(riteSeen(DAY + 1), null);
  assert.equal(q.host.isCleared(DAY + 1, PX, PY), false);
  assert.equal(riteSeen(DAY)?.d, DAY, 'the day\'s memory untouched by asking of another');
});

test('AUDIT BROKER-CAGE C1, C6, C13 the rite\'s host: a character who came after the Summoner fell (the hub\'s broken word) and saw every other one fall says `c` and sees her free; where the relay says the cage (isCleared ownEyes false) the hub\'s word alone frees her, and clearedAt says when; the hub\'s word takes down copies of the faithful a page stood before it (mutants: the broken word not the Summoner\'s fall; own eyes trusted where the relay says it; the copies left standing)', async () => {
  // C1: the latecomer
  const r = rig();
  r.host.onBroken({ k: 'br', d: DAY, px: PX, py: PY, at: 5, by: ['Ann'], n: 1 });   // Ann felled the Summoner, and left
  r.host.frame(); await settle();
  assert.equal(r.spawned.length, riteFaithfulOf(DAY).length - 1, 'the Summoner is not stood again');
  for (const f of r.foes) { f.dead = true; f.corpse = true; }
  r.set(T.omenAt + 70_000); r.host.frame();
  assert.equal(riteMemory(DAY).fell, 0, 'this character never saw him fall');
  assert.equal(r.words.at(-1).c, 1, 'every one of them fell all the same: said');
  assert.equal(r.host.isCleared(DAY, PX, PY), true, 'free on my own eyes');
  // C6: where the relay says the cage, its word alone
  assert.equal(r.host.isCleared(DAY, PX, PY, false), false, 'not on my own eyes where the relay says it');
  assert.ok(Number.isNaN(r.host.clearedAt(DAY, PX, PY)), 'not said yet');
  r.host.onBroken({ k: 'cl', d: DAY, px: PX, py: PY, at: 4242 });
  assert.equal(r.host.isCleared(DAY, PX, PY, false), true, 'the hub\'s word');
  assert.equal(r.host.clearedAt(DAY, PX, PY), 4242, 'and when');
  // C13: copies of the faithful a page stood before the hub's word landed
  const q = rig();
  q.host.frame(); await settle();
  assert.ok(q.foes.length > 0, 'stood');
  q.host.onBroken({ k: 'cl', d: DAY, px: PX, py: PY, at: 9 });
  q.set(T.omenAt + 61_000); q.host.frame();
  assert.equal(q.foes.length, 0, 'taken down with the hub\'s word');
  assert.deepEqual(q.dropped, [`${PX},${PY}:rite.${DAY}`], 'the site kept');
  q.set(T.omenAt + 70_000); q.host.frame(); await settle();
  assert.equal(q.spawned.length, riteFaithfulOf(DAY).length, 'and none stood again');
});

test('BROKER-CAGE the omen\'s cage site: the breach the clock is about, from its omen to the Wrath\'s midnight - a Warden fallen early takes the gate\'s standing, never her site; none before the omen or after midnight; one record a site (mutants: the cage site the gate\'s standing; midnight kept; a record a frame)', () => {
  let clock = T.omenAt - 1000, fellAt = null;
  const omen = createGateOmen({ now: () => clock, site: (day) => (day === DAY ? { px: PX, py: PY, spot: [10, 10], ring: { cx: PX, cy: PY, r: 3 }, place: 'Copperham', near: 'Copperham' } : null), say: () => {}, fellAt: () => fellAt });
  omen.frame();
  assert.equal(omen.cageSite(), null, 'before the omen');
  clock = T.omenAt + 1000; omen.frame();
  const s = omen.cageSite();
  assert.deepEqual(s, { day: DAY, px: PX, py: PY });
  assert.equal(omen.cageSite(), s, 'one record a site');
  clock = T.openAt + 60_000; fellAt = T.openAt + 30_000; omen.frame();
  clock = fellAt + GATE_COLLAPSE_MS + 1000; omen.frame();
  assert.equal(omen.standing(), null, 'the Warden fell: the gate is gone');
  assert.deepEqual(omen.cageSite(), { day: DAY, px: PX, py: PY }, 'and she stands on');
  clock = T.wrathAt - 1; omen.frame();
  assert.ok(omen.cageSite());
  clock = T.wrathAt; omen.frame();
  assert.equal(omen.cageSite(), null, 'midnight');
});

/** The relay's rite on fake rooms (test/net/gate/wb12d_rite_relay.test.js's withRite, cut down). */
async function withRelay(fn, start = T.omenAt + 60_000) {
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  Date.now = () => clock;
  globalThis.fetch = async () => ({ ok: true, status: 204 });
  const world = fakeRooms({ now: () => clock });
  const cell = world.room(worldRoom(PX, PY)), hub = world.room(SOCIAL_ROOM);
  const [x, z] = riteNativeOf(DAY, PX, PY);
  const AT = { x: x + 3 * RITE_UNITS_PER_M, y: 0, z, yaw: 0, pitch: 0 };
  const say = (ws, o = {}) => cell.raw(ws, JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY, s: 0, f: 0, ...o }));
  const at = async (id) => { const ws = cell.connect(); await cell.hello(ws, id, AT); clock += 1000; return ws; };
  // the hub's door as the cells reach it: `hub.door = 'down'` answers 503, a promise holds every tell until it settles
  const door = { state: 'up', hold: null };
  const get = world.ROOMS.get;
  world.ROOMS.get = (id) => { const o = get(id); return id === SOCIAL_ROOM ? { fetch: async (req) => { if (door.hold) await door.hold; return door.state === 'down' ? new Response('no', { status: 503 }) : o.fetch(req); } } : o; };
  const warn = console.warn; console.warn = () => {};
  try { await fn({ world, cell, hub, say, at, door, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } }); }
  finally { Date.now = realNow; globalThis.fetch = realFetch; console.warn = warn; }
}
const rites = (ws) => ws.sent.filter((m) => m.t === 'rite');

test('BROKER-CAGE the relay: a word that every one of the faithful fell, from a pose at the circle in the rite\'s window, is kept by the cell beside the broken rite (the Summoner\'s fall with it) and told the hub, which says `cl` once to everyone online and to every hello until midnight - after an early kill too - and never past it; a word past the rite\'s grace is nothing (mutants: `cl` never told; told every word; the hello\'s word gone with the circle; said past midnight; heard after the opening)', async () => {
  await withRelay(async ({ cell, hub, say, at, set, step }) => {
    const watcher = hub.connect(); await hub.hello(watcher, 'peer-0009', null);
    const a = await at('peer-0001');
    await say(a, { s: 1, c: 1 });
    await settle();
    const c = cell.store.get(RITE_KEY).c[`${PX},${PY}`];
    assert.equal(c.cl, 1, 'kept');
    assert.equal(c.f, 1, 'the Summoner fell with them');
    assert.equal(c.clTold, 1, 'told the hub');
    const cl = rites(watcher).filter((m) => m.k === 'cl');
    assert.equal(cl.length, 1, 'said to everyone online');
    assert.deepEqual(validRiteOut(cl[0]), { k: 'cl', d: DAY, px: PX, py: PY, at: c.clAt });
    assert.equal(rites(watcher).filter((m) => m.k === 'br').length, 1, 'and the broken word, once');
    await say(a, { s: 1, f: 1, c: 1 }); await settle();
    const b = await at('peer-0002');
    await say(b, { s: 1, f: 1, c: 1 }); await settle();   // another who struck: the cell tells the hub again
    assert.equal(Object.keys(hub.store.get(RITE_KEY).c[`${PX},${PY}`].h).length, 2, 'the hub told again');
    assert.equal(rites(watcher).filter((m) => m.k === 'cl').length, 1, 'and her cage said open once');
    const inCell = await at('peer-0003');
    assert.deepEqual(rites(inCell), [], 'a hello in the circle\'s cell hears no rite word - the hub\'s alone');
    set(T.openAt + 60_000);
    const late = hub.connect(); await hub.hello(late, 'peer-0010', null);
    assert.equal(rites(late).filter((m) => m.k === 'cl').length, 1, 'a hello hears it');
    assert.equal(rites(late).filter((m) => m.k === 'br').length, 1, 'and the broken word, while its circle stands');
    // the Warden falls early: his breach and its circle collapse - and a hello still hears her cage open until midnight
    const fellAt = T.openAt + 2 * 60_000;
    set(fellAt);
    const res = await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d: DAY, at: fellAt, top: ['Ann'], n: 1 }) }));
    assert.equal(res.status, 200);
    step(GATE_COLLAPSE_MS + 1000);
    const after = hub.connect(); await hub.hello(after, 'peer-0011', null);
    assert.equal(rites(after).filter((m) => m.k === 'br').length, 0, 'the circle gone with the breach: no broken word');
    assert.equal(rites(after).filter((m) => m.k === 'cl').length, 1, 'her cage still open');
    set(T.wrathAt - 1000);
    const last = hub.connect(); await hub.hello(last, 'peer-0012', null);
    assert.equal(rites(last).filter((m) => m.k === 'cl').length, 1, 'the last moment before midnight');
    set(T.wrathAt + 1);
    const night = hub.connect(); await hub.hello(night, 'peer-0013', null);
    assert.equal(rites(night).filter((m) => m.k === 'cl').length, 0, 'midnight: she is gone');
  });
  await withRelay(async ({ cell, say, at, set }) => {
    const a = await at('peer-0001');
    set(T.openAt + RITE_GRACE_MS);
    await say(a, { s: 1, f: 1, c: 1 });
    assert.equal(cell.store.get(RITE_KEY)?.c?.[`${PX},${PY}`] ?? null, null, 'past the rite\'s grace: nothing kept');
  });
});

test('AUDIT BROKER-CAGE (R1-R3) the relay never loses a cleared word: said after the Summoner\'s fall was told (the usual order), it is told on its own and said once; told after an early kill\'s collapse - its hub out of reach till then - the hub keeps it and says it (and the broken word nowhere); said while a tell is in flight, the retry tells it (mutants: the cleared half of the owed test; the hub\'s door shut at the collapse; a tell in flight arming nothing)', async () => {
  const tellFrom = (cell) => cell.store.get(RITE_KEY).c[`${PX},${PY}`];
  // R3: the Summoner first, then the last of the faithful - the hub down when it is said, told on the retry
  await withRelay(async ({ cell, hub, say, at, door, step }) => {
    const w = hub.connect(); await hub.hello(w, 'peer-0009', null);
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 }); await settle();
    assert.equal(tellFrom(cell).told, 1, 'the break told');
    assert.equal(rites(w).filter((m) => m.k === 'br').length, 1);
    door.state = 'down';
    step(60_000);
    await say(a, { s: 1, f: 1, c: 1 }); await settle();
    assert.equal(tellFrom(cell).cl, 1, 'kept');
    assert.ok(!tellFrom(cell).clTold, 'not told: the hub is down');
    assert.ok(cell.alarm.at != null, 'the retry armed');
    door.state = 'up';
    step(5000); await cell.fire(); await settle();
    assert.equal(tellFrom(cell).clTold, 1, 'told on the retry');
    assert.equal(rites(w).filter((m) => m.k === 'cl').length, 1, 'and said once');
    assert.equal(rites(w).filter((m) => m.k === 'br').length, 1, 'the break not said again');
  });
  // R1: cleared at the last moment, the hub out of reach until after an early kill's collapse
  await withRelay(async ({ cell, hub, say, at, door, set, step }) => {
    const a = await at('peer-0001');
    door.state = 'down';
    set(T.openAt - 30_000);
    await say(a, { s: 1, f: 1, c: 1 }); await settle();
    const fellAt = T.openAt + 60_000;
    set(fellAt);
    const res = await hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d: DAY, at: fellAt, top: ['Ann'], n: 1 }) }));
    assert.equal(res.status, 200);
    const w = hub.connect(); await hub.hello(w, 'peer-0009', null);
    step(GATE_COLLAPSE_MS + 1000);
    door.state = 'up';
    await cell.fire(); await settle();
    assert.equal(tellFrom(cell).clTold, 1, 'told');
    assert.equal(hub.store.get(RITE_KEY)?.c?.[`${PX},${PY}`]?.cl, 1, 'kept by the hub though its circle has collapsed');
    assert.equal(rites(w).filter((m) => m.k === 'cl').length, 1, 'said to everyone online');
    assert.equal(rites(w).filter((m) => m.k === 'br').length, 0, 'the broken word is not said past the collapse');
    const late = hub.connect(); await hub.hello(late, 'peer-0010', null);
    assert.equal(rites(late).filter((m) => m.k === 'cl').length, 1, 'and to a hello until midnight');
  });
  // R2: a tell in flight past its retry, the cleared word said meanwhile
  await withRelay(async ({ cell, hub, say, at, door, step }) => {
    const w = hub.connect(); await hub.hello(w, 'peer-0009', null);
    const a = await at('peer-0001');
    let release;
    door.hold = new Promise((r) => { release = r; });
    const first = say(a, { s: 1, f: 1 });   // its tell held at the hub's door
    await settle();
    step(1000);
    await say(a, { s: 1, f: 1, c: 1 });   // the last of them falls while it is in flight
    step(5000); await cell.fire();   // the retry fires mid-flight
    assert.ok(cell.alarm.at != null, 'a tell in flight arms the retry');
    door.hold = null; release(); await first; await settle();
    assert.ok(!tellFrom(cell).clTold, 'the first tell took only what was owed when it went');
    step(5000); await cell.fire(); await settle();
    assert.equal(tellFrom(cell).clTold, 1, 'the retry tells it');
    assert.equal(rites(w).filter((m) => m.k === 'cl').length, 1);
  });
});

test('BROKER-CAGE the cage: corner posts and frame of the plinth\'s stone, bars of the gate\'s, every face wound outward; bars a hand apart on three sides, either side of the door on its +z face and over the top; the leaf exactly the opening between the jambs on its hinge (AUDIT BROKER-CAGE G5: no face over another), the posts capped over the frame, the jambs under the beam; its bars as deep as it is told and its sill as high; the walls in the collider hold a body on every side and the shut door holds it at the door (mutants: a face wound in; bars a hand apart no more; the leaf over the jambs; the hinge off the jamb; a fixed foot; the door\'s slab missing; no top bars; no front bars)', () => {
  for (const model of [buildCageModel(), buildCageDoor()]) {
    assert.ok(model.subMeshes.every((m) => m.textureArchive === GATE_ARCHIVE && [GATE_STONE_RECORD, GATE_PLINTH_RECORD].includes(m.textureRecord)), 'the gate\'s own stone');
    const P = model.positions, N = model.normals;
    let inward = 0;
    for (const sm of model.subMeshes) {
      for (let s = 0; s < sm.primitiveCount; s += 12) {   // a slab: twelve triangles
        const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
        for (let t = s; t < s + 12; t++) for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) { const x = P[((sm.startIndex / 3 + t) * 3 + v) * 3 + a]; mn[a] = Math.min(mn[a], x); mx[a] = Math.max(mx[a], x); }
        for (let t = s; t < s + 12; t++) {
          const i = (sm.startIndex / 3 + t) * 9;
          let d = 0;
          for (let a = 0; a < 3; a++) d += N[i + a] * ((P[i + a] + P[i + 3 + a] + P[i + 6 + a]) / 3 - (mn[a] + mx[a]) / 2);
          if (!(d > 0)) inward++;
        }
      }
    }
    assert.equal(inward, 0, 'every face wound outward');
  }
  assert.ok(CAGE_H > 2.15 + 0.3, 'over her idle\'s height');
  // the bars as built: their centres along a face, read off the gate's stone record's slabs (a bar is a CAGE_BAR square)
  const cage = buildCageModel();
  const slabs = (model, rec) => {
    const sm = model.subMeshes.find((m) => m.textureRecord === rec), out = [];
    for (let s = 0; s < sm.primitiveCount; s += 12) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let v = s * 3; v < (s + 12) * 3; v++) for (let a = 0; a < 3; a++) { const x = model.positions[(sm.startIndex + v) * 3 + a]; mn[a] = Math.min(mn[a], x); mx[a] = Math.max(mx[a], x); }
      out.push({ mn, mx, c: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2] });
    }
    return out;
  };
  const bars = slabs(cage, GATE_STONE_RECORD), up = bars.filter((b) => b.mx[1] - b.mn[1] > 2), over = bars.filter((b) => b.mx[1] - b.mn[1] < 0.2);
  const gapsOf = (xs) => xs.sort((a, b) => a - b).slice(1).map((x, i) => x - xs[i] - CAGE_BAR);
  const back = up.filter((b) => Math.abs(b.c[2] + CAGE_D / 2) < 1e-6).map((b) => b.c[0]);
  assert.ok(back.length >= 8 && Math.max(...gapsOf([...back, -CAGE_W / 2, CAGE_W / 2])) < 0.2, `the back: bars a hand apart, post to post (${back.length})`);
  const front = up.filter((b) => Math.abs(b.c[2] - CAGE_D / 2) < 1e-6).map((b) => b.c[0]);
  assert.ok(front.filter((x) => x < -CAGE_DOOR_W / 2).length >= 2 && front.filter((x) => x > CAGE_DOOR_W / 2).length >= 2, 'the front: bars either side of the door');
  assert.ok(front.every((x) => Math.abs(x) > CAGE_DOOR_W / 2), 'and none across it');
  assert.ok(over.length >= 8 && over.every((b) => b.mn[2] <= -CAGE_D / 2 + 1e-6 && b.mx[2] >= CAGE_D / 2 - 1e-6), 'bars across the top, back to front');
  const lo = Math.min(...bars.map((b) => b.mn[1]));
  assert.ok(Math.abs(lo + CAGE_FOOT) < 1e-6, 'its bars CAGE_FOOT under her feet by default');
  assert.ok(Math.abs(Math.min(...slabs(buildCageModel({ foot: 0.93 }), GATE_STONE_RECORD).map((b) => b.mn[1])) + 0.93) < 1e-6, 'and as deep as it is told');
  // G5: the frame - posts capped over it, jambs under its beam, the leaf exactly the opening between the jambs
  const frame = slabs(cage, GATE_PLINTH_RECORD);
  const posts = frame.filter((b) => Math.abs(Math.abs(b.c[0]) - CAGE_W / 2) < 1e-6 && Math.abs(Math.abs(b.c[2]) - CAGE_D / 2) < 1e-6 && b.mx[1] - b.mn[1] > 2);
  assert.equal(posts.length, 4);
  assert.ok(posts.every((b) => Math.abs(b.mx[1] - (CAGE_H + CAGE_CAP)) < 1e-6), 'the posts capped over the frame - no two tops in one plane');
  const jambs = frame.filter((b) => Math.abs(Math.abs(b.c[0]) - CAGE_DOOR_W / 2) < 1e-6 && Math.abs(b.c[2] - CAGE_D / 2) < 1e-6);
  assert.equal(jambs.length, 2, 'two jambs');
  assert.ok(jambs.every((b) => Math.abs(b.mx[1] - (CAGE_H - CAGE_BEAM)) < 1e-6), 'under the front beam, never through it');
  const [hx, hz] = cageHinge();
  const leaf = buildCageDoor().positions;
  let lx = Infinity, rx = -Infinity, ly = Infinity;
  for (let i = 0; i < leaf.length; i += 3) { lx = Math.min(lx, leaf[i] + hx); rx = Math.max(rx, leaf[i] + hx); ly = Math.min(ly, leaf[i + 1]); }
  const jamb = (side) => jambs.find((b) => Math.sign(b.c[0]) === side);
  assert.ok(Math.abs(lx - jamb(-1).mx[0]) < 1e-6 && Math.abs(rx - jamb(1).mn[0]) < 1e-6, `shut, the leaf fills the opening jamb to jamb (${lx.toFixed(3)}..${rx.toFixed(3)})`);
  assert.ok(Math.abs(hz - CAGE_D / 2) < 1e-9 && Math.abs(rx - lx - CAGE_LEAF_W) < 1e-6, 'on the +z face, its own width');
  assert.ok(Math.abs(ly - CAGE_SILL) < 1e-6, 'its sill CAGE_SILL over her feet by default');
  let ly2 = Infinity;
  const raised = buildCageDoor({ sill: 0.6 }).positions;
  for (let i = 1; i < raised.length; i += 3) ly2 = Math.min(ly2, raised[i]);
  assert.ok(Math.abs(ly2 - 0.6) < 1e-6, 'as high as it is told');
  let ly3 = Infinity;
  const high = buildCageDoor({ sill: 5 }).positions;
  for (let i = 1; i < high.length; i += 3) ly3 = Math.min(ly3, high[i]);
  assert.ok(Math.abs(ly3 - CAGE_SILL_MAX) < 1e-6, 'never higher than a leaf of 1.5 m allows');
  // the walls hold a body - every side, and the door while it is shut
  const c = new Collider(() => 0);
  const m = trs(0, 0, 0, 0, 0, 0);
  c.addMesh('w', CAGE_WALLS.positions, CAGE_WALLS.indices, m);
  const held = CAGE_W / 2 + CAGE_WALL_OUT + CAPSULE_RADIUS - 0.02;   // at its outer face (T4: a body stuck in a slab is not held)
  for (const [x, z, dx, dz] of [[0, -3, 0, 2.5], [3, 0, -2.5, 0], [-3, 0, 2.5, 0], [0.8, 3, 0, -2.5], [-0.8, 3, 0, -2.5]]) {
    const p = [x, 0, z];
    c.move(p, dx, 0, dz);
    assert.ok(Math.abs(p[0]) > held || Math.abs(p[2]) > held, `held outside from (${x}, ${z}): ${p[0].toFixed(2)}, ${p[2].toFixed(2)}`);
  }
  const open = [0, 0, 3];
  c.move(open, 0, 0, -2.5);
  assert.ok(open[2] < CAGE_D / 2, 'the door\'s opening lets a body in');
  c.addMesh('d', CAGE_DOOR_WALL.positions, CAGE_DOOR_WALL.indices, m);
  const shut = [0, 0, 3];
  c.move(shut, 0, 0, -2.5);
  assert.ok(shut[2] > CAGE_D / 2, 'the shut door holds it');
});
