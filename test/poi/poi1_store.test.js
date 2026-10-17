// POI-1 (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE POI FORMAT AND THE STORE THAT APPROVES IT.
// Mac: "POI Tool (General Map Editor) ... a tool my developers can use without having to access the codebase"; "I need
// to be able to approve changes"; "Developers + Builders".
//   - the mesh (src/poi/poiMesh.js): one layout each way, and every way a mesh is refused;
//   - the texture's header (src/poi/poiImage.js): PNG, JPEG and WebP known by their own bytes;
//   - the document (src/poi/poiLaw.js): what a POI is, and every way a draft falls short;
//   - the store (server-account/src/poi.js) on the real Worker over the real migrations: the roles, a content-addressed
//     upload, drafts, a submission, the approver's word, the live feed and its assets, a retirement and a rollback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodePoiMesh, decodePoiMesh, poiMeshError, POI_MESH_LIMITS } from '../../src/poi/poiMesh.js';
import { poiImageMetaOf } from '../../src/poi/poiImage.js';
import { poiDocProblems, poiAssetProblems, poiAssetsOf, mintPoiId, unitQuat, problemLine, DEFAULT_MATERIAL, POI_LIMITS } from '../../src/poi/poiLaw.js';
import { standService } from '../accountDb.mjs';
import { poiPathOf } from '../../server-account/src/service.js';
import { forgetPoiFeed, POI_FEED_KEEP_MS } from '../../server-account/src/poi.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** Problems as lines, `path: code`, for a regex to read. */
const lines = (ps) => ps.map(problemLine).join('\n');
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A quad of two triangles, in two submeshes - the smallest mesh with two materials. */
const quad = () => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  submeshes: [{ start: 0, count: 3 }, { start: 3, count: 3 }],
});
/** A real 1x1 PNG (one opaque white pixel). */
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));

const docOf = (id, mesh, { texture = null, name = 'The Old Watchtower' } = {}) => ({
  v: 1, id, name, about: 'A ruined tower.\nOn the hill.', tags: ['ruin'],
  place: { px: 207, py: 213, x: 400.5, z: 120, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 },
  parts: [{ key: 'tower', name: 'Tower', mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true,
    materials: [{ ...DEFAULT_MATERIAL, texture }, { ...DEFAULT_MATERIAL }] }],
  lights: [{ t: [0, 3, 0], color: [1, 0.8, 0.5], radius: 8, intensity: 1, flicker: true }],
  marker: { show: true, label: 'Old Watchtower' },
});

// ── THE FORMAT ──────────────────────────────────────────────────────

test('POI-1 MESH: encoded and decoded, the mesh is the mesh - its arrays, its runs and its bounds; u32 indices past 65,535 vertices; every refusal named (mutants: the bounds unchecked; an index past the list; a run not whole triangles)', () => {
  const m = quad();
  const bytes = encodePoiMesh(m);
  const d = decodePoiMesh(bytes);
  assert.ok('mesh' in d, d.error);
  assert.deepEqual([...d.mesh.positions], [...m.positions]);
  assert.deepEqual([...d.mesh.normals], [...m.normals]);
  assert.deepEqual([...d.mesh.uvs], [...m.uvs]);
  assert.deepEqual([...d.mesh.indices], [...m.indices]);
  assert.deepEqual(d.mesh.submeshes, m.submeshes);
  assert.deepEqual(d.mesh.boundsMin, [0, 0, 0]);
  assert.deepEqual(d.mesh.boundsMax, [1, 1, 0]);
  assert.ok(d.mesh.indices instanceof Uint16Array);
  // from an offset inside a bigger buffer, too
  const padded = new Uint8Array(bytes.byteLength + 3); padded.set(bytes, 3);
  assert.ok('mesh' in decodePoiMesh(padded.subarray(3)));
  // wide
  const V = 70000;
  const big = { positions: new Float32Array(V * 3), normals: new Float32Array(V * 3).fill(1), uvs: new Float32Array(V * 2), indices: new Uint32Array([0, 1, 69999]), submeshes: [{ start: 0, count: 3 }] };
  for (let i = 0; i < V; i++) big.positions[i * 3] = i / 1000;
  const wide = decodePoiMesh(encodePoiMesh(big));
  assert.ok('mesh' in wide && wide.mesh.indices instanceof Uint32Array && wide.mesh.indices[2] === 69999);

  assert.equal(poiMeshError({ ...quad(), indices: new Uint16Array([0, 1, 4, 0, 2, 3]) }), 'index-range');
  assert.equal(poiMeshError({ ...quad(), submeshes: [{ start: 0, count: 4 }, { start: 4, count: 2 }] }), 'submesh-run');
  assert.equal(poiMeshError({ ...quad(), submeshes: [{ start: 0, count: 3 }] }), 'submesh-run');
  assert.equal(poiMeshError({ ...quad(), submeshes: [{ start: 3, count: 3 }, { start: 0, count: 3 }] }), 'submesh-run', 'runs out of order');
  assert.equal(poiMeshError({ ...quad(), uvs: new Float32Array(6) }), 'attribute-length');
  assert.equal(poiMeshError({ ...quad(), positions: new Float32Array([0, 0, 0, NaN, 0, 0, 1, 1, 0, 0, 1, 0]) }), 'not-finite');
  assert.equal(poiMeshError({ ...quad(), positions: new Float32Array([0, 0, 0, POI_MESH_LIMITS.extent + 1, 0, 0, 1, 1, 0, 0, 1, 0]) }), 'too-large');
  assert.throws(() => encodePoiMesh({ ...quad(), indices: new Uint16Array([0, 1, 9, 0, 2, 3]) }), /index-range/);

  // bytes that lie: a bound rewritten, a wrong magic, a short file, a length the header does not account for
  const lie = new Uint8Array(bytes); new DataView(lie.buffer).setFloat32(32, 5, true);
  assert.deepEqual(decodePoiMesh(lie), { error: 'bounds' });
  const bad = new Uint8Array(bytes); bad[0] = 0;
  assert.deepEqual(decodePoiMesh(bad), { error: 'magic' });
  assert.deepEqual(decodePoiMesh(bytes.subarray(0, 20)), { error: 'short' });
  assert.deepEqual(decodePoiMesh(bytes.subarray(0, bytes.byteLength - 4)), { error: 'length' });
  const range = new Uint8Array(bytes); new DataView(range.buffer).setUint16(range.byteLength - 4, 9, true);
  assert.equal(decodePoiMesh(range).error, 'index-range');
});

test('POI-1 IMAGE: a texture known by its own header - PNG, JPEG (its first frame past the tables) and WebP (lossy, lossless, extended); anything else, or past 4096 a side, refused (mutant: an image any size)', () => {
  assert.deepEqual(poiImageMetaOf(PNG), { format: 'png', w: 1, h: 1, type: 'image/png' });
  // a JPEG: SOI, an APP0, a DHT (C4 - not a frame), then SOF0 at 640 x 480
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc4, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x01, 0xe0, 0x02, 0x80, 3, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(poiImageMetaOf(jpeg), { format: 'jpeg', w: 640, h: 480, type: 'image/jpeg' });
  const riff = (chunk, body) => Uint8Array.from([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP'), ...Buffer.from(chunk), 0, 0, 0, 0, ...body, ...new Array(16).fill(0)]);
  assert.deepEqual(poiImageMetaOf(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x00, 0x02, 0x00, 0x01])), { format: 'webp', w: 512, h: 256, type: 'image/webp' });
  // VP8L: signature 0x2f, then 14 bits w-1, 14 bits h-1
  const bits = (100 - 1) | ((50 - 1) << 14);
  assert.deepEqual(poiImageMetaOf(riff('VP8L', [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >> 24) & 255])), { format: 'webp', w: 100, h: 50, type: 'image/webp' });
  assert.deepEqual(poiImageMetaOf(riff('VP8X', [0, 0, 0, 0, 0x1f, 0x03, 0x00, 0x0f, 0x02, 0x00])), { format: 'webp', w: 800, h: 528, type: 'image/webp' });
  const huge = new Uint8Array(PNG); new DataView(huge.buffer).setUint32(16, 8192);
  assert.deepEqual(poiImageMetaOf(huge), { error: 'too-large' });
  assert.deepEqual(poiImageMetaOf(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), { error: 'not-an-image' });
  assert.deepEqual(poiImageMetaOf(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 0, 0, 0, 0, 0, 0])), { error: 'jpeg' });
});

test('POI-1 DOCUMENT: a whole POI answers no problems; every field short of the law is named by its path - the place on the map and in its pixel, a part\'s mesh, transform and materials, a light, the marker, a field the law does not know (mutant: one unread); the assets a document names, and theirs checked against what is stored', () => {
  const mesh = 'a'.repeat(64), tex = 'b'.repeat(64);
  const good = docOf(mintPoiId((b) => b.fill(7)), mesh, { texture: tex });
  assert.equal(good.id, 'poi-070707070707');
  assert.deepEqual(poiDocProblems(good), []);
  const bad = (patch) => poiDocProblems({ ...good, ...patch });
  const badL = (patch) => lines(bad(patch));
  assert.match(badL({ v: 2 }), /^v:/m);
  assert.match(badL({ id: 'poi-XYZ' }), /^id:/m);
  assert.match(badL({ name: ' padded ' }), /^name:/m);
  assert.match(badL({ name: '' }), /^name:/m);
  assert.deepEqual(bad({ about: 'two\nlines' }), []);
  assert.match(badL({ about: 'a\u0007bell' }), /^about:/m);
  assert.match(badL({ place: { ...good.place, px: 1000 } }), /^place\.px:/m);
  assert.match(badL({ place: { ...good.place, py: -1 } }), /^place\.py:/m);
  assert.match(badL({ place: { ...good.place, x: 819.2 } }), /^place\.x:/m);
  assert.match(badL({ place: { ...good.place, ground: 'float' } }), /^place\.ground:/m);
  assert.match(badL({ place: { ...good.place, r: [0, 0, 0, 2] } }), /^place\.r:/m);
  assert.match(badL({ parts: [] }), /^parts:/m);
  const part = good.parts[0];
  assert.match(badL({ parts: [part, part] }), /^parts\[1\]\.key: key-twice$/m);
  assert.match(badL({ parts: [{ ...part, mesh: 'nope' }] }), /^parts\[0\]\.mesh:/m);
  assert.match(badL({ parts: [{ ...part, s: [1, 0, 1] }] }), /^parts\[0\]\.s:/m);
  assert.deepEqual(bad({ parts: [{ ...part, s: [-1, 1, 1] }] }), [], 'a negative scale mirrors');
  assert.match(badL({ parts: [{ ...part, materials: [{ ...part.materials[0], alpha: 'glass' }, part.materials[1]] }] }), /materials\[0\]\.alpha:/);
  assert.match(badL({ parts: [{ ...part, materials: [{ ...part.materials[0], uv: { offset: [0, 0], scale: [0, 1], rotation: 0 } }, part.materials[1]] }] }), /materials\[0\]\.uv:/);
  assert.match(badL({ parts: [{ ...part, materials: [{ ...part.materials[0], shine: 1 }, part.materials[1]] }] }), /materials\[0\]\.shine: unknown/);
  assert.match(badL({ lights: [{ ...good.lights[0], radius: 0 }] }), /^lights\[0\]\.radius:/m);
  assert.match(badL({ marker: { show: 'yes' } }), /^marker\.show:/m);
  assert.match(badL({ script: 'x' }), /^script: unknown$/m);
  assert.match(badL({ about: 'x'.repeat(POI_LIMITS.docBytes) }), /^doc: too-large$/m);
  assert.deepEqual(unitQuat([0, 0, 0, 1.0004]), [0, 0, 0, 1.0004 / 1.0004]);
  assert.equal(unitQuat([0, 0, 0, 1.01]), null);

  const { meshes, textures } = poiAssetsOf(good);
  assert.deepEqual([...meshes], [mesh]);
  assert.deepEqual([...textures], [tex]);
  const facts = new Map([[mesh, { kind: 'mesh', submeshes: 2 }], [tex, { kind: 'texture', w: 1, h: 1 }]]);
  assert.deepEqual(poiAssetProblems(good, (s) => facts.get(s) ?? null), []);
  assert.deepEqual(poiAssetProblems(good, (s) => (s === mesh ? { kind: 'mesh', submeshes: 3 } : facts.get(s))), [{ path: 'parts[0].materials', code: 'material-count', have: 2, want: 3 }]);
  assert.match(lines(poiAssetProblems(good, (s) => (s === tex ? null : facts.get(s)))), /materials\[0\]\.texture: not-uploaded/);
  assert.match(lines(poiAssetProblems(good, (s) => (s === tex ? { kind: 'mesh', submeshes: 1 } : facts.get(s)))), /texture: not-a-texture/);
});

test('POI-1 PATHS: the store\'s paths matched as a save slot is - and nothing that only looks like one', () => {
  assert.deepEqual(poiPathOf('/v1/poi/live'), { route: 'live' });
  assert.deepEqual(poiPathOf(`/v1/poi/asset/${'c'.repeat(64)}`), { route: 'asset', sha: 'c'.repeat(64) });
  assert.deepEqual(poiPathOf('/v1/poi/doc/poi-0123456789ab'), { route: 'doc', id: 'poi-0123456789ab' });
  for (const p of ['/v1/poi/', '/v1/poi/asset/abc', `/v1/poi/asset/${'C'.repeat(64)}`, '/v1/poi/doc/poi-1', '/v1/poi/live/x', '/v1/poix/live']) assert.equal(poiPathOf(p), null, p);
});

// ── THE STORE ───────────────────────────────────────────────────────

async function theStore() {
  forgetPoiFeed();
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
  const upload = async (who, kind, bytes) => {
    const sha = await sha256(bytes);
    return { sha, ...(await req('PUT', `/v1/poi/asset/${sha}?kind=${kind}`, { who, raw: bytes })) };
  };
  return { ...s, mac, dev, mapper, player, req, upload };
}

test('POI-1 STORE: the roles - a guest and a player build nothing; a developer and a listed builder build; only the listed approver decides; the lists read fresh (mutants: a developer not a builder; a builder an approver)', async () => {
  const { req, mac, dev, mapper, player, guest, env } = await theStore();
  const g = await guest();
  assert.deepEqual((await req('GET', '/v1/poi/me', { who: { secret: g.secret } })).json, { handle: null, builder: false, approver: false });
  assert.deepEqual((await req('GET', '/v1/poi/me', { who: player })).json, { handle: 'Player', builder: false, approver: false });
  assert.deepEqual((await req('GET', '/v1/poi/me', { who: dev })).json, { handle: 'Dev', builder: true, approver: false });
  assert.deepEqual((await req('GET', '/v1/poi/me', { who: mapper })).json, { handle: 'Mapper', builder: true, approver: false });
  assert.deepEqual((await req('GET', '/v1/poi/me', { who: mac })).json, { handle: 'Mac', builder: true, approver: true });
  assert.equal((await req('GET', '/v1/poi/list', { who: player })).status, 403);
  assert.equal((await req('GET', '/v1/poi/queue', { who: dev })).status, 403);
  assert.equal((await req('GET', '/v1/poi/queue', { who: mac })).status, 200);
  assert.equal((await req('GET', '/v1/poi/me')).status, 401, 'no session, no answer');
  env.BUILDER_HANDLES = '';
  assert.equal((await req('GET', '/v1/poi/me', { who: mapper })).json.builder, false, 'a handle taken off the list is refused at its next call');
});

test('POI-1 STORE: an upload is named by its own hash and read as the kind it claims - a lie about the hash, a mesh that is not one, a texture that is no image, a kind that is neither refused; the same bytes twice stored once; a player uploads nothing (mutants: the hash unchecked; the mesh undecoded)', async () => {
  const { req, upload, dev, player, env } = await theStore();
  const mesh = encodePoiMesh(quad());
  const ok = await upload(dev, 'mesh', mesh);
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.meta, { submeshes: 2, vertices: 4, triangles: 2, min: [0, 0, 0], max: [1, 1, 0] });
  assert.ok(env.SAVES._map.has(`poi/a/${ok.sha}`));
  assert.equal((await upload(dev, 'mesh', mesh)).json.existed, true);
  assert.equal((await upload(dev, 'texture', PNG)).json.meta.format, 'png');
  assert.equal((await req('PUT', `/v1/poi/asset/${'0'.repeat(64)}?kind=mesh`, { who: dev, raw: mesh })).json.error, 'poi-sha-mismatch');
  const notMesh = new TextEncoder().encode('not a mesh at all, but long enough to be read as one header..');
  assert.equal((await upload(dev, 'mesh', notMesh)).json.error, 'poi-bad-mesh');
  assert.equal((await upload(dev, 'texture', notMesh)).json.error, 'poi-bad-texture');
  assert.equal((await req('PUT', `/v1/poi/asset/${ok.sha}?kind=model`, { who: dev, raw: mesh })).json.error, 'poi-kind');
  assert.equal((await upload(player, 'mesh', mesh)).status, 403);
  assert.equal((await upload(dev, 'texture', mesh)).json.error, 'poi-bad-texture', 'a mesh claimed a texture is no image');
});

test('POI-1 STORE: draft, submit, approve - the feed is live revisions only: a draft and a submission stand nowhere and their assets are a builder\'s alone; approved, the POI is in the feed and its assets anyone\'s, cached a day; the feed answers 304 to the version a game holds (mutants: a draft asset public; a builder decides; the draft saved anew)', async () => {
  const { req, upload, mac, dev, player } = await theStore();
  const m = await upload(dev, 'mesh', encodePoiMesh(quad()));
  const t = await upload(dev, 'texture', PNG);
  const id = 'poi-00000000beef';
  const doc = docOf(id, m.sha, { texture: t.sha });

  // the law at the door: a document short of it, and one naming an asset never uploaded
  const short = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: { ...doc, name: '' } } });
  assert.equal(short.status, 400);
  assert.match(lines(short.json.problems), /^name: name$/m);
  const missing = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: docOf(id, 'f'.repeat(64)) } });
  assert.match(lines(missing.json.problems), /parts\[0\]\.mesh: not-uploaded/);

  const d1 = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc } });
  assert.deepEqual(d1.json, { id, rev: 1, state: 'draft' });
  const d2 = await req('PUT', '/v1/poi/draft', { who: dev, body: { doc: { ...doc, name: 'The Watchtower' } } });
  assert.deepEqual(d2.json, { id, rev: 1, state: 'draft' }, 'the author\'s open draft is saved over, not a new revision');
  assert.equal((await req('PUT', '/v1/poi/draft', { who: player, body: { doc } })).status, 403);

  const feed0 = await req('GET', '/v1/poi/live');
  assert.deepEqual(feed0.json, { v: 0, pois: [] });
  assert.equal((await req('GET', `/v1/poi/asset/${m.sha}`)).status, 404, 'a draft\'s asset is no stranger\'s');
  assert.equal((await req('GET', `/v1/poi/asset/${m.sha}`, { who: player })).status, 404, 'nor a player\'s');
  const asBuilder = await req('GET', `/v1/poi/asset/${m.sha}`, { who: dev });
  assert.equal(asBuilder.status, 200);
  assert.equal(asBuilder.res.headers.get('cache-control'), 'private, no-store');

  assert.equal((await req('POST', '/v1/poi/submit', { who: mac, body: { id, rev: 1 } })).json.error, 'poi-not-author');
  assert.deepEqual((await req('POST', '/v1/poi/submit', { who: dev, body: { id, rev: 1 } })).json, { id, rev: 1, state: 'submitted' });
  assert.equal((await req('PUT', '/v1/poi/draft', { who: dev, body: { doc } })).json.rev, 2, 'a submission is not saved over - the next save is a new draft');
  assert.deepEqual((await req('GET', '/v1/poi/live')).json.pois, [], 'a submission stands nowhere');

  const q = await req('GET', '/v1/poi/queue', { who: mac });
  assert.equal(q.json.queue.length, 1);
  assert.equal(q.json.queue[0].doc.name, 'The Watchtower');
  assert.equal(q.json.queue[0].stale, false);
  assert.equal((await req('POST', '/v1/poi/review', { who: dev, body: { id, rev: 1, verdict: 'approve' } })).status, 403);
  // PIN MOVED (AUDIT POI S1): an approval names the document the approver saw - the queue's `docSha`
  assert.deepEqual((await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'approve', note: 'Good.', docSha: q.json.queue[0].docSha } })).json, { id, rev: 1, state: 'approved' });
  assert.equal((await req('POST', '/v1/poi/review', { who: mac, body: { id, rev: 1, verdict: 'reject' } })).status, 409, 'decided once');

  const feed1 = await req('GET', '/v1/poi/live');
  assert.equal(feed1.json.v, 1);
  assert.deepEqual(feed1.json.pois.map((p) => [p.id, p.rev, p.doc.name]), [[id, 1, 'The Watchtower']]);
  const etag = feed1.res.headers.get('etag');
  assert.equal(etag, '"poi-1"');
  assert.equal((await req('GET', '/v1/poi/live', { headers: { 'if-none-match': etag } })).status, 304);
  const pub = await req('GET', `/v1/poi/asset/${t.sha}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.res.headers.get('content-type'), 'image/png');
  assert.equal(pub.res.headers.get('cache-control'), 'public, max-age=86400', 'PIN MOVED (AUDIT POI S4): a day, not immutable for a year - a live asset can stop being public');
  assert.deepEqual(new Uint8Array(await pub.res.arrayBuffer()), PNG);
});

test('POI-1 STORE: rejected with a word; a retirement asked and approved takes the POI out of the world; a rollback stands an earlier approved revision again (a retired POI too); a stale submission is flagged in the queue; withdrawn, a submission is a draft again (mutants: a second retirement asked; a rollback to a rejected revision; the stale unflagged)', async () => {
  const { req, upload, mac, dev, mapper } = await theStore();
  const m = await upload(dev, 'mesh', encodePoiMesh(quad()));
  const id = 'poi-0000000000aa';
  const save = async (who, name, base = null) => (await req('PUT', '/v1/poi/draft', { who, body: { doc: docOf(id, m.sha, { name }), base } })).json;
  const submit = async (who, rev) => (await req('POST', '/v1/poi/submit', { who, body: { id, rev } })).json;
  // PIN MOVED (AUDIT POI S1): the approver's word names the document seen, as the queue gives it
  const review = async (rev, verdict, note) => {
    const seen = (await req('GET', '/v1/poi/queue', { who: mac })).json.queue.find((x) => x.id === id && x.rev === rev);
    return (await req('POST', '/v1/poi/review', { who: mac, body: { id, rev, verdict, note, docSha: seen?.docSha ?? null } })).json;
  };
  const live = async () => { forgetPoiFeed(); return (await req('GET', '/v1/poi/live')).json; };

  await save(dev, 'First'); await submit(dev, 1); await review(1, 'approve');
  assert.deepEqual((await live()).pois.map((p) => p.doc.name), ['First']);

  // the mapper's change, made from revision 1, and the developer's, made from it too
  const a = await save(mapper, 'Mapper\'s', 1); await submit(mapper, a.rev);
  const b = await save(dev, 'Dev\'s', 1); await submit(dev, b.rev);
  await review(a.rev, 'approve');
  const q = (await req('GET', '/v1/poi/queue', { who: mac })).json.queue;
  assert.deepEqual(q.map((x) => [x.rev, x.stale]), [[b.rev, true]], 'made from a revision no longer live');
  assert.deepEqual(await review(b.rev, 'reject', 'Conflicts with the mapper\'s.'), { id, rev: b.rev, state: 'rejected' });
  assert.deepEqual((await live()).pois.map((p) => p.doc.name), ['Mapper\'s']);
  const hist = (await req('GET', `/v1/poi/doc/${id}`, { who: dev })).json;
  assert.equal(hist.revs.find((r) => r.rev === b.rev).note, 'Conflicts with the mapper\'s.');
  assert.equal(hist.liveRev, a.rev);

  // withdrawn: a draft again, saved over
  const c = await save(dev, 'Again', a.rev); await submit(dev, c.rev);
  assert.deepEqual((await req('POST', '/v1/poi/withdraw', { who: dev, body: { id, rev: c.rev } })).json, { id, rev: c.rev, state: 'draft' });
  assert.equal((await save(dev, 'Again, better', a.rev)).rev, c.rev);

  // retired
  const r = (await req('POST', '/v1/poi/retire', { who: mapper, body: { id } })).json;
  assert.equal(r.state, 'submitted');
  assert.equal((await req('POST', '/v1/poi/retire', { who: dev, body: { id } })).json.error, 'poi-pending');
  await review(r.rev, 'approve');
  assert.deepEqual((await live()).pois, [], 'retired, it stands nowhere');
  assert.equal((await req('POST', '/v1/poi/retire', { who: dev, body: { id } })).json.error, 'poi-not-live');

  // rolled back: an approved revision stands again; a rejected one never
  assert.equal((await req('POST', '/v1/poi/rollback', { who: dev, body: { id, rev: 1 } })).status, 403);
  assert.equal((await req('POST', '/v1/poi/rollback', { who: mac, body: { id, rev: b.rev } })).status, 409);
  assert.deepEqual((await req('POST', '/v1/poi/rollback', { who: mac, body: { id, rev: 1 } })).json, { id, rev: 1, live: true });
  const after = await live();
  assert.deepEqual(after.pois.map((p) => [p.rev, p.doc.name]), [[1, 'First']]);
  assert.ok(after.v >= 4, 'every approval, retirement and rollback moved the feed');
  const list = (await req('GET', '/v1/poi/list', { who: mapper })).json.pois;
  assert.equal(list[0].name, 'First');
  assert.equal(list[0].liveRev, 1);
  // PIN MOVED (AUDIT POI S14): the rollback is a revision of its own, the approver's, approved
  assert.deepEqual(list[0].revs.map((x) => [x.kind, x.state]), [['doc', 'approved'], ['doc', 'approved'], ['doc', 'rejected'], ['doc', 'draft'], ['retire', 'approved'], ['rollback', 'approved']]);
});

test('POI-1 STORE: the feed kept in the isolate - asked again inside its keep, no statement; past it, one small read, and the documents only when the version moved (mutant: the feed unkept)', async () => {
  const { env } = await theStore();
  const { poiLiveFeed } = await import('../../server-account/src/poi.js');
  let n = 0;
  const db = { prepare: (sql) => { n++; return env.DB.prepare(sql); } };
  forgetPoiFeed();
  await poiLiveFeed(db, 1000);
  assert.equal(n, 2, 'the version, and the documents');
  await poiLiveFeed(db, 1000 + POI_FEED_KEEP_MS - 1);
  assert.equal(n, 2);
  await poiLiveFeed(db, 1000 + POI_FEED_KEEP_MS + 1);
  assert.equal(n, 3, 'the version alone');
});

test('POI-1 RECORDS: the store is in the migrations, the roles in the config, its shared law in the account deploy\'s filter', () => {
  assert.match(src('server-account/migrations/0116_poi.sql'), /CREATE TABLE IF NOT EXISTS poi_revs/);
  const toml = src('server-account/wrangler.toml');
  assert.match(toml, /^APPROVER_HANDLES = "Lattymoy"$/m);
  assert.match(toml, /^BUILDER_HANDLES = ""$/m);
  const wf = src('.github/workflows/account-deploy.yml');
  for (const f of ['src/poi/poiLaw.js', 'src/poi/poiMesh.js', 'src/poi/poiImage.js']) assert.ok(wf.includes(`- "${f}"`), `${f} is not in the deploy's filter`);
});
