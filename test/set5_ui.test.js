// SET5 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md; Mac: "sigil armor sets that also come with set
// builds ... go all out on this"): THE SETS ON SCREEN. The law's one view of a set for a wearer (the places filled, the
// stage and what holds it, why it sleeps, the tiers) and its words for a line-printing tooltip; the HUD's chips for the
// powers; the set block, the doll's strip and the frame's mark built on the fake document (test/invdrag.mjs); the sigil
// block's words for a set's armour; the sheet's rules; and every surface's wiring. The browser's side - the strip in its
// column, the rune's colour, the block's lines, the chips' hue - is tools/setUiProbe.mjs's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import { setSigilOnline, setSigilRenown, SIGIL_STAGES, _resetSigilForTests } from '../src/systems/sigil.js';
import {
  SIGIL_SETS, SET_PLACES, setPlacesWorn, setCardView, setLines, setsSleep, setSleepText, setSetsWearer, setsWearer,
  setSetsDueling, _resetSigilSetsForTests,
} from '../src/systems/sigilSets.js';
import { setHudChips, setStruck, _setSetPowersClockForTests, _resetSetPowersForTests } from '../src/systems/sigilSetPowers.js';
import { setPlayerDoor } from '../src/systems/playerDoor.js';
import { reportPlayerKill } from '../src/systems/playerKills.js';
import { hurtPlayer } from '../src/characters/playerEntity.js';
import { rarityLines } from '../src/systems/lootRarity.js';
import { setCard, setStrip, markSetFrame, setShades, setStageText, SET_PLACE_WORDS } from '../src/ui/setCard.js';
import { sigilCard } from '../src/ui/sigilCard.js';
import { sigilRuneTileUrl, SIGIL_RUNE_TILE_URL } from '../src/ui/sigilRune.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { mintAetheric, aethericById } from '../src/systems/aetheric.js';
import { equipItem } from '../src/systems/equip.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
const player = () => ({ isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(35).fill(30), level: 5, career: {}, health: 60, maxHealth: 100, activeEffects: [] });
const BODY = [107, 106, 105, 102, 103, 104, 108];
const XP = SIGIL_STAGES.map((s) => s.xp);
const piece = (templateIndex, set, xp = 0, name = null) => {
  const it = mintCondition({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 });
  it.rarity = 'rare';
  it.sigil = { set, party: 1, xp };
  if (name) it.name = name;
  return it;
};
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } return e; };
let T = 0;
_setSetPowersClockForTests(() => T);
function fresh() { _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests(); setPlayerDoor(null); T = 0; }
const online = (renown) => { setSigilOnline(true); setSigilRenown(renown); };

test('SET5 the view of a set for a wearer: which of the nine places its pieces fill (a weapon in either hand), how many, whether this piece is one, the stage and what holds it (the piece to grow, the Renown), why every set sleeps (offline, the Renown unknown, a duel), and its tiers at the stage; null for no set piece; the wearer defaults to the host\'s (mutants: a place off by one; the shield\'s place never lit; the weapon\'s place never lit; the sleep reasons mixed)', () => {
  fresh();
  const e = player();
  const helm = piece(107, 'ruhn', XP[1]), boots = piece(108, 'ruhn', XP[2]);
  const shield = mintAetheric(aethericById('ruhn-gate-shield'));
  const axe = mintAetheric(aethericById('ruhn-gatecleaver'));
  wear(e, helm, boots, shield, axe);
  assert.deepEqual(setPlacesWorn(e, 'ruhn'), [true, false, false, false, false, false, true, true, true], 'head, feet, the shield, the weapon');
  assert.deepEqual(setPlacesWorn(e, 'dagon'), new Array(9).fill(false));
  assert.deepEqual(setPlacesWorn(null, 'ruhn'), new Array(9).fill(false));
  assert.equal(SET_PLACES.length, 9);
  assert.equal(SET_PLACE_WORDS.length, SET_PLACES.length);
  // the sleep, in order: offline, then the Renown unknown, then a duel
  assert.equal(setsSleep(), 'offline');
  setSigilOnline(true);
  assert.equal(setsSleep(), 'renown');
  setSigilRenown(12);
  assert.equal(setsSleep(), null);
  setSetsDueling(true);
  assert.equal(setsSleep(), 'duel');
  setSetsDueling(false);
  assert.deepEqual(['offline', 'renown', 'duel', null].map(setSleepText), ['sets wake online', 'sets wake with your Renown', 'sets sleep in a duel', null]);
  // the view: the Renown 12 holds everything at Kindled; the fresh shield and axe hold the set at Faint
  let v = setCardView(helm, e);
  assert.deepEqual([v.id, v.name, v.count, v.of, v.worn, v.stage, v.stageName, v.sleep], ['ruhn', "Ruhn's Regalia", 4, 9, true, 0, 'Faint', null]);
  assert.equal(v.colour, SIGIL_SETS.ruhn.colour);
  assert.equal(v.aetheric, true);
  assert.equal(v.heldPiece, shield, 'the fresh Gate-Shield, the first of the lowest');
  assert.equal(v.renownNext, null, 'the Renown opens Kindled: not what holds it');
  assert.deepEqual(v.tiers.map((t) => t.awake), [true, true, false], 'four pieces: two tiers');
  assert.equal(v.tiers[0].text, SIGIL_SETS.ruhn.tiers[0].text({ fire: 15, sear: 2 }), 'the numbers at the set\'s stage');
  const packed = piece(103, 'ruhn', 0);
  e.items.push(packed);
  assert.equal(setCardView(packed, e).worn, false, 'a piece in the pack is not one of the four');
  assert.equal(setCardView(packed, e).count, 4);
  setSetsDueling(true);
  v = setCardView(helm, e);
  assert.deepEqual([v.stage, v.stageName, v.sleep, v.tiers.some((t) => t.awake)], [-1, null, 'duel', false]);
  setSetsDueling(false);
  assert.equal(setCardView({ name: 'Mace', group: 'Weapons', templateIndex: 124 }, e), null);
  assert.equal(setCardView(null, e), null);
  setSetsWearer(() => e);
  assert.equal(setsWearer(), e);
  assert.equal(setCardView(helm).count, 4, 'the host\'s wearer by default');
  setSetsWearer(() => { throw new Error('gone'); });
  assert.equal(setsWearer(), null, 'a wearer that throws is none');
  fresh();
});

test('SET5 the set in words, for a line-printing tooltip: its name, the places worn of nine and its stage (or why it sleeps), then a line a tier - how many pieces more a sleeping tier wants; ASCII only, as the classic font draws; rarityLines carries them by default and the card that draws the block asks without - AUDIT U5 an unidentified piece\'s too (the sigil and its set are the port\'s own marks, seen at once); U11 a set\'s armour\'s sigil line says it sleeps in a duel, a set weapon\'s keeps its blow (mutants: the lines never carried; the count of pieces more off by the count worn; an unidentified piece\'s set unsaid; a sleeping piece\'s sigil called Faint; a set weapon\'s blow unsaid in a duel)', () => {
  fresh();
  const e = player();
  const a = piece(107, 'dagon', 0), b = piece(106, 'dagon', 0), c = piece(105, 'dagon', 0);
  wear(e, a, b, c);
  setSetsWearer(() => e);
  assert.deepEqual(setLines(a), [
    "Dagon's Brand: 3 of 9 worn (sets wake online)",
    `2 pieces - Ravager: ${SIGIL_SETS.dagon.tiers[0].text({ strength: 2, critical: 4 })} (asleep)`,
    `4 pieces - Bloodfury: ${SIGIL_SETS.dagon.tiers[1].text({ more: 4 })} (1 more)`,
    `6 pieces - Rampage: ${SIGIL_SETS.dagon.tiers[2].text({ stack: 4 })} (3 more)`,
  ]);
  online(1);
  const lines = setLines(a);
  assert.equal(lines[0], "Dagon's Brand: 3 of 9 worn, Faint");
  assert.equal(lines[1], `2 pieces - Ravager: ${SIGIL_SETS.dagon.tiers[0].text({ strength: 2, critical: 4 })}`, 'awake: no suffix');
  for (const l of lines) assert.match(l, /^[\x20-\x7e]*$/, `ASCII: ${l}`);
  assert.deepEqual(setLines({ name: 'Mace' }), []);
  _resetForTests(); setPref('lootRarity', true);
  const tip = rarityLines(a);
  assert.deepEqual(tip.slice(-4), lines, 'a tooltip\'s list ends with its set');
  assert.ok(!rarityLines(a, { set: false }).includes(lines[0]), 'the card that draws the block asks without');
  const inv = strip(read('src/ui/enhancedInventory.js'));
  assert.match(inv, /itemPowerLines\(picked, deps, \{ set: false \}\)/);   // TRADE-INFO: the card reads the one list, and asks it without the set
  assert.match(inv, /const lines = rarityLines\(item, \{ sigil: false, set \}\);/, 'the list asks rarityLines as the card asked it');
  // AUDIT SET U5: an unidentified piece - its enchantment hidden, its sigil and its set said
  const hidden = { ...a, enchantments: [{ type: 1, param: 0 }], isIdentified: false };
  const unk = rarityLines(hidden);
  assert.equal(unk[1], 'Unidentified');
  assert.deepEqual(unk.slice(2), ['Sigil (Faint)', 'Faint: 0 / 5,000 to Kindled', ...lines], 'its sigil, then its set');
  assert.deepEqual(rarityLines(hidden, { sigil: false, set: false }), [unk[0], 'Unidentified'], 'the card that draws both blocks asks without');
  // AUDIT SET U11: in a duel a set's armour's sigil sleeps with its set; a set weapon's blow is SIGIL1's, and says so
  setSetsDueling(true);
  assert.deepEqual(rarityLines(a).slice(1, 2), ['Sigil (asleep in a duel)']);
  const sw = createWeapon(120, 0);
  sw.rarity = 'rare';
  sw.sigil = { power: 6, set: 'dagon', party: 1, xp: 0 };
  assert.match(rarityLines(sw)[1], /^Sigil \(Faint\): \+[\d.]+% damage, \+6% at Ascendant$/, 'the set weapon\'s blow, awake on a foe');
  setSetsDueling(false);
  _resetForTests();
  fresh();
});

test('SET5 the HUD\'s chips for the powers: a window running burns (the Rampage\'s stacks and seconds, Unbroken\'s halving, the Wrath\'s fury), a recovery waits - each only while its 6-piece tier is awake on me, in whole seconds (minutes past sixty); none for anyone but me or while the sets sleep (mutants: a recovery shown without its tier; a window shown as a recovery; the minutes misread)', () => {
  fresh(); online(1);
  const e = wear(player(), ...BODY.slice(0, 6).map((t) => piece(t, 'dagon')));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
  assert.deepEqual(setHudChips(e), [], 'nothing running');
  T = 10;
  reportPlayerKill({}); reportPlayerKill({});
  T = 10.4;
  assert.deepEqual(setHudChips(e), [{ key: 'rampage', set: 'dagon', name: 'Rampage II', text: '12s', state: 'active' }]);
  assert.deepEqual(setHudChips({ ...e, peer: 'p1' }), [], 'a peer\'s entity');
  setSetsDueling(true);
  assert.deepEqual(setHudChips(e), [], 'a duel');
  setSetsDueling(false);
  // Unbroken: the halving burns, then the recovery waits - minutes past sixty
  fresh(); online(1);
  const m = wear(player(), ...BODY.slice(0, 6).map((t) => piece(t, 'malacath')));
  m.health = 5;
  T = 0;
  hurtPlayer(m, 50);
  T = 1;
  assert.deepEqual(setHudChips(m), [{ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: '3s', state: 'active' }]);
  T = 4;
  assert.deepEqual(setHudChips(m), [{ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: '4:56', state: 'recovering' }]);
  T = 299;
  assert.equal(setHudChips(m)[0].text, '1s');
  T = 300;
  assert.deepEqual(setHudChips(m), [], 'recovered');
  // a recovery with its tier taken off: nothing to say
  T = 0; m.health = 5; _resetSetPowersForTests(); _setSetPowersClockForTests(() => T);
  hurtPlayer(m, 50);
  T = 10;
  const five = wear(player(), ...BODY.slice(0, 5).map((t) => piece(t, 'malacath')));
  assert.deepEqual(setHudChips(five), [], 'five pieces: the Unbroken tier asleep, its recovery unsaid');
  // the Wrath and Eventide
  fresh(); online(1);
  const r = wear(player(), ...BODY.slice(0, 6).map((t) => piece(t, 'ruhn')));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => r });
  r.health = 40;
  setStruck({ name: 'rat' }, r, 15);   // AUDIT SET L3: the Wrath answers a foe's blow
  hurtPlayer(r, 15);
  assert.deepEqual(setHudChips(r).map((c) => [c.name, c.text, c.state]), [['Wrath', '10s', 'active']]);
  T = 10;
  assert.deepEqual(setHudChips(r).map((c) => [c.name, c.text, c.state]), [['Wrath', '2:50', 'recovering']]);
  fresh(); online(1);
  const n = wear(player(), ...BODY.slice(0, 6).map((t) => piece(t, 'nocturnal')));
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => n });
  reportPlayerKill({});
  assert.deepEqual(setHudChips(n), [{ key: 'eventide', set: 'nocturnal', name: 'Eventide', text: '30s', state: 'recovering' }]);
  fresh();
});

test('SET5 the set block, built: the name and the pieces of nine, the Prince and the role, nine places lit where worn, the stage line (the piece to grow and the Renown, or the sleep, or what would wake it), three tiers lit when awake with Ascendant\'s numbers under the pointer; null for no set piece (mutants: the places unlit; a sleeping tier lit; the stage line lost)', () => {
  withDom(() => {
    fresh(); online(12);
    const e = player();
    const helm = piece(107, 'dagon', XP[1], 'Helm');
    wear(e, helm, piece(106, 'dagon', XP[2]), piece(105, 'dagon', XP[2]), piece(102, 'dagon', XP[2]));
    const box = setCard(helm, e, (it) => it.name);
    assert.equal(box.tagName, 'SECTION');
    assert.equal(box.className, 'setbox');
    assert.equal(box.dataset.set, 'dagon');
    assert.equal(box.dataset.stage, '1');
    assert.equal(one(box, 'set-name').textContent, "Dagon's Brand");
    assert.equal(one(box, 'set-count').textContent, '4/9');
    assert.equal(one(box, 'set-role').textContent, 'Mehrunes Dagon · The one who does not stop');
    const places = kids(box, 'set-place');
    assert.equal(places.length, 9);
    assert.deepEqual(places.map((p) => p.classList.contains('on')), [true, true, true, true, false, false, false, false, false]);
    assert.equal(places[0].title, 'Head - worn');
    assert.equal(places[8].title, 'Weapon');
    assert.equal(one(box, 'set-stage').textContent, 'Kindled · Bright: grow your Helm, reach Renown 20');
    const tiers = kids(box, 'set-tier');
    assert.deepEqual(tiers.map((t) => t.classList.contains('awake')), [true, true, false]);
    assert.deepEqual(tiers.map((t) => one(t, 'set-at').textContent), ['2', '4', '6']);
    assert.equal(one(tiers[0], 'set-tier-name').textContent, 'Ravager');
    assert.equal(one(tiers[0], 'set-tier-text').textContent, SIGIL_SETS.dagon.tiers[0].text({ strength: 3, critical: 6 }), 'Kindled\'s numbers');
    assert.equal(tiers[0].title, `At Ascendant: ${SIGIL_SETS.dagon.tiers[0].text({ strength: 6, critical: 12 })}`);
    // the stage line's other words
    assert.equal(setStageText({ stage: 1, stageName: 'Kindled', heldPiece: null, renownNext: 20 }), 'Kindled · Bright at Renown 20');
    assert.equal(setStageText({ stage: 1, stageName: 'Kindled', heldPiece: { name: 'Boots' }, renownNext: null }), 'Kindled · Bright: grow your Boots');
    assert.equal(setStageText({ stage: 4, stageName: 'Ascendant', heldPiece: null, renownNext: null }), 'Ascendant');
    assert.equal(setStageText({ stage: -1, sleep: 'duel', count: 3 }), 'Asleep · sets sleep in a duel');
    assert.equal(setStageText({ stage: -1, sleep: null, count: 0 }), 'Wear two pieces to wake it');
    assert.equal(setStageText(null), '');
    setSetsDueling(true);
    const asleep = setCard(helm, e);
    assert.equal(asleep.dataset.stage, 'asleep');
    assert.equal(one(asleep, 'set-stage').textContent, 'Asleep · sets sleep in a duel');
    assert.ok(kids(asleep, 'set-tier').every((t) => !t.classList.contains('awake')));
    setSetsDueling(false);
    assert.equal(setCard({ name: 'Mace' }, e), null);
    fresh();
  });
});

test('SET5 the doll\'s strip: a line a worn set - its name, pieces of nine, three pips lit where awake, its stage - a press handing that set\'s first worn piece up; none while no set is worn; AUDIT U14 the strip a labelled group (mutants: a pip lit asleep; the press handing nothing; the label on a bare div)', () => {
  withDom(() => {
    fresh(); online(1);
    const e = player();
    assert.equal(setStrip(e), null, 'no set worn');
    const d1 = piece(107, 'dagon'), d2 = piece(106, 'dagon');
    wear(e, d1, d2, piece(108, 'ruhn'));
    let picked = null;
    const s = setStrip(e, { onPick: (it) => { picked = it; } });
    assert.deepEqual([s.getAttribute('role'), s.getAttribute('aria-label')], ['group', 'Sets worn'], 'AUDIT U14: a labelled group');
    const lines = kids(s, 'setline');
    assert.deepEqual(lines.map((l) => l.dataset.set), ['dagon', 'ruhn'], 'the registry\'s order');
    assert.deepEqual(lines.map((l) => one(l, 'setline-name').textContent), ["Dagon's Brand", "Ruhn's Regalia"]);
    assert.deepEqual(lines.map((l) => one(l, 'setline-count').textContent), ['2/9', '1/9']);
    assert.deepEqual(lines.map((l) => (one(l, 'setline-pips').children ?? []).map((i) => i.classList.contains('on'))), [[true, false, false], [false, false, false]]);
    assert.deepEqual(lines.map((l) => one(l, 'setline-stage').textContent), ['Faint', 'Faint']);
    assert.match(lines[0].title, /^2: Ravager\n4: Bloodfury \(asleep\)\n6: Rampage \(asleep\)$/);
    lines[0].onclick({ stopPropagation() {} });
    assert.equal(picked, d1, 'the set\'s first worn piece');
    setSigilOnline(false);
    const off = setStrip(e);
    assert.deepEqual(kids(off, 'setline').map((l) => one(l, 'setline-stage').textContent), ['Asleep', 'Asleep']);
    assert.ok(kids(off, 'setline').every((l) => (one(l, 'setline-pips').children ?? []).every((i) => !i.classList.contains('on'))));
    fresh();
  });
});

test('SET5 x GOLD-DROP (AUDIT FINAL F1, the merge with main): the doll\'s set line is a pick like any other - its press puts the gold field away, so the card and the field never stand together (AUDIT2 GOLD-DROP 2, main\'s one floater at a time) (mutant: the strip\'s pick keeps the field)', async () => {
  const { mountEnhancedInventory } = await import('../src/ui/enhancedInventory.js');
  const prev = globalThis.location;
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };
  try {
    withDom((dom) => {
      fresh(); online(1);
      const e = player();
      e.goldPieces = 1287;
      wear(e, piece(107, 'dagon'), piece(106, 'dagon'));
      const host = dom.mk('div'); dom.body.append(host);
      let view = null;
      view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => view.unmount(), dropItem: () => {} });
      const button = () => host.querySelectorAll('.goldbtn')[0] ?? null;
      const field = () => host.querySelectorAll('.goldfield')[0] ?? null;
      const card = () => host.querySelectorAll('.packtip').length;
      button().onclick();
      assert.deepEqual([card(), !!field()], [0, true], 'the field up');
      kids(host, 'setline')[0].onclick({ stopPropagation() {} });
      assert.deepEqual([card(), !!field()], [1, false], 'the set line\'s card up, the field put away');
      view.unmount();
      fresh();
    });
  } finally { globalThis.location = prev; _resetForTests(); }
});

test('SET5 the frame\'s mark and the rune\'s colour: a set piece\'s frame wears data-set, a frame that outlives its item is unmarked with it; the corner rune is the sigil\'s pixels in the set\'s own colour (a bad colour answers the teal); the block\'s shades are the set\'s colour lit and shaded (mutants: the mark never taken off; the rune left teal)', () => {
  withDom(() => {
    const n = { dataset: {}, style: {} };
    markSetFrame(n, piece(107, 'mora'));
    assert.equal(n.dataset.set, 'mora');
    markSetFrame(n, { name: 'Mace' });
    assert.equal(n.dataset.set, undefined, 'unmarked with its item');
    markSetFrame(n, null);
    assert.equal(n.dataset.set, undefined);
  });
  for (const set of Object.values(SIGIL_SETS)) {
    const u = sigilRuneTileUrl(set.colour);
    assert.ok(u.includes(encodeURIComponent(set.colour)), `${set.id}'s rune in ${set.colour}`);
    assert.ok(!u.includes(encodeURIComponent('#72f0d8')), `${set.id}: not the teal`);
    assert.equal(sigilRuneTileUrl(set.colour), u, 'the same picture for the same colour');
  }
  assert.equal(sigilRuneTileUrl('red'), SIGIL_RUNE_TILE_URL);
  assert.equal(sigilRuneTileUrl(null), SIGIL_RUNE_TILE_URL);
  assert.deepEqual(setShades('#ec5a3c'), { '--set': '#ec5a3c', '--set-hi': '#f5a494', '--set-lo': '#6a281b', '--set-rgb': '236,90,60' });
  assert.equal(setShades('nonsense')['--set'], '#b9ab93', 'a colour that is none: the kit\'s own');
  // the sheet: the block's own paragraph rules outrank the card's, the rune's picture follows --set-rune
  assert.ok(PLUS_CSS.includes('.pack-shell .card .setbox p.set-stage'), 'the stage line outranks .pack-shell .card p');
  assert.ok(PLUS_CSS.includes('.pack-shell .card .setbox p.set-role'));
  assert.ok(PLUS_CSS.includes('.dragghost[data-set] .tile::after { background-image: var(--set-rune); }'));
  for (const sel of ['.setbox {', '.set-place.on {', '.set-tier.awake .set-at {', '.setstrip {', '.setline-pips i.on {']) assert.ok(PLUS_CSS.includes(sel), sel);
  // UI3: a set power's tile in the status widget - its frame the set's light and shade, a recovery dashed and dimmed
  assert.match(read('src/ui/enhancedStyle.js'), /\.hst-cell\.set \{ --hst-hi: var\(--set-hi, #e6dccb\); --hst-lo: var\(--set-lo, #3a352a\); \}/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.hst-cell\.recovering \.hst-tile \{ border-style: dashed;/);
});

test('SET5 the sigil block for a set\'s armour: no "+null%" - its line says it is a set\'s sigil (asleep, or growing its set with its lowest piece), and a fresh one says it grows as I earn Renown wearing it; a weapon\'s block is as it was; AUDIT U11 in a duel a set\'s armour\'s sigil sleeps (no gem lit, named Asleep) and a set weapon\'s keeps its blow; U12 a set sigil on what is no set piece answers no set (mutants: the blow\'s words on armour; a duel\'s armour sigil lit; a set weapon\'s blow put to sleep; a ring called a set\'s)', () => {
  withDom(() => {
    fresh();
    const armour = piece(107, 'mora', 0);
    let box = sigilCard(armour);
    assert.equal(one(box, 'sigil-effect').textContent, 'A set\'s sigil: it wakes online, with your Renown');
    online(1);
    box = sigilCard(armour);
    assert.equal(one(box, 'sigil-effect').textContent, 'A set\'s sigil: its set grows with its lowest piece');
    assert.equal(one(box, 'sigil-note').textContent, 'It grows as you earn Renown wearing it.');
    const w = createWeapon(120, 0);
    w.sigil = { power: 6, set: 'dagon', party: 1, xp: 0 };
    box = sigilCard(w);
    assert.match(one(box, 'sigil-effect').textContent, /^\+[\d.]+% damage now · \+6% at Ascendant$/, 'a set weapon keeps its blow\'s words');
    assert.equal(one(box, 'sigil-note').textContent, 'It grows as this weapon earns Renown in your hand.');
    // AUDIT SET U11: a duel
    setSetsDueling(true);
    box = sigilCard(armour);
    assert.equal(box.dataset.stage, 'dormant');
    assert.equal(box.getAttribute('aria-label'), 'Sigil, Asleep');
    assert.equal(one(box, 'sigil-effect').textContent, 'A set\'s sigil: it sleeps in a duel');
    assert.ok(kids(box, 'sigil-gem').every((g) => !g.classList.contains('awake')), 'no gem burning');
    box = sigilCard(w);
    assert.match(one(box, 'sigil-effect').textContent, /^\+[\d.]+% damage now · \+6% at Ascendant$/, 'a set weapon\'s blow is awake on a foe');
    setSetsDueling(false);
    // U12: a set's sigil on a ring - no set piece
    box = sigilCard({ name: 'Ring', sigil: { set: 'mora', party: 1, xp: 0 } });
    assert.equal(one(box, 'sigil-effect').textContent, 'A sigil that answers no set');
    fresh();
  });
});

test('SET5 the surfaces\' wiring: the pack\'s card and the Info box append the set block after the sigil\'s, the doll\'s column the strip after the shelf, every frame the pack marks and the hotbar\'s slot and the diamond\'s cell wear the set (their repaint keys read it); the host names the wearer and hands the HUD its chips (mutants: the Info box without the block; the strip never drawn; the hotbar\'s key blind to the set; the HUD\'s chips unwired)', () => {
  const inv = strip(read('src/ui/enhancedInventory.js'));
  assert.match(inv, /\{ const sb = sigilCard\(picked\); if \(sb\) c\.append\(sb\); \}\s*\{ const set = setCard\(picked, deps\.entity, itemLongName\); if \(set\) c\.append\(set\); \}/, 'the card');
  assert.match(inv, /\{ const sb = sigilCard\(item\); if \(sb\) card\.append\(sb\); \}\s*\{ const set = setCard\(item, deps\.entity, itemLongName\); if \(set\) card\.append\(set\); \}/, 'the Info box');
  assert.match(inv, /col2\.append\(accessoryShelf\(\)\);\s*const sets = setStrip\(deps\.entity, \{ onPick: \(it\) => \{ picked = it; goldEntry = null; pickedAt = 'worn'; side = 'local'; notice = null; render\(\); \} \}\);\s*if \(sets\) col2\.append\(sets\);/, 'the doll\'s strip');
  assert.match(inv, /export function markItemFrame\(node, item\) \{[\s\S]*?markSetFrame\(node, item\);[\s\S]*?return node;\s*\}/, 'every frame the pack marks');
  const hb = strip(read('src/ui/enhancedHotbar.js'));
  assert.match(hb, /\$\{validSigil\(v\.item\.sigil\) \? '\*' : ''\}\$\{setIdOf\(v\.item\) \?\? ''\}/, 'the hotbar\'s repaint key reads the set');
  assert.match(hb, /if \(it && validSigil\(it\.sigil\)\) n\.dataset\.sigil = ''; else delete n\.dataset\.sigil;\s*markSetFrame\(n, it\);/);
  const hud = strip(read('src/ui/enhancedHud.js'));
  assert.match(hud, /const frameKey = worn \? `\$\{rarityAttr\(worn\) \?\? ''\}\|\$\{validSigil\(worn\.sigil\) \? 1 : 0\}\|\$\{setIdOf\(worn\) \?\? ''\}` : '';/, 'the diamond\'s key');
  assert.match(hud, /markSetFrame\(part\.cell, worn\);/);
  assert.match(hud, /const powers = setPowerChips\(vitals\);/);
  assert.doesNotMatch(hud, /from '\.\.\/systems\/sigilSetPowers\.js'/, 'the HUD never imports the powers (a cycle through the round\'s ticker)');
  const w = strip(read('src/scenes/world.js'));
  assert.match(w, /setSetsWearer\(\(\) => playerEntity\);\s*setHudSetChips\(setHudChips\);/);
});
