// OL3 (Mac, 2026-09-14: "Go ahead and get these done per your opinion") -
// THE CLOCK DOES NOT PUNISH ABSENCE. Three of AUDIT WORLD5's recorded
// items, paid. (1) Every world-time deadline runs on wall time through a
// logout; the shared world keeps one clock, so the price is SAID in real
// time: the shared clock's inverse rides beside its source (wire.js
// wallMsForClassicMinutes, worldTick.js sharedWallMs / realTimeText), the
// tavern's offer says when the room ends by the player's own clock, and
// the bank's due-by carries the real time beside the date. (2) CreateFoe's
// spawn interval is a quest timer and stands down with the Clock online:
// the marker rides the clock, no interval accrues while the player idles
// or is away, a wave in flight still lands. (7) A welcome clock more than a
// year from this machine's is SAID - the console and the HUD line - rather
// than run uncorrected in silence.
//
// LIVED1 (2026-09-29) re-aims (1)'s deadlines: a room, a loan and a
// repair run on the CHARACTER's own clock now (worldTick.js ownMinutes),
// which stands while they are away - so the price is said in THEIR time
// and in play (ownTimeLeftText), not as a wall-clock date the character's
// clock does not keep. The wire's inverse and the real-time words stand
// for the world's own dates (the gates' local times, the raids).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharedClassicMinutes, wallMsForClassicMinutes, ONLINE_EPOCH_MS, PIXEL_UNITS, RELAY_VERSION } from '../../src/net/wire.js';
import { setSharedClock, sharedWallMs, sharedClockOn, ownTimeLeftText, setOwnMinutes } from '../../src/systems/worldTick.js';
import { TavernWindow, OWN_TIME_ROOM, OWN_TIME_ROOM_NOTE, TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y } from '../../src/ui/tavernWindow.js';
import { OFFER_PRICE_ID } from '../../src/systems/tavern.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { loadQuestTables } from '../../src/systems/quest/tables.js';
import { QuestMachine } from '../../src/systems/quest/machine.js';
import { OnlineSession, CLOCK_WARNING } from '../../src/net/online.js';
import { fakeSocketClass } from '../fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };

test('OL3 (1): the shared clock has an inverse at the wire, and the ticker carries it beside the source - a classic minute reads as this machine\'s wall-clock ms, and offline as nothing [AUDIT LIVED1b U6: the words over it, realTimeText and sharedRealTimeText, went with their last reader]', () => {
  for (const ms of [ONLINE_EPOCH_MS, ONLINE_EPOCH_MS + 123456789, ONLINE_EPOCH_MS - 5000]) assert.ok(Math.abs(wallMsForClassicMinutes(sharedClassicMinutes(ms)) - ms) < 1e-3, 'the inverse round-trips');
  const local = new Date(2026, 8, 15, 18, 5).getTime();   // Tue 15 Sep 2026, 18:05, whatever this machine\'s zone
  assert.equal(sharedWallMs(1000), null, 'offline: no wall clock');
  try {
    setSharedClock(() => 5000, (m) => local + (m - 5000) * 5000);   // five real seconds a minute, anchored so minute 5000 is 18:05
    assert.equal(sharedClockOn(), true);
    assert.equal(sharedWallMs(5000), local);
    assert.equal(sharedWallMs(5012), local + 60000, 'twelve minutes of the world are one real minute');
    assert.equal(sharedWallMs(NaN), null);
  } finally { setSharedClock(null); }
  assert.equal(sharedWallMs(5000), null, 'uninstalled with the clock');
  // TIME1: and the sky's own source and inverse beside them, through the same offset
  assert.match(rd('src/scenes/world.js'), /setSharedClock\(\(\) => sharedClassicMinutes\(Date\.now\(\) \+ _sharedOffsetMs\), \(m\) => wallMsForClassicMinutes\(m\) - _sharedOffsetMs, \{ sky: \(\) => skyClassicMinutes\(Date\.now\(\) \+ _sharedOffsetMs\), skyWall: \(m\) => wallMsForSkyMinutes\(m\) - _sharedOffsetMs \}\);/, 'the host installs the inverse through the relay\'s offset');
});

test('OL3 (1) + LIVED1: the tavern\'s offer says how long the room is theirs in the character\'s own time and in play - a fresh rental from now, a renewal from the standing expiry - and offline the offer is DFU\'s', () => {
  const rows = (id) => [{ text: `#${id} %a gold, %dwr hours`, center: true }];
  const now = 99 * MINUTES_PER_DAY + 600;
  const asked = [];
  const mk = (ownTimeOf, rentedRooms = []) => new TavernWindow({
    entity: { name: 'Rin', health: 20, maxHealth: 50, rentedRooms, goldPieces: 5000, items: [], stats: { personality: 50 } },
    rows, now: () => now, mapId: () => 7, buildingKey: () => 42, buildingName: () => 'The Dancing Dagger', quality: () => 10, bedCount: () => 4,
    freeRooms: () => false, skills: () => ({ mercantile: 50, personality: 50 }), heal() {}, onTalk() {}, onClose() {}, rolls: () => 0.5,
    ...(ownTimeOf ? { ownTimeOf } : {}),
  });
  const offerFor = (w, days) => {
    const [x, y, rw, rh] = TAVERN_RECTS.room;
    w.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2);
    for (let i = 0; i < 12; i++) w.flow.input('backspace');   // the field opens on TextBox.Text = "1"
    for (const ch of String(days)) w.flow.input(`char:${ch}`);
    w.flow.input('Enter');
    return w.flow.top;
  };
  const on = mk((m) => { asked.push(m); return '3 days of your time (6h of play)'; });
  const offer = offerFor(on, 3);
  assert.match(offer.rows[0].text, new RegExp(`^#${OFFER_PRICE_ID} `), 'DFU\'s offer first');
  // AUDIT LIVED1 N (U2): two rows, split at the play's bracket - the classic box lays its rows out unwrapped
  assert.equal(offer.rows.length, 3);
  assert.deepEqual(offer.rows.slice(1).map((r) => r.text), [`${OWN_TIME_ROOM} 3 days of your time`, `(6h of play)${OWN_TIME_ROOM_NOTE}`]);
  assert.deepEqual(offer.rows.slice(1).map((r) => r.text), ['The room is yours for 3 days of your time', '(6h of play). Resting uses it; logging off does not.']);
  assert.equal(offer.rows[1].center, true);
  assert.equal(offer.rows[2].center, true);
  assert.deepEqual(asked, [now + 3 * MINUTES_PER_DAY], 'a fresh rental ends three days from now');
  const room = { name: 'The Dancing Dagger', mapId: 7, buildingKey: 42, allocatedBedIndex: 0, expiryMinutes: now + 20 * 60 };
  const renew = mk((m) => { asked.push(m); return '2 days 20 hours of your time (5h 40m of play)'; }, [room]);
  offerFor(renew, 2);
  assert.equal(asked[1], room.expiryMinutes + 2 * MINUTES_PER_DAY, 'a renewal extends the standing expiry, as RentRoom does');
  const off = mk(null);
  assert.equal(offerFor(off, 3).rows.length, 1, 'offline: the offer it always was');
  assert.match(rd('src/scenes/worldModes.js'), /ownTimeOf: \(m\) => ownTimeLeftText\(m\),/, 'the host\'s word');
  assert.match(rd('src/scenes/worldModes.js'), /dueDateText: \(minutes, \{ short = false \} = \{\}\) => \{\s*if \(!\(minutes > 0\)\) return '';\s*const left = ownTimeLeftShort\(minutes\);\s*if \(left === 'now'\) return short \? 'now' : 'due now';[^\n]*\n\s*const own = short \? \(left && `\$\{left\} of your time`\) : ownTimeLeftText\(minutes\);\s*return own \? `in \$\{own\}` : dateString\(dateFromClassicMinutes\(minutes\)\);/, 'the bank\'s due-by says the time left in the character\'s own time online (short on the classic parchment, "due now" once due: AUDIT LIVED1 P/L), and is the date alone offline');
  // the words themselves: the character's clock and the most play it can take (the wire's one rate)
  try {
    setSharedClock(() => 900000);
    setOwnMinutes(500000);
    assert.equal(ownTimeLeftText(500000 + 7 * MINUTES_PER_DAY), '7 days of your time (14h of play)', 'a week\'s lodging');
    assert.equal(ownTimeLeftText(500000 + 360 * MINUTES_PER_DAY), '360 days of your time (720 hours of play)', 'a loan\'s year');
    assert.equal(ownTimeLeftText(500000 + 90), '1 hour of your time (8m of play)');
    assert.equal(ownTimeLeftText(500000 - 5), '0 minutes of your time (0m of play)', 'a deadline past says nothing is left');
  } finally { setSharedClock(null); }
  assert.equal(ownTimeLeftText(500000 + 90), null, 'offline DFU says its dates');
});

test('OL3 (2), re-spelt by WORLD7: CreateFoe\'s spawn interval charges PLAYED time - a tick\'s gap past the step is forgiven (one step charged, one wave, not thirty), a wave in flight still lands, a resume past a step waits a full interval from there, and offline the marker arithmetic is DFU\'s own', () => {
  const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'dfu-quests');
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^\uFEFF/, '');
  loadQuestTables(sources);
  const world = { currentRegionIndex: () => 0, isPlayerInLocationRect: () => true, created: [], placed: [], createFoeGameObjects: (foe, count) => { world.created.push(count); return Array.from({ length: count }, (_, i) => ({ i })); }, tryPlaceFoe: (h) => { world.placed.push(h); return true; }, raiseOnEncounterEvent() {} };
  let step = 1800;
  const clock = { t: 100000 };
  const m = new QuestMachine({ nowSeconds: () => clock.t, world, questClockStepMax: () => step, showPopup() {} });
  const q = m.scheduleQuest(['Quest: __QF', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Foe _rat_ is 2 Giant_rat', '', ' create foe _rat_ every 1 minutes 5 times with 100% success'], 0, { rolls: () => 0.4 });
  const act = [...q.tasks.values()][0].actions.find((a) => a.constructor.name === 'CreateFoe');
  m.tick();
  assert.equal(act.lastSpawnTime, clock.t - 24, 'the first tick backdates into the interval (DFU\'s Range), online too');
  clock.t += 30; m.tick();
  assert.equal(world.created.length, 0, 'half a minute played: not yet');
  clock.t += 30; m.tick();
  assert.deepEqual(world.created, [2], 'a minute played: the wave');
  m.tick(); m.tick();
  assert.equal(world.placed.length, 2); assert.equal(act.spawnCounter, 1, 'the wave lands and is counted');
  clock.t += 3600; m.tick();
  assert.equal(world.created.length, 2, 'an hour away in one gap: the marker forgiven all but one step - one wave on return, not sixty'); assert.equal(act.lastSpawnTime, clock.t, 'the marker stands at the wave');
  m.tick(); m.tick();
  assert.equal(act.spawnCounter, 2, 'landed and counted');
  // a resume: no tick sample (a load, a quest restored) and the time since the save past a step - forgiven whole
  act._lastTick = null; act.lastSpawnTime = clock.t - 100000;
  m.tick();
  assert.equal(act.lastSpawnTime, clock.t, 'the marker stands here'); assert.equal(world.created.length, 2, 'the resume fired none');
  clock.t += 30; m.tick();
  assert.equal(world.created.length, 2, 'the first wave after a resume waits a full interval');
  clock.t += 30; m.tick();
  assert.equal(world.created.length, 3, 'and comes');
  m.tick(); m.tick();
  // offline: no step - an hour's gap counts whole, DFU's own
  step = Infinity;
  clock.t += 3600; m.tick();
  assert.equal(act.lastSpawnTime, clock.t, 'offline the gap counted and the wave fired at once'); assert.equal(world.created.length, 4);
  const src = rd('src/systems/quest/actions.js');
  assert.match(src, /const step = this\.parentQuest\.questClockStepMax\?\.\(\) \?\? Infinity;/);
  assert.match(src, /if \(gameSeconds >= this\.lastSpawnTime \+ this\.spawnInterval && !this\.spawnInProgress\) \{/);
  assert.equal(src.includes('questClocksStoodDown'), false, 'the stand-down word is gone');
});

test('OL3 (7): a welcome clock more than a year from this machine\'s is said - the session keeps a warning the HUD line shows while open, the console hears it once, and a sane welcome clears it', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => 1000 });
  const warned = [];
  const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
  quiet(() => s.join('dungeon:m187853213', at(1, 1))); sockets[0].open();
  const warn = console.warn; console.warn = (m) => warned.push(String(m)); const info = console.info; console.info = () => {};
  try {
    sockets[0].receive({ t: 'welcome', v: RELAY_VERSION, id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() + 400 * 24 * 3600 * 1000 });
    assert.equal(s.clockWarning, CLOCK_WARNING);
    assert.equal(s.statusLine(), `online: ${CLOCK_WARNING}`, 'the HUD line, on an OPEN session');
    assert.equal(warned.filter((w) => w.includes(CLOCK_WARNING)).length, 1, 'the console, with both clocks');
    sockets[0].receive({ t: 'welcome', v: RELAY_VERSION, id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() + 400 * 24 * 3600 * 1000 });
    assert.equal(warned.filter((w) => w.includes(CLOCK_WARNING)).length, 1, 'said once, not per welcome');
    sockets[0].receive({ t: 'welcome', v: RELAY_VERSION, id: 'aaaa-0001', peers: [], host: 'aaaa-0001', world: null, now: Date.now() + 2000 });
    assert.equal(s.clockWarning, null, 'a sane clock clears it');
    assert.equal(s.statusLine(), null);
  } finally { console.warn = warn; console.info = info; }
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## OL3 \(2026-09-14\)/, 'the record');
});
