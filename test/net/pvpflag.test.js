// PVP-FLAG (the PvP rework, 2026-10-28/29 - the owner: "flagging gives a skull above your head", "need to be instant",
// "make it a min", "u flag and un flag instanly", "u cant flag on a party member"; bible/11-Multiplayer/PvP-Rework.md):
// in the open zone a blow lands only between two flagged players. The flag goes up at once from level 30 and comes down at
// once, never within PVP_FLAG.lockMs of the last PvP blow given or taken - on the client (systems/wild/pvpFlag.js) and
// at the referee (net/wild/wildRef.js wildZone, wildBlow), which says each flag to the room (`wref` `flag`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PVP_FLAG, pvpFlagRefusal, pvpFlagCanDrop, pvpAggroLeft } from '../../src/systems/wild/pvpFlag.js';
import { newWildRef, wildZone, wildBlow, wildAggroWord, wildFlagWord, WILD_GRACE } from '../../src/net/wild/wildRef.js';
import { SIEGE_UNITS_PER_M } from '../../src/net/siege/siegeRef.js';
import { validWildData, validWildRefOut, worldRoom, PIXEL_UNITS } from '../../src/net/wire.js';
import { createPvpFlagHost, pvpFlagOn } from '../../src/scenes/pvpFlagHost.js';
import { capsFixKey, noteCaps } from '../../src/ui/capsFix.js';
import { SKULL_ROWS, SKULL_TINTS, skullSrc, skullGlow } from '../../src/ui/pvpSkull.js';
import { fakeRoom } from '../fakeRoom.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const M = SIEGE_UNITS_PER_M;
const at = (x) => ({ x: 1000 * M + x * M, y: 0, z: 1000 * M });
const FIST = { w: -1, m: 0 };
const L = PVP_FLAG.lockMs;
const hit = (st, now, by = 'acct-a', to = 'acct-b') => wildBlow(st, by, to, { d: 999, held: FIST, rid: '0123456789ab' }, now);
/** Two fighters in the zone past their safe passage, `fa` and `fb` their flags. */
function enter(fa, fb, now = WILD_GRACE.ms) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: 'r-a', fl: fa }, true, at(-1), 0);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b', fl: fb }, true, at(1), 0);
  for (const s of ['acct-a', 'acct-b']) st.fighters.get(s).graceUntil = -Infinity;
  return { st, now };
}

test('PVP-FLAG THE LAW (systems/wild/pvpFlag.js): up from level 30, at once; down at once, but never within the minute after a PvP blow (mutants: the level, the lock, its edge)', () => {
  assert.deepEqual(PVP_FLAG, { lockMs: 60_000, level: 30, sayMs: 10_000 });
  assert.equal(pvpFlagRefusal({ on: true, level: 30 }), null);
  assert.equal(pvpFlagRefusal({ on: true, level: 29 }), 'PvP opens at level 30.');
  assert.equal(pvpFlagRefusal({ on: false, fightAt: 0, now: L - 1 }), 'You are in combat. You can turn PvP off in 1 s.');
  assert.equal(pvpFlagRefusal({ on: false, fightAt: 0, now: L }), null);
  assert.equal(pvpFlagRefusal({ on: false }), null, 'never in a fight: at once');
  assert.deepEqual([pvpFlagCanDrop(0, L - 1), pvpFlagCanDrop(0, L), pvpFlagCanDrop(-Infinity, 0)], [false, true, true]);
});

test('PVP-FLAG THE REFEREE (net/wild/wildRef.js): a blow lands only from a flagged striker - the struck one\'s flag never shields it; a drop inside the lock is held up; past it, it comes down; a word with no flag keeps it (mutants: the blow unasked; the lock unheld; the word unread)', () => {
  let { st, now } = enter(1, 0);
  assert.equal(hit(st, now).ok, true, 'a flagged striker lands on the unflagged');
  assert.equal(hit(st, now, 'acct-b', 'acct-a').why, 'unflagged', 'the striker unflagged: no blow');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b', fl: 1 }, true, at(1), now);
  assert.equal(st.fighters.get('acct-b').flag, true, 'up at once');
  assert.equal(hit(st, now).ok, true, 'both flagged: it lands too');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b', fl: 0 }, true, at(1), now + L - 1);
  assert.equal(st.fighters.get('acct-b').flag, true, 'a drop inside the lock is held up');
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: 'r-a', fl: 0 }, true, at(-1), now + L - 1);
  assert.equal(st.fighters.get('acct-a').flag, true, 'the striker\'s too');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b' }, true, at(1), now + L);
  assert.equal(st.fighters.get('acct-b').flag, true, 'a word with no flag keeps it');
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: 'r-b', fl: 0 }, true, at(1), now + L);
  assert.equal(st.fighters.get('acct-b').flag, false, 'past the lock it comes down');
  ({ st, now } = enter(null, null));
  assert.equal(hit(st, now).ok, true, 'a fighter made with no word is flagged (a blow at it is its own choice to stand open)');
});

test('PVP-FLAG THE WIRE (net/wire.js): `fl` rides a word that I stand in the zone, 0 or 1; `wref` `flag` is an id and 0 or 1 (mutants: a foreign flag; the leave carrying one; the word unprojected)', () => {
  assert.deepEqual(validWildData({ k: 'zone', z: 1, fl: 1 }), { k: 'zone', z: 1, fl: 1 });
  assert.deepEqual(validWildData({ k: 'zone', z: 1, fl: 0 }), { k: 'zone', z: 1, fl: 0 });
  assert.deepEqual(validWildData({ k: 'zone', z: 1 }), { k: 'zone', z: 1 });
  assert.deepEqual(validWildData({ k: 'zone', z: 0, fl: 1 }), { k: 'zone', z: 0 }, 'a leave carries none');
  assert.equal(validWildData({ k: 'zone', z: 1, fl: 2 }), null);
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 1 }), { k: 'flag', id: 'peer-0001', f: 1 });
  for (const bad of [{ f: 2 }, { f: '1' }, { id: 'x y' }]) assert.equal(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 0, ...bad }), null, JSON.stringify(bad));
});

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const flags = (ws) => ws.sent.filter((m) => m.t === 'wref' && m.k === 'flag').map((m) => [m.id, m.f]);

test('PVP-FLAG THE RELAY (server/src/index.js _wildFlagSay): each flag said to the room as it moves, every flag said to one entering; an unflagged one strikes nobody (mutants: the move unsaid; the newcomer untold; the refused drop unsaid)', async () => {
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(CELL, { now: () => clock });
    const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
    const join = async (id, x, ci) => { const ws = r.connect(); await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci }); return ws; };
    const a = await join('peer-0001', -1, 'r00000000000000000a02'), b = await join('peer-0002', 1, 'r00000000000000000a01');
    await say(a, { k: 'zone', z: 1, fl: 1 });
    await say(b, { k: 'zone', z: 1, fl: 0 });
    assert.deepEqual(flags(b), [['peer-0001', 1], ['peer-0002', 0], ['peer-0001', 1]], 'the room heard each, and the newcomer every flag up');
    clock += WILD_GRACE.ms + 1;
    await say(b, { k: 'strike', to: 'peer-0001', n: 1, by: 'melee', p: W(1), d: 999 });
    assert.equal(a.sent.filter((m) => m.t === 'wref' && m.k === 'hp').length, 0, 'the unflagged strikes no one');
    await say(a, { k: 'strike', to: 'peer-0002', n: 2, by: 'melee', p: W(-1), d: 999 });
    assert.equal(b.sent.filter((m) => m.t === 'wref' && m.k === 'hp').length, 1, 'a flagged striker lands on the unflagged');
    await say(b, { k: 'zone', z: 1, fl: 1 });
    const before = flags(a).length;
    await say(b, { k: 'zone', z: 1, fl: 0 });
    assert.deepEqual(flags(a).slice(before), [['peer-0002', 1]], 'a drop in the lock: the room told it holds');
  } finally { Date.now = realNow; }
});

test('PVP-FLAG THE PAGE (scenes/pvpFlagHost.js): Caps Lock or the button toggles it; the referee\'s word holds mine; a peer is fair while mine is up; a blow on me starts the lock; the Portal Stone is free while I am down (mutants: the fair unasked; my word unheld; the lock unstarted; the stone\'s door)', () => {
  let clock = 0;
  const said = [], sent = [];
  const online = { id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) };
  const player = { level: 30 };
  const f = createPvpFlagHost(() => online, player, (l) => said.push(l), { say: () => {} }, { doc: null, now: () => clock });
  assert.equal(pvpFlagOn(), false);
  assert.equal(f.toggle(), true);
  assert.deepEqual(sent, [true]);
  assert.equal(pvpFlagOn(), true, 'the stone\'s door hears it');
  f.heard({ k: 'flag', id: 'peer-x', f: 1 });
  assert.equal(f.fair('peer-x'), true);
  assert.equal(f.fair('peer-y'), true, 'theirs never shields them');
  f.heard({ k: 'hp', by: 'peer-x', to: 'peer-me' });
  clock = L - 1;
  assert.equal(f.toggle(), false, 'in the lock');
  assert.equal(said.at(-1), 'You are in combat. You can turn PvP off in 1 s.');
  clock = L;
  assert.equal(f.toggle(), true);
  assert.equal(f.fair('peer-x'), false, 'I am down: nobody');
  f.heard({ k: 'flag', id: 'peer-me', f: 1 });
  assert.equal(f.on(), true, 'the referee held mine up');
  const inner = [];
  const w = f.wrap((g) => inner.push(g.k));
  w({ k: 'flag', id: 'peer-z', f: 1 }); w({ k: 'hp', by: 'a', to: 'b' });
  assert.deepEqual(inner, ['hp'], 'the flag taken here, the rest handed on');
  player.level = 29;
  f.toggle(); f.toggle();
  assert.equal(said.at(-1), 'PvP opens at level 30.');
  const world = rd('src/scenes/world.js'), stone = rd('src/scenes/portalStoneHost.js');
  assert.ok(world.includes('return pvpFlag.fair(peerId) && (modes?.mode'), 'the host asks it of every target');
  assert.ok(world.includes('const wildRefIn = pvpFlag.wrap((g, room) => {'));
  assert.ok(stone.includes("const zoneRefused = (to = null) => pvpFlagOn() && host.wildTeleportRefused(to);"));
});

test('PVP-FLAG THE KEY (scenes/pvpFlagHost.js): Caps Lock toggles the flag in the game alone - typed in the chat box or any field it does nothing; a held key never repeats it (mutants: the field unread)', () => {
  const handlers = [], realInterval = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    const stub = () => ({ style: {}, setAttribute: () => {}, addEventListener: () => {} });
    const doc = { addEventListener: (k, fn) => handlers.push([k, fn]), createElement: stub, body: null };
    const sent = [];
    createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: (v) => sent.push(v) }), { level: 30 }, () => {}, { say: () => {} }, { doc, now: () => 0 });
    const key = handlers.find(([k]) => k === 'keydown')[1];
    key({ code: 'CapsLock', target: { tagName: 'INPUT' } });
    key({ code: 'CapsLock', target: { tagName: 'TEXTAREA' } });
    key({ code: 'CapsLock', target: { isContentEditable: true } });
    assert.deepEqual(sent, [], 'typed in a field: nothing');
    key({ code: 'CapsLock', repeat: true, target: { tagName: 'CANVAS' } });
    assert.deepEqual(sent, [], 'a held key: nothing');
    key({ code: 'CapsLock', target: { tagName: 'CANVAS' } });
    assert.deepEqual(sent, [true], 'in the game: up');
  } finally { globalThis.setInterval = realInterval; }
});

test('PVP-FLAG-CAPS (ui/capsFix.js, ui/chatPanel.js): the flag\'s Caps Lock types no capitals in chat - a letter under it goes in as its other case; a Caps Lock pressed in the field is the player\'s own; shortcuts and other keys pass (mutants: the game\'s press unread; the field\'s press unheard)', () => {
  const field = { value: 'hi ', selectionStart: 3, selectionEnd: 3, setSelectionRange(a) { this.selectionStart = this.selectionEnd = a; }, dispatchEvent: () => true };
  const key = (k, o = {}) => { let stopped = false; const e = { code: o.code ?? `Key${k.toUpperCase()}`, key: k, getModifierState: () => o.caps ?? true, preventDefault: () => { stopped = true; }, ...o }; return [capsFixKey(e, field), stopped]; };
  noteCaps(null);   // THE KEY above pressed it in the game
  assert.deepEqual(key('A'), [false, false], 'no press seen: the light is the player\'s');
  noteCaps('game');
  assert.deepEqual(key('A'), [true, true]);
  assert.deepEqual(key('b', { shiftKey: true }), [true, true], 'Shift under the light: lower, flipped to its other case');
  assert.equal(field.value, 'hi aB');
  assert.deepEqual(key('1', { code: 'Digit1' }), [false, false], 'a digit passes');
  assert.deepEqual(key('C', { ctrlKey: true }), [false, false], 'a shortcut passes');
  assert.deepEqual(key('D', { caps: false }), [false, false], 'the light off: nothing to undo');
  key('CapsLock', { code: 'CapsLock' });
  assert.deepEqual(key('E'), [false, false], 'pressed in the field: the player\'s own capitals');
  assert.ok(rd('src/ui/chatPanel.js').includes('if (capsFixKey(e, input)) { e.stopPropagation(); return; }'));
  assert.ok(rd('src/scenes/pvpFlagHost.js').includes("      noteCaps('game');"));
});

test('PVP-SKULL THE REFEREE AND THE WIRE (net/wild/wildRef.js wildAggroWord, wildFlagWord; net/wire.js): a flagged fighter in a blow is said in aggro, its ms left riding `a`, once each ten seconds; an unflagged one never; one entering hears each flagged fighter\'s aggro left; the wire keeps `a` on a flag up alone (mutants: the aggro unsaid; said each blow; the newcomer\'s aggro dropped; the wire\'s `a` dropped)', () => {
  assert.deepEqual([pvpAggroLeft(0, 0), pvpAggroLeft(0, L - 1), pvpAggroLeft(0, L), pvpAggroLeft(-Infinity, 0)], [L, 1, 0, 0]);
  const { st, now } = enter(1, 0);
  assert.equal(hit(st, now).ok, true);
  const a = st.fighters.get('acct-a'), b = st.fighters.get('acct-b');
  assert.deepEqual(wildAggroWord(a, now), { t: 'wref', k: 'flag', id: 'peer-a', f: 1, a: L });
  assert.equal(wildAggroWord(a, now + PVP_FLAG.sayMs - 1), null, 'once each ten seconds');
  assert.equal(wildAggroWord(a, now + PVP_FLAG.sayMs)?.a, L - PVP_FLAG.sayMs);
  assert.equal(wildAggroWord(b, now), null, 'the unflagged has no skull to turn gold');
  assert.deepEqual(wildFlagWord(a, now + 1000), { t: 'wref', k: 'flag', id: 'peer-a', f: 1, a: L - 1000 });
  assert.deepEqual(wildFlagWord(a, now + L), { t: 'wref', k: 'flag', id: 'peer-a', f: 1 }, 'past the minute: white');
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', f: 1, a: 5000 }), { k: 'flag', id: 'peer-0001', f: 1, a: 5000 });
  for (const bad of [{ f: 0, a: 5000 }, { f: 1, a: 60_001 }, { f: 1, a: 1.5 }]) assert.deepEqual(validWildRefOut({ t: 'wref', k: 'flag', id: 'peer-0001', ...bad }), { k: 'flag', id: 'peer-0001', f: bad.f }, JSON.stringify(bad));
  const srv = rd('server/src/index.js');
  assert.ok(srv.includes('    this._wildAggroSay(st, [a.sub, tb.sub], now);'));
  assert.ok(srv.includes('this._send(mine[0], JSON.stringify(wildFlagWord(o, Date.now())));'));
});

test('PVP-SKULL THE PAGE (scenes/pvpFlagHost.js, ui/pvpSkull.js, ui/nameLayer.js): a peer flagged wears white, gold while its aggro runs, none unflagged; mine gold after a blow; the name mask hands each point its skull; one 16-pixel drawing in three tints (mutants: the gold unread; the mask unworn; a tint lost)', () => {
  let clock = 0;
  const f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: () => {} }), { level: 30 }, () => {}, { say: () => {} }, { doc: null, now: () => clock });
  f.heard({ k: 'flag', id: 'peer-x', f: 1, a: 5000 });
  f.heard({ k: 'flag', id: 'peer-y', f: 1 });
  assert.deepEqual([f.skullOf('peer-x'), f.skullOf('peer-y'), f.skullOf('peer-z')], ['gold', 'white', null]);
  clock = 5000;
  assert.equal(f.skullOf('peer-x'), 'white', 'the aggro ran out');
  f.heard({ k: 'flag', id: 'peer-y', f: 0 });
  assert.equal(f.skullOf('peer-y'), null, 'down: no skull');
  assert.equal(f.mySkull(), null);
  f.toggle();
  assert.equal(f.mySkull(), 'white');
  f.heard({ k: 'hp', by: 'peer-me', to: 'peer-x' });
  assert.equal(f.mySkull(), 'gold');
  const mask = f.mask((p) => (p.id === 'peer-gone' ? null : p));
  assert.deepEqual(mask({ id: 'peer-x', name: 'A' }), { id: 'peer-x', name: 'A', skull: 'white' });
  assert.deepEqual(mask({ id: 'peer-q', name: 'B' }), { id: 'peer-q', name: 'B' });
  assert.equal(mask({ id: 'peer-gone' }), null);
  assert.equal(SKULL_ROWS.length, 16);
  assert.ok(SKULL_ROWS.every((r) => r.length === 16));
  for (const k of ['white', 'gold', 'red']) assert.ok(decodeURIComponent(skullSrc(k)).includes(`fill='${SKULL_TINTS[k][0]}'`), k);
  assert.deepEqual(Object.fromEntries(Object.entries(SKULL_TINTS).map(([k, v]) => [k, v[0]])), { white: '#ece6d6', gold: '#e8b62c', red: '#d42a1e' }, 'the mockup\'s bone in each');
  assert.equal(skullSrc('none'), '');
  assert.deepEqual([skullGlow('white'), !!skullGlow('gold'), !!skullGlow('red')], ['', true, true]);
  assert.ok(rd('src/scenes/world.js').includes('      mask: pvpFlag.mask(wildNameMask),'));
  assert.ok(rd('src/ui/nameLayer.js').includes("put(tag, 'skullOf', p.skull ?? '',"));
});
