// HISTORY-OUT (the rule is in the bible's Home.md): comments say why, never the ticket, the date or the quote that made a line. The
// ratchet holds every file to tools/commentTagsBaseline.json, which only goes down; the sweep takes history out
// without touching code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanText, isTag, isHistoryLine, historyLines } from '../../tools/commentRules.mjs';
import { transform, KEEP_BYTES } from '../../tools/commentSweep.mjs';
import { measure, verdict, BASELINE } from '../../tools/commentTags.mjs';
import { sameProgram } from '../../tools/sameProgram.mjs';

const base = JSON.parse(readFileSync(new URL(`../../${BASELINE}`, import.meta.url), 'utf8'));

test('HISTORY-OUT a tag is an uppercase token with a digit or a hyphen; names and rule labels are not tags', () => {
  for (const t of ['PROF8', 'DW-C', 'FB1029d', 'EG-ZP', 'TELL6', 'WORLD6a']) assert.ok(isTag(t), t);
  for (const t of ['ARENA2', 'BAY-OWN', 'TAMRIEL-WIDE', 'HOST-SPLIT', 'UTF-8', 'D1', 'DFU', 'HUD', 'A-Z', 'MP3']) assert.ok(!isTag(t), t);
});

test('HISTORY-OUT the cleaner takes out leading tags, reference-only parentheticals and tag-only comments, and keeps the reason', () => {
  assert.equal(cleanText('TELL6 (bible/12-Enhanced-AI/Feud-Arc.md 8.1): the ring - an annulus'), 'The ring - an annulus');
  assert.equal(cleanText('BAG1: where the haul went'), 'Where the haul went');
  assert.equal(cleanText('DW-C'), '');
  assert.equal(cleanText('PIN MOVED: world295, GUILD-SHOP (the armlet)'), '');
  assert.equal(cleanText('the value (31) stays'), 'the value (31) stays', 'a number alone is data, not a reference');
  assert.equal(cleanText('rises to full ("now")'), 'rises to full ("now")', 'a quoted word is not an owner quote');
  assert.equal(cleanText('BAY-OWN: MapsFile rows are the Bay\'s'), 'BAY-OWN: MapsFile rows are the Bay\'s');
  assert.equal(cleanText('A plain reason.'), 'A plain reason.');
  assert.ok(isHistoryLine('X (2026-10-04, Mac: "a quote") y'));
  assert.ok(!isHistoryLine('the value in metres'));
});

test('HISTORY-OUT the sweep never changes code: a swept source is the same program', () => {
  const src = [
    '// PROF8 (2026-09-30, Mac: "Continue the arc") -',
    '// FISHING WITH THE NET (bible/06-Systems/',
    '// Professions-Arc.md 5.2, 6, 30). The kind in the host.',
    "import { a } from './a.js';   // BAG1: where the haul went",
    '/** TELL3 (section 5): an iron blow\'s wind-up runs longer. */',
    'export const X = a + 1;   // DW-C',
    '/**',
    ' * AUDIT ARENA-LADDER: the families, kept here',
    ' * so the relay reads a leaf.',
    ' */',
    'export function f(x) { return x * 2; }',
    '',
  ].join('\n');
  const out = transform(src);
  assert.notEqual(out, src);
  assert.equal(sameProgram(src, out).same, true);
  assert.equal(historyLines(out), 0, out);
  assert.match(out, /^\/\/ FISHING WITH THE NET\. The kind in the host\.$/m);
  assert.match(out, /^export const X = a \+ 1;$/m, 'a tag-only trailing comment goes, with its spaces');
});

test('HISTORY-OUT a file pinned byte for byte is never swept', () => {
  assert.ok(KEEP_BYTES.has('src/ai/nav/navmesh.js'));
});

test('HISTORY-OUT the ratchet: no file gains history comments, a new file has none, and a sweep lowers the baseline', () => {
  const { over, lower } = verdict(measure(), base);
  assert.deepEqual(over, [], 'comments say why, not the ticket, date or quote that made the line (HISTORY-OUT, bible/Home.md)');
  assert.deepEqual(lower, [], 'history came out - lower the baseline: node tools/commentTags.mjs --lower');
});
