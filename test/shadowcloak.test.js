// SHADOW-CLOAK — SIRMCMOBDON'S OWN AURA: THE HOLO SHADOW CLOAK (2026-10-04).
//
// The owner: "So for SirMcMobdon, I want to build a new unique AURA specifically for his account. A holo shadow cloak
// with red accents. Extremely detailed". SirMcMobdon already holds Shadow Fang (SHADOW-FANG: the black-and-crimson
// title, the wolf's-head glyph, the werewolf's skin), so the cloak rides the same handle list - the third list to grant
// an aura (TIER_AURA) - and wears the title's own black and crimson. It is the aura pass's fourth look
// (render/auraRing.js AURA_LOOK): not a mark on the ground nor light round the body but a CLOAK ON IT. Seen, the owner
// asked for it "less digital", its hood "at a weird orientation" adjusted, "not as tall, more cape like", and its
// floating elements "more emblem like" - "for the emblems have it use that user's glyph" - and "when the user transforms
// into a werewolf have this rip apart with fragments floating around". So: a cape clasped at the throat with its hood
// up round the head, open at the wearer's front (the facing every host hands the pass), lined in red, embroidered,
// drawn premultiplied so its shadow darkens what is behind it; the wearer's glyph on its back, at its clasp and rising
// off it; a pool of shadow under it; torn apart when its wearer turns beast, its shreds floating round them. Its shader
// is RUN here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { AURA_TEXT, AURA_PAINT, TITLE_GRADIENT, GLYPH_PATH, GLYPH_DETAIL } from '../src/ui/playerBadge.js';
import { isStaff } from '../src/net/staffCommands.js';
import {
  titlesHeld, glyphsOf, titleWorn, aurasHeld, auraWorn, auraRefusal, wardrobeOf, TIER_LISTS, TIER_GLYPH, TIER_AURA,
} from '../server-account/src/titles.js';
import { RELAY_VERSION } from '../src/net/wire.js';
import { peerBodyYaw } from '../src/net/peerClimb.js';
import { CAPSULE_HEIGHT, EYE_HEIGHT } from '../src/player/motor.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_RING_R, AURA_GROUND_R, AURA_LIFT_M, AURA_STEPS, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS, AURA_CARDS,
  CLOAK_H, CLOAK_HOOD_Y, CLOAK_NECK_Y, CLOAK_CLASP_Y, CLOAK_SHOULDER_Y, CLOAK_HEM_R, CLOAK_SHOULDER_R, CLOAK_NECK_R, CLOAK_HOOD_R,
  CLOAK_BACK_M, CLOAK_HOOD_BACK_M, CLOAK_PEAK_BACK_M, CLOAK_HEM_Y, CLOAK_SQUASH, CLOAK_ROUND, CLOAK_ROWS, CLOAK_OPEN, CLOAK_FACE,
  CLOAK_MANTLE_Y, CLOAK_POOL_R, CLOAK_GLYPH, CLOAK_GLYPH_EYE, CLOAK_SIGIL_Y, CLOAK_SIGIL_R, CLOAK_CLASP_R, CLOAK_EMBLEMS,
  CLOAK_EMBLEM_LIFE, CLOAK_RIP_S, CLOAK_SHREDS, CLOAK_SHRED_AT, CLOAK_SHRED_HZ, CLOAK_HZ, CLOAK_FLOW, CLOAK_RGB, cloakRatesWhole,
  auraCloakGrid, glyphEdges, auraBeastStep, AuraRingRenderer, WARD_GLYPHS, RADIANCE_R, RADIANCE_H,
  CLOAK_SWING, CLOAK_REST_POSE, CLOAK_ACROSS, CLOAK_HEAD_ABOVE, CLOAK_BONES, auraMotionStep, auraCapePose, auraCapeStep,
} from '../src/render/auraRing.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';
import { rigPointToBody, armBonesInBody, NIF_TO_PASS } from '../src/combat/fpArm.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { trs, multiply, transformPoint } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
/** The Worker's config as it reads it: every handle list. */
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;
const LATER = AFTER + 30 * 86_400;
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const rgb = (c) => [...c].slice(0, 3).map((x) => +x.toFixed(3));
const lum = (c) => c[0] + c[1] + c[2];
const TAU = 2 * Math.PI;

// ── THE VOCABULARY, THE GRANT, THE WIRE ─────────────────────────────

test('SHADOW-CLOAK vocabulary: the cloak joins AURAS after the radiance (SERAPH-WINGS\' wings after it), "Holo Shadow Cloak" in words, its button in the Shadow Fang\'s paint; a look of its own - the fourth kind, its own mesh, and it SHADES; its colours the title\'s own black and crimson (mutants: the word, the paint, the kind, the colour)', () => {
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings'], 'the Broker\'s fire, the ward, the radiance, then the cloak - SERAPH-WINGS\' wings after it (PIN MOVED)');
  assert.equal(AURA_TEXT.shadowcloak, 'Holo Shadow Cloak', 'the owner\'s words: "A holo shadow cloak"');
  assert.equal(AURA_PAINT.shadowcloak, 'shadowfang', 'its button in the Shadow Fang\'s black and crimson');
  assert.ok(TITLES.includes(AURA_PAINT.shadowcloak));
  for (const a of AURAS) assert.ok(Object.hasOwn(AURA_LOOK, a), `a look for ${a}`);
  assert.deepEqual({ ...AURA_LOOK.shadowcloak }, { kind: 3, ringR: CLOAK_HEM_R, flameH: CLOAK_H, glyphs: CLOAK_EMBLEMS, shreds: CLOAK_SHREDS, mesh: 'cloak', shade: true }, 'the fourth kind: the hem\'s radius, the hood\'s height, its emblems and its shreds, its own mesh, and a look that shades');
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  assert.equal(auraLookOf('shadowcloak'), AURA_LOOK.shadowcloak);
  for (const a of ['dagonfire', 'oblivionward', 'radiance']) assert.ok(!AURA_LOOK[a].shade && !AURA_LOOK[a].mesh, `${a} still adds its light whole, on the strip`);
  // the title's own gradient: the shadow its black end, the light its crimson end
  const [black, crimson] = TITLE_GRADIENT.shadowfang;
  assert.deepEqual(rgb(CLOAK_RGB.crimson), rgb(crimson), 'the light: the Shadow Fang\'s crimson');
  assert.deepEqual(rgb(CLOAK_RGB.shadow), rgb(black), 'the shadow: the Shadow Fang\'s black');
  assert.ok(CLOAK_RGB.crimson[0] > 3 * CLOAK_RGB.crimson[1] && CLOAK_RGB.crimson[0] > 3 * CLOAK_RGB.crimson[2], 'red accents: red over everything');
  assert.ok(CLOAK_RGB.ember[0] >= CLOAK_RGB.ember[1] && CLOAK_RGB.ember[1] >= CLOAK_RGB.ember[2] && lum(CLOAK_RGB.ember) > lum(CLOAK_RGB.crimson), 'where it burns brightest an ember\'s red - no hot pink');
  assert.ok(CLOAK_RGB.lining[0] > 4 * CLOAK_RGB.lining[1] && lum(CLOAK_RGB.lining) < lum(CLOAK_RGB.crimson), 'lined in a deeper red');
});

test('SHADOW-CLOAK grant: SHADOW_FANG_HANDLES still names SirMcMobdon, and the list now grants the cloak with the title and the glyph, case-folded; worn while held, read off the config alone; off the list all three go, a guest holds none, the other lists\' holders hold their own and not it (mutants: the aura\'s grant, the list\'s key)', () => {
  assert.equal(v('SHADOW_FANG_HANDLES'), 'SirMcMobdon');
  assert.equal(TIER_LISTS.shadowfang, 'SHADOW_FANG_HANDLES');
  assert.equal(TIER_GLYPH.shadowfang, 'shadowfang');
  assert.equal(TIER_AURA.shadowfang, 'shadowcloak', 'the third list to grant an aura');
  for (const h of ['SirMcMobdon', 'sirmcmobdon', 'SIRMCMOBDON']) {
    const p = row(h);
    assert.deepEqual(titlesHeld(p, ENV), ['shadowfang'], `${h}: the title, by name, case-folded`);
    assert.deepEqual(glyphsOf(p, ENV, LATER), ['shadowfang'], 'and its glyph');
    assert.deepEqual(aurasHeld(p, ENV), ['shadowcloak'], 'and the cloak');
    assert.equal(auraRefusal('shadowcloak', p, ENV), null, 'theirs to wear');
  }
  const sir = row('SirMcMobdon', { title: 'shadowfang', aura: 'shadowcloak' });
  assert.equal(titleWorn(sir, ENV), 'shadowfang');
  assert.equal(auraWorn(sir, ENV), 'shadowcloak');
  assert.equal(auraWorn(sir), undefined, 'without the config, the Broker\'s alone - the cloak is a list\'s');
  const both = row('SirMcMobdon', { insignia: 'aura:dagonfire', aura: 'dagonfire' });
  assert.deepEqual(aurasHeld(both, ENV), ['shadowcloak', 'dagonfire'], 'the list\'s first, then what the Broker sold');
  const w = wardrobeOf(sir, ENV, LATER);
  assert.deepEqual([w.titles, w.title, w.glyphs, w.auras, w.aura], [['shadowfang'], 'shadowfang', ['shadowfang'], ['shadowcloak'], 'shadowcloak'], 'the account card\'s whole answer');
  const off = { ...ENV, SHADOW_FANG_HANDLES: '' };
  assert.deepEqual([titlesHeld(sir, off), glyphsOf(sir, off, LATER), aurasHeld(sir, off)], [[], [], []], 'off the list, all three go');
  assert.equal(auraWorn(sir, off), undefined, 'and the cloak is not worn by a row nobody cleared');
  assert.equal(auraRefusal('shadowcloak', sir, off), 'not-held');
  assert.deepEqual(aurasHeld({ ...sir, handle: null }, ENV), [], 'a guest holds none');
  assert.deepEqual(aurasHeld(row('Sureme'), ENV), ['oblivionward'], 'Sureme holds the ward and not the cloak');
  assert.deepEqual(aurasHeld(row('GA00250'), ENV), ['radiance'], 'GA00250 the radiance and not the cloak');
  for (const h of ['Diggleborf', 'Dutchess', 'SquidKamer', 'SirMcMobdo', 'SirMcMobdonn', 'Mobdon']) {
    assert.deepEqual(aurasHeld(row(h), ENV), [], `${h} holds no aura`);
    assert.equal(auraRefusal('shadowcloak', row(h), ENV), 'not-held');
  }
  assert.equal(isStaff(['shadowfang']), true, 'the Shadow Fang\'s staff right is the glyph\'s, as before - the cloak adds none');
});

test('SHADOW-CLOAK the service end to end: SirMcMobdon registers, holds the cloak beside the title; wears it through the aura door; the token signs it and says it beside; a stranger is refused it; off the list the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ SHADOW_FANG_HANDLES: 'SirMcMobdon' });
  const me = await registered('SirMcMobdon');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.equal('au' in m.claims, false, 'held and not worn: no aura signed until they put it on');
  let r = await call('/v1/account/aura', { aura: 'shadowcloak' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.auras, r.body.aura], [['shadowcloak'], 'shadowcloak'], 'the wardrobe answers it worn');
  m = await mint();
  assert.equal(m.claims.au, 'shadowcloak', 'signed');
  assert.equal(m.answer.aura, 'shadowcloak', 'and said beside the token, for their own back');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'shadowcloak' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the cloak');
  env.SHADOW_FANG_HANDLES = '';
  m = await mint();
  assert.equal('au' in m.claims, false, 'off the list: the next token carries no cloak');
});

test('SHADOW-CLOAK the account card: wearing the cloak, the card says its name - never its key (AUDIT)', async () => {
  const { AccountFlow } = await import('../src/ui/accountFlow.js');
  const { SESSION_KEY } = await import('../src/net/accountClient.js');
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-sir', name: 'SirMcMobdon', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const wardrobe = { titles: ['shadowfang'], title: 'shadowfang', glyphs: ['shadowfang'], auras: ['shadowcloak'], aura: null, insignia: [] };
  const answers = { '/v1/account': { account: { id: 'acct-sir', name: 'SirMcMobdon', kind: 'linked', handle: 'sirmcmobdon' }, wardrobe, devices: [] }, '/v1/account/aura': { ok: true, ...wardrobe, aura: 'shadowcloak' } };
  const fetch = async (url) => { const path = url.replace(/^https?:\/\/[^/]+/, ''); return { ok: true, status: 200, json: async () => answers[path] }; };
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  assert.equal(await flow.wearAura('shadowcloak'), true);
  assert.equal(flow.note, 'Wearing Holo Shadow Cloak.');
});

test('SHADOW-CLOAK token and relay: a token may carry the cloak and verifies; the relay - world167 and after, the ones that know the word - reads it out of the signature onto their row for everyone near (mutants: the vocabulary\'s aura)', async () => {
  assert.equal(RELAY_VERSION, 'world169', 'SHADOW-CLOAK moved it on (world167 - world165 on its branch, renumbered past SERPENT1 and SERPENT2 at the merges), SERAPH-WINGS after it (world168 - PIN MOVED), AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED): the vocabulary rides the relay\'s bundle');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', t: 'shadowfang', g: ['shadowfang'], au: 'shadowcloak' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.au, 'shadowcloak');
  assert.equal(claimsValid({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS], au: 'shadowcloak' }), true, 'every glyph and the cloak at once: claims the vocabulary takes');
  const full = await mintToken({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', t: 'shadowfang', g: [...GLYPHS], au: 'shadowcloak' }, kp.privateKey, { subtle, nowS });
  assert.match(full, /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9_-]{1,640}\.[A-Za-z0-9_-]{1,128}$/, `and a token carrying them all inside the relay's own bound (net/wire.js TOKEN_RE: ${full.split('.')[1].length} of 640)`);
  assert.equal(claimsValid({ s: 'acct-sir', n: 'SirMcMobdon', k: 'linked', i: nowS, e: nowS + 60, au: 'holoshadowcloak' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'SirMcMobdon', title: 'shadowfang', glyphs: ['shadowfang'], au: 'shadowcloak' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.equal(seen.au, 'shadowcloak', 'and everyone near sees their cloak');
});

// ── THE CLOAK'S SHAPE ───────────────────────────────────────────────

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BASE = { uSeed: 0.37, uRingR: CLOAK_HEM_R, uGroundR: AURA_GROUND_R, uFlameH: CLOAK_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: AURA_LIFT_M, uVP: I, uAura: 3, uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0], uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1], uCapeH: [0, CLOAK_HOOD_Y, 0, 0], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0] };
/** The vertex half's answer: where a mesh point (or an emblem's or a shred's corner) stands. */
const vsAt = (kind, aP, { t = 13.5, yaw = 0, at = [0, 0, 0], eye = [0, 1.2, -5], torn = -1, pose = {} } = {}) => {
  const f = glslFunctions(AURA_VS, { ...BASE, ...pose, aP, uKind: kind, uTime: t, uYaw: yaw, uAt: at, uCamPos: eye, uTorn: torn });
  f.main();
  return { w: f.globals.vWorld, vP: f.globals.vP, vS: f.globals.vS };
};
/** One draw's answer, premultiplied: [light r, g, b, how much it covers] - or 'discard'. `side` the cloth's draw (0 the
 *  lining - front faces culled, 1 its outside - back faces culled). */
const fsSide = (kind, vP, side, { t = 13.5, yaw = 0, kindle = 1, world = null, eye = [0, 1.2, -5], s = [0, 0, 0], fog = null, at = [0, 0, 0], torn = -1, pose = {} } = {}) => {
  const w = world ?? (kind === 1 ? vsAt(1, vP, { t, yaw, at, torn, pose }).w : [0, 0, 0]);
  const f = glslFunctions(AURA_FS, { ...BASE, ...pose, vP, vWorld: w, vS: s, uKind: kind, uTime: t, uYaw: yaw, uKindle: kindle, uCamPos: eye, uAt: at, uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uSide: side, uTorn: torn });
  try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return 'discard'; throw e; }
  return f.globals.o;
};
/** The frame's answer: the cloth's from whichever of its two draws lays the fragment. */
/** THE SIDE A POINT OF THE CLOTH SHOWS an eye, as the GPU decides it: its cell's triangle (u0,v0),(u1,v0),(u1,v1) as
 *  the mesh winds it, through the vertex half, its winding seen from the eye - 1 (its outside, a front face once the
 *  game's mirror and CW front face cancel; here unmirrored and CCW) or 0 (its lining). */
const sideOf = (vP, { eye = [0, 1.2, -5], ...o } = {}) => {
  const du = 1 / CLOAK_ROUND, dv = 1 / CLOAK_ROWS;
  const u0 = Math.floor(vP[0] / du) * du, v0 = Math.min(Math.floor(vP[1] / dv), CLOAK_ROWS - 1) * dv;
  const [a, b, c] = [[u0, v0], [u0 + du, v0], [u0 + du, v0 + dv]].map((q) => vsAt(1, q, o).w);
  const e1 = b.map((x, i) => x - a[i]), e2 = c.map((x, i) => x - a[i]);
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  return n[0] * (eye[0] - a[0]) + n[1] * (eye[1] - a[1]) + n[2] * (eye[2] - a[2]) > 0 ? 1 : 0;
};
/** The frame's answer: the cloth's from the one of its two draws that lays the fragment (sideOf). */
const fsAt = (kind, vP, o = {}) => fsSide(kind, vP, kind === 1 ? sideOf(vP, o) : 1, o);
/** The shader's own functions, to ask the shape and the glyph directly. */
const F = glslFunctions(AURA_FS, { ...BASE, vP: [0, 0], vWorld: [0, 0, 0], vS: [0, 0, 0], uKind: 1, uTime: 13.5, uYaw: 0, uKindle: 1, uCamPos: [0, 1.2, -5] });
/** Even-odd, as the badge fills its path and the shader its edges. */
const insideOf = (edges, [x, y]) => { let n = 0; for (const [ax, ay, bx, by] of edges) if ((ay <= y) !== (by <= y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) n++; return n % 2 === 1; };
const segD = ([ax, ay, bx, by], [x, y]) => { const ex = bx - ax, ey = by - ay, h = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey))); return Math.hypot(x - ax - ex * h, y - ay - ey * h); };
const EDGES = glyphEdges(CLOAK_GLYPH), EYE = glyphEdges(CLOAK_GLYPH_EYE);
const outlineD = (g) => Math.min(...EDGES.map((e) => segD(e, g)));
/** Points of the glyph's box well inside the wolf (not its eye) and well outside it but inside the emblem's ring. */
const GRID = Array.from({ length: 31 * 31 }, (_, i) => [0.5 + (i % 31) * 0.5, 0.5 + Math.floor(i / 31) * 0.5]);
const IN_HEAD = GRID.filter((g) => insideOf(EDGES, g) && !insideOf(EYE, g) && outlineD(g) > 0.7 && Math.min(...EYE.map((e) => segD(e, g))) > 0.7);
const OUT_HEAD = GRID.filter((g) => !insideOf(EDGES, g) && outlineD(g) > 0.9 && Math.hypot(g[0] - 8, g[1] - 8) < 7.0);
const EYE_AT = [(9.3 + 11.8 + 9.8) / 3, (4.7 + 5.5 + 6.2) / 3];
/** The emblem's measure at a point of the glyph's box (seven of its units to one, y up). */
const measureOf = ([gx, gy]) => [(gx - 8) / 7, (8 - gy) / 7];
const QUIET = 13.2;

test('SHADOW-CLOAK the law: a CAPE clasped at the throat, its hood up round the head - its peak a hand over the crown and no more, its middle at the eye; broader across the shoulders than deep; open at the front below the clasp and at the hood\'s face, the collar whole between; trailing longest down the back; the mesh whole; every rate whole over the clock; the emblems\' lives divide it; and nothing of the projection it was - no lattice, no rain of script, no glitch (mutants: the hood, the opening, a rate off whole)', () => {
  assert.ok(CLOAK_H > CAPSULE_HEIGHT && CLOAK_H <= CAPSULE_HEIGHT + 0.1, `the hood's peak over the crown, a hand at most - "not as tall" (${CLOAK_H})`);
  assert.ok(Math.abs(CLOAK_HOOD_Y - EYE_HEIGHT) < 0.03, 'the hood\'s middle at the eye');
  assert.ok(CLOAK_SHOULDER_Y <= CLOAK_CLASP_Y && CLOAK_CLASP_Y < CLOAK_NECK_Y && CLOAK_NECK_Y < CLOAK_HOOD_Y, 'hung from the shoulders, clasped at the throat, drawn in to the neck');
  assert.ok(CLOAK_FACE.y - CLOAK_FACE.h >= CLOAK_CLASP_Y + 0.05 && CLOAK_FACE.y + CLOAK_FACE.h <= CLOAK_H - 0.05, 'the face open between the collar and a brow over it');
  assert.ok(CLOAK_SHOULDER_R < CLOAK_HEM_R && CLOAK_HEM_R + CLOAK_BACK_M < AURA_RING_R && CLOAK_POOL_R < AURA_GROUND_R, 'flaring to its hem, inside the fire\'s ring; its ground inside the quad');
  assert.ok(CLOAK_HOOD_R > 0.12 && CLOAK_HOOD_R < CLOAK_SHOULDER_R && CLOAK_NECK_R < CLOAK_HOOD_R, 'a hood round the head, swelling from the neck');
  assert.ok(CLOAK_SQUASH.shoulder > CLOAK_SQUASH.hem, 'a body is broader than it is deep');
  assert.ok(CLOAK_HEM_Y.back < CLOAK_HEM_Y.edge, 'a cape trails longest down the back');
  assert.ok(CLOAK_OPEN.hem > CLOAK_OPEN.chest && CLOAK_OPEN.chest > 0 && CLOAK_OPEN.face > 0, 'open wider toward the hem; the face open');
  assert.equal(auraCloakGrid().length, CLOAK_ROUND * CLOAK_ROWS * 12, 'two triangles a cell');
  const g = auraCloakGrid();
  assert.deepEqual([Math.min(...g), Math.max(...g)], [0, 1], 'u and v from 0 to 1');
  for (let j = 0, c = 0; j < CLOAK_ROWS; j++) for (let i = 0; i < CLOAK_ROUND; i++, c++) {
    const u0 = i / CLOAK_ROUND, u1 = (i + 1) / CLOAK_ROUND, v0 = j / CLOAK_ROWS, v1 = (j + 1) / CLOAK_ROWS;
    const want = [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], got = Array.from(g.subarray(c * 12, c * 12 + 12));
    if (got.some((x, k) => Math.abs(x - want[k]) > 1e-6)) assert.fail(`cell ${i},${j} is not two triangles tiling it, wound alike: ${got}`);
  }
  assert.ok(cloakRatesWhole(), 'every cloak rate whole over the clock');
  for (const r of [...Object.values(CLOAK_HZ), ...Object.values(CLOAK_FLOW), ...Object.values(CLOAK_SHRED_HZ)]) assert.ok(Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6), `whole: ${r}`);
  for (const l of CLOAK_EMBLEM_LIFE) assert.equal(AURA_CLOCK_PERIOD % l, 0, `an emblem's life divides the clock: ${l}`);
  assert.equal(AURA_CARDS, Math.max(WARD_GLYPHS, CLOAK_EMBLEMS + CLOAK_SHREDS, AURA_LOOK.seraphwings.glyphs), 'the third draw has cards enough for the most any look floats (SERAPH-WINGS: its sparks and backlight - PIN MOVED)');
  for (const gone of ['cloakHex', 'cloakRain', 'cloakGlitch', 'cloakWisp', 'flicker']) assert.ok(!AURA_VS.includes(gone) && !AURA_FS.includes(gone), `"less digital": no ${gone}`);
});

test('SHADOW-CLOAK the emblem is the wearer\'s glyph: the badge\'s own path (ui/playerBadge.js GLYPH_PATH.shadowfang, its eye GLYPH_DETAIL\'s) cut into edges that close on themselves, and the shader\'s outline of it the path\'s - inside where the badge fills, outside where it does not; a path the cut cannot draw is refused (mutants: the glyph swapped, the fill\'s rule, a chord dropped)', () => {
  assert.equal(CLOAK_GLYPH, GLYPH_PATH.shadowfang, 'SirMcMobdon\'s own glyph, the path the badge draws');
  assert.equal(CLOAK_GLYPH_EYE, GLYPH_DETAIL.shadowfang.path, 'and its eye');
  for (const edges of [EDGES, EYE]) {
    for (let i = 0; i < edges.length; i++) {
      const [, , bx, by] = edges[i], [nx, ny] = edges[(i + 1) % edges.length];
      assert.ok(Math.hypot(bx - nx, by - ny) < 1e-9, `edge ${i} meets the next: one closed figure`);
      assert.ok(edges[i].every((x) => x >= 0 && x <= 16), 'inside the glyph\'s box');
    }
  }
  const area = EDGES.reduce((s, [ax, ay, bx, by]) => s + (ax * by - bx * ay) / 2, 0);
  assert.ok(Math.abs(area) > 60, `a head, not a sliver (${Math.abs(area).toFixed(1)} of the box's 256)`);
  assert.equal(EDGES.length, (CLOAK_GLYPH.match(/L/g).length + CLOAK_GLYPH.match(/Q/g).length * 4 + 1), 'every line, each curve in four chords, and the close');
  assert.ok(IN_HEAD.length > 40 && OUT_HEAD.length > 20, `points either side to ask (${IN_HEAD.length} in, ${OUT_HEAD.length} out)`);
  const pick = (a, n) => Array.from({ length: n }, (_, i) => a[Math.floor((i * a.length) / n)]);
  for (const p of pick(IN_HEAD, 12)) assert.ok(F.cloakGlyphD(p) < -0.5, `inside the wolf at ${p}`);
  for (const p of pick(OUT_HEAD, 12)) assert.ok(F.cloakGlyphD(p) > 0.5, `outside it at ${p}`);
  assert.ok(F.cloakEyeD(EYE_AT) < 0, 'its eye');
  assert.throws(() => glyphEdges('M1 1C2 2 3 3 4 4Z'), /not drawn here/, 'a cubic is refused, never drawn wrong');
  assert.throws(() => glyphEdges('L1 1L2 2Z'), /begin with M/, 'a line before a move is refused');
  assert.throws(() => glyphEdges('Q1 1 2 2Z'), /begin with M/, 'and a curve');
  assert.equal(glyphEdges('M1 1L1.0004 1L5 5Z').length, 2, 'an edge that rounds to nothing as the shader takes it is none - no 0/0');
  // even-odd here is the badge's own nonzero fill: the path never crosses itself, so the winding is 0 or 1 everywhere
  const wind = ([x, y]) => EDGES.reduce((w, [ax, ay, bx, by]) => w + ((ay <= y) !== (by <= y) && x < ax + (y - ay) * (bx - ax) / (by - ay) ? (by > ay ? 1 : -1) : 0), 0);
  for (const g of GRID) assert.equal(wind(g) !== 0, insideOf(EDGES, g), `nonzero and even-odd agree at ${g}`);
});

test('SHADOW-CLOAK the vertex half, RUN: the cape stands round the body from the feet and closes at the hood\'s peak; its opening faces the wearer\'s facing - turned with them; its back hangs further than its front; broader across the shoulders than deep; the hood round the head - every bearing clear of it, its middle just behind the face, its peak fallen back a little; folds in the cloth; emblems rise off the back half; torn, it bursts outward and its shreds fly out to float round the beast, the same at the wrap (mutants: the facing ignored, the back drape dropped, the squash dropped, the hood off the head, the folds dropped, the burst, the shreds\' ring)', () => {
  const near = (p, q, e = 1e-6) => p.every((x, i) => Math.abs(x - q[i]) < e);
  const front0 = vsAt(1, [0, 0.5 / CLOAK_H], { t: QUIET }).w, front90 = vsAt(1, [0, 0.5 / CLOAK_H], { t: QUIET, yaw: Math.PI / 2 }).w;
  assert.ok(front0[2] > 0.2 && Math.abs(front0[0]) < 1e-6, `yaw 0: the front at +z (${front0.map((x) => x.toFixed(3))})`);
  assert.ok(front90[0] > 0.2 && Math.abs(front90[2]) < 1e-6, `yaw a quarter turn: at +x (${front90.map((x) => x.toFixed(3))})`);
  const back = vsAt(1, [0.5, 0.5 / CLOAK_H], { t: QUIET }).w, front = vsAt(1, [0, 0.5 / CLOAK_H], { t: QUIET }).w;
  assert.ok(-back[2] > front[2] + 0.05, `the back hangs further out (${(-back[2]).toFixed(3)} behind, ${front[2].toFixed(3)} in front)`);
  const vS = (CLOAK_SHOULDER_Y - 0.02) / CLOAK_H;
  const side = vsAt(1, [0.25, vS], { t: QUIET }).w, behind = vsAt(1, [0.5, vS], { t: QUIET }).w;
  assert.ok(Math.abs(side[0]) > Math.abs(behind[2]) + 0.05, `broader than deep (${Math.abs(side[0]).toFixed(3)} across, ${Math.abs(behind[2]).toFixed(3)} deep)`);
  const foot = vsAt(1, [0.3, 0], { t: QUIET }).w;
  assert.ok(Math.abs(foot[1]) < 1e-9 && Math.hypot(foot[0], foot[2]) > CLOAK_HEM_R - 0.05, 'from the feet, out at the hem');
  const peak = vsAt(1, [0.37, 1], { t: QUIET }).w;
  assert.ok(near(peak, [0, CLOAK_H, -(CLOAK_HOOD_BACK_M + CLOAK_PEAK_BACK_M)]), `the hood closes at its peak, a little behind the head (${peak.map((x) => x.toFixed(3))})`);
  assert.ok(CLOAK_HOOD_BACK_M + CLOAK_PEAK_BACK_M < 0.1, 'fallen back a little, never tipped off the head');
  // the hood round the head at the eye: every bearing clear of a head's 0.1 m, its middle just behind the face
  const ring = Array.from({ length: 24 }, (_, i) => vsAt(1, [i / 24, CLOAK_HOOD_Y / CLOAK_H], { t: QUIET }).w);
  for (const p of ring) { assert.ok(Math.abs(p[1] - CLOAK_HOOD_Y) < 1e-9); assert.ok(Math.hypot(p[0], p[2]) > 0.11, `clear of the head (${p.map((x) => x.toFixed(3))})`); }
  const mid = (ring[0][2] + ring[12][2]) / 2;
  assert.ok(mid < 0 && mid > -0.06, `its middle just behind the face (${mid.toFixed(3)})`);
  assert.ok(Math.abs(ring[6][0] + ring[18][0]) < 1e-6, 'and square to the wearer, side to side');
  const radii = Array.from({ length: 96 }, (_, i) => { const p = vsAt(1, [0.25 + (i / 96) * 0.5, 0.4 / CLOAK_H], { t: QUIET }).w; return Math.hypot(p[0], p[2]); });
  let turns = 0;
  for (let i = 1; i < 95; i++) if ((radii[i] - radii[i - 1]) * (radii[i + 1] - radii[i]) < 0) turns++;
  assert.ok(turns >= 8, `folds in the cloth (${turns} turns round its back half)`);
  let behindN = 0;
  for (let k = 0; k < CLOAK_EMBLEMS; k++) {
    const life = CLOAK_EMBLEM_LIFE[k % 3];
    const t0 = (Math.floor(QUIET / life) + 0.2) * life;
    const a = vsAt(2, [k * 2 + 0.5, 0.5], { t: t0 }), b = vsAt(2, [k * 2 + 0.5, 0.5], { t: t0 + life * 0.5 });
    assert.equal(a.vS[1], 0, 'an emblem\'s card');
    if (a.w[2] < -0.1) behindN++;
    if (Math.abs(b.vS[0] - a.vS[0] - 0.5) < 1e-6) assert.ok(b.w[1] > a.w[1] + 0.1, `emblem ${k} rises`);
  }
  assert.ok(behindN >= CLOAK_EMBLEMS - 1, `off the back (${behindN}/${CLOAK_EMBLEMS} behind the body)`);
  // an emblem's card reads as the badge does: its x the eye's right as the frame shows it (world/mat4.js HANDEDNESS -
  // looking north, +x on screen right), so the wolf faces the way the badge's does
  const l = vsAt(2, [0, 0.5], { eye: [0, 1.2, -5] }).w, rt = vsAt(2, [1, 0.5], { eye: [0, 1.2, -5] }).w;
  assert.ok(rt[0] > l[0] + 0.1, `the card's right toward +x for an eye looking north (${l[0].toFixed(3)} to ${rt[0].toFixed(3)})`);
  // torn: the cloth bursts out; the shreds fly from the cloth to their ring and float there
  const whole = vsAt(1, [0.5, 0.5 / CLOAK_H], { t: QUIET }).w, burst = vsAt(1, [0.5, 0.5 / CLOAK_H], { t: QUIET, torn: CLOAK_RIP_S }).w;
  assert.ok(-burst[2] > -whole[2] + 0.3, `torn, it bursts out (${(-whole[2]).toFixed(3)} to ${(-burst[2]).toFixed(3)})`);
  for (let j = 0; j < CLOAK_SHREDS; j++) {
    const k = CLOAK_EMBLEMS + j;
    const at0 = vsAt(2, [k * 2 + 0.5, 0.5], { torn: 0 }), far = vsAt(2, [k * 2 + 0.5, 0.5], { torn: CLOAK_RIP_S + 7.3, t: 40 });
    assert.equal(at0.vS[1], 1, 'a shred\'s card');
    assert.ok(Math.hypot(at0.w[0], at0.w[2]) < CLOAK_HEM_R + CLOAK_BACK_M + 0.12, `shred ${j} tears off the cloth`);
    const r = Math.hypot(far.w[0], far.w[2]);
    assert.ok(r > CLOAK_SHRED_AT.r[0] - 0.12 && r < CLOAK_SHRED_AT.r[1] + 0.12 && far.w[1] > CLOAK_SHRED_AT.y[0] - 0.15 && far.w[1] < CLOAK_SHRED_AT.y[1] + 0.15, `shred ${j} floats round the beast (${r.toFixed(2)} out, ${far.w[1].toFixed(2)} up)`);
    const wrapA = vsAt(2, [k * 2 + 0.5, 0.5], { torn: CLOAK_RIP_S + 3.1 }), wrapB = vsAt(2, [k * 2 + 0.5, 0.5], { torn: CLOAK_RIP_S + 3.1 + AURA_CLOCK_PERIOD });
    assert.ok(near(wrapA.w, wrapB.w, 1e-3), `shred ${j}: the same at the wrap`);
  }
});

test('SHADOW-CLOAK the cloth, RUN: open below the clasp and at the hood\'s face, the collar whole between - the mesh\'s seam inside the opening or under the clasp; each fragment laid by ONE of its two draws, the lining (front faces culled) before the outside; its outside shadow and its lining red - premultiplied, neither nothing nor a wall; denser at its edges; the wearer\'s glyph on its back, lit inside the wolf and dark beside it, its eye an ember; the clasp the emblem too; the mantle\'s stitched edge; the embroidery down the opening; the hem torn into trailing smoke; none of it from inside (the wearer\'s first person); drawn in from the hem as it kindles; the wrap whole (mutants: the opening, the side split, the lining, the rim, the emblem, the clasp, the mantle, the trim, the build)', () => {
  const eyeBack = [0, 1.2, -5], eyeSide = [5, 1.2, 0], eyeFront = [0, 1.2, 5];
  for (let y = 0.4; y < CLOAK_CLASP_Y - 0.04; y += 0.1) for (const u of [0.005, 0.995]) assert.equal(fsAt(1, [u, y / CLOAK_H], { t: QUIET, eye: eyeFront }), 'discard', `open at the front, ${y.toFixed(2)} m`);
  for (const dy of [-0.05, 0, 0.05]) assert.equal(fsAt(1, [0.005, (CLOAK_FACE.y + dy) / CLOAK_H], { t: QUIET, eye: eyeFront }), 'discard', 'the hood\'s face open');
  for (const y of [CLOAK_CLASP_Y + 0.03, CLOAK_NECK_Y - 0.01]) assert.notEqual(fsAt(1, [0.005, y / CLOAK_H], { t: QUIET, eye: eyeFront }), 'discard', `the collar whole at ${y.toFixed(2)} m`);
  // its sides, as its own winding names them: the back seen from behind is its outside, from in front its lining
  assert.equal(sideOf([0.45, 0.4], { t: QUIET, eye: eyeBack }), 1, 'the back to an eye behind: its outside');
  assert.equal(sideOf([0.45, 0.4], { t: QUIET, eye: eyeFront }), 0, 'and to an eye in front: its lining');
  const outside = fsAt(1, [0.42, 0.45], { t: QUIET, eye: eyeBack }), lining = fsAt(1, [0.42, 0.45], { t: QUIET, eye: eyeFront });
  assert.ok(outside[3] > 0.7 && outside[3] < 0.95, `a dense shadow over what is behind it, not a wall (${outside[3].toFixed(3)})`);
  assert.ok(lum(outside) < 0.2, `its outside dark (${lum(outside).toFixed(3)})`);
  assert.ok(lining[0] > outside[0] + 0.1 && lining[0] > 3 * lining[1], `its lining red (${lining.slice(0, 3).map((x) => x.toFixed(3))})`);
  let edge = 0, across = 0;
  for (const t of [QUIET, 41.2, 77.7]) { edge += fsAt(1, [0.25, 0.35], { t, eye: eyeBack })[3] + fsAt(1, [0.75, 0.35], { t, eye: eyeBack })[3]; across += 2 * fsAt(1, [0.44, 0.35], { t, eye: eyeBack })[3]; }
  assert.ok(edge > across * 1.03, `denser at its edges (${(edge / 6).toFixed(3)} vs ${(across / 6).toFixed(3)})`);
  // the glyph on its back: lit inside the wolf, dark beside it inside the disc, its eye an ember
  const onBack = ([gx, gy]) => {
    const [mx, my] = measureOf([gx, gy]), x = (mx * CLOAK_SIGIL_R) / 1.4, y = CLOAK_SIGIL_Y + (my * CLOAK_SIGIL_R) / 1.4;
    let u = 0.5;
    for (let i = 0; i < 3; i++) u = 0.5 - x / (TAU * F.cloakRadius(u, y));
    return fsAt(1, [u, y / CLOAK_H], { t: QUIET, eye: [0, CLOAK_SIGIL_Y, -3] });
  };
  const ins = IN_HEAD.filter((_, i) => i % 9 === 0).map((g) => lum(onBack(g))), outs = OUT_HEAD.filter((_, i) => i % 5 === 0).map((g) => lum(onBack(g)));
  assert.ok(Math.min(...ins) > Math.max(...outs) + 0.05, `the wolf lit (${Math.min(...ins).toFixed(3)} at its dimmest) and beside it dark (${Math.max(...outs).toFixed(3)} at its brightest)`);
  const eyeLit = onBack(EYE_AT);
  assert.ok(eyeLit[1] > 0.1 && eyeLit[0] > eyeLit[1] * 1.5, `its eye an ember (${eyeLit.slice(0, 3).map((x) => x.toFixed(3))})`);
  // the clasp: the emblem's ring lit at the throat, over the meeting edges
  const claspRing = fsAt(1, [0.5 + 0.5 - (1.2 * CLOAK_CLASP_R / 1.4) / (TAU * F.cloakRadius(0, CLOAK_CLASP_Y - 0.012)), (CLOAK_CLASP_Y - 0.012) / CLOAK_H], { t: QUIET, eye: eyeFront });
  const beside = fsAt(1, [0.06, (CLOAK_CLASP_Y - 0.012) / CLOAK_H], { t: QUIET, eye: eyeFront });
  assert.ok(lum(claspRing) > lum(beside) + 0.3, `the clasp's ring lit (${lum(claspRing).toFixed(3)} vs ${lum(beside).toFixed(3)})`);
  assert.notEqual(fsAt(1, [0.002, (CLOAK_CLASP_Y - 0.03) / CLOAK_H], { t: QUIET, eye: eyeFront }), 'discard', 'whole over the opening under it');
  // the mantle's stitched edge across the back
  const stitch = lum(fsAt(1, [0.5, (CLOAK_MANTLE_Y + 0.005) / CLOAK_H], { t: QUIET, eye: eyeBack })), below = lum(fsAt(1, [0.5, (CLOAK_MANTLE_Y - 0.06) / CLOAK_H], { t: QUIET, eye: eyeBack }));
  assert.ok(stitch > below + 0.15, `the mantle's edge stitched in crimson (${stitch.toFixed(3)} vs ${below.toFixed(3)})`);
  // the embroidery: lit just inside the opening's edge, against the cloth a hand further in
  const y = 0.9, rr = F.cloakRadius(0.2, y), open = F.cloakOpenHalf(y);
  const uTrim = open + 0.004 / (TAU * rr);
  const trim = lum(fsAt(1, [uTrim, y / CLOAK_H], { t: QUIET, eye: eyeFront })), cloth = lum(fsAt(1, [uTrim + 0.1 / (TAU * rr), y / CLOAK_H], { t: QUIET, eye: eyeFront }));
  assert.ok(trim > cloth + 0.3, `embroidered along the opening (${trim.toFixed(3)} vs ${cloth.toFixed(3)})`);
  const collar = fsAt(1, [0.002, (CLOAK_NECK_Y - 0.035) / CLOAK_H], { t: QUIET, eye: eyeFront });
  assert.ok(lum(collar) < 0.15, `and none down the collar, where it is closed (${lum(collar).toFixed(3)})`);
  // the hem: torn into smoke - well below it nothing, just below it no more than smoke, the cloth whole above it
  for (let i = 0; i < 12; i++) assert.equal(fsAt(1, [0.15 + (i / 12) * 0.12, 0.03 / CLOAK_H], { t: QUIET, eye: eyeFront }), 'discard', 'below the trailing smoke, nothing');
  let smokeN = 0;
  for (let i = 0; i < 12; i++) { const c = fsAt(1, [0.4 + (i / 12) * 0.2, 0.05 / CLOAK_H], { t: QUIET, eye: eyeBack }); if (c !== 'discard') { smokeN++; assert.ok(c[3] <= 0.56, 'just below the hem, smoke'); } }
  assert.ok(smokeN >= 2, `smoke trails below it (${smokeN} of 12)`);
  // trailing longest down the back: a hand over the floor its back is still cloth where its sides are smoke
  const solid = (us) => us.filter((u) => { const c = fsAt(1, [u, 0.17 / CLOAK_H], { t: QUIET, eye: u > 0.35 && u < 0.65 ? eyeBack : eyeSide }); return c !== 'discard' && c[3] > 0.6; }).length;
  const backN = solid(Array.from({ length: 9 }, (_, i) => 0.42 + i * 0.02)), sideN = solid([0.22, 0.235, 0.25, 0.265, 0.735, 0.75, 0.765, 0.78, 0.795]);
  assert.ok(backN > sideN, `longest down the back (${backN} of 9 solid there, ${sideN} of 9 at its sides)`);
  assert.ok(fsAt(1, [0.45, 0.6 / CLOAK_H], { t: QUIET, eye: eyeBack })[3] > 0.7, 'the cloth whole above it');
  for (const [u, vv] of [[0.42, 0.85], [0.3, 0.6], [0.7, 0.75], [0.2, 0.9]]) {
    const c = fsAt(1, [u, vv], { t: QUIET, eye: [0, 1.65, 0.05] });
    if (c !== 'discard') assert.deepEqual(c.map((x) => +x.toFixed(6)), [0, 0, 0, 0], `nothing from inside it (${u}, ${vv})`);
  }
  assert.equal(fsAt(1, [0.4, 0.95], { t: QUIET, kindle: 0.5 }), 'discard', 'half kindled: not yet at the hood');
  assert.ok(fsAt(1, [0.4, 0.3], { t: QUIET, kindle: 0.5, eye: eyeBack })[3] > 0.2, 'and the knee drawn');
  assert.equal(fsAt(1, [0.4, 0.2], { t: QUIET, kindle: 0 }), 'discard', 'unkindled: nothing');
  // embers along the line the kindling has reached: just inside it, redder than the same cloth whole
  let v = 0.5;
  for (let i = 0; i < 30; i++) v = 0.5 * 1.25 - 0.1 - 0.003 - (F.vnoiseP([0.4 * 16, v * CLOAK_H * 5], [16, 64]) - 0.5) * 0.2;
  const ember = fsAt(1, [0.4, v], { t: QUIET, kindle: 0.5, eye: eyeBack }), cool = fsAt(1, [0.4, v], { t: QUIET, kindle: 1, eye: eyeBack });
  assert.ok(ember[0] > cool[0] + 0.3, `embers along the kindling's edge (${ember[0].toFixed(3)} vs ${cool[0].toFixed(3)})`);
  for (let i = 0; i < 10; i++) {
    const p = [0.2 + (i / 10) * 0.6, 0.15 + (i % 5) * 0.15];
    const a = fsAt(1, p, { t: 0, eye: eyeSide }), b = fsAt(1, p, { t: AURA_CLOCK_PERIOD, eye: eyeSide });
    if (a === 'discard' || b === 'discard') { assert.equal(a, b, 'the same cloth at the wrap'); continue; }
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-6), `the cloth at the wrap is the cloth at zero (${p})`);
  }
});

test('SHADOW-CLOAK the tear, RUN: turned beast, the cloth splits along seams and loses its pieces one after another, embers along the tears; torn through, nothing of it is left; and the step that keeps each wearer\'s tear - torn from the turn, already torn when first seen turned, wrapped whole past the tear, the cloak kindling again from nothing when they turn back (mutants: the seams, the pieces, the step\'s wrap, the re-kindle)', () => {
  const eyeBack = [0, 1.2, -5];
  // on the plain cloth: clear of the emblem on its back, the mantle and the hem's smoulder
  const pts = Array.from({ length: 40 }, (_, i) => [[0.3, 0.33, 0.36, 0.39, 0.61, 0.64, 0.67, 0.7][i % 8], (0.5 + Math.floor(i / 8) * 0.06) / CLOAK_H]);
  const wholeN = pts.filter((p) => fsAt(1, p, { t: QUIET, eye: eyeBack }) !== 'discard').length;
  const early = pts.map((p) => fsAt(1, p, { t: QUIET, eye: eyeBack, torn: 0.3 * CLOAK_RIP_S }));
  const earlyN = early.filter((c) => c !== 'discard').length;
  assert.equal(wholeN, pts.length, 'whole before the turn');
  assert.ok(earlyN < wholeN && earlyN > wholeN * 0.2, `tearing: some of it gone, some still there (${earlyN}/${wholeN})`);
  assert.ok(early.some((c) => c !== 'discard' && c[0] > 0.3 && c[0] > 2 * c[2]), 'embers along the tears');
  for (const p of pts) assert.equal(fsAt(1, p, { t: QUIET, eye: eyeBack, torn: CLOAK_RIP_S }), 'discard', `torn through: nothing at ${p}`);
  // the seams open first - before any piece goes - and by three quarters most of it is gone
  const dense = Array.from({ length: 96 }, (_, i) => [0.3 + (i % 12) * 0.035, (0.45 + Math.floor(i / 12) * 0.04) / CLOAK_H]);
  const seams = dense.filter((p) => fsAt(1, p, { t: QUIET, eye: eyeBack, torn: 0.15 * CLOAK_RIP_S }) === 'discard').length;
  assert.ok(seams >= 5, `the seams open first (${seams} of ${dense.length} split)`);
  const left = dense.filter((p) => fsAt(1, p, { t: QUIET, eye: eyeBack, torn: 0.75 * CLOAK_RIP_S }) !== 'discard').length;
  assert.ok(left <= dense.length * 0.2, `by three quarters its pieces are going (${left} of ${dense.length} left)`);
  for (const p of dense) assert.equal(fsAt(1, p, { t: QUIET, eye: eyeBack, torn: CLOAK_RIP_S }), 'discard', `and through, every piece gone - the seams alone never reach a piece's middle (${p})`);
  // the step
  const w = {};
  auraBeastStep(w, false, 10);
  assert.equal(w.torn, -1, 'a man: not torn');
  auraBeastStep(w, true, 20);
  assert.equal(w.torn, 0, 'turned: the tear begins');
  auraBeastStep(w, true, 20 + CLOAK_RIP_S / 2);
  assert.ok(Math.abs(w.torn - CLOAK_RIP_S / 2) < 1e-9, 'and runs');
  auraBeastStep(w, true, 20 + CLOAK_RIP_S + 3);
  const a = w.torn;
  auraBeastStep(w, true, 20 + CLOAK_RIP_S + 3 + AURA_CLOCK_PERIOD);
  assert.ok(Math.abs(w.torn - a) < 1e-9 && a >= CLOAK_RIP_S, `wrapped whole past the tear (${a} and ${w.torn})`);
  auraBeastStep(w, false, 500);
  assert.deepEqual([w.torn, w.since], [-1, 500], 'turned back: whole, kindling again from now');
  const seen = auraBeastStep({}, true, 900);
  assert.ok(Math.abs(seen.torn - CLOAK_RIP_S) < 1e-9, 'first seen already turned: already torn, no tear replayed');
});

test('SHADOW-CLOAK the ground, RUN: a pool of shadow at the feet, mist in it and a dull crimson under the hem, none past it; no seam where the angle closes; the wrap whole; unkindled nothing; the quad\'s corners round; the fog thins it (mutants: the pool dropped, a seam)', () => {
  const at = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
  const feet = fsAt(0, at(0.12, 0.7), { t: QUIET });
  assert.ok(feet[3] > 0.4, `the shadow pooled at the feet (${feet[3].toFixed(3)})`);
  for (let i = 0; i < 12; i++) assert.equal(fsAt(0, at(CLOAK_POOL_R + 0.03, (i / 12) * TAU), { t: QUIET }), 'discard', 'none past the pool - not even worked out');
  const under = Array.from({ length: 48 }, (_, i) => fsAt(0, at(CLOAK_HEM_R * 0.95, (i / 48) * TAU), { t: QUIET }));
  assert.ok(under.some((c) => c[0] > 0.03 && c[0] > 3 * c[1]), 'a dull crimson in the mist under the hem');
  for (const t of [QUIET, 2.5, 7.25, 31.75]) for (const r of [0.12, 0.4, CLOAK_HEM_R, 0.75]) {
    const a = fsAt(0, [r, 1e-7], { t }), b = fsAt(0, [r, -1e-7], { t });
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-3), `no seam at ${r}, ${t} s`);
  }
  for (let i = 0; i < 12; i++) {
    const p = at([0.2, CLOAK_HEM_R, 0.6, 0.8][i % 4], i * 0.61);
    const a = fsAt(0, p, { t: 0 }), b = fsAt(0, p, { t: AURA_CLOCK_PERIOD });
    assert.ok(a.every((x, k) => Math.abs(x - b[k]) < 1e-6), `the ground at the wrap is the ground at zero (${p.map((x) => x.toFixed(2))})`);
  }
  assert.deepEqual(fsAt(0, at(0.3, 1.0), { t: QUIET, kindle: 0 }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], 'unkindled: nothing');
  assert.equal(fsAt(0, [AURA_GROUND_R * 0.8, AURA_GROUND_R * 0.8], { t: QUIET }), 'discard', 'the quad\'s corners are round');
  const fogged = fsAt(0, at(0.3, 1.0), { t: QUIET, world: [0, 0, 400], fog: { density: 0.01 } });
  assert.ok(lum(fogged) + fogged[3] < (lum(feet) + feet[3]) * 0.1, 'the fog thins its light and its shadow alike');
});

test('SHADOW-CLOAK the emblems and the shreds, RUN: an emblem is the wearer\'s glyph on a disc of shadow - the wolf lit, beside it dark, its eye an ember - and nothing as it begins and as it ends, none while the cloak is forming, none once it has torn; a shred is a scrap of the shadow with a smouldering torn edge, dimmer to the beast\'s own eye (mutants: the emblem\'s glyph, the fade, the kindle gate, the tear\'s gate, the shred\'s burn, the beast\'s own eye)', () => {
  const card = (g) => { const [mx, my] = measureOf(g); return [mx / 3 + 0.5, my / 3 + 0.5]; };
  const ins = IN_HEAD.filter((_, i) => i % 9 === 0).map((g) => fsAt(2, card(g), { t: QUIET, s: [0.5, 0, 1] }));
  const outs = OUT_HEAD.filter((_, i) => i % 5 === 0).map((g) => fsAt(2, card(g), { t: QUIET, s: [0.5, 0, 1] }));
  assert.ok(Math.min(...ins.map(lum)) > Math.max(...outs.map(lum)) + 0.05, 'the wolf lit, beside it dark');
  assert.ok(Math.min(...outs.map((c) => c[3])) > 0.5, 'on a disc of shadow');
  const eye = fsAt(2, card(EYE_AT), { t: QUIET, s: [0.5, 0, 1] });
  assert.ok(eye[1] > 0.1 && eye[0] > eye[1] * 1.5, 'its eye an ember');
  for (const age of [0, 1]) for (const g of [IN_HEAD[3], OUT_HEAD[2], EYE_AT]) assert.deepEqual(fsAt(2, card(g), { t: QUIET, s: [age, 0, 2] }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], `nothing at age ${age}`);
  for (const g of [IN_HEAD[3], EYE_AT]) {
    assert.deepEqual(fsAt(2, card(g), { t: QUIET, s: [0.5, 0, 2], kindle: 0.6 }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], 'none while the cloak forms');
    assert.deepEqual(fsAt(2, card(g), { t: QUIET, s: [0.5, 0, 2], torn: CLOAK_RIP_S }).map((x) => +x.toFixed(6)), [0, 0, 0, 0], 'none once it has torn');
  }
  let burning = 0, shadow = 0, outsideSum = 0, insideSum = 0;
  const plain = Array.from({ length: CLOAK_SHREDS }, (_, j) => j).filter((j) => F.cloakHash([j, 3.3]) < 0.5);   // the shreds with no strip of the opening's teeth
  assert.ok(plain.length >= 3, 'some shreds plain');
  for (let j = 0; j < 6; j++) for (let i = 0; i < 9; i++) for (let k = 0; k < 9; k++) {
    const uv = [0.1 + i * 0.1, 0.1 + k * 0.1];
    const c = fsAt(2, uv, { t: QUIET, s: [0, 1, j], torn: 5, eye: [0, 1.2, -5] });
    if (plain.includes(j) && c[0] > 0.1 && c[0] > 2 * c[1]) burning++;
    if (c[3] > 0.5) shadow++;
    outsideSum += lum(c) + c[3];
    const own = fsAt(2, uv, { t: QUIET, s: [0, 1, j], torn: 5, eye: [0, 1.7, 0.05] });
    insideSum += lum(own) + own[3];
  }
  assert.ok(burning >= 6, `a smouldering torn edge, on a shred with no teeth to redden it (${burning} points)`);
  // the others: a strip of the opening's wolf's teeth along their foot
  const toothed = Array.from({ length: CLOAK_SHREDS }, (_, j) => j).filter((j) => F.cloakHash([j, 3.3]) >= 0.5);
  let onTeeth = 0, offTeeth = 0;
  for (const j of toothed) for (let i = 0; i < 16; i++) {
    const x = -0.4 + i * 0.05, y = -0.42 + Math.abs(((x * 2.5) % 1 + 1) % 1 - 0.5) * 0.36;
    onTeeth += fsAt(2, [(x + 1) / 2, (y + 1) / 2], { t: QUIET, s: [0, 1, j], torn: 5 })[0];
    offTeeth += fsAt(2, [(x + 1) / 2, (y + 0.15 + 1) / 2], { t: QUIET, s: [0, 1, j], torn: 5 })[0];
  }
  assert.ok(toothed.length >= 3 && onTeeth > offTeeth * 1.5, `the the opening's teeth on a shred (${onTeeth.toFixed(2)} along them, ${offTeeth.toFixed(2)} beside)`);
  assert.ok(shadow >= 60, `shadow inside it (${shadow} points)`);
  assert.ok(insideSum < outsideSum * 0.5, `dimmer to the beast's own eye (${insideSum.toFixed(1)} vs ${outsideSum.toFixed(1)})`);
});

test('SHADOW-CLOAK the draw: FARTHEST FIRST, so a nearer cloak\'s shadow lies over a farther one; the cloak premultiplied - its ground, its cloth twice (its lining with front faces culled, then its outside with back faces culled) and its cards - its emblems behind the cloth for an eye in front of the wearer, over it for one behind; none of its cloth round the wearer\'s own eye; the blend and the frame\'s state handed back whole, even when a wearer throws mid-pass; each wearer\'s facing, tear, swing and pose set beside its place; torn, its shreds with its emblems, torn through its shreds alone and no cloth; riding, folded away; the fire and the radiance as before - one program for the four (mutants: the order, the blend, the culled sides, the cards\' order, the first person, the hand-back, the shreds\' range, a rider\'s cape, the swing, the pose)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) {
      if (k in tg) return tg[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const r = new AuraRingRenderer(gl);
  assert.equal(calls.filter((c) => c[0] === 'createProgram').length, 1, 'one program for the four auras');
  const meshData = calls.filter((c) => c[0] === 'bufferData').map((c) => c[2].length);
  assert.ok(meshData.includes(CLOAK_ROUND * CLOAK_ROWS * 12), 'the cloak\'s mesh uploaded');
  assert.ok(meshData.includes(AURA_CARDS * 12), 'cards enough for the emblems and the shreds');
  const M = new Float32Array(I), MESH = CLOAK_ROUND * CLOAK_ROWS * 6;
  const per = (name, kind) => calls.filter((c) => c[0] === kind && c[1] === name).map((c) => c[2]);
  const draws = () => calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]);
  const firsts = () => calls.filter((c) => c[0] === 'drawArrays').map((c) => c[2]);
  // nearest first in, farthest first drawn; the eye behind the cloak's wearer (yaw 0.75 faces away from the origin)
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', yaw: 0.75 }, { at: [5, 0, 5], aura: 'radiance', yaw: 2 }, { at: [9, 0, 9], aura: 'dagonfire' }], M, M, [0, 0, 0], 10);
  assert.equal(r.drawn, 3);
  assert.deepEqual(per('uAura', 'uniform1i'), [0, 2, 3], 'the farthest first, the nearest last');
  assert.deepEqual(per('uYaw', 'uniform1f'), [0, 2, 0.75], 'each wearer\'s facing - none given, none turned');
  assert.deepEqual(per('uTorn', 'uniform1f'), [-1, -1, -1], 'none torn');
  assert.deepEqual(per('uRingR', 'uniform1f'), [AURA_RING_R, RADIANCE_R, CLOAK_HEM_R]);
  assert.deepEqual(per('uFlameH', 'uniform1f'), [0.62, RADIANCE_H, CLOAK_H]);
  assert.deepEqual(draws(), [6, AURA_STEPS * 6, 6, AURA_STEPS * 6, 6, MESH, MESH, CLOAK_EMBLEMS * 6], 'the fire\'s two; the radiance\'s two; the cloak\'s ground, its cloth twice and then - the eye behind its wearer - its emblems over it');
  const seq = calls.filter((c) => ['blendFunc', 'drawArrays', 'cullFace', 'enable', 'disable'].includes(c[0]) && !(c[0] !== 'blendFunc' && c[0] !== 'drawArrays' && c[0] !== 'cullFace' && c[1] !== 11)).map((c) => (c[0] === 'blendFunc' ? `blend ${c[1]},${c[2]}` : c[0] === 'cullFace' ? `cull ${c[1] === 14 ? 'front' : 'back'}` : c[0] === 'drawArrays' ? 'draw' : `${c[0]} cull`));
  assert.deepEqual(seq, ['blend 10,10', 'disable cull', 'draw', 'draw', 'draw', 'draw', 'blend 10,13', 'draw', 'enable cull', 'cull front', 'draw', 'cull back', 'draw', 'disable cull', 'cull back', 'draw', 'blend 10,10', 'cull back', 'enable cull', 'blend 10,10'], 'added; premultiplied for the cloak - its lining with its front faces culled, then its outside with its back faces culled; handed back added, culling back on');
  assert.deepEqual(per('uSide', 'uniform1i'), [0, 1], 'its lining, then its outside');
  assert.equal(calls.filter((c) => c[0] === 'useProgram').length, 1, 'the program bound once for the frame');
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform4f' && c[1] === 'uSwing').map((c) => c.slice(2)), [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'no swing given, none drawn - a wearer each');
  assert.deepEqual([...calls.filter((c) => c[0] === 'uniform4fv' && c[1] === 'uCapeS')[2][2]], [...CLOAK_REST_POSE.shoulders], 'no pose given: at rest');
  // the eye IN FRONT of the wearer: its emblems behind the cloth, so laid before it
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', yaw: 0.75 + Math.PI }], M, M, [0, 0, 0], 10);
  assert.deepEqual(draws(), [6, CLOAK_EMBLEMS * 6, MESH, MESH], 'its emblems first, then its cloth over them');
  // the wearer's own eye: no cloth worked out at all
  calls.length = 0;
  r.draw([{ at: [0.2, 0, 0.2], aura: 'shadowcloak', yaw: 0 }], M, M, [0, 1.7, 0], 10);
  assert.deepEqual(draws(), [6, CLOAK_EMBLEMS * 6], 'from inside it: its ground and its emblems, no cloth');
  calls.length = 0;
  const posed = { shoulders: Float32Array.of(0.01, 1.3, 0.05, 1.1), head: Float32Array.of(0, 1.6, 0.04, 0.2), kneeL: Float32Array.of(-0.1, 0.5, 0.2), kneeR: Float32Array.of(0.1, 0.5, -0.1) };
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', swing: { x: 0.1, z: -0.2, lift: 0.05, twist: 0.3 }, cape: posed }], M, M, [0, 0, 0], 10);
  const arg = (name, kind) => calls.find((c) => c[0] === kind && c[1] === name).slice(2);
  assert.deepEqual(arg('uSwing', 'uniform4f'), [0.1, -0.2, 0.05, 0.3], 'its swing: across, along, its lift, its lag');
  assert.deepEqual([arg('uCapeS', 'uniform4fv')[0], arg('uCapeH', 'uniform4fv')[0], arg('uKneeL', 'uniform3fv')[0], arg('uKneeR', 'uniform3fv')[0]], [posed.shoulders, posed.head, posed.kneeL, posed.kneeR], 'its pose: the shoulders, the head, the knees');
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', torn: 0.5 }], M, M, [0, 0, 0], 10);
  assert.deepEqual([per('uTorn', 'uniform1f'), draws()], [[0.5], [6, MESH, MESH, (CLOAK_EMBLEMS + CLOAK_SHREDS) * 6]], 'tearing: the cloth still drawn, and its shreds with its emblems');
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', torn: CLOAK_RIP_S + 4 }], M, M, [0, 0, 0], 10);
  assert.deepEqual([draws(), firsts()], [[6, CLOAK_SHREDS * 6], [0, CLOAK_EMBLEMS * 6]], 'torn through: its ground and its shreds alone - the emblems\' cards not drawn at all - and no cloth');
  calls.length = 0;
  r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', mounted: true }, { at: [5, 0, 5], aura: 'oblivionward', mounted: true }], M, M, [0, 0, 0], 10);
  assert.deepEqual(draws(), [6, AURA_STEPS * 6, WARD_GLYPHS * 6, 6], 'riding: the ward on a rider as before; the cape folded away, its emblems with it - its ground stays');
  // a wearer that throws mid-pass: the frame's state handed back all the same
  calls.length = 0;
  assert.throws(() => r.draw([{ at: [1, 0, 1], aura: 'shadowcloak', get yaw() { throw new Error('a broken wearer'); } }], M, M, [0, 0, 0], 10), /a broken wearer/);
  const tail = calls.slice(-7).map((c) => c[0] + (c[0] === 'enable' || c[0] === 'disable' ? ` ${c[1]}` : ''));
  assert.deepEqual(tail, ['bindVertexArray', 'cullFace', 'disable 12', 'enable 11', 'depthMask', 'blendFunc', 'disable 9'], 'blend off, culling back on, depth written, the offset off - as the frame had them');
});

test('SHADOW-CLOAK the hosts: the one gather every host draws through hands each wearer\'s facing - mine my body\'s own, as its third person is drawn, a peer\'s off their pose (to the wall on a climb) - each wearer\'s beast form (mine my own lycanthropy turned, a peer\'s the pose\'s `wb`) and each wearer\'s swing; and the draw, after the bodies are posed, hangs each cape on its body as drawn - mine at my body\'s feet and yaw with my posed bones (none in the sprite lane or first person), crouched with my crouch; a peer\'s from their body - on lines that were already there, so no cite below them moved', () => {
  // a pin on CODE: every line the match touches is code where it touches it - none of it after a `//` (AUDIT 2: a line
  // commented out whole still matched)
  const codeMatch = (src, re, msg) => { const m = re.exec(src); assert.ok(m, msg ?? String(re)); const from = src.lastIndexOf('\n', m.index) + 1; const lines = src.slice(from, m.index + m[0].length).split('\n'); assert.ok(!lines[0].slice(0, m.index - from).includes('//') && lines.slice(1).every((l) => !l.trim().startsWith('//')), `${msg ?? re}: not commented out`); };
  const w = rd('src/scenes/world.js');
  codeMatch(w, /import \{ AuraRingRenderer, auraWearers, auraLookOf, auraBeastStep, auraMotionStep, auraCapeStep, auraSpriteBones, auraSpritePosed, auraWingLights, CLOAK_BONES, AURA_KINDLE_S, AURA_FORGET_S \} from '\.\.\/render\/auraRing\.js'; import \{ peerBodyYaw \} from '\.\.\/net\/peerClimb\.js';/);
  codeMatch(w, /import \{ mwViewFirstPerson, mwViewFrame, mwViewWheel, mwViewDrawBody, mwViewBodyBones, mwViewSpriteFigure,/);
  codeMatch(w, /_auraSelf\.aura = mine; _auraSelf\.yaw = mwViewSpriteFigure\(\)\?\.yaw \?\? player\.bodyYawFor\(cam\.yaw\); auraBeastStep\(_auraSelf, !!liveLycanthropy\(playerEntity\)\?\.isTransformed, t\);/, 'mine: the body\'s facing, and turned beast');
  codeMatch(w, /w\.at\[2\] = p\[2\]; w\.yaw = peerBodyYaw\(d\.shown\) \?\? 0; auraBeastStep\(w, !!d\.shown\.wb, t\);/, 'a peer\'s: their pose\'s');
  codeMatch(w, /auraBeastStep\(_auraSelf[^\n]*\n\s+_auraSelf\.kindle = Math\.min\(1, \(t - _auraSelf\.since\) \/ AURA_KINDLE_S\); _auraSelf\.mounted = !!player\.riding;/, 'stepped before the kindling is read, so turning back kindles it again; and riding');
  codeMatch(w, /auraBeastStep\(w, [^\n]*\n\s+w\.kindle = Math\.min\(1, \(t - w\.since\) \/ AURA_KINDLE_S\); w\.seen = t; w\.mounted = !!d\.shown\.rd;/, 'a peer\'s too - a horse or a cart');
  // THE DRAW LINE, read as code - its comment cut off first (a call after a // is no call: FOE1's trap, met here once)
  const line = w.split('\n').find((l) => l.includes('for (const w of _auraDraw) if (auraLookOf(w.aura).mesh)'));
  const code = line.slice(0, line.indexOf('   //'));
  assert.ok(!code.includes('//'), 'no comment inside the code half');
  assert.match(code, /const auraNow = performance\.now\(\) \/ 1000; for \(const w of _auraDraw\) if \(auraLookOf\(w\.aura\)\.mesh\) \{ auraCapeStep\(w, w === _auraSelf \? \{ feet: player\.bodyFeetAt\(\), yaw: mwViewSpriteFigure\(\)\?\.yaw \?\? player\.bodyYawFor\(cam\.yaw\), bones: mwViewBodyBones\(CLOAK_BONES\) \?\? auraSpriteBones\(mwViewSpriteFigure\(\)\) \} : peerBodies\?\.bonesOf\(w\.id, CLOAK_BONES\) \?\? auraSpritePosed\(w, peerWalkers\?\.figureOf\(w\.id\) \?\? peerRiders\?\.figureOf\?\.\(w\.id\)\), w === _auraSelf \? player\.height \/ CAPSULE_HEIGHT : 1\); auraMotionStep\(w, auraNow\); \} _auraPass\?\.draw\(_auraDraw, proj, view, eye, auraNow, \{/, 'each cape hung on its body and swung where it is drawn, THEN every aura drawn');
  codeMatch(w, /const drawVeiledPeerBodies = \(\) => \{ peerBodies\?\.drawVeiled\(\); drawAuras\(\);/, 'drawn through the hook the street, the building and the dungeon all call - after the bodies');
  const a = rd('src/combat/fpArm.js');
  codeMatch(a, /lastThirdModel = model;[^\n]*\n\s+drawnArm = t\.arm; drawnMats = t\.arm\.mats;/, 'the body\'s bones read in the pose it was drawn in');
  codeMatch(a, /const arm = thirdBuilt\.arm, drawn = drawnArm === arm \? drawnMats : null;/, 'while it is this arm\'s');
  assert.equal(peerBodyYaw({ cl: 1, cw: 1.25, yaw: 0.3 }), 1.25, 'a peer on the wall: its facing the wall\'s');
  assert.equal(peerBodyYaw({ yaw: 0.3 }), 0.3, 'and off it, its own');
  const v = rd('src/player/mwView.js');
  codeMatch(v, /export function mwViewBodyBones\(names\) \{\n\s+if \(eotbLane\(\) \|\| !mwCamera\.thirdPerson\(\)\) return null;\n\s+return fpArm\.thirdBones\(names\);/, 'no bones from the sprite lane or in first person');
});

test('SHADOW-CLOAK the pose, RUN: at rest the cape is the cape; it hangs from the shoulders where they are - scaled between the feet and them (a crouch presses it down and it gathers out), the collar with them, the hem following half as far - the hood with the head and turned with it, the cloth as broad as the shoulders and the hood not; trailing its wearer\'s motion the more the lower, rising as a pendulum, lagging a turn below the shoulders, lifting and filling in a fall; and a knee carried past the cloth presses it out (mutants: the crouch, the lean, the head, the head\'s turn, the scale across, the trail, the pendulum, the twist, the lift, a knee)', () => {
  const at = (u, y, pose, o = {}) => vsAt(1, [u, y / CLOAK_H], { t: QUIET, pose, ...o }).w;
  const near = (p, q, e = 1e-6) => p.every((x, i) => Math.abs(x - q[i]) < e);
  const rest = { uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1], uCapeH: [0, CLOAK_HOOD_Y, 0, 0] };
  for (const [u, y] of [[0.5, 0.4], [0.3, 1.0], [0.5, 1.5], [0.37, CLOAK_H]]) assert.ok(near(at(u, y, rest), at(u, y, {})), `at rest, the cape as it was (${u}, ${y})`);
  // a crouch: the shoulders 0.7 as high - the cloth there with them, the hem gathered out
  const crouch = { uCapeS: [0, CLOAK_SHOULDER_Y * 0.7, 0, 1], uCapeH: [0, CLOAK_HOOD_Y * 0.7, 0, 0] };
  const sh = at(0.5, CLOAK_SHOULDER_Y - 0.001, crouch), knee = at(0.25, 0.5, crouch), kneeRest = at(0.25, 0.5, rest);
  assert.ok(Math.abs(sh[1] - CLOAK_SHOULDER_Y * 0.7) < 0.01, `pressed down with the shoulders (${sh[1].toFixed(3)})`);
  assert.ok(Math.abs(knee[1] - 0.35) < 0.02 && Math.hypot(knee[0], knee[2]) > Math.hypot(kneeRest[0], kneeRest[2]) + 0.05, `and gathered out below (${knee.map((x) => x.toFixed(3))})`);
  assert.ok(Math.abs(at(0.37, CLOAK_H, crouch)[1] - CLOAK_HOOD_Y * 0.7 - (CLOAK_H - CLOAK_HOOD_Y)) < 1e-4, 'the hood down with the head');
  // a lean: the shoulders 0.1 m forward - the collar with them, the hem half as far
  const lean = { uCapeS: [0, CLOAK_SHOULDER_Y, 0.1, 1], uCapeH: [0, CLOAK_HOOD_Y, 0.1, 0] };
  assert.ok(Math.abs(at(0.5, CLOAK_SHOULDER_Y + 0.02, lean)[2] - at(0.5, CLOAK_SHOULDER_Y + 0.02, rest)[2] - 0.1) < 1e-4, 'the collar with the shoulders');
  assert.ok(Math.abs(at(0.5, 0, lean)[2] - at(0.5, 0, rest)[2] - 0.05) < 1e-4, 'the hem half as far');
  // the head: the hood's peak moves with it and turns with it; the shoulders stay
  const head = { uCapeS: rest.uCapeS, uCapeH: [0.05, CLOAK_HOOD_Y - 0.03, 0.04, 0] };
  assert.ok(near(at(0.37, CLOAK_H, head), at(0.37, CLOAK_H, rest).map((x, i) => x + [0.05, -0.03, 0.04][i]), 1e-5), 'the hood\'s peak with the head');
  assert.ok(near(at(0.5, 1.0, head), at(0.5, 1.0, rest)), 'the cape below the shoulders not');
  const turned = at(0.0, CLOAK_FACE.y, { uCapeS: rest.uCapeS, uCapeH: [0, CLOAK_HOOD_Y, 0, Math.PI / 2] }), ahead = at(0.0, CLOAK_FACE.y, rest);
  assert.ok(ahead[2] > 0.08 && turned[0] > 0.08 && Math.abs(turned[2]) < 0.04, `the hood's face turned with the head (${ahead.map((x) => x.toFixed(3))} to ${turned.map((x) => x.toFixed(3))})`);
  // broader shoulders: the cloth broader below them, the hood not
  const broad = { uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1.2], uCapeH: rest.uCapeH };
  const wide = at(0.25, 1.0, broad), narrow = at(0.25, 1.0, rest);
  assert.ok(Math.abs(wide[0] / narrow[0] - 1.2) < 0.05, `as broad as the shoulders (${(wide[0] / narrow[0]).toFixed(3)})`);
  assert.ok(near(at(0.25, CLOAK_HOOD_Y, broad), at(0.25, CLOAK_HOOD_Y, rest)), 'the hood the head\'s size');
  // the swing: trailing 0.3 m behind at the hem, none at the shoulders, risen as a pendulum
  const trail = { ...rest, uSwing: [0, -0.3, 0, 0] };
  const hem = at(0.25, 0.05, trail), hem0 = at(0.25, 0.05, rest);
  assert.ok(hem[2] < hem0[2] - 0.2 && hem[1] > hem0[1] + 0.01, `the hem trails behind and rises (${hem.map((x) => x.toFixed(3))} from ${hem0.map((x) => x.toFixed(3))})`);
  assert.ok(near(at(0.25, CLOAK_SHOULDER_Y + 0.01, trail), at(0.25, CLOAK_SHOULDER_Y + 0.01, rest)), 'the shoulders hold');
  const tw = at(0.5, 0.05, { ...rest, uSwing: [0, 0, 0, 0.5] }), tw0 = at(0.5, 0.05, rest);
  assert.ok(Math.abs(Math.atan2(tw[0], -tw[2]) - Math.atan2(tw0[0], -tw0[2])) > 0.3, 'a turn\'s lag swings the hem round');
  assert.ok(near(at(0.5, CLOAK_SHOULDER_Y + 0.01, { ...rest, uSwing: [0, 0, 0, 0.5] }), at(0.5, CLOAK_SHOULDER_Y + 0.01, rest)), 'and not the shoulders');
  const fall = at(0.25, 0.05, { ...rest, uSwing: [0, 0, 0.2, 0] });
  assert.ok(fall[1] > hem0[1] + 0.15 && Math.hypot(fall[0], fall[2]) > Math.hypot(hem0[0], hem0[2]) + 0.08, 'a fall lifts it and fills it out');
  // a knee carried out past the cloth at the wearer's left presses it out round it
  const kneeOut = { ...rest, uKneeL: [-0.5, 0.5, 0.0] };
  const pressed = at(0.75, 0.5, kneeOut), unpressed = at(0.75, 0.5, rest);
  assert.ok(-pressed[0] > 0.5 && -pressed[0] > -unpressed[0] + 0.1, `a knee presses it out (${(-unpressed[0]).toFixed(3)} to ${(-pressed[0]).toFixed(3)})`);
  assert.ok(near(at(0.25, 0.5, kneeOut), at(0.25, 0.5, rest)), 'only where the knee is');
  const far = at(0.75, 0.5, { ...rest, uKneeL: [-1.5, 0.5, 0.0] });
  assert.ok(-far[0] <= -unpressed[0] + 0.2 + 1e-6, `a knee far out raises no more than a hand's tent (${(-far[0]).toFixed(3)})`);
  // rising (a jump), the hem drawn in - never below the feet
  for (let i = 0; i < 12; i++) assert.ok(vsAt(1, [i / 12, 0], { t: QUIET, pose: { ...rest, uSwing: [0, 0, -0.06, 0] } }).w[1] >= -1e-9, 'never below the feet');
  // THE BILLOW: the hem moving in its own time down the back, the shoulders still; and every vertex the same at the wrap
  const hemA = at(0.5, 0.05, rest, { t: QUIET }), hemB = at(0.5, 0.05, rest, { t: QUIET + 1.25 });
  assert.ok(Math.hypot(hemA[0] - hemB[0], hemA[2] - hemB[2]) > 0.01, 'the hem billows');
  assert.ok(near(at(0.5, CLOAK_SHOULDER_Y + 0.01, rest, { t: QUIET }), at(0.5, CLOAK_SHOULDER_Y + 0.01, rest, { t: QUIET + 1.25 })), 'the shoulders do not');
  for (const [u, y] of [[0.5, 0.05], [0.3, 0.4], [0.7, 0.9], [0.1, 0.2]]) assert.ok(near(at(u, y, rest, { t: 0 }), at(u, y, rest, { t: AURA_CLOCK_PERIOD }), 1e-6), `the cloth at the wrap is the cloth at zero (${u}, ${y})`);
});

test('SHADOW-CLOAK no pow of a negative: GLSL leaves pow(x < 0, y) undefined (a driver\'s exp2/log2 answers NaN, and the test evaluator\'s Math.pow would hide it) - every pow the cloak\'s shader takes, at rest and under its strongest poses, its ground, its emblems and its shreds, has a base of zero or more (mutants: a square written as pow)', () => {
  const guard = (src) => src.replace(/\bpow\(/g, 'cloakPowChk(').replace('const float CLOAK_TAU', 'float powNeg = 0.0;\nfloat cloakPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }\nconst float CLOAK_TAU');
  const VS = guard(AURA_VS), FS = guard(AURA_FS);
  const poses = [{}, { uSwing: [0.42, -0.42, 0.25, 0.6] }, { uSwing: [0, 0, -0.05, -0.6] }, { uCapeS: [0, CLOAK_SHOULDER_Y * 0.4, 0.1, 1.25], uCapeH: [0, CLOAK_HOOD_Y * 0.4, 0.1, 1.5] }, { uKneeL: [-0.6, 0.5, 0.2], uKneeR: [0.5, 0.4, -0.3] }];
  for (const pose of poses) for (let i = 0; i < 24; i++) {
    const aP = [i / 24, ((i * 7) % 24) / 23];
    const vs = glslFunctions(VS, { ...BASE, ...pose, aP, uKind: 1, uTime: 3.7 * i, uYaw: 0.3 * i, uAt: [0, 0, 0], uCamPos: [3, 1.5, -2], uTorn: i % 3 === 0 ? 0.6 : -1 });
    vs.main();
    assert.equal(vs.globals.powNeg, 0, `the vertex half at ${aP}`);
    for (const [kind, vP, sv] of [[1, aP, [0, 0, 0]], [0, [Math.cos(i) * 0.5, Math.sin(i) * 0.5], [0, 0, 0]], [2, [0.3 + i / 60, 0.6], [0.5, 0, i % 5]], [2, [0.4, 0.3 + i / 60], [0, 1, i % 14]]]) {
      for (const side of [0, 1]) {
        const fs = glslFunctions(FS, { ...BASE, ...pose, vP, vWorld: vs.globals.vWorld, vS: sv, uKind: kind, uTime: 3.7 * i, uYaw: 0.3 * i, uKindle: i % 4 === 0 ? 0.5 : 1, uCamPos: [3, 1.5, -2], uAt: [0, 0, 0], uSide: side, uTorn: kind === 2 && sv[1] === 1 ? 5 : -1 });
        try { fs.main(); } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
        assert.equal(fs.globals.powNeg, 0, `the fragment half, kind ${kind} at ${vP}`);
      }
    }
  }
});

test('SHADOW-CLOAK the winding: every cell of the cloth winds OUTWARD - at rest and under the strongest poses its swing and its body hand it (a crouch, a full trail and lift, a lean, broad shoulders, a knee out) - so culling names its outside and its lining by the bent mesh itself; no cell folds over (mutants: the mesh wound inward, the trail\'s cap, the crouch\'s shortening, the legs\' room)', () => {
  const poses = {
    rest: {},
    run: { uSwing: [0, -CLOAK_SWING.trailMax * 1.2, 0, 0] },
    strafe: { uSwing: [CLOAK_SWING.trailMax * 1.2, 0, 0, 0] },
    crouchedRun: { uCapeS: [0, CLOAK_SHOULDER_Y * 0.5, 0, 1], uCapeH: [0, CLOAK_HOOD_Y * 0.5, 0, 0], uSwing: [0.42, -0.42, 0, 0] },
    fall: { uSwing: [0, 0, CLOAK_SWING.liftMax, 0.6] },
    lean: { uCapeS: [0, CLOAK_SHOULDER_Y, 0.12, 1.25], uCapeH: [0, CLOAK_HOOD_Y, 0.15, 0] },
    knee: { uKneeL: [-0.6, 0.5, 0.1] },
    flung: { uSwing: [3, -3, 0, 0] },   // past anything auraMotionStep hands it - the shader's own cap holds it
    backpedal: { uSwing: [0.56, 0.56, 0, 0] },   // a strafe reversed at its swing's most: the cloth carried through the legs' axis (AUDIT 2)
  };
  for (const [name, pose] of Object.entries(poses)) {
    let inward = 0, cells = 0, longest = 0;
    for (let j = 0; j < CLOAK_ROWS; j += 3) for (let i = 0; i < CLOAK_ROUND; i += 2) {
      const u = i / CLOAK_ROUND, v = (j + 0.5) / CLOAK_ROWS, y = v * CLOAK_H;
      if (y < 0.08 || y > CLOAK_H - 0.08) continue;   // the hem's ragged edge and the peak's point
      const du = 1 / CLOAK_ROUND, dv = 1 / CLOAK_ROWS, v0 = j / CLOAK_ROWS;
      const [a, b, c] = [[u, v0], [u + du, v0], [u + du, v0 + dv]].map((q) => vsAt(1, q, { t: QUIET, pose }).w);
      const e1 = b.map((x, k) => x - a[k]), e2 = c.map((x, k) => x - a[k]);
      assert.ok([...a, ...b, ...c].every(Number.isFinite), `${name}: every corner a number (${u.toFixed(3)}, ${v.toFixed(3)})`);
      longest = Math.max(longest, Math.hypot(...e1), Math.hypot(...e2));
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const out = [Math.sin((u + du / 2) * TAU), Math.cos((u + du / 2) * TAU)];   // its bearing at yaw 0: x right, z forward
      cells++;
      if (n[0] * out[0] + n[2] * out[1] + n[1] * 0.0 <= 0 && Math.hypot(n[0], n[2]) > Math.abs(n[1]) * 0.2) inward++;
      assert.ok(c[1] > a[1] - 1e-9, `${name}: the cloth rises up its mesh, never folding back (${u.toFixed(3)}, ${v.toFixed(3)})`);
    }
    assert.ok(inward <= cells * 0.02, `${name}: wound outward (${inward} of ${cells} cells inward)`);
    if (name !== 'flung') assert.ok(longest < 0.2, `${name}: no cell stretched across the body (its longest edge ${longest.toFixed(3)} m)`);
  }
  // a pose no clamp lets through (auraCapePose holds the shoulders off the feet): the shader still answers numbers
  const atTheFeet = { uCapeS: [0, -0.1, 0, 1], uCapeH: [0, 0.1, 0, 0], uSwing: [0, 0, 0, 0] };   // and still: no trail to scale
  for (let j = 0; j <= CLOAK_ROWS; j += 4) for (let i = 0; i < CLOAK_ROUND; i += 4) assert.ok(vsAt(1, [i / CLOAK_ROUND, j / CLOAK_ROWS], { t: QUIET, pose: atTheFeet }).w.every(Number.isFinite), `a pose at the feet: a number (${i}, ${j})`);
  // the legs' room: a full strafe never brings the hem within a hand of the axis
  const strafed = Array.from({ length: 24 }, (_, i) => vsAt(1, [i / 24, 0.05 / CLOAK_H], { t: QUIET, pose: poses.strafe }).w);
  assert.ok(Math.min(...strafed.map((p) => Math.hypot(p[0], p[2]))) >= 0.2 - 1e-6, 'a strafe\'s trail never through the legs');
});

test('SHADOW-CLOAK the swing and the pose from the body: the swing is a damped spring off how its wearer moves - trailing a run, swinging past and settling when they stop, lagging a turn, lifting in a fall, still at first sight and after a teleport; the pose reads the body\'s own bones - the rig\'s frame exactly where its draw puts it, the shoulders\' middle and breadth (bounded), the head past its joint, the knees, nothing from a skeleton without them; each cape placed where its body is drawn, at rest or crouched without one; a peer\'s bones off its standing body alone (mutants: the trail\'s sign, the spring, the turn, the fall, the snap, the frame, the breadth\'s bounds, the head\'s reach, the placing, the crouch, a peer with no body)', async () => {
  const run = (path, steps, dt = 1 / 60) => { const w = { at: [0, 0, 0], yaw: path(0).yaw ?? 0 }; let t = 0; const out = []; for (let i = 0; i <= steps; i++) { const p = path(i * dt); w.at = p.at; w.yaw = p.yaw ?? 0; auraMotionStep(w, t); out.push({ ...w.swing }); t += dt; } return out; };
  assert.deepEqual(run(() => ({ at: [0, 0, 0] }), 0)[0], { x: 0, z: 0, lift: 0, twist: 0 }, 'still at first sight');
  const fwd = run((t) => ({ at: [0, 0, t * 5] }), 120);
  assert.ok(fwd[120].z < -0.2 && Math.abs(fwd[120].x) < 1e-6, `running north (forward at yaw 0), it trails behind (${fwd[120].z.toFixed(3)})`);
  const east = run((t) => ({ at: [t * 5, 0, 0], yaw: Math.PI / 2 }), 120);
  assert.ok(east[120].z < -0.2 && Math.abs(east[120].x) < 1e-3, 'running east facing east, the same - in the body\'s frame');
  const side = run((t) => ({ at: [t * 5, 0, 0] }), 120);
  assert.ok(side[120].x < -0.2, 'stepping to the right, it trails to the left');
  const stop = run((t) => ({ at: [0, 0, Math.min(t, 2) * 5] }), 300);
  assert.ok(Math.max(...stop.slice(121, 200).map((s) => s.z)) > 0.01, 'stopping, it swings past');
  assert.ok(Math.abs(stop[300].z) < 0.01, 'and settles');
  assert.ok(Math.min(...fwd.map((s) => s.z)) >= -CLOAK_SWING.trailMax - 0.1, 'never past its reach by more than its swing');
  const turn = run((t) => ({ at: [0, 0, 0], yaw: t * 2 }), 120);
  assert.ok(turn[120].twist < -0.1, `turning right, it lags (${turn[120].twist.toFixed(3)})`); const across = run((t) => ({ at: [0, 0, 0], yaw: ((Math.PI - 0.5 + t * 2 + Math.PI) % (2 * Math.PI)) - Math.PI }), 120); assert.ok(Math.max(...across.map((s) => s.twist)) <= 1e-9 && Math.abs(across[120].twist - turn[120].twist) < 0.02, 'turning right across the half turn its yaw wraps at, the same lag - the short way round, never a whole turn the other way');
  const fall = run((t) => ({ at: [0, -4 * t * t, 0] }), 60);
  assert.ok(fall[60].lift > 0.1, `falling, it lifts (${fall[60].lift.toFixed(3)})`);
  const tele = run((t) => ({ at: [0, 0, t < 1 ? t * 5 : 500] }), 300);
  assert.ok(Math.abs(tele[60].z - tele[59].z) < 0.02 && Math.abs(tele[60].x) < 1e-9, 'a teleport (or the floating origin moving the world) is no motion: nothing read off it, the swing carries on as it was going');
  assert.ok(tele[60].z < -0.15 && Math.abs(tele[300].z) < 0.01 && Math.min(...tele.slice(59).map((x) => x.z)) >= -CLOAK_SWING.trailMax - 0.05, 'and it settles from there, never flung');
  const recentre = run((t) => ({ at: [0, 0, t * 5 - (t >= 1 ? 819.2 : 0)] }), 120), steady = run((t) => ({ at: [0, 0, t * 5] }), 120);
  assert.ok(Math.max(...recentre.map((x, i) => Math.abs(x.z - steady[i].z))) < 1e-4, 'the floating origin moving the world mid-run: the trail never sags');
  const stepped = run((t) => ({ at: [t >= 1 ? 1.5 : 0, 0, t * 5] }), 120);
  assert.ok(Math.max(...stepped.map((x) => Math.abs(x.x))) < 1e-9, 'a 1.5 m placement in a frame (a snapped step, a pin) flicks it nowhere');
  const coarse = (() => { const w = { at: [0, 0, 0], yaw: 0 }; for (let i = 0; i <= 240; i++) { w.at = [0, 0, i / 120 * 5]; auraMotionStep(w, Math.floor(i / 2) / 60); } return w.swing.z; })();
  assert.ok(Math.abs(coarse - fwd[120].z) < 0.02, `a clock coarser than the frames (two frames a tick): the same trail (${coarse.toFixed(3)} vs ${fwd[120].z.toFixed(3)})`);
  const back = (() => { const w = { at: [0, 0, 0], yaw: 0 }; for (let i = 0; i <= 120; i++) { w.at = [0, 0, i / 60 * 5]; auraMotionStep(w, i / 60); } w.at = [0, 0, 10]; auraMotionStep(w, 5); return w.swing; })();
  assert.deepEqual(back, { x: 0, z: 0, lift: 0, twist: 0 }, 'back after a gap (a death, the travel view): hanging still, no run\'s trail left in it');
  // the rig's frame: where drawThird's own model puts a rig point, about the feet
  const feet = [10, 2, -3], yaw = 0.7, rs = { weight: 1.1, height: 0.95 }, rigPt = [5, 7, 90];
  const u = 1 / MW_UNITS_PER_METER;
  const model = multiply(trs(feet[0], feet[1], feet[2], 0, yaw * 180 / Math.PI + 180, 0, -u * rs.weight, u * rs.height, u * rs.weight), NIF_TO_PASS);
  const world = transformPoint(model, ...rigPt), b = rigPointToBody(rigPt, rs);
  const R = [Math.cos(yaw), 0, -Math.sin(yaw)], Fw = [Math.sin(yaw), 0, Math.cos(yaw)];
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(world[i] - (feet[i] + R[i] * b[0] + (i === 1 ? b[1] : 0) + Fw[i] * b[2])) < 1e-4, `the body's frame is the draw's (axis ${i})`);
  // the pose
  const bones = { 'bip01 l upperarm': [-0.24, 1.36, 0.02], 'bip01 r upperarm': [0.24, 1.36, 0.02], 'bip01 neck': [0, 1.5, 0], 'bip01 head': [0, 1.6, 0], 'bip01 l calf': [-0.1, 0.5, 0.2], 'bip01 r calf': [0.1, 0.48, -0.1] };
  const p = auraCapePose(bones);
  assert.deepEqual([...p.shoulders].map((x) => +x.toFixed(4)), [0, 1.36, 0.02, 1.2], 'the shoulders\' middle and their breadth');
  assert.deepEqual([...p.head].map((x) => +x.toFixed(4)), [0, +(1.6 + CLOAK_HEAD_ABOVE).toFixed(4), 0, 0], 'the head\'s middle a hand past its joint, along the neck');
  assert.deepEqual([[...p.kneeL], [...p.kneeR]].map((k) => k.map((x) => +x.toFixed(4))), [[-0.1, 0.5, 0.2], [0.1, 0.48, -0.1]], 'the knees');
  assert.equal(auraCapePose({ ...bones, 'bip01 l upperarm': [-0.9, 1.36, 0], 'bip01 r upperarm': [0.9, 1.36, 0] }).shoulders[3], CLOAK_ACROSS[1], 'its breadth bounded');
  assert.equal(auraCapePose({ ...bones, 'bip01 head': null }), null, 'a skeleton without them (the wolf\'s): no pose');
  const w = auraCapeStep({ at: [0, 0, 0], yaw: 0 }, { feet: [1, 2, 3], yaw: 0.5, bones });
  assert.deepEqual([w.at, w.yaw, [...w.cape.shoulders].map((x) => +x.toFixed(4))], [[1, 2, 3], 0.5, [0, 1.36, 0.02, 1.2]], 'placed where the body is drawn, hung from its bones');
  assert.equal(auraCapeStep({ at: [0, 0, 0] }, { feet: [1, 2, 3], yaw: 0.5, bones: null }).cape, CLOAK_REST_POSE, 'no bones (the sprite lane, first person): at rest');
  const c = auraCapeStep({ at: [0, 0, 0] }, null, 0.7).cape;
  assert.deepEqual([c.shoulders[1], c.head[1]].map((x) => +x.toFixed(4)), [+(CLOAK_SHOULDER_Y * 0.7).toFixed(4), +(CLOAK_HOOD_Y * 0.7).toFixed(4)], 'crouched without a body\'s bones');
  // a posed arm's bones, by name, in the body's frame; none it lacks; nothing from an arm not posed
  const ref = new Map([['bip01 head', 7], ['bip01 neck', 6]]), mats = new Map([[7, { t: [0, 1.4, 112] }], [6, { t: [0, 0, 105] }]]);
  const arm = armBonesInBody({ skeleton: { byName: ref }, mats }, ['Bip01 Head', 'bip01 neck', 'bip01 tail'], { weight: 1, height: 1.1 });
  assert.deepEqual(Object.keys(arm), ['Bip01 Head', 'bip01 neck', 'bip01 tail']);
  assert.deepEqual(arm['Bip01 Head'].map((x) => +x.toFixed(4)), rigPointToBody([0, 1.4, 112], { weight: 1, height: 1.1 }).map((x) => +x.toFixed(4)), 'by name, case aside, through the body\'s frame');
  assert.equal(arm['bip01 tail'], null, 'a bone it lacks');
  assert.equal(armBonesInBody({ skeleton: { byName: ref }, mats: null }, ['bip01 head']), null, 'an arm not posed');
  // a peer's bones off its standing body alone
  const { PeerBodies } = await import('../src/net/peerBodies.js');
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}) });
  const rig = { thirdActive: () => true, thirdBones: (names) => Object.fromEntries(names.map((n) => [n, bones[n] ?? null])) };
  pb._bodies.set('p1', { state: 'ok', goneAt: null, far: false, feet: [4, 0, 4], yaw: 1.25, rig });
  pb._bodies.set('p2', { state: 'building', goneAt: null, far: false, feet: [4, 0, 4], yaw: 1.25, rig });
  pb._bodies.set('p3', { state: 'ok', goneAt: null, far: true, feet: [4, 0, 4], yaw: 1.25, rig });
  const got = pb.bonesOf('p1', CLOAK_BONES);
  assert.deepEqual([got.feet, got.yaw, got.bones['bip01 head']], [[4, 0, 4], 1.25, [0, 1.6, 0]], 'its feet and eased yaw, and its bones');
  for (const id of ['p2', 'p3', 'none']) assert.equal(pb.bonesOf(id, CLOAK_BONES), null, `no standing body, no bones (${id})`);
});

test('SHADOW-CLOAK AUDIT 2, the limits held: each stage compiles whole on its own, as a driver compiles it (no name its stage never declares); a long frame never blows the spring up; every cap of the swing reached and held; the rest pose every wearer shares never written through one; a crouch pressed no lower than its floor and the breadth no narrower than its; the opening narrowing from the hem to the chest; the eye inside the hood alone answers nothing - a camera over the wearer or a peer at their shoulder sees the cloth; a rig that throws hands no bones (mutants: a stage\'s undeclared name, the substeps, the caps, the rest pose written, the floors, the opening swapped, the inside by the axis, the bones\' guard)', async () => {
  for (const [stage, src] of [['vertex', AURA_VS], ['fragment', AURA_FS]]) assert.doesNotThrow(() => glslFunctions(src, {}, { eager: true }), `the ${stage} stage compiles every function it carries`);
  // a long frame: the spring stepped in sixtieths, never in one
  const sw = { at: [0, 0, 0], yaw: 0 }; let t = 0, z = 0;
  for (let i = 0; i <= 60; i++) { sw.at = [0, 0, z]; auraMotionStep(sw, t); t += 1 / 60; z += 5 / 60; }
  for (const dt of [0.3, 0.45, 0.4, 0.35, 0.45, 0.3]) {
    t += dt; z += 5 * dt; sw.at = [0, 0, z]; auraMotionStep(sw, t);
    const s = sw.swing;
    assert.ok([s.x, s.z, s.lift, s.twist].every(Number.isFinite) && Math.abs(s.z) <= CLOAK_SWING.trailMax * 1.5, `a ${dt} s frame never blows the spring up (${s.z.toFixed(3)})`);
  }
  // the caps: reached and held (a damped spring's overshoot aside)
  const most = (path, key, steps = 180) => { const w = { at: [0, 0, 0], yaw: 0 }; let peak = 0; for (let i = 0; i <= steps; i++) { const p = path(i / 60); w.at = p.at; w.yaw = p.yaw ?? 0; auraMotionStep(w, i / 60); peak = Math.max(peak, Math.abs(w.swing[key])); } return peak; };
  const run = most((s) => ({ at: [0, 0, 15 * s] }), 'z'), turn = most((s) => ({ at: [0, 0, 0], yaw: 20 * s }), 'twist'), fall = most((s) => ({ at: [0, -25 * s, 0] }), 'lift'), rise = most((s) => ({ at: [0, 10 * s, 0] }), 'lift');
  assert.ok(run > CLOAK_SWING.trailMax * 0.95 && run <= CLOAK_SWING.trailMax * 1.25, `a sprint trails to its reach and no further (${run.toFixed(3)})`);
  assert.ok(turn > CLOAK_SWING.twistMax * 0.95 && turn <= CLOAK_SWING.twistMax * 1.25, `a spin lags to its most and no further (${turn.toFixed(3)})`);
  assert.ok(fall > CLOAK_SWING.liftMax * 0.95 && fall <= CLOAK_SWING.liftMax * 1.25, `a long fall lifts it to its most and no further (${fall.toFixed(3)})`);
  assert.ok(rise <= 0.05 * 1.25, `a rise presses it down a hand's half at most (${rise.toFixed(3)})`);
  // the rest pose, shared by every wearer without bones: never written through one
  const snap = () => [CLOAK_REST_POSE.shoulders, CLOAK_REST_POSE.head, CLOAK_REST_POSE.kneeL, CLOAK_REST_POSE.kneeR].map((a) => [...a]);
  const was = snap(), bones = { 'bip01 l upperarm': [-0.24, 1.2, 0.02], 'bip01 r upperarm': [0.24, 1.2, 0.02], 'bip01 neck': [0, 1.35, 0], 'bip01 head': [0, 1.45, 0], 'bip01 l calf': [-0.1, 0.5, 0.2], 'bip01 r calf': [0.1, 0.48, -0.1] };
  const a = { at: [0, 0, 0] }, b = { at: [0, 0, 0] };
  auraCapeStep(a, null, 1); auraCapeStep(a, null, 0.6);   // stands, then crouches
  auraCapeStep(b, null, 1); auraCapeStep(b, { feet: [0, 0, 0], yaw: 0, bones }, 1);   // stands, then a body's bones
  assert.deepEqual(snap(), was, 'the rest pose as it was');
  assert.equal(auraCapeStep({ at: [0, 0, 0] }, null, 1).cape, CLOAK_REST_POSE, 'and a third wearer still hangs from it');
  assert.ok(Math.abs(auraCapeStep({ at: [0, 0, 0] }, null, 0.1).cape.shoulders[1] - CLOAK_SHOULDER_Y * 0.4) < 1e-6, 'pressed no lower than its floor (a swim\'s height)');
  assert.ok(Math.abs(auraCapePose({ ...bones, 'bip01 l upperarm': [-0.02, 1.2, 0], 'bip01 r upperarm': [0.02, 1.2, 0] }).shoulders[3] - CLOAK_ACROSS[0]) < 1e-6, 'and no narrower than its');
  // the opening: widest at the hem, narrower at the chest
  assert.ok(Math.abs(F.cloakOpenHalf(0.0) - CLOAK_OPEN.hem) < 1e-9 && Math.abs(F.cloakOpenHalf(1.1) - CLOAK_OPEN.chest) < 0.005, `the opening's half, hem then chest (${F.cloakOpenHalf(0.0).toFixed(3)}, ${F.cloakOpenHalf(1.1).toFixed(3)})`);
  assert.equal(fsAt(1, [0.17, 0.2 / CLOAK_H], { t: QUIET }), 'discard', 'open there at the hem');
  assert.notEqual(fsAt(1, [0.17, 1.1 / CLOAK_H], { t: QUIET }), 'discard', 'cloth there at the chest');
  // the eye inside the hood alone
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, POLYGON_OFFSET_FILL: 12, FRONT: 14, BACK: 15 }, { get(tg, k) { if (k in tg) return tg[k]; return (...x) => { calls.push([k, ...x]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return x[1]; return {}; }; } });
  const r = new AuraRingRenderer(gl), MESH = CLOAK_ROUND * CLOAK_ROWS * 6, M = new Float32Array(I);
  const cloth = (wearer, eye) => { calls.length = 0; r.draw([{ aura: 'shadowcloak', yaw: 0, ...wearer }], M, M, eye, 10); return calls.filter((c) => c[0] === 'drawArrays' && c[3] === MESH).length; };
  assert.equal(cloth({ at: [0, 0, 0] }, [0, 1.7, 0.05]), 0, 'its own first person: inside the hood, no cloth');
  assert.equal(cloth({ at: [0, 0, 0] }, [0, 3.2, -0.3]), 2, 'a camera looking straight down on them: the cloth');
  assert.equal(cloth({ at: [0, 0, 0] }, [0.45, 1.7, 0]), 2, 'a peer at their shoulder: the cloth');
  const low = { shoulders: Float32Array.of(0, 0.7, 0, 1), head: Float32Array.of(0, 0.85, 0, 0), kneeL: new Float32Array(3), kneeR: new Float32Array(3) };
  assert.equal(cloth({ at: [0, 0, 0], cape: low }, [0, 0.8, 0.05]), 0, 'crouched, the eye in the hood where the hood now is');
  assert.equal(cloth({ at: [0, 0, 0], cape: low }, [0, 1.7, 0.05]), 2, 'and over it, the cloth');
  // tearing, the eye in front: its emblems behind the cloth, its shreds over it; and none of it with the ground's depth offset
  calls.length = 0;
  r.draw([{ at: [0, 0, 0], aura: 'shadowcloak', yaw: 0, torn: 0.5 }], M, M, [0, 1.2, 4], 10);
  const seq = calls.filter((x) => x[0] === 'drawArrays' || ((x[0] === 'enable' || x[0] === 'disable') && x[1] === 12)).map((x) => x[0] === 'drawArrays' ? x[3] : `${x[0]} offset`);
  assert.deepEqual(seq, ['enable offset', 6, 'disable offset', CLOAK_EMBLEMS * 6, MESH, MESH, CLOAK_SHREDS * 6, 'enable offset', 'disable offset'], 'the ground with the offset; the emblems, the cloth, the shreds without it');
  // the pose's floors off the bones
  const squat = auraCapePose({ ...bones, 'bip01 l upperarm': [-0.24, -0.1, 0], 'bip01 r upperarm': [0.24, -0.1, 0], 'bip01 neck': [0, -0.05, 0], 'bip01 head': [0, 0, 0] });
  assert.ok(Math.abs(squat.shoulders[1] - CLOAK_SHOULDER_Y * 0.4) < 1e-6 && squat.head[1] >= squat.shoulders[1] + 0.18 - 1e-6, `a pose at the feet: the shoulders at their floor, the head a neck over them (${squat.shoulders[1].toFixed(3)}, ${squat.head[1].toFixed(3)})`);
  const hunched = auraCapePose({ ...bones, 'bip01 head': [0, 1.22, 0.2] });
  assert.ok(hunched.head[1] >= hunched.shoulders[1] + 0.18 - 1e-6, 'a head sunk to the shoulders: a neck over them still');
  const over = fsAt(1, [0.5, 1.0 / CLOAK_H], { t: QUIET, eye: [0, 3.2, -0.3] });
  assert.ok(over !== 'discard' && over[3] > 0.5, 'and the cloth answers that camera, whole');
  // a rig that throws: no bones, and the frame goes on
  const { PeerBodies } = await import('../src/net/peerBodies.js');
  const pb = new PeerBodies({ renderer: {}, createRig: () => ({}) });
  pb._bodies.set('p', { state: 'ok', goneAt: null, far: false, feet: [0, 0, 0], yaw: 0, rig: { thirdActive: () => true, thirdBones: () => { throw new Error('torn rig'); } } });
  const err = console.error; console.error = () => {};
  try { assert.equal(pb.bonesOf('p', CLOAK_BONES), null, 'a rig that throws hands no bones'); } finally { console.error = err; }
});
