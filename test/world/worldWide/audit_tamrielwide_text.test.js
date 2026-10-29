// AUDIT TAMRIEL-WIDE, lane D (2026-10-28): what the player reads past the Bay - the Features rows, the held map's sheet and
// hover, the death screen and the lines said wherever the player stands - true in every province, beside the Bay's own
// answer, and read through the text core (bible/01-Overview/audits/Audit-Tamriel-Wide.md).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as tm from '../../../src/systems/textManager.js';
import { FEATURES } from '../../../src/systems/features.js';
import { MOD_SETTINGS } from '../../../src/systems/modSettings.js';
import { sheetTitle, stripLayout } from '../../../src/ui/map/mapStrip.js';
import { tamrielHoverAt, TAMRIEL_TEXT } from '../../../src/ui/tamrielInk.js';
import { setTamrielFit, inBay } from '../../../src/world/tamriel/tamrielFrame.js';
import { setTamrielTrace, provinceKeyBeyondBay } from '../../../src/world/tamriel/tamrielLand.js';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import { CLIMATES } from '../../../src/formats/mapsFile.js';
import { SERPENT_CLAIM_TEXT } from '../../../src/net/serpent/serpentClaims.js';
import { ROOM_TALKS, SEA_NEWS } from '../../../src/systems/livingWorld/lines.js';
import { CREW_BLURBS } from '../../../src/systems/naval/crewLife.js';
import { GUILD_PRIMER_LINES } from '../../../src/ui/socialPanel.js';
import { officeText } from '../../../src/ui/naval/navalYardWindow.js';
import { sourceName } from '../../../src/ui/collections/wardrobeCatalogue.js';
import { tierBlurb } from '../../../src/ui/gambitTableWords.js';
import { eventTimerRows } from '../../../src/systems/eventTimers.js';
import { tutorialById } from '../../../src/systems/tutorials.js';
import { pastBayJourney } from '../../../src/systems/travel/pastBayTravel.js';

const ROOT = new URL('../../../', import.meta.url);
const rows = (code) => new Map(tm.parseStringTableCsv(readFileSync(new URL(`locales/${code}/Port_Strings.csv`, ROOT), 'utf8')));
/** `fn` read in `code`, its catalogue patched in; English put back after. */
function inLanguage(code, fn) {
  tm.patchLocaleTable(code, 'Port_Strings', rows(code));
  tm.setLocale(code);
  try { return fn(rows(code)); } finally { tm.setLocale('en'); tm.clearLocaleTables(code); }
}
const BAY = /\bBay\b|\bIliac\b/;

test('AUDIT TAMRIEL-WIDE D1: the Features rows for the map and the land past the Bay say what stands there - its cities, towns, roads and dungeons, reached by fast travel as a Bay place is - in the player\'s language; each row\'s online setting the player\'s, as before (mutants: a row\'s note in plain English again)', () => {
  const map = FEATURES.find((f) => f.id === 'tamriel-map'), land = FEATURES.find((f) => f.id === 'tamriel-land');
  assert.match(land.note, /its own cities, towns, roads and dungeons\./);
  assert.match(land.note, /Off ends the world at the Bay’s edge\.$/);
  assert.match(map.note, /A place past the Bay is reached by fast travel, as a place on the Bay is\.$/);
  for (const r of [map, land]) assert.doesNotMatch(r.note, /no towns|can.t travel/, `${r.id}: no word the land past the Bay outgrew`);
  // the law the map's note says (TRAVEL-EVERYWHERE): a journey past the Bay is the zone's verdict, as one on the Bay is
  assert.equal(pastBayJourney({ x: 200, y: 200 }, { x: 1500, y: -200 }, null, { ok: true }).ok, true, 'fast travel past the Bay');
  assert.equal(pastBayJourney({ x: 200, y: 200 }, { x: 1500, y: -200 }, null, { ok: false }).ok, false, 'the zone still refuses');
  assert.deepEqual([map.control.online, land.control.online], ['player', 'player'], 'the online setting unchanged - the owner\'s call');
  inLanguage('de', (de) => {
    for (const k of ['tamrielMap', 'tamrielLand']) {
      const r = FEATURES.find((f) => f.id === (k === 'tamrielMap' ? 'tamriel-map' : 'tamriel-land'));
      assert.equal(r.title, de.get(`features.${k}.title`), `${r.id}: its title in German`);
      assert.equal(r.note, de.get(`features.${k}.note`), `${r.id}: its note in German`);
    }
    assert.equal(map.effect, de.get('features.effect.nextMap'));
    assert.equal(land.effect, de.get('features.effect.worldLoads'));
  });
});

// The held map in node, the probe's way (a recording canvas, no DOM).
function heldMapDocument() {
  let ids = 0;
  const ctxOf = (canvas) => {
    const st = { globalAlpha: 1 };
    return new Proxy({}, {
      get: (_, k) => {
        if (k === 'canvas') return canvas;
        if (k === 'measureText') return (s) => ({ width: String(s).length * 6 });
        if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w?.width ?? w ?? 1) * (h ?? 1) * 4)), width: w, height: h });
        if (k === 'getLineDash') return () => [];
        return k in st ? st[k] : () => {};
      },
      set: (_, k, v) => { st[k] = v; return true; },
    });
  };
  const node = (tag) => {
    const n = { tag, id: '', children: [], style: { setProperty() {} }, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, append(...k) { n.children.push(...k); }, remove() {},
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [], className: '', textContent: '', title: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(_v) { n.children = []; }, get innerHTML() { return ''; } };
    if (tag === 'canvas') { n.id = `c${++ids}`; n.width = 300; n.height = 150; const c = ctxOf(n); n.getContext = () => c; }
    return n;
  };
  return { createElement: (t) => node(t), createTextNode: (t) => ({ textContent: t }), getElementById: () => null, head: node('head'), body: node('body'), addEventListener() {}, removeEventListener() {}, fonts: { load: () => ({ then() {} }) } };
}

test('AUDIT TAMRIEL-WIDE D3: the held map\'s world sheet is titled Tamriel where it shows the continent, and the Bay where the switch keeps it to the Bay - in the player\'s language (mutants: the window\'s flag unread; the title the Bay\'s whatever the sheet shows)', async () => {
  // the strip's own law
  assert.equal(sheetTitle('world', 'wilderness'), 'The Bay');
  assert.equal(sheetTitle('world', 'wilderness', true), 'Tamriel');
  assert.equal(sheetTitle('world', 'town', true), 'Tamriel', 'the world tab in a town, too');
  assert.equal(sheetTitle('town', 'town', true), 'Town', 'the town\'s own sheet keeps its name');
  assert.deepEqual(stripLayout({ context: 'town', ids: ['town', 'world'], live: 'world' }, { continent: true }).tabs.map((t) => t.title), ['Town', 'Tamriel']);
  // the window, a player standing in Skyrim
  const saved = { document: globalThis.document, ImageData: globalThis.ImageData, innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight, devicePixelRatio: globalThis.devicePixelRatio };
  globalThis.document = heldMapDocument();
  globalThis.ImageData = class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } };
  globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
  setTamrielTrace(null);
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  _resetForTests();
  try {
    const { HeldMapWindow } = await import('../../../src/ui/heldMap.js');
    let sk = null;
    for (let y = -400; y < 0 && !sk; y += 3) for (let x = 900; x < 1800 && !sk; x += 3) if (!inBay(x, y) && provinceKeyBeyondBay(x, y) === 'Skyrim') sk = { x, y };
    assert.ok(sk, 'a pixel of Skyrim');
    const strip = () => {
      const win = new HeldMapWindow({ getPlayerPixel: () => sk, getClimateIndex: () => CLIMATES.Mountain, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapSize: { width: 1000, height: 500 },
        gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0 });
      for (let i = 0; i < 20; i++) win.tick(0.05);
      win._paint();
      const titles = win._strip.tabs.map((t) => t.title);
      win.dispose?.();
      return titles;
    };
    assert.deepEqual(strip(), ['Tamriel'], 'the continent on the sheet: Tamriel (it said The Bay)');
    inLanguage('ru', () => assert.deepEqual(strip(), ['Тамриэль'], 'in the player\'s language'));
    setPref('tamrielMap', false);
    assert.deepEqual(strip(), ['The Bay'], 'the switch off: the sheet stops at the Bay, and says so');
  } finally {
    _resetForTests(); setTamrielTrace(null); setTamrielFit(null);
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});

test('AUDIT TAMRIEL-WIDE D3: a hover past the Bay names the province and the place, never "(beyond the Bay)" - a place of no province is Tamriel\'s - read through the text core (mutant: the suffix back)', () => {
  setTamrielTrace(null);
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    let sk = null;
    for (let y = -400; y < 0 && !sk; y += 3) for (let x = 900; x < 1800 && !sk; x += 3) if (!inBay(x, y) && provinceKeyBeyondBay(x, y) === 'Skyrim') sk = { x, y };
    const view = { ox: sk.x - 20, oy: sk.y - 12, scale: 12 };
    assert.deepEqual(tamrielHoverAt(sk.x + 0.5, sk.y + 0.5, view, null, null), { on: 'land', label: 'Skyrim' }, 'the land: its province');
    const placesIn = (x0, y0, x1, y1) => (sk.x >= x0 && sk.x < x1 && sk.y >= y0 && sk.y < y1 ? [{ x: sk.x, y: sk.y, type: 0, name: 'Dragon Bridge' }] : []);
    const mark = tamrielHoverAt(sk.x + 0.5, sk.y + 0.5, view, null, { placesIn, band: 'near' });
    assert.equal(mark?.on, 'mark');
    assert.match(mark.label, /^Skyrim : Dragon Bridge \([a-z ]+\)$/, `a place: its province, its name and its kind (${mark?.label})`);
    assert.doesNotMatch(mark.label, BAY);
    assert.equal(TAMRIEL_TEXT.beyond, 'Tamriel');
    inLanguage('ja', () => {
      assert.equal(TAMRIEL_TEXT.beyond, 'タムリエル', 'the world\'s name in the player\'s language');
      assert.equal(TAMRIEL_TEXT.city('Skyrim', 'Solitude', 'town'), 'Skyrim : Solitude (town)', 'the pattern the language\'s own');
    });
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('AUDIT TAMRIEL-WIDE D4: the death screen names no place - the tale\'s end and the rise\'s line the same in Skyrim as in the Bay (mutants: the Bay back in either line)', async () => {
  const node = (tag) => { const n = { tag, children: [], style: { setProperty() {} }, dataset: {}, className: '', textContent: '', hidden: false, id: '', append(...k) { n.children.push(...k); }, after(k) { n.children.push(k); }, remove() {}, setAttribute() {}, querySelector: () => null, replaceChildren() {} }; return n; };
  const saved = globalThis.document;
  globalThis.document = { createElement: node, head: node('head'), body: node('body'), getElementById: () => null, fonts: { load: () => Promise.resolve() } };
  try {
    const { drawEnhancedDeath, removeEnhancedDeath } = await import('../../../src/ui/enhanced/enhancedDeath.js');
    const texts = (n, out = []) => { if (n?.textContent) out.push(n.textContent); for (const c of n?.children ?? []) texts(c, out); return out; };
    const lineOf = (rises) => {
      globalThis.document.body.children = [];
      drawEnhancedDeath({ goldLoss: 0, hint: 'ENTER end   F11 load', rises }, 1);
      const said = texts(globalThis.document.body);
      removeEnhancedDeath();
      return said;
    };
    const ends = lineOf(false), rises = lineOf(true);
    assert.ok(ends.includes('Your tale ends here.'), 'the tale\'s end');
    assert.ok(rises.includes('Your body falls. The world is not done with you yet.'), 'the rise\'s line');
    for (const said of [ends, rises]) assert.ok(!said.some((s) => BAY.test(s)), `no line names the Bay: ${said.join(' | ')}`);
  } finally { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
});

test('AUDIT TAMRIEL-WIDE D5: the travel map\'s page promises a journey to any place, past the Bay too (TRAVEL-EVERYWHERE); the arena\'s names its one city, as TUT1 allows (mutants: the travel line kept to the Bay; the arena line as it was)', () => {
  const travel = tutorialById('travel-map').body.join(' '), arena = tutorialById('arena').body.join(' ');
  assert.match(travel, /opens the map of the whole land\. Choose a place to travel there\./);
  assert.doesNotMatch(travel, /Past the Bay|in the Iliac Bay/, 'no journey kept to the Bay');
  assert.doesNotMatch(arena, /province's capital/, 'one arena, not one a province');
  assert.match(arena, /^The one arena stands in the westernmost of the Iliac Bay's three crown cities\./);
});

test('AUDIT TAMRIEL-WIDE D6: the lines said wherever the player stands name no Bay - the serpent\'s, the taverns\', the sea\'s news, the crew\'s, the guild primer\'s, the Admiralty\'s carrack, the wardrobe, the card table, the raids and the sea fight (mutants: each line as it was)', () => {
  const boss = { name: 'Vharos' };
  const said = [
    ['the serpent\'s record', SERPENT_CLAIM_TEXT.recorded(2, 0, boss)], ['the serpent\'s title', SERPENT_CLAIM_TEXT.title()],
    ...Object.values(ROOM_TALKS).flat(2).map((l) => ['a room\'s talk', l]), ...Object.values(SEA_NEWS).flat(2).map((l) => ['the sea\'s news', l]),
    ...CREW_BLURBS.calm.map((l) => ['the crew', l]), ...GUILD_PRIMER_LINES.map((l) => ['the guild primer', l]),
    ['the carrack', officeText({ port: 'Solitude', crown: 'Skyrim', rank: 'Commodore', standing: 90, admiralty: { open: true, can: true, price: '1 gold' } }).letters.find((l) => l.id === 'admiralty').words],
    ['the wardrobe', sourceName('world')], ['the card table', tierBlurb('grandmaster')],
    ['the raids\' timer', eventTimerRows({ now: 0, region: 'Skyrim', raids: [1, 2, 3].map((i) => ({ name: `T${i}`, region: 'Elsewhere', type: 'orcs', startMs: i * 60_000, endMs: (i + 10) * 60_000 })) }).find((r) => r.id === 'raids:elsewhere').detail],
    ['the raids\' mod row', MOD_SETTINGS['world-events-raiding-parties'].keys.Enabled.description],
    ['the sea fight\'s row', FEATURES.find((f) => f.id === 'naval-combat').note],
  ];
  const named = said.filter(([, s]) => BAY.test(s)).map(([who, s]) => `${who}: ${s}`);
  assert.deepEqual(named, []);
  assert.equal(said.find(([w]) => w === 'the raids\' timer')[1], '2 more today across Tamriel');
});
