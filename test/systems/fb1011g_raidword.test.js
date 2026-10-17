// RAID-WORD (FIELD BUGS 2026-10-11g #3, the Discord's "Doesn't register raid 20%ish of the time": "I thought maybe it was
// because the raid would sometimes lead you way out of town, but i have had many raids end within town after 20 kills,
// and nothing pops up"). Two ways the town's ledger stood short of its target while the raid looked over here, each
// driven through the real client (systems/raidingParties.js) on RAID3's recording host: a death tallied past the
// location's rect - still on the town's map pixel, where the relay credits a word (server/src/index.js _raidWord's
// `here`) - was never said; and a jump's sweep (scenes/world.js exteriorFoes.clearLive) took every raider and defender
// out of the pool without a death, so the raid kept them standing and stood no one under its cap for the rest of it.
// And the held map's raid card reads the town's ledger, not this machine's share. bible/01-Overview/bugs/Field-Bugs-2026-10-11g.md.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  raidFrame as frame, restoreRaidSaveData as restoreSaveData, raidState, setRaidingPartiesHost, raidRelayWord,
  raidRelayState, raidPoolCleared, _resetRaidingParties, MAX_RAID_ENEMIES,
} from '../../src/systems/raidingParties.js';
import { raidMapMarks } from '../../src/ui/eventMapMarks.js';
import { raidSig } from '../../src/net/raid/raidLaw.js';
import { worldRoom } from '../../src/net/wire.js';
import { setSharedClock } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { _resetRenownKillsForTests } from '../../src/net/renownTracker.js';
import { _resetModSettings } from '../../src/systems/modSettings.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((res) => setImmediate(res));
const DAY = 400;
const AT = (min) => DAY * MINUTES_PER_DAY + min;
const KEY = `3:7:${DAY}`;
const raidRec = (o = {}) => ({
  regionIndex: 3, locationIndex: 7, startDay: DAY, locationName: 'Gothway Garden', type: 2,
  startMinute: AT(600), endMinute: AT(720), killed: 0, attackAmount: 20, cleansed: false,
  announced: true, struck: false, px: 200, py: 100, ...o,
});
/** RAID3's recording host: the words said, the raiders and defenders stood. */
function rig({ relay = true } = {}) {
  const at = { now: AT(610), wall: 100000, me: 'mmm-0002', town: { regionIndex: 3, locationIndex: 7 }, pixel: { x: 200, y: 100 }, region: 3, relay, allowed: false };
  const log = { words: [], raiders: [], defenders: [], said: [] };
  let seq = 0;
  const foe = (mobileType) => ({ mobileType, dead: false, corpse: false, entity: { health: 10 }, ai: { feet: [seq, 0, 0] }, uid: ++seq });
  setRaidingPartiesHost({
    now: () => at.now, random: () => 0, wallNow: () => at.wall, selfId: () => at.me, maps: () => null, picker: () => null,
    regionIndex: () => at.region, regionName: (r) => `Region${r}`, townHere: () => at.town, playerPixel: () => at.pixel,
    peersInTown: () => [], raidPuppets: () => [], ownRaidFoes: () => [],
    standRaider: (mt) => { const f = foe(mt); log.raiders.push(f); return Promise.resolve(f); },
    standDefender: () => { const g = foe(146); g.defender = true; log.defenders.push(g); return Promise.resolve(g); },
    defenderCount: () => log.defenders.filter((g) => !g.dead).length, defendersAllowed: () => at.allowed,
    removeFoe: (f) => { f.dead = true; }, outOfSight: () => true,
    reputation: () => ({ player: { legalRep: {} }, store: { dict: new Map() } }), say: (line) => log.said.push(line),
    relayRaids: () => at.relay, sendRaid: (w, cell) => { log.words.push({ w, cell }); return true; },
  });
  return { at, log };
}
/** A raider of mine falls, a body left - the way exteriorFoes' damageFoe leaves one. */
const fell = (f) => { f.dead = true; f.corpse = true; f.entity.health = 0; };

beforeEach(() => {
  _resetRaidingParties();
  _resetRenownKillsForTests();
  _resetModSettings();
  setSharedClock(null);
});

test('RAID-WORD: a raider of mine that falls past the town\'s rect, on its map pixel, is said to the town\'s ledger - the relay credits a word from the pixel, and the fight drifts out of a hamlet\'s 300 m; off the pixel nothing is said, and a raid I never fought is not said from past the rect (mutants: the pixel\'s raid unsaid; any raid on the pixel said; the pixel unread)', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ killed: 16, struck: true })] });
  setSharedClock(() => at.now);
  frame(1);   // the runner: in the rect, a raider stood
  await tick();
  assert.equal(log.words.at(-1).w.n, 16, 'in the rect, my word');
  assert.equal(log.raiders.length, 1);
  at.town = null;   // the fight drifted past the rect - still the town's pixel
  fell(log.raiders[0]);
  assert.equal(frame(0), 'idle', 'past the rect the raid stands no one');
  assert.equal(raidState().raids[0].killed, 17, 'the death is tallied here');
  assert.deepEqual(log.words.at(-1), { w: { k: 'w', key: KEY, st: AT(600), tg: 20, ty: 2, px: 200, py: 100, n: 17, s: 1 }, cell: worldRoom(200, 100) },
    'and said to the town\'s cell at once - the relay\'s count is the cleanse');
  const n = log.words.length;
  at.pixel = { x: 201, y: 100 };
  raidState().raids[0].killed = 18;
  frame(0);
  assert.equal(log.words.length, n, 'off the town\'s pixel: nothing - the relay would credit none of it');
  // a raid on the pixel I never fought, stood past its rect: not mine to say
  _resetRaidingParties();
  const second = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec()] });
  setSharedClock(() => second.at.now);
  second.at.town = null;
  frame(0);
  assert.equal(second.log.words.length, 0, 'never fought: no word from past the rect');
  raidState().raids[0].struck = true;
  frame(0);
  assert.equal(second.log.words.at(-1)?.w.s, 1, 'a blow struck there is a word');
  await tick();
});

test('RAID-WORD: past the rect the last deaths reach the ledger, and the relay\'s cleanse closes the raid - the player who fought the town is told it was held (the report\'s "nothing pops up")', async () => {
  const { at, log } = rig();
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ killed: 19, struck: true, attackAmount: 20 })] });
  setSharedClock(() => at.now);
  frame(1);
  await tick();
  at.town = null;
  fell(log.raiders[0]);
  frame(0);
  assert.equal(log.words.at(-1).w.n, 20, 'the twentieth death said from past the rect');
  const g = raidSig({ st: AT(600), tg: 20, ty: 2, px: 200, py: 100 });
  assert.equal(raidRelayWord({ k: 'cl', key: KEY, g, top: [], n: 1 }, worldRoom(200, 100)), true);
  assert.equal(raidState().raids[0].cleansed, true, 'the relay\'s cleanse closes it here');
  assert.match(log.said.at(-1), /Gothway Garden/, 'and says so');
});

test('RAID-WORD: a jump\'s sweep - the pool emptied, no one dead - frees the raid\'s places: twenty-five stood, the sweep, and back in the town a raider stands again; a raider that fell before the sweep is still tallied (mutants: the sweep keeps the stood; the fallen untallied; the host never tells the raid)', async () => {
  const { at, log } = rig({ relay: false });
  restoreSaveData({ lastSelectedDay: DAY, raids: [raidRec({ attackAmount: 99 })] });
  while (log.raiders.length < MAX_RAID_ENEMIES) { frame(1); await tick(); }
  for (let i = 0; i < 6; i++) { frame(1); await tick(); }
  assert.equal(log.raiders.length, MAX_RAID_ENEMIES, 'twenty-five standing, and no more');
  fell(log.raiders[0]);   // one falls the frame the jump comes, before the tally reads it
  raidPoolCleared();   // the jump: exteriorFoes.clearLive() took every one of them, none dead
  at.town = null; frame(1);
  at.town = { regionIndex: 3, locationIndex: 7 };
  assert.equal(raidState().raids[0].killed, 1, 'the one that fell is tallied');
  for (let i = 0; i < 6; i++) { frame(1); await tick(); }
  assert.ok(log.raiders.length >= MAX_RAID_ENEMIES + 4, `back in the town the raid stands raiders again, one a clock - the swept hold no place (${log.raiders.length - MAX_RAID_ENEMIES} new)`);
});

test('RAID-WORD by source: the world host tells the raid of its sweep beside the sweep itself - every jump, load and respawn runs it', () => {
  const w = read('src/scenes/world.js');
  const sweep = w.indexOf('    exteriorFoes.clearLive();\n'), guards = w.indexOf('    cityGuards.clearLive();\n');
  assert.ok(sweep > 0 && guards > sweep, 'the sweep this pin reads');
  assert.match(w.slice(guards, guards + 400), /\n {4}raidPoolCleared\(\);   \/\/ FIELD BUGS 2026-10-11g RAID-WORD/, 'the sweep, then the raid told');
  assert.match(w, /import \{[^}]*\braidPoolCleared\b[^}]*\} from '\.\.\/systems\/raidingParties\.js';/);
});

test('RAID-WORD: the held map\'s raid card reads the town\'s ledger at a raid relay - its count and its target, the day\'s roll of 15 to 25 - and this machine\'s share without one (mutants: the ledger unread; its target unread)', () => {
  const r = raidRec({ killed: 4, attackAmount: 20 });
  assert.equal(raidMapMarks([r], AT(610))[0].tip.lines[2], '4 of 20 driven off', 'no ledger: my share');
  const ledger = (key) => (key === KEY ? { n: 17, tg: 23, c: 0 } : null);
  assert.equal(raidMapMarks([r], AT(610), { relay: ledger })[0].tip.lines[2], '17 of 23 driven off', 'the town\'s count against the town\'s target');
  assert.equal(raidMapMarks([raidRec({ killed: 0 })], AT(610), { relay: ledger })[0].tip.lines[2], '17 of 23 driven off', 'a player who has killed none here still sees the town\'s');
  assert.equal(raidMapMarks([r], AT(610), { relay: () => null })[0].tip.lines[2], '4 of 20 driven off');
  assert.match(read('src/scenes/world.js'), /raidMapMarks\(raidState\(\)\.raids, worldMinutes\(\), \{ [^}]*relay: raidRelayState \}\)/, 'the world host hands it the ledger');
  assert.equal(typeof raidRelayState, 'function');
});
