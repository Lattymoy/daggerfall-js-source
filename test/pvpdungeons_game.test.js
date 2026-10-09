// PVPDUNGEONS + the owner's game changes (2026-10-08): the pure laws under them - the zone's halls (where they stand and
// what stands in them), Heal Curse, the rest's warning, the hands swapped, Gothway Garden's side boards, and the spellbook
// kept (KEEP-SPELLBOOK).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWildMask, WILD_REGION } from '../src/systems/wildZone.js';
import { wildHallPicks, wildRingBorderDistance, wildHallFoes, wildHallKeeps, wildHallTemplateOk, WILD_DUNGEONS_PER_RING, WILD_HALL_FOES } from '../src/systems/wildDungeons.js';
import { startInfection, INFECTION, liveInfections } from '../src/systems/infection.js';
import { curseOf, healCurseOffer, healCursePaid, healCursePrice, HEAL_CURSE_BASE } from '../src/systems/healCurse.js';
import { restAilmentLines } from '../src/systems/restWarning.js';
import { readFileSync } from 'node:fs';
import { equipItem, swapHands, canSwapHands, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { gothwayNorthSpots, isGothwayGarden } from '../src/systems/gothwayBoards.js';
import { planStore, REFUSAL, isKeptSpellbook } from '../src/systems/itemTransfer.js';   // KEEP-SPELLBOOK
import { shiftDrop } from '../src/systems/physicalItems.js';
import { setLocked } from '../src/systems/itemLock.js';
import { assignStartingGear } from '../src/systems/startingGear.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { mountEnhancedTrade } from '../src/ui/enhancedTrade.js';
import { tabAccepts } from '../src/ui/nativeInventory.js';
import { withDom } from './invdrag.mjs';

const blob = (x, y) => { const dx = (x - 520) / 38, dy = (y - 110) / 24; return dx * dx + dy * dy + 0.15 * Math.sin(x / 5) < 1; };
const mask = buildWildMask({ width: 1000, height: 500, regionAt: (x, y) => (blob(x, y) ? WILD_REGION : 3) });

test('PVPDUNGEONS halls: every tier its full count (10, 8, 6, 4), never on or beside a place, off its tier\'s borders where the tier allows, spread, and the same on every client for a day - another day, other halls', () => {
  const places = new Set();
  for (let i = 0; i < 120; i++) places.add(`${490 + (i * 37) % 70},${92 + (i * 53) % 40}`);
  const free = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (places.has(`${x + dx},${y + dy}`)) return false; return true; };
  const bd = wildRingBorderDistance(mask);
  const a = wildHallPicks(mask, free, 20369), b = wildHallPicks(mask, free, 20369), c = wildHallPicks(mask, free, 20370);
  assert.deepEqual(a, b, 'the same day, the same halls');
  assert.notDeepEqual(a.map((h) => h.key), c.map((h) => h.key), 'a new day, new halls');
  assert.deepEqual([1, 2, 3, 4].map((r) => a.filter((h) => h.ring === r).length), [...WILD_DUNGEONS_PER_RING]);
  for (const h of a) {
    assert.ok(free(h.x, h.y), `${h.key}: never on or beside a place`);
    assert.ok(bd[h.y * 1000 + h.x] >= 2, `${h.key}: never touching another tier`);
  }
  for (const p of a) for (const q of a) if (p !== q) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= 2, 'never two halls on top of each other');
});

test('PVPDUNGEONS halls\' foes: the low tiers swapped for the ring\'s high tier, a water marker for a water foe, the human classes kept; pure by the hall\'s id; no graveyard for a template', () => {
  const layout = [{ mobileType: 0 }, { mobileType: 3 }, { mobileType: 11 }, { mobileType: 131 }, { mobileType: 32 }, { mobileType: 17 }];
  const one = wildHallFoes(layout, 1, 7428544), heart = wildHallFoes(layout, 4, 7428544);
  assert.deepEqual(one, wildHallFoes(layout, 1, 7428544), 'the same hall, the same foes on every client');
  for (const list of [one, heart]) for (const e of list) assert.ok(wildHallKeeps(e.mobileType), `no low tier: ${e.mobileType}`);
  assert.ok(WILD_HALL_FOES.water.includes(one[2].mobileType), 'a water marker keeps a water foe');
  assert.equal(one[3].mobileType, 131, 'a human class is kept');
  assert.equal(one[4].mobileType, 32, 'a high tier is kept');
  for (const e of heart.filter((x) => x.wildSwapped && !WILD_HALL_FOES.water.includes(x.mobileType))) assert.ok(WILD_HALL_FOES[4].includes(e.mobileType), 'the heart draws the heart\'s');
  assert.equal(wildHallTemplateOk({ name: 'Cemetery of Fools', mapTableData: { locationType: 12 } }), false, '"Cemeteries cannot be zone dungeons!"');
  assert.equal(wildHallTemplateOk({ name: 'The Tower', mapTableData: { locationType: 7, dungeonType: 18 } }), false);
  assert.equal(wildHallTemplateOk({ name: 'Castle Grim', mapTableData: { locationType: 7, dungeonType: 0 } }), true);
});

test('HEAL-CURSE: the curse in the blood lifted for the temple\'s price, the turn cancelled; nothing to lift, no offer; short of gold, nothing taken', () => {
  const e = { name: 'T', isPlayer: true, level: 5, goldPieces: 20000, activeEffects: [], items: [] };
  assert.equal(healCurseOffer(e).kind, 'none');
  startInfection(e, INFECTION.Werewolf, { day: 3 });
  e.timeToBecomeVampireOrWerebeast = 5;
  assert.deepEqual(curseOf(e), { vampire: false, were: false, blood: 1 });
  const cost = healCursePrice({ priceAdjustment: 1000, quality: 10 });
  assert.equal(cost, HEAL_CURSE_BASE, 'an average temple asks the base');
  const poor = { ...e, goldPieces: 10, activeEffects: e.activeEffects };
  assert.equal(healCursePaid(poor, { priceAdjustment: 1000, quality: 10 }).kind, 'notEnoughGold');
  assert.equal(liveInfections(poor).length, 1, 'nothing lifted on credit');
  const r = healCursePaid(e, { priceAdjustment: 1000, quality: 10 });
  assert.equal(r.kind, 'lifted');
  assert.equal(e.goldPieces, 20000 - cost);
  assert.equal(liveInfections(e).length, 0, 'the blood clean');
  assert.equal(e.timeToBecomeVampireOrWerebeast, 0, 'the turn cancelled');
  assert.ok(healCursePrice({ priceAdjustment: 1000, quality: 20 }) < healCursePrice({ priceAdjustment: 1000, quality: 0 }), 'a finer temple asks less');
});

test('REST-WARN: poisoned, diseased or both, the rest asks first and says which; a curse in the blood is not a disease here; well, nothing', () => {
  assert.equal(restAilmentLines({ activeEffects: [] }), null);
  assert.match(restAilmentLines({ activeEffects: [{ kind: 'poison' }] })[0], /^You are poisoned\.$/);
  assert.match(restAilmentLines({ activeEffects: [{ kind: 'disease' }] })[0], /^You are diseased\.$/);
  assert.match(restAilmentLines({ activeEffects: [{ kind: 'poison' }, { kind: 'disease' }] })[0], /poisoned and diseased/);
  assert.equal(restAilmentLines({ activeEffects: [{ kind: 'disease', infection: 'Werewolf-Infection' }] }), null);
  assert.equal(restAilmentLines({ activeEffects: [{ kind: 'poison', ended: true }] }), null);
  assert.deepEqual(restAilmentLines({ activeEffects: [{ kind: 'poison' }] }), ['You are poisoned.', 'Resting will not cure it.', 'Rest anyway?']);
});

test('REST-WARN in THE FOUR HOSTS: the street\'s, a building\'s, a dungeon\'s and the fixed city\'s rest each ask before the window - its Yes the one way to it, nothing ailing the window at once', () => {
  const asks = /const restNow = \(\) => [\s\S]{0,300}?createRestWindow\([^\n]*\n(?:[^\n]*\n){0,2}?\s*const ail = restAilmentLines\(playerEntity\);\s*\n\s*if \(ail\) \{[^\n]*new DecisionBoxWindow\(\{ rows: ail,[^\n]*return; \}\s*\n\s*restNow\(\);/;
  for (const host of ['world.js', 'worldModes.js', 'dungeonContext.js', 'exterior.js']) {
    const src = readFileSync(new URL(`../src/scenes/${host}`, import.meta.url), 'utf8');
    assert.match(src, asks, `${host}: the rest asks first (exterior.js - the fixed city - was the host left out)`);
    assert.match(src, /import \{ restAilmentLines \} from '\.\.\/systems\/restWarning\.js';/, `${host}: the one law`);
  }
});

test('SWAP-HANDS: two one-handers trade hands; one crosses to the empty hand; a shield never leaves the left, a two-hander never the right', () => {
  const e = { items: [] };
  const mk = (t, name, group = 'Weapons') => { const it = { group, templateIndex: t, name, stackCount: 1 }; e.items.push(it); return it; };
  const dagger = mk(113, 'Dagger'), sword = mk(114, 'Shortsword');
  equipItem(e, dagger); equipItem(e, sword);
  const s = equipTableOf(e);
  assert.deepEqual([s[EQUIP_SLOTS.RightHand]?.name, s[EQUIP_SLOTS.LeftHand]?.name], ['Dagger', 'Shortsword']);
  assert.deepEqual(swapHands(e), { ok: true });
  assert.deepEqual([s[EQUIP_SLOTS.RightHand]?.name, s[EQUIP_SLOTS.LeftHand]?.name], ['Shortsword', 'Dagger']);
  assert.equal(s[EQUIP_SLOTS.RightHand].equipSlot, EQUIP_SLOTS.RightHand, 'each piece knows its new hand');
  s[EQUIP_SLOTS.LeftHand] = null; dagger.equipSlot = null;
  assert.deepEqual(swapHands(e), { ok: true });
  assert.deepEqual([s[EQUIP_SLOTS.RightHand]?.name ?? null, s[EQUIP_SLOTS.LeftHand]?.name], [null, 'Shortsword'], 'into the empty hand');
  const empty = { items: [] };
  assert.equal(canSwapHands(empty).ok, false, 'empty hands');
  const k = { items: [] };
  const shield = { group: 'Armor', templateIndex: 111, name: 'Kite Shield', stackCount: 1 }, blade = { group: 'Weapons', templateIndex: 114, name: 'Shortsword', stackCount: 1 };
  k.items.push(shield, blade); equipItem(k, blade); equipItem(k, shield);
  const ks = equipTableOf(k);
  assert.equal(ks[EQUIP_SLOTS.LeftHand]?.name, 'Kite Shield');
  assert.equal(swapHands(k).ok, false, 'a shield never leaves the left');
  assert.equal(ks[EQUIP_SLOTS.LeftHand]?.name, 'Kite Shield', 'and nothing moved');
  const t2 = { items: [] };
  const claymore = { group: 'Weapons', templateIndex: 119, name: 'Two-hander', stackCount: 1 };
  t2.items.push(claymore);
  const r2 = equipItem(t2, claymore);
  if (equipTableOf(t2)[EQUIP_SLOTS.RightHand] === claymore && canSwapHands(t2).ok === false) assert.match(canSwapHands(t2).why, /right hand/);
});

test('GOTHWAY-BOARDS: Gothway Garden alone; two boards at the NORTH entrance, one each side of the road in, inside the border, facing north; never in a wall', () => {
  assert.equal(isGothwayGarden('Gothway Garden'), true);
  assert.equal(isGothwayGarden(' gothway garden '), true);
  assert.equal(isGothwayGarden('Daggerfall'), false);
  const W = 256, H = 256, cell = 1.6;
  // a road down the middle (x 124..131) and another road off to the west; buildings either side of the middle one
  const grid = (gx, gy) => ((gx >= 124 && gx <= 131) || (gx >= 20 && gx <= 23) ? 15 : (gx > 116 && gx < 124) || (gx > 131 && gx < 139) ? 0 : 7);
  const [w, e] = gothwayNorthSpots(grid, W, H, cell);
  assert.deepEqual([w.side, e.side], ['west', 'east']);
  assert.ok(w.x < 124 * cell + cell && e.x > 131 * cell, 'either side of the middle road (the way in), not the far one');
  assert.ok(w.z > (H - 8) * cell && w.z < H * cell, 'inside the north border');
  for (const s of [w, e]) assert.notEqual(grid(Math.floor(s.x / cell), Math.floor(s.z / cell)), 0, 'never inside a wall');
  assert.equal(w.yawDeg, 0, 'facing north, at whoever arrives');
  assert.equal(gothwayNorthSpots(() => 0, W, H, cell), null, 'no way in: no boards');
});

import { wildGiantsAt, WILD_GIANT_COUNT, WILD_GIANT_LEG_MS, wildGiantRing } from '../src/systems/wildGiants.js';
import { wdunEmpty, wdunGiantDie, wdunGiants, wdunState, wdunPrune, WDUN_GIANT_DOWN_MS } from '../src/net/wildLaw.js';
import { validWdunIn, validWdunOut } from '../src/net/wire.js';
import { wildRingAt } from '../src/systems/wildZone.js';

test('ZONE-GIANTS: two giants a tier, always; each walks inside its own tier, the same on every client, a step at a time; the dead left out', () => {
  const free = () => true, t0 = 1.7e12;
  const a = wildGiantsAt(mask, free, t0), b = wildGiantsAt(mask, free, t0);
  assert.equal(a.length, WILD_GIANT_COUNT);
  assert.deepEqual(a, b, 'every client the same');
  assert.deepEqual([1, 2, 3, 4].map((r) => a.filter((g) => g.ring === r).length), [2, 2, 2, 2]);
  for (let k = 0; k < 40; k++) {
    const t = t0 + k * (WILD_GIANT_LEG_MS / 3);
    for (const gi of wildGiantsAt(mask, free, t)) {
      assert.equal(gi.ring, wildGiantRing(gi.g));
      const later = wildGiantsAt(mask, free, t + 60_000).find((q) => q.g === gi.g);
      assert.ok(Math.hypot(later.x - gi.x, later.y - gi.y) < 2, 'a minute on, a short step - never a jump (the walk to a new day\'s home the longest)');
    }
  }
  for (const gi of a) {   // its waypoints are its own tier's pixels
    const leg = wildGiantsAt(mask, free, Math.floor((t0 + gi.g * 157_000) / WILD_GIANT_LEG_MS) * WILD_GIANT_LEG_MS - gi.g * 157_000).find((q) => q.g === gi.g);
    assert.equal(wildRingAt(Math.floor(leg.x), Math.floor(leg.y), mask), gi.ring, 'a waypoint in its own tier');
  }
  assert.equal(wildGiantsAt(mask, free, t0, (g) => g === 3).length, WILD_GIANT_COUNT - 1, 'a dead giant is not on the map');
});

test('ZONE-GIANTS hub: a kill is down for everyone half an hour, a second report moves nothing, then it walks again; the words bounded', () => {
  const st = wdunEmpty(), t = 1e12;
  assert.equal(wdunGiantDie(st, 2, t), true);
  assert.equal(wdunGiantDie(st, 2, t + 5000), false, 'already down');
  assert.equal(wdunGiantDie(st, 9, t), false, 'no such giant');
  assert.deepEqual(wdunGiants(st, t + 1000), [[2, WDUN_GIANT_DOWN_MS - 1000]]);
  assert.deepEqual(wdunState(st, 'A', t).giants, [[2, WDUN_GIANT_DOWN_MS]]);
  wdunPrune(st, t + WDUN_GIANT_DOWN_MS + 1);
  assert.deepEqual(wdunGiants(st, t + WDUN_GIANT_DOWN_MS + 1), [], 'up again');
  assert.deepEqual(validWdunIn({ k: 'gk', g: 7 }), { k: 'gk', g: 7 });
  assert.equal(validWdunIn({ k: 'gk', g: 8 }), null);
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'gd', giants: [[1, 5], [12, 5], ['x', 1]] }), { k: 'gd', giants: [[1, 5]] });
});

test('GIANT-FIELDS: with the height map, the giants walk the low half of their tier - never the peaks', () => {
  const free2 = (x, y) => x >= 0 && y >= 0;   // a fresh pixel test: a fresh table of cells
  const hgt = (x, y) => ((x * 7 + y * 13) % 100);
  const t0 = 1.75e12;
  for (let k = 0; k < 30; k++) {
    for (const gi of wildGiantsAt(mask, free2, t0 + k * WILD_GIANT_LEG_MS, () => false, hgt)) {
      // at a leg's start the giant stands on a waypoint (its own offset aside, the same leg law)
      const at = wildGiantsAt(mask, free2, Math.floor((t0 + k * WILD_GIANT_LEG_MS + gi.g * 157_000) / WILD_GIANT_LEG_MS) * WILD_GIANT_LEG_MS - gi.g * 157_000, () => false, hgt).find((q) => q.g === gi.g);
      assert.ok(hgt(Math.floor(at.x), Math.floor(at.y)) <= 60, `giant ${gi.g} on low ground`);
    }
  }
});

test('GIANT-LEASH: a giant\'s walk never leaves the zone, minute by minute through a whole day', () => {
  const t0 = 1.76e12;
  for (let m = 0; m < 24 * 60; m += 7) for (const gi of wildGiantsAt(mask, () => true, t0 + m * 60_000)) assert.ok(wildRingAt(Math.floor(gi.x), Math.floor(gi.y), mask) > 0, `giant ${gi.g} inside at minute ${m}`);
});

test('CROW-NEWS: the crows\' word names whose death set them, bounded - so the fallen\'s party is not told', () => {
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'cr', crows: [['1,2', 5]], who: 'acct-a' }), { k: 'cr', crows: [['1,2', 5]], who: 'acct-a' });
  assert.deepEqual(validWdunOut({ t: 'wdun', k: 'cr', crows: [], who: 'x'.repeat(200) }), { k: 'cr', crows: [] });
});

import { dungeonRespawnMs, dungeonRespawnDue, DUNGEON_RESPAWN_MS, ELITE_DUNGEON_RESPAWN_MS } from '../src/systems/dungeonRespawn.js';
test('DUNGEON-RESPAWN: a normal dungeon 20 minutes, an elite 40, each on its own clock; the zone\'s halls and a Super dungeon keep the hour', () => {
  assert.equal(dungeonRespawnMs({}), 20 * 60_000);
  assert.equal(dungeonRespawnMs({ elite: true }), 40 * 60_000);
  assert.equal(dungeonRespawnMs({ elite: true, wild: true }), 3600_000, 'the halls as they were');
  assert.equal(dungeonRespawnMs({ superTier: true }), 3600_000);
  const t = 1e12;
  assert.equal(dungeonRespawnDue(t, t + DUNGEON_RESPAWN_MS - 1, DUNGEON_RESPAWN_MS), false);
  assert.equal(dungeonRespawnDue(t, t + DUNGEON_RESPAWN_MS, DUNGEON_RESPAWN_MS), true, 'twenty minutes after it fell, whoever came and went');
  assert.equal(dungeonRespawnDue(t, t + ELITE_DUNGEON_RESPAWN_MS - 1, ELITE_DUNGEON_RESPAWN_MS), false);
  assert.equal(dungeonRespawnDue(t, null, DUNGEON_RESPAWN_MS), false, 'offline: nothing respawns');
});

import { foeTitle } from '../src/systems/foeTitle.js';
import { GREATER_GIANT_NAME, GREATER_GIANT_CALL, GREATER_GIANT_CALL_AT } from '../src/systems/wildZone.js';
import { validFoeRecord } from '../src/net/wire.js';
test('GREATER-GIANT: the zone\'s giants are Greater Giants, calling ten ordinary giants at half health; a puppet known by its health alone', () => {
  assert.equal(foeTitle({ wildGiant: true }, 'Giant'), GREATER_GIANT_NAME);
  assert.equal(foeTitle({}, 'Giant'), 'Giant', 'its ten are giants of the ordinary kind');
  assert.deepEqual([GREATER_GIANT_CALL, GREATER_GIANT_CALL_AT], [10, 0.5]);
  assert.equal(validFoeRecord({ i: 3, gg: 5 }).gg, 5, 'which Greater Giant rides every puppet\'s record');
  assert.equal(validFoeRecord({ i: 3, gg: 8 }), null);
  assert.equal(validFoeRecord({ i: 3 }).gg, undefined, 'any other foe carries none');
});

import { wildMaskOf, wildInside, WILD_KEEPOUT_PX } from '../src/systems/wildZone.js';
test('WILD-KEEPOUT: Wrothgaria and the ground about it are never the zone - the west border moved east, never a notch', () => {
  let town = null;   // a pixel deep inside the zone without the keep-out
  for (let y = 0; y < 500 && !town; y++) for (let x = 0; x < 1000 && !town; x++) if (mask.depth?.[y * 1000 + x] >= 6) town = { x, y };
  assert.ok(town, 'a deep pixel to stand the town on');
  const maps = {
    getRegionIndexAt: (x, y) => (blob(x, y) ? WILD_REGION : 3),
    getLocationByName: (region, name) => (name === 'Wrothgaria' ? { mapTableData: { longitude: town.x * 128 + 5, latitude: (499 - town.y) * 128 + 5 } } : null),
  };
  const m = wildMaskOf(maps);
  assert.equal(wildInside(m, town.x, town.y), false, 'the town out');
  assert.equal(wildInside(m, town.x + WILD_KEEPOUT_PX, town.y), false, 'and its ground');
  assert.equal(wildInside(mask, town.x, town.y), true, 'without it, the same pixel is the zone');
  // WILD-KEEPOUT2: never a notch - the west border moved east the same distance on every row, the east edge as it was
  const rows = (mk, y) => { let w = -1, e = -1; for (let x = 0; x < 1000; x++) if (mk.inside[y * 1000 + x]) { if (w < 0) w = x; e = x; } return [w, e]; };
  const shifts = new Set();
  for (let y = mask.box.y0; y <= mask.box.y1; y++) {
    const [w0, e0] = rows(mask, y), [w1, e1] = rows(m, y);
    if (w0 < 0 || w1 < 0) continue;
    assert.equal(e1, e0, `row ${y}: the east edge stays`);
    shifts.add(w1 - w0);
  }
  assert.ok(Math.max(...shifts) - Math.min(...shifts) <= 1, 'one shift all along the west (a pixel for a row\'s own bays)');
});

// ── KEEP-SPELLBOOK (2026-10-08, the owner: "a player dropped his spellbook apparently") ──

/** A new character's spellbook, off the producer that hands it over (startingGear.js, the bag's first piece). */
const newSpellbook = () => {
  const e = { items: [] };
  assignStartingGear(e, { rolls: () => 0, torchesFromItems: false });
  const book = e.items.find((it) => it.group === 'MiscItems' && it.templateIndex === 132);
  assert.ok(book, 'the producer hands over a spellbook');
  return { e, book };
};

test('KEEP-SPELLBOOK the law: the spellbook never leaves the pack - not to the ground, a pile, a body or a chest, not by the shift-drop, not even asked dry - and the own wagon still takes it; a quest\'s book is the quest\'s, and the rest of the bag goes as ever (mutants: the store rung gone, the wagon refused, the shift-drop unguarded, the quest\'s book kept)', () => {
  const { e, book } = newSpellbook();
  assert.equal(REFUSAL.spellbook.text, 'Your spellbook never leaves you.', 'the words, as prose');
  assert.equal(planStore(book, { remote: [] }).refusal, REFUSAL.spellbook, 'the ground, a pile, a body, a chest');
  assert.equal(planStore(book, { remote: [], dryRun: true }).refusal, REFUSAL.spellbook, 'a view asking whether to draw the button');
  assert.equal(planStore(book, { remote: [], usingWagon: true }).ok, true, 'the wagon is still mine');
  let dropped = null;
  const r = shiftDrop(book, { items: e.items, entity: e, drop: (list) => { dropped = list; } });
  assert.equal(r.refusal?.text, REFUSAL.spellbook.text, 'the shift-drop says why');
  assert.ok(e.items.includes(book) && dropped === null, 'and the book stays in the pack');
  setLocked(book, true);
  assert.equal(shiftDrop(book, { items: e.items, entity: e, drop: () => {} }).refusal?.text, REFUSAL.spellbook.text,
    'a locked book says its own reason, not "unlock it first" - unlocking it would not let it go');
  setLocked(book, false);
  const quests = { ...book, questItem: true };
  assert.equal(isKeptSpellbook(quests), false, 'a quest\'s book is not the character\'s');
  assert.notEqual(planStore(quests, { remote: [], dryRun: true }).refusal, REFUSAL.spellbook);
  const shirt = e.items.find((it) => it !== book && it.group === 'MensClothing');
  assert.equal(planStore(shirt, { remote: [] }).ok, true, 'a shirt drops as ever');
});

const SB_ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const sbHooks = (mode, bag) => ({
  mode, shelfItems: () => [], packItems: () => bag, entity: { items: bag }, accepts: () => true, enchanted: () => true,
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }), gold: () => 1000,
  rows: (id) => [{ text: `#${id}`, center: true }], weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {}, icons: SB_ICONS,
});
const SB_PAGES = Object.freeze({ weapons: 'Weapons & Armor', magic: 'Magic Items', clothing: 'Clothing & Misc', ingredients: 'Ingredients' });
const sbPageOf = (item) => Object.keys(SB_PAGES).find((t) => tabAccepts(item, t));

test('KEEP-SPELLBOOK the counters: the classic counter\'s Sell and Sell Magic refuse the spellbook in words and keep it, a shirt sells; the enhanced counter the same, quoting it no price (mutants: the classic counter sells it; the enhanced counter sells it; the enhanced counter quotes it)', () => {
  for (const mode of ['Sell', 'SellMagic']) {
    const { e, book } = newSpellbook();
    const bag = e.items;
    const shirt = bag.find((it) => it !== book && it.group === 'MensClothing');
    const pick = (it) => {
      const w = new NativeTradeWindow(sbHooks(mode, bag));
      w.tab = sbPageOf(it);
      const at = w.localList().indexOf(it);
      assert.ok(at >= 0, `${mode}: ${it.name} is on the counter's list`);
      w._pickLocal(at);
      return { said: w.box?.rows?.[0]?.text ?? null, staged: w.staged.includes(it) };
    };
    assert.deepEqual(pick(book), { said: REFUSAL.spellbook.text, staged: false }, `${mode}: the classic counter refuses it in words`);
    assert.ok(bag.includes(book), `${mode}: it stays in the pack`);
    if (mode === 'Sell') assert.equal(pick(shirt).staged, true, 'a shirt sells');
  }
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  for (const mode of ['Sell', 'SellMagic']) {
    const { e, book } = newSpellbook();
    const bag = e.items;
    withDom((dom) => {
      const host = dom.mk('div');
      dom.body.append(host);
      const view = mountEnhancedTrade(host, { ...sbHooks(mode, bag), gold: () => 100000 });
      try {
        host.querySelectorAll('.packtab').find((b) => b.textContent === SB_PAGES[sbPageOf(book)]).onclick();
        const row = host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(book.name));
        assert.ok(row, `${mode}: the spellbook is on the counter's list`);
        row.onclick({ timeStamp: 5000 });
        assert.doesNotMatch(textOf(host), /Sell for/, `${mode}: no price quoted for a sale the counter refuses`);
        host.querySelectorAll('.act.primary').find((b) => b.textContent === 'Sell').onclick();
        assert.ok(bag.includes(book), `${mode}: the enhanced counter keeps it in the pack`);
        assert.deepEqual(host.querySelectorAll('.px-note').map((n) => n.textContent), [REFUSAL.spellbook.text], `${mode}: and says why`);
      } finally { view.unmount(); }
    });
  }
});
