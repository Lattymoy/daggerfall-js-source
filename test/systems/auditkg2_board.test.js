// AUDIT KG II (2026-10-15, bible/01-Overview/audits/Audit-Kings-Gambit-II.md, lane C): THE KING'S GAMBIT'S BOARD AND ITS
// PRESSES, FOUND AND FIXED - the pad's Start and A, and a finger the cloth took, each a stake lost at one press (the
// host's Escape action, LeftClick's Mouse0 alias and the touch layer's stick now the board's while a battle is on); the
// d-pad the board's cursor under the Plus crossbar; the lean never thrown away by a sheet over the whole view; the beat
// after a forfeit nobody's turn; the chosen card pressed where it is drawn; the information box's foes by name and its
// cell's hazard; a regular's night the tavern's; a finger on a foe's card that foe; the mod's own piece selection.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openGambitTableGame, gambitTableOn, gambitClear, GAMBIT_CLEAR_MIN } from '../../src/scenes/gambitTableGame.js';
import { gambitBoardKey, gambitHudModel, infoBox } from '../../src/ui/gambitTableHud.js';
import { gambitPlaces, gambitPressCell, gambitCardHeight, gambitLean, GAMBIT_CARD_FOOT, GAMBIT_SELECT_LIFT } from '../../src/world/gambitCloth.js';
import { pieceById, reachable, KG_TILE, KG_COLS } from '../../src/net/kingsGambit.js';
import { GAMBIT_RESULT_MS } from '../../src/systems/gambit/gambitTableSession.js';
import { tierFor } from '../../src/systems/gambit/gambitPatrons.js';
import { fakeDoc, fakeWin } from '../decorFakes.mjs';
import { nearestFreeSeat, takenSeats } from '../../src/world/card/cardTables.js';
import { RemoteCardTable } from '../../src/systems/card/cardRemoteTable.js';
import * as court from '../../src/systems/court.js';
import * as sess from '../../src/systems/card/cardTableSession.js';
import * as hudm from '../../src/ui/card/cardTableHud.js';
import * as hand from '../../src/world/card/cardHand.js';
import { CARD_W, CARD_L, chipDiscs } from '../../src/world/card/cardMotion.js';
import { cardMatrix } from '../../src/render/cardTableDraw.js';
import { holdCursor } from '../../src/player/pointerLock.js';
import { rayDirFromScreen, projectToScreen } from '../../src/player/tapRay.js';
import { regularsToStand, regularBark, regularLook, BARK_MS } from '../../src/world/card/cardRegulars.js';
import { seatTopByte } from '../../src/player/seatPose.js';
import { cardPackPrice, buyCardPack } from '../../src/systems/card/cardSources.js';
import { openIliacTableGame } from '../../src/scenes/iliacTableGame.js';
import { iliacGrade } from '../../src/systems/iliac/iliacPatrons.js';
import { giveBinderAtChargen } from '../../src/systems/iliac/iliacItems.js';
import { skillValue, SKILLS } from '../../src/systems/skills.js';
import { liveStat } from '../../src/systems/statMods.js';
import { createBindings, resetDefaults } from '../../src/systems/inputActions.js';
import { setBindings, actionOf } from '../../src/ui/input.js';
import { CARD_TABLE_W, CARD_TABLE_D } from '../../src/world/card/cardTableProp.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';
import { setPref, _resetForTests as resetPrefs } from '../../src/systems/uiPrefs.js';
import { xorshift } from '../../tools/kgMeasure.mjs';

beforeEach(() => resetPrefs());
const FRAME = { centre: [0, 0.8, 0], axisYaw: Math.PI / 2, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 };
const FEET = [0, 0, -0.9];
const WM = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');

/** The interior host's card block (test/systems/kg3_host.test.js's harness), with the host's own Escape arm lifted whole. */
function cardHost() {
  const doc = fakeDoc(), win = fakeWin();
  const playerEntity = { name: 'Mac', goldPieces: 5000, items: [], health: 50 };
  giveBinderAtChargen(playerEntity);
  const said = [];
  const seatList = Array.from({ length: 4 }, (_, k) => ({ x: k * 2, z: 0, eye: [k * 2, 1, 0], feet: [k * 2, 0, 0], yaw: 0, pitch: 0, top: 0.8 }));
  const store = createBindings(); resetDefaults(store); setBindings(store);
  const BLOCK = WM.slice(WM.indexOf('  let cardSeat = null;'), WM.indexOf('\n', WM.indexOf("registerPlayerHurtListener('cards-seat'")));
  const at = WM.indexOf("    if (mode === 'interior' && cardSeat && actionOf(e, keys) === 'Escape' && !interiorKeyCtx.uiOverlayActive) {");
  const ESC_ARM = WM.slice(at, WM.indexOf('\n    }\n', at) + 6);
  const scope = {
    isTavern: () => true, BUILDING_TYPES: { None: 0 },
    cardTableSeats: () => seatList, seatFloorOk: () => true, SEAT_FLOOR_PROBE: 1, nearestFreeSeat, takenSeats,
    player: { pos: [0, 0, 0], eyeAt: () => [0, 1.6, 0] },
    host: { realmAct: null, relock: () => {}, seatedPeers: () => [], cardOnline: null, iliacOnline: null, iliacRanked: { why: () => '', vouch: async () => ({ ok: false }), board: async () => ({ ok: false }) }, iliacClaims: { add: () => {} } },
    say: (x) => said.push(x), cam: { yaw: 0, pitch: 0, pos: null },
    getNameBankOfRegion: () => 0, residentName: (seed, bank, g) => `R${seed}:${g}`,
    stakesFor: sess.stakesFor, buyInRange: sess.buyInRange, goldAmount: court.goldAmount,
    holdCursor, renderer: {},
    createCardTableDraw: () => ({ draw() {}, destroy() {} }),
    createCardTableHud: (p) => hudm.createCardTableHud({ ...p, doc }), cardHudModel: hudm.cardHudModel, eventLine: hudm.eventLine,
    deductGold: court.deductGold, addGold: court.addGold, playerEntity,
    CardTableSession: sess.CardTableSession, seatPatrons: sess.seatPatrons, regularsFor: sess.regularsFor, regularsAfter: sess.regularsAfter,
    CardScene: class { constructor(o) { this.places = o.places; } onEvent() {} poses() { return { cards: [], chips: [] }; } settledAt() { return 0; } },
    tablePlaces: () => ({ seatOf: [], board: [], table: FRAME, seats: [] }), tableFrame: () => FRAME, hashSeed: (...x) => x.join(':'),
    buildingDirectory: () => ({ locationName: 'Daggerfall' }), registerPlayerHurtListener: () => {},
    isOnlinePage: () => false, mwViewFirstPerson: () => {}, homeTownOf: (b) => b?.townMapId || 0, worldMinutes: () => 0, MINUTES_PER_DAY: 1440,
    RemoteCardTable, mode: 'interior', regularsToStand, regularBark, BARK_MS, showdownWinners: hudm.showdownWinners, HOLDEM_REFUSALS: hudm.HOLDEM_REFUSALS,
    cardPackPrice, buyCardPack, openIliacTableGame: (o) => openIliacTableGame({ ...o, doc }), iliacGrade, skillValue, SKILLS, liveStat,
    gambitTableOn, openGambitTableGame: (o) => openGambitTableGame({ ...o, doc }), isTouchDevice: () => false, regularLook, seatTopByte, cursorKeyClaimed: () => false, gambitBoardKey, audio: null,
    canvas: { clientWidth: 1280, clientHeight: 720, getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture() {} }, ...hand, CARD_W, CARD_L, chipDiscs, cardMatrix,
    worldViewportRect: () => null, rayDirFromScreen, projectToScreen, performance,
    window: win, interiorPaused: () => false, townTalk: null,
    actionOf, interiorKeyCtx: { uiOverlayActive: false }, keys: new Set(),
  };
  const state = { interiorCtx: { tables: [{ aabb: {} }], collider: null }, interiorBuilding: { buildingKey: 7, quality: 10, regionIndex: 17, townMapId: 1111 } };
  const api = new Function('S', ...Object.keys(scope), `let interiorCtx = S.interiorCtx, interiorBuilding = S.interiorBuilding;\n${BLOCK}\n
    function hostEscape(e) {
${ESC_ARM}
return "not-taken"; }
    return { sitAtCardTable, standFromCardTable, hostEscape, cardTavernKey, get gambitGame() { return gambitGame; } };`)(state, ...Object.values(scope));
  const walk = (n, f, out = []) => { if (!n) return out; if (f(n)) out.push(n); for (const c of n.children ?? []) walk(c, f, out); return out; };
  const panels = () => doc.body.children.filter((n) => /^df(cards|iliac|gambit)\b/.test(n.className) && !n.removed);
  const press = (label) => { const b = panels().flatMap((p) => walk(p, (n) => n.tag === 'button' && n.textContent.startsWith(label)))[0]; assert.ok(b, label); b.fire('click'); };
  return { api, said, win, playerEntity, press };
}
const staked = (h) => {
  h.api.sitAtCardTable(0);
  h.press('Play The King\'s Gambit');
  const gg = h.api.gambitGame;
  gg.press('regular', 1); gg.press('stake', 5); gg.press('next'); gg.press('autofill'); gg.press('start');
  assert.ok(gg.g.game.stake > 0 && gg.playing());
  return gg;
};

test('AUDIT KG II C1 + C2 THE PAD AT A STAKED BATTLE: Start (an Escape action\'s key) asks Stand up twice, as Escape does; A\'s LeftClick alias (Mouse0) is the board\'s, never ActivateCenterObject\'s stand (mutants: the host\'s Escape arm; the alias swallowed)', () => {
  const h = cardHost();
  const gg = staked(h);
  const purse = h.playerEntity.goldPieces;
  const start = h.win.fire('keydown', { code: 'JoystickButton7', key: 'JoystickButton7', target: {} });
  assert.equal(start.stopped, false, 'the cloth names no Start');
  assert.equal(actionOf({ code: 'JoystickButton7' }, new Set()), 'Escape', 'Start is an Escape action\'s key');
  h.api.hostEscape({ code: 'JoystickButton7', key: 'JoystickButton7', preventDefault() {} });
  assert.ok(h.api.gambitGame, 'one press: asked, not stood up');
  assert.equal(gg.g.armed, 'stand');
  assert.equal(h.playerEntity.goldPieces, purse);
  const a = h.win.fire('keydown', { code: 'JoystickButton0', key: 'JoystickButton0', target: {} });
  const m = h.win.fire('keydown', { code: 'Mouse0', key: 'Mouse0', target: {} });
  assert.equal(a.stopped, true, 'A: the cursor\'s press');
  assert.equal(m.stopped, true, 'and its LeftClick alias the board\'s too');
  const start7 = () => h.api.hostEscape({ code: 'JoystickButton7', key: 'JoystickButton7', preventDefault() {} });
  start7();
  assert.equal(gg.g.selected, null, 'A chose a piece: Start lets it go first, as Escape does');
  start7();
  assert.ok(h.api.gambitGame, 'then asks');
  start7();
  assert.equal(h.api.gambitGame, null, 'asked twice: stood up');
});

test('AUDIT KG II C3 + C9 A FINGER THE CLOTH TOOK IS HELD TILL IT LIFTS - the touch layer\'s stick never born under it; a regular\'s night the tavern\'s (mutants: the finger; its lift; cardPressHeld; the tavern\'s key)', () => {
  assert.match(WM, /cardPressHeld: \(\) => mode === 'interior' && !!cardSeat && !!\(cardGame\?\.handPress \|\| cardGame\?\.drag \|\| gambitGame\?\.fingerHeld\?\.\(\)\),/);
  assert.match(WM, /\['pointerup', lift\], \['pointercancel', lift\]/);
  assert.match(WM, /day: cardDay, key: cardTavernKey\(\), friendly/);
  const h = cardHost();
  assert.equal(h.api.cardTavernKey(), '1111:7', 'the tavern, not its table');
  const gg = staked(h);
  const W = 1280, H = 720, eye = [0, 1.4, -0.75];
  const cam = { proj: mirrorProjectionX(perspective((65 * Math.PI) / 180, W / H, 0.05, 100)), view: lookAt(eye, [0, 0.8, 0], [0, 1, 0]), eye };
  gg.draw(0, cam);
  const p = gg.g.places.at(7, 6), s = projectToScreen(p, W, H, cam.proj, cam.view, null);
  assert.equal(gg.pointer([s.x, s.y], { w: W, h: H }, { touch: true }), true);
  assert.equal(gg.fingerHeld(), true, 'the cloth\'s finger');
  h.win.fire('pointerup', { pointerType: 'touch' });
  assert.equal(gg.fingerHeld(), false, 'lifted');
});

test('AUDIT KG II C4 THE D-PAD AT THE BOARD UNDER THE PLUS CROSSBAR: its own codes, the board\'s cursor - never the map, the log, Rest or the hands (mutants: boardUp)', async () => {
  globalThis.window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
  const { applyPlusPadLayout, registerCrossbar, DPAD_CODES } = await import('../../src/ui/plus/plusPad.js');
  const { attachGamepad } = await import('../../src/ui/gamepadInput.js');
  const { _resetForTests: resetSettings } = await import('../../src/systems/settings/settings.js');
  resetSettings(); setPref('plusPadLayout', 0);
  const store = createBindings(); resetDefaults(store); applyPlusPadLayout(store); setBindings(store);
  registerCrossbar({ inForce: () => true, press() {}, setActive() {} });
  const tap = (board) => {
    const events = [];
    const pad = { connected: true, mapping: 'standard', id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    const canvas = { dispatchEvent() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), style: {} };
    const gp = attachGamepad(canvas, { overlayActive: () => false, paused: () => false, attack() {}, look() {}, padAction: () => false, board: { up: () => board } }, { getPads: () => [pad], dispatch: (t, c) => events.push([t, c]), makeEvent: (type, init) => ({ type, ...init }) });
    gp.tick(1 / 60);
    const out = {};
    for (const [dir, btn] of [['up', 12], ['down', 13], ['left', 14], ['right', 15]]) {
      events.length = 0;
      pad.buttons[btn] = { pressed: true, value: 1 }; for (let f = 0; f < 3; f++) gp.tick(1 / 60);
      pad.buttons[btn] = { pressed: false, value: 0 }; gp.tick(1 / 60); gp.tick(1 / 60);
      out[dir] = events.filter(([t]) => t === 'keydown').map(([, c]) => c);
    }
    gp.detach?.(); gp.dispose?.();
    return out;
  };
  const at = tap(true);
  for (const dir of ['up', 'down', 'left', 'right']) {
    assert.deepEqual(at[dir], [DPAD_CODES[dir]], `${dir}: its own code`);
    assert.ok(gambitBoardKey(DPAD_CODES[dir])?.startsWith('Arrow'), 'the board\'s cursor');
  }
  const away = tap(false);
  assert.notDeepEqual(away.up, [DPAD_CODES.up], 'away from the board the crossbar\'s d-pad keeps its world actions');
});

test('AUDIT KG II C5 THE LEAN UNDER A SHEET OVER THE WHOLE VIEW: no clear screen worth fitting (null) - the lean keeps the last, and never throws the eye away on a clear screen of no extent (mutants: the floor; the fallback)', () => {
  const box = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b, width: r - l, height: b - t });
  assert.equal(gambitClear(box(0, 36, 844, 390), { w: 844, h: 390 }, true), null, 'More\'s sheet on a landscape phone');
  assert.ok(gambitClear(box(591, 36, 844, 390), { w: 844, h: 390 }, true), 'the strip leaves a column');
  assert.ok(GAMBIT_CLEAR_MIN > 0 && GAMBIT_CLEAR_MIN < 0.2);
  const P = gambitPlaces(FRAME, FEET);
  const L = gambitLean(P, { aspect: 844 / 390, fovY: 1, clear: { x0: 0, x1: 0, y0: 0.2, y1: 1 } });
  const full = gambitLean(P, { aspect: 844 / 390, fovY: 1 });
  assert.ok(L.eye.every(Number.isFinite));
  assert.deepEqual(L.eye.map((x) => Math.round(x * 1e6)), full.eye.map((x) => Math.round(x * 1e6)), 'the whole view');
});

/** A regular's game on the seat, dealt (test/systems/kg3_host.test.js's rig, small). */
function dealt({ gold = 5000, touch = false } = {}) {
  let now = 0;
  const entity = { name: 'Ves', items: [], goldPieces: gold };
  const renderer = { createMesh: (m) => ({ m }), drawMesh() {}, destroyMesh() {}, uploadTexture() {}, releaseTexture() {} };
  const seed = [...Array(400).keys()].find((s) => tierFor(s).key === 'amateur');
  const g = openGambitTableGame({
    doc: fakeDoc(), renderer, entity, say() {}, holdCursor: () => () => true, relock() {},
    rand32: xorshift(7), now: () => now, day: () => 100, key: 'town:7', friendly: false, regulars: [{ name: 'Ana', seed, chair: 1 }],
    frame: FRAME, mySeatFeet: FEET, touch: () => touch, onHoldem() {}, onIliac() {}, onStand() {},
  });
  g.press('regular', 0); g.press('stake', 2); g.press('next'); g.press('autofill'); g.press('start');
  return { g, entity, tick: (ms) => { now += ms; g.frame(now); } };
}

test('AUDIT KG II C6 THE BEAT AFTER A FORFEIT: decided, nobody\'s turn - the result\'s title, no End turn, no Forfeit, nothing chosen or lit (mutants: decided)', () => {
  const r = dealt();
  const st = r.g.g.session.state;
  const p = st.pieces.find((x) => x.side === 0 && reachable(st, x).length);
  r.g.press('cell', [p.col, p.row]);
  assert.equal(r.g.g.selected, p.id);
  r.g.press('forfeit'); r.g.press('forfeit');
  assert.ok(r.g.g.session.over && !r.g.g.session.shown, 'decided, its result not yet shown');
  const m = gambitHudModel({ ...r.g.g.hud.last ?? {}, phase: 'battle', regulars: [], army: [], game: { state: r.g.g.session.state, crowns: r.g.g.game.crowns, name: 'Ana', stake: r.g.g.game.stake, over: null, decided: true, dealt: [7, 7] }, selected: p.id, info: null, crown: 'daggerfall' });
  assert.equal(m.title, 'The King\'s Gambit: the result');
  assert.equal(m.actions.find((a) => a.id === 'end').enabled, false);
  assert.equal(m.actions.find((a) => a.id === 'forfeit').enabled, false);
  assert.deepEqual(m.battle.lit, [], 'nothing lit');
  assert.equal(r.g.g.selected, null, 'the choice let go');
  r.tick(GAMBIT_RESULT_MS + 10);
  assert.equal(r.g.g.phase, 'over');
});

test('AUDIT KG II C7 THE CHOSEN CARD IS PRESSED WHERE IT IS DRAWN: its lifted top centimetre is its own cell, never the mat behind (mutants: the lift)', () => {
  const P = gambitPlaces(FRAME, FEET);
  const board = { tiles: new Array(KG_COLS * 13).fill(KG_TILE.floor), pieces: [{ id: 3, col: 7, row: 9 }] };
  const H = gambitCardHeight(P.cell);
  const o = P.at(7, 9), top = [o[0], P.top + GAMBIT_CARD_FOOT + GAMBIT_SELECT_LIFT + H - 0.002, o[2]];
  const eye = [o[0] - P.toHost[0] * 0.6, P.top + 0.35, o[2] - P.toHost[1] * 0.6];
  const d = top.map((x, i) => x - eye[i]), n = Math.hypot(...d), dir = d.map((x) => x / n);
  assert.deepEqual(gambitPressCell(P, board, eye, dir, 3), [7, 9], 'the chosen card, lifted');
  assert.notDeepEqual(gambitPressCell(P, board, eye, dir, null), [7, 9], 'unchosen, that height is over it');
});

test('AUDIT KG II C8 + D21 THE INFORMATION BOX: the foes in range by name, the piece\'s own cell\'s hazard (mutants: the names; the hazard line)', () => {
  const r = dealt();
  const st = structuredClone(r.g.g.session.state);
  st.tiles = st.tiles.map(() => KG_TILE.floor);
  st.hazards = [];
  const mine = st.pieces.find((x) => x.side === 0 && !x.king && !x.ranged);
  const foe = st.pieces.find((x) => x.side === 1 && !x.king);
  for (const x of st.pieces) if (x !== mine && x !== foe) { x.col = 0; x.row = 0; }
  st.pieces = st.pieces.filter((x) => x === mine || x === foe || x.king);
  mine.col = 7; mine.row = 6; foe.col = 7; foe.row = 5;
  for (const k of st.pieces.filter((x) => x.king)) { k.col = k.side ? 14 : 0; k.row = k.side ? 0 : 12; }
  st.hazards.push({ col: 7, row: 6, kind: 'fire', active: true });
  const crowns = ['daggerfall', 'wayrest'];
  const box = infoBox(st, { piece: mine.id }, crowns, 'Ana');
  assert.ok(box.lines.some((l) => /^In range now: .+\.$/.test(l)), box.lines.join(' | '));
  assert.ok(box.lines.some((l) => /^Fire: a piece that ends its turn here loses \d+ health\.$/.test(l)), 'its cell\'s hazard');
  assert.ok(!box.lines.some((l) => /reach now/.test(l)), 'range, a blow\'s word');
});

test('AUDIT KG II C13 + C14 THE PRESS: one\'s own piece pressed again stays chosen (the mod\'s OnCellClicked); a foe out of range lets it go (mutants: the toggle; the let-go; the foe\'s card)', () => {
  const r = dealt();
  const st = r.g.g.session.state;
  const p = st.pieces.find((x) => x.side === 0 && reachable(st, x).length);
  r.g.press('cell', [p.col, p.row]);
  r.g.press('cell', [p.col, p.row]);
  assert.equal(r.g.g.selected, p.id, 'chosen again, never let go by its own press');
  const far = st.pieces.find((x) => x.side === 1);
  r.g.press('cell', [far.col, far.row]);
  assert.equal(r.g.g.selected, null, 'a foe out of range lets it go');
  assert.equal(r.g.g.info.piece, far.id, 'and is shown');
  assert.match(readFileSync(new URL('../../src/scenes/gambitTableGame.js', import.meta.url), 'utf8'), /if \(how\.touch && pressed\?\.side !== 1\) \{/, 'a finger on a foe\'s card is that foe');
  assert.ok(pieceById(st, p.id));
});
