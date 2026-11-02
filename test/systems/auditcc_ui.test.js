import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SURVIVAL_RULES } from '../../src/systems/survival/difficulty.js';
import { newSurvival, survivalMinute, warmedByFire } from '../../src/systems/survival/needs.js';
import { temperatureWord } from '../../src/systems/survival/temperature.js';
import { survivalFeed, feltNow } from '../../src/systems/survival/env.js';
import { HUD_NEED_WORDS, LEVEL_WORDS, needLevel, levelSaid, survivalHudChips, temperatureReadout, survivalStatusLines, STATUS_TEXT, STATUS_LINE_MAX } from '../../src/systems/survival/status.js';
import { SURVIVAL_PREF } from '../../src/systems/survival/switch.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { LOOT_RARITY_KEY, applyRarity, WARDROBE_LEGENDARIES } from '../../src/systems/loot/lootRarity.js';
import '../../src/systems/loot/lootPowers.js';   // the game imports it, and its folds register at import (LOOT15's degrees)
import { itemIsIdentified } from '../../src/systems/tradeModes.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { assignStartingGear } from '../../src/systems/startingGear.js';
import { SKILLS } from '../../src/systems/skills.js';
import { equipItem } from '../../src/systems/equip.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';
import { RACES } from '../../src/systems/races.js';
import { statusTiles, STATUS_GLYPHS } from '../../src/ui/hud/hudStatus.js';
import { HUD_PIECES, HUD_LAYOUT_CSS, HUD_LAYOUT_PREF, sweepHudLayout, _resetHudLayoutForTests } from '../../src/ui/hud/hudLayout.js';
import { packTemperature, temperaturePlaque, temperatureWear, boonStatRows } from '../../src/ui/temperatureCard.js';
import { asKnown, wearComparison } from '../../src/ui/armourCard.js';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { HOTBAR_PREF } from '../../src/ui/enhanced/enhancedHotbar.js';
import { PACE_BOX_ID } from '../../src/ui/travel/travelPaceControls.js';
import { buildStatsPage } from '../../src/ui/statsCard.js';
import { ARMOUR_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';
import { GRIMOIRE_KIT_CSS, GRIM_TONES, TEMP_INK } from '../../src/ui/grimoireDress.js';
import { statusReadoutRows } from '../../src/ui/statusBox.js';
import { CREDITS } from '../../src/ui/credits.js';
import { TUTORIALS } from '../../src/systems/tutorialCatalogue.js';
import { rulesOf } from '../sheetRules.mjs';
import { withDom } from '../invdrag.mjs';

// ═══ AUDIT C&C - THE SURFACES (2026-10-12) ═══════════════════════════════
//
// Lens S (what the player sees) and lens R (the records and the pins) of AUDIT C&C, the comprehensive audit of the
// Climates & Calories arc, each finding reproduced in Chromium or through the real producers before it was fixed: the
// pack's Felt plaque stood on the R-Weapon panel (S1); the HUD's plate ran off the screen at legal HUD scales, went with
// the compass's X, stayed compact after a scale came back and stood under the FPS read-out (S3, S10, S12); the Grimoire
// dress framed every plate in the one wood and wrote every plaque in the red of a cost (S4); Hard's costing Tired, Warm
// and Stiff were amber and a Drenched that costs nothing of its own was red (S5); the strip read the record and the
// plate the live air (S9); an unidentified piece's comparison counted its hidden power (S6); the credits said Boons
// takes nothing (S8); the Status page read the tier a minute late (S11); the first-need tutorial's words (S13); a cost
// said in colour alone (S14); a red thermometer on the comfortable reading (D6); the hearth's glyph misnamed (R11); and
// the pins that did not fail (R5, R6, R7). Every fixture is a real producer's - chargen's own character and kit, the
// real feed and minute law, the real pack, HUD, menu and sheet builders - and every number a literal (A PIN MUST FAIL).

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const HARD = SURVIVAL_RULES.hard, CASUAL = SURVIVAL_RULES.casual, BOONS = SURVIVAL_RULES.boons;
const CAREER = buildCustomCareer({ name: 'Wanderer', hp: 12,
  skills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike, SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping, SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 } });
/** A REAL CHARACTER, made on `p` - the chargen flow's own producers: a custom career, createCharacter, and the starting
 *  kit and the survival provisions through assignStartingGear (the shirt and the pants worn through equipItem). */
function realPlayer(tier = 'casual', p = { isPlayer: true, reflexes: 2, items: [], activeEffects: [] }) {
  setPref(SURVIVAL_PREF, tier);
  Object.assign(p, { gender: 'male', raceId: RACES.Breton });
  createCharacter(p, CAREER, -1, { rolls: () => 0.5 });
  p.raceId = RACES.Breton; p.gender = 'male';
  assignStartingGear(p, { isCustom: true, rolls: () => 0.25, torchesFromItems: false });
  return p;
}
/** A garment through the kit's own minter, carried and worn through the real equip path. */
const garment = (templateIndex, variant = 0) => mintCondition(setItemFields({ group: 'MensClothing', templateIndex, variant }));
const wear = (e, item) => { e.items.push(item); equipItem(e, item); return item; };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
/** A minute through the real feed and law, as a host's ticker runs it - what it drained, wounded and took read back. */
function minute(e, env, now) {
  let drained = 0, hurt = 0;
  const f = survivalFeed(e, env);
  survivalMinute(e, now, f.env, { ...f.deps, sinks: { drainFatigue: (n) => { drained += n; }, restoreFatigue: () => {}, hurt: (n) => { hurt += n; }, say: () => {} }, autoDrink: false, autoEat: false, rolls: () => 0.99 });
  const took = Object.values(e.activeEffects.find((a) => a?.kind === 'survival')?.statMods ?? {}).some((v) => v < 0);
  return { drained, hurt, took, felt: e.survival.felt };
}
/** Indoors in the woods in midsummer: comfortable in the starting clothes - a room that charges nothing. */
const ROOM = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 6, hour: 12, weather: 'sunny', insideBuilding: true });
const MOUNTAIN_NIGHT = Object.freeze({ climateIndex: CLIMATES.Mountain, month: 0, hour: 2, weather: 'cloudy' });
/** A winter evening in the woods, overcast: -25 in the starting clothes - Cold, felt in Casual and charged in Hard. */
const WOODS_EVENING = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 0, hour: 17, weather: 'cloudy' });
const RAIN_NIGHT = Object.freeze({ climateIndex: CLIMATES.Woodlands, month: 0, hour: 21, weather: 'rain' });

afterEach(() => { _resetForTests(); _resetHudLayoutForTests(); });

// ── a document just real enough for the HUD's build and HUD-MOVE's sweep ────────────────────────────────────────────
/** A tree, classes, attributes and the dataset (a data- attribute and the dataset are one), style properties, boxes a
 *  test sets, and the selectors the HUD and the sweep ask: a list, a descendant, a tag, a class, an id, an attribute. */
function hudDoc() {
  const camel = (k) => k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const all = (n, out = []) => { for (const c of n.children) { out.push(c); all(c, out); } return out; };
  const compound = (n, s) => {
    const tag = /^[a-z][\w-]*/i.exec(s)?.[0];
    if (tag && n.tagName !== tag.toUpperCase()) return false;
    for (const m of s.matchAll(/\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      if (m[1] && !n.classList.contains(m[1])) return false;
      if (m[2] && n.id !== m[2]) return false;
      if (m[3] && (!n.hasAttribute(m[3]) || (m[4] != null && n.getAttribute(m[3]) !== m[4]))) return false;
    }
    return true;
  };
  const matches = (n, sel) => String(sel).split(',').some((one) => {
    const parts = one.trim().split(/\s+/);
    if (!parts[0] || !compound(n, parts.at(-1))) return false;
    let at = n.parentNode;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (at && !(at.tagName && compound(at, parts[i]))) at = at.parentNode;
      if (!at) return false;
      at = at.parentNode;
    }
    return true;
  });
  const mk = (tag = 'div') => {
    const attrs = {};
    const n = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, className: '', textContent: '', id: '', src: '', alt: '', title: '', dataset: {},
      style: { setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; }, getPropertyValue(k) { return this[k] ?? ''; } },
      classList: {
        add: (...c) => { const s = new Set(n.className.split(/\s+/).filter(Boolean)); for (const x of c) s.add(x); n.className = [...s].join(' '); },
        remove: (...c) => { const s = new Set(n.className.split(/\s+/).filter(Boolean)); for (const x of c) s.delete(x); n.className = [...s].join(' '); },
        toggle: (c, on) => { if (on ?? !n.classList.contains(c)) n.classList.add(c); else n.classList.remove(c); },
        contains: (c) => n.className.split(/\s+/).includes(c),
      },
      get parentElement() { return n.parentNode; },
      setAttribute(k, v) { attrs[k] = String(v); if (k.startsWith('data-')) n.dataset[camel(k)] = String(v); },
      getAttribute(k) { return k.startsWith('data-') ? n.dataset[camel(k)] ?? null : attrs[k] ?? null; },
      hasAttribute(k) { return k.startsWith('data-') ? n.dataset[camel(k)] != null : k in attrs; },
      removeAttribute(k) { delete attrs[k]; if (k.startsWith('data-')) delete n.dataset[camel(k)]; },
      append(...cs) { for (const c of cs) { if (c == null || typeof c !== 'object') continue; c.parentNode = n; n.children.push(c); } },
      appendChild(c) { n.append(c); return c; },
      replaceChildren(...cs) { for (const c of n.children) c.parentNode = null; n.children = []; n.append(...cs); },
      remove() { if (n.parentNode) { n.parentNode.children = n.parentNode.children.filter((c) => c !== n); n.parentNode = null; } },
      addEventListener() {}, removeEventListener() {},
      matches: (sel) => matches(n, sel),
      closest: (sel) => { for (let p = n; p; p = p.parentNode) if (p.tagName && matches(p, sel)) return p; return null; },
      querySelectorAll: (sel) => all(n).filter((x) => matches(x, sel)),
      querySelector: (sel) => all(n).find((x) => matches(x, sel)) ?? null,
    };
    return n;
  };
  const head = mk('head'), body = mk('body');
  const every = () => [...all(head), ...all(body)];
  return {
    head, body, mk,   // no window: a page without events - the gauntlet and HUD-MOVE stand down, the sweep is the test's to call
    createElement: mk, createElementNS: (_ns, t) => mk(t),
    getElementById: (id) => every().find((x) => x.id === id) ?? null,
    querySelectorAll: (sel) => every().filter((x) => matches(x, sel)),
    querySelector: (sel) => every().find((x) => matches(x, sel)) ?? null,
  };
}
/** The real HUD drawn on `doc` at a screen `w` wide; the HUD put away and the globals given back after. */
async function withHud(doc, fn, w = 1440) {
  const prev = { doc: globalThis.document, w: globalThis.innerWidth, h: globalThis.innerHeight };
  globalThis.document = doc; globalThis.innerWidth = w; globalThis.innerHeight = 900;
  const hud = await import('../../src/ui/enhanced/enhancedHud.js');
  try { return await fn(hud); } finally {
    hud.destroyEnhancedHud();
    globalThis.document = prev.doc; globalThis.innerWidth = prev.w; globalThis.innerHeight = prev.h;
  }
}
/** The HUD's temperature tile in its status widget: [its word, its kind] - or null. */
const tempTile = (doc) => {
  const words = Object.values(HUD_NEED_WORDS.temp);
  const cell = doc.querySelectorAll('.hud-stat .hst-cell').find((c) => words.includes(c.querySelector('.hst-name')?.textContent));
  return cell ? { word: cell.querySelector('.hst-name').textContent, kind: ['warn', 'danger'].find((k) => cell.classList.contains(k)), cell } : null;
};
/** A rule's declarations, by property; a sheet's rule by one of its selectors (and its place in the sheet). */
const decls = (body) => Object.fromEntries(body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
const ruleAt = (css, sel) => rulesOf(css).findIndex((r) => r.sel.split(',').map((s) => s.trim()).includes(sel));
const ruleOf = (css, sel) => rulesOf(css)[ruleAt(css, sel)];
/** A selector's specificity as [ids, classes + attributes + pseudo-classes] (no element names stand in these). */
const specificity = (sel) => [(sel.match(/#[\w-]+/g) ?? []).length, (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length];
/** WCAG contrast of two #rrggbb colours. */
const contrast = (a, b) => {
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ═══ S1 - THE PACK'S PLAQUES ════════════════════════════════════════════

test('AUDIT C&C S1: THE PACK\'S TWO PLAQUES STAND IN ONE ROW ON THE FIGURE\'S FIRST CELL NAMED WHOLE - row 1 to 2, column 2 to 3 (each stood alone on \'1 / 2\', where an absolutely placed grid child\'s unnamed end lines run to the map\'s edge: the Felt plaque stood on the R-Weapon panel at every screen in both dresses); the row is the sheets\', the Armour plaque at its left and the Felt one at its right, wrapping under the Armour one where the figure is narrow', () => {
  const e = realPlayer('casual');
  minute(e, MOUNTAIN_NIGHT, 1001);
  equipItem(e, e.items.find((i) => i.group === 'Weapons'));   // the R-Weapon panel filled, as the lens stood it
  // the quick bar, not the hotbar: the hotbar is one node a page keeps for its life, and the HUD's pins below build
  // theirs on their own page
  setPref(HOTBAR_PREF, 'quickbar');
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const was = globalThis.window;
    globalThis.window = { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const row = host.querySelector('.wornplaques');
      assert.ok(row, 'the plaques\' row');
      assert.ok(row.parent.classList.contains('wornmap'), 'a cell of the worn map');
      assert.equal(row.style.gridArea, '1 / 2 / 2 / 3', 'the figure\'s first cell, named whole');
      assert.deepEqual(row.children.map((c) => c.className), ['wornac-total', 'worntemp-total'], 'the Armour plaque, then the Felt one');
      assert.deepEqual(row.children.map((c) => c.style.gridArea ?? ''), ['', ''], 'neither placed alone');
    } finally { view.unmount(); globalThis.window = was; }
  });
  // the sheets' row: out of the map's sizing (absolute), the cell's own width, the two at its ends and the Felt one
  // under the Armour one where they do not fit in a line; the plaques flow in it
  const row = decls(ruleOf(ARMOUR_CSS, '.pack-shell .wornmap .wornplaques').body);
  assert.deepEqual([row.position, row.left, row.right, row.top, row.display, row['flex-wrap'], row['justify-content']],
    ['absolute', '4px', '4px', '4px', 'flex', 'wrap', 'space-between']);
  for (const sel of ['.pack-shell .wornmap .wornac-total', '.pack-shell .wornmap .worntemp-total']) {
    assert.equal(decls(ruleOf(ARMOUR_CSS, sel).body).position, 'relative', `${sel} flows in the row`);
  }
});

// ═══ S3, S10, S12 - THE HUD'S PLATE ═════════════════════════════════════

test('AUDIT C&C S3: THE PLATE IS A HUD PIECE OF ITS OWN, INSIDE ANOTHER (UI-CALM: the quick block, the corner\'s caption) - the outer piece\'s X turns it off and leaves the plate (it took the plate with it while the plate\'s own part stood on), the plate\'s own X turns it off, the compass\'s move is undone on it and the plate moves on its own - HUD-MOVE\'s real sweep over the real HUD', async () => {
  assert.deepEqual({ ...HUD_PIECES.find((p) => p.id === 'temp') }, { id: 'temp', sel: '.hud .hud-temp', name: 'Temperature', inside: 'quick' });
  const doc = hudDoc();
  await withHud(doc, async ({ drawEnhancedHud }) => {
    const e = realPlayer('casual');
    minute(e, MOUNTAIN_NIGHT, 1001);
    drawEnhancedHud(e, 0, 0, {});
    const plate = doc.querySelector('.hud .hud-temp'), compass = doc.querySelector('.hud .hud-quick');   // UI-CALM: the outer piece is the quick block
    assert.equal(plate.parentNode?.parentNode, compass, 'in the page, inside the quick block (its caption)');
    const sweep = (layout) => { setPref(HUD_LAYOUT_PREF, layout); sweepHudLayout(doc); };
    sweep({ quick: { off: true } });
    assert.deepEqual([compass.dataset.hm, plate.dataset.hm], ['quick', 'temp']);
    assert.deepEqual([compass.hasAttribute('data-hm-off'), plate.hasAttribute('data-hm-off')], [true, false], 'the compass off, the plate not');
    sweep({ temp: { off: true } });
    assert.deepEqual([compass.hasAttribute('data-hm-off'), plate.hasAttribute('data-hm-off')], [false, true], 'its own X');
    sweep({ quick: { x: 300, y: 40 } });
    assert.deepEqual([compass.style['--hmx'], compass.style['--hmy']], ['300px', '40px']);
    assert.deepEqual([plate.style['--hmx'], plate.style['--hmy']], ['-300px', '-40px'], 'the compass\'s move undone on it: it stands where it stood');
    sweep({ temp: { x: -200, y: 300 } });
    assert.deepEqual([plate.style['--hmx'], plate.style['--hmy'], compass.style['--hmx']], ['-200px', '300px', undefined], 'moved on its own');
  });
  // the sheet: the compass turned off leaves the plate standing, unless it is off too - the quick block's own law for
  // the buffs inside it
  assert.ok(HUD_LAYOUT_CSS.includes('\n.hud-quick[data-hm-off]:not([data-hm-edit]) .hud-temp[data-hm]:not([data-hm-off]) { visibility: visible !important; }'));
});

// ═══ S4 - THE GRIMOIRE DRESS ════════════════════════════════════════════

test('AUDIT C&C S4: THE GRIMOIRE DRESS KEEPS THE COST\'S SIGNAL - the HUD plate\'s level frames over the chip\'s wood (the wood\'s rule outweighed the plate\'s levels, three classes to two, and the plate wore one frame felt, costing or comfortable), and the pack\'s Felt plaque out of the Armour plaque\'s red ink - its number in its side\'s ink and its frame in its level\'s, deepened to read on the page', () => {
  const G = ':root[data-plus-dress="grimoire"]';
  const chip = ruleAt(GRIMOIRE_KIT_CSS, `${G} .hud-temp`);
  assert.ok(chip >= 0, 'the plate is a chip of the wood');
  for (const [level, border] of [['warn', '#f3cf86 #7a5424 #7a5424 #f3cf86'], ['danger', '#ff9a7a #b53a2e #b53a2e #ff9a7a']]) {
    const sel = `${G} .hud-temp[data-level="${level}"]`;
    const at = ruleAt(GRIMOIRE_KIT_CSS, sel);
    assert.ok(at > chip, `${level}: after the chip's rule`);
    assert.ok(specificity(sel)[1] > specificity(`${G} .hud-temp`)[1], `${level}: it outweighs the wood`);
    assert.equal(decls(rulesOf(GRIMOIRE_KIT_CSS)[at].body)['border-color'], border, `${level}: the status tiles' own pair`);
  }
  // the plaque: the red ink is the Armour plaque's alone
  assert.equal(ruleAt(GRIMOIRE_KIT_CSS, `${G} .worntemp-total .v`) === ruleAt(GRIMOIRE_KIT_CSS, `${G} .wornac-total .v`), false, 'no longer one rule');
  assert.equal(decls(ruleOf(GRIMOIRE_KIT_CSS, `${G} .wornac-total .v`).body).color, `${GRIM_TONES.red} !important`);
  assert.equal(decls(ruleOf(GRIMOIRE_KIT_CSS, `${G} .worntemp-total .v`).body).color, `${GRIM_TONES.ink} !important`, 'comfortable: the ink');
  assert.deepEqual({ ...TEMP_INK }, { cold: '#1f4f9e', hot: '#7a4a00', warn: '#7a5424' });
  for (const [side, ink] of [['cold', '#1f4f9e'], ['hot', '#7a4a00']]) assert.equal(decls(ruleOf(GRIMOIRE_KIT_CSS, `${G} .worntemp-total[data-side="${side}"] .v`).body).color, `${ink} !important`);
  for (const [level, ink] of [['warn', '#7a5424'], ['danger', GRIM_TONES.red]]) {
    const sel = `${G} .worntemp-total[data-level="${level}"]`;
    assert.equal(decls(ruleOf(GRIMOIRE_KIT_CSS, sel).body)['border-color'], `${ink} !important`);
    assert.ok(specificity(sel)[1] > specificity(`${G} .worntemp-total`)[1], `${level}: it outweighs the plaques' one outline`);
  }
  // the inks read on the page (#e3c995): the numbers at 4.5:1 and better, the felt frame 3:1 and better
  const page = '#e3c995';
  assert.deepEqual([TEMP_INK.cold, TEMP_INK.hot, GRIM_TONES.ink].map((c) => contrast(c, page) >= 4.5), [true, true, true]);
  assert.ok(contrast(TEMP_INK.warn, page) >= 3 && contrast(GRIM_TONES.red, page) >= 3);
});

// ═══ S5 - RED MEANS IT COSTS, IN THE LIVE TIER ═════════════════════════

test('AUDIT C&C S5 (decisions D1, D2): A NEED\'S CHIP IS RED EXACTLY WHERE THE LIVE TIER\'S MINUTE CHARGES FOR ITS STAGE - every stage of every need, in Hard, Casual and Boons, through the real minute law: Hard red from Tired (it takes the attributes) and on the stiff morning (they were amber), Casual the red words, Boons nothing; Drenched amber in every tier (it was red, and costs only through the temperature, whose chip says so)', () => {
  const STAGES = [
    ['hunger', 'peckish', (s, now) => { s.lastAte = now - 300; }], ['hunger', 'hungry', (s, now) => { s.lastAte = now - 800; }], ['hunger', 'starving', (s, now) => { s.lastAte = now - 1500; }],
    ['thirst', 'thirsty', (s) => { s.thirst = 60; }], ['thirst', 'parched', (s) => { s.thirst = 85; }], ['thirst', 'dehydrated', (s) => { s.thirst = 110; }],
    ['sleep', 'tired', (s) => { s.sleepDebt = 5; }], ['sleep', 'drowsy', (s) => { s.sleepDebt = 9; }], ['sleep', 'exhausted', (s) => { s.sleepDebt = 13; }],
    ['wet', 'damp', (s) => { s.wet = 10; }], ['wet', 'wet', (s) => { s.wet = 50; }], ['wet', 'soaked', (s) => { s.wet = 150; }], ['wet', 'drenched', (s) => { s.wet = 250; }],
    ['stiff', 'stiff', (s, now) => { s.stiffUntil = now + 240; }],
  ];
  const now = 20001;   // not a harm tick
  const seen = {};
  for (const [tier, rules] of [['hard', HARD], ['casual', CASUAL], ['boons', BOONS]]) {
    for (const [need, stage, set] of STAGES) {
      const e = realPlayer(tier);
      e.survival = newSurvival(now - 1);
      e.survival.lastMinute = now - 1;
      set(e.survival, now);
      const c = minute(e, ROOM, now);
      assert.ok(c.felt > rules.stamina.coldFrom && c.felt < rules.stamina.hotFrom, `${tier}: the room charges no temperature (${c.felt})`);
      const chip = survivalHudChips(e, now, { rules, live: feltNow(e) }).find((x) => x.key === need);
      if (need === 'stiff' && !rules.attributes) { assert.equal(chip, undefined, `${tier}: no stiff morning - it lifts the minute the tier turns`); continue; }
      assert.equal(chip?.text, need === 'stiff' ? 'Stiff' : HUD_NEED_WORDS[need][stage], `${tier} ${need}:${stage}`);
      assert.equal(chip.level === 'danger', c.drained > 0 || c.hurt > 0 || c.took, `${tier} ${need}:${stage}: red iff the minute charged (drained ${c.drained}, hurt ${c.hurt}, took ${c.took})`);
      (seen[tier] ??= []).push(`${stage}:${chip.level}`);
    }
  }
  assert.deepEqual(seen, {
    hard: ['peckish:warn', 'hungry:warn', 'starving:danger', 'thirsty:warn', 'parched:danger', 'dehydrated:danger', 'tired:danger', 'drowsy:danger', 'exhausted:danger',
      'damp:warn', 'wet:warn', 'soaked:warn', 'drenched:warn', 'stiff:danger'],
    casual: ['peckish:warn', 'hungry:warn', 'starving:danger', 'thirsty:warn', 'parched:danger', 'dehydrated:danger', 'tired:warn', 'drowsy:warn', 'exhausted:danger',
      'damp:warn', 'wet:warn', 'soaked:warn', 'drenched:warn'],
    boons: ['peckish:warn', 'hungry:warn', 'starving:warn', 'thirsty:warn', 'parched:warn', 'dehydrated:warn', 'tired:warn', 'drowsy:warn', 'exhausted:warn',
      'damp:warn', 'wet:warn', 'soaked:warn', 'drenched:warn'],
  });
  // the one law the three surfaces read, said for every stage as the table above (a reader that hands no tier reads
  // the default's)
  assert.equal(needLevel('sleep', 'tired', { rules: HARD }), 'danger'); assert.equal(needLevel('sleep', 'tired'), 'warn');
  assert.equal(needLevel('stiff', 'stiff', { rules: HARD }), 'danger'); assert.equal(needLevel('stiff', 'stiff', { rules: CASUAL }), 'warn');
  assert.equal(needLevel('wet', 'drenched', { rules: HARD }), 'warn');
  // REST6's Waking Salts hold the sleep's penalties and its drain: a Hard Tired and a Casual Exhausted under them cost
  // nothing, and their chips say so (they stayed red)
  for (const [tier, rules, debt] of [['hard', HARD, 5], ['casual', CASUAL, 13]]) {
    const e = realPlayer(tier);
    e.survival = newSurvival(now - 1);
    Object.assign(e.survival, { lastMinute: now - 1, sleepDebt: debt, wakingUntil: now + 60 });
    const c = minute(e, ROOM, now);
    const chip = survivalHudChips(e, now, { rules, live: feltNow(e) }).find((x) => x.key === 'sleep');
    assert.deepEqual([chip.level, c.drained > 0 || c.hurt > 0 || c.took], ['warn', false], `${tier}: the salts hold`);
  }
});

test('AUDIT C&C S5: THE TEMPERATURE\'S RED IS THE LIVE TIER\'S BAND - over the world\'s air, a dressed and shod body\'s minute is charged exactly where the strip\'s chip and the HUD\'s plate say red (Hard from twenty either way - a Warm of 24 and a Cold of -21 were amber - Casual its red words, Boons nowhere), and the pack\'s plaque wears the plate\'s level; the band\'s edges as literals; a lit fire\'s cold amber where the tier warms', () => {
  for (const [tier, rules] of [['hard', HARD], ['casual', CASUAL], ['boons', BOONS]]) {
    const e = realPlayer(tier);
    wear(e, garment(148));   // shoes: Hard's barefoot tax is the feet's, not the temperature's
    const reds = new Set(), ambers = new Set();
    let n = 0;
    for (const climateIndex of [CLIMATES.Desert2, CLIMATES.Desert, CLIMATES.Mountain, CLIMATES.Woodlands, CLIMATES.Swamp, CLIMATES.Subtropical]) for (let month = 0; month < 12; month++) for (const hour of [2, 6, 12, 17, 21]) for (const weather of ['sunny', 'cloudy', 'rain', 'snow']) {
      const now = 30001 + 10 * n++;   // never a harm tick
      e.survival = newSurvival(now - 1);
      e.survival.lastMinute = now - 1;
      const c = minute(e, { climateIndex, month, hour, weather }, now);
      const chip = survivalHudChips(e, now, { rules }).find((x) => x.key === 'temp');   // the minute's own reading
      const plate = temperatureReadout(e, undefined, { rules });
      if (temperatureWord(c.felt) === 'comfortable') { assert.equal(chip, undefined); assert.equal(plate.level, 'ok'); continue; }
      if ((chip.level === 'danger') !== c.drained > 0) assert.fail(`${tier}: felt ${c.felt} at ${climateIndex}/${month}/${hour}/${weather} is ${chip.level}, and the minute drained ${c.drained}`);
      assert.equal(plate.level, chip.level);
      const live = feltNow(e);
      assert.equal(packTemperature(e).level, temperatureReadout(e, live.felt, { rules, env: live.env }).level, 'the plaque wears the plate\'s level');
      (chip.level === 'danger' ? reds : ambers).add(c.felt);
    }
    // the sweep stood on both sides of each band
    const has = (set, lo, hi) => [...set].some((f) => f >= lo && f <= hi);
    if (tier === 'hard') assert.deepEqual([has(ambers, 11, 19), has(reds, 20, 30), has(ambers, -19, -11), has(reds, -30, -20), has(ambers, 21, 200), has(ambers, -200, -21)], [true, true, true, true, false, false]);
    if (tier === 'casual') assert.deepEqual([has(ambers, 31, 50), has(reds, 51, 200), has(ambers, -30, -11), has(reds, -50, -31), has(reds, -30, 50)], [true, true, true, true, false]);
    if (tier === 'boons') assert.equal(reds.size, 0, 'Boons: nothing red');
  }
  // the edges, as literals
  const e = realPlayer('hard');
  const level = (felt, rules, env = null) => temperatureReadout(e, felt, { rules, env }).level;
  assert.deepEqual([10, 11, 19, 20, 30, -10, -11, -19, -20, -30].map((f) => level(f, HARD)), ['ok', 'warn', 'warn', 'danger', 'danger', 'ok', 'warn', 'warn', 'danger', 'danger']);
  assert.deepEqual([30, 50, 51, -30, -31, -51].map((f) => level(f, CASUAL)), ['warn', 'warn', 'danger', 'warn', 'danger', 'danger']);
  assert.deepEqual([60, -60].map((f) => level(f, BOONS)), ['warn', 'warn']);
  // a lit fire answers the cold where the tier says so (Casual, Boons), never in Hard, never the heat
  assert.deepEqual([level(-35, CASUAL, { byFire: true }), level(-35, CASUAL, { byFire: false }), level(-35, HARD, { byFire: true }), level(55, CASUAL, { byFire: true })], ['warn', 'danger', 'danger', 'danger']);
});

// ═══ S6 - AS ITS CARD KNOWS IT ══════════════════════════════════════════

test('AUDIT C&C S6 (decision D4): AN UNIDENTIFIED PIECE\'S COMPARISON IS AS ITS CARD KNOWS IT - no lines and no power: the Wrothgar Pass Mantle unknown reads as the formal cloak it shows (-85 to -73 on a mountain night; its hidden Mountain-Born had it at -53), and known its lining and its power too (-43)', () => {
  setPref(LOOT_RARITY_KEY, true);
  const e = realPlayer('casual');
  minute(e, MOUNTAIN_NIGHT, 1001); minute(e, MOUNTAIN_NIGHT, 1002);
  const mantle = () => { const c = garment(155); applyRarity(c, 'legendary', () => 0.5, [WARDROBE_LEGENDARIES.find((l) => l.id === 'wrothgar-mantle')]); e.items.push(c); return c; };
  const hidden = mantle(), known = mantle(), plain = garment(155);
  known.isIdentified = true;
  e.items.push(plain);
  assert.equal(itemIsIdentified(hidden), false, 'a Legendary drops unidentified');
  const reads = (item) => { const w = temperatureWear(e, item, wearComparison(e, item)); return [Math.round(w.before.felt), Math.round(w.after.felt)]; };
  assert.deepEqual(reads(plain), [-85, -73], 'the formal cloak it shows');
  assert.deepEqual(reads(hidden), [-85, -73], 'unknown: as the cloak it shows');
  assert.deepEqual(reads(known), [-85, -43], 'known: its lining (+10) and Mountain-Born (+20) too');
  // the one view: an unknown piece without its lines and its power ids, a known one itself
  const view = asKnown(hidden);
  assert.deepEqual([view.affixes, view.legendary, view.imprint, view.gilded, view.templateIndex, view.rarity], [[], null, null, null, 155, 'legendary']);
  assert.deepEqual(hidden.affixes.length, 3, 'the piece itself untouched');
  assert.equal(asKnown(known), known);
  assert.equal(wearComparison(e, hidden).worn[wearComparison(e, hidden).slot].legendary, null, 'the comparison wears the view');
});

// ═══ S8, S13 - THE WORDS ════════════════════════════════════════════════

test('AUDIT C&C S8, S13: THE WORDS SAY WHAT IS SO - the credits and the Features comment say Boons\' neglect costs nothing (the drink still swings the attributes in Boons: "nothing taken" was false); the first-need page opens on the first need of any kind and says where the tiles stand (the left edge, not beside the bars), in TUT1\'s sixty words', () => {
  const cc = Object.values(CREDITS).flat().find((c) => c?.title === 'Climates & Calories');
  assert.match(cc.what, /There are four tiers in Settings: Off, Boons \(the default: neglect costs nothing, and staying fed, watered and rested gives bonuses\), Casual/);
  assert.doesNotMatch(JSON.stringify(cc), /nothing taken/);
  const features = read('src/systems/features.js');
  assert.match(features, /\/\/ \(SURV-BOONS, 2026-10-12: neglect costs nothing, a need met earns a bonus\),/);
  assert.doesNotMatch(features, /nothing taken, a need met/);
  const page = TUTORIALS.find((t) => t.id === 'survival');
  assert.equal(page.trigger, 'When a need first shows on your screen.');
  assert.equal(page.body[0], 'You need food, water, warmth and sleep. Signs at the left edge of the screen show what you lack, and on Boons what you have earned.');   // VOICE1 (PIN MOVED): the same law in plain words
  assert.equal(page.body.join(' ').split(/\s+/).length, 60, 'TUT1\'s count: two paragraphs, no more than sixty');   // VOICE1 (PIN MOVED)
});

// ═══ S9 - ONE READING ON THE HUD ════════════════════════════════════════

test('AUDIT C&C S9 (decision D3): ONE TEMPERATURE READING ON THE HUD - a CLOTHED body in the rain, whose wet eats its clothes\' warmth a minute at a time: the strip\'s tile and the plate say the live reading\'s word and level every frame (the tile read the record: Freezing beside the plate\'s -51 Deadly cold), and a step to a fire is amber on both before the minute turns; the fire\'s law is one helper the minute law writes with', async () => {
  assert.deepEqual([[CASUAL, true, -1], [CASUAL, true, 0], [CASUAL, false, -40], [HARD, true, -40], [BOONS, true, -40], [null, true, -40]].map(([r, byFire, felt]) => warmedByFire(r, { byFire }, felt)),
    [true, false, false, false, true, false]);
  assert.equal(warmedByFire(CASUAL, null, -40), false);
  // the minute law writes its record's word for it through the helper
  for (const [tier, warmed] of [['casual', true], ['hard', false]]) {
    const e = realPlayer(tier);
    minute(e, { ...MOUNTAIN_NIGHT, byFire: true }, 1001);
    assert.equal(e.survival.warmed === true, warmed, `${tier}: the record's warmth`);
  }
  const doc = hudDoc();
  await withHud(doc, async ({ drawEnhancedHud }) => {
    const e = realPlayer('casual');
    const plate = () => doc.querySelector('.hud .hud-temp');
    let ahead = 0;
    for (let m = 1; m <= 6; m++) {
      minute(e, RAIN_NIGHT, 2000 + m);
      survivalFeed(e, RAIN_NIGHT);   // the next frame's feed, as the host builds it
      drawEnhancedHud(e, 0, 0, {});
      const live = feltNow(e);
      if (temperatureWord(live.felt) !== temperatureWord(e.survival.felt)) ahead++;
      const tile = tempTile(doc);
      const word = temperatureReadout(e, live.felt).label;
      assert.deepEqual([tile.word, tile.kind], [word, plate().dataset.level], `minute ${m}: the tile is the plate (live ${live.felt}, the record ${e.survival.felt})`);
      assert.equal(plate().querySelector('.hud-tempword').textContent, word);
    }
    assert.ok(ahead >= 1, 'the live reading crossed a word ahead of the record - what the tile had lagged on');
    survivalFeed(e, { ...RAIN_NIGHT, byFire: true });   // a step to a lit fire: the frame after it, before any minute
    drawEnhancedHud(e, 0, 0, {});
    assert.deepEqual([tempTile(doc).kind, plate().dataset.level, e.survival.warmed ?? false], ['warn', 'warn', false], 'amber at once on both - the record still says the street');
  });
});

// ═══ S11 - THE PAGE READS THE LIVE TIER ═════════════════════════════════

test('AUDIT C&C S11: THE STATUS PAGE READS THE LIVE TIER - turned from Boons to Casual under the pause, before a minute runs, it says Casual\'s words at once (it still said "You are not tired." and the boons until a minute ran): the row builder reads the tier once, for all four hosts', () => {
  const e = realPlayer('boons');
  for (let m = 101; m <= 103; m++) minute(e, ROOM, m);
  const rows = () => statusReadoutRows({ lines: () => [], entity: e, survival: { minutes: 103, vampire: false, endurance: 50 } }).map((r) => (typeof r === 'string' ? r : r.text)).filter(Boolean);
  assert.deepEqual(rows().filter((l) => /tired|rested|Well fed|Quenched/.test(l)), ['You are not tired.', 'Well fed: +5 Strength, +5 Endurance.', 'Quenched: +5 Agility, +5 Speed.']);
  setPref(SURVIVAL_PREF, 'casual');
  assert.deepEqual(rows().filter((l) => /tired|rested|Well fed|Quenched/.test(l)), ['You are well rested.'], 'Casual at once');
  assert.ok(Array.isArray(e.survival.boons), 'the record still Boons\' - no minute ran');
});

// ═══ S14 - A COST SAID WITHOUT ITS COLOUR ═══════════════════════════════

test('AUDIT C&C S14: A COST IS SAID WITHOUT ITS COLOUR - a need\'s tile and the HUD\'s plate say their level in words on their title and label and a costing one carries a mark (the sheets\' "!"), the pack\'s plaque says it too; the colour alone had told a costing reading from a felt one', async () => {
  assert.deepEqual({ ...LEVEL_WORDS }, { danger: 'it costs you', warn: 'no cost to you yet' });
  assert.deepEqual([levelSaid('Freezing', 'danger'), levelSaid('Cold', 'warn'), levelSaid('Comfortable', 'ok'), levelSaid('Well fed', 'boon')],
    ['Freezing - it costs you', 'Cold - no cost to you yet', 'Comfortable', 'Well fed']);
  // the tiles, off the real strip: a Parched (costing in Casual) and a Wet (felt)
  const e = realPlayer('casual');
  e.survival = newSurvival(3000);
  Object.assign(e.survival, { thirst: 85, wet: 50 });
  minute(e, ROOM, 3001);
  const tiles = statusTiles({ needs: survivalHudChips(e, 3001, { rules: CASUAL }) });
  assert.deepEqual(tiles.map((t) => [t.key, t.say, t.cost]), [['need:thirst', 'Parched - it costs you', true], ['need:wet', 'Wet - no cost to you yet', false]]);
  const b = realPlayer('boons');
  minute(b, ROOM, 3001);
  assert.deepEqual(statusTiles({ needs: survivalHudChips(b, 3001, { rules: BOONS }) }).map((t) => [t.key, t.say, t.cost]), [['need:boon:fed', null, false], ['need:boon:quenched', null, false]], 'a boon says its own name');
  // the HUD, drawn: the costing tile marked and said, the plate said
  const doc = hudDoc();
  await withHud(doc, async ({ drawEnhancedHud }) => {
    const f = realPlayer('casual');
    minute(f, MOUNTAIN_NIGHT, 1001);
    drawEnhancedHud(f, 0, 0, {});
    const tile = tempTile(doc);
    const reading = temperatureReadout(f, feltNow(f).felt);
    // STATUS-TIPS (2026-10-20): the tile's level is said on its label and in its hover card (ui/hud/statusTips.js) - the
    // browser's own title stands down, as the pack's does under its card
    assert.deepEqual([tile.word, tile.cell.classList.contains('hst-cost'), tile.cell.title, tile.cell.getAttribute('aria-label')], [reading.label, true, '', `${reading.label} - it costs you`]);
    const plate = doc.querySelector('.hud .hud-temp');
    assert.deepEqual([plate.title, plate.getAttribute('aria-label')], [`Felt temperature ${reading.text}: ${reading.label} - it costs you`, `Felt temperature ${reading.text}: ${reading.label} - it costs you`]);
    withDom(() => {
      const p = temperaturePlaque(f);
      assert.equal(p.getAttribute('aria-label'), `Felt temperature ${reading.text}, ${reading.label} - it costs you`);
      assert.ok(p.title.startsWith(`Felt temperature ${reading.text}: ${reading.label.toLowerCase()} - it costs you (comfortable from -10° to +10°)`));
    });
  });
  // the marks: on a costing plate and a costing tile, out of the flow; and on the pack's costing plaque
  const mark = decls(ruleOf(ENHANCED_CSS, '.hud-temp[data-level="danger"]::after').body);
  assert.equal(ruleAt(ENHANCED_CSS, '.hud-temp[data-level="danger"]::after'), ruleAt(ENHANCED_CSS, '.hst-cell.hst-cost .hst-tile::after'), 'one rule marks both');
  assert.deepEqual([mark.content, mark.position], ['\'!\'', 'absolute']);
  const plaque = decls(ruleOf(ARMOUR_CSS, '.pack-shell .worntemp-total[data-level="danger"]::after').body);
  assert.deepEqual([plaque.content, plaque.position], ['\'!\'', 'absolute']);
});

// ═══ D6, R11 - THE GLYPHS ═══════════════════════════════════════════════

test('AUDIT C&C D6, R11: THE COMFORTABLE THERMOMETER IS NEUTRAL - its column the plate\'s bone, not the red that says a reading costs; and the code says the hearth wears a flame of its own (it said "the campfire", REST1\'s Rested\'s)', () => {
  assert.deepEqual({ ...STATUS_GLYPHS.thermo.pal }, { g: '#cfd4dc', w: '#eef2f6', r: '#b8ab8c', h: '#efe6cf', t: '#a8b0bc' });
  for (const c of Object.values(STATUS_GLYPHS.thermo.pal)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 52, `${c}: no hue to speak of`);
  }
  for (const f of ['src/systems/survival/status.js', 'src/ui/hud/hudStatus.js']) assert.doesNotMatch(read(f), /the campfire for the hearth/, f);
  // PIN MOVED (AUDIT C&C, lens S): REST1's tile is Next night now
  assert.match(read('src/systems/survival/status.js'), /a flame for the hearth \(its own - REST1's Next night is the campfire\)/);
  assert.match(read('src/ui/hud/hudStatus.js'), /a flame of its own for the hearth \(REST1's\n\/\/ {5}Next night is the campfire\)/);
});

// ═══ R5, R6, R7 - THE PINS THAT DID NOT FAIL ════════════════════════════

test('AUDIT C&C R7 (TEMP-UI): A WEAR\'S READING TAKES THE WEAR\'S WARDROBE - a lined formal cloak (a Magic warmth line of 4, the ladder\'s own roll) says +16 on its card, the cloak\'s 12 and its lining\'s 4 (read without the wear\'s wardrobe, it said +12)', () => {
  setPref(LOOT_RARITY_KEY, true);
  const e = realPlayer('casual');
  minute(e, MOUNTAIN_NIGHT, 1001);
  const lined = applyRarity(garment(155), 'magic', seq(0, 0.7, 0.96, 0.7));   // PIN MOVED (AFFIX-LINES): the pick drawn over the garment's 43 lines - warmth, one of them, at 0.96 (0.7 lands on a skill now)
  assert.deepEqual([lined.name, lined.affixes], ['Lined Formal Cloak', [{ id: 'warmth', value: 4 }]]);
  e.items.push(lined);
  const w = temperatureWear(e, lined, wearComparison(e, lined));
  assert.deepEqual([Math.round(w.before.felt), Math.round(w.after.felt)], [-85, -69]);
});

test('AUDIT C&C R7 (TEMP-UI): THE HUD\'S PLATE READS THE LIVE TIER - turned while the record is still the last tier\'s (no minute run, no `boons` written), the plate and the strip\'s tile wear the new tier\'s level at once: Casual\'s felt Cold amber, Hard\'s red, Boons\' amber (the plate test had written the record\'s `boons` by hand, so the live tier was never what it read)', async () => {
  const doc = hudDoc();
  await withHud(doc, async ({ drawEnhancedHud }) => {
    const e = realPlayer('casual');
    assert.ok(Array.isArray(e.equip.slots), 'chargen\'s own equip table');
    minute(e, WOODS_EVENING, 1001);
    assert.equal(e.survival.felt, -25);
    // the plate's level and the strip's tile's, the frame after the turn
    const level = () => { drawEnhancedHud(e, 0, 0, {}); return [doc.querySelector('.hud .hud-temp').dataset.level, tempTile(doc).kind]; };
    assert.deepEqual(level(), ['warn', 'warn'], 'Casual: felt');
    setPref(SURVIVAL_PREF, 'hard');
    assert.deepEqual(level(), ['danger', 'danger'], 'Hard at once: it costs');
    setPref(SURVIVAL_PREF, 'boons');
    assert.deepEqual(level(), ['warn', 'warn'], 'Boons at once');
    assert.equal('boons' in e.survival, false, 'the record untouched');
  });
});

test('AUDIT C&C R6 (C13): THE STATS SIDE\'S BOONS SECTION, DRIVEN - a Boons body that slept in a bed and woke: the real sheet builder draws the section with every boon and what it gives (three source lines were all that pinned it)', () => {
  const e = realPlayer('boons');
  for (let m = 101; m <= 160; m++) minute(e, { ...ROOM, resting: true, sleeping: 'bed' }, m);   // an hour in a bed banks ninety minutes of Well rested
  minute(e, ROOM, 161);
  withDom(() => {
    const page = buildStatsPage(e, () => {});
    const sec = page.children.find((c) => String(c.className).includes('sf-sec') && c.children[0]?.textContent === 'Boons');
    assert.ok(sec, 'the section');
    assert.deepEqual(sec.children.slice(1).map((r) => r.children.map((x) => x.textContent)), [
      ['Well fed', '+5 Strength, +5 Endurance'], ['Quenched', '+5 Agility, +5 Speed'], ['Well rested', '+5 Intelligence, +5 Willpower (2 hours left)'], ['Thriving', '+5 Luck'],
    ]);
    assert.deepEqual(boonStatRows(e).length, 4);
  });
});

test('AUDIT C&C R5 (B11): THE ENHANCED MENU\'S ATTRIBUTES PAGE, DRIVEN - the pause window\'s Stats page, its Attributes section pressed, for a Boons body: the eight meters, then the Boons divider and every boon\'s row (a source-text pin let the rows go undrawn, one boon drawn, or the Character page stand in)', async () => {
  await import('../chargenDom.mjs');   // the pause window's document (its globals stand for the rest of this file: this test is the last)
  const { mountEnhancedMenu } = await import('../../src/ui/enhanced/enhancedMenu.js');
  const { playerEntity } = await import('../../src/characters/playerEntity.js');
  const kept = { ...playerEntity };
  try {
    realPlayer('boons', playerEntity);
    for (let m = 101; m <= 160; m++) minute(playerEntity, { ...ROOM, resting: true, sleeping: 'bed' }, m);
    minute(playerEntity, ROOM, 161);
    const host = globalThis.document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    try {
      host.querySelectorAll('.px-qrow').find((b) => b.textContent.includes('Attributes')).onclick();
      const detail = host.querySelectorAll('.px-qdetail')[0];
      const shown = detail.children.map((c) => (c.className === 'px-divider' ? `| ${c.textContent}` : c.className === 'px-mrow' ? c.children[0].children[0].textContent : c.className === 'px-stat' ? `${c.children[0].textContent}: ${c.children[1].textContent}` : null)).filter(Boolean);
      assert.deepEqual(shown, ['| Attributes', 'Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck', '| Boons',
        'Well fed: +5 Strength, +5 Endurance', 'Quenched: +5 Agility, +5 Speed', 'Well rested: +5 Intelligence, +5 Willpower (2 hours left)', 'Thriving: +5 Luck']);
    } finally { menu.unmount(); }
  } finally {
    for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k];
    Object.assign(playerEntity, kept);
  }
});

test('AUDIT C&C (lens R): THE BOON TILES, DRIVEN THROUGH THE REAL HUD - a Boons body after a minute of the law, fed and watered: the strip draws Well fed and Quenched as green tiles; turned to Casual, the same body draws neither (SURV-BOONS drew them in its own session, and survboons pins the tiles\' builder, `statusTiles`, alone)', async () => {
  const doc = hudDoc();
  await withHud(doc, async ({ drawEnhancedHud }) => {
    const e = realPlayer('boons');
    minute(e, ROOM, 101);
    assert.deepEqual(e.survival.boons, ['fed', 'quenched'], 'the minute law granted them');
    const boonCells = () => {
      drawEnhancedHud(e, 0, 0, {});
      return doc.querySelectorAll('.hud-stat .hst-cell').map((c) => [c.querySelector('.hst-name')?.textContent, ['buff', 'warn', 'danger'].find((k) => c.classList.contains(k))])
        .filter(([name]) => name === 'Well fed' || name === 'Quenched');
    };
    assert.deepEqual(boonCells(), [['Well fed', 'buff'], ['Quenched', 'buff']], 'green, each by its word');
    setPref(SURVIVAL_PREF, 'casual');
    assert.deepEqual(boonCells(), [], 'Casual earns no boon tile');
  });
});

test('AUDIT C&C (lens S): EVERY LINE OF THE STATUS PAGE\'S THIRD BOX FITS THE CLASSIC BOX - it sizes itself to its widest line and wraps nothing (DaggerfallMessageBox), centred on a 320-pixel screen; Well rested\'s line with its bank ran 59 characters, past the felt line\'s 53, the widest the box has drawn since TEMP-UI - the bank\'s hours are a line of their own, and every line a body\'s record can mint, in every tier, is held to 53 (mutant: the hours back in the boon\'s line)', () => {
  assert.equal(STATUS_LINE_MAX, 53);
  assert.equal(STATUS_TEXT.felt(-120).length, 53, 'the budget is the felt line\'s longest');
  let widest = '';
  for (const tier of ['boons', 'casual', 'hard']) {
    const rules = SURVIVAL_RULES[tier];
    for (const vampire of [false, true]) for (const lastAte of [990, 700, 200, -2000]) for (const thirst of [0, 60, 100, 140]) for (const sleepDebt of [0, 2, 5, 10]) for (const wet of [0, 60, 150, 250]) for (const felt of [-120, -25, 0, 30, 120]) for (const drunk of [0, 30, 60]) {
      const s = { ...newSurvival(0), lastAte, thirst, sleepDebt, wet, felt, drunk, stiffUntil: 2000, boons: ['fed', 'quenched', 'rested', 'thriving', 'hearth'], wellRested: 720 };
      for (const l of survivalStatusLines({ survival: s }, 1000, { vampire, endurance: 50, rules })) if (l.length > widest.length) widest = l;
    }
  }
  assert.ok(widest.length <= STATUS_LINE_MAX, `"${widest}" (${widest.length})`);
  assert.equal(widest.length, 53, 'and the felt line is the widest, as it was');
});

