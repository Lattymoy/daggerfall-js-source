// SERPENT5 (2026-10-15; bible/11-Multiplayer/Sea-Serpent.md section 17; Mac: "A gilded weapon to the serpent + a rare
// chance of a title/aura drop") - THE OLD COIL'S HONOURS: the title COILBREAKER one dealing ship's serpent kill in twenty
// and the aura THE MAELSTROM one in fifty, rolled by the account service on the kill's first write off its own draw (the
// Hour's law, server-account/src/sds.js), laid on the row (`serpent_honours`, migration 0119) and held for good; said and
// popped by the claim's carrier (net/serpent/serpentClaims.js); worn as every aura is, and drawn by the aura pass's ninth look
// (render/auraRing.js): a whirlpool of tide and foam at the feet, its arms drawn IN, a lip of breaking foam, a curl at the
// lip and spray thrown off it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { d1, standService } from '../../accountDb.mjs';
import { createGuest } from '../../../server-account/src/accounts.js';
import {
  claimSerpent, serpentHonoursRoll, SERPENT_HONOUR_TITLE, SERPENT_HONOUR_AURA, SERPENT_TITLE_CHANCE, SERPENT_AURA_CHANCE,
  SERPENT_HONOURS_SALT,
} from '../../../server-account/src/serpents.js';
import { SD_HONOURS_SALT } from '../../../server-account/src/sds.js';
import { titlesHeld, aurasHeld, auraRefusal, equipRefusal } from '../../../server-account/src/titles.js';
import { mintSerpentReceipt } from '../../../src/net/serpent/serpentReceipt.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64, TITLES, AURAS, mintToken, verifyToken } from '../../../src/net/identityToken.js';
import { readAura } from '../../../src/net/wire.js';
import { seededRng } from '../../../src/systems/wind/wind.js';
import { createSerpentClaims, SERPENT_CLAIM_TEXT, SERPENT_HONOUR_KEYS } from '../../../src/net/serpent/serpentClaims.js';
import { TITLE_TEXT, AURA_TEXT, AURA_PAINT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, COIL_SEA, COIL_TIDE, COIL_FOAM } from '../../../src/ui/playerBadge.js';
import {
  AURA_LOOK, AURA_GROUND_R, AURA_CLOCK_PERIOD, AURA_FS, MAELSTROM_R, MAELSTROM_EYE_R, MAELSTROM_ARMS, MAELSTROM_H,
  MAELSTROM_CURL_H, MAELSTROM_HZ, MAELSTROM_RGB, MAELSTROM_DROPS, maelstromRatesWhole, maelstromSpin, maelstromArmAngle, maelstromCrest, maelstromDropAt, MAELSTROM_SHADE, MAELSTROM_DROP_TOP,
} from '../../../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const T0 = 1_800_000_000;
const DAY = 363;
const CH = 'char-0001';
const TAU = Math.PI * 2;
let _handles = 0;
const member = async (db, { handle = true } = {}) => {
  const id = (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id;
  if (!handle) return { id, handle: null };
  const h = `Coil${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
const rowOf = (db, id) => db._raw.prepare('SELECT * FROM players WHERE id = ?').get(id);
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
/** A draw whose first write grants what is asked - one in a thousand at the rarest, so twenty thousand seeds hold one. */
const seedFor = (title, aura) => { for (let c = 1; c <= 20000; c++) { const h = serpentHonoursRoll(c); if (h.title === title && h.aura === aura) return c; } throw new Error(`no seed grants title ${title}, aura ${aura}`); };
/** The claim's own four-byte draw answered with `seed`, every other ask (the nonce) at random (sd9b's `rolling`). */
const rolling = (seed) => (b) => (b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b));
const receipt = (s, d, key, x = 'dealt') => mintSerpentReceipt({ d, b: 'sethrakul', s, c: 99, x, h: 4, l: 20 }, key, { subtle, nowS: T0 });
const claim = async (db, seed, who, r, pubKey) => claimSerpent({ db, nowS: T0 + 60, subtle, rand: rolling(seed) }, { ...who, serpent_honours: rowOf(db, who.id)?.serpent_honours ?? 0 }, { receipt: r, character: CH, name: who.handle }, pubKey);

// ── the roll ──────────────────────────────────────────────────────────

test('SERPENT5 THE ROLL: off the claim\'s own draw, its own stream (salted \'COIL\' - never the Hour\'s, never the hoard\'s): Coilbreaker one kill in twenty, The Maelstrom one in fifty, the two apart; the title first, then the aura (mutants: the chances; the salt the Hour\'s)', () => {
  assert.deepEqual([SERPENT_TITLE_CHANCE, SERPENT_AURA_CHANCE, SERPENT_HONOUR_TITLE, SERPENT_HONOUR_AURA], [1 / 20, 1 / 50, 1, 2]);
  assert.equal(SERPENT_HONOURS_SALT, 0x434f494c, '\'COIL\'');
  assert.notEqual(SERPENT_HONOURS_SALT, SD_HONOURS_SALT);
  const N = 60000;
  let t = 0, a = 0, both = 0;
  for (let c = 0; c < N; c++) {
    const h = serpentHonoursRoll(c);
    t += h.title; a += h.aura; both += h.title && h.aura;
  }
  assert.ok(Math.abs(t / N - 0.05) < 0.004, `title ${t / N}`);
  assert.ok(Math.abs(a / N - 0.02) < 0.003, `aura ${a / N}`);
  assert.ok(Math.abs(both / N - 0.001) < 0.0008, `both ${both / N} - the two apart`);
  const r = seededRng((7 ^ SERPENT_HONOURS_SALT) >>> 0);
  assert.deepEqual(serpentHonoursRoll(7), { title: r() < 0.05, aura: r() < 0.02 }, 'the title first, then the aura');
});

// ── the claim ─────────────────────────────────────────────────────────

test('SERPENT5 THE CLAIM: a dealing ship\'s first write rolls the grants off its own draw, lays them on the row (serpent_kills\' title and aura, players.serpent_honours) and answers them, `titleNew`/`auraNew` only for one not held before; a second claim of the kill rolls nothing; a ship that stood is granted none whatever its draw; a guest none (mutants: the grants to a ship that stood; laid by any claim; new when held; the row\'s bits unwritten)', async () => {
  const db = d1();
  const A = await member(db), B = await member(db), C = await member(db), G = await member(db, { handle: false });
  const { priv, pubKey } = await relayPair();
  const both = seedFor(true, true), none = seedFor(false, false), title = seedFor(true, false);
  const first = await claim(db, both, A, await receipt(A.id, DAY, priv), pubKey);
  assert.equal(first.recorded, true);
  assert.deepEqual([first.title, first.aura, first.titleNew, first.auraNew], [true, true, true, true], 'both, and both new');
  assert.equal(rowOf(db, A.id).serpent_honours, SERPENT_HONOUR_TITLE | SERPENT_HONOUR_AURA, 'laid on the row');
  assert.deepEqual({ ...db._raw.prepare('SELECT title, aura FROM serpent_kills WHERE day = ? AND account = ?').get(DAY, A.id) }, { title: 1, aura: 1 }, 'and on the kill\'s');
  const again = await claim(db, both, A, await receipt(A.id, DAY, priv), pubKey);
  assert.deepEqual([again.recorded, again.why, again.title], [false, 'claimed', undefined], 'once, whatever happens to it');
  const next = await claim(db, title, A, await receipt(A.id, DAY + 2, priv), pubKey);
  assert.deepEqual([next.title, next.aura, next.titleNew, next.auraNew], [true, false, false, false], 'a title held already: said, never new');
  assert.equal(rowOf(db, A.id).serpent_honours, 3, 'held for good');
  assert.deepEqual({ ...db._raw.prepare('SELECT title, aura FROM serpent_kills WHERE day = ? AND account = ?').get(DAY + 2, A.id) }, { title: 1, aura: 0 }, 'AUDIT WORLD-REWARDS E3: the kill\'s row says what IT granted, each its own column');
  const aura = seedFor(false, true);
  const third = await claim(db, aura, A, await receipt(A.id, DAY + 4, priv), pubKey);
  assert.deepEqual([third.title, third.aura, third.titleNew, third.auraNew], [false, true, false, false], 'AUDIT WORLD-REWARDS E1: an aura held already - said, never new');
  assert.deepEqual({ ...db._raw.prepare('SELECT title, aura FROM serpent_kills WHERE day = ? AND account = ?').get(DAY + 4, A.id) }, { title: 0, aura: 1 });
  const quiet = await claim(db, none, B, await receipt(B.id, DAY, priv), pubKey);
  assert.deepEqual([quiet.title, quiet.aura, quiet.titleNew, quiet.auraNew, rowOf(db, B.id).serpent_honours], [false, false, false, false, 0]);
  assert.equal((await claim(db, both, B, await receipt(B.id, DAY, priv), pubKey)).why, 'claimed');
  assert.equal(rowOf(db, B.id).serpent_honours, 0, 'a claim that wrote no row lays nothing, whatever its draw');
  const stood = await claim(db, both, C, await receipt(C.id, DAY, priv, 'stood'), pubKey);
  assert.deepEqual([stood.recorded, stood.title, stood.aura, rowOf(db, C.id).serpent_honours], [true, false, false, 0], 'a ship that stood: none, whatever its draw');
  const guest = await claim(db, both, G, await receipt(G.id, DAY, priv), pubKey);
  assert.deepEqual([guest.why, guest.title, rowOf(db, G.id).serpent_honours], ['guest', undefined, 0], 'a guest: never counted, never granted');
  assert.match(src('server-account/migrations/0119_serpent_honours.sql'), /^ALTER TABLE players ADD COLUMN serpent_honours INTEGER NOT NULL DEFAULT 0;$/m);
});

test('SERPENT5 HELD: Coilbreaker off the row\'s first bit, The Maelstrom off its second - a registered account\'s alone, each off its own bit; worn through the title\'s and the aura\'s doors (mutants: held off any bit; held by a guest)', () => {
  const row = (bits, handle = 'Coil') => ({ handle, serpent_honours: bits });
  assert.ok(titlesHeld(row(1)).includes('coilbreaker'));
  assert.ok(!titlesHeld(row(2)).includes('coilbreaker'), 'never off the aura\'s bit');
  assert.ok(!titlesHeld(row(3, null)).includes('coilbreaker'), 'never a guest\'s');
  assert.ok(aurasHeld(row(2)).includes('maelstrom'));
  assert.ok(!aurasHeld(row(1)).includes('maelstrom'), 'never off the title\'s bit');
  assert.ok(!aurasHeld(row(3, null)).includes('maelstrom'), 'never a guest\'s');
  assert.equal(equipRefusal('coilbreaker', row(1)), null, 'the title worn');
  assert.ok(equipRefusal('coilbreaker', row(0)), 'not held, not worn');
  assert.equal(auraRefusal('maelstrom', row(2)), null, 'the aura worn');
  assert.ok(auraRefusal('maelstrom', row(0)), 'not held, not worn');
});

test('SERPENT5 THE ROUTE (AUDIT WORLD-REWARDS E9): through the real Worker, the session\'s own row - /v1/serpent/claim answers the grants a forced draw rolls (title, aura, and both new), lays them on the row, and the next kill\'s answer reads the row the session resolved (held: never new); the account\'s held titles carry them', async () => {
  const s = await standService();
  const ann = await s.registered('Coilann', { character: CH });
  const P = Object.getPrototypeOf(globalThis.crypto), real = P.getRandomValues;
  const forced = (seed) => { P.getRandomValues = function (b) { if (b?.length === 4) { b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]); return b; } return real.call(this, b); }; };
  const serpent = async (day) => s.call('/v1/serpent/claim', { receipt: await mintSerpentReceipt({ d: day, b: 'sethrakul', s: ann.id, c: 99, x: 'dealt', h: 4, l: 20 }, s.gateKey, { subtle, nowS: Math.floor(Date.now() / 1000) }), character: CH, name: ann.handle }, ann.secret);
  try {
    forced(seedFor(true, true));
    const first = await serpent(DAY);
    assert.equal(first.status, 200);
    assert.deepEqual([first.body.recorded, first.body.title, first.body.aura, first.body.titleNew, first.body.auraNew], [true, true, true, true, true], 'the route passes the grants through');
    const next = await serpent(DAY + 2);
    assert.deepEqual([next.body.recorded, next.body.title, next.body.aura, next.body.titleNew, next.body.auraNew], [true, true, true, false, false], 'the session\'s row resolved: held, never new');
  } finally { P.getRandomValues = real; }
  const row = s.env.DB._raw.prepare('SELECT * FROM players WHERE id = ?').get(ann.id);
  assert.equal(row.serpent_honours, 3);
  assert.ok(titlesHeld(row).includes('coilbreaker') && aurasHeld(row).includes('maelstrom'), 'held off the row the session reads');
});

// ── the vocabulary and the badge ──────────────────────────────────────

test('SERPENT5 THE VOCABULARY: Coilbreaker last of TITLES, The Maelstrom last of AURAS; their words; the title drawn the open sea into the tide into the foam, edged in black, its one colour the tide\'s and no other title\'s; the Maelstrom\'s button in its paint; both signed into a token and kept by the wire (mutants: the word; the paint)', async () => {
  assert.equal(TITLES.at(-25) /* PIN MOVED (NIRNROOT-SAGE): the Nirnroot Sage joined the list last */ /* PIN MOVED (KETCH): the Skyfarer joined the list last */ /* PIN MOVED (WITCH1): Witchwarden and Hearthkeeper joined the list last */ /* PIN MOVED (STAR8): the Starwarden joined the list after the questlines' five, before the festival's two */, 'coilbreaker');   // PIN MOVED (QL12): the questlines' five joined the list last, after the WikiMaid; PIN MOVED (EG-E2, the merges of main): the Spire's thirteen after it; PIN MOVED (WIKIMAID): the WikiMaid joined the list last
  assert.equal(AURAS.at(-7) /* PIN MOVED (NIRNROOT-SAGE): Sage's Smoke joined the list last */ /* PIN MOVED (WITCH1): Witchfire joined the list last */, 'maelstrom');   // PIN MOVED (EG-E2, the merges of main): the Spire's three after it; PIN MOVED (WIKIMAID): the Lilac Warren joined the list last
  assert.deepEqual([TITLE_TEXT.coilbreaker, AURA_TEXT.maelstrom], ['Coilbreaker', 'The Maelstrom']);
  assert.equal(TITLE_RGBA.coilbreaker, COIL_TIDE);
  assert.deepEqual(TITLE_GRADIENT.coilbreaker, [COIL_SEA, COIL_TIDE, COIL_FOAM]);
  assert.deepEqual(TITLE_EDGE.coilbreaker, [0, 0, 0, 1]);
  for (const [k, c] of Object.entries(TITLE_RGBA)) if (k !== 'coilbreaker') assert.notDeepEqual([...c], [...COIL_TIDE], `${k} wears another colour`);
  assert.equal(AURA_PAINT.maelstrom, 'coilbreaker');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-0001', n: 'Coil', k: 'linked', t: 'coilbreaker', au: 'maelstrom' }, kp.privateKey, { subtle, nowS: T0 });
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS: T0 + 1 });
  assert.ok(v.ok, `the token verifies: ${v.why ?? ''}`);
  assert.deepEqual([v.claims.t, v.claims.au], ['coilbreaker', 'maelstrom']);
  assert.equal(readAura({ au: 'maelstrom' }), 'maelstrom', 'the wire keeps it');
});

// ── the carrier ───────────────────────────────────────────────────────

test('SERPENT5 THE CARRIER: a counted kill\'s grants said whenever it granted one, popped (the loot banner\'s honour door) only when new - a service from before acct137 says neither; a hook that throws is the page\'s (mutants: popped when held; the keys)', async () => {
  const { priv } = await relayPair();
  const A = 'acct-0001';
  const run = async (data, announce) => {
    const said = [], popped = [];
    const store = new Map();
    const c = createSerpentClaims({
      claim: async () => ({ ok: true, data: { recorded: true, slain: 1, renown: { credited: 0 }, spoils: false, ...data } }),
      store: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) }, nowS: () => T0, me: () => A,
      say: (t) => said.push(t), announce: announce ?? ((kind, key) => popped.push([kind, key])),
    });
    assert.equal(c.add(await mintSerpentReceipt({ d: DAY, b: 'sethrakul', s: A, c: 1, x: 'dealt', h: 4, l: 20 }, priv, { subtle, nowS: T0 }), CH, 'Coil', 20), true);
    await c.flush();
    return { said, popped };
  };
  assert.deepEqual(SERPENT_HONOUR_KEYS, { title: 'coilbreaker', aura: 'maelstrom' });
  assert.ok(TITLES.includes(SERPENT_HONOUR_KEYS.title) && AURAS.includes(SERPENT_HONOUR_KEYS.aura), 'the vocabulary\'s spelling');
  const fresh = await run({ title: true, aura: true, titleNew: true, auraNew: true });
  assert.ok(fresh.said.includes(SERPENT_CLAIM_TEXT.title()) && fresh.said.includes(SERPENT_CLAIM_TEXT.aura()));
  assert.deepEqual(fresh.popped, [['title', 'coilbreaker'], ['aura', 'maelstrom']]);
  const held = await run({ title: true, aura: false, titleNew: false, auraNew: false });
  assert.ok(held.said.includes(SERPENT_CLAIM_TEXT.title()) && !held.said.includes(SERPENT_CLAIM_TEXT.aura()));
  assert.deepEqual(held.popped, [], 'held already: said, never popped');
  const heldAura = await run({ title: false, aura: true, titleNew: false, auraNew: false });
  assert.ok(heldAura.said.includes(SERPENT_CLAIM_TEXT.aura()) && !heldAura.said.includes(SERPENT_CLAIM_TEXT.title()));
  assert.deepEqual(heldAura.popped, [], 'AUDIT WORLD-REWARDS E1: an aura held already - said, never popped');
  const old = await run({});
  assert.ok(!old.said.includes(SERPENT_CLAIM_TEXT.title()) && !old.said.includes(SERPENT_CLAIM_TEXT.aura()) && old.popped.length === 0, 'a service from before acct137: nothing (AUDIT WORLD-REWARDS E2: the aura\'s line neither)');
  await run({ titleNew: true }, () => { throw new Error('the page\'s'); });   // never the carrier's
  assert.match(src('src/scenes/world.js'), /createSerpentClaims\(\{[\s\S]{0,900}announce: \(kind, key\) => announceHonour\(kind, key\),   \/\/ SERPENT5/);
});

// ── the look ──────────────────────────────────────────────────────────

test('SERPENT5 THE LOOK\'S LAW: the ninth kind, added whole (no shade, no mesh, no symbols), its strip at the pool\'s lip to the spray\'s reach; its colours the Coilbreaker\'s; every rate whole over the clock; the pool turns clockwise as the eye sees it and its arms draw IN (mutants: the kind; the turn)', () => {
  assert.deepEqual({ ...AURA_LOOK.maelstrom }, { kind: 8, ringR: MAELSTROM_R, flameH: MAELSTROM_H, glyphs: 0 });
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, Object.keys(AURA_LOOK).length, 'every look its own kind');
  assert.ok(MAELSTROM_R < AURA_GROUND_R && MAELSTROM_EYE_R < MAELSTROM_R && MAELSTROM_CURL_H < MAELSTROM_H);
  const shade = (c) => c.slice(0, 3).map((x) => Math.round(x * MAELSTROM_SHADE * 1000) / 1000);
  assert.equal(MAELSTROM_SHADE, 0.72, 'AUDIT WORLD-REWARDS D1: The First Hour\'s shade (FIRST_SHADE) - the foam never washes out to white over a lit floor');
  assert.deepEqual(MAELSTROM_RGB, { sea: shade(COIL_SEA), tide: shade(COIL_TIDE), foam: shade(COIL_FOAM) });
  assert.ok(maelstromRatesWhole());
  assert.ok(Math.abs(Math.abs(maelstromSpin(AURA_CLOCK_PERIOD)) - TAU * MAELSTROM_HZ.spin * AURA_CLOCK_PERIOD) < 1e-9 && Number.isInteger(MAELSTROM_HZ.spin * AURA_CLOCK_PERIOD), 'whole turns over the clock');
  assert.ok(maelstromSpin(1) < maelstromSpin(0), 'its angle falls - clockwise on the screen');
  // the arms draw in: the angle an arm holds at r is held at a smaller r a moment later
  for (const r of [0.3, 0.5, 0.7]) {
    const a = maelstromArmAngle(r, 10);
    let inner = null;
    for (let rr = r; rr > 0.05; rr -= 0.0005) { const d = maelstromArmAngle(rr, 10.5) - a; if (Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.002) { inner = rr; break; } }
    assert.ok(inner !== null && inner < r, `an arm at ${r} m is nearer the eye half a second on (${inner})`);
  }
  assert.match(AURA_FS, /if \(uAura == 8\) \{ vec3 c = uKind == 0 \? maelstromGround\(vP\) : maelstromWall\(vP\);/);
  // AUDIT WORLD-REWARDS D2: never a pow of a negative - GLSL leaves it undefined, and the interpreter's Math.pow answers a
  // negative base with an even exponent as a positive number, so only the source can hold the guard (AUDIT SD II's law)
  assert.match(AURA_FS, /float maelstromArm\(float r, float a\) \{[\s\S]{0,260}return pow\(max\(0\.5 \+ 0\.5 \* cos\(ph\), 0\.0\), /);
  assert.equal(MAELSTROM_DROP_TOP, 0.9, 'AUDIT WORLD-REWARDS D4: a drop\'s arc tops out inside the strip');
});

const at = (kind, vP, { t = 30.5, kindle = 1 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: [0, 0, 0], uKind: kind, uAura: 8, uTime: t, uSeed: 0, uKindle: kindle, uRingR: AURA_LOOK.maelstrom.ringR, uGroundR: AURA_GROUND_R,
    uFlameH: MAELSTROM_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uResLit: Array(48).fill(0), dFdx: () => [0.001, 0, 0], dFdy: () => [0, 0.001, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

test('SERPENT5 THE POOL, the shader RUN: foam where its arms stand at the clock\'s own turn and the sea\'s light between them; every arm round; the eye empty; the lip a ring of foam; the arms move on with the clock; unkindled nothing; the middle never a NaN, the corners round (mutants: the arms\' turn; the eye filled)', () => {
  for (const t of [30.5, 61.25, 97.8]) {
    for (const r of [0.3, 0.5, 0.7]) {
      for (let k = 0; k < MAELSTROM_ARMS; k++) {
        const a = maelstromArmAngle(r, t, k);
        const on = lum(at(0, polar(r, a), { t })), off = lum(at(0, polar(r, a + Math.PI / MAELSTROM_ARMS), { t }));
        assert.ok(on > off + 0.8, `arm ${k} at ${r} m, ${t} s (${on.toFixed(3)} vs between's ${off.toFixed(3)})`);
      }
    }
  }
  const a = maelstromArmAngle(0.5, 30.5);
  assert.ok(lum(at(0, polar(0.5, a), { t: 31.5 })) < lum(at(0, polar(0.5, a), { t: 30.5 })) - 0.5, 'a second on, the arm has moved from where it stood');
  assert.ok(lum(at(0, polar(0.5, maelstromArmAngle(0.5, 31.5)), { t: 31.5 })) > 1, 'and stands where the clock says');
  for (let i = 0; i < 12; i++) {
    const lip = lum(at(0, polar(MAELSTROM_R, (i / 12) * TAU))), past = lum(at(0, polar(MAELSTROM_R + 0.1, (i / 12) * TAU)));
    assert.ok(lip > past + 0.12, `the lip's foam at ${i}/12 (${lip.toFixed(3)} over the water past it, ${past.toFixed(3)})`);
  }
  // AUDIT WORLD-REWARDS E5: the surf RUNS round the lip - the same place on the lip breaks and eases with the clock
  let surf = 0;
  for (let i = 0; i < 12; i++) { const p = polar(MAELSTROM_R, (i / 12) * TAU); surf = Math.max(surf, Math.abs(lum(at(0, p, { t: 30.5 })) - lum(at(0, p, { t: 31.25 })))); }
  assert.ok(surf > 0.1, `the surf runs round the lip (${surf.toFixed(3)})`);
  for (let i = 0; i < 24; i++) assert.ok(lum(at(0, polar(0.08, (i / 24) * TAU))) < 0.02, `the eye: open water (${i}/24)`);
  assert.equal(lum(at(0, polar(0.5, a), { kindle: 0 })), 0, 'unkindled: nothing');
  assert.ok(at(0, [0, 0]).every((x) => Number.isFinite(x)), 'the middle, never a NaN');
  assert.throws(() => at(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8]), GlslDiscard, 'the quad\'s corners are round');
});

test('SERPENT5 THE CURL AND THE SPRAY, the shader RUN: the curl\'s crest of foam at the lip, riding the arms round - higher under an arm than between; water under it, nothing over it but spray; the spray rises the wall\'s height and falls; kindled up from the feet (mutants: no spray; kindled down)', () => {
  const t = 30.5, w = (u) => u * TAU;
  const crestAt = (u) => MAELSTROM_CURL_H * (0.7 + 0.3 * Math.cos(MAELSTROM_ARMS * (w(u) - maelstromSpin(t))));
  const uArm = (((maelstromSpin(t) / TAU) % 1) + 1) % 1, uGap = uArm + 0.5 / MAELSTROM_ARMS;
  assert.ok(crestAt(uArm) > crestAt(uGap) + 0.05, 'under an arm the curl stands higher');
  for (const u of [uArm, uGap]) {
    const c = crestAt(u);
    assert.ok(lum(at(1, [u, c / MAELSTROM_H], { t })) > 1, `the crest's foam at ${u.toFixed(3)}`);
    assert.ok(lum(at(1, [u, (c * 0.6) / MAELSTROM_H], { t })) > 0.05, 'water under it');
  }
  // the spray: somewhere over the curl, at some moment, a drop
  let high = 0;
  for (let i = 0; i < 160; i++) for (const tt of [10, 20, 30, 40]) if (lum(at(1, [i / 160, 0.6], { t: tt + i * 0.013 })) > 0.3) high++;
  assert.ok(high > 0, `spray over the curl (${high})`);
  // AUDIT WORLD-REWARDS E5: each drop where maelstromDropAt says - carried round WITH the pool, up off the crest and down
  let drops = 0;
  for (const tt of [12.3, 47.9, 88.1]) {
    for (let m = 0; m < MAELSTROM_DROPS; m++) {
      const d = maelstromDropAt(m, tt);
      if (d.life < 0.15 || d.life > 0.6) continue;
      const c = maelstromCrest(d.u, tt), hy = c + (MAELSTROM_H * MAELSTROM_DROP_TOP - c) * 4 * d.life * (1 - d.life);
      assert.ok(lum(at(1, [d.u, hy / MAELSTROM_H], { t: tt })) > 0.3, `drop ${m} at ${tt} s where the pool has carried it`);
      drops++;
    }
  }
  assert.ok(drops > 10, `drops sampled (${drops})`);
  const crestV = crestAt(uArm) / MAELSTROM_H;
  assert.equal(lum(at(1, [uArm, crestV], { t, kindle: 0.1 })), 0, 'kindled up from the feet: a tenth kindled, not yet at the crest');
  assert.ok(lum(at(1, [uArm, crestV * 0.3], { t, kindle: 0.1 })) > 0, 'but at the feet already');
});
