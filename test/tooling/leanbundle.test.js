// The bundle's quest text and vendored manifests are lean: comment lines and author fields out, every line the game
// reads kept as it is (scripts/leanBundle.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leanQuestScript, leanQuestTable, leanQuestText, leanManifest } from '../../scripts/leanBundle.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const txt = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.txt')).map((f) => `${dir}/${f}`);
const OUTSIDE = /Daggerfall Unity|Interkarma|\bDFU\b|[Nn]exus/;

/** A script's QRC: from its `QRC:` line to its `QBN:` line, as the parser cuts it. */
const qrcOf = (text) => {
  const lines = text.split('\n');
  const from = lines.findIndex((l) => l.trim().toLowerCase().startsWith('qrc:'));
  const to = lines.findIndex((l) => l.trim().toLowerCase().startsWith('qbn:'));
  return lines.slice(from, to).join('\n');
};
const codeLines = (text) => text.split('\n').filter((l) => !l.trim().startsWith('-'));

test('a quest script: its header and QBN lose their comment lines, its QRC keeps every byte - a `-` line there ends a message', () => {
  const script = ['-- by someone', 'Quest: T', 'QRC:', 'Message: 1', 'a', '', '-- ends it', 'more', 'QBN:', '-- note', 'Item _x_ gold'].join('\n');
  assert.equal(leanQuestScript(script), ['Quest: T', 'QRC:', 'Message: 1', 'a', '', '-- ends it', 'more', 'QBN:', 'Item _x_ gold'].join('\n'));
  const files = [...txt('vendor/dfu-quests/Quests'), ...txt('src/systems/quest/own')];
  assert.ok(files.length > 250, `${files.length} scripts`);
  for (const f of files) {
    const text = read(f), lean = leanQuestText(f, text);
    assert.equal(qrcOf(lean), qrcOf(text), `${f}: the QRC as written`);
    assert.deepEqual(codeLines(lean), codeLines(text), `${f}: every line the parser reads, in order`);
  }
});

test('a quest table: its comment lines go and its rows stay; no table names an outside author or site', () => {
  const tables = txt('vendor/dfu-quests/Tables');
  for (const f of tables) {
    const text = read(f), lean = leanQuestTable(text);
    const rows = (t) => codeLines(t).map((l) => l.split(',').slice(0, 5).join(','));
    assert.deepEqual(rows(lean), rows(text), `${f}: every row's fields the game reads`);
    assert.doesNotMatch(lean, OUTSIDE, `${f}: lean`);
  }
});

test('a vendored manifest loses its author, contact and download page and keeps the rest', () => {
  const manifest = JSON.parse(read('vendor/grimoire-ui/grimoire-ui.files.json'));
  const lean = leanManifest(manifest);
  for (const k of ['ModAuthor', 'ModContactInfo', 'Source']) assert.ok(!(k in lean), k);
  assert.deepEqual(lean.Files, manifest.Files, 'the files the pack is drawn from');
  assert.equal(lean.ModVersion, manifest.ModVersion);
  assert.doesNotMatch(JSON.stringify(lean), OUTSIDE);
  assert.deepEqual(leanManifest([1, 2]), [1, 2], 'a list is data, not a manifest');
});

test('the build wears it', () => {
  assert.match(read('vite.config.js'), /import \{ leanBundlePlugin \} from '\.\/scripts\/leanBundle\.mjs';/);
  assert.match(read('vite.config.js'), /licenceFiles\(\), leanBundlePlugin\(\)\]/);
  assert.match(read('vite.config.js'), /worker: \{ plugins: \(\) => \[leanBundlePlugin\(\)\] \}/, 'and the workers, built apart');
  assert.doesNotMatch(read('src/systems/uiPack.js'), /ModAuthor|manifest\.Source/, 'the pack record names no author');
});
