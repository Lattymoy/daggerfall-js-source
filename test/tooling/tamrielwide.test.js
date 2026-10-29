// TAMRIEL-WIDE (2026-10-28; the owner: "ensure our future development isnt just Daggerfall anymore and is the
// entirety of tamriel"). bible/Home.md, THE WORLD IS TAMRIEL: the code idioms that answer for the Iliac Bay alone are
// counted a file at a time by tools/tamrielWide.mjs, and held to tools/tamrielWideBaseline.json, which only goes down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { IDIOMS, BAY_OWN, BASELINE, ROOT, countIn, codeOf, measure, verdict, lowered } from '../../tools/tamrielWide.mjs';

const base = JSON.parse(readFileSync(new URL(`../../${BASELINE}`, import.meta.url), 'utf8'));
const ids = IDIOMS.map((d) => d.id);
const none = Object.fromEntries(ids.map((id) => [id, {}]));

test('TAMRIEL-WIDE each idiom is caught in the shapes the tree writes it, and the world\'s own answer is not (mutants: an idiom\'s pattern loosened or dropped; a named width, a padded mask, a difference counted)', () => {
  assert.deepEqual(ids, ['pixel-id', 'pixel-mask', 'region-count', 'bay-bound', 'bay-clamp', 'region-62']);
  const caught = {
    'pixel-id': ['const key = py * 1000 + px;', 'return mapPixelY * 1000 + mapPixelX;', 'm.get(loc.y * 1000 + loc.x)', 'const id = x + y * 1000;',
      // AUDIT TAMRIEL-WIDE II T2: bracketed, reversed, and the width by its constant's name
      'const k = (py * 1000) + px;', 'const k = px + 1000 * py;', 'const i = py * MAP_WIDTH + px;', 'a[y * BAY_W + x]',
      // AUDIT TAMRIEL-WIDE III P5/T9: the width by its other names
      'const i = 4 * (py * MAP_W + px);', 'arr[mapPixelX + (mapPixelY * MAP_W)]'],
    'pixel-mask': ['const id = loc.mapTableData.mapId & 0xfffff;', 'return (id >>> 0) & 0xFFFFF;', 'mapDict.get(id & 0x000fffff)', 'const low = mapId % 0x100000;'],
    'region-count': ['for (let r = 0; r < maps.regionCount; r++) {', 'if (region >= regionCount) return null;', 'r < (maps?.regionCount ?? 0)'],
    'bay-bound': ['if (px < 0 || px >= 1000) return;', 'py > 499', 'mapPixelX <= 999', 'x >= 1000 || y >= 500', 'p.x < 1000',
      'if (px >= MAP_WIDTH) return;', 'y < MAX_MAP_PIXEL_Y', 'if (tx >= 1000) return;', 'if (1000 <= px) return;',
      // AUDIT TAMRIEL-WIDE III P5/T9: the edge by its other names, and a bound handed to a call
      'if (px >= TP_MAP_W || py >= TP_MAP_H) return;', 'x < MAP_W', 'if (ok(px, 999) && ok(py, 499)) {', 'intIn(px, 0, 999)', '!integer(a.TemplateMapX, 999)'],
    'bay-clamp': ['const x = Math.min(999, px);', 'Math.max(0, Math.min(MAP_W - 1 - px, ix))', 'Math.min(MAP_H - 1, y)', 'const x = Math.min(px, 999);'],
    'region-62': ['if (region >= 62) return null;', 'regionIndex > 61', 'for (let r = 0; r < 62; r++) {', '!integer(a.TemplateRegionIndex, 61)'],
  };
  for (const [id, lines] of Object.entries(caught)) for (const line of lines) assert.equal(countIn(line)[id], 1, `${id}: ${line}`);
  const world = [
    'const key = worldPixelKey(px, py);', 'if (!worldPixelOk(px)) return;', 'for (const p of places.inArea(area)) {',
    'if (region < BAY_REGION_COUNT) return bayRow(region);', 'const w = 1000 * scale + x;', 'if (count >= 1000) break;',
    'const k = discoveryKeyOf(mapId);', 'const v = bits & 0xffff;', 'Math.min(width - 1, x)',
    // AUDIT TAMRIEL-WIDE II T3: a difference is no coordinate - a time, a height - and a product of two numbers no key
    'M.hits = M.hits.filter((x) => now - x < 1000);', 'if (u.y - d.y < 500) continue;', 'const t = delay * 1000 + maxJitter;', 'const ms = days * 1000 + extra;',
    // AUDIT TAMRIEL-WIDE III P5/T9: a bound handed to a call that is no coordinate, and the world's own bound
    '!integer(a.TemplateLocationIndex, 65535)', 'clamp(count, 999)', 'intIn(px, -WORLD_PX, WORLD_PX)', 'const MAP_WIDE = 5;',
  ];
  for (const line of world) assert.deepEqual(countIn(line), {}, line);
});

test('TAMRIEL-WIDE a comment is not code, and a BAY-OWN: line - on the line or the one above - is the Bay\'s own data on purpose (mutants: comments counted; the marker unread above; read above from a code line; read without its why)', () => {
  assert.deepEqual(countIn('// MapsFile\'s id is py * 1000 + px'), {});
  assert.deepEqual(countIn(' * a key of py * 1000 + px'), {});
  assert.equal(codeOf('const k = py * 1000 + px; // the Bay\'s'), 'const k = py * 1000 + px; ');
  assert.equal(codeOf('fetch(\'https://example.com\')'), 'fetch(\'https://example.com\')', 'a URL\'s slashes are no comment');
  assert.deepEqual(countIn(`const k = py * 1000 + px; // ${BAY_OWN} MapsFile's own id`), {});
  assert.deepEqual(countIn(`// ${BAY_OWN} DFU's GetMapPixelID\nreturn mapPixelY * 1000 + mapPixelX;`), {});
  assert.deepEqual(countIn(`// ${BAY_OWN} one line\nconst a = 1;\nconst k = py * 1000 + px;`), { 'pixel-id': 1 }, 'the marker reaches one line, not two');
  // AUDIT TAMRIEL-WIDE II T4: a code line's marker is its own line's; a marker says why; a string is no marker
  assert.deepEqual(countIn(`foo();   // ${BAY_OWN} the save's\nconst k = py * 1000 + px;`), { 'pixel-id': 1 }, 'a code line\'s marker reaches no line below');
  assert.deepEqual(countIn(`const k = py * 1000 + px;   // ${BAY_OWN}`), { 'pixel-id': 1 }, 'a marker with no why');
  assert.deepEqual(countIn(`const s = '${BAY_OWN} the Bay'; const k = py * 1000 + px;`), { 'pixel-id': 1 }, 'a marker in a string');
});

test('TAMRIEL-WIDE the verdict: a file not in the baseline is over at its first idiom; a baseline higher than today is stale until lowered, and lowering never raises (mutants: an unlisted file let through; a lower count unread)', () => {
  assert.deepEqual(verdict({ ...none, 'pixel-id': { 'src/a.js': 1 } }, none), { over: ['pixel-id src/a.js: 1 (allowed 0)'], stale: [] });
  assert.deepEqual(verdict({ ...none, 'pixel-id': { 'src/a.js': 3 } }, { ...none, 'pixel-id': { 'src/a.js': 2 } }).over, ['pixel-id src/a.js: 3 (allowed 2)']);
  assert.deepEqual(verdict(none, { ...none, 'region-count': { 'src/b.js': 1 } }), { over: [], stale: ['region-count src/b.js: 0 (baseline 1)'] });
  assert.deepEqual(verdict({ ...none, 'bay-bound': { 'src/c.js': 2 } }, { ...none, 'bay-bound': { 'src/c.js': 2 } }), { over: [], stale: [] });
  const low = lowered({ ...none, 'pixel-id': { 'src/a.js': 2, 'src/b.js': 1 } }, { ...none, 'pixel-id': { 'src/a.js': 5 } });
  assert.deepEqual(low['pixel-id'], { 'src/a.js': 2 }, 'a.js kept at its baseline, b.js dropped at zero');
});

test('TAMRIEL-WIDE no Bay-only idiom grows: every source file is within its baseline, and a baseline a fix lowered is written lower (node tools/tamrielWide.mjs --lower)', () => {
  const { over, stale } = verdict(measure(ROOT), base);
  assert.deepEqual(over, [], 'a new Bay-only idiom - answer for every province (tools/tamrielWide.mjs names the world\'s way), or mark the Bay\'s own data BAY-OWN: with why');
  assert.deepEqual(stale, [], 'fewer Bay-only idioms - lower the baseline: node tools/tamrielWide.mjs --lower');
});

test('TAMRIEL-WIDE the baseline lists only the idioms, each file with a count above zero', () => {
  assert.deepEqual(Object.keys(base), ids);
  for (const id of ids) for (const [f, n] of Object.entries(base[id])) assert.ok(Number.isSafeInteger(n) && n > 0, `${id} ${f}`);
});

test('TAMRIEL-WIDE the law is written where a contributor reads it: Home.md, Port-Doctrine and CLAUDE.md name the rule and its gate', () => {
  for (const f of ['bible/Home.md', 'bible/01-Overview/Port-Doctrine.md', 'CLAUDE.md']) {
    const page = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    assert.match(page, /TAMRIEL-WIDE/, f);
    assert.match(page, /tamrielwide\.test\.js/, f);
  }
});
