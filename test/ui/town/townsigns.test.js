// TOWN-SIGNS (a player's ask: a second look for the town map - "no text on the houses, only their icons"): the pictures
// (ui/town/townIcons.js, ui/ink/inkTown.js), the town sheet's two looks (ui/town/townSheet.js) and the button that switches them
// (ui/heldMap.js, by source). Driven through the real sheet and the real ink.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTownSheet } from '../../../src/ui/town/townSheet.js';
import { signKindOf, SIGN_KINDS, TOWN_MODES, nextTownMode, townModeOf } from '../../../src/ui/town/townIcons.js';
import { TOWN_SIGN_GLYPHS, BLOCK_PX } from '../../../src/ui/ink/inkTown.js';
import { toPaper } from '../../../src/ui/ink/inkMap.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { GUILD_FACTION_IDS, ORDERS } from '../../../src/systems/guild/guildFactions.js';
import { setPref, resetPrefs, _resetForTests, PREF_DEFAULTS } from '../../../src/systems/uiPrefs.js';

beforeEach(() => { _resetForTests(); resetPrefs(); });
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

function recordingCtx() {
  const calls = [], state = {};
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

test('TOWN-SIGNS kinds: a trade is its picture - the pawnbroker\'s balls, the Mages Guild\'s eye, the tavern\'s mug - a guild hall by WHICH guild, and a diamond for what has no trade (mutants: the guilds read as one; a trade left without a picture)', () => {
  const T = BUILDING_TYPES;
  const want = { [T.Alchemist]: 'potion', [T.Armorer]: 'shield', [T.Bank]: 'coin', [T.Bookseller]: 'book', [T.ClothingStore]: 'shirt', [T.FurnitureStore]: 'chair',
    [T.GemStore]: 'gem', [T.GeneralStore]: 'barrel', [T.Library]: 'tome', [T.PawnShop]: 'balls', [T.WeaponSmith]: 'sword', [T.Temple]: 'star', [T.Tavern]: 'mug', [T.Palace]: 'crown' };
  for (const [type, kind] of Object.entries(want)) assert.equal(signKindOf(Number(type)), kind, `type ${type}`);
  assert.equal(signKindOf(T.GuildHall, GUILD_FACTION_IDS.MagesGuild), 'eye');
  assert.equal(signKindOf(T.GuildHall, GUILD_FACTION_IDS.FightersGuild), 'swords');
  assert.equal(signKindOf(T.GuildHall, GUILD_FACTION_IDS.ThievesGuild), 'dagger');
  assert.equal(signKindOf(T.GuildHall, GUILD_FACTION_IDS.DarkBrotherhood), 'dagger');
  assert.equal(signKindOf(T.GuildHall, ORDERS.Horn), 'banner', 'a knightly order\'s hall');
  assert.equal(signKindOf(T.GuildHall, null), 'banner');
  for (const t of [T.House1, T.House3, T.HouseForSale, T.Ship, -1, undefined]) assert.equal(signKindOf(t), 'diamond');
  // every picture has its strokes, and nothing draws a kind the list does not carry
  assert.deepEqual(Object.keys(TOWN_SIGN_GLYPHS).sort(), [...SIGN_KINDS].sort());
  const kinds = new Set([...Object.values(want), 'eye', 'swords', 'dagger', 'banner', 'diamond']);
  assert.deepEqual([...kinds].sort(), [...SIGN_KINDS].sort(), 'each picture is some building\'s');
});

test('TOWN-SIGNS modes: two looks, Names by default, the press goes to the other and a bad stored word is Names (mutants: the default Signs; a third value kept)', () => {
  assert.deepEqual([...TOWN_MODES], ['names', 'signs']);
  assert.equal(PREF_DEFAULTS.townMapMode, 'names');
  assert.equal(nextTownMode('names'), 'signs');
  assert.equal(nextTownMode('signs'), 'names');
  assert.equal(townModeOf('signs'), 'signs');
  assert.equal(townModeOf('weird'), 'names');
  assert.equal(townModeOf(undefined), 'names');
});

function blockGrid(rects) {
  const g = new Uint8Array(BLOCK_PX * BLOCK_PX);
  for (const [x0, y0, x1, y1, v] of rects) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * BLOCK_PX + x] = v;
  return g;
}
const buildings = [
  { buildingKey: 1, buildingType: BUILDING_TYPES.PawnShop, factionId: 0, name: 'Pawnshop', blockX: 0, blockY: 0, position: [32, 0, 32], isResidence: false },
  { buildingKey: 2, buildingType: BUILDING_TYPES.GuildHall, factionId: GUILD_FACTION_IDS.MagesGuild, name: 'The Mages Guild', blockX: 0, blockY: 0, position: [64, 0, 48], isResidence: false },
  { buildingKey: 3, buildingType: BUILDING_TYPES.House1, factionId: 0, name: 'House', blockX: 0, blockY: 0, position: [48, 0, 64], isResidence: true },
  { buildingKey: 4, buildingType: BUILDING_TYPES.Tavern, factionId: 0, name: 'The Rusty Nail', blockX: 0, blockY: 0, position: [70, 0, 40], isResidence: false },
];
const discovered = [{ buildingKey: 1, displayName: 'Doctor Theodard\'s Pawnbrokers' }, { buildingKey: 2, displayName: 'The Mages Guild' }, { buildingKey: 3, displayName: 'House' }];   // the tavern is not found
const sheet = (homes = [{ buildingKey: 3, own: false, label: 'A player\'s house' }]) => createTownSheet({
  gridW: 1, gridH: 1, blocks: [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 60, 60, 1]]) }],
  buildings: () => buildings, discovered: () => discovered, homes: () => homes,
  player: () => ({ x: 4, y: 4, yaw: 0 }),
});
const ENV = { view: { ox: 0, oy: 0, scale: 12 }, paperW: 1200, paperH: 1200, dpr: 1, pulse: 0 };   // a block is BLOCK_PX layout pixels; this zoom puts the fixture's 64 on the paper
const texts = (ctx) => ctx.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);

test('TOWN-SIGNS the sheet: the Names look letters the buildings and marks a player\'s house; the Signs look letters nothing, marks no house and draws a picture for each building the discovery law would name - never an undiscovered one, never a plain residence (mutants: the lettering kept; the house kept; a hidden building drawn)', () => {
  const s = sheet();
  let ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  assert.ok(texts(ctx).length >= 1, 'Names: the buildings are lettered');
  assert.equal(s.homes().length, 1, '...and a player\'s house is on the sheet');
  setPref('townMapMode', 'signs');
  ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  assert.deepEqual(texts(ctx), [], 'Signs: not a word on the paper');
  const signs = s.signs(ENV.view);
  assert.deepEqual(signs.map((x) => x.kind).sort(), ['balls', 'eye'], 'the pawnshop\'s balls and the Mages Guild\'s eye - not the house (a residence is named by a quest alone), not the tavern nobody found');
  assert.ok(signs.every((x) => x.r >= 6 && x.r <= 13), 'a picture is a mark, whatever the zoom');
  const noHomes = recordingCtx();
  sheet([]).paintOverlay(noHomes, ENV);
  assert.deepEqual(ctx.calls, noHomes.calls, 'Signs: a player\'s house adds no mark to the paper');
  const homeArcs = ctx.calls.filter((c) => c.fn === 'moveTo').length;
  assert.ok(homeArcs > 0, 'the pictures are drawn');
  // the look is read at every paint: back to Names, the lettering is back
  setPref('townMapMode', 'names');
  ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  assert.ok(texts(ctx).length >= 1);
});

test('TOWN-SIGNS the pointer: in the Signs look a picture names its building, the nearest wins, and a pointer on bare paper says the town (mutants: the name lost with the lettering)', () => {
  setPref('townMapMode', 'signs');
  const s = sheet();
  const ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);   // the sheet remembers the view it was painted at
  const [pawn] = s.signs(ENV.view).filter((x) => x.kind === 'balls');
  const [px, py] = toPaper(ENV.view, pawn.x, pawn.y);
  assert.equal(s.hoverLabel(px + 2, py - 1).label, 'Doctor Theodard\'s Pawnbrokers');
  const [eye] = s.signs(ENV.view).filter((x) => x.kind === 'eye');
  const [ex, ey] = toPaper(ENV.view, eye.x, eye.y);
  assert.equal(s.hoverLabel(ex, ey).label, 'The Mages Guild');
  assert.notEqual(s.hoverLabel(1190, 1190).label, 'The Mages Guild', 'bare paper names nothing');
});

test('TOWN-SIGNS the button: a press of the look button on the map window turns the pref over and asks a repaint, its words say the look that is on, and only the town\'s sheet shows it (by source; mutants: the button never wired; shown on every sheet)', () => {
  const hm = rd('src/ui/heldMap.js');
  assert.match(hm, /const lookBtn = el\('button', 'act hmlook', ''\);\n\s*lookBtn\.onclick = \(\) => \{ if \(this\._phase === 'map'\) this\._toggleTownLook\(\); \};/);
  assert.match(hm, /top\.append\(label, search, note, lookBtn, findMe, close\);/, 'beside Find me');
  assert.match(hm, /setPref\('townMapMode', nextTownMode\(townModeOf\(getPref\('townMapMode'\)\)\)\);\n\s*this\._syncTownLook\(\);\n\s*this\._dirty = true;/);
  assert.match(hm, /b\.textContent = mode === 'signs' \? t\('townmap\.look\.signs', 'Look: Signs'\) : t\('townmap\.look\.names', 'Look: Names'\);/);
  assert.match(rd('src/ui/enhanced/enhancedStyle.js'), /\.hmroot:not\(\[data-hm-sheet="town"\]\) \.hmlook \{ display: none; \}/);
});

test('TOWN-SIGNS landmarks: a landmark with no trade (a city wall\'s gate) has no picture in the Signs look, a quest\'s named house keeps its diamond, and both are named in the Names look (mutants: the diamond drawn for a wall; a quest\'s building dropped with it)', () => {
  setPref('townMapMode', 'signs');
  const s = createTownSheet({
    gridW: 1, gridH: 1,
    blocks: [{ x: 0, y: 0, autoMap: blockGrid([[2, 2, 60, 60, 1]]), landmark: { name: 'City Wall', buildingType: BUILDING_TYPES.Town23, position: [10, 0, 10] } }],
    buildings: () => [{ buildingKey: 9, buildingType: BUILDING_TYPES.House1, factionId: 0, name: 'House', blockX: 0, blockY: 0, position: [32, 0, 32], isResidence: true, questName: 'Gareth\'s house', questMarked: true }],
    discovered: () => [{ buildingKey: 9, displayName: 'House' }],
    player: () => ({ x: 4, y: 4, yaw: 0 }),
  });
  assert.deepEqual(s.names().map((n) => n.text).sort(), ['City Wall', 'Gareth\'s house'], 'both are named by the discovery law');
  const signs = s.signs(ENV.view);
  assert.deepEqual(signs.map((x) => [x.kind, x.name]), [['diamond', 'Gareth\'s house']], 'the wall has no picture; the quest\'s house keeps its diamond');
});
