// UI3 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "move buffs/debuffs/etc to their own
// widget space somewhere on the side of the screen, where it doesn't interact with other UI elements, and use square
// icons with glyphs for each effect (climates and calories included) which then gives more space for the XP bar and
// being able to fit the XP amounts inside").
//
// THE STATUS WIDGET (ui/hudStatus.js, drawn by ui/enhancedHud.js): the effects leave the HUD's foot for a column of
// square tiles standing on the quickslot block's caption at the left edge - a spell's own ICON00I0 icon, a set power's
// rune in its set's colour, the port's pixel glyphs for the needs and for a poison and a disease (shown at last, on
// the Status box's own law); the frame says the kind, the foot the time left, an ending tile blinks; the band it grows
// in is measured against the chat, the escort faces and the touch buttons, and a long list wraps into a next column.
// The XP in the Renown bar is renown4/renownbar's; the phone's vitals are pinned here. What only a browser can say
// (the band on real screens, the glyphs drawn) is tools/uiStatusProbe.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  statusTiles, afflictionRows, needGlyph, statusGlyphSvg, statusGlyphSrc, statRoom, statRows, statSide, statPlace, statColumns, statOverflow,
  STATUS_GLYPHS, STAT_TILE, STAT_PIC, STAT_GAP, STAT_AIR, STAT_LIFT, STAT_TIGHT_ROWS, STAT_WIDE_COLUMNS, STAT_METRICS, STAT_SHORT_QUERY, STAT_MIDDLE_CLEAR,
  STAT_NAME_MAX, STAT_NAME_GAP,
} from '../src/ui/hudStatus.js';
import { DISEASE_NAMES, DISEASE_DATA, DISEASES } from '../src/systems/diseases.js';
import { POISONS } from '../src/systems/poisons.js';
import { healthStatusRows } from '../src/systems/healthStatus.js';
import { HUD_NEED_WORDS } from '../src/systems/survival/status.js';
import { createInfection } from '../src/systems/infection.js';
import { sigilRuneTileSrc, sigilRuneTileUrl, SIGIL_RUNE_TILE_URL } from '../src/ui/sigilRune.js';
import { setHudRenown } from '../src/ui/hudRenown.js';
import { BLINK_INTERVAL } from '../src/ui/hudActiveSpells.js';
import { _fittedKeys } from '../src/ui/textureCanvas.js';
import { initEscortFaces, restoreEscortFacesSaveData, clearEscortFaces, escortFacesBottom, ESCORT_START_Y, ESCORT_SPECIAL_FACE_SIZE } from '../src/ui/hudEscortFaces.js';
import { escortBottomPx } from '../src/ui/hud.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const rule = (sheet, sel) => {
  const at = sheet.indexOf(`\n${sel} {`);
  assert.ok(at >= 0, `${sel} has a rule`);
  return sheet.slice(at + 1, sheet.indexOf('}', at) + 1);
};

// ── THE TILES ───────────────────────────────────────────────────────

test('UI3 the tiles: a spell mine on me a buff and another\'s a debuff, its rounds at its foot, blinking as it ends and never an item\'s, its ICON00I0 index; a set power its set, its time at its foot, a recovery marked; a poison or disease a debuff with its glyph; a need felt amber (warn) and one that costs red (danger), its glyph; in the foot row\'s order (mutants: a debuff framed as a buff; an item blinking; the rounds dropped; a need that costs framed amber; the order turned)', () => {
  const tiles = statusTiles({
    spells: [
      { name: 'Shield', rounds: 12, expiring: false, item: false, icon: 5, self: true },
      { name: 'Paralysis', rounds: 1, expiring: true, item: false, icon: 20, self: false },
      { name: 'Ring of Warmth', rounds: 1, expiring: true, item: true, icon: 7, self: true },
      { name: 'Odd', rounds: null, expiring: false, item: false, icon: -1, self: true },
    ],
    powers: [{ key: 'wrath', set: 'ruhn', name: 'Wrath', text: '45s', state: 'active' }, { key: 'unbroken', set: 'malacath', name: 'Unbroken', text: '1:05', state: 'recovering' }],
    afflictions: [{ key: 'poison', name: 'Poisoned', glyph: 'poison' }],
    needs: [{ key: 'hunger', text: 'Hungry', level: 'warn', tier: 2, of: 3 }, { key: 'thirst', text: 'Parched', level: 'danger', tier: 2, of: 3 }, { key: 'temp', text: 'Freezing', level: 'danger', tier: 2, of: 3 }],
  });
  assert.deepEqual(tiles.map((t) => [t.kind, t.name]), [
    ['buff', 'Shield'], ['debuff', 'Paralysis'], ['buff', 'Ring of Warmth'], ['buff', 'Odd'],
    ['set', 'Wrath'], ['set', 'Unbroken'], ['debuff', 'Poisoned'],
    ['warn', 'Hungry'], ['danger', 'Parched'], ['danger', 'Freezing'],
  ], 'the spells, the set powers, the afflictions, the needs');
  const [shield, para, ring, odd, wrath, unbroken, poison, hungry, parched, freezing] = tiles;
  assert.deepEqual([shield.foot, shield.blink, shield.item, shield.spell, shield.glyph], ['12', false, false, 5, null]);
  assert.deepEqual([para.foot, para.blink], ['1', true], 'ending: it blinks');
  assert.deepEqual([ring.blink, ring.item], [false, true], 'an item\'s never blinks (SetIconBlinkState)');
  assert.deepEqual([odd.foot, odd.spell], [null, null], 'no rounds, no foot; no icon, no picture asked');
  assert.deepEqual([wrath.foot, wrath.set, wrath.recovering, unbroken.recovering, unbroken.foot], ['45s', 'ruhn', false, true, '1:05']);
  assert.deepEqual([poison.glyph, poison.foot, poison.blink], ['poison', null, false]);
  assert.deepEqual([hungry.glyph, parched.glyph, freezing.glyph], ['hunger', 'thirst', 'cold']);
  assert.deepEqual([hungry.foot, parched.foot, freezing.foot], ['2/3', '2/3', '2/3'], 'NEED-TIER: how bad, at its foot');
  assert.equal(statusTiles({ needs: [{ key: 'stiff', text: 'Stiff', level: 'warn' }] })[0].foot, null, 'one stage, no foot');
  assert.equal(new Set(tiles.map((t) => t.key)).size, tiles.length, 'every tile its own key');
  assert.deepEqual(statusTiles(), [], 'nothing: no tiles');
});

test('UI3 the spells, bundle by bundle (AUDIT UI C3/C5): a party mate\'s gift is a buff; each tile its own bundle\'s rounds, never another of its name\'s; an item\'s held magic no time at its foot (mutants: a mate\'s gift framed a debuff; the mate\'s mark dropped; the rounds by name; an item\'s rounds at its foot)', async () => {
  const { effectRows } = await import('../src/ui/enhancedHud.js');
  const b = (id, name, self, rounds, extra = {}) => ({ kind: 'shield', bundleId: id, bundleName: name, bundleIcon: 7, bundleSelfCast: self, roundsRemaining: rounds, ...extra });
  const rows = effectRows({ activeEffects: [
    b(1, 'Heal', true, 30), b(2, 'Heal', false, 1, { bundleAlly: true }), b(3, 'Curse', false, 9),
    b(4, 'Ring of Warmth', true, 0, { bundleType: 'HeldMagicItem' }),
  ] });
  assert.deepEqual(rows.map((r) => [r.name, r.rounds, r.self, r.ally]), [
    ['Heal', 30, true, false], ['Ring of Warmth', 0, true, false], ['Heal', 1, false, true], ['Curse', 9, false, false],
  ], 'mine first, each its own rounds');
  const tiles = statusTiles({ spells: rows });
  assert.deepEqual(tiles.map((t) => [t.name, t.kind, t.foot]), [
    ['Heal', 'buff', '30'], ['Ring of Warmth', 'buff', null], ['Heal', 'buff', '1'], ['Curse', 'debuff', '9'],
  ], 'the mate\'s Heal a buff with its own 1; the ring no clock');
});

test('UI3 the needs\' glyphs: every need the strip can raise has one - the temperature\'s by the way it runs, the cold words (read off the chips\' own table) a snowflake and the warm ones the sun (mutants: every temperature a sun; a need left without a glyph)', () => {
  for (const [w, [text]] of Object.entries(HUD_NEED_WORDS.temp)) {
    assert.equal(needGlyph({ key: 'temp', text }), ['cold', 'freezing', 'deadly cold'].includes(w) ? 'cold' : 'hot', text);
  }
  for (const key of [...Object.keys(HUD_NEED_WORDS).filter((k) => k !== 'temp'), 'stiff', 'drunk']) {
    assert.equal(needGlyph({ key, text: 'x' }), key, `${key} has its glyph`);
    assert.ok(statusGlyphSvg(key), `${key} draws`);
  }
  assert.equal(needGlyph({ key: 'nonsense' }), null);
  assert.equal(needGlyph(null), null);
});

// ── THE POISONS AND DISEASES ────────────────────────────────────────

test('UI3 the afflictions: the Status box\'s own law - one tile for being poisoned once a poison has left its waiting (however many, and still while its damage heals), a tile a disease once its incubation is over, by the name its message gives, and nothing for one still waiting or incubating, one ended, or an infection - the same entities the box itself answers (mutants: a waiting poison shown; a tile a poison; an incubating disease shown; an infection shown; an ended one shown)', () => {
  assert.deepEqual(afflictionRows(null), []);
  assert.deepEqual(afflictionRows({ activeEffects: [] }), []);
  const poison = (state, extra = {}) => ({ kind: 'poison', poison: POISONS.Arsenic, state, statMods: {}, ...extra });
  const disease = (type, over, extra = {}) => ({ kind: 'disease', disease: type, incubationOver: over, statMods: {}, ...extra });
  const cases = [
    [[poison('waiting')], []],
    [[poison('active')], ['Poisoned']],
    [[poison('active'), { ...poison('waiting'), poison: POISONS.Moonseed }, { ...poison('active'), poison: POISONS.Thyrwort }], ['Poisoned']],
    [[poison('complete', { statMods: { strength: -4 } })], ['Poisoned']],
    [[poison('active', { ended: true })], []],
    [[disease(DISEASES.WitchesPox, false)], []],
    [[disease(DISEASES.WitchesPox, true)], ["Witches' Pox"]],
    [[disease(DISEASES.Plague, true), disease(DISEASES.WizardFever, true), poison('active')], ['Poisoned', 'Plague', 'Wizard Fever']],
    [[disease(DISEASES.Cholera, true, { ended: true })], []],
    [[{ ...createInfection('vampirism'), incubationOver: true }], []],
  ];
  for (const [effects, want] of cases) {
    const e = { activeEffects: effects };
    const rows = afflictionRows(e);
    assert.deepEqual(rows.map((r) => r.name), want, JSON.stringify(effects));
    // the box: its record 117 exactly when the widget says Poisoned, record 100 + type exactly for each disease it names
    const box = healthStatusRows(e, (id) => [`#${id}`]);
    assert.equal(box.includes('#117'), want.includes('Poisoned'), 'the box says poisoned when the widget does');
    for (const [i, name] of DISEASE_NAMES.entries()) assert.equal(box.includes(`#${100 + i}`), want.includes(name), `${name}: the box and the widget agree`);
    assert.deepEqual(rows.map((r) => r.glyph), want.map((w) => (w === 'Poisoned' ? 'poison' : 'disease')));
  }
});

test('UI3 the diseases\' names are the seventeen the table carries, in its order - the names DISEASE_DATA\'s own rows are commented with (mutants: a name out of its place)', () => {
  assert.equal(DISEASE_NAMES.length, DISEASE_DATA.length);
  assert.equal(DISEASE_NAMES.length, Object.values(DISEASES).filter((v) => v >= 0).length);
  const src = read('src/systems/diseases.js');
  const table = src.slice(src.indexOf('export const DISEASE_DATA'), src.indexOf(']);', src.indexOf('export const DISEASE_DATA')));
  const commented = [...table.matchAll(/^\s*D\([^)]*\),\s*\/\/ (.+)$/gm)].map((m) => m[1].trim());
  assert.deepEqual([...DISEASE_NAMES], commented);
});

// ── THE GLYPHS ──────────────────────────────────────────────────────

test('UI3 the glyphs: eleven (REST1 the Rested campfire), each on the 16px grid the classic\'s spell icons use, every letter in its palette, every lit pixel outlined in the kit\'s black (no lit pixel touches the empty), drawn as runs, one source a name (mutants: a pixel unoutlined; a letter with no colour; the runs one rect a pixel)', () => {
  assert.deepEqual(Object.keys(STATUS_GLYPHS).sort(), ['cold', 'disease', 'drunk', 'hot', 'hunger', 'poison', 'rested', 'sleep', 'stiff', 'thirst', 'wet']);   // REST1: and the Rested campfire
  for (const [name, g] of Object.entries(STATUS_GLYPHS)) {
    assert.equal(g.rows.length, 16, `${name}: 16 rows`);
    let lit = 0;
    g.rows.forEach((row, y) => {
      assert.equal(row.length, 16, `${name} row ${y}: 16 pixels`);
      [...row].forEach((ch, x) => {
        if (ch === '.' || ch === 'k') return;
        lit++;
        assert.ok(/^#[0-9a-f]{6}$/.test(g.pal[ch] ?? ''), `${name}: '${ch}' has a colour`);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const n = g.rows[y + dy]?.[x + dx];
          assert.notEqual(n, '.', `${name} (${x},${y}): a lit pixel beside the empty - its outline is broken`);
        }
      });
    });
    assert.ok(lit > 20, `${name}: a picture, not a speck`);
    const svg = statusGlyphSvg(name);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">/);
    assert.ok(svg.includes('fill="#050608"'), 'the kit\'s black');
    const rects = (svg.match(/<rect /g) ?? []).length;
    const pixels = g.rows.join('').replace(/\./g, '').length;
    assert.ok(rects < pixels, `${name}: runs (${rects} rects for ${pixels} pixels)`);
    assert.equal(svg.match(/width="(\d+)"/g).map((w) => Number(w.slice(7, -1))).reduce((a, b) => a + b, 0), pixels, `${name}: every pixel drawn once`);
    assert.equal(statusGlyphSrc(name), statusGlyphSrc(name));
    assert.ok(statusGlyphSrc(name).startsWith('data:image/svg+xml;utf8,'));
  }
  assert.equal(statusGlyphSvg('nonsense'), null);
  assert.equal(statusGlyphSrc('nonsense'), null);
  assert.equal(statusGlyphSvg('toString'), null, 'own names only');
});

test('UI3 a set power\'s tile is its set\'s rune as a picture\'s source - the corner rune\'s own pixels and colour law (mutants: the source left a CSS url)', () => {
  assert.equal(`url("${sigilRuneTileSrc('#ec5a3c')}")`, sigilRuneTileUrl('#ec5a3c'));
  assert.ok(sigilRuneTileSrc('#ec5a3c').startsWith('data:image/svg+xml;utf8,'));
  assert.ok(sigilRuneTileSrc('#ec5a3c').includes(encodeURIComponent('#ec5a3c')));
  assert.equal(`url("${sigilRuneTileSrc('red')}")`, SIGIL_RUNE_TILE_URL, 'a colour that is none: the teal');
});

// ── THE BAND ────────────────────────────────────────────────────────

test('UI3 the band: the room above the caption is from it up to what stands above, less the air and the lift, over the HUD\'s scale (none, or less than none, where there is no band); beside the diamond it is from the caption - or from under what stands above, where that reaches lower - to the diamond\'s bottom; the rows and columns are the tiles those hold (mutants: the scale not divided; the air or the lift forgotten; the band beside from the caption under a chat; a row too many)', () => {
  // a laptop at 1x: the caption at 482, the chat's peek ending at 164
  assert.equal(statRoom({ captionTop: 482, above: 164, scale: 1 }), 482 - 164 - STAT_AIR - STAT_LIFT);
  assert.equal(statRows(statRoom({ captionTop: 482, above: 164, scale: 1 })), 7);
  assert.equal(statRoom({ captionTop: 482, above: 164, scale: 2 }), Math.floor((482 - 164 - STAT_AIR) / 2 - STAT_LIFT), 'at 2x the same band holds half the block\'s pixels');
  assert.equal(statRows(statRoom({ captionTop: 482, above: 164, scale: 2 })), 3);
  assert.equal(statRoom({ captionTop: 100, above: 300, scale: 1 }), 100 - 300 - STAT_AIR - STAT_LIFT, 'no band: less than none');
  assert.equal(statRoom({ captionTop: 400, above: -50, scale: Number.NaN }), 400 - STAT_AIR - STAT_LIFT, 'nothing above, a scale that is none read as 1');
  for (let n = 1; n <= 8; n++) {
    const exact = n * STAT_TILE + (n - 1) * STAT_GAP;
    assert.equal(statRows(exact), n, `${exact}px holds ${n}`);
    assert.equal(statRows(exact - 1), Math.max(1, n - 1), `${exact - 1}px does not`);
  }
  const short = STAT_METRICS.short;
  assert.equal(statRows(3 * short.tile + 2 * short.gap, short), 3, 'a short screen\'s rows in its own tiles');
  assert.equal(statColumns(3 * STAT_TILE + 2 * STAT_METRICS.full.colGap), 3);
  assert.equal(statColumns(3 * STAT_TILE + 2 * STAT_METRICS.full.colGap - 1), 2);
  assert.equal(statColumns(-40), 1, 'one column at the least');
  // beside the diamond: from the caption, or from under the chat where it reaches lower
  assert.deepEqual(statSide({ captionTop: 66, diamondBottom: 268, above: 0, scale: 1 }), { room: 202, offset: 0 });
  assert.deepEqual(statSide({ captionTop: 66, diamondBottom: 268, above: 172, scale: 1 }), { room: 268 - 180, offset: 180 - 66 }, 'a phone on its side: under the chat\'s peek lines');
  assert.deepEqual(statSide({ captionTop: 403, diamondBottom: 721, above: 0, scale: 1.5 }), { room: Math.floor(318 / 1.5), offset: 0 });
  assert.deepEqual(statSide({ captionTop: 66, diamondBottom: Number.NaN, above: 0, scale: 1 }), { room: 0, offset: 0 }, 'no diamond (the hotbar up): no band beside');
});

test('UI3 the place: above the caption while its band holds two rows (or every tile); beside the diamond where it holds one or none and the diamond holds more; nowhere - stepped aside - where neither holds one; the names only with three rows, two columns at the most and never beside; the columns stop short of the middle and the rest fold into one more tile, "+N" (mutants: beside with a band above; a strip of one row kept; over what stands above rather than aside; the names in a wall of columns; the named columns across the middle; the middle crossed; the fold one tile short)', () => {
  const rows = (n) => n * STAT_TILE + (n - 1) * STAT_GAP;
  const dia = rows(5);
  assert.deepEqual(statPlace({ room: rows(8), sideRoom: dia, count: 13 }), { side: false, rows: 8, columns: 2, tight: false, none: false }, 'a desk at rest: two columns of names');
  assert.deepEqual(statPlace({ room: rows(3), sideRoom: dia, count: 13 }), { side: false, rows: 3, columns: 5, tight: true, none: false }, 'five columns: icons alone');
  assert.equal(statPlace({ room: rows(2), sideRoom: dia, count: 13 }).side, false, 'two rows above: above');
  assert.deepEqual(statPlace({ room: rows(1), sideRoom: dia, count: 13 }), { side: true, rows: 5, columns: 3, tight: true, none: false }, 'one row above: a strip - beside instead');
  assert.equal(statPlace({ room: rows(1), sideRoom: dia, count: 1 }).side, false, '...unless one row holds them all');
  assert.equal(statPlace({ room: 0, sideRoom: rows(1), count: 4 }).side, true, 'none above: beside, even one row');
  assert.equal(statPlace({ room: rows(1), sideRoom: rows(1), count: 4 }).side, false, 'no more beside than above: above');
  assert.deepEqual(statPlace({ room: STAT_TILE - 1, sideRoom: STAT_TILE - 1, count: 4 }), { side: false, rows: 1, columns: 1, tight: true, none: true }, 'no band anywhere: stepped aside');
  assert.equal(statPlace({ room: rows(2), sideRoom: 0, count: 3 }).tight, true, 'two rows: icons alone');
  assert.equal(statPlace({ room: rows(3), sideRoom: 0, count: 3 * STAT_WIDE_COLUMNS }).tight, false, 'three rows, two columns: names');
  assert.equal(statPlace({ room: rows(3), sideRoom: 0, count: 3 * STAT_WIDE_COLUMNS + 1 }).tight, true, 'a third column: icons alone');
  // the columns: what the width to the middle holds
  assert.equal(statPlace({ room: rows(2), sideRoom: 0, count: 13, aboveWidth: 133 }).columns, 2, 'a phone\'s left half: two columns of icons');
  assert.equal(statPlace({ room: 0, sideRoom: rows(2), count: 13, sideWidth: 100, aboveWidth: 1000 }).columns, 2, 'beside: the width beside');
  const t = (n) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, kind: 'buff', name: `T${i}` }));
  assert.equal(statOverflow(t(4), { rows: 2, columns: 2 }).length, 4, 'all four fit');
  const folded = statOverflow(t(13), { rows: 2, columns: 2 });
  assert.deepEqual(folded.map((x) => x.key), ['k0', 'k1', 'k2', 'more'], 'three and one more');
  assert.deepEqual([folded[3].kind, folded[3].foot, folded[3].name], ['more', '+10', '10 more']);
  assert.equal(folded.length - 1 + 10, 13, 'the fold stands for every tile it hides');
  assert.equal(statOverflow(t(3), { rows: 1, columns: 1 }).at(-1).foot, '+3', 'one place: the fold alone');
  assert.equal(STAT_TIGHT_ROWS, 3);
  assert.ok(STAT_MIDDLE_CLEAR >= 9, 'the reticle\'s half and some air');
  // AUDIT UI C2: the names only where their columns fit short of the middle - a named column is the tile, the gap and
  // the name's widest
  const named2 = 2 * (STAT_TILE + STAT_NAME_GAP + STAT_NAME_MAX) + STAT_METRICS.full.colGap;
  assert.equal(statPlace({ room: rows(4), count: 8, aboveWidth: named2 }).tight, false, 'two named columns fit: names');
  assert.equal(statPlace({ room: rows(4), count: 8, aboveWidth: named2 - 1 }).tight, true, 'a pixel short: icons alone');
  assert.equal(statPlace({ room: rows(4), count: 4, aboveWidth: STAT_TILE + STAT_NAME_GAP + STAT_NAME_MAX }).tight, false, 'one named column');
});

// ── THE ESCORTS ─────────────────────────────────────────────────────

test('UI3 the escort faces\' bottom: how far down the drawn column reaches, in the classic\'s units and in the window\'s pixels (the canvas\'s pixels over its ratio to the window) - 0 with none (mutants: the column\'s top for its bottom; the canvas\'s pixels for the window\'s)', async () => {
  clearEscortFaces();
  assert.equal(escortFacesBottom(), 0);
  assert.equal(escortBottomPx({ width: 1920, height: 1080 }), 0);
  const bytes = new Uint8Array(64 * 64);
  initEscortFaces({ fetchBytes: async () => bytes, palette: { get: (i) => ({ r: i, g: i, b: i }) }, renderer: { uploadTexture: () => 'tex:face' } });
  restoreEscortFacesSaveData([{ factionFaceIndex: 0, questUID: 1, targetName: 'x' }]);
  assert.equal(escortFacesBottom(), 0, 'a face whose art has not landed is not drawn');
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(escortFacesBottom(), ESCORT_START_Y + ESCORT_SPECIAL_FACE_SIZE, 'the special face: 48 tall at 36');
  const had = Object.getOwnPropertyDescriptor(globalThis, 'innerHeight');
  try {
    globalThis.innerHeight = 1080;
    assert.equal(escortBottomPx({ width: 1920, height: 1080 }), 84 * 5, 'at 1080p: scale 5');
    globalThis.innerHeight = 540;
    assert.equal(escortBottomPx({ width: 1920, height: 1080 }), 84 * 5 / 2, 'a canvas at twice the window\'s pixels');
  } finally {
    if (had) Object.defineProperty(globalThis, 'innerHeight', had); else delete globalThis.innerHeight;
    clearEscortFaces();
  }
});

// ── THE HUD, EXECUTED ───────────────────────────────────────────────

const mkEl = (tag = 'div') => ({
  tag, className: '', textContent: '', id: '', rel: '', href: '', src: '', alt: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; this[a] = ''; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener(type, fn) { (this._on ??= {})[type] = fn; },
});
const find = (node, cls) => {
  if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
  return null;
};
const spellEntry = (id, name, icon, self, rounds, type = 'Spell') => ({ kind: 'shield', bundleId: id, bundleName: name, bundleIcon: icon, bundleSelfCast: self, bundleType: type, roundsRemaining: rounds });

test('UI3 the HUD, executed: the widget is the quickslot block\'s first child, on its caption, and the foot has no status row; a tile a spell (its icon asked fitted at the tile\'s 32px), a set power (its rune in its colour, its shades), a poison and a disease (their glyphs); the grid\'s rows the tiles the band holds; rebuilt only when what it says changes; the band measured against the chat, the HUD\'s top block, the touch presses short of the middle and the escort faces - beside the diamond against what crosses its rows - a short one dropping the names (mutants: the widget in the foot; rebuilt every frame; the band never measured; the chat ignored; the escorts ignored; the top block ignored; the touch presses ignored; a press past the middle counted; the escorts ignored beside; the band beside over a chat)', async () => {
  const prev = globalThis.document;
  let chat = null;
  globalThis.document = {
    createElement: (t) => mkEl(t), createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
    querySelector: (sel) => (sel === '.dfchat' ? chat : null),
    querySelectorAll: (sel) => [...(chat && sel.includes('.dfchat') ? [chat] : []), ...(touchBtn && sel.includes('.dftouch-btn') ? [touchBtn] : [])],
  };
  let touchBtn = null;
  const { drawEnhancedHud, destroyEnhancedHud, setHudSetChips } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const entity = {
    health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null,
    activeEffects: [
      spellEntry(1, 'Shield', 5, true, 12),
      spellEntry(2, 'Paralysis', 20, false, 1),
      { kind: 'poison', poison: POISONS.Arsenic, state: 'active', statMods: {} },
      { kind: 'disease', disease: DISEASES.Plague, incubationOver: true, statMods: {} },
    ],
  };
  setHudSetChips(() => [{ key: 'wrath', set: 'ruhn', name: 'Wrath', text: '45s', state: 'active' }]);
  const opts = { weapon: null, weaponSheathed: true };
  try {
    setHudRenown(null);
    drawEnhancedHud(entity, 0, 0, opts);
    const root = document.body.children.find((n) => n.className === 'hud');
    const quick = find(root, 'hud-quick');
    assert.deepEqual(quick.children.map((n) => n.className), ['hud-stat', 'hud-qcap', 'hud-qdiamond'], 'on the caption, in the block');
    assert.deepEqual(find(root, 'hud-bottom').children.map((n) => n.className), ['hud-hotdock', 'hud-breath', 'hud-breath hud-grip', 'hud-bars', 'hud-renown'], 'and not in the foot (CLIMB2: the grip beside the breath)');
    const stat = quick.children[0];
    assert.deepEqual(stat.children.map((c) => c.className), [
      'hst-cell buff', 'hst-cell debuff blink', 'hst-cell set', 'hst-cell debuff', 'hst-cell debuff',
    ]);
    const names = stat.children.map((c) => find(c, 'hst-name').textContent);
    assert.deepEqual(names, ['Shield', 'Paralysis', 'Wrath', 'Poisoned', 'Plague']);
    assert.deepEqual(stat.children.map((c) => find(c, 'hst-foot')?.textContent ?? null), ['12', '1', '45s', null, null]);
    assert.ok(_fittedKeys().includes('spellicon5@32x1c4w'), 'the spell\'s own icon, asked whole at the tile\'s picture box');
    assert.ok(_fittedKeys().includes('spellicon20@32x1c4w'));
    assert.equal(find(stat.children[0], 'hst-pic').style.visibility, 'hidden', 'the frame stands empty until the icon lands (node has no sheet)');
    const set = stat.children[2];
    assert.equal(set.dataset.set, 'ruhn');
    assert.equal(set.style['--set'], '#ffae45', 'the set\'s colour for its frame');
    assert.equal(find(set, 'hst-pic').src, sigilRuneTileSrc('#ffae45'), 'its rune in it');
    assert.equal(stat.children[3].dataset.glyph, 'poison');
    assert.equal(find(stat.children[3], 'hst-pic').src, statusGlyphSrc('poison'));
    assert.equal(stat.children[4].dataset.glyph, 'disease');
    assert.equal(stat.style.gridTemplateRows, `repeat(5, ${STAT_TILE}px)`, 'five tiles in a band not yet measured (five rows): one column');
    assert.equal(stat.classList.contains('tight'), false);
    // unchanged: not rebuilt
    const first = stat.children[0];
    drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.children[0], first, 'what it says has not changed: the same nodes');
    // a round passes: the foot changes, the widget is rebuilt
    entity.activeEffects[0].roundsRemaining = 11;
    drawEnhancedHud(entity, 0, 0, opts);
    assert.notEqual(stat.children[0], first);
    assert.equal(find(stat.children[0], 'hst-foot').textContent, '11');
    // THE BAND: the caption at 300, the chat's box ending at 180 - (300 - 180 - 8) - 8 = 104px, two rows
    const cap = find(quick, 'hud-qcap');
    cap.getBoundingClientRect = () => ({ top: 300, bottom: 320, height: 20, left: 54 });
    chat = { getBoundingClientRect: () => ({ top: 44, bottom: 180, height: 136, left: 14, right: 454, width: 440 }) };
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.style.gridTemplateRows, `repeat(2, ${STAT_TILE}px)`, 'the chat bounds it: two rows, the rest in the next columns');
    assert.equal(stat.classList.contains('tight'), true, 'under three rows: the names go');
    // the chat closed to a line: room again
    chat = { getBoundingClientRect: () => ({ top: 44, bottom: 62, height: 18, left: 14, right: 454, width: 440 }) };
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.style.gridTemplateRows, `repeat(5, ${STAT_TILE}px)`);
    assert.equal(stat.classList.contains('tight'), false);
    // AUDIT UI C1: offline, the HUD's own top block bounds it - the compass and a foe's bar reaching down to 220, across
    // the widget's half of the screen: (300 - 220 - 8) - 8 = 64, one row (a column climbed into the compass before)
    chat = null;
    const hadIW = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
    globalThis.innerWidth = 1000;
    find(root, 'hud-top').getBoundingClientRect = () => ({ top: 18, bottom: 220, height: 202, left: 240, right: 760, width: 520 });
    try {
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
      assert.equal(stat.style.gridTemplateRows, `repeat(1, ${STAT_TILE}px)`, 'the compass and the foe bar bound it');
      // AUDIT UI C4: a touch press where it really stands - a notch's safe area below it, down to 260: no row above
      find(root, 'hud-top').getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 });
      touchBtn = { getBoundingClientRect: () => ({ top: 75, bottom: 260, height: 185, left: 16, right: 64, width: 48 }) };
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
      assert.equal(stat.classList.contains('noroom'), true, 'the press bounds it (no diamond measured beside: stepped aside)');
      // ...and one wholly right of the middle is not above it
      touchBtn = { getBoundingClientRect: () => ({ top: 16, bottom: 290, height: 274, left: 600, right: 648, width: 48 }) };
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
      assert.equal(stat.classList.contains('noroom'), false, 'a press past the middle stands over no part of it');
    } finally {
      touchBtn = null;
      if (hadIW) Object.defineProperty(globalThis, 'innerWidth', hadIW); else delete globalThis.innerWidth;
    }
    find(root, 'hud-top').getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 });
    // an escort's face reaching down to 250: (300 - 250 - 8) - 8 = 34 - no row above, and no diamond measured beside
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 250 });
    assert.equal(stat.classList.contains('noroom'), true, 'the escort faces bound it too: no band anywhere, it steps aside');
    // the diamond measured: beside it, from the caption (the escort ends above it) to the diamond's bottom - 180px, four rows
    find(quick, 'hud-qdiamond').getBoundingClientRect = () => ({ top: 338, bottom: 480, height: 142 });
    quick.getBoundingClientRect = () => ({ left: 24, right: 256, top: 300, bottom: 502 });
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 250 });
    assert.equal(stat.classList.contains('noroom'), false);
    assert.equal(stat.classList.contains('side'), true, 'beside the diamond');
    assert.equal(stat.style.top, '0px', 'from the caption\'s top');
    assert.equal(stat.style.gridTemplateRows, `repeat(4, ${STAT_TILE}px)`);
    assert.equal(stat.classList.contains('tight'), true, 'beside: icons alone');
    // an escort reaching below the caption, to 350: beside from under it (358) to 480 - 122px, two rows, 58px down
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 350 });
    assert.equal(stat.style.top, '58px', 'beside, from under what stands above');
    assert.equal(stat.style.gridTemplateRows, `repeat(2, ${STAT_TILE}px)`);
    // a chat crossing the diamond's own rows from BELOW the caption's top (a phone on its side): it stands over no part of
    // the band above, and beside the diamond the band starts under it - the top block down to 280 leaves nothing above
    // ((300 - 280 - 8) - 8 = 4); the chat 310-400 crosses the rows right of the block: beside from 408 to 480, one row
    const hadIW2 = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
    globalThis.innerWidth = 1000;
    find(root, 'hud-top').getBoundingClientRect = () => ({ top: 18, bottom: 280, height: 262, left: 240, right: 760, width: 520 });
    chat = { getBoundingClientRect: () => ({ top: 310, bottom: 400, height: 90, left: 14, right: 454, width: 440 }) };
    try {
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
      assert.equal(stat.classList.contains('side'), true, 'beside the diamond');
      assert.equal(stat.style.top, '108px', 'from under the chat that crosses its rows (408 - 300)');
      assert.equal(stat.style.gridTemplateRows, `repeat(1, ${STAT_TILE}px)`);
    } finally {
      chat = null;
      if (hadIW2) Object.defineProperty(globalThis, 'innerWidth', hadIW2); else delete globalThis.innerWidth;
      find(root, 'hud-top').getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0 });
    }
    // a narrow screen: the width to the middle holds two columns - two rows by two, the last the fold
    const hadW = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
    globalThis.innerWidth = 2 * (256 + 8 + 2 * STAT_TILE + 14 + 24);
    try {
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 350 });
    } finally { if (hadW) Object.defineProperty(globalThis, 'innerWidth', hadW); else delete globalThis.innerWidth; }
    assert.deepEqual(stat.children.map((c) => find(c, 'hst-name').textContent), ['Shield', 'Paralysis', 'Wrath', '2 more'], 'five tiles in four places: the last two folded, never past the middle');
    assert.equal(find(stat.children[3], 'hst-foot').textContent, '+2');
    assert.equal(find(stat.children[3], 'hst-pic').style.display, 'none', 'the fold is its count alone');
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 350 });
    assert.equal(stat.children.length, 5, 'room again (no width to the middle measured): every tile');
    // a short screen (a phone on its side): the rows counted in its smaller tiles, and its spell icons asked at its box
    const hadMM = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
    globalThis.matchMedia = (q) => ({ matches: q === STAT_SHORT_QUERY });
    try {
      for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, { ...opts, escortBottom: 350 });
    } finally { if (hadMM) Object.defineProperty(globalThis, 'matchMedia', hadMM); else delete globalThis.matchMedia; }
    const shortRows = statRows(480 - 358, STAT_METRICS.short);
    assert.equal(stat.style.gridTemplateRows, `repeat(${shortRows}, ${STAT_METRICS.short.tile}px)`, 'the short tiles\' rows');
    assert.ok(_fittedKeys().includes(`spellicon5@${STAT_METRICS.short.pic}x1c4w`), 'the short picture box');
    // everything gone: no tiles
    entity.activeEffects = [];
    setHudSetChips(null);
    drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.children.length, 0, 'empty - and the sheet takes an empty widget away');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setHudSetChips(null);
    setHudRenown(null);
    globalThis.document = prev;
  }
});

test('UI3 AUDIT UI C: a new window size measures the band on the frame it comes, not half a second on; a new screen ratio asks the spell icons again at it; the touch layer\'s presses carry the class the band reads (mutants: the band kept over a rotation; the ratio out of the widget\'s key; the presses unnamed)', async () => {
  const prev = globalThis.document;
  let chat = null;
  globalThis.document = {
    createElement: (t) => mkEl(t), createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
    querySelector: () => null,
    querySelectorAll: (sel) => (chat && sel.includes('.dfchat') ? [chat] : []),
  };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const entity = {
    health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null,
    activeEffects: [spellEntry(1, 'Shield', 43, true, 12), spellEntry(2, 'Paralysis', 44, false, 9), spellEntry(3, 'Light', 45, true, 30)],
  };
  const opts = { weapon: null, weaponSheathed: true };
  const hadIW = Object.getOwnPropertyDescriptor(globalThis, 'innerWidth');
  const hadDpr = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  try {
    setHudRenown(null);
    globalThis.innerWidth = 1000;
    drawEnhancedHud(entity, 0, 0, opts);
    const root = document.body.children.find((n) => n.className === 'hud');
    const quick = find(root, 'hud-quick');
    const stat = quick.children[0];
    find(quick, 'hud-qcap').getBoundingClientRect = () => ({ top: 300, bottom: 320, height: 20, left: 54 });
    for (let i = 0; i < 30; i++) drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.style.gridTemplateRows, `repeat(3, ${STAT_TILE}px)`, 'measured: nothing above, a row a tile');
    // the chat's box opens down to 180: between measures the band stands...
    chat = { getBoundingClientRect: () => ({ top: 44, bottom: 180, height: 136, left: 14, right: 454, width: 440 }) };
    drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.style.gridTemplateRows, `repeat(3, ${STAT_TILE}px)`, 'read every thirty frames');
    // ...but a window turned is measured on the frame it comes: (300 - 180 - 8) - 8 = 104, two rows
    globalThis.innerWidth = 900;
    drawEnhancedHud(entity, 0, 0, opts);
    assert.equal(stat.style.gridTemplateRows, `repeat(2, ${STAT_TILE}px)`, 'a new size: the band at once');
    // a new screen ratio (a zoom, the window dragged to another monitor): the icons asked again at it
    assert.ok(_fittedKeys().includes('spellicon43@32x1c4w'));
    assert.ok(!_fittedKeys().includes('spellicon43@32x2c4w'));
    globalThis.devicePixelRatio = 2;
    drawEnhancedHud(entity, 0, 0, opts);
    assert.ok(_fittedKeys().includes('spellicon43@32x2c4w'), 'fitted at the new ratio');
    assert.ok(_fittedKeys().includes('spellicon44@32x2c4w'));
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setHudRenown(null);
    globalThis.document = prev;
    if (hadIW) Object.defineProperty(globalThis, 'innerWidth', hadIW); else delete globalThis.innerWidth;
    if (hadDpr) Object.defineProperty(globalThis, 'devicePixelRatio', hadDpr); else delete globalThis.devicePixelRatio;
  }
  // AUDIT UI C4: the touch layer's presses are found by their class, wherever the safe area puts them
  assert.match(read('src/ui/touch.js'), /const b = document\.createElement\('div'\);\n\s+b\.className = 'dftouch-btn';/);
});

// ── THE SHEET ───────────────────────────────────────────────────────

test('UI3 the sheet: the tile, its picture, the rows\' gap and the lift are the module\'s numbers; the frame\'s kinds; an empty widget takes no room; the names go on a phone, a short screen and a tight band; an ending picture blinks DFU\'s own quarter second and stands still for reduced motion; the phone\'s vitals say their numbers alone; no status row, and no chips in the kit (mutants: the tile\'s size drifted from the module; the names kept on a phone; the blink never stilled; the phone\'s words kept)', async () => {
  const { ENHANCED_CSS } = await import('../src/ui/enhancedStyle.js');
  const { PLUS_CSS } = await import('../src/ui/enhancedPlusStyle.js');
  const C = ENHANCED_CSS;
  assert.match(rule(C, '.hst-tile'), new RegExp(`width: ${STAT_TILE}px; height: ${STAT_TILE}px;[^}]*border: 2px solid;`));
  assert.equal(STAT_TILE - 2 * 2, STAT_PIC, 'the picture fills the frame');
  assert.match(rule(C, '.hst-pic'), new RegExp(`width: ${STAT_PIC}px; height: ${STAT_PIC}px; image-rendering: pixelated;`));
  assert.equal(rule(C, '.hud-stat'), `.hud-stat { display: grid; grid-auto-flow: column; grid-auto-columns: max-content; gap: ${STAT_GAP}px 14px; margin-bottom: ${STAT_LIFT}px; }`);
  assert.match(C, /\n\.hud-stat:empty \{ display: none; \}/);
  for (const [kind, hi, lo] of [['buff', '#b9f0c4', '#216b3b'], ['debuff', '#f2a597', '#8a2820'], ['warn', '#f3cf86', '#7a5424'], ['danger', '#ff9a7a', '#b53a2e']]) {
    assert.equal(rule(C, `.hst-cell.${kind}`), `.hst-cell.${kind} { --hst-hi: ${hi}; --hst-lo: ${lo}; }`, kind);
  }
  assert.match(rule(C, '.hst-tile'), /border-color: var\(--hst-hi\) var\(--hst-lo\) var\(--hst-lo\) var\(--hst-hi\);/, 'lit from the top left');
  assert.match(C, /\n\.hst-cell\.item \.hst-tile \{ border-style: dashed; \}/);
  assert.match(C, /\n\.hud-stat\.tight \.hst-name \{ display: none; \}/);
  assert.match(rule(C, '.hst-name'), new RegExp(`max-width: ${STAT_NAME_MAX}px;`), 'the name\'s widest the module counts');
  assert.match(rule(C, '.hst-cell'), new RegExp(`gap: ${STAT_NAME_GAP}px;`), 'and the gap beside it');
  // a short screen: the sheet's numbers are the module's short metrics, under the module's own query
  const { tile: st, pic: sp, gap: sg, colGap: sc } = STAT_METRICS.short;
  assert.ok(C.includes(`\n@media ${STAT_SHORT_QUERY} {\n  .hst-tile { width: ${st}px; height: ${st}px; }\n  .hst-pic { width: ${sp}px; height: ${sp}px; }\n  .hud-stat { gap: ${sg}px ${sc}px; }\n}`), 'the short tiles');
  assert.equal(st - 2 * 2, sp, 'the short picture fills its frame too');
  assert.ok(C.includes(`@media (max-width: 640px), ${STAT_SHORT_QUERY} { .hud-stat .hst-name { display: none; } }`), 'the names go on a phone and a short screen');
  assert.match(rule(C, '.hud-stat'), new RegExp(`gap: ${STAT_GAP}px ${STAT_METRICS.full.colGap}px;`), 'the full column gap the module counts');
  // beside the diamond, stepped aside, the fold
  assert.equal(rule(C, '.hud-stat.side'), '.hud-stat.side { position: absolute; left: 100%; top: 0; margin: 0 0 0 8px; }');
  assert.equal(rule(C, '.hud-stat.noroom'), '.hud-stat.noroom { display: none; }');
  assert.match(C, /\n\.hst-cell\.more \.hst-foot \{ position: static; transform: none;/);
  assert.match(C, /\n@media \(max-width: 640px\), \(max-height: 500px\) \{ \.hud-stat \.hst-name \{ display: none; \} \}/);
  assert.match(C, new RegExp(`\\n\\.hst-cell\\.blink \\.hst-pic \\{ animation: hst-blink ${BLINK_INTERVAL * 2}s steps\\(1, end\\) infinite; \\}\\n@keyframes hst-blink \\{ 50% \\{ opacity: 0; \\} \\}`), 'a quarter second off, a quarter on');
  assert.match(C, /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.hst-cell\.blink \.hst-pic \{ animation: none; \}/);
  assert.match(PLUS_CSS, /@media \(max-width: 640px\) \{\n {2}\.hud-vlabel \{ display: none; \}\n {2}\.hud-vital \.hud-track \{ justify-content: center; \}\n {2}\.hud-num \{ padding-right: 0; \}\n\}/);
  assert.ok(PLUS_CSS.indexOf('@media (max-width: 640px) {\n  .hud-vlabel') > PLUS_CSS.indexOf('.hud-num { position: relative; z-index: 1; padding-right: 10px;'), 'after the number\'s own padding, so it wins');
  assert.doesNotMatch(C, /\.hud-effects|\.hud-needs|\.hud-status|\.hud-eff\b|\.hud-need\b/);
  assert.doesNotMatch(read('src/ui/enhancedFrame.js'), /'\.hud-eff'|'\.hud-need'/, 'the kit dresses no chip that is gone');
  const hud = read('src/ui/enhancedHud.js');
  assert.doesNotMatch(hud, /'hud-effects'|'hud-needs'|'hud-status'|hud-eff |hud-need /, 'the HUD builds none');
  assert.match(read('src/ui/hud.js'), /\n {6}escortBottom: escortBottomPx\(canvas\),/, 'the host hands the widget the escort faces\' bottom');
});
