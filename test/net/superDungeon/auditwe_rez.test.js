// AUDIT WORLD-EVENTS (2026-10-25, the owner: "Audit this. Ensure perfection"; bible/01-Overview/audits/Audit-World-Events.md)
// - THE HOUR'S RAISE, RECORDED BY THE REALM (SD-REZ's findings): any hello inside the window was a rise, a friend's spell or
// not (L1-1); the raised fell again to the count (L1-2); the window said two minutes and was one (L1-5); the page's window
// stamped every frame of the death screen (L1-6); a death the list could not hold was forgotten (L1-7); the down cleared
// before the door's refusals (L1-8).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SD_KEY, SD_REALM_KEY, SOCIAL_ROOM, PIXEL_UNITS, worldRoom, chatRegionRoom, SD_FIGHTERS_MAX, validSdIn } from '../../../src/net/wire.js';
import { sdRoomKey, SD_REZ_MS, SD_REZ_REACH_M, SD_NO_FALLEN, sdDownWord, sdMayRaise } from '../../../src/net/superDungeon/sdLaw.js';
import { SD_ARENA, realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { PIXEL_M } from '../../../src/net/gate/gateLaw.js';
import { sdSlotsKept, SD_REZ_PAGE_SLACK_MS } from '../../../src/systems/superDungeon/sdSlots.js';
import { CORPSE_MS } from '../../../src/net/remotePlayers.js';
import { ONLINE_RESPAWN_SECONDS } from '../../../src/ui/deathScreen.js';
import { madeRulesLines } from '../../../src/ui/hud/statusTips.js';
import { sendRaiseWord } from '../../../src/net/raiseWord.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const T0 = 1_800_000_000_000;
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArena = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };

/** sd12_onelife.test.js's fake world, driven to a FOUND Hollow (slot 1), its realm standing past the Orrery. */
async function withRealm(fn) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(chatRegionRoom(17)); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      const realm = world.room(sdRoomKey(rec.s));
      const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h);
      const hello = async (id, pose) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', '') }); return ws; };
      await fn({ realm, hello, step: (ms) => { clock += ms; } });
    });
  } finally { Date.now = realNow; }
}
const raise = (realm, ws, to) => realm.raw(ws, JSON.stringify({ t: 'sd', k: 'rz', to }));

test('AUDIT WORLD-EVENTS L1-1: the Hour lets a body back only when a living fighter\'s Resurrect at it was recorded - an unraised hello inside the window is held at the door (busy: its page asks again), a raise from afar, from the dead or from one never admitted is nothing; the raised rises; a raise of an earlier death is not this one\'s (mutants: any hello a rise; the reach unread; the dead raising; the raise kept past a new death)', async () => {
  await withRealm(async ({ realm, hello, step }) => {
    const ann = await hello('peer-ann', inArena(0, -12)), bo = await hello('peer-bo', inArena(2, -12)), cy = await hello('peer-cy', inArena(40, -12));
    await realm.raw(ann, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    const down = realm.store.get(SD_REALM_KEY).down.find(([x]) => x === 'acct-peer-ann');
    assert.ok(down && Number.isFinite(down[2]) && Number.isFinite(down[3]), 'down where she fell');
    step(5000);
    const sneak = await hello('peer-ann', inArena(0, -12));
    assert.equal(sneak.closed?.reason, 'busy', 'nobody raised her: held at the door');
    assert.deepEqual(realm.store.get(SD_REALM_KEY).down.map(([x]) => x), ['acct-peer-ann'], 'still lying');
    await raise(realm, cy, 'acct-peer-ann');
    assert.deepEqual(realm.store.get(SD_REALM_KEY).raised ?? [], [], `a raise from ${40} m off is nothing`);
    const ghost = realm.connect(); await realm.hello(ghost, 'peer-zed', inArena(0, -12), { name: 'zed' });
    await realm.raw(ghost, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    await raise(realm, ghost, 'acct-peer-ann');
    assert.deepEqual(realm.store.get(SD_REALM_KEY).raised ?? [], [], 'the dead raise nobody');
    await raise(realm, bo, 'acct-peer-ann');
    assert.deepEqual(realm.store.get(SD_REALM_KEY).raised.map(([x]) => x), ['acct-peer-ann'], 'a living friend beside her: recorded');
    step(1000);
    const risen = await hello('peer-ann', inArena(0, -12));
    assert.equal(risen.closed, null, 'raised: back in the Hour');
    assert.deepEqual([realm.store.get(SD_REALM_KEY).down.map(([x]) => x), realm.store.get(SD_REALM_KEY).raised], [['acct-peer-zed'], []], 'off the lying and the raised');
    // a second death: the old raise is not this one's
    await realm.raw(risen, JSON.stringify({ t: 'pose', p: inArena(0, -12, { dd: 1 }) }));
    step(1000);
    assert.equal((await hello('peer-ann', inArena(0, -12))).closed?.reason, 'busy');
    step(SD_REZ_MS);
    assert.equal((await hello('peer-ann', inArena(0, -12))).closed?.reason, SD_NO_FALLEN, 'past the window, unraised: for good');
  });
  // the law, pure
  const realm = { in: ['a', 'b', 'c'], dead: ['c'], down: [['x', 1000, 10, 20]], raised: [] };
  assert.equal(sdDownWord(realm, 'x', 1000 + SD_REZ_MS), 'down');
  assert.equal(sdMayRaise(realm, 'a', 'x', 2000, [10 + SD_REZ_REACH_M - 0.1, 0, 20]), true);
  assert.equal(sdMayRaise(realm, 'a', 'x', 2000, [10 + SD_REZ_REACH_M + 0.1, 0, 20]), false, 'out of reach');
  assert.equal(sdMayRaise(realm, 'c', 'x', 2000, null), false, 'a caster dead for good');
  assert.equal(sdMayRaise(realm, 'z', 'x', 2000, null), false, 'never admitted');
  assert.equal(sdMayRaise({ ...realm, down: [...realm.down, ['b', 1500]] }, 'b', 'x', 2000, null), false, 'a caster lying down itself');
  assert.equal(sdMayRaise(realm, 'a', 'x', 1001 + SD_REZ_MS, null), false, 'past the window');
  assert.equal(sdDownWord({ ...realm, raised: [['x', 1500]] }, 'x', 2000), 'rise');
  assert.equal(sdDownWord({ ...realm, raised: [['x', 900]] }, 'x', 2000), 'down', 'a raise before this death');
  assert.deepEqual(validSdIn({ k: 'rz', to: 'acct-peer-ann' }), { k: 'rz', to: 'acct-peer-ann' });
  assert.equal(validSdIn({ k: 'rz', to: 'no spaces' }), null);
  // the page says it to the realm it stands in, and nowhere else
  const sent = [];
  const online = (room) => ({ room, sendSdRaise: (to) => sent.push(['sd', to]), sendEg: (k, f) => sent.push(['eg', k, f.to]), sendKetch: (k, f) => sent.push(['kt', k, f.to]) });
  assert.equal(sendRaiseWord(online(sdRoomKey(3)), 'acct-a'), true);
  assert.equal(sendRaiseWord(online('town:m9'), 'acct-a'), false);
  assert.deepEqual(sent, [['sd', 'acct-a']]);
  assert.match(read('src/scenes/world.js'), /_partyComposedAt = -Infinity;\n\s*sendRaiseWord\(online, f\.acct\);/, 'the world host\'s Resurrect door says it');
});

test('AUDIT WORLD-EVENTS L1-2/L1-8: the raised is a new life on the count, and comes off the lying only once the door lets it in (mutants: no new life; the down cleared before the refusals)', () => {
  const relay = read('server/src/index.js');
  assert.match(relay, /async _sdRose\(realm, sub, now\) \{\n\s*realm\.down = realm\.down\.filter\(\(\[x\]\) => x !== sub\);\n\s*realm\.raised = \(realm\.raised \?\? \[\]\)\.filter\(\(\[x\]\) => x !== sub\);\n\s*await this\.state\.storage\.put\(SD_REALM_KEY, realm\);\n\s*const f = await this\._sdFightOf\(\);\n\s*if \(f\?\.players\?\.\[sub\]\) \{ bodyLife\(f\.players\[sub\], now, this\._bodyLine\(\)\.body\); await this\._sdFightSave\(f, now, true\); \}/);
  const admit = relay.slice(relay.indexOf('  async _sdAdmit('), relay.indexOf('  async _sdRose(realm, sub, now) {'));
  assert.ok(admit.indexOf("if (lies === 'down') return SD_NO_BUSY;") < admit.indexOf('return SD_NO_FALLEN'), 'unraised: held');
  assert.equal((admit.match(/_sdRose\(realm, sub, now\)/g) ?? []).length, 2, 'a rise kept at each admission');
  assert.ok(admit.lastIndexOf("if (lies === 'rise') await this._sdRose(realm, sub, now);") > admit.lastIndexOf('return SD_NO_FULL'), 'after every refusal');
});

test('AUDIT WORLD-EVENTS L1-5/L1-6/L1-7: the window is the body\'s minute - the corpse\'s and the death screen\'s, and the tile says it; the page stamps its death once; a death past the list is buried, never forgotten (mutants: two minutes; the stamp every frame; the slice forgetting)', async () => {
  assert.equal(SD_REZ_MS - SD_REZ_PAGE_SLACK_MS, CORPSE_MS, 'the page\'s window: the body\'s on a friend\'s screen');
  assert.equal(CORPSE_MS, ONLINE_RESPAWN_SECONDS * 1000, 'and the death screen\'s');
  assert.ok(madeRulesLines('hour').some((l) => l.includes('within 60 seconds')), 'the tile says the minute');
  let clock = 0;
  const store = new Map();
  const slots = sdSlotsKept('k', () => 'acct-z', () => ({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }), () => clock);
  slots.add(5);
  for (clock = 1000; clock <= 50_000; clock += 1000) slots.add(5);   // every frame of the death screen
  clock = SD_REZ_MS - SD_REZ_PAGE_SLACK_MS + 1;
  assert.equal(slots.mayRise(5), false, 'the window shut at the death\'s own minute');
  await withRealm(async ({ realm }) => {
    const r = realm.room;
    for (let i = 0; i <= SD_FIGHTERS_MAX; i++) await r._sdMarkFallenAt(1, `acct-${i}`, T0 + i);
    const kept = realm.store.get(SD_REALM_KEY);
    assert.equal(kept.down.length, SD_FIGHTERS_MAX);
    assert.ok(kept.dead.includes('acct-0'), 'the one the list could not hold: buried');
    assert.equal(sdDownWord(kept, 'acct-0', T0 + 1), 'fallen');
  });
});
