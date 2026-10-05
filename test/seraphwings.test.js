// SERAPH-WINGS — THE DEVELOPERS' AURA: THE SERAPH WINGS (2026-10-05).
//
// The owner, sending a painted angel whose wings are long ribbons of golden light: "So I want to build an aura for the
// developers. These are based off this image above. Golden Angel wings that flow". The developers are
// DEVELOPER_HANDLES (the developer title and glyph's list), so the wings are held while the handle is listed
// (titles.js DEVELOPER_AURA) and gone on the next token once it is not. They are the aura pass's fifth look
// (render/auraRing.js AURA_LOOK): wings of light ON THE BODY - plumes fanned from the upper back, each a broad strand
// of light and two fine ones, waves running out along them so they flow, motes of gold drifting off them, a faint
// pool of gold beneath - hung from the body's shoulders as the cape is and swung by its motion. Added whole: light,
// never a shadow. Their shader is RUN here.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { fakeRoom } from './fakeRoom.mjs';
import { TITLES, GLYPHS, AURAS, claimsValid, mintToken, verifyToken, importPublicKeyB64 } from '../src/net/identityToken.js';
import { AURA_TEXT, AURA_PAINT, TITLE_RGBA } from '../src/ui/playerBadge.js';
import { aurasHeld, auraWorn, auraRefusal, wardrobeOf, titlesHeld, isDeveloper, DEVELOPER_AURA } from '../server-account/src/titles.js';
import { RELAY_VERSION } from '../src/net/wire.js';
import { standService } from './accountDb.mjs';
import {
  AURA_LOOK, auraLookOf, AURA_STEPS, AURA_GROUND_R, AURA_LIFT_M, AURA_CLOCK_PERIOD, AURA_VS, AURA_FS, AURA_CARDS, AuraRingRenderer,
  WING_PLUMES, WING_COVERTS, WING_PER_SIDE, WING_CARDS, WING_STRANDS, WING_SEGS, WING_ROOT, WING_SPREAD, WING_REACH, WING_W, WING_HZ, WING_FLOW, WING_MOTES,
  WING_MOTE_LIFE, WING_POOL_R, WING_RGB, WING_STRAND_COUNT, WING_VERTS, wingRatesWhole, auraWingsGrid,
  CLOAK_SHOULDER_Y, CLOAK_HOOD_Y, CLOAK_REST_POSE, CLOAK_ACROSS, auraTorso, auraSpriteBones, auraSpritePosed, auraCapePose, auraCapeStep,
  EOTB_FIGURE, AURA_SADDLE_M, WING_HALO_NEAR, WING_COVERT, WING_BEAT, WING_HALO_M, WING_MOTE_LEN, WING_MOTE_M, WING_LIGHT, auraWingLights,
  WING_SPRITE_BACK,
} from '../src/render/auraRing.js';
import { createEotbBody } from '../src/player/eotbBody.js';
import { createPeerWalkers, createPeerRiders, createEotbArt } from '../src/net/peerRiders.js';
import { RIDE_EYE_HEIGHT, EYE_HEIGHT } from '../src/player/motor.js';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const { subtle } = webcrypto;
const toml = rd('server-account/wrangler.toml');
const v = (k) => new RegExp(`^${k} = "([^"]*)"$`, 'm').exec(toml)?.[1];
const ENV = Object.fromEntries([...toml.matchAll(/^([A-Z_]+_HANDLES) = "([^"]*)"$/gm)].map((m) => [m[1], m[2]]));
const AFTER = 1_900_000_000;
const LATER = AFTER + 30 * 86_400;
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const lum = (c) => c[0] + c[1] + c[2];
const TAU = 2 * Math.PI;
const DEVS = (v('DEVELOPER_HANDLES') ?? '').split(',').map((h) => h.trim()).filter(Boolean);

// ── THE VOCABULARY, THE GRANT, THE WIRE ─────────────────────────────

test('SERAPH-WINGS vocabulary: the wings join AURAS last, "Seraph Wings" in words, their button in the Founder\'s gold; a look of their own - the fifth kind, their own mesh and motes, added whole (no shade); gold, white-hot at the heart (mutants: the word, the paint, the kind)', () => {
  assert.deepEqual([...AURAS], ['dagonfire', 'oblivionward', 'radiance', 'shadowcloak', 'seraphwings'], 'the fire, the ward, the radiance, the cloak, then the wings');
  assert.equal(AURA_TEXT.seraphwings, 'Seraph Wings');
  assert.equal(AURA_PAINT.seraphwings, 'founder', 'the button in gold - the developer\'s own paint is a red');
  assert.ok(TITLES.includes(AURA_PAINT.seraphwings));
  assert.deepEqual({ ...AURA_LOOK.seraphwings }, { kind: 4, ringR: WING_POOL_R, flameH: WING_REACH[1], glyphs: WING_CARDS, mesh: 'wings' }, 'the fifth kind: its pool, its reach, its sparks and its backlight, its own mesh - and no shade');
  assert.equal(auraLookOf('seraphwings'), AURA_LOOK.seraphwings);
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  const [r, g, b] = WING_RGB.gold, f = TITLE_RGBA.founder;
  assert.ok(r >= g && g >= b && r === 1 && Math.abs(g - f[1]) < 0.05 && Math.abs(b - f[2]) < 0.05, 'the gold the button wears');
  assert.ok(lum(WING_RGB.core) > lum(WING_RGB.gold) && lum(WING_RGB.gold) > lum(WING_RGB.amber) && WING_RGB.core[2] > 0.8, 'white-hot at the heart, gold through it, amber at the edge');
});

test('SERAPH-WINGS grant: every developer holds the wings, case-folded, read off the config alone; worn while held; off the list they go; a guest, the other lists\' holders and everyone else hold none of them; a developer on another list holds that list\'s aura first (mutants: the grant, the list)', () => {
  assert.ok(DEVS.length >= 1, 'DEVELOPER_HANDLES names the developers');
  assert.equal(DEVELOPER_AURA, 'seraphwings');
  for (const h of DEVS) for (const hh of [h, h.toLowerCase(), h.toUpperCase()]) {
    const p = row(hh);
    assert.ok(isDeveloper(p, ENV), `${hh}: a developer`);
    assert.ok(aurasHeld(p, ENV).includes('seraphwings'), `${hh}: holds the wings`);
    assert.equal(auraRefusal('seraphwings', p, ENV), null);
  }
  const dev = row(DEVS[0], { aura: 'seraphwings' });
  assert.equal(auraWorn(dev, ENV), 'seraphwings');
  assert.equal(auraWorn(dev), undefined, 'without the config, the Broker\'s alone - the wings are the list\'s');
  assert.deepEqual(aurasHeld(row(DEVS[0], { insignia: 'aura:dagonfire' }), ENV), ['seraphwings', 'dagonfire'], 'the wings, then what the Broker sold');
  const w = wardrobeOf(dev, ENV, LATER);
  assert.ok(w.auras.includes('seraphwings') && w.aura === 'seraphwings' && titlesHeld(dev, ENV).includes('developer'), 'the account card\'s answer: the wings beside the developer title');
  const off = { ...ENV, DEVELOPER_HANDLES: '' };
  assert.deepEqual(aurasHeld(dev, off), [], 'off the list, the wings go');
  assert.equal(auraWorn(dev, off), undefined);
  assert.equal(auraRefusal('seraphwings', dev, off), 'not-held');
  assert.deepEqual(aurasHeld({ ...dev, handle: null }, ENV), [], 'a guest holds none');
  for (const [h, theirs] of [['Sureme', ['oblivionward']], ['GA00250', ['radiance']], ['SirMcMobdon', ['shadowcloak']], ['Asynian', []], ['SquidKamer', []], ['Stranger', []]]) {
    assert.deepEqual(aurasHeld(row(h), ENV), theirs, `${h}: their own and not the wings`);
    assert.equal(auraRefusal('seraphwings', row(h), ENV), 'not-held');
  }
  const both = { ...ENV, SHADOW_FANG_HANDLES: DEVS[0] };
  assert.deepEqual(aurasHeld(row(DEVS[0]), both), ['shadowcloak', 'seraphwings'], 'a developer on another list: that list\'s aura first, then the wings');
});

test('SERAPH-WINGS the service end to end: a developer registers and holds the wings; wears them through the aura door; the token signs them; a stranger is refused them; off the list the next token carries none', async () => {
  const { env, call, registered, identityPublic } = await standService({ DEVELOPER_HANDLES: 'Lattymoy' });
  const me = await registered('Lattymoy');
  const mint = async () => {
    const r = await call('/v1/auth/token', {}, me.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const got = await verifyToken(r.body.token, identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
    assert.ok(got.ok, got.why);
    return { answer: r.body, claims: got.claims };
  };
  let m = await mint();
  assert.equal('au' in m.claims, false, 'held and not worn: none signed until they put them on');
  let r = await call('/v1/account/aura', { aura: 'seraphwings' }, me.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.aura, 'seraphwings', 'worn');
  m = await mint();
  assert.equal(m.claims.au, 'seraphwings', 'signed');
  const other = await registered('Stranger');
  r = await call('/v1/account/aura', { aura: 'seraphwings' }, other.secret);
  assert.equal(r.body.error, 'not-held', 'a stranger is refused the wings');
  env.DEVELOPER_HANDLES = '';
  m = await mint();
  assert.equal('au' in m.claims, false, 'off the list: the next token carries no wings');
});

test('SERAPH-WINGS the account card: wearing the wings, the card says their name', async () => {
  const { AccountFlow } = await import('../src/ui/accountFlow.js');
  const { SESSION_KEY } = await import('../src/net/accountClient.js');
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'acct-dev', name: 'Lattymoy', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, val) => m.set(k, String(val)), removeItem: (k) => m.delete(k) };
  const wardrobe = { titles: ['developer'], title: 'developer', glyphs: ['dev'], auras: ['seraphwings'], aura: null, insignia: [] };
  const answers = { '/v1/account': { account: { id: 'acct-dev', name: 'Lattymoy', kind: 'linked', handle: 'lattymoy' }, wardrobe, devices: [] }, '/v1/account/aura': { ok: true, ...wardrobe, aura: 'seraphwings' } };
  const fetch = async (url) => { const path = url.replace(/^https?:\/\/[^/]+/, ''); return { ok: true, status: 200, json: async () => answers[path] }; };
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  assert.equal(await flow.wearAura('seraphwings'), true);
  assert.equal(flow.note, 'Wearing Seraph Wings.');
});

test('SERAPH-WINGS token and relay: a token may carry the wings and verifies; the relay - world168 and after, the ones that know the word - reads it out of the signature for everyone near; a token with every glyph and the wings inside the relay\'s bound (mutants: the vocabulary\'s word)', async () => {
  assert.equal(RELAY_VERSION, 'world169', 'SERAPH-WINGS moved it on (world168): the vocabulary rides the relay\'s bundle; AUDIT ARENA-LADDER after it (world169, the arena ladder audit - PIN MOVED)');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', t: 'developer', g: ['dev'], au: 'seraphwings' }, kp.privateKey, { subtle, nowS });
  const got = await verifyToken(tok, pub, { subtle, nowS });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.au, 'seraphwings');
  assert.equal(claimsValid({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', i: nowS, e: nowS + 60, g: [...GLYPHS], au: 'seraphwings' }), true);
  const full = await mintToken({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', t: 'developer', g: [...GLYPHS], au: 'seraphwings' }, kp.privateKey, { subtle, nowS });
  assert.match(full, /^[A-Za-z0-9]{1,8}\.[A-Za-z0-9_-]{1,640}\.[A-Za-z0-9_-]{1,128}$/, `inside the relay's own bound (${full.split('.')[1].length} of 640)`);
  assert.equal(claimsValid({ s: 'acct-dev', n: 'Lattymoy', k: 'linked', i: nowS, e: nowS + 60, au: 'angelwings' }), false, 'a word the vocabulary does not hold is refused');
  const room = fakeRoom('town:m9');
  const a = room.connect(), b = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Lattymoy', title: 'developer', glyphs: ['dev'], au: 'seraphwings' });
  assert.equal(a.closed, null, 'the relay admitted the token');
  await room.hello(b, 'peer-0002');
  assert.equal(b.sent.find((msg) => msg.t === 'welcome').peers.find((p) => p.id === 'peer-0001').au, 'seraphwings', 'everyone near sees the wings');
});

// ── THE WINGS' LAW AND SHAPE ────────────────────────────────────────

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const BASE = { uWingBack: 0, uSeed: 0.37, uRingR: WING_POOL_R, uGroundR: AURA_GROUND_R, uFlameH: WING_REACH[1], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0], uLift: AURA_LIFT_M, uVP: I, uAura: 4, uSide: 1, uTorn: -1, uSwing: [0, 0, 0, 0], uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1], uCapeH: [0, CLOAK_HOOD_Y, 0, 0], uKneeL: [0, 0, 0], uKneeR: [0, 0, 0], uTorsoU: [0, 1, 0], uTorsoF: [0, 0, 1] };
const FAR = [0, 1.5, -6];   // an eye well behind the wearer
/** Strand k's point at its length's share t, as the vertex half lays it (the middle of its ribbon). */
const strandAt = (k, t, { time = 13.2, yaw = 0, eye = FAR, pose = {} } = {}) => {
  const across = (side) => { const f = glslFunctions(AURA_VS, { ...BASE, ...pose, aP: [k * 2 + side, t], uKind: 1, uTime: time, uYaw: yaw, uAt: [0, 0, 0], uCamPos: eye }); f.main(); return f.globals.vWorld; };
  const a = across(0), b = across(1);
  return { mid: a.map((x, i) => (x + b[i]) / 2), width: Math.hypot(...a.map((x, i) => x - b[i])) };
};
const broad = (side, plume) => (side < 0 ? 0 : WING_PER_SIDE) + plume * WING_STRANDS;   // a primary's broad strand

test('SERAPH-WINGS the law: every rate whole over the clock and every mote\'s life dividing it; the mesh every strand\'s ribbon, root to tip, two triangles a segment; the fan from below level to high over the head, the high plumes the long ones; the pool inside the ground\'s quad; cards enough for the motes (mutants: a rate off whole, the fan)', () => {
  assert.ok(wingRatesWhole(), 'every rate whole');
  for (const hz of [...Object.values(WING_HZ), WING_FLOW.rate, WING_FLOW.fray]) assert.ok(Number.isInteger(Math.round(hz * AURA_CLOCK_PERIOD * 1e6) / 1e6), `${hz} whole over ${AURA_CLOCK_PERIOD} s`);
  for (const l of WING_MOTE_LIFE) assert.equal(AURA_CLOCK_PERIOD % l, 0, `a mote's life of ${l} s divides the clock`);
  assert.equal(WING_PER_SIDE, (WING_PLUMES + WING_COVERTS) * WING_STRANDS, 'the primaries and the coverts');
  assert.equal(WING_STRAND_COUNT, 2 * WING_PER_SIDE);
  assert.equal(WING_CARDS, WING_MOTES + 1, 'the sparks and the backlight');
  assert.equal(WING_VERTS, WING_STRAND_COUNT * WING_SEGS * 6);
  const g = auraWingsGrid();
  assert.equal(g.length, WING_VERTS * 2, 'two numbers a vertex');
  for (let k = 0; k < WING_STRAND_COUNT; k++) {
    const own = [];
    for (let i = 0; i < g.length; i += 2) if (Math.floor(g[i] / 2) === k) own.push([g[i] - 2 * k, g[i + 1]]);
    assert.equal(own.length, WING_SEGS * 6, `strand ${k}: its segments`);
    assert.deepEqual([Math.min(...own.map((p) => p[1])), Math.max(...own.map((p) => p[1]))], [0, 1], `strand ${k}: root to tip`);
    assert.ok(own.every((p) => p[0] === 0 || p[0] === 1), `strand ${k}: its two edges`);
  }
  assert.ok(WING_SPREAD[0] < 0 && WING_SPREAD[1] > 1, 'from below level to high over the head');
  assert.ok(WING_REACH[1] > WING_REACH[0] * 1.5, 'the high plumes the long ones');
  assert.ok(WING_W.broad > 2 * WING_W.fine, 'a broad strand and fine ones');
  assert.ok(WING_POOL_R <= AURA_GROUND_R, 'its pool inside the ground quad');
  assert.ok(AURA_CARDS >= WING_CARDS, 'cards enough for its sparks and its backlight');
});

test('SERAPH-WINGS the vertex half, RUN: every strand grows out of the upper back, behind the shoulders\' middle; the left plumes out to the wearer\'s left, the right to their right; up the fan each tip higher, the highest over the head, the lowest below the shoulders and off the ground; none sweeping in front of the wearer; turned with the facing; a ribbon its width across, broad wider than fine, turned to the eye; flowing - the tips move, the roots stay; the same at the clock\'s wrap (mutants: the root, the side, the fan, the facing, the width, the flow)', () => {
  for (const k of [0, 5, broad(-1, 6), broad(1, 0), WING_STRAND_COUNT - 1]) {
    const r = strandAt(k, 0).mid;
    assert.ok(Math.abs(r[1] - (CLOAK_SHOULDER_Y - WING_ROOT.below)) < 1e-6 && Math.abs(r[2] + WING_ROOT.back) < 1e-6 && Math.abs(Math.abs(r[0]) - WING_ROOT.apart) < 1e-6, `strand ${k} grows from the upper back (${r.map((x) => x.toFixed(3))})`);
  }
  const tips = (side) => Array.from({ length: WING_PLUMES }, (_, p) => strandAt(broad(side, p), 1).mid);
  const L = tips(-1), R = tips(1);
  assert.ok(L.every((t) => t[0] < -0.3) && R.every((t) => t[0] > 0.3), 'the left out to the left (-x at yaw 0), the right to the right');
  for (const side of [L, R]) {
    for (let p = 1; p < WING_PLUMES; p++) assert.ok(side[p][1] > side[p - 1][1], `up the fan each tip higher (${p})`);
    assert.ok(side[WING_PLUMES - 1][1] > 2.4 && side[0][1] < 1.0 && side[0][1] > 0.2, `the highest over the head, the lowest below the shoulders and off the ground (${side[WING_PLUMES - 1][1].toFixed(2)}, ${side[0][1].toFixed(2)})`);
  }
  for (let k = 0; k < WING_STRAND_COUNT; k += 2) for (const t of [0.25, 0.5, 0.75, 1]) assert.ok(strandAt(k, t).mid[2] < 0.05, `strand ${k} at ${t}: never in front of the wearer`);
  const turned = strandAt(broad(1, 3), 1, { yaw: Math.PI / 2, eye: [-6, 1.5, 0] }).mid;
  assert.ok(turned[2] < -0.3 && Math.abs(turned[0]) < 0.8, `faced along +x, the right wing out along -z (${turned.map((x) => x.toFixed(2))})`);
  const wb = strandAt(broad(-1, 3), 0.4).width, wf = strandAt(broad(-1, 3) + 1, 0.4).width;
  assert.ok(Math.abs(wb - WING_W.broad * (0.3 + 0.7 * 1) * (1 - 0.55 * 0.16)) < 0.02 && wf < wb * 0.5, `a ribbon its width across, broad wider than fine (${wb.toFixed(3)}, ${wf.toFixed(3)})`);
  // turned to the eye: the ribbon's width square to the line to the eye
  for (const [kk, t, eye] of [[broad(1, 2), 0.5, FAR], [broad(-1, 5), 0.7, [4, 2, 1]], [broad(1, 6) + 2, 0.3, [-3, 0.5, -3]]]) {
    const ends = [0, 1].map((side) => { const f = glslFunctions(AURA_VS, { ...BASE, aP: [kk * 2 + side, t], uKind: 1, uTime: 13.2, uYaw: 0, uAt: [0, 0, 0], uCamPos: eye }); f.main(); return f.globals.vWorld; });
    const across = ends[1].map((x, i) => x - ends[0][i]), c = ends[0].map((x, i) => (x + ends[1][i]) / 2), to = eye.map((x, i) => x - c[i]);
    assert.ok(Math.abs(across.reduce((a, x, i) => a + x * to[i], 0)) / (Math.hypot(...across) * Math.hypot(...to)) < 1e-3, `strand ${kk} turned to the eye at ${eye}`);
  }
  // the waves are more than the fan's breath: a breath (6 s) apart the breath is where it was and the waves are not
  const breathApart = Math.max(...[broad(1, 2), broad(1, 4), broad(-1, 5), broad(-1, 1) + 1].map((kk) => { const a = strandAt(kk, 1, { time: 13.2 }).mid, b = strandAt(kk, 1, { time: 13.2 + 1 / WING_HZ.breathe }).mid; return Math.hypot(...a.map((x, i) => x - b[i])); }));
  assert.ok(breathApart > 0.03, `waves running along them (${breathApart.toFixed(3)} m a breath apart)`);
  // and along each: between beats the curve the strand would be without its waves has no wiggle (a quadratic laid along
  // its plume, a cubic droop) - its fourth difference along it is nothing, and the waves give it one
  const wiggle = Math.max(...[broad(1, 4), broad(-1, 6), broad(1, 2) + 1].map((kk) => { const q = [0.4, 0.5, 0.6, 0.7, 0.8].map((t) => strandAt(kk, t, { time: 7.4 }).mid); return Math.hypot(...[0, 1, 2].map((i) => q[0][i] - 4 * q[1][i] + 6 * q[2][i] - 4 * q[3][i] + q[4][i])); }));
  assert.ok(wiggle > 0.004, `waves along each strand (${wiggle.toFixed(4)})`);
  // the fan breathes: over twenty-four seconds (whole periods of the breath, the beat and every wave) the middle plumes'
  // tips rise and fall with the breath - the waves and the beat, at other rates, cancel out of it
  const mids = [broad(-1, 3), broad(1, 3), broad(-1, 4), broad(1, 4)];
  let corr = 0;
  for (let i = 0; i < 96; i++) { const time = 2 + i * 0.25; corr += mids.reduce((a, kk) => a + strandAt(kk, 1, { time }).mid[1], 0) / mids.length * Math.sin(2 * Math.PI * WING_HZ.breathe * time); }
  assert.ok(Math.abs(corr / 96) > 0.02, `the fan breathing open and closed (${(corr / 96).toFixed(3)})`);
  const k = broad(1, 4), now = strandAt(k, 1, { time: 13.2 }).mid, then = strandAt(k, 1, { time: 14.2 }).mid;
  assert.ok(Math.hypot(...now.map((x, i) => x - then[i])) > 0.03, 'flowing: the tip moves');
  const r0 = strandAt(k, 0, { time: 13.2 }).mid, r1 = strandAt(k, 0, { time: 14.2 }).mid;
  assert.ok(Math.hypot(...r0.map((x, i) => x - r1[i])) < 1e-9, 'and the root stays');
  const w0 = strandAt(k, 0.8, { time: 1 / 240 }).mid, w1 = strandAt(k, 0.8, { time: AURA_CLOCK_PERIOD + 1 / 240 }).mid;
  assert.ok(Math.hypot(...w0.map((x, i) => x - w1[i])) < 1e-5, 'the same at the clock\'s wrap');
});

test('SERAPH-WINGS on the body, RUN: hung from the shoulders where they are - a crouch lowers them, broad shoulders set them apart; a run\'s trail sweeps them back the more the further out, a fall lifts them - the roots where they were (mutants: the pose, the breadth, the trail, the lift)', () => {
  const k = broad(1, 3);
  const crouched = { uCapeS: [0, CLOAK_SHOULDER_Y * 0.6, 0, 1] }, broadS = { uCapeS: [0, CLOAK_SHOULDER_Y, 0, 1.25] };
  assert.ok(Math.abs(strandAt(k, 0, { pose: crouched }).mid[1] - (CLOAK_SHOULDER_Y * 0.6 - WING_ROOT.below)) < 1e-6, 'crouched, the roots lower');
  assert.ok(Math.abs(strandAt(k, 0, { pose: broadS }).mid[0] - WING_ROOT.apart * 1.25) < 1e-6, 'broad shoulders, the roots apart');
  const rest = strandAt(k, 1).mid, run = strandAt(k, 1, { pose: { uSwing: [0, -0.4, 0, 0] } }).mid, half = strandAt(k, 0.5, { pose: { uSwing: [0, -0.4, 0, 0] } }).mid, halfRest = strandAt(k, 0.5).mid;
  assert.ok(run[2] < rest[2] - 0.4 && (rest[2] - run[2]) > (halfRest[2] - half[2]) * 1.5, `a run sweeps the tip back, more than the middle (${(rest[2] - run[2]).toFixed(2)} vs ${(halfRest[2] - half[2]).toFixed(2)})`);
  const sw0 = strandAt(k, 0, { pose: { uSwing: [0.3, -0.4, 0.2, 0] } }).mid, sw1 = strandAt(k, 0).mid;
  assert.ok(Math.hypot(...sw0.map((x, i) => x - sw1[i])) < 1e-9, 'the roots where they were');
  assert.ok(strandAt(k, 1, { pose: { uSwing: [0, 0, 0.25, 0] } }).mid[1] > rest[1] + 0.25, 'a fall lifts them');
});

/** The fragment half's answer for the wings - light (rgb), or 'discard'. */
const fsW = (kind, vP, { s = [0, 0, 0], world = [0, 1.6, -0.6], eye = FAR, time = 13.2, kindle = 1 } = {}) => {
  const f = glslFunctions(AURA_FS, { ...BASE, vP, vWorld: world, vS: s, uKind: kind, uTime: time, uYaw: 0, uKindle: kindle, uCamPos: eye, uAt: [0, 0, 0] });
  try { f.main(); } catch (e) { if (e instanceof GlslDiscard) return 'discard'; throw e; }
  return f.globals.o;
};
const QUIET = 13.2;

test('SERAPH-WINGS the light, RUN: gold - white-hot at a strand\'s heart, gold to amber toward its edge, gone past it; out of the back and frayed away at the tip; alive along it and over time, and the same at the wrap; unfurled from the root as it kindles; nothing laid over an eye among them; a fine strand fainter than the broad (mutants: the heart, the edge, the tip, the root, the kindle, the eye)', () => {
  const k = broad(1, 3), mid = (a, t, o = {}) => fsW(1, [a, t], { s: [k, 0, 0], ...o });
  const heart = mid(0.5, 0.5), edge = mid(0.12, 0.5);
  assert.ok(heart[0] >= heart[1] && heart[1] >= heart[2] && heart[0] > 0.3, `gold (${heart.slice(0, 3).map((x) => x.toFixed(2))})`);
  assert.ok(lum(heart) > lum(edge) * 1.8 && heart[2] / heart[0] > 0.45 && heart[2] / heart[0] > edge[2] / Math.max(edge[0], 1e-6), `white-hot at the heart, golder toward the edge (${(heart[2] / heart[0]).toFixed(2)})`);
  assert.equal(lum(mid(0.0, 0.5)), 0, 'gone past the edge - frayed to nothing');
  assert.ok(lum(mid(0.5, 0.995)) < lum(heart) * 0.1 && lum(mid(0.5, 0.02)) < lum(heart) * 0.1, 'faint out of the back, frayed away at the tip');
  const along = Array.from({ length: 30 }, (_, i) => lum(mid(0.5, 0.2 + i * 0.02)));
  assert.ok(Math.max(...along) > Math.min(...along) * 1.3, 'alive along it - not one flat light');
  assert.ok(Math.abs(lum(mid(0.5, 0.5, { time: QUIET })) - lum(mid(0.5, 0.5, { time: QUIET + 0.7 }))) > 0.01, 'and over time');
  // the light runs along it: a pulse's period (3 s) apart the pulse is where it was and the breath only scales the
  // whole, so what is left to differ is the light's own flow
  const shape = (time) => { const p = Array.from({ length: 30 }, (_, i) => lum(mid(0.5, 0.25 + i * 0.015, { time }))); const m = p.reduce((a, x) => a + x, 0) / p.length; return p.map((x) => x / m); };
  const sa = shape(QUIET), sb = shape(QUIET + 1 / WING_HZ.flow);
  assert.ok(Math.max(...sa.map((x, i) => Math.abs(x - sb[i]))) > 0.05, 'the light flowing along it');
  assert.ok(Math.abs(lum(mid(0.5, 0.5, { time: 1 / 240 })) - lum(mid(0.5, 0.5, { time: AURA_CLOCK_PERIOD + 1 / 240 }))) < 1e-4, 'the same at the clock\'s wrap');
  assert.equal(lum(mid(0.5, 0.5, { kindle: 0 })), 0, 'unkindled, nothing');
  assert.ok(lum(mid(0.5, 0.2, { kindle: 0.5 })) > 0.05 && lum(mid(0.5, 0.85, { kindle: 0.5 })) === 0, 'half kindled: lit near the root, not yet at the tip');
  assert.equal(lum(mid(0.5, 0.5, { eye: [0, 1.62, -0.55] })), 0, 'an eye among them: nothing laid over it');
  assert.ok(lum(fsW(1, [0.5, 0.5], { s: [k + 1, 1, 0] })) < lum(heart), 'a fine strand fainter than the broad');
});

test('SERAPH-WINGS the ground and the motes, RUN: a faint pool of gold at the feet, none past it, none unkindled; a mote a small round light, nothing past its disc, nothing as it begins and as it ends, none till the wings have unfurled (mutants: the pool, the mote\'s fade, its kindle gate)', () => {
  const g0 = fsW(0, [0, 0]), gEdge = fsW(0, [WING_POOL_R - 0.05, 0]);
  assert.ok(lum(g0) > 0.08 && lum(g0) < 0.2 && g0[0] > g0[2], `a faint pool of gold (${lum(g0).toFixed(2)}) - WINGS-FIT: fainter (it was 0.33)`);
  assert.ok(lum(gEdge) < lum(g0) * 0.1, 'fading to its edge');
  assert.equal(fsW(0, [WING_POOL_R + 0.02, 0]), 'discard', 'none past it');
  assert.equal(lum(fsW(0, [0.2, 0.1], { kindle: 0 })), 0, 'none unkindled');
  const mote = (uv, age, o = {}) => fsW(2, uv, { s: [age, 0, 3], ...o });
  assert.ok(lum(mote([0.5, 0.5], 0.4)) > 1, 'a small round light');
  assert.equal(mote([0.03, 0.03], 0.4), 'discard', 'nothing past its disc');
  assert.ok(lum(mote([0.5, 0.5], 0.0)) === 0 && lum(mote([0.5, 0.5], 1.0)) < 1e-6, 'nothing as it begins and as it ends');
  assert.equal(lum(mote([0.5, 0.5], 0.4, { kindle: 0.6 })), 0, 'none till the wings have unfurled');
});

test('SERAPH-WINGS no pow of a negative, no NaN: every pow the wings\' shader takes has a base of zero or more, and every point it lays is a number - at rest, under the strongest swing and pose, and from an eye on a strand (mutants: a pow of a negative)', () => {
  const guard = (src) => src.replace(/\bpow\(/g, 'wingPowChk(').replace('const float TAU', 'float powNeg = 0.0;\nfloat wingPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }\nconst float TAU');
  const VS = src => src.replace(/\bpow\(/g, 'wingPowChk(').replace('float wingHash', 'float powNeg = 0.0;\nfloat wingPowChk(float b, float e) { if (b < 0.0) powNeg = 1.0; return exp(e * log(max(abs(b), 1e-30))); }\nfloat wingHash');
  const vsSrc = VS(AURA_VS), fsSrc = guard(AURA_FS);
  const poses = [{}, { uSwing: [0.42, -0.42, 0.25, 0.6] }, { uSwing: [-0.42, 0.42, -0.05, -0.6] }, { uCapeS: [0, CLOAK_SHOULDER_Y * 0.4, 0.1, 1.25] }];
  for (const pose of poses) for (let i = 0; i < 30; i++) {
    const k = (i * 7) % WING_STRAND_COUNT, t = (i % 11) / 10;
    for (const [kind, aP] of [[1, [k * 2 + (i % 2), t]], [2, [((i * 3) % WING_MOTES) * 2 + 0.5, 0.5]]]) {
      const eye = i % 5 === 0 ? [0.1, 1.5, -0.3] : [3, 1.5, -2];
      const vs = glslFunctions(vsSrc, { ...BASE, ...pose, aP, uKind: kind, uTime: 3.7 * i, uYaw: 0.3 * i, uAt: [0, 0, 0], uCamPos: eye });
      vs.main();
      assert.equal(vs.globals.powNeg, 0, `the vertex half, kind ${kind} at ${aP}`);
      assert.ok(vs.globals.vWorld.every(Number.isFinite), `a number, kind ${kind} at ${aP}`);
      const fs = glslFunctions(fsSrc, { ...BASE, ...pose, vP: vs.globals.vP, vWorld: vs.globals.vWorld, vS: vs.globals.vS, uKind: kind, uTime: 3.7 * i, uYaw: 0.3 * i, uKindle: i % 4 === 0 ? 0.5 : 1, uCamPos: eye, uAt: [0, 0, 0] });
      try { fs.main(); } catch (e) { if (!(e instanceof GlslDiscard)) throw e; }
      assert.equal(fs.globals.powNeg, 0, `the fragment half, kind ${kind} at ${aP}`);
      assert.ok(fs.globals.o.every(Number.isFinite), `its light a number, kind ${kind}`);
    }
  }
});

// ── THE DRAW AND THE HOSTS ──────────────────────────────────────────

test('SERAPH-WINGS the draw: the wings\' mesh uploaded; a wearer of them drawn in the fifth look - its pool, its strands, its motes - added whole (never the cloak\'s premultiplied blend), none of the strands or motes with the ground\'s depth offset, the offset handed back for the next wearer\'s ground; beside the fire as before (mutants: the strands, the motes, the blend, the offset)', () => {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const r = new AuraRingRenderer(gl);
  assert.ok(calls.filter((c) => c[0] === 'bufferData').map((c) => c[2].length).includes(WING_VERTS * 2), 'the wings\' mesh uploaded');
  calls.length = 0;
  r.draw([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0 }, { at: [3, 0, 3], aura: 'dagonfire' }], new Float32Array(I), new Float32Array(I), [0, 1.5, -5], 10);
  assert.equal(r.drawn, 2);
  const seq = calls.filter((c) => c[0] === 'drawArrays' || (c[0] === 'uniform1i' && c[1] === 'uAura') || ((c[0] === 'enable' || c[0] === 'disable') && c[1] === 12)).map((c) => c[0] === 'drawArrays' ? c[3] : c[0] === 'uniform1i' ? `aura ${c[2]}` : `${c[0]} offset`);
  assert.deepEqual(seq, ['enable offset', 'aura 0', 6, AURA_STEPS * 6, 'aura 4', 6, 'disable offset', WING_VERTS, WING_CARDS * 6, 'enable offset', 'disable offset'], 'farthest first: the fire, then the wings - their pool with the offset, their strands, sparks and backlight without it, the offset back');
  assert.ok(!calls.some((c) => c[0] === 'blendFunc' && c[2] === 13), 'added whole - never premultiplied');
  calls.length = 0;
  const torso = Float32Array.of(0, 0.9, 0.436, 0, -0.436, 0.9);
  r.draw([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0, cape: { ...CLOAK_REST_POSE, torso } }, { at: [3, 0, 3], aura: 'seraphwings' }], new Float32Array(I), new Float32Array(I), [0, 1.5, -5], 10);
  const tor = (n) => calls.filter((c) => c[0] === 'uniform3f' && c[1] === n).map((c) => c.slice(2).map((x) => +x.toFixed(3)));
  assert.deepEqual([tor('uTorsoU'), tor('uTorsoF')], [[[0, 1, 0], [0, 0.9, 0.436]], [[0, 0, 1], [0, -0.436, 0.9]]], 'each wearer\'s torso set beside its place - at rest without a pose, its own with one');
  const at = calls.findIndex((c) => c[0] === 'drawArrays' && c[3] === WING_VERTS), bound = calls.slice(0, at).filter((c) => c[0] === 'bindVertexArray').pop();
  assert.equal(bound[1], r.wingsVao, 'the strands off the wings\' own mesh');
});

test('SERAPH-WINGS the hosts: the draw hangs and swings every look with a mesh of its own - the cloak and the wings alike - on its wearer\'s body, read as code', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ AuraRingRenderer, auraWearers, auraLookOf, auraBeastStep, auraMotionStep, auraCapeStep, auraSpriteBones, auraSpritePosed, auraWingLights, CLOAK_BONES, AURA_KINDLE_S, AURA_FORGET_S \} from '\.\.\/render\/auraRing\.js';/);
  const line = w.split('\n').find((l) => l.includes('for (const w of _auraDraw) if (auraLookOf(w.aura).mesh)'));
  assert.ok(line, 'the draw\'s line');
  const code = line.slice(0, line.indexOf('   //'));
  assert.ok(!code.trim().startsWith('//') && /for \(const w of _auraDraw\) if \(auraLookOf\(w\.aura\)\.mesh\) \{ auraCapeStep\(w, [^;]*\); auraMotionStep\(w, auraNow\); \}/.test(code), 'every meshed look hung on its body and swung');
  assert.ok(code.includes('bones: mwViewBodyBones(CLOAK_BONES) ?? auraSpriteBones(mwViewSpriteFigure()) }') && code.includes(': peerBodies?.bonesOf(w.id, CLOAK_BONES) ?? auraSpritePosed(w, peerWalkers?.figureOf(w.id) ?? peerRiders?.figureOf?.(w.id)),'), 'mine off my rig, else off my sprite as drawn; a peer\'s off their rig, else off their sprite - a walker\'s, or a beast\'s on foot (AUDIT 3)');
  assert.ok(code.includes('yaw: mwViewSpriteFigure()?.yaw ?? player.bodyYawFor(cam.yaw),'), 'AUDIT 3: mine facing the way my sprite faces, not the camera');
  assert.equal(auraLookOf('seraphwings').mesh, 'wings');
  assert.ok(Math.abs(CLOAK_REST_POSE.shoulders[1] - CLOAK_SHOULDER_Y) < 1e-6, 'without bones, the wings hang from the rest pose\'s shoulders as the cape does');
});

// ── ON THE BACK: BOTH BODIES ────────────────────────────────────────

test('SERAPH-WINGS on the back of a Morrowind body: the torso read off the rig - up its spine, across its shoulders, forward out of its chest - upright at rest, leaning as the back leans, turned as the shoulders turn, upright where the bones cannot say; and the wings laid along it - a lean tips them forward, a turn turns them (mutants: the torso ignored, its forward, its guard)', () => {
  const near = (a, b, tol = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < tol);
  const out = new Float32Array(6);
  const L = [-0.2, 1.4, 0], R = [0.2, 1.4, 0];
  assert.ok(near([...auraTorso(L, R, [0, 1.2, 0], [0, 1.5, 0], [0, 1.6, 0], out)], [0, 1, 0, 0, 0, 1]), 'upright, facing forward');
  const lean = [...auraTorso(L, R, [0, 1.2, 0], [0, 1.48, 0.15], [0, 1.6, 0.2], out)];
  assert.ok(lean[2] > 0.3 && lean[4] < -0.3 && Math.abs(Math.hypot(lean[0], lean[1], lean[2]) - 1) < 1e-6, `leaning forward, its up tips forward and its forward down (${lean.map((x) => x.toFixed(2))})`);
  const turn = [...auraTorso([-0.2, 1.4, 0.1], [0.2, 1.4, -0.1], [0, 1.2, 0], [0, 1.5, 0], [0, 1.6, 0], out)];
  assert.ok(turn[3] > 0.3 && turn[5] > 0.7, `the right shoulder drawn back: it faces to the right (${turn.map((x) => x.toFixed(2))})`);
  assert.ok(near([...auraTorso(L, R, null, [0, 1.5, 0], [0, 1.65, 0], out)], [0, 1, 0, 0, 0, 1]), 'without the spine, up the neck');
  assert.ok(near([...auraTorso(L, L, [0, 1.2, 0], [0, 1.5, 0], [0, 1.6, 0], out)], [...CLOAK_REST_POSE.torso]), 'no breadth across: at rest');
  assert.ok(near([...auraTorso(L, R, [0, 1.5, 0], [0, 1.2, 0], [0, 1.0, 0], out)], [...CLOAK_REST_POSE.torso]), 'a back upside down: at rest');
  const bones = { 'bip01 l upperarm': L, 'bip01 r upperarm': R, 'bip01 neck': [0, 1.48, 0.15], 'bip01 head': [0, 1.6, 0.2], 'bip01 spine2': [0, 1.2, 0], 'bip01 l calf': null, 'bip01 r calf': null };
  assert.ok(near(lean.slice(0, 3), [0, 0.28 / Math.hypot(0.28, 0.15), 0.15 / Math.hypot(0.28, 0.15)], 1e-4), 'up the spine - its upper spine to its neck');
  assert.ok(near([...auraCapePose(bones).torso], lean), 'the pose carries it');
  // the wings along it
  const k = broad(1, 7), at = (pose) => strandAt(k, 1, { pose }).mid;
  const rest = at({}), c = Math.cos(0.4), sn = Math.sin(0.4);
  const leant = at({ uTorsoU: [0, c, sn], uTorsoF: [0, -sn, c] }), turned = at({ uTorsoU: [0, 1, 0], uTorsoF: [Math.sin(0.5), 0, Math.cos(0.5)] });
  assert.ok(leant[2] > rest[2] + 0.3, `a lean tips them forward (${rest[2].toFixed(2)} to ${leant[2].toFixed(2)})`);
  assert.ok(Math.hypot(turned[0] - rest[0], turned[2] - rest[2]) > 0.15, 'a turn turns them');   // WINGS-FIT: the shorter tip half a radian round (it was 0.3 at 2.2 m)
  assert.ok(near(strandAt(k, 0, { pose: { uTorsoU: [0, c, sn], uTorsoF: [0, -sn, c] } }).mid, [WING_ROOT.apart, CLOAK_SHOULDER_Y - WING_ROOT.below * c - WING_ROOT.back * -sn, -WING_ROOT.below * sn - WING_ROOT.back * c], 1e-5), 'the roots on the back as it leans');
});

test('SERAPH-WINGS on the back of an Eye of the Beholder sprite: its bones read off the frame drawn BY THE PIXEL - the shoulders at the sets\' own shoulder line over the frame\'s foot, whatever the frame holds (AUDIT 3: a sword up or a hand raised made the frame taller and the cloak float over the head), not the rest pose\'s; sunk with a crouch; a beast\'s at its own line; broad by its metres a pixel (within bounds); folded and closed when sunk to the neck; a peer\'s at their own feet; none without a figure; the sprite body hands the frame it drew - its metres a pixel, its form and the way it FACES (walking back it faces the camera) - none undrawn, none in the saddle, none in first person - the view keeps it for the aura, and a peer\'s walker or beast its own; a rider without bones hangs from over the saddle, the saddle the motor\'s (mutants: the figure ignored, the shoulder line, the frame\'s height read, the beast, the breadth, the sunk fold, the facing, first person, the saddle)', async () => {
  const shoulderOf = (fig) => auraSpriteBones(fig)['bip01 r upperarm'][1];
  const standing = auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp });
  const line = EOTB_FIGURE.shoulder * EOTB_FIGURE.mpp;
  assert.ok(Math.abs(standing['bip01 r upperarm'][1] - line) < 1e-9 && line > CLOAK_SHOULDER_Y + 0.2, `the shoulders at the sets' own line (${line.toFixed(2)} m), well over the rest pose's ${CLOAK_SHOULDER_Y}`);
  // AUDIT 3: measured off the frames' alpha - each frame's own shoulders, whatever it holds, within a hand of the line
  for (const [frame, px] of [['Idle', 88], ['IdleMelee', 80], ['IdleSpell', 84], ['IdleRanged', 87]]) assert.ok(Math.abs(line - px * EOTB_FIGURE.mpp) < 0.12, `${frame}: ${px} px over the foot`);
  assert.deepEqual(auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp, h: 3.3 }), standing, 'a taller frame (a staff, a raised hand) is not a taller body');
  assert.equal(standing.sunk, false);
  const p = auraCapePose(standing);
  assert.ok(Math.abs(p.shoulders[1] - line) < 1e-6 && Math.abs(p.shoulders[3] - 1) < 1e-6 && p.sunk === false, 'hung there, as broad as the rest');
  assert.ok([...p.torso].every((x, i) => Math.abs(x - CLOAK_REST_POSE.torso[i]) < 1e-6), 'a flat figure stands upright');
  assert.ok(Math.abs(strandAt(broad(1, 3), 0, { pose: { uCapeS: [...p.shoulders], uTorsoU: [0, 1, 0], uTorsoF: [0, 0, 1] } }).mid[1] - (p.shoulders[1] - WING_ROOT.below)) < 1e-6, 'the wings grow from there');
  assert.ok(Math.abs(auraCapePose(auraSpriteBones({ base: -0.45, mpp: EOTB_FIGURE.mpp })).shoulders[1] - (line - 0.45)) < 1e-6, 'crouched, sunk with the sprite');
  const beastS = shoulderOf({ base: 0, mpp: 0.029, beast: true });
  assert.ok(beastS > 1.65 && beastS < 1.74, `a beast's frames (0.029 m a pixel): at its own shoulders, measured 1.65 - 1.74 m (${beastS.toFixed(2)})`);
  assert.ok(shoulderOf({ base: 0, mpp: 0.029 }) > 2.4, 'read as a walker\'s it would float - the form is read');
  const big = auraCapePose(auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp * 1.1 }));
  assert.ok(Math.abs(big.shoulders[3] - 1.1) < 1e-6 && Math.abs(big.shoulders[1] - line * 1.1) < 1e-6, 'a sprite drawn bigger (BillboardScale): higher and broader');
  assert.ok(Math.abs(auraCapePose(auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp * 3 })).shoulders[3] - CLOAK_ACROSS[1]) < 1e-6, 'within the bounds');
  // sunk to the neck in water: the quad's top at the waterline - nothing hangs from shoulders under it
  const sunk = auraSpriteBones({ base: 0.45 - 110 * EOTB_FIGURE.mpp, mpp: EOTB_FIGURE.mpp });
  assert.equal(sunk.sunk, true); assert.equal(auraCapePose(sunk).sunk, true, 'the pose says so');
  assert.equal(auraSpriteBones(null), null);
  assert.equal(auraSpriteBones({ base: 0, mpp: 0 }), null, 'no figure, no bones');
  assert.equal(auraSpriteBones({ base: 0, h: 2.09 }), null, 'a height alone is no figure');
  const w = { at: [3, 0, 4], yaw: 0.7 };
  const posed = auraSpritePosed(w, { base: 0, mpp: EOTB_FIGURE.mpp });
  assert.ok(posed.feet === w.at && posed.yaw === 0.7 && posed.bones['bip01 head'], 'a peer\'s at their own feet and facing');
  assert.equal(auraSpritePosed(w, null), null);
  // folded and closed when sunk: the cloth, the cards, the strands - none drawn; the ground still
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const r0 = new AuraRingRenderer(gl);
  const drawsOf = (aura, cape) => { calls.length = 0; r0.draw([{ at: [0, 0, 0], aura, yaw: 0, cape }], new Float32Array(I), new Float32Array(I), [0, 1.5, -5], 10); return calls.filter((c) => c[0] === 'drawArrays').length; };
  const sunkPose = auraCapePose(sunk), upPose = auraCapePose(standing);
  assert.equal(drawsOf('seraphwings', sunkPose), 1, 'the wings closed - the ground alone');
  assert.ok(drawsOf('seraphwings', upPose) > 2, 'open on a body standing');
  assert.equal(drawsOf('shadowcloak', sunkPose), 1, 'the cloak folded - the ground alone');
  assert.ok(drawsOf('shadowcloak', upPose) > 2);
  // the sprite body hands the frame it drew
  const fake = () => ({ batches: [], uploadTexture() {}, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} });
  const r = fake();
  const b = createEotbBody({ count: () => 3035, urlFor: (k2) => `/art/${k2}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  assert.equal(b.figure(), null, 'nothing drawn, no figure');
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  const still = { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw: 0, cameraPos: [0, 3.5, -2] };
  for (let i = 0; i < 12; i++) b.tick(1 / 60, still);
  await new Promise((res) => setTimeout(res, 2));
  assert.equal(b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }), true);
  const drawn = r.batches.at(-1), fig = b.figure();
  assert.ok(fig && Math.abs(fig.mpp - drawn.size.h / 6) < 1e-9 && Math.abs(fig.base - (drawn.origin[1] - 2)) < 1e-9 && fig.beast === false, `the frame drawn, over its feet, its metres a pixel (${JSON.stringify(fig)})`);
  // WINGS-FIT: facing nowhere yet (Vector3.zero) the sprite shows the eye its FRONT (orientation 0) - so it faces the eye,
  // and the wings hang behind it; it answered null, and the camera's yaw hung them over the sprite's face
  assert.equal(b.state().orientation, 0, 'facing nowhere: its front to the eye');
  assert.ok(Math.abs(Math.atan2(Math.sin(fig.yaw - Math.PI), Math.cos(fig.yaw - Math.PI))) < 1e-9, `facing nowhere yet: facing the eye (${fig.yaw})`);
  // AUDIT 3: WALKING BACK, THE SPRITE FACES THE CAMERA - and so do the cloak and the wings (they were the camera's way: the cape over its face)
  const yaw = 0.3, cp = [-Math.sin(yaw) * 2, 3.5, -Math.cos(yaw) * 2];
  for (let i = 0; i < 40; i++) b.tick(1 / 60, { motion: { forward: -1, strafe: 0, standing: false, speed: 3, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw, cameraPos: cp });
  await new Promise((res) => setTimeout(res, 2));
  b.draw(null, { eye: cp, feet: [0, 2, 0], yaw });
  const back = b.figure().yaw, d = Math.atan2(Math.sin(back - yaw), Math.cos(back - yaw));
  assert.ok(Math.abs(Math.abs(d) - Math.PI) < 1e-6, `walking back: faced about (${back.toFixed(3)} against the camera's ${yaw})`);
  for (let i = 0; i < 40; i++) b.tick(1 / 60, { motion: { forward: 0, strafe: 1, standing: false, speed: 3, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw, cameraPos: cp });
  await new Promise((res) => setTimeout(res, 2));
  b.draw(null, { eye: cp, feet: [0, 2, 0], yaw });
  assert.ok(Math.abs(b.figure().yaw - (yaw + Math.PI / 2)) < 1e-6, 'strafing: side on');
  assert.ok(b.figure(), 'a figure stands from the last frame drawn');
  b.toggle(false, false);
  assert.equal(b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }), false);
  assert.equal(b.figure(), null, 'nothing drawn this frame: no figure kept from the last');
  // AUDIT 3: none in first person - the billboard stands on the camera, and a figure lifted the hood off the eye
  b.toggle(true, true);
  for (let i = 0; i < 12; i++) b.tick(1 / 60, still);
  await new Promise((res) => setTimeout(res, 2));
  assert.equal(b.draw(null, { eye: [0, 3.7, 0], feet: [0, 2, 0], yaw: 0 }), true, 'drawn (its shadow)');
  assert.equal(b.figure(), null, 'but no figure');
  // the plumbing: the door hands the figure, the view keeps it, a peer's walker or beast gives its own
  const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  assert.match(src('src/player/eotbBody.js'), /setEotbDrawBody\(\(canvas, f\) => this\.draw\(canvas, f\), \(\) => this\.figure\(\)\);/);
  assert.match(src('src/player/eotbBody.js'), /figure = last\.riding \|\| FP \? null : \{ base: c\[1\] - cam\.feet\[1\], mpp: batchPx > 0 \? batchSize\.h \* grow \/ batchPx : 0, beast: !!last\.transformed, yaw: /, 'none in the saddle - a rider\'s frame is the horse\'s too - nor in first person');
  const mv = src('src/player/mwView.js');
  assert.match(mv, /const drawn = drawEotbBody\([^;]*\); spriteFigure = drawn \? eotbFigure\(\) : null; return drawn;/);
  assert.match(mv, /export function mwViewSpriteFigure\(\) \{ return eotbLane\(\) \? spriteFigure : null; \}/);
  const pr = src('src/net/peerRiders.js');
  assert.match(pr, /figureOf: layer\.figureOf,   \/\/ SERAPH-WINGS/);
  assert.match(pr, /figureOf: layer\.figureOf,   \/\/ AUDIT 3 \(SERAPH-WINGS\): a beast's on foot/);
  assert.match(pr, /r\.px > 0 && r\.form !== 'rider' \? \{ base: \(r\.xml\.y \/ r\.xml\.scale\) \* \(r\.g \?\? 1\), mpp: r\.size\.h \/ r\.px, beast: r\.form === 'beast' \} : null/);
  assert.match(pr, /r\.px = up\.h; r\.form = mode\?\.riding \? 'rider' : mode\?\.transformed \? 'beast' : 'walker';/);
  // a rider with no bones: from over the saddle - the motor's own saddle
  const rider = auraCapeStep({ at: [0, 0, 0], mounted: true }, null, 1);
  assert.ok(Math.abs(rider.cape.shoulders[1] - (CLOAK_SHOULDER_Y + AURA_SADDLE_M)) < 1e-6 && rider.cape !== CLOAK_REST_POSE && Math.abs(CLOAK_REST_POSE.shoulders[1] - CLOAK_SHOULDER_Y) < 1e-6, 'a rider\'s wings from over the saddle - the rest pose untouched');
  assert.ok(Math.abs(AURA_SADDLE_M - (RIDE_EYE_HEIGHT - EYE_HEIGHT)) < 1e-9, 'the saddle the motor\'s: its eye in the saddle over its eye afoot');
});

test('SERAPH-WINGS AUDIT 3, the net: a crouched or mounted wearer without bones keeps an upright back - its wings reach (a zeroed torso collapsed every strand onto the shoulder); a back laid flat stands at rest; a peer\'s sprite figure, driven - a walker\'s by the pixel, a beast\'s on foot its own, none in the saddle or unknown; the wings\' light from the shoulders the pose holds, none when closed, and through the dungeon\'s flame tint gold (mutants: the torso reset, the flat back, the peer\'s figure, the light\'s pose, the sunk light, the tint)', async () => {
  const near = (a, b, tol = 1e-6) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < tol);
  const leaning = { shoulders: Float32Array.of(0, 1.5, 0, 1), head: Float32Array.of(0, 1.8, 0, 0), kneeL: new Float32Array(3), kneeR: new Float32Array(3), torso: Float32Array.of(0, 0.9, 0.436, 0, -0.436, 0.9) };
  for (const [label, w, k] of [['a rider', { at: [0, 0, 0], mounted: true }, 1], ['crouched', { at: [0, 0, 0] }, 0.6], ['a reused leaning cape, crouched', { at: [0, 0, 0], cape: leaning }, 0.6]]) {
    const cape = auraCapeStep(w, null, k).cape;
    assert.ok(near([...cape.torso], [...CLOAK_REST_POSE.torso]), `${label}: the back upright (${[...cape.torso]})`);
    const tip = strandAt(broad(1, 7), 1, { pose: { uCapeS: [...cape.shoulders], uTorsoU: [...cape.torso.slice(0, 3)], uTorsoF: [...cape.torso.slice(3)] } }).mid, root = strandAt(broad(1, 7), 0, { pose: { uCapeS: [...cape.shoulders], uTorsoU: [...cape.torso.slice(0, 3)], uTorsoF: [...cape.torso.slice(3)] } }).mid;
    assert.ok(Math.hypot(...tip.map((x, i) => x - root[i])) > 0.9, `${label}: the wings reach`);
  }
  const out = new Float32Array(6), L = [-0.2, 1.4, 0], R = [0.2, 1.4, 0], tilt = 80 * Math.PI / 180;
  assert.ok(near([...auraTorso(L, R, [0, 1.2, 0], [0, 1.2 + 0.3 * Math.cos(tilt), 0.3 * Math.sin(tilt)], [0, 1.25 + 0.4 * Math.cos(tilt), 0.4 * Math.sin(tilt)], out)], [...CLOAK_REST_POSE.torso]), 'a back laid 80 degrees over: at rest');
  // a peer's sprite figure, driven through the real layers
  const renderer = { uploadTexture() {}, createBillboardBatch: (archive, record, size) => ({ archive, record, size, origin: null }), destroyBillboardBatch() {} };
  const art = createEotbArt({ renderer, urlFor: (k2) => `u:${k2}`, decode: async () => ({ width: 50, height: 110, colors: new Uint32Array(50 * 110) }) });
  const toScene = (q) => [q.x, q.y, q.z], pose = (o = {}) => ({ x: 4, y: 0, z: 9, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, sr: 0, cn: 0, ar: 0, ...o });
  const walkers = createPeerWalkers({ art }), riders = createPeerRiders({ art });
  const peers = [{ id: 'w', look: { eo: 0 }, shown: pose() }, { id: 'b', look: { eo: 0 }, shown: pose({ wb: 1 }) }, { id: 'h', look: { eo: 0 }, shown: pose({ rd: 1 }) }];
  for (let i = 0; i < 2; i++) { walkers.sync(peers, toScene, { eye: [4, 1, 20], dt: 0.01 }); riders.sync(peers, toScene, { eye: [4, 1, 20], dt: 0.01 }); await new Promise((res) => setTimeout(res, 5)); }
  const wf = walkers.figureOf('w'), wr = walkers.walkers.get('w');
  assert.ok(wf && Math.abs(wf.mpp - wr.size.h / 110) < 1e-9 && Math.abs(wf.base - (wr.xml.y / wr.xml.scale) * (wr.g ?? 1)) < 1e-9 && wf.beast === false, `a walker's: by the pixel (${JSON.stringify(wf)})`);
  assert.ok(Math.abs(wf.mpp - EOTB_FIGURE.mpp) < 0.002, 'at the standing scale');
  const bf = riders.figureOf('b');
  assert.ok(bf && bf.beast === true && bf.mpp > wf.mpp, `a beast on foot: its own, a beast's (${JSON.stringify(bf)})`);
  assert.ok(riders.isRiding('h'), 'the horse drawn');
  assert.equal(riders.figureOf('h'), null, 'none in the saddle - the frame is the horse\'s too');
  assert.equal(walkers.figureOf('nobody'), null); assert.equal(riders.figureOf('nobody'), null);
  // the wings' light from the pose's shoulders; none closed; tagged an aura's
  const lit = [];
  const cape = { ...CLOAK_REST_POSE, shoulders: Float32Array.of(0, 2.23, 0, 1) };
  auraWingLights([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0, cape }], [0, 1.6, -5], lit);
  assert.ok(Math.abs(lit[0].y - (2.23 + WING_LIGHT.lift)) < 1e-6 && lit[0].aura === true, 'from the shoulders the pose holds - and an aura\'s');
  auraWingLights([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0, cape: { ...cape, sunk: true } }], [0, 1.6, -5], lit);
  assert.equal(lit.length, 0, 'closed: unlit');
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(wm, /const _dgTint = \(l\) => \(l && !l\.aura \? \{ \.\.\.l, color: _iilOn \? iilTorch\(l\)\.color : _dgColor \} : l\);/, 'the dungeon\'s flame tint passes an aura\'s light by');
});

test('SERAPH-WINGS AUDIT 4: a pose reused after a swim is not left sunk - a swim and then a ride or a crouch opens the wings again and lights them; the last segment of every strand lies flat, its across the same way as the one before it (it was taken backward at the tip, and the segment twisted into a bowtie) (mutants: the stale sunk, the tip\'s tangent)', () => {
  const w = { at: [0, 0, 0], aura: 'seraphwings', yaw: 0 };
  auraCapeStep(w, { feet: [0, 0, 0], yaw: 0, bones: auraSpriteBones({ base: 0.45 - 110 * EOTB_FIGURE.mpp, mpp: EOTB_FIGURE.mpp }) }, 1);
  assert.equal(w.cape.sunk, true, 'swimming: sunk');
  w.mounted = true;
  auraCapeStep(w, null, 1);
  assert.equal(w.cape.sunk, false, 'then riding: open');
  const lit = [];
  auraWingLights([w], [0, 1.6, -5], lit);
  assert.equal(lit.length, 1, 'and lit');
  w.mounted = false;
  auraCapeStep(w, { feet: [0, 0, 0], yaw: 0, bones: auraSpriteBones({ base: 0.45 - 110 * EOTB_FIGURE.mpp, mpp: EOTB_FIGURE.mpp }) }, 1);
  auraCapeStep(w, null, 0.6);
  assert.equal(w.cape.sunk, false, 'then crouched without bones: open');
  // the tip: the ribbon's across at the last two rows the same way round, for every strand
  const acrossAt = (k, t) => {
    const at2 = (side) => { const f = glslFunctions(AURA_VS, { ...BASE, aP: [k * 2 + side, t], uKind: 1, uTime: QUIET, uYaw: 0, uAt: [0, 0, 0], uCamPos: FAR }); f.main(); return f.globals.vWorld; };
    const a = at2(0), b = at2(1);
    return b.map((x, i) => x - a[i]);
  };
  let flipped = 0;
  for (let k = 0; k < WING_STRAND_COUNT; k += 7) {
    const a = acrossAt(k, (WING_SEGS - 1) / WING_SEGS), b = acrossAt(k, 1);
    if (a.reduce((s2, x, i) => s2 + x * b[i], 0) < 0) flipped++;
  }
  assert.equal(flipped, 0, 'no strand twisted at its tip');
});

// ── WINGS-FIT ───────────────────────────────────────────────────────

test('SERAPH-WINGS WINGS-FIT (Mac: "the wings should sit farther back on the eye of the beholder skin ... clips on certain rotational directions", "the aura itself is WAY too bright ... match this and the slimness of the wings"): a Beholder sprite is a flat card through its feet, so its wings root WING_SPRITE_BACK further back - seen from its front round to either side no wing is laid over the body it grows from (a hand behind the card, the root stood inside the body\'s outline from the side and was drawn over it); the pose carries the depth, a rig\'s and the rest pose\'s none, the pass uploads it; and slim, short and soft as the painting - three strands a plume, slim ribbons, six tenths as long, no strand\'s heart, backlight or pool at the old blaze (mutants: the depth, its carriage, its upload, the slimness, the light)', () => {
  // the depth: the sprite's, as big as it is drawn; carried by the pose; none for a rig or at rest; dropped with the sprite
  const fig = { base: 0, mpp: EOTB_FIGURE.mpp };
  assert.equal(auraSpriteBones(fig).wingBack, WING_SPRITE_BACK);
  assert.ok(Math.abs(auraSpriteBones({ base: 0, mpp: EOTB_FIGURE.mpp * 1.2 }).wingBack - WING_SPRITE_BACK * 1.2) < 1e-9, 'a sprite drawn bigger: further back');
  const sp = auraCapePose(auraSpriteBones(fig));
  assert.equal(sp.wingBack, WING_SPRITE_BACK, 'the pose carries it');
  const rig = { 'bip01 l upperarm': [-0.2, 1.45, 0], 'bip01 r upperarm': [0.2, 1.45, 0], 'bip01 neck': [0, 1.5, 0], 'bip01 head': [0, 1.6, 0] };
  assert.equal(auraCapePose(rig, auraCapePose(auraSpriteBones(fig))).wingBack, 0, 'a rig has a back of its own - and a pose reused from a sprite drops its depth');
  assert.equal(CLOAK_REST_POSE.wingBack, 0);
  const w = { at: [0, 0, 0], aura: 'seraphwings', yaw: 0 };
  auraCapeStep(w, { feet: [0, 0, 0], yaw: 0, bones: auraSpriteBones(fig) }, 1);
  assert.equal(w.cape.wingBack, WING_SPRITE_BACK);
  w.mounted = true; auraCapeStep(w, null, 1);
  assert.equal(w.cape.wingBack, 0, 'hung from the rest pose again: none');
  // the pass uploads it with the pose
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, FRONT: 14, BACK: 15 }, {
    get(tg, k) { if (k in tg) return tg[k]; return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const r0 = new AuraRingRenderer(gl);
  const upload = (cape) => { calls.length = 0; r0.draw([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0, cape }], new Float32Array(I), new Float32Array(I), [0, 1.5, -5], 10); return calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uWingBack').map((c) => c[2]); };
  assert.deepEqual(upload(sp), [WING_SPRITE_BACK], 'uploaded with the pose');
  assert.deepEqual(upload(undefined), [0], 'none at rest');
  // the shader roots them there
  const root = strandAt(broad(1, 3), 0, { pose: { uWingBack: WING_SPRITE_BACK } }).mid;
  assert.ok(Math.abs(root[2] + WING_ROOT.back + WING_SPRITE_BACK) < 1e-6, `rooted further back (${root[2].toFixed(3)})`);
  const haloAt = (back) => { const f = glslFunctions(AURA_VS, { ...BASE, uWingBack: back, aP: [WING_MOTES * 2 + 0.5, 0.5], uKind: 2, uTime: QUIET, uYaw: 0, uAt: [0, 0, 0], uCamPos: FAR }); f.main(); return f.globals.vWorld; };
  assert.ok(Math.abs(haloAt(WING_SPRITE_BACK)[2] - (haloAt(0)[2] - WING_SPRITE_BACK)) < 1e-6, 'the backlight behind the roots, where they are');
  const lit = [];
  auraWingLights([{ at: [0, 0, 0], aura: 'seraphwings', yaw: 0, cape: sp }], [0, 1.6, -5], lit);
  assert.ok(Math.abs(lit[0].z + WING_LIGHT.back + WING_SPRITE_BACK) < 1e-6, `and the light on the world (${lit[0].z.toFixed(3)})`);
  // THE LAW: the card stands through the axis square to the eye, and the body in it about 0.25 m either side of the axis
  // to its head. From its front round to either side - where the sprite shows its front or its side, never its back -
  // no point of a wing lies nearer the eye than the card AND inside that outline (drawn over the body it grows from)
  const F = glslFunctions(AURA_VS, { ...BASE, uCapeS: [...sp.shoulders], uCapeH: [...sp.head], uKind: 1, uTime: QUIET, uYaw: 0, uCamPos: FAR });
  const headTop = sp.head[1] + 0.12;
  const overBody = (back) => {
    F.globals.uWingBack = back;
    let n = 0;
    for (const deg of [0, 30, 60, 90, -30, -60, -90]) {
      const ph = deg * Math.PI / 180, to = [Math.sin(ph), Math.cos(ph)];   // the eye's way from the feet - the wearer faces +z
      for (let k = 0; k < WING_STRAND_COUNT; k++) for (let i = 1; i <= 10; i++) {
        const p = F.wingPoint(k, i / 10, QUIET);
        if (p[0] * to[0] + p[2] * to[1] > 0 && Math.abs(p[0] * to[1] - p[2] * to[0]) < 0.25 && p[1] < headTop) n++;
      }
    }
    return n;
  };
  assert.equal(overBody(WING_SPRITE_BACK), 0, 'no wing laid over the body, from its front round to either side');
  const was = overBody(0);
  assert.ok(was > 50, `a hand behind the card, they were (${was} points over the body)`);
  // SLIM, SHORT AND SOFT ("way to long, too large and overbearing"): three strands a plume, slim ribbons, about six
  // tenths as long, the backlight smaller; the brightest a strand's heart burns over the clock, the
  // backlight's heart and the pool all well under what they were (2.7, 3.6 and 0.33)
  assert.ok(WING_STRANDS === 3 && WING_W.broad <= 0.12 && WING_W.fine <= 0.04 && WING_HALO_M <= 1.2 && WING_REACH[1] <= 1.3 && WING_COVERT.reach[1] <= 0.5, `slim and short (${WING_STRANDS} strands, ${WING_W.broad} m)`);
  const L = glslFunctions(AURA_FS, { ...BASE, vP: [0.5, 0.5], vWorld: [0, 1.6, -0.6], vS: [0, 0, 0], uKind: 1, uTime: 0, uYaw: 0, uKindle: 1, uCamPos: FAR, uAt: [0, 0, 0] });
  let hot = 0, halo = 0;
  for (let i = 0; i < 240; i++) {
    L.globals.uTime = i * 0.5;
    L.globals.uKind = 1; L.globals.vS = [broad(1, 3), 0, 0]; L.globals.vWorld = [0, 1.6, -0.6];
    for (const t of [0.3, 0.45, 0.6]) { L.globals.vP = [0.5, t]; L.main(); hot = Math.max(hot, ...L.globals.o.slice(0, 3)); }
    L.globals.uKind = 2; L.globals.vS = [1, 2, WING_MOTES]; L.globals.vWorld = [0, CLOAK_SHOULDER_Y, -0.6]; L.globals.vP = [0.5, 0.5]; L.main(); halo = Math.max(halo, lum(L.globals.o));
  }
  assert.ok(hot > 0.6 && hot < 1.5, `a strand's heart at its brightest (${hot.toFixed(2)})`);
  assert.ok(halo > 0.3 && halo < 1.2, `the backlight's heart at its brightest (${halo.toFixed(2)})`);
});

// ── THE INSANE PARTS ────────────────────────────────────────────────

test('SERAPH-WINGS the coverts and the beat, RUN: inside the primaries a layer of short coverts, shorter and softer; every eight seconds a slow stroke - the fan swept down and its tips forward, fast down and slow back, the tips after the roots - and the light flaring with it (mutants: the coverts\' reach, the stroke, its lag, the flare)', () => {
  const covert = (side, q) => (side < 0 ? 0 : WING_PER_SIDE) + (WING_PLUMES + q) * WING_STRANDS;
  const reachOf = (k) => { const r = strandAt(k, 0).mid, t = strandAt(k, 1).mid; return Math.hypot(...t.map((x, i) => x - r[i])); };
  const covertMost = Math.max(...Array.from({ length: WING_COVERTS }, (_, q) => reachOf(covert(1, q))));
  const primaryLeast = Math.min(...Array.from({ length: WING_PLUMES }, (_, p) => reachOf(broad(1, p))));
  assert.ok(covertMost < primaryLeast + 0.1 && covertMost < WING_COVERT.reach[1] + 0.2, `the coverts short (${covertMost.toFixed(2)} m at most, the primaries ${primaryLeast.toFixed(2)} at least)`);
  // WINGS-FIT: the low primaries short and the high ones long, in the shape itself (the lowest tip's height pinned it
  // while the wings were 2.2 m; at 1.3 m every plume as long as the highest still hung its lowest tip off the ground)
  assert.ok(reachOf(broad(1, 0)) < reachOf(broad(1, WING_PLUMES - 1)) * 0.7, `the low plumes short (${reachOf(broad(1, 0)).toFixed(2)} m, the highest ${reachOf(broad(1, WING_PLUMES - 1)).toFixed(2)})`);
  assert.ok(lum(fsW(1, [0.5, 0.5], { s: [covert(1, 3), 0, 1] })) < lum(fsW(1, [0.5, 0.5], { s: [covert(1, 3), 0, 0] })) * 0.6, 'and softer');
  const F = glslFunctions(AURA_FS, { ...BASE, vP: [0, 0], vWorld: [0, 0, 0], vS: [0, 0, 0], uKind: 1, uTime: 0, uYaw: 0, uKindle: 1, uCamPos: FAR });
  const peak = 0.18 * 8, rest = 0.9 * 8;
  assert.ok(F.wingBeat(0, peak) > 0.99 && F.wingBeat(0, rest) < 0.01, 'the stroke at its height and between strokes');
  assert.ok(F.wingBeat(0, 0.05 * 8) > F.wingBeat(1, 0.05 * 8) && F.wingBeat(1, peak + 0.06 * 8) > 0.99, 'the tips after the roots');
  assert.ok(F.wingBeat(0, 0.09 * 8) > 0.4 && F.wingBeat(0, 0.46 * 8) > 0.4, 'fast down, slow back up');
  const k = broad(1, 6), up = strandAt(k, 1, { time: rest }).mid, down = strandAt(k, 1, { time: peak + 0.06 * 8 }).mid;
  assert.ok(down[1] < up[1] - 0.25 && down[2] > up[2] + 0.4, `the fan swept down and its tips forward (${up.map((x) => x.toFixed(2))} to ${down.map((x) => x.toFixed(2))})`);
  assert.ok(WING_BEAT.down > 0.2 && WING_BEAT.forward > 0.2);
});

test('SERAPH-WINGS the backlight and the sparks, RUN: behind the upper back a card of radiance square to the eye, white at its heart, rays turning in it, none past its round, none unkindled, none over an eye among the wings; a spark a streak along the strand it rides, brightest at its head (mutants: the backlight\'s place, its facing, its rays, its gate, the streak\'s way, its head)', () => {
  const card = (k, corner, o = {}) => { const f = glslFunctions(AURA_VS, { ...BASE, aP: [k * 2 + corner[0], corner[1]], uKind: 2, uTime: o.time ?? QUIET, uYaw: 0, uAt: [0, 0, 0], uCamPos: o.eye ?? FAR, ...(o.pose ?? {}) }); f.main(); return f.globals; };
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map((c) => card(WING_MOTES, c).vWorld);
  const mid = [0, 1, 2].map((i) => corners.reduce((a, c) => a + c[i], 0) / 4);
  assert.ok(Math.abs(mid[0]) < 1e-6 && mid[2] < -WING_ROOT.back - 0.1 && mid[1] > CLOAK_SHOULDER_Y, `behind the upper back (${mid.map((x) => x.toFixed(2))})`);
  const dot = (a, b) => a.reduce((s2, x, i) => s2 + x * b[i], 0);
  for (const eye of [FAR, [2, 4.5, -4]]) {
    const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map((c) => card(WING_MOTES, c, { eye }).vWorld);
    const ax = cs[1].map((x, i) => x - cs[0][i]), ay = cs[3].map((x, i) => x - cs[0][i]), to = eye.map((x, i) => x - mid[i]);
    assert.ok(Math.abs(Math.hypot(...ax) - WING_HALO_M) < 1e-6 && Math.abs(dot(ax, to)) < 1e-5 && Math.abs(dot(ay, to)) < 1e-5, `its size, square to the eye at ${eye}`);
  }
  assert.equal(card(WING_MOTES, [0.5, 0.5]).vS[1], 2, 'marked the backlight');
  // AUDIT 4: gone with the eye near its middle - the wearer's own first person (the eye at 1.7 m over the feet, about
  // 0.36 m from it), looking down, washed the floor before the feet gold; whole from a camera behind, and from a peer
  // at arm's length
  assert.equal(card(WING_MOTES, [0.5, 0.5], { eye: [0, 1.7, 0] }).vS[0], 0, 'from the wearer\'s own eye: none');
  assert.equal(card(WING_MOTES, [0.5, 0.5]).vS[0], 1, 'from afar: whole');
  assert.equal(card(WING_MOTES, [0.5, 0.5], { eye: [mid[0] + WING_HALO_NEAR[1] + 0.05, mid[1], mid[2]] }).vS[0], 1, 'at arm\'s length past its fade: whole');
  assert.ok(WING_HALO_NEAR[0] > 0.5 && WING_HALO_NEAR[1] < 2, `the fade ${WING_HALO_NEAR}`);
  assert.equal(lum(fsW(2, [0.5, 0.5], { s: [0, 2, WING_MOTES], world: mid })), 0, 'and the light goes with it');
  const halo = (uv, o = {}) => fsW(2, uv, { s: [1, 2, WING_MOTES], world: mid, ...o });
  const heart = halo([0.5, 0.5]), ring = Array.from({ length: 48 }, (_, i) => lum(halo([0.5 + 0.18 * Math.cos(i / 48 * TAU), 0.5 + 0.18 * Math.sin(i / 48 * TAU)])));
  assert.ok(lum(heart) > Math.max(...ring) && heart[2] / heart[0] > 0.4, 'white at its heart');
  assert.ok(Math.max(...ring) > Math.min(...ring) * 1.25, 'rays in it');
  const ringLater = Array.from({ length: 48 }, (_, i) => lum(halo([0.5 + 0.18 * Math.cos(i / 48 * TAU), 0.5 + 0.18 * Math.sin(i / 48 * TAU)], { time: QUIET + 3 })));
  assert.ok(ring.some((x, i) => Math.abs(x - ringLater[i]) > 0.02), 'turning');
  assert.equal(halo([0.02, 0.02]), 'discard', 'none past its round');
  assert.equal(lum(halo([0.5, 0.5], { kindle: 0.4 })), 0, 'none till the wings are half unfurled');
  assert.equal(lum(halo([0.5, 0.5], { eye: [mid[0], mid[1], mid[2] + 0.2] })), 0, 'none over an eye among the wings');
  // a spark: its long side along its way
  const sp = [[0, 0], [1, 0], [0, 1]].map((c) => card(3, c));
  const across = sp[1].vWorld.map((x, i) => x - sp[0].vWorld[i]), along = sp[2].vWorld.map((x, i) => x - sp[0].vWorld[i]);
  const age = sp[0].vS[0], sc = 1 - 0.4 * age;
  assert.ok(Math.abs(Math.hypot(...along) - WING_MOTE_LEN * sc) < 1e-6 && Math.abs(Math.hypot(...across) - WING_MOTE_M * sc) < 1e-6, 'a streak: long along, narrow across');
  const level = Array.from({ length: 8 }, (_, k) => { const c0 = card(k, [0, 0]).vWorld, c1 = card(k, [0, 1]).vWorld; const d = c1.map((x, i) => x - c0[i]); return Math.abs(d[1]) / Math.hypot(...d) < 0.9; }).filter(Boolean).length;
  assert.ok(level >= 3, `along the strands it rides, out to the side - not all upright (${level} of 8)`);
  const head = fsW(2, [0.5, 0.8], { s: [0.4, 0, 3] }), tail = fsW(2, [0.5, 0.2], { s: [0.4, 0, 3] });
  assert.ok(lum(head) > lum(tail) * 1.5, 'brightest at its head');
});

test('SERAPH-WINGS the light on the world: a gold light behind the shoulders of each wearer of the wings - the nearest three within reach of the eye, its range as they kindle, carried (no glare, no shadow slot) - none for another aura or unkindled; and every host\'s light list carries them (mutants: the light, its colour, its cap, its reach, its gate)', () => {
  const out = [];
  const wearer = (at, o = {}) => ({ at, aura: 'seraphwings', yaw: 0, kindle: 1, ...o });
  auraWingLights([wearer([0, 0, 0]), { at: [1, 0, 0], aura: 'shadowcloak' }, { at: [2, 0, 0], aura: 'radiance' }], [0, 1.6, -5], out);
  assert.equal(out.length, 1, 'one light, for the wings alone');
  const l = out[0];
  assert.ok(Math.abs(l.y - (CLOAK_SHOULDER_Y + WING_LIGHT.lift)) < 1e-6 && Math.abs(l.z + WING_LIGHT.back) < 1e-6 && Math.abs(l.x) < 1e-6, 'behind the shoulders');
  assert.ok(l.carried === true && l.range === WING_LIGHT.range && l.color[0] === WING_LIGHT.rgb[0] && l.color[0] > l.color[1] && l.color[1] > l.color[2], 'carried, its full range, gold');
  assert.ok(WING_LIGHT.range <= 4.5 && WING_LIGHT.rgb[0] <= 0.7, 'WINGS-FIT: a soft light (it was 7 m at full)');
  auraWingLights([wearer([0, 0, 0], { yaw: Math.PI / 2 })], [0, 0, 0], out);
  assert.ok(Math.abs(out[0].x + WING_LIGHT.back) < 1e-6 && Math.abs(out[0].z) < 1e-6, 'behind them as they face');
  auraWingLights([wearer([0, 0, 0], { kindle: 0 }), wearer([0, 0, 0], { kindle: 0.5 })], [0, 0, 0], out);
  assert.ok(out.length === 1 && Math.abs(out[0].range - WING_LIGHT.range * 0.75) < 1e-6 && Math.abs(out[0].color[0] - WING_LIGHT.rgb[0] * 0.5) < 1e-6, 'none unkindled; half kindled, dimmer and nearer');
  auraWingLights([10, 2, 30, 5, 60].map((d) => wearer([d, 0, 0])), [0, 1.6, 0], out);
  assert.deepEqual(out.map((x) => Math.round(x.x)), [2, 5, 10], 'the nearest three within reach, nearest first');
  assert.equal(auraWingLights([wearer([WING_LIGHT.reach + 5, 0, 0])], [0, 1.6, 0], out).length, 0, 'none past its reach');
  assert.match(rd('src/scenes/world.js'), /\n    for \(const l of auraWingLights\(_auraWearers, cam\.pos, _auraLights\)\) _peerLights\.push\(l\); return _peerLights;/, 'every host\'s light list - the open world\'s and the dungeon\'s and the building\'s through peerLights');
});

