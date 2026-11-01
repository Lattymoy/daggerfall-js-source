// FIRST-VISIT (2026-10-25, bible/07-Rendering/Performance-Priority.md FIRST-VISIT) - the port ships' builds kept
// across launches (systems/comeSailAway/shipBuildsKept.js, read by comeSailAwayModels.js loadComeSailAwayModels). A
// launch is a fresh module instance (the build's own once-a-process cache starts empty). Held here: a launch whose
// builds are kept builds nothing and answers the models a launch that built them answers; another bake refuses the
// kept build; a malformed record is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODELS = new URL('../../../src/systems/comeSailAway/comeSailAwayModels.js', import.meta.url).href;
const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
function storeOf() {
  const m = new Map();
  return { m, sets: 0, async get(k) { return m.get(k) ?? null; }, async set(k, v) { this.sets++; m.set(k, structuredClone(v)); return true; } };
}
let launches = 0;
/** One launch: a fresh module instance. */
async function launch(store, fetchFn = fileFetch) {
  const mod = await import(`${MODELS}?launch=${++launches}`);
  const models = await mod.loadComeSailAwayModels(fetchFn, undefined, { warn() {} }, mod.GALLEON_MODEL_URL, undefined, store);
  return { models };
}
const shape = (m) => ({ prefabs: m.prefabs, components: m.components, meshes: m.meshes, animation: m.animation, galleon: m.galleon, carrack: m.carrack, largeBoat: m.largeBoat, geo: Object.keys(m.meshes).filter((k) => m.meshes[k].port).map((k) => m.geometry(k)) });

test('FIRST-VISIT ship builds: a launch with the builds kept answers the models a launch that built them answers, from the store (mutant: the kept build ignored)', async () => {
  const store = storeOf();
  const first = await launch(store);
  assert.ok(first.models?.galleon && first.models.carrack && first.models.largeBoat, 'the fixture: all three port ships stand');
  assert.equal(store.m.size, 3, 'each ship\'s build kept');
  const keys = [...store.m.keys()];
  // a forged mark on each kept build: the next launch answers it, so it read the store instead of building
  for (const k of keys) store.m.get(k).prefab.forged = k;
  const second = await launch(store);
  assert.equal(store.sets, 3, 'nothing kept again');
  assert.equal(Object.values(second.models.prefabs).filter((p) => p.forged).length, 3, 'read back from the store');
  for (const k of keys) delete store.m.get(k).prefab.forged;
  const third = await launch(store);
  assert.deepEqual(shape(third.models), shape(first.models));
});

test('FIRST-VISIT ship builds: another bake refuses the kept build; a malformed record is refused (mutants: the bake left out of the key; any object taken)', async () => {
  const store = storeOf();
  await launch(store);
  const edited = async (url) => {
    const r = await fileFetch(url);
    if (!String(url).includes('carrack.json')) return r;
    const json = await r.json();
    json.edited = 1;
    return { ...r, json: async () => json };
  };
  await launch(store, edited);
  assert.equal(store.m.size, 4, 'the edited carrack built and kept under its own key');
  for (const k of store.m.keys()) store.m.set(k, { prefab: {}, components: [], meshes: { a: { positions: [1, 2, 3], vertexCount: 1 } }, animation: {} });
  const bad = await launch(store);
  assert.ok(bad.models?.galleon, 'built again over the malformed records');
  assert.ok(bad.models.geometry(Object.keys(bad.models.meshes).find((k) => bad.models.meshes[k].galleon)).positions instanceof Float32Array);
});
