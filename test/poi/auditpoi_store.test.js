// AUDIT POI, LANE A (2026-10-15; bible/06-Systems/POI-Editor-Arc.md POI-1, POI-4b) - THE STORE AND THE SHARED LAW, HELD
// TO WHAT THEY SAY. Mac: "Audit everything. Ensure perfection." Seven reviewers read the POI arc at 0c78d81a85; these
// are the store's and the law's findings, each pinned on the real Worker over the real migrations (test/accountDb.mjs)
// or on the law itself:
//   S1  a submission approved only as the approver saw it - its document named (`docSha`), the assets made public the
//       decided document's, a decision's later writes its own request's alone;
//   S2  a field the law does not know refused at every level; S3 the list never reads a document;
//   S4  an asset public only while a live revision names it, cached a day; S5 a mesh header of NaN bounds refused;
//   S6  a POI bounded as a whole; S7 a write that changed nothing never answered as one that did;
//   S8  two writes at once meet in the database; S9 the day's upload bound reserved where it is counted;
//   S10 every growth bounded - open revisions, the shelf ever, the list, the queue;
//   S11 a game holding a newer feed never handed an older one, a weak tag read; S12 stale whatever the live one is now;
//   S13 no control, separator, bidi or lone surrogate in what every player reads; S14 a rollback and a withdrawal recorded;
//   U13 a full shelf and an entry taken off said in their own words.
// The store's new names are read off a namespace, so on the code before the fix each pin fails on what it pins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePoiMesh, decodePoiMesh } from '../../src/poi/poiMesh.js';
import * as mesh from '../../src/poi/poiMesh.js';
import * as law from '../../src/poi/poiLaw.js';
import { DEFAULT_MATERIAL, problemLine } from '../../src/poi/poiLaw.js';
import { problemText } from '../../src/poi/poiText.js';
import { poiReview } from '../../src/poi/poiService.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { standService } from '../accountDb.mjs';
import * as poi from '../../server-account/src/poi.js';

const lines = (ps) => ps.map(problemLine).join('\n');
const hexOf = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes) => hexOf(await crypto.subtle.digest('SHA-256', bytes));
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));
/** A quad of two triangles in two submeshes; `lift` moves its top edge, so each lift is other bytes. */
const quad = (lift = 0) => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1 + lift, 0, 0, 1 + lift, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});
const docOf = (id, meshSha, { name = 'The Old Watchtower', px = 207, texture = null } = {}) => ({
  v: 1, id, name, about: 'A ruined tower.\nOn the hill.', tags: ['ruin'],
  place: { px, py: 213, x: 400.5, z: 120, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 },
  parts: [{ key: 'tower', name: 'Tower', mesh: meshSha, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true,
    materials: [{ ...DEFAULT_MATERIAL, texture }, { ...DEFAULT_MATERIAL }] }],
  lights: [{ t: [0, 3, 0], color: [1, 0.8, 0.5], radius: 8, intensity: 1, flicker: true }],
  marker: { show: true, label: 'Old Watchtower' },
});
const entryOf = (id, meshSha, extra = {}) => ({ v: 1, id, name: 'Lantern post', tags: [], parts: [{ key: 'body', mesh: meshSha, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true,
  materials: [{ ...DEFAULT_MATERIAL }, { ...DEFAULT_MATERIAL }] }], thumb: null, ...extra });

async function theStore() {
  poi.forgetPoiFeed();
  const s = await standService({ DEVELOPER_HANDLES: 'Dev', BUILDER_HANDLES: 'Mapper', APPROVER_HANDLES: 'Mac' });
  const mac = await s.registered('Mac'), dev = await s.registered('Dev'), mapper = await s.registered('Mapper'), player = await s.registered('Player');
  const req = async (method, path, { who = null, body, raw, headers = {} } = {}) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(who ? { authorization: `Bearer ${who.secret}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = res.status === 304 ? '' : await res.clone().text();
    let json = null; try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, json, res };
  };
  const upload = async (who, bytes, kind = 'mesh') => {
    const sha = await sha256(bytes);
    return { sha, ...(await req('PUT', `/v1/poi/asset/${sha}?kind=${kind}`, { who, raw: bytes })) };
  };
  const raw = s.env.DB._raw;
  /** a player's row, as the session lookup answers it - for calling the store directly */
  const row = (who) => raw.prepare('SELECT * FROM players WHERE id = ?').get(who.id);
  /** the name of a revision's document as stored - what an approver who looked at it saw */
  const seenSha = async (id, rev) => sha256(new TextEncoder().encode(raw.prepare('SELECT doc FROM poi_revs WHERE poi_id = ? AND rev = ?').get(id, rev).doc));
  const ctx = (nowS = Math.floor(Date.now() / 1000)) => ({ db: s.env.DB, bucket: s.env.SAVES, subtle: crypto.subtle, nowS });
  const draft = async (who, doc, base = null) => (await req('PUT', '/v1/poi/draft', { who, body: { doc, base } })).json;
  const submit = async (who, id, rev) => (await req('POST', '/v1/poi/submit', { who, body: { id, rev } })).json;
  const approve = async (id, rev) => (await req('POST', '/v1/poi/review', { who: mac, body: { id, rev, verdict: 'approve', docSha: await seenSha(id, rev) } })).json;
  const live = async () => { poi.forgetPoiFeed(); return (await req('GET', '/v1/poi/live')).json; };
  return { ...s, mac, dev, mapper, player, req, upload, raw, row, seenSha, ctx, draft, submit, approve, live };
}

/** A database whose statement matching `re` runs `before()` first, once - where two real requests meet (D1 runs each
 *  statement alone). `onBatch` the same before a batch. */
function racing(db, { re = null, onBatch = null, before }) {
  let fired = false;
  const once = async () => { if (!fired) { fired = true; await before(); } };
  return {
    batch: async (list) => { if (onBatch) await once(); return db.batch(list); },
    prepare(sql) {
      const st = db.prepare(sql);
      if (!re || !re.test(sql)) return st;
      const w = { bind(...a) { st.bind(...a); return w; }, _result: () => st._result(),
        first: async () => { await once(); return st.first(); }, all: async () => { await once(); return st.all(); }, run: async () => { await once(); return st.run(); } };
      return w;
    },
  };
}

// ── S1: APPROVED AS SEEN ────────────────────────────────────────────

test('AUDIT POI S1: an approval names the document the approver saw - withdrawn, saved over and sent again under the same revision, the approver\'s word is refused `poi-changed`, nothing decided, the unseen model private; an approval naming nothing refused; the queue gives each submission its document\'s name (mutants: the name unchecked; an approval naming nothing taken; the route dropping it; the client not sending it)', async () => {
  const { req, upload, dev, mac, draft, submit, live, seenSha } = await theStore();
  const benign = await upload(dev, encodePoiMesh(quad(0)));
  const unseen = await upload(dev, encodePoiMesh(quad(5)));
  const id = 'poi-00000000c0de';
  await draft(dev, docOf(id, benign.sha, { name: 'A small shrine' }));
  await submit(dev, id, 1);
  const seen = (await req('GET', '/v1/poi/queue', { who: mac })).json.queue[0];
  // the author withdraws, saves something else over the same revision, and sends it again
  assert.equal((await req('POST', '/v1/poi/withdraw', { who: dev, body: { id, rev: 1 } })).json.state, 'draft');
  assert.equal((await draft(dev, docOf(id, unseen.sha, { name: 'Something else', px: 500 }))).rev, 1);
  await submit(dev, id, 1);
  const word = await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'approve', docSha: seen.docSha } });
  assert.deepEqual([word.status, word.json.error], [409, 'poi-changed'], 'approved only as it was seen');
  assert.deepEqual((await live()).pois, [], 'nothing decided');
  assert.equal(seen.docSha, await seenSha(id, 1) && seen.docSha, 'the queue named the document it showed');
  assert.equal((await req('GET', `/v1/poi/asset/${unseen.sha}`)).status, 404, 'the unseen model is no stranger\'s');
  assert.equal((await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'reject', docSha: seen.docSha } })).json.error, 'poi-changed', 'nor sent back unseen');
  assert.deepEqual([(await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'approve' } })).status], [400], 'an approval names what it approves');
  // looked at again, it is approved as it now is
  const now = (await req('GET', '/v1/poi/queue', { who: mac })).json.queue[0];
  assert.deepEqual((await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'approve', docSha: now.docSha } })).json, { id, rev: 1, state: 'approved' });
  assert.equal((await live()).pois[0].doc.name, 'Something else');

  // the client's door sends the name it is given, and nothing when it has none
  const asked = [];
  const io = { fetch: async (url, init) => { asked.push(JSON.parse(init.body)); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) }; }, base: 'https://svc', secret: 's' };
  await poiReview(io, id, 1, 'approve', null, now.docSha);
  await poiReview(io, id, 1, 'reject', 'No.');
  assert.deepEqual(asked, [{ id, rev: 1, verdict: 'approve', note: null, docSha: now.docSha }, { id, rev: 1, verdict: 'reject', note: 'No.' }]);
});

test('AUDIT POI S1: the document decided is the document read - one swapped in between the approver\'s read and the batch is refused, and no live document names a model left private (mutant: the decision not held to the document read)', async () => {
  const { env, upload, dev, mac, row, ctx, raw, seenSha, req, live } = await theStore();
  const A = await upload(dev, encodePoiMesh(quad(0)));
  const B = await upload(dev, encodePoiMesh(quad(7)));
  const c = ctx(), DEV = row(dev), MAC = row(mac);
  const id = 'poi-00000000abab';
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, A.sha) });
  await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  const docSha = await seenSha(id, 1);
  // the author's other tab, between the approver's read and the approver's write
  const swapped = racing(env.DB, { onBatch: true, before: async () => {
    await poi.withdrawPoi(c, DEV, env, { id, rev: 1 });
    await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, B.sha, { name: 'swapped' }) });
    await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  } });
  const r = await poi.reviewPoi({ ...c, db: swapped }, MAC, env, { id, rev: 1, verdict: 'approve', docSha });
  assert.equal(r.error, 'poi-changed');
  assert.equal(raw.prepare('SELECT live_rev FROM poi_docs WHERE id = ?').get(id).live_rev, null, 'nothing went live');
  assert.equal(raw.prepare('SELECT state FROM poi_revs WHERE poi_id = ? AND rev = 1').get(id).state, 'submitted', 'still waiting, as it now is');
  assert.deepEqual((await live()).pois, []);
  assert.equal((await req('GET', `/v1/poi/asset/${B.sha}`)).status, 404);
});

test('AUDIT POI S1: a decision\'s later writes are its own request\'s - an approval sent again in the same second is refused and moves nothing, a rollback made since standing (mutant: the decision\'s mark one every request shares)', async () => {
  const { env, upload, dev, mapper, mac, row, ctx, raw, seenSha } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const c = ctx(1_800_000_000), DEV = row(dev), MAPPER = row(mapper), MAC = row(mac);
  const id = 'poi-00000000f00d';
  const state = () => ({ live: raw.prepare('SELECT live_rev FROM poi_docs WHERE id = ?').get(id).live_rev, v: raw.prepare('SELECT v FROM poi_feed').get().v });
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'r1' }) });
  await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  await poi.reviewPoi(c, MAC, env, { id, rev: 1, verdict: 'approve', docSha: await seenSha(id, 1) });
  await poi.savePoiDraft(c, MAPPER, env, { doc: docOf(id, m.sha, { name: 'r2' }), base: 1 });
  await poi.submitPoi(c, MAPPER, env, { id, rev: 2 });
  const docSha = await seenSha(id, 2);
  // the approver's click sent twice (a retry after a lost answer): the second read the revision still waiting; before
  // its batch lands, the first's approval lands, and the approver rolls the POI back to revision 1 - all in one second
  let before = null;
  const late = racing(env.DB, { onBatch: true, before: async () => {
    assert.equal((await poi.reviewPoi(c, MAC, env, { id, rev: 2, verdict: 'approve', docSha })).state, 'approved');
    assert.equal((await poi.rollbackPoi(c, MAC, env, { id, rev: 1 })).live, true);
    before = state();
  } });
  assert.equal((await poi.reviewPoi({ ...c, db: late }, MAC, env, { id, rev: 2, verdict: 'approve', docSha })).error, 'poi-state');
  assert.equal(before.live, 1);
  assert.deepEqual(state(), before, 'the rollback stands, the feed unmoved');
});

// ── S2, S3: THE LAW AT EVERY LEVEL; THE LIST READS NO DOCUMENT ──────

test('AUDIT POI S2: a field the law does not know is a problem at every level - in the place, a part, a light, the marker, a material\'s UVs, a shelf entry\'s part - and the store refuses it (mutants: each level unread)', async () => {
  const base = docOf('poi-0000000000ab', 'a'.repeat(64));
  const mat = base.parts[0].materials[0];
  const cases = [
    [{ ...base, place: { ...base.place, script: 'x' } }, 'place.script'],
    [{ ...base, parts: [{ ...base.parts[0], onLoad: { any: 1 } }] }, 'parts[0].onLoad'],
    [{ ...base, lights: [{ ...base.lights[0], shadowCaster: true }] }, 'lights[0].shadowCaster'],
    [{ ...base, marker: { ...base.marker, href: 'https://elsewhere.invalid' } }, 'marker.href'],
    [{ ...base, parts: [{ ...base.parts[0], materials: [{ ...mat, uv: { ...mat.uv, matrix: [1, 2, 3] } }, base.parts[0].materials[1]] }] }, 'parts[0].materials[0].uv.matrix'],
  ];
  for (const [d, path] of cases) assert.match(lines(law.poiDocProblems(d)), new RegExp(`^${path.replace(/[[\].]/g, '\\$&')}: unknown$`, 'm'), path);
  const proto = JSON.parse(JSON.stringify(base).replace('"ground":"snap"', '"ground":"snap","__proto__":{"polluted":1}'));
  assert.match(lines(law.poiDocProblems(proto)), /^place\.__proto__: unknown$/m, 'an own key JSON made, however it is spelt');
  assert.match(lines(law.poiShelfProblems(entryOf('lib-00000000beef', 'a'.repeat(64), { parts: [{ ...entryOf('lib-00000000beef', 'a'.repeat(64)).parts[0], extra: 1 }] }))), /^parts\[0\]\.extra: unknown$/m);
  assert.deepEqual(law.poiDocProblems(base), [], 'the whole document still the law\'s');

  const { upload, dev, req } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const doc = docOf('poi-0000000000ab', m.sha);
  doc.place.script = 'alert(1)';
  const r = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc } });
  assert.equal(r.status, 400);
  assert.match(lines(r.json.problems), /^place\.script: unknown$/m);
});

test('AUDIT POI S3: one draft deep past SQLite\'s JSON bound breaks no builder\'s list - the law refuses it, and the list reads its names and pixels from their own columns, never out of a document (mutants: the list reading the documents; the name not written beside them)', async () => {
  const { upload, dev, mapper, mac, req, raw, draft } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  await draft(dev, docOf('poi-000000000001', m.sha, { name: 'Healthy', px: 300 }));
  const deep = docOf('poi-000000000002', m.sha);
  deep.place.note = JSON.parse('['.repeat(1100) + ']'.repeat(1100));
  // a document no reader can take apart, stored as it was before the law knew better
  raw.prepare('INSERT INTO poi_docs (id, created_by, created_at) VALUES (?, ?, ?)').run('poi-000000000003', dev.id, 1);
  raw.prepare("INSERT INTO poi_revs (poi_id, rev, kind, doc, author, author_name, at, state) VALUES (?, 1, 'doc', ?, ?, 'Dev', 1, 'draft')").run('poi-000000000003', JSON.stringify({ place: { note: deep.place.note } }), dev.id);
  for (const who of [mapper, dev, mac]) {
    const list = await req('GET', '/v1/poi/list', { who });
    assert.equal(list.status, 200, `${who.handle}'s list answers`);
    const healthy = list.json.pois.find((p) => p.id === 'poi-000000000001');
    assert.deepEqual([healthy.name, healthy.px, healthy.py], ['Healthy', 300, 213]);
  }
  assert.equal((await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: deep } })).status, 400, 'and the law refuses the passenger');
});

// ── S4, S5: WHAT IS PUBLIC; A MESH'S BOUNDS ─────────────────────────

test('AUDIT POI S4: an asset is public only while a live revision names it - a model a newer revision replaced, and a retired POI\'s, a builder\'s again; stood again by a rollback, public again; one two POIs share live while either names it; a live asset cached a day (mutants: live never cleared; the rollback not recomputing it; the cache a year)', async () => {
  const { req, upload, dev, mapper, mac, draft, submit, approve } = await theStore();
  const A = await upload(dev, encodePoiMesh(quad(0)));
  const B = await upload(dev, encodePoiMesh(quad(3)));
  const S = await upload(dev, encodePoiMesh(quad(9)));
  const id = 'poi-0000000000dd', other = 'poi-0000000000ee';
  const status = async (sha) => (await req('GET', `/v1/poi/asset/${sha}`)).status;
  await draft(dev, docOf(id, A.sha)); await submit(dev, id, 1); await approve(id, 1);
  // revision 2 replaces model A with model B
  await draft(dev, docOf(id, B.sha), 1); await submit(dev, id, 2); await approve(id, 2);
  assert.deepEqual([await status(A.sha), await status(B.sha)], [404, 200], 'the replaced model is no stranger\'s');
  // a model two POIs share: live while either names it
  await draft(mapper, docOf(other, S.sha)); await submit(mapper, other, 1); await approve(other, 1);
  await draft(dev, { ...docOf(id, B.sha), parts: [docOf(id, B.sha).parts[0], { ...docOf(id, S.sha).parts[0], key: 'shared' }] }, 2); await submit(dev, id, 3); await approve(id, 3);
  await draft(dev, docOf(id, B.sha), 3); await submit(dev, id, 4); await approve(id, 4);
  assert.equal(await status(S.sha), 200, 'the other POI still names it');
  // retired: its models a builder's again
  const r = (await req('POST', '/v1/poi/retire', { who: mapper, body: { id } })).json;
  assert.equal((await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: r.rev, verdict: 'approve' } })).json.state, 'approved');
  assert.deepEqual([await status(B.sha), await status(S.sha)], [404, 200]);
  assert.equal((await req('GET', `/v1/poi/asset/${B.sha}`, { who: dev })).status, 200, 'still the builders\'');
  // rolled back to revision 1: model A in the world again
  assert.equal((await req('POST', '/v1/poi/rollback', { who: mac, body: { id, rev: 1 } })).json.live, true);
  assert.deepEqual([await status(A.sha), await status(B.sha)], [200, 404]);
  const pub = await req('GET', `/v1/poi/asset/${A.sha}`);
  assert.equal(pub.res.headers.get('cache-control'), 'public, max-age=86400', 'a day - an asset can stop being public');
});

test('AUDIT POI S5: a mesh header of NaN bounds is a header that lies - refused by the decoder and by the store (mutant: the bounds compared as they differ)', async () => {
  const bytes = encodePoiMesh(quad());
  const lie = new Uint8Array(bytes);
  for (let k = 0; k < 6; k++) new DataView(lie.buffer).setFloat32(20 + k * 4, NaN, true);
  assert.deepEqual(decodePoiMesh(lie), { error: 'bounds' });
  const one = new Uint8Array(bytes); new DataView(one.buffer).setFloat32(32, NaN, true);
  assert.deepEqual(decodePoiMesh(one), { error: 'bounds' }, 'one bound NaN is enough');
  const { upload, dev } = await theStore();
  const up = await upload(dev, lie);
  assert.deepEqual([up.status, up.json.error, up.json.why], [400, 'poi-bad-mesh', 'bounds']);
});

// ── S6: A POI AS A WHOLE ────────────────────────────────────────────

test('AUDIT POI S6: a POI is bounded as a whole - the triangles and vertices it draws (a model stood twice drawn twice), the bytes and pixels of its distinct assets, how far it reaches at its size - each said by the editor; the store refuses past any, and a POI at every budget passes (mutants: each budget unread; the place\'s size unread)', async () => {
  const B = { triangles: 1_048_576, vertices: 1_048_576, bytes: 64 * 1024 * 1024, pixels: 2 * 4096 * 4096, reach: 2048 };
  const h = (n, c) => `${c}${n}`.padEnd(64, c);
  const part = (i, meshSha, extra = {}) => ({ key: `p${i}`, mesh: meshSha, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }], ...extra });
  const meshFact = (triangles, vertices, bytes, min = [-1, -1, -1], max = [1, 1, 1]) => ({ kind: 'mesh', submeshes: 1, triangles, vertices, bytes, min, max });
  const tex = (bytes) => ({ kind: 'texture', w: 4096, h: 4096, bytes });
  const codes = (doc, facts) => law.poiAssetProblems(doc, (s) => facts.get(s) ?? null).map((p) => p.code);
  const base = docOf('poi-000000000abc', h(0, 'a'));
  // drawn: one model stood twice is drawn twice - over the triangles and vertices, its bytes counted once
  const half = meshFact(B.triangles / 2 + 1, B.vertices / 2 + 1, 1024);
  const twice = { ...base, parts: [part(0, h(0, 'a')), part(1, h(0, 'a'))] };
  assert.deepEqual(codes(twice, new Map([[h(0, 'a'), half]])), ['budget-triangles', 'budget-vertices']);
  assert.deepEqual(codes({ ...base, parts: [part(0, h(0, 'a'))] }, new Map([[h(0, 'a'), half]])), []);
  // fetched and held: distinct assets' bytes and pixels
  const pics = [h(1, 'b'), h(2, 'b'), h(3, 'b')];
  const mats = (i) => [{ ...DEFAULT_MATERIAL, texture: pics[i] }];
  const facts = new Map([[h(0, 'a'), meshFact(2, 4, 40 * 1024 * 1024)], ...pics.map((p) => [p, tex(16 * 1024 * 1024)])]);
  const three = { ...base, parts: [0, 1, 2].map((i) => part(i, h(0, 'a'), { materials: mats(i) })) };
  assert.deepEqual(codes(three, facts), ['budget-bytes', 'budget-pixels']);
  assert.deepEqual(codes({ ...three, parts: [part(0, h(0, 'a'), { materials: mats(0) }), part(1, h(0, 'a'), { materials: mats(0) })] }, facts), [], 'one picture worn twice is held once');
  // reach: a part's box, sized, turned and moved, times the place's size
  const reachFacts = new Map([[h(0, 'a'), meshFact(2, 4, 100, [0, 0, 0], [1, 1, 1])]]);
  const far = (s, t = [0, 0, 0], ps = 1) => ({ ...base, place: { ...base.place, s: ps }, parts: [part(0, h(0, 'a'), { s: [s, s, s], t })] });
  assert.deepEqual(codes(far(1000), reachFacts), [], 'a corner sqrt(3) km out - 1,732 m');
  assert.deepEqual(codes(far(1000, [0, 0, 0], 2), reachFacts), ['budget-reach'], 'at twice the size, 3,464 m');
  assert.deepEqual(codes(far(1, [1999, 0, 0], 1.05), reachFacts), ['budget-reach'], 'moved out, and sized');
  const said = law.poiAssetProblems(far(1000, [0, 0, 0], 2), (s) => reachFacts.get(s) ?? null)[0];
  assert.deepEqual(said, { path: 'doc', code: 'budget-reach', have: 3465, max: 2048 });
  for (const code of ['budget-triangles', 'budget-vertices', 'budget-bytes', 'budget-pixels', 'budget-reach']) {
    assert.doesNotMatch(problemText({ code, have: 2 * 1024 * 1024, max: 1024 * 1024 }), /Something is wrong/, `${code} is said in words`);
  }
  assert.match(problemText({ code: 'budget-bytes', have: 80 * 1024 * 1024, max: B.bytes }), /80 MB; at most 64 MB/);

  // the store: its facts as stored at the upload (poiMeshFacts, the editor's to read too), and a POI past a budget refused
  const { upload, dev, req, raw } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  assert.deepEqual(m.json.meta, mesh.poiMeshFacts(decodePoiMesh(encodePoiMesh(quad())).mesh));
  const big = h(9, 'c');
  raw.prepare("INSERT INTO poi_assets (sha, kind, bytes, meta, by, at, live) VALUES (?, 'mesh', 1000, ?, ?, 1, 0)").run(big, JSON.stringify({ submeshes: 2, vertices: 4, triangles: B.triangles / 2 + 1, min: [0, 0, 0], max: [1, 1, 0] }), dev.id);
  const heavy = { ...docOf('poi-000000000abd', big), parts: [0, 1].map((i) => ({ ...docOf('x', big).parts[0], key: `k${i}` })) };
  const refused = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: heavy } });
  assert.equal(refused.status, 400);
  assert.match(lines(refused.json.problems), /^doc: budget-triangles$/m);
  assert.equal((await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: { ...heavy, parts: [heavy.parts[0]] } } })).status, 200);
  assert.deepEqual(law.POI_BUDGET, B, 'the budgets as the lead puts them to Mac');
});

// ── S7, S8: WRITES THAT CHANGED NOTHING; WRITES AT ONCE ─────────────

/** The store with one mesh up and the players' rows for calling it directly. */
async function directly() {
  const s = await theStore();
  const m = await s.upload(s.dev, encodePoiMesh(quad()));
  return { ...s, m, c: s.ctx(), DEV: s.row(s.dev), MAPPER: s.row(s.mapper), MAC: s.row(s.mac),
    stored: (id, rev) => s.raw.prepare("SELECT state, json_extract(doc, '$.name') AS name FROM poi_revs WHERE poi_id = ? AND rev = ?").get(id, rev) };
}

test('AUDIT POI S7: a save meeting a submission is stored where its answer says - the submission as it was sent, the save the next draft (mutant: the save writing over a submission)', async () => {
  const { env, m, c, DEV, stored } = await directly();
  const id = 'poi-00000000a5a5';
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'v1' }) });
  // the author's tab A saves as tab B submits the same draft
  const meets = racing(env.DB, { re: /^\s*UPDATE poi_revs SET doc/, before: () => poi.submitPoi(c, DEV, env, { id, rev: 1 }) });
  const saved = await poi.savePoiDraft({ ...c, db: meets }, DEV, env, { doc: docOf(id, m.sha, { name: 'v2 - the hour of work' }) });
  assert.equal(saved.state, 'draft');
  assert.deepEqual({ ...stored(id, saved.rev) }, { state: 'draft', name: 'v2 - the hour of work' }, 'stored where the answer says');
  assert.deepEqual({ ...stored(id, 1) }, { state: 'submitted', name: 'v1' }, 'the submission as it was sent');
});

test('AUDIT POI S7: a withdrawal an approval beat is told the revision is approved, not that it is a draft again (mutant: the withdrawal\'s answer its own guess)', async () => {
  const { env, m, c, DEV, MAC, seenSha } = await directly();
  const id = 'poi-00000000b6b6';
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'to withdraw' }) });
  await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  const docSha = await seenSha(id, 1);
  const beaten = racing(env.DB, { re: /^\s*UPDATE poi_revs SET (state = \?, )?submitted_at = NULL/, before: () => poi.reviewPoi(c, MAC, env, { id, rev: 1, verdict: 'approve', docSha }) });
  assert.deepEqual(await poi.withdrawPoi({ ...c, db: beaten }, DEV, env, { id, rev: 1 }), { error: 'poi-state', state: 'approved' });
});

test('AUDIT POI S7: a submission its author saved over between its check and its write is refused, never sent unchecked (mutant: the submission not held to the document checked)', async () => {
  const { env, m, c, DEV, stored } = await directly();
  const id = 'poi-00000000c7c8';
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'checked' }) });
  const under = racing(env.DB, { re: /^\s*UPDATE poi_revs SET state = 'submitted'/, before: () => poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'unchecked' }) }) });
  assert.deepEqual(await poi.submitPoi({ ...c, db: under }, DEV, env, { id, rev: 1 }), { error: 'poi-state', state: 'draft' });
  assert.equal(stored(id, 1).state, 'draft');
  assert.equal((await poi.submitPoi(c, DEV, env, { id, rev: 1 })).state, 'submitted', 'sent once checked');
});

test('AUDIT POI S8: two builders putting one new shelf id at once - one keeps it, the other is told it is the other\'s, never both told they won (mutant: the shelf\'s loser told it won)', async () => {
  const { env, m, c, DEV, MAPPER, raw } = await directly();
  const both = await Promise.all([poi.shelve(c, DEV, env, { item: entryOf('lib-00000000c7c7', m.sha, { name: 'Dev\'s lamp' }) }), poi.shelve(c, MAPPER, env, { item: entryOf('lib-00000000c7c7', m.sha, { name: 'Mapper\'s lamp' }) })]);
  const kept = raw.prepare('SELECT name, by_name FROM poi_shelf WHERE id = ?').get('lib-00000000c7c7');
  assert.deepEqual(both.map((r) => r.error ?? 'ok').sort(), ['ok', 'poi-not-author']);
  assert.equal(kept.name, kept.by_name === 'Dev' ? 'Dev\'s lamp' : 'Mapper\'s lamp', 'the entry stored is the one told it was kept');
});

test('AUDIT POI S8: two retirements asked at once - one waits, the other is told one waits (mutant: a second retirement stored)', async () => {
  const { env, m, c, DEV, MAPPER, MAC, raw, seenSha } = await directly();
  const id = 'poi-00000000d8d8';
  await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha) });
  await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  await poi.reviewPoi(c, MAC, env, { id, rev: 1, verdict: 'approve', docSha: await seenSha(id, 1) });
  const two = await Promise.all([poi.requestRetire(c, DEV, env, { id }), poi.requestRetire(c, MAPPER, env, { id })]);
  assert.deepEqual(two.map((r) => r.error ?? r.state).sort(), ['poi-pending', 'submitted']);
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM poi_revs WHERE poi_id = ? AND kind = 'retire' AND state = 'submitted'").get(id).n, 1);
});

test('AUDIT POI S8: one author\'s two first saves at once are one open draft, saved over; a submission withdrawn beside another open draft of the author\'s is withdrawn, not a second draft (mutant: a second open draft stored)', async () => {
  const { env, m, c, DEV, raw } = await directly();
  // one author's two tabs save a new POI at once: tab B's save runs whole just before tab A's writes its revision
  const id = 'poi-00000000e9e9';
  let tabB = null;
  const meet = racing(env.DB, { re: /^\s*INSERT INTO poi_revs/, onBatch: true, before: async () => { tabB = await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'tab B' }) }); } });
  const tabA = await poi.savePoiDraft({ ...c, db: meet }, DEV, env, { doc: docOf(id, m.sha, { name: 'tab A' }) });
  assert.deepEqual([tabA.rev, tabB.rev], [1, 1], 'one draft, saved over');
  assert.equal(raw.prepare("SELECT json_extract(doc, '$.name') AS name FROM poi_revs WHERE poi_id = ? AND rev = 1").get(id).name, 'tab A', 'the later save its draft');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM poi_revs WHERE poi_id = ? AND state = 'draft'").get(id).n, 1);
  // sent, a new draft begun beside it, then the sent one taken back: one open draft still
  await poi.submitPoi(c, DEV, env, { id, rev: 1 });
  assert.equal((await poi.savePoiDraft(c, DEV, env, { doc: docOf(id, m.sha, { name: 'tab C' }) })).rev, 2);
  assert.deepEqual(await poi.withdrawPoi(c, DEV, env, { id, rev: 1 }), { id, rev: 1, state: 'withdrawn' });
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM poi_revs WHERE poi_id = ? AND state = 'draft'").get(id).n, 1);
});

// ── S9, S10: THE BOUNDS ─────────────────────────────────────────────

test('AUDIT POI S9: the day\'s upload bound is reserved where it is counted - eight uploads at once with room for one store one; bytes never stored are given back (mutants: the bound unreserved; a failed store keeping its bytes counted)', async () => {
  const { env, dev, row, ctx, raw } = await theStore();
  const c = ctx(), DEV = row(dev);
  const bound = poi.POI_UPLOAD_DAY_BYTES;
  const meshes = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => encodePoiMesh(quad(i + 1)));
  const size = meshes[0].byteLength;
  // the builder's day: room for one more mesh, not two (as the store counts it - the day's table, where there is one)
  const used = bound - Math.floor(size * 1.5);
  if (raw.prepare("SELECT 1 FROM sqlite_master WHERE name = 'poi_upload_days'").get()) raw.prepare('INSERT INTO poi_upload_days (by, day, bytes) VALUES (?, ?, ?)').run(DEV.id, Math.floor(c.nowS / 86400), used);
  raw.prepare("INSERT INTO poi_assets (sha, kind, bytes, meta, by, at, live) VALUES (?, 'mesh', ?, '{}', ?, ?, 0)").run('f'.repeat(64), used, DEV.id, c.nowS);
  // a statement a few milliseconds away, as D1's are, so the uploads' statements interleave
  const slow = { batch: (l) => env.DB.batch(l), prepare(sql) {
    const st = env.DB.prepare(sql); const lag = () => new Promise((r) => setTimeout(r, 3));
    const w = { bind(...a) { st.bind(...a); return w; }, first: async () => { await lag(); return st.first(); }, all: async () => { await lag(); return st.all(); }, run: async () => { await lag(); return st.run(); } };
    return w;
  } };
  const shas = await Promise.all(meshes.map(sha256));
  const raced = await Promise.all(meshes.map((b, i) => poi.putPoiAsset({ ...c, db: slow }, DEV, env, { sha: shas[i], kind: 'mesh', bytes: b.buffer.slice(0) })));
  assert.deepEqual(raced.map((r) => r.error ?? 'stored').sort(), ['poi-quota', 'poi-quota', 'poi-quota', 'poi-quota', 'poi-quota', 'poi-quota', 'poi-quota', 'stored']);
  // a store that fails: the bytes are not the day's
  const day = () => raw.prepare('SELECT bytes FROM poi_upload_days WHERE by = ? AND day = ?').get(DEV.id, Math.floor(c.nowS / 86400)).bytes;
  raw.prepare('UPDATE poi_upload_days SET bytes = 1000 WHERE by = ?').run(DEV.id);
  const was = day();
  const fresh = encodePoiMesh(quad(40));
  const failing = { ...c, bucket: { put: async () => { throw new Error('R2 down'); } } };
  await assert.rejects(poi.putPoiAsset(failing, DEV, env, { sha: await sha256(fresh), kind: 'mesh', bytes: fresh.buffer.slice(0) }), /R2 down/);
  assert.equal(day(), was, 'given back');
});

test('AUDIT POI S10: every growth bounded - a builder\'s open revisions (a new POI too), saving over one\'s own draft still free; the shelf ever, those taken off counted; the list the newest revisions of the POIs it lists, and only theirs read; the queue the oldest, `more` saying others wait (mutants: each bound lifted; the list reading every revision)', async () => {
  const { env, upload, dev, mapper, mac, row, ctx, raw, req, draft } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const c = ctx(), DEV = row(dev);
  const hex12 = (n) => n.toString(16).padStart(12, '0');
  const seedPoi = raw.prepare('INSERT INTO poi_docs (id, created_by, created_at) VALUES (?, ?, ?)');
  const seedRev = raw.prepare("INSERT INTO poi_revs (poi_id, rev, kind, doc, author, author_name, at, state, submitted_at) VALUES (?, ?, 'doc', '{}', ?, ?, ?, ?, ?)");

  // open revisions: POI_OPEN_REVS of the developer's, drafts and submissions
  const open = poi.POI_OPEN_REVS ?? 200;
  assert.equal(open, 200);
  const first = await draft(dev, docOf('poi-0000000a0001', m.sha));
  for (let i = 1; i < open; i++) { seedPoi.run(`poi-${hex12(0xb00000 + i)}`, dev.id, 1); seedRev.run(`poi-${hex12(0xb00000 + i)}`, 1, dev.id, 'Dev', 1, i % 2 ? 'draft' : 'submitted', i % 2 ? null : 1); }
  const full = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: docOf('poi-0000000a0002', m.sha) } });
  assert.deepEqual([full.status, full.json.error], [409, 'poi-drafts-full']);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM poi_docs WHERE id = ?').get('poi-0000000a0002').n, 0, 'no POI founded without its draft');
  assert.equal((await draft(dev, docOf('poi-0000000a0001', m.sha, { name: 'Saved over' }))).rev, first.rev, 'saving over one\'s own draft takes no room');
  assert.equal((await draft(mapper, docOf('poi-0000000a0002', m.sha))).state, 'draft', 'another builder\'s own room');

  // the shelf ever: POI_SHELF_EVER of a builder's entries, taken off or not
  const ever = poi.POI_SHELF_EVER ?? 10000;
  assert.equal(ever, 10000);
  const seedShelf = raw.prepare('INSERT INTO poi_shelf (id, item, name, tags, thumb, parts, triangles, by, by_name, at, updated_at, updated_by, gone_at) VALUES (?, ?, ?, ?, NULL, 1, 2, ?, ?, 1, 1, ?, 1)');
  raw.exec('BEGIN');
  for (let i = 0; i < ever; i++) seedShelf.run(`lib-${hex12(0x200000 + i)}`, '{}', 'x', '[]', DEV.id, 'Dev', 'Dev');
  raw.exec('COMMIT');
  const spent = await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf('lib-0000000f00d1', m.sha) } });
  assert.deepEqual([spent.status, spent.json.error], [409, 'poi-shelf-spent']);
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: mapper, body: { item: entryOf('lib-0000000f00d1', m.sha) } })).status, 200);

  // the list: 2,001 POIs, one with 25 revisions - the newest 2,000 listed, the newest 20 of each, nothing else read
  raw.exec('BEGIN');
  for (let i = 0; i < 2001; i++) { seedPoi.run(`poi-${hex12(0xc00000 + i)}`, DEV.id, 10 + i); seedRev.run(`poi-${hex12(0xc00000 + i)}`, 1, DEV.id, 'Dev', 1, 'rejected', null); }
  const deep = `poi-${hex12(0xc00000 + 2000)}`;
  for (let r = 2; r <= 25; r++) seedRev.run(deep, r, DEV.id, 'Dev', 1, 'rejected', null);
  raw.exec('COMMIT');
  let revRows = 0;
  const counting = { batch: (l) => env.DB.batch(l), prepare(sql) {
    const st = env.DB.prepare(sql);
    const w = { bind(...a) { st.bind(...a); return w; }, first: () => st.first(), run: () => st.run(), all: async () => { const r = await st.all(); if (/rev, kind, author/.test(sql)) revRows += r.results.length; return r; } };
    return w;
  } };
  const list = (await poi.listPoi({ ...c, db: counting }, DEV, env)).pois;
  assert.equal(list.length, 2000);
  const deepOne = list.find((p) => p.id === deep);
  assert.deepEqual([deepOne.revs.length, deepOne.revs[0].rev, deepOne.newestRev], [20, 6, 25], 'its newest twenty');
  assert.equal(revRows, list.reduce((n, p) => n + p.revs.length, 0), 'only what it lists is read');
  assert.equal((await req('GET', `/v1/poi/doc/${deep}`, { who: dev })).json.revs.length, 25, 'the history has them all');

  // the queue: 51 waiting, the oldest 50 answered
  raw.prepare("UPDATE poi_revs SET state = 'submitted', submitted_at = at + rowid WHERE state = 'rejected' AND rev = 1 AND poi_id IN (SELECT id FROM poi_docs WHERE created_at < 61)").run();
  const q = (await req('GET', '/v1/poi/queue', { who: mac })).json;
  const waiting = raw.prepare("SELECT COUNT(*) AS n FROM poi_revs WHERE state = 'submitted'").get().n;
  assert.ok(waiting > poi.POI_QUEUE_MAX, `${waiting} wait`);
  assert.deepEqual([q.queue.length, q.more], [50, true]);
});

// ── S11, S12: THE FEED; WHAT IS STALE ───────────────────────────────

test('AUDIT POI S11: a game holding a newer feed than this isolate keeps is never handed the older one - the version asked again; a weak tag read as its version (mutants: the held version unread; a weak tag a stranger)', async () => {
  const { env, req, upload, dev, mac, row, ctx, draft, submit, approve, seenSha } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const id = 'poi-0000000000b2';
  await draft(dev, docOf(id, m.sha, { name: 'first' })); await submit(dev, id, 1); await approve(id, 1);
  assert.equal((await req('GET', '/v1/poi/live')).json.v, 1, 'this isolate keeps v1');
  // another isolate (another instance of the store's module) approves the second
  const isoB = await import('../../server-account/src/poi.js?isolate=B');
  await draft(dev, docOf(id, m.sha, { name: 'second' }), 1); await submit(dev, id, 2);
  assert.equal((await isoB.reviewPoi(ctx(), row(mac), env, { id, rev: 2, verdict: 'approve', docSha: await seenSha(id, 2) })).state, 'approved');
  // the game, holding "poi-2" from there, asks here inside the keep
  const held = await req('GET', '/v1/poi/live', { headers: { 'if-none-match': '"poi-2"' } });
  assert.equal(held.status, 304, 'what it holds is the newest');
  assert.equal(held.res.headers.get('etag'), '"poi-2"');
  assert.equal((await req('GET', '/v1/poi/live', { headers: { 'if-none-match': 'W/"poi-2"' } })).status, 304, 'a weak tag is the same version');
  const older = await req('GET', '/v1/poi/live', { headers: { 'if-none-match': 'W/"poi-1"' } });
  assert.deepEqual([older.status, older.json.v, older.json.pois[0].doc.name], [200, 2, 'second']);
  assert.equal(poi.poiHeldVersion?.('"poi-3", W/"poi-12"'), 12);
  assert.equal(poi.poiHeldVersion?.('"poi-x"'), -1);
});

test('AUDIT POI S12: a submission is stale whenever the revision it was made from is not the live one now - a change to a POI retired since, a first draft of a POI that went live since, a retirement of a revision no longer live (mutant: stale only while a revision is live)', async () => {
  const { req, upload, dev, mapper, mac, draft, submit, approve } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const id = 'poi-0000000000c2';
  const stale = async () => Object.fromEntries((await req('GET', '/v1/poi/queue', { who: mac })).json.queue.map((x) => [`${x.kind}${x.rev}`, x.stale]));
  await draft(dev, docOf(id, m.sha, { name: 'Bandit camp' }));
  await submit(dev, id, 1);
  assert.deepEqual(await stale(), { doc1: false }, 'a new POI\'s first is fresh');
  await draft(mapper, docOf(id, m.sha, { name: 'Mapper\'s camp' }));
  await submit(mapper, id, 2);
  await approve(id, 1);
  assert.deepEqual(await stale(), { doc2: true }, 'made from nothing, while revision 1 went live');
  await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 2, verdict: 'reject', note: 'Stale.' } });
  await draft(mapper, docOf(id, m.sha, { name: 'Bigger camp' }), 1);
  await submit(mapper, id, 3);
  const r = (await req('POST', '/v1/poi/retire', { who: dev, body: { id } })).json;
  assert.deepEqual(await stale(), { doc3: false, [`retire${r.rev}`]: false });
  await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: r.rev, verdict: 'approve' } });
  assert.deepEqual(await stale(), { doc3: true }, 'a change to a POI retired since would stand it again');
  await req('POST', '/v1/poi/rollback', { who: mac, body: { id, rev: 1 } });
  const r2 = (await req('POST', '/v1/poi/retire', { who: dev, body: { id } })).json;
  await draft(dev, docOf(id, m.sha, { name: 'Newer camp' }), 1); await submit(dev, id, r2.rev + 1); await approve(id, r2.rev + 1);
  assert.equal((await stale())[`retire${r2.rev}`], true, 'a retirement of a revision no longer live');
});

// ── S13, S14, U13: WORDS, RECORDS ───────────────────────────────────

test('AUDIT POI S13: no name, tag, label or part name every player reads holds a control character (C1 too), a line or paragraph separator, a bidi embedding, override or isolate, or half a surrogate pair; prose takes its lines and nothing else of those; any script\'s letters and a whole emoji pass (mutants: each class let through)', () => {
  const base = docOf('poi-0000000000c1', 'a'.repeat(64));
  const bad = { 'C1 U+0085': 'Shrine\u{85}x', 'U+2028': 'Shrine\u{2028}of lies', 'U+2029': 'Shrine\u{2029}x', 'RLO U+202E': 'Shrine \u{202E}tlov', 'LRE U+202A': 'Shrine\u{202A}x', 'RLI U+2067': 'Shrine \u{2067}x\u{2069}', 'lone high surrogate': 'Shrine\u{D800}', 'lone low surrogate': '\u{DC00}Shrine', DEL: 'Shrine\u{7f}' };
  for (const [what, s] of Object.entries(bad)) {
    const paths = law.poiDocProblems({ ...base, name: s, tags: [s], marker: { show: true, label: s }, parts: [{ ...base.parts[0], name: s }] }).map((p) => p.path);
    assert.deepEqual(paths, ['name', 'tags[0]', 'parts[0].name', 'marker.label'], what);
    assert.deepEqual(law.poiDocProblems({ ...base, about: `A shrine.\n${s}` }).map((p) => p.path), ['about'], `${what} in prose`);
  }
  assert.deepEqual(law.poiDocProblems({ ...base, name: 'Café ö 漢字 Шрайн \u{1F3F0}', about: 'Two\nlines' }), [], 'letters of any script, a castle, lines in prose');
});

test('AUDIT POI S14: a rollback is a revision of its own - no document, the revision put back its base, the approver its author and reviewer, approved; a withdrawn retirement is \'withdrawn\', with no note in any one language (mutants: the rollback\'s base unrecorded; a withdrawn retirement a rejection)', async () => {
  const { req, upload, dev, mapper, mac, draft, submit, approve, raw } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const id = 'poi-0000000000f1';
  await draft(dev, docOf(id, m.sha, { name: 'One' })); await submit(dev, id, 1); await approve(id, 1);
  await draft(mapper, docOf(id, m.sha, { name: 'Two' }), 1); await submit(mapper, id, 2); await approve(id, 2);
  assert.deepEqual((await req('POST', '/v1/poi/rollback', { who: mac, body: { id, rev: 1 } })).json, { id, rev: 1, live: true });
  const h = (await req('GET', `/v1/poi/doc/${id}`, { who: dev })).json;
  const rb = h.revs.at(-1);
  assert.deepEqual([rb.rev, rb.kind, rb.doc, rb.base, rb.author, rb.authorId, rb.state, rb.reviewer], [3, 'rollback', null, 1, 'Mac', mac.id, 'approved', 'Mac']);
  assert.equal(h.liveRev, 1, 'the revision put back is the live one');
  const r = (await req('POST', '/v1/poi/retire', { who: mapper, body: { id } })).json;
  assert.deepEqual((await req('POST', '/v1/poi/withdraw', { who: mapper, body: { id, rev: r.rev } })).json, { id, rev: r.rev, state: 'withdrawn' });
  assert.deepEqual({ ...raw.prepare('SELECT state, note FROM poi_revs WHERE poi_id = ? AND rev = ?').get(id, r.rev) }, { state: 'withdrawn', note: null });
  assert.equal((await req('POST', '/v1/poi/retire', { who: dev, body: { id } })).json.state, 'submitted', 'and another may be asked');
});

test('AUDIT POI U13: a full shelf and an entry taken off are said in their own words - not a full day\'s uploads, not a request the service does not know; every new word of the store\'s a sentence (mutants: taken off answered not-found; a full shelf a full day)', async () => {
  const { req, upload, dev, mac } = await theStore();
  const m = await upload(dev, encodePoiMesh(quad()));
  const id = 'lib-00000000feed';
  await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf(id, m.sha) } });
  await req('POST', '/v1/poi/unshelve', { who: mac, body: { id } });
  for (const [method, path, body] of [['GET', `/v1/poi/shelf/${id}`], ['PUT', '/v1/poi/shelf', { item: entryOf(id, m.sha) }], ['POST', '/v1/poi/unshelve', { id }]]) {
    const r = await req(method, path, { who: dev, body });
    assert.deepEqual([r.status, r.json.error], [410, 'poi-gone'], `${method} ${path}`);
  }
  const server = accountRefusalText('server');
  for (const w of ['poi-changed', 'poi-drafts-full', 'poi-shelf-full', 'poi-shelf-spent', 'poi-gone']) assert.notEqual(accountRefusalText(w), server, `${w} has its sentence`);
  assert.notEqual(accountRefusalText('poi-shelf-full'), accountRefusalText('poi-quota'));
  assert.match(accountRefusalText('poi-gone'), /^That library entry has been removed\.$/);
});
