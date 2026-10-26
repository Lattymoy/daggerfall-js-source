// WILD-REJOIN (FIELD BUGS 2026-10-25h, bible/11-Multiplayer/Wild-Zone.md section 4) - A FALL THAT OUTLIVES ITS PAGE.
//
// The report: "if you die in the wilderness and alt f4 before you are looted you wont be able to be looted by who killed
// you. you can also skip the death timer this way." A fall lived in the referee and on the dying game's screen alone;
// the account service's record was the save from before it, so a game closed on the death screen came back alive. These
// pins run the referee's word to a fallen still down, its projection on the wire, the receipt's word that the fallen was
// gone, the relay that says both, and the page that lies down again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWildRef, wildZone, wildBlow, wildDownWord, WILD_DOWN_SAY_MIN_MS, WILD_REF } from '../../../src/net/wild/wildRef.js';
import { mintWildReceipt, readWildReceipt, verifyWildReceipt, wildReceiptValid, wildCollectValid, wildFallGraceS, WILD_FALL_GRACE_S } from '../../../src/net/wild/wildReceipt.js';
import { validWildRefOut, WILD_DOWN_MS_MAX, worldRoom, PIXEL_UNITS } from '../../../src/net/wire.js';
import { SIEGE_UNITS_PER_M } from '../../../src/net/siege/siegeRef.js';
import { createWildRejoin, WILD_REJOIN_KNOWN_MS } from '../../../src/systems/wild/wildRejoin.js';
import { setWildDeath, wildDeath, wildDeathKill, wildDeathLines, WILD_DEATH_HOLD_S } from '../../../src/systems/wild/wildZone.js';
import { DeathScreen } from '../../../src/ui/deathScreen.js';
import { presentHeardDeath, forcePlayerDeath, setDeathListener, setDeathPresenter } from '../../../src/characters/playerEntity.js';
import { createWildSeizeHost } from '../../../src/scenes/wildSeizeHost.js';
import { fakeRoom } from '../../fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const FIST = { w: -1, m: 0 };
const RC = 'r00000000000000000a01';
const RC2 = 'r00000000000000000a02';
const RC3 = 'r00000000000000000a03';

/** Two fighters in the zone, a pace apart, and `acct-a`'s fists on `acct-b` until it falls: the fall. */
function fallen(now = 10_000) {
  const st = newWildRef();
  wildZone(st, 'acct-a', { id: 'peer-a', lv: 10, ci: RC }, true, { x: 1000 * M - M, y: 0, z: 1000 * M }, now);
  wildZone(st, 'acct-b', { id: 'peer-b', lv: 10, ci: RC2 }, true, { x: 1000 * M + M, y: 2, z: 1000 * M }, now);
  let t = now;
  for (let k = 0; k < 400; k++) {
    t += 300;
    const fall = wildBlow(st, 'acct-a', 'acct-b', { d: 999, held: FIST, rid: `ddddddddd${String(k).padStart(3, '0')}` }, t).fall;
    if (fall) return { st, fall };
  }
  throw new Error('acct-b never fell');
}

test('WILD-REJOIN THE REFEREE\'S WORD: a fallen still down is told how long it has left to lie and, where its fall was refereed, the remains\' id and where the body lies; a fighter up, unknown, or within WILD_DOWN_SAY_MIN_MS of rising is told nothing; a fall carried from another room says its time alone (mutants: the word to a fighter up; the margin unread; the body\'s place dropped)', () => {
  const { st, fall } = fallen();
  assert.deepEqual(wildDownWord(st, 'acct-b', fall.at), { k: 'down', ms: WILD_REF.riseMs, r: fall.r, p: [1000 * M + M, 2, 1000 * M] });
  assert.equal(wildDownWord(st, 'acct-b', fall.at + 30_000).ms, WILD_REF.riseMs - 30_000, 'the time left, from the fall');
  assert.equal(wildDownWord(st, 'acct-b', fall.at + WILD_REF.riseMs - WILD_DOWN_SAY_MIN_MS).ms, WILD_DOWN_SAY_MIN_MS);
  assert.equal(wildDownWord(st, 'acct-b', fall.at + WILD_REF.riseMs - WILD_DOWN_SAY_MIN_MS + 1), null, 'a moment from rising: a risen fallen is never killed again');
  assert.equal(wildDownWord(st, 'acct-a', fall.at), null, 'the killer stands');
  assert.equal(wildDownWord(st, 'acct-nobody', fall.at), null);
  // the body's place is the one the referee believed at the fall, whatever the fighter's pose says since
  st.fighters.get('acct-b').pose = { x: 0, y: 0, z: 0 };
  assert.deepEqual(wildDownWord(st, 'acct-b', fall.at + 1000).p, [1000 * M + M, 2, 1000 * M]);
  // another room: the hub's carry says it is down, and no body lies here
  const other = newWildRef();
  const carry = { hp: 0, max: 400, down: true, downAt: fall.at, at: fall.at };
  wildZone(other, 'acct-b', { id: 'peer-b2', lv: 10, ci: RC2, carry }, true, { x: 0, y: 0, z: 0 }, fall.at + 20_000);
  assert.deepEqual(wildDownWord(other, 'acct-b', fall.at + 20_000), { k: 'down', ms: WILD_REF.riseMs - 20_000 });
});

test('WILD-REJOIN THE WIRE: the `down` word projected - its time inside the referee\'s rise, and the body\'s remains id and place together, or the id alone, or neither; a place with no id, a time of none or past the rise, refused; anything else on it dropped (mutants: the kind unknown; the bound off the rise; a place with no id)', () => {
  assert.equal(WILD_DOWN_MS_MAX, WILD_REF.riseMs, 'pinned equal: the wire imports no referee');
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'down', ms: 5000, x: 1 }), { k: 'down', ms: 5000 });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'down', ms: 5000, r: '0123456789ab' }), { k: 'down', ms: 5000, r: '0123456789ab' });
  assert.deepEqual(validWildRefOut({ t: 'wref', k: 'down', ms: 5000, r: '0123456789ab', p: [1, 2, 3] }), { k: 'down', ms: 5000, r: '0123456789ab', p: [1, 2, 3] });
  assert.equal(validWildRefOut({ t: 'wref', k: 'down', ms: 5000, p: [1, 2, 3] }), null);
  assert.equal(validWildRefOut({ t: 'wref', k: 'down', ms: 0 }), null);
  assert.equal(validWildRefOut({ t: 'wref', k: 'down', ms: WILD_REF.riseMs + 1 }), null);
  assert.equal(validWildRefOut({ t: 'wref', k: 'down', ms: 5000, r: '0123456789ab', p: [1, 2] }), null);
});

test('WILD-REJOIN THE RECEIPT: a fall signed with its fallen gone from the room says `g` 1, and its killer\'s grace is none; any other fall says nothing and keeps WILD_FALL_GRACE_S; `g` is 1 or absent, and never a collect\'s (mutants: the gone word unsigned; the grace for every fall; any `g` read)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const base = { f: 'acct-fallen', c: RC2, k: 'acct-killer', r: '0123456789ab', w: -1 };
  const gone = await mintWildReceipt({ ...base, g: 1 }, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  const here = await mintWildReceipt(base, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  const v = await verifyWildReceipt(gone, kp.publicKey, { subtle, nowS: 1_800_000_010 });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.g, 1);
  assert.equal(readWildReceipt(here).g, undefined, 'a fallen in the room: unsaid');
  assert.deepEqual([wildFallGraceS(v.claims), wildFallGraceS(readWildReceipt(here)), wildFallGraceS(null)], [0, WILD_FALL_GRACE_S, WILD_FALL_GRACE_S]);
  const claims = { ...base, i: 1_800_000_000, e: 1_800_003_600 };
  assert.equal(wildReceiptValid({ ...claims, g: 1 }), true);
  assert.equal(wildReceiptValid({ ...claims, g: 2 }), false);
  assert.equal(wildReceiptValid({ ...claims, g: 0 }), false);
  assert.equal(wildCollectValid({ r: '0123456789ab', k: 'acct-killer', c: RC, i: 1, e: 2, g: 1 }), false, 'a collect never carries a fall\'s word');
});

// ── the relay, over its fake Durable Object (the int9 pins' own harness, cut to what these need) ──
const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const BASE = { x: PX * PIXEL_UNITS + 16384, z: (499 - PY) * PIXEL_UNITS + 16384 };
const P = (x) => ({ x: BASE.x + x * M, y: 0, z: BASE.z, yaw: 0, pitch: 0 });
const W = (x) => [BASE.x + x * M, 0, BASE.z];
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const CI = { 'peer-0001': RC, 'peer-0002': RC2, 'peer-0003': RC3 };   // a fighter is a realm character in play
const refs = (ws, k) => ws.sent.filter((m) => m.t === 'wref' && (!k || m.k === k));

async function withZone(fn) {
  const realNow = Date.now;
  let clock = 1_800_000_000_000;
  Date.now = () => clock;
  const r = fakeRoom(CELL, { now: () => clock });
  const relayKp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  r.env.GATE_SIGNING_KEY = Buffer.from(await subtle.exportKey('pkcs8', relayKp.privateKey)).toString('base64');
  const say = (ws, d) => r.raw(ws, JSON.stringify({ t: 'wild', data: d }));
  const join = async (id, x) => {
    const ws = r.connect();
    await r.hello(ws, id, P(x), { lv: 10, look: LOOK, rc: 1, ci: CI[id] });
    return ws;
  };
  const step = (ms) => { clock += ms; };
  const fell = async (a, to) => {
    for (let k = 0; k < 400; k++) {
      step(300);
      await say(a, { k: 'strike', to, n: 100 + k, by: 'melee', p: W(-1), d: 999 });
      const f = refs(a, 'fell')[0];
      if (f) return f;
    }
    return null;
  };
  try {
    await fn({ r, say, join, step, fell, relayKp, nowS: () => Math.floor(clock / 1000) });
  } finally {
    Date.now = realNow;
  }
}

test('WILD-REJOIN THE RELAY: a fall signed after its fallen\'s socket left says `g` 1 (one signed with the fallen there does not); the fallen back in the room and in the zone is told it is down - its time, its remains id, where its body lies - BEFORE the receipt it is owed, so its game is dead when it takes its drop; a zone word near the rise says nothing (mutants: `g` for every fall; the down word unsaid; the receipt said first)', () => withZone(async ({ r, say, join, step, fell, relayKp, nowS }) => {
  const a = await join('peer-0001', -1);
  const b = await join('peer-0002', 1);
  for (const ws of [a, b]) await say(ws, { k: 'zone', z: 1 });
  const f = await fell(a, 'peer-0002');
  assert.ok(f, 'B fell');
  await r.drop(b);   // the game closed on the death screen
  await say(a, { k: 'pick', r: f.r, w: -1 });
  const v = await verifyWildReceipt(refs(a, 'rc')[0].rc, relayKp.publicKey, { subtle, nowS: nowS() });
  assert.ok(v.ok, v.why);
  assert.equal(v.claims.g, 1, 'nobody of theirs in the room to take the drop first');
  step(20_000);
  const back = await join('peer-0002', 5);   // the save before the fall: alive, a few paces off
  await say(back, { k: 'zone', z: 1 });
  const words = refs(back).map((m) => m.k);
  assert.deepEqual(words.slice(0, 2), ['down', 'rc'], 'down first, then the owed receipt');
  const [down] = refs(back, 'down');
  assert.deepEqual(validWildRefOut(down), { k: 'down', ms: down.ms, r: f.r, p: W(1) });
  assert.ok(down.ms <= WILD_REF.riseMs - 20_000 && down.ms > WILD_REF.riseMs - 25_000, `about the rest of the two minutes: ${down.ms}`);
  // near the rise, nothing
  step(WILD_REF.riseMs - 20_000 - WILD_DOWN_SAY_MIN_MS + 1_000);
  const before = refs(back, 'down').length;
  await say(back, { k: 'zone', z: 0 });
  await say(back, { k: 'zone', z: 1 });
  assert.equal(refs(back, 'down').length, before);
  // a fall signed with its fallen in the room says nothing of it
  const c = await join('peer-0003', 0);
  await say(c, { k: 'zone', z: 1 });
  step(WILD_REF.riseMs);
  await say(a, { k: 'zone', z: 0 });
  await say(a, { k: 'zone', z: 1 });
  let g = null;
  for (let k = 0; k < 400 && !g; k++) {
    step(300);
    await say(c, { k: 'strike', to: 'peer-0001', n: 500 + k, by: 'melee', p: W(0), d: 999 });
    g = refs(c, 'fell').find((x) => x.id === 'peer-0001') ?? null;
  }
  assert.ok(g, 'A fell, its socket still here');
  await say(c, { k: 'pick', r: g.r, w: -1 });
  const w = await verifyWildReceipt(refs(c, 'rc').at(-1).rc, relayKp.publicKey, { subtle, nowS: nowS() });
  assert.equal(w.claims.g, undefined);
}));

test('WILD-REJOIN THE PAGE: a living page told it is down - and that saw no death of its own in the zone inside WILD_REJOIN_KNOWN_MS - lies down for the time left: a kill, nothing dropped yet, the time served kept through the death\'s later words, the screen holding only the rest; its first dead frame takes that death once; a page that knows its death (on the screen, risen, raised by a Resurrect) or is dead takes nothing (mutants: a page that knows its death killed again; the served time lost to a later word; the screen\'s full two minutes; the death taken twice)', () => {
  const realDoc = globalThis.document;
  let t = 1_000_000;
  const presented = [];
  try {
    setWildDeath(null);
    const page = createWildRejoin({ now: () => t, present: () => presented.push(t) });
    const death = page.heard({ k: 'down', ms: 90_000, r: '0123456789ab', p: [1, 2, 3] }, { alive: true });
    assert.deepEqual(death, { servedS: 30, p: [1, 2, 3] });
    assert.deepEqual(presented, [t], 'put down');
    assert.deepEqual([wildDeath().served, wildDeath().killer, wildDeath().dropped, wildDeathKill()], [30, null, 0, true]);
    assert.equal(wildDeathLines()[0], 'Another player may claim one piece of your worn gear.', 'a kill by a killer this page never heard named');
    setWildDeath({ killer: null, kill: true, dropped: 4 });   // the drop's answer, later
    assert.equal(wildDeath().served, 30, 'kept through the death\'s later words');
    const screen = new DeathScreen({ online: true });
    assert.equal(screen.holdSeconds, WILD_DEATH_HOLD_S - 30);
    assert.equal(screen.respawnIn, 90);
    assert.deepEqual(page.begin(), death, 'the first dead frame takes it');
    assert.equal(page.begin(), null, 'once');
    t += 1_000;
    assert.equal(page.heard({ k: 'down', ms: 60_000 }, { alive: true }), null, 'it knows its death');
    t += WILD_REJOIN_KNOWN_MS;
    assert.equal(page.heard({ k: 'down', ms: 60_000 }, { alive: false }), null, 'the dead take nothing');
    // a page that died here and was raised by a party's Resurrect: the referee still holds it down, and it stands
    const raised = createWildRejoin({ now: () => t });
    raised.begin();
    t += 10_000;
    assert.equal(raised.heard({ k: 'down', ms: 100_000 }, { alive: true }), null);
    // a word whose death never reached a dead frame in the zone is never a later death's
    const lost = createWildRejoin({ now: () => t });
    assert.ok(lost.heard({ k: 'down', ms: 10_000 }, { alive: true }));
    t += WILD_REJOIN_KNOWN_MS;
    assert.equal(lost.begin(), null);
    assert.equal(presented.length, 1, 'only the presenter it was handed');
  } finally {
    setWildDeath(null);
    globalThis.document = realDoc;
  }
});

test('WILD-REJOIN THE BODY RECORD: one home for both deaths that lay a body - the place and room it is handed, the hall and the map pixel the player stands in now, asked at the call; the place copied, never the caller\'s array; nothing known is null (mutants: the hall dropped; the pixel dropped; the caller\'s array kept)', () => {
  let here = { dungeon: 'hall-7', px: { x: 120, y: 44 } };
  const page = createWildRejoin({ place: () => here });
  const mark = [1, 2, 3];
  const body = page.bodyAt(mark, 'dungeon:m42');
  assert.deepEqual(body, { p: [1, 2, 3], room: 'dungeon:m42', dungeon: 'hall-7', px: { x: 120, y: 44 } });
  mark[0] = 99;
  assert.deepEqual(body.p, [1, 2, 3], 'the death mark moving on does not move the body');
  here = { dungeon: null, px: null };
  assert.deepEqual(page.bodyAt([4, 5, 6], 'world:1,1'), { p: [4, 5, 6], room: 'world:1,1', dungeon: null, px: null }, 'asked at the call: outdoors now');
  assert.deepEqual(createWildRejoin().bodyAt([0, 0, 0], 'world:0,0'), { p: [0, 0, 0], room: 'world:0,0', dungeon: null, px: null }, 'no host: nothing known');
});

test('WILD-REJOIN THE DEATH\'S DOOR: a death another page already heard is presented alone - the health at zero and the host\'s screen, no subscriber told it a second time (Project Legacy decided it on the page that closed); a referee\'s fall heard on this page still tells them; nothing for the dead (mutants: the subscribers told again; the presenter skipped)', () => {
  const heard = [];
  const shown = [];
  setDeathListener('wildrejoin-test', (e) => heard.push(e));
  const prior = setDeathPresenter((e) => shown.push(e));
  try {
    const entity = { health: 50 };
    assert.equal(presentHeardDeath(entity), true);
    assert.deepEqual([entity.health, shown.length, heard.length], [0, 1, 0]);
    assert.equal(presentHeardDeath(entity), false, 'already dead');
    const other = { health: 50 };
    forcePlayerDeath(other);
    assert.deepEqual([shown.length, heard.length], [2, 1], 'the fall heard here: the door as ever');
  } finally {
    setDeathListener('wildrejoin-test', null);
    setDeathPresenter(prior);
  }
});

test('WILD-REJOIN THE KILLER\'S CARRY: a fall I won is carried when its time comes and its remains laid where the body fell; an account service from before the gone word answers \'grace\' to a fall signed with its fallen gone, and the carry waits the grace every service knows - once (mutants: the grace word dropped; the grace waited for ever)', async () => {
  const realNow = Date.now;
  let clock = 1_000_000;
  Date.now = () => clock;
  try {
    const seize = new Map();
    const answers = [{ ok: false, error: 'grace' }, { ok: false, error: 'grace' }];
    const asked = [];
    const laid = [];
    const host = createWildSeizeHost({
      _wildSeize: seize,
      campToWire: () => [9, 9, 9],
      player: { feetAt: () => [0, 0, 0] },
      wildAccount: { fall: async (body) => { asked.push(body); return answers.shift() ?? { ok: true, data: { r: '0123456789ab', order: 'o', items: [{ templateIndex: 1 }] } }; } },
      wildDeposit: (dep) => laid.push(dep),
      online: null,
      wildRemains: { has: () => false },
    });
    const flush = () => new Promise((resolve) => { setImmediate(resolve); });
    seize.set('0123456789ab', { rc: 'f1.x.y', room: 'world:1,1', p: [1, 2, 3], due: clock + 5_000, tries: 0 });
    host.wildSeizeFrame();
    assert.equal(asked.length, 0, 'not before its time');
    clock += 5_000;
    host.wildSeizeFrame();
    await flush();
    assert.equal(asked.length, 1);
    assert.ok(seize.get('0123456789ab').due >= clock + WILD_FALL_GRACE_S * 1000, 'asked again once the grace has gone by');
    clock = seize.get('0123456789ab').due;
    host.wildSeizeFrame();
    await flush();
    assert.equal(asked.length, 2);
    assert.equal(seize.size, 0, 'a second grace is the service\'s own word: nothing more is asked');
    seize.set('0123456789ac', { rc: 'f1.x.z', room: 'world:1,1', p: [1, 2, 3], due: clock, tries: 0 });
    host.wildSeizeFrame();
    await flush();
    assert.deepEqual(laid.map((d) => [d.r, d.p, d.room]), [['0123456789ab', [1, 2, 3], 'world:1,1']], 'laid where the body fell');
  } finally {
    Date.now = realNow;
  }
});
