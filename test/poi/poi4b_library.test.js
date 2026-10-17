// POI-4b (2026-10-14; bible/06-Systems/POI-Editor-Arc.md) - THE LIBRARY: THE MODELS EVERY BUILDER KEEPS.
// Mac: "Allowing not just the creation of POI's using models, but also the ability to import models ... a tool my
// developers can use without having to access the codebase"; "Developers + Builders".
//   - the law (src/poi/poiLaw.js poiShelfProblems): an entry is a POI's parts and lights without a place, a picture by
//     its hash or none;
//   - the store (server-account/src/poi.js) on the real Worker over the real migrations: listed to builders, put new or
//     over one's own (an approver's, any), taken off the shelf, a builder's count bounded;
//   - its picture (src/poi/poiThumb.js): drawn in software from its parts, written as a PNG the store reads;
//   - keeping (src/poi/poiShelf.js): the law first, the picture uploaded, the entry put;
//   - the library's dialogs (src/ui/poi/poiLibraryPanel.js) over the shared fake document, and the placing that keeps an
//     entry's turns, sizes and lights (src/scenes/poiEditorHost.js).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { encodePoiMesh } from '../../src/poi/poiMesh.js';
import { poiImageMetaOf } from '../../src/poi/poiImage.js';
import { poiDocProblems, poiShelfProblems, poiAssetProblems, poiAssetsOf, mintShelfId, problemLine, DEFAULT_MATERIAL, POI_PIXEL_M } from '../../src/poi/poiLaw.js';
import { standService } from '../accountDb.mjs';
import { poiPathOf } from '../../server-account/src/service.js';
import { forgetPoiFeed, POI_SHELF_MAX } from '../../server-account/src/poi.js';
import { renderThumb, encodePng, thumbEye, POI_THUMB_SIZE } from '../../src/poi/poiThumb.js';
import { shelfEntryOf, putOnShelf } from '../../src/poi/poiShelf.js';
import { poiShelve } from '../../src/poi/poiService.js';
import { createPoiEditorPanel } from '../../src/ui/poi/poiEditorPanel.js';
import { shelfMatches, tagsOf, dataUrlOf } from '../../src/ui/poi/poiLibraryPanel.js';
import { createPoiEdit, newPart } from '../../src/poi/poiEdit.js';
import { createPoiEditorHost } from '../../src/scenes/poiEditorHost.js';
import { perspective, lookAt, mirrorProjectionX } from '../../src/world/mat4.js';
import { projectToScreen } from '../../src/player/tapRay.js';
import { quatAngleAxis } from '../../src/world/quat.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const lines = (ps) => ps.map(problemLine).join('\n');
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
/** Wait until `cond` holds - an upload hashes off the main thread, so no count of turns is sure to outlast it. */
const until = async (cond, what) => { const end = Date.now() + 10000; while (!cond()) { if (Date.now() > end) assert.fail(`never: ${what}`); await new Promise((r) => setTimeout(r, 1)); } };
const counting = () => { let n = 0; return (b) => { for (let i = 0; i < b.length; i++) b[i] = (n + i) & 255; n++; return b; }; };
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'));

/** A quad of two triangles in the z = 0 plane, its winding's (b - a) x (c - a) along `facing` (+1: +z, -1: -z). */
const quad = (facing = 1, submeshes = 1) => {
  const idx = facing > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  return {
    positions: new Float32Array([1, 0, 0, -1, 0, 0, -1, 2, 0, 1, 2, 0]),
    normals: new Float32Array([0, 0, facing, 0, 0, facing, 0, 0, facing, 0, 0, facing]),
    uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    indices: new Uint16Array(idx),
    submeshes: submeshes === 2 ? [{ start: 0, count: 3 }, { start: 3, count: 3 }] : [{ start: 0, count: 6 }],
  };
};
const part = (mesh, extra = {}) => ({ key: 'body', name: 'Body', mesh, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }], ...extra });
const entryOf = (id, mesh, extra = {}) => ({ v: 1, id, name: 'Lantern post', tags: ['light'], parts: [part(mesh)], lights: [{ t: [0, 2, 0], color: [1, 0.8, 0.5], radius: 6, intensity: 1, flicker: true }], thumb: null, ...extra });

// ── THE LAW ─────────────────────────────────────────────────────────

test('POI-4b THE LAW: a shelf entry is a POI\'s parts and lights without a place - a lib- id, no place or marker, its picture a hash or none, a picture never stored or not a picture named by its path; a POI document takes no picture (mutants: the entry\'s id read as a POI\'s; its picture unread; its picture\'s asset unchecked)', () => {
  const m = 'a'.repeat(64), pic = 'b'.repeat(64);
  assert.deepEqual(poiShelfProblems(entryOf('lib-00000000beef', m)), []);
  assert.deepEqual(poiShelfProblems(entryOf('lib-00000000beef', m, { thumb: pic })), []);
  assert.match(lines(poiShelfProblems(entryOf('poi-00000000beef', m))), /^id: id$/m, 'a POI\'s id is no entry\'s');
  assert.match(lines(poiShelfProblems(entryOf('lib-00000000beef', m, { thumb: 'nope' }))), /^thumb: texture-ref$/m);
  assert.match(lines(poiShelfProblems(entryOf('lib-00000000beef', m, { place: { px: 1 } }))), /^place: unknown$/m);
  assert.match(lines(poiShelfProblems(entryOf('lib-00000000beef', m, { marker: { show: true } }))), /^marker: unknown$/m);
  assert.match(lines(poiShelfProblems(entryOf('lib-00000000beef', m, { parts: [] }))), /^parts: parts-none$/m, 'the parts\' own law');
  assert.match(lines(poiDocProblems({ ...entryOf('poi-00000000beef', m), place: { px: 1, py: 1, x: 1, z: 1, y: 0, ground: 'snap', r: [0, 0, 0, 1], s: 1 } })), /^thumb: unknown$/m, 'a POI wears no library picture');
  assert.equal(mintShelfId(counting()), 'lib-000102030405');
  // its assets: the picture among them, and checked as a picture
  const e = entryOf('lib-00000000beef', m, { thumb: pic });
  assert.ok(poiAssetsOf(e).textures.has(pic));
  const facts = new Map([[m, { kind: 'mesh', submeshes: 1 }]]);
  assert.match(lines(poiAssetProblems(e, (s) => facts.get(s) ?? null)), /^thumb: not-uploaded$/m);
  facts.set(pic, { kind: 'mesh', submeshes: 1 });
  assert.match(lines(poiAssetProblems(e, (s) => facts.get(s) ?? null)), /^thumb: not-a-texture$/m);
  facts.set(pic, { kind: 'texture', w: 1, h: 1 });
  assert.deepEqual(poiAssetProblems(e, (s) => facts.get(s) ?? null), []);
});

// ── THE STORE ───────────────────────────────────────────────────────

async function theStore() {
  forgetPoiFeed();
  const s = await standService({ DEVELOPER_HANDLES: 'Dev', BUILDER_HANDLES: 'Mapper', APPROVER_HANDLES: 'Mac' });
  const mac = await s.registered('Mac'), dev = await s.registered('Dev'), mapper = await s.registered('Mapper'), player = await s.registered('Player');
  const req = async (method, path, { who = null, body, raw } = {}) => {
    const res = await s.fetch(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(who ? { authorization: `Bearer ${who.secret}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await res.clone().text();
    let json = null; try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, json };
  };
  const upload = async (who, kind, bytes) => {
    const sha = await sha256(bytes);
    return { sha, ...(await req('PUT', `/v1/poi/asset/${sha}?kind=${kind}`, { who, raw: bytes })) };
  };
  return { ...s, mac, dev, mapper, player, req, upload };
}

test('POI-4b THE STORE: the shelf listed to builders alone, newest change first, its triangles counted; an entry put whole or refused by the law (its assets stored, of their kinds); changed by its maker or an approver, never another builder; taken off the shelf - kept, listed no more, read no more, put over no more; a builder\'s count bounded (mutants: another builder changes it; a taken-off entry listed; the triangles uncounted; the count unbounded)', async () => {
  const { req, upload, mac, dev, mapper, player, env } = await theStore();
  assert.deepEqual(poiPathOf('/v1/poi/shelf'), { route: 'shelf' });
  assert.deepEqual(poiPathOf('/v1/poi/shelf/lib-0123456789ab'), { route: 'shelf', id: 'lib-0123456789ab' });
  assert.deepEqual(poiPathOf('/v1/poi/unshelve'), { route: 'unshelve' });
  for (const p of ['/v1/poi/shelf/poi-0123456789ab', '/v1/poi/shelf/lib-1', '/v1/poi/shelf/']) assert.equal(poiPathOf(p), null, p);

  const m = await upload(dev, 'mesh', encodePoiMesh(quad(1, 1)));
  const pic = await upload(dev, 'texture', PNG);
  assert.equal((await req('GET', '/v1/poi/shelf', { who: player })).status, 403, 'a player sees no shelf');
  assert.deepEqual((await req('GET', '/v1/poi/shelf', { who: dev })).json, { items: [] });

  // the law at the door: a POI id, and a picture never uploaded
  const wrong = await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf('poi-00000000beef', m.sha) } });
  assert.equal(wrong.status, 400);
  assert.match(lines(wrong.json.problems), /^id: id$/m);
  const noPic = await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf('lib-00000000beef', m.sha, { thumb: 'c'.repeat(64) }) } });
  assert.match(lines(noPic.json.problems), /^thumb: not-uploaded$/m);
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: player, body: { item: entryOf('lib-00000000beef', m.sha) } })).status, 403);

  const id = 'lib-00000000beef';
  assert.deepEqual((await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf(id, m.sha, { thumb: pic.sha }) } })).json.id, id);
  const second = await req('PUT', '/v1/poi/shelf', { who: mapper, body: { item: entryOf('lib-00000000cafe', m.sha, { name: 'Mapper\'s post' }) } });
  assert.equal(second.status, 200);
  const listed = (await req('GET', '/v1/poi/shelf', { who: mapper })).json.items;
  assert.deepEqual(listed.map((x) => [x.id, x.name, x.by, x.parts, x.triangles]).sort(), [[id, 'Lantern post', 'Dev', 1, 2], ['lib-00000000cafe', 'Mapper\'s post', 'Mapper', 1, 2]]);
  assert.equal(listed.find((x) => x.id === id).thumb, pic.sha);
  assert.deepEqual(listed.find((x) => x.id === id).tags, ['light']);
  const one = (await req('GET', `/v1/poi/shelf/${id}`, { who: mapper })).json;
  assert.equal(one.item.lights.length, 1, 'its lights kept');
  assert.equal(one.by, 'Dev');

  // changed by its maker; never by another builder; by an approver, any
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: mapper, body: { item: entryOf(id, m.sha, { name: 'Taken' }) } })).json.error, 'poi-not-author');
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf(id, m.sha, { name: 'Lantern post, tall' }) } })).status, 200);
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: mac, body: { item: entryOf(id, m.sha, { name: 'Lantern post (tidied)' }) } })).status, 200);
  const after = (await req('GET', '/v1/poi/shelf', { who: dev })).json.items;
  assert.equal(after[0].id, id, 'the newest change first');
  assert.equal(after[0].name, 'Lantern post (tidied)');
  assert.equal(after[0].updatedBy, 'Mac');
  assert.equal(after[0].by, 'Dev', 'still its maker\'s');

  // taken off the shelf: by its maker or an approver
  assert.equal((await req('POST', '/v1/poi/unshelve', { who: mapper, body: { id } })).json.error, 'poi-not-author');
  assert.deepEqual((await req('POST', '/v1/poi/unshelve', { who: dev, body: { id } })).json, { id, gone: true });
  assert.deepEqual((await req('GET', '/v1/poi/shelf', { who: dev })).json.items.map((x) => x.id), ['lib-00000000cafe']);
  // PIN MOVED (AUDIT POI U13): taken off is said so - `poi-gone`, 410 - not "the service does not know that request"
  assert.deepEqual([(await req('GET', `/v1/poi/shelf/${id}`, { who: dev })).status, (await req('GET', `/v1/poi/shelf/${id}`, { who: dev })).json.error], [410, 'poi-gone']);
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf(id, m.sha) } })).status, 410, 'not put back over');
  assert.equal((await req('POST', '/v1/poi/unshelve', { who: mac, body: { id: 'lib-00000000cafe' } })).status, 200, 'an approver takes any off');

  // a builder's count is bounded
  const raw = env.DB._raw;
  const devId = raw.prepare('SELECT id FROM players WHERE handle = ?').get('Dev').id;
  const ins = raw.prepare('INSERT INTO poi_shelf (id, item, name, tags, thumb, parts, triangles, by, by_name, at, updated_at, updated_by) VALUES (?, ?, ?, ?, NULL, 1, 2, ?, ?, 1, 1, ?)');
  for (let i = 0; i < POI_SHELF_MAX; i++) ins.run(`lib-${(0x100000 + i).toString(16).padStart(12, '0')}`, '{}', 'x', '[]', devId, 'Dev', 'Dev');
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: dev, body: { item: entryOf('lib-0000000f00d0', m.sha) } })).json.error, 'poi-shelf-full', 'PIN MOVED (AUDIT POI U13): a full shelf its own word, not a full day\'s uploads');
  assert.equal((await req('PUT', '/v1/poi/shelf', { who: mapper, body: { item: entryOf('lib-0000000f00d0', m.sha) } })).status, 200, 'another builder\'s own count');
});

// ── ITS PICTURE ─────────────────────────────────────────────────────

const px = (img, x, y) => { const o = (y * img.width + x) * 4; return [...img.data.subarray(o, o + 4)]; };
const drawn = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) n++; return n; };

test('POI-4b ITS PICTURE: a model drawn small from its front-right and above, framed, its background clear; a face turned away culled unless both its sides are, a mirroring size turning which side is which; a cutout\'s clear texels dropped; a picture sampled where its UVs fall; the PNG what the store reads (mutants: the facing reversed; the cut ignored; the zlib check wrong)', () => {
  const eye = thumbEye();
  assert.ok(eye.f[2] < 0 && eye.f[1] < 0, 'it looks back at the model\'s front, down');
  // a quad facing the eye: drawn, framed - its middle filled, its corners clear
  const toward = renderThumb([{ mesh: quad(1), materials: [{ color: [1, 0, 0, 1] }] }]);
  assert.equal(toward.width, POI_THUMB_SIZE);
  assert.ok(drawn(toward) > POI_THUMB_SIZE * POI_THUMB_SIZE * 0.3, `framed large (${drawn(toward)})`);
  assert.equal(px(toward, 64, 64)[3], 255);
  assert.ok(px(toward, 64, 64)[0] > 100 && px(toward, 64, 64)[1] === 0, 'its colour, lit');
  assert.equal(px(toward, 0, 0)[3], 0, 'the background clear');
  // turned away: culled; both sides: drawn; a mirroring size: the turned-away face is the front again
  assert.equal(drawn(renderThumb([{ mesh: quad(-1), materials: [{ color: [1, 0, 0, 1] }] }])), 0, 'turned away');
  assert.ok(drawn(renderThumb([{ mesh: quad(-1), materials: [{ color: [1, 0, 0, 1], twoSided: true }] }])) > 1000);
  assert.ok(drawn(renderThumb([{ mesh: quad(-1), s: [1, 1, -1], materials: [{ color: [1, 0, 0, 1] }] }])) > 1000, 'mirrored: its winding turned');
  // a picture: left half red, right half blue - both drawn; a cutout over a clear picture: nothing
  const two = { width: 2, height: 1, data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]) };
  const pic = renderThumb([{ mesh: quad(1), materials: [{ color: [1, 1, 1, 1], picture: two, wrap: ['clamp', 'clamp'] }] }]);
  let red = 0, blue = 0;
  for (let i = 0; i < pic.data.length; i += 4) { if (pic.data[i + 3] && pic.data[i] > 60 && pic.data[i + 2] < 20) red++; if (pic.data[i + 3] && pic.data[i + 2] > 60 && pic.data[i] < 20) blue++; }
  assert.ok(red > 1000 && blue > 1000, `both halves (${red}, ${blue})`);
  const clear = { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 0]) };
  assert.equal(drawn(renderThumb([{ mesh: quad(1), materials: [{ color: [1, 1, 1, 1], picture: clear, alpha: 'cutout', cutoff: 0.5 }] }])), 0);
  // nothing to draw: a clear picture, not a failure
  assert.equal(drawn(renderThumb([])), 0);
  // the PNG: read by the store's own header reader, inflated by zlib (its Adler-32 checked) to the rows, filter None
  const png = encodePng(toward);
  assert.deepEqual(poiImageMetaOf(png), { format: 'png', w: 128, h: 128, type: 'image/png' });
  const idatLen = (png[33] << 24) | (png[34] << 16) | (png[35] << 8) | png[36];
  assert.equal(String.fromCharCode(...png.subarray(37, 41)), 'IDAT');
  const rows = zlib.inflateSync(Buffer.from(png.subarray(41, 41 + idatLen)));
  assert.equal(rows.length, 128 * (128 * 4 + 1));
  assert.equal(rows[0], 0);
  assert.deepEqual([...rows.subarray(1 + 64 * 4 + 64 * (128 * 4 + 1), 1 + 64 * 4 + 64 * (128 * 4 + 1) + 4)], px(toward, 64, 64));
  for (const [at, type] of [[8, 'IHDR'], [33, 'IDAT']]) {
    const len = (png[at] << 24) | (png[at + 1] << 16) | (png[at + 2] << 8) | png[at + 3];
    const crc = ((png[at + 8 + len] << 24) | (png[at + 9 + len] << 16) | (png[at + 10 + len] << 8) | png[at + 11 + len]) >>> 0;
    assert.equal(crc, zlib.crc32(png.subarray(at + 4, at + 8 + len)), `${type}'s CRC`);
  }
});

// ── KEEPING ─────────────────────────────────────────────────────────

test('POI-4b KEEPING: an entry made from an import\'s parts is the law\'s; kept, the law asked before anything is uploaded, its picture drawn and uploaded as a texture by its name, then the entry put wearing it; a picture that will not draw leaves it without one, still kept; the store\'s refusal brings the law\'s problems back (mutants: uploaded before the law; the picture not worn; the problems dropped)', async () => {
  const sha = 'a'.repeat(64);
  const entry = shelfEntryOf({ id: 'lib-00000000beef', name: '  Old   well ', tags: ['stone', 'stone', ' well '], about: '  A well. ', parts: [{ name: 'Well', mesh: sha, submeshes: 2, t: [1, 0, 0], materials: [{ ...DEFAULT_MATERIAL, color: [0.5, 0.5, 0.5, 1] }] }], lights: [] });
  assert.deepEqual(poiShelfProblems(entry), []);
  assert.equal(entry.name, 'Old well');
  assert.deepEqual(entry.tags, ['stone', 'well']);
  assert.equal(entry.about, 'A well.');
  assert.equal(entry.parts[0].materials.length, 2, 'a material for each submesh');
  assert.deepEqual(entry.parts[0].t, [1, 0, 0]);
  const calls = [];
  const io = {
    meshOf: async () => quad(1, 2),
    pictureOf: async () => null,
    putAsset: async (bytes, kind) => { calls.push(['asset', kind, poiImageMetaOf(bytes).format]); return { ok: true, data: { sha: 'f'.repeat(64) } }; },
    shelve: async (item) => { calls.push(['shelve', item.thumb]); return { ok: true, data: { id: item.id } }; },
  };
  const bad = await putOnShelf({ ...entry, name: '' }, io);
  assert.equal(bad.ok, false);
  assert.match(lines(bad.problems), /^name: name$/m);
  assert.deepEqual(calls, [], 'nothing uploaded for an entry the law refuses');
  const ok = await putOnShelf(entry, io);
  assert.equal(ok.ok, true);
  assert.deepEqual(calls, [['asset', 'texture', 'png'], ['shelve', 'f'.repeat(64)]]);
  calls.length = 0;
  const noPicture = await putOnShelf(entry, { ...io, meshOf: async () => { throw new Error('offline'); } });
  assert.equal(noPicture.ok, true);
  assert.deepEqual(calls, [['shelve', null]]);
  // the store's refusal carries the law's problems back to the dialog
  const refused = await poiShelve({ base: 'https://svc', secret: 't', fetch: async () => ({ ok: false, status: 400, json: async () => ({ error: 'poi-doc', problems: [{ path: 'thumb', code: 'not-uploaded' }] }) }) }, entry);
  assert.deepEqual([refused.ok, refused.error, refused.problems], [false, 'poi-doc', [{ path: 'thumb', code: 'not-uploaded' }]]);
  // the panel's helpers: words matched in name, tags and maker; tags as typed
  assert.equal(shelfMatches({ name: 'Old well', tags: ['stone'], by: 'Mapper' }, 'STONE map'), true);
  assert.equal(shelfMatches({ name: 'Old well', tags: ['stone'], by: 'Mapper' }, 'stone tower'), false);
  assert.deepEqual(tagsOf('ruin,  stone , ,ruin'), ['ruin', 'stone']);
  assert.match(dataUrlOf(PNG), /^data:image\/png;base64,iVBORw0KGgo/);
});

// ── THE LIBRARY'S DIALOGS ───────────────────────────────────────────

function store() {
  const s = { asks: [], items: [], entries: new Map(), thumbs: new Map() };
  const ok = (body) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => body });
  s.fetch = async (url, init = {}) => {
    const path = url.replace('https://svc', '');
    const body = init.body === undefined ? undefined : typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    s.asks.push({ path, method: init.method ?? 'GET', body });
    if (path === '/v1/poi/shelf' && (init.method ?? 'GET') === 'GET') return ok({ items: s.items });
    const one = /^\/v1\/poi\/shelf\/(lib-[0-9a-f]{12})$/.exec(path);
    if (one) return ok({ id: one[1], item: s.entries.get(one[1]), by: 'Mapper' });
    if (path === '/v1/poi/shelf') return ok({ id: body.item.id, at: 1 });
    if (path === '/v1/poi/unshelve') return ok({ id: body.id, gone: true });
    const a = /^\/v1\/poi\/asset\/([0-9a-f]{64})\?kind=(mesh|texture)$/.exec(path);
    if (a) return ok({ sha: a[1], kind: a[2], meta: a[2] === 'mesh' ? { submeshes: 1 } : { w: 128, h: 128 }, existed: false });
    return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: 'not-found' }) };
  };
  return s;
}
const editorStub = () => {
  const e = { calls: [] };
  Object.assign(e, { mode: () => 'move', setMode() {}, space: () => 'world', setSpace() {}, snapOn: () => false, setSnap() {}, snapSteps: () => ({ move: 0.25, turn: 15, size: 0.1 }), eyeSpeed: () => 12, placeNew() {}, placeAsset: (a, n) => e.calls.push(['placeAsset', a, n]) });
  return e;
};
const all = (root) => root.querySelectorAll('*');
const button = (root, text) => all(root).find((n) => n.tagName === 'BUTTON' && n.textContent === text);

async function libraryOver(handle = 'Mapper', approver = false) {
  const meshBytes = encodePoiMesh(quad(1));
  const sha = await sha256(meshBytes);
  const svc = store();
  const assets = new Map([[sha, meshBytes], ['e'.repeat(64), PNG]]);
  const edit = createPoiEdit({ rand: counting() });
  const editor = editorStub();
  const panel = createPoiEditorPanel({
    doc: document, edit, editor, feed: { asset: async (h) => { if (!assets.has(h)) throw new Error('poi asset: 404'); return assets.get(h); } },
    io: () => ({ fetch: svc.fetch, base: 'https://svc', secret: 'tok' }), me: { handle, builder: true, approver }, onExit() {}, rand: counting(),
  });
  document.body.append(panel.root);
  panel.setOn(true);
  await flush();
  return { panel, edit, editor, svc, sha, root: panel.root };
}

test('POI-4b THE LIBRARY: the bar\'s Library lists the shelf - each entry\'s picture, name and facts - searched and narrowed to mine; Place stands its parts and lights where the next click is; Change and Take off only on mine (or an approver\'s), taking off asked twice; a POI kept from its inspector - its picture drawn and uploaded, then the entry with its parts and lights (mutants: Change offered on another\'s; taken off at the first press; the lights left behind)', async () => {
  const L = await libraryOver('Mapper');
  const lantern = entryOf('lib-00000000beef', L.sha, { thumb: 'e'.repeat(64) });
  L.svc.items = [
    { id: 'lib-00000000beef', name: 'Lantern post', tags: ['light'], thumb: 'e'.repeat(64), parts: 1, triangles: 2, by: 'Dev', at: 1, updatedAt: 2 },
    { id: 'lib-00000000cafe', name: 'Old well', tags: ['stone'], thumb: null, parts: 1, triangles: 2, by: 'mapper', at: 1, updatedAt: 1 },
  ];
  L.svc.entries.set('lib-00000000beef', lantern);
  L.svc.entries.set('lib-00000000cafe', entryOf('lib-00000000cafe', L.sha, { name: 'Old well' }));
  button(L.root, 'Library').click();
  await until(() => !!L.panel.library.items(), 'the shelf listed');
  await flush();
  const dlg = L.panel.library.dialog();
  assert.ok(dlg && L.root.contains(dlg));
  const names = () => all(dlg).filter((n) => n.className === 'dfpoi-shelf-name').map((n) => n.textContent);
  assert.deepEqual(names(), ['Lantern post', 'Old well']);
  assert.ok(all(dlg).some((n) => n.textContent === 'by Dev · 1 part · 2 triangles'));
  await until(() => all(dlg).some((n) => n.tagName === 'IMG' && /^data:image\/png;base64,/.test(n.src)), 'the lantern\'s picture shown');
  // search and mine
  const find = all(dlg).find((n) => n.tagName === 'INPUT' && n.type === 'search');
  find.value = 'stone'; find.dispatch('input', {});
  assert.deepEqual(names(), ['Old well']);
  find.value = ''; find.dispatch('input', {});
  const mineBox = all(dlg).find((n) => n.tagName === 'INPUT' && n.type === 'checkbox');
  mineBox.checked = true; mineBox.dispatch('change', {});
  assert.deepEqual(names(), ['Old well'], 'my handle in any case');
  mineBox.checked = false; mineBox.dispatch('change', {});
  // Change and Take off on mine alone
  const rowOf = (name) => all(dlg).find((n) => n.className === 'dfpoi-shelf-row' && n.textContent.includes(name));
  const btnIn = (row, text) => row.querySelectorAll('button').find((b) => b.textContent === text);
  assert.equal(btnIn(rowOf('Lantern post'), 'Change...'), undefined, 'not mine');
  assert.ok(btnIn(rowOf('Old well'), 'Change...'));
  btnIn(rowOf('Old well'), 'Take off the shelf').click();
  await flush();
  assert.equal(L.svc.asks.filter((a) => a.path === '/v1/poi/unshelve').length, 0, 'asked first');
  btnIn(rowOf('Old well'), 'Take it off the shelf?').click();
  await until(() => L.svc.asks.some((a) => a.path === '/v1/poi/unshelve'), 'taken off');
  assert.deepEqual(L.svc.asks.find((a) => a.path === '/v1/poi/unshelve').body, { id: 'lib-00000000cafe' });
  // Place: its parts and lights handed to the editor's placing
  await flush();
  btnIn(rowOf('Lantern post'), 'Place').click();
  await until(() => L.editor.calls.length > 0, 'placed');
  const [, asset] = L.editor.calls[0];
  assert.equal(asset.name, 'Lantern post');
  assert.deepEqual(asset.parts.map((p) => p.mesh), [L.sha]);
  assert.equal(asset.lights.length, 1, 'its light with it');
  assert.equal(L.panel.library.dialog(), null, 'the library closed for the click');

  // a POI kept from its inspector
  const id = L.edit.create({ px: 1, py: 1, x: 5, z: 5, name: 'Shrine' });
  L.edit.edit(id, 'add part', (d) => { d.parts.push(newPart(d, { mesh: L.sha, submeshes: 1, name: 'Altar' })); d.lights.push({ t: [0, 3, 0], color: [1, 1, 1], radius: 5, intensity: 1, flicker: false }); });
  L.edit.select({ id, part: null });
  await flush();
  button(L.root, 'Keep it in the library...').click();
  const keepDlg = L.panel.library.dialog();
  assert.ok(all(keepDlg).some((n) => n.textContent === '1 part, 1 light'));
  const nameIn = all(keepDlg).find((n) => n.tagName === 'INPUT' && n.type === 'text');
  assert.equal(nameIn.value, 'Shrine');
  const tagIn = all(keepDlg).filter((n) => n.tagName === 'INPUT' && n.type === 'text')[1];
  tagIn.value = 'holy, small';
  button(keepDlg, 'Keep it').click();
  await until(() => L.svc.asks.some((a) => a.path === '/v1/poi/shelf' && a.method === 'PUT'), 'the entry put');
  const putPic = L.svc.asks.find((a) => /^\/v1\/poi\/asset\/[0-9a-f]{64}\?kind=texture$/.test(a.path));
  assert.ok(putPic, 'its picture uploaded');
  assert.equal(poiImageMetaOf(putPic.body).format, 'png');
  const item = L.svc.asks.find((a) => a.path === '/v1/poi/shelf' && a.method === 'PUT').body.item;
  assert.match(item.id, /^lib-[0-9a-f]{12}$/);
  assert.equal(item.name, 'Shrine');
  assert.deepEqual(item.tags, ['holy', 'small']);
  assert.equal(item.thumb, putPic.path.slice('/v1/poi/asset/'.length, '/v1/poi/asset/'.length + 64));
  assert.equal(item.parts.length, 1);
  assert.equal(item.lights.length, 1, 'its lights kept with it');
  assert.deepEqual(poiShelfProblems(item), []);
  await until(() => L.panel.library.dialog() === null, 'the dialog closed');
  assert.match(all(L.root).find((n) => n.className.includes('dfpoi-status')).textContent, /Kept in the library: Shrine/);
  L.panel.destroy();
});

test('POI-4b PLACING AN ENTRY: its parts keep their own turn, size, solidity and shadow, each where it stands from the entry\'s origin, and its lights come with it - all one step (mutants: the turn dropped; the lights dropped)', () => {
  const ed = createPoiEdit({ rand: counting() });
  const W = 800, H = 600, fovY = Math.PI / 3, S = POI_PIXEL_M;
  const cam = { pos: [0, 10, -20], yaw: 0, pitch: Math.atan2(-10, 20) };
  const frame = () => {
    const f = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
    return { proj: mirrorProjectionX(perspective(fovY, W / H, 0.2, 6000)), view: lookAt(cam.pos, [cam.pos[0] + f[0], cam.pos[1] + f[1], cam.pos[2] + f[2]], [0, 1, 0]), eye: cam.pos, fovY, w: W, h: H, rect: null, canvasRect: { left: 0, top: 0, width: W, height: H } };
  };
  const editor = createPoiEditorHost({
    edit: ed, feed: { setOverlay() {} }, host: { pick: () => null, partOf: () => null }, view: frame,
    translation: (px, py, out = [0, 0, 0]) => { out[0] = (px - 10) * S; out[1] = 0; out[2] = -(py - 20) * S; return out; },
    sceneToPixel: (p) => { const px = 10 + Math.floor(p[0] / S), py = 20 - Math.floor(p[2] / S); return { px, py, x: p[0] - (px - 10) * S, z: p[2] + (py - 20) * S }; },
    groundHit: (o, d) => { if (!(d[1] < 0)) return { point: null, dist: Infinity }; const k = -o[1] / d[1]; return { point: [o[0] + d[0] * k, 0, o[2] + d[2] * k], dist: k }; },
    surfaceAt: () => 0, actionOf: () => null,
  });
  editor.enter();
  const screen = (p) => { const s = projectToScreen(p, W, H, frame().proj, frame().view); return { clientX: s.x, clientY: s.y }; };
  const turn = quatAngleAxis(90, [0, 1, 0]);
  const asset = {
    name: 'Gate', lights: [{ t: [0, 3, 1], color: [1, 0.5, 0.2], radius: 4, intensity: 2, flicker: true }],
    parts: [
      { key: 'left', name: 'Left', mesh: 'a'.repeat(64), t: [-2, 0, 0], r: turn, s: [1, 2, 1], collide: 'none', shadow: false, materials: [{ ...DEFAULT_MATERIAL }] },
      { key: 'right', name: 'Right', mesh: 'a'.repeat(64), t: [2, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], collide: 'mesh', shadow: true, materials: [{ ...DEFAULT_MATERIAL }] },
    ],
  };
  editor.placeAsset(asset, 'New place');
  editor.pointerMove(screen([4, 0, 6]), cam);
  editor.pointerDown({ ...screen([4, 0, 6]), button: 0 });
  const id = ed.ids()[0];
  const d = ed.docOf(id);
  assert.equal(d.name, 'Gate');
  assert.equal(d.parts.length, 2);
  const [l, r] = d.parts;
  assert.ok(Math.abs(Math.abs(l.r[1]) - Math.SQRT1_2) < 1e-6 && Math.abs(Math.abs(l.r[3]) - Math.SQRT1_2) < 1e-6, `its own turn kept (${l.r})`);
  assert.deepEqual(l.s, [1, 2, 1]);
  assert.deepEqual([l.collide, l.shadow, r.collide, r.shadow], ['none', false, 'mesh', true]);
  assert.ok(Math.abs(r.t[0] - l.t[0] - 4) < 1e-6, 'each where it stands from the origin');
  assert.equal(d.lights.length, 1, 'its light with it');
  assert.ok(Math.abs(d.lights[0].t[1] - l.t[1] - 3) < 1e-6 && Math.abs(d.lights[0].t[2] - l.t[2] - 1) < 1e-6, `where it stands from the origin (${d.lights[0].t} against ${l.t})`);
  assert.equal(d.lights[0].flicker, true);
  // one step: undone, the parts and the light go together
  // PIN MOVED (AUDIT POI E11): placed with no POI held, the new POI and its model are ONE step, as this section says -
  // this asserted the two the editor made (one undo took the parts and left the POI standing empty, a second took it)
  ed.undo();
  assert.equal(ed.has(id), false, 'one undo: the POI and its model gone together');
  ed.redo();
  assert.equal(ed.docOf(id).parts.length, 2);
  assert.equal(ed.docOf(id).lights.length, 1);
});

test('POI-4b RECORDS: the shelf in the migration and the routes in the service; the import keeps what it places unless told not; the inspectors keep a POI and a part', () => {
  assert.match(src('server-account/migrations/0116_poi.sql'), /CREATE TABLE IF NOT EXISTS poi_shelf \(/);
  const index = src('server-account/src/index.js');
  assert.match(index, /route === 'shelf' && request\.method === 'GET'\) return answer\(poiPath\.id \? await shelfEntry\(/);
  assert.match(index, /if \(route === 'unshelve'\) return answer\(await unshelve\(pctx, me, env, \{ id: body\.id \}\)\);/);
  const panel = src('src/ui/poi/poiEditorPanel.js');
  assert.match(panel, /const keepToo = check\(true, \(\) => \{\}\);/);
  // PIN MOVED (AUDIT POI L7): kept with the lights it read (they were left behind, `lights: []`)
  assert.match(panel, /if \(keepToo\.checked\) \{[\s\S]{0,600}await library\.keepNow\(\{ name: r\.asset\.name, parts: r\.asset\.parts, lights: r\.asset\.lights \?\? \[\], meshes \}\);/);
  assert.match(panel, /library\.keep\(\{ name: d\.name, parts: structuredClone\(d\.parts\), lights: structuredClone\(d\.lights \?\? \[\]\) \}\)/);
  assert.match(panel, /library\.keep\(\{ name: part\.name \|\| part\.key, parts: \[\{ \.\.\.structuredClone\(part\), t: \[0, 0, 0\] \}\], lights: \[\] \}\)/);
});
