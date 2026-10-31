// EG-MIGHT (2026-10-31, the owner: "Address DMG cap in Elite Breach. It's not engaging to see 45 DMG when you're well
// geared"; asked, "Gear-aware purse"; bible/11-Multiplayer/Elite-Gates.md section 21.1). The trust law's purse refilled at
// 3 x (5 + level) a second whatever a member wore - 45 at level 10 - and the screen says what lands. Now the account
// service's judge reads a kit's might off its judged pack (net/kitMight.js), the mint signs it with the Renown's sky
// (`mg`, net/mightLaw.js), and the Spire's purse grows by it while a member's share of a body's health grows by its root
// (net/eliteGates/egMight.js). Pinned here: the law, the kit's parts, the numbers it reads equal to the client's homes, the
// judge, the mint's sum, the token, the relay's socket and the director's own breach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGHT_NONE, MIGHT_MOST, mightOk, mightX, mightOf, mightSigned, firmamentPart } from '../../../src/net/mightLaw.js';
import { kitMightParts, kitMightOf, KIT_POWER_PCT, KIT_SET_PIECES, KIT_GEAR_PER_POINT, KIT_GEAR_PCT_MOST, KIT_CLIMB_PCT, KIT_CLIMB_HALF_PCT } from '../../../src/net/kitMight.js';
import { EG_MIGHT_HEALTH_EXP, egPurseX, egHealthRef, egTokenAtt } from '../../../src/net/eliteGates/egMight.js';
import { BLOW_TOPS } from '../../../src/systems/powerCeiling.js';
import { LEGENDARY_POWERS } from '../../../src/systems/loot/lootRarity.js';
import { GILDED_RECORDS } from '../../../src/systems/gilded.js';
import { WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT } from '../../../src/systems/weaponMastery.js';
import { SKILLS } from '../../../src/systems/skills.js';
import { effectiveSkill, SKILL_SOFT_CAP } from '../../../src/systems/skillSoftcap.js';
import { SIGIL_SET_IDS } from '../../../src/systems/sigil/sigil.js';
import { applyRarity } from '../../../src/systems/loot/lootRarity.js';
import { mintGilded } from '../../../src/systems/gilded.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { TOKEN_MIGHT_MIN, TOKEN_MIGHT_MAX, mightIssuable, mintToken, verifyToken, RENOWN_MAX } from '../../../src/net/identityToken.js';
import { judgeSave } from '../../../server-account/src/judge.js';
import { egHallOf, egFirstHallOf, egCirclePlan, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egBlow } from '../../../src/net/eliteGates/egBrain.js';
import { egLordsAwake, egLordsOf, egTtkRef, egLordsShare, egLordsFight, EG_SEAM } from '../../../src/net/eliteGates/egLords.js';
import { EG_FL, egHas } from '../../../src/net/eliteGates/egBodies.js';
import { HIT_KINDS, dpsRef, BUCKET_RATE_X, BUCKET_DEPTH_X } from '../../../src/net/gate/gateBrain.js';
import { STAND_IN_WHOLE } from '../../../src/world/gate/gateBoss.js';
import { readFileSync } from 'node:fs';
import { standService, T0 as ACCT_T0 } from '../../accountDb.mjs';
import { seatRealm } from '../../realmSeat.mjs';
import { realmMintFacts } from '../../../server-account/src/realm.js';

const all = () => true;
const seededRng = (seed) => { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const sword = (o = {}) => ({ group: 'Weapons', templateIndex: 120, material: 0, ...o });
const skills = (v = 50, at = {}) => Array.from({ length: 35 }, (_, i) => at[i] ?? v);
const setPiece = (templateIndex = 102) => ({ group: 'Armor', templateIndex, material: 0, sigil: { party: 1, xp: 0, set: SIGIL_SET_IDS[0] } });
const BLOW_SIGIL = Object.freeze({ party: 1, xp: 0, power: 5 });

test('EG-MIGHT THE LAW: a might is a whole per cent from 100 (none) to 1000 (ten times), its factor the purse\'s; per cents compose by product and clamp; the token\'s bounds are the law\'s (mutants: the top widened; a might under none taken; per cents added)', () => {
  assert.deepEqual([MIGHT_NONE, MIGHT_MOST], [100, 1000]);
  assert.deepEqual([TOKEN_MIGHT_MIN, TOKEN_MIGHT_MAX], [MIGHT_NONE, MIGHT_MOST], 'pinned equal (the token is a leaf)');
  for (const v of [99, 100, 101, 999, 1000, 1001, 250.5, '300', null, undefined, NaN]) assert.equal(mightIssuable(v), mightOk(v), String(v));
  assert.deepEqual([mightOk(100), mightOk(1000), mightOk(99), mightOk(1001), mightOk(150.5)], [true, true, false, false, false]);
  assert.deepEqual([mightX(400), mightX(null), mightX(5000)], [4, 1, 1]);
  assert.equal(mightOf([]), 100);
  assert.equal(mightOf([100, 50]), 300, '2 x 1.5');
  assert.equal(mightOf([900, 900]), 1000, 'clamped at the top');
  assert.equal(mightOf([-50]), 100, 'a price never lowers a might under none');
});

test('EG-MIGHT THE KIT\'S PARTS: a plain sword is no might; a weapon\'s own damage lines, a slayer line and a piece\'s own power (each Legendary once), a set by its most pieces, a weapon\'s sigil, a weapon skill\'s climb and gear lines, a martial path - each at most its registry\'s top; an unlawful piece is nothing (mutants: a Legendary counted twice; a set\'s pieces past six; a sigil on armour; the axe\'s climb at the sword\'s rate; the law\'s word ignored)', () => {
  assert.equal(kitMightOf({ items: [sword()], skills: skills() }, all), 100, 'a plain sword');
  assert.equal(kitMightOf({}, all), 100, 'no pack');
  const legend = sword({ rarity: 'legendary', legendary: 'nightwhisper', affixes: [{ id: 'damage', value: 30 }, { id: 'slayer', param: 'undead', value: 20 }] });
  const p = kitMightParts([legend, { ...legend }], skills(), all);
  assert.deepEqual([p.roll, p.loot], [30, KIT_POWER_PCT + 40], 'its own roll; one power for two copies, both slayer lines');
  assert.equal(kitMightOf({ items: [legend], skills: skills() }, all), Math.round(100 * 1.3 * 2.2));
  const gilded = sword({ rarity: 'gilded', gilded: GILDED_RECORDS[0].id });
  assert.equal(kitMightParts([legend, gilded, sword({ rarity: 'legendary', legendary: 'wyrmbane' })], skills(), all).loot, BLOW_TOPS.loot, 'three powers, at the loot\'s top');
  for (const [n, want] of [[1, 0], [2, BLOW_TOPS.sets / 3], [4, (2 * BLOW_TOPS.sets) / 3], [6, BLOW_TOPS.sets], [8, BLOW_TOPS.sets]]) {
    assert.ok(Math.abs(kitMightParts(Array.from({ length: n }, () => setPiece()), skills(), all).sets - want) < 1e-9, `${n} pieces of a set`);
  }
  assert.equal(KIT_SET_PIECES, 6);
  assert.equal(kitMightParts([sword({ sigil: BLOW_SIGIL })], skills(), all).sigil, BLOW_TOPS.sigil, 'a weapon\'s sigil');
  assert.equal(kitMightParts([{ ...setPiece(), sigil: BLOW_SIGIL }], skills(), all).sigil, 0, 'never an armour\'s');
  const climb = effectiveSkill(200) - SKILL_SOFT_CAP;
  assert.ok(climb > 0);
  assert.equal(kitMightParts([], skills(50, { [SKILLS.LongBlade]: 200 }), all).mastery, climb * KIT_CLIMB_PCT, 'a sword\'s climb');
  assert.equal(kitMightParts([], skills(50, { [SKILLS.Axe]: 200 }), all).mastery, climb * KIT_CLIMB_HALF_PCT, 'an axe\'s, twice the sword\'s');
  const ring = { group: 'Jewellery', templateIndex: 133, affixes: [{ id: 'skill', param: SKILLS.Axe, value: 30 }, { id: 'skill', param: SKILLS.Axe, value: 20 }] };
  assert.ok(Math.abs(kitMightParts([ring], skills(), all).mastery - 50 * KIT_GEAR_PER_POINT) < 1e-9, 'the gear lines on one weapon skill');
  assert.equal(kitMightParts([], skills(), all, { martial: true }).martial, BLOW_TOPS.martial);
  assert.equal(kitMightOf({ items: [legend], skills: skills(), martialPath: 'warden' }, all), Math.round(100 * 1.3 * 2.2 * 1.4));
  assert.equal(kitMightOf({ items: [legend], skills: skills() }, (it) => it !== legend), 100, 'a piece the law refuses arms nothing');
  // the shapes the producers mint: a rolled Legendary and a Gilded record carry their power
  const rng = seededRng(7);
  const rolled = applyRarity(createWeapon(120, 1), 'legendary', rng);
  assert.equal(typeof rolled.legendary, 'string', 'a rolled Legendary names its record');
  assert.ok(kitMightParts([rolled], skills(), all).loot >= KIT_POWER_PCT, 'its power read');
  assert.ok(kitMightParts([mintGilded(GILDED_RECORDS[0])], skills(), all).loot >= KIT_POWER_PCT, 'a Gilded record\'s power read');
  const everything = [legend, gilded, ...Array.from({ length: 6 }, () => setPiece()), sword({ sigil: BLOW_SIGIL }), ring];
  assert.equal(kitMightOf({ items: everything, skills: skills(50, { [SKILLS.Axe]: 200 }), martialPath: 'warden' }, all), MIGHT_MOST, 'a whole kit, at the top');
});

test('EG-MIGHT THE NUMBERS IT READS ARE THE CLIENT\'S: WEAPON-GEAR\'s and MARTIAL2\'s rates equal weaponMastery.js\'s, and KIT_POWER_PCT is the strongest power any Legendary or Gilded record carries (mutants: a rate drifted; a power stronger than the kit reads)', () => {
  assert.deepEqual([KIT_GEAR_PER_POINT, KIT_GEAR_PCT_MOST, KIT_CLIMB_PCT, KIT_CLIMB_HALF_PCT], [WEAPON_GEAR_PER_POINT, WEAPON_GEAR_PCT_MOST, WEAPON_POTENCY_PER_POINT * 100, WEAPON_HALF_PER_POINT * 100]);
  const pcts = [...Object.values(LEGENDARY_POWERS), ...GILDED_RECORDS.map((r) => r.power)].map((p) => Math.max(Number(p?.pct) || 0, Number(p?.share) || 0));
  assert.equal(Math.max(...pcts), KIT_POWER_PCT);
});

test('EG-MIGHT THE JUDGE AND THE MINT: a judged save carries its kit\'s might, a refused piece left out; the mint grows it by the Renown\'s sky (the Firmament\'s top at full Renown), never past the top, and signs nothing for no judged kit (mutants: the might not judged; the sky at every Renown\'s whole; the top passed)', () => {
  const gilded = mintGilded(GILDED_RECORDS[0]);
  const judged = judgeSave({ items: [gilded], skills: skills() });
  assert.ok(judged.might > MIGHT_NONE, `the Gilded piece judged lawful and its might signed (${judged.might})`);
  assert.equal(judged.might, kitMightOf({ items: [gilded], skills: skills() }, all));
  const forged = { ...gilded, affixes: [...gilded.affixes, { id: 'damage', value: 400 }] };
  assert.equal(judgeSave({ items: [forged], skills: skills() }).might, MIGHT_NONE, 'the law refuses the forged line, and its power with it');
  assert.equal(judgeSave(null).might, MIGHT_NONE);
  assert.equal(firmamentPart(RENOWN_MAX, RENOWN_MAX), BLOW_TOPS.firmament);
  assert.equal(firmamentPart(RENOWN_MAX / 2, RENOWN_MAX), BLOW_TOPS.firmament / 2);
  assert.deepEqual([firmamentPart(0, RENOWN_MAX), firmamentPart(undefined, RENOWN_MAX), firmamentPart(99, RENOWN_MAX)], [0, 0, BLOW_TOPS.firmament]);
  assert.deepEqual([mightSigned(100, 0, RENOWN_MAX), mightSigned(100, RENOWN_MAX, RENOWN_MAX), mightSigned(260, 25, RENOWN_MAX), mightSigned(900, RENOWN_MAX, RENOWN_MAX)], [100, 150, 325, 1000]);
  assert.deepEqual([mightSigned(null, 10, RENOWN_MAX), mightSigned(50, 10, RENOWN_MAX), mightSigned(2000, 10, RENOWN_MAX)], [null, null, null]);
  const src = readFileSync(new URL('../../../server-account/src/index.js', import.meta.url), 'utf8');
  assert.match(src, /const mg = rc \? mightSigned\(facts\.km, lv, RENOWN_MAX\) : null;/);
  assert.match(src, /\.\.\.\(mg != null \? \{ mg \} : \{\}\)/);
});

test('EG-MIGHT THE MINT, THROUGH THE ACCOUNT WORKER: a judged checkpoint keeps its kit\'s might on the row, and the token signs it grown by the Renown\'s sky - a forged piece adds nothing; none before a judged checkpoint, none to another account, none named (mutants: the verdict not writing it; the mint not reading it; the sky not added)', async (t) => {
  t.mock.method(Date, 'now', () => ACCT_T0 * 1000);
  const { subtle } = globalThis.crypto;
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
  const claimsOf = async (body, secret = who.secret) => {
    const r = await S.call('/v1/auth/token', body, secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const v = await verifyToken(r.body.token, S.identityPublic, { subtle, nowS: ACCT_T0 });
    assert.ok(v.ok, v.why);
    return v.claims;
  };
  const row = () => raw.prepare('SELECT might FROM realm_characters WHERE id = ?').get(R.id).might;
  const gilded = mintGilded(GILDED_RECORDS[0]);
  await checkpoint([gilded]);
  const kit = row();
  assert.equal(kit, kitMightOf({ items: [gilded] }, all), 'the judged kit\'s might, on the row');
  assert.ok(kit > MIGHT_NONE);
  const renown = (await claimsOf({ character: R.id })).lv;
  assert.ok(Number.isSafeInteger(renown) && renown >= 1);
  assert.equal((await claimsOf({ character: R.id })).mg, mightSigned(kit, renown, RENOWN_MAX), 'signed, grown by the Renown\'s sky');
  await checkpoint([{ ...gilded, affixes: [...gilded.affixes, { id: 'damage', value: 400 }] }]);
  assert.equal(row(), MIGHT_NONE, 'a forged piece adds nothing');
  raw.prepare('UPDATE realm_characters SET might = NULL WHERE id = ?').run(R.id);
  assert.equal('mg' in (await claimsOf({ character: R.id })), false, 'no judged checkpoint since EG-MIGHT');
  raw.prepare('UPDATE realm_characters SET might = 400 WHERE id = ?').run(R.id);
  const B = await S.registered('Bran');
  assert.equal('mg' in (await claimsOf({ character: R.id }, B.secret)), false, 'another account naming it');
  assert.equal((await realmMintFacts({ db: S.env.DB }, B.id, R.id)).km, null);
  assert.equal((await realmMintFacts({ db: S.env.DB }, who.id, R.id)).km, 400);
  assert.equal('mg' in (await claimsOf({})), false, 'none named');
});

test('EG-MIGHT THE TOKEN AND THE SOCKET: `mg` is signed and read beside the realm\'s yes alone, in bounds; a breach member\'s socket carries it with its level, and nothing out of bounds (mutants: `mg` without the realm; out of bounds signed; the socket dropping it)', async () => {
  const { subtle } = globalThis.crypto;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_800_000_000;
  const base = { s: 'acct-0001', n: 'Mac', k: 'linked', rc: 1, ci: 'r0123456789abcdef0123' };
  const tok = await mintToken({ ...base, mg: 325 }, kp.privateKey, { subtle, nowS });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS });
  assert.equal(v?.claims?.mg ?? v?.mg, 325);
  await assert.rejects(mintToken({ ...base, rc: 0, ci: undefined, mg: 325 }, kp.privateKey, { subtle, nowS }), /refused/);
  await assert.rejects(mintToken({ ...base, mg: 1001 }, kp.privateKey, { subtle, nowS }), /refused/);
  assert.deepEqual(egTokenAtt({ cl: 10, mg: 325 }), { cl: 10, mg: 325 });
  assert.deepEqual(egTokenAtt({ cl: 0, mg: 50 }), {});
  assert.deepEqual(egTokenAtt({ mg: 1000 }), { mg: 1000 });
  const relay = readFileSync(new URL('../../../server/src/index.js', import.meta.url), 'utf8');
  assert.match(relay, /ci: c\.ci, wa: c\.wa, mg: c\.mg \};/, 'the verified token\'s claim read');
  assert.match(relay, /if \(egRoom\) Object\.assign\(charLv, egTokenAtt\(who\)\);/, 'onto a breach member\'s socket');
  assert.match(relay, /const w = egEnter\(B, a\.sub, r\.claims\.ez, lv, now, a\.mg\);/, 'and into its admission');
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
/** A solo member at level `lv` with might `mg` woken in the Court of circle `c` of `seed`, its lord awake; `cast` lands a
 *  spell of `d` on a body from beside it, one blow every 250 ms (the blow rate's four a second). */
function court(seed, c, lv, mg) {
  const h = egFirstHallOf(c) + egCirclePlan(seed, c).findIndex((p) => p.kind === 'court'), rng = seeded(seed), co = [['acct-0', 'M0', 1]];
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  B.pr = ''; B.dc = [];
  let now = T0 + EG_SEALED_MS + 100;
  egEnter(B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, now, mg);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 60 * 60_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  let pos = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z, y: spec.arrive.y ?? 0 };
  const step = () => { now += 250; egStep(B, now, [{ sub: 'acct-0', ...pos, dead: false, at: now }], rng); };
  for (let k = 0; k < 4 * 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  for (let k = 0; k < 4 * 30 && !egLordsAwake(B.F); k++) { pos = { sx: spec.x0 + spec.ring.x, z: spec.ring.z, y: spec.ring.y ?? 0 }; step(); }
  assert.ok(egLordsAwake(B.F), 'the lord woke in its ring');
  const lord = egLordsOf(B.F).find((L) => !egHas(L, EG_FL.mirror));
  let q = 1;
  const cast = (b, d) => { pos = { sx: spec.x0 + b.x + 1.5, z: b.z, y: b.y ?? 0 }; now += 250; return egBlow(B, 'acct-0', { k: 'hit', i: b.i, q: q++, d, r: HIT_KINDS.Spell }, pos, now).filter((f) => f.k === 'eland').reduce((s, f) => s + f.d, 0); };
  return { B, lord, cast, now: () => now };
}
/** What a member lands a second once its purse's depth is spent: the last 40 blows' words over their 10 s - on its lord made
 *  too big to fall or turn a phase in the while, so the purse alone decides. */
function sustained(C) {
  C.lord.max = C.lord.hp = 1e12;
  for (let k = 0; k < 120; k++) C.cast(C.lord, 50_000);   // the depth spent (30 s at four blows a second)
  let landed = 0;
  for (let k = 0; k < 40; k++) landed += C.cast(C.lord, 50_000);
  return landed / 10;
}

test('EG-MIGHT THE REPORT, ON THE DIRECTOR\'S OWN BREACH: a level-10 member with no might lands 45 a second once its purse is spent (3 x (5 + 10) - the report\'s 45); with a signed might of 400 it lands four times that, its purse full at its might\'s depth, and its lord holds twice the health (the might\'s root) - so the kill is twice as fast, never four times; a newer token\'s might is the member\'s (mutants: the might never reaching the purse; the health at the might\'s whole; the depth not grown; a re-entry keeping the old might)', () => {
  const lv = 10, ref = dpsRef(lv);
  const plain = court(1, 1, lv, null), geared = court(1, 1, lv, 400);
  const pl = plain.lord.max, gl = geared.lord.max;
  assert.ok(Math.abs(sustained(plain) - BUCKET_RATE_X * ref) <= 1, `${BUCKET_RATE_X * ref} a second at level ${lv}, whatever was claimed`);
  assert.ok(Math.abs(sustained(geared) - BUCKET_RATE_X * ref * 4) <= 2, 'four times, at a might of 400');
  const fresh = court(1, 1, lv, 400);
  assert.ok(fresh.B.mem['acct-0'].bucket <= BUCKET_DEPTH_X * ref * 4 + 1e-6 && fresh.B.mem['acct-0'].bucket > BUCKET_DEPTH_X * ref * 2, 'its purse filled at its might\'s depth');
  assert.equal(EG_MIGHT_HEALTH_EXP, 0.5);
  assert.ok(Math.abs(pl - egTtkRef(1) * ref) < 1, 'the plain member\'s lord holds circle 1\'s reference');
  assert.ok(Math.abs(gl / pl - 2) < 1e-6, `the geared member's twice (${gl} of ${pl})`);
  assert.deepEqual([egPurseX(400), egHealthRef(lv, 400) / ref, egHealthRef(lv, null) / ref], [4, 2, 1]);
  // a re-entry (a reload, the next circle's room) takes the newest token's might, and a token with none takes none
  egEnter(geared.B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, geared.now(), 250);
  assert.equal(geared.B.mem['acct-0'].mg, 250);
  egEnter(geared.B, 'acct-0', 'ordacct-0'.padEnd(20, 'x'), lv, geared.now(), 5000);
  assert.equal(geared.B.mem['acct-0'].mg, null, 'out of bounds is none');
});

test('EG-MIGHT THE SHARES: a lord\'s shares are counted at each member\'s might\'s root - the hall\'s own as the team was, a newcomer\'s through the seam and by the law, each at the lord\'s fraction (mutants: a share without it; a newcomer without it; the seam dropping it)', () => {
  const lv = 10;
  const G = court(1, 1, lv, 400), L = G.lord, F = G.B.F;
  const max0 = L.max;
  egLordsShare(F, 'acct-n', lv, true, 400);
  assert.ok(Math.abs(L.fs['acct-0'].share - L.per * egHealthRef(lv, 400)) < 1e-6, 'the hall\'s own member, at its might\'s root');
  assert.ok(Math.abs(L.fs['acct-0'].share - max0) < 1e-6, 'its share is the whole it was stood for');
  assert.ok(Math.abs(L.max - max0 - L.per * egHealthRef(lv, 400)) < 1e-6, 'a newcomer of might 400 brings twice the reference');
  const max1 = L.max;
  EG_SEAM.join(egLordsFight(F, null, {}, G.now()), 'acct-m', 'Mm', lv, G.now(), null, { admits: true, mg: 900 });
  assert.ok(Math.abs(L.max - max1 - L.per * egHealthRef(lv, 900)) < 1e-6, 'through the seam: three times the reference at 900');
  const max2 = L.max;
  EG_SEAM.join(egLordsFight(F, null, {}, G.now()), 'acct-z', 'Zz', lv, G.now(), null, { admits: true });
  assert.ok(Math.abs(L.max - max2 - L.per * dpsRef(lv)) < 1e-6, 'and none: the reference alone');
});

test('EG-MIGHT THE STAND-IN\'S WHOLE: grown by the most a might grows a breach\'s purse, so a geared spell is never held under it - 9,750, still under a bout\'s 10,000 (mutant: the whole not grown)', () => {
  assert.equal(STAND_IN_WHOLE, 975 * (MIGHT_MOST / MIGHT_NONE));
  assert.ok(STAND_IN_WHOLE < 10_000);
});
