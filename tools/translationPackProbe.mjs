// L10N3b (2026-09-27): A REAL DFU TRANSLATION PACK, INSTALLED THROUGH THE SETTINGS ROW, IN A REAL BROWSER.
//
// test/l10n3b.test.js runs the store and the loader over an in-memory IndexedDB; this installs a pack the way a player
// does - the Translation pack row's Install, its folder picked (then its .zip) - into Chromium's own IndexedDB, and
// reads the game's tables back: the pack's Internal_Strings and Internal_RSC words live, its font registered for its
// language, all of it still there after a reload, and gone again after Remove.
//
// A pack is its authors' work under their own terms, so none ships with the port and none is committed here: point
// PACK_DIR at one on your own disk (its folder, the one holding Text/). No PACK_DIR, no run.
//     npx vite --port 5199 &
//     PACK_DIR="/path/to/French files for DFU 1.2" PACK_LANG=fr node tools/translationPackProbe.mjs
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const PACK_DIR = process.env.PACK_DIR ?? '';
const LANG = process.env.PACK_LANG ?? 'fr';
if (!PACK_DIR || !existsSync(join(PACK_DIR, 'Text'))) {
  console.log('no PACK_DIR (a DFU translation pack\'s folder, holding Text/) - nothing to install; skipped');
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// the pack's own words, read here the way DFU reads them, to compare against what the game shows
const csvValue = (file, key) => {
  const text = readFileSync(join(PACK_DIR, 'Text', file), 'utf8').replace(/^﻿/, '');
  const m = new RegExp(`(?:^|\\n)${key},((?:"[^"]*")+|[^",\\n]*)`).exec(text);
  return m ? m[1].replace(/^"|"$/g, '').replace(/""/g, '"').replace(/^[\r\n]+|[\r\n]+$/g, '') : null;
};
const wantSave = csvValue('Internal_Strings.csv', 'saveGame');

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-US' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const open = async () => {
  await page.goto(`${BASE}/play/?nointro&lang=${LANG}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  if (await page.locator('.px-acctstage').count()) await page.locator('.px-acctstage').click({ position: { x: 2, y: 2 } });
  await page.locator('.px-menu .door-settings').click();
  await page.locator('#enhanced-menu .subbtn').filter({ hasText: /^Interface/ }).first().click();
};
const tables = () => page.evaluate(async () => {
  const tm = await import('/src/systems/textManager.js');
  return {
    save: tm.tryGetLocalizedText(tm.TextCollections.Internal, 'saveGame') ?? null,
    rsc0: tm.tryGetLocalizedText(tm.TextCollections.TextRSC, '0') ?? null,
    font: tm.getLocalizedFont('FONT0003')?.family ?? null,
    pack: tm.localeInfo()?.pack?.name ?? null,
  };
});
// the pack row: the second row of the Interface pane on the front door
const packRow = () => page.locator('#enhanced-menu .row').nth(1);

await open();
check('before: the pack row offers an install', (await packRow().locator('button').count()) === 1);
check('before: no pack text in the tables', (await tables()).save === null);

// 1. THE FOLDER
await packRow().locator('button').first().click();
await page.waitForSelector('#pickassets');
await page.setInputFiles('#pickassets', PACK_DIR);
await page.waitForFunction(() => /files will be used|could not/.test(document.querySelector('#amsg')?.textContent ?? ''), null, { timeout: 60000 });
const said = await page.locator('#amsg').textContent();
check('the folder installs', /files will be used/.test(said), said);
await page.locator('#adone').click();
let t = await tables();
check('the pack\'s Internal_Strings are live', t.save === wantSave, `${t.save} / ${wantSave}`);
check('the pack\'s TEXT.RSC rows are live', !!t.rsc0 && t.rsc0.length > 20, (t.rsc0 ?? '').slice(0, 40));
check('the language knows its pack', !!t.pack, t.pack ?? 'none');
check('the pack row names it and offers a removal', (await packRow().locator('button').count()) === 2 && (await packRow().innerText()).includes(t.pack ?? '\u0000'));
const hasFont = existsSync(join(PACK_DIR, 'Fonts'));
if (hasFont) check('the pack\'s font is the one FONT0003 draws with', /dfu-pack-/.test(t.font ?? ''), t.font ?? 'none');

// 2. A RELOAD: the pack is the browser's now
await open();
t = await tables();
check('after a reload the pack is still there, loaded before the front door', t.save === wantSave && !!t.pack);

// 3. REMOVE
const oneButton = () => page.waitForFunction(() => document.querySelectorAll('#enhanced-menu .row')[1]?.querySelectorAll('button').length === 1);
await packRow().locator('button').nth(1).click();
await oneButton();
t = await tables();
check('removed: the pack\'s text is gone and the drafts stand', t.save === null && t.pack === null);

// 4. THE ZIP, as a pack is downloaded
const zipDir = mkdtempSync(join(tmpdir(), 'packprobe-'));
const zipPath = join(zipDir, 'pack.zip');
execFileSync('zip', ['-qr', zipPath, 'Text'], { cwd: PACK_DIR });
await packRow().locator('button').first().click();
await page.waitForSelector('#pickzip');
await page.setInputFiles('#pickzip', zipPath);
await page.waitForFunction(() => /files will be used|could not/.test(document.querySelector('#amsg')?.textContent ?? ''), null, { timeout: 60000 });
check('the zip installs', /files will be used/.test(await page.locator('#amsg').textContent()), await page.locator('#amsg').textContent());
await page.locator('#adone').click();
t = await tables();
check('the zip\'s Internal_Strings are live', t.save === wantSave);
await packRow().locator('button').nth(1).click();
await oneButton();

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
