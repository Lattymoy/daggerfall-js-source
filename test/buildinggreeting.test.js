// BG1 - THE BUILDING GREETING: what kind of shop, and who lives here.
//
// PlayerActivate.cs:585-628 + PresentShopQuality (:1332-1391). Open a
// shop door in classic and it tells you what you walked into; open a
// stranger's front door and someone greets you. The port did neither.
//
// THE GATE IS TWO VARIABLES ANSWERING DIFFERENT QUESTIONS (:517-518):
//
//     var isBrokenIn = isBash;                      // bashing IS breaking in
//     if (!buildingUnlocked && !isBash && HandleOpenEffectOnExteriorDoor(...))
//         buildingUnlocked = isBrokenIn = true;     // the Open SPELL sets BOTH
//     ... a successful PICK sets isBrokenIn ALONE
//
//     if (buildingUnlocked && House1..House4 && !TG && !DB && !IsHouseOwned)
//     {
//         if (!isBrokenIn) mb = MessageBox(GetRandomText(256));
//     }
//     else mb = PresentShopQuality(building);
//
// The `!isBrokenIn` test is INSIDE the house branch, not beside it, so
// failing it does not fall through to the shop arm. That nesting is
// what makes the four outcomes below differ, and it is the single most
// mutable line in the member.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIVE } from '../src/systems/settings.js';
import { NUMBER_LAW } from '../src/ui/settingsLaw.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildingGreeting, shopQualityTextId, shopQualityPresentation,
  isGreetingHouse, HOUSE_GREETING_TEXT_ID,
} from '../src/systems/buildingGreeting.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const HOUSE = BUILDING_TYPES.House2;
const SHOP = BUILDING_TYPES.GeneralStore;

test('BG1: the quality bands are DFU\'s manual thresholds, not quality/4', () => {
  // DFU's own note: "UESP states this is building quality / 4 but
  // Daggerfall uses manual thresholds" - and 3/7/13/17 are not four
  // apart, which is exactly why the division would be wrong.
  for (const q of [1, 2, 3]) assert.equal(shopQualityTextId(q), 270);
  for (const q of [4, 7]) assert.equal(shopQualityTextId(q), 269);
  for (const q of [8, 13]) assert.equal(shopQualityTextId(q), 268);
  for (const q of [14, 17]) assert.equal(shopQualityTextId(q), 267);
  for (const q of [18, 20]) assert.equal(shopQualityTextId(q), 266);
  // every boundary, both sides
  assert.notEqual(shopQualityTextId(3), shopQualityTextId(4));
  assert.notEqual(shopQualityTextId(7), shopQualityTextId(8));
  assert.notEqual(shopQualityTextId(13), shopQualityTextId(14));
  assert.notEqual(shopQualityTextId(17), shopQualityTextId(18));
});

test('BG1: House1..House4 alone are greeted', () => {
  assert.equal(isGreetingHouse(BUILDING_TYPES.House1), true);
  assert.equal(isGreetingHouse(BUILDING_TYPES.House4), true);
  assert.equal(isGreetingHouse(BUILDING_TYPES.House5), false, 'House5 is outside the band');
  assert.equal(isGreetingHouse(BUILDING_TYPES.House6), false);
  assert.equal(isGreetingHouse(SHOP), false);
});

test('BG1: walked in during open hours - the householder greets you', () => {
  const g = buildingGreeting({ buildingType: HOUSE, buildingUnlocked: true, isBrokenIn: false });
  assert.deepEqual(g, { kind: 'house', textId: HOUSE_GREETING_TEXT_ID });
});

test('BG1: the OPEN SPELL silences a HOUSE and only a house', () => {
  // buildingUnlocked true (so the outer branch is taken for a house)
  // AND isBrokenIn true (so the greeting inside it does not fire), and
  // because the test is NESTED there is no fall-through to the shop
  // arm. A house you magicked your way into says nothing.
  assert.equal(buildingGreeting({ buildingType: HOUSE, buildingUnlocked: true, isBrokenIn: true }), null);
  // A SHOP is a different story, and the draft of this pin got it
  // wrong before the code did: a shop is not House1..House4, so the
  // OUTER test fails whatever isBrokenIn says, the else-arm runs, and
  // PresentShopQuality speaks. isBrokenIn gates the greeting alone.
  assert.deepEqual(
    buildingGreeting({ buildingType: SHOP, buildingUnlocked: true, isBrokenIn: true, isShop: true, quality: 20 }),
    { kind: 'shopQuality', textId: 266 },
    'a shop states its quality even to someone who magicked the lock');
});

test('BG1: a PICKED lock leaves buildingUnlocked false, so the shop still states its quality', () => {
  // the pick raises isBrokenIn alone (:557), so the else-arm runs
  const shop = buildingGreeting({ buildingType: SHOP, buildingUnlocked: false, isBrokenIn: true, isShop: true, quality: 20 });
  assert.deepEqual(shop, { kind: 'shopQuality', textId: 266 });
  // a house you picked says nothing - PresentShopQuality answers null
  // off a non-shop (:1350-1351)
  assert.equal(buildingGreeting({ buildingType: HOUSE, buildingUnlocked: false, isBrokenIn: true, isShop: false }), null);
});

test('BG1: the nesting - a suppressed greeting does NOT fall through to the shop arm', () => {
  // `if (!isBrokenIn) mb = ...` sits INSIDE the house branch. Written
  // as a fall-through (`if (!isBrokenIn) return house;` with the shop
  // arm below) it is equivalent for every input the host can produce -
  // a house is never a shop, so the fall-through lands on the same
  // null - which is exactly why the campaign's mutant survived the
  // first pass. What the nesting actually guarantees is the CONTRACT:
  // once the house branch is taken, the shop arm is unreachable, for
  // any arguments at all.
  assert.equal(
    buildingGreeting({ buildingType: HOUSE, buildingUnlocked: true, isBrokenIn: true, isShop: true, quality: 20 }),
    null, 'the house branch is terminal - isShop cannot rescue it');
  assert.deepEqual(
    buildingGreeting({ buildingType: HOUSE, buildingUnlocked: true, isBrokenIn: false, isShop: true, quality: 20 }),
    { kind: 'house', textId: HOUSE_GREETING_TEXT_ID }, 'and the greeting still wins over it');
});

test('BG1: a LOCKED building is not greeted at all', () => {
  // buildingUnlocked is the first term of the outer test, and nothing
  // else in the member can stand in for it.
  assert.equal(buildingGreeting({ buildingType: HOUSE, buildingUnlocked: false, isBrokenIn: false }), null);
  // and a locked SHOP falls to the else-arm, which still speaks - the
  // term gates the HOUSE branch, not the whole member
  assert.deepEqual(
    buildingGreeting({ buildingType: SHOP, buildingUnlocked: false, isBrokenIn: false, isShop: true, quality: 2 }),
    { kind: 'shopQuality', textId: 270 });
});

test('BG1: your own house, the Thieves Guild and the Dark Brotherhood are not greeted', () => {
  const base = { buildingType: HOUSE, buildingUnlocked: true, isBrokenIn: false };
  assert.equal(buildingGreeting({ ...base, houseOwned: true }), null);
  assert.equal(buildingGreeting({ ...base, factionId: 42 }), null, 'The_Thieves_Guild');
  assert.equal(buildingGreeting({ ...base, factionId: 108 }), null, 'The_Dark_Brotherhood');
  // and each falls to the ELSE arm, which for a house is null but for
  // a TG SHOP front would be the quality line
  assert.deepEqual(
    buildingGreeting({ ...base, factionId: 42, isShop: true, quality: 5 }),
    { kind: 'shopQuality', textId: 269 });
});

test('BG1: an open shop states its quality; anything that is not a shop says nothing', () => {
  assert.deepEqual(
    buildingGreeting({ buildingType: SHOP, buildingUnlocked: true, isShop: true, quality: 10 }),
    { kind: 'shopQuality', textId: 268 });
  assert.equal(buildingGreeting({ buildingType: BUILDING_TYPES.Temple, buildingUnlocked: true, isShop: false }), null);
});

test('BG1: ShopQualityPresentation - 0 popup, 1 HUD, everything else nothing', () => {
  assert.equal(shopQualityPresentation(0), 'popup');
  assert.equal(shopQualityPresentation(1), 'hud');
  assert.equal(shopQualityPresentation(2), 'none');
  assert.equal(shopQualityPresentation(7), 'none', 'DFU\'s `default` arm');
  // and with no argument it reads the store, which is where DFU reads
  // it - inside PresentShopQuality, not at the door
  assert.equal(shopQualityPresentation(), 'popup', 'the vendored default is 0');
});

test('BG1: the door arm carries DFU\'s two variables and DEFERS behind the box', () => {
  const wm = read('src/scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf('let isBrokenIn = false;'), wm.indexOf('return enterInteriorCore(hit, entries);'));
  // the Open spell raises BOTH; the pick raises only isBrokenIn
  assert.match(arm, /opened = r\.opened;\n\s*if \(r\.opened\) isBrokenIn = true;/,
    'buildingUnlocked = isBrokenIn = true');
  const pick = arm.indexOf('isBrokenIn = true;   // :557');
  assert.ok(pick > 0, 'the pick raises isBrokenIn');
  assert.equal(arm.slice(pick - 400, pick).includes('opened = true'), false,
    'and never raises buildingUnlocked - that is what keeps the shop arm reachable after a pick');
  // the box defers the transition
  assert.match(arm, /townTalk\.showOverlay\(new ChoiceWindow\(\{ lines \}\), \(\) => \{ enterInteriorCore\(hit, entries\); \}\);/);
  // the HUD arm speaks and does NOT defer
  assert.match(arm, /if \(lines\.length && how === 'hud'\) for \(const l of lines\) townTalk\?\.say\?\.\(l, getInt\('GUI', 'ShopQualityHUDDelay', 1, 10\)\);/);
  // the house greeting is a RANDOM variant; the quality line is not
  assert.match(arm, /townTalk\?\.randomText\?\.\(greet\.textId\)/);
  // and the house greeting is not behind the shop setting
  assert.match(arm, /\? 'popup'   \/\/ the house greeting is not behind ShopQualityPresentation/);
});

test('BG1: the bash flag is NARROWED to the input it actually needs', () => {
  // The old flag said "no weapon-vs-static-door path exists yet" and
  // bundled the greeting with it. The greeting shipped; what is left
  // is the isBash INPUT, and the flag now says only that.
  const wm = read('src/scenes/worldModes.js');
  const note = wm.slice(wm.indexOf('// FLAGGED, and narrowed to what is actually missing:'), wm.indexOf('let isBrokenIn = false;'));
  assert.match(note, /:571-583/);
  assert.match(note, /:621-627/);
  assert.match(note, /`isBash`/);
  assert.doesNotMatch(note, /house greeting/, 'the greeting is no longer part of this flag');
});

test('AUDIT 28 W6: the shop-quality HUD lines stay up for ShopQualityHUDDelay seconds (PlayerActivate :1382)', () => {
  // townTalk.say rides the delay through to hudText.add's delayInSeconds
  // - AddHUDText's own second argument - and the setting's GetInt range
  // is 1..10 (SettingsManager :494). The screen's law row matches.
  const talk = readFileSync(new URL('../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(talk, /say: \(line, delayInSeconds = undefined\) => hud\.add\(line, delayInSeconds\),/);
  assert.equal(LIVE['GUI/ShopQualityHUDDelay'], 'src/scenes/worldModes.js');
  assert.deepEqual(NUMBER_LAW['GUI/ShopQualityHUDDelay'], { min: 1, max: 10, step: 1, coarse: 2, format: 'sec', source: "DFU GetInt(1,10) (SettingsManager:494)" });
});
