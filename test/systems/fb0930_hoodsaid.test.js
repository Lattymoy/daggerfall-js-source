// FIELD BUGS 2026-09-30 (HOOD-SAID) - "Vampire hood on cloaks dont show hood is up or down making them think its a bug".
//
// A vampire raises a hood to travel by day (VAMP-HOOD), and the refusal at the map's door said "Raise the hood of a
// cloak or robe" - a button that did not exist. On the Enhanced Plus pack a click on the worn cloak's panel only picked
// it; its card offered Use, which is DFU's NextVariant: the casual cloak has six drawings, hood down, UP, UP, down,
// down, UP, so each press stepped to the next drawing - not a toggle. The use path returned `repaint: true` for a
// variant and nothing read it, so the doll kept the old drawing; the card closed, nothing was said, and the card and
// the panel showed the template's name and "Worn yes" whatever the hood was. The hood was up and nothing on the
// screen said so.
//
// Now the card of a worn cloak or plain robes carries Raise hood / Lower hood in Use's place and a Hood row; a press
// moves the garment to the same drape's other drawing (useItem.js toggleHood, over survival/temperature.js's one hood
// law), says so, keeps the card up and redraws the doll; the panel wears a Hood chip while the hood is up; the use
// path's repaint is read at last; and the door's hint names the button of the skin in play. Fixtures are the producers': the cloak
// and robes minted by setItemFields + mintCondition and worn through equipItem, the vampire createVampirismCurse's, and
// the pack mounted on the fake document the pack's suites drive (test/invdrag.mjs).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDom } from '../invdrag.mjs';
import { PAGE_IDS } from '../../src/ui/packPages.js';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { enhancedNoticeKeys, destroyEnhancedNotice, ENHANCED_NOTICE_ID } from '../../src/ui/enhanced/enhancedNotice.js';
import { ARMOUR_CSS, PLUS_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { toggleHood, nextVariant, HOOD_TEXT, VARIANT_CHANGEABLE } from '../../src/systems/useItem.js';
import {
  hoodCapable, hoodUp, cloakState, HOODED_CLOAK_VARIANTS, CLOAK_WARMTH, CASUAL_CLOAKS, FORMAL_CLOAKS, HOODED_ROBES,
} from '../../src/systems/survival/temperature.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition, setItemFields, templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import {
  createVampirismCurse, racialFastTravelBlock, SUNLIGHT_TRAVEL_TEXT, VAMPIRE_HOOD_TEXT, VAMPIRE_HOOD_TEXT_CLASSIC,
} from '../../src/systems/vampirism.js';
import { VAMPIRE_CLANS } from '../../src/systems/infection.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const garment = (templateIndex, variant = 0) => {
  const it = mintCondition(setItemFields({ group: templateIndex >= 180 ? 'WomensClothing' : 'MensClothing', templateIndex, flags: 0 }));
  it.variant = variant;
  return it;
};
const hero = () => ({
  isPlayer: true, name: 'Valentin', career: { name: 'Spellsword' }, level: 5, gender: 'male', race: 'Breton',
  stats: { strength: 50, endurance: 48, agility: 50, speed: 50, luck: 50, willpower: 50, intelligence: 50, personality: 50 },
  skills: new Array(35).fill(30), activeEffects: [], spells: [], items: [], goldPieces: 0, health: 100, maxHealth: 100,
});
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
/** invdrag.mjs's withDom, awaited: the doll's recompose lands a microtask after the press, and withDom puts the
 *  globals back the moment its callback returns. */
async function withDomAsync(fn) {
  const dom = fakeDom();
  const keys = ['document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'innerWidth', 'innerHeight', 'window'];
  const saved = Object.fromEntries(keys.map((k) => [k, [Object.hasOwn(globalThis, k), globalThis[k]]]));
  Object.assign(globalThis, {
    document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener,
    requestAnimationFrame: () => 0, innerWidth: dom.w, innerHeight: dom.h,
    window: { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) },   // the card's placement reads it
  });
  try { return await fn(dom); } finally {
    for (const [k, [had, v]] of Object.entries(saved)) { if (had) globalThis[k] = v; else delete globalThis[k]; }
    destroyEnhancedNotice();
  }
}
/** The live notice panels' rows (test/ui/enhanced/enhancedInventory.test.js's reader, ENH-NOTICE3). */
const noticeTexts = (dom) => {
  const live = new Set(enhancedNoticeKeys());
  const stack = (dom.body.children ?? []).find((c) => c.id === ENHANCED_NOTICE_ID);
  return (stack?.children ?? [])
    .filter((c) => String(c.className).split(/\s+/).includes('notice') && live.has(c.dataset.owner))
    .flatMap((panel) => (panel.children.find((c) => c.className === 'notice-body')?.children ?? [])
      .filter((r) => r.style.display !== 'none').map((r) => r.textContent));
};

test('HOOD-SAID: a hood is raised and lowered, never cycled - toggleHood keeps the drape: the casual cloak\'s six drawings are three drapes, each hood down and up (0/1, 2/3, 4/5), the formal cloak\'s and plain robes\' two are one pair; the six hooded garments and nothing else; a piece\'s hood is cloakState\'s own answer (mutants: the toggle a NextVariant step; the drape lost; the partner skipped; a hood on anything; the robes forgotten; every piece read as a shirt; a stray drawing left where it was)', () => {
  // the pairing is the tables' own shape: every pair (v, v^1) holds exactly one hooded drawing, and it is the warmer
  // by one
  for (let v = 0; v < 6; v += 2) {
    assert.equal(HOODED_CLOAK_VARIANTS.has(v) + HOODED_CLOAK_VARIANTS.has(v + 1), 1, `drawings ${v} and ${v + 1}: one hood`);
    const [down, up] = HOODED_CLOAK_VARIANTS.has(v) ? [v + 1, v] : [v, v + 1];
    assert.equal(CLOAK_WARMTH[up], CLOAK_WARMTH[down] + 1, `drawings ${v}/${v + 1}: the hood warms one more`);
  }
  const hooded = [...CASUAL_CLOAKS, ...FORMAL_CLOAKS, ...HOODED_ROBES].sort((a, b) => a - b);
  assert.deepEqual(hooded, [154, 155, 163, 191, 192, 200]);
  for (const t of hooded) {
    assert.ok(VARIANT_CHANGEABLE.has(t), `${t}: a garment DFU lets the player change`);
    const total = templateByIndex(t).variants;
    assert.equal(total, CASUAL_CLOAKS.has(t) ? 6 : 2, `${t}: its drawings`);
    for (let v = 0; v < total; v++) {
      const it = garment(t, v);
      assert.equal(hoodCapable(it), true);
      const slot = HOODED_ROBES.has(t) ? EQUIP_SLOTS.ChestClothes : EQUIP_SLOTS.Cloak2;
      const was = hoodUp(it);
      assert.equal(was, cloakState({ [slot]: it }).hood, `${t}/${v}: the piece's hood is cloakState's, in either cloak slot`);
      assert.equal(toggleHood(it), true);
      assert.equal(it.variant, v ^ 1, `${t}/${v}: the same drape's other drawing`);
      assert.equal(hoodUp(it), !was, `${t}/${v}: the hood the other way`);
      assert.equal(toggleHood(it), true);
      assert.equal(it.variant, v, `${t}/${v}: and back - a toggle, two presses`);
    }
  }
  // a drawing past the template's (a stray save value): NextVariant's own order from it, to the first hood that differs
  const stray = garment(154, 6);
  assert.equal(hoodUp(stray), false);
  assert.equal(toggleHood(stray), true);
  assert.equal(stray.variant, 1, 'round to the first hooded drawing');
  // nothing else has a hood: a shirt, a tunic with variants, a sword - left as they were
  for (const it of [garment(165, 1), garment(161, 1), { group: 'Weapons', templateIndex: 120, variant: 0 }]) {
    assert.equal(hoodCapable(it), false, `${it.templateIndex}: no hood`);
    assert.equal(hoodUp(it), false);
    assert.equal(toggleHood(it), false);
    assert.equal(it.variant, it.group === 'Weapons' ? 0 : 1, 'untouched');
  }
  // DFU's NextVariant is untouched: the classic window's Use and middle click still step every drawing
  const c = garment(154, 0);
  const seen = [];
  for (let i = 0; i < 6; i++) { seen.push(hoodUp(c)); nextVariant(c); }
  assert.deepEqual(seen, [false, true, true, false, false, true]);
});

test('HOOD-SAID: the pack says it - a worn cloak\'s card offers Raise hood in Use\'s place and a Hood row; a press raises it, says "You raise your hood.", keeps the card up with its row and button flipped, redraws the doll, and the panel wears a Hood chip beside its family word; Lower hood the same way back (mutants: Use kept on a hooded piece; no hood button; the label backwards; no Hood row; nothing said; the lines swapped; the doll not redrawn; the card closed; the panel silent; the chip left up; the chip undressed; the chip on the count)', async () => {
  const e = hero();
  const cloak = garment(154, 0);
  e.items.push(cloak); equipItem(e, cloak);
  await withDomAsync(async (dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const panel = () => host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornname')?.textContent === 'Casual Cloak');
      const card = () => host.querySelector('.packtip');
      const acts = () => card().querySelectorAll('button').filter((b) => String(b.className).split(/\s+/).includes('act')).map((b) => b.textContent);
      const rows = () => card().querySelectorAll('.pair').map((p) => [p.querySelector('dt').textContent, p.querySelector('dd').textContent]);
      const press = (label) => card().querySelectorAll('button').find((b) => b.textContent === label).onclick();
      const plate = () => panel().querySelector('.wornhood');
      assert.equal(panel().querySelector('.wornslot').textContent, 'Cloaks', 'the family word stands');
      assert.equal(plate(), null, 'a hood down: the bare panel');
      panel().onclick({});
      assert.ok(card(), 'the card is up');
      assert.ok(acts().includes('Raise hood') && !acts().includes('Use') && !acts().includes('Lower hood'), `the hood's button, not Use: ${acts()}`);
      assert.deepEqual(rows().filter(([k]) => k === 'Worn' || k === 'Hood'), [['Worn', 'yes'], ['Hood', 'down']]);
      await flush();
      const before = host.querySelector('.pack-shell');
      press('Raise hood');
      assert.equal(cloak.variant, 1, 'drawing 0\'s partner, hood up');
      assert.equal(cloakState(e.equip.slots).hood, true, 'the one hood law reads it up - the vampire\'s door with it');
      assert.deepEqual(noticeTexts(dom), [HOOD_TEXT.raise]);
      assert.equal(HOOD_TEXT.raise, 'You raise your hood.');
      assert.ok(card(), 'the card stays up');
      assert.ok(acts().includes('Lower hood') && !acts().includes('Raise hood'), 'its button flipped');
      assert.deepEqual(rows().find(([k]) => k === 'Hood'), ['Hood', 'up'], 'and its row');
      assert.equal(plate()?.textContent, 'Hood', 'a hood up wears its chip');
      const drawn = host.querySelector('.pack-shell');
      await flush();
      assert.notEqual(host.querySelector('.pack-shell'), drawn, 'the doll recomposed and the pack repainted with it');
      assert.notEqual(drawn, before);
      press('Lower hood');
      assert.equal(cloak.variant, 0);
      assert.deepEqual(noticeTexts(dom), [HOOD_TEXT.lower]);
      assert.equal(HOOD_TEXT.lower, 'You lower your hood.');
      assert.equal(plate(), null, 'and takes it off with the hood');
      // and nothing else carries one: the helm's panel, the rest of the map
      press('Raise hood');
      assert.equal(host.querySelectorAll('.wornhood').length, 1);
    } finally {
      view.unmount();
    }
  });
  // the chip rides the Plus sheet in the part plate's dress, in its corner, off a family's count
  assert.ok(PLUS_CSS.includes(ARMOUR_CSS));
  assert.match(ARMOUR_CSS, /\n\.pack-shell \.equipped \.wornhood \{ position: absolute; right: 3px; top: 3px;/);
  assert.match(ARMOUR_CSS, /\n\.pack-shell \.equipped \.worncount ~ \.wornhood \{ right: 20px; \}/);
});

test('HOOD-SAID: plain robes worn hood down say so and raise the same way; a cloak in the pack keeps DFU\'s Use, whose repaint is read at last; an enchanted hooded cloak keeps its Use beside the hood (mutants: the robes forgotten; a carried cloak\'s hood; the repaint flag unread; the enchanted cloak\'s Used payload out of reach)', async () => {
  const e = hero();
  const robes = garment(163, 0);
  const carried = garment(154, 0);
  e.items.push(robes, carried); equipItem(e, robes);
  await withDomAsync(async (dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    let view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const card = () => host.querySelector('.packtip');
      const acts = () => card().querySelectorAll('button').filter((b) => String(b.className).split(/\s+/).includes('act')).map((b) => b.textContent);
      host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornname')?.textContent === 'Plain Robes').onclick({});
      assert.ok(acts().includes('Raise hood') && !acts().includes('Use'), `the robes' hood: ${acts()}`);
      card().querySelectorAll('button').find((b) => b.textContent === 'Raise hood').onclick();
      assert.equal(robes.variant, 1);
      assert.equal(cloakState(e.equip.slots).hood, true);
      assert.equal(host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornname')?.textContent === 'Plain Robes')
        .querySelector('.wornhood')?.textContent, 'Hood', 'the robes\' half panel wears the chip');
      // the carried cloak: not worn, so no hood of the wearer's - DFU's Use, stepping its drawings
      host.querySelector('.packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf('clothing')].onclick({});
      const row = host.querySelectorAll('.itemrow').find((r) => r._padItem === carried);
      assert.ok(row, 'the carried cloak on the Clothing page');
      row.onclick();
      assert.ok(acts().includes('Use') && !acts().includes('Raise hood'), `a cloak in the pack: ${acts()}`);
      await flush();
      const drawn = host.querySelector('.pack-shell');
      card().querySelectorAll('button').find((b) => b.textContent === 'Use').onclick();
      assert.equal(carried.variant, 1, 'NextVariant, as DFU');
      const after = host.querySelector('.pack-shell');
      assert.notEqual(after, drawn);
      await flush();
      assert.notEqual(host.querySelector('.pack-shell'), after, 'a variant repaints the doll (useResultAction\'s repaint, read)');
      // an enchanted hooded cloak worn: the hood's button and its Used payload's Use both
      view.unmount();
      const magic = garment(155, 0);
      magic.enchantments = [{ type: 1, param: 0 }];
      e.items.push(magic); equipItem(e, magic);
      view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
      host.querySelectorAll('.wornrow').find((n) => n.querySelector('.wornname')?.textContent?.includes('Formal Cloak')).onclick({});
      assert.ok(acts().includes('Raise hood') && acts().includes('Use'), `the enchanted cloak: ${acts()}`);
    } finally {
      view.unmount();
    }
  });
  const src = read('src/ui/enhanced/enhancedInventory.js');
  const use = src.slice(src.indexOf('function use(item'), src.indexOf('export function inventoryQuickAct('));
  assert.match(use, /\n {2}refresh\(\);\n {2}if \(act\.repaint\) refreshFigure\(\);/, 'the use path reads the flag');
});

test('HOOD-SAID: the door\'s hint names the button that raises the hood - the pack card\'s Raise hood on the enhanced skin, the doll\'s Use on the classic one (mutants: the hint the old sentence; the classic told of a button it has not; the skin unread)', () => {
  const v = hero();
  createVampirismCurse(v, VAMPIRE_CLANS.Lyrezi, { now: 400 * MINUTES_PER_DAY });
  const noon = 400 * MINUTES_PER_DAY + 12 * 60;
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  try {
    globalThis.location = { search: '?skin=enhanced' };
    assert.deepEqual(racialFastTravelBlock(v, noon), { text: SUNLIGHT_TRAVEL_TEXT, hint: VAMPIRE_HOOD_TEXT });
    assert.equal(VAMPIRE_HOOD_TEXT, 'Raise the hood of a cloak or robe to travel by day. Use Raise hood on its card in your pack.');
    globalThis.location = { search: '?skin=classic' };
    assert.deepEqual(racialFastTravelBlock(v, noon), { text: SUNLIGHT_TRAVEL_TEXT, hint: VAMPIRE_HOOD_TEXT_CLASSIC });
    assert.equal(VAMPIRE_HOOD_TEXT_CLASSIC, 'Use a cloak or robe on your doll until its hood is up.');
  } finally {
    if (had === undefined) delete globalThis.location; else globalThis.location = had;
  }
  // the enhanced hint's button is the card's own label; the classic's is the window's Use mode (nativeInventory MODES)
  assert.match(read('src/ui/enhanced/enhancedInventory.js'), /hoodUp\(picked\) \? 'Lower hood' : 'Raise hood'/);
  assert.match(read('src/ui/native/nativeInventory.js'), /const MODES = \['wagon', 'info', 'equip', 'remove', 'use', 'gold'\];/);
  assert.doesNotMatch(VAMPIRE_HOOD_TEXT_CLASSIC, /Raise hood/, 'the classic window has no such button');
});
