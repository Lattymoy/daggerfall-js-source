// SHIP-COLOURS (2026-10-17, the owner: "Finally, a fully customizable flag with the option to use your guild insignia";
// bible/03-World/Naval-Refit.md SHIP-COLOURS) - A SHIP'S FLAG: its door, its design put right as it is chosen, the guild's
// arms flown in its shape, its key and its wire code (systems/naval/shipFlag.js); its drawing in the heraldry's hand
// (ui/flagArt.js); the cloth at her masthead, the law of its vertex shader run in JS (render/shipFlagPass.js, test/glsl.mjs);
// the flags flown over Come Sail Away's real runtime (scenes/shipFlagHost.js); the ledger that keeps hers and its save
// (systems/fleet.js); the Fleet's Colours act and panel (scenes/fleetHost.js, ui/fleetPage.js); the boats' word `f`
// (systems/comeSailAway/comeSailAwayWire.js) and the peers' reading; the world's wiring. tools/mutants/shipcolours.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FLAG_SHAPES, FLAG_DEFAULT, FLAG_SIZES, shipFlagOf, fitFlag, flownFlag, flagKey, flagCode, flagOfCode, flagSizeOf } from '../../../src/systems/naval/shipFlag.js';
import { flagSvg, FLAG_CLOTH, FLAG_DEVICE } from '../../../src/ui/flagArt.js';
import { FLAG_VS, FLAG_FS, FLAG_COLS, FLAG_ROWS, FLAG_WAVE_HZ, FLAG_SLACK_BEND, flagVertices, flyOf } from '../../../src/render/shipFlagPass.js';
import { BANNER_CLOCK_PERIOD } from '../../../src/render/bannerPass.js';
import { createShipFlagHost, flagPhaseOf } from '../../../src/scenes/shipFlagHost.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { fleetBook, fleetShip, knowShip, titleDeed, titleOf, setShipColours, fleetSaveData, restoreFleetSaveData, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { csaWireRecord, validCsaRecord, csaRecordKey } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { drawFleetPage, resetFleetPage } from '../../../src/ui/fleetPage.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../../../src/ui/holdingsPages.js';
import { glslFunctions } from '../../glsl.mjs';
import { scene, terrain } from '../../csaScene.mjs';
import { hostText } from '../../hostText.mjs';
import { readFileSync } from 'node:fs';

const WORLD = hostText('src/scenes/world.js');
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARMS = { field: 'sable', border: 'gold', device: 'wolf', division: 'pale', field2: 'crimson', charge: 'argent' };

test('SHIP-COLOURS the flag\'s door: a shape of four, a field of the sixteen, a division with a second colour not the field\'s, a border none or not the field\'s, a device none or the forty with a colour on neither part of the field (given one where none is said); the guild a choice; anything else none (mutants: each refusal, the charge\'s gift)', () => {
  assert.deepEqual(FLAG_SHAPES, ['flag', 'swallowtail', 'pennant', 'burgee']);
  const ok = shipFlagOf({ shape: 'swallowtail', field: 'azure', division: 'fess', field2: 'argent', border: 'gold', device: 'ship', charge: 'gold', guild: true });
  assert.deepEqual({ ...ok }, { shape: 'swallowtail', field: 'azure', division: 'fess', field2: 'argent', border: 'gold', device: 'ship', charge: 'gold', guild: true });
  assert.ok(Object.isFrozen(ok));
  assert.deepEqual({ ...shipFlagOf({ field: 'vert' }) }, { shape: 'flag', field: 'vert', division: 'plain', field2: null, border: null, device: null, charge: null, guild: false }, 'a plain cloth');
  for (const [bad, why] of [
    [{ field: 'plaid' }, 'a colour not the heraldry\'s'], [{ shape: 'kite', field: 'azure' }, 'a shape of none'], [{ field: 'azure', division: 'wavy' }, 'a division of none'],
    [{ field: 'azure', division: 'pale' }, 'a divided field with no second colour'], [{ field: 'azure', division: 'pale', field2: 'azure' }, 'its second the first'],
    [{ field: 'azure', field2: 'gold' }, 'a plain field with a second'], [{ field: 'azure', border: 'azure' }, 'a border the field\'s'],
    [{ field: 'azure', device: 'unicorn' }, 'a device of none'], [{ field: 'azure', device: 'wolf', charge: 'azure' }, 'a device on the field\'s own colour'],
    [{ field: 'azure', division: 'pale', field2: 'gold', device: 'wolf', charge: 'gold' }, 'on the second\'s'], [{ field: 'azure', charge: 'gold' }, 'a colour for no device'],
    [{ field: 'azure', guild: 'yes' }, 'a guild that is no choice'], [null, 'nothing'], [[], 'a list'],
  ]) assert.equal(shipFlagOf(bad), null, why);
  assert.equal(shipFlagOf({ field: 'azure', border: 'gold', device: 'wolf' }).charge, 'gold', 'the border\'s');
  assert.equal(shipFlagOf({ field: 'argent', device: 'wolf' }).charge, 'sable', 'never the field\'s');
  assert.equal(shipFlagOf({ field: 'argent', division: 'pale', field2: 'sable', device: 'wolf' }).charge, 'gold', 'nor the second\'s');
  assert.equal(shipFlagOf({ field: 'gold', border: 'argent', division: 'fess', field2: 'argent', device: 'wolf' }).charge, 'sable', 'a border on the second\'s colour is no gift');
});

test('SHIP-COLOURS the design put right: every choice over FLAG_DEFAULT, each clash with one made before it mended - a second colour on the field\'s, a border on it, a device colour on either part - always a flag; the guild\'s arms flown in the flag\'s shape, its own colours set aside, and the guild\'s none its own; its key and its seven numbers, read back through the door (mutants: each mend, the shape kept, the guild unread, the code\'s door)', () => {
  assert.deepEqual({ ...fitFlag(null) }, { ...FLAG_DEFAULT });
  assert.equal(fitFlag({ field: 'gold' }).border, null, 'the default\'s gold border on a gold field: none');
  assert.equal(fitFlag({ field: 'gold' }).charge, 'argent', 'and its gold anchor Argent');
  assert.equal(fitFlag({ division: 'pale' }).field2, 'argent');
  assert.equal(fitFlag({ field: 'argent', division: 'pale', field2: 'argent' }).field2, 'sable');
  assert.equal(fitFlag({ shape: 'kite' }).shape, 'flag');
  assert.equal(fitFlag({ device: 'unicorn' }).device, null);
  assert.equal(fitFlag({ device: null }).charge, null);
  for (const raw of [{ field: 'sable', division: 'saltire', field2: 'sable', border: 'sable', device: 'skull', charge: 'sable' }, { field: 'x' }, 'nonsense']) assert.ok(shipFlagOf(fitFlag(raw)), JSON.stringify(raw));
  const mine = fitFlag({ shape: 'burgee', field: 'azure', guild: true });
  const flown = flownFlag(mine, ARMS);
  assert.deepEqual({ ...flown }, { shape: 'burgee', field: 'sable', division: 'pale', field2: 'crimson', border: 'gold', device: 'wolf', charge: 'argent', guild: true });
  assert.equal(flownFlag(mine, null).field, 'azure', 'no arms: its own');
  assert.equal(flownFlag(mine, { field: 'bogus' }).field, 'azure', 'arms the door refuses: its own');
  assert.equal(flownFlag({ ...mine, guild: false }, ARMS).field, 'azure', 'not the guild\'s: its own');
  assert.equal(flownFlag(null, ARMS), null);
  assert.equal(flownFlag(fitFlag({ guild: true }), { field: 'azure', border: 'gold', device: 'eagle' }).charge, 'gold', 'a plain guild\'s device in its border\'s colour (heraldryInk)');
  assert.equal(flagKey(flown), 'burgee|sable|pale|crimson|gold|wolf|argent');
  assert.equal(flagKey(null), '');
  const code = flagCode(flown);
  assert.equal(code.length, 7);
  assert.deepEqual({ ...flagOfCode(code) }, { ...flown, guild: false }, 'the colours it flies');
  assert.deepEqual({ ...flagOfCode(flagCode(shipFlagOf({ field: 'vert' }))) }, { ...shipFlagOf({ field: 'vert' }) });
  assert.equal(flagCode(null), 0);
  for (const bad of [0, [], [0, 0, 0, -1, -1, -1], [0, 0, 0, -1, -1, -1, -1, 0], ['0', '0', '0', -1, -1, -1, -1], [0, 0, 0, -1, -1, -1, -2], [9, 0, 0, -1, -1, -1, -1], [0, 99, 0, -1, -1, -1, -1], [0, 0, 0, -1, -1, 5, -1], [0, 0, 0, -1, -1, -1, 3], [0, 0, 0, 0.5, -1, -1, -1], [0, 0, 1, -1, -1, -1, -1]]) assert.equal(flagOfCode(bad), null, JSON.stringify(bad));
  assert.deepEqual(FLAG_SIZES.map((s) => s && [...s]), [null, [1.2, 0.8], [2.4, 1.6], [2.7, 1.8], [3, 2]]);
  assert.equal(flagSizeOf(0), null, 'a Rowboat flies none');
});

test('SHIP-COLOURS the drawing: each shape its cloth in the 150 x 100 box, the field, a divided field\'s second part, the border stroked inside the edge, the device at the middle on a flag (at the hoist on a pennant) in its own colour - and none where none is chosen (mutants: the division, the border, the device\'s place)', () => {
  const svg = flagSvg({ shape: 'flag', field: 'azure', division: 'pale', field2: 'argent', border: 'gold', device: 'anchor', charge: 'crimson' });
  assert.match(svg, /viewBox="0 0 150 100"/);
  assert.ok(svg.includes(`<path d="${FLAG_CLOTH.flag}" fill="#3b6fd8"/>`), 'the field');
  assert.ok(svg.includes('fill="#e6e6e6" clip-path'), 'the second part, Argent');
  assert.ok(svg.includes('stroke="#d4a017" stroke-width="18"'), 'the border');
  assert.ok(svg.includes(`translate(${FLAG_DEVICE.flag.x} ${FLAG_DEVICE.flag.y}) scale(${FLAG_DEVICE.flag.scale})`), 'the device at its middle');
  assert.ok(svg.includes('fill="#b3262e"'), 'in its own colour');
  const plain = flagSvg({ shape: 'pennant', field: 'vert' });
  assert.ok(plain.includes(FLAG_CLOTH.pennant));
  assert.ok(!plain.includes('translate('), 'no device');
  assert.ok(!plain.includes('stroke-width="18"'), 'no border');
  assert.equal(flagSvg(null), '');
  assert.ok(flagSvg({ shape: 'burgee', field: 'vert', device: 'star' }).includes(`translate(${FLAG_DEVICE.burgee.x} ${FLAG_DEVICE.burgee.y})`), 'at the hoist on a burgee');
  const mid = (at) => [at.x + 50 * at.scale, at.y + 50 * at.scale];
  assert.deepEqual(mid(FLAG_DEVICE.flag), [75, 50], 'a flag\'s device at the cloth\'s middle');
  assert.ok(mid(FLAG_DEVICE.swallowtail)[0] < 75 && mid(FLAG_DEVICE.swallowtail)[1] === 50, 'a swallowtail\'s short of its cut');
  for (const s of ['pennant', 'burgee']) assert.ok(mid(FLAG_DEVICE[s])[0] < 50 && mid(FLAG_DEVICE[s])[1] === 50, `a ${s}'s at the hoist, where its cloth is wide`);
});

test('SHIP-COLOURS the cloth: FLAG_COLS by FLAG_ROWS quads, the wave whole over the banners\' period; the hoist nailed at her masthead whatever the wind, the fly out downwind by its length in a fair wind, bent down along an arc of its own length in a calm (the sheet whole), the wave\'s throw growing to the free edge - the vertex shader\'s own law, run (mutants: the hoist moved, the droop, the throw at the staff, the fly reversed)', () => {
  assert.equal(flagVertices().length, FLAG_COLS * FLAG_ROWS * 12);
  assert.ok(Number.isInteger(FLAG_WAVE_HZ * BANNER_CLOCK_PERIOD));
  assert.deepEqual(flyOf([3, 9, 4]), [0.6, 0, 0.8]);
  assert.deepEqual(flyOf([0, 1, 0]), [0, 0, 1]);
  assert.match(FLAG_FS, /if \(t\.a < 0\.5\) discard;/);
  const at = (u, v, wind, time = 3.1) => {
    const out = { uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uTop: [10, 20, 30], uFly: [1, 0, 0], uSize: [3, 2], uTime: time, uWind: wind, uPhase: 0.7, aUV: [u, v] };
    const fns = glslFunctions(FLAG_VS, out);
    fns.main();
    return fns.globals.vWorld;
  };
  for (const wind of [0, 0.5, 1]) for (const v of [0, 1]) {
    const p = at(0, v, wind);
    assert.ok(Math.abs(p[0] - 10) < 1e-6 && Math.abs(p[2] - 30) < 1e-6 && Math.abs(p[1] - (20 - 2 * v)) < 1e-6, `the hoist nailed at wind ${wind}: ${p}`);
  }
  const fair = at(1, 0, 1), calm = at(1, 0, 0);
  assert.ok(Math.abs(fair[0] - 13) < 1e-6 && Math.abs(fair[1] - 20) < 1e-6, `a fair wind: out its length, level (${fair})`);
  const B = FLAG_SLACK_BEND;
  assert.ok(Math.abs(calm[0] - (10 + 3 * Math.sin(B) / B)) < 1e-5 && Math.abs(calm[1] - (20 - 3 * (1 - Math.cos(B)) / B)) < 1e-5, `a calm: bent down along an arc of its own length (${calm})`);
  const foot = at(1, 1, 0);
  assert.ok(Math.abs(foot[0] - (calm[0] - 2 * Math.sin(B))) < 1e-5 && Math.abs(foot[1] - (calm[1] - 2 * Math.cos(B))) < 1e-5, `the sheet bent whole - its foot turned with it (${foot})`);
  let near = 0, far = 0;
  for (let k = 0; k < 24; k++) { near = Math.max(near, Math.abs(at(0.2, 0.5, 1, k * 0.13)[2] - 30)); far = Math.max(far, Math.abs(at(1, 0.5, 1, k * 0.13)[2] - 30)); }
  assert.ok(far > near * 2 && far > 0.2, `the throw grows to the fly: ${near.toFixed(3)} at the staff, ${far.toFixed(3)} at the fly`);
});

/** Come Sail Away's real runtime with the Fleet's book (holddoor.test.js's), a boat of each hull placed. */
function world() {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  let uid = 7000;
  const pack = [];
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack, titles: () => fleetBook(), retitle: (boat) => !!boat };
  s.deps.isPortTown = () => true;
  const ship = (uidOf, hull, at = [100, 34, 200]) => { titleDeed(mintDeed(hull, 0, uidOf, 1000)); return s.rt.SummonBoat(uidOf, titleOf(uidOf), fleetBook(), at, [0, 0, 1], s.terrains[0]); };
  return { s, ship };
}

test('SHIP-COLOURS the flags flown over the real runtime: a boat of mine with colours in the ledger flies them from her FlagObject (her masthead) down its forward, her hull\'s size, her number\'s phase - the guild\'s arms where the flag is the guild\'s - and says them to the room; her pennant\'s cubes left out; a boat with none, a peer\'s with none, and every boat while the cloth is not drawn fly their pennants; a peer\'s flag flown (mutants: the ledger unread, the arms unread, the masthead, the shown gate, the pennant kept)', () => {
  const { s, ship } = world();
  const a = ship(11, 2), b = ship(12, 4, [300, 34, 200]);
  assert.ok(a && b && a.FlagObject, 'her masthead');
  setShipColours(11, fitFlag({ shape: 'swallowtail', field: 'crimson', guild: true }));
  let arms = null, shown = true;
  const peer = { hull: 1, uid: 0, FlagObject: { position: [5, 6, 7], forward: [0, 0, -1] }, GameObject: { activeSelf: true } };
  const peerFlag = fitFlag({ field: 'teal' });
  const host = createShipFlagHost({ myBoats: () => s.rt.AllBoats, coloursOf: (uid) => fleetShip(uid)?.colours ?? null, guildArms: () => arms, peerFlags: () => [{ boat: peer, flag: peerFlag }, { boat: { hull: 2 }, flag: null }], shown: () => shown });
  host.frame();
  const list = host.draws();
  assert.equal(list.length, 2, 'mine with colours, and the peer\'s');
  const mine = list[0];
  assert.equal(mine.flag.field, 'crimson', 'her own colours - her guild has no arms');
  assert.deepEqual(mine.top, a.FlagObject.position);
  assert.deepEqual(mine.fly, flyOf(a.FlagObject.forward));
  assert.deepEqual(mine.size, [...FLAG_SIZES[2]]);
  assert.equal(mine.phase, flagPhaseOf(11));
  assert.equal(host.flies(a), true);
  assert.equal(host.flies(b), false, 'none set: her pennant');
  assert.equal(host.flies(peer), true);
  assert.equal(host.wireFlag(a).field, 'crimson');
  assert.equal(host.wireFlag(b), null);
  arms = ARMS;
  host.frame();
  assert.equal(host.draws()[0].flag.field, 'sable', 'her guild\'s arms now it has them');
  assert.equal(host.draws()[0].flag.shape, 'swallowtail', 'in her flag\'s shape');
  assert.equal(host.wireFlag(a).device, 'wolf');
  shown = false;
  host.frame();
  assert.equal(host.draws().length, 0);
  assert.equal(host.flies(a), false, 'no cloth drawn: her pennant flies');
  assert.ok(flagPhaseOf(11) !== flagPhaseOf(12) && flagPhaseOf(11) >= 0 && flagPhaseOf(11) < Math.PI * 2);
});

test('SHIP-COLOURS the ledger: her colours set through the door (a flag the door refuses never), struck to none, saved with her and read back as they may be (mutants: the door skipped, the save dropped, the restore unread)', () => {
  _resetFleetForTests();
  knowShip(21, 2, 0, 100);
  assert.equal(fleetShip(21).colours, null, 'a new ship flies her pennant');
  assert.equal(setShipColours(21, { field: 'plaid' }), false);
  assert.equal(fleetShip(21).colours, null);
  assert.equal(setShipColours(21, fitFlag({ field: 'vert' })), true);
  assert.equal(fleetShip(21).colours.field, 'vert');
  assert.equal(setShipColours(99, fitFlag({})), false, 'no such ship');
  const save = fleetSaveData();
  assert.equal(save.ships[0].colours.field, 'vert');
  _resetFleetForTests();
  restoreFleetSaveData(save);
  assert.equal(fleetShip(21).colours.field, 'vert');
  restoreFleetSaveData({ ...save, ships: [{ ...save.ships[0], colours: { field: 'plaid' } }] });
  assert.equal(fleetShip(21).colours, null, 'a flag the door refuses: her pennant');
  setShipColours(21, null);
  assert.equal('colours' in fleetSaveData().ships[0], false, 'none: nothing said');
});

test('SHIP-COLOURS the Fleet: a Colours act on every hull with a masthead - hoisted, struck, a Rowboat\'s refused and a flag the door refuses refused - and its word said again; the page\'s Colours panel: her flag drawn as she will fly it, its choices each put right, Fly my guild\'s arms only with arms, Hoist and Strike through the act (mutants: the act unwired, the word unsaid, the panel\'s hoist, the guild\'s gate)', () => {
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const { s, ship } = world();
  let changed = 0, arms = null;
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 200] }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0],
    changed: () => { changed++; }, openHold: () => true, guildArms: () => arms,
  });
  ship(31, 2); knowShip(32, 0, 0, 1); titleDeed(mintDeed(0, 0, 32, 1));
  const m = host.model();
  assert.deepEqual(m.ships.map((r) => [r.uid, r.flag, r.colours]).sort(), [[31, true, null], [32, false, null]]);
  assert.equal(m.guildArms, null);
  assert.deepEqual([host.act(32, 'colours', fitFlag({})).ok, host.act(32, 'colours', fitFlag({})).text], [false, 'This ship has no masthead for a flag.']);
  assert.equal(host.act(31, 'colours', { field: 'plaid' }).ok, false);
  const r = host.act(31, 'colours', fitFlag({ field: 'vert' }));
  assert.deepEqual([r.ok, r.text], [true, 'New flag raised.']);
  assert.equal(changed, 1, 'her word said again');
  assert.equal(fleetShip(31).colours.field, 'vert');
  // the page
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, title: '', className: cls ?? '', innerHTML: '', style: { setProperty() {} }, _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join(''), set: (v) => { n._t = String(v); } });
    return n;
  };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  const press = (root, label) => all(root, (c) => c.tag === 'button' && c.textContent === label);
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div', 'px-qdetail'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div') }); return d; };
  let d = draw();
  assert.equal(press(d, 'Colours').length, 1, 'the Small Ship\'s card alone');
  press(d, 'Colours')[0].onclick();
  d = draw();
  const pic = all(d, (c) => c.className === 'hld-flag')[0];
  assert.ok(pic.innerHTML.includes('fill="#2f8f4e"'), 'her flag as she flies it, Vert');
  const guild = press(d, 'Fly my guild\'s arms')[0];
  assert.equal(guild.attrs['aria-disabled'], 'true', 'no arms: no guild\'s');
  // a swatch chosen: the field Crimson - the border and the device kept, put right
  const crimson = all(d, (c) => c.attrs?.['aria-label'] === 'Crimson' && c.className.startsWith('hld-swatch'))[0];
  crimson.onclick();
  d = draw();
  assert.ok(all(d, (c) => c.className === 'hld-flag')[0].innerHTML.includes('fill="#b3262e"'));
  press(d, 'Raise flag')[0].onclick();
  assert.equal(fleetShip(31).colours.field, 'crimson');
  // the guild's arms, once the guild has them
  arms = ARMS;
  resetFleetPage();
  d = draw();
  press(d, 'Colours')[0].onclick();
  d = draw();
  const g = press(d, 'Fly my guild\'s arms')[0];
  assert.equal(g.attrs['aria-disabled'], undefined);
  g.onclick();
  d = draw();
  assert.ok(all(d, (c) => c.className === 'hld-flag')[0].innerHTML.includes('fill="#1d1d1d"'), 'her guild\'s Sable field');
  assert.equal(press(d, 'Flying your guild\'s arms').length, 1);
  press(d, 'Raise flag')[0].onclick();
  assert.equal(fleetShip(31).colours.guild, true);
  resetFleetPage();
  d = draw();
  press(d, 'Colours')[0].onclick();
  d = draw();
  press(d, 'Remove flag')[0].onclick();
  assert.equal(fleetShip(31).colours, null, 'struck: her pennant');
  setHoldingsProvider(null);
});

test('SHIP-COLOURS the room\'s word: `f` a flag\'s seven numbers for each boat (0 her pennant), said only while one flies a flag; read through the flag\'s door - a code it refuses her pennant, never the boats dropped; a new flag a new word (mutants: `f` always said, the reader\'s door, the record dropped, the key blind)', () => {
  const v = (flag) => ({ hull: 2, variant: 0, position: [1, 2, 3], rotation: [0, 0, 0, 1], sails: 1, helm: false, light: false, uid: 5, flag });
  const plain = csaWireRecord([v(null)]);
  assert.equal('f' in plain, false, 'no flag: the older word');
  const flown = fitFlag({ shape: 'pennant', field: 'teal', device: 'ship' });
  const rec = csaWireRecord([v(flown), { ...v(null), uid: 6 }]);
  assert.deepEqual(rec.f, [flagCode(flown), 0]);
  const back = validCsaRecord(rec);
  assert.equal(back.boats[0].flag.field, 'teal');
  assert.equal(back.boats[1].flag, undefined);
  const bad = validCsaRecord({ ...rec, f: [[99, 0, 0, -1, -1, -1, -1], 0] });
  assert.equal(bad.boats.length, 2, 'never dropped for her flag');
  assert.equal(bad.boats[0].flag, undefined);
  assert.equal(validCsaRecord({ ...rec, f: 'x' }).boats.length, 2);
  assert.notEqual(csaRecordKey(rec), csaRecordKey(csaWireRecord([v(fitFlag({ field: 'gold' })), { ...v(null), uid: 6 }])), 'a new flag, a new word');
  assert.notEqual(csaRecordKey(rec), csaRecordKey(csaWireRecord([v(null), { ...v(null), uid: 6 }])));
});

test('SHIP-COLOURS the world: one renderer built in every skin (a shader that fails costs the flags), the host over my boats, the ledger, my guild\'s arms and the peers\' flags, shown in the exterior\'s pass alone; its frame each frame; the pennant left out where the cloth flies; the flags drawn after the banners on their light and wind; my word saying them; the Fleet handed my guild\'s arms; the peers\' reading (mutants: each seam)', () => {
  assert.match(WORLD, /const shipFlagPass = \(\(\) => \{\n\s+try \{\n\s+return new ShipFlagRenderer\(renderer\.gl, \{/);
  assert.match(WORLD, /const shipFlags = createShipFlagHost\(\{\n\s+myBoats: \(\) => \(shipFlagPass && csaRuntime && csaOn\(\) \? csaRuntime\.AllBoats : \[\]\),\n\s+coloursOf: \(uid\) => fleetShip\(uid\)\?\.colours \?\? null,\n\s+guildArms: \(\) => guildBook\?\.guild\?\.heraldry \?\? null,\n\s+peerFlags: \(\) => \(shipFlagPass \? csaPeers\?\.flagged\?\.\(\) \?\? \[\] : \[\]\),\n\s+seaFlags: \(\) => \(shipFlagPass && navalOn\(\) \? naval\?\.seaFlags\?\.\(\) \?\? \[\] : \[\]\),[^\n]*\n\s+shown: \(\) => !!shipFlagPass && _mode\(\) === 'exterior',/);   // PIN MOVED (SEA-COLOURS: the sea's flags)
  assert.match(WORLD, /shipFlags\.frame\(\);/);
  assert.match(WORLD, /if \(list === lists\.flags && shipFlags\.flies\(boat\)\) continue;/);
  assert.match(WORLD, /const frameShipFlags = \(\) => \{   \/\/ PERF-V8\n[^\n]*\n[^\n]*\n\s+if \(shipFlagPass && shipFlagPass\.draw\(shipFlags\.draws\(\), proj, view, new Float32Array\(mwv\.eye\), now \/ 1000, \{   \/\/ none to draw: its idle textures pruned, no pass/);   // PIN MOVED (PERF-V8: a closure of its own)
  assert.ok(WORLD.indexOf('    frameBanners();') < WORLD.indexOf('    const frameShipFlags = '), 'after the banners');
  assert.match(WORLD, /flag: shipFlags\.wireFlag\(b\),/);
  assert.match(WORLD, /if \(shipFlagPass && shipFlagPass\.draw\([^\n]*\n[^\n]*\n\s+wind: Math\.min\(1, wd\.strength01 \* wd\.gust\),/, 'the weather\'s own wind, as the banners\'');
  assert.match(WORLD, /guildArms: \(\) => guildBook\?\.guild\?\.heraldry \?\? null,   \/\/ SHIP-COLOURS: "fly my guild's arms"/);
  const peers = rd('src/scenes/comeSailAway/comeSailAwayPeers.js');
  assert.match(peers, /for \(let i = 0; i < list\.length; i\+\+\) if \(list\[i\]\?\.boat && words\[i\]\?\.flag\) out\.push\(\{ boat: list\[i\]\.boat, flag: words\[i\]\.flag \}\);/);
});
