// FIELD BUGS 2026-10-18d CRAFT-HOWTO - the Discord's #bug-reports, "No clue how to start crafting", MoonGeneral: "I've
// already found out really quickly how to do the gathering jobs ... But for the crafting side of this mechanic i have no
// clue on how to start it. When going to the professions tab when selecting a gathering quest besides it being easy to
// understand it has an extra explanation for every gathering skill, but when it comes to the crafting skills you no
// explanation there." Asked: "a bit more detailed piece about crafting in the tutorial ... something that helps new
// players know where to look", and "the crafting skill tabs in professions also should have an tutorial part for it
// just like the gathering skills".
//
// The Professions page said how each gathering profession gathers (GATHER_HOW, TOOL-SAID; Hunting's and Fishing's own)
// and of the five crafts only Provisioning's brew and Enchanting's disenchanting - Smithing, Building and Outfitting
// showed their cards and nothing else, and Provisioning never said Cooking. Now every craft's pane says where its
// stations stand and what they do (ui/professions/profPages.js CRAFT_HOW), and the Tutorials carry a Crafting page that
// pops with the first gather. The page is drawn for real over a stand-in book; the words are held to the law and the
// hosts' station questions they name.
import '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROFESSIONS, SAW_RECIPES, CURE_RECIPES, SMELT_RECIPES, MASON_RECIPES, COOK_FIRE, WEAVERS_STOCK, COUNTER_ONLY, trackOf,
} from '../../../src/net/professionLaw.js';
import { RECIPES, COOKING_RECIPES, craftXp, cookXp } from '../../../src/net/recipeLaw.js';
import { LOCALE_CATALOG } from '../../../src/systems/localeCatalog.js';
import {
  setProfessionsPages, drawProfessionsPage, resetProfPages, CRAFT_HOW, GATHER_HOW, FISHING_HOW, ALCHEMY_HOW, ENCHANTING_HOW,
  MINING_GROUND_LINE, PROF_PAGE_SECTIONS,
} from '../../../src/ui/professions/profPages.js';
import { tutorialById, tutorialsIn, tutorialText } from '../../../src/systems/tutorials.js';
import { tutorialsMatching } from '../../../src/ui/tutorialsPane.js';
import { actionLabel } from '../../../src/systems/inputActions.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A stand-in book: every track at rank 0, the professions open - the shape the page reads (net/profBook.js). */
function standInBook() {
  const tracks = new Map(PROFESSIONS.map((p) => [p.id, { profession: p.id, xp: 0, rank: 0, specs: { 50: null, 100: null }, respec: null, free: [] }]));
  return {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null, hunt: { hides: 0, high: 0 }, hauls: 0 },
    stale: () => false, refresh: async () => ({ ok: true }), track: (id) => tracks.get(trackOf(id)), choose: async () => ({ ok: true }),
  };
}
/** THE REAL PROFESSIONS PAGE with each profession chosen in turn: what its pane says before its cards - the paragraphs
 *  drawn on the pane itself (a card's "Chosen at 50." is the cards' own). */
function panes() {
  resetProfPages();
  setProfessionsPages({ book: standInBook(), name: (k) => k });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawProfessionsPage(root, draw, kit); };
  const out = {};
  try {
    draw();
    for (const p of PROFESSIONS) {
      const row = [...root.querySelectorAll('button')].find((b) => b.className.split(/\s+/).includes('prof-row') && b.children[0]?.textContent === p.name);
      assert.ok(row, `${p.name}: a row on the page`);
      row.onclick();
      const pane = root.querySelector('.prof-pane');
      assert.equal(pane.querySelector('h3').textContent, p.name, `${p.name}: its pane`);
      out[p.id] = pane.children.filter((c) => c.tagName === 'P' && c.className === 'px-note').map((c) => c.textContent);
    }
  } finally { setProfessionsPages(null); resetProfPages(); root?.remove(); }
  return out;
}

test('CRAFT-HOWTO THE PAGE: every profession\'s pane says how it is done - each craft its CRAFT_HOW words where a gathering one\'s stand (Provisioning its brew and then its cooking, Enchanting its disenchanting), every gatherer as before; no profession of the ten without one (mutants: Smithing\'s, Building\'s, Outfitting\'s and the cooking line dropped; the crafts\' branch, the brew, the disenchanting, the three gatherers\', Hunting\'s and Fishing\'s dropped)', () => {
  const said = panes();
  assert.deepEqual(Object.keys(said), PROFESSIONS.map((p) => p.id), 'the ten, every one drawn');
  assert.deepEqual(said, {
    mining: [GATHER_HOW.mining, MINING_GROUND_LINE],
    logging: [GATHER_HOW.logging],
    herbalism: [GATHER_HOW.herbalism],
    hunting: [said.hunting[0]],
    fishing: [FISHING_HOW],
    smithing: [CRAFT_HOW.smithing()],
    building: [CRAFT_HOW.building()],
    outfitting: [CRAFT_HOW.outfitting()],
    provisioning: [ALCHEMY_HOW, CRAFT_HOW.provisioning()],
    enchanting: [ENCHANTING_HOW(0)],
  });
  assert.match(said.hunting[0], /^With a Skinning Knife in your pack, you can skin a creature you killed\./, 'PIN MOVED (VOICE2): Hunting\'s own words');
  // a craft's words are the table's, every one a paragraph of its own (the four crafts the brew and the item maker leave)
  assert.deepEqual(Object.keys(CRAFT_HOW), ['smithing', 'building', 'outfitting', 'provisioning']);
  for (const p of PROFESSIONS.filter((x) => x.kind === 'crafting')) {
    assert.ok(said[p.id].length >= 1 && said[p.id].every((w) => w.length > 120), `${p.name}: a how-to, not a word`);
    assert.doesNotMatch(said[p.id].join(' '), /not practised|daggerfall|\bDFU\b/i, `${p.name}: practised, and the old game unnamed`);
  }
});

/** The host's station questions (scenes/worldModes.js), each its shops' types and whether a home's station answers it. */
function stationQuestions() {
  const wm = src('src/scenes/worldModes.js');
  const out = {};
  for (const q of ['forgeHere', 'workbenchHere', 'loomHere', 'masonHere', 'jewellerHere', 'alchemyHere', 'enchantHere']) {
    const at = wm.indexOf(`    ${q}() {`);
    assert.ok(at > 0, `worldModes.js asks ${q}`);
    const body = wm.slice(at, wm.indexOf('\n    },', at));
    out[q] = { types: [...body.matchAll(/BUILDING_TYPES\.(\w+)/g)].map((m) => m[1]), home: /stationOwnerHere\(\) && interiorDecor\.list\(\)\.some/.test(body), body };
  }
  return out;
}
/** A shop type's words, as the page says them (a Weaponsmith's), and as the Tutorials' list says them (Weaponsmiths). */
const SHOP_WORDS = Object.freeze({
  WeaponSmith: ['Weaponsmith\'s', 'Weaponsmiths'], Armorer: ['Armorer\'s', 'Armorers'], FurnitureStore: ['Furniture Store\'s', 'Furniture Stores'],
  ClothingStore: ['Clothing Store\'s', 'Clothing Stores'], GeneralStore: ['General Store\'s', 'General Stores'], PawnShop: ['Pawn Shop\'s', 'Pawn Shops'],
  GemStore: ['Gem Store\'s', 'Gem Stores'], Alchemist: ['Alchemist\'s', 'Alchemists'],
});
/** Each craft's how-to by the station questions it names. */
const HOW_OF = () => ({
  forgeHere: CRAFT_HOW.smithing(), jewellerHere: CRAFT_HOW.smithing(), workbenchHere: CRAFT_HOW.building(), masonHere: CRAFT_HOW.building(),
  loomHere: CRAFT_HOW.outfitting(), alchemyHere: ALCHEMY_HOW,
});

test('CRAFT-HOWTO THE WORDS ARE THE CODE\'S: each craft names the shops its stations\' questions answer and the home\'s own, the joinery and any fire; what the works make and what pays its XP is the law\'s (mutants: a shop dropped from Smithing\'s words; a home dropped from Outfitting\'s; the joinery dropped; a saw and a cure paying XP; the brew\'s carried goods unsaid)', () => {
  const qs = stationQuestions();
  const how = HOW_OF();
  for (const [q, words] of Object.entries(how)) {
    assert.ok(qs[q].types.length, `${q}: a shop answers it`);
    for (const ty of qs[q].types) assert.ok(words.includes(SHOP_WORDS[ty][0]), `${q}: its ${ty} named - "${SHOP_WORDS[ty][0]}"`);
    assert.ok(qs[q].home, `${q}: a home's station answers it`);
    assert.match(words, /your own home/, `${q}: and the words say so`);
  }
  // a Mages Guild hall is the enchanting station's shop, said by the item maker's own page
  assert.match(qs.enchantHere.body, /BUILDING_TYPES\.GuildHall && interiorBuilding\.factionId/);
  assert.match(qs.enchantHere.body, /=== GUILD_GROUPS\.MagesGuild\) return \{ kind: 'shop'/);
  assert.match(ENCHANTING_HOW(0), /at an enchanting station, in a Mages Guild hall or your own home, from the Stores page/, 'PIN MOVED (VOICE2): the station\'s places in the sentence, not in brackets');
  // CARP-YARD: a joinery's bench is the street's workbench question (scenes/world.js)
  assert.match(src('src/scenes/world.js'), /workbench: \(\) => workbenchHere\(\),\s+\/\/ CARP-YARD: and a joinery's in the street/);
  assert.match(CRAFT_HOW.building(), /a Furniture Store's, a joinery's or one in your own home/);
  // the fire is any lit one, and nobody's to charge for
  assert.deepEqual(COOK_FIRE, { kind: 'fire', fee: 0 });
  assert.match(CRAFT_HOW.provisioning(), /^Cook at any lit fire, such as a campfire, a hearth or a brazier: stand close to its flame/);
  // every one is worked on the Stores page, the Holdings tab's (enhancedMenu.js: the Professions page the Stats rail's)
  assert.deepEqual(PROF_PAGE_SECTIONS.map(([id]) => id), ['professions', 'stores']);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const PROF_HOLD_SECTIONS = Object\.freeze\(PROF_PAGE_SECTIONS\.filter\(\(\[id\]\) => id !== 'professions'\)\);/);
  assert.match(menu, /\['holdings', 'Holdings'\]/);
  for (const k of ['smithing', 'building', 'outfitting', 'provisioning']) assert.match(CRAFT_HOW[k](), /open the Stores page (there )?\(Holdings > Stores\)/i, `${k}: where it is worked`);

  // THE WORKS: the forge's ingots of mined ore pay Smithing; a saw and a cure pay nothing, a mason's work Building
  const ingots = SMELT_RECIPES.filter((r) => r.out.startsWith('ingot:') && r.inputs.every((i) => /^(metal|ore):/.test(i.key)));
  assert.ok(ingots.length >= 8 && ingots.every((r) => trackOf(r.xp) === 'smithing'), 'the forge smelts the ore you mine, for Smithing XP');
  assert.match(CRAFT_HOW.smithing(), /The Forge smelts the ore you mine into ingots, and the Anvil makes weapons, armor and tools from them, or from raw ore by smelting it first\./, 'PIN MOVED (VOICE2): armor, American spelling');
  assert.match(CRAFT_HOW.smithing(), /Smelting and every piece you make earn Smithing experience\.$/);
  assert.ok(SAW_RECIPES.length && SAW_RECIPES.every((r) => r.xp === null && r.station === 'workbench'), 'a saw pays no XP');
  assert.match(CRAFT_HOW.building(), /saws the logs you fell into planks/);
  assert.match(CRAFT_HOW.building(), /Every piece, cut and mix earns Building experience; sawing earns none\.$/);   // AUDIT FB1018D L1-5: each XP clause whole
  assert.ok(MASON_RECIPES.every((r) => trackOf(r.xp) === 'building' && r.station === 'mason'), 'the cut and the mix pay Building');
  assert.deepEqual(MASON_RECIPES.map((r) => r.id), ['cut:stone', 'mix:mortar']);
  assert.ok(CURE_RECIPES.length && CURE_RECIPES.every((r) => r.xp === null && r.station === 'loom' && r.inputs[0].key.startsWith('hide:')), 'a cure pays no XP');
  assert.match(CRAFT_HOW.outfitting(), /tanning rack cures the hides you skin into leather/);
  assert.match(CRAFT_HOW.outfitting(), /Every piece earns Outfitting experience; curing earns none\.$/);
  // every piece a station makes pays its craft's track, a dish Provisioning's as a brew does, and Linen and Wool are bought,
  // never made (COUNTER_ONLY) - the Weavers' two, Linen a furnisher's counter's too (AUDIT FB1018D L1-9)
  for (const r of RECIPES) {
    assert.ok(['smithing', 'building', 'outfitting', 'provisioning'].includes(trackOf(r.profession)), `${r.id} is a craft's`);
    assert.ok(r.kind === 'dish' ? cookXp(0) > 0 : craftXp(r.tier, 0, false) > 0, `${r.id} pays its craft`);
  }
  assert.deepEqual(WEAVERS_STOCK.map((s) => s.key), ['cloth:linen', 'cloth:wool']);
  assert.ok(COUNTER_ONLY.includes('cloth:linen') && COUNTER_ONLY.includes('cloth:wool'));
  assert.match(CRAFT_HOW.outfitting(), /Linen and Wool are bought from the Weavers, at a Clothing Store's loom or a Notice Board's Market/);
  assert.ok(RECIPES.some((r) => r.kind === 'dish') && RECIPES.filter((r) => r.kind === 'dish').every((r) => trackOf(r.profession) === 'provisioning'), 'a dish pays Provisioning');
  assert.match(CRAFT_HOW.provisioning(), /Brewing and cooking both earn Provisioning experience\.$/);
  // a dish's goods: the meat a body gives, the net's fish, the herbs and the Basket's food
  const goods = new Set(COOKING_RECIPES.flatMap((r) => r.inputs.map((i) => i.key.split(':')[0] === 'food' ? i.key : 'herb')));
  assert.deepEqual([...goods].sort(), ['food:apple', 'food:egg', 'food:fish', 'food:meat', 'food:mushroom', 'food:orange', 'herb']);
  assert.match(CRAFT_HOW.provisioning(), /from the meat you skin, the fish you net, herbs and the food a Basket finds, and go to your pack/);
  // BAG-CRAFT: the brew reads what is carried as every station does - the brew's words said the Stores alone
  assert.match(src('src/ui/professions/profPages.js'), /function drawAlchemyStation[\s\S]*?const held = \(k\) => workOf\(book, k\);/);
  assert.match(ALCHEMY_HOW, /from the Stores page, with what you carry or keep in your Stores\./, 'PIN MOVED (VOICE2): the brew\'s words reworded, the carried goods kept');
});

test('CRAFT-HOWTO THE TUTORIAL: a Crafting page among Professions & Survival, after Professions, popping with the first gather beside it - every station\'s shop named as the host answers it, the Stores page where the menu keeps it, found by the pane\'s search; the Professions page no longer says its key opens the Stores (mutants: the page moved off its group; a shop dropped from its list; the seam dropped; the Professions page\'s old words)', () => {
  const page = tutorialById('crafting');
  assert.ok(page, 'a Crafting page');
  assert.deepEqual(tutorialsIn('livelihood').map((p) => p.id), ['foraging', 'professions', 'crafting', 'survival']);
  assert.equal(page.title, 'Crafting');
  assert.equal(page.trigger, tutorialById('professions').trigger, 'when the first gather pops the two before it');
  // the seam: the first gather's press pops the three, in order (scenes/gatherHost.js)
  assert.match(src('src/scenes/gatherHost.js'), /\n {6}noteFirstUse\('foraging'\); noteFirstUse\('professions'\); noteFirstUse\('crafting'\);/);
  const { body, points } = tutorialText(page, () => 'DOWN');
  const words = [...body, ...points].join(' ');
  // AUDIT FB1018D L1-6: by the key - "Menu > Holdings" is the Enhanced menu's alone (the Classic skin's Escape is DFU's
  // pause, no tabs), and the key opens the pages on either skin (ui/pauseDoor.js profPageAt)
  assert.match(body[0], /stand at one, press \[DOWN\] and open Holdings > Stores\. Cook at any fire\.$/);
  assert.doesNotMatch(words, /Menu >/);
  // every shop a station question answers, as the list names them
  const qs = stationQuestions();
  const list = { forgeHere: 'Forge:', loomHere: 'Loom:', workbenchHere: 'Workbench:', jewellerHere: 'Jeweler\'s bench:',   // PIN MOVED (VOICE2): American spelling (Voice.md rule 8)
  masonHere: 'Mason\'s bench:', alchemyHere: 'Alchemy:' };
  for (const [q, head] of Object.entries(list)) {
    const at = words.indexOf(head);
    assert.ok(at >= 0, `${head} listed`);
    const entry = words.slice(at + head.length, words.indexOf('.', at));
    for (const ty of qs[q].types) assert.ok(entry.includes(SHOP_WORDS[ty][1]), `${head} names ${SHOP_WORDS[ty][1]}`);
  }
  assert.match(words, /Workbench: Furniture Stores, joineries\./);
  assert.match(words, /Enchanting: Mages Guild halls\./);
  assert.match(words, /Your home can hold stations too\. Each crafting profession under \[DOWN\] says more\.$/);
  assert.deepEqual(tutorialsMatching('jeweler').map((p) => p.id), ['crafting'], 'PIN MOVED (VOICE2): the pane\'s search finds it, by its American spelling');
  // the Professions page: the key lands on the Professions page (input.js), the Stores page is Holdings'
  assert.match(src('src/ui/input.js'), /case 'Professions': return ctx\.togglePause && ctx\.sailing\?\.\(\) !== true \? \(ctx\.togglePause\(\{ at: 'professions', setPlayerPos \}\), true\)/);
  const prof = tutorialText(tutorialById('professions'), () => 'DOWN').body.join(' ');
  assert.doesNotMatch(prof, /opens them and your Stores/);
  assert.match(prof, /\[DOWN\] opens them, and your stored goods are under Holdings > Stores in the same window\.$/);
  assert.match(src('src/ui/pauseDoor.js'), /if \(profPageAt\(hooks\.at\)\) \{\n {4}if \(!profPagesShown\(\)\) \{ hudText\(profPagesClosedLine\(\)\); return null; \}\n {4}if \(typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/,
    'the key\'s page opens the tabbed window on either skin - where Holdings > Stores is');
  // AUDIT FB1018D L1-7: and the key's Controls row says the same - it opens the Professions page, the Stores a tab away
  assert.equal(actionLabel('Professions'), 'Open your Professions page (online)');
});

test('CRAFT-HOWTO IN EVERY WHOLE LANGUAGE: the new words are drafted in each language the catalog holds whole, the Crafting page\'s last point naming the key it fills (the l10n gate holds the rest)', () => {
  const keys = ['prof.page.how.smithing', 'prof.page.how.building', 'prof.page.how.outfitting', 'prof.page.how.cooking', 'prof.page.how.alchemy',
    'tutorials.crafting.title', 'tutorials.crafting.trigger', 'tutorials.crafting.body', 'tutorials.crafting.shops1', 'tutorials.crafting.shops2', 'tutorials.crafting.more'];
  const en = src('locales/en/Port_Strings.csv');
  for (const k of keys) assert.ok(en.includes(`\n${k},"`), `${k} in the English catalog`);
  const whole = LOCALE_CATALOG.filter((l) => l.source === 'machine' && !l.drafting).map((l) => l.code);
  assert.equal(whole.length, 13);
  for (const lang of whole) {
    const csv = src(`locales/${lang}/Port_Strings.csv`);
    for (const k of keys) assert.ok(csv.includes(`\n${k},"`), `${lang}: ${k}`);
    assert.match(csv, /\ntutorials\.crafting\.more,"[^\n]*\{Professions\}/, `${lang}: the key named as a key`);
  }
});
