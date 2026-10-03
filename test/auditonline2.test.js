// AUDIT ONLINE 2 (2026-09-28, Mac: "Fix it and do another audit"): what AUDIT ONLINE left "not changed, said so", fixed
// and pinned here - beside RAID-ROLL (test/raidroll.test.js: the relay reads the day's roll) and the corpse pile's way
// back (test/world6biiic.test.js, F4):
//   F2 a receipt's life is the RELAY's clock - a device a week ahead let every receipt go unasked;
//   F3 a load in the session is a stand-up - the spoils pools let go of what they held in the old pack, and the crash's
//      door asks again (a town's thanks, a load from before them, a save: the record cleared, the pieces in no pack);
//   F5 a trade a peer's game refused says so - "your offer was not valid" blamed the wrong player, and the reader of an
//      offer from a newer build is told to reload.
// bible/03-World/Raiding-Parties.md, "AUDIT ONLINE 2".
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { mintReceipt } from '../src/net/gateReceipt.js';
import { createRaidClaims, RAID_CLAIMS_KEY } from '../src/net/raidClaims.js';
import { createGateClaims } from '../src/net/gateClaims.js';
import { createSpoilsPool, recoverSpoils } from '../src/scenes/spoilsPool.js';
import { RAID_SPOILS_KEYS, RAID_SPOILS_RECORDS_MAX } from '../src/systems/raidSpoils.js';
import { onSlotLoaded, slotLoaded } from '../src/systems/saveSlots.js';
import { createTradeManager, inTradeRange, tradeRefusedText, tradeUnreadableText, tradeWhyText } from '../src/net/tradeSession.js';
import { validTradeData } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const subtle = globalThis.crypto.subtle;
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((res) => setImmediate(res)); };
const memStore = () => { const m = new Map(); return { get: (k) => (m.has(k) ? JSON.parse(m.get(k)) : undefined), set: (k, v) => m.set(k, JSON.stringify(v)), remove: (k) => m.delete(k), m }; };

// ═══ F2: THE RELAY'S CLOCK ═══════════════════════════════════════════════════════════════════════

test('AUDIT ONLINE2 F2: A RECEIPT\'S LIFE IS THE RELAY\'S CLOCK - the raid and gate carriers keep and offer a receipt whatever this device\'s clock says while no relay clock is heard (the service judges it), let go unasked only one the relay\'s clock says is past, and the world host hands both carriers the relay\'s clock (mutants: the device\'s clock back; "unheard" read as expired; the host\'s clock unwired)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const minted = 1_900_000_000;
  const raid = await mintRaidReceipt({ w: '3:7:600', s: 'acct-me', c: 5, y: 2 }, kp.privateKey, { subtle, nowS: minted });
  const gate = await mintReceipt({ d: 700, b: 'ruhn', s: 'acct-me', c: 4242, x: 'dealt' }, kp.privateKey, { subtle, nowS: minted });
  for (const [what, make, add] of [
    ['raid', (o) => createRaidClaims(o), (q, r) => q.add(r, 'char-0001', 'Ann', 3)],
    ['gate', (o) => createGateClaims(o), (q, r) => q.add(r)],
  ]) {
    const r = what === 'raid' ? raid : gate;
    // unheard: kept and offered, whatever this device thinks
    const asked = [];
    const st = memStore();
    const q = make({ claim: async (x) => { asked.push(x); return { ok: false, error: 'offline' }; }, store: st, nowS: () => null, nowMs: () => 0, me: () => 'acct-me' });
    assert.equal(add(q, r), true, `${what}: no relay clock heard - kept`);
    await settle();
    assert.equal(asked.length, 1, `${what}: and offered - the service judges its life`);
    assert.equal(q.kept().length, 1);
    // the relay's clock, a day on: still good
    const q2 = make({ claim: async () => ({ ok: false, error: 'offline' }), store: memStore(), nowS: () => minted + 86_400, nowMs: () => 0, me: () => 'acct-me' });
    assert.equal(add(q2, r), true, `${what}: the relay's clock inside its week`);
    // the relay's clock past its end: let go unasked
    const late = [];
    const q3 = make({ claim: async (x) => { late.push(x); return { ok: false, error: 'offline' }; }, store: memStore(), nowS: () => minted + 30 * 86_400, nowMs: () => 0, me: () => 'acct-me' });
    assert.equal(add(q3, r), false, `${what}: past its end by the relay's clock`);
    await settle();
    assert.deepEqual(late, [], `${what}: never asked`);
  }
  const w = rd('src/scenes/world.js');
  assert.match(w, /const relayNowS = \(\) => \(_sharedClockHeard \? Math\.floor\(\(Date\.now\(\) \+ _sharedOffsetMs\) \/ 1000\) : null\);/);
  assert.match(w, /online\.onClock = \(offsetMs\) => \{ const was = _sharedOffsetMs; _sharedOffsetMs = offsetMs; _sharedClockHeard = true;/);
  assert.match(w, /createGateClaims\(\{\n\s*claim: \(r\) => _accountGates\.claim\(r, gateSeatWord\(r\)\),\n\s*me: _accountGates\.me,\n\s*nowS: relayNowS,/);
  assert.match(w, /createRaidClaims\(\{\n\s*claim: _accountRaids\.claim,\n\s*me: _accountRaids\.me,\n\s*nowS: relayNowS,/);
  assert.equal(RAID_CLAIMS_KEY, 'raid4.raidClaims');
});

// ═══ F3: A LOAD IS A STAND-UP ════════════════════════════════════════════════════════════════════

test('AUDIT ONLINE2 F3: A LOAD IN THE SESSION IS A STAND-UP - a town\'s thanks given, a save from before them loaded, then a save: the record is NOT cleared (the pool let go of what it held in the old pack), and the crash\'s door hands the pieces again; saved once more, it clears; both loads say so and the world host re-asks the door (mutants: the pool never lets go; the door never asked again; a load unsaid)', async () => {
  const st = memStore();
  const took = [];
  const pool = createSpoilsPool({ ray: () => null, now: () => 0, take: (p) => took.push(p), say: () => {}, store: st, who: () => 'char-A', keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX });
  const list = [{ kind: 'gold', gold: 40, tier: 'common' }];
  assert.equal(pool.grant({ day: 'raid:3:7:600', acct: 'acct-me', roll: () => list }), true);
  assert.deepEqual(took, list, 'the thanks in the pack');
  assert.equal(pool.loaded('char-B'), 0, 'another character\'s load lets go of nothing');
  assert.equal(pool.loaded('char-A'), 1, 'the load: the old pack, and the pieces in it, are gone');
  assert.equal(pool.saved('char-A'), 0, 'a save now holds nothing of theirs - the record stays');
  assert.equal(st.get(RAID_SPOILS_KEYS.store).length, 1);
  const again = [];
  assert.equal(recoverSpoils(st, (p) => again.push(p), { who: 'char-A', key: RAID_SPOILS_KEYS.store, onHanded: (rec) => pool.adopt(rec) }), 1, 'the crash\'s door hands them again');
  assert.deepEqual(again, list);
  assert.equal(pool.saved('char-A'), 1, 'and the next save holds them: cleared');
  assert.equal(st.get(RAID_SPOILS_KEYS.store), undefined);
  // the load's word
  const heard = [];
  const off = onSlotLoaded((c) => heard.push(c));
  const offBad = onSlotLoaded(() => { throw new Error('a listener\'s own bug'); });
  const warn = console.warn; console.warn = () => {};
  try { slotLoaded('char-A'); slotLoaded(undefined); } finally { console.warn = warn; }
  off(); offBad();
  slotLoaded('char-C');
  assert.deepEqual(heard, ['char-A', null], 'told, a throwing listener kept from the rest, and unsubscribed');
  const w = rd('src/scenes/world.js'), dc = rd('src/scenes/dungeonContext.js');
  assert.match(w, /townTalk\.say\(localizedText\('gameLoaded', 'Game loaded\.'\)\);\n\s*slotLoaded\(playerEntity\.characterId \?\? null\);/, 'the world\'s load says it');
  assert.match(dc, /if \(announce\) hudText\.add\(localizedText\('gameLoaded', 'Game loaded\.'\)\);[^\n]*\n\s*slotLoaded\(playerEntity\.characterId \?\? null\);/, 'and the dungeon\'s');
  assert.match(w, /onSlotLoaded\(\(characterId\) => \{ spoilsPool\.loaded\(characterId\); raidSpoils\.loaded\(characterId\); _spoilsAskedFor = null; \}\);/, 'the pools let go and the door asks again');
  assert.ok(w.indexOf('let _spoilsAskedFor = null;') < w.indexOf('onSlotLoaded((characterId)'), 'registered after what it resets');
});

// ═══ F5: A REFUSED TRADE SAYS WHOSE ══════════════════════════════════════════════════════════════

function makePack(ids, gold) {
  const st = { items: ids.map((id) => ({ id, stackCount: 1 })), gold };
  return {
    st,
    offerable: () => null,
    wire: (entries) => entries.map(({ item, count }) => ({ id: item.id, n: count })),
    unwire: (recs) => (recs.every((r) => r && typeof r.id === 'string') ? recs.map((r) => ({ id: r.id, stackCount: r.n })) : null),
    take: (entries, g) => { if (g > st.gold) return null; st.gold -= g; st.items = st.items.filter((it) => !entries.some((e) => e.item === it)); return { entries, g }; },
    restore: (h) => { st.gold += h.g; for (const e of h.entries) st.items.push(e.item); },
    give: (items, g) => { st.gold += g; for (const it of items) st.items.push(it); },
    fits: () => true,
    gold: () => st.gold,
  };
}

test('AUDIT ONLINE2 F5: AN OFFER THIS BUILD CANNOT READ ends the trade with the reader told to reload, and its maker told the reader\'s game refused - never "your offer was not valid"; nothing moves (mutants: the old words on either side)', () => {
  const q = [], said = { A: [], B: [] };
  const mk = (me, other, id, pack) => createTradeManager({
    pack, now: () => 0, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
    near: () => inTradeRange([0, 0, 0], [1, 0, 0]), open: () => {},
  });
  const packA = makePack(['set-piece'], 10), packB = makePack(['ring'], 10);
  packB.unwire = (recs) => (recs.some((r) => r.id === 'set-piece') ? null : recs.map((r) => ({ id: r.id, stackCount: r.n })));   // B's build predates the piece
  const A = mk('A', 'Bran', 'peerAAAA', packA), B = mk('B', 'Ann', 'peerBBBB', packB);   // each side names its peer
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  A.request('peerBBBB'); pump(); B.request('peerAAAA'); pump();
  assert.ok(A.session && B.session);
  assert.equal(A.session.setOffer([{ item: packA.st.items[0], count: 1 }], 0).ok, true);
  pump();
  assert.equal(said.B.at(-1), tradeUnreadableText('Ann'), 'the reader: the offer holds what its game does not know - reload');
  assert.equal(said.A.at(-1), tradeRefusedText('Bran'), 'its maker: the reader\'s game refused it');
  assert.notEqual(said.A.at(-1), tradeWhyText('refused', 'Bran'), 'never "Bran\'s offer was not valid"');
  assert.deepEqual([packA.st.items.map((i) => i.id), packB.st.items.map((i) => i.id)], [['set-piece'], ['ring']], 'nothing moved');
  assert.match(tradeUnreadableText('Ann'), /reload/);
});
