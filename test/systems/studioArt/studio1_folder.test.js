// STUDIO1 (2026-10-17, bible/07-Rendering/Studio-Art.md): THE STUDIO'S FOLDER - what an artist may drop in, what the
// game is served, and what they are handed to start from.
//
//   F1  the folder as it stands passes its own check - the gate every pull request that brings a picture runs - and
//       its roster names the two artists it was opened for
//   F2  the rules, on trees of the test's own: a picture in a rostered artist's folder, named for what it replaces, is
//       served; a folder the roster does not name, a file that is not a PNG, a name that names nothing, a picture past
//       the studio's limits, a slot painted twice, a stray file in the studio's own folder - each refused and said;
//       with no roster, nothing is served
//   F3  a PNG's size off its header
//   F4  the plugin: the build writes the listing beside the pictures, the dev server answers it fresh at its path and
//       passes every other ask on; each problem said
//   F5  the check decodes every picture whole, and notes a picture whose shape is not its slot's
//   F6  the slots: every model the port paints itself, each slot's key read back off its template's name, its picture
//       its size, every paint of every wagon a slot of its own; each `painted` model's host paints through wearPainted
//       (studioArt.js) and each `vendor` one stands on the texture door
//
// The trees and pictures are the test's own: no game data (Port-Doctrine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writePng } from '../../../tools/pngIO.mjs';
import {
  studioListing, studioArtIndex, studioIndexJson, pngSize, STUDIO_TREE, STUDIO_INDEX_PATH, STUDIO_MAX_SIDE, STUDIO_MAX_BYTES,
} from '../../../scripts/studioArtIndex.mjs';
import { checkStudio } from '../../../tools/studioArt.mjs';
import { studioFile, STUDIO_DIR, STUDIO_INDEX } from '../../../src/systems/studioArt/studioArt.js';
import { STUDIO_SETS, studioSlots, slotLabel } from '../../../src/systems/studioArt/studioSlots.js';
import { WAGON_ARCHIVE, LOOK_RECORDS, lookRecord, wagonArt } from '../../../src/world/wagonArt.js';
import { WAGON_OUTSIDE_LOOKS, CARAVAN_INSIDE_LOOKS } from '../../../src/systems/wagon/wagonLooks.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));   // AUDIT STUDIO1 E16: a checkout under a path with a space
const png = (w, h) => writePng({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(200) });
const ROSTER = { artists: [{ folder: 'trashBattery', name: 'trashBattery', approved: 'the test' }, { folder: 'Redclaw', name: 'Redclaw', approved: 'the test' }] };

/** A repository of the test's own: `files` path under the studio -> bytes (a string is written as text). */
function tree(files, roster = ROSTER) {
  const root = mkdtempSync(join(tmpdir(), 'studio1-'));
  const dir = join(root, STUDIO_TREE);
  mkdirSync(dir, { recursive: true });
  if (roster) writeFileSync(join(dir, 'artists.json'), typeof roster === 'string' ? roster : JSON.stringify(roster));
  for (const [path, bytes] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), bytes);
  }
  return root;
}
/** A PNG header claiming `w` x `h`, its body nothing. */
const header = (w, h) => { const b = Buffer.from(png(1, 1)); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };

test('STUDIO1 F1: the folder as it stands passes its own check, and its roster names the two artists it was opened for', async () => {
  const { listing, problems } = await checkStudio(ROOT);
  assert.deepEqual(problems, [], 'the studio\'s folder - every pull request that brings a picture runs this');
  // the two it was opened for stay on it; an artist the guide adds joins them (AUDIT STUDIO1 E14)
  for (const f of ['trashBattery', 'Redclaw']) assert.ok(listing.roster.some((a) => a.folder === f), f);
  for (const a of listing.roster) assert.ok(a.name && a.approved, `${a.folder}: a name and the word that approved them`);
  const top = readdirSync(join(ROOT, STUDIO_TREE));
  assert.ok(top.includes('README.md') && top.includes('artists.json'), 'the guide and the roster');
});

test('STUDIO1 F2: the rules - a rostered artist\'s picture named for what it replaces is served; every other file refused and said; with no roster nothing is served', () => {
  const root = tree({
    'trashBattery/wagons/38181_1-0--cart-side.png': png(64, 64),
    'trashBattery/38181_11-0.png': png(2048, 1024),
    'trashBattery/wip.psd': 'layers',
    'trashBattery/cart.png': png(4, 4),
    'stranger/38181_2-0.png': png(4, 4),
    'Redclaw/38181_1-0.png': png(4, 4),
    'Redclaw/38181_3-0.png': header(STUDIO_MAX_SIDE + 1, 64),
    'Redclaw/38181_4-0.png': 'not a picture',
    'Redclaw/38181_5-0.png': Buffer.concat([png(4, 4), Buffer.alloc(STUDIO_MAX_BYTES)]),
    'Redclaw/38181_6-0.png': header(0, 64),
    'stray.png': png(4, 4),
  });
  try {
    const { files, problems } = studioListing(root);
    assert.deepEqual(files, ['Redclaw/38181_1-0.png', 'trashBattery/38181_11-0.png'], 'the first path keeps a slot: Redclaw\'s 38181_1-0 sorts before trashBattery\'s');
    const said = (path) => problems.filter((p) => p.startsWith(`${path}:`));
    assert.match(said('trashBattery/wagons/38181_1-0--cart-side.png')[0], /Redclaw\/38181_1-0\.png already paints 38181_1-0 - one picture a slot/);
    assert.match(said('trashBattery/wip.psd')[0], /only PNG pictures/);
    assert.match(said('trashBattery/cart.png')[0], /the name says nothing the game wears/);
    assert.match(said('stranger/38181_2-0.png')[0], /"stranger" is not on the roster/);
    assert.match(said('Redclaw/38181_3-0.png')[0], new RegExp(`${STUDIO_MAX_SIDE + 1} x 64 - a side may be ${STUDIO_MAX_SIDE} at most`));
    assert.match(said('Redclaw/38181_4-0.png')[0], /not a PNG inside/);
    assert.match(said('Redclaw/38181_5-0.png')[0], /a picture may be 4 MB at most/);
    assert.match(said('Redclaw/38181_6-0.png')[0], /0 x 64/);
    assert.match(said('stray.png')[0], /holds only README\.md and artists\.json/);
    assert.equal(problems.length, 9, 'each refused file said once, and nothing else');
  } finally { rmSync(root, { recursive: true, force: true }); }
  for (const roster of [null, '{ not json', { artists: [{ folder: 'trash Battery', name: 'x', approved: 'y' }, { folder: 'Redclaw', name: 'Redclaw' }] }]) {
    const r = tree({ 'Redclaw/38181_1-0.png': png(4, 4) }, roster);
    try {
      const { files, problems } = studioListing(r);
      assert.deepEqual(files, [], `no roster that names Redclaw (${JSON.stringify(roster)}): nothing served`);
      assert.ok(problems.some((p) => p.startsWith('artists.json:')), 'and the roster\'s problem said');
    } finally { rmSync(r, { recursive: true, force: true }); }
  }
  const twice = tree({}, { artists: [{ folder: 'Redclaw', name: 'a', approved: 'b' }, { folder: 'redclaw', name: 'c', approved: 'd' }] });
  try { assert.deepEqual(studioListing(twice).problems, ['artists.json: "redclaw" twice']); } finally { rmSync(twice, { recursive: true, force: true }); }
});

test('STUDIO1 F3: a PNG\'s size off its header, and nothing off bytes that are no PNG', () => {
  assert.deepEqual(pngSize(png(37, 5)), { width: 37, height: 5 });
  assert.equal(pngSize(Buffer.from('GIF89a and more bytes than a header')), null);
  assert.equal(pngSize(Buffer.from(png(1, 1)).subarray(0, 20)), null, 'cut short');
  assert.equal(pngSize(null), null);
});

test('STUDIO1 F4: the plugin - the build writes the listing beside the pictures, the dev server answers it fresh at its path and passes every other ask on', () => {
  const root = tree({ 'Redclaw/38181_1-0.png': png(4, 4), 'Redclaw/oops.png': png(4, 4) });
  try {
    const plugin = studioArtIndex(root);
    const emitted = [], warned = [];
    plugin.generateBundle.call({ emitFile: (f) => emitted.push(f), warn: (w) => warned.push(w) });
    assert.deepEqual(emitted, [{ type: 'asset', fileName: `${STUDIO_DIR}/${STUDIO_INDEX}`, source: studioIndexJson(studioListing(root)) }]);
    assert.deepEqual(JSON.parse(emitted[0].source), { studio: 1, files: ['Redclaw/38181_1-0.png'] });
    assert.equal(warned.length, 1);
    assert.match(warned[0], /^\[studio\] Redclaw\/oops\.png:/);
    let use;
    const logged = [];
    plugin.configureServer({ middlewares: { use: (fn) => { use = fn; } }, config: { logger: { warn: (w) => logged.push(w) } } });
    assert.equal(STUDIO_INDEX_PATH, '/art/studio/index.json');
    const ask = (url) => {
      const res = { headers: {}, body: null, setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
      let passed = false;
      use({ url }, res, () => { passed = true; });
      return { res, passed };
    };
    writeFileSync(join(root, STUDIO_TREE, 'Redclaw/38181_2-0.png'), png(4, 4));   // dropped in while the server runs
    const a = ask('/art/studio/index.json?t=1');
    assert.equal(a.passed, false);
    assert.deepEqual(JSON.parse(a.res.body).files, ['Redclaw/38181_1-0.png', 'Redclaw/38181_2-0.png'], 'fresh at every ask');
    assert.equal(a.res.headers['Content-Type'], 'application/json');
    assert.equal(a.res.headers['Cache-Control'], 'no-store');
    assert.equal(logged.length, 1, 'the problem said in the log');
    for (const other of ['/art/studio/Redclaw/38181_1-0.png', '/play/index.html', '/art/studio/index.jsonx']) assert.equal(ask(other).passed, true, other);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('STUDIO1 F5: the check decodes every picture whole, and notes a picture whose shape is not its slot\'s', async () => {
  const cut = Buffer.from(png(64, 64)).subarray(0, 40);
  const root = tree({ 'Redclaw/38181_1-0.png': cut, 'Redclaw/38181_2-0.png': png(128, 64), 'Redclaw/38181_3-0.png': png(256, 256), 'Redclaw/233_5-0.png': png(9, 3) });
  try {
    const { problems, notes } = await checkStudio(root);
    assert.deepEqual(problems.map((p) => p.split(':')[0]), ['Redclaw/38181_1-0.png']);
    assert.match(problems[0], /will not decode/);
    assert.deepEqual(notes.map((n) => n.split(':')[0]), ['Redclaw/38181_2-0.png'], 'a 64 x 64 slot painted 128 x 64; 256 x 256 is its shape; Daggerfall\'s own records are not measured here');
    assert.match(notes[0], /stretched to the slot's shape/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('STUDIO1 F6: the slots - every model the port paints itself, each key read back off its template\'s name, each picture its size, every wagon paint its own slot; each painted model\'s host paints through wearPainted', async () => {
  const seen = new Set();
  for (const set of STUDIO_SETS) {
    const slots = studioSlots(set);
    assert.ok(slots.length > 0, set.id);
    for (const s of slots) {
      assert.ok(!seen.has(s.key), `${s.key} one slot`);
      seen.add(s.key);
      const back = studioFile(`trashBattery/${s.fileName}`);
      assert.equal(back?.key, s.key, `${s.fileName} reads back as its key`);
      assert.equal(back.label, slotLabel(s.name));
      assert.match(back.label, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      const p = await s.picture();
      assert.ok(p.width > 0 && p.height > 0 && p.data.length === p.width * p.height * 4, `${s.key} a picture`);
    }
  }
  const wagons = studioSlots(STUDIO_SETS.find((s) => s.id === 'wagons'));
  const want = new Set(wagonArt().map(([r]) => `${WAGON_ARCHIVE}_${r}-0`));
  for (const [list, recs] of Object.entries(LOOK_RECORDS)) {
    const n = (WAGON_OUTSIDE_LOOKS[list] ?? CARAVAN_INSIDE_LOOKS[list]).length;
    for (let i = 1; i < n; i++) for (const r of recs) want.add(`${WAGON_ARCHIVE}_${lookRecord(r, i)}-0`);
  }
  assert.deepEqual(new Set(wagons.map((s) => s.key)), want, 'every built picture and every paint\'s');
  assert.equal(wagons.find((s) => s.key === '38181_101-0').name, 'cart side boards - Red');
  assert.equal(wagons.find((s) => s.key === '38181_1-0').fileName, '38181_1-0--cart-side-boards-weathered-oak.png');
  // the doors: a painted model's host paints through wearPainted; a vendor one's stands on the texture door
  const src = (f) => readFileSync(join(ROOT, 'src', f), 'utf8');
  const DOORS = { wagons: ['scenes/horseCartPool.js', 'WAGON_ARCHIVE'], yards: ['scenes/merchantYardsHost.js', 'YARD_ARCHIVE'], port: ['scenes/portHost.js', 'PORT_ARCHIVE'], lefay: ['scenes/lefayMonumentHost.js', 'LEFAY_ARCHIVE'] };
  const STANDS = {
    galleon: ['world/ships/galleonArt.js', /addVendorTextures\(shipStandIns\(\{ archive: GALLEON_ARCHIVE,/],
    carrack: ['world/ships/carrackArt.js', /addVendorTextures\(shipStandIns\(\{ archive: CARRACK_ARCHIVE,/],
    largeboat: ['world/ships/largeBoatArt.js', /addVendorTextures\(shipStandIns\(\{ archive: LARGE_BOAT_ARCHIVE,/],
    hangings: ['world/detStandIns.js', /entries\.push\(\.\.\.townPictureEntries\(gate\)\);[\s\S]*return addVendorTextures\(entries\.map/],
  };
  for (const set of STUDIO_SETS) {
    if (set.door === 'painted') assert.match(src(DOORS[set.id][0]), new RegExp(`wearPainted\\(${DOORS[set.id][1]}, `), `${set.id}: its host asks the studio`);
    else assert.match(src(STANDS[set.id][0]), STANDS[set.id][1], `${set.id}: on the texture door's vendor tier, where the studio outranks it`);
  }
  assert.deepEqual(STUDIO_SETS.map((s) => s.id).sort(), [...Object.keys(DOORS), ...Object.keys(STANDS)].sort(), 'every set has its door');
});
