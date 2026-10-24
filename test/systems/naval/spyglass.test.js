// SPYGLASS (2026-10-11, the owner: "Removing observable names from ships and instead implementing a spyglass option where
// you can aim and view to observe other ships, their allegiance, cargo, etc." - bible/03-World/Captains-Sea.md) - WHAT A
// CAPTAIN KNOWS OF A SHIP, AND THE GLASS THAT TELLS HIM. A sail is a hull and a rig till her colours are made out - by
// the naked eye close, a Lookout's call, the glass held on her, or her guns on me; her guns, hands and hold through the
// glass close, or once she strikes. An unknown hull wears no tag. A wary pirate may fly a merchantman's false colours
// till the glass sees through them or she runs up the black flag. The glass is the Spyglass action's - K beside the
// road's follow, aboard - and narrows the view to its magnification. tools/mutants/spyglass.json.
import '../../modsOff.js';
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KNOW, NAKED_EYE_M, NAKED_EYE_DARK_M, LOOKOUT_ID_M, GLASS_FAR_M, GLASS_NEAR_M, GLASS_STUDY_S, GLASS_STUDY_NEAR_S, GLASS_ZOOM, GLASS_ZOOM_MIN, GLASS_ZOOM_MAX,
  RETICLE_DEG, DECEIT_SHARE, KNOTS, hullWord, aHull, unknownName, falseFlagOf, glassReach, knowledgeOf, glassHolds, coloursWords, cargoWords,
  gunsWords, handsWords, mindWords, glassCard, merchantOfHull,
} from '../../../src/systems/naval/shipKnowledge.js';
import { classById, CROWNS, NAVAL_FACTIONS, shipNames, classLine } from '../../../src/systems/naval/navalShips.js';
import { NIGHT_LIT_SIGHT, NIGHT_DARK_SIGHT } from '../../../src/systems/naval/shipWatch.js';
import { GLASS_AIM_LIFT } from '../../../src/scenes/naval/navalHost.js';
import { easeLens, glassFov, glassLookScale, GLASS_EASE_S, glassFootWords, drawSpyglass, GLASS_TONES } from '../../../src/ui/spyglassView.js';
import { drawNavalHud, navalTouchGlass, destroyNavalHud } from '../../../src/ui/naval/navalHud.js';
import { ACTIONS, PORT_ACTIONS, DEFAULT_SHARES, DEFAULT_BINDINGS, ACTION_GROUPS, MOD_ACTIONS } from '../../../src/systems/inputActions.js';
import { TOUCH_BUTTON_ACTIONS } from '../../../src/ui/touch/touchButtons.js';
import { PLUS_BIND_ROWS } from '../../../src/ui/plus/plusPadBinds.js';
import { DPAD_CHOICES } from '../../../src/ui/plus/plusPad.js';
import { DESPAWN_BEYOND } from '../../../src/systems/naval/navalDirector.js';
import { sea, knowAll } from '../../navalSea.mjs';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const hand = (name, role, fights = 0) => ({ name, role, mobile: 144, gender: 'male', fights, boardings: 0 });
/** The first seed whose wary pirate of `cls` flies false colours (and the crown she flies). */
function deceiver(cls = 'pirateSloop') {
  for (let seed = 1; ; seed++) { const f = falseFlagOf(classById(cls), seed, 'wary'); if (f) return { seed, flag: f }; }
}
/** The glass laid on her hull's middle from the harness eye. */
const aimAt = (s, e) => { const o = s.view.look.origin; s.view.look = { origin: o, dir: [e.ship.pos[0] - o[0], e.ship.pos[1] + GLASS_AIM_LIFT - o[1], e.ship.pos[2] - o[2]] }; };
/** The glass up on her for `seconds`, the sea stepped with it (the world's order: the glass, then the frame). */
function hold(s, e, seconds, dt = 0.1) {
  let card = null;
  for (let t = 0; t < seconds - 1e-9; t += dt) { if (e) aimAt(s, e); card = s.host.glass(dt, { up: true }); s.run(dt, dt); }
  return card;
}
const spawn = (s, cls, range, bearing = Math.PI / 2, o = {}) => s.host._sea.get(s.host.spawnShip(cls, { range, bearing, ...o }));
const tagOf = (s, e) => s.host.tags().find((t) => t.id === e.id) ?? null;

test('SPYGLASS the law of knowing: her hull at any range; her colours by the eye within its reach, a Lookout within his, the glass held GLASS_STUDY_S within its far reach, or her own guns on me; the rest held GLASS_STUDY_NEAR_S within its near reach, or once she strikes - and never unlearnt (mutants: each reach, each hold, the struck, the never-lowered, the clamp)', () => {
  assert.deepEqual(KNOW, { hull: 0, colours: 1, studied: 2 });
  assert.deepEqual([NAKED_EYE_M, LOOKOUT_ID_M, GLASS_FAR_M, GLASS_NEAR_M, GLASS_STUDY_S, GLASS_STUDY_NEAR_S], [220, 320, 1800, 900, 0.6, 1.4]);
  assert.ok(GLASS_FAR_M < DESPAWN_BEYOND, 'a sail the glass can find is one the sea still holds');
  const day = glassReach();
  assert.deepEqual(day, { far: 1800, near: 900, eye: 220, lookout: 0 }, 'by day, no Lookout aboard');
  const k = (known, o) => knowledgeOf(known, { reach: day, ...o });
  assert.equal(k(0, { dist: 221 }), KNOW.hull, 'past the eye: a hull');
  assert.equal(k(0, { dist: 220 }), KNOW.colours, 'the eye reads her colours');
  assert.equal(k(0, { dist: 1000, held: 0.59 }), KNOW.hull, 'the glass not held long enough');
  assert.equal(k(0, { dist: 1000, held: 0.6 }), KNOW.colours, 'the glass held: her colours');
  assert.equal(k(0, { dist: 1801, held: 5 }), KNOW.hull, 'past the glass\'s far reach: nothing');
  assert.equal(k(0, { dist: 900, held: 1.39 }), KNOW.colours, 'her colours, not yet the rest');
  assert.equal(k(0, { dist: 900, held: 1.4 }), KNOW.studied, 'held long within the near reach: all of her');
  assert.equal(k(1, { dist: 901, held: 9 }), KNOW.colours, 'past the near reach: no more than her colours');
  assert.equal(k(0, { dist: 5000, revealed: true }), KNOW.colours, 'her guns on me tell her colours at any range');
  assert.equal(k(0, { dist: 5000, struck: true }), KNOW.studied, 'struck: everything');
  assert.equal(k(2, { dist: 5000 }), KNOW.studied, 'never unlearnt');
  assert.equal(k(1, { dist: 5000 }), KNOW.colours);
  assert.equal(k(7, { dist: 5000 }), KNOW.studied, 'clamped');
  const crewed = glassReach({ lookout: true });
  assert.equal(crewed.lookout, 320);
  assert.equal(knowledgeOf(0, { dist: 320, reach: crewed }), KNOW.colours, 'a Lookout calls her colours');
  assert.equal(knowledgeOf(0, { dist: 321, reach: crewed }), KNOW.hull);
});

test('SPYGLASS the reach: her Lookout\'s worth carries the glass and his own eye further; by night the glass sees no farther than shipWatch.js nightSight lets a lookout - a lit ship NIGHT_LIT_SIGHT, a dark one NIGHT_DARK_SIGHT - and the naked eye reads a dark ship\'s colours only within NAKED_EYE_DARK_M (mutants: the worth unread, the night unread, the eye\'s own night)', () => {
  assert.deepEqual(glassReach({ sight: 1.4, lookout: true }), { far: 1800 * 1.4, near: 900 * 1.4, eye: 220, lookout: 320 * 1.4 }, 'an Old Salt Lookout: 40% further, the naked eye its own');
  assert.deepEqual(glassReach({ sight: 0.5 }), glassReach(), 'never less than the glass\'s own');
  assert.deepEqual(glassReach({ night: true, lit: true, lookout: true }), { far: NIGHT_LIT_SIGHT, near: NIGHT_LIT_SIGHT, eye: 220, lookout: 320 });
  assert.equal(NAKED_EYE_DARK_M, 100);
  assert.deepEqual(glassReach({ night: true, lit: false, lookout: true }), { far: NIGHT_DARK_SIGHT, near: NIGHT_DARK_SIGHT, eye: NAKED_EYE_DARK_M, lookout: NIGHT_DARK_SIGHT }, 'a dark ship: the glass and the Lookout close, the naked eye closer');
});

test('SPYGLASS false colours: DECEIT_SHARE of the wary pirates fly a crown\'s merchant colors, by their seed on their own stream - never a bold pirate, a flagship, a trader, a crown\'s ship, or one the host marks plain (mutants: the share, the temper, the flagship, the plain, the crown\'s draw)', () => {
  assert.equal(DECEIT_SHARE, 0.35);
  const sloop = classById('pirateSloop');
  const N = 4000;
  let n = 0;
  const crowns = new Set();
  for (let i = 1; i <= N; i++) { const f = falseFlagOf(sloop, i * 2654435761 >>> 0, 'wary'); if (f) { n++; crowns.add(f); } }
  assert.ok(Math.abs(n / N - DECEIT_SHARE) < 0.03, `${n / N}`);
  assert.deepEqual([...crowns].sort(), CROWNS.map((c) => c.name).sort(), 'every crown\'s colours flown');
  const { seed, flag } = deceiver();
  assert.equal(falseFlagOf(sloop, seed, 'wary'), flag, 'the same on every client');
  assert.equal(falseFlagOf(sloop, seed, 'bold'), null, 'a bold pirate has no need to hide');
  assert.equal(falseFlagOf(sloop, seed, 'wary', { plain: true }), null, 'a raider, a hand-launched foe');
  assert.equal(falseFlagOf(classById('pirateFlagship'), seed, 'wary'), null);
  assert.equal(falseFlagOf(classById('merchantCoaster'), seed, 'wary'), null);
  assert.equal(falseFlagOf(classById('navyCutter'), seed, 'wary'), null);
});

test('SPYGLASS the glass holds a ship: the look within her hull\'s own half-length at her range, or within the reticle\'s RETICLE_DEG at the glass\'s magnification - whichever is wider (mutants: the reticle\'s zoom, the hull\'s width)', () => {
  assert.equal(RETICLE_DEG, 4);
  const deg = Math.PI / 180;
  assert.equal(glassHolds(0.99 * deg, 1000, 1, 4), true, 'inside a degree at x4');
  assert.equal(glassHolds(1.01 * deg, 1000, 1, 4), false);
  assert.equal(glassHolds(1.9 * deg, 1000, 1, 2), true, 'x2: two degrees');
  assert.equal(glassHolds(3 * deg, 100, 20, 8), true, 'a carrack close fills the glass');
  assert.equal(glassHolds(3 * deg, 1000, 20, 8), false);
  assert.deepEqual([GLASS_ZOOM, GLASS_ZOOM_MIN, GLASS_ZOOM_MAX], [4, 2, 8]);
});

test('SPYGLASS the card\'s words: a hull by her kind before her colours, her guns off her batteries, her hands to the nearest five, her hold by her cargo, her colours and her mind (mutants: each word)', () => {
  // PIN MOVED (AUDIT CAPTAIN'S SEA S22): the small ship's hull a two-master - a brigantine, a galleon and a cutter by her class
  assert.deepEqual([0, 1, 2, 3, 4].map(hullWord), ['rowboat', 'sloop', 'two-master', 'galley', 'carrack']);
  assert.deepEqual([aHull(1), aHull(4), unknownName(2)], ['a sloop', 'a carrack', 'Unknown two-master']);
  assert.deepEqual([0, 1, 2, 3].map(gunsWords), ['no guns', '6 swivels, a swivel gun forward', '10 long guns, 2 chain guns forward, fire barrels astern', '8 long guns, 3 great guns forward']);
  assert.deepEqual([0, 3, 12, 60].map(handsWords), ['no hands', 'about 5 hands', 'about 10 hands', 'about 60 hands']);
  assert.deepEqual([1, 2, 3, 4, 9].map(cargoWords), ['riding high, a light hold', 'riding easy - some cargo', 'riding low, a full hold', 'riding deep, a rich hold', 'riding deep, a rich hold']);
  assert.deepEqual([coloursWords('pirate', null), coloursWords('navy', 'Wayrest'), coloursWords('merchant', 'Sentinel'), coloursWords('merchant', null)],
    ['the black flag', 'Wayrest\'s royal ensign', 'Sentinel\'s merchant colors', 'a trader\'s merchant colors']);
  assert.equal(mindWords({ hostile: true, mode: 'board' }), 'Closing to board you!');
  assert.equal(mindWords({ hostile: true, mode: 'engage' }), 'Heading straight for you!');
  assert.equal(mindWords({ faction: 'pirate', temper: 'bold' }), 'Bold. Attacks any target');
  assert.equal(mindWords({ faction: 'pirate', temper: 'wary' }), 'Wary. Picks its targets carefully');
  assert.equal(mindWords({ faction: 'merchant', bound: 'bound for Wayrest' }), 'Bound for Wayrest');
  assert.equal(mindWords({ faction: 'navy' }), 'On the crown\'s business');
  assert.equal(KNOTS, 1.944);
});

test('SPYGLASS the glass\'s card: unknown - her hull and her way, nothing of her stance; her colours - her name, her colours (false ones while they hold, a merchantman\'s line and a friend\'s tone), her mind; studied - her guns, hands, hurts and hold, a bounty, false colours seen through; the study\'s share and the range the next lesson wants (mutants: each level\'s rows, the disguise, the hint)', () => {
  const f = { hull: 1, name: 'The Black Gull', classLine: 'Pirate Sloop', faction: 'pirate', flag: null, falseFlag: 'Wayrest', temper: 'wary', mode: 'cruise', hostile: false, friendly: false, bound: '',
    distance: 1234.4, speed: 5, crew: 12, hullShare: 0.5, sailShare: 0.75, fire: true, cargo: 2, bounty: '300 gold - posted at Wayrest', lore: null };
  const unknown = glassCard(f, KNOW.hull, { study: 0.3, within: 1800 });
  assert.deepEqual(unknown, { title: 'Unknown sloop', sub: 'Colors not yet identified', rows: [['Range', '1234 m'], ['Way', 'making 10 knots']], tone: 'unknown', study: 0.3, hint: 'Close within 1800 m to make out its colours' });
  const told = glassCard(f, KNOW.colours, { study: 0.5 });
  assert.deepEqual([told.title, told.sub, told.tone, told.study, told.hint], ['A merchantman of Wayrest', 'Merchantman', 'friendly', 0.5, '']);
  assert.deepEqual(told.rows, [['Colours', 'Wayrest\'s merchant colors'], ['Range', '1234 m - making 10 knots'], ['Bearing', 'Holding course']], 'a merchantman\'s colours and mind: the disguise holds');
  assert.equal(glassCard(f, KNOW.colours, { within: 900 }).hint, 'Close within 900 m to make out its guns and hold');
  const seen = glassCard(f, KNOW.studied, { study: 0.2 });
  assert.deepEqual([seen.title, seen.sub, seen.tone, seen.study], ['The Black Gull', 'Pirate Sloop', 'pirate', 1]);
  assert.deepEqual(seen.rows, [
    ['False colors', 'Too many gunports for a trader. This is a pirate'], ['Colours', 'the black flag'], ['Range', '1234 m - making 10 knots'], ['Bearing', 'Wary. Picks its targets carefully'],
    ['Guns', '6 swivels, a swivel gun forward'], ['Hands', 'about 10 hands'], ['Hurts', 'hull 50%, canvas 75% - burning'], ['Hold', 'riding easy - some cargo'], ['Wanted', '300 gold - posted at Wayrest'],
  ]);
  assert.equal(glassCard({ ...f, hostile: true, mode: 'engage' }, KNOW.colours).title, 'The Black Gull', 'her guns on me: false colours hold for nobody');
  const hot = glassCard({ ...f, falseFlag: null, hostile: true, mode: 'engage' }, KNOW.colours);
  assert.deepEqual([hot.title, hot.tone, hot.rows[0][1], hot.rows[2][1]], ['The Black Gull', 'hostile', 'the black flag', 'Heading straight for you!'], 'her guns on me: no disguise');
  const still = glassCard({ ...f, speed: 0.2, falseFlag: null, faction: 'navy', flag: 'Sentinel', friendly: true }, KNOW.colours);
  assert.deepEqual([still.tone, still.rows[0][1], still.rows[1][1]], ['friendly', 'Sentinel\'s royal ensign', '1234 m - lying still']);
});

test('SPYGLASS at sea, the eye: a hull with her colours unread wears no tag and gives no card (GLASS-SPOT, PIN MOVED: the look\'s card named her "Unknown two-master" and her range - a ship spotted at a glance); within NAKED_EYE_M the eye reads her colours, her name and her bar; her captain only once she is studied (mutants: the tag\'s gate, the card\'s gate, the captain\'s gate)', async () => {
  const s = await sea({ hull: 2 });
  const near = spawn(s, 'merchantCoaster', 200, 0);
  const far = spawn(s, 'merchantGalleon', 500);
  s.run(0.5);
  assert.deepEqual([near.known, far.known], [KNOW.colours, KNOW.hull]);
  assert.deepEqual(s.host.tags().map((t) => t.id), [near.id], 'the unknown hull wears no tag');
  assert.equal(tagOf(s, near).name, near.ship.names.name);
  assert.equal(s.host.hudModel().target, null, 'her on the look, not made out: no card');   // GLASS-SPOT (PIN MOVED: "Unknown two-master", her range, no stance - AUDIT CAPTAIN'S SEA S22/S24)
  far.known = KNOW.colours;
  const told = s.host.hudModel().target;
  assert.equal(told.id, far.id, 'her on the look');
  assert.deepEqual([told.name, told.faction, told.friendly, told.captain], [far.ship.names.name, 'merchant', true, null], 'her colours: her name and stance, not her captain');
  far.known = KNOW.studied;
  assert.equal(s.host.hudModel().target.captain, far.ship.names.captain, 'studied: her captain too');
});

test('SPYGLASS at sea, the glass: raised and held on her - her colours past GLASS_STUDY_S, the rest past GLASS_STUDY_NEAR_S within the near reach; a ship the glass leaves is begun afresh; past its reach the card says how close; down, it holds nothing (mutants: the hold\'s clock, the reset, the reach, the glass down)', async () => {
  const s = await sea({ hull: 2 });
  const a = spawn(s, 'merchantGalleon', 700);
  const b = spawn(s, 'merchantCarrack', 700, 0);
  s.run(0.2);
  let card = hold(s, a, 0.5);
  assert.equal(a.known, KNOW.hull, 'half a second: not yet');
  assert.equal(card.title, 'Unknown two-master');   // PIN MOVED (AUDIT CAPTAIN'S SEA S22)
  assert.equal(s.host._glass().on, a.id);
  hold(s, b, 0.2);
  assert.equal(s.host._glass().on, b.id, 'the glass on another');
  card = hold(s, a, 0.5);
  assert.equal(a.known, KNOW.hull, 'begun afresh: half a second again is not enough');
  card = hold(s, a, 0.2);
  assert.equal(a.known, KNOW.colours, 'her colours made out');
  assert.equal(card.title, a.ship.names.name);
  assert.ok(card.study > 0.4 && card.study < 1, `the study under way: ${card.study}`);
  card = hold(s, a, 0.8);
  assert.equal(a.known, KNOW.studied, 'and the rest');
  assert.ok(card.rows.some(([l]) => l === 'Guns') && card.rows.some(([l]) => l === 'Hold'));
  assert.equal(card.study, 1);
  assert.deepEqual(s.host.tags().map((t) => t.id), [a.id], 'her tag now');
  // down: nothing held, nothing learnt
  assert.equal(s.host.glass(0.1, { up: false }), null);
  assert.deepEqual([s.host._glass().on, s.host._glass().held], [null, 0]);
  for (let i = 0; i < 20; i++) { aimAt(s, b); s.host.glass(0.1, { up: false }); s.run(0.1); }
  assert.equal(b.known, KNOW.hull, 'a glass not raised made nothing out');
  // past the near reach: her colours, and how close for the rest
  const c = spawn(s, 'merchantCoaster', 1300, Math.PI);
  s.run(0.2);
  card = hold(s, c, 2);
  assert.equal(c.known, KNOW.colours);
  assert.equal(card.hint, `Close within ${GLASS_NEAR_M} m to make out its guns and hold`);
  assert.equal(card.study, 0, 'no study that cannot finish');
  // the magnification, as the wheel turns it - clamped
  s.host.glass(0.1, { up: true, zoom: 64 });
  assert.equal(s.host._glass().zoom, GLASS_ZOOM_MAX);
  s.host.glass(0.1, { up: true, zoom: 1 });
  assert.equal(s.host._glass().zoom, GLASS_ZOOM_MIN);
});

test('SPYGLASS my Lookout calls her colours: a crewed deck with a Lookout reads a sail within LOOKOUT_ID_M times his worth - said, and cried from her bow; a deck without one, or no crew, reads her at the eye\'s reach (mutants: the post unread, the crew unread, the call unsaid)', async () => {
  const save = { v: 1, boats: { 42: { hull: 2, sail: 1, crew: 1, mates: { morale: 60, hires: 2, hands: [hand('Elsa', 'Lookout'), hand('Hal', 'Deckhand')] } } }, notoriety: {}, day: null, raids: [] };
  const s = await sea({ hull: 2, save });
  s.boat.crewed = true;
  s.run(0.2);
  const e = spawn(s, 'merchantCoaster', 340);   // a Green Lookout: 320 m x 1.1 = 352 m
  s.run(0.5);
  assert.equal(e.known, KNOW.colours);
  assert.ok(s.log.say.includes(`Lookout: A sloop flying ${e.ship.flag}'s merchant colors!`), s.log.say.join(' | '));
  const bare = await sea({ hull: 2 });
  const f = spawn(bare, 'merchantCoaster', 340);
  bare.run(0.5);
  assert.equal(f.known, KNOW.hull, 'no Lookout aboard: the eye\'s reach alone');
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /return \{ deck, sight: st\?\.worth\?\.sight \?\? 1, lookout: !!deck\?\.crewed && !!st\?\.worth\?\.posts\?\.Lookout \};/, 'a Lookout on a crewed deck');
  assert.match(host, /hailCalls\.set\(deck, `Flying \$\{colours\}!`\);/, 'cried from her bow');
});

test('SPYGLASS false colours at sea: a wary pirate under a merchantman\'s colours reads one on her tag and her card - friendly, no stance of hers - flies a merchantman\'s pennant, and no lookout hails her; the glass held close sees through her (a pirate to me from now); her black flag goes up as she goes for her prey (mutants: the disguise unread, the pennant, the hail\'s hold, the seeing-through, the black flag)', async () => {
  const { seed, flag } = deceiver();
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'pirateSloop', 150, Math.PI / 2, { temper: 'wary' });
  e.plain = false; e.ship.seed = seed;
  s.run(1);
  assert.equal(e.known, KNOW.colours, 'the eye reads her colours - her false ones');
  // PIN MOVED (AUDIT CAPTAIN'S SEA S5): the trader she passes for - the merchant of her own hull, named off her seed as that
  // trader would be under the false crown, lined as that trader's class ("A merchantman of X", "Merchantman" was the tell)
  const trader = merchantOfHull(e.ship.hull);
  const as = shipNames(trader, seed, { regionIndex: CROWNS.find((c) => c.name === flag).region }).name;
  const t = tagOf(s, e);
  assert.deepEqual([t.name, t.line, t.faction, t.friendly, t.hostile, t.bound], [as, classLine(trader), 'merchant', true, false, '']);
  const card = s.host.hudModel().target;
  assert.deepEqual([card.name, card.faction, card.friendly, card.hostile], [as, 'merchant', true, false]);
  assert.deepEqual(e.boat.flagColor, NAVAL_FACTIONS.merchant.flag, 'a merchantman\'s pennant at her masthead');
  assert.ok(!s.log.say.some((l) => l.startsWith('Sail ho')), 'no hail for a merchantman');
  // after a weaker prey she cannot yet see (past her ENGAGE_RANGE, within the lookout's SAIL_HO_RANGE): no hail while her
  // false colours hold - the same sloop under no colours of her own is hailed
  const hailed = async (plain) => {
    const r = await sea({ hull: 0 });
    const p = spawn(r, 'pirateSloop', 820, Math.PI / 2, { temper: 'wary' });
    p.plain = plain; p.ship.seed = seed;
    r.run(3, 0.25);
    assert.equal(p.ship.mode, 'cruise', 'not yet after me');
    return r.log.say.some((l) => l.startsWith('Sail ho'));
  };
  assert.deepEqual([await hailed(false), await hailed(true)], [false, true]);
  const seen = hold(s, e, 1.5);
  assert.equal(e.known, KNOW.studied);
  assert.ok(s.log.mid.includes(`False colors! ${e.ship.names.name} is a pirate.`), s.log.mid.join(' | '));
  assert.equal(seen.rows[0][0], 'False colors');
  assert.deepEqual([tagOf(s, e).name, tagOf(s, e).faction], [e.ship.names.name, 'pirate'], 'her tag her own now');
  // a weaker prey: she runs up the black flag and comes on
  const r = await sea({ hull: 0 });
  const p = spawn(r, 'pirateSloop', 150, Math.PI / 2, { temper: 'wary' });
  p.plain = false; p.ship.seed = seed;
  knowAll(r.host);
  for (let i = 0; i < 50 && !p.blackFlag; i++) r.run(0.1);
  assert.equal(p.blackFlag, true);
  assert.ok(r.log.say.includes(`False colors! ${as} runs up the black flag!`), r.log.say.join(' | '));   // PIN MOVED (AUDIT CAPTAIN'S SEA S5): the trader she passed for
  r.run(0.5);
  assert.deepEqual(p.boat.flagColor, NAVAL_FACTIONS.pirate.flag, 'the black at her masthead');
  assert.equal(tagOf(r, p).faction, 'pirate');
});

test('SPYGLASS the crew\'s cries by what is known: a hostile sail\'s hail names her hull while her colours are unread, her class once they are; a ship called by her kind until then (mutants: the hail\'s name, the called name)', async () => {
  const s = await sea({ hull: 2 });
  const e = spawn(s, 'pirateSloop', 700);
  for (let i = 0; i < 40 && !s.log.say.some((l) => l.startsWith('Sail ho')); i++) s.run(0.25);
  assert.ok(s.log.say.includes('Sail ho! A sloop on the starboard beam!'), s.log.say.join(' | '));
  const t = await sea({ hull: 2 });
  const k = spawn(t, 'pirateSloop', 700);
  knowAll(t.host);
  for (let i = 0; i < 40 && !t.log.say.some((l) => l.startsWith('Sail ho')); i++) t.run(0.25);
  assert.ok(t.log.say.includes('Sail ho! A Pirate Sloop on the starboard beam!'), t.log.say.join(' | '));
  assert.ok(e && k);
  const host = rd('src/scenes/naval/navalHost.js');
  assert.match(host, /const calledName = \(e\) => \(knownOf\(e\) < KNOW\.colours \? withArticle\(hullWord\(e\.ship\.hull\)\) : disguisedOf\(e\) \? shownName\(e\) : nameOf\(e\)\);/);
  for (const cry of ['Check your fire! ${calledName(entry)} fights on your side.', '${calledName(victor)} grapples ${calledName(prize)}!', '${calledName(v)} takes ${calledName(p)} and sets it on fire!', '${calledName(e)} comes to your aid!']) assert.ok(host.includes(cry), cry);
});

test('SPYGLASS the world: the Spyglass action appended, a port row in Come Sail Away\'s group, shared onto K beside the road\'s follow; the touch corner\'s and the pad\'s to choose; the glass\'s frame - raised aboard alone, down under a window, the travel view, a laid broadside; the lens narrowed at the frame\'s three, the look slowed, the wheel its magnification; the road\'s follow never read aboard (mutants: each seam)', () => {
  assert.equal(ACTIONS.at(-5), 'Spyglass');   // SHOT-KINDS: and the guns' load   // PIN MOVED (UI-CALM, CARGO-ANYWHERE, PARTY-PING): the saddle panel's key, the hold's and the ping's appended after it
  assert.ok(PORT_ACTIONS.includes('Spyglass'));
  assert.ok(DEFAULT_SHARES.some(([c, a, p]) => c === 'KeyK' && a === 'Spyglass' && p === 'FollowPaths'));
  assert.ok(!DEFAULT_BINDINGS.some(([, a]) => a === 'Spyglass'), 'it owns no key - a share');
  assert.ok(ACTION_GROUPS.find((g) => g.mod === 'come-sail-away').rows.some((r) => r.action === 'Spyglass'));
  assert.ok(MOD_ACTIONS['come-sail-away'].some((r) => r.action === 'Spyglass' && r.legacy == null), 'live while the ships are');
  assert.deepEqual(TOUCH_BUTTON_ACTIONS.find((a) => a.id === 'Spyglass'), { id: 'Spyglass', label: 'Spyglass (aboard)', glyph: 'Glass', kind: 'tap', w: 64 });
  assert.ok(PLUS_BIND_ROWS.some((r) => r.sec === 'Spyglass'));
  assert.ok(DPAD_CHOICES.some(([a]) => a === 'Spyglass'));
  const w = rd('src/scenes/world.js');
  // PIN MOVED (AUDIT CAPTAIN'S SEA S1): never while a door builds or the world is moved
  assert.match(w, /const spyglassAllowed = \(\) => navalOn\(\) && !!naval\?\.aboard\?\.\(\) && _mode\(\) === 'exterior' && walkMode && playerSpawned && !_loading && !gamePaused\(\)\n\s+&& !townTalk\.overlayActive && !travelView\?\.active && !naval\?\.aiming && !\(townTalk\.overlay instanceof DeathScreen\)\n\s+&& !modes\?\.transitioning && !worldMoveBusy\(\);/);
  // PIN MOVED (AUDIT CAPTAIN'S SEA S2/S3/S16): the host's own door and a finger's Lower press it too; a finger's Magnify turns it
  assert.match(w, /const pressedNow = hccActionPressed\('Spyglass'\) \|\| navalTouchGlass\(\) \|\| glassDoorPress \|\| \(taps\.lower && spyglass\.up\);\n\s+glassDoorPress = false;\n\s+if \(pressedNow && \(spyglass\.up \|\| spyglassAllowed\(\)\)\) spyglass\.up = !spyglass\.up;\n\s+if \(spyglass\.up && !spyglassAllowed\(\)\) spyglass\.up = false;\n[^\n]*\n\s+mwViewHoldFirst\(spyglass\.up\);\n\s+spyglass\.lens = easeLens\(spyglass\.lens, spyglass\.up \? spyglass\.zoom : 1, dt\);/);
  assert.match(w, /naval\.glass\(dt, \{ up: spyglass\.up, zoom: spyglass\.zoom, field, near: spyglass\.near \}\)/);   // PIN MOVED (AUDIT CAPTAIN'S SEA S19): and its field; PIN MOVED (GLASS-CLEAR): and its focus
  // PIN MOVED (GLASS-CLEAR): its near the glass's focus; PIN MOVED (OW-HORIZON, 2026-10-20): the lens through
  // scenes/travelHorizon.js horizonProj, taken after the travel view's frame (its planes grow under the view) - still
  // after the glass's step
  const stepAt = w.indexOf('spyglassStep(dt);'), lensAt = w.indexOf('const proj = horizonProj(glassFov(fieldOfView() + climbFeel.fovRad(), spyglass.lens), worldAspect, spyglass.near, tvf);');
  assert.ok(stepAt > 0 && lensAt > stepAt, 'the step before the lens is taken');
  assert.match(w, /sky\.draw\([^\n]*glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\), worldAspect,/, 'the sky through the glass');
  assert.match(w, /fovY: glassFov\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), spyglass\.lens\), aspect: worldAspect,/, 'the far ring through it');
  assert.equal((w.match(/lookScale\(\) \* glassLookScale\(spyglass\.lens\)/g) || []).length, 2, 'the mouse\'s look and the finger\'s and pad\'s');
  assert.equal((w.match(/lookScale\(\) \* lookInvert\(\) \* glassLookScale\(spyglass\.lens\)/g) || []).length, 2);
  assert.match(w, /\|\| modes\?\.wheel\?\.\(e\) \|\| spyglassWheel\(e\.deltaY\) \|\| shotWheel\(e\.deltaY\) \|\| mwViewWheel\(e\.deltaY\)\) e\.preventDefault\(\);/, 'the wheel: the glass\'s before the camera\'s');   // PIN MOVED (SHOT-KINDS: the laid guns' load before the camera too)
  assert.match(w, /spyglass\.zoom = Math\.max\(GLASS_ZOOM_MIN, Math\.min\(GLASS_ZOOM_MAX, deltaY < 0 \? spyglass\.zoom \* 2 : spyglass\.zoom \/ 2\)\);/);
  assert.match(w, /function travelFollowPressed\(\) \{ return !naval\?\.aboard\?\.\(\) && pressed\(latch\.edge, keys, 'FollowPaths'\); \}/, 'a deck has no road');
  assert.match(w, /glassUp: spyglass\.up,/, 'the plate\'s Glass brass while it is up');
});

test('SPYGLASS the lens: eased to the glass\'s magnification over GLASS_EASE_S and home, snapped within a hair; the field\'s tangent divided by it; the look slowed by it (mutants: the ease, the snap, the tangent, the look)', () => {
  assert.equal(GLASS_EASE_S, 0.12);
  const one = easeLens(1, 4, GLASS_EASE_S);
  assert.ok(Math.abs(one - (1 + 3 * (1 - Math.exp(-1)))) < 1e-12, `${one}`);
  assert.equal(easeLens(3.995, 4, 0.016), 4, 'snapped');
  assert.equal(easeLens(4, 1, 10), 1, 'home');
  assert.equal(easeLens(2, 4, -1), 2, 'no time, no change');
  const f = 65 * Math.PI / 180;
  assert.ok(Math.abs(Math.tan(glassFov(f, 4) / 2) - Math.tan(f / 2) / 4) < 1e-12);
  assert.equal(glassFov(f, 1), f);
  assert.deepEqual([glassLookScale(4), glassLookScale(1), glassLookScale(0.5)], [0.25, 1, 1]);
});

test('SPYGLASS the head: while the glass is up the view is held in first person - a third-person body put into the head and handed back as it stood, the perspective key refused meanwhile; the travel view\'s hold wins (mutants: the hand-back, the refusal, the travel view\'s precedence)', async () => {
  const mv = await import('../../../src/player/mwView.js');
  const { eotbCamera } = await import('../../../src/player/eyeOfTheBeholder/eotbCamera.js');
  const { setModSetting } = await import('../../../src/systems/modSettings.js');
  setModSetting('eye-of-the-beholder', 'Enabled', true);   // the sprite's lane (this suite runs with every mod off)
  mv.setEotbBodyReady(() => true);
  try {
    if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
    assert.equal(mv.mwViewHoldFirst(true), true);
    assert.equal(mv.mwViewHeldFirst(), true);
    assert.equal(mv.mwViewHoldFirst(false), true);
    assert.equal(eotbCamera.thirdPerson(), false, 'in the head it stood, in the head it stays');
    assert.equal(mv.mwViewTogglePerspective(), true);
    assert.equal(eotbCamera.thirdPerson(), true, 'third person');
    assert.equal(mv.mwViewHoldFirst(true), true);
    assert.equal(eotbCamera.thirdPerson(), false, 'the glass to the eye: into the head');
    assert.equal(mv.mwViewTogglePerspective(), false, 'the key refused while the glass is up');
    assert.equal(mv.mwViewHoldFirst(false), true);
    assert.equal(eotbCamera.thirdPerson(), true, 'handed back as it stood');
    assert.equal(mv.mwViewHoldFirst(false), false, 'nothing held');
    mv.mwViewHoldThird(true);
    assert.equal(mv.mwViewHoldFirst(true), false, 'the travel view holds the body out');
    mv.mwViewHoldThird(false);
  } finally { mv.setEotbBodyReady(() => false); if (eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false); setModSetting('eye-of-the-beholder', 'Enabled', false); }
});

test('SPYGLASS the window: hidden while the glass is down; up, the tube and its reticle, the card of the ship it holds - her name in her tone, her line, her rows, the study\'s bar while it fills, the hint - and its foot\'s magnification and presses (mutants: the hidden, the rows, the tone, the bar, the foot\'s words)', () => {
  assert.equal(glassFootWords({ zoom: 4, keys: { glass: 'K' } }), 'x4 - Wheel: magnify - K: lower the glass');
  assert.equal(glassFootWords({ zoom: 8, touch: true }), 'x8');   // PIN MOVED (AUDIT CAPTAIN'S SEA S3/S16): a finger's presses are the foot's own Magnify and Lower
  assert.equal(glassFootWords({ zoom: 2, pad: true, keys: { glass: 'Y' } }), 'x2 - Y: lower the glass');
  drawSpyglass(null);
  assert.equal(byClass(globalThis.document.body, 'dfglass').length, 0, 'nothing built while it is down');
  const card = { title: 'The Black Gull', sub: 'Pirate Sloop', rows: [['Colours', 'the black flag'], ['Guns', '6 swivels']], tone: 'pirate', study: 0.5, hint: '' };
  drawSpyglass({ card, zoom: 4 }, { keys: { glass: 'K' } });
  const [root] = byClass(globalThis.document.body, 'dfglass');
  assert.ok(root && root.style.display !== 'none');
  assert.equal(root.className, 'dfglass held');
  const [title] = byClass(root, 'dfglass-title');
  assert.deepEqual([title.textContent, title.style.color], ['The Black Gull', GLASS_TONES.pirate]);
  assert.equal(byClass(root, 'dfglass-sub')[0].textContent, 'Pirate Sloop');
  assert.equal(byClass(root, 'dfglass-rows')[0].textContent, 'Coloursthe black flagGuns6 swivels');
  const [bar] = byClass(root, 'dfglass-study');
  assert.equal(bar.style.display, '');
  assert.equal(bar.children[0].style.width, '50%');
  assert.equal(byClass(root, 'dfglass-hint')[0].style.display, 'none');
  assert.equal(byClass(root, 'dfglass-foot-words')[0].textContent, 'x4 - Wheel: magnify - K: lower the glass');   // PIN MOVED (AUDIT CAPTAIN'S SEA S3/S16): the foot's words beside its two finger presses
  drawSpyglass({ card: { ...card, study: 1, hint: 'Close within 900 m to make out its guns and hold' }, zoom: 8 }, { keys: { glass: 'K' } });
  assert.equal(bar.style.display, 'none', 'studied: no bar');
  assert.equal(byClass(root, 'dfglass-hint')[0].textContent, 'Close within 900 m to make out its guns and hold');
  drawSpyglass({ card: null, zoom: 8 }, { keys: { glass: 'K' } });
  assert.equal(root.className, 'dfglass', 'nothing held');
  assert.equal(byClass(root, 'dfglass-card')[0].style.display, 'none');
  drawSpyglass(null);
  assert.equal(root.style.display, 'none', 'down');
  drawSpyglass({ card, zoom: 4 }, { covered: true });
  assert.equal(root.style.display, 'none', 'the HUD hidden: hidden with it');
});

test('SPYGLASS the plate\'s Glass under a finger: at a helm on a touch screen a Glass press stands over the Brace, a tap read once by the world, brass while the glass is up; none off a touch screen (mutants: the press unshown, the tap kept, the brass)', () => {
  destroyNavalHud();
  const model = { ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1 }, armed: false, aiming: false, aim: null, board: null, boarding: null, target: null, batteries: [], notoriety: { crown: 'Wayrest', value: 0, level: 0 } };
  drawNavalHud(model, { touch: true });
  const [btn] = byClass(globalThis.document.body, 'dfnaval-glassbtn');
  assert.ok(btn, 'the press');
  assert.equal(btn.style.display, '');
  assert.equal(btn.className, 'dfnaval-glassbtn');
  assert.equal(navalTouchGlass(), false, 'no tap yet');
  for (const f of btn.listeners.touchstart) f({ preventDefault() {}, stopPropagation() {} });
  assert.equal(navalTouchGlass(), true, 'the tap');
  assert.equal(navalTouchGlass(), false, 'read once');
  drawNavalHud(model, { touch: true, glassUp: true });
  assert.equal(btn.className, 'dfnaval-glassbtn down', 'brass while up');
  drawNavalHud(model, { touch: false });
  assert.equal(btn.style.display, 'none', 'no finger, no press');
  destroyNavalHud();
});
