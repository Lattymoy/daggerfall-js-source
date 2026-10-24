// WITCH1 (2026-10-20, the owner: "A new armor set, a new weapon, a new title and aura, a brand new item (profile icon),
// new cards"; bible/06-Systems/Witches-Festival.md): THE WYRD SISTER'S WARES - the Wyrd's Raiment and its three tiers
// driven through the real set seam, the Witchmoon Athame, the six festival cards kept out of every pack and patron, the
// Witchfire aura's look, the profile icons drawn in code, the festival's painted pictures, and the window's rows and
// presses (src/ui/wyrdWindow.js).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WYRD_SET_PIECES, wyrdPieceById, AETHERIC_RECORDS } from '../../../src/systems/aetheric.js';
import { WYRD_PIECE_IDS, FESTIVAL_CARD_IDS, FESTIVAL_WARES } from '../../../src/net/festivalLaw.js';
import { SIGIL_SETS, tierValues, SET_STAGE_MAX, _resetSigilSetsForTests } from '../../../src/systems/sigil/sigilSets.js';
import { SIGIL_SET_IDS, setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../../src/systems/sigil/sigil.js';
import { setBlow, setSetPowersVoice, setPowerStates, setRound, _setSetPowersClockForTests, _resetSetPowersForTests } from '../../../src/systems/sigil/sigilSetPowers.js';
import { reportPlayerKill } from '../../../src/systems/playerKills.js';
import { setPlayerDoor } from '../../../src/systems/playerDoor.js';
import { equipItem } from '../../../src/systems/equip.js';
import { entityStatMod } from '../../../src/systems/entityMods.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { hallowedFoe, foeFindSource } from '../../../src/systems/festival/festivalFoes.js';
import { ILIAC_CARDS, CARD_EMBLEMS, cardById } from '../../../src/net/iliac/iliacCards.js';
import { PACK_POOL } from '../../../src/systems/card/cardSources.js';
import { cardRules, cardFlavor } from '../../../src/systems/iliac/iliacCardWords.js';
import { AURA_LOOK, AURA_FS, witchfireRatesWhole } from '../../../src/render/auraRing.js';
import { profileIconNode, ICON_ART, ICON_TEXT } from '../../../src/ui/profileIcons.js';
import { ICONS } from '../../../src/net/identityToken.js';
import { FESTIVAL_PAINTERS, FESTIVAL_ART, registerFestivalArt, _resetFestivalArt } from '../../../src/world/festivalArt.js';
import { wyrdRows, wyrdPress, mountWyrdWindow, WYRD_WATCH_MS, WYRD_CSS } from '../../../src/ui/wyrdWindow.js';
import { withDom } from '../../invdrag.mjs';
import { mock } from 'node:test';
import { TITLE_TEXT, AURA_TEXT } from '../../../src/ui/playerBadge.js';
import { soulCakes, hearthOffering, SOUL_CAKE_TEXT } from '../../../src/systems/festival/soulCake.js';
import { survivalInfoTokens, itemInfoRows } from '../../../src/systems/item/itemInfo.js';
import { itemLine } from '../../../src/ui/enhanced/enhancedInventory.js';

test('WITCH1 THE WYRD\'S RAIMENT: nine Aetheric pieces of Elven make in the Wyrd\'s set - the eight of a body and its shield, the Athame its weapon - each minted by its id alone', () => {
  assert.deepEqual(WYRD_SET_PIECES.map((r) => r.id), WYRD_PIECE_IDS);
  assert.ok(WYRD_SET_PIECES.every((r) => AETHERIC_RECORDS.includes(r)), 'every reader asks them');
  assert.ok(SIGIL_SET_IDS.includes('wyrd'));
  for (const id of WYRD_PIECE_IDS) {
    const it = wyrdPieceById(id);
    assert.equal(it.aetheric, id);
    assert.equal(it.rarity, 'aetheric');
    assert.equal(it.sigil.set, 'wyrd');
    assert.ok(it.affixes.length >= 3, `${id}: its affixes`);
  }
  const athame = wyrdPieceById('wyrd-athame');
  assert.deepEqual([athame.name, athame.group, athame.templateIndex], ['The Witchmoon Athame', 'Weapons', 113]);
  assert.deepEqual([wyrdPieceById('wyrd-hearthward').templateIndex, wyrdPieceById('wyrd-robe').templateIndex], [110, 102]);
  assert.equal(wyrdPieceById('ruhn-crown'), null, 'another set\'s id mints nothing here');
  assert.equal(wyrdPieceById('nothing'), null);
});

test('WITCH1 THE SET\'S WORDS: Wyrd-Sight, Tallow-Ward, Soul Harvest - at their first stage and their last', () => {
  const set = SIGIL_SETS.wyrd;
  assert.deepEqual([set.name, set.prince, set.aetheric], ["The Wyrd's Raiment", 'The Glenmoril Wyrd', true]);
  assert.deepEqual(set.tiers.map((t) => [t.n ?? t.pieces ?? t.count, t.id ?? t.key]).map(([, id]) => id), ['wyrd-sight', 'tallow-ward', 'soul-harvest']);
  const words = (i, st) => { const t = set.tiers[i]; return t.text(tierValues(t, st)); };
  assert.equal(words(0, 0), '+2 Willpower, +5 magic resistance');
  assert.equal(words(0, SET_STAGE_MAX), '+6 Willpower, +15 magic resistance');
  assert.equal(words(1, 0), 'Your weapon deals 10% more damage to the undead, the Daedra and the atronachs');
  assert.equal(words(1, SET_STAGE_MAX), 'Your weapon deals 30% more damage to the undead, the Daedra and the atronachs');
});

test('WITCH1 THE SET\'S POWERS through the real seam: Wyrd-Sight\'s Willpower, Tallow-Ward\'s bite on the dead and the summoned alone, Soul Harvest\'s health and magicka on a kill - said, sounded, and recovered', () => {
  let T = 0;
  _setSetPowersClockForTests(() => T);
  _resetSigilForTests(); _resetSigilSetsForTests(); _resetSetPowersForTests();
  setSigilOnline(true); setSigilRenown(1);
  const v = { said: [], sounds: [] };
  setSetPowersVoice({ say: (l) => v.said.push(l), sound: (n) => v.sounds.push(n) });
  const e = { isPlayer: true, items: [], stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
    skills: new Array(35).fill(30), level: 5, career: {}, activeEffects: [], health: 50, maxHealth: 100, magicka: 0, maxMagicka: 200, armorValues: new Array(7).fill(100) };
  for (const id of WYRD_PIECE_IDS.slice(0, 6)) { const it = wyrdPieceById(id); e.items.push(it); equipItem(e, it); }
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
  assert.equal(entityStatMod(e, 'willpower') >= 2, true, 'Wyrd-Sight\'s Willpower among the pieces\' own');
  const sword = createWeapon(120, 0, () => 0.5);
  const skeleton = { mobileType: MOBILE_TYPES.SkeletalWarrior };
  const rat = { mobileType: MOBILE_TYPES.Rat };
  assert.equal(setBlow(sword, 100, e, skeleton, {}), 110, 'the dead: +10%');
  assert.equal(setBlow(sword, 100, e, { mobileType: MOBILE_TYPES.FireAtronach }, {}), 110, 'the summoned too');
  assert.equal(setBlow(sword, 100, e, rat, {}), 100, 'a rat is neither');
  T = 100;
  reportPlayerKill(rat);
  assert.deepEqual(v.said, ['Soul Harvest! +8% health and magicka.']);
  assert.deepEqual(v.sounds, ['harvest']);
  assert.deepEqual([e.health, e.magicka], [58, 16]);
  reportPlayerKill(rat);
  assert.equal(v.said.length, 1, 'recovering');
  assert.ok(setPowerStates().harvestRecoverLeft > 0);
  T = 141;
  setRound(e);
  assert.deepEqual(v.said.slice(1), ['Soul Harvest is ready again.']);
  setPlayerDoor(null);
  _resetSetPowersForTests(); _resetSigilForTests(); _resetSigilSetsForTests();
});

test('WITCH1 WHAT A FOE IS TO THE FESTIVAL: the dead and the summoned hallowed; an elite or a champion finds as an elite; a world boss\'s body not at all', () => {
  assert.equal(hallowedFoe({ mobileType: MOBILE_TYPES.Lich }), true);
  assert.equal(hallowedFoe({ mobileType: MOBILE_TYPES.DaedraLord }), true);
  assert.equal(hallowedFoe({ mobileType: MOBILE_TYPES.Rat }), false);
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.Vampire }), 'undead');
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.IceAtronach }), 'daedra');
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.Rat }), 'foe');
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.Rat, eliteFoe: true }), 'elite');
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.Zombie, champion: 'vampiric' }), 'elite');
  assert.equal(foeFindSource({ mobileType: MOBILE_TYPES.Lich, eliteFoe: true, worldBoss: true }), null, 'a world boss\'s body: its deed\'s act is its find');
  assert.equal(foeFindSource(null), 'foe');
});

test('WITCH1 THE FESTIVAL\'S CARDS: six, in the catalogue, their rules the effects\' own words, never in a pack or a patron\'s hand; the witch and the candle emblems', () => {
  assert.deepEqual(ILIAC_CARDS.slice(-6).map((c) => c.id), FESTIVAL_CARD_IDS);
  assert.deepEqual(CARD_EMBLEMS.slice(-2), ['witch', 'candle']);
  assert.deepEqual(FESTIVAL_CARD_IDS.map((id) => { const c = cardById(id); return `${c.name}|${c.kind}|${c.cost}|${c.power}|${c.tier}`; }), [
    'Warlock|unit|2|2|magic', 'Thaumaturge|unit|3|3|magic', 'Glenmoril Witch|unit|4|4|rare', 'Demonologist|unit|4|3|rare',
    'Tales and Tallows|spell|3|0|magic', "King Lysandus' Spectre|unit|6|7|legendary",
  ]);
  assert.deepEqual(FESTIVAL_CARD_IDS.map((id) => cardRules(cardById(id))), [
    'Reveal: gain +1 magicka next turn.', 'Ongoing: your mage units here have +1 power.', 'Reveal: turn the weakest enemy unit here into a Rat.',
    'Reveal: summon two Imps here.', 'Summon a Ghost here.', 'Reveal: enemy units lose 1 power.',
  ]);
  assert.ok(FESTIVAL_CARD_IDS.every((id) => cardFlavor(cardById(id)).length > 10));
  for (const pool of Object.values(PACK_POOL)) for (const id of FESTIVAL_CARD_IDS) assert.ok(!pool.includes(id), `${id} in no pack`);
  assert.deepEqual(FESTIVAL_WARES.filter((w) => w.kind === 'card').map((w) => w.key), FESTIVAL_CARD_IDS, 'sold by the Wyrd Sister alone');
});

test('WITCH1 THE WITCHFIRE AURA: its look and its own branch of the shader; its clocks whole on the aura\'s period', () => {
  assert.equal(AURA_LOOK.witchfire.kind, 13);
  assert.ok(Object.values(AURA_LOOK).filter((l) => l.kind === 13).length === 1, 'a kind of its own');
  assert.match(AURA_FS, /if \(uAura == 13\)/);
  assert.equal(witchfireRatesWhole(), true);
  assert.equal(AURA_TEXT.witchfire, 'Witchfire');
  assert.deepEqual([TITLE_TEXT.witchwarden, TITLE_TEXT.hearthkeeper], ['Witchwarden', 'Hearthkeeper']);
});

test('WITCH1 THE PROFILE ICONS: each drawn in code - a round field, its rim and its shapes - and nothing for a word no icon has or a page with no SVG', () => {
  assert.deepEqual(Object.keys(ICON_ART), ICONS);
  assert.deepEqual(Object.keys(ICON_TEXT), ICONS);
  const made = [];
  const node = (tag) => { const n = { tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, append(...k) { this.kids.push(...k); } }; made.push(n); return n; };
  const doc = { createElementNS: (ns, tag) => { assert.equal(ns, 'http://www.w3.org/2000/svg'); return node(tag); } };
  const svg = profileIconNode(doc, 'tallowskull', 'px-icon', 48);
  assert.deepEqual([svg.tag, svg.attrs.width, svg.attrs.class, svg.attrs['aria-label']], ['svg', '48', 'px-icon', 'Tallow Skull']);
  assert.equal(svg.kids.length, 2 + ICON_ART.tallowskull.shapes.length, 'its defs, its field and its shapes');
  assert.match(svg.kids[1].attrs.fill, /^url\(#pxicon-tallowskull-\d+\)$/);
  assert.equal(profileIconNode(doc, 'pumpkin'), null);
  assert.equal(profileIconNode(doc, 'toString'), null);
  assert.equal(profileIconNode({}, 'twinmoons'), null);
});

test('WITCH1 THE FESTIVAL\'S PICTURES: six painted, each its own size, every texel of its own colours or clear; registered once on the texture door', async () => {
  const sizes = Object.fromEntries(Object.entries(FESTIVAL_PAINTERS).map(([r, paint]) => { const img = paint(); return [r, `${img.width}x${img.height}`]; }));
  assert.deepEqual(sizes, {
    [FESTIVAL_ART.cake]: '24x18', [FESTIVAL_ART.offeringIcon]: '28x24', [FESTIVAL_ART.offering]: '40x56',
    [FESTIVAL_ART.turnip]: '24x26', [FESTIVAL_ART.effigy]: '32x64', [FESTIVAL_ART.wardStaff]: '24x56',
  });
  for (const paint of Object.values(FESTIVAL_PAINTERS)) {
    const img = paint();
    let solid = 0;
    for (let i = 0; i < img.width * img.height; i++) if (img.colors[i * 4 + 3] === 255) solid++; else assert.equal(img.colors[i * 4 + 3], 0, 'clear or solid');
    assert.ok(solid > img.width * img.height * 0.2, 'a picture, not a speck');
  }
  _resetFestivalArt();
  const asked = [];
  const n = registerFestivalArt((entries) => { asked.push(...entries); return entries.length; });
  assert.equal(n, 6);
  assert.equal(registerFestivalArt(() => 99), 0, 'once');
  const pic = await asked.find((e) => e.record === FESTIVAL_ART.offering).build();
  assert.deepEqual([pic.width, pic.height], [40, 56]);
  assert.ok(asked.every((e) => e.standIn === true && e.archive === 38291));
});

test('WITCH1 THE WINDOW\'S ROWS AND PRESSES: the wares in their parts, the two the festival gives with their progress; Buy, Wear, Take off, and why not', () => {
  const rows = wyrdRows({ wares: ['title:witchwarden', 'icon:twinmoons'], given: 30, taken: 3 }, { title: 'witchwarden', aura: null, icon: null },
    (w) => ({ name: `piece ${w.key}` }), (it) => it.name);
  assert.deepEqual(rows.filter((r) => r.part === 'insignia').map((r) => r.id), [
    'title:witchwarden', 'aura:witchfire', 'icon:tallowskull', 'icon:twinmoons', 'icon:wyrdcauldron', 'earned:hearthkeeper', 'earned:starwarden', 'earned:soulcake',
  ]);   // PIN MOVED (AUDIT STAR8 T3): the Starwarden beside Hearthkeeper
  assert.deepEqual([...new Set(rows.map((r) => r.part))], ['insignia', 'offering', 'raiment', 'cards']);
  const by = (id) => rows.find((r) => r.id === id);
  assert.deepEqual([by('title:witchwarden').owned, by('title:witchwarden').worn], [true, true]);
  assert.deepEqual([by('icon:twinmoons').owned, by('icon:twinmoons').worn], [true, false]);
  assert.deepEqual([by('earned:hearthkeeper').owned, by('earned:hearthkeeper').progress], [true, '25/25']);
  assert.deepEqual([by('earned:soulcake').owned, by('earned:soulcake').progress], [false, '3/10']);
  assert.equal(by('piece:wyrd-athame').name, 'piece wyrd-athame');
  assert.equal(by('aura:witchfire').name, 'Witchfire');
  const live = { cakes: 50, shut: null, busy: false };
  assert.deepEqual(wyrdPress(by('title:witchwarden'), live), { label: 'Take off', why: null });
  assert.deepEqual(wyrdPress(by('icon:twinmoons'), live), { label: 'Wear', why: null });
  assert.deepEqual(wyrdPress(by('earned:hearthkeeper'), live), { label: 'Wear', why: null });
  assert.equal(wyrdPress(by('earned:soulcake'), live).label, '3/10');
  assert.equal(wyrdPress(by('earned:soulcake'), live).why, "Earned by taking Soul Cakes from others' offerings.");
  assert.deepEqual(wyrdPress(by('aura:witchfire'), live), { label: '100 more', why: 'You need more Soul Cakes.' });
  assert.deepEqual(wyrdPress(by('card:warlock'), live), { label: 'Buy', why: null });
  assert.deepEqual(wyrdPress(by('card:warlock'), { ...live, shut: 'offline' }), { label: 'Buy', why: 'The Wyrd cannot hear you right now.' });
  assert.deepEqual(wyrdPress(by('card:warlock'), { ...live, shut: 'guest' }), { label: 'Buy', why: 'Link an account to keep Soul Cakes.' }, 'a guest is told why (AUDIT WITCH1 F-M1)');
  // the account unheard: its progress unknown, never a known nought (AUDIT WITCH1 G2)
  const unheard = wyrdRows({ wares: [], given: null, taken: null }, null, () => null, (it) => it?.name ?? '?');
  const of = (id) => unheard.find((r) => r.id === id);
  assert.deepEqual([of('earned:hearthkeeper').owned, of('earned:hearthkeeper').progress, of('earned:soulcake').progress], [false, '?/25', '?/10']);
});

test('AUDIT STAR8 T3 THE WYRD KNOW THE STARWARDEN: The Thirteenth of Frostfall\'s title stands beside Hearthkeeper among the insignia - held as the account\'s wardrobe says it is, worn and taken off there, never sold and no count to show; unheld, it says where it is earned (mutants: the row left out; held read off the wrong title; its count shown)', () => {
  const rowOf = (worn) => wyrdRows({ wares: [], given: 0, taken: 0 }, worn, () => null, (it) => it?.name).find((r) => r.id === 'earned:starwarden');
  const none = rowOf({ title: null, aura: null, icon: null, titles: ['hearthkeeper'] });
  assert.deepEqual([none.name, none.kind, none.price, none.owned, none.progress], ['Starwarden', 'title', null, false, null]);
  assert.deepEqual(wyrdPress(none, { cakes: 500, shut: null, busy: false }), { label: 'Not yet', why: 'Earned on The Thirteenth of Frostfall.' }, 'never sold');
  const held = rowOf({ title: null, aura: null, icon: null, titles: ['starwarden'] });
  assert.deepEqual([held.owned, wyrdPress(held, { cakes: 0, shut: null, busy: false }).label], [true, 'Wear']);
  const worn = rowOf({ title: 'starwarden', aura: null, icon: null, titles: ['starwarden'] });
  assert.deepEqual([worn.worn, wyrdPress(worn, { cakes: 0, shut: null, busy: false }).label], [true, 'Take off']);
  assert.equal(rowOf(null).owned, false, 'no wardrobe read yet: not held');
});

test('WITCH1 THE RAIMENT IS LEATHER, A CASTER\'S - the Athame Elven; and the Witchfire\'s candles wrap, one candle at the seam (AUDIT WITCH1 B4, E5)', () => {
  for (const r of WYRD_SET_PIECES) assert.equal(r.make, r.group === 'Weapons' ? 'Elven' : 'Leather', r.id);
  assert.ok(AURA_FS.includes('float k = mod(floor(fract(a / TAU) * 7.0 + 0.5), 7.0);'), 'the first candle one candle');
});

const kidsOf = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kidsOf(c, cls)]);
test('WITCH1 THE WINDOW MOUNTED: the reason a press cannot be said (a guest\'s, offline\'s), an earned row\'s progress said once, the bowl\'s row never its name twice, the card sticky and brought into view on a phone; it looks again at what no answer says, and leaves nothing behind (AUDIT WITCH1 E3/E8/E10)', () => {
  withDom(() => {
    mock.timers.enable({ apis: ['setInterval'] });
    let shut = 'guest', renders = 0;
    const host = document.createElement('div');
    const view = mountWyrdWindow(host, {
      state: () => { renders++; return { cakes: 10, wares: [], given: 3, taken: 0 }; }, worn: () => null, shut: () => shut,
      lastDay: () => '7 November', night: () => false, itemOf: () => null, nameOf: (it) => it?.name ?? '?',
      buy: async () => ({ ok: true, text: '' }), wear: async () => ({ ok: true, text: '' }),
    });
    try {
      const rows = kidsOf(host, 'broker-offer');
      const row = (id) => rows.find((r) => r.dataset.ware === id);
      const btn = (id) => kidsOf(row(id), 'broker-buy')[0];
      const price = (id) => kidsOf(row(id), 'broker-price')[0];
      assert.equal(btn('earned:hearthkeeper').textContent, '3/25');
      // why nothing can be bought, said before a press asks it (AUDIT WITCH1 G2)
      const noteOf = () => kidsOf(host, 'broker-note')[0];
      assert.equal(noteOf().textContent, 'Link an account to keep Soul Cakes.');
      assert.equal(noteOf().getAttribute('hidden'), null);
      const liveHost = document.createElement('div');
      const liveView = mountWyrdWindow(liveHost, {
        state: () => ({ cakes: 10, wares: [], given: 3, taken: 0 }), worn: () => null, shut: () => null,
        lastDay: () => '7 November', night: () => false, itemOf: () => null, nameOf: (it) => it?.name ?? '?',
        buy: async () => ({ ok: true, text: '' }), wear: async () => ({ ok: true, text: '' }),
      });
      assert.notEqual(kidsOf(liveHost, 'broker-note')[0].getAttribute('hidden'), null, 'live, nothing said until a press says it');
      liveView.unmount();
      assert.equal(price('earned:hearthkeeper').textContent, '', 'its progress the press\'s word alone');
      assert.notEqual(kidsOf(row('item:offering'), 'broker-set')[0].textContent, kidsOf(row('item:offering'), 'broker-name')[0].textContent, 'the bowl\'s kind line is its own');
      btn('card:warlock').onclick?.({ stopPropagation() {} });
      assert.ok(WYRD_CSS.includes('.wyrd-shell .broker-card { position: sticky; top: 0; }'));
      assert.ok(WYRD_CSS.includes('text-overflow: ellipsis'));
      // the relay comes back, no answer says so: the window looks again
      const before = renders;
      shut = null;
      mock.timers.tick(WYRD_WATCH_MS);
      assert.ok(renders > before, 'repainted as the festival came live');
      const after = renders;
      mock.timers.tick(WYRD_WATCH_MS * 3);
      assert.equal(renders, after, 'nothing changed, nothing repainted');
    } finally {
      view.unmount();
      const left = renders;
      shut = 'offline';
      mock.timers.tick(WYRD_WATCH_MS * 2);
      assert.equal(renders, left, 'unmounted: its watch went with it');
      mock.timers.reset();
    }
  });
});

test('WITCH1 THE TWO ITEMS\' CARDS: a Soul Cake and a Hearth Offering say what each is and what it is for - in the classic info box and on the enhanced card alike (AUDIT STAR: the enhanced card said nothing of either) (mutants: WITCH1-AUDIT-the-enhanced-card-silent)', () => {
  assert.deepEqual(SOUL_CAKE_TEXT.cake(), ['A spiced cake set out for the restless dead.', 'The Wyrd Sisters trade for them.']);
  assert.deepEqual(SOUL_CAKE_TEXT.offering(), ['A bowl for Soul Cakes, under a tallow lantern.', 'Use it at your own door to set it out.']);
  for (const [item, lines] of [[soulCakes(3), SOUL_CAKE_TEXT.cake()], [hearthOffering(), SOUL_CAKE_TEXT.offering()]]) {
    assert.deepEqual(survivalInfoTokens(item).map((r) => r.text).slice(2), lines);
    assert.deepEqual(itemInfoRows(item, () => null).map((r) => r.text).slice(2), lines, 'the classic info box');
    assert.deepEqual(itemLine(item).survival, lines, 'the enhanced card');
  }
});
