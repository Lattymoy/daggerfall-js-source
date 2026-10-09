// INT7 (2026-10-09, the INTEGRITY arc's lane 2 - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and
// do it properly"): THE ARMS AND THE LEVEL SIGNED. Every referee of a blow between players clipped it to the weapon the
// striker's own word named (the arena) or its own look carried (a siege, a Royal Tourney) - a client's claim either way,
// so a Daedric Dai-Katana struck as one from a pack that never held it. Now each checkpoint's judge reads the most reach
// of the pack's LAWFUL weapons and whether a lawful bow is among them (net/siegeRef.js armsOf), the identity mint signs
// them (`wa`) beside the level the judge trusts (`cl`, realm.js realmLevelOf), and every referee holds a blow to them.
// Driven through the real account Worker over node:sqlite (test/accountDb.mjs) and the real relay Room
// (test/fakeRoom.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armsTop, armsOf, armsOk, ARMS_TOP_MAX, siegeBlowMax, refereeBlow, newFighter, SIEGE_HIT, SIEGE_THUNDERLOCK, SIEGE_WEAPON_MAX,
  SIEGE_BONUS_MAX, SIEGE_CRIT_MAX, siegeRoomKey, SIEGE_UNITS_PER_M,
} from '../src/net/siegeRef.js';
import { arenaBlowCap, arenaArmsOk, ARENA_ARMS_TOP_MAX, ARENA_HIT, ARENA_MOD_MAX, ARENA_TICK_MS, ARENA_FLOOR_CENTRE } from '../src/net/arenaLaw.js';
import { TOKEN_ARMS_TOP_MAX, armsIssuable, claimsValid, verifyToken } from '../src/net/identityToken.js';
import { openBout, joinBout, stepBout, poseOf, refBlow } from '../src/net/arenaBrain.js';
import { boutLive } from '../src/systems/arenaBout.js';
import { weaponMaxDamage, weaponMaterialModifier } from '../src/characters/weapons.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { seededRng } from '../src/systems/wind.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { realmArmsOf } from '../server-account/src/realm.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const lawful = () => true;
const weapon = (t, m) => createWeapon(t, m, seededRng(t * 16 + m));

test('INT7 THE LAW: a weapon\'s reach is its DFU top and its material\'s modifier (every template, every material, the Thunderlock - pinned to characters/weapons.js); the arms are the most reach of the pack\'s LAWFUL weapons and a lawful bow, a refused piece arming nobody; the bound one number at all three ends (mutants: the material left out; a refused piece counted; the bow unread; the most not the most)', () => {
  for (const t of Object.keys(SIEGE_WEAPON_MAX).map(Number)) {
    for (let m = 0; m <= 9; m++) assert.equal(armsTop(t, m), weaponMaxDamage(t) + weaponMaterialModifier(m), `${t}/${m}`);
  }
  assert.equal(armsTop(SIEGE_THUNDERLOCK.template, 9), weaponMaxDamage(SIEGE_THUNDERLOCK.template) + weaponMaterialModifier(9));
  assert.equal(armsTop(9999, 0), null, 'no weapon this table names');
  assert.deepEqual([ARMS_TOP_MAX, TOKEN_ARMS_TOP_MAX, ARENA_ARMS_TOP_MAX], [32, 32, 32], 'one bound, at the token, the siege and the arena');
  assert.equal(ARMS_TOP_MAX, Math.max(...Object.keys(SIEGE_WEAPON_MAX).map((t) => armsTop(Number(t), 9)), armsTop(SIEGE_THUNDERLOCK.template, 9)));
  const dai = { group: 'Weapons', templateIndex: 123, material: 9 };
  const dagger = { group: 'Weapons', templateIndex: 113, material: 0 };
  const bow = { group: 'Weapons', templateIndex: 130, material: 1 };
  assert.deepEqual(armsOf([dagger, dai, { group: 'Armor', templateIndex: 102, material: 0x0209 }], lawful), [27, 0], 'the most, and armour arms nothing');
  assert.deepEqual(armsOf([dagger, bow], lawful), [18, 1], 'a bow\'s own reach, and its shaft');
  assert.deepEqual(armsOf([dagger, dai, bow], (it) => it !== dai && it !== bow), [5, 0], 'a piece the law refuses arms nobody - nor its bow');
  assert.deepEqual(armsOf([], lawful), [0, 0], 'a bare pack: a fist alone');
  assert.deepEqual(armsOf(null, lawful), [0, 0]);
  assert.deepEqual(armsOf([null, 7, { group: 'Weapons', templateIndex: 'x' }], lawful), [0, 0], 'junk arms nothing');
  for (const ok of [armsOk, arenaArmsOk, armsIssuable]) {
    assert.equal(ok([27, 1]), true);
    assert.equal(ok([0, 0]), true, 'a fist alone is a claim');
    for (const bad of [null, [27], [27, 1, 0], [33, 0], [-1, 0], [1.5, 0], [27, 2], ['27', 1], { 0: 27, 1: 1, length: 2 }]) assert.equal(ok(bad), false, JSON.stringify(bad));
  }
});

test('INT7 THE CLIPS: a siege\'s blow and an arena\'s never past the striker\'s signed reach, a shaft only from a signed bow; a fist every fighter\'s own; a token from before the arms the old caps (mutants: the clip unread at either referee; the bow unread; a fist clipped)', () => {
  assert.equal(siegeBlowMax(123, 9, [16, 0]), (16 + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX, 'a Daedric Dai-Katana claimed from a Longsword\'s pack');
  assert.equal(siegeBlowMax(123, 9, null), siegeBlowMax(123, 9), 'no claim: as before');
  assert.equal(siegeBlowMax(113, 0, [27, 0]), siegeBlowMax(113, 0), 'a weaker weapon than the pack\'s best is its own');
  assert.equal(siegeBlowMax(-1, 0, [0, 0]), siegeBlowMax(-1, 0), 'a fist is every character\'s');
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee, w: 123, m: 9, wa: [16, 0] }), 2 * (16 + ARENA_MOD_MAX));
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee, w: 123, m: 9 }), 2 * (27 + ARENA_MOD_MAX), 'no claim: as before');
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Melee, w: -1, wa: [0, 0] }), arenaBlowCap({ r: ARENA_HIT.Melee, w: -1 }), 'a fist');
  assert.equal(arenaBlowCap({ r: ARENA_HIT.Spell, wa: [0, 0] }), arenaBlowCap({ r: ARENA_HIT.Spell }), 'a spell is no weapon\'s');
  // the siege's referee: the shaft a bow's - a signed one
  const M = SIEGE_UNITS_PER_M;
  const by = newFighter(10, 0), to = newFighter(10, 0);
  const shot = (wa) => refereeBlow(by, to, { from: { x: 0, y: 0, z: 0 }, at: { x: 20 * M, y: 0, z: 0 }, held: { w: 130, m: 9 }, d: 10, r: SIEGE_HIT.Shaft, wa }, 10_000 + by.dealt * 1000);
  assert.equal(shot([18, 0]).why, 'weapon', 'a shaft from a pack with no lawful bow');
  assert.equal(shot([18, 1]).ok, true, 'and from one with');
  assert.equal(shot(null).ok, true, 'a token from before the arms: as before');
  // the arena's: one fighter on the sand, an AI a step off
  let now = 10_000;
  const st = openBout({ o: '0000000000000abc', kind: 'pve', f: [{ sub: 'acct-ceryn', name: 'Ceryn', lv: 20, cl: 20 }], tier: 9, bout: 0, now });
  joinBout(st, 'acct-ceryn', 'f', now);
  for (let i = 0; i < 400 && !boutLive(st.b); i++) { now += ARENA_TICK_MS; stepBout(st, now, () => 0.5); }
  const C = ARENA_FLOOR_CENTRE;
  poseOf(st, 'p0', C[0], C[2], now);
  for (const a of st.ai) { a.pos = [C[0] + 1, C[2]]; a.mv = null; a.atk = null; a.nextAt = Infinity; }
  const foe = st.ai[0].id;
  assert.equal(refBlow(st, 'p0', { i: foe, d: 999, r: ARENA_HIT.Melee, w: 123, m: 9, q: 1 }, now, [16, 0]).got, 2 * (16 + ARENA_MOD_MAX), 'clipped to the signed reach');
  now += 5000;
  assert.equal(refBlow(st, 'p0', { i: foe, d: 5, r: ARENA_HIT.Shaft, w: 130, m: 9, q: 2 }, now, [18, 0]).got, 0, 'a shaft with no signed bow');
  now += 5000;
  assert.equal(refBlow(st, 'p0', { i: foe, d: 5, r: ARENA_HIT.Shaft, w: 130, m: 9, q: 3 }, now, [18, 1]).got, 5, 'with one');
});

test('INT7 THE MINT: a judged realm character\'s token signs its arms off the pack\'s lawful weapons - a forged blade arms nobody - and the claim\'s law refuses it beside anything but a realm\'s yes; none before a judged checkpoint, none to another account (mutants: the mint signs no arms; the law\'s word on the piece unread; another account\'s character read)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const S = await standService();
  const raw = S.env.DB._raw;
  const who = await S.registered('Aldric');
  const R = await seatRealm(S.env, who.secret, 'Aldric');
  const checkpoint = async (items) => {
    const at = R.at();
    const put = await S.fetch(`https://accounts.invalid/v1/realm/${R.id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${who.secret}`, 'x-realm-lease': at.lease, 'x-realm-seq': String(at.seq + 1) },
      body: JSON.stringify({ name: 'Aldric', level: 1, goldPieces: 100, items }),
    });
    assert.equal(put.status, 200);
  };
  await checkpoint([weapon(120, 1), weapon(129, 0)]);
  const claimsOf = async (body, secret = who.secret) => {
    const r = await S.call('/v1/auth/token', body, secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await verifyToken(r.body.token, S.identityPublic, { subtle, nowS: T0 });
    assert.ok(v.ok, v.why);
    return v.claims;
  };
  const row = () => raw.prepare('SELECT arms_top, arms_bow FROM realm_characters WHERE id = ?').get(R.id);
  assert.deepEqual({ ...row() }, { arms_top: armsTop(120, 1), arms_bow: 1 }, 'a checkpoint judged: a steel Longsword, a Short Bow');
  assert.deepEqual((await claimsOf({ character: R.id })).wa, [armsTop(120, 1), 1]);
  // a checkpoint whose Dai-Katana the law refuses (a line on a tierless blade): it arms nobody
  const forged = { ...weapon(123, 9), affixes: [{ id: 'damage', value: 40 }] };
  await checkpoint([weapon(113, 0), forged]);
  assert.deepEqual((await claimsOf({ character: R.id })).wa, [armsTop(113, 0), 0], 'the forged blade arms nobody; the bow left the pack');
  // none before a judged checkpoint; none for a character not this account's; none named
  raw.prepare('UPDATE realm_characters SET arms_top = NULL, arms_bow = NULL WHERE id = ?').run(R.id);
  assert.equal('wa' in (await claimsOf({ character: R.id })), false, 'no judged checkpoint since INT7');
  raw.prepare('UPDATE realm_characters SET arms_top = 27, arms_bow = 1 WHERE id = ?').run(R.id);
  const B = await S.registered('Bran');
  assert.equal('wa' in (await claimsOf({ character: R.id }, B.secret)), false, 'another account naming it');
  assert.equal(await realmArmsOf({ db: S.env.DB }, B.id, R.id), null);
  assert.equal('wa' in (await claimsOf({})), false, 'none named');
  // the claim's own law
  const base = { s: 'acct-1234', n: 'Aldric', k: 'linked', i: 100, e: 200 };
  assert.equal(claimsValid({ ...base, rc: 1, ci: R.id, wa: [27, 1] }), true);
  assert.equal(claimsValid({ ...base, wa: [27, 1] }), false, 'beside no realm\'s yes');
  assert.equal(claimsValid({ ...base, rc: 0, wa: [27, 1] }), false, 'beside a no');
  assert.equal(claimsValid({ ...base, rc: 1, ci: R.id, wa: [33, 1] }), false, 'past the bound');
});

test('INT7 THE RELAY: a striker\'s signed arms ride its socket from the hello, and a siege\'s referee clips its blow to them whatever its look holds - a token from before the arms struck as it did (mutants: the hello drops `wa`; the relay passes none to the referee)', async () => {
  const KEY = siegeRoomKey(3021, 20);
  const M = SIEGE_UNITS_PER_M;
  const at = (x) => ({ x: x * M, y: 0, z: 0, yaw: 0, pitch: 0 });
  const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };
  const realNow = Date.now; let clock = 1_800_000_000_000; Date.now = () => clock;
  try {
    const r = fakeRoom(KEY, { now: () => clock });
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
    const join = async (id, x, extra = {}) => { const ws = r.connect(); await r.hello(ws, id, at(x), { glyphs: ['dev'], lv: 10, look: LOOK, ...extra }); return ws; };
    const a = await join('peer-0001', 0, { rc: 1, ci: 'r0123456789abcdef0123', wa: [16, 0] });
    const b = await join('peer-0002', 2, { lv: 50 });
    const c = await join('peer-0003', 1);
    assert.deepEqual(r.room._attach(a).wa, [16, 0], 'the signed arms on the striker\'s socket');
    assert.equal('wa' in r.room._attach(c), false, 'none on a token from before them');
    for (const ws of [a, b, c]) await say(ws, { k: 'in' });
    await say(a, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 500, r: 0 });
    const hp = () => ws => ws.sent.filter((f) => f.t === 'siege' && f.k === 'hp').at(-1)?.h;
    assert.equal(hp()(b), 400 - siegeBlowMax(123, 9, [16, 0]), 'its look\'s Dai-Katana, clipped to its pack\'s Longsword');
    clock += 1000;
    await say(c, { k: 'blow', to: 'peer-0002', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(hp()(b), 400 - siegeBlowMax(123, 9, [16, 0]) - siegeBlowMax(123, 9), 'a token from before the arms: its look\'s whole bucket');
  } finally { Date.now = realNow; }
});
