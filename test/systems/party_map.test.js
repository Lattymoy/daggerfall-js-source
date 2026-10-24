// PARTY-MAP (2026-09-30, Discord: "share map data between party members, possibly with a spell effect so that
// maintaining some kind of buff for it becomes part of the dungeoneering loop"): SHARED CARTOGRAPHY. The wire's law on
// both ends, the hub's party-only fan, the session's send and receive, the automap merge (revealed, never trail or
// visitedThisRun), the sender's batching (buff and dungeon and party, new rows only, capped), and the effect itself
// (a BUFF_KINDS row, in the Spell Maker, priced at Mysticism, on the spell shop's shelf online).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseClient, validAmapFrame, amapBody, validAmapRow, validAmapDungeon, amapShareGate, relaySupportsPartyMap,
  AMAP_KEYS_MAX, AMAP_SEND_MS, AMAP_HUB_MIN_MS, CHAT_WORLD_ROOM, SOCIAL_ROOM, RELAY_VERSION,
} from '../../src/net/wire.js';
import { OnlineSession } from '../../src/net/online.js';
import {
  enterDungeonAutomap, exitDungeonAutomap, getDungeonAutomap, bindAutomapLayout, buildRevealIndex,
  liveDungeonAutomapKey, mergePartyAutomap, automapDungeonKey,
} from '../../src/systems/automap/automap.js';
import {
  createPartyMapSender, sharedCartographySpell, hasSharedCartography, SHARED_CARTOGRAPHY_KEY, SHARED_CARTOGRAPHY_KIND,
  SHARED_CARTOGRAPHY_SPELL_INDEX,
} from '../../src/systems/party/partyMap.js';
import { BUFF_KINDS, BUFF_START_TEXT, MAGIC_ONLY_KEYS, applySpell } from '../../src/systems/effects.js';
import { SPELL_MAKER_EFFECTS, spellMakerGroups, portEffectDescription } from '../../src/systems/spell/spellEffects.js';
import { EFFECT_COST_TABLE, calculateCastCost, effectSchool } from '../../src/systems/spellcost.js';
import { allowedTargetsOf, TARGET_FLAGS_SELF } from '../../src/systems/spell/spellMaker.js';
import { SKILLS } from '../../src/systems/skills.js';
import { fakeSocketClass } from '../fakeSocket.mjs';
import { fakeRoom } from '../fakeRoom.mjs';

const rd = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const K = '17/Privateer\'s Hold';

// ─── the wire ────────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-MAP wire: the row and dungeon keys are checked by shape - the model\'s and the action system\'s rows, a real automap key; anything else refused', () => {
  for (const ok of ['0:12', '3:40960', 'act:2:512', '12345:1234567890']) assert.equal(validAmapRow(ok), ok, ok);
  for (const bad of ['', 'door:3', 'loot:1', 'act:x:1', '1:2:3', ':1', '1:', '-1:2', 'act:1:-2', '123456:1', '1:12345678901', 12, null, {}, ' 1:2', '1:2 '])
    assert.equal(validAmapRow(bad), null, JSON.stringify(bad));
  assert.equal(validAmapDungeon(automapDungeonKey(17, 'Privateer\'s Hold')), K);
  assert.equal(validAmapDungeon('-1/Some Crypt'), '-1/Some Crypt', 'a location with no region is -1');
  for (const bad of ['Privateer\'s Hold', '17/', '/x', 'a/b', '17/x\u0000y', '17/' + 'x'.repeat(65), 5, null])
    assert.equal(validAmapDungeon(bad), null, JSON.stringify(bad));
});

test('PARTY-MAP wire: parseClient takes {t:\'amap\', k, r} after hello alone, 1..AMAP_KEYS_MAX rows, duplicates folded, one bad row refuses the frame whole', () => {
  const f = (o) => JSON.stringify({ t: 'amap', ...o });
  assert.deepEqual(parseClient(f({ k: K, r: ['0:1', '0:2', '0:1'] }), { hasHello: true }), { t: 'amap', k: K, r: ['0:1', '0:2'] });
  assert.deepEqual(parseClient(f({ k: K, r: ['0:1'] }), { hasHello: false }), { error: 'amap before hello' });
  for (const bad of [{ k: K, r: [] }, { k: K, r: ['0:1', 'nope'] }, { k: K, r: '0:1' }, { k: 'x', r: ['0:1'] }, { r: ['0:1'] },
    { k: K, r: Array.from({ length: AMAP_KEYS_MAX + 1 }, (_, i) => `0:${i}`) }])
    assert.deepEqual(parseClient(f(bad), { hasHello: true }), { error: 'bad amap' }, JSON.stringify(bad).slice(0, 60));
  const full = Array.from({ length: AMAP_KEYS_MAX }, (_, i) => `act:9:${i * 1000}`);
  assert.equal(parseClient(f({ k: K, r: full }), { hasHello: true }).r.length, AMAP_KEYS_MAX, 'a full batch fits the ordinary frame cap');
  assert.deepEqual(amapBody({ k: K, r: ['1:1'] }), { k: K, r: ['1:1'] });
});

test('PARTY-MAP wire: validAmapFrame (the hub\'s frame, at home) wants the sender\'s account and the same body; the gate is a plain cooldown at half the client\'s floor; the relay floor is world134', () => {
  assert.deepEqual(validAmapFrame({ t: 'amap', acct: 'acct-a', name: 'Ana', k: K, r: ['0:1'] }), { t: 'amap', acct: 'acct-a', name: 'Ana', k: K, r: ['0:1'] });
  assert.equal(validAmapFrame({ t: 'amap', acct: 'acct-a', name: null, k: K, r: ['0:1'] }).name, null);
  assert.equal(validAmapFrame({ t: 'amap', k: K, r: ['0:1'] }), null, 'no sender');
  assert.equal(validAmapFrame({ t: 'amap', acct: 'acct-a', k: K, r: ['bad'] }), null);
  assert.equal(validAmapFrame({ t: 'quest', acct: 'acct-a', k: K, r: ['0:1'] }), null);
  assert.equal(validAmapFrame(null), null);
  assert.equal(AMAP_HUB_MIN_MS, AMAP_SEND_MS / 2);
  const g1 = amapShareGate(undefined, 1000);
  assert.equal(g1.pass, true);
  assert.equal(amapShareGate(g1.at, 1000 + AMAP_HUB_MIN_MS - 1).pass, false);
  assert.equal(amapShareGate(g1.at, 1000 + AMAP_HUB_MIN_MS).pass, true);
  assert.equal(relaySupportsPartyMap('world133'), false, 'an older relay closes on the frame');
  assert.equal(relaySupportsPartyMap('world134'), true);
  assert.equal(relaySupportsPartyMap(RELAY_VERSION), true);
  assert.equal(relaySupportsPartyMap(null), false);
});

// ─── the hub ─────────────────────────────────────────────────────────────────────────────────────────────────────

const lastOf = (ws, k) => ws.sent.filter((m) => m.t === 'social' && m.k === k).at(-1) ?? null;
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
  try { await fn({ r, act, join, tick }); } finally { Date.now = realNow; }
}

test('PARTY-MAP hub: a member\'s rows go to the party alone, stamped with the sender\'s account; no party, no fan; a second send inside the cooldown is dropped', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  const amaps = (ws) => ws.sent.filter((m) => m.t === 'amap');
  await r.raw(a, JSON.stringify({ t: 'amap', k: K, r: ['0:1'] })); tick();
  assert.equal(amaps(b).length + amaps(c).length, 0, 'no party yet: nobody hears it');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick();
  await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick(AMAP_SEND_MS);
  await r.raw(a, JSON.stringify({ t: 'amap', k: K, r: ['0:1', '3:40'] })); tick(100);
  assert.deepEqual(amaps(b), [{ t: 'amap', acct: 'acct-a', name: 'a', k: K, r: ['0:1', '3:40'] }], 'the party mate has it, whole');
  assert.equal(amaps(c).length, 0, 'someone outside the party never does');
  assert.equal(amaps(a).length, 0, 'nor the sender');
  await r.raw(a, JSON.stringify({ t: 'amap', k: K, r: ['0:2'] })); tick();
  assert.equal(amaps(b).length, 1, 'inside AMAP_HUB_MIN_MS: dropped');
  tick(AMAP_HUB_MIN_MS);
  await r.raw(a, JSON.stringify({ t: 'amap', k: K, r: ['0:2'] })); tick();
  assert.equal(amaps(b).length, 2, 'after it: fanned');
}));

test('PARTY-MAP hub by source: the relay\'s arm meters, keeps to the hub and the party, and budgets the room', () => {
  const hub = rd('server/src/index.js');
  assert.match(hub, /if \(m\.t === 'amap'\) \{[\s\S]{0,900}?a = this\._meterAmap\(ws, a, now\); if \(!a\) return;\s*\n\s*if \(!isSocialRoom\(a\.key\) \|\| !a\.acct\) \{ this\._junk\(ws\); return; \}/);
  assert.match(hub, /const budget = tokenGate\(this\._roomAmap, now, AMAP_ROOM_HZ_MAX\);/);
  assert.match(hub, /for \(const member of party\.members\) \{ if \(member === a\.acct\) continue; for \(const other of this\._socketsOf\(member\)\) this\._send\(other, out\); \}[^\n]*\n\s*return;\s*\n\s*\}\s*\n\s*if \(m\.t === 'who'\)/);
});

// ─── the session ─────────────────────────────────────────────────────────────────────────────────────────────────

const hubSession = (v = RELAY_VERSION) => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1e6 };
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => clock.t, presence: false, acct: 'acct-me', asecret: 'secret-of-acct-me' });
  s.join(CHAT_WORLD_ROOM, null); sockets[0].open(); sockets[0].receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
  const got = [];
  s.onAmap = (acct, name, k, r) => got.push({ acct, name, k, r });
  const sent = () => sockets[0].sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'amap');
  return { s, sockets, got, sent, clock };
};

test('PARTY-MAP session: shareAutomap sends a checked body at most once per AMAP_SEND_MS, and never to a relay that does not know the frame', () => quiet(() => {
  const { s, sent, clock } = hubSession();
  assert.equal(s.amapOk, true);
  assert.equal(s.shareAutomap(K, ['0:1', 'bad']), false, 'a bad row: nothing sent');
  assert.equal(s.shareAutomap(K, ['0:1']), true);
  assert.deepEqual(sent(), [{ t: 'amap', k: K, r: ['0:1'] }]);
  clock.t += AMAP_SEND_MS - 1;
  assert.equal(s.shareAutomap(K, ['0:2']), false, 'inside the floor');
  clock.t += 1;
  assert.equal(s.shareAutomap(K, ['0:2']), true);
  const old = hubSession('world133');
  assert.equal(old.s.amapOk, false);
  assert.equal(old.s.shareAutomap(K, ['0:1']), false, 'an older relay would close the socket on it');
  assert.equal(old.sent().length, 0);
}));

test('PARTY-MAP session: a mate\'s frame is delivered through the wire\'s door - never my own account\'s, never a malformed one, and a sender flooding inside the hub\'s cooldown is held', () => quiet(() => {
  const { sockets, got, clock } = hubSession();
  sockets[0].receive({ t: 'amap', acct: 'acct-b', name: 'Bea', k: K, r: ['0:1'] });
  assert.deepEqual(got, [{ acct: 'acct-b', name: 'Bea', k: K, r: ['0:1'] }]);
  sockets[0].receive({ t: 'amap', acct: 'acct-me', name: 'Mac', k: K, r: ['0:1'] });
  sockets[0].receive({ t: 'amap', acct: 'acct-c', name: 'Cy', k: K, r: ['<script>'] });
  sockets[0].receive({ t: 'amap', acct: 'acct-b', name: 'Bea', k: K, r: ['0:2'] });
  assert.equal(got.length, 1, 'my own, a bad one and a flood are all dropped');
  clock.t += AMAP_HUB_MIN_MS;
  sockets[0].receive({ t: 'amap', acct: 'acct-b', name: 'Bea', k: K, r: ['0:2'] });
  assert.equal(got.length, 2);
}));

// ─── the automap ─────────────────────────────────────────────────────────────────────────────────────────────────

const box = (x) => ({ min: [x, 0, 0], max: [x + 1, 1, 1] });
const model = () => buildRevealIndex([{ key: '0:1', aabb: box(0) }, { key: '0:2', aabb: box(2) }, { key: 'act:0:3', aabb: box(4) }]);

test('PARTY-MAP automap: a mate\'s rows are marked REVEALED - never visitedThisRun (they draw grey, known but not visited) and never the walked trail; only in the dungeon I stand in, only rows my level holds', () => {
  const rec = enterDungeonAutomap(K, 100);
  bindAutomapLayout(rec, model());
  assert.equal(liveDungeonAutomapKey(), K);
  assert.equal(mergePartyAutomap('17/Some Other Hold', ['0:1']), 0, 'another dungeon: nothing');
  assert.equal(mergePartyAutomap(K, ['0:1', 'act:0:3', '9:9', 42]), 2, 'a row of another layout is dropped');
  assert.deepEqual([...rec.revealed].sort(), ['0:1', 'act:0:3']);
  assert.equal(rec.visitedThisRun.size, 0, 'not visited: DFU\'s grayscale');
  assert.equal(rec.trail?.size ?? 0, 0, 'not walked: the solid sheet inks my own steps');
  assert.equal(mergePartyAutomap(K, ['0:1']), 0, 'a row already known is not new');
  assert.equal(getDungeonAutomap(K), rec);
  exitDungeonAutomap(200);
  assert.equal(liveDungeonAutomapKey(), null);
  assert.equal(mergePartyAutomap(K, ['0:2']), 0, 'outside: nothing lands');
});

// ─── the sender ──────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-MAP sender: only while the buff is live, in a dungeon, in a party - new rows of my OWN scan since the last send, capped, batched at the floor, and kept when a send is refused', () => {
  const snd = createPartyMapSender({ sendMs: 5000, max: 3 });
  const rec = { revealed: new Set(['0:1', '0:2', '9:9']), visitedThisRun: new Set(['0:1', '0:2']) };
  const at = (o) => snd.next({ active: true, inDungeon: true, partied: true, key: K, rec, nowMs: 10_000, ...o });
  assert.equal(at({ active: false }), null, 'no buff: nothing');
  assert.equal(at({ partied: false }), null, 'no party: nothing (offline and solo do nothing at all)');
  assert.equal(at({ inDungeon: false, key: null, rec: null }), null, 'no dungeon: nothing');
  const f1 = at({});
  assert.deepEqual(f1, { k: K, r: ['0:1', '0:2'] }, 'my own scan\'s rows - never a mate\'s (9:9 is revealed, not visited): no echo');
  assert.deepEqual(at({}), f1, 'uncommitted (the link refused it): the same rows wait');
  snd.commit(f1, 10_000);
  assert.equal(snd.sentCount, 2);
  for (const k of ['0:3', '0:4', '0:5', '0:6', 'bad']) rec.visitedThisRun.add(k);
  assert.equal(at({ nowMs: 14_999 }), null, 'inside the batch floor');
  const f2 = at({ nowMs: 15_000 });
  assert.deepEqual(f2.r, ['0:3', '0:4', '0:5'], 'only the new, only well-formed, at most the cap');
  snd.commit(f2, 15_000);
  assert.deepEqual(at({ nowMs: 20_000 }).r, ['0:6'], 'the rest next batch');
  assert.equal(at({ nowMs: 20_000, inDungeon: false, key: null, rec: null }), null);
  assert.equal(snd.sentCount, 0, 'leaving the dungeon forgets what went: the next entry starts whole');
});

test('PARTY-MAP sender by source: world.js feeds it the buff, the dungeon and the party each frame, commits only a send the link took, and merges a mate\'s rows for a party seat alone', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const f = _partyMapSender\.next\(\{ active: hasSharedCartography\(playerEntity\), inDungeon: !!k, partied: !!social\?\.party\?\.members\?\.some\(\(m\) => m\.online && m\.acct !== social\.acct\),/);   // SCALE2b: a mate online
  assert.match(w, /if \(f && socialLink\(\)\?\.shareAutomap\(f\.k, f\.r\)\) _partyMapSender\.commit\(f, nowMs\);/);
  assert.match(w, /link\.onAmap = \(acct, _name, k, r\) => \{ if \(social\.inMyParty\(acct\)\) mergePartyAutomap\(k, r\); \};/);
  assert.match(w, /partyMapFrame\(nowMs\);   \/\/ PARTY-MAP/);
});

// ─── the effect ──────────────────────────────────────────────────────────────────────────────────────────────────

test('PARTY-MAP effect: Shared Cartography is a duration buff (46,255) - in the Spell Maker, CasterOnly, Magic, priced at Mysticism, described in the spellbook', () => {
  assert.equal(BUFF_KINDS[SHARED_CARTOGRAPHY_KEY], SHARED_CARTOGRAPHY_KIND);
  assert.ok(BUFF_START_TEXT[SHARED_CARTOGRAPHY_KIND]);
  assert.ok(MAGIC_ONLY_KEYS.has(SHARED_CARTOGRAPHY_KEY));
  const row = SPELL_MAKER_EFFECTS.find((e) => e.key === SHARED_CARTOGRAPHY_KEY);
  assert.ok(row, 'in the registry');
  assert.equal(row.name, 'Shared Cartography');
  assert.equal(row.craftable, true, 'the maker offers it');
  assert.equal(row.ported, true);
  assert.deepEqual([row.duration, row.chance, row.magnitude], [true, false, false], 'duration alone: keeping it up is the loop');
  assert.ok(spellMakerGroups().includes('Shared Cartography'));
  assert.equal(allowedTargetsOf(46, 255), TARGET_FLAGS_SELF);
  assert.equal(EFFECT_COST_TABLE[SHARED_CARTOGRAPHY_KEY].skill, SKILLS.Mysticism);
  assert.equal(effectSchool({ type: 46, subType: 255 }), SKILLS.Mysticism);
  assert.ok(portEffectDescription(SHARED_CARTOGRAPHY_KEY)?.length > 1, 'the spellbook\'s popup is never empty');
});

test('PARTY-MAP effect: the ready-made spell lands the buff on its caster for a while, renews on a recast, and is on the spell shop\'s shelf online at a modest price', () => {
  const sp = sharedCartographySpell();
  assert.equal(sp.name, 'Shared Cartography');
  assert.equal(sp.index, SHARED_CARTOGRAPHY_SPELL_INDEX);
  assert.equal(sp.rangeType, 0, 'on the caster');
  const me = { stats: { luck: 50, willpower: 50, personality: 50 }, skills: new Array(35).fill(40), activeEffects: [], race: 'Nord', level: 1, health: 50, maxHealth: 50, magicka: 100, maxMagicka: 100 };
  assert.equal(hasSharedCartography(me), false);
  const out = applySpell(sp, 1, me, {}, () => 0.5, { level: 1, entity: me }, {});
  assert.equal(out.buffs, 1);
  assert.equal(hasSharedCartography(me), true);
  const e = me.activeEffects.find((a) => a.kind === SHARED_CARTOGRAPHY_KIND);
  assert.equal(e.roundsRemaining, 21, '20 rounds + 2 at level 1, the first run at once (the DFU shape)');
  e.roundsRemaining = 5;
  applySpell(sp, 1, me, {}, () => 0.5, { level: 1, entity: me }, {});
  assert.equal(me.activeEffects.filter((a) => a.kind === SHARED_CARTOGRAPHY_KIND).length, 1, 'a recast merges into the incumbent');
  assert.equal(e.roundsRemaining, 21, 'a recast renews it to a fresh 21 - never adds its 22');   // PIN MOVED (STACK-CAP)
  const cost = calculateCastCost(sp, me);
  assert.ok(cost.gold > 0 && cost.gold < 1000, `modest: ${cost.gold} gold`);
  assert.ok(cost.sp >= 5 && cost.sp < 60, `and cheap to keep up: ${cost.sp} SP`);
  assert.match(rd('src/scenes/worldModes.js'), /isOnlinePage\(\) \? \[resurrectionSpell\(\), sharedCartographySpell\(\)\] : \[\]/);
});

test('AUDIT PARTY-MAP F2: the sender walks its whole map again every AMAP_RESYNC_MS - a mate who arrived late still gets it', async () => {
  const { AMAP_RESYNC_MS } = await import('../../src/systems/party/partyMap.js');
  const tx = createPartyMapSender({ sendMs: 0, max: 128, resyncMs: 1000 });
  const rec = { visitedThisRun: new Set(['1:2', '3:4']) };
  const at = (nowMs) => tx.next({ active: true, inDungeon: true, key: '5/Privateer', rec, nowMs });
  const f1 = at(0); tx.commit(f1, 0);
  assert.deepEqual(f1.r, ['1:2', '3:4']);
  assert.equal(at(500), null, 'nothing new before the resync');
  const f2 = at(1000);
  assert.deepEqual(f2?.r, ['1:2', '3:4'], 'the whole map again');
  assert.equal(AMAP_RESYNC_MS, 60000);
});
