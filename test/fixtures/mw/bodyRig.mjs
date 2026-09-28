// PEER-CADENCE (2026-09-22): THE FIXTURE BODY RIG, shared. The arm
// fixtures under this directory (armfp.nif, armfpidle.kf, the hand and
// upperarm meshes, armfp.esm) stand a whole `createFpArm()` rig with a
// third-person body when the ESM is given the two BODY records and the
// retail x-model names - fparm.test.js's fpFixtureBuildWithBody. The
// peer-bodies probe and the cadence pins drive the SAME rig, so the
// build lives here once, with the renderer that counts what it costs.
import { readFileSync } from 'node:fs';
import { fpSkeletonPath, FP_CLIP_PATH } from '../../../src/combat/fpArm.js';

export const fixtureFile = (n) => new Uint8Array(readFileSync(new URL(`./${n}`, import.meta.url)));

/** a BODY record, as fparm.test.js mints them (hand=5, upperarm=8 in MW_BODY_PARTS order) */
export function bodyRec(id, model, race, part, { female = false } = {}) {
  const sub = (name, data) => { const b = new Uint8Array(8 + data.length); b.set([...name].map((c) => c.charCodeAt(0)), 0); new DataView(b.buffer).setUint32(4, data.length, true); b.set(data, 8); return b; };
  const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));
  const bydt = new Uint8Array(4); bydt[0] = part; bydt[2] = female ? 1 : 0; bydt[3] = 0;   // BPF_Female=1; MT_Skin=0
  const subs = [sub('NAME', z(id)), sub('MODL', z(model)), sub('FNAM', z(race)), sub('BYDT', bydt)];
  const size = subs.reduce((a, s) => a + s.length, 0);
  const rec = new Uint8Array(16 + size);
  rec.set([...'BODY'].map((c) => c.charCodeAt(0)), 0);
  new DataView(rec.buffer).setUint32(4, size, true);
  let o = 16; for (const s of subs) { rec.set(s, o); o += s.length; }
  return rec;
}

/** The build deps for a rig with a third-person body: the FP fixture plus the retail x-model names and the two BODY records. */
export function fixtureBodyDeps() {
  const f = fixtureFile;
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
  ]);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  return {
    loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}

/** a renderer that counts what a body costs it: meshes minted, mesh uploads, sprite renders, sprite quads */
export function countingRenderer() {
  const c = { meshes: 0, uploads: 0, sprites: 0, quads: 0 };
  return { c, gl: null,
    createCharacterMesh: () => { c.meshes++; return { vao: {}, buffers: [] }; },
    updateCharacterMesh: () => { c.uploads++; },
    createCharacterTexture: (mips) => ({ mips }),
    renderCharacterSprite: () => { c.sprites++; return { tex: {} }; },
    drawCharacterSpriteQuad: () => { c.quads++; },
    drawScreenOverlayQuad: () => {},
    createParticleEffect: () => ({}),
  };
}

/** A NIF (4.0.0.2) of NiNodes and NiStringExtraData, written the way mwNifFile.js reads it. */
function nifBytes(records, roots) {
  const out = [];
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); out.push(...b); };
  const i32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, true); out.push(...b); };
  const f32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, n, true); out.push(...b); };
  const u16 = (n) => { out.push(n & 255, (n >> 8) & 255); };
  const str = (s) => { u32(s.length); for (const c of s) out.push(c.charCodeAt(0)); };
  for (const c of 'NetImmerse File Format, Version 4.0.0.2\n') out.push(c.charCodeAt(0));
  u32(0x04000002); u32(records.length);
  for (const r of records) {
    str(r.type);
    if (r.type === 'NiNode') {
      str(r.name); i32(r.extra ?? -1); i32(-1); u16(0);
      for (const v of r.translation ?? [0, 0, 0]) f32(v);
      for (const v of [1, 0, 0, 0, 1, 0, 0, 0, 1]) f32(v);
      f32(1); f32(0); f32(0); f32(0);
      u32(0); u32(0);   // no properties, no bounding volume
      u32(r.children?.length ?? 0); for (const c of r.children ?? []) i32(c);
      u32(0);   // no effects
    } else if (r.type === 'NiStringExtraData') {
      i32(-1); u32(r.string.length + 4); str(r.string);
    }
  }
  u32(roots.length); for (const r of roots) i32(r);
  return Uint8Array.from(out);
}
/** The WS1 addon that joins a pelvis to the fixture's Bip01: a BONE-marked node under a node named Bip01. */
const PELVIS_ADDON = nifBytes([
  { type: 'NiNode', name: 'pelvisaddon', children: [1] },
  { type: 'NiNode', name: 'Bip01', children: [2] },
  { type: 'NiNode', name: 'Bip01 Pelvis', extra: 3, translation: [0, 0, 10] },
  { type: 'NiStringExtraData', string: 'BONE' },
], [0]);

const enc = (s) => Array.from(s, (c) => c.charCodeAt(0));
const u32b = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const sub = (name, payload) => [...enc(name), ...u32b(payload.length), ...payload];
const rec = (type, subs) => { const body = subs.flat(); return [...enc(type), ...u32b(body.length), 0, 0, 0, 0, 0, 0, 0, 0, ...body]; };
const z = (s) => [...enc(s), 0];
const lhdt = (flags) => { const b = new Uint8Array(24); new DataView(b.buffer).setInt32(20, flags, true); return Array.from(b); };
const LANTERN_LIGH = rec('LIGH', [sub('NAME', z('lantern_01')), sub('MODL', [...enc('l'), 0x5c, ...z('lantern_01.nif')]), sub('FNAM', z('Lantern')), sub('LHDT', lhdt(1 | 2))]);

/** HT-WAIST (moved here by HT-WAIST-NET, so the local body's pins and the peers' build ONE rig): the fixture body
 *  rig above, with a pelvis joined through the WS1 bone-addon door (the fixture skeleton is an arm and has none) and
 *  a carriable LIGH lantern with its mesh. `counters.opened` counts the archive opens (the slow path's one fetch). */
export function hipLanternBodyDeps({ lanternRecord = true, pelvis = true } = {}) {
  const f = fixtureFile;
  const files = new Map([
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')], ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
    ['meshes/l/lantern_01.nif', f('weapon.nif')],
  ]);
  if (pelvis) files.set('animations/xbase_anim/pelvisaddon.nif', PELVIS_ADDON);
  const esm = f('armfp.esm');
  const extra = [bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8)];
  if (lanternRecord) extra.push(Uint8Array.from(LANTERN_LIGH));
  const all = new Uint8Array(esm.length + extra.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of extra) { all.set(r, o); o += r.length; }
  const counters = { opened: 0 };
  return {
    counters,
    loadMorrowindArchives: async () => { counters.opened++; return [{ has: (p) => files.has(p), get: (p) => files.get(p), list: () => [...files.keys()] }]; },
    storedMorrowindNames: async () => ['armfp.esm'],
    loadMorrowindFile: async () => all,
  };
}

/** A CLOT record, as loadclot writes one: NAME, MODL, FNAM, CTDT (u32 type, f32 weight, u16 value, u16 enchant), then
 *  each part reference as INDX (one byte) + BNAM (and CNAM when given). */
export function clotRec(id, model, type, refs) {
  const enc = (s) => Array.from(s, (c) => c.charCodeAt(0));
  const u32 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const sub = (name, payload) => [...enc(name), ...u32(payload.length), ...payload];
  const z = (s) => [...enc(s), 0];
  const subs = [sub('NAME', z(id)), ...(model ? [sub('MODL', z(model))] : []), sub('FNAM', z('Werewolf Robe')), sub('CTDT', [...u32(type), 0, 0, 0, 0, 0, 0, 0, 0])];   // AUDIT C2: `model` null writes no MODL
  for (const [indx, male, female] of refs) {
    subs.push(sub('INDX', [indx]));
    if (male) subs.push(sub('BNAM', z(male)));
    if (female) subs.push(sub('CNAM', z(female)));
  }
  const body = subs.flat();
  return Uint8Array.from([...enc('CLOT'), ...u32(body.length), 0, 0, 0, 0, 0, 0, 0, 0, ...body]);
}

/** AUDIT C6 (2026-09-26): THE WOLF'S THIRD-PERSON SKELETON - armfp.nif's own nodes, where they are, and a Chest and a
 *  Head beside them, so the robe's chest and WerewolfHead and WerewolfHair have bones to BIND to (armfp.nif is an arm:
 *  the head, the hair and the chest were notes, never pieces, and no pin saw them drawn). The idle .kf drives the arms
 *  it always drove. */
const WOLF_TP_SKELETON = nifBytes([
  { type: 'NiNode', name: 'Bip01', children: [1, 11] },
  { type: 'NiNode', name: 'Bip01 Neck', translation: [0, 0, 3], children: [2, 3, 7, 12] },
  { type: 'NiNode', name: 'Camera', translation: [0, 0.1, 0.45] },
  { type: 'NiNode', name: 'Right Upper Arm', translation: [0.4, 0.45, 0.2], children: [4] },
  { type: 'NiNode', name: 'Right Forearm', translation: [-0.14, 0.75, -0.05], children: [5] },
  { type: 'NiNode', name: 'Right Hand', translation: [-0.05, 0.45, 0], children: [6] },
  { type: 'NiNode', name: 'Weapon Bone', translation: [0, 0.18, 0] },
  { type: 'NiNode', name: 'Left Upper Arm', translation: [-0.4, 0.45, 0.2], children: [8] },
  { type: 'NiNode', name: 'Left Forearm', translation: [0.14, 0.75, -0.05], children: [9] },
  { type: 'NiNode', name: 'Left Hand', translation: [0.05, 0.45, 0], children: [10] },
  { type: 'NiNode', name: 'Weapon Bone Left', translation: [0, 0.18, 0] },
  { type: 'NiNode', name: 'Chest', translation: [0, 0, 1.5] },
  { type: 'NiNode', name: 'Head', translation: [0, 0.05, 0.4] },
], [0]);

/** A 32-bit top-origin TGA (image type 2) of `w` x `h` RGBA texels, as decodeTga reads one. */
export function tgaBytes(w, h, rgba) {
  const out = new Uint8Array(18 + w * h * 4);
  out[2] = 2; out[12] = w & 255; out[13] = w >> 8; out[14] = h & 255; out[15] = h >> 8; out[16] = 32; out[17] = 0x28;   // 8 alpha bits, top origin
  for (let i = 0; i < w * h; i++) { const o = 18 + i * 4; out[o] = rgba[i * 4 + 2]; out[o + 1] = rgba[i * 4 + 1]; out[o + 2] = rgba[i * 4]; out[o + 3] = rgba[i * 4 + 3]; }
  return out;
}

/** SHADOW-FANG (AUDIT F1/F2): THE WOLF'S HEAD TEXTURE, its own file - 64 square, a dark brown fur with a lighter strand
 *  every fourth column, and two amber eyes (discs of radius 2) where a head's texture has them: the one texture the
 *  eye rule reads for a blob. */
export const WOLF_HEAD_EYES = Object.freeze([[20, 22], [44, 22]]);
function wolfHeadTexture() {
  const W = 64, rgba = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, strand = x % 4 === 0 ? 30 : 0;
      rgba[o] = 70 + strand; rgba[o + 1] = 50 + strand; rgba[o + 2] = 34 + strand; rgba[o + 3] = 255;
    }
  }
  for (const [cx, cy] of WOLF_HEAD_EYES) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) rgba.set([255, 190, 20, 255], ((cy + y) * W + cx + x) * 4);
  }
  return tgaBytes(W, W, rgba);
}

/** The same bytes with a texture name for another of the SAME length (the NIF's string keeps its size), every time it
 *  stands. */
function renamedTexture(bytes, from, to) {
  const out = bytes.slice();
  const a = Array.from(from, (c) => c.charCodeAt(0));
  let n = 0;
  for (let i = 0; i + a.length <= out.length; i++) {
    if (a.every((c, k) => out[i + k] === c)) { for (let k = 0; k < a.length; k++) out[i + k] = to.charCodeAt(k); n++; }
  }
  if (!n) throw new Error(`${from} is not in these bytes`);
  return out;
}
/** A flat brown fur, `w` square, as a TGA - a texture of a piece's own. */
const plainFur = (w) => tgaBytes(w, w, Uint8Array.from({ length: w * w * 4 }, (_, i) => [96, 70, 44, 255][i % 4]));

/** WEREWOLF1: the werewolf's files under Bloodmoon's own names (fixture bytes), beside the person's - distinct paths
 *  each, so a read log says which the build took. `wolf` false is a player without Bloodmoon attached. The meshes name
 *  tx_fixture.tga, served as the archive's .dds (SHADOW-FANG's skin reads it); AUDIT F1/C6: the head names its own,
 *  tx_wolf_hd.tga, served as the authored .tga, and the third-person skeleton has the bones the head, hair and chest
 *  bind to. AUDIT F8: the base model's bone addon and the person's first-person neck are here to be REFUSED - the wolf
 *  takes neither. `robeModel` false is a robe with no MODL (AUDIT C2). */
export function werewolfBodyDeps({ wolf = true, robe = true, robeModel = true, esmNames = ['armfp.esm'], wolfKf = true, generation = null } = {}) {
  const hand = fixtureFile('armfphand.nif'), arm = fixtureFile('armfparm.nif');
  const f = fixtureFile;
  const files = new Map([
    ['textures/tx_fixture.dds', f('fixture.dds')], ['textures/tx_wolf_hd.tga', wolfHeadTexture()], ['textures/tx_wolf1st.tga', plainFur(16)],
    [fpSkeletonPath({}), f('armfp.nif')], [FP_CLIP_PATH, f('armfpidle.kf')],
    ['meshes/xbase_anim.nif', f('armfp.nif')], ['meshes/xbase_anim.kf', f('armfpidle.kf')],
    ['animations/xbase_anim/pelvisaddon.nif', PELVIS_ADDON],
    ['meshes/fixture/humanhand.nif', hand], ['meshes/fixture/humanarm.nif', arm], ['meshes/fixture/humanneck1st.nif', arm],
    ['meshes/fixture/wolfhand.nif', hand], ['meshes/fixture/wolfhand1st.nif', renamedTexture(hand, 'tx_fixture.tga', 'tx_wolf1st.tga')],   // AUDIT D2: the first person's own texture
    ['meshes/fixture/wolfarm.nif', arm], ['meshes/fixture/wolfchest.nif', arm],
    ['meshes/fixture/wolfhead.nif', renamedTexture(arm, 'tx_fixture.tga', 'tx_wolf_hd.tga')], ['meshes/fixture/wolfhair.nif', arm],
  ]);
  if (wolf && wolfKf) {
    files.set('meshes/wolf/xskin.1st.nif', f('armfp.nif')); files.set('meshes/wolf/xskin.1st.kf', f('armfpidle.kf'));
    files.set('meshes/wolf/xskin.nif', WOLF_TP_SKELETON); files.set('meshes/wolf/xskin.kf', f('armfpidle.kf'));
  } else if (wolf) {   // AUDIT C7: the wolf's skeletons with no .kf of their own (no x-form, rule 18's swap declined)
    files.set('meshes/wolf/skin.1st.nif', f('armfp.nif')); files.set('meshes/wolf/skin.nif', WOLF_TP_SKELETON);
  }
  const recs = [
    bodyRec('b_fprace_m_hand', 'fixture\\humanhand.nif', 'fprace', 5), bodyRec('b_fprace_m_upperarm', 'fixture\\humanarm.nif', 'fprace', 8),
    bodyRec('b_fprace_m_neck.1st', 'fixture\\humanneck1st.nif', 'fprace', 2),
    bodyRec('wolf_hand', 'fixture\\wolfhand.nif', 'werewolf', 5), bodyRec('wolf_hand.1st', 'fixture\\wolfhand1st.nif', 'werewolf', 5),
    bodyRec('wolf_upperarm', 'fixture\\wolfarm.nif', 'werewolf', 8), bodyRec('wolf_chest', 'fixture\\wolfchest.nif', 'werewolf', 3),
    bodyRec('WerewolfHead', 'fixture\\wolfhead.nif', 'werewolf', 0), bodyRec('WerewolfHair', 'fixture\\wolfhair.nif', 'werewolf', 1),
  ];
  if (robe) recs.push(clotRec('WerewolfRobe', robeModel ? 'c\\c_werewolf.nif' : null, 4, [[6, 'wolf_hand'], [7, 'wolf_hand'], [13, 'wolf_upperarm'], [14, 'wolf_upperarm'], [3, 'wolf_chest']]));
  const esm = f('armfp.esm');
  const all = new Uint8Array(esm.length + recs.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0); let o = esm.length; for (const r of recs) { all.set(r, o); o += r.length; }
  const reads = new Set();
  let opened = 0;
  return {
    reads, get opened() { return opened; }, esm: all,
    deps: {
      loadMorrowindArchives: async () => { opened++; return [{ has: (p) => files.has(p), get: (p) => { reads.add(p); return files.get(p); }, list: () => [...files.keys()] }]; },
      storedMorrowindNames: async () => esmNames,
      loadMorrowindFile: async () => all,
      // a data generation turns the module's memos on (fpArm adoptMemoGeneration) - SHADOW-FANG's shared skin rides it
      ...(generation != null ? { morrowindDataGeneration: () => generation } : {}),
    },
  };
}
