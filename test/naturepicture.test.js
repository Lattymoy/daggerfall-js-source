// AUDIT 05b A12 (FIELD BUGS 2026-10-05b): THE PICTURE A NATURE FLAT STANDS AS - ONE CHOICE, EVERY HOST'S. The town's own
// pixels (scenes/world.js), a location's flats (scenes/exterior.js) and a yard's placed tree (scenes/yardNature.js, DECOR-
// LPT's) each wrote the choice out - Low Poly Trees' far picture, else Seasons of the Iliac Bay's picture under the
// install's own key and with no mip chain, else the classic record - three copies of one rule, the yard's already short
// of the town's (THE ONE CONSTRUCTION SEAM). Now each asks world/naturePicture.js. Pinned by its answers, and by a sweep
// of the source: no host makes the choice itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { naturePicture, seasonPictureKey } from '../src/world/naturePicture.js';
import { billboardSize } from '../src/world/rmbFlats.js';

const root = new URL('..', import.meta.url).pathname;
const T = { recordCount: 32, getSize: () => ({ width: 40, height: 120 }), getScale: () => ({ width: 0, height: 0 }) };
const PLAIN = billboardSize(T, 12);
/** A host's deps: Low Poly Trees' door with a tree for `protos` (its data loading as `loads` says), Seasons of the Iliac
 *  Bay standing `season` over archive 504 (none while null), and what went up, in order. */
function host({ protos = ['504_12'], loads = true, season = null } = {}) {
  const log = [];
  const door = {
    load: async () => (loads ? {} : null),
    proto: (a, r) => (protos.includes(`${a}_${r}`) ? { a, r } : null),
    farPicture: async (p) => ({ proto: p, record: `${p.r}#lpt`, size: { w: 80, h: 160 } }),
  };
  const seasons = season == null ? null : { installedSeason: season, lookup: (a, r) => (a === 504 ? { texture: { image: { of: `${a}.${r}` } }, size: { w: 3, h: 9 } } : null) };
  return { door, seasons, renderer: { uploadTexture: (...a) => log.push(['texture', ...a]) }, uploadRecord: (...a) => log.push(['record', ...a]), log };
}

test('naturePicture: Low Poly Trees\' far picture first, where the mod stands a tree for the record - the batch\'s key and size the far picture\'s, the handle unheld (the host holds it), the flat\'s own size beside it (the season\'s while one stands); nothing uploaded (mutants: NATUREPIC-trees-after-season, NATUREPIC-plain-classic)', async () => {
  for (const season of [null, 2]) {
    const h = host({ season });
    const pic = await naturePicture(h, T, 504, 12);
    assert.deepEqual([pic.key, pic.size, pic.far?.record, pic.proto], ['12#lpt', { w: 80, h: 160 }, '12#lpt', { a: 504, r: 12 }], `season ${season}`);
    assert.deepEqual(pic.plain, season == null ? PLAIN : { w: 3, h: 9 }, 'the flat\'s own size - its lean, its cover, the far rings\' height');
    assert.deepEqual(h.log, [], 'its picture is the door\'s');
  }
});

test('naturePicture: else the season\'s picture - uploaded whole under the install\'s own key with no mip chain (AUDIT 61: the mod\'s atlas has one NEAREST level); else the record, uploaded. A door whose data will not load, a record it has no tree for, or no door at all falls through (mutants: NATUREPIC-season-mipped, NATUREPIC-season-key-shared, NATUREPIC-record-unloaded)', async () => {
  for (const h of [host({ season: 3, protos: [] }), host({ season: 3, loads: false }), { ...host({ season: 3 }), door: null }]) {
    const pic = await naturePicture(h, T, 504, 12);
    assert.deepEqual([pic.key, pic.size, pic.plain, pic.far, pic.proto], ['12#season3', { w: 3, h: 9 }, { w: 3, h: 9 }, null, null]);
    assert.deepEqual(h.log, [['texture', 504, '12#season3', { of: '504.12' }, { mips: false, variant: '' }]]);
  }
  assert.equal(seasonPictureKey(12, 3), '12#season3');
  for (const h of [host({ protos: [] }), host({ season: 3, protos: [] })]) {
    const pic = await naturePicture(h, T, 302, 4);   // an archive the mods leave alone
    assert.deepEqual([pic.key, pic.size, pic.plain, pic.sib, pic.far], [4, PLAIN, PLAIN, null, null]);
    assert.deepEqual(h.log, [['record', 302, 4]]);
  }
});

const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []));

test('THE ONE CONSTRUCTION SEAM: every host that stands a nature flat asks the one choice - the town\'s pixels, a location\'s flats, a yard\'s tree - and no file in src/ makes it for itself: none writes the season\'s key, asks which archives Low Poly Trees stands, or asks the door for a far picture (mutants: NATUREPIC-world-unwired, NATUREPIC-exterior-unwired)', () => {
  const read = (p) => readFileSync(join(root, p), 'utf8');
  assert.match(read('src/scenes/world.js'), /await naturePicture\(\{ door: lowPolyTrees, seasons: seasonsActive \? seasons : null, renderer, uploadRecord \}, t, archive, record\)/, 'the town\'s pixels: the season while the mod stands one');
  assert.match(read('src/scenes/exterior.js'), /await naturePicture\(\{ door: lowPolyTrees, seasons, renderer, uploadRecord \}, t, archive, record\)/, 'a location\'s flats');
  assert.match(read('src/scenes/yardNature.js'), /await naturePicture\(\{ door, seasons: seasonal\?\.\(\) \?\? null, renderer, uploadRecord \}, t, archive, record\)/, 'a yard\'s tree');
  const seam = 'src/world/naturePicture.js';
  for (const f of walk('src')) {
    if (f === seam) continue;
    const s = read(f);
    assert.ok(!s.includes('#season${'), `${f} writes the season's key - world/naturePicture.js seasonPictureKey`);
    assert.ok(!s.includes('LPT_ARCHIVES.includes('), `${f} asks which archives Low Poly Trees stands - world/naturePicture.js`);
    assert.ok(!/\.farPicture\(/.test(s), `${f} asks Low Poly Trees for a far picture - world/naturePicture.js`);
  }
});
