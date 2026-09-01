// SHARED MORROWIND TEST FIXTURES.
//
// The hand-laid TES3 record builders and the archive/deps harness the
// MW suites drive their builds through. It lives here because NPC1
// gave the third-person body a SECOND caller (the actor service) and
// two copies of a hand-laid record layout is exactly the drift the
// port's one-home law exists to stop - a reader change would be
// caught by one suite and missed by the other.
import { readFileSync } from 'node:fs';

export const f = (n) => new Uint8Array(readFileSync(new URL(`./fixtures/mw/${n}`, import.meta.url)));

const sub = (name, data) => {
  const b = new Uint8Array(8 + data.length);
  b.set([...name].map((c) => c.charCodeAt(0)), 0);
  new DataView(b.buffer).setUint32(4, data.length, true);
  b.set(data, 8);
  return b;
};
const z = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(0));

/** A minimal TES3 BODY record, laid out by hand (record = name[4] +
 *  size + 8 header bytes + subrecords; each sub = name[4] + size +
 *  data) - so no writer shares the reader's guess. */
export function bodyRec(id, model, race, part, { female = false } = {}) {
  const bydt = new Uint8Array(4);
  bydt[0] = part; bydt[2] = female ? 1 : 0; bydt[3] = 0;   // BPF_Female=1; MT_Skin=0
  const subs = [sub('NAME', z(id)), sub('MODL', z(model)), sub('FNAM', z(race)), sub('BYDT', bydt)];
  const size = subs.reduce((a, s) => a + s.length, 0);
  const rec = new Uint8Array(16 + size);
  rec.set([...'BODY'].map((c) => c.charCodeAt(0)), 0);
  new DataView(rec.buffer).setUint32(4, size, true);
  let o = 16;
  for (const s of subs) { rec.set(s, o); o += s.length; }
  return rec;
}

/** Append hand-laid records onto a fixture .esm's bytes. */
export function esmWith(baseName, records) {
  const esm = f(baseName);
  const all = new Uint8Array(esm.length + records.reduce((a, r) => a + r.length, 0));
  all.set(esm, 0);
  let o = esm.length;
  for (const r of records) { all.set(r, o); o += r.length; }
  return all;
}

/**
 * Deps for a THIRD-PERSON actor build: the retail arrangement of
 * skeleton and animation names (rule 18's x-form, which retail has),
 * the two body meshes the fprace fixture records name, and a
 * generation stamp the caller controls - the swap caches and the
 * catalog both key on it, so a test that wants a fresh walk bumps it.
 */
export function tpActorDeps({ gen = null } = {}) {
  const files = new Map([
    ['meshes/xbase_anim.nif', f('armfp.nif')],
    ['meshes/xbase_anim.kf', f('armfpidle.kf')],
    ['meshes/fixture/armfphand.nif', f('armfphand.nif')],
    ['meshes/fixture/armfparm.nif', f('armfparm.nif')],
    ['textures/tx_fixture.dds', f('fixture.dds')],
  ]);
  // hand=5, upperarm=8 in MW_BODY_PARTS order (loadbody.hpp MeshPart)
  const all = esmWith('armfp.esm', [
    bodyRec('b_fprace_m_hand', 'fixture\\armfphand.nif', 'fprace', 5),
    bodyRec('b_fprace_m_upperarm', 'fixture\\armfparm.nif', 'fprace', 8),
  ]);
  let generation = gen;
  return {
    files,
    setGeneration(g) { generation = g; },
    deps: {
      loadMorrowindArchives: async () => [{ has: (p) => files.has(p), get: (p) => files.get(p) }],
      storedMorrowindNames: async () => ['armfp.esm'],
      loadMorrowindFile: async () => all,
      morrowindDataGeneration: () => generation,
    },
  };
}
