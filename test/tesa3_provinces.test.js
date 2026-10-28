// TESA3 (2026-10-12, the owner: "Continue"; bible/03-World/Arena-Provinces.md TESA3) - THE PROVINCE'S NAME AND ITS
// PEOPLE, pinned. Past the Bay a pixel answers the province it stands on (world/tamriel/tamrielLand.js provinceKeyBeyondBay) for
// what the player READS - the loading screen, the Overworld's line, the new region's word and its edge - and for whose
// NAMES its people carry (world/tamrielPeople.js: a Nord's in Skyrim, the Imperial bank in Black Marsh by DFU's own
// Argonian law). Never a region index: every system keyed by region keeps the 62 regions' law (no chat room, bank, price
// table or service past index 61 - the sweep in the page's record).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { provinceKeyBeyondBay, setTamrielTrace, provinceKeyAt } from '../src/world/tamriel/tamrielLand.js';
import { setTamrielFit, bayToPicture } from '../src/world/tamriel/tamrielFrame.js';
import { provinceNameBank } from '../src/world/tamrielPeople.js';
import { PROVINCES } from '../src/world/tamriel/tamrielGeography.js';
import { BANK_TYPES, getNameBank, getRandomFullName, getRandomFullNameOfBank, getNameBankOfRegion } from '../src/characters/nameHelper.js';
import { srand } from '../src/formats/dfRandom.js';
import { hostText } from './hostText.mjs';   // HOST-SPLIT (at the merge of main): the world host read whole - its pixel build stands in scenes/pixelBuild.js

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });

function rectTrace(rects) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (const [id, x0, y0, x1, y1] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { land[y * w + x] = 1; province[y * w + x] = id; }
  return { w, h, land, province };
}

test('TESA3 the province past the Bay: a Bay pixel beyond the Bay answers the province its centre stands on - the trace\'s, else the authored rings\' - and the Bay\'s own pixels and the sea answer none (mutant: the Bay test, the centre)', () => {
  setTamrielFit({ ox: 400, oy: 500, ppu: 10 });
  setTamrielTrace(rectTrace([[3, 110, 20, 210, 50], [4, 210, 20, 260, 50], [1, 40, 50, 100, 100]]));   // High Rock's land under the Bay too
  assert.equal(provinceKeyAt(90.05, 75.05), 'HighRock', 'the Bay\'s pixel stands on High Rock\'s land in the picture');
  assert.equal(provinceKeyBeyondBay(800, -200), 'Skyrim');
  assert.equal(provinceKeyBeyondBay(1750, -200), 'Morrowind');
  assert.equal(provinceKeyBeyondBay(500, 250), null, 'the Bay\'s own pixel: Daggerfall\'s regions answer there');
  assert.equal(provinceKeyBeyondBay(800, -320), null, 'the sea north of Skyrim');
  // the centre decides: pixel 699's centre is picture 109.95 - the sea - though its far edge touches the land
  assert.equal(provinceKeyBeyondBay(699, -200), null);
  assert.equal(provinceKeyBeyondBay(700, -200), 'Skyrim');
  // no trace: the authored shape's own answer, as provinceKeyAt gives it
  setTamrielTrace(null); setTamrielFit(null);
  const [px, py] = [2200, -360];
  assert.equal(provinceKeyBeyondBay(px, py), provinceKeyAt(...bayToPicture(px + 0.5, py + 0.5)));
});

test('TESA3 the province\'s people: each province\'s name bank off its own race through DFU\'s GetNameBank - an Argonian\'s the Imperial bank (NameHelper.cs:50) - and the Imperial Province, which no race claims, the Imperial bank; none for no province (mutant: the Imperial arm, a race read)', () => {
  assert.deepEqual(Object.fromEntries(PROVINCES.map((p) => [p.key, provinceNameBank(p.key)])), {
    HighRock: BANK_TYPES.Breton, Hammerfell: BANK_TYPES.Redguard, Skyrim: BANK_TYPES.Nord, Morrowind: BANK_TYPES.DarkElf,
    Imperial: BANK_TYPES.Imperial, BlackMarsh: BANK_TYPES.Imperial, Elsweyr: BANK_TYPES.Khajiit, Valenwood: BANK_TYPES.WoodElf, Sumurset: BANK_TYPES.HighElf,
  });
  for (const p of PROVINCES) if (p.race) assert.equal(provinceNameBank(p.key), getNameBank(p.race), `${p.key} by GetNameBank`);
  assert.equal(provinceNameBank(null), null);
  assert.equal(provinceNameBank('Atmora'), null);
  assert.equal(getNameBank(null), BANK_TYPES.Breton, 'GetNameBank\'s own default is why the Imperial arm is the province\'s');
});

test('TESA3 the stranger\'s name: getRandomFullNameOfBank is getRandomFullName\'s own draw from a bank in hand - the same coin, the same stream - and getRandomFullName now calls it (mutant: the coin, the order)', () => {
  for (const seed of [1, 2, 3, 7, 11, 101]) {
    srand(seed);
    const region = getRandomFullName(17);
    srand(seed);
    assert.equal(getRandomFullNameOfBank(getNameBankOfRegion(17)), region, `seed ${seed}`);
  }
  srand(5);
  const nord = getRandomFullNameOfBank(BANK_TYPES.Nord);
  assert.match(nord, /sen$/, 'a Nord surname ends in -sen (NameGen.txt)');
  assert.match(read('src/characters/nameHelper.js'), /export function getRandomFullName\(regionIndex\) \{\n  return getRandomFullNameOfBank\(getNameBankOfRegion\(regionIndex \?\? -1\)\);\n\}/);
});

test('TESA3 the host: the province where the player stands (never on the Bay, at sea or past the Veil, and only where the land beyond the Bay streams) names the loading screen, the Overworld\'s line, the new region\'s word and its edge; the people\'s names - talk, strangers, quest people, the oath\'s race and the town talk\'s - come from its bank, a raid\'s pinned region naming by its region; no region index moves (mutant: a gate, a site, the pin\'s exception)', () => {
  const w = hostText('src/scenes/world.js');
  const fn = w.slice(w.indexOf('  function provinceAt(x, y) {'), w.indexOf('  const provinceHere = '));
  assert.match(fn, /if \(!tamrielLand \|\| onTheBay\(x, y\) \|\| \(etherSea && inEther\(x, y\)\)\) return null;\n\s+return provinceByKey\(provinceKeyBeyondBay\(x, y\)\);/);
  assert.match(w, /const provinceHere = \(\) => \{ const px = playerTravelPixel\(\); return provinceAt\(px\.x, px\.y\); \};/);
  assert.match(w, /const provinceBankHere = \(\) => \(_questRegionPin == null \? provinceNameBank\(provinceHere\(\)\?\.key\) : null\);\n\s+const nameBankHere = \(\) => provinceBankHere\(\) \?\? getNameBankOfRegion\(_questRegionIndex\(\)\);/);
  // what the player reads
  assert.match(w, /return locationIndex\.get\(key\)\?\.name \|\| provinceAt\(px, py\)\?\.name \|\| \(etherSea && inEther\(px, py\) \? ETHER_SEA_NAME : REGION_NAMES\[maps\.getRegionIndexAt\(px, py\)\]\) \|\| '';/, 'the loading screen');
  assert.match(w, /const region = provinceAt\(px\.x, px\.y\)\?\.name \|\| \(etherSea && inEther\(px\.x, px\.y\) \? ETHER_SEA_NAME : maps\.getRegionName\(maps\.getRegionIndexAt\(px\.x, px\.y\)\)\) \|\| '';/, 'the Overworld\'s line');
  assert.match(w, /regionName: \(\) => provinceHere\(\)\?\.name \?\? maps\.getRegionName\(_questRegionIndex\(\)\),/, 'Travel Options\' new region');
  assert.match(w, /const _region = `\$\{_questRegionIndex\(\)\}\|\$\{provinceHere\(\)\?\.key \?\? ''\}`;/, 'a province\'s edge is a region\'s');
  // whose names
  assert.match(w, /nameBankOfCurrentRegion: \(\) => nameBankHere\(\),/);
  assert.match(w, /randomFullName: \(\) => getRandomFullNameOfBank\(nameBankHere\(\)\),/);
  assert.match(w, /raceOfCurrentRegion: \(\) => \(RACE_BY_NAME_BANK\[nameBankHere\(\)\] \?\? 'Breton'\),/);
  assert.match(w, /regionIndex: \(\) => _questRegionIndex\(\),\n\s+nameBank: \(\) => provinceBankHere\(\),/, 'the town talk told');
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /const provinceBank = \(\) => \(typeof nameBank === 'function' \? nameBank\(\) : null\) \?\? null;/);
  assert.match(tt, /nameBank: provinceBank\(\) \?\? getNameBankOfRegion\(region\),/, 'the building names\' people');
  assert.match(tt, /fullName: \(gender\) => nameHelperFullName\(provinceBank\(\) \?\? getNameBankOfRegion\(regionNow\(\)\), /, 'the talk\'s %fn/%mn');
  // and no region index: the province never enters a region read
  const regionFn = w.slice(w.indexOf('  function _questRegionIndex() {'), w.indexOf('\n  }\n', w.indexOf('  function _questRegionIndex() {')));
  assert.match(regionFn, /return maps\.getRegionIndexAt\(px\.x, px\.y\);$/, 'the player\'s region index is the 62 regions\' law');
  assert.doesNotMatch(regionFn, /province/i, 'untouched by the province');
  assert.doesNotMatch(read('src/world/tamriel/tamrielLand.js'), /characters\//, 'the land module stays the worker\'s - the people live in tamrielPeople.js');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('TESA3 with ARENA2: on the player\'s own trace Winterhold\'s pixel is Skyrim\'s, Mournhold\'s country Morrowind\'s and the Bay\'s own Daggerfall none', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../src/ui/tamrielTrace.js');
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes, palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  assert.equal(provinceKeyBeyondBay(2200, -360), 'Skyrim');
  assert.equal(provinceKeyBeyondBay(3344, 535), 'Morrowind', 'Mournhold\'s own pixel (TESA2)');
  assert.equal(provinceKeyBeyondBay(207, 213), null);
});
