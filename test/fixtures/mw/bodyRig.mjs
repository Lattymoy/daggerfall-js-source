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
