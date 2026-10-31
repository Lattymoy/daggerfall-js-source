// AUDIT POTION-MIGHT (2026-10-31, the owner: "Audit this", of POTION-CLOCK and EG-MIGHT; bible/01-Overview/audits/
// Audit-Potion-Might.md): the findings the cold lanes proved, each pinned where it was fixed.
//   C1 - a bottle that lands whole is every kind it carries: a Purification heals as Heal True does, on the health clock;
//   C2 - a health potion drunk in a breach is told to its room (`pot`), which believes its heal on its own 15 s clock,
//        outside the member's own budget - a Heal True every 15 s had outrun the count's line, and the relay felled members
//        whose screens said they stood.
//   B2 - an Elite Breach's stand-ins stand at its own whole (9,750); every other one at 975, so a bout's spell fits 10,000;
//   B3 - the receipt's share and a hall's part judge damage at the reference, so a bare member of a geared company earns;
//   B5 - the Spire's spell number reads my token's might beside my Vestiges, as the room grows my purse;
//   B6 - the relay half run through the real Room: a token's might reaches the member, kept from its first entry.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerMadeLevelHere } from '../../../src/systems/madeLevel.js';
import { registerSpirePotionTold } from '../../../src/systems/eliteGates/spireKit.js';
import { potionKindsOf, pvpPotionKind, pvpPotionRefusal, pvpPotionDrunk, setPvpFight, resetPvpPotions, PVP_POTION_MS } from '../../../src/combat/pvpPotions.js';
import { pendingDeclares, resetPvpDeclares } from '../../../src/combat/pvpDeclare.js';
import { POTION_RECIPES, potionRecipeKey } from '../../../src/systems/potionRecipes.js';
import { egBreachNew, egEnter, egPotion, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { bodyStruck, BODY_DEFAULT } from '../../../src/net/bossBody.js';
import { healRef } from '../../../src/net/gate/gateBrain.js';
import { potionHealAt, PVP_VITALS } from '../../../src/net/wild/pvpVitals.js';
import { validEgIn, EG_POT_RELAY_MIN, relaySupportsEgPot } from '../../../src/net/wire.js';
import { EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';

const key = (name) => potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients);
const bottle = (name) => ({ potionRecipeKey: key(name) });
const clean = () => { resetPvpPotions(); resetPvpDeclares(); setPvpFight(false); registerMadeLevelHere(null); registerSpirePotionTold(null); };

test('AUDIT POTION-MIGHT C1: where a bottle lands whole it is every kind it carries - a Purification is a health potion and an other one, so it waits on a Heal True and a Heal True on it; in a fight, where its first effect lands alone, it is that one kind (mutants: the first effect\'s kind everywhere; one kind\'s clock started)', () => {
  clean();
  assert.deepEqual(potionKindsOf(bottle('purification'), true), ['health', 'other']);
  assert.deepEqual(potionKindsOf(bottle('purification'), false), ['other'], 'its first effect, Cure Disease');
  assert.equal(pvpPotionKind(bottle('purification')), 'other');
  assert.deepEqual(potionKindsOf(bottle('healTrue'), true), ['health']);
  registerMadeLevelHere(() => 'spire');
  try {
    const t0 = 5_000_000;
    pvpPotionDrunk(bottle('healTrue'), t0);
    assert.match(pvpPotionRefusal(bottle('purification'), t0 + 1000) ?? '', /health potion in 14 s/, 'a Purification waits on the health clock');
    resetPvpPotions();
    pvpPotionDrunk(bottle('purification'), t0);
    assert.match(pvpPotionRefusal(bottle('healTrue'), t0 + 1000) ?? '', /health potion in 14 s/, 'and a Heal True on it');
    assert.match(pvpPotionRefusal(bottle('levitation'), t0 + 1000) ?? '', /of this kind in 14 s/, 'its Cure Disease starts the other clock');
    assert.equal(pvpPotionRefusal(bottle('restorePower'), t0 + 1000), null, 'never the magicka one');
  } finally { clean(); }
  // in a fight its first effect lands alone, and it is that kind alone
  setPvpFight(true);
  try {
    pvpPotionDrunk(bottle('healTrue'), 7_000_000);
    assert.equal(pvpPotionRefusal(bottle('purification'), 7_000_100), null, 'a fight\'s Purification heals nothing, and waits on nothing of health');
  } finally { clean(); }
});

test('AUDIT POTION-MIGHT C2, THE CLIENT\'S HALF: a bottle drunk where potions are timed is told to the made level\'s door with its kinds; a fight\'s goes to the referee alone, and no door hears a bottle outside both (mutants: the door never told; the referee told from the Spire)', () => {
  clean();
  const told = [];
  registerSpirePotionTold((kinds) => told.push(kinds));
  try {
    pvpPotionDrunk(bottle('healTrue'), 1);
    assert.deepEqual(told, [], 'no clock, nothing told');
    registerMadeLevelHere(() => 'spire');
    pvpPotionDrunk(bottle('purification'), 2);
    pvpPotionDrunk(bottle('restorePower'), 3);
    assert.deepEqual(told, [['health', 'other'], ['magicka']]);
    assert.deepEqual(pendingDeclares(), [], 'no referee in a breach');
    registerMadeLevelHere(null);
    setPvpFight(true);
    pvpPotionDrunk(bottle('stamina'), 4);
    assert.deepEqual(told.length, 2, 'a fight\'s bottle is the referee\'s');
    assert.equal(pendingDeclares().length, 1);
  } finally { clean(); }
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
/** A breach of one at level `lv`, its member entered and counted alive. */
function member(lv = 45) {
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 1, op: T0, co: [['acct-0', 'M0', 1]], site: SITE, wg: [] });
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, T0 + EG_SEALED_MS + 100);
  return { B, m: B.mem['acct-0'], now: T0 + EG_SEALED_MS + 1000 };
}

test('AUDIT POTION-MIGHT C2, THE ROOM\'S HALF: a health potion\'s word is believed - the most a Heal True heals at the member\'s level, a share of its reference body - once in the clock\'s 15 s, outside the member\'s own budget; within the 15 s, or from a member not counted alive, nothing (mutants: the room\'s clock unkept; the heal out of the budget; a fallen member healed)', () => {
  const line = BODY_DEFAULT.body;
  assert.equal(PVP_VITALS.potionMs, PVP_POTION_MS, 'the room\'s clock is the client\'s');
  const { m, now } = member(45);
  bodyStruck(m, 0.9, now, line);
  const v0 = m.bd.v, budget0 = m.bd.m;
  const share = egPotion({ mem: { 'acct-0': m }, end: null }, 'acct-0', now + 10, line);
  assert.ok(Math.abs(share - potionHealAt(45) / healRef(45)) < 1e-9, `a Heal True at level 45 is ${potionHealAt(45)} of a reference ${healRef(45)}`);
  assert.equal(m.bd.v, 1, 'the count whole again');
  assert.ok(m.bd.m >= budget0 - 1e-9, 'the member\'s own budget untouched');
  assert.ok(m.bd.v > v0);
  bodyStruck(m, 0.5, now + 20, line);
  assert.equal(egPotion({ mem: { 'acct-0': m }, end: null }, 'acct-0', now + 10 + PVP_POTION_MS - 1, line), 0, 'within the room\'s 15 s: nothing');
  assert.ok(egPotion({ mem: { 'acct-0': m }, end: null }, 'acct-0', now + 10 + PVP_POTION_MS, line) > 0, 'at 15 s: believed again');
  m.alive = 0;
  assert.equal(egPotion({ mem: { 'acct-0': m }, end: null }, 'acct-0', now + 10 + 3 * PVP_POTION_MS, line), 0, 'a fallen member drinks nothing');
  // the wire and the relay
  assert.deepEqual(validEgIn({ k: 'pot' }), { k: 'pot' });
  assert.deepEqual([EG_POT_RELAY_MIN, relaySupportsEgPot('world297'), relaySupportsEgPot('world298')], [298, false, true]);
  const relay = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(relay, /if \(m\.k === 'pot'\) \{ egPotion\(B, a\.sub, now, this\._egLine\(\), EG_BODY_ENFORCE\); return; \}/);
});

// ---- lane B ----
import { bossStandIn, breachStandIn, STAND_IN_WHOLE, EG_STAND_IN_WHOLE, standInBlowCap } from '../../../src/world/gate/gateBoss.js';
import { countOnStandIn } from '../../../src/scenes/gate/standInSpell.js';
import { duelSpellOf } from '../../../src/combat/duelCombat.js';
import { buildCustomSpell } from '../../../src/systems/spell/spellMaker.js';
import { playerEntity } from '../../../src/characters/playerEntity.js';
import { validArenaIn } from '../../../src/net/arena/arenaLaw.js';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf } from '../../../src/net/eliteGates/egLaw.js';
import { egStep, egStateOf, egActiveIn, egHallDealt } from '../../../src/net/eliteGates/egBrain.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { EG_SEAM, EG_EARN_SHARE, egLordsFight } from '../../../src/net/eliteGates/egLords.js';
import { egRefDealt } from '../../../src/net/eliteGates/egMight.js';
import { dpsRef, HIT_CAP_X } from '../../../src/net/gate/gateBrain.js';
import { EG_BUCKET_X_MAX } from '../../../src/net/eliteGates/egVestige.js';
import { tokenMight } from '../../../src/net/online.js';

const SURE = () => 0.999;
const NOOP = () => {};
const disint = { type: 5, subType: 255, settings: { chanceBase: 100 } };
const harm = (lo) => ({ type: 4, subType: 0, settings: { magnitudeBaseLow: lo, magnitudeBaseHigh: lo, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 } });

test('AUDIT POTION-MIGHT B2: a refereed bout\'s rival stands at 975 again, so a Disintegrate beside a Damage Health effect claims under the bout\'s 10,000 and is carried; a stand-in of the Spire\'s stands at its own whole (mutants: one whole for both, grown; the Spire\'s at the gate\'s)', () => {
  assert.deepEqual([STAND_IN_WHOLE, EG_STAND_IN_WHOLE], [975, 9750]);
  const was = playerEntity.level;
  playerEntity.level = 30;
  try {
    const rival = bossStandIn({ mobile: 0 }, 'Your opponent');
    const sp = buildCustomSpell({ slots: [disint, harm(300)], rangeType: 1, element: 4, name: 'Unmaking' });
    const d = Math.max(0, Math.round(countOnStandIn(duelSpellOf(sp), rival, 30, playerEntity, SURE).dealt));
    assert.ok(d > STAND_IN_WHOLE && d < 10_000, `the claim ${d}`);
    assert.ok(validArenaIn({ k: 'hit', i: 'p1', d, r: 2, q: 1 }), 'the bout\'s wire carries it');
    const spire = breachStandIn(bossStandIn({ mobile: 0 }, 'a lord'));
    assert.deepEqual([spire.health, spire.maxHealth, spire.relayHealth], [EG_STAND_IN_WHOLE, EG_STAND_IN_WHOLE, true]);
    assert.equal(Math.round(countOnStandIn(duelSpellOf(buildCustomSpell({ slots: [disint], rangeType: 1, element: 4, name: 'D' })), spire, 30, playerEntity, SURE).dealt), EG_STAND_IN_WHOLE, 'a Disintegrate there counts the breach\'s whole');
  } finally { playerEntity.level = was; }
});

/** A first-circle hall of `kind` woken on the relay's brain, drawn by the real screen with a link that says my token's
 *  might is `mg`: the targets my blows meet, with and without my Vestiges (test/net/gate/fb1019f_standinwhole.test.js). */
async function breachTargets(kind, mg) {
  const ME = 'acct-0', seed = 12345;
  let h = 0;
  for (let k = 1; k <= 15 && !h; k++) if (egHallOf(seed, k, 0).kind === kind) h = k;
  const spec = egHallOf(seed, h, 0);
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = [[ME, 'M0', 30], ['acct-1', 'M1', 30]];
  let now = T0;
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: ME, o: 'M0', ew: 0, rh: 0, seed, op: now - EG_SEALED_MS - 1000, co, site: SITE, wg: [] });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now, sub === ME ? mg : null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const arrive = { x: spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  const pos = { [ME]: { sx: spec.x0 + arrive.x, z: arrive.z, y: arrive.y }, 'acct-1': { sx: spec.x0 + arrive.x + 0.5, z: arrive.z, y: arrive.y } };
  let E = { ...EG_STATE_EMPTY, b: B.b, seed: B.seed, geo: 0 };
  const tell = (w) => { if (!w || (w.to && w.to !== ME)) return; const v = validEgOut(JSON.parse(JSON.stringify(w))); if (v) E = foldEg(E, v, now); };
  const centre = egHallCentre(spec), feet = [centre[0] + arrive.x, centre[1] + arrive.y, centre[2] + arrive.z];
  const tex = (archive) => ({ archive, recordCount: 30, getFrameCount: () => 5, getSize: () => ({ width: 40, height: 80 }), getScale: () => ({ width: 0, height: 0 }) });
  const fight = createEgFight({ renderer: { textures: { has: () => true }, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: [0, 0, 0], bounds: [0, 0, 0, 1] }), destroyBillboardBatch: NOOP },
    link: { state: () => E, might: () => mg }, now: () => now, feet: () => feet, cam: () => [feet[0], feet[1] + 1.6, feet[2] - 6], player: () => ({ health: 100, maxHealth: 100 }), me: () => ME,
    getTexture: async (a) => tex(a), uploadRecordFrame: NOOP, strike: NOOP, save: () => 0, sendHit: () => true });
  for (let k = 0; k < 80; k++) {
    now += 250;
    for (const w of egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng)) tell(w);
    fight.frame(); await new Promise((r) => setImmediate(r)); fight.frame();
  }
  const T = [...fight.hostTargets()];
  const mine = () => { B.mem[ME].vs = [[16, 3], [5, 3]]; E = { ...E, ms: egStateOf(B, now).ms }; fight.frame(); return [...fight.hostTargets()]; };
  return { T, mine };
}

test('AUDIT POTION-MIGHT B2 + B5, ON THE REAL SCREEN: a hall\'s bodies and objects stand at the breach\'s whole, and the factor they say my blows grow by is my Vestiges\' times my token\'s might - so a spell\'s number on them says what the room lands (mutants: the screen\'s stand-ins at the gate\'s whole; my might unread)', async () => {
  for (const kind of ['yard', 'span']) {
    const { T, mine } = await breachTargets(kind, 400);
    assert.ok(T.length > 0, `${kind}: bodies my blows meet`);
    assert.deepEqual([...new Set(T.map((t) => t.entity.maxHealth))], [EG_STAND_IN_WHOLE], `${kind}: the breach's whole`);
    assert.deepEqual([...new Set(T.map((t) => t.entity.relayBlowX()))], [4], `${kind}: my might alone`);
    const V = mine();
    assert.deepEqual([...new Set(V.map((t) => t.entity.relayBlowX()))], [EG_BUCKET_X_MAX * 4], `${kind}: and my Vestiges`);
    assert.equal(standInBlowCap(V[0].entity, 30), HIT_CAP_X * dpsRef(30) * EG_BUCKET_X_MAX * 4, `${kind}: what one blow of mine lands`);
  }
  const { T } = await breachTargets('yard', null);
  assert.deepEqual([...new Set(T.map((t) => t.entity.relayBlowX()))], [1], 'no might signed: the gate\'s own');
  // the client's word of its might is its hello token's, read as the relay reads it
  const body = (c) => Buffer.from(JSON.stringify(c)).toString('base64url');
  assert.deepEqual([tokenMight(`v1.${body({ mg: 400 })}.sig`), tokenMight(`v1.${body({ mg: 5000 })}.sig`), tokenMight(`v1.${body({})}.sig`), tokenMight('junk'), tokenMight(null)], [400, null, null, null, null]);
});

test('AUDIT POTION-MIGHT B3: the Redoubt\'s receipt and a hall\'s part judge damage at the reference - a bare member among three at a might of 1000 dealt its even share, and earns; one who dealt a tenth of that does not (mutants: the receipt\'s raw damage; a hall\'s part raw)', () => {
  const co = [['a', { dc: 1000, mg: 1000, act: 0 }], ['b', { dc: 1000, mg: 1000, act: 0 }], ['c', { dc: 1000, mg: 1000, act: 0 }], ['bare', { dc: 100, mg: null, act: 0 }], ['idle', { dc: 10, mg: null, act: 0 }],
    ['light', { dc: 300, mg: 1000, act: 0 }]];
  assert.equal(egRefDealt(1000, 1000), 100);
  const f = egLordsFight({ mem: { lordsFell: 1 } }, null, { co }, 0);
  assert.deepEqual(co.map(([sub]) => EG_SEAM.earned(f, sub)), [true, true, true, true, false, false], 'the bare member earns; the idle one does not, nor a geared one whose 300 is 30 at the reference');
  assert.ok(100 < (co.reduce((t, [, m]) => t + m.dc, 0) * EG_EARN_SHARE) / co.length, 'raw, the bare member\'s 100 was under half an even share');
  // a hall's part: at the reference, even; a tenth of it, not
  const mem = (dh, mg) => ({ in: 1, dh, mg, hh: 0, erH: 0 });
  const dealt = egHallDealt({ a: mem(1000, 1000), b: mem(1000, 1000), c: mem(1000, 1000), bare: mem(100, null), out: { ...mem(5000, null), in: 0 } });
  assert.equal(dealt, 3 * egRefDealt(1000, 1000) + 100, 'the hall\'s damage at the reference, an entered member\'s alone');
  assert.equal(egActiveIn(mem(100, null), { h: 1, n: 4, dealt, took: 0, crossed: false }), true);
  assert.equal(egActiveIn(mem(10, null), { h: 1, n: 4, dealt, took: 0, crossed: false }), false);
  assert.equal(egActiveIn(mem(100, 1000), { h: 1, n: 4, dealt, took: 0, crossed: false }), false, 'a geared member\'s 100 is 10 at the reference');
});

// ---- B6: the relay half through the real Room (test/fakeRoom.mjs, its token builder carrying `mg` now) ----
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, EG_KEY } from '../../../src/net/wire.js';
import { egRoomKey } from '../../../src/net/eliteGates/egLaw.js';
import { mintEgOrder } from '../../../src/net/identityToken.js';
import { BUCKET_DEPTH_X } from '../../../src/net/gate/gateBrain.js';

test('AUDIT POTION-MIGHT B6 + B1 + C2, THROUGH THE REAL ROOM: a breach socket\'s token signs a might of 400 beside its realm character - the member enters with it, its purse full at its depth; a new socket on a token of 1000 enters again and keeps 400; a `pot` is believed once in 15 s (mutants: the hello\'s might dropped; the admission ignoring it)', async () => {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const warn = console.warn; console.warn = () => {};
  try {
    const world = fakeRooms({ now: () => clock });
    const hub = world.room(SOCIAL_ROOM);
    const mac = hub.connect(); await hub.hello(mac, 'peer-mac', null, { name: 'Mac', acct: 'acct-mac', asecret: 'secret-of-acct-mac', kind: 'linked' });
    const { subtle } = globalThis.crypto;
    const order = await mintEgOrder({ o: 'egopen', s: 'acct-mac', eb: '0123456789abcdef', ez: 'z'.repeat(20) }, (await hub.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
    await hub.raw(mac, JSON.stringify({ t: 'eg', k: 'open', z: order, site: { px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 } }));
    const eg = world.room(egRoomKey('0123456789abcdef'));
    clock += EG_SEALED_MS + 1000;
    const admit = async (ez) => mintEgOrder({ o: 'egadmit', s: 'acct-mac', eb: '0123456789abcdef', ez }, (await eg.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
    const char = { kind: 'linked', tokenSub: 'acct-mac', charLevel: 20, rc: 1, ci: 'r0123456789abcdef0123' };
    const ws = eg.connect(); await eg.hello(ws, 'peer-mac', null, { ...char, mg: 400 });
    assert.equal(ws.closed, null);
    await eg.raw(ws, JSON.stringify({ t: 'eg', k: 'in', z: await admit('a'.repeat(20)), lv: 20, bv: 2 }));
    const m = () => eg.room._eg.mem['acct-mac'];
    assert.deepEqual([m().in, m().mg, m().bucket], [1, 400, BUCKET_DEPTH_X * dpsRef(20) * 4], 'the token\'s might, the purse at its depth');
    assert.equal(eg.store.get(EG_KEY).mem['acct-mac'].mg, 400, 'kept on the record');
    const again = eg.connect(); await eg.hello(again, 'peer-mac', null, { ...char, mg: 1000 });
    await eg.raw(again, JSON.stringify({ t: 'eg', k: 'in', z: await admit('b'.repeat(20)), lv: 20, bv: 2 }));
    assert.equal(m().mg, 400, 'a new socket\'s newer token: the first entry\'s might kept');
    // C2: the room hears a potion once in its 15 s
    bodyStruck(m(), 0.6, clock, BODY_DEFAULT.body);
    const v0 = m().bd.v;
    await eg.raw(again, JSON.stringify({ t: 'eg', k: 'pot' }));
    assert.ok(m().bd.v > v0 && m().pot === clock, 'believed');
    const v1 = m().bd.v;
    bodyStruck(m(), 0.3, clock, BODY_DEFAULT.body);
    const v2 = m().bd.v;
    await eg.raw(again, JSON.stringify({ t: 'eg', k: 'pot' }));
    assert.ok(v1 > v2 && m().bd.v === v2, 'within the 15 s: nothing');
  } finally { Date.now = realNow; console.warn = warn; }
});

// ---- D3: the might's own laws the first records left unpinned ----
import { egRaise, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_M_ID } from '../../../src/net/eliteGates/egVestige.js';
import { egPurseX } from '../../../src/net/eliteGates/egMight.js';
import { mightOf } from '../../../src/net/mightLaw.js';
import { potionWaits } from '../../../src/combat/pvpPotions.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { egGive8 } from '../../egGive8.mjs';
import { egSpecForget } from '../../../src/net/eliteGates/egLaw.js';

/** The Court of seed 12345's Hall 5 woken with `first` entered (each `[sub, mg]`) and its legion cleared - the shape
 *  test/net/eliteGates/egaudit3_legion_blows.test.js stands. */
function court5(first) {
  egGive8(12345, [1]);   // spec law 8's ground, as egaudit3's own (test/egGive8.mjs) - forgotten after each test
  let s = 12345;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = first.map(([sub], i) => [sub, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: co[0][0], o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [], pr: 'pyre' });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub, mg] of first) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now, mg);
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const here = new Set(first.map(([sub]) => sub));
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = (ms = 250) => { now += ms; return egStep(B, now, [...here].map((sub) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial');
  for (const sub of here) pos[sub] = { sx: spec.x0, z: 41 };
  step();
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  const blow = (sub, i, d, r) => { now += 300; return egBlow(B, sub, { k: 'hit', i, q: q++, d, r }, { sx: spec.x0, y: 0, z: 41 }, now); };
  return { B, step, blow, now: () => now };
}

test.afterEach(() => egSpecForget?.());
test('AUDIT POTION-MIGHT D3, SPILLOVER: a spell\'s carry past a felled add is held to the blow\'s cap and paid from the purse at the member\'s might, as the blow is (mutant: the host hits\' factor the Vestiges\' alone)', () => {
  const S = court5([['acct-0', 400]]);
  S.B.mem['acct-0'].mast = EG_M_ID.spillover;
  const [A] = egRaise(S.B.F, EG_ROLE.add, 0, [[0, 44]], 30, S.now(), []);
  const [X] = egRaise(S.B.F, EG_ROLE.add, 0, [[0, 47]], 50_000, S.now(), []);
  S.blow('acct-0', A.i, 1e6, HIT_KINDS.Spell);
  const want = HIT_CAP_X * dpsRef(40) * egPurseX(400) - 30;
  assert.ok(Math.abs(50_000 - X.hp - want) < 1e-6, `the carry at the might's cap (${50_000 - X.hp} of ${want})`);
});

test('AUDIT POTION-MIGHT D3, THE LAW\'S ROUNDING AND THE CLOCK\'S SECONDS: a might rounds to the nearest whole per cent and a price never lowers the rest; a kind\'s wait says its whole seconds up (mutants: floored; a price taken; the seconds rounded)', () => {
  assert.deepEqual([mightOf([0.6]), mightOf([0.4]), mightOf([50, -30])], [101, 100, 150]);
  clean();
  registerMadeLevelHere(() => 'spire');
  try {
    pvpPotionDrunk(bottle('healTrue'), 1_000_000);
    assert.deepEqual(potionWaits(1_000_000 + 600), [['health', 15]], '14.4 s left says 15');
  } finally { clean(); }
});

// ---- the client's wiring of C2 and B5 ----
import { createEgLink } from '../../../src/net/eliteGates/egLink.js';
import { OnlineSession } from '../../../src/net/online.js';

test('AUDIT POTION-MIGHT C2 + B5, THE CLIENT\'S WIRING: the breach\'s screen tells its room a health potion alone (`pot`, a relay that knows it); its link answers my might, the session\'s off the token my room\'s socket said hello on (mutants: another kind told; the link\'s might dropped; the session reading no token)', () => {
  const client = readFileSync(new URL('../../../src/scenes/eliteGates/egClient.js', import.meta.url), 'utf8');
  assert.match(client, /registerSpirePotionTold\(\(kinds\) => \{ const o = online\(\); if \(inSpire\(\) && o\?\.egPotOk && kinds\.includes\('health'\)\) o\.sendEg\?\.\('pot'\); \}\);/);
  assert.match(client, /createEgLink\(\{ now, say, onReceipt: \(r\) => claimAdd\(r\), onRefused: \(w\) => refused\(w\), might: \(\) => online\(\)\?\.might \?\? null \}\)/);
  assert.equal(createEgLink({ now: () => 0, might: () => 640 }).might(), 640);
  assert.equal(createEgLink({ now: () => 0 }).might(), null);
  const ws = {}, body = Buffer.from(JSON.stringify({ mg: 640 })).toString('base64url');
  const get = /** @type {any} */ (Object.getOwnPropertyDescriptor(OnlineSession.prototype, 'might')).get;
  assert.equal(get.call({ _ws: ws, _helloTok: new Map([[ws, `v1.${body}.sig`]]) }), 640);
  assert.equal(get.call({ _ws: null, _helloTok: new Map() }), null);
});

// ---- C6: the tile's seconds, plural-aware where a language's numbers ask it ----
import * as TM from '../../../src/systems/textManager.js';

test('AUDIT POTION-MIGHT C6: the rules tile\'s seconds take each language\'s plural - Czech, Russian, Romanian and Bulgarian say 1, 3, 15 and 21 seconds rightly (mutant: a bare number back)', () => {
  const port = TM.runtimeCollectionName(TM.TextCollections.Port);
  const want = {
    cs: ['1 sekundu', '3 sekundy', '15 sekund', '21 sekund'],
    ru: ['1 секунду', '3 секунды', '15 секунд', '21 секунду'],
    ro: ['1 secundă', '3 secunde', '15 secunde', '21 de secunde'],
    bg: ['1 секунда', '3 секунди', '15 секунди', '21 секунди'],
  };
  try {
    for (const [code, forms] of Object.entries(want)) {
      const rows = TM.parseStringTableCsv(readFileSync(new URL(`../../../locales/${code}/Port_Strings.csv`, import.meta.url), 'utf8'));
      const list = Array.isArray(rows) ? rows : [...(rows.entries?.() ?? [])];
      TM.registerLocale({ code, name: code });
      TM.patchLocaleTable(code, port, list.filter((r) => (r[0] ?? r.key) === 'madeRules.potionClock').map((r) => [r[0] ?? r.key, r[1] ?? r.value]));
      TM.setLocale(code);
      [1, 3, 15, 21].forEach((s, i) => assert.ok(TM.t('madeRules.potionClock', 'Each kind of potion waits {s} seconds after the last one.', { s }).includes(forms[i]), `${code} ${s}: ${forms[i]}`));
    }
  } finally { TM.setLocale('en'); }
});

// ---- C7: a bottle the Spire's flight ban would waste ----
import { useItem } from '../../../src/systems/useItem.js';
import { TEMPLATES } from '../../../src/systems/item/itemKinds.js';
import { flightBottleRefusal } from '../../../src/systems/eliteGates/spireKit.js';
import { EG_NO_FLIGHT_TEXT } from '../../../src/systems/madeLevel.js';

test('AUDIT POTION-MIGHT C7: where the place bans flight, a Levitation or a Slow Falling is kept and refused in its words, its clock never started; a bottle with anything else in it, or one drunk outside, is drunk (mutants: the refusal unasked; a mixed bottle refused)', () => {
  clean();
  const drink = (name) => { const it = { group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, ...bottle(name) }, pack = [it]; return [useItem(it, pack, { drinkPotion: () => name }).kind, pack.length]; };
  assert.deepEqual([flightBottleRefusal(bottle('levitation')), drink('levitation')], ['', ['potion', 0]], 'outside: drunk');
  registerMadeLevelHere(() => 'spire');
  try {
    assert.deepEqual([flightBottleRefusal(bottle('levitation')), flightBottleRefusal(bottle('slowFalling')), flightBottleRefusal(bottle('healTrue'))], [EG_NO_FLIGHT_TEXT, EG_NO_FLIGHT_TEXT, '']);
    assert.deepEqual(drink('levitation'), ['refused', 1], 'the bottle kept');
    assert.equal(pvpPotionRefusal(bottle('purification'), Date.now()), null, 'no clock started by it');
    assert.deepEqual(drink('healTrue'), ['potion', 0]);
  } finally { clean(); }
});
