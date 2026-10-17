// SHIP-NAMES (2026-10-02, Mac: "Enemy and Friendly vessels need a large assortment of generated names") - a ship's
// name was a line of her trade's list: sixteen merchantmen's, eighteen pirates', six a crown's - two hundred ships of a
// trade met the same sixteen names over and over, and a possessive took an article ("The Dagon's Tooth"). Now each is
// drawn off her seed from her trade's FORMS over word banks of the Iliac Bay (systems/naval/navalShips.js shipNameOf,
// NAME_WORDS, CROWN_LORE): a crown's ship by her crown's royals, places and martial words, a merchantman by her port,
// her cargo and her fortune, a pirate by her dark beasts, her Daedric patron and her deeds; the old lists among the
// forms. On its own stream (SHIP_NAME_SALT): her captain is the captain she always had. Every pin runs the real module; each
// is red on the record's code (168bf2587). `03-World/Naval-Combat.md` (NAV-C).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROWNS, CROWN_LORE, NAME_WORDS, SHIP_NAME_SALT, PIRATE_NAMES, MERCHANT_NAMES, classById, shipNames, shipNameOf,
} from '../../../src/systems/naval/navalShips.js';
import { mulberry32 } from '../../../src/combat/blood/bloodArt.js';
import { srand, getSeed } from '../../../src/formats/dfRandom.js';

const W = NAME_WORDS;
const crown = (name) => CROWNS.find((c) => c.name === name);
const CLASS = { merchant: classById('merchantCoaster'), pirate: classById('pirateSloop'), navy: classById('navyCutter') };
/** A scripted stream: the draws in order (the form's first, then her words'), nought after. */
const seq = (...draws) => { let i = 0; return () => (i < draws.length ? draws[i++] : 0); };
/** The form's draw that lands `cum` of `total` into the forms' weights (a hair over it: clear of the float's edge). */
const share = (cum, total) => (cum + 1e-9) / total;
/** The draw that picks `list[i]` (pick: floor(r * length)). */
const at = (list, i) => (i + 0.5) / list.length;
const last = (list) => list[list.length - 1];
const N = 3000;
const namesOf = (faction, c = null) => Array.from({ length: N }, (_, i) => shipNames(CLASS[faction], i * 7919 + 1, { regionIndex: 17, crown: c }).name);

test('SHIP-NAMES A LARGE ASSORTMENT: three thousand ships of a trade bear well over a thousand names a trade - over 1,800 merchantmen\'s and 1,500 pirates\', over 550 each crown\'s (a list of sixteen, eighteen and six, each name met again and again) - every one of a form of her trade, the same off the same seed', () => {
  const merchant = new Set(namesOf('merchant')), pirate = new Set(namesOf('pirate'));
  assert.ok(merchant.size > 1800, `merchantmen: ${merchant.size} names`);
  assert.ok(pirate.size > 1500, `pirates: ${pirate.size} names`);
  for (const c of CROWNS) {
    const navy = new Set(namesOf('navy', c));
    assert.ok(navy.size > 550, `${c.name}: ${navy.size} names`);
  }
  // the old lists are among the forms still - a share of each trade's names
  assert.ok([...merchant].filter((n) => MERCHANT_NAMES.includes(n.replace(/^The /, ''))).length >= 12, 'the merchantmen\'s list');
  assert.ok([...pirate].filter((n) => PIRATE_NAMES.some((p) => n === `The ${p}` || n === p)).length >= 12, 'the pirates\'');
  // deterministic: a peer's copy, named off the same seed and waters, is the same ship
  for (let i = 0; i < 50; i++) {
    const seed = (i * 0x9e3779b1) >>> 0;
    assert.deepEqual(shipNames(CLASS.navy, seed, { regionIndex: 23 }), shipNames(CLASS.navy, seed, { regionIndex: 23 }));
    assert.equal(shipNames(CLASS.pirate, seed).name, shipNameOf('pirate', mulberry32(((seed >>> 0) ^ SHIP_NAME_SALT) >>> 0)), 'her name\'s own stream');
  }
});

test('SHIP-NAMES THE FORMS OF A TRADE: a merchantman of her port and calling, her fortune and wares, her port\'s goods, a lady of her port, or the old list (2 : 5 : 5 : 4 : 4); a pirate of the old list, a dark beast, a Daedric prince\'s boon, a deed of heads or a scourge of a port (2 : 6 : 4 : 3 : 3) - each form at its own share of the draw, its words off their own banks', () => {
  const form = (faction, total, cum, ...draws) => shipNameOf(faction, seq(share(cum, total), ...draws));
  // the merchantmen: the form's draw at each form's first share, then the words, first and last of their banks
  assert.equal(form('merchant', 20, 0, at(MERCHANT_NAMES, 3)), `The ${MERCHANT_NAMES[3]}`);
  assert.equal(form('merchant', 20, 1.999, at(MERCHANT_NAMES, 0)), `The ${MERCHANT_NAMES[0]}`, 'the list\'s share to 2 of 20');
  assert.equal(form('merchant', 20, 2, 0, 0.9999), `The ${W.ports[0]} ${last(W.callings)}`);
  assert.equal(form('merchant', 20, 6.999, 0.9999, 0), `The ${last(W.ports)} ${W.callings[0]}`, 'port and calling to 7');
  assert.equal(form('merchant', 20, 7, at(W.fair, 4), at(W.wares, 9)), `The ${W.fair[4]} ${W.wares[9]}`);
  assert.equal(form('merchant', 20, 11.999, 0, 0), `The ${W.fair[0]} ${W.wares[0]}`, 'fortune and wares to 12');
  assert.equal(form('merchant', 20, 12, at(W.ports, 7), at(W.goods, 2)), `The ${W.ports[7]} ${W.goods[2]}`);
  assert.equal(form('merchant', 20, 15.999, 0, 0), `The ${W.ports[0]} ${W.goods[0]}`, 'the port\'s goods to 16');
  assert.equal(form('merchant', 20, 16, at(W.titles, 5), at(W.ports, 11)), `The ${W.titles[5]} of ${W.ports[11]}`);
  assert.equal(form('merchant', 20, 19.999, 0.9999, 0.9999), `The ${last(W.titles)} of ${last(W.ports)}`, 'a lady of her port to the end');
  // the pirates
  assert.equal(form('pirate', 18, 0, at(PIRATE_NAMES, 2)), `The ${PIRATE_NAMES[2]}`.replace(/^The (\S+'s )/, '$1'));
  assert.equal(form('pirate', 18, 1.999, at(PIRATE_NAMES, 0)), `The ${PIRATE_NAMES[0]}`.replace(/^The (\S+'s )/, '$1'), 'the list\'s share to 2 of 18');
  assert.equal(form('pirate', 18, 2, at(W.dark, 1), at(W.beasts, 0)), `The ${W.dark[1]} ${W.beasts[0]}`);
  assert.equal(form('pirate', 18, 7.999, 0.9999, 0.9999), `The ${last(W.dark)} ${last(W.beasts)}`, 'a dark beast to 8');
  assert.equal(form('pirate', 18, 8, at(W.princes, 9), at(W.boons, 3)), `${W.princes[9]}'s ${W.boons[3]}`);
  assert.equal(form('pirate', 18, 11.999, 0, 0), `${W.princes[0]}'s ${W.boons[0]}`, 'a prince\'s boon to 12');
  assert.equal(form('pirate', 18, 12, at(W.heads, 2), at(W.deeds, 1)), `The ${W.heads[2]}${W.deeds[1]}`);
  assert.equal(form('pirate', 18, 14.999, 0, 0), `The ${W.heads[0]}${W.deeds[0]}`, 'a deed of heads to 15');
  assert.equal(form('pirate', 18, 15, at(W.scourges, 4), at(W.ports, 20)), `The ${W.scourges[4]} of ${W.ports[20]}`);
  assert.equal(form('pirate', 18, 17.999, 0.9999, 0.9999), `The ${last(W.scourges)} of ${last(W.ports)}`, 'a scourge of a port to the end');
});

test('SHIP-NAMES A CROWN\'S OWN: a crown\'s ship is of her crown\'s list, her royals\' virtues, her crown and a martial word, a divine\'s favour, an emblem of her places or a martial word alone (3 : 5 : 5 : 3 : 3 : 3) - Wayrest\'s royals and places for a ship of Wayrest, Sentinel\'s for Sentinel\'s, never another crown\'s; a ship whose crown is not named sails for Daggerfall', () => {
  for (const c of CROWNS) {
    const lore = CROWN_LORE[c.name];
    const form = (cum, ...draws) => shipNameOf('navy', seq(share(cum, 22), ...draws), c);
    assert.equal(form(0, at(c.ships, 1)), `The ${c.ships[1]}`.replace(/^The (\S+'s )/, '$1'), `${c.name}: her crown's list`);
    assert.equal(form(2.999, at(c.ships, 0)), `${c.ships[0]}`, `${c.name}: "${c.ships[0]}" - a possessive takes no article; the list to 3 of 22`);
    assert.equal(form(3, at(lore.royals, 2), at(W.virtues, 5)), `${lore.royals[2]}'s ${W.virtues[5]}`);
    assert.equal(form(7.999, 0.9999, 0.9999), `${last(lore.royals)}'s ${last(W.virtues)}`, 'her royals to 8');
    assert.equal(form(8, at(W.martial, 6)), `The ${c.name} ${W.martial[6]}`);
    assert.equal(form(12.999, 0), `The ${c.name} ${W.martial[0]}`, 'her crown\'s martial word to 13');
    assert.equal(form(13, at(W.divines, 3), at(W.favours, 7)), `${W.divines[3]}'s ${W.favours[7]}`);
    assert.equal(form(15.999, 0, 0), `${W.divines[0]}'s ${W.favours[0]}`, 'a divine\'s favour to 16');
    assert.equal(form(16, at(W.emblems, 4), at(lore.places, 5)), `The ${W.emblems[4]} of ${lore.places[5]}`);
    assert.equal(form(18.999, 0.9999, 0.9999), `The ${last(W.emblems)} of ${last(lore.places)}`, 'an emblem of her places to 19');
    assert.equal(form(19, at(W.martial, 11)), `The ${W.martial[11]}`);
    assert.equal(form(21.999, 0.9999), `The ${last(W.martial)}`, 'a martial word alone to the end');
    // drawn by the thousand: only her own crown's royals and places
    const own = new Set([...lore.royals, ...W.divines, ...c.ships.filter((n) => /'s /.test(n)).map((n) => n.split("'s ")[0])]);
    for (const n of namesOf('navy', c).slice(0, 600)) {
      const who = /^(.+?)'s /.exec(n)?.[1];
      if (who) assert.ok(own.has(who), `${c.name}: ${n} - ${who} is no royal of hers`);
      const of = /^The \S+ of (.+)$/.exec(n)?.[1];
      if (of) assert.ok(lore.places.includes(of), `${c.name}: ${n} - ${of} is none of her places`);
      const named = /^The (Daggerfall|Wayrest|Sentinel) /.exec(n)?.[1];
      if (named && !c.ships.map((x) => `The ${x}`).includes(n)) assert.equal(named, c.name, `${c.name}: ${n}`);
    }
  }
  const unnamed = shipNameOf('navy', seq(share(3, 22), at(CROWN_LORE.Daggerfall.royals, 1), 0));
  assert.equal(unnamed, `${CROWN_LORE.Daggerfall.royals[1]}'s ${W.virtues[0]}`, 'no crown named: Daggerfall\'s');
  assert.equal(shipNameOf('navy', seq(share(8, 22), 0)), `The ${CROWNS[0].name} ${W.martial[0]}`);
  assert.equal(shipNameOf('navy', seq(share(3, 22), 0, 0), { ...crown('Wayrest'), name: 'Nowhere' }), `${CROWN_LORE.Daggerfall.royals[0]}'s ${W.virtues[0]}`, 'a crown with no lore of its own: Daggerfall\'s words');
});

test('SHIP-NAMES THE ARTICLE: a name in the possessive takes none ("Dagon\'s Tooth" - it was "The Dagon\'s Tooth"), the rest "The"; a deed of heads joins in one word, hyphened where a letter would double ("The Bone-eater", never "The Boneeater"); no name bears an empty word or two articles', () => {
  const all = [...namesOf('merchant'), ...namesOf('pirate'), ...CROWNS.flatMap((c) => namesOf('navy', c))];
  for (const n of all) {
    assert.ok(/^The [A-Z]/.test(n) || /^[A-Z][\w-]*(?: [A-Z][\w-]*)?'s [A-Z]/.test(n), n);
    assert.ok(!/^The \S+(?: \S+)?'s /.test(n), `${n}: an article on a possessive`);
    assert.ok(!/The The|\s{2}|\s$|undefined|null/.test(n), n);
  }
  assert.ok(all.some((n) => /^\S+'s /.test(n) && !n.startsWith('The ')), 'possessives drawn');
  assert.equal(shipNameOf('pirate', seq(0, at(PIRATE_NAMES, PIRATE_NAMES.indexOf("Dagon's Tooth")))), "Dagon's Tooth");
  assert.equal(shipNameOf('navy', seq(0, at(crown('Daggerfall').ships, 0)), crown('Daggerfall')), "Gothryd's Resolve");
  const deed = (h, d) => shipNameOf('pirate', seq(share(12, 18), at(W.heads, W.heads.indexOf(h)), at(W.deeds, W.deeds.indexOf(d))));
  assert.equal(deed('Bone', 'eater'), 'The Bone-eater');
  assert.equal(deed('Gold', 'reaver'), 'The Goldreaver');
  assert.equal(deed('Widow', 'maker'), 'The Widowmaker');
  assert.equal(deed('Gut', 'taker'), 'The Gut-taker');
  for (const h of W.heads) for (const d of W.deeds) {
    const n = deed(h, d);
    assert.equal(n, h.slice(-1).toLowerCase() === d[0] ? `The ${h}-${d}` : `The ${h}${d}`);
  }
});

test('SHIP-NAMES HER CAPTAIN IS THE ONE SHE HAD: her name off its own stream, her captain is drawn as he always was - the seeds\' captains as the record named them, the global stream put back as it stood; her name as this record names it', () => {
  const CASES = [
    ['merchantCoaster', 1, null, 'The Abibon-Gora Heron', 'Ysona Wicksley'],
    ['merchantGalleon', 0xabc123, null, 'The Wayrest Trader', 'Dunyctor Gaerston'],
    ['pirateSloop', 2, null, "Azura's Grin", 'Barbayne Moorhart'],
    ['pirateBrig', 0x51f00e, null, 'The Neckseeker', 'Chrystorya Mastercroft'],
    ['navyCutter', 3, 'Wayrest', "Eadwyre's Fury", 'Bedane Kinghart'],
    ['navyCutter', 4, 'Sentinel', 'The Eagle of Cybiades', 'Carolona Hawkfield'],
    ['navyCutter', 5, 'Daggerfall', 'The Daggerfall Resolute', 'Theodyn Moorhouse'],
  ];
  srand(4242);
  const before = getSeed();
  for (const [id, seed, c, name, captain] of CASES) {
    const got = shipNames(classById(id), seed, { regionIndex: 17, crown: c ? crown(c) : null });
    assert.deepEqual(got, { name, captain, crown: c }, `${id} ${seed}`);
  }
  assert.equal(getSeed(), before, 'the global stream as it stood');
});
