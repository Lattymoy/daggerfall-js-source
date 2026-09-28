// SHADOW-FANG — THE WEREWOLF'S OWN SKIN (2026-09-26).
//
// Mac, for SirMcMobdon: "Wants a custom morrowind werewolf skin (skin base but blacker amd like crimson red thru out
// the edging in the fur, red eyes)". The werewolf is Bloodmoon's (WEREWOLF1, test/werewolf1.test.js), built from the
// player's own data, so the skin is a LAW over its textures' pixels (characters/werewolfSkin.js), painted on a copy on
// the way to the GPU - and worn by whoever holds the Shadow Fang glyph: a peer by the glyphs their signed token
// carries, the player by the account service's last word on this device.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { werewolfSkinOf, shadowFangPixels, skinMips, skinUseOf, skinUseKey, downsampleLevel, isEyeTexture, looksLikeEye, SHADOW_FANG, WEREWOLF_SKINS, SKIN_GLYPH } from '../src/characters/werewolfSkin.js';
import { ownGlyphs, ownWerewolfSkin } from '../src/systems/ownGlyphs.js';
import { adoptIdentity, storedSession, SESSION_KEY } from '../src/net/accountClient.js';
import { createFpArm, _skinPainted } from '../src/combat/fpArm.js';
import { werewolfBodyDeps, WOLF_HEAD_EYES } from './fixtures/mw/bodyRig.mjs';
import { PeerBodies, peerBuildOpts, peerBodyKey } from '../src/net/peerBodies.js';
import { armBuildOptsOf } from '../src/combat/weaponRig.js';
import { GLYPHS } from '../src/net/identityToken.js';
import { GLYPH_DETAIL, cssRgba } from '../src/ui/playerBadge.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 60) => { for (let i = 0; i < n; i++) await flush(); };
/** AUDIT F7: the law's fingerprint over the golden fur (the third law test). A deliberate change to the law moves it:
 *  print `fnv(shadowFangPixels(...))` there and write the new value here, with the reason in the commit. */
const GOLDEN_LAW = 'a8ede95a';

/** A texture of one colour with one texel changed, 7x7, row-major RGBA. */
function tex(fill, at = null, px = null, w = 7, h = 7) {
  const t = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) t.set(fill, i * 4);
  if (at) t.set(px, (at[1] * w + at[0]) * 4);
  return t;
}
const px = (t, x, y, w = 7) => Array.from(t.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const FUR = [110, 82, 52, 255];   // a mid-brown fur

test('SHADOW-FANG who wears it: the Shadow Fang glyph names the skin, and nothing else does (mutants: any glyph a skin)', () => {
  assert.deepEqual([...WEREWOLF_SKINS], ['shadowfang']);
  assert.ok(GLYPHS.includes(SKIN_GLYPH.shadowfang), 'the skin rides a glyph the token can carry');
  assert.equal(werewolfSkinOf(['sprout', 'shadowfang']), 'shadowfang');
  assert.equal(werewolfSkinOf(['apostle', 'dev']), null);
  assert.equal(werewolfSkinOf(null), null);
  assert.equal(werewolfSkinOf('shadowfang'), null, 'a string is not a list of glyphs');
});

/** A deterministic fur, 64 square: a base, a lighter overcoat in vertical strands, the mix from a small LCG - the
 *  colours are what the audit measured the old law on (AUDIT F2/F3). */
function fur(base, tip, { w = 64, h = 64, seed = 7 } = {}) {
  let st = seed >>> 0;
  const rnd = () => ((st = (Math.imul(st, 1664525) + 1013904223) >>> 0) / 4294967296);
  const col = Array.from({ length: w }, () => rnd());
  const t = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = Math.min(1, Math.max(0, col[x] * 0.8 + rnd() * 0.3 - 0.1));
      for (let c = 0; c < 3; c++) t[(y * w + x) * 4 + c] = Math.round(base[c] * (1 - m) + tip[c] * m);
      t[(y * w + x) * 4 + 3] = 255;
    }
  }
  return t;
}
const FURS = { brown: [[72, 52, 34], [150, 112, 72]], golden: [[130, 92, 38], [235, 185, 80]], wheat: [[160, 130, 80], [240, 200, 110]],
  amber: [[150, 90, 20], [255, 191, 0]], auburn: [[110, 40, 25], [200, 60, 40]], blond: [[160, 135, 90], [240, 222, 170]], cream: [[170, 160, 140], [245, 240, 228]] };
const disc = (t, w, [cx, cy], r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) t.set(c, ((cy + y) * w + cx + x) * 4); };
const lumOf = (t) => { let s = 0, n = 0; for (let i = 0; i < t.length; i += 4) if (t[i + 3]) { s += (0.299 * t[i] + 0.587 * t[i + 1] + 0.114 * t[i + 2]) / 255; n++; } return s / n; };
const crimsonShare = (t) => { let c = 0, n = 0; for (let i = 0; i < t.length; i += 4) { if (!t[i + 3]) continue; n++; if (t[i] > 60 && t[i] > 2.5 * t[i + 1] && t[i] > 2 * t[i + 2]) c++; } return c / n; };
/** A texel in the eye's own red (#ff222e by its light) - not the edging's crimson (#c41230 lit), whose green and blue
 *  stand in another ratio to its red. */
const burning = (t, i) => { const r = t[i * 4], g = t[i * 4 + 1], b = t[i * 4 + 2]; return r > 150 && Math.abs(g / r - 34 / 255) < 0.02 && Math.abs(b / r - 46 / 255) < 0.025; };
/** FNV-1a over bytes - a golden pin's fingerprint. */
const fnv = (b) => { let h = 0x811c9dc5; for (const v of b) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

test('SHADOW-FANG the law: the base is its own colour blacker; a strand lighter than the fur around it and the lit tips - the lightest of THIS texture\'s own - are crimson, and on an alpha-tested card the fringe beside a cut; a transparent texel and every alpha are kept, and the input is never written (mutants: the base left light; the edging dropped; the cache painted)', () => {
  const src = tex(FUR);
  const before = src.slice();
  const out = shadowFangPixels(src, 7, 7);
  assert.deepEqual(src, before, 'the shared texture is not written');
  // THE BASE: blacker, still its own colour
  const [r, g, b, a] = px(out, 3, 3);
  assert.equal(a, 255);
  assert.ok(r < FUR[0] * 0.45 && g < FUR[1] * 0.45 && b < FUR[2] * 0.45, `blacker (${r},${g},${b})`);
  assert.ok(r > b, 'still the skin\'s warm base, not a flat grey');
  assert.ok(r < 2 * g + 8, 'and not crimson');
  // THE EDGING: a strand
  const strand = px(shadowFangPixels(tex(FUR, [3, 3], [168, 128, 84, 255]), 7, 7), 3, 3);
  assert.ok(strand[0] > 2.5 * strand[1] && strand[0] > 2.5 * strand[2] && strand[0] > 80, `a lighter strand goes crimson (${strand})`);
  // AUDIT F3: a FLAT light texture has no tips - a cream wolf is a black one, not a red one
  const flat = px(shadowFangPixels(tex([230, 222, 210, 255]), 7, 7), 3, 3);
  assert.ok(flat[0] < 80 && flat[0] < 2 * flat[1] + 8, `a flat cream is its base, blacker (${flat})`);
  // THE FRINGE, on a cut card alone (AUDIT F6)
  const card = tex(FUR, [3, 3], [0, 0, 0, 0]);
  const fringed = shadowFangPixels(card, 7, 7, { cut: true });
  assert.ok(px(fringed, 2, 3)[0] > 2.5 * px(fringed, 2, 3)[1], `a texel beside an alpha cut is crimson (${px(fringed, 2, 3)})`);
  assert.ok(px(fringed, 2, 2)[0] > 2.5 * px(fringed, 2, 2)[1], 'a diagonal neighbour is beside it too');
  assert.deepEqual(px(fringed, 3, 3), [0, 0, 0, 0], 'the cut itself is left alone');
  assert.ok(px(fringed, 0, 0)[0] < 50, 'and the fur away from it stays black');
  assert.deepEqual(shadowFangPixels(card, 7, 7, { cut: false }).slice(0, 4 * 7 * 3), shadowFangPixels(tex(FUR), 7, 7).slice(0, 4 * 7 * 3), 'an opaque texture\'s hole (a UV island\'s padding) edges nothing');
  const halfA = tex(FUR, [3, 3], [FUR[0], FUR[1], FUR[2], 60]);
  assert.deepEqual(px(shadowFangPixels(halfA, 7, 7, { cut: true }), 3, 3).slice(0, 3), px(out, 3, 3).slice(0, 3), 'no texel is its own fringe');
  assert.equal(px(shadowFangPixels(halfA, 7, 7, { cut: true }), 3, 3)[3], 60, 'and its alpha kept');
  // WRAP as the texture does: a cut at x = 6 is beside x = 0
  const edgeCut = tex(FUR, [6, 3], [0, 0, 0, 0]);
  assert.ok(px(shadowFangPixels(edgeCut, 7, 7, { cut: true, wrapS: true }), 0, 3)[0] > 80, 'wrapping, x = 0 is beside the cut at the far edge');
  assert.ok(px(shadowFangPixels(edgeCut, 7, 7, { cut: true, wrapS: false }), 0, 3)[0] < 50, 'clamped, it is not');
  // THE NEIGHBOURHOOD IS THE OPAQUE FUR'S: a white texel with no alpha two away lends it no light
  const hole = tex(FUR, [5, 3], [255, 255, 255, 0]);
  assert.deepEqual(px(shadowFangPixels(hole, 7, 7, { cut: false }), 3, 3), px(out, 3, 3), 'a transparent white is no fur round a texel');
  assert.equal(cssRgba(SHADOW_FANG.eye.map((v) => v / 255)), cssRgba(GLYPH_DETAIL.shadowfang.rgba), 'the eye is the glyph\'s own red');
});

test('SHADOW-FANG (AUDIT F2) the eyes are WHERE THE EYES ARE: every texel of a texture - or a shape - that names an eye, its pupil kept dark; on the HEAD\'s own texture a small, compact blob glowing well above the fur round it, amber or red; never a colour alone and never the body\'s fur - golden, wheat, amber and auburn wolves burn nowhere (mutants: the blob test dropped; the head test dropped; the red branch dropped)', () => {
  // an eye texture: red whole, the pupil dark
  const eyeTex = tex([200, 180, 40, 255], [3, 3], [10, 10, 10, 255]);
  const eyes = shadowFangPixels(eyeTex, 7, 7, { eyes: 'all' });
  assert.ok(px(eyes, 0, 0)[0] > 230 && px(eyes, 0, 0)[1] < 40, `the iris burns (${px(eyes, 0, 0)})`);
  assert.ok(px(eyes, 3, 3)[0] < 90, `the pupil stays a pupil (${px(eyes, 3, 3)})`);
  assert.ok(isEyeTexture('tx_werewolf_eyes.dds') && isEyeTexture('Eye_Yellow.TGA') && !isEyeTexture('tx_werewolf.dds'));
  // on a head's texture: amber eyes and red ones on a dark wolf burn; its fur does not
  for (const col of [[255, 190, 20, 255], [240, 20, 20, 255]]) {
    const head = fur(...FURS.brown);
    disc(head, 64, [20, 22], 2, col); disc(head, 64, [44, 22], 2, col);   // 13 texels each: an eye's size on a 64-square head
    const o = shadowFangPixels(head, 64, 64, { eyes: 'colour' });
    assert.ok(burning(o, 22 * 64 + 20) && burning(o, 22 * 64 + 44), `${col} eyes burn`);
    let lit = 0; for (let i = 0; i < 64 * 64; i++) if (burning(o, i)) lit++;
    assert.equal(lit, 2 * 13, `and nothing else (${lit} texels)`);
    const big = fur(...FURS.brown);
    disc(big, 64, [32, 32], 8, col);
    const bo = shadowFangPixels(big, 64, 64, { eyes: 'colour' });
    assert.ok(!burning(bo, 32 * 64 + 32), 'a patch of that colour past an eye\'s share of the texture is fur, not an eye');
    const strand = fur(...FURS.brown);
    for (let y = 20; y < 30; y++) strand.set(col, (y * 64 + 10) * 4);
    assert.ok(!burning(shadowFangPixels(strand, 64, 64, { eyes: 'colour' }), 25 * 64 + 10), 'a strand of it, ten long and one wide, is no eye');
    const crowd = fur(...FURS.brown);
    disc(crowd, 64, [32, 32], 2, col);
    // specks of its colour a texel clear of it and of each other - each too small to be an eye, all of them round it
    for (let k = 28; k <= 36; k += 2) for (const [x, y] of [[k, 28], [k, 36], [28, k], [36, k]]) crowd.set(col, (y * 64 + x) * 4);
    assert.ok(!burning(shadowFangPixels(crowd, 64, 64, { eyes: 'colour' }), 32 * 64 + 32), 'nor a blob crowded by its kind - a highlight among highlights');
    const body = shadowFangPixels(head, 64, 64, { eyes: 'none' });
    assert.ok(!burning(body, 22 * 64 + 20), 'the same colours on the body\'s texture are no eyes');
  }
  // the furs the colour alone took for eyes, on the head's own texture where the eye rule runs
  for (const [name, [b, t]] of Object.entries(FURS)) {
    for (const seed of [3, 7, 11]) {
      const f = fur(b, t, { seed });
      const o = shadowFangPixels(f, 64, 64, { eyes: 'colour' });
      let lit = 0; for (let i = 0; i < 64 * 64; i++) if (burning(o, i)) lit++;
      assert.equal(lit, 0, `${name} fur (seed ${seed}) burns nowhere`);
    }
  }
  assert.equal(looksLikeEye(...FUR.slice(0, 3)), false, 'fur is no eye\'s colour');
  assert.equal(looksLikeEye(240, 200, 110), false, 'nor a wheat highlight');
  assert.equal(looksLikeEye(150, 22, 0), false, 'nor a deep red-brown shadow');
  assert.equal(looksLikeEye(255, 190, 20), true, 'an amber glow is');
  assert.equal(looksLikeEye(240, 20, 20), true, 'and a hot red');
  // which rule a texture takes, by the piece that wears it
  assert.equal(skinUseOf({ slot: 'head', material: { alphaTest: false, clampMode: 3 } }, 'tx_wolf_head.dds').eyes, 'colour');
  assert.equal(skinUseOf({ slot: 'head (werewolfrobe)', material: null }, 'x.dds').eyes, 'colour', 'a robe\'s head too');
  assert.equal(skinUseOf({ slot: 'cuirass (werewolfrobe)', material: null }, 'tx_wolf.dds').eyes, 'none', 'the body\'s fur: never');
  assert.equal(skinUseOf({ slot: 'head', shape: 'Tri Eyes', material: null }, 'tx_wolf.dds').eyes, 'all', 'a shape that names an eye');
  assert.deepEqual(skinUseOf({ slot: 'hair', material: { alphaTest: true, clampMode: 1 } }, 'h.dds'), { file: 'h.dds', eyes: 'none', cut: true, clamp: 1 });
  assert.notEqual(skinUseKey('shadowfang', { eyes: 'colour' }), skinUseKey('shadowfang', { eyes: 'none' }), 'a texture worn two ways is kept two ways');
});

test('SHADOW-FANG (AUDIT F3/F7) light and dark wolves alike: a blond or a cream wolf is BLACKENED, not reddened (its tips the lightest of its own), a brown one keeps a crimson edging in its strands, and the law is pinned whole on one fur (mutants: any constant moved)', () => {
  for (const name of ['blond', 'cream', 'golden', 'brown']) {
    const f = fur(...FURS[name]);
    const o = shadowFangPixels(f, 64, 64);
    assert.ok(lumOf(o) < 0.3, `${name}: dark (${lumOf(o).toFixed(2)})`);
    const share = crimsonShare(o);
    assert.ok(share > 0.05 && share < 0.3, `${name}: crimson in the edging, not the whole coat (${(share * 100).toFixed(0)}%)`);
  }
  // THE GOLDEN PIN: one fur, every rule and constant - an eye, strands, tips, a cut row - a change to any is a change to this
  const f = fur(...FURS.brown, { seed: 5 });
  disc(f, 64, [20, 12], 2, [255, 190, 20, 255]);
  for (let i = 0; i < 64; i++) f[(63 * 64 + i) * 4 + 3] = i % 3 ? 255 : 0;
  const golden = shadowFangPixels(f, 64, 64, { eyes: 'colour', cut: true });
  assert.ok(burning(golden, 12 * 64 + 20), 'the golden fur has its eye');
  assert.equal(fnv(golden), GOLDEN_LAW, 'the law, whole');
});

test('SHADOW-FANG (AUDIT F4) the mips: the law on the FIRST level, and every later one that level box-filtered down (colour weighted by alpha), each keeping its own alpha - never the law run apart per level (the edging faded with distance, a cut\'s fringe grew); each level its own copy; no skin, another, or texels short of their size is the mips as they are (mutants: the law per level; the level\'s alpha replaced; the cache\'s array handed back painted)', () => {
  const f0 = fur(...FURS.brown, { w: 8, h: 8 });
  const mips = [{ width: 8, height: 8, rgba: f0 }, { width: 4, height: 4, rgba: downsampleLevel(f0, 8, 8, 4, 4) }, { width: 2, height: 2, rgba: downsampleLevel(downsampleLevel(f0, 8, 8, 4, 4), 4, 4, 2, 2) }];
  mips[1].rgba[3] = 17;   // a level's own alpha, not the one its parent's mean would give
  const keep = mips.map((m) => m.rgba.slice());
  const sk = skinMips(mips, 'shadowfang', 'tx_werewolf.dds');
  assert.equal(sk.length, 3);
  assert.notEqual(sk, mips); sk.forEach((m, i) => assert.notEqual(m.rgba, mips[i].rgba));
  assert.deepEqual(sk[0].rgba, shadowFangPixels(f0, 8, 8, { eyes: 'none', cut: true }), 'the first level, in the law');
  const down = downsampleLevel(sk[0].rgba, 8, 8, 4, 4);
  for (let i = 0; i < 16; i++) for (let c = 0; c < 3; c++) assert.equal(sk[1].rgba[i * 4 + c], down[i * 4 + c], 'the next, it filtered down');
  assert.equal(sk[1].rgba[3], 17, 'with its own alpha');
  assert.notDeepEqual(sk[1].rgba, shadowFangPixels(mips[1].rgba, 4, 4), 'not the law run again on the smaller level');
  mips.forEach((m, i) => assert.deepEqual(m.rgba, keep[i], 'the decoded texture is untouched'));
  assert.equal(skinMips(mips, null), mips);
  assert.equal(skinMips(mips, 'emperor'), mips);
  const short = [{ width: 8, height: 8, rgba: new Uint8Array(12) }];
  assert.equal(skinMips(short, 'shadowfang'), short, 'a level short of its size is the mips as they are - never zero-filled (AUDIT F13)');
  const eyed = skinMips(mips, 'shadowfang', 'tx_wolf_eye.dds')[0].rgba;
  assert.ok(eyed[0] > 3 * eyed[1] && eyed[0] > 100, `an eye file, by its name - red, by its own light (${eyed.slice(0, 4)})`);
  // a box filter weights colour by alpha: a cut texel's own colour lends the fur nothing
  const two = new Uint8Array([200, 0, 0, 255, 0, 200, 0, 0]);
  assert.deepEqual(Array.from(downsampleLevel(two, 2, 1, 1, 1)), [200, 0, 0, 128]);
});

const uploadingRig = () => {
  const uploads = [];
  const renderer = {
    gl: null, createCharacterMesh: () => ({ vao: {}, buffers: [] }), updateCharacterMesh: () => {},
    renderCharacterSprite: () => ({ tex: {} }), drawScreenOverlayQuad: () => {}, drawCharacterSpriteQuad: () => {},
    createParticleEffect: () => ({}), createCharacterTexture: (mips) => { uploads.push(mips); return { mips }; },
  };
  const arm = createFpArm();
  arm.attach(renderer, () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0, move: { forward: 0, strafe: 0, running: false, speed: 0, grounded: true } }));
  return { arm, uploads };
};
/** Both views' meshes hung: the first person on update, the third on its first posed update in third person. */
async function hangBoth(arm) {
  arm.update(1 / 60);
  if (arm.canThirdPerson()) { arm.setViewMode('third'); arm.update(1 / 60, { pose: true }); arm.setViewMode('first'); }
}

test('SHADOW-FANG on the rig: the wolf built with a skin hangs skinned copies on BOTH its bodies - the first person\'s arms and the third person\'s whole wolf, the head\'s eyes burning - painted in the build and shared module-wide (a second rig paints nothing); the shared decoded texture untouched; the person and a skinless wolf hang the cache\'s own (mutants: the skin on the person; the third person unskinned; the cache painted in place; the memo keyed without its image)', async () => {
  const run = async (opts) => {
    const { arm, uploads } = uploadingRig();
    const res = await arm.build({ race: 'fprace', deps: werewolfBodyDeps({ generation: 'sf-rig' }).deps, ...opts });
    assert.equal(res.ok, true, `${res.stage}: ${res.error}`);
    const keep = new Map([...res.textures, ...(res.third?.textures ?? [])].map(([k, e]) => [k, e.image.mips[0].rgba.slice()]));
    // AUDIT D2: painted IN THE BUILD - before any frame hangs a mesh
    const painted = [[res.arm, res.textures], [res.third?.arm, res.third?.textures]].every(([a, tx]) => (a?.pieces ?? []).every((q) => {
      const file = q.material?.textureFile;
      return !file || !tx?.get(file) || _skinPainted(tx.get(file).image, 'shadowfang', skinUseOf(q, file));
    }));
    await hangBoth(arm);
    return { arm, res, uploads, keep, painted };
  };
  const wolf = await run({ werewolf: true, skin: 'shadowfang' });
  assert.equal(wolf.painted, true, 'every range\'s skin painted by the build, none left to the frame (AUDIT D2)');
  const entries = new Map([...wolf.res.textures, ...wolf.res.third.textures]);
  assert.equal(entries.size, 3, 'the body\'s texture, the head\'s own and the first-person hand\'s own');
  assert.ok(wolf.uploads.length >= 4, `both views hung (${wolf.uploads.length})`);
  const own = new Set([...entries.values()].map((e) => e.image.mips));
  assert.ok(wolf.uploads.every((m) => !own.has(m)), 'a copy on every range of the wolf');
  const head = wolf.uploads.find((m) => m[0].width === 64);
  assert.ok(head, 'the third person hung the head\'s texture');
  for (const [x, y] of WOLF_HEAD_EYES) assert.ok(head[0].rgba[(y * 64 + x) * 4] === 255 && head[0].rgba[(y * 64 + x) * 4 + 1] < 45, `the head\'s eye at ${x},${y} burns`);
  const body = entries.get('tx_fixture.tga').image.mips;
  assert.ok(wolf.uploads.some((m) => m[0].width === body[0].width && m !== body), 'the body\'s fur, in the skin');
  for (const [k, e] of entries) assert.deepEqual(e.image.mips[0].rgba, wolf.keep.get(k), `${k}: the cache\'s texture - every rig\'s - untouched`);
  // module-wide: a second wolf in the same skin, on the same data, hangs the very same copies
  const again = await run({ werewolf: true, skin: 'shadowfang' });
  assert.ok(again.uploads.length && again.uploads.every((m) => wolf.uploads.includes(m)), 'painted once, for every rig');
  const man = await run({ skin: 'shadowfang' });
  const manOwn = new Set([...man.res.textures.values()].map((e) => e.image.mips));
  assert.ok(man.uploads.every((m) => manOwn.has(m) || [...(man.res.third?.textures?.values() ?? [])].some((e) => e.image.mips === m)), 'the person wears the textures as they are, whatever skin the opts carry');
  const plain = await run({ werewolf: true });
  const plainOwn = new Set([...plain.res.textures.values(), ...plain.res.third.textures.values()].map((e) => e.image.mips));
  assert.ok(plain.uploads.every((m) => plainOwn.has(m)), 'a wolf with no skin is Bloodmoon\'s own');
  const f = rd('src/combat/fpArm.js');
  assert.match(f, /hangRangeTextures\(mesh\.ranges, collectArmTextures\(pieces, archives, gen\)\);/, 'an item\'s icon wears no skin');
});

test('SHADOW-FANG (AUDIT F1) the skin rides the FORM: setWerewolf(true, { skin }) builds the wolf in it, a skin taken off under a standing wolf rebuilds it plain, and a form queued mid-build keeps its skin (mutants: the skin dropped at the door; the skin change ignored; the queue losing it)', async () => {
  const { arm, uploads } = uploadingRig();
  const fx = werewolfBodyDeps();
  assert.equal((await arm.build({ race: 'fprace', deps: fx.deps })).ok, true);
  const res = await arm.setWerewolf(true, { skin: 'shadowfang' });
  assert.equal(res.ok, true);
  uploads.length = 0; await hangBoth(arm);
  const cached = new Set([...res.textures.values(), ...res.third.textures.values()].map((e) => e.image.mips));
  assert.ok(uploads.length && uploads.every((m) => !cached.has(m)), 'in its skin');
  assert.equal(arm.setWerewolf(true, { skin: 'shadowfang' }), false, 'the fast path');
  const plain = await arm.setWerewolf(true, { skin: null });
  assert.equal(plain.ok, true, 'the skin taken off: a rebuild');
  uploads.length = 0; await hangBoth(arm);
  const plainOwn = new Set([...plain.textures.values(), ...plain.third.textures.values()].map((e) => e.image.mips));
  assert.ok(uploads.every((m) => plainOwn.has(m)), 'plain');
  // queued mid-build
  const busy = arm.build({ race: 'fprace', deps: fx.deps });
  assert.equal(arm.setWerewolf(true, { skin: 'shadowfang' }), false);
  await busy; await settle();
  assert.equal(arm.builtFor()?.werewolf, true);
  uploads.length = 0; await hangBoth(arm);
  assert.ok(uploads.length && uploads.every((m) => !plainOwn.has(m)), 'the queued form kept its skin');
});

test('SHADOW-FANG whose skin: my own is the account service\'s last word on this device, kept on the stored session (a token\'s glyphs, a wardrobe\'s) and read offline - only into the session that asked (AUDIT B4); a peer\'s is the glyphs the relay read off their token, handed to their build, and the skin is part of which body they are (mutants: the glyphs not kept; a list rewritten unchanged; a late answer adopted into another account; the peer\'s skin left off the key or the build)', async () => {
  const store = new Map();
  let writes = 0;
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { writes++; store.set(k, v); }, removeItem: (k) => store.delete(k) };
  storage.setItem(SESSION_KEY, JSON.stringify({ id: 'acct-sf', name: 'SirMcMobdon', kind: 'linked', sessionId: 's', secret: 'x' }));
  assert.deepEqual(ownGlyphs(storage), [], 'none stated yet');
  assert.equal(ownWerewolfSkin(storage), null);
  writes = 0;
  assert.equal(adoptIdentity(storage, { name: 'SirMcMobdon', kind: 'linked', glyphs: ['shadowfang', 42, 'x'.repeat(25)], secret: 'x' }), true);
  assert.equal(writes, 1);
  assert.deepEqual(storedSession(storage).glyphs, ['shadowfang'], 'strings only, bounded');
  assert.equal(storedSession(storage).secret, 'x', 'the credential untouched');
  assert.equal(ownWerewolfSkin(storage), 'shadowfang', 'and read back - offline');
  assert.equal(adoptIdentity(storage, { name: 'SirMcMobdon', kind: 'linked', glyphs: ['shadowfang'], secret: 'x' }), false, 'nothing new, nothing written');
  assert.equal(writes, 1);
  // AUDIT B4: an answer asked with another session's secret lands nowhere
  assert.equal(adoptIdentity(storage, { name: 'Tabby', kind: 'linked', glyphs: [], secret: 'someone-else' }), false);
  assert.equal(storedSession(storage).name, 'SirMcMobdon');
  assert.equal(ownWerewolfSkin(storage), 'shadowfang');
  adoptIdentity(storage, { glyphs: [], secret: 'x' });
  assert.equal(ownWerewolfSkin(storage), null, 'a grant taken off is gone here too');
  assert.match(rd('src/ui/accountFlow.js'), /adoptIdentity\(storage, \{ name: r\.data\.account\?\.name, kind: r\.data\.account\?\.kind, glyphs: r\.data\.wardrobe\?\.glyphs, secret: asked \}\);/, 'the wardrobe states them, for the session that asked');
  assert.match(rd('src/net/accountClient.js'), /adoptIdentity\(storage, \{ \.\.\.who, secret: session\.secret \}\);/, 'and every mint');
  // my own werewolf, at the door - the value, off this device's stored session
  const me = { race: 'Breton', gender: 'male', faceIndex: 0, items: [], activeEffects: [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: 1 }] };
  const was = globalThis.localStorage;
  globalThis.localStorage = storage;
  try {
    adoptIdentity(storage, { glyphs: ['shadowfang'], secret: 'x' });
    assert.equal(armBuildOptsOf(me).skin, 'shadowfang', 'the wolf built at the door wears it');
    assert.equal(armBuildOptsOf({ ...me, activeEffects: [] }).skin, null, 'a person wears none');
  } finally { if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was; }
  // a peer's
  const LOOK = { race: 'Breton', gender: 'male', faceIndex: 0, items: [] };
  assert.equal(peerBuildOpts(LOOK, { wb: 1 }, ['shadowfang']).skin, 'shadowfang');
  assert.equal('skin' in peerBuildOpts(LOOK, { wb: 1 }, ['dev']), false, 'a wolf with no skin carries no key');
  assert.equal('skin' in peerBuildOpts(LOOK, { wb: 0 }, ['shadowfang']), false, 'the person wears none');
  assert.notEqual(peerBodyKey(LOOK, { wb: 1 }, ['shadowfang']), peerBodyKey(LOOK, { wb: 1 }, []), 'the skin is part of which body');
  assert.equal(peerBodyKey(LOOK, { wb: 0 }, ['shadowfang']), peerBodyKey(LOOK, { wb: 0 }, []), 'and nothing of the person\'s');
  // ...and handed to the build the body layer queues
  const built = [];
  const createRig = () => ({ attach() {}, async build(o) { built.push(o); return { ok: true }; }, canThirdPerson: () => true, setViewMode: () => true, update() {},
    thirdActive: () => true, drawThird: () => true, unload() {}, raceHeightScale: () => 1, setSheathed() {}, setWeapon() { return true; }, readySpell() {}, setHipLight() {}, release() {}, upperBodyReady: () => true });
  const pb = new PeerBodies({ renderer: {}, createRig, now: () => 1000 });
  pb.sync([{ id: 'sf', look: LOOK, shown: { x: 0, y: 0, z: 0, yaw: 0, wb: 1 }, glyphs: ['shadowfang'] }], (q) => [q.x, q.y, q.z], 0.016, [0, 0, 0]);
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(built.at(-1)?.skin, 'shadowfang', 'the peer\'s wolf, in the skin their token names');
});
