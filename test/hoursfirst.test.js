// HOURS-FIRST (2026-10-08, Mac: "for all the accounts here I want to grant them a unique different version of the aura,
// a title named Hour's First, and each the gilded gun"): THE FIRST GROUP TO BREAK AN ABYSS DUNGEON - the thirteen
// accounts the first clear's claims name (sd_kills, slot 1, read by .github/workflows/sd-clears.yml). The title Hour's
// First and its aura, The First Hour, held by name (server-account/src/titles.js HOURS_FIRST_HANDLES, a list in config,
// the developers' law); the aura is The Turning Hour's wheel cast again in the first dawn's colours (render/auraRing.js),
// its dial turning forward and the Hour's own mark ablaze. The gun rides the server's post (SERVER-POST).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { TITLES, AURAS, mintToken, verifyToken } from '../src/net/identityToken.js';
import {
  TITLE_TEXT, TITLE_RGBA, TITLE_GRADIENT, TITLE_EDGE, AURA_TEXT, AURA_PAINT, HOUR_DAWN, HOUR_PEARL, HOUR_SUN, HOUR_GOLD,
  badgeCss, cssRgba,
} from '../src/ui/playerBadge.js';
import {
  titlesHeld, aurasHeld, auraWorn, auraRefusal, equipRefusal, titleWorn, wardrobeOf, hoursFirstHandles, isHoursFirst,
  HOURS_FIRST_AURA,
} from '../server-account/src/titles.js';
import { readAura } from '../src/net/wire.js';
import {
  AURA_LOOK, auraLookOf, AURA_GROUND_R, AURA_FS, TURNING_R, TURNING_TOOTH_M, TURNING_RIM_M, TURNING_H, TURNING_DIAL_R,
  TURNING_MARK_M, TURNING_RGB, FIRST_RGB, FIRST_BLAZE, FIRST_SHADE, FIRST_RAY, turningDialAngle, firstDialAngle,
} from '../src/render/auraRing.js';
import { glslFunctions } from './glsl.mjs';

const { subtle } = webcrypto;
const TAU = Math.PI * 2;
const AFTER = 1_900_000_000;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const row = (handle, over = {}) => ({ handle, created_at: AFTER, registered_at: AFTER, ...over });
const env = { HOURS_FIRST_HANDLES: ' Duck , ArtemisGodfrey,terra ' };

/** The thirteen, as the first clear's claims named them (Abyss Dungeon clears, run 1, slot 1). */
const FIRST_CLEAR = ['aether', 'ArtemisGodfrey', 'CycleD0se', 'Duck', 'Kobakk', 'MackyWackyDeeJew', 'mayaamano', 'Nirnroot', 'ofrizz', 'rosalina', 'ShikiX3', 'Temegast', 'Terra'];

test('HOURS-FIRST the vocabulary: the title and the aura join the closed lists last; "Hour\'s First" and "The First Hour" in words; the title drawn rose gold into pearl into the dawn\'s white, edged in black, its one colour the rose gold and no other title\'s; the aura\'s button in its paint; no glyph (mutants: another title\'s paint; the gradient\'s order; the colour the Hourbreaker\'s)', () => {
  assert.deepEqual(TITLES.slice(-7), ['hoursfirst', 'iliacchampion', 'chaptermaster', 'chapterofficer', 'formermaster', 'highmaster', 'seasonmaster']);   // PIN MOVED (CARDS10, at the merge of main): Iliac Champion joined the list after it; PIN MOVED (CHAP4c): the Chapters' three after them - their relay after CARDS10's world182; PIN MOVED (CHAP6e): and their two more
  assert.equal(AURAS.at(-1), 'firsthour');
  assert.equal(TITLE_TEXT.hoursfirst, "Hour's First");
  assert.equal(AURA_TEXT.firsthour, 'The First Hour');
  assert.equal(HOURS_FIRST_AURA, 'firsthour');
  assert.deepEqual(TITLE_RGBA.hoursfirst, HOUR_DAWN, 'its one colour the dawn\'s rose gold');
  assert.deepEqual(TITLE_GRADIENT.hoursfirst, [HOUR_DAWN, HOUR_PEARL, HOUR_SUN], 'rose gold into pearl into the dawn\'s white');
  assert.deepEqual(TITLE_EDGE.hoursfirst, [0, 0, 0, 1], 'its white end needs a black edge');
  for (const [t, c] of Object.entries(TITLE_RGBA)) if (t !== 'hoursfirst') assert.notDeepEqual(c, HOUR_DAWN, `no colour of ${t}'s`);
  assert.notDeepEqual(HOUR_DAWN, HOUR_GOLD);
  assert.equal(AURA_PAINT.firsthour, 'hoursfirst');
  assert.ok(badgeCss().includes(`.card button.acttitle.actaura.aura-firsthour { color: ${cssRgba(TITLE_RGBA.hoursfirst)}; }`), 'its button in Hour\'s First\'s rose gold');
  // CSS-safe ids, each no longer than the longest of its list the token was sized for (test/auditlegacy3.test.js)
  assert.match(TITLES.at(-1), /^[a-z]+$/);
  assert.match(AURAS.at(-1), /^[a-z]+$/);
  assert.ok(TITLES.at(-1).length <= Math.max(...TITLES.slice(0, -1).map((t) => t.length)) && AURAS.at(-1).length <= Math.max(...AURAS.slice(0, -1).map((a) => a.length)));
});

test('HOURS-FIRST held by name: a handle in HOURS_FIRST_HANDLES holds the title and the aura, in any case; a guest - no handle - never; off the list, neither, on the next read; worn only while held; signed into the token and kept by the wire (mutants: the list not case-folded; a guest by its generated name; the aura without the title\'s list)', async () => {
  assert.deepEqual([...hoursFirstHandles(env)].sort(), ['artemisgodfrey', 'duck', 'terra']);
  const duck = row('Duck'), terra = row('TERRA'), other = row('Kobakk'), guest = { handle: null, guest_name: 'Duck', created_at: AFTER };
  assert.deepEqual([isHoursFirst(duck, env), isHoursFirst(terra, env), isHoursFirst(other, env), isHoursFirst(guest, env)], [true, true, false, false]);
  assert.ok(titlesHeld(duck, env).includes('hoursfirst'));
  assert.ok(aurasHeld(duck, env).includes('firsthour'));
  assert.ok(!titlesHeld(other, env).includes('hoursfirst') && !aurasHeld(other, env).includes('firsthour'));
  assert.ok(!titlesHeld(guest, env).includes('hoursfirst') && !aurasHeld(guest, env).includes('firsthour'), 'a guest never');
  assert.ok(!titlesHeld(duck, {}).includes('hoursfirst') && !aurasHeld(duck, {}).includes('firsthour'), 'off the list, neither');
  assert.equal(equipRefusal('hoursfirst', duck, env), null);
  assert.equal(equipRefusal('hoursfirst', other, env), 'not-held');
  assert.equal(auraRefusal('firsthour', duck, env), null);
  assert.equal(auraRefusal('firsthour', other, env), 'not-held');
  const wearing = { ...duck, title: 'hoursfirst', aura: 'firsthour' };
  assert.deepEqual([titleWorn(wearing, env), auraWorn(wearing, env)], ['hoursfirst', 'firsthour']);
  assert.deepEqual([titleWorn(wearing, {}), auraWorn(wearing, {})], [undefined, undefined], 'a stored choice no longer held is not worn');
  const w = wardrobeOf(wearing, env, AFTER);
  assert.deepEqual([w.titles.includes('hoursfirst'), w.title, w.auras.includes('firsthour'), w.aura], [true, 'hoursfirst', true, 'firsthour'], 'the account card\'s answer');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const tok = await mintToken({ s: 'acct-duck', n: 'Duck', k: 'linked', t: 'hoursfirst', au: 'firsthour' }, kp.privateKey, { subtle, nowS: AFTER });
  const got = await verifyToken(tok, kp.publicKey, { subtle, nowS: AFTER });
  assert.deepEqual([got.claims.t, got.claims.au], ['hoursfirst', 'firsthour'], 'signed into the token');
  assert.equal(readAura({ au: 'firsthour' }), 'firsthour', 'the wire keeps it');
});

test('HOURS-FIRST the config: HOURS_FIRST_HANDLES in wrangler.toml names the thirteen the first clear\'s claims named, and no one else (mutants: a name dropped; a name added)', () => {
  const m = /^HOURS_FIRST_HANDLES = "([^"]*)"$/m.exec(src('server-account/wrangler.toml'));
  assert.ok(m, 'a var beside the founders\'');
  assert.deepEqual(m[1].split(','), FIRST_CLEAR);
  const listed = hoursFirstHandles({ HOURS_FIRST_HANDLES: m[1] });
  assert.equal(listed.size, 13);
  for (const h of FIRST_CLEAR) assert.ok(isHoursFirst(row(h), { HOURS_FIRST_HANDLES: m[1] }), h);
});

// ── the look ──────────────────────────────────────────────────────────

const at = (aura, kind, vP, { t = 30.5, px = 0.001 } = {}) => {
  const f = glslFunctions(AURA_FS, {
    vP, vWorld: [0, 0, 0], uKind: kind, uAura: aura, uTime: t, uSeed: 0, uKindle: 1, uRingR: AURA_LOOK.turninghour.ringR, uGroundR: AURA_GROUND_R,
    uFlameH: TURNING_H, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1.2, 5], uAt: [0, 0, 0], uFocus: [0, 0, 0, 0],
    uResLit: Array(48).fill(0), dFdx: () => [px, 0, 0], dFdy: () => [0, px, 0],
  });
  f.main();
  return f.globals.o;
};
const lum = (c) => c[0] + c[1] + c[2];
const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

test('HOURS-FIRST THE FIRST HOUR, the shader RUN: its own kind, The Turning Hour\'s wheel at its measures; cast in the dawn\'s rose gold where the Remnant\'s is brass; its dial turning FORWARD where the Remnant\'s turns back; the Hour\'s own mark ablaze, the Remnant\'s no brighter than its others; the first light\'s rays out to the marks, none on the Remnant\'s; a palette with no white to wash out (mutants: the dial turning back; the blaze dropped; the Remnant\'s colours; the rays dropped)', () => {
  const L = AURA_LOOK.firsthour, T = AURA_LOOK.turninghour;
  assert.deepEqual([L.kind, L.ringR, L.flameH, L.glyphs, !!L.shade, L.mesh ?? null], [7, T.ringR, T.flameH, 0, false, null], 'its own kind, the wheel\'s measures');
  assert.equal(auraLookOf('firsthour'), L);
  assert.equal(new Set(Object.values(AURA_LOOK).map((l) => l.kind)).size, AURAS.length, 'a kind each');
  // the title's colours one step deeper, at FIRST_SHADE - the rose gold, the rose gold into the pearl, the pearl: no white in
  // the light the pass adds (AUDIT HOURS-FIRST: at full strength it washed out to white over a lit floor)
  const sh = (c) => c.slice(0, 3).map((x) => Math.round(x * FIRST_SHADE * 1000) / 1000);
  const mid = [0, 1, 2].map((i) => (HOUR_DAWN[i] + HOUR_PEARL[i]) / 2);
  assert.deepEqual([FIRST_RGB.brass, FIRST_RGB.gold, FIRST_RGB.light], [sh(HOUR_DAWN), sh(mid), sh(HOUR_PEARL)]);
  assert.ok(FIRST_SHADE > 0.5 && FIRST_SHADE < 1, 'deeper, not dark');
  assert.ok(Math.max(...FIRST_RGB.light) < 0.8, 'no near-white in the added light');
  assert.match(AURA_FS, /if \(uAura == 7\) \{ vec3 c = uKind == 0 \? firstGround\(vP\) : firstWall\(vP\);/);
  assert.match(AURA_FS, /if \(uAura == 6\) \{ vec3 c = uKind == 0 \? turningGround\(vP\) : turningWall\(vP\);/, 'the Remnant\'s as it was');

  // THE RIM, the same wheel in another metal: the dawn's is redder than the Remnant's brass
  const rimR = TURNING_R - TURNING_RIM_M / 2;
  const first = at(7, 0, polar(rimR, 1)), turning = at(6, 0, polar(rimR, 1));
  assert.ok(lum(first) > 0.4 && lum(turning) > 0.4, 'the rim lit in both');
  assert.ok(first[0] / first[1] > turning[0] / turning[1] + 0.1, `rose gold, not brass (r/g ${(first[0] / first[1]).toFixed(2)} vs ${(turning[0] / turning[1]).toFixed(2)})`);
  assert.ok(first[2] / first[0] > turning[2] / turning[0], 'paler - more blue in it than the brass');

  // THE DIAL: the Hour's own mark is twice as long, so between one and two marks' length in only it stands
  const ownR = TURNING_DIAL_R - 1.5 * TURNING_MARK_M;
  for (const t of [12.25, 37.5, 90.75]) {
    const fwd = firstDialAngle(t), back = turningDialAngle(t);
    assert.ok(Math.abs(Math.atan2(Math.sin(fwd - back), Math.cos(fwd - back))) > 0.2, `the two dials apart at ${t}`);
    assert.ok(lum(at(7, 0, polar(ownR, fwd), { t })) > 0.5, `The First Hour's own mark where the forward dial has it at ${t}`);
    assert.ok(lum(at(7, 0, polar(ownR, back), { t })) < 0.2, `and not where a dial turning back would at ${t}`);
    assert.ok(lum(at(6, 0, polar(ownR, back), { t })) > 0.4, `the Remnant's own mark still turning back at ${t}`);
  }
  assert.ok(Math.abs(Math.abs(firstDialAngle(60)) - Math.abs(turningDialAngle(60))) < 1e-12 && Math.sign(firstDialAngle(60)) === -Math.sign(turningDialAngle(60)), 'the same pace, the other way');

  // THE BLAZE: on The First Hour the Hour's own mark outshines an ordinary one; on the Remnant's it does not
  const t = 37.5, markR = TURNING_DIAL_R - 0.5 * TURNING_MARK_M, hour = TAU / 12;
  const own7 = lum(at(7, 0, polar(markR, firstDialAngle(t)), { t })), other7 = lum(at(7, 0, polar(markR, firstDialAngle(t) - 3 * hour), { t }));
  const own6 = lum(at(6, 0, polar(markR, turningDialAngle(t)), { t })), other6 = lum(at(6, 0, polar(markR, turningDialAngle(t) - 3 * hour), { t }));
  assert.ok(own7 > other7 * 1.5, `ablaze (${own7.toFixed(3)} vs an ordinary mark's ${other7.toFixed(3)})`);
  assert.ok(Math.abs(own6 - other6) < 0.05, `the Remnant's own mark as bright as its others (${own6.toFixed(3)} vs ${other6.toFixed(3)})`);
  assert.ok(FIRST_BLAZE > 1, 'brighter than the line');

  // THE FIRST LIGHT: a ray of dawn out to each hour's mark, between the wheel's teeth and the dial, turning on with it -
  // and none on the Remnant's
  const rayR = (TURNING_R + TURNING_TOOTH_M + TURNING_DIAL_R - TURNING_MARK_M * 2) / 2;
  for (const tt of [12.25, 37.5]) {
    const onRay = lum(at(7, 0, polar(rayR, firstDialAngle(tt) + 2 * hour), { t: tt })), between = lum(at(7, 0, polar(rayR, firstDialAngle(tt) + 2.5 * hour), { t: tt }));
    assert.ok(onRay > between + 0.15, `a ray along an hour's mark at ${tt} (${onRay.toFixed(3)} vs ${between.toFixed(3)} between)`);
    const r6on = lum(at(6, 0, polar(rayR, turningDialAngle(tt) + 2 * hour), { t: tt })), r6off = lum(at(6, 0, polar(rayR, turningDialAngle(tt) + 2.5 * hour), { t: tt }));
    assert.ok(Math.abs(r6on - r6off) < 0.05, `none on the Remnant's at ${tt}`);
  }
  assert.ok(FIRST_RAY > 0);
  assert.doesNotMatch(AURA_FS.slice(AURA_FS.indexOf('vec3 firstGround'), AURA_FS.indexOf('vec3 firstWall')), /turning BACK|it turns back/, 'its own words in its own code');

  // THE WALL: lit as The Turning Hour's is, in the dawn
  const wallF = at(7, 1, [0.37, 0.02]), wallT = at(6, 1, [0.37, 0.02]);
  assert.ok(lum(wallF) > 0 && lum(wallT) > 0);
  assert.deepEqual(TURNING_RGB.gold, HOUR_GOLD.slice(0, 3), 'the Remnant\'s still its own');
  assert.ok(TURNING_R + TURNING_TOOTH_M === L.ringR);
});
