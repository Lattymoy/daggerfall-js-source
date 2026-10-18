// CAPT-CREW (2026-10-11, the owner: "make the decisions and completely make this as detailed as possible, providing depth
// without overcomplicating systems") - A HAND'S SERVICE, AND WHAT HIS POST IS WORTH (bible/03-World/Captains-Sea.md). The
// fights and boardings every hand counted now rank him - Green, Seasoned, Veteran, Old Salt - and a post is worth
// something, more in a seasoned hand: her Gunner the reload, her Carpenter the mending, her Lookout the hail's reach, her
// Cook the sea's wear on spirits, her Bosun her way under sail, a boarding-hardened First Mate more hands over the rail.
// Only a post's best holder aboard counts. tools/mutants/captcrew.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  serviceOf, veteranOf, VETERANCY, POST_WORTH, postWorth, postsOf, crewWorth, NO_WORTH, postWords, createShipCrew, crewCard,
  SEA_DECAY_S, MORALE_START, SEASONED_HIRE,
} from '../../../src/systems/naval/shipCrew.js';
import { handService } from '../../../src/ui/fleetPage.js';
import { sea } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const hand = (name, role, fights = 0, boardings = 0) => ({ name, role, mobile: 144, gender: 'male', fights, boardings });

test('CAPT-CREW the ranks: a hand\'s service is his fights and twice his boardings, and it ranks him Green, Seasoned at 4, Veteran at 12, an Old Salt at 30 (mutants: the boardings\' weight, each threshold, the ladder\'s order)', () => {
  assert.equal(serviceOf({ fights: 3, boardings: 2 }), 7);
  assert.equal(serviceOf({}), 0);
  assert.equal(serviceOf({ fights: -4, boardings: -1 }), 0, 'a record\'s nonsense is no service');
  assert.deepEqual(VETERANCY.map((v) => [v.tier, v.at, v.key, v.label]), [[0, 0, 'green', 'Green'], [1, 4, 'seasoned', 'Seasoned'], [2, 12, 'veteran', 'Veteran'], [3, 30, 'oldsalt', 'Old Salt']]);
  const at = (fights, boardings = 0) => veteranOf({ fights, boardings }).label;
  assert.deepEqual([at(0), at(3), at(4), at(11), at(12), at(29), at(30), at(99)], ['Green', 'Green', 'Seasoned', 'Seasoned', 'Veteran', 'Veteran', 'Old Salt', 'Old Salt']);
  assert.equal(at(0, 2), 'Seasoned', 'two boardings are four service');
  assert.equal(at(2, 5), 'Veteran', '2 + 10');
  assert.equal(SEASONED_HIRE, 4, 'a seasoned hire comes with a Seasoned hand\'s service');
});

test('CAPT-CREW what a post is worth: the table, a Green hand\'s base and each rank more - a Gunner 4% to 13% off the reload, a Carpenter 15% to 45% on the mending, a Lookout 10% to 40% on his reach, a Cook 25% to 100% on the spirits, a Bosun 1% to 4% on her way, a First Mate one hand a Veteran and two an Old Salt (mutants: each base, each step, the mate\'s ranks)', () => {
  const table = Object.fromEntries(Object.keys(POST_WORTH).map((role) => [role, [0, 1, 2, 3].map((t) => postWorth(role, t))]));
  assert.deepEqual(table, {
    Gunner: [0.04, 0.07, 0.1, 0.13],
    Carpenter: [0.15, 0.25, 0.35, 0.45],
    Lookout: [0.1, 0.2, 0.3, 0.4],
    Cook: [0.25, 0.5, 0.75, 1],
    Bosun: [0.01, 0.02, 0.03, 0.04],
    'First Mate': [0, 0, 1, 2],
  });
  assert.equal(postWorth('Deckhand', 3), 0, 'a deckhand is worth his hands, not a post');
  assert.equal(postWorth('Bard', 3), 0);
  assert.equal(postWorth('Gunner', 9), 0.13, 'past the last rank, the last');
});

test('CAPT-CREW her posts aboard: each post\'s BEST holder counts (the roster\'s first where two stand level), a hand ashore works none, a crew with no posts reads every worth 1 and no hands (mutants: the best holder, the ashore, the no-post answer)', () => {
  const hands = [
    hand('Aldric', 'First Mate', 20, 6),   // 32: an Old Salt
    hand('Brand', 'Gunner', 2),            // Green
    hand('Cora', 'Gunner', 12),            // Veteran - the best Gunner
    hand('Dain', 'Carpenter', 4),          // Seasoned
    hand('Elsa', 'Lookout', 30),           // Old Salt - ashore below
    hand('Finn', 'Cook', 0),
    hand('Gil', 'Bosun', 6, 3),            // 12: Veteran
    hand('Hal', 'Deckhand', 40),
  ];
  const posts = postsOf(hands);
  assert.deepEqual(Object.fromEntries(Object.entries(posts).map(([k, v]) => [k, [v.name, v.label]])), {
    'First Mate': ['Aldric', 'Old Salt'], Gunner: ['Cora', 'Veteran'], Carpenter: ['Dain', 'Seasoned'], Lookout: ['Elsa', 'Old Salt'], Cook: ['Finn', 'Green'], Bosun: ['Gil', 'Veteran'],
  });
  const w = crewWorth(hands);
  assert.deepEqual([w.reload, w.mend, w.sight, w.wear, w.way, w.hands], [0.9, 1.25, 1.4, 1.25, 1.03, 2]);
  const away = crewWorth(hands, new Set(['Elsa', 'Cora']));
  assert.equal(away.sight, 1, 'her Lookout ashore: no lookout\'s worth');
  assert.equal(away.reload, 0.96, 'her best Gunner ashore: the Green one\'s');
  const level = postsOf([hand('Ann', 'Gunner', 4), hand('Bea', 'Gunner', 5)]);
  assert.equal(level.Gunner.name, 'Ann', 'two Seasoned gunners: the first stands');
  const none = crewWorth([hand('Hal', 'Deckhand', 40)]);
  assert.deepEqual([none.reload, none.mend, none.sight, none.wear, none.way, none.hands], [1, 1, 1, 1, 1, 0]);
  assert.deepEqual([NO_WORTH.reload, NO_WORTH.mend, NO_WORTH.sight, NO_WORTH.wear, NO_WORTH.way, NO_WORTH.hands], [1, 1, 1, 1, 1, 0]);
});

test('CAPT-CREW the Cook\'s worth on the sea\'s clock: spirits wear a point every SEA_DECAY_S times her Cook\'s wear (twice as long under an Old Salt) - a port\'s rise untouched (mutants: the wear unread)', () => {
  const plain = createShipCrew({ seed: 4 });
  const cooked = createShipCrew({ seed: 4 });
  plain.tick(SEA_DECAY_S * 4 + 1, { atSea: true });
  cooked.tick(SEA_DECAY_S * 4 + 1, { atSea: true, wear: 2 });
  assert.equal(plain.morale, MORALE_START - 4);
  assert.equal(cooked.morale, MORALE_START - 2, 'half the wear');
  const below = createShipCrew({ seed: 4 });
  below.tick(SEA_DECAY_S + 1, { atSea: true, wear: 0.2 });
  assert.equal(below.morale, MORALE_START - 1, 'a wear under one is no faster clock');
});

test('CAPT-CREW a seasoned hire: hands joining with `service` bring that much service aboard (`prior`, never past an Old Salt\'s) - his rank Seasoned, his deeds with her none, the card and the Fleet page telling no fights he never won (AUDIT CAPTAIN\'S SEA C8); the rest of her roster untouched; the save keeps it (mutants: the service unread, the cap, prior told as fights, prior unsaved)', () => {
  const crew = createShipCrew({ seed: 11 });
  const roster = (n) => Array.from({ length: n }, () => ({ mobile: 144, gender: 'male' }));
  crew.sync(roster(3));
  assert.ok(crew.hands.every((h) => h.fights === 0 && h.prior === 0));
  const { joined } = crew.sync(roster(5), { service: SEASONED_HIRE });
  assert.equal(joined.length, 2);
  assert.ok(joined.every((h) => h.prior === SEASONED_HIRE && h.fights === 0 && veteranOf(h).label === 'Seasoned'));
  assert.ok(crew.hands.slice(0, 3).every((h) => h.prior === 0), 'the old hands as they were');
  const card = crewCard({ morale: 60, hands: joined });
  assert.ok(card.slice(1).every((l) => / - Seasoned$/.test(l) && !/fight/.test(l)), `no fights told: ${card.join(' | ')}`);
  assert.equal(handService({ ...joined[0], role: 'Gunner' }, true), 'Seasoned - the guns reload 7% quicker', 'the Fleet page the same');
  const kept = createShipCrew({ seed: 11, record: JSON.parse(JSON.stringify(crew.snapshot())) });
  assert.deepEqual(kept.hands.map((h) => h.prior), [0, 0, 0, SEASONED_HIRE, SEASONED_HIRE], 'the save keeps it');
  assert.deepEqual(createShipCrew({ seed: 1, record: { hands: [{ name: 'X', prior: 9999 }, { name: 'Y', prior: -3 }, { name: 'Z', prior: 'a' }] } }).hands.map((h) => h.prior), [VETERANCY[VETERANCY.length - 1].at, 0, 0], 'a junk one clamped');
  const capped = createShipCrew({ seed: 12 });
  capped.sync(roster(1), { service: 999 });
  assert.equal(capped.hands[0].prior, VETERANCY[VETERANCY.length - 1].at);
});

test('CAPT-CREW in a captain\'s words: the crew card ends a hand\'s line with his rank from Seasoned up, and the Fleet page says his rank, his deeds and his post\'s worth while he holds it (mutants: the rank on the card, the worth\'s words)', () => {
  const card = crewCard({ morale: 60, hands: [hand('Cora', 'Gunner', 12), hand('Finn', 'Cook', 1)] });
  assert.ok(card.includes('Cora, Gunner - 12 fights - Veteran'));
  assert.ok(card.includes('Finn, Cook - 1 fight'), 'a Green hand says no rank');
  assert.equal(handService(hand('Cora', 'Gunner', 12), true), 'Veteran - 12 fights won - the guns reload 10% quicker');
  assert.equal(handService(hand('Cora', 'Gunner', 12), false), 'Veteran - 12 fights won', 'a second gunner\'s worth is not hers');
  assert.equal(handService(hand('Ann', 'First Mate', 1, 1), true), 'Green - 1 fight won, 1 boarding', 'a Green mate is worth no hand yet');
  assert.deepEqual(['Gunner', 'Carpenter', 'Lookout', 'Cook', 'Bosun', 'First Mate'].map((r) => postWords(r, 3)),
    ['the guns reload 13% quicker', 'the crew repairs 45% faster', 'the lookout sees 40% further', 'spirits last 100% longer at sea', '4% more way under sail', '2 more hands over the rail']);
  assert.equal(postWords('Deckhand', 3), '');
});

test('CAPT-CREW at sea: the host reads her posts aboard each frame - her Bosun\'s way handed to Come Sail Away\'s Rigging read (postsWay), never on a boat with no crew - and the seams take the worth: the guns\' reload, the mending, the repairs, the hands over the rail, the Cook\'s wear, the lookout\'s hail (mutants: the worth unread, the posts\' way, each seam)', async () => {
  const save = { v: 1, boats: { 42: { hull: 1, sail: 1, crew: 1, mates: { morale: 60, hires: 2, hands: [hand('Gil', 'Bosun', 30), hand('Hal', 'Deckhand')] } } }, notoriety: {}, day: null, raids: [] };
  const s = await sea({ hull: 2, save });
  s.boat.crewed = true;
  s.run(0.5);
  assert.equal(s.host.postsWay(s.boat), 1.04, 'an Old Salt Bosun: 4% more way under sail');
  s.boat.crewed = false;
  assert.equal(s.host.postsWay(s.boat), 1, 'a boat with no crew has no Bosun');
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /reloadScale: \(\) => \(boat\.crewed && st\.crew \? reloadScaleOf\(st\.crew\.morale, st\.crew\.order\) \* st\.worth\.reload : 1\)/, 'the Gunner on the reload');
  assert.match(host, /s\.worth = captainWorth\(b\.crewed \? crewWorth\(c\.hands, ashoreNames\(b\)\) : NO_WORTH, deps\.captain\?\.stats\?\.\(\)\);/, 'her posts aboard, a hand ashore working none (AUDIT CAPTAIN\'S SEA C1: none ashore while I sail)');
  assert.match(host, /c\.tick\(d, \{ inPort: [^\n]*wear: s\.worth\.wear \}\);/, 'the Cook on the sea\'s clock');
  assert.match(host, /const scale = \(b\.crewed \? mendScaleOf\(s\.crew\.morale\) \* \(s\.worth\?\.mend \?\? 1\) : 1\) \* \(underFire/, 'the Carpenter on the repairs');
  assert.match(host, /scale: b\.crewed \? mendScaleOf\(s\.crew\.morale\) \* \(s\.worth\?\.mend \?\? 1\) : 1 \}\);/, 'and on the free mending');
  assert.match(host, /return Math\.max\(1, Math\.min\(base \+ 1 \+ mate, base \+ handsBonusOf\(st\.crew\.morale, st\.crew\.order\) \+ mate, Math\.max\(base \+ 1, men\)\)\);/, 'the First Mate\'s hands - as many as her crew has men for (AUDIT CAPTAIN\'S SEA C5)');
  assert.match(host, /nightSight\(SAIL_HO_RANGE \* sight, \{ night, lit: showsLight\(e\) \}\)/, 'the Lookout on the hail');
  assert.match(rd('src/scenes/world.js'), /refit: \(boat\) => \{ const r = fleetHost\?\.refit\(boat\) \?\? null, k = naval\?\.postsWay\?\.\(boat\) \?\? 1; return k === 1 \? r : \{ \.\.\.\(r \?\? \{\}\), speed: \(Number\(r\?\.speed\) \|\| 1\) \* k \}; \},/, 'the Bosun beside the Rigging, where the runtime reads its rates');
  assert.match(rd('src/scenes/fleetHost.js'), /fights: h\.fights \| 0, boardings: h\.boardings \| 0, prior: h\.prior \| 0, ashore: !!away\?\.has\(i\) \}\)\);/, 'the Fleet page is handed his boardings, his prior service and whether he is ashore');
});
