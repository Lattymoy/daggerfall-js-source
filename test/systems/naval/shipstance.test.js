// SHIP-STANCE and SHIP-TAGS (2026-10-02, Mac: "Improve the enemy and friendly UI substationally" and "Friendly ships
// should have green Healthbars unless provoked") - a ship's tag and card said one thing of how she stood: hostile, or
// nothing. Every bar was an enemy's red - the merchantman sailing by, the crown's cutter keeping the passage, the
// pirate closing - and nothing said what a ship was or where she went. Now:
//   SHIP-STANCE - a ship flying a lawful flag (a merchantman, a crown's ship) that is not after me is FRIENDLY: her tag's
//                 bar and her card's hull green (CREW_GREEN, the party's own), her card's state "Friendly"; provoked
//                 (a blow of mine, PROVOKED_S), hunting me (my notoriety with her crown) or struck, she is not - a
//                 hostile ship's red, "Hostile" in red; a pirate not after me now is neither (red still)
//   SHIP-TAGS   - within TAG_DETAIL_M of the eye a tag reads a second line: her class (a crown's by her crown) and where
//                 she is bound - moored at, leaving, patrolling off or bound for a harbour by its town's name, a lane's
//                 packet bound for her next port or lying off it (SEA-LANES), a relief coming to my aid; the card's
//                 state line says the same after her stance
// The host's own model (scenes/naval/navalHost.js tagsModel, targetCardOf) through real frames over Come Sail Away's pool
// (test/navalSea.mjs), and the HUD's own text and DOM (ui/naval/navalHud.js). Each is red on the record's code (168bf2587).
// `03-World/Naval-Combat.md` (NAV-F).
import { byClass } from '../../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea, knowAll } from '../../navalSea.mjs';
import { provoke, PROVOKED_S, NAVY_HUNTS } from '../../../src/systems/naval/navalAI.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { classLine } from '../../../src/systems/naval/navalShips.js';
import { drawNavalTags, drawNavalHud, destroyNavalHud, navalHudText, tagLine, TAG_DETAIL_M, NAVAL_HUD_CSS, CREW_GREEN } from '../../../src/ui/naval/navalHud.js';

/** The coast of test/systems/naval/shiplife.test.js: land north of z = 200 and a headland east; the town behind the shore. */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const PORT = { key: 'port:1', name: 'Wayrest', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
/** A ship stood by the host at `range` m on `bearing` (radians from +z), built and settled. */
function stand(h, classId, range, bearing, temper = null) {
  const e = h.host._sea.get(h.host.spawnShip(classId, { range, bearing, temper }));
  return e;
}
const tagOf = (h, e) => h.host.tags().find((t) => t.id === e.id);

test('SHIP-STANCE FRIENDLY UNTIL PROVOKED, by the real host: a merchantman and a crown\'s cutter under way are friendly - neither hostile - a pirate after my boat is hostile and never friendly; a blow of mine turns the merchantman hostile (PROVOKED_S), and when it is old she is friendly again; a crown hunting me (my notoriety) is hostile; a ship struck is neither - on her tag and her card alike', async () => {
  const h = await sea({ hull: 2 });
  const m = stand(h, 'merchantCoaster', 300, Math.PI / 2);   // on the look (+x): the card's
  const n = stand(h, 'navyCutter', 400, 0);
  const p = stand(h, 'pirateBrig', 500, Math.PI);
  const w = stand(h, 'pirateSloop', 650, -Math.PI / 2, 'wary');   // a wary sloop: my boat no prize of hers
  knowAll(h.host);   // PIN MOVED (SPYGLASS): their colours made out - an unknown hull wears no tag, and her card says nothing of her stance
  h.run(1.5);
  for (const e of [m, n, p, w]) assert.ok(tagOf(h, e), `${e.ship.cls.id} tagged`);
  const stance = (e) => { const t = tagOf(h, e); return [t.hostile, t.friendly]; };
  assert.deepEqual(stance(m), [false, true], 'the merchantman: friendly');
  assert.deepEqual(stance(n), [false, true], 'the crown\'s cutter: friendly');
  assert.deepEqual(stance(p), [true, false], 'the pirate after my boat: hostile');
  assert.deepEqual(stance(w), [false, false], 'a pirate not after me: neither - no lawful flag');
  const card = () => h.host.hudModel().target;
  assert.equal(card().id, m.id);
  assert.deepEqual([card().hostile, card().friendly, card().bound], [false, true, ''], 'her card: friendly, her own cruise');
  m.ship.errand = { kind: 'voyage', harbour: null, path: null, i: 0 };
  assert.equal(card().bound, 'bound out to sea', 'and where she is bound');
  m.ship.errand = null;
  // provoked: a blow of mine
  provoke(m.ship, 'local', 0);
  assert.deepEqual(stance(m), [true, false], 'provoked: hostile, the green gone');
  assert.deepEqual([card().hostile, card().friendly], [true, false]);
  provoke(m.ship, 'local', -PROVOKED_S - 5);
  assert.deepEqual(stance(m), [false, true], 'the blow forgotten: friendly again');
  // a crown that hunts me
  h.host.notoriety.add(n.ship.names.crown, NAVY_HUNTS);
  assert.deepEqual(stance(n), [true, false], 'hunting me: hostile');
  // struck - a blow of mine on her fresh: still neither (no fight in a struck ship)
  provoke(m.ship, 'local', 0);
  m.ship.damage.apply({ hull: m.ship.damage.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  assert.equal(m.ship.damage.state, SHIP_STATES.struck);
  assert.deepEqual(stance(m), [false, false], 'struck: neither');
  assert.deepEqual([card().hostile, card().friendly], [false, false]);
});

test('SHIP-STANCE THE GREEN BAR: a friendly ship\'s tag is marked `friendly` and its bar\'s fill is green by the HUD\'s own CSS (CREW_GREEN) - a hostile ship\'s red as it was, and the mark never on a ship that is hostile; the card\'s hull green, its state "Friendly" in green, "Hostile" in red', () => {
  destroyNavalHud();
  const pt = (o = {}) => ({ id: 'a:1', name: 'The Gilded Cog', faction: 'merchant', hostile: false, friendly: true, hull: 0.9, state: 'afloat', boarded: false, target: false, distance: 150, x: 400, y: 200, ...o });
  drawNavalTags([pt(), pt({ id: 'b:2', name: 'The Black Kraken', faction: 'pirate', hostile: true, friendly: false, x: 700 }), pt({ id: 'c:3', hostile: true, friendly: true, x: 1000 }), pt({ id: 'd:4', faction: 'pirate', friendly: false, x: 1300 })], { scale: 1, reach: 700 });   // SHIP-CLUTTER: apart, or one covers the rest
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  assert.deepEqual(byClass(layer, 'dfnaval-tag').map((x) => x.className), ['dfnaval-tag merchant friendly', 'dfnaval-tag pirate hostile', 'dfnaval-tag merchant hostile', 'dfnaval-tag pirate']);
  assert.ok(NAVAL_HUD_CSS.includes(`.dfnaval-tag.friendly .dfnaval-tag-bar > i { background: linear-gradient(180deg, #b8ffb8 0 1px, ${CREW_GREEN} 1px); }`), 'the friendly bar: green');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-tag-bar > i \{[^}]*#b53a2e 1px\); \}/, 'the rest: red');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-card\.friendly \.dfnaval-track\.hull \.dfnaval-fill \{ background: linear-gradient\(180deg, #b9f0c4 0 2px, #5fc27c 2px 4px, #2f9152 4px 8px/, 'the card\'s hull: green');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-card-state\.friendly \{ color: #9fe0a8; \}/);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-card-state\.hostile \{ color: #ff9c8a; \}/);
  destroyNavalHud();
  // the card
  const helm = (target) => ({ ship: { name: 'Small Ship', hull: 1, sail: 1, crew: 1, fire: false, wrecked: false, braced: false }, armed: false, aiming: false, aim: null, board: null, boarding: null, batteries: [], notoriety: { crown: 'Wayrest', value: 0, level: 0 }, target });
  const target = (o = {}) => ({ id: 'a:1', name: 'The Gilded Cog', captain: 'Ysona Wicksley', classLine: 'Merchant Coaster', faction: 'merchant', hull: 0.9, sail: 1, state: 'afloat', boarded: false, distance: 220, hostile: false, friendly: true, bound: 'bound for Sentinel', ...o });
  const c = navalHudText(helm(target())).card;
  assert.deepEqual([c.friendly, c.hostile, c.state, c.stateKind], [true, false, 'Friendly - bound for Sentinel', 'friendly']);
  const foe = navalHudText(helm(target({ hostile: true, friendly: false, bound: '' }))).card;
  assert.deepEqual([foe.friendly, foe.hostile, foe.state, foe.stateKind], [false, true, 'Hostile', 'hostile']);
  assert.equal(navalHudText(helm(target({ hostile: true, friendly: true }))).card.friendly, false, 'never friendly while hostile');
  const pirate = navalHudText(helm(target({ faction: 'pirate', friendly: false, bound: '' }))).card;
  assert.deepEqual([pirate.state, pirate.stateKind], ['', ''], 'a pirate not after me: neither');
  assert.equal(navalHudText(helm(target({ state: 'struck', friendly: false }))).card.state, 'Colors struck', 'struck: her colours, as before');
  drawNavalHud(helm(target()), { keys: {} });
  const [root] = byClass(globalThis.document.body, 'dfnaval-hud');
  assert.equal(byClass(root, 'dfnaval-card')[0].className, 'dfnaval-card merchant friendly');
  assert.equal(byClass(root, 'dfnaval-card-state')[0].className, 'dfnaval-card-state friendly');
  assert.equal(byClass(root, 'dfnaval-card-state')[0].textContent, 'Friendly - bound for Sentinel');
  drawNavalHud(helm(target({ hostile: true, friendly: false, bound: '' })), { keys: {} });
  assert.equal(byClass(root, 'dfnaval-card')[0].className, 'dfnaval-card merchant hostile');
  assert.equal(byClass(root, 'dfnaval-card-state')[0].className, 'dfnaval-card-state hostile');
  destroyNavalHud();
});

test('SHIP-TAGS HER CLASS AND WHERE SHE IS BOUND: within TAG_DETAIL_M of the eye a tag\'s second line reads her class (a crown\'s ship by her crown) and where she is bound; past it, none (the name and the bar are what can be read); the line drawn in its own slot, emptied when it says nothing', () => {
  assert.equal(tagLine({ distance: TAG_DETAIL_M, line: 'Wayrest War Galley', bound: 'bound for Daggerfall' }), 'Wayrest War Galley - bound for Daggerfall');
  assert.equal(tagLine({ distance: TAG_DETAIL_M + 1, line: 'Wayrest War Galley', bound: 'bound for Daggerfall' }), '', 'too far to read');
  assert.equal(tagLine({ distance: 100, line: 'Merchant Coaster', bound: '' }), 'Merchant Coaster');
  assert.equal(tagLine({ distance: 100, line: '', bound: 'moored at Wayrest' }), 'moored at Wayrest');
  assert.equal(tagLine({ line: 'Merchant Coaster' }), '', 'no distance: none');
  destroyNavalHud();
  const pt = (o = {}) => ({ id: 'a:1', name: 'The Gilded Cog', faction: 'merchant', hostile: false, friendly: true, line: 'Merchant Coaster', bound: 'bound for Sentinel', hull: 1, state: 'afloat', boarded: false, target: false, distance: 150, x: 400, y: 200, ...o });
  drawNavalTags([pt()], { scale: 1, reach: 700 });
  const [layer] = byClass(globalThis.document.body, 'dfnaval-tags');
  const [tag] = byClass(layer, 'dfnaval-tag');
  assert.deepEqual(tag.children.map((x) => x.className), ['dfnaval-tag-name', 'dfnaval-tag-line', 'dfnaval-tag-bar', 'dfnaval-tag-state'], 'the line under her name, over her bar');
  assert.equal(byClass(tag, 'dfnaval-tag-line')[0].textContent, 'Merchant Coaster - bound for Sentinel');
  drawNavalTags([pt({ distance: 600 })], { scale: 1, reach: 700 });
  assert.equal(byClass(tag, 'dfnaval-tag-line')[0].textContent, '', 'far: emptied (and hidden by its :empty rule)');
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-tag-line:empty \{ display: none; \}/);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-tag\.friendly \.dfnaval-tag-line \{ color: #bfe6c3; \}/);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-tag\.hostile \.dfnaval-tag-line \{ color: #f0b9ae; \}/);
  destroyNavalHud();
});

test('SHIP-TAGS THE WORDS, by the real host: her class line (a crown\'s by her crown), and where she is bound by her errand and her harbour\'s town - moored at, leaving, patrolling off, bound for; a lane\'s packet bound for her next port or lying off it; a relief coming to my aid; a voyage out of the harbours bound out to sea; nothing while she fights, nor for another player\'s ship - and the card\'s state line after her stance', async () => {
  const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'some' } });
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => PORT;
  h.run(0.5);   // the harbour sounded and named
  const n = stand(h, 'navyCutter', 380, Math.PI);
  h.run(1);
  const t = () => tagOf(h, n);
  assert.equal(t().line, classLine(n.ship.cls, n.ship.names.crown));
  assert.match(t().line, /^(Daggerfall|Wayrest|Sentinel) /, 'a crown\'s ship by her crown');
  const bound = (errand) => { n.ship.errand = errand; n.ship.course = null; return t().bound; };
  const on = (kind, extra = {}) => ({ kind, harbour: PORT.key, berth: 0, path: null, i: 0, until: 1e9, ...extra });
  assert.equal(bound(on('moored')), 'moored at Wayrest');
  assert.equal(bound(on('depart')), 'leaving Wayrest');
  assert.equal(bound(on('patrol')), 'patrolling off Wayrest');
  assert.equal(bound(on('arrive')), 'bound for Wayrest');
  assert.equal(bound(on('voyage')), 'bound for Wayrest');
  assert.equal(bound(on('patrol', { harbour: 'port:9' })), 'on patrol', 'a harbour not known: no name');
  assert.equal(bound(on('voyage', { harbour: null })), 'bound out to sea');
  assert.equal(bound(null), '', 'her own cruise: nothing said');
  n.relief = true;
  assert.equal(bound(null), 'coming to your aid');
  n.relief = false;
  // AUDIT BAY A9 PIN MOVED: a packet's ports by key and name, and lying off her port by her leg's end (LINER_PORT_M)
  const SENT = { key: 'port:7', name: 'Sentinel' }, WAYR = { key: PORT.key, name: 'Wayrest' };
  const leg = [[n.ship.pos[0], n.ship.pos[2] - 3000], [n.ship.pos[0], n.ship.pos[2] + 2000]];
  n.liner = { id: 'L1-2.0.1', seed: 1, phase: 'sail', to: SENT, from: WAYR, port: null, leg, way: leg, dest: SENT };
  assert.equal(bound(null), 'bound for Sentinel', 'a lane\'s packet');
  n.liner = { id: 'L1-2.0.1', seed: 1, phase: 'dwell', to: WAYR, from: WAYR, port: SENT, leg, way: leg, dest: SENT };
  assert.equal(bound(null), 'bound for Sentinel', 'her dwell begun, she not yet there');
  const short = [leg[0], [n.ship.pos[0], n.ship.pos[2] + 100]];
  n.liner = { ...n.liner, leg: short, way: short };
  assert.equal(bound(null), 'lying off Sentinel', 'by her leg\'s end');
  n.liner = null;
  n.ship.errand = on('patrol');
  assert.equal(t().friendly, true);
  // fighting: nothing said of where she goes
  n.ship.mode = 'engage';
  assert.equal(t().bound, '');
  n.ship.mode = 'cruise';
  // struck: nothing
  n.ship.damage.apply({ hull: n.ship.damage.maxHull * 0.8, sail: 0, crew: 0 }, 0);
  assert.equal(t().bound, '');
  // the card's line through the HUD's own words
  const hud = navalHudText({ ship: null, armed: false, aiming: false, aim: null, board: null, boarding: null, batteries: [], notoriety: null, target: { id: 'x', name: 'The Gilded Cog', classLine: 'Merchant Coaster', faction: 'merchant', hull: 1, sail: 1, state: 'afloat', boarded: false, distance: 90, hostile: false, friendly: true, bound: 'moored at Wayrest' } });
  assert.equal(hud.card.state, 'Friendly - moored at Wayrest');
});
