// FIELD BUGS 2026-10-19f DISEASE-UNWELL - a player's private report: after catching a disease, the rest and travel
// warnings said they were diseased, but no disease's icon or name appeared until after the character died of it. Found on
// the real startDisease -> magic rounds path: the warnings count every live disease, an incubating one too
// (restWarning.js plainDiseases, travelPopUp.js DiseaseCount), while the HUD's tile and the Status box showed one only once
// its incubation was over - DFU's own law (DaggerfallUI.CreateHealthStatusBox, DiseaseEffect.IncubationOver; DFU's
// HUDActiveSpells shows a disease never, ShowSpellIcon false). Incubation ends at the character's own next midnight, and
// a long rest or journey catches up its days while the HUD is hidden - so a disease could take hold, run, and kill unseen.
// THE OWNER'S DECISION (2026-10-19, "Unnamed 'Unwell' tile", a departure from DFU): while a disease incubates, the HUD
// shows an UNNAMED tile, "Unwell", and the Status box says the character feels unwell without naming it; once incubation
// is over, the named disease as before. A vampirism or lycanthropy infection is no plain disease and stays as it was.
// Driven on the real producers: startDisease, the character's own clock and the magic rounds a rest runs, the temple's
// and a spell's cure.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerEntity } from '../../src/characters/playerEntity.js';
import * as wt from '../../src/systems/worldTick.js';
import { startDisease, endDisease, DISEASES, DISEASE_NAMES, contractedMessageRecord, diseaseIncubating } from '../../src/systems/diseases.js';
import { createInfection } from '../../src/systems/infection.js';
import { cureDiseasesInfectionsLast } from '../../src/systems/effects.js';
import { afflictionRows, statusTiles, statusGlyphSrc, UNWELL_TILE_TEXT } from '../../src/ui/hud/hudStatus.js';
import { healthStatusRows, YOU_ARE_HEALTHY_ID, UNWELL_LINE_TEXT } from '../../src/systems/healthStatus.js';
import { restAilmentLines } from '../../src/systems/rest/restWarning.js';
import { activeSpellIcons } from '../../src/ui/hud/hudActiveSpells.js';
import * as tm from '../../src/systems/textManager.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The host's TEXT.RSC rows as the street's hosts answer them (`{ text, center }` - TextRsc.linesById). */
const rows = (id) => [{ text: `r${id}`, center: true }];
const UNWELL = { key: 'unwell', name: 'Unwell', glyph: 'disease' };
const PLAGUE = { key: `disease:${DISEASES.Plague}`, name: 'Plague', glyph: 'disease' };

/** The player, fresh: the real entity, level 5, nothing on it - online, its own clock behind the world's (LIVED1). */
function freshPlayer() {
  wt.setSharedClock(() => 1000 * 1440 + 600);
  wt.setOwnMinutes(900 * 1440 + 300);
  wt.resetMagicRoundMarker(Math.floor(wt.ownMinutes()));
  Object.assign(playerEntity, { level: 5, activeEffects: [], maxHealth: 100, health: 100 });
  return playerEntity;
}
/** An hour of rest as a host's rest runs it: the character's own minutes on, the rounds claimed and run. */
function restHour(me) {
  const end = wt.ownMinutes() + 60, start = Math.floor(end) - 60;
  wt.advanceOwnMinutes(60);
  const w = wt.claimMagicRounds(start, end);
  wt.runMagicRoundsFor(me, w.from, w.to, { sinks: { hurt: (n) => { me.health = Math.max(1, me.health - n); } }, rolls: () => 0.5 });
}
function cleanup() {
  wt.setSharedClock(null);
  wt.resetMagicRoundMarker(null);
  Object.assign(playerEntity, { activeEffects: [] });
}

test('DISEASE-UNWELL THE REPORT, ON THE REAL PATH: a disease caught - the warnings say diseased at once, and the HUD shows the unnamed "Unwell" tile and the Status box "You feel unwell." through its incubation (they showed nothing); past the character\'s own next midnight, the named disease on both; cured, nothing (mutants: an incubating disease shown nothing; the incubating one named; the tile under the disease\'s name after incubation; the box silent while it incubates)', () => {
  const me = freshPlayer();
  try {
    const day = Math.floor(wt.ownMinutes() / 1440);
    const plague = startDisease(me, DISEASES.Plague, day, () => 0.5);
    assert.ok(plague, 'caught');
    assert.deepEqual(restAilmentLines(me), ['You are diseased.', 'Resting will not cure it.', 'Rest anyway?'], 'the rest\'s warning says it at once');
    assert.equal(diseaseIncubating(plague), true);
    assert.deepEqual(afflictionRows(me), [UNWELL], 'incubating: the unnamed tile');
    assert.deepEqual(healthStatusRows(me, rows), [{ text: 'You feel unwell.', center: true }], 'and the box says it, unnamed, in the host\'s own row shape');
    // the rest runs on, hour by hour, until the character's own day turns
    let hours = 0;
    while (!plague.incubationOver && hours < 48) { restHour(me); hours++; }
    assert.equal(hours, 19, 'the character\'s own next midnight ended it, 19 hours on (1140 of its own minutes) - not the world\'s, 14');
    assert.equal(diseaseIncubating(plague), false);
    assert.deepEqual(afflictionRows(me), [PLAGUE], 'past it: the disease by its name, and no Unwell beside it');
    assert.deepEqual(healthStatusRows(me, rows), rows(contractedMessageRecord(DISEASES.Plague)), 'the box: its contracted message, as DFU');
    // cured at the temple or by a spell (the one cure door): nothing
    cureDiseasesInfectionsLast(me);
    assert.deepEqual(afflictionRows(me), []);
    assert.deepEqual(healthStatusRows(me, rows), rows(YOU_ARE_HEALTHY_ID));
    assert.equal(restAilmentLines(me), null);
  } finally { cleanup(); }
});

test('DISEASE-UNWELL ONE TILE, AT ITS PLACE: however many incubate, one Unwell - where the first of them stands among the named; one named and one incubating show both; an ended one and an infection show nothing, the infection never Unwell (the rest\'s warning leaves it out too, where the travel warnings count it); the box the same, its line once (mutants: a tile an incubating disease; an infection taken for one; an ended one shown; the line once per disease)', () => {
  const me = freshPlayer();
  try {
    const day = Math.floor(wt.ownMinutes() / 1440);
    const plague = startDisease(me, DISEASES.Plague, day, () => 0.5);
    while (!plague.incubationOver) restHour(me);
    const now = Math.floor(wt.ownMinutes() / 1440);
    startDisease(me, DISEASES.WitchesPox, now, () => 0.5);
    startDisease(me, DISEASES.Cholera, now, () => 0.5);
    assert.deepEqual(afflictionRows(me), [PLAGUE, UNWELL], 'the named one, and one Unwell for the two still incubating');
    assert.deepEqual(healthStatusRows(me, rows), [...rows(contractedMessageRecord(DISEASES.Plague)), { text: 'You feel unwell.', center: true }], 'the box: the named message, then the one line');
    const turned = { activeEffects: [me.activeEffects[1], me.activeEffects[0], me.activeEffects[2]] };   // the Pox first: where the first incubating one stands
    assert.deepEqual(afflictionRows(turned), [UNWELL, PLAGUE]);
    assert.deepEqual(healthStatusRows(turned, rows), [{ text: 'You feel unwell.', center: true }, ...rows(contractedMessageRecord(DISEASES.Plague))]);
    // the infection: no plain disease, never Unwell, as the rest's warning (restWarning.js plainDiseases) - the travel
    // popup, the held map's travel confirm and world.js's `unwell:` prompt count it (diseases.js diseaseCount, DFU's
    // DiseaseCount)
    const bitten = { activeEffects: [createInfection('vampirism', { day: now })] };
    assert.equal(diseaseIncubating(bitten.activeEffects[0]), false);
    assert.deepEqual(afflictionRows(bitten), []);
    assert.deepEqual(healthStatusRows(bitten, rows), rows(YOU_ARE_HEALTHY_ID));
    assert.equal(restAilmentLines(bitten), null);
    // an ended one is gone already
    const pox = me.activeEffects.find((a) => a.disease === DISEASES.WitchesPox);
    endDisease(pox);
    endDisease(me.activeEffects.find((a) => a.disease === DISEASES.Cholera));
    assert.equal(diseaseIncubating(pox), false);
    assert.deepEqual(afflictionRows(me), [PLAGUE]);
    assert.deepEqual(healthStatusRows(me, rows), rows(contractedMessageRecord(DISEASES.Plague)), 'nor the box an ended one');
    // the underground host's rows are plain strings: the line is one too
    const plain = (id) => [`r${id}`];
    assert.deepEqual(healthStatusRows({ activeEffects: [{ ...pox, ended: false }] }, plain), ['You feel unwell.']);
  } finally { cleanup(); }
});

test('DISEASE-UNWELL THE TILE ON THE WIDGET: a debuff, the disease\'s own spore (the art the named tile wears), "Unwell" its name, no foot; the classic skin shows a disease never - DFU\'s own law (ShowSpellIcon false), unchanged - and says it in the Status box both skins open (mutants: the tile framed a buff; another glyph)', () => {
  const me = freshPlayer();
  try {
    startDisease(me, DISEASES.Plague, Math.floor(wt.ownMinutes() / 1440), () => 0.5);
    const [tile] = statusTiles({ afflictions: afflictionRows(me) });
    assert.deepEqual([tile.key, tile.kind, tile.name, tile.glyph, tile.foot, tile.blink], ['unwell', 'debuff', 'Unwell', 'disease', null, false]);
    assert.ok(statusGlyphSrc(tile.glyph), 'its picture is the disease tile\'s own');
    assert.deepEqual(activeSpellIcons(me), { self: [], other: [] }, 'the classic row: no disease icon, incubating or not');
  } finally { cleanup(); }
});

// THE ENHANCED HUD, EXECUTED (ui3_status.test.js's page): the widget as Enhanced Plus draws it, over a real disease.
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

test('DISEASE-UNWELL THE ENHANCED HUD, EXECUTED: the status widget draws the Unwell tile while the disease incubates - a debuff on the disease\'s spore, named "Unwell" - then the named tile once the own clock\'s midnight has passed, and nothing once cured (mutants: the widget drawn off another law than afflictionRows; the tile left after the cure)', async () => {
  const prev = globalThis.document;
  globalThis.document = {
    createElement: (t) => mkEl(t), createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(), querySelector: () => null, querySelectorAll: () => [],
  };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../../src/ui/enhanced/enhancedHud.js');
  const { clearQuickslots } = await import('../../src/systems/quickslots.js');
  clearQuickslots();
  const me = freshPlayer();
  const opts = { weapon: null, weaponSheathed: true };
  const cells = () => {
    drawEnhancedHud(me, 0, 0, opts);
    const stat = find(document.body.children.find((n) => n.className === 'hud'), 'hud-stat');
    return stat.children.map((c) => [c.className, find(c, 'hst-name').textContent, c.dataset.glyph, find(c, 'hst-pic').src]);
  };
  try {
    const plague = startDisease(me, DISEASES.Plague, Math.floor(wt.ownMinutes() / 1440), () => 0.5);
    assert.deepEqual(cells(), [['hst-cell debuff', 'Unwell', 'disease', statusGlyphSrc('disease')]], 'incubating: Unwell, on the spore');
    while (!plague.incubationOver) restHour(me);
    assert.deepEqual(cells(), [['hst-cell debuff', 'Plague', 'disease', statusGlyphSrc('disease')]], 'past the own midnight: the named tile');
    cureDiseasesInfectionsLast(me);
    assert.deepEqual(cells(), [], 'cured: none');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    cleanup();
    globalThis.document = prev;
  }
});

test('DISEASE-UNWELL IN THE PLAYER\'S LANGUAGE: the tile\'s word and the box\'s line are the catalog\'s (hud.status.unwell, status.health.unwell), read when they are drawn - a language\'s row speaks them (mutants: either left a literal)', () => {
  const en = new Map(tm.parseStringTableCsv(rd('locales/en/Port_Strings.csv')));
  assert.equal(en.get('hud.status.unwell'), UNWELL_TILE_TEXT);
  assert.equal(en.get('status.health.unwell'), UNWELL_LINE_TEXT);
  const fr = tm.loadStringTableCsv(rd('locales/fr/Port_Strings.csv'));
  tm.patchLocaleTable('fr', 'Port_Strings', fr);
  const frm = new Map(fr);
  const me = { activeEffects: [{ kind: 'disease', disease: DISEASES.Plague, incubationOver: false, statMods: {} }] };
  try {
    tm.setLocale('fr');
    assert.equal(afflictionRows(me)[0].name, frm.get('hud.status.unwell'));
    assert.deepEqual(healthStatusRows(me, rows), [{ text: frm.get('status.health.unwell'), center: true }]);
    assert.notEqual(frm.get('hud.status.unwell'), UNWELL_TILE_TEXT, 'a French word, not the English');
  } finally { tm.setLocale('en'); }
  assert.equal(afflictionRows(me)[0].name, 'Unwell');
  assert.equal(DISEASE_NAMES.includes(afflictionRows(me)[0].name), false, 'Unwell names no disease');
});
