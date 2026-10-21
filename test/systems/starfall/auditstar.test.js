// AUDIT STAR (2026-10-20, the owner: text and UI "enhanced plus + not AI-like and overexplanatory"): THE STARFALL'S WORDS,
// ITS ITEM'S NAME AND ITS SET'S POWERS, read again - bible/11-Multiplayer/Starfall.md section 8 (AUDIT STAR) and
// Sigil-Sets.md section 6f. Each master its own circle line; the fight's calls each their own; the claim's and the cap's
// lines in the gate's and the festival's voice, the cap's number handed to the language; the Veil's effect said, its chip
// and its spell named through the text core; Bound in Silk's held blow cuts the count whatever its weight; a chip
// carries its tier; the star's glass is Starfall Glass, no custom row's name is another's, and its card says what it is.
// tools/mutants/auditstar.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { STAR_MASTERS } from '../../../src/systems/starfall/starCoven.js';
import { STAR_AT_TEXT } from '../../../src/systems/starfall/starWords.js';
import { STAR_CLAIM_TEXT } from '../../../src/net/starfall/starClaims.js';
import { STAR_SPOILS_TEXT } from '../../../src/systems/starfall/starSpoils.js';
import { MARKS_TEXT, createMarksBook } from '../../../src/net/marksBook.js';
import { MARKS_COMBAT } from '../../../src/net/marksLaw.js';
import { haulCappedText, claimHauls } from '../../../src/ui/haulCards.js';
import { patchLocaleTable, setLocale, clearLocaleTables } from '../../../src/systems/textManager.js';
import {
  setBlow, setStrike, setStruck, setHudChips, setSetPowersVoice, strandsAt, veilBundle, VEIL_TEXT, CHIP_TIER,
  _setSetPowersClockForTests, _resetSetPowersForTests,
} from '../../../src/systems/sigil/sigilSetPowers.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { setById, ROUND_SECONDS, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { statusTiles } from '../../../src/ui/hud/hudStatus.js';
import { setTileTier } from '../../../src/ui/enhanced/enhancedHud.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { mintCondition, templateByIndex, registerCustomTemplates, customTemplateRows } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../../src/systems/armorMaterials.js';
import { starglass, STARGLASS_ROW, STARGLASS_TEXT } from '../../../src/systems/starfall/starglass.js';
import { survivalInfoTokens, itemInfoRows } from '../../../src/systems/item/itemInfo.js';
import { itemLine } from '../../../src/ui/enhanced/enhancedInventory.js';
import { RRI_TEMPLATES } from '../../../src/systems/roleplayRealismItems/rriItems.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('AUDIT STAR W1: every master calls its circle in a line of its own - its name with its article, her or its as it stands - and no line drops a name into a shared one (mutants: a master\'s pronoun, a master\'s article)', () => {
  assert.deepEqual(Object.values(STAR_MASTERS).map((m) => [m.id, m.circle()]), [
    ['mother', 'The Coven Mother calls her circle. Break it!'],
    ['flesh', 'The Flesh Atronach calls its circle. Break it!'],
    ['lord', 'The Daedra Lord calls its circle. Break it!'],
    ['seducer', 'The Daedra Seducer calls her circle. Break it!'],
    ['lich', 'The Ancient Lich calls its circle. Break it!'],
  ]);
  for (const m of Object.values(STAR_MASTERS)) {
    const name = m.name();
    assert.ok(m.circle().startsWith(name.startsWith('The ') ? name : `The ${name}`), `${m.id}: its own name, with its article`);
    assert.match(m.circle(), m.female ? / her circle\./ : / its circle\./, `${m.id}: as it stands`);
  }
  assert.equal('circle' in STAR_AT_TEXT, false, 'the shared line is gone');
  assert.match(read('src/scenes/starfall/starfallHost.js'), /sayAt\(S, `circle\$\{i\}`, M\.circle\(\)\)/, 'the host says the master\'s own');
});

test('AUDIT STAR W4: the fight\'s calls each say their own thing - "comes for the star" at most three times over the waves and the masters (mutants: a call of the old set)', () => {
  const calls = [1, 2, 3, 4].map((w) => STAR_AT_TEXT.wave(w)).concat(Object.values(STAR_MASTERS).map((m) => m.call()));
  assert.equal(new Set(calls).size, calls.length, 'no two alike');
  assert.ok(calls.filter((c) => /comes for the star/.test(c)).length <= 3, calls.join(' | '));
  assert.equal(STAR_AT_TEXT.wave(4), 'Mephala\'s own join the fight.');
  assert.equal(STAR_MASTERS.flesh.call(), 'A Flesh Atronach rises from the crater!');
  assert.equal(STAR_MASTERS.seducer.call(), 'Mephala sends a Daedra Seducer!');
});

test('AUDIT STAR W2/W3/W5: the claim\'s lines in the gate\'s shape, the day\'s bound in the festival\'s voice, the spoils\' line the whole of them; the cap\'s line hands the language its number, never "150 silver" in English; the card\'s cap a label through the text core (mutants: the cap\'s words unhanded; the label frozen)', () => {
  assert.equal(STAR_CLAIM_TEXT.recorded(3, 0), 'Star recorded. Stars held: 3.');
  assert.equal(STAR_CLAIM_TEXT.recorded(3, 70), 'Star recorded. Stars held: 3. +70 toward your Renown.');
  assert.equal(STAR_CLAIM_TEXT.guest(), 'Star not recorded. Add a username within a week to keep it.');
  assert.equal(STAR_CLAIM_TEXT.dayFull(), 'You have held enough stars for today.');
  assert.equal(STAR_SPOILS_TEXT.granted(), 'The star\'s spoils are in your pack.');
  assert.equal(MARKS_TEXT.cappedStar(), `No silver for this star. You've reached today's limit of ${MARKS_COMBAT.perDay} silver.`);
  assert.equal(haulCappedText(), 'Daily silver cap reached');
  const capped = claimHauls({ marks: { struck: 0, balance: 150, why: 'cap' } }, 'star');
  assert.deepEqual(capped.map((c) => [c.haul, c.text]), [['note', 'Daily silver cap reached']]);
  try {
    patchLocaleTable('xx', 'Port_Strings', [['marks.capped.star', 'Kein Silber. Grenze {cap} Silber.'], ['haul.capped', 'Silbergrenze erreicht']]);
    setLocale('xx');
    assert.equal(MARKS_TEXT.cappedStar(), `Kein Silber. Grenze ${MARKS_COMBAT.perDay} Silber.`, 'the number alone: the language says "silver"');
    assert.deepEqual(claimHauls({ marks: { struck: 0, balance: 150, why: 'cap' } }, 'star').map((c) => c.text), ['Silbergrenze erreicht'], 'read when the card is made');
  } finally { setLocale('en'); clearLocaleTables('xx'); }
  assert.equal(typeof createMarksBook, 'function');
});

const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = () => ({
  isPlayer: true, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [],
  health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const BODY = [107, 106, 105, 102, 103, 104, 108];
const piece = (templateIndex, set) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp: 0 };
  return it;
};
const wearSet = (e, set, n) => { for (const t of BODY.slice(0, n)) { const it = piece(t, set); e.items.push(it); equipItem(e, it); } return e; };
let T = 0;
function fresh() {
  _setSetPowersClockForTests(() => T);
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests(); setPlayerDoor(null); T = 0;
  const v = { said: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: () => {} });
  setSigilOnline(true); setSigilRenown(1);
  return v;
}
const RAT = Object.freeze({ name: 'rat' });
/** A blow of mine that lands; `whole` false for a blow that does not count whole (formulas.js `blow` - an off hand's part). */
const swing = (e, weapon, target, whole = true) => { const d = setBlow(weapon, 100, e, target, {}); setStrike(e, target, d, weapon, { blow: whole }); return d; };

test('AUDIT STAR S1: BOUND IN SILK - the held blow\'s landing cuts the count whatever its weight, and only a blow that counts whole lays a strand: an off hand\'s part-blow on three strands takes the bonus once, never twice (mutants: the cut on a whole blow alone; a part-blow laying a strand)', () => {
  fresh();
  const e = wearSet(player(), 'starspun', 4);
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
  const s = createWeapon(120, 0, () => 0.5);
  T = 10;
  assert.deepEqual([swing(e, s, RAT), swing(e, s, RAT), swing(e, s, RAT), swing(e, s, RAT, false), swing(e, s, RAT)], [100, 100, 100, 160, 100], 'the part-blow held, the count cut');
  assert.equal(strandsAt(RAT), 1, 'and the next whole blow laid the first again');
  fresh();
  const f = wearSet(player(), 'starspun', 4);
  T = 10;
  assert.deepEqual([swing(f, s, RAT, false), swing(f, s, RAT, false), swing(f, s, RAT, false), swing(f, s, RAT, false)], [100, 100, 100, 100], 'part-blows lay nothing');
  assert.equal(strandsAt(RAT), 0);
});

test('AUDIT STAR W6/S2/S3: the Veil says its effect and how long, its spell and its chip named through the text core; every chip carries its tier and the HUD\'s card reads the tier by it, never by the chip\'s name; a blow the full-health guard leaves at 1 hides me, as it sheds Shed Skin (mutants: the seconds; the chip\'s tier; the card by name)', () => {
  const v = fresh();
  const e = wearSet(player(), 'starspun', 6);
  const casts = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: (b) => casts.push(b), player: () => e });
  T = 10;
  setStruck(RAT, e, 500);
  const dead = hurtPlayer(e, 500);
  assert.deepEqual([dead, e.health], [false, 1], 'the full-health guard: a blow from full that would kill leaves 1');
  assert.equal(casts.length, 1, 'S3: hidden at 1 - the guard is no death save');
  assert.equal(casts[0].name, VEIL_TEXT.spell());
  assert.deepEqual(v.said, [`Mephala's Veil! Chameleon for ${2 * ROUND_SECONDS} s.`]);
  assert.equal(VEIL_TEXT.proc(20), 'Mephala\'s Veil! Chameleon for 20 s.');
  assert.deepEqual([VEIL_TEXT.spell(), VEIL_TEXT.chip(), VEIL_TEXT.ready()], ['Mephala\'s Veil', 'Veil', 'Mephala\'s Veil is ready again.']);
  assert.deepEqual(veilBundle(2).name, 'Mephala\'s Veil');
  const chips = setHudChips(e, 10);
  assert.deepEqual(chips.map((c) => [c.key, c.name, c.tier]), [['veil', 'Veil', CHIP_TIER]]);
  assert.equal(CHIP_TIER, 2, 'the 6-piece tier');
  const tiles = statusTiles({ powers: chips });
  assert.equal(tiles[0].tier, CHIP_TIER);
  const at = setTileTier(tiles[0]);
  assert.deepEqual([at?.set.id, at?.i, at?.set.tiers[at.i].name], ['starspun', 2, 'Mephala\'s Veil'], 'the card finds the Veil though "Veil" begins no tier\'s name');
  assert.equal(setTileTier({ ...tiles[0], name: 'Schleier' })?.i, 2, 'nor does a name in the player\'s language matter');
  assert.equal(setTileTier({ ...tiles[0], tier: null }), null, 'no tier, no line');
  assert.equal(setTileTier({ set: 'technique', tier: 2 }), null, 'a tile of no set');
  assert.equal('Reprieve'.startsWith(setById('panoply').tiers[2].name), false, 'the Reprieve\'s chip was another the name could not find');
  try {
    patchLocaleTable('xx', 'Port_Strings', [['starfall.set.veilChip', 'Schleier'], ['starfall.set.veil', 'Schleier! {s} s.'], ['starfall.set.veilSpell', 'Mephalas Schleier']]);
    setLocale('xx');
    assert.equal(setHudChips(e, 10)[0].name, 'Schleier');
    assert.equal(VEIL_TEXT.proc(10), 'Schleier! 10 s.');
    assert.equal(veilBundle(2).name, 'Mephalas Schleier', 'the spell as the HUD\'s list and the sheet name it');
  } finally { setLocale('en'); clearLocaleTables('xx'); }
});

/** Every module that registers a custom row, imported (the import IS the registration), and the one that registers on
 *  install (Roleplay & Realism: Items) given its rows. */
async function everyCustomRow() {
  const walk = (d, out = []) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); } return out; };
  const files = walk(join(ROOT, 'src')).filter((f) => /registerCustomTemplates\(/.test(readFileSync(f, 'utf8')));
  assert.ok(files.length >= 20, `${files.length} homes`);
  for (const f of files) await import(f);
  registerCustomTemplates(RRI_TEMPLATES);
  return customTemplateRows();
}
/** Two mods' own rows, verbatim, that name the same fruit (Climates & Calories' 532 and 533, Foraging's 1608 and 1609 -
 *  systems/foraging/foragingLaw.js fruitTemplate takes C&C's while it is on): their data, not ours to rename. */
const SHARED_BY_MODS = Object.freeze({ apple: [532, 1608], orange: [533, 1609] });

test('AUDIT STAR I1/I2: THE STAR\'S GLASS IS STARFALL GLASS - no custom row shares a name with another but two mods\' own fruit, so the Eltheric Ocean\'s Starglass is one good and the star\'s another; its card says what it is and what it is for, on both skins\' cards (mutants: the old name; the card\'s lines)', async () => {
  const rows = await everyCustomRow();
  assert.ok(rows.length > 150, `${rows.length} rows`);
  const byName = new Map();
  for (const r of rows) { const k = String(r.name).trim().toLowerCase(); byName.set(k, [...(byName.get(k) ?? []), r.index]); }
  const shared = Object.fromEntries([...byName].filter(([, v]) => v.length > 1).map(([k, v]) => [k, v.sort((a, b) => a - b)]));
  assert.deepEqual(shared, SHARED_BY_MODS, 'every other custom row its own name');
  assert.equal(STARGLASS_ROW.name, 'Starfall Glass');
  assert.equal(templateByIndex(576)?.name, 'Starfall Glass');
  assert.equal(templateByIndex(1340)?.name, 'Starglass', 'the sea\'s good keeps its name');
  const g = starglass(2);
  assert.deepEqual(survivalInfoTokens(g).map((r) => r.text), ['Starfall Glass', survivalInfoTokens(g)[1].text, ...STARGLASS_TEXT.glass()]);
  assert.deepEqual(STARGLASS_TEXT.glass(), ['Pale glass from a fallen star, still holding some of its light.', 'Any merchant pays well for it.']);
  assert.deepEqual(itemInfoRows(g, () => null).map((r) => r.text).slice(2), STARGLASS_TEXT.glass(), 'the classic info box');
  assert.deepEqual(itemLine(g).survival, STARGLASS_TEXT.glass(), 'and the enhanced card');
});
