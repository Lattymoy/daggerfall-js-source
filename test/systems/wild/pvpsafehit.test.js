// PVP-SAFE-HIT (bible/11-Multiplayer/PvP-Rework.md): in a settlement's safe streets of the open zone, a player who is no
// villain may strike a red villain, and no blow lands on that player there. The client says the streets to the referee
// (`zone` with `sf` 1); a relay before world283 is told 0 there, as before.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newWildRef, wildZone, wildBlow, wildStreetsBar, WILD_GRACE } from '../../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { validWildData, relaySupportsWildStreets, WILD_STREETS_RELAY_MIN, RELAY_VERSION } from '../../../src/net/wire.js';
import { OnlineSession } from '../../../src/net/online.js';
import { peaceFor, streetsStrike } from '../../../src/systems/wild/villainHunt.js';
import { isVillain, VILLAIN } from '../../../src/systems/wild/villainLaw.js';
import { ZONE_SAFE_TEXT } from '../../../src/systems/wild/zoneSafe.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
import { hostText } from '../../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const W = hostText('src/scenes/world.js');
const lineOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n', i) + 1); };
const blockOf = (head) => { const i = W.indexOf(head); assert.ok(i >= 0, `the host holds ${head}`); return W.slice(i, W.indexOf('\n  };\n', i) + 5); };

/** Two fighters a pace apart, in the zone past any safe passage: `a` and `b` each with its streets word and meter. */
const pair = ({ aSf = false, bSf = false, aVl = 0, bVl = 0 } = {}) => {
  const st = newWildRef(), now = 1_000_000;
  for (const [sub, id, x] of [['a', 'A', 0], ['b', 'B', SIEGE_UNITS_PER_M]]) wildZone(st, sub, { id, lv: 10 }, true, { x, y: 0, z: 0 }, now - WILD_GRACE.ms - 20_000);
  wildZone(st, 'a', { id: 'A', lv: 10, vl: aVl, sf: aSf }, true, { x: 0, y: 0, z: 0 }, now - 10_000);
  wildZone(st, 'b', { id: 'B', lv: 10, vl: bVl, sf: bSf }, true, { x: SIEGE_UNITS_PER_M, y: 0, z: 0 }, now - 10_000);
  return { st, now };
};
const blow = (o, by = 'a', to = 'b') => { const { st, now } = pair(o); return wildBlow(st, by, to, { d: 5, held: { w: -1, m: 0 } }, now); };

test('PVP-SAFE-HIT THE REFEREE (wildRef.js wildStreetsBar): no blow lands on one in the streets who is no villain; one in the streets strikes a villain alone; a villain\'s streets word shields nothing (mutants: the struck one\'s streets unread; the striker\'s unread; the villain\'s exception dropped; the word kept off the zone)', () => {
  const red = VILLAIN.red;
  assert.equal(blow({ bSf: true }).why, 'streets', 'struck in the streets: nothing lands');
  assert.equal(blow({ aSf: true }).why, 'streets', 'from the streets at a plain player: nothing lands');
  const atVillain = blow({ aSf: true, bVl: red });
  assert.ok(atVillain.ok && atVillain.dealt > 0, `from the streets at a red villain: it lands (${atVillain.why})`);
  assert.equal(blow({ aSf: true, bVl: red }, 'b', 'a').why, 'streets', 'the villain cannot strike back into the streets');
  const crafted = blow({ bSf: true, bVl: red });
  assert.ok(crafted.ok && crafted.dealt > 0, 'a villain who says the streets is struck all the same - the meter is the referee\'s');
  const open = blow();
  assert.ok(open.ok && open.dealt > 0, 'neither in the streets: the zone as it was');
  assert.equal(wildStreetsBar({ streets: false }, { streets: false }), null);
  const { st, now } = pair({ bSf: true });
  wildZone(st, 'b', { id: 'B', lv: 10, sf: true }, false, null, now);
  assert.equal(st.fighters.get('b').streets, false, 'out of the zone, no streets word');
  assert.match(rd('src/net/sea/seaRef.js'), /if \(wildStreetsBar\(a, x\)\) return no\('streets'\);/, 'a harbour\'s streets refuse a gun as a blow');
  assert.match(rd('server/src/index.js'), /m\.data\.ed === 1, m\.data\.sf === 1\); return; \}/, 'the dispatcher hands `sf` to its own method');
});

test('PVP-SAFE-HIT THE WIRE (wire.js validWildData, relaySupportsWildStreets): `sf` 1 rides a word that I stand in the zone alone; world283 is the first relay that reads it (mutants: `sf` dropped; kept on a word 0; the gate one early)', () => {
  assert.deepEqual(validWildData({ k: 'zone', z: 1, sf: 1, fl: 1 }), { k: 'zone', z: 1, fl: 1, sf: 1 });
  assert.deepEqual(validWildData({ k: 'zone', z: 0, sf: 1 }), { k: 'zone', z: 0 });
  assert.deepEqual(validWildData({ k: 'zone', z: 1, sf: 2 }), { k: 'zone', z: 1 });
  assert.equal(validWildData({ k: 'zone', z: 2 }), null, 'the word on the wire stays 0 or 1');
  assert.equal(WILD_STREETS_RELAY_MIN, 283);
  assert.equal(relaySupportsWildStreets('world282'), false);
  assert.equal(relaySupportsWildStreets('world283'), true);
  assert.equal(relaySupportsWildStreets(RELAY_VERSION), true);
});

test('PVP-SAFE-HIT THE CLIENT\'S LINK (online.js setWildZone 2): to a relay that reads it, 1 with `sf`; to an older one, 0 as before; a step out of the streets is said at once (mutants: the gate unread; the change of streets unsaid)', () => {
  const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {};
  try {
    for (const [v, first] of [[RELAY_VERSION, { z: 1, sf: 1 }], ['world282', { z: 0 }]]) {
      const { FakeWS, sockets } = fakeSocketClass();
      const s = new OnlineSession({ url: 'wss://relay.test', name: 'Example Player', id: 'expl-0001', secret: 'secret-of-expl-0001', WebSocketImpl: FakeWS, now: () => 1000 });
      s.join('world:2,12', { x: 1, y: 0, z: 1, yaw: 0 }); sockets[0].open();
      sockets[0].receive({ t: 'welcome', id: 'expl-0001', peers: [], host: null, world: null, v });
      const zones = () => sockets[0].sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'wild' && m.data?.k === 'zone').map(({ data: { z, sf } }) => (sf ? { z, sf } : { z }));
      s.setWildZone(2);
      assert.deepEqual(zones(), [first], `${v}: the streets`);
      s.setWildZone(1);
      assert.deepEqual(zones(), [first, { z: 1 }], `${v}: out of the streets, the zone`);
    }
  } finally { console.info = info; console.warn = warn; }
});

test('PVP-SAFE-HIT THE HOST\'S DOORS (scenes/world.js wildCan, wildFair, zoneWatchCall, run as they stand): in the streets my word is 2, a red body is fair and no other, and a blow from there calls no watch (mutants: wildFair\'s streets unread; the word 0 in the streets; the watch called)', () => {
  const streets = [10, 0, 10], open = [9999, 0, 9999];
  const scope = {
    online: { wildOk: true, status: 'open', guildTagOf: () => null }, wildHere: () => true, wildOutdoors: () => true,
    settledAt: (p) => p === streets, campToWire: (p) => p, player: { feetAt: () => scope.me }, locationIndex: new Map(), modes: { mode: 'exterior', deathUp: () => false },
    playerEntity: { health: 50 }, me: streets, peers: new Map([['red', open], ['plain', open]]),
    wildKin: () => false, social: { isPartyPeer: () => false }, _wildTruce: { holds: () => false }, duelMgr: { live: false }, myGuildTag: () => null,
    wildAtWire: (p) => !!p, duelWorldOf: (id) => scope.peers.get(id) ?? null, peaceFor, isVillain, streetsStrike, zoneSafe: () => scope.me === streets,
    pvpFlag: { fair: () => true, villainy: () => 100, skullOf: (id) => (id === 'red' ? 'red' : 'white') },
  };
  const body = `${lineOf('  const wildCan = (streets = false) =>')}${blockOf('  const wildFair = (peerId) => {')}`;
  const { wildCan, wildFair } = new Function('S', `with (S) { ${body}\n return { wildCan, wildFair }; }`)(scope);
  assert.deepEqual([wildCan(), wildCan(true)], [false, true], 'in the streets: a fighter, not in the open zone');
  assert.equal(wildFair('red'), true, 'a red villain is fair from the streets');
  assert.equal(wildFair('plain'), false, 'no one else');
  scope.me = open;
  assert.equal(wildFair('plain'), true, 'out of the streets, as before');
  assert.ok(W.includes('online?.setWildZone?.(wildCan() ? 1 : wildCan(true) ? 2 : 0, '), 'my word 2 in the streets');
  assert.ok(W.includes('    can: () => wildCan(true),\n    fair: wildFair,'), 'the fight\'s own door lets a blow from the streets reach wildFair');
  const crimes = [];
  const ws = { modes: { mode: 'exterior' }, _isPlayerInTownStrict: () => true, wildHere: () => true, performance: { now: () => 100_000 }, zoneSafe: () => true,
    setCrimeCommitted: (_e, c) => crimes.push(c), playerEntity: {}, CRIMES: { Assault: 'assault' }, _crimeResponse: () => {}, townTalk: { say: () => {} } };
  const { zoneWatchCall } = new Function('S', `with (S) { ${lineOf('  let _zoneWatchAt = -Infinity;')}${blockOf('  const zoneWatchCall = () => {')}\n return { zoneWatchCall }; }`)(ws);
  zoneWatchCall();
  assert.deepEqual(crimes, [], 'a blow at a villain from the streets is no assault');
});

test('PVP-SAFE-HIT THE WORDS (zoneSafe.js ZONE_SAFE_TEXT): the safe line says I can attack a villain (mutants: the old line back)', () => {
  assert.equal(ZONE_SAFE_TEXT.enter, 'You are in the streets of a city, town or village: a safe zone. Other players cannot attack you here. You can attack a villain.');
  assert.equal(ZONE_SAFE_TEXT.rule, 'Cities, towns and villages are safe zones: no player can attack another in their streets. A villain is never safe, and you can attack one from the streets.');
});
