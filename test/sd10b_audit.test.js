// SD10b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD): THE ARC'S
// AUDIT - four lenses over SD0-SD10a (the page, the relay, the law, the docs), each finding verified before it was fixed.
// The page: the hub's hand of my Hour receipt heard; a receipt kept for a burst that never came granted out of the realm;
// a fresh fight's blows judged as its own (a blow's number begins again in every fight); the next Hour's fall and End
// said; the way home one place a fall, clear of the pillars; the Rift that admits a fighter back in its collapse; the
// spoils thrown from outside a pillar; no list or matrix made a frame for nothing; Gearward answering the Remnant's own
// blows through a world boss's mark (and nothing else answering it); a cut of nothing spending no winding; a Hollow laid
// whole. The relay and the law: a fight whose Hour ENDED lost in its time; a full realm's idle seat freed; a hub that does
// not answer never read as a closed Hour; the fall at its own instant and the director armed from it; no write for a
// known fighter's `in`; no blow once the Hour no longer holds; no `in` before the Concord.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// the page
import { SD_BLOWS, SD_BODY, SD_PILLARS, SD_ECHO_SPOTS, SD_LOST_MS, SD_OPENING_MS, SD_RESET_PCT, newRemnantFight, joinRemnant, remnantStateOf, stepRemnant } from '../src/net/sdRemnant.js';
import { createSdFightLink } from '../src/net/sdFightLink.js';
import { validSdOut, SD_NO_WORDS, SD_FIGHT_KEY, SD_KEY, SOCIAL_ROOM, SD_INTERNAL_FELL, worldRoom, PIXEL_UNITS, CLOSE_BUSY } from '../src/net/wire.js';
import { SD_ARENA, SD_PILLAR_W, SD_REALM_ORIGIN, realmToDungeon } from '../src/net/sdBrain.js';
import { SD_STEPS_COURSE, stepAt } from '../src/world/sdSteps.js';
import { strikeDamage } from '../src/net/gateStrike.js';
import { POOL_TICK_MS, HIT_KINDS } from '../src/net/gateBrain.js';
import { createSdRemnantBlows, bodysBlow, SD_BLOWS_TEXT } from '../src/scenes/sdRemnantBlows.js';
import { arenaToDungeon, SD_REM_SINK_MS } from '../src/scenes/sdRemnant.js';
import { createSdSpoils, clearOfPillars, SD_PILLAR_CLEAR_M, SD_SPEW_AT_MS } from '../src/scenes/sdSpoils.js';
import { createSdEnd } from '../src/scenes/sdEnd.js';
import { createSdHall } from '../src/scenes/sdHall.js';
import { handMatrix } from '../src/world/sdHall.js';
import { mintSdReceipt, readSdReceipt } from '../src/net/sdReceipt.js';
import { spoilsLevel } from '../src/scenes/spoilsPool.js';
import { sdSpoilsDay, sdSpoilsList, SD_SPOILS_TEXT } from '../src/systems/sdSpoils.js';
import { sdRiftWord, sdReturnStands } from '../src/world/sdDungeon.js';
import { sdFell, sdRoomKey, isSdRoom, SD_NO_CLOSED, SD_NO_FULL, SD_COLLAPSE_MS } from '../src/net/sdLaw.js';
import { dungeonSizeFor, onlineDungeonSize } from '../src/world/smallerDungeons.js';
import { orreryOf } from '../src/net/sdBrain.js';
import { isSdRealm } from '../src/world/sdRealm.js';
// the set powers
import { setStruck, setBossStruck, setPowerStates, setSetPowersVoice, registerPlayerBlowLanded, BLOW_WINDOW_S, _setSetPowersClockForTests, _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../src/systems/sigil.js';
import { _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { _resetPlayerHealForTests } from '../src/systems/playerHeal.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
// the relay
import { fakeRooms } from './fakeRoom.mjs';
import { PIXEL_M } from '../src/net/gateLaw.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const near = (a, b, e = 1e-6) => a.length === b.length && [...a].every((v, i) => Math.abs(v - b[i]) < e);
const tick = () => new Promise((r) => setImmediate(r));
const T0 = 1_800_000_000_000;
const W = read('src/scenes/world.js');
/** A `function name(` of world.js's own, its text. */
const fnOf = (name) => { const at = W.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  }\n', at) + 4); };
/** A `const name = (` of world.js's own, its text (an arrow whose body closes `\n  };`). */
const constOf = (name) => { const at = W.indexOf(`\n  const ${name} = `); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  };\n', at) + 5); };
const receiptFor = (d, over = {}) => mintSdReceipt({ d, s: 'acct-a', c: 1234, x: 'dealt', l: 7, ...over }, null, { subtle: globalThis.crypto.subtle, nowS: 1_700_000_000 });

// ── the page: the Remnant's blows on me ───────────────────────────────

/** A fight heard by a real link on a clock the test turns, and the arena's blows over it (SD8d's driver); `entity` the
 *  body struck, `strike` the door its blows land by. */
function blowsRig({ at = [0, -6], entity = null, strike = null } = {}) {
  let clock = T0 + 20_000;
  const L = createSdFightLink({ now: () => clock });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const struck = [], said = [];
  let pos = at;
  const e = entity ?? { health: 200, maxHealth: 200 };
  const B = createSdRemnantBlows({
    link: L, audio: null, feet: () => (pos ? arenaToDungeon(pos[0], pos[1]) : null), grounded: () => true, player: () => e,
    strike: (dmg, how) => { struck.push({ dmg, name: how.name }); strike?.(dmg); }, say: (t) => said.push(t), me: () => 'A',
  });
  return {
    L, B, f, struck, said, e,
    word: (w) => L.word(validSdOut(w)),
    to: (t) => { clock = t; B.frame(); },
    across: (from, to, step = 50) => { for (let t = from; t <= to; t += step) { clock = t; B.frame(); } },
    stand: (p) => { pos = p; },
  };
}
/** A fresh fight's whole state, as the realm says it after an `in` - `fi` its number. */
const freshState = (s, fi, born) => { const g = newRemnantFight(s, fi, born); joinRemnant(g, 'a', 'A', 30, born); return { ...remnantStateOf(g), me: 1 }; };

test('AUDIT SD A FRESH FIGHT\'S BLOWS ARE ITS OWN: a blow\'s number begins again in every fight (the law\'s `seq`), so a lost fight\'s marks are forgotten as the next is heard - its blow numbered as one the last fight already judged strikes all the same; the last fight\'s burning brass goes with it (mutants: the marks kept across fights; the brass kept)', () => {
  const S = SD_BLOWS.stomp, A0 = T0 + 21_000;
  const r = blowsRig({ at: [0, 6] });
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 5, a: S.id, at: A0, x: 0, z: 8, yw: 0, tg: [] });
  r.across(A0 - 100, A0 + 2000);
  assert.deepEqual(r.struck.map((x) => x.dmg), [strikeDamage(S.pct, 200, S.base)], 'the first fight\'s blow 5');
  // its Gear Volley lays its brass where I do not stand
  const V = SD_BLOWS.volley, A1 = T0 + 24_000;
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 6, a: V.id, at: A1, x: 0, z: 8, yw: 0, tg: [[10, -10]] });
  r.across(A1 - 100, A1 + 200);
  assert.ok(r.B.state().pools.length > 0, 'the brass burns');
  // the fight is lost, and the next `in` finds a fresh one: numbered on, its blows from 1 again - heard while the last
  // one's brass still burns
  r.word(freshState(4, 2, A1 + 300));
  r.to(A1 + 350);
  assert.ok(A1 + 350 < A1 + V.pool.ms, 'inside the brass\'s life');
  assert.deepEqual(r.B.state().pools, [], 'the last fight\'s brass gone with it');
  const A2 = T0 + 40_000;
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 5, a: S.id, at: A2, x: 0, z: 8, yw: 0, tg: [] });
  r.across(A2 - 100, A2 + 2000);
  assert.equal(r.struck.length, 2, 'the fresh fight\'s blow 5 strikes - it was never judged');
});

test('AUDIT SD THE NEXT HOUR SAYS ITS OWN: out of the Hour the driver forgets which fight\'s fall and End it said - the next Hollow\'s Hour numbers its fights from 1 again, and its fall is heard and said, its End said (mutants: the fall\'s number kept; the End\'s kept)', () => {
  const r = blowsRig({ at: [0, -6] });
  const E = SD_BLOWS.end;
  r.word({ k: 'atk', b: SD_BODY.hour, i: 40, a: E.id, at: T0 + 22_000, x: 0, z: 0, yw: 0, tg: [] });
  r.to(T0 + 21_000);
  r.word({ k: 'fell', at: T0 + 25_000, top: ['A'], n: 1, dm: [{ n: 'A', l: 30, d: 900, x: 0, h: 40, b: 30, f: 0 }] });
  r.to(T0 + 25_100);
  assert.deepEqual(r.said, [SD_BLOWS_TEXT.end, SD_BLOWS_TEXT.fell]);
  // out, and into the next Hollow's Hour - fight 1 again
  r.B.leave(); r.L.leave();
  r.word(freshState(9, 1, T0 + 60_000));
  r.word({ k: 'atk', b: SD_BODY.hour, i: 3, a: E.id, at: T0 + 72_000, x: 0, z: 0, yw: 0, tg: [] });
  r.to(T0 + 71_000);
  r.word({ k: 'fell', at: T0 + 75_000, top: ['A'], n: 1, dm: [{ n: 'A', l: 30, d: 900, x: 0, h: 40, b: 30, f: 0 }] });
  r.to(T0 + 75_100);
  assert.deepEqual(r.said, [SD_BLOWS_TEXT.end, SD_BLOWS_TEXT.fell, SD_BLOWS_TEXT.end, SD_BLOWS_TEXT.fell], 'the next Hour\'s End and fall, said');
});

// ── the page: the world host ──────────────────────────────────────────

/** world.js's way home's place, from its own text, over a fight link the test sets. */
function homeHost() {
  let state = null, now = 0;
  const env = { sdFightLink: { state: () => state, now: () => now }, SD_REM_SINK_MS, clearOfPillars, sdRealmToDungeon: realmToDungeon, SD_ARENA };
  const body = `let _sdHome = null;\n${constOf('sdHomeAt')}\nreturn sdHomeAt;`;
  const sdHomeAt = new Function(...Object.keys(env), body)(...Object.values(env));
  return { sdHomeAt, set: (s, t) => { state = s; now = t; } };
}

test('AUDIT SD THE WAY HOME, ONE PLACE A FALL: where the Remnant fell, keyed by the fall\'s own instant - the next Hollow\'s Hour (its fight numbered 1 again) stands its way home where ITS Remnant fell, never the last one\'s place; a fall inside a pillar stands it clear of the pillar\'s square (mutants: keyed by the fight\'s number; inside the pillar)', () => {
  const h = homeHost();
  const fellAt = (fi, at, x, z) => ({ fi, fell: { at, top: ['A'], n: 1 }, rem: { x, z } });
  h.set(fellAt(1, T0, 3, -4), T0 + SD_REM_SINK_MS - 1);
  assert.equal(h.sdHomeAt(), null, 'not before its body has sunk');
  h.set(fellAt(1, T0, 3, -4), T0 + SD_REM_SINK_MS);
  assert.ok(near(h.sdHomeAt(), realmToDungeon(SD_ARENA.x + 3, 0, SD_ARENA.z - 4)), 'where it fell');
  // the next Hollow's Hour: its fight numbered 1 again, its Remnant fallen elsewhere
  h.set(fellAt(1, T0 + 3_600_000, -8, 12), T0 + 3_600_000 + SD_REM_SINK_MS);
  assert.ok(near(h.sdHomeAt(), realmToDungeon(SD_ARENA.x - 8, 0, SD_ARENA.z + 12)), 'its own fall\'s place');
  // inside a pillar
  const [px, pz] = SD_PILLARS[0];
  h.set(fellAt(1, T0 + 7_200_000, px + 0.2, pz - 0.3), T0 + 7_200_000 + SD_REM_SINK_MS);
  const half = SD_PILLAR_W / 2 + SD_PILLAR_CLEAR_M;
  assert.ok(near(h.sdHomeAt(), realmToDungeon(SD_ARENA.x + px + 0.2, 0, SD_ARENA.z + pz - half)), 'out of its square the shortest way, clear of its side');
});

/** world.js's Rift and its step through, from its own text, over fakes of what they ask (SD5a's harness). */
function riftHost({ rec = null, entered = true, s = 7 } = {}) {
  const log = [];
  let step = null;
  const hollow = { s, key: 'k', site: { px: 303, py: 202 }, loc: { name: 'The Hollow', regionName: 'Daggerfall' } };
  const modes = {
    mode: 'dungeon', dungeonLocation: null, stepThroughFire: (go) => { step = go; },
    forceExitToExterior: () => log.push('out'), enterSdRealm: async () => { log.push('realm'); return entered; },
  };
  const env = {
    sdHost: { record: () => rec, hollow: () => hollow }, _sharedOffsetMs: 0, sdRiftWord, sdReturnStands, modes, playerEntity: { health: 10 }, INTERIOR_SEASON: 3, isSdRealm,
    SD_REALM_TEXT: { lost: 'lost' }, setMidScreenText: (t) => log.push(['said', t]), _teleportToPixel: async () => log.push('pixel'), _sdEntered: new Set(),
  };
  const body = `${constOf('sdRiftOf')}\n${fnOf('sdEnterRealm')}\nreturn { sdRiftOf, sdEnterRealm };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, log, entered: env._sdEntered, run: () => step?.() };
}

test('AUDIT SD THE RIFT REMEMBERS WHO WENT THROUGH: during the collapse a newcomer is refused ("The Hour has closed.") - and one who went through this session is admitted again, as the realm keeps them (SD4b\'s `entered`, which the host never passed); a step through that never reached the Hour remembers nothing (mutants: `entered` unpassed; the step through unremembered; remembered when the realm would not build)', async () => {
  const found = { s: 7, ph: 'found', r: 3, at: T0 - 60_000, until: T0 + 3_600_000, next: T0 + 9_000_000 };
  const fell = sdFell(found, T0, { top: 'Ann', n: 2 });
  const realNow = Date.now;
  Date.now = () => T0 + 1000;
  try {
    const a = riftHost({ rec: found });
    assert.equal(a.sdRiftOf(7).word, null, 'found: through');
    assert.equal(a.sdEnterRealm(7), true);
    assert.equal(await a.run(), true);
    assert.deepEqual([...a.entered], [7], 'through: remembered');
    const b = riftHost({ rec: fell });
    assert.equal(b.sdRiftOf(7).word, SD_NO_CLOSED, 'fallen: a newcomer refused');
    b.entered.add(7);
    assert.equal(b.sdRiftOf(7).word, null, 'one who went through: admitted again');
    b.entered.add(8);
    b.entered.delete(7);
    assert.equal(b.sdRiftOf(7).word, SD_NO_CLOSED, 'another Hollow\'s going-through is not this one\'s');
    const c = riftHost({ rec: found, entered: false });
    c.sdEnterRealm(7);
    assert.equal(await c.run(), false);
    assert.deepEqual([...c.entered], [], 'the realm would not build: nothing remembered');
  } finally { Date.now = realNow; }
});

/** world.js's receipts, from its own text: kept in my realm, granted out of it - over a pool that keeps what it is asked. */
function receiptHost() {
  let slot = null;
  const grants = [];
  const env = {
    readSdReceipt, isSdRoom, modes: { sdRealmSlot: () => slot }, spoilsLevel, playerEntity: { level: 30 }, spoilsLock: (f) => Promise.resolve().then(f),
    sdSpoilsPool: { grant: (o) => { grants.push(o); return true; } }, sdSpoilsDay, sdSpoilsList, SD_SPOILS_TEXT, _sdReceipts: new Map(),
  };
  const body = `${fnOf('sdSpoilsReceipt')}\n${fnOf('grantSdSpoils')}\n${fnOf('sdReceiptsLeft')}\nreturn { sdSpoilsReceipt, sdReceiptsLeft };`;
  const api = new Function(...Object.keys(env), body)(...Object.values(env));
  return { ...api, grants, kept: env._sdReceipts, at: (s) => { slot = s; } };
}

test('AUDIT SD MY HOUR RECEIPT, WHEREVER IT COMES: the hub\'s hand of it (at the kill, when I stood outside the realm; at my hello) is heard by the hub\'s own link - the chat tab\'s, the one in chat:world - to the account service and the spoils, as the realm\'s is; one my realm handed me, kept for a burst that never came (I left before it - the way back, a death, the Hour\'s end), is its spoils straight into the pack as I am out of the realm, once (mutants: the hub\'s hand unheard; the kept receipt left for a week; granted every frame)', async () => {
  const w = strip(W);
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onSdReceipt = \(r, room\) => \{ sdClaims\?\.add\(r\); sdSpoilsReceipt\(r, room\); \};/);
  assert.match(w, /if \(!inRealm && _sdReceipts\.size\) sdReceiptsLeft\(\);\s*\n\s*if \(!inRealm && _sdFightHeld\) sdSpoilsBurst\?\.leave\(\);/, 'before the floor is gathered and the fight forgotten');
  const h = receiptHost();
  h.at(7);
  const r = await receiptFor(7);
  h.sdSpoilsReceipt(r, sdRoomKey(7));
  await tick();
  assert.deepEqual([h.grants.length, h.kept.size], [0, 1], 'in my realm: kept for the burst');
  // out of the realm before the burst
  h.at(null);
  h.sdReceiptsLeft();
  await tick();
  assert.equal(h.grants.length, 1);
  assert.deepEqual([h.grants[0].day, h.grants[0].acct, h.grants[0].text], [sdSpoilsDay(7), 'acct-a', SD_SPOILS_TEXT.granted]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.grants[0].roll())), JSON.parse(JSON.stringify(sdSpoilsList(1234, 7))), 'the Hour\'s roll, at the fight\'s level');
  assert.equal(h.kept.size, 0);
  h.sdReceiptsLeft();
  await tick();
  assert.equal(h.grants.length, 1, 'once');
  // the hub's hand, wherever I stand: straight into the pack
  h.sdSpoilsReceipt(await receiptFor(8), SOCIAL_ROOM);
  await tick();
  assert.equal(h.grants.length, 2);
});

// ── the page: the spoils, the portals, the hall ───────────────────────

test('AUDIT SD CLEAR OF THE PILLARS: a place on the arena\'s floor inside a pillar\'s square (the Remnant\'s walk never minds them) is put out of it the shortest way, its margin clear of the side - each of the four; a place clear of them is unmoved; the spoils leave the Remnant\'s chest from outside a pillar it fell into (mutants: the long way out; the margin lost; the spew from inside)', () => {
  const half = SD_PILLAR_W / 2 + SD_PILLAR_CLEAR_M;
  assert.equal(SD_PILLAR_CLEAR_M, 1.2);
  for (const [px, pz] of SD_PILLARS) {
    assert.deepEqual(clearOfPillars(px + 0.2, pz - 0.5), [px + 0.2, pz - half], 'out along z, the nearer side');
    assert.deepEqual(clearOfPillars(px - 0.6, pz + 0.1), [px - half, pz + 0.1], 'out along x');
    assert.deepEqual(clearOfPillars(px, pz + half + 0.01), [px, pz + half + 0.01], 'clear already');
    assert.ok(near(clearOfPillars(px + 0.1, pz + 0.2, 0.3), [px + 0.1, pz + SD_PILLAR_W / 2 + 0.3]), 'its own margin');
  }
  assert.deepEqual(clearOfPillars(3, -4), [3, -4]);
  // the spoils' burst, its Remnant fallen into a pillar
  let clock = T0;
  const L = createSdFightLink({ now: () => clock });
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0);
  L.word(validSdOut({ ...remnantStateOf(f), me: 1 }));
  const spews = [];
  const pool = { spew: (o) => { spews.push(o); return true; }, frame: () => {}, gather: () => 0 };
  return receiptFor(4).then((r) => {
    const d = createSdSpoils({ link: L, pool, slot: () => 4, receipt: () => r, level: () => 30, feet: () => null, say: () => {} });
    const [px, pz] = SD_PILLARS[2];
    f.rem.x = px - 0.1; f.rem.z = pz + 0.05; f.fell = { at: T0 + 10_000, top: ['A'], n: 1 };
    L.word(validSdOut(remnantStateOf(f)));
    clock = T0 + 10_000 + SD_SPEW_AT_MS;
    d.frame();
    assert.equal(spews.length, 1);
    const heard = L.state().rem;   // the wire's centimetres
    assert.ok(Math.max(Math.abs(heard.x - px), Math.abs(heard.z - pz)) < SD_PILLAR_W / 2, 'it fell inside the pillar');
    const [cx, cz] = clearOfPillars(heard.x, heard.z, 0.3);
    const want = realmToDungeon(SD_ARENA.x + cx, 0, SD_ARENA.z + cz);
    assert.ok(Math.abs(spews[0].at[0] - want[0]) < 1e-6 && Math.abs(spews[0].at[2] - want[2]) < 1e-6, 'from outside the pillar');
    assert.ok(Math.max(Math.abs(cx - px), Math.abs(cz - pz)) >= SD_PILLAR_W / 2 + 0.3 - 1e-9);
  });
});

/** A renderer that keeps what it is asked to make (SD4b's). */
function endFakes() {
  const r = { made: [], freed: [] };
  r.uploadTexture = () => {}; r.uploadEmissionTexture = () => {};
  r.createBillboardBatch = (archiveName, record, size) => { const b = { archive: archiveName, record, size }; r.made.push(b); return b; };
  r.destroyBillboardBatch = (b) => r.freed.push(b);
  return r;
}

test('AUDIT SD NOTHING MADE A FRAME FOR NOTHING: the Rift\'s and the Return\'s batches one list frame after frame, made again only as a portal stands or goes - the Hour\'s way home stood alone among them, the Return gone out of them, none once cleared; the Orrery\'s hands drawn where the stones are at the first word, and a hand at rest keeps its matrix; the Steps\' places into one scratch (mutants: a portal stood unlisted; a gone one still listed; the list kept past the clear; a hand drawn at its start; a matrix made every frame; a step\'s place made every frame)', () => {
  const r = endFakes();
  const end = createSdEnd({ renderer: r });
  assert.deepEqual(end.batches(), []);
  end.stand({ rift: { at: [10, 0, 5], size: 6 }, retAt: [15, 0, 5] });
  const both = end.batches();
  assert.deepEqual(both, [r.made[0], r.made[1]]);
  end.frame([50, 0, 50]);
  assert.equal(end.batches(), both, 'the same list, frame after frame');
  end.returnOut();
  const one = end.batches();
  assert.deepEqual(one, [r.made[0]], 'the Return gone out of it');
  assert.equal(end.batches(), one);
  end.clear();
  assert.deepEqual(end.batches(), [], 'none once cleared');
  const home = createSdEnd({ renderer: r });
  home.standReturn([1, 0, 1]);
  assert.deepEqual(home.batches(), [r.made.at(-1)], 'the way home, stood alone');
  // the hall's hands
  const o = orreryOf(1);
  const renderer = { createMesh: (m) => ({ m }), destroyMesh: () => {}, uploadTexture: () => {}, uploadEmissionTexture: () => {} };
  const hall = createSdHall({ renderer, s: 1, now: () => 10_000 });
  const draws = [];
  hall.stand({ dynamicDraws: draws, collider: null });
  const st0 = o.start.map((h) => (h + 5) % 12);
  hall.frame(0.016, null, { k: 'pz', s: 1, st: st0, f: 0, lit: 0, ok: false });
  const hands = draws.slice(1, 7);
  for (let i = 0; i < 6; i++) assert.ok(near(hands[i].object.matrix, handMatrix(i, st0[i])), `hand ${i} drawn where its stone is`);
  const before = hands.map((d) => d.object.matrix);
  hall.frame(0.05, null, null);
  hall.frame(0.05, null, null);
  assert.ok(hands.every((d, i) => d.object.matrix === before[i]), 'at rest: kept');
  // the Steps: each step's place into the frame's one scratch, moved into the dungeon's frame by realmToDungeon's own sum
  const drift = SD_STEPS_COURSE.find((x) => x.kind === 'drift'), into = [9, 9, 9];
  assert.equal(stepAt(drift, 3.5, into), into, 'into the scratch given');
  assert.deepEqual(into, stepAt(drift, 3.5), 'the place a fresh one has');
  assert.notEqual(stepAt(drift, 3.5)[0], drift.x, 'a drifting one, off its centre');
  assert.match(read('src/scenes/sdSteps.js'), /stepAt\(s, t, _at\);[^\n]*\n\s*const x = SD_REALM_ORIGIN\[0\] \+ _at\[0\], y = SD_REALM_ORIGIN\[1\] \+ _at\[1\], z = SD_REALM_ORIGIN\[2\] \+ _at\[2\];/);
  assert.deepEqual(realmToDungeon(1, 2, 3), [SD_REALM_ORIGIN[0] + 1, SD_REALM_ORIGIN[1] + 2, SD_REALM_ORIGIN[2] + 3], 'realmToDungeon is that sum - the pose\'s own');
});

// ── the set powers: Gearward and the world boss ───────────────────────

const BODY = [107, 106, 105, 102, 103, 104, 108];
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const piece = (templateIndex, set) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp: 0 };
  return it;
};
const wearSet = (e, set, n) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set); e.items.push(it); equipItem(e, it); } return e; };
const RAT = Object.freeze({ name: 'rat' });
let T = 0;
_setSetPowersClockForTests(() => T);
const at = (t) => { T = t; };
function fresh() {
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); at(0);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  setSigilOnline(true); setSigilRenown(1);
  return v;
}
const door = (me) => setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });

test('AUDIT SD GEARWARD ANSWERS THE BRASS REMNANT: a world boss\'s blow lands through the court\'s door, never the attack formula\'s struck tail, so it carries no foe\'s mark - and the Remnant\'s own set\'s Gearward never answered the fight it drops in. The body\'s blow is marked as it lands (setBossStruck): Gearward lightens it and winds again; the mark is that hurt\'s alone (taken as the door opens), and one older than the blow\'s window is nobody\'s; no reach power answers it - the blow\'s listeners hear no foe; a cut of nothing - a blow too small to lighten by a whole point - spends no winding (mutants: the boss\'s blow unanswered; its mark lying for the next hurt; the window unread; a cut of nothing spending the gear)', () => {
  const v = fresh();
  const e = wearSet(player(), 'numidium', 4);
  door(e);
  at(10);
  setBossStruck(); hurtPlayer(e, 3);
  assert.deepEqual([e.health, v.sounds], [97, []], 'a cut of nothing: 15% of 3 is no whole point - landed whole, the gear still wound');
  hurtPlayer(e, 40);
  assert.equal(e.health, 57, 'the mark was that hurt\'s alone: a hurt after it in the same instant is no boss\'s blow');
  setBossStruck(); hurtPlayer(e, 40);
  assert.deepEqual([e.health, v.sounds], [23, ['gear']], 'the boss\'s blow: 6 of 40 turned');
  assert.equal(setPowerStates(10).gearLeft, 18, 'winding again');
  // a mark nobody took in its window is nobody's
  fresh();
  const e2 = wearSet(player(), 'numidium', 4);
  door(e2);
  at(20);
  setBossStruck();
  at(20 + BLOW_WINDOW_S + 0.05);
  hurtPlayer(e2, 40);
  assert.equal(e2.health, 60, 'too old: whole');
  // no reach power answers a world boss (Sigil-Sets.md section 8): the blow's listeners hear no foe in it
  const heard = [];
  registerPlayerBlowLanded('audit-sd', (who, attacker, took) => heard.push([attacker, took]));
  try {
    at(60);
    setBossStruck(); hurtPlayer(e2, 10);
    assert.deepEqual(heard, [], 'the boss\'s blow: no foe\'s');
    setStruck(RAT, e2, 10); hurtPlayer(e2, 10);
    assert.deepEqual(heard.map(([a]) => a), [RAT], 'a rat\'s: its foe');
  } finally { registerPlayerBlowLanded('audit-sd', null); }
});

test('AUDIT SD THE BODY\'S BLOWS ALONE: through the Remnant\'s own driver, a body\'s own blow - the Stomp, the Hand, the Volley; the Remnant\'s, and an Echo\'s - is a world boss\'s, and Gearward lightens it; the Hour\'s unresisted magic over the whole floor (the Pulse; the Reset, though the Remnant casts it; the End) and the burning brass (no blow) land whole and leave the gear wound (mutants: the Hour\'s magic marked; the Reset marked as the body\'s; the brass marked; an Echo\'s unmarked)', () => {
  assert.deepEqual([SD_BLOWS.stomp, SD_BLOWS.hand, SD_BLOWS.volley, SD_BLOWS.pulse, SD_BLOWS.reset, SD_BLOWS.end].map(bodysBlow), [true, true, true, false, false, false]);
  assert.equal(bodysBlow(undefined), false);
  const v = fresh();
  const e = wearSet(player(), 'numidium', 4);
  door(e);
  at(10);
  const r = blowsRig({ at: [0, 6], entity: e, strike: (dmg) => hurtPlayer(e, dmg) });
  const P = SD_BLOWS.pulse, S = SD_BLOWS.stomp, V = SD_BLOWS.volley;
  // the Hour's Pulse
  r.word({ k: 'atk', b: SD_BODY.hour, i: 3, a: P.id, at: T0 + 21_000, x: 0, z: 0, yw: 0, tg: [], n: 0 });
  r.across(T0 + 20_500, T0 + 22_000);
  assert.equal(r.struck.length, 1);
  assert.deepEqual([e.health, v.sounds], [100 - r.struck[0].dmg, []], 'the Hour\'s own blow: whole, the gear still wound');
  // the burning brass, stepped into after its discs fell
  e.health = 100;
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 4, a: V.id, at: T0 + 23_000, x: 0, z: 8, yw: 0, tg: [[-10, 10]] });
  r.across(T0 + 22_500, T0 + 23_300);
  const n = r.struck.length;
  r.stand([-10, 10]);
  r.across(T0 + 23_350, T0 + 23_350 + POOL_TICK_MS * 2 + 100);
  const bites = r.struck.slice(n);
  assert.ok(bites.length >= 1 && bites.every((x) => x.name === SD_BLOWS_TEXT.burning), 'the brass bites');
  assert.deepEqual([e.health, v.sounds], [100 - bites.reduce((a, x) => a + x.dmg, 0), []], 'the brass: whole, the gear still wound');
  // the Remnant's Stomp
  e.health = 100;
  r.stand([0, 6]);
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 5, a: S.id, at: T0 + 30_000, x: 0, z: 8, yw: 0, tg: [] });
  r.across(T0 + 29_900, T0 + 32_000);
  const d = r.struck.at(-1).dmg;
  assert.equal(d, strikeDamage(S.pct, 100, S.base));
  assert.deepEqual([e.health, v.sounds], [100 - (d - Math.round((d * 15) / 100)), ['gear']], 'the Remnant\'s: lighter');
  // an Echo's, once the gear has wound again
  at(10 + 18);
  e.health = 100;
  r.f.phase = 2;
  r.f.ec = SD_ECHO_SPOTS.map(([x, z], k) => ({ e: k, h: 100, m: 100, up: T0, downAt: null, body: { x, z, yw: Math.PI, mv: null, atk: null } }));
  r.word({ ...remnantStateOf(r.f), me: 1 });
  r.word({ k: 'atk', b: SD_BODY.gold, i: 6, a: S.id, at: T0 + 40_000, x: 0, z: 8, yw: 0, tg: [] });
  r.across(T0 + 39_900, T0 + 42_000);
  const d2 = r.struck.at(-1).dmg;
  assert.deepEqual([e.health, v.sounds], [100 - (d2 - Math.round((d2 * 15) / 100)), ['gear', 'gear']], 'an Echo\'s: lighter');
  // the Reset: the Remnant's body casts it, and it is the Hour's magic all the same
  at(10 + 18 + 18);
  e.health = 100;
  r.word({ k: 'atk', b: SD_BODY.remnant, i: 7, a: SD_BLOWS.reset.id, at: T0 + 52_000, x: 0, z: 0, yw: 0, tg: [] });
  r.across(T0 + 51_000, T0 + 53_000, 100);
  const d3 = r.struck.at(-1);
  assert.deepEqual([d3.name, d3.dmg], [SD_BLOWS.reset.name, strikeDamage(SD_RESET_PCT, 100, 0)]);
  assert.deepEqual([e.health, v.sounds], [100 - d3.dmg, ['gear', 'gear']], 'the Reset: whole, the gear still wound');
});

// ── the size law ──────────────────────────────────────────────────────

test('AUDIT SD A HOLLOW IS LAID WHOLE: its feat is its template\'s longest walk - online (where the world\'s sizes re-lay every other dungeon), offline, whatever a setting or a quest says, by the one tier law; a regular dungeon online keeps the world\'s size (mutants: the Hollow re-laid online; the tier unread)', () => {
  let id = 1;
  while (onlineDungeonSize({ mapTableData: { mapId: id } }) === 'full') id++;
  const plain = { hasDungeon: true, mapTableData: { mapId: id } };
  const hollow = { ...plain, superTier: true };
  assert.notEqual(dungeonSizeFor(plain, { online: true }), 'full', `a regular dungeon online: the world's size (${dungeonSizeFor(plain, { online: true })})`);
  for (const online of [true, false]) for (const setting of [true, false]) for (const world of [true, false]) {
    assert.equal(dungeonSizeFor(hollow, { online, setting, world, medium: true }), 'full', JSON.stringify({ online, setting, world }));
  }
  const quests = { getSiteLinks: () => [{ questUID: 1 }], getQuest: () => ({ smallerDungeonsState: 2 }) };
  assert.equal(dungeonSizeFor(hollow, { questMachine: quests, setting: false, world: false, medium: false }), 'full', 'whatever a quest says');
  assert.equal(dungeonSizeFor({ ...plain, superTier: 'yes' }, { online: true }), onlineDungeonSize(plain), 'the tier law\'s word, not any truthy field');
});

// ── the law: a fight whose Hour ended ────────────────────────────────

test('AUDIT SD AN ENDED HOUR IS LOST IN ITS TIME: SD_LOST_MS after the Hour\'s End the fight is lost, whoever\'s pose still says it stands in the arena - a tab frozen there held a fight nobody could win, and the next could never begin (mutants: an ended fight never lost while a pose stands; lost a beat late)', () => {
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 20, T0);
  const wake = T0 + SD_OPENING_MS;
  const stands = () => [{ sub: 'a', x: 0, z: -6, dead: false }];
  for (let now = T0; now <= wake + 1000; now += 250) stepRemnant(f, now, stands(), () => 0.5);
  f.endsAt = wake + 5000;
  const out = [];
  for (let now = wake + 1250; now <= f.endsAt + SD_LOST_MS - 250; now += 250) out.push(...stepRemnant(f, now, stands(), () => 0.5));
  assert.ok(f.ended && !f.lost, 'ended, and still stood in');
  assert.ok(out.some((x) => x.k === 'atk' && x.a === SD_BLOWS.end.id));
  const last = stepRemnant(f, f.endsAt + SD_LOST_MS, stands(), () => 0.5);
  assert.deepEqual(last, [{ k: 'lost', at: f.endsAt + SD_LOST_MS }], 'lost at its time');
  assert.equal(joinRemnant(f, 'b', 'B', 20, f.endsAt + SD_LOST_MS + 1), false, 'it takes nobody after');
});

// ── the relay ─────────────────────────────────────────────────────────

const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const fights = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev');
const say = (o) => JSON.stringify({ t: 'sd', ...o });
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };

/** The fake world driven to a FOUND Hollow (slot 1) and its realm standing (SD8b's rig) - past the Orrery unless
 *  `concord` is false; `hub.down(true)` and the realm's asks of the hub go unanswered. */
async function withRealm(fn, { concord = true } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room('chat:r17'); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      const realm = world.room(sdRoomKey(rec.s));
      if (concord) { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }
      let down = false;
      const ROOMS = realm.room.env.ROOMS;
      realm.room.env.ROOMS = { idFromName: ROOMS.idFromName, get: (id) => ({ fetch: (q) => (down && id === SOCIAL_ROOM ? Promise.resolve(new Response('', { status: 503 })) : ROOMS.get(id).fetch(q)) }) };
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      await fn({ world, hub, hws, cell, realm, rec, beat, step: (ms) => { clock += ms; }, now: () => clock, down: (v) => { down = v; } });
    });
  } finally { Date.now = realNow; }
}

test('AUDIT SD A HUB THAT DOES NOT ANSWER IS NO CLOSED HOUR: a realm\'s ask of the hub that goes unanswered (busy, away - a deploy\'s hello storm) refuses a hello as busy, which the page tries again - never "The Hour has closed.", which is for good - and is asked again at the next hello, not believed for its freshness; an `in` meanwhile goes unanswered (the page says it again), and a blow is never stopped by it (mutants: no answer read as closed; the non-answer kept; the `in` refused for good; the blow stopped)', async () => {
  await withRealm(async ({ realm, down, beat, step }) => {
    down(true);
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    assert.deepEqual(ann.closed, { code: CLOSE_BUSY, reason: 'busy' }, 'busy: try again');
    assert.ok(!ann.sent.some((m) => m.t === 'error' && m.m === SD_NO_CLOSED));
    down(false);
    // AUDIT SD II (PIN MOVED, L3 F2): a miss is not asked again for SD_LIVE_MISS_MS (2 s - the page's own busy back-off is
    // longer) - inside it the next hello is busy unasked; past it, asked, and in at once: the non-answer is never kept
    const asked = realm.room._sdLive;
    const early = realm.connect(); await realm.hello(early, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    assert.deepEqual(early.closed, { code: CLOSE_BUSY, reason: 'busy' }, 'inside the back-off: busy, the hub unasked');
    assert.equal(realm.room._sdLive, asked, 'not asked again');
    step(2000);
    const ann2 = realm.connect(); await realm.hello(ann2, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    assert.equal(ann2.closed, null, 'the hub answers again: in at once - its non-answer was never kept');
    // an `in` while the hub does not answer: nothing said, no fight made
    down(true); realm.room._sdLive = null;
    await realm.raw(ann2, say({ k: 'in', lv: 30, bv: 1 }));
    assert.deepEqual(fights(ann2).filter((m) => m.k === 'no'), [], 'never refused');
    assert.equal(realm.store.get(SD_FIGHT_KEY), undefined, 'no fight yet');
    down(false); realm.room._sdLive = null;
    await realm.raw(ann2, say({ k: 'in', lv: 30, bv: 1 }));
    assert.equal(fights(ann2).at(-1).k, 'st', 'said again, answered');
    await beat(SD_OPENING_MS + 1000);
    // a blow while the hub does not answer: believed
    down(true); realm.room._sdLive = null;
    const f = realm.room._sdFight, h0 = f.hp;
    await realm.raw(ann2, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40, 'a hub away stops no blow');
  });
});

test('AUDIT SD NO BLOW ONCE THE HOUR NO LONGER HOLDS: a page that stayed in the realm past its cast-out (the hub\'s record gone by, or another slot\'s) lands nothing - asked of the hub as a hello is (mutants: blows believed past the Hour)', async () => {
  await withRealm(async ({ realm, hub, beat }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    await beat(SD_OPENING_MS + 1000);
    const f = realm.room._sdFight, h0 = f.hp;
    await realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40, 'while it holds');
    const rec = await hub.room._sdOf();
    rec.until = Date.now() - 1;
    realm.room._sdLive = null;
    await realm.raw(ann, say({ k: 'hit', q: 2, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(f.hp, h0 - 40, 'gone by: nothing');
  });
});

test('AUDIT SD THE FALL AT ITS OWN INSTANT: a realm\'s word of its kill heard late - its Hour\'s time past as the hub hears it - is the kill all the same, at the fall\'s own instant, never later than the hub\'s now; and the hub\'s director is armed from it, so the collapse ends and the next Hollow rises on time (mutants: the fall at the hearing - no kill after its Hour; the director unarmed)', async () => {
  await withRealm(async ({ hub, rec, step }) => {
    const live = await hub.room._sdOf();
    const fellAt = live.until - 60_000;
    step(live.until + 1000 - Date.now());
    const tell = (o) => hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, top: 'Ann', n: 2, rc: [], here: [], ...o }) }));
    assert.equal((await tell({ at: fellAt })).status, 200);
    const fell = hub.store.get(SD_KEY);
    assert.deepEqual([fell.ph, fell.fellAt, fell.top, fell.n], ['fell', fellAt, 'Ann', 2], 'fallen at its own instant');
  });
  // a kill early in the Hour: the director's next move is its collapse's end, hours before the Hour's own end
  await withRealm(async ({ hub, rec }) => {
    const now = Date.now(), live = await hub.room._sdOf();
    assert.ok(hub.alarm.at > now + SD_COLLAPSE_MS && live.until > now + SD_COLLAPSE_MS, 'armed for later than a collapse');
    await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, at: now + 30_000, top: 'Bo', n: 1, rc: [], here: [] }) }));
    assert.equal(hub.store.get(SD_KEY).fellAt, now, 'a realm\'s clock ahead: never later than the hub\'s now');
    assert.equal(hub.alarm.at, now + SD_COLLAPSE_MS, 'the director armed for its collapse\'s end');
  });
});

test('AUDIT SD THE SEATS FREE THEMSELVES: a full realm (SD_FIGHTERS_MAX accounts admitted) frees the seat of one with no socket here and no seat in its fight - a watcher\'s hello no longer holds one for the Hollow\'s whole life; one standing in the realm, or one with a seat in its fight, keeps theirs (mutants: never freed; a present account\'s freed; a fighter\'s freed)', async () => {
  await withRealm(async ({ realm, rec }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(3, -12), { name: 'Bo' });
    const r = await realm.room._sdRealmOf(rec.s);
    assert.deepEqual(r.in, ['acct-peer-ann', 'acct-peer-bo']);
    const f = realm.room._sdFight;
    const fighters = Array.from({ length: 254 }, (_, k) => `acct-f${k}`);
    for (const x of fighters) f.players[x] = { ...f.players['acct-peer-ann'], name: x };
    r.in.push(...fighters);
    const cy = realm.connect(); await realm.hello(cy, 'peer-cy', inArenaAt(-3, -12), { name: 'Cy' });
    assert.deepEqual(cy.closed?.reason, SD_NO_FULL, 'full: Ann fights, Bo stands here, the rest fight');
    // Bo leaves: his seat is free
    await realm.drop(bo);
    const dee = realm.connect(); await realm.hello(dee, 'peer-dee', inArenaAt(-3, -12), { name: 'Dee' });
    assert.equal(dee.closed, null, 'Bo\'s seat');
    assert.ok(!r.in.includes('acct-peer-bo') && r.in.includes('acct-peer-dee') && r.in.length === 256);
    // Ann leaves too - her seat is her fight's
    await realm.drop(ann);
    const eve = realm.connect(); await realm.hello(eve, 'peer-eve', inArenaAt(-3, -12), { name: 'Eve' });
    assert.deepEqual(eve.closed?.reason, SD_NO_FULL, 'a fighter keeps her seat');
  });
});

test('AUDIT SD NO WRITE FOR A KNOWN `in`: a fighter\'s `in` said again (its retry, a second tab) is answered and written nowhere - a fresh fight and a newcomer are written at once (the gate\'s AUDIT WB A3) (mutants: every `in` written; a newcomer unwritten)', async () => {
  await withRealm(async ({ realm }) => {
    const storage = realm.room.state.storage, put = storage.put.bind(storage);
    const writes = [];
    storage.put = (k, v) => { if (k === SD_FIGHT_KEY) writes.push(Object.keys(v.players)); return put(k, v); };
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    assert.deepEqual(writes, [['acct-peer-ann']], 'a fresh fight: written');
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    assert.equal(fights(ann).at(-1).k, 'st', 'answered');
    assert.equal(writes.length, 1, 'known: not written');
    const bo = realm.connect(); await realm.hello(bo, 'peer-bo', inArenaAt(3, -12), { name: 'Bo' });
    await realm.raw(bo, say({ k: 'in', lv: 20, bv: 1 }));
    assert.deepEqual(writes.at(-1), ['acct-peer-ann', 'acct-peer-bo'], 'a newcomer: written');
    assert.equal(writes.length, 2);
  });
});

test('AUDIT SD PAST THE ORRERY ALONE: the fight\'s door asks the realm\'s Concord - an `in` before the Orrery is set is nothing (the arena\'s way is laid by the Concord alone); after it, the fight (mutants: the Concord unasked)', async () => {
  await withRealm(async ({ realm, rec }) => {
    const ann = realm.connect(); await realm.hello(ann, 'peer-ann', inArenaAt(0, -12), { name: 'Ann' });
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    assert.equal(realm.store.get(SD_FIGHT_KEY), undefined, 'no fight');
    assert.deepEqual(fights(ann).filter((m) => m.k === 'no' || m.k === 'st').map((m) => m.m ?? m.k), ['st'].slice(0, fights(ann).filter((m) => m.k === 'st').length), 'nothing new said');
    const h = await realm.room._sdHallOf(rec.s); h.ok = true;
    await realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    assert.ok(realm.store.get(SD_FIGHT_KEY), 'the Concord set: the fight');
  }, { concord: false });
  assert.ok(SD_NO_WORDS.length === 4);
});
