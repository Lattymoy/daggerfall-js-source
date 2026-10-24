// AUDIT EG V (2026-10-15, the Elite Gates arc's fifth audit; bible/11-Multiplayer/Elite-Gates.md sections 6.1, 6.3, 15,
// 16.3, 19 and 20) - FIX GROUP D ("net"), THE SCREEN'S HALF: the member's own client (scenes/eliteGates/egClient.js over a recording
// account door), the link's fold (net/eliteGates/egLink.js), the arch pool (scenes/eliteGates/egArch.js), the Spire's fight (scenes/eliteGates/egFight.js
// createEgFight over the real damage door, characters/playerEntity.js hurtPlayer), the spoils (systems/eliteGates/egSpoils.js) and the
// boards' window (ui/eliteGates/egBoardWindow.js) - every fixture the producers' own (the director's breach and its words through the
// wire, egAim's blows, the Panoply's own records, the service's answer's shape):
//   L4-3   AN ADMIT ORDER IS ASKED AGAIN NEAR ITS END: an order kept past half its minute is asked again before it is used,
//          and one the room refused is let go whole - the next answer asks, and in my hall it is asked again at once;
//   L4-4   A CALL TO ANOTHER BREACH NEVER WIPES THE BREACH I STAND IN: folded as the call alone while my breach lives;
//   L4-6   A STRANGER'S ARCH IS NO STONE TO ME: its site is its opener's word, so only its company stands its collider;
//   L8-1   THE SPIRE'S BLOWS ARE A FOE'S: the Panoply's Reprieve and Shed Skin answer a lord's blow landed through the
//          fight's real door, as they answer a blow the attack formula marks; a hazard's is no foe's;
//   L8-2   A PAID REDOUBT'S DEADLANDS EMBERS ARE IN ITS SPOILS, as many as the claim paid;
//   L8-5   THE SPOILS ROLL ON THE CLAIM'S SEED, a Redoubt's and an end's Reliquaries alike - never the receipt's own;
//   L8-9   THE DEPTHS' ROW NAMES ITS WAGER.
import '../../modsOff.js';
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { egHallOf, EG_TEXT, EG_SEALED_MS, EG_DECREES } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egEnd, egFightStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egAim } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { foldEg, createEgLink, egLiveHeld, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgClient, EG_ADMIT_FRESH_MS, EG_ADMIT_ASKS } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgArchPool, egArchBucket } from '../../../src/scenes/eliteGates/egArch.js';
import { signEgCall } from '../../../src/net/eliteGates/egCallSig.js';
import { ORDER_TTL_S } from '../../../src/net/identityToken.js';
import { egSpoilsList, egReliquaryGrant, egReliquaryList, egSpoilsSeedOf, egEmberStack } from '../../../src/systems/eliteGates/egSpoils.js';
import { egSpoilsSeed } from '../../../src/net/eliteGates/egPay.js';
import { isSigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { egBoardLines, EG_BOARD_TEXT } from '../../../src/ui/eliteGates/egBoardWindow.js';
import * as P from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { PANOPLY_SET_PIECES, mintAetheric } from '../../../src/systems/aetheric.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { setPref, _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY } from '../../../src/systems/loot/lootRarity.js';
import { readFileSync } from 'node:fs';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
});

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000, ME = 'acct-mac', Y = '0123456789abcdef', X = 'fedcba9876543210', SEED = 12345;
const SITE = { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 };
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const callOf = (b, op, o = 'Ann', os = 'acct-ann') => wire({ k: 'call', b, o, os, seed: 1, op, rh: 0, co: [[os, o, 1], [ME, 'Mac', 2]], site: SITE, ew: 0, wg: [], sg: 'A'.repeat(86) });

/** A breach of the director's, Mac and Ann its company, at hall `h`'s trial - `inMe` whether Mac is entered. */
function breach(b, { h = 2, inMe = true } = {}) {
  const co = [['acct-ann', 'Ann', 1], [ME, 'Mac', 2]];
  const B = egBreachNew({ b, ez: 'z'.repeat(20), s: 'acct-ann', o: 'Ann', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  let t = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-ann', 'o'.repeat(20), 20, t);
  if (inMe) egEnter(B, ME, 'p'.repeat(20), 20, t);
  // the hall woken by the director's own law (test/net/eliteGates/egz_legion.test.js breachAt's way): the company on its arrival plate
  const spec = egHallOf(SEED, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = t; B.cnt = { left: 1_800_000, at: t }; B.pulledAt = t; B.su = t + 30_000;
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const subs = inMe ? ['acct-ann', ME] : ['acct-ann'];
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) { t += 250; egStep(B, t, subs.map((sub, i) => ({ sub, sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z, dead: false, at: t })), rng); }
  assert.equal(B.sg, 'trial', 'the hall woke');
  return { B, t };
}

/** This screen's client (test/net/eliteGates/egaudit4_net_client.test.js's rig, and the Spire's): the account door records each admission
 *  asked and answers it when the test says; the room link records its words; the mode machine stands me in `st.hall`. */
function rig(t, { answer = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 1000;
  t.mock.method(Date, 'now', () => clock);
  const L = { said: [], asks: [], sent: [] };
  const st = { hall: null, mode: 'exterior' };
  const modes = { get mode() { return st.hall ? 'dungeon' : st.mode; }, stepping: false, egHallBreach: () => st.hall, egHallCircle: () => (st.hall ? 1 : null), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => go(), enterEgHall: () => true };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  let n = 0;
  const account = { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), admit: async (b) => { L.asks.push(b); return answer ? answer(b) : { ok: true, data: { order: `v1.admit.${++n}` } }; } };
  const entity = { level: 20, health: 100, maxHealth: 100, magicka: 0, maxMagicka: 10, fatigue: 0, stats: {}, items: [] };
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => ({ egOk: true, sendEg: () => true }), account, now: () => clock, entity,
    player: { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } }, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (s) => L.said.push(s), site: () => ({}), wire: () => SITE, landAt: () => true, hurt: () => {}, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    callPortal: { open: () => ({ at: [0, 0, 0] }), clear: () => {}, tick: () => {}, standing: () => false }, feet: () => [0, 0, 0] });
  return { client, L, st, online, step: (ms) => { clock += ms; }, now: () => clock };
}

// ── L4-3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-3 AN ADMIT ORDER IS ASKED AGAIN NEAR ITS END (sections 6.1 and 23 - an order lives ORDER_TTL_S): an answer within EG_ADMIT_FRESH_MS keeps the order (AUDIT EG IV lane4 #14\'s pin, re-judged: kept while young); past it the next answer asks the service again; an order the room refused (`the order is not yours` - a dead one) is let go whole and the next answer asks again, never "the road is shut" (mutants: the order kept past its half-life; the refused order\'s breach kept)', async (t) => {
  assert.equal(EG_ADMIT_FRESH_MS, ORDER_TTL_S * 500, 'half an order\'s life');
  const R = rig(t);
  R.client.word(callOf(Y, R.now() - EG_SEALED_MS - 1000), SOCIAL_ROOM);
  R.client.command(''); await settle();
  assert.equal(R.L.asks.length, 1, 'the admission asked');
  R.step(EG_ADMIT_FRESH_MS - 1000);
  R.client.command(''); await settle();
  assert.equal(R.L.asks.length, 1, 'young: kept');
  R.step(2000);
  R.client.command(''); await settle();
  assert.equal(R.L.asks.length, 2, 'past half its life: asked again');
  R.L.said.length = 0;
  R.client.word(wire({ k: 'no', m: 'the order is not yours' }), `eg:${Y}`);
  R.client.command(''); await settle();
  assert.equal(R.L.asks.length, 3, 'a refused order let go whole: the next answer asks');
  assert.ok(!R.L.said.includes(EG_TEXT.shut), 'never "the road is shut"');
});

test('AUDIT EG V L4-3 IN MY HALL, A DEAD ORDER IS ASKED AGAIN (section 6.1, "The member\'s hello to eg:<b> carries the order"): a member who stepped in under the veil after its order grew old (the room counts it not yet) asks the service again and says the fresh one to the room - never the dead one; a refusal by the room asks once more in silence; at most EG_ADMIT_ASKS asks a breach (mutants: the old order said; no ask in the hall; asks unbounded)', async (t) => {
  const R = rig(t);
  R.client.word(callOf(Y, R.now() - EG_SEALED_MS - 1000), SOCIAL_ROOM);
  R.client.command(''); await settle();
  assert.equal(R.L.asks.length, 1);
  R.step(EG_ADMIT_FRESH_MS + 5000);   // a slow step under the veil - the room's first word comes now
  R.st.hall = Y;
  const { B } = breach(Y, { inMe: false });
  R.client.word(wire(egStateOf(B, R.now())), `eg:${Y}`);
  R.client.frame(); await settle();
  assert.equal(R.L.asks.length, 2, 'the old order asked again in the hall');
  assert.ok(!R.L.sent.some((f) => f.k === 'in' && f.z === 'v1.admit.1'), 'the dead order never said');
  R.client.frame(); await settle();
  assert.deepEqual(R.L.sent.filter((f) => f.k === 'in').map((f) => f.z), ['v1.admit.2'], 'the fresh one said, once');
  R.L.said.length = 0;
  R.client.word(wire({ k: 'no', m: 'the order is not yours' }), `eg:${Y}`);
  assert.deepEqual(R.L.said, [], 'refused: nothing said while it is asked again');
  R.client.frame(); await settle(); R.client.frame(); await settle();
  assert.equal(R.L.asks.length, 3);
  assert.deepEqual(R.L.sent.filter((f) => f.k === 'in').map((f) => f.z), ['v1.admit.2', 'v1.admit.3']);
  R.client.word(wire({ k: 'no', m: 'the order is not yours' }), `eg:${Y}`);
  for (let k = 0; k < 4; k++) { R.client.frame(); await settle(); }
  assert.equal(R.L.asks.length, 1 + EG_ADMIT_ASKS, 'at most EG_ADMIT_ASKS in the hall');
  R.client.word(wire({ k: 'no', m: 'the order is not yours' }), `eg:${Y}`);
  for (let k = 0; k < 4; k++) { R.client.frame(); await settle(); }
  assert.equal(R.L.asks.length, 1 + EG_ADMIT_ASKS, 'refused again past the bound: no more asked');
  assert.ok(R.L.said.includes('The order is not yours.'), 'and the refusal said, the asks spent');
});

// ── L4-4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V D NEW-4 THE ASKS ARE THE ONE BREACH\'S (section 6.1): the asks my hall makes of the service are counted for the breach I stand in alone - the next breach begins its own EG_ADMIT_ASKS, and the count is never a record of every breach a session stood in (mutant: the count carried into the next breach)', async (t) => {
  const R = rig(t, { answer: () => ({ ok: false, error: 'the breach is closed' }) });
  for (const b of [Y, X]) {
    R.st.hall = b;
    const { B } = breach(b, { inMe: false });
    R.client.word(wire(egStateOf(B, R.now())), `eg:${b}`);
    for (let k = 0; k < EG_ADMIT_ASKS + 2; k++) { R.client.frame(); await settle(); }
    assert.equal(R.L.asks.filter((a) => a === b).length, EG_ADMIT_ASKS, `${b}: its own EG_ADMIT_ASKS, then none`);
  }
});

test('AUDIT EG V L4-4 A CALL TO ANOTHER BREACH NEVER WIPES THE ONE I STAND IN (section 6.1, "one breach at a time"): my screen holds breach Y\'s trial (its room\'s words - the director\'s state and its whole fight); the hub calls me into X (the opener\'s whole frozen company) - Y, its hall, its stage, its company and its fight stand, X\'s call kept beside them; Y\'s next word keeps it; once Y ends, a call replaces the state, and leaving it stands the kept call for its answer (mutants: the call\'s fold unchanged; the live test reading the call)', () => {
  const { B, t } = breach(Y);
  const spec = egHallOf(SEED, 2, 0);
  egAim(B.F, spec, { o: 0, s: [shDisc(0, 30, 3)], at: t + 9000, wu: 3000, p: 0.2, b: 0, el: null, nm: 'Test Blow' }, [], t + 2000, []);
  let s = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, t + 2000)), t + 2000);
  s = foldEg(s, wire(egFightStateOf(B, t + 2000)), t + 2000);
  const held = { b: s.b, h: s.h, sg: s.sg, co: s.co.length, bodies: s.fight.bodies.length, blows: s.fight.blows.length };
  assert.ok(egLiveHeld(s) && held.bodies > 0 && held.blows > 0, 'the trial held');
  // a call over a call (no room has spoken): the newer breach's call starts its state, as before
  const Z = '00000000000000aa';
  assert.equal(foldEg(foldEg(EG_STATE_EMPTY, callOf(X, t), t), callOf(Z, t), t).b, Z, 'a call replaces a call');
  s = foldEg(s, callOf(X, t), t + 2100);
  assert.deepEqual({ b: s.b, h: s.h, sg: s.sg, co: s.co.length, bodies: s.fight.bodies.length, blows: s.fight.blows.length }, held, 'Y stands');
  assert.equal(s.call.b, X, 'X\'s call kept beside it');
  s = foldEg(s, wire(egStateOf(B, t + 3000)), t + 3000);
  assert.equal(s.call?.b, X, 'Y\'s next word keeps it');
  // Y ends: its end said, a call replaces the state
  const out = [];
  egEnd(B, 'tear', t + 4000, out);
  for (const f of out.filter((f) => f.k === 'end' || f.k === 'st')) s = foldEg(s, wire(f), t + 4000);
  assert.equal(egLiveHeld(s), false, 'ended');
  assert.equal(foldEg(s, callOf(X, t), t + 4100).b, X, 'a call over an ended breach starts X\'s state');
  // the link: leaving Y stands X's call for its answer
  const link = createEgLink({ now: () => t + 5000 });
  link.word(wire(egStateOf(breach(Y).B, t)));
  link.word(callOf(X, t));
  assert.equal(link.state().b, Y);
  link.clear();
  assert.deepEqual([link.state().b, link.state().call.b], [X, X], 'out of Y: X\'s call to answer');
});

// ── L4-6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L4-6 A STRANGER\'S ARCH IS NO STONE TO ME (section 6.3, "How peers see it" - the site is its opener\'s word): the company\'s own arch, from the hub\'s call, stands its collider; a stranger\'s arch heard on the cell, its signature good, is drawn and pressed but stands none - and never sets my feet down out of it (mutant: every arch\'s stone stood)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  let clock = T0;
  const col = { adds: [] }, lands = [];
  const pool = createEgArchPool({
    renderer: { createMesh: (m) => ({ m }), uploadTexture() {}, uploadEmissionTexture() {}, drawMesh() {} },
    collider: () => ({ addMesh: (k) => col.adds.push(k), removeBucket() {} }),
    pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: () => clock, feet: () => [100, 0, 400], me: () => ME,
    landAt: (l) => { lands.push(l); return true; }, verifyKey: async () => kp.publicKey,
  });
  const site = { px: 300, py: 200, x: 409.6, y: 0, z: 380, yaw: 0 };
  pool.call({ b: Y, o: 'Mac', os: ME, op: T0, ew: 0, site, co: [[ME, 'Mac', 1]], sg: await signEgCall({ b: Y, o: 'Mac', os: ME, op: T0, ew: 0, site }, kp.privateKey, { subtle }) });
  const there = { ...site, x: 100, z: 400 };   // a stranger's arch said where I stand
  const word = { b: X, o: 'Tor', os: 'acct-tor', op: T0, ew: 0, site: there, sg: await signEgCall({ b: X, o: 'Tor', os: 'acct-tor', op: T0, ew: 0, site: there }, kp.privateKey, { subtle }) };
  assert.equal(await pool.heard('peer-tor', word, [100, 0, 395]), true, 'believed: its signature is good');
  clock = T0 + 30_000;
  pool.frame(0.016);
  assert.ok(pool.arches.get(X).place?.risen, 'the stranger\'s arch stands risen, drawn');
  assert.deepEqual(col.adds, [egArchBucket(Y)], 'my company\'s stone alone');
  assert.deepEqual(lands, [], 'my feet never set down out of a stranger\'s arch');
});

// ── L8-1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The breach's fight on my screen (scenes/eliteGates/egFight.js createEgFight): the director's whole fight and a blow of egAim's at my
 *  feet, `p` its share, `el` its element; the strike door the dungeon context's own (strikePlayer: the damage door,
 *  characters/playerEntity.js hurtPlayer). `place` none: seed 12345's Hall 1, the Rift-Yard, whose floor no hazard of the
 *  place reaches; else Hall 2's cave and its Falling Basalt, and no blow - the place's alone. Answers what struck me. */
function struck(entity, { p = 0.85, el = null, place = false } = {}) {
  const h = place ? 2 : 1, { B, t } = breach(Y, { h });
  const spec = egHallOf(SEED, h, 0), floor = spec.fl[0], cx = place ? 0 : floor.x, cz = place ? (floor.az + floor.bz) / 2 : floor.z;
  assert.equal(!!(spec.hazards ?? []).length, place);
  const at = t + 3000;
  const out = [], hits = [];
  B.F.blows.length = 0;   // the legion's own blows elsewhere (test/net/eliteGates/egaudit3_client_fight.test.js struckBy's way): this one alone
  if (!place) assert.ok(egAim(B.F, spec, { o: 0, s: [shDisc(cx, cz, 3)], at, wu: 1500, p, b: 0, el, nm: 'Test Blow' }, [], at - 1500, out));
  let E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, at - 1500)), at - 1500);
  E = foldEg(E, wire(egFightStateOf(B, at - 1500)), at - 1500);
  for (const f of out) E = foldEg(E, wire(f), at - 1500);
  let now = at - 1300;
  const fight = createEgFight({ link: { state: () => E, now: () => now }, now: () => now, player: () => entity, me: () => ME,
    strike: (d, how) => { hits.push(how?.name); hurtPlayer(entity, d); },   // dungeonContext.js strikePlayer's own door: hurtEntity(playerEntity, dmg)
    feet: () => realmToDungeon(spec.x0 + cx, 0, cz) });
  for (; now < at; now += 100) fight.frame();
  now = at; fight.frame();
  now = at + 500; fight.frame();
  return hits;
}
const bodyOf = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100) });
function wearing(wear) {
  _resetSigilForTests(); _resetSigilSetsForTests(); P._resetSetPowersForTests(); _resetPlayerHealForTests(); resetPrefs(); setPref(LOOT_RARITY_KEY, false);
  let T = 0; P._setSetPowersClockForTests(() => T); void T;
  const said = [];
  P.setSetPowersVoice({ say: (l) => said.push(l), sound: () => {} });
  setSigilOnline(true); setSigilRenown(1);
  const e = bodyOf();
  wear(e);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
  P.setSpireRecovery(() => Y);
  return { e, said };
}
const panoply = (e) => { for (const r of PANOPLY_SET_PIECES.slice(0, 6)) { const it = mintAetheric(r); e.items.push(it); equipItem(e, it); } };
const coilscale = (e) => { for (const tpl of [107, 106, 105, 102, 103, 104]) { const it = mintCondition({ group: 'Armor', templateIndex: tpl, material: ARMOR_MATERIAL.Steel, flags: 0 }); it.rarity = 'rare'; it.sigil = { set: 'coilscale', party: 1, xp: 0 }; e.items.push(it); equipItem(e, it); } };

test('AUDIT EG V L8-1 THE SPIRE\'S BLOWS ARE A FOE\'S (section 15\'s death saves; Sigil-Sets.md 6e): six of the Panoply\'s own records worn, a lord\'s blow landed through the fight\'s real door (createEgFight\'s landShare -> the dungeon context\'s strike -> the damage door) taking me under 20% raises Battlemage\'s Reprieve; Sethrakul\'s Coilscale\'s Shed Skin answers the same blow; a blow no foe dealt (a fall\'s, a hazard\'s - unmarked) raises neither (mutants: the blow unmarked; the mark read by no save; the mark lying for the next hurt)', () => {
  let w = wearing(panoply);
  assert.deepEqual(struck(w.e), ['Test Blow']);
  assert.equal(w.e.health, 15, 'struck under the line, standing');
  assert.equal(P.setPowerStates(0).reprieve, 15, 'the Reprieve\'s shield raised');
  assert.deepEqual(w.said, ["Battlemage's Reprieve! A 15-point shield."]);
  w = wearing(coilscale);
  struck(w.e, { p: 0.7 });
  assert.equal(w.e.health, 40, 'Shed Skin heals 10%');
  assert.deepEqual(w.said.slice(-1), ['Shed Skin! 10 health returns.']);
  // a hurt no foe dealt in the Spire: neither - the place's own (a hazard through the same door), a fall's
  w = wearing(panoply);
  w.e.health = 30;
  assert.ok(struck(w.e, { place: true }).includes('Falling Basalt'), 'the place struck me');
  assert.ok(w.e.health < 20 && w.e.health > 0, `under the line by the place\'s hazard (${w.e.health})`);
  assert.equal(P.setPowerStates(0).reprieve, 0, 'a hazard is no foe: no Reprieve');
  w = wearing(panoply);
  hurtPlayer(w.e, 85);
  assert.equal(P.setPowerStates(0).reprieve, 0, 'an unmarked hurt raises nothing');
  // every body's blow the screen lands is marked - mine, and my part of a chained mate's (Morvayn's soul-chain)
  const src = readFileSync(new URL('../../../src/scenes/eliteGates/egFight.js', import.meta.url), 'utf8');
  const blows = src.match(/landShare\(bl\.p, bl\.b, bl\.el, bl\.nm, [^;]*?\)(?=[;\s])/g) ?? [];
  assert.equal(blows.length, 2, 'two doors a body\'s blow lands by');
  for (const call of blows) assert.match(call, /, true\)$/, `a foe's blow: ${call}`);
  assert.equal((src.match(/landShare\([^)]*\)/g) ?? []).filter((c) => !c.startsWith('landShare(bl.')).filter((c) => /, true\)$/.test(c)).length, 0, 'no hazard, zone or drain marked');
  // the mark is the blow's alone: one set and never taken lies past BLOW_WINDOW_S
  w = wearing(panoply);
  P.setSpireStruck();
  P._setSetPowersClockForTests(() => 5);
  hurtPlayer(w.e, 85);
  assert.equal(P.setPowerStates(5).reprieve, 0, 'a stale mark is nobody\'s');
});

// ── L8-2 / L8-5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-2 / L8-5 THE SPOILS A CLAIM PAYS (sections 16.1, 16.3 and 19): a paid Redoubt\'s spoils carry one stack of Deadlands Embers as many as the claim\'s `embers` (the gate\'s own stone, the Broker\'s currency), thrown last - none for none, none for a Redoubt that pays its gold alone; every roll is on the seed the claim answered (`seed` - the receipt\'s mixed with the service\'s draw), a Redoubt\'s and an end\'s Reliquaries alike, never the receipt\'s own `c` (mutants: no embers thrown; the embers on gold alone; the receipt\'s seed rolled)', () => {
  const c = { q: 'w', b: Y, s: ME, w: 10, h: 50, c: 4242, l: 20 };
  const d = { recorded: true, paid: true, embers: 3, seed: egSpoilsSeed(4242, '00112233445566ff'), pity: [] };
  assert.equal(egSpoilsSeedOf(c, d), d.seed, 'the claim\'s seed');
  assert.notEqual(d.seed, c.c);
  const list = egSpoilsList(egSpoilsSeedOf(c, d), c.l, c.w, { embers: d.embers });
  const last = list.at(-1);
  assert.ok(isSigilStone(last.item), 'the embers last');
  assert.deepEqual([last.item.stackCount, last.tier], [3, 'artifact']);
  assert.deepEqual(list.slice(0, -1).map((q) => q.kind), egSpoilsList(d.seed, c.l, c.w).map((q) => q.kind), 'every other piece what its seed gives');
  assert.ok(!egSpoilsList(d.seed, c.l, c.w, { embers: 0 }).some((q) => isSigilStone(q.item)), 'none for none');
  assert.ok(!egSpoilsList(d.seed, c.l, c.w, { embers: 3, goldOnly: true }).some((q) => isSigilStone(q.item)), 'a Redoubt that pays its gold alone pays no embers');
  assert.equal(egEmberStack(-1), null);
  assert.equal(egSpoilsSeedOf(c, { why: 'guest' }), 4242, 'a guest\'s gold: the receipt\'s own (no row, no seed)');
  // an end's Reliquaries on the claim's seed
  const x = { q: 'x', b: Y, s: ME, c: 777, l: 20 };
  const dx = { rl: [1, 2], seed: egSpoilsSeed(777, 'ffeeddccbbaa0011') };
  const g = egReliquaryGrant(x, dx, 20);
  assert.deepEqual(g.roll().map((q) => q.kind), egReliquaryList(dx.seed, 20, [1, 2]).map((q) => q.kind));
  assert.deepEqual(JSON.stringify(g.roll().map((q) => q.item?.name ?? q.gold)), JSON.stringify(egReliquaryList(dx.seed, 20, [1, 2]).map((q) => q.item?.name ?? q.gold)), 'the claim\'s seed rolled');
  assert.notDeepEqual(JSON.stringify(g.roll().map((q) => q.gold ?? 0)), JSON.stringify(egReliquaryList(777, 20, [1, 2]).map((q) => q.gold ?? 0)), 'never the receipt\'s own');
  // the host's half (scenes/world.js egSpoilsPaid): the claim's seed and its embers into the Redoubt's spoils
  const host = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  const fn = host.slice(host.indexOf('function egSpoilsPaid(c, d) {'), host.indexOf('function egSpoilsPaid(c, d) {') + 2200);
  assert.match(fn, /embers: Number\.isSafeInteger\(d\?\.embers\) \? d\.embers : 0 \}/, 'the embers the claim paid');
  assert.match(fn, /const seed = egSpoilsSeedOf\(c, d\), day = egSpoilsDay\(c\.b, c\.w\), roll = \(\) => egSpoilsList\(seed, level, c\.w, o\);/, 'rolled on the claim\'s seed');
  assert.match(fn, /sdSpoilsPool\.spew\(\{ day, seed, level,/, 'thrown on it');
});

// ── L8-9 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L8-9 THE DEPTHS\' ROW NAMES ITS WAGER (sections 18 and 20 - "with its Wager shown on the row"): the service\'s row carries the Wager\'s decrees (`wg`), the window names each; a row whose end kept none says it was wagered; an unwagered row says nothing of it (mutants: the decrees unnamed; the flag said over the names)', () => {
  const board = { season: { n: 3, day: 2 }, depths: { rows: [
    { rank: 1, name: 'Mac', h: 47, ew: 10, wagered: true, wg: [0, 9] },
    { rank: 2, name: 'Ann', h: 31, ew: 0, wagered: true, wg: [] },
    { rank: 3, name: 'Bob', h: 20, ew: 0, wagered: false, wg: [] },
  ] } };
  const lines = egBoardLines(board, 'depths');
  assert.equal(lines[2], `1. Mac - Hall 47 from Redoubt 10 - ${EG_TEXT.wager(`${EG_DECREES[0].name}, ${EG_DECREES[9].name}`)}`);
  assert.equal(lines[2], '1. Mac - Hall 47 from Redoubt 10 - The Wager: Chained Blows, Ashfall', 'the start window\'s own words');
  assert.equal(lines[3], `2. Ann - Hall 31 - ${EG_BOARD_TEXT.wagered}`);
  assert.equal(lines[4], '3. Bob - Hall 20');
});
