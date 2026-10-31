// TOWN-MARKS (2026-09-29, Mac: "For the notice boards in town. Can we physically mark them on the town map, and also mark
// owned player housing"; bible/10-UI/UI-Arc.md TOWN-MARKS): THE TOWN MAP'S PLAYER HOUSING (NOTICE-PANEL, 2026-10-29: the
// boards' marks went with the boards). The data (ui/town/townMapMarks.js: which houses, what each is called), the ink
// (ui/ink/inkTown.js paintHomeMark - under the names, lifted above their place), the sheet (ui/town/townSheet.js: into sheet space by the
// plates' and the party's own seams, answered under the pointer, a repaint when the homes answer), and the wiring
// (ui/town/townMapDoor.js, scenes/world.js toggleExteriorAutomap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  readTownHomes, townHomeRows, TOWN_HOUSE_LABEL, TOWN_MARK_REACH,
} from '../../../src/ui/town/townMapMarks.js';
import { createTownSheet } from '../../../src/ui/town/townSheet.js';
import { TOWN_PEN, TOWN_MARK_HALF, ANCHOR_R, sheetY, paintHomeMark } from '../../../src/ui/ink/inkTown.js';
import { toPaper, PEN, CARET_R } from '../../../src/ui/ink/inkMap.js';
import { nameplateAnchor } from '../../../src/ui/nameplateLayout.js';
import { hostText } from '../../hostText.mjs';

const src = (p) => hostText(p);   // HOST-SPLIT 2: a host read whole - the town map's door lives in scenes/exteriorAutomapToggle.js

/** A canvas that records every call with the pens it was made in. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
/** Each glyph as it was inked: its halo pass's outline (paintMarkShape - a closed path stroked in the halo), as a box. */
function glyphBoxes(ctx) {
  const out = [];
  const c = ctx.calls;
  for (let i = 1; i < c.length; i++) {
    if (c[i].fn !== 'moveTo' || c[i - 1].fn !== 'beginPath') continue;
    const pts = [c[i].args];
    let j = i + 1;
    while (c[j]?.fn === 'lineTo') pts.push(c[j++].args);
    if (c[j]?.fn !== 'closePath' || c[j + 1]?.fn !== 'stroke' || c[j + 1].strokeStyle !== TOWN_PEN.halo) continue;
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    out.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 });
  }
  return out;
}

const VIEW = { ox: 0, oy: 0, scale: 3 };
const ENV = { view: VIEW, paperW: 2000, paperH: 2000, dpr: 1, pulse: 0 };
const house = (buildingKey, blockX, blockY, x, z, extra = {}) => ({ buildingKey, blockX, blockY, position: [x, 0, z], buildingType: 17, isResidence: true, name: '', ...extra });

test('TOWN-MARKS the reading: a home with no building is dropped (mutants: the reads keep a bad row)', () => {
  assert.deepEqual(readTownHomes(null), []);
  assert.deepEqual(readTownHomes(() => { throw new Error('x'); }), []);
  assert.deepEqual(readTownHomes(() => [{ buildingKey: 7, own: true, label: 'Your home' }, { buildingKey: 0, label: 'x' }, { buildingKey: 1.5, label: 'x' },
    { buildingKey: 9, label: 3 }, { buildingKey: 8, own: 'yes', label: "Mac's home" }]), [
    { buildingKey: 7, own: true, label: 'Your home' },
    { buildingKey: 8, own: false, label: "Mac's home" },
  ]);
});

test('TOWN-MARKS the housing: an online home, the player\'s and every other player\'s, named as its door names it; the bank\'s house only in its own town (mutants: another town\'s house of the same key marked; the home read as the player\'s; offline homes asked)', () => {
  const buildings = [house(10, 0, 0, 10, 10), house(11, 0, 0, 40, 40), house(12, 1, 0, 20, 20), house(13, 1, 1, 5, 5)];
  const registry = new Map([[10, { owner: 'Mac', own: true }], [11, { owner: 'Gryphoth', own: false }]]);
  const homeAt = (mapId, key) => (mapId === 4000000000 ? registry.get(key) ?? null : null);
  const houses = [];
  houses[3] = { regionIndex: 3, location: 'Daggerfall', mapId: -294967296, buildingKey: 12 };   // the same map id, stored signed
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses, homeAt }), [
    { buildingKey: 10, own: true, label: 'Your home' },
    { buildingKey: 11, own: false, label: "Gryphoth's home" },
    { buildingKey: 12, own: true, label: TOWN_HOUSE_LABEL },
  ]);
  // another town of the region: its building 12 is somebody else's - a key is a location's own numbering
  assert.deepEqual(townHomeRows({ buildings, mapId: 77, regionIndex: 3, houses, homeAt }), []);
  // offline: no registry - the bank's house alone
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses }), [{ buildingKey: 12, own: true, label: TOWN_HOUSE_LABEL }]);
  // a home stands on the bank's house: the home answers, once
  const both = new Map([[12, { owner: 'Mac', own: true }]]);
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses, homeAt: (m, k) => both.get(k) ?? null }), [{ buildingKey: 12, own: true, label: 'Your home' }]);
  // a home of my account played by another of my characters is not mine to call mine
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 0, homeAt: (m, k) => (k === 13 ? { owner: 'Mac', mine: true, own: false } : null) }),
    [{ buildingKey: 13, own: false, label: "Mac's home" }]);
  assert.deepEqual(townHomeRows({ buildings, mapId: undefined, regionIndex: 3, houses }), [], 'off a location');
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 4, houses }), [], 'no house in this region');
});

test('TOWN-MARKS the sheet: a home stands ON its building\'s place (the plates\' anchor, +Z up), under the names, the player\'s own in the player\'s ink (mutants: a mark mirrored; the wrong building; drawn over the names; the own fill lost)', () => {
  const buildings = [house(1, 0, 0, 30, 30), house(2, 1, 0, 60, 10, { name: 'Oakhouse', isResidence: false, buildingType: 15 })];
  const s = createTownSheet({
    gridW: 2, gridH: 2, blocks: [], buildings: () => buildings, discovered: () => [{ buildingKey: 2, displayName: 'Oakhouse' }],
    boards: () => [{ feet: [16, 0, 48], label: 'Notice Board' }],   // NOTICE-PANEL: a host's boards are no mark now
    homes: () => [{ buildingKey: 1, own: true, label: 'Your home' }, { buildingKey: 2, own: false, label: "Gryphoth's home" }, { buildingKey: 99, label: 'gone' }],
  });
  const h = s.field.h;
  const [ax, ay] = nameplateAnchor(0, 0, [30, 0, 30]);
  const [bx, by] = nameplateAnchor(1, 0, [60, 0, 10]);
  assert.deepEqual(s.homes(), [{ x: ax, y: sheetY(h, ay), own: true, label: 'Your home' }, { x: bx, y: sheetY(h, by), own: false, label: "Gryphoth's home" }],
    'at the plates\' own anchors; a home whose building is not in this town is not drawn');
  assert.equal(s.boards, undefined, 'NOTICE-PANEL: the sheet marks no board');
  const ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const want = s.homes().map((m) => toPaper(VIEW, m.x, m.y));
  const got = glyphBoxes(ctx).map((g) => [g.cx, g.cy]);
  assert.equal(got.length, 2);
  want.forEach((w, i) => assert.ok(near(got[i], w), `mark ${i} is centred on its place (Mac: "on top of the building itself"): ${got[i]} vs ${w}`));
  const fills = ctx.calls.filter((c) => c.fn === 'fill').map((c) => c.fillStyle);
  assert.equal(fills.filter((f) => f === TOWN_PEN.home).length, 1, 'ONE house filled in the player\'s ink - the player\'s own');
  assert.equal(TOWN_PEN.home, PEN.player);
  const firstName = ctx.calls.findIndex((c) => c.fn === 'fillText');
  const lastMark = ctx.calls.findLastIndex((c) => c.fn === 'closePath');
  assert.ok(firstName > 0 && lastMark >= 0 && lastMark < firstName, 'the marks go down before the names - a name is never under a glyph');
  // a sheet with no marks is the sheet it was
  const plain = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => buildings, discovered: () => [] });
  assert.deepEqual(plain.homes(), []);
});

test('TOWN-MARKS the glyphs: centred ON the place, no taller than 2 x TOWN_MARK_HALF, on no post, no bigger than the caret (Mac: "I kinda wish the icons were on top of the building itself, not on the side") (mutants: a glyph off its place; the half grown)', () => {
  for (const paint of [(c) => paintHomeMark(c, 100, 200, false), (c) => paintHomeMark(c, 100, 200, true)]) {
    const ctx = recordingCtx();
    paint(ctx);
    const [g] = glyphBoxes(ctx);
    assert.ok(g, 'the glyph is inked');
    assert.ok(near([g.cx, g.cy], [100, 200]), `centred on the place: ${g.cx}, ${g.cy}`);
    assert.ok(g.y1 - g.y0 <= 2 * TOWN_MARK_HALF && g.y0 >= 200 - TOWN_MARK_HALF && g.y1 <= 200 + TOWN_MARK_HALF, `within TOWN_MARK_HALF of it: ${g.y0}..${g.y1}`);
    assert.ok(g.x1 - g.x0 <= 2 * CARET_R && g.y1 - g.y0 <= 2 * CARET_R, `no bigger than the player's own caret - it marks a building, it does not hide it: ${g.x1 - g.x0} x ${g.y1 - g.y0}`);
    assert.ok(!ctx.calls.some((c) => c.fn === 'lineTo' && c.args[0] === 100 && c.args[1] > 200 + TOWN_MARK_HALF), 'no post down from it');
  }
});

test('TOWN-MARKS the names: a building a home\'s glyph stands on is named UNDER the glyph, clear of it, with no tick of its own - the glyph is its tick; the other names stand where they stood, and a home that goes lays its name back (mutants: the name left on the glyph; the plates not re-laid; the tick drawn under the glyph)', () => {
  const buildings = [house(1, 0, 0, 30, 30), house(2, 0, 0, 90, 90, { name: 'Oakhouse', isResidence: false, buildingType: 15 })];
  let homes = [{ buildingKey: 1, own: true, label: 'Your house' }];
  const s = createTownSheet({
    gridW: 2, gridH: 2, blocks: [], buildings: () => buildings,
    discovered: () => [{ buildingKey: 1, displayName: "Mac's residence", isOverrideName: true }, { buildingKey: 2, displayName: 'Oakhouse' }],
    homes: () => homes,
  });
  const h = s.field.h;
  const place = (bx, by, pos) => { const [x, y] = nameplateAnchor(bx, by, pos); return toPaper(VIEW, x, sheetY(h, y)); };
  const [, hy] = place(0, 0, [30, 0, 30]);
  const [, oy] = place(0, 0, [90, 0, 90]);
  const measure = (t) => t.length * 6;
  const rows = s.platesAt(VIEW, 2000, 2000, measure);
  const mine = rows.find((r) => r.text === "Mac's residence");
  const oak = rows.find((r) => r.text === 'Oakhouse');
  assert.equal(mine.marked, true);
  assert.equal(mine.anchorY, hy + TOWN_MARK_HALF, 'its place is the glyph\'s foot');
  assert.equal(mine.y, hy + TOWN_MARK_HALF + 1 + (mine.size * 1.15) / 2, 'lettered under the glyph, clear of it');
  assert.equal(oak.marked, undefined);
  assert.equal(oak.y, oy, 'another name stands on its place');
  const ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const ticks = ctx.calls.filter((c) => c.fn === 'arc' && c.args[2] === ANCHOR_R).map((c) => c.args[1]);
  assert.ok(ticks.includes(oy), 'Oakhouse is ticked');
  assert.ok(!ticks.includes(mine.anchorY) && !ticks.includes(hy), 'the marked building is not - its glyph is its tick');
  homes = [];   // sold
  const back = s.platesAt(VIEW, 2000, 2000, measure).find((r) => r.text === "Mac's residence");
  assert.equal(back.y, hy, 'the name back on its place');
  assert.equal(back.marked, undefined);
});

test('TOWN-MARKS the pointer: over a glyph the town map names it - a home as its door does; past its reach it is the street (mutants: the reach lost)', () => {
  const s = createTownSheet({
    gridW: 1, gridH: 1, blocks: [], buildings: () => [house(1, 0, 0, 30, 30)], discovered: () => [], title: 'Daggerfall',
    homes: () => [{ buildingKey: 1, own: false, label: "Gryphoth's home" }],
  });
  s.paintOverlay(recordingCtx(), ENV);
  const [hx, hy] = toPaper(VIEW, s.homes()[0].x, s.homes()[0].y);
  assert.equal(s.hoverLabel(hx, hy + TOWN_MARK_HALF).label, "Gryphoth's home");
  assert.equal(s.hoverLabel(hx + TOWN_MARK_REACH - 1, hy).label, "Gryphoth's home", 'within reach');
  assert.equal(s.hoverLabel(hx + TOWN_MARK_REACH + 1, hy).label, 'Daggerfall', 'past it');
});

test('TOWN-MARKS the repaint: the homes answer after the map is open - the plan breathes until it has painted the version it has, and then rests (mutants: never repainted; breathing for ever)', () => {
  let version = 0;
  const s = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => [], discovered: () => [], homes: () => [], homesVersion: () => version });
  assert.equal(s.breathes(), true, 'not yet painted');
  s.paintOverlay(recordingCtx(), ENV);
  assert.equal(s.breathes(), false, 'painted what it has: at rest');
  version = 1;   // the service answers
  assert.equal(s.breathes(), true, 'the answer is painted on the next beat');
  s.paintOverlay(recordingCtx(), ENV);
  assert.equal(s.breathes(), false);
  const offline = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => [], discovered: () => [] });
  assert.equal(offline.breathes(), false, 'no registry: the plan it always was');
});

test('TOWN-MARKS the wiring: the door hands the marks to the enhanced town map; the host marks the town\'s housing (NOTICE-PANEL: no board), and asks for the town\'s homes as the map opens (mutants: a key dropped at the door; the board marked while closed; the homes never asked)', () => {
  const door = src('src/ui/town/townMapDoor.js');
  assert.doesNotMatch(door, /boards: |townBoards/);
  assert.match(door, /homes: deps\.townHomes \?\? null,/);
  assert.match(door, /homesVersion: deps\.townHomesVersion \?\? null,/);
  const w = src('src/scenes/world.js');
  assert.doesNotMatch(w, /townBoards|townBoardMarks/);   // PIN MOVED (NOTICE-PANEL): no board stands to mark
  // PIN MOVED (VENDOR-HOUSES): the waypoint's house and every trader's house (never my own) carry `vendor`
  assert.match(w, /townHomes: \(\) => townHomeRows\(\{\n\s*buildings: summaries, mapId: dfLoc\.mapTableData\?\.mapId, regionIndex: dfLoc\.regionIndex, houses: playerEntity\.houses \?\? null,\n\s*homeAt: onlineHomes \? \(mapId, buildingKey\) => \{\n\s*const h = onlineHomes\.homeAt\(mapId, buildingKey\);\n[^\n]*\n\s*if \(h && isVendorWaypoint\(mapId, buildingKey\)\) return \{ \.\.\.h, own: false, vendor: true, waypoint: true, owner: vendorWaypointLabel\(h\.owner\) \};\n\s*return h && !h\.own && isVendorHouse\(mapId, buildingKey\) \? \{ \.\.\.h, vendor: true \} : h;\n\s*\} : null,\n\s*\}\),/);
  // PIN MOVED (FB1020c STREETS-TAB, at the merge of STAR0's move): the bag `townHere` builds for either key; the homes asked as the M key's window opens and as the travel
  // key's streets are handed over
  // PIN MOVED (VENDOR-HOUSES; AUDIT TECH-FEEDBACK F7: a number, the sheet asks it a frame)
  assert.match(w, /townHomesVersion: \(\) => \(onlineHomes\?\.version\(\) \?\? 0\) \+ vendorWaypointVersion\(\) \* 100_000 \+ vendorHousesVersion\(\) \* 1e10,[^\n]*\n\s*\} \};/);
  assert.match(w, /townTalk\.showOverlay\(createTownMapWindow\(here\.deps\)\);\n\s*onlineHomes\?\.ensure\(here\.mapId\);[^\n]*\n\s*if \(onlineHomes\) ensureVendorHouses\(here\.region\);/, 'the M key asks, its traders too');
  assert.match(w, /if \(!here\) return \{\};\n\s*onlineHomes\?\.ensure\(here\.mapId\);[^\n]*\n\s*if \(onlineHomes\) ensureVendorHouses\(here\.region\);/, 'the travel key\'s streets ask too');
  assert.match(w, /return \{ mapId: dfLoc\.mapTableData\?\.mapId, region: dfLoc\.regionIndex, deps: \{/, 'the town\'s MapId and region');
  // the classic exterior automap is DFU's own window: it draws DFU's marks alone
  assert.doesNotMatch(src('src/ui/exteriorAutomapWindow.js'), /townHomes|paintHomeMark/);
});

// ---- VENDOR-HOUSES (Mac, 2026-10-30, forwarding #feature-feedback "Player Vendors") ---------------------------------

const { registerVendorHouseReader, ensureVendorHouses, isVendorHouse, vendorHousesVersion, VENDOR_HOUSES_READ_S, VENDOR_HOUSES_RETRY_S, VENDOR_HOUSES_HUNG_S, _resetVendorHousesForTests } = await import('../../../src/systems/vendorHouses.js');
const settle = () => new Promise((r) => setTimeout(r, 0));

test('VENDOR-HOUSES the read: a region\'s traders by town and house, read once a while, past the Bay as in it (mutants: the reread every open; the version never moved; a house of another town of the same key marked)', async () => {
  _resetVendorHousesForTests();
  const asked = [];
  const rows = { 17: [{ map: 4000000000, buildingKey: 12 }, { map: 77, buildingKey: 5 }, { map: 77, buildingKey: 0 }], 66: [{ map: 9100001, buildingKey: 3 }] };
  registerVendorHouseReader((region) => { asked.push(region); return { ok: true, data: { rows: rows[region] ?? [] } }; });
  const v0 = vendorHousesVersion();
  ensureVendorHouses(17, 1000);
  ensureVendorHouses(17, 1000);   // a read out: not asked twice
  await settle();
  assert.deepEqual(asked, [17]);
  assert.ok(vendorHousesVersion() > v0, 'the marks moved, so the sheet repaints');
  assert.ok(isVendorHouse(4000000000, 12) && isVendorHouse(-294967296, 12), 'a map id read signed or not');
  assert.ok(isVendorHouse(77, 5) && !isVendorHouse(77, 12) && !isVendorHouse(77, 0), 'a key is its own town\'s');
  ensureVendorHouses(17, 1000 + VENDOR_HOUSES_READ_S - 1);
  await settle();
  assert.deepEqual(asked, [17], 'read again only after VENDOR_HOUSES_READ_S');
  const v1 = vendorHousesVersion();
  ensureVendorHouses(17, 1000 + VENDOR_HOUSES_READ_S);
  await settle();
  assert.deepEqual(asked, [17, 17]);
  assert.equal(vendorHousesVersion(), v1, 'the same traders: no repaint');
  // a region past the Bay (TAMRIEL-WIDE): read and marked as the Bay's
  ensureVendorHouses(66, 1000);
  await settle();
  assert.ok(isVendorHouse(9100001, 3));
  rows[17] = [];
  ensureVendorHouses(17, 1000 + 2 * VENDOR_HOUSES_READ_S);
  await settle();
  assert.ok(!isVendorHouse(77, 5) && vendorHousesVersion() > v1, 'a trader shut is no longer marked');
  // the market shut, a refusal, no reader: nothing marked, nothing thrown
  _resetVendorHousesForTests();
  ensureVendorHouses(17, 0);
  registerVendorHouseReader(() => null);
  ensureVendorHouses(17, 0);
  ensureVendorHouses(-1, 0);
  await settle();
  assert.ok(!isVendorHouse(4000000000, 12));
  _resetVendorHousesForTests();
});

test('AUDIT TECH-FEEDBACK F4 VENDOR-HOUSES a read that failed: the market not open yet is asked again soon, a market shut marks nothing, a service error keeps what was read, a read never answered is let go (mutants: a failure waits the whole read; a shut market\'s houses kept; a hung read holds the region for good)', async () => {
  _resetVendorHousesForTests();
  let answer = null;
  const asked = [];
  registerVendorHouseReader((region) => { asked.push(region); return typeof answer === 'function' ? answer() : answer; });
  ensureVendorHouses(17, 1000);   // the market not open: the reader answers none
  await settle();
  ensureVendorHouses(17, 1000 + VENDOR_HOUSES_RETRY_S - 1);
  await settle();
  assert.deepEqual(asked, [17], 'not asked again at once');
  answer = { ok: true, data: { rows: [{ map: 77, buildingKey: 5 }] } };
  ensureVendorHouses(17, 1000 + VENDOR_HOUSES_RETRY_S);
  await settle();
  assert.deepEqual(asked, [17, 17], 'asked again after VENDOR_HOUSES_RETRY_S, not VENDOR_HOUSES_READ_S');
  assert.ok(VENDOR_HOUSES_RETRY_S < VENDOR_HOUSES_READ_S);
  assert.ok(isVendorHouse(77, 5));
  answer = { ok: false, error: 'server' };   // a service error: what was read stands
  ensureVendorHouses(17, 2000);
  await settle();
  assert.ok(isVendorHouse(77, 5));
  const v = vendorHousesVersion();
  answer = null;   // the market shut: nothing of it is marked
  ensureVendorHouses(17, 2000 + VENDOR_HOUSES_RETRY_S);
  await settle();
  assert.ok(!isVendorHouse(77, 5) && vendorHousesVersion() > v);
  // a read never answered is let go after VENDOR_HOUSES_HUNG_S, and its late answer marks nothing
  let late = null;
  answer = () => new Promise((r) => { late = r; });
  ensureVendorHouses(17, 3000);
  ensureVendorHouses(17, 3000 + VENDOR_HOUSES_HUNG_S - 1);
  assert.equal(asked.length, 5, 'held while it may still answer');
  answer = { ok: true, data: { rows: [{ map: 77, buildingKey: 9 }] } };
  ensureVendorHouses(17, 3000 + VENDOR_HOUSES_HUNG_S);
  await settle();
  assert.equal(asked.length, 6);
  const v2 = vendorHousesVersion();
  late({ ok: true, data: { rows: [{ map: 77, buildingKey: 1 }] } });
  await settle();
  assert.ok(isVendorHouse(77, 9) && !isVendorHouse(77, 1), 'the hung read\'s late answer is no one\'s');
  assert.equal(vendorHousesVersion(), v2, 'and repaints nothing');
  _resetVendorHousesForTests();
});

test('AUDIT TECH-FEEDBACK II F4/F5 VENDOR-HOUSES: a read that throws or rejects is a failure (asked again soon, its marks kept); a load forgets every read; nothing is marked while the market is shut (mutants: a rejection a success; a throw a shut market; the load remembered; the shut market marked)', async () => {
  _resetVendorHousesForTests();
  let mode = 'ok', open = true;
  const asked = [];
  registerVendorHouseReader((region) => {
    asked.push(region);
    if (mode === 'throw') throw new Error('boom');
    if (mode === 'reject') return Promise.reject(new Error('net'));
    return { ok: true, data: { rows: [{ map: 77, buildingKey: 5 }] } };
  }, { open: () => open });
  ensureVendorHouses(17, 1000, 1);
  await settle();
  assert.ok(isVendorHouse(77, 5));
  for (const [m, at] of [['reject', 1200], ['throw', 1200 + VENDOR_HOUSES_RETRY_S]]) {
    mode = m;
    ensureVendorHouses(17, at, 1);
    await settle();
    assert.ok(isVendorHouse(77, 5), `${m}: what was read stands`);
  }
  mode = 'ok';
  ensureVendorHouses(17, 1200 + 2 * VENDOR_HOUSES_RETRY_S, 1);
  await settle();
  assert.equal(asked.length, 4, 'each failure asked again after VENDOR_HOUSES_RETRY_S');
  open = false;
  assert.ok(!isVendorHouse(77, 5), 'the market shut: nothing marked');
  open = true;
  const v = vendorHousesVersion();
  ensureVendorHouses(66, 5000, 2);   // a load: another character, another door's law
  assert.ok(!isVendorHouse(77, 5) && vendorHousesVersion() > v, 'a load forgets every read');
  _resetVendorHousesForTests();
});

test('VENDOR-HOUSES the mark: a trader\'s house carries `vendor` through the rows and the sheet and is filled blue with a parchment door; my own stays red (mutants: the flag dropped at a read; the blue fill lost; a trader\'s house in my red)', () => {
  const buildings = [house(1, 0, 0, 30, 30), house(2, 1, 0, 60, 10), house(3, 1, 1, 10, 50)];
  const reg = new Map([[1, { owner: 'Mac', own: true }], [2, { owner: 'Gryphoth', own: false, vendor: true }], [3, { owner: 'Trader waypoint - Eve', own: false, vendor: true, waypoint: true }]]);
  const rows = townHomeRows({ buildings, mapId: 4000000000, regionIndex: 66, homeAt: (m, k) => reg.get(k) ?? null });
  assert.deepEqual(rows, [
    { buildingKey: 1, own: true, label: 'Your home' },
    { buildingKey: 2, own: false, vendor: true, label: "Gryphoth's home - trader" },
    { buildingKey: 3, own: false, vendor: true, label: "Trader waypoint - Eve's home" },
  ]);
  assert.deepEqual(readTownHomes(() => rows), rows);
  const s = createTownSheet({ gridW: 2, gridH: 2, blocks: [], buildings: () => buildings, discovered: () => [], homes: () => rows });
  assert.deepEqual(s.homes().map((h) => [h.own, h.vendor === true]), [[true, false], [false, true], [false, true]]);
  const ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const fills = ctx.calls.filter((c) => c.fn === 'fill').map((c) => c.fillStyle);
  assert.equal(fills.filter((f) => f === TOWN_PEN.vendor).length, 2, 'the two traders\' houses in blue');
  assert.equal(fills.filter((f) => f === TOWN_PEN.home).length, 1, 'my own in my ink');
  assert.equal(TOWN_PEN.vendor, PEN.vendor);
  assert.equal(PEN.vendor, 'rgba(24, 85, 190, 0.95)', 'classic\'s shop blue (townQuarters.js CLASSIC_ARGB.shop), at the pen\'s strength');
  const one = recordingCtx();
  paintHomeMark(one, 100, 200, true, true);
  assert.ok(one.calls.some((c) => c.fn === 'fill' && c.fillStyle === TOWN_PEN.home) && !one.calls.some((c) => c.fn === 'fill' && c.fillStyle === TOWN_PEN.vendor), 'my own trader is my house first');
});

test('VENDOR-HOUSES the wiring: the vendor host registers the directory\'s read, the market\'s gate on it', () => {
  assert.match(src('src/scenes/vendorHost.js'), /registerVendorHouseReader\(\(region\) => \(vendorMarketOpen\(\) \? vendorReachable\(region\) : null\), \{\n\s*open: vendorMarketOpen,\n\s*\}\);/);   // PIN MOVED (AUDIT TECH-FEEDBACK II F5)
});
