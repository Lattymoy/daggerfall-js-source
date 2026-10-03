// ARENA4b (2026-10-03): THE STANDS AND THE BANNERS ON A RELAY'S SAND, DRIVEN - the spectator's two presses on the bout's HUD
// (ui/arenaHud.js: the model, the DOM, the keys, the allowance), my cheer or boo down a watched bout's room over the real
// relay (scenes/arenaBouts.js cheer, scenes/arenaOnline.js send.cheer, server/src/index.js over test/fakeRoom.mjs) and my own
// crowd moved at once without hearing my echo twice, and the realm's banners and laurel on a relay's sand and on this
// screen's floor (scenes/arenaBouts.js setRealm / relayBanners / laurelFavour, scenes/arenaOnline.js realm). Mac,
// 2026-10-02: "During fights, the crowd is present and can cheer/boo you".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arenaHudModel, drawArenaHud, destroyArenaHud, STANDS_KEYS, ARENA_HUD_CSS } from '../src/ui/arenaHud.js';
import { newBout, boutTick, boutAtMarks, callMs, COUNT_MS } from '../src/systems/arenaBout.js';
import { newCrowd, SHOUT_PUSH } from '../src/systems/arenaCrowd.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createArenaBouts, CHEER_GAP_MS } from '../src/scenes/arenaBouts.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { ARENA_HALL, arenaBoutRoom, ARENA_FLOOR_CENTRE, ARENA_CHEER_MS, arenaLadderOf } from '../src/net/arenaLaw.js';
import { LAUREL_FAVOUR } from '../src/systems/arenaLeague.js';
import { exhibitionFor } from '../src/systems/arenaLadder.js';
import { FRAME_ROLES } from '../src/ui/enhancedFrame.js';
import { DEFAULT_BINDINGS, DEFAULT_SECONDARY_BINDINGS } from '../src/systems/inputActions.js';
import worker from '../server/src/index.js';
import { fakeRooms } from './fakeRoom.mjs';
import { withDom } from './invdrag.mjs';

void worker;
const O = ARENA_TEXT.online;
const C = ARENA_FLOOR_CENTRE;
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.className?.split?.(' ').includes(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const RING = { centre: [0, 0], radius: 14 };
function live(fighters) {
  const b = newBout({ id: 'x', fighters, ring: RING, now: 0 });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  boutTick(b, callMs(b) + COUNT_MS);
  return { b, t: callMs(b) + COUNT_MS };
}
const F2 = [{ id: 'p0', name: 'Alva', side: 0, maxHealth: 100, ai: false }, { id: 'p1', name: 'Brann', side: 1, maxHealth: 100, ai: false }];

test('ARENA4b the stands\' presses on the HUD: carried only for a watcher of a relay\'s bout, shut while the allowance runs; two touch-sized buttons with their keys, hidden but for a watcher, the readout still hidden from a screen reader; a press and the + and - keys reach the door, a key in a field, with a modifier, held, or taken by another window does not; the keys let go with the row (mutants: the presses for a fighter; a refused press let through; the keys heard after the row went; the root\'s aria-hidden never lifted)', () => withDom((dom) => {
  destroyArenaHud();
  const { b, t } = live(F2);
  const crowd = newCrowd({ fighters: b.fighters });
  // the model: a watcher's (`stands`), never a fighter's, never the pit's
  const w = arenaHudModel(b, crowd, t, { stands: { ready: true } });
  assert.deepEqual(w.stands, { cheer: O.cheer, boo: O.boo, cheerKey: O.cheerKey, booKey: O.booKey, ready: true });
  assert.equal(arenaHudModel(b, crowd, t, { you: 'p0', stands: { ready: true } }).stands, null, 'a fighter has no presses');
  assert.equal(arenaHudModel(b, crowd, t, { stands: { ready: true }, quiet: true }).stands, null, 'no crowd, no stands');
  assert.equal(arenaHudModel(b, crowd, t).stands, null);
  assert.equal(arenaHudModel(b, crowd, t, { stands: { ready: false } }).stands.ready, false);
  // the DOM: built hidden, shown for a watcher with a door
  const pressed = [];
  const door = (d) => { pressed.push(d); return true; };
  drawArenaHud(arenaHudModel(b, crowd, t, { you: 'p0' }), { doc: dom.doc, cheer: door });
  const root = one(dom.body, 'arena-hud');
  const stands = one(root, 'arena-stands');
  assert.equal(stands.style.display, 'none', 'a fighter sees no presses');
  assert.equal(root.attrs['aria-hidden'], 'true');
  assert.equal(dom.win.count('keydown'), 0, 'no keys heard for a fighter');
  drawArenaHud(w, { doc: dom.doc, cheer: door });
  assert.equal(stands.style.display, '');
  assert.equal(root.attrs['aria-hidden'], undefined, 'the presses are a screen reader\'s');
  for (const cls of ['arena-plate', 'arena-bark', 'arena-hint']) assert.equal(one(root, cls).attrs['aria-hidden'], 'true', `${cls} stays a readout`);
  const [cheer, boo] = kids(stands, 'arena-shout');
  assert.deepEqual([one(cheer, 'arena-shout-word').textContent, one(cheer, 'arena-key').textContent], [O.cheer, O.cheerKey]);
  assert.deepEqual([one(boo, 'arena-shout-word').textContent, one(boo, 'arena-key').textContent], [O.boo, O.booKey]);
  assert.equal(cheer.attrs['aria-label'], `${O.cheer} (${O.cheerKey})`);
  assert.equal(cheer.attrs['aria-disabled'], undefined);   // AUDIT PRE-MERGE 1003 U15: shut by aria-disabled, never disabled (the focus kept)
  assert.equal(cheer.attrs.disabled, undefined);
  let stopped = 0;
  cheer.onclick({ stopPropagation: () => stopped++ });
  boo.onclick({ stopPropagation: () => stopped++ });
  assert.deepEqual(pressed, [1, -1], 'Cheer and Boo to the door');
  assert.equal(stopped, 2, 'a press is never a swing');
  stands.onpointerdown({ stopPropagation: () => stopped++ });
  assert.equal(stopped, 3, 'the pointer swallowed on the row');
  // the keys
  assert.equal(dom.win.count('keydown'), 1);
  const key = (code, extra = {}) => { let prevented = false; dom.win.fire('keydown', { code, target: { tagName: 'CANVAS' }, preventDefault: () => { prevented = true; }, ...extra }); return prevented; };
  assert.equal(key('Equal'), true);
  assert.equal(key('Minus'), true);
  assert.deepEqual(pressed, [1, -1, 1, -1]);
  key('Equal', { target: { tagName: 'INPUT' } });
  key('Equal', { ctrlKey: true });
  key('Equal', { repeat: true });
  key('Equal', { defaultPrevented: true });
  key('KeyW');
  assert.deepEqual(pressed, [1, -1, 1, -1], 'a field, a modifier, a held key, another window\'s key, a walk: none');
  // the allowance: shut, the press and the key dead
  drawArenaHud(arenaHudModel(b, crowd, t, { stands: { ready: false } }), { doc: dom.doc, cheer: door });
  assert.equal(cheer.attrs['aria-disabled'], 'true', 'shut - AUDIT PRE-MERGE 1003 U15: by aria-disabled');
  assert.equal(cheer.attrs.disabled, undefined, 'never disabled - a disabled press lets the keyboard\'s focus fall to the page');
  cheer.onclick({});
  key('Equal');
  assert.deepEqual(pressed, [1, -1, 1, -1], 'shut while the allowance runs');
  // the row goes - and its keys with it
  drawArenaHud(arenaHudModel(b, crowd, t, { you: 'p0' }), { doc: dom.doc, cheer: door });
  assert.equal(stands.style.display, 'none');
  assert.equal(root.attrs['aria-hidden'], 'true');
  assert.equal(dom.win.count('keydown'), 0, 'the keys let go');
  drawArenaHud(w, { doc: dom.doc });
  assert.equal(stands.style.display, 'none', 'no door, no presses');
  drawArenaHud(w, { doc: dom.doc, cheer: door, hidden: true });
  assert.equal(dom.win.count('keydown'), 0, 'hidden with the HUD');
  drawArenaHud(w, { doc: dom.doc, cheer: door });
  destroyArenaHud();
  assert.equal(dom.win.count('keydown'), 0, 'gone with the page');
  // the keys are free of the game's own bindings; the sheet's touch size and the kit's button role
  const bound = new Set([...DEFAULT_BINDINGS, ...DEFAULT_SECONDARY_BINDINGS].map(([code]) => code));
  for (const code of Object.keys(STANDS_KEYS)) assert.ok(!bound.has(code), `${code} holds no game action`);
  assert.match(ARENA_HUD_CSS, /\.arena-shout \{ pointer-events: auto;/, 'the presses take the pointer the readout does not');
  assert.match(ARENA_HUD_CSS, /\.arena-hud\.touch \.arena-shout \{ min-height: 48px;/, 'a finger\'s size on a touch screen');
  assert.ok(FRAME_ROLES.button.includes('body .arena-shout'), 'the kit\'s stone button on Plus');
}));

/** A fake floor stage for the driver. */
function stageOf() {
  const c = [C[0], C[1], C[2]];
  return {
    kind: 'floor', centre: () => c,
    spawn: async (mobile, feet, o) => ({ mobile, entity: { health: 20, maxHealth: 20 }, ai: { feet: [...feet], yaw: o.yaw ?? 0, isHostile: true } }),
    remove: () => {}, heightAt: () => null,
  };
}
const arenaOf = (ws) => ws.sent.filter((m) => m.t === 'arena');
const lastOf = (ws, k) => arenaOf(ws).filter((m) => m.k === k).at(-1) ?? null;
const wordTo = (r, ws, w) => r.raw(ws, JSON.stringify({ t: 'arena', ...w }));
async function onClock(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  try { return await fn({ now: () => clock, step: (ms) => { clock += ms; } }); } finally { Date.now = realNow; }
}

test('ARENA4b my cheer from the stands over the real relay: sent through the watched bout\'s session as `ch`, my crowd moved at once by the stands\' own law, the relay\'s `cr` fanned to the fighters and back to me - my own echo not heard twice, a shout beside mine heard as every screen hears it; one each CHEER_GAP_MS, so the relay never drops a cheer my crowd heard; the HUD\'s door the driver\'s (mutants: the echo heard again; the local push skipped; the allowance the relay\'s alone; the word not sent down the bout\'s room)', async () => onClock(async ({ now, step }) => {
  const W = fakeRooms();
  const H = W.room(ARENA_HALL);
  const A = H.connect(), B = H.connect();
  await H.hello(A, 'peer-alva', null, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', ar: 1000 });
  await H.hello(B, 'peer-brann', null, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', ar: 1040 });
  await wordTo(H, A, { k: 'q', lv: 20 }); await wordTo(H, B, { k: 'q', lv: 30 });
  step(1000); await H.fire();
  const of = lastOf(A, 'of').o;
  await wordTo(H, A, { k: 'y', o: of }); await wordTo(H, B, { k: 'y', o: of });
  const o = lastOf(A, 'go').o;   // AUDIT PRE-MERGE 1003 S7: the bout's room is the go's, never the offer's id
  const R = W.room(arenaBoutRoom(o));
  const a = R.connect(), b = R.connect();
  await R.hello(a, 'fight-alva', { x: C[0] - 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Alva', kind: 'linked', tokenSub: 'acct-alva', lv: 20 });
  await R.hello(b, 'fight-brann', { x: C[0] + 6, y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Brann', kind: 'linked', tokenSub: 'acct-brann', lv: 30 });
  await wordTo(R, a, { k: 'in', r: 'f' }); await wordTo(R, b, { k: 'in', r: 'f' });
  // ME, in the stands: the driver on a floor stage, the arena online on a session whose room is the bout's
  const s = R.connect(), s2 = R.connect();
  await R.hello(s, 'seat-sola', { x: C[0], y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Sola' });
  await R.hello(s2, 'seat-tam', { x: C[0] + 2, y: 7, z: C[2] - 21.8, yaw: 0, pitch: 0, mv: 0 }, { name: 'Tam' });
  await wordTo(R, s2, { k: 'in', r: 's' });
  const out = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { out.push(wordTo(R, s, w)); return true; } };
  const huds = [], cues = [];
  const D = createArenaBouts({ now, playerEntity: { name: 'Sola', health: 50, maxHealth: 50 }, drawHud: (m, o2) => huds.push([m, o2]), sound: { cue: (l) => cues.push(...l), bed: () => {}, stop: () => {} } });
  D.setStage(stageOf());
  const hallLink = { status: 'open', join() {}, leave() {}, sendArena: () => true };
  const A2 = createArenaOnline({ now, session: () => session, makeHall: () => hallLink, bouts: D, account: { board: async () => ({ ok: true, data: { me: null, team: { laurel: null } } }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true, inBout: () => D.holds() });
  A2.model();
  hallLink.onArena({ k: 'live', l: [{ o, kind: 'pvp', a: { n: 'Alva', r: 1000 }, b: { n: 'Brann', r: 1040 }, sp: 1, at: 1 }] });
  assert.deepEqual(A2.act('spectate', { o }), { ok: true, text: '' });
  await new Promise((r) => setTimeout(r, 0));
  session.room = arenaBoutRoom(o);
  A2.tick();
  await Promise.all(out);
  let seen = 0;
  const pump = async () => { await Promise.all(out); const ws = arenaOf(s); for (const m of ws.slice(seen)) { const { t: _t, ...w } = m; A2.word(w, session.room); } seen = ws.length; };
  await pump();
  assert.equal(D.relay()?.me, '', 'I watch from the stands');
  assert.ok(D.crowd(), 'the bout stands here, its crowd with it');
  D.frame(0.016, {});
  const [model, opts] = huds.at(-1);
  assert.equal(model.stands.ready, true, 'the presses up for a watcher');
  assert.equal(typeof opts.cheer, 'function', 'the HUD handed the driver\'s door');
  // THE PRESS: my crowd at once, the word down the bout's room
  const m0 = D.crowd().mood;
  const cueN = cues.length;
  assert.equal(opts.cheer(1), true);
  assert.ok(Math.abs(D.crowd().mood - (m0 + SHOUT_PUSH)) < 1e-9, 'my own voice heard at once, the stands\' own law');
  assert.equal(cues.length, cueN + 1, 'and its cheer heard');
  await pump();
  assert.deepEqual(lastOf(a, 'cr'), { t: 'arena', k: 'cr', c: 1, n: 1 }, 'the relay fans it to the fighters');
  assert.deepEqual(lastOf(s, 'cr'), { t: 'arena', k: 'cr', c: 1, n: 1 }, 'and back to me');
  assert.ok(Math.abs(D.crowd().mood - (m0 + SHOUT_PUSH)) < 1e-9, 'my echo is not heard twice');
  // a shout beside mine: heard as every screen hears it (one voice before, two now)
  await wordTo(R, s2, { k: 'ch', c: 1 });
  await pump();
  assert.deepEqual(lastOf(s, 'cr'), { t: 'arena', k: 'cr', c: 1, n: 2 });
  assert.ok(Math.abs(D.crowd().mood - (m0 + SHOUT_PUSH * 3)) < 1e-9, 'one and two - the sum every other screen heard');
  // THE ALLOWANCE: mine, a beat past the relay's, so the relay never drops one my crowd heard
  assert.equal(CHEER_GAP_MS > ARENA_CHEER_MS, true);
  const sent = out.length;
  assert.equal(D.cheer(-1), false, 'not again so soon');
  step(ARENA_CHEER_MS + 1);
  assert.equal(D.cheer(-1), false, 'nor at the relay\'s bare allowance');
  assert.equal(out.length, sent, 'nothing sent');
  D.frame(0.016, {});
  assert.equal(huds.at(-1)[0].stands.ready, false, 'the presses shut while it runs');
  step(CHEER_GAP_MS - ARENA_CHEER_MS);
  const m1 = D.crowd().mood;
  assert.equal(D.cheer(-1), true);
  await pump();
  assert.deepEqual(lastOf(b, 'cr'), { t: 'arena', k: 'cr', c: -1, n: 1 }, 'the relay took it');
  assert.ok(Math.abs(D.crowd().mood - (m1 - SHOUT_PUSH)) < 1e-9, 'a boo heard once');
  assert.equal(D.cheer(0), false, 'a cheer or a boo, nothing else');
}));

test('ARENA4b a fighter has no presses and sends no shout; a bout the relay does not run takes none (mutants: the press for a fighter; a shout with no relay)', () => {
  let t = 1000;
  const sent = [];
  const huds = [];
  const D = createArenaBouts({ now: () => t, playerEntity: { name: 'Alva', health: 80, maxHealth: 80 }, drawHud: (m, o) => huds.push([m, o]) });
  D.setStage(stageOf());
  assert.equal(D.cheer(1), false, 'no bout');
  D.startRelay({ o: '0123456789abcdef', kind: 'pvp', me: 'p0', send: { cheer: (c) => { sent.push(c); return true; } } });
  D.relayWord({ k: 'st', o: '0123456789abcdef', kind: 'pvp', ph: 'fight', pa: 5000, fa: 9000, lim: 180000, f: [['p0', 'Alva', 0, 340, 340, '', 0, -1, 0, '', ''], ['p1', 'Brann', 1, 360, 360, '', 0, -1, 0, '', '']], me: 'p0', sp: 0 });
  assert.equal(D.cheer(1), false, 'a fighter cheers nobody');
  D.frame(0.016, {});
  assert.equal(huds.at(-1)[0].stands, null);
  assert.equal(huds.at(-1)[1].cheer, null);
  assert.deepEqual(sent, []);
  t += 10;
});

test('ARENA4b the realm\'s banners on a relay\'s sand: mine the account\'s banner (a pennant, `data-team`) and the laurel\'s favour from the first bell when it is the laurel\'s; a rival\'s pennant as the hall billed it; a watched bout\'s two; none for the relay\'s own fighters; the arena online hands the driver the realm while it is live and nothing offline (mutants: my banner the save\'s online; the favour to the other banner; the rival\'s bill dropped; the realm kept offline)', async () => {
  const O16 = '0123456789abcdef';
  const pveSt = { k: 'st', o: O16, kind: 'pve', ph: 'call', pa: 5000, fa: null, lim: 180000, tier: 0, bout: 1, f: [['p0', 'Ceryn', 0, 90, 90, '', 0, -1, 0, '', ''], ['a0', '-', 1, 26, 26, '', 1, 136, 50, '', '']], me: 'p0', sp: 0 };
  const pvpSt = (me) => ({ k: 'st', o: O16, kind: 'pvp', ph: 'call', pa: 5000, fa: null, lim: 180000, f: [['p0', 'Alva', 0, 340, 340, '', 0, -1, 0, '', ''], ['p1', 'Brann', 1, 360, 360, '', 0, -1, 0, '', '']], me, sp: 0 });
  const make = (realm) => {
    const huds = [];
    const P = { name: 'Ceryn', health: 90, maxHealth: 90, arenaLeague: { v: 1, team: 'blue', laurel: { banner: 'blue', season: 405 } } };
    const D = createArenaBouts({ now: () => 1000, playerEntity: P, gameMinutes: () => 523530, drawHud: (m) => huds.push(m) });
    D.setStage(stageOf());
    D.setRealm(realm);
    return { D, huds };
  };
  // a ladder bout on the relay: mine the account's banner (red), the realm's laurel red - favoured from the first bell
  let { D, huds } = make(() => ({ banner: 'red', laurel: 'red' }));
  D.startRelay({ o: O16, kind: 'pve', me: 'p0', next: { tier: 0, bout: 1, purse: 50 } });
  D.relayWord(pveSt);
  assert.ok(Math.abs(D.crowd().favour.p0 - LAUREL_FAVOUR) < 1e-9, 'the laurel\'s favour, the realm\'s');
  assert.equal(D.crowd().favour.a0, 0, 'the house\'s fighter none');
  D.frame(0.016, {});
  assert.deepEqual([huds.at(-1).left[0].team, huds.at(-1).right[0].team], ['red', ''], 'my pennant, none for the house');
  // the laurel the other banner's: my pennant, no favour - and never the save's (blue, in its laurel)
  ({ D, huds } = make(() => ({ banner: 'red', laurel: 'blue' })));
  D.startRelay({ o: O16, kind: 'pve', me: 'p0', next: { tier: 0, bout: 1, purse: 50 } });
  D.relayWord(pveSt);
  assert.equal(D.crowd().favour.p0, 0);
  // a bout between players: my rival's banner as the hall billed it, the laurel's favour to the rival
  ({ D, huds } = make(() => ({ banner: null, laurel: 'blue' })));
  D.startRelay({ o: O16, kind: 'pvp', me: 'p0', banners: { p1: 'blue' } });
  D.relayWord(pvpSt('p0'));
  D.frame(0.016, {});
  assert.deepEqual([huds.at(-1).left[0].team, huds.at(-1).right[0].team], ['', 'blue'], 'no banner of mine, the rival\'s');
  assert.ok(Math.abs(D.crowd().favour.p1 - LAUREL_FAVOUR) < 1e-9 && D.crowd().favour.p0 === 0);
  // watched: the hall's two bills; junk ignored
  ({ D, huds } = make(() => ({ banner: 'red', laurel: null })));
  D.startRelay({ o: O16, kind: 'pvp', me: '', banners: { p0: 'red', p1: 'green' } });
  D.relayWord(pvpSt(''));
  D.frame(0.016, {});
  assert.deepEqual([huds.at(-1).left[0].team, huds.at(-1).right[0].team], ['red', ''], 'a watched bout\'s banners - not my own');
  // the arena online hands the realm while live, and nothing offline
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: () => true };
  let handed = null;
  const bouts = { ask: (p) => { bouts.asked = p; }, setRealm: (fn) => { handed = fn; }, dismiss() {}, holds: () => false };
  const board = { season: 3, me: { banner: 'red', ladder: arenaLadderOf([]) }, team: { laurel: 'blue', standings: { red: 1, blue: 2 } } };
  const A = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => null, bouts, account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true });
  assert.equal(typeof handed, 'function');
  assert.deepEqual(handed(), { banner: null, laurel: null }, 'online before the board: no banner, no laurel - never the save\'s');
  A.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(handed(), { banner: 'red', laurel: 'blue' });
  // AUDIT PRE-MERGE 1003 O4: offline is a relay that opens no arena room, or a seat lost - a socket between rooms
  // ('closed' for a door's reconnect) is online all the same (this pinned the socket's status)
  session.status = 'closed';
  assert.deepEqual(handed(), { banner: 'red', laurel: 'blue' }, 'a door\'s reconnect is no logout');
  session.arenaOk = false;
  assert.equal(handed(), null, 'offline: the save\'s league is the law');
  Object.assign(session, { arenaOk: true, superseded: true });
  assert.equal(handed(), null, 'a seat lost: offline');
  Object.assign(session, { status: 'open', superseded: false });
  // a bout between players: my rival's bill handed to the driver, by its side
  const hallLink = { status: 'open', join() {}, leave() {}, sendArena: () => true };
  const B2 = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => hallLink, bouts, account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true });
  B2.model();
  hallLink.onArena({ k: 'go', o: O16, side: 1, vs: { n: 'Alva', r: 1000, b: 'red' } });
  assert.deepEqual(bouts.asked.relay.banners, { p0: 'red' }, 'the rival on side 0, its banner');
  assert.equal(typeof bouts.asked.relay.send.cheer, 'function');
  // a bout watched from the window: the hall's two bills, by side
  const hall3 = { status: 'open', join() {}, leave() {}, sendArena: () => true };
  const C3 = createArenaOnline({ now: () => 0, session: () => session, makeHall: () => hall3, bouts, account: { board: async () => ({ ok: true, data: board }), claim: async () => ({ ok: true, data: {} }), me: () => null }, enterFloor: () => true });
  C3.model();
  hall3.onArena({ k: 'live', l: [{ o: O16, kind: 'pvp', a: { n: 'Alva', r: 1000, b: 'red' }, b: { n: 'Brann', r: 1040, b: 'blue' }, sp: 0, at: 1 }] });
  C3.act('spectate', { o: O16 });
  assert.deepEqual([bouts.asked.relay.me, bouts.asked.relay.banners], ['', { p0: 'red', p1: 'blue' }], 'a watched bout\'s two banners');
});

test('ARENA4b the laurel on this screen\'s floor online: an exhibition\'s Red against Blue, the realm\'s laurel favoured from the first bell - not the save\'s; offline the save\'s as ARENA3 (mutants: the save\'s laurel online; no favour offline)', async () => {
  const gm = 523530 - (523530 % 1440) + 30 * 1440 + 12 * 60 + 2;
  const ex = exhibitionFor(gm);
  assert.ok(ex, 'the noon bout');
  const run = async (realm) => {
    const P = { name: 'Ceryn', health: 90, maxHealth: 90, arenaLeague: { v: 1, team: null, laurel: { banner: 'blue', season: 405 } } };
    const D = createArenaBouts({ now: () => 1000, playerEntity: P, gameMinutes: () => gm, drawHud: () => {} });
    D.setStage(stageOf());
    if (realm) D.setRealm(realm);
    D.start({ kind: 'exhibition', ex });
    await new Promise((r) => setTimeout(r, 0));
    return D.crowd().favour;
  };
  const base = await run(() => ({ banner: null, laurel: null }));
  const online = await run(() => ({ banner: null, laurel: 'red' }));
  assert.ok(Math.abs(online.f0 - base.f0 - LAUREL_FAVOUR) < 1e-9, 'the Red\'s fighter in the realm\'s laurel');
  assert.equal(online.f1, base.f1, 'the Blue\'s none - the save\'s laurel is not the realm\'s');
  const offline = await run(null);
  assert.equal(offline.f0, base.f0);
  assert.ok(offline.f1 > base.f1, 'offline the save\'s laurel, as ARENA3');
});
