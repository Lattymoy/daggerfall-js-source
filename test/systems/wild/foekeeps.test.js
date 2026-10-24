// FOE-KEEPS (2026-10-24, bible/11-Multiplayer/Wild-Zone.md section 4 - the owner: "I feel like the eltheric sea can be too
// punishing. I dont want people to lose everything they have. Espcially the fact you can lose your spellbook?
// Ridiculous"; asked, "Only PvP deaths drop", "The usual tenth", "Both zones"). A death in the open zone - the Wrothgarian
// Mountains and the Eltheric Ocean alike - drops what it carries only at another player's hand. A death to a foe (a
// monster, a ship, the sea) drops nothing and pays the usual death's tenth of the purse at the rise; the account service
// refuses its fall (test/net/int9_wild_ref.test.js FOE-KEEPS THE SERVICE). A kill drops a tenth of the purse, the usual
// share, where it dropped half. And the spellbook was never the zone's to take: the law keeps it wherever it is carried.
import '../../modsOff.js';
import '../../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { takeWildDeath, takeWildGold, wildCanLose, WILD_GOLD_LOSS, WILD_GOLD_DIVISOR } from '../../../src/systems/wild/wildDropLaw.js';
import { DEATH_GOLD_FRACTION, DEATH_GOLD_DIVISOR, deathGoldLoss } from '../../../src/systems/deathPenalty.js';
import { TEMPLATES } from '../../../src/systems/item/itemKinds.js';
import { setItemFields, mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { setWildDeath, wildDeathLines, WILD_TEXT } from '../../../src/systems/wild/wildZone.js';
import { ETHER_WILD_TEXT } from '../../../src/systems/wild/etherWild.js';
import { ZONE_RULES } from '../../../src/ui/wild/wildZoneMap.js';
import * as tm from '../../../src/systems/textManager.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const mk = (o) => mintCondition(setItemFields({ material: 0, flags: 0, variant: 0, message: 0, stackCount: 1, ...o }));
const book = () => mk({ group: 'MiscItems', templateIndex: TEMPLATES.Spellbook });
const gem = () => mk({ group: 'Gems', templateIndex: 0 });
const coin = (n) => ({ group: 'Currency', templateIndex: 0, stackCount: n });
const books = (list) => list.filter((it) => it.group === 'MiscItems' && it.templateIndex === TEMPLATES.Spellbook).length;

test('FOE-KEEPS THE SHARE (wildDropLaw.js WILD_GOLD_LOSS, takeWildGold): a kill in the zone drops a tenth of the purse - the usual death\'s own share, one number at both ends - and a tenth of the cart\'s coin and of each companion\'s; nine tenths stay (mutants: the share half again; the divisor apart from the share; a share rounded up - AUDIT FOE-KEEPS P2: every coin the pins held was a multiple of ten)', () => {
  assert.equal(WILD_GOLD_LOSS, DEATH_GOLD_FRACTION, 'the usual death\'s share');
  assert.equal(WILD_GOLD_DIVISOR, DEATH_GOLD_DIVISOR);
  assert.equal(WILD_GOLD_LOSS, 1 / WILD_GOLD_DIVISOR, 'the share and its divisor one number');
  const pack = { f: 'crew:1:Hand', items: [coin(307)] };
  const e = { goldPieces: 1009, items: [], wagonItems: [coin(455)] };
  const pile = takeWildGold(e, { packs: [pack] });
  assert.equal(pile.stackCount, 100 + 45 + 30, 'one pile: the purse\'s tenth, the cart\'s and his - each floored');
  assert.equal(1009 - e.goldPieces, deathGoldLoss(1009), 'the purse pays what any death pays');
  assert.deepEqual([e.goldPieces, e.wagonItems[0].stackCount, pack.items[0].stackCount], [909, 410, 277], 'nine tenths and the odd coins stay');
  const poor = { goldPieces: 9, items: [], wagonItems: [] };
  assert.equal(takeWildGold(poor), null, 'under ten gold, nothing to drop');
  assert.equal(poor.goldPieces, 9);
});

test('FOE-KEEPS THE SPELLBOOK (wildDropLaw.js wildCanLose): no death in the zone takes a spellbook - in the bag, the cart or a companion\'s pack, even at another player\'s hand - while what may change hands drops beside it (mutants: the spellbook loseable)', () => {
  assert.equal(wildCanLose(book()), false, 'the spellbook is kept');
  assert.equal(wildCanLose(gem()), true, 'a gem is not');
  const pack = { f: 'crew:1:Hand', items: [book(), gem()] };
  const e = { goldPieces: 1000, items: [book(), gem()], wagonItems: [book(), gem()] };
  const d = takeWildDeath(e, -1, () => false, null, { cart: true, packs: [pack] });
  assert.equal(books(d.taken), 0, 'none taken');
  assert.deepEqual([books(e.items), books(e.wagonItems), books(pack.items)], [1, 1, 1], 'each where it was carried');
  assert.equal(d.taken.filter((it) => it.group === 'Gems').length, 3, 'the gems dropped - the death took what it may');
});

test('AUDIT FOE-KEEPS P4 THE WORDS READ WHEN SAID: the mountains\' entry and chip are the text core\'s at the moment they are read, so a language chosen after the module loaded speaks them (mutants: either read once, at import)', () => {
  tm.patchLocaleTable('de', 'Port_Strings', tm.loadStringTableCsv(rd('locales/de/Port_Strings.csv')));
  try {
    tm.setLocale('de');
    assert.equal(WILD_TEXT.enter, 'Du betrittst Wrothgarian Mountains, eine offene PvP-Zone. Gegner sind hier viermal so stark. Tötet dich ein anderer Spieler, lässt du fallen, was du trägst.');
    assert.match(WILD_TEXT.chipTip, /^Wrothgarian Mountains: Andere Spieler dürfen dich angreifen\..*Tötet dich ein anderer Spieler, lässt du fallen, was du trägst\.$/);
    assert.equal(WILD_TEXT.deathKept(), 'Nichts fällt zu Boden. Was du trägst, fällt nur, wenn dich ein Spieler tötet.');   // PIN MOVED (AUDIT FOE-KEEPS O1)
  } finally { tm.setLocale(tm.BASE_LOCALE); }
  assert.match(WILD_TEXT.enter, /^You enter the Wrothgarian Mountains/, 'English again');
});

test('FOE-KEEPS THE WORDS (wildZone.js WILD_TEXT, etherWild.js ETHER_WILD_TEXT, wildZoneMap.js ZONE_RULES, the tutorial): the mountains and the sea say a player\'s kill drops what you carry, never any death; a foe\'s death says you keep it, a player\'s does not (mutants: the kept line unsaid; said at a kill)', () => {
  const kill = /If another player kills you, you drop what you carry\.$/;
  for (const [name, w] of [['mountains enter', WILD_TEXT.enter], ['mountains chip', WILD_TEXT.chipTip], ['sea enter', ETHER_WILD_TEXT.enter()], ['sea chip', ETHER_WILD_TEXT.chipTip()]]) {
    assert.match(w, kill, name);
    assert.doesNotMatch(w, /can lose what you carry|If you die, you drop/, `${name}: never any death`);
  }
  assert.match(WILD_TEXT.enter, /^You enter the Wrothgarian Mountains, an open PvP zone\./);
  assert.ok(ZONE_RULES.some((l) => l.startsWith('If another player kills you, what you carry drops')), 'the zone map\'s legend');
  assert.ok(rd('src/systems/tutorialCatalogue.js').includes("t('tutorials.wildZone.body2', 'If another player kills you there, your bag drops"), 'the tutorial page');   // PIN MOVED (AUDIT FOE-KEEPS O4): both zones, the cart only while with you, the tenths
  setWildDeath({ killer: null, dropped: 0 });
  assert.deepEqual(wildDeathLines(), ['Nothing dropped. Only another player\'s kill drops what you carry.', WILD_TEXT.deathHold], 'a foe\'s death: kept');   // PIN MOVED (AUDIT FOE-KEEPS O1, H5): "You keep what you carry" stood over the tenth the death claims
  setWildDeath({ killer: 'Borin', dropped: 3 });
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathDrop(3), WILD_TEXT.deathHold], 'a kill: no kept line');
  setWildDeath(null);
});

test('FOE-KEEPS THE HOST (world.js wildDeathBegin, wildTakeDrop, the online respawn): a death to a foe asks no drop - the first dead frame shows my worn pieces to a killer and asks nothing else, and the drop is asked against a receipt alone; the rise pays the usual tenth unless a player\'s kill (mutants: the drop asked at a foe\'s death; the tenth skipped at any death in the zone; a drop asked with no receipt)', () => {
  const w = rd('src/scenes/world.js');
  const begin = /const wildDeathBegin = \(\) => \{[\s\S]*?\n {2}\};/.exec(w)?.[0] ?? '';
  assert.ok(begin.includes('if (worn.length) wildFight.offerWorn(fell.by, fell.r, worn.map(wildRecord));'), 'the fixture: the first dead frame');
  assert.ok(!begin.includes('wildTakeDrop('), 'no drop asked at the death itself - a kill\'s waits on the relay\'s receipt');
  assert.match(w, /const wildRise = !!wildDeath\(\) \|\| wildDeathKill\(\), wildKilled = wildDeathKill\(\);[^\n]*\n\s*wildGhostEnd\(\);/, 'the kill read before the ghost ends');   // PIN MOVED (AUDIT FOE-KEEPS H1): the referee's word, never the screen's name
  assert.match(w, /const goldLost = wildKilled \|\| madeRuleHere\('deathPenalty'\) === 'none' \? 0 : applyDeathPenalty\(playerEntity\);/, 'a kill\'s tenth is in the remains; any other death pays it');
  assert.ok(w.includes('    const key = readWildReceipt(rc)?.r;\n'), 'the drop asked against a receipt');
  assert.ok(w.includes('    if (!key || !realmSession || realmSession.lost || !lay || _wildTaking.has(key)) return;'), 'and none without one');
  assert.ok(!w.includes('{ n: nonce }'), 'no foe\'s nonce asked');
  assert.match(rd('server-account/src/wild.js'), /\n {2}if \(body\?\.receipt === undefined\) return \{ error: 'foe' \};\n/, 'the service refuses a foe\'s fall');
});
