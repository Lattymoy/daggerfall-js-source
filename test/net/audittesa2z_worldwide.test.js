// AUDIT TESA II Z2 and Z6 (2026-10-25, lane Z; bible/03-World/World-Wide.md "Folded into TESA"): THE WORLD-WIDE RELAY.
// The arc put four words past the Bay on the wire - a gate's lanes, a province's channels, a hall of Cyrodiil's and (AUDIT
// TESA-BIOME F2) a spawn grant's world pixel - and they shipped in one relay. Three gates stood as literals at 256 after
// the merge with main renumbered that relay to world260, and passed main's world256-world259, which read none of it; the
// fourth had no gate at all. Now they are one number (net/wire.js WORLD_WIDE_RELAY_MIN), held here to the LAW row of
// test/net/relayversion.test.js that names WORLD-WIDE, and the row before it refused at every gate; and a client on an
// older relay takes no grant off the Bay's map (net/grantLaw.js grantPixelReadBack, scenes/grantHost.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORLD_WIDE_RELAY_MIN, relaySupportsWorldWide, RELAY_VERSION, GATE_LANES_RELAY_MIN, relaySupportsGateLanes,
  PROVINCE_REGIONS_RELAY_MIN, relaySupportsProvinceRegions, WDUN_WORLD_RELAY_MIN, relaySupportsWdunWorld, worldRoom,
} from '../../src/net/wire.js';
import { GRANT_WORLD_RELAY_MIN, relaySupportsGrantWorld, grantPixelReadBack, GRANT_RENEW_LEAD_MS } from '../../src/net/grantLaw.js';
import { createGrantHost } from '../../src/scenes/grantHost.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const num = (v) => Number(/^world(\d+)$/.exec(v)?.[1]);

test('AUDIT TESA II Z2 THE WORLD-WIDE RELAY IS ONE NUMBER, ITS LAW ROW\'S: the four gates its own (the lanes, the provinces\' channels, Cyrodiil\'s halls, a grant\'s world pixel); the row of relayversion.test.js that names WORLD-WIDE is that number; the relay row before it refused at every gate, the row itself and RELAY_VERSION let through (mutants: the number behind its row; a gate an older relay passes; a gate its own number again)', () => {
  const law = read('test/net/relayversion.test.js');
  const rows = [...law.matchAll(/^ {2}world(\d+): '[0-9a-f]{64}',/gm)].map((m) => Number(m[1]));
  const ww = [...law.matchAll(/^ {2}world(\d+): '[0-9a-f]{64}',\s+\/\/[^\n]*WORLD-WIDE folded into TESA/gm)].map((m) => Number(m[1]));
  assert.equal(ww.length, 1, 'one LAW row names WORLD-WIDE');
  assert.equal(WORLD_WIDE_RELAY_MIN, ww[0], 'the one number is the world-wide relay\'s own row - a merge that renumbers the row moves it');
  assert.ok(num(RELAY_VERSION) >= WORLD_WIDE_RELAY_MIN, 'this relay reads the world');
  const before = Math.max(...rows.filter((n) => n < WORLD_WIDE_RELAY_MIN));
  assert.equal(before, 259, 'the row before it: main\'s ASK-LONGER (the relay production served at the audit)');
  assert.deepEqual([GATE_LANES_RELAY_MIN, PROVINCE_REGIONS_RELAY_MIN, WDUN_WORLD_RELAY_MIN, GRANT_WORLD_RELAY_MIN], Array(4).fill(WORLD_WIDE_RELAY_MIN));
  const gates = { relaySupportsWorldWide, relaySupportsGateLanes, relaySupportsProvinceRegions, relaySupportsWdunWorld, relaySupportsGrantWorld };
  for (const [name, gate] of Object.entries(gates)) {
    assert.equal(gate(`world${before}`), false, `${name}: the relay before the world-wide one`);
    for (const v of ['world255', 'world256', null, '', 'world', 'worldX']) assert.equal(gate(v), false, `${name}: ${v}`);
    assert.equal(gate(`world${WORLD_WIDE_RELAY_MIN}`), true, `${name}: the world-wide relay`);
    assert.equal(gate(RELAY_VERSION), true, `${name}: this relay`);
  }
});

test('AUDIT TESA II Z6 A GRANT PAST THE BAY ONLY OF A RELAY THAT READS IT BACK: an older relay mints one on any pose\'s pixel and junks its renewal, carry and handover - so a client on it takes no grant off the Bay\'s map (the stand stands ungranted, as before AUDIT TESA-BIOME F2) and asks none of it again; on the world-wide relay the same grant is taken, renewed and carried; the session\'s word is relaySupportsGateLanes\'s, the world-wide one (mutants: the read-back unread at the mint; the renewal\'s filter dropped; the carry\'s filter dropped; the handover\'s filter dropped; the Bay\'s own map refused; the session\'s word unread)', async () => {
  assert.deepEqual([grantPixelReadBack({ p: [402, 151] }, false), grantPixelReadBack({ p: [999, 499] }, false), grantPixelReadBack({ p: [2400, 900] }, false), grantPixelReadBack({ p: [-3, 10] }, false), grantPixelReadBack({ p: [402, 500] }, false), grantPixelReadBack({ p: [2400, 900] }, true)],
    [true, true, false, false, false, true], 'the Bay\'s map alone, of an older relay; any world pixel of the world-wide one');
  assert.match(read('src/net/online.js'), /this\.gateLanesOk = relaySupportsGateLanes\(relayV\);/, 'the session\'s word off its welcome');
  assert.equal(relaySupportsGateLanes, relaySupportsGrantWorld, 'one test, the world-wide relay\'s');
  let t = 1_000_000;
  const rig = (worldOk) => {
    const sent = [];
    const s = { status: 'open', grantMode: 'measure', room: worldRoom(2400, 900), gateLanesOk: worldOk, sendGrant: (a) => { sent.push(a); return true; } };
    const host = createGrantHost({ session: () => s, now: () => t, fetchKey: async () => null, wait: 20 });
    return { s, host, sent };
  };
  const grant = (p, g = 7, q = worldRoom(p[0], p[1])) => ({ g, o: 'sock-mac-01', q, a: 'acct-mac', k: 'enc', p, m: 9, l: 12, r: 0, n: 1, s: 77, e: 0, c: [-1], h: -1, x: t + 10 * 60_000, sg: 'A'.repeat(86) });
  const mint = async (h, p) => {
    const got = h.host.memberFor('enc');
    await Promise.resolve(); await Promise.resolve();
    const ask = h.sent.at(-1);
    assert.equal(ask?.k, 'mint');
    h.host.answer({ k: 'ok', id: ask.id, gr: grant(p) });
    return got;
  };
  const old = rig(false);
  assert.equal(await mint(old, [2400, 900]), null, 'an older relay\'s grant past the Bay: no grant - the stand stands ungranted');
  const onBay = await mint(old, [402, 151]);
  assert.deepEqual(onBay?.gr?.p, [402, 151], 'the Bay\'s own grant, as ever');
  const ww = rig(true);
  const past = await mint(ww, [2400, 900]);
  assert.deepEqual(past?.gr?.p, [2400, 900], 'the world-wide relay\'s, taken');
  // held from a world-wide relay, then on an older one (a rollback's): never renewed nor carried there
  const f = {};
  ww.host.stood(past.gr, past.i, f);
  ww.s.gateLanesOk = false;
  t = past.gr.x - GRANT_RENEW_LEAD_MS + 1;
  const n = ww.sent.length;
  ww.host.tick();
  assert.equal(ww.sent.slice(n).filter((a) => a.k === 'renew').length, 0, 'no renewal an older relay would junk');
  ww.s.room = worldRoom(2420, 900);
  ww.host.tick(); await Promise.resolve(); await Promise.resolve();
  assert.equal(ww.sent.slice(n).filter((a) => a.k === 'carry').length, 0, 'no carry either');
  ww.s.gateLanesOk = true;
  ww.s.room = past.gr.q;
  ww.host.tick(); await Promise.resolve();
  assert.equal(ww.sent.slice(n).filter((a) => a.k === 'renew').length, 1, 'of the world-wide relay, renewed');
  // a member handed on: never to an older relay, which would junk the handover
  const g2 = {}, g3 = {};
  ww.host.stood(past.gr, 0, g2); ww.host.stood(past.gr, 0, g3);
  ww.s.gateLanesOk = false;
  const n2 = ww.sent.length;
  ww.host.handed(g2, 'sock-ann-01'); await Promise.resolve(); await Promise.resolve();
  assert.equal(ww.sent.slice(n2).filter((a) => a.k === 'heir').length, 0, 'no handover an older relay would junk');
  ww.s.gateLanesOk = true;
  ww.host.handed(g3, 'sock-ann-01'); await Promise.resolve(); await Promise.resolve();
  assert.equal(ww.sent.slice(n2).filter((a) => a.k === 'heir').length, 1, 'of the world-wide relay, handed on');
});
