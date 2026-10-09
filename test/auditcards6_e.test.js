// AUDIT CARDS-6 (2026-10-09, bible/01-Overview/Audit-Cards-6.md) lane E: THE HOLD'EM CLIENT, THE GESTURES, THE SEATED
// SPRITE AND THE RECORDS, driven. The interior host's card block run (test/cardssaid.test.js's way: sliced from
// scenes/worldModes.js, `let cardSeat = null;` to the hurt listener) over the real panel, the real gestures and - for the
// relay's words - the real relay on test/fakeRoom.mjs: a press on the hand is its own pointer's, and a press the window
// never heard let go is let go unread (E2: a stale press folded the next chip drag); a finger the cards took is never
// the touch layer's stick, on either half (E1's last door: a squeeze from the hand's left edge walked him off the seat);
// the online panel offers Iliac Hand and the packs whenever he is not in a hand (E7) and says a cloth that plays Iliac
// Hand instead of asking for its chair for ever (E8); the click checks and the push folds through the host for real
// (E20: the old pins read the text); the narrow screen's hand fitted and lifted clear of the panel (E21); the squeeze
// follows the finger down (E22); the class sprite's sink through its own path (E20); the relay that deals Hold'em (E20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { nearestFreeSeat, takenSeats } from '../src/world/cardTables.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import * as court from '../src/systems/court.js';
import * as sess from '../src/systems/cardTableSession.js';
import * as hudm from '../src/ui/cardTableHud.js';
import * as hand from '../src/world/cardHand.js';
import { CARD_W, CARD_L, chipDiscs } from '../src/world/cardMotion.js';
import { cardMatrix } from '../src/render/cardTableDraw.js';
import { holdCursor } from '../src/player/pointerLock.js';
import { rayDirFromScreen, projectToScreen } from '../src/player/tapRay.js';
import { perspective, lookAt, mirrorProjectionX } from '../src/world/mat4.js';
import { regularsToStand, regularBark, BARK_MS } from '../src/world/cardRegulars.js';
import { fakeDoc, fakeWin } from './decorFakes.mjs';
import { cardPackPrice, buyCardPack } from '../src/systems/cardSources.js';
import { openIliacTableGame } from '../src/scenes/iliacTableGame.js';
import { iliacGrade } from '../src/systems/iliacPatrons.js';
import { giveBinderAtChargen } from '../src/systems/iliacItems.js';
import { skillValue, SKILLS } from '../src/systems/skills.js';
import { liveStat } from '../src/systems/statMods.js';
import { attachTouch } from '../src/ui/touch.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { HOLDEM_FIRST_MS } from '../src/net/holdemTable.js';
import { STARTER_DECK } from '../src/net/iliacCards.js';
import { relaySupportsHoldem, HOLDEM_RELAY_MIN, RELAY_VERSION } from '../src/net/wire.js';
import { RemotePlayers } from '../src/net/remotePlayers.js';
import { SEAT_HIP_DROP } from '../src/player/seatPose.js';
import { fakeRoom } from './fakeRoom.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const grab = (src, re, what) => { const m = re.exec(src); assert.ok(m, `${what} is no longer where this pin reads it`); return m[1]; };
const ROOM = 'interior:m100.200';

// ── THE HOST ─────────────────────────────────────────────────────────────────────────────────────────────────────
const WM = read('src/scenes/worldModes.js');
const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));
// the modes' own lines (outside the block), read into it: the touch layer's two seat hooks are the hosts' over these
const SEATED = grab(WM, /\n {4}cardSeated: (\(\) => [^\n]*?),\n/, "worldModes' cardSeated");
const PRESS_HELD = grab(WM, /\n {4}cardPressHeld: (\(\) => [^\n]*?),\n/, "worldModes' cardPressHeld");
const HOOK_SEAT = grab(read('src/scenes/world.js'), /\n {4}cardTable: (\(\) => [^\n]*?),   \/\/ CARDS-TOUCH/, "world.js's cardTable hook");
const HOOK_HELD = grab(read('src/scenes/world.js'), /\n {4}cardHeld: (\(\) => [^\n]*?),   \/\/ AUDIT CARDS-6 E1/, "world.js's cardHeld hook");

// THE FAKE GEOMETRY (lane E's s10 rig): the eye over the cloth, a screen point meeting the top at P(x, y), the held cards'
// middles projected onto `hand`; THE REAL GEOMETRY: the frame's own projection, for the hand as it is drawn
const W = 1100, H = 640, EYE = [0, 1.2, 0.5];
const P = (x, y) => [(x - 550) / 1000, 0.8, -(H - y) / 400];
const STACK = [600, 600], POT = [580, 450];
const seatedPlaces = (seatOf) => ({ seatOf, board: [[0, 0.8, -0.6]], table: { centre: [0, 0.8, -0.6], axisYaw: 0, halfLong: 1, halfShort: 1 },
  seats: seatOf.map(() => ({ stack: P(...STACK), holes: [P(550, 590), P(560, 590)], yaw: Math.PI })) });

function host({ online = false, id = 'peer-me', geom = 'fake', at = [600, 560], size = [W, H], perf = performance, held = false, seats = 4, pos = [0, 0, 0] } = {}) {
  const doc = fakeDoc();
  const playerEntity = { name: 'Mac', goldPieces: 5000, items: [], health: 50 };
  giveBinderAtChargen(playerEntity);
  const said = [], sent = [], isent = [], drawn = [];
  const seatList = Array.from({ length: seats }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const canvas = { clientWidth: size[0], clientHeight: size[1], getBoundingClientRect: () => ({ left: 0, top: 0 }), captured: [], setPointerCapture(pid) { this.captured.push(pid); } };
  const real = geom === 'real';
  const heldCards = (seat) => (held ? [{ id: `h:${seat}:0`, seat, settled: true, roll: 0, card: 3, pos: [0, 0.8, 0], yaw: 0 }, { id: `h:${seat}:1`, seat, settled: true, roll: 0, card: 9, pos: [0.1, 0.8, 0], yaw: 0 }] : []);
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1, nearestFreeSeat, takenSeats,
    player: { pos, eyeAt: () => [0, 1.6, 0] },
    host: {
      realmAct: null, relock: () => {}, seatedPeers: () => [],
      cardOnline: online ? { ok: () => true, send: (w) => { sent.push(w); return true; }, id: () => id, welcomes: () => 0, room: () => ROOM } : null,
      iliacOnline: online ? { ok: () => true, send: (w) => { isent.push(w); return true; }, id: () => id, now: () => Date.now() } : null,
      iliacRanked: { why: () => 'Sign in to play ranked.', vouch: async () => ({ ok: false }), board: async () => ({ ok: false }) },
      iliacClaims: { add: () => {} },
    },
    say: (s) => said.push(s), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount,
    holdCursor, renderer: {},
    createCardTableDraw: () => ({ draw: (x) => drawn.push(x), destroy() {} }),
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.places = o.places; this.playerSeat = o.playerSeat; } onEvent() {} poses() { return { cards: heldCards(this.playerSeat), chips: [] }; } settledAt() { return 0; } },
    tablePlaces: (frame, s, seatOf) => seatedPlaces(seatOf), tableFrame: () => ({ centre: [0, 0.8, 0], axisYaw: 0, halfLong: 1, halfShort: 0.5 }), hashSeed: (...x) => x.join(':'),
    buildingDirectory: () => ({ locationName: 'Daggerfall' }), registerPlayerHurtListener: () => {},
    isOnlinePage: () => online, mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0, worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
    cardPackPrice, buyCardPack, openIliacTableGame: (o) => openIliacTableGame({ ...o, doc }), iliacGrade, skillValue, SKILLS, liveStat,
    // the cards' own: the gestures and the held hand, real; the screen's geometry the rig's or the frame's
    canvas, ...hand, CARD_W, CARD_L, chipDiscs, cardMatrix,
    worldViewportRect: () => null,
    rayDirFromScreen: real ? rayDirFromScreen : (x, y) => { const q = P(x, y); return [q[0] - EYE[0], q[1] - EYE[1], q[2] - EYE[2]]; },
    projectToScreen: real ? projectToScreen : () => ({ front: true, x: at[0], y: at[1] }),
    performance: perf,
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }, { aabb: {}, gold: true }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    return { sitAtCardTable, standFromCardTable, cardGameFrame, cardOnlineFrame, iliacOnlineFrame, cardDrawGame, cardSeated: ${SEATED}, cardPressHeld: ${PRESS_HELD},
      get cardGame() { return cardGame; }, get cardSeat() { return cardSeat; }, get iliacGame() { return iliacGame; } };`)(state, ...Object.values(scope));
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const panels = () => doc.body.children.filter((n) => (n.className === 'dfcards' || n.className === 'dfiliac') && !n.removed);
  const buttons = (cls = 'dfcards') => panels().filter((p) => p.className === cls).flatMap((p) => walk(p, (n) => n.tag === 'button').map((b) => b.textContent));
  const press = (label) => { const b = panels().flatMap((p) => walk(p, (n) => n.tag === 'button' && n.textContent.startsWith(label)))[0]; assert.ok(b, `a "${label}" button: ${buttons()}`); b.fire('click'); };
  const shown = () => panels().map((p) => walk(p, (n) => n.tag !== 'button' && typeof n.textContent === 'string' && n.textContent && !n.children?.length).map((n) => n.textContent).join(' | ')).join(' / ');
  return { api, said, sent, isent, drawn, canvas, playerEntity, buttons, press, shown };
}

/** An offline evening dealt and played on to the player's turn (lane E's s10 rig): `until` the law he must hold. */
function seatedOnHisTurn(h, until = (l) => !!l) {
  h.api.sitAtCardTable(0);
  h.press('Deal me in');
  const g = h.api.cardGame;
  let t = 0;
  for (; t < 900000; t += 100) {
    h.api.cardGameFrame(t);
    const l = g.session.legal();
    if (l && until(l)) break;
    if (l) { g.session.playerAct(l.check ? { type: 'check' } : l.call <= 2 * g.stakes.bb ? { type: 'call' } : { type: 'fold' }, t); h.api.cardGameFrame(t); }   // not the turn asked for: played on, cheaply
    if (g.session.over) { g.session = null; break; }
  }
  assert.ok(g.session?.legal(), 'the player\'s turn came');
  g.frame = { proj: new Float32Array(16), view: new Float32Array(16), eye: EYE.slice() };
  g.heldAt = [[0, 1, 0], [0.01, 1, 0]];
  return g;
}
const ev = (x, y, more = {}) => ({ clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true, target: { closest: () => null }, ...more });
/** A drag of the chips from his stack into the pot. */
function chipDrag(win, more = {}) { win.fire('pointermove', ev(...STACK, more)); win.fire('pointerdown', ev(...STACK, more)); win.fire('pointermove', ev(...POT, more)); win.fire('pointerup', ev(...POT, more)); }
function withWindow(fn) {
  const prev = globalThis.window;
  const win = fakeWin();
  globalThis.window = win;
  try { return fn(win); } finally { globalThis.window = prev; }
}

test('AUDIT CARDS-6 E2: a press on the hand the window never heard let go - the browser took it back, the canvas lost it, a mouse let go outside - is let go UNREAD, and the next chip drag is the bet, never "You fold." (mutants: the cancel; the lost capture; the same pointer down again)', () => withWindow((win) => {
  // as designed: a calm drag of the chips bets
  {
    const h = host();
    const g = seatedOnHisTurn(h);
    g.log = [];   // the log keeps its last twelve: read fresh
    const n = 0;
    chipDrag(win);
    assert.match(g.log.slice(n).join(' '), /^You (call|bet|raise)/, 'the drag is the bet');
    h.api.standFromCardTable();
  }
  for (const how of ['pointercancel', 'lostpointercapture', 'unheard']) {
    const h = host();
    const g = seatedOnHisTurn(h);
    win.fire('pointermove', ev(600, 560)); win.fire('pointerdown', ev(600, 560));
    assert.ok(g.handPress && g.peekHeld, `${how}: the press on the hand held`);
    assert.deepEqual(h.canvas.captured, [1], `${how}: its pointer captured`);
    if (how !== 'unheard') win.fire(how, ev(600, 560));
    if (how !== 'unheard') assert.deepEqual([g.handPress, g.squeeze, g.peekHeld, g.drag], [null, null, false, null], `${how}: let go, unread`);
    g.log = [];   // the log keeps its last twelve: read fresh
    const n = 0;
    chipDrag(win);   // 'unheard': the same pointer down again - the press it held was let go where the window never heard it
    assert.ok(!g.log.slice(n).includes('You fold.'), `${how}: never a fold - ${g.log.slice(n)}`);
    assert.match(g.log.slice(n).join(' '), /^You (call|bet|raise)/, `${how}: the drag is the bet`);
    assert.equal(g.drag, null, `${how}: nothing left hanging`);
    h.api.standFromCardTable();
  }
}));

test('AUDIT CARDS-6 E2: a second finger is no press - it never takes the first\'s place, pulls its squeeze or lets it go; a chip let go over the panel is no bet, whatever the pointer\'s target (mutants: the pointer\'s id; the second finger taken; the panel\'s box)', () => withWindow((win) => {
  const h = host();
  const g = seatedOnHisTurn(h);
  g.scene.places.seats[g.scene.playerSeat].stack = P(900, 630);   // his chips well away from the hand
  g.log = [];   // the log keeps its last twelve: read fresh
  const n = 0;
  win.fire('pointermove', ev(600, 515)); win.fire('pointerdown', ev(600, 515));
  const second = { pointerId: 2, isPrimary: false };
  const seen = win.fire('pointerdown', ev(600, 605, second));
  assert.ok(seen.stopped && seen.prevented, 'the second finger taken - never the seat\'s');
  assert.deepEqual(g.handPress.at, [600, 515], 'the press still the first finger\'s');
  win.fire('pointermove', ev(600, 700, second));
  assert.equal(g.squeeze ?? null, null, 'the second finger pulls no squeeze');
  win.fire('pointerup', ev(600, 700, second));
  assert.ok(g.handPress, 'its letting go is not the press\'s');
  win.fire('pointercancel', ev(600, 700, second));
  assert.ok(g.handPress, 'nor its cancel');
  win.fire('pointerup', ev(600, 515));
  assert.equal(g.handPress, null, 'the first finger lets its own press go');
  assert.ok(!g.log.slice(n).includes('You fold.'), `a still press is no push: ${g.log.slice(n)}`);
  h.api.standFromCardTable();
  // the panel's box: a chip carried there and let go is no bet, though the pointer's target is the canvas it was captured to
  const h2 = host();
  const g2 = seatedOnHisTurn(h2);
  g2.hud.root.getBoundingClientRect = () => ({ left: 560, right: 600, top: 430, bottom: 470, width: 40, height: 40 });
  g2.log = [];
  const m = 0;
  chipDrag(win);
  assert.deepEqual(g2.log.slice(m), [], 'let go over the panel: no bet');
  h2.api.standFromCardTable();
}));

test('AUDIT CARDS-6 E20: the host\'s click and push driven for real - a click on the hand checks when the law has a check, a push up folds on his turn, neither does anything off it (the old pins read the text)', () => withWindow((win) => {
  const h = host();
  const g = seatedOnHisTurn(h, (l) => !!l.check);
  g.log = [];   // the log keeps its last twelve: read fresh
  let n = 0;
  win.fire('pointermove', ev(600, 560)); win.fire('pointerdown', ev(600, 560)); win.fire('pointerup', ev(601, 561));
  assert.equal(g.log[n], 'You check.', 'a click checks');
  // on to his next turn, and a push up the screen folds
  for (let t = 1e6; !g.session.legal() && t < 2e6; t += 100) h.api.cardGameFrame(t);
  assert.ok(g.session.legal(), 'his turn again');
  g.log = []; n = 0;
  win.fire('pointermove', ev(600, 560)); win.fire('pointerdown', ev(600, 560)); win.fire('pointermove', ev(605, 560 - H * hand.PUSH_FOLD - 10)); win.fire('pointerup', ev(605, 560 - H * hand.PUSH_FOLD - 10));
  assert.equal(g.log[n], 'You fold.', 'a push folds');
  // off his turn: neither a click nor a push says anything
  assert.equal(g.session.legal(), null);
  g.log = []; n = 0;
  win.fire('pointermove', ev(600, 560)); win.fire('pointerdown', ev(600, 560)); win.fire('pointerup', ev(600, 560));
  win.fire('pointerdown', ev(600, 560)); win.fire('pointermove', ev(600, 400)); win.fire('pointerup', ev(600, 400));
  assert.ok(!g.log.slice(n).some((l) => /^You (check|fold)/.test(l)), `off his turn: ${g.log.slice(n)}`);
  h.api.standFromCardTable();
}));

// ── E1: THE TOUCH LAYER AND THE CARDS TOGETHER ─────────────────────────────────────────────────────────────────────
function stubEl() {
  return {
    id: '', textContent: '', children: [], _l: new Map(), attrs: {}, style: { cssText: '' },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { if (!this._l.has(t)) this._l.set(t, []); this._l.get(t).push(f); },
    setAttribute(k, v) { this.attrs[k] = v; }, remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    fire(t, e) { for (const f of [...(this._l.get(t) ?? [])]) f(e); },
  };
}
test('AUDIT CARDS-6 E1: a finger the cards took is the table\'s on the stick\'s half too - a squeeze pulled down from the hand\'s left edge walks him nowhere; a finger they did not take is still the stick that walks him off the seat (mutants: the layer\'s gate; the host\'s word; exterior\'s hook)', () => {
  const prev = { d: globalThis.document, w: globalThis.window, k: globalThis.KeyboardEvent };
  const keys = [];
  globalThis.KeyboardEvent = class { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } };
  globalThis.document = { createElement: () => stubEl(), body: stubEl() };
  const win = Object.assign(fakeWin(), { ontouchstart: null, dispatchEvent: (e) => { if (e.type === 'keydown') keys.push(e.code); return true; }, prompt: () => null });
  globalThis.window = win;
  resetPrefs();
  setPref('touchStickAnchor', 'float');
  let layer = null;
  try {
    const LEFT = [400, 560];   // the hand's left edge - the touch layer's stick half (its canvas 1000 wide)
    const h = host({ at: LEFT });
    const g = seatedOnHisTurn(h);
    const modes = { cardSeated: h.api.cardSeated, cardPressHeld: h.api.cardPressHeld };
    const said = { look: 0, attack: 0, tap: 0 };
    const surface = stubEl();
    layer = attachTouch(surface, {
      look: () => { said.look++; }, attack: () => { said.attack++; }, tap: () => { said.tap++; },
      cardTable: new Function('modes', `return ${HOOK_SEAT};`)(modes), cardHeld: new Function('modes', `return ${HOOK_HELD};`)(modes),
    });
    const touch = (type, x, y, ts) => surface.fire(type, { type, timeStamp: ts, preventDefault() {}, stopPropagation() {}, changedTouches: [{ identifier: 7, clientX: x, clientY: y }] });
    // the browser's order: the pointerdown (the cards, at the window's capture) before the touchstart (the layer)
    win.fire('pointermove', ev(...LEFT)); win.fire('pointerdown', ev(...LEFT));
    assert.ok(g.handPress, 'the cards took the press on the hand');
    touch('touchstart', ...LEFT, 0);
    for (let i = 1; i <= 6; i++) { win.fire('pointermove', ev(LEFT[0], LEFT[1] + i * 15)); touch('touchmove', LEFT[0], LEFT[1] + i * 15, i * 16); }
    assert.ok(g.squeeze > 0, 'the cards read the pull as the squeeze');
    win.fire('pointerup', ev(LEFT[0], LEFT[1] + 90)); touch('touchend', LEFT[0], LEFT[1] + 90, 120);
    assert.deepEqual(keys, [], 'no stick: no step that stands him up');
    assert.deepEqual(said, { look: 0, attack: 0, tap: 0 }, 'and nothing else said to the world');
    // a finger on the cloth the cards did not take: the stick, which still walks him off the seat
    win.fire('pointermove', ev(100, 300)); win.fire('pointerdown', ev(100, 300));
    assert.equal(h.api.cardPressHeld(), false);
    touch('touchstart', 100, 300, 1000);
    for (let i = 1; i <= 6; i++) touch('touchmove', 100, 300 + i * 15, 1000 + i * 16);
    touch('touchend', 100, 390, 1120);
    assert.ok(keys.length > 0, 'the stick walks - the seat\'s way off');
    h.api.standFromCardTable();
    assert.equal(h.api.cardPressHeld(), false, 'standing, nothing is held');
  } finally {
    layer?.dispose();
    globalThis.document = prev.d; globalThis.window = prev.w; globalThis.KeyboardEvent = prev.k;
    resetPrefs();
  }
  // both hosts that enter buildings hand the layer the word
  assert.equal(grab(read('src/scenes/exterior.js'), /\n {4}cardHeld: (\(\) => [^\n]*?),   \/\/ AUDIT CARDS-6 E1/, "exterior.js's cardHeld hook"), HOOK_HELD);
});

// ── E7, E8: THE RELAY'S WORDS ────────────────────────────────────────────────────────────────────────────────────────
const gateKey = webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']).then(async (kp) => Buffer.from(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey)).toString('base64'));
async function withRelay(fn) {
  const r = fakeRoom(ROOM);
  r.env.GATE_SIGNING_KEY = await gateKey;
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms) => { clock += ms; };
  const local = { ms: 0 };
  const perf = { now: () => local.ms };
  const join = async (id) => { const w = r.connect(); await r.hello(w, id, null, { name: id }); return w; };
  /** A host at the relay: its words said to the relay, the relay's frames to it, as online.js and world.js hand them. */
  const seat = async (id, chair) => {
    const ws = await join(id);
    const h = host({ online: true, id, perf, pos: [chair * 2, 0, 0] });   // stood by the chair he takes
    let heard = 0;
    h.pump = async () => {
      for (const w of h.sent.splice(0)) { tick(300); await r.raw(ws, JSON.stringify({ t: 'holdem', ...w })); }
      for (const w of h.isent.splice(0)) { tick(300); await r.raw(ws, JSON.stringify({ t: 'iliac', ...w })); }
      for (const m of ws.sent.slice(heard)) {
        if (m.t === 'holdem') h.api.cardOnlineFrame({ ...m, at: local.ms });
        if (m.t === 'iliac') h.api.iliacOnlineFrame({ ...m, at: local.ms });
      }
      heard = ws.sent.length;
      h.api.cardGameFrame(local.ms);
    };
    h.ws = ws;
    return h;
  };
  try { await fn({ r, tick, local, join, seat }); } finally { Date.now = realNow; }
}

test('AUDIT CARDS-6 E8: a Hold\'em sit at a cloth that plays Iliac Hand - the relay\'s \'other game\' - is said once, never asked again, and the panel offers that game (mutants: the refusal\'s word; the chair lost; the panel\'s offer)', () => withRelay(async ({ r, tick, local, join, seat }) => {
  const a = await join('peer-a'), b = await join('peer-b');
  for (const [ws, chair] of [[a, 0], [b, 2]]) { tick(300); await r.raw(ws, JSON.stringify({ t: 'iliac', op: 'sit', table: 0, chair, chairs: 4, deck: [...STARTER_DECK] })); }
  assert.equal(r.room._iliac.get(0).seats.length, 2, 'two at Iliac Hand on the cloth');
  const c = await seat('peer-c', 3);
  c.api.sitAtCardTable(0);
  assert.deepEqual(c.sent.map((w) => w.op), ['sit'], 'the Hold\'em sit said');
  await c.pump();
  assert.ok(c.ws.sent.some((m) => m.t === 'holdem' && m.error === 'other game'), 'the relay\'s own word');
  assert.ok(c.said.includes('Iliac Hand is being played at this table.'), `said: ${c.said}`);
  for (let k = 1; k <= 4; k++) { local.ms += 1600; await c.pump(); }
  assert.deepEqual(c.sent, [], 'never asked again - it was every 1.5 s for as long as the game went on');
  assert.ok(!r.room._holdem?.get(0)?.seats.some((s) => s?.id === 'peer-c'), 'no seat at the relay');
  assert.match(c.shown(), /Iliac Hand is being played at this table\./, 'the panel says it');
  const offer = c.buttons();
  assert.equal(offer.length, 3, `${offer}`);
  assert.equal(offer[0], 'Play Iliac Hand', 'and offers the game played there');
  assert.match(offer[1], /^Buy a card pack \(\d+ gold\)$/, 'the house\'s packs');
  assert.equal(offer[2], 'Leave the table');
  c.press('Play Iliac Hand');
  assert.ok(c.api.iliacGame, 'the Iliac panel open on the seat');
  await c.pump();
  assert.ok(c.ws.sent.some((m) => m.t === 'iliac' && m.state?.seats?.length === 2), 'watching the game under way');
  c.api.standFromCardTable();
}));

test('AUDIT CARDS-6 E7: the relay\'s Hold\'em table offers Iliac Hand and the house\'s packs whenever he is not in a hand - alone, two waiting for the deal - and not while a hand holds him; the press stands him up from Hold\'em and opens the other game (mutants: the offer\'s gate; in a hand)', () => withRelay(async ({ r, tick, local, seat }) => {
  const a = await seat('peer-a', 0);
  a.api.sitAtCardTable(0);
  await a.pump();
  assert.equal(a.api.cardGame.remote?.confirmed, true, 'sat at the relay\'s table (no buy-in panel)');
  const offered = (h) => h.buttons().some((x) => x === 'Play Iliac Hand') && h.buttons().some((x) => /^Buy a card pack/.test(x));
  assert.ok(offered(a), `alone: ${a.buttons()}`);
  const b = await seat('peer-b', 2);
  b.api.sitAtCardTable(0);
  await b.pump(); await a.pump();
  assert.ok(offered(a) && offered(b), `two, the deal coming: ${a.buttons()} / ${b.buttons()}`);
  tick(HOLDEM_FIRST_MS); await r.fire();
  local.ms += 3000;
  await a.pump(); await b.pump();
  assert.ok(a.api.cardGame.remote.state.hand, 'dealt');
  assert.ok(!offered(a) && !offered(b), `in a hand: ${a.buttons()} / ${b.buttons()}`);
  // a hand under way that does not hold him: a third, sat down while it is played
  const c = await seat('peer-c', 3);
  c.api.sitAtCardTable(0);
  await c.pump();
  await c.pump();   // the room's change came with no table under it: the whole asked for (CARDS-TIDY's look), and told
  assert.ok(c.api.cardGame.remote.state?.hand && !c.api.cardGame.remote.state.handSeats.includes(c.api.cardGame.remote.playerSeat), 'a hand he is not in');
  assert.ok(offered(c), `not in the hand: ${c.buttons()}`);
  c.press('Play Iliac Hand');
  assert.deepEqual(c.sent.map((w) => w.op), ['stand'], 'up from the relay\'s Hold\'em table');
  assert.ok(c.api.iliacGame && !c.api.cardGame, 'the other game open, Hold\'em closed');
  await c.pump();
  assert.ok(!r.room._holdem.get(0).seats.some((s) => s?.id === 'peer-c' && !s.leaving), 'the relay stood him');
  for (const h of [a, b, c]) h.api.standFromCardTable();
}));

// ── E21, E22: THE HAND AS IT IS DRAWN ────────────────────────────────────────────────────────────────────────────────
/** The host's cardDrawGame on a frame of `w` x `h` from a seat's eye, the panel's box `box` (or none): the held matrices. */
function drawSeated(h, w, ht, box) {
  const g = h.api.cardGame;
  if (box) g.hud.root.getBoundingClientRect = () => ({ ...box, width: box.right - box.left, height: box.bottom - box.top });
  const eye = [0, 1.2, 0.5];
  const proj = mirrorProjectionX(perspective((60 * Math.PI) / 180, w / ht, 0.02, 100));
  const view = lookAt(eye, [0, 0.8, -0.6], [0, 1, 0]);
  h.api.cardDrawGame(g, proj, view, eye);
  const mats = [...g.hold.values()].map((x) => x.m);
  const corners = mats.flatMap((m) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => {
    const x = sx * CARD_W / 2, z = sz * CARD_L / 2;
    return projectToScreen([m[0] * x + m[8] * z + m[12], m[1] * x + m[9] * z + m[13], m[2] * x + m[10] * z + m[14]], w, ht, proj, view, null);
  })));
  return { g, proj, view, mats, xs: corners.map((s) => s.x), ys: corners.map((s) => s.y) };
}

test('AUDIT CARDS-6 E21: on a phone held upright the host holds the hand farther off and nearer the middle - inside the screen\'s edges - and lifts it clear of a panel the old lift could not clear; a wide screen\'s hand is the hand it was (mutants: the fit\'s aspect; the fit unused; the lift\'s reach; the host\'s fit)', () => withWindow(() => {
  assert.equal(hand.HELD_FIT_ASPECT, 0.8);
  assert.equal(hand.heldFit(1100 / 640), 1, 'a wide screen: as tuned');
  assert.ok(Math.abs(hand.heldFit(390 / 844) - 0.8 / (390 / 844)) < 1e-12);
  const view = lookAt([0, 1.2, 0.5], [0, 0.8, -0.6], [0, 1, 0]);
  for (const p of [0, 1]) assert.deepEqual(hand.heldMatrices(view, 2, p, 0.05, 1).map((m) => [...m]), hand.heldMatrices(view, 2, p, 0.05).map((m) => [...m]), 'fit 1 is the hand it was');
  // the phone (390 x 844): the panel at the bottom, full width - its top where a playing panel's stands (lane E's 376 px)
  const box = { left: 16, right: 374, top: 844 - 18 - 376, bottom: 844 - 18 };
  for (const peek of [0, 1]) {
    const h = host({ geom: 'real', size: [390, 844], held: true });
    seatedOnHisTurn(h);
    h.api.cardGame.peek = peek; h.api.cardGame.peekHeld = !!peek;
    const { xs, ys } = drawSeated(h, 390, 844, box);
    assert.ok(Math.min(...xs) >= 0 && Math.max(...xs) <= 390, `peek ${peek}: inside the edges (x ${Math.min(...xs).toFixed(0)}..${Math.max(...xs).toFixed(0)})`);
    assert.ok(Math.max(...ys) <= box.top - hand.HELD_PANEL_GAP_PX + 0.5, `peek ${peek}: clear of the panel (lowest ${Math.max(...ys).toFixed(0)}, its top ${box.top})`);
    assert.ok(Math.min(...ys) >= 0, `peek ${peek}: under the top of the view`);
    h.api.standFromCardTable();
  }
  // the desktop probe's screen: the same hand as before the fit
  const d = host({ geom: 'real', size: [1100, 640], held: true });
  seatedOnHisTurn(d);
  const { mats, view: v } = drawSeated(d, 1100, 640, null);
  assert.deepEqual(mats.map((m) => [...m].map((x) => +x.toFixed(9))), hand.heldMatrices(v, 2, d.api.cardGame.peek).map((m) => [...m].map((x) => +x.toFixed(9))));
  d.api.standFromCardTable();
}));

test('AUDIT CARDS-6 E22: the squeeze draws the front card DOWN the screen, as the finger pulls - through the host\'s own press and draw (mutants: the draw\'s direction)', () => withWindow((win) => {
  const h = host({ geom: 'real', size: [1100, 640], held: true });
  const g = seatedOnHisTurn(h);
  const first = drawSeated(h, 1100, 640, null);
  const mid = (m) => projectToScreen([m[12], m[13], m[14]], 1100, 640, first.proj, first.view, null);
  const at = mid(first.mats[0]);
  win.fire('pointermove', ev(at.x, at.y)); win.fire('pointerdown', ev(at.x, at.y));
  assert.ok(g.handPress, 'the press on the hand');
  g.peek = 1;   // peeked all the way (the press holds it so): only the squeeze moves a card from here
  const before = drawSeated(h, 1100, 640, null);
  const front = mid(before.mats[0]), back = mid(before.mats[1]);
  win.fire('pointermove', ev(at.x, at.y + 640 * (hand.CLICK_SLOP + hand.SQUEEZE_PULL)));
  assert.equal(g.squeeze, 1, 'pulled all the way down');
  const after = drawSeated(h, 1100, 640, null);
  const f2 = mid(after.mats[0]), b2 = mid(after.mats[1]);
  assert.ok(f2.y > front.y + 20, `the front card comes down the screen with the finger (${front.y.toFixed(0)} -> ${f2.y.toFixed(0)})`);
  assert.ok(Math.abs(b2.y - back.y) < 1e-6 && Math.abs(b2.x - back.x) < 1e-6, 'the card behind stays');
  win.fire('pointerup', ev(at.x, at.y + 640 * (hand.CLICK_SLOP + hand.SQUEEZE_PULL)));
  h.api.standFromCardTable();
}));

// ── E20: THE RECORDS ─────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT CARDS-6 E20: the relay that deals Hold\'em is TAVERN CARDS\' world178 - main\'s world176 and world177 deal nothing (mutants: the least relay)', () => {
  assert.equal(HOLDEM_RELAY_MIN, 178);
  for (const [v, ok] of [['world175', false], ['world176', false], ['world177', false], ['world178', true], [RELAY_VERSION, true]]) assert.equal(relaySupportsHoldem(v), ok, v);
});

test('AUDIT CARDS-6 E20: the class sprite\'s path sunk at its seat for real on a fake renderer, its name brought down with it; on its feet standing (the old pin read the text)', () => {
  const made = [];
  const renderer = { createBillboardBatch: (archive, rec, size) => { const b = { archive, rec, size }; made.push(b); return b; }, destroyBillboardBatch() {}, textures: { has: () => true } };
  const rp = new RemotePlayers({ renderer, deps: { fetchBytes: async () => null, palette: null, uploadRecordFrame: () => {} }, compose: async () => null });
  const bundle = { mobileUnit: { update: () => ({ record: 0, frame: 0, flip: false }) }, archive: 400, tex: { archive: 400, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) } };
  const peer = { id: 'p1', shown: { x: 2, y: 0, z: 3, st: 16 } };
  rp._shown = [];
  rp._syncMobilePeer(peer, bundle, (s) => [s.x, s.y, s.z], 0.016, [0, 1.6, 0]);
  const entry = rp._batches.get('p1');
  assert.equal(made.length, 1);
  assert.deepEqual(entry.batch.origin.map((v) => +v.toFixed(6)), [2, -SEAT_HIP_DROP, 3], 'sunk by the seat\'s drop');
  assert.ok(Math.abs(rp._shown[0].height - (entry.height - SEAT_HIP_DROP)) < 1e-9, 'the name over the sunk head');
  peer.shown = { x: 2, y: 0, z: 3 };
  rp._shown = [];
  rp._syncMobilePeer(peer, bundle, (s) => [s.x, s.y, s.z], 0.016, [0, 1.6, 0]);
  assert.deepEqual(entry.batch.origin, [2, 0, 3], 'stood up: on its feet');
  assert.equal(rp._shown[0].height, entry.height);
});
