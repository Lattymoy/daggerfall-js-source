// SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482"): THE RELAY'S OWN FIGHTERS ON THE CLIENT -
// the field's frame folded with them (where each stands and walks, its vitality, its blow, its fall), their HUD's words
// (the guards standing, a revolt's Captain and rebels, its result and its Honours), the session's foes (a guard an
// attacker's, a rebel and the Captain a defender's; no heal reaches one; the Captain's fall and a fighter cut down said),
// and the screen's driver - its looks, its acts, its bodies and batches (bible/11-Multiplayer/Seats-Arc.md 7.5, 7.7, 19;
// src/net/siege/siegeLink.js, src/net/siege/siegeSession.js, src/scenes/siegeNpcs.js, src/scenes/world.js). `06-Systems/Online-Arc.md`
// SEAT2b part two (c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foldSiege, siegeNpcShown, siegeBarLines, siegeWorksLine, siegeSidesLine, siegeResultTitle, siegeHudModel, SIEGE_STATE_EMPTY, SIEGE_REVOLT_HONOUR } from '../../../src/net/siege/siegeLink.js';
import { createSiegeSession, SIEGE_SESSION_TEXT } from '../../../src/net/siege/siegeSession.js';
import { siegeRoomKey, SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { siegeNpcLook, siegeNpcAct, createSiegeNpcs, SIEGE_NPC_LOOKS, SIEGE_NPC_FALL_MS } from '../../../src/scenes/siegeNpcs.js';
import { enemyDisplayName } from '../../../src/characters/enemy/enemyBasics.js';

const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
const T = 1_800_000_000_000;
const M = SIEGE_UNITS_PER_M;
const SH = { name: 'The Silver Hand', tag: 'SH' }, EO = { name: 'Ebon Oath', tag: 'EO' };
const F = { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: T, e: T + 2_700_000, n: [2, 1, 0] };
const G = (id, o = {}) => [id, 1, 360, 360, 0, 0, 0, 0, 0, 0].map((v, i) => (o[i] !== undefined ? o[i] : v));
const REVOLT = { k: 'f', b: [], th: 0, s: T, e: T + 7_200_000, n: [0, 1, 0], v: 1, np: [['n0', 3, 400, 400, 0, 0, 0, 0, 0, 0], ...Array.from({ length: 12 }, (_, i) => [`n${i + 1}`, 2, 340, 340, 0, 0, 0, 0, 0, 0])] };
const siege = { seat: 'Wayrest', kind: 'siege', tier: 'crown', attacker: EO, defender: SH };
const revolt = { seat: 'Anticlere', kind: 'revolt', tier: 'palace', attacker: null, defender: SH };

test('SEAT2b part two (c) THE RELAY\'S OWN FOLDED: the frame\'s `np` kept as each one\'s place and walk (carried on at its pace from the frame\'s moment), its vitality and its blow; a blow on one moves its vitality and its flinch, its fall stops it where it stood; `v` a revolt (mutants: the fold; the walk; the hp; the fall)', () => {
  let s = foldSiege(SIEGE_STATE_EMPTY, { ...F, np: [G('n0', { 6: 10 * M, 9: T + 900 })] }, T);
  assert.deepEqual(s.npcs, [{ id: 'n0', kind: 'guard', hp: 360, max: 360, x: 0, z: 0, tx: 10 * M, tz: 0, at: T, down: false, atk: T + 900, hurtAt: -Infinity }]);
  assert.deepEqual(siegeNpcShown(s.npcs[0], T + 1000), [5 * M, 0], 'five metres a second');
  s = foldSiege(s, { k: 'hp', id: 'n0', h: 300, m: 360 }, T + 1000);
  assert.deepEqual([s.npcs[0].hp, s.npcs[0].hurtAt, s.npcs[0].down], [300, T + 1000, false]);
  s = foldSiege(s, { k: 'fell', id: 'n0', by: 'att-0001' }, T + 1200);
  assert.deepEqual([s.npcs[0].down, s.npcs[0].hp, s.npcs[0].x, s.npcs[0].tx, s.npcs[0].at, s.npcs[0].atk], [true, 0, 6 * M, 6 * M, T + 1200, 0]);
  assert.deepEqual(s.roll, {}, 'one of them is no fighter of the roll');
  assert.equal(foldSiege(SIEGE_STATE_EMPTY, REVOLT, T).revolt, true);
  assert.equal(foldSiege(foldSiege(SIEGE_STATE_EMPTY, REVOLT, T), F, T).revolt, false);
});

test('SEAT2b part two (c) THE HUD\'S WORDS: the guards standing on the works\' line; a revolt\'s bar the holder against the rising, the Captain\'s vitality and the rebels standing, one side counted; its result the revolt put down or standing; its card says it earns no Honours (mutants: each word)', () => {
  const s = foldSiege(SIEGE_STATE_EMPTY, { ...F, np: [G('n0'), G('n1', { 8: 1 })] }, T);
  assert.equal(siegeWorksLine(s), 'GUARDS 1 of 2 stand');
  let r = foldSiege(SIEGE_STATE_EMPTY, REVOLT, T);
  r = foldSiege(r, { k: 'fell', id: 'n5', by: 'def-0001' }, T);
  const bar = siegeBarLines(r, revolt, T + 60_000);
  assert.equal(bar[0], 'ANTICLERE   The Silver Hand <SH>   vs   THE RISING   1:59:00');
  assert.equal(bar[1], 'THE CAPTAIN 400 / 400    REBELS 11 of 12 stand');
  r = foldSiege(r, { k: 'fell', id: 'n0', by: 'def-0001' }, T);
  assert.equal(siegeBarLines(r, revolt, T)[1], 'THE CAPTAIN HAS FALLEN    REBELS 11 of 12 stand');
  r = foldSiege(r, { k: 'st', f: [['def-0001', 300, 320, 0, 2], ['def-0002', 0, 320, 1, 2]] }, T);
  assert.equal(siegeSidesLine(r, revolt), 'SH  1 up / 1 down');
  assert.equal(siegeResultTitle({ r: 'defend' }, revolt), 'THE SILVER HAND PUTS DOWN THE REVOLT AT ANTICLERE');
  assert.equal(siegeResultTitle({ r: 'attack' }, revolt), 'THE REVOLT STANDS - ANTICLERE IS LOST TO THE SILVER HAND');
  const card = siegeHudModel(foldSiege(r, { k: 'end', r: 'defend', a: 0 }, T), revolt, 'def-0001', T, { claimable: true }).card;
  assert.equal(card.honour, SIEGE_REVOLT_HONOUR);
  assert.equal(siegeResultTitle({ r: 'attack' }, siege), 'EBON OATH TAKES THE THRONE OF WAYREST', 'a siege\'s as it was');
});

test('SEAT2b part two (c) THE SESSION\'S FOES: a standing guard is an attacker\'s foe and never a defender\'s; a rebel and the Captain a defender\'s; a blow and a harmful cast on one leave, a heal never; the Captain\'s fall and a fighter cut down by one said (mutants: the sides; the down; the heal; the words)', async () => {
  const sent = [], said = [];
  const online = { id: 'me-00001', room: null, status: 'open', mintSiegePass: null, sendSiege: (f) => { sent.push(f); return true; } };
  let side = 'attack';
  const pass = async () => ({ ok: true, pass: 'v1.p.q', side, week: 20, window: Math.floor((T + 7_200_000) / 1000) });
  const make = async (sd, kind = 'siege') => {
    side = sd;
    const ses = createSiegeSession({ online, pass, nowMs: () => T, say: (t) => said.push(t), relayOk: () => true });
    ses.enter({ key: 5023, name: 'Wayrest' }, { kind, tier: 'crown' }, [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
    await Promise.resolve(); await Promise.resolve();
    return ses;
  };
  const room = siegeRoomKey(5023, 20);
  const att = await make('attack');
  att.onSiege({ ...F, np: [G('n0'), G('n1', { 8: 1 })] }, room);
  assert.deepEqual([att.isFoe('n0'), att.isFoe('n1'), att.isFoe('n7'), att.foes()], [true, false, false, ['n0']]);
  assert.equal(att.blow('n0', { w: 123, m: 9, d: 30, r: 0 }), true);
  assert.equal(att.cast('n0', 20), true);
  assert.equal(att.cast('n0', 20, true), false, 'no heal reaches one');
  assert.deepEqual(sent, [{ k: 'blow', to: 'n0', w: 123, m: 9, d: 30, r: 0 }, { k: 'cast', to: 'n0', d: 20, h: 0 }]);
  att.onSiege({ k: 'fell', id: 'me-00001', by: 'n0' }, room);
  assert.deepEqual(said.slice(-1), [SIEGE_SESSION_TEXT.struckBy('guard')]);
  const def = await make('defend');
  def.onSiege({ ...F, np: [G('n0')] }, room);
  assert.deepEqual([def.isFoe('n0'), def.blow('n0', { w: 1, m: 0, d: 1, r: 0 })], [false, false], 'a defender strikes no guard');
  const holder = await make('defend', 'revolt');
  holder.onSiege(REVOLT, room);
  assert.equal(holder.foes().length, 13);
  holder.onSiege({ k: 'fell', id: 'n0', by: 'me-00001' }, room);
  assert.deepEqual(said.slice(-1), [SIEGE_SESSION_TEXT.captainDown]);
  assert.equal(holder.foes().length, 12);
  const eye = await make('watch');
  eye.onSiege({ ...F, np: [G('n0')] }, room);
  assert.deepEqual([eye.isFoe('n0'), eye.foes()], [false, []]);
});

test('SEAT2b part two (c) THE SCREEN\'S DRIVER: a guard is the City Watch, the rebels a Rogue, a Barbarian and a Thief by turns, the Captain a Warrior drawn a fifth taller; its act a wind-up then a strike about its blow\'s landing, a flinch, a walk, an idle, a fall and then gone; its bodies where its walk has carried it, on the ground the scene finds, one a standing one; its batches for the town\'s pass (mutants: the looks; each act; the body; the batch)', async () => {
  assert.deepEqual([enemyDisplayName(SIEGE_NPC_LOOKS.guard.mobiles[0]), enemyDisplayName(SIEGE_NPC_LOOKS.captain.mobiles[0])], ['City Watch', 'Warrior']);
  assert.deepEqual(SIEGE_NPC_LOOKS.rebel.mobiles.map(enemyDisplayName), ['Rogue', 'Barbarian', 'Thief']);
  assert.deepEqual(['n1', 'n2', 'n3', 'n4'].map((id) => siegeNpcLook({ id, kind: 'rebel' }).mobile), [143, 138, 136, 143]);
  assert.equal(siegeNpcLook({ id: 'n0', kind: 'captain' }).scale, 1.2);
  const n = { id: 'n0', kind: 'guard', hp: 360, max: 360, x: 0, z: 0, tx: 0, tz: 0, at: T, down: false, atk: T + 1000, hurtAt: -Infinity };
  const look = { mobile: 146 };
  assert.deepEqual([siegeNpcAct(n, T + 100, look).act, siegeNpcAct(n, T + 1100, look).act, siegeNpcAct(n, T + 1700, look).act], ['windup', 'strike', 'idle']);
  assert.equal(siegeNpcAct({ ...n, atk: 0, hurtAt: T }, T + 100, look).act, 'flinch');
  assert.equal(siegeNpcAct({ ...n, atk: 0, tx: 20 * M }, T + 100, look).act, 'walk');
  assert.deepEqual([siegeNpcAct({ ...n, down: true }, T + 100, look).act, siegeNpcAct({ ...n, down: true }, T + SIEGE_NPC_FALL_MS, look).act], ['fall', 'gone']);
  const made = [];
  const renderer = { textures: new Set(), createBillboardBatch: (archive, record, size) => { const b = { archive, record, size, bounds: [0, 0, 0, 0] }; made.push(b); return b; }, destroyBillboardBatch: () => {} };
  const tex = { getFrameCount: () => 4, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ x: 0, y: 0 }) };
  const d = createSiegeNpcs({ renderer, getTexture: async () => tex, uploadRecordFrame: () => {}, cam: () => [0, 2, 10], toScene: (x, z) => [x / M, 7, z / M] });
  const npcs = [{ ...n, atk: 0, tx: 10 * M }, { ...n, id: 'n1', atk: 0, down: true, at: T }];
  d.frame(npcs, T + 1000);
  await new Promise((r) => setTimeout(r, 0));
  d.frame(npcs, T + 1000);
  assert.deepEqual(d.targets().map((t) => [t.id, t.feet]), [['n0', [5, 7, 0]]], 'the standing one alone, where its walk has carried it');
  assert.equal(d.body('n0').name, 'Town Guard');
  assert.equal(d.batches().length, 1, 'the fallen one gone from the pass');
  d.leave();
  assert.deepEqual(d.state(), { bodies: [], shown: 0, targets: 0 }, 'out of the battle: every body put away');
});

test('SEAT2b part two (c) THE HOST\'S SEAMS (scenes/world.js): the driver made with the session, its feet on the scene\'s ground; drawn in the siege\'s own room alone; its batches on the town\'s billboard pass; its bodies the arms\' (a foe\'s body found among them, a spell\'s mark by its own name) (mutants: each seam)', () => {
  assert.match(W, /siegeNpcs = createSiegeNpcs\(\{ renderer, getTexture, uploadRecordFrame, audio, cam: \(\) => cam\.pos,\s+toScene: \(x, z\) => \{ const q = onlineToScene\(\{ x, y: 0, z \}\); const y = heightAt\(q\[0\], q\[2\]\);/);
  assert.match(W, /if \(siegeNpcs\) \{ if \(inSiegeRoom\(\)\) siegeNpcs\.frame\(siegeSession\.npcs\(\), battleNowMs\(\)\); else siegeNpcs\.leave\(\); \}/);
  assert.match(W, /if \(siegeNpcs\) for \(const b of siegeNpcs\.batches\(\)\) allBatches\.push\(b\);/);
  assert.match(W, /const duelBody = \(peerId\) => \(peerId \? \(peersNear\(\)\?\.find\(\(x\) => x\.id === peerId\) \?\? siegeNpcs\?\.body\(peerId\) \?\? null\) : null\);/);
  assert.match(W, /name: b\.name \?\? peerName\(b\.id\) \?\? 'a foe'/);
});
