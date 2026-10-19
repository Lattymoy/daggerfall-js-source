// PASSAGE (2026-10-19; bible/03-World/Passage.md) - THE VOYAGE'S HOST HALF (scenes/naval/passageHost.js), over stand-in
// doors: the booking (her master's ports, the question, all of it or none of it) and the passage's life (sailed on when
// a voyage stops, over when I step off her - her hold ashore, her boat gone, her record forgotten). AUDIT PASSAGE (lane A):
// the stand-in runtime moves her hold as Come Sail Away's LayUpBoat does (under her number) and refuses while a player
// stands aboard her, as the real one does - the first stand-in did neither, and the order it hid was wrong.

import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPassageHost, hullReach } from '../../../src/scenes/naval/passageHost.js';
import { ListPickerWindow } from '../../../src/ui/listPicker.js';
import { YesNoBoxWindow } from '../../../src/ui/yesNoBox.js';
import { PASSAGE_TEXT, PASSAGE_LEAVE_M, PASSAGE_OFF_S, PASSAGE_FIRST_S, PASSAGE_RESUME_S, PASSAGE_RESUMES, PASSAGE_SLOW, passageFare } from '../../../src/systems/naval/passage.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const PORTS = [
  { key: '100,100', name: 'Daggerfall', px: 100, py: 100 },
  { key: '130,100', name: 'Sentinel', px: 130, py: 100 },
  { key: '100,60', name: 'Wayrest', px: 100, py: 60 },
];
const SHIP = { id: 'local:3', name: 'The Fair Silk', captain: 'Ana Rhea', hull: 2, faction: 'merchant' };

/** A world of stand-ins: Come Sail Away's runtime (its boats, its helm, its laying up), the sea's charter, the journey,
 *  the purse and the pack. `o` changes a door. */
function world(o = {}) {
  const log = { say: [], shown: [], spawned: [], paid: [], forgot: [], routed: [], sailed: [], laid: [], remount: [], stopped: 0 };
  const w = { gold: o.gold ?? 200, feet: [0, 0, 0], live: false, onDeck: false, pack: [], log, canGo: o.canGo ?? true, ride: o.ride ?? 'foot' };
  const rt = {
    AllBoats: [], state: { CurrentBoat: null }, sailing: false, passengers: 0, held: new Map(),
    isSailing() { return this.sailing; },
    StartSailing(b) { if (o.helmThrows) throw new Error('no helm'); this.sailing = true; this.state.CurrentBoat = b; w.feet = [...b.GameObject.position]; w.ride = 'foot'; },
    StopSailing() { this.sailing = false; this.state.CurrentBoat = null; },
    // Come Sail Away's LayUpBoat: refused at the helm or with a player aboard; her hold moved under her number; gone
    LayUpBoat(b) {
      if (b === this.state.CurrentBoat || this.passengers > 0) return false;
      log.laid.push(b.uid);
      this.held.set(b.uid, [...(this.held.get(b.uid) ?? []), ...b.Cargo.Items.splice(0)]);
      this.AllBoats.splice(this.AllBoats.indexOf(b), 1);
      return true;
    },
    laidUpHold(uid) { if (!this.held.has(uid)) this.held.set(uid, []); return this.held.get(uid); },
    forgetHold(uid) { log.forgot.push(['hold', uid]); if (this.held.get(uid)?.length) return false; return this.held.delete(uid); },
  };
  w.rt = rt;
  const naval = {
    boatInPlay: () => w.inPlay ?? null,
    forgetBoat: (uid) => log.forgot.push(['boat', uid]),
    charter(id, record) {
      if (o.gone) return null;
      const boat = { uid: 9001, hull: SHIP.hull, charter: record, GameObject: { position: [50, 0, 0] }, Cargo: { Items: [] } };
      rt.AllBoats.push(boat);
      return boat;
    },
    charterSailed(id) { log.sailed.push(id); return true; },
  };
  w.host = createPassageHost({
    naval: () => naval, csa: () => (o.csaOff ? null : rt),
    ports: () => o.ports ?? PORTS, here: () => PORTS[0], pixel: () => ({ x: 100, y: 100 }), ether: (p) => !!o.ether && p.x === 100,
    place: (p) => (p.name === 'Wayrest' && !o.knowsWayrest ? null : { name: p.name, pixel: { x: p.px, y: p.py } }),
    canGo: () => w.canGo,
    travel: () => ({ get isTravelActive() { return w.live; }, clearTravelDestination() { log.stopped++; w.live = false; } }),
    route: (s, { voyage, noWay } = {}) => { assert.equal(voyage, true, 'asked as a voyage'); log.routed.push(s.name); if (o.route === 'noway' || w.noWay) { noWay?.(); return false; } if (o.route === false) return false; w.live = true; w.to = s.pixel; if (o.routeThrows) throw new Error('the route threw'); return true; },
    journeyTo: () => (w.live ? w.to ?? null : null), busy: () => !!w.busy,
    remount: (m) => { log.remount.push(m); w.ride = m; }, standsOn: () => w.onDeck,
    player: { get transportMode() { return w.ride; }, feetAt: () => w.feet, spawn: (x, y, z) => { log.spawned.push([x, y, z]); w.feet = [x, y, z]; } },
    gold: () => w.gold, pay: (n) => { log.paid.push(n); w.gold -= n; }, pack: () => w.pack,
    talk: { say: (t) => log.say.push(t), showOverlay: (win) => log.shown.push(win) },
  });
  return w;
}
/** Her master's list up, a row picked, and the question answered. */
function bookTo(w, name, yes = true) {
  assert.equal(w.host.offer(SHIP), true, 'the list goes up');
  const list = w.log.shown.at(-1);
  assert.ok(list instanceof ListPickerWindow);
  const i = list.items.findIndex((r) => r.startsWith(name));
  assert.ok(i >= 0, `${name} listed`);
  list._pick(i);
  const box = w.log.shown.at(-1);
  assert.ok(box instanceof YesNoBoxWindow, 'then the question');
  box.answer(yes);
  return box;
}

test('PASSAGE host: her master\'s ports - every port I know but this one, nearest first with its fare; the question names the fare beside the purse; Yes makes the passage - her boat, the helm, the voyage begun, then her ship let go and the fare paid (mutants: paid before the voyage began; her ship never let go; the unknown port listed)', () => {
  const w = world();
  w.host.offer(SHIP);
  const list = w.log.shown[0];
  assert.deepEqual(list.items, [`Sentinel - east, ${passageFare({ x: 100, y: 100 }, { x: 130, y: 100 })} gold`], 'never Daggerfall (I stand at it), never Wayrest (never discovered)');
  list._pick(0);
  const box = w.log.shown[1];
  assert.deepEqual(box.rows, PASSAGE_TEXT.ask(SHIP.name, 'Sentinel', 50, 200));
  assert.deepEqual(w.log.paid, [], 'nothing paid until Yes');
  box.answer(true);
  const boat = w.rt.AllBoats[0];
  assert.ok(boat, 'her boat stands');
  assert.deepEqual(boat.charter, { to: { name: 'Sentinel', px: 130, py: 100 }, ship: SHIP.name, captain: SHIP.captain, fare: 50 }, 'the voyage written on her');
  assert.equal(w.rt.state.CurrentBoat, boat, 'at her helm');
  assert.deepEqual(w.log.routed, ['Sentinel'], 'the voyage begun');
  assert.deepEqual(w.log.sailed, [SHIP.id], 'her ship let go');
  assert.deepEqual(w.log.paid, [50]);
  assert.equal(w.log.say.at(-1), PASSAGE_TEXT.booked(SHIP.name, SHIP.captain, 50, 'Sentinel'));
  assert.equal(w.host.charterBoat(), boat);
  assert.equal(w.host.offer(SHIP), false, 'one passage at a time');
  assert.equal(w.log.say.at(-1), PASSAGE_TEXT.booking);
  // a second question answered after the first booked (two lists opened before either was answered): refused at Yes
  const v = world();
  v.host.offer(SHIP); v.log.shown[0]._pick(0);
  v.host.offer(SHIP); v.log.shown[2]._pick(0);
  v.log.shown[1].answer(true);
  v.log.shown[3].answer(true);
  assert.deepEqual([v.rt.AllBoats.length, v.log.paid], [1, [50]], 'one boat, one fare');
  assert.equal(v.log.say.at(-1), PASSAGE_TEXT.booking);
});

test('PASSAGE host: ALL OF IT OR NONE OF IT - a voyage refused (the route will not go, no way by sea, the route throwing, a foe near, the helm will not take) puts everything back: her boat gone, the player where they stood and riding as they rode, no journey left, nothing paid, her ship at her berth; a purse short and her ship gone ask nothing (mutants: the refusal leaves her boat; the fare taken on a refusal; the player left at her helm; the rider left on foot; the thrown route\'s journey left; no way unsaid)', () => {
  for (const o of [{ route: false }, { route: 'noway' }, { routeThrows: true }, { canGo: false }, { helmThrows: true }]) {
    const w = world({ ...o, knowsWayrest: true, ride: 'horse' });
    w.feet = [3, 1, 4];
    const warn = console.warn; console.warn = () => {};
    try { bookTo(w, 'Wayrest'); } finally { console.warn = warn; }
    assert.deepEqual(w.rt.AllBoats, [], `${JSON.stringify(o)}: no boat left`);
    assert.deepEqual(w.log.paid, [], 'nothing paid');
    assert.deepEqual(w.log.sailed, [], 'her ship at her berth');
    assert.equal(w.rt.isSailing(), false, 'no helm held');
    assert.deepEqual(w.feet, [3, 1, 4], 'set back where I stood');
    assert.equal(w.ride, 'horse', 'riding as I rode (AUDIT PASSAGE A7: the helm puts a rider on foot)');
    if (o.helmThrows) assert.equal(w.log.say.at(-1), PASSAGE_TEXT.failed);
    if (o.route === 'noway') assert.equal(w.log.say.at(-1), PASSAGE_TEXT.noWay, 'no way by sea, said');
    if (o.routeThrows) assert.deepEqual([w.log.stopped, w.live], [1, false], 'the journey the route began is ended (AUDIT PASSAGE A7)');
  }
  const poor = world({ gold: 49 });
  bookTo(poor, 'Sentinel');
  assert.equal(poor.log.say.at(-1), PASSAGE_TEXT.poor(50));
  assert.deepEqual([poor.rt.AllBoats.length, poor.log.paid.length], [0, 0]);
  const gone = world({ gone: true });
  bookTo(gone, 'Sentinel');
  assert.equal(gone.log.say.at(-1), PASSAGE_TEXT.gone);
  assert.deepEqual(gone.log.paid, []);
});

test('PASSAGE host: no list where none can sail - Come Sail Away off, past the Veil, no port known (mutants: a list with the mod off)', () => {
  const off = world({ csaOff: true });
  assert.equal(off.host.offer(SHIP), false);
  assert.deepEqual([off.log.shown.length, off.log.say.at(-1)], [0, PASSAGE_TEXT.noSail]);
  const veil = world({ ether: true });
  assert.equal(veil.host.offer(SHIP), false);
  assert.equal(veil.log.say.at(-1), PASSAGE_TEXT.ether);
  const lone = world({ ports: [PORTS[0], PORTS[2]] });
  assert.equal(lone.host.offer(SHIP), false, 'only the port I stand at, and one never discovered');
  assert.deepEqual([lone.log.shown.length, lone.log.say.at(-1)], [0, PASSAGE_TEXT.none]);
});

test('PASSAGE host: THE PASSAGE\'S LIFE - aboard with no voyage under way, her master sails on (first after PASSAGE_FIRST_S on a host that meets her fresh, then each PASSAGE_RESUME_S) for as long as I stand aboard; PASSAGE_RESUMES tries in a row that find no way and he says so, once, and tries on at PASSAGE_SLOW times the pace; a way found, the count starts again; on her deck away from the helm, the helm is asked for, once; paused or in a world\'s move, nothing moves (mutants: never resumed; given up for good; the stuck word every try; the helm word every try; resumed off the helm; she packs after a load)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  w.live = false;   // a foe stopped the voyage
  w.host.frame(PASSAGE_RESUME_S - 0.5);
  assert.deepEqual(w.log.routed, ['Sentinel'], 'not yet');
  w.host.frame(100, true);
  w.busy = true; w.host.frame(100); w.busy = false;
  assert.deepEqual(w.log.routed, ['Sentinel'], 'paused, or a world\'s move: nothing');
  w.host.frame(1);
  assert.deepEqual(w.log.routed, ['Sentinel', 'Sentinel'], 'sails on');
  for (let i = 0; i < 5; i++) { w.live = false; w.host.frame(PASSAGE_RESUME_S); }
  assert.equal(w.log.routed.length, 7, 'and on, every time it stops - never given up while I stand aboard (AUDIT PASSAGE B3)');
  // no way from here: PASSAGE_RESUMES in a row, said once; then on at the slow pace
  w.live = false; w.noWay = true;
  const before = w.log.routed.length;
  for (let i = 0; i < PASSAGE_RESUMES; i++) w.host.frame(PASSAGE_RESUME_S);
  assert.equal(w.log.routed.length, before + PASSAGE_RESUMES);
  assert.equal(w.log.say.filter((t) => t === PASSAGE_TEXT.stuck('Sentinel')).length, 1, 'said once');
  w.host.frame(PASSAGE_RESUME_S);
  assert.equal(w.log.routed.length, before + PASSAGE_RESUMES, 'the slow pace');
  w.host.frame(PASSAGE_RESUME_S * (PASSAGE_SLOW - 1));
  assert.equal(w.log.routed.length, before + PASSAGE_RESUMES + 1, 'and tried on');
  w.host.frame(PASSAGE_RESUME_S * PASSAGE_SLOW);
  assert.equal(w.log.say.filter((t) => t === PASSAGE_TEXT.stuck('Sentinel')).length, 1, 'never said again in the same run');
  w.noWay = false;
  w.host.frame(PASSAGE_RESUME_S * PASSAGE_SLOW);
  assert.equal(w.live, true, 'a way found');
  w.live = false;
  w.host.frame(PASSAGE_RESUME_S);
  assert.equal(w.log.routed.length, before + PASSAGE_RESUMES + 4, 'the count starts again: the usual pace');
  // a load put me on her deck, off the helm: a fresh host's first try waits PASSAGE_FIRST_S, and asks for the helm, once
  const v = world();
  bookTo(v, 'Sentinel');
  const boat = v.rt.AllBoats[0];
  const loaded = world();
  loaded.rt.AllBoats.push(boat);
  boat.packable = true;   // her hull's own word, as a load stands her
  loaded.onDeck = true;
  loaded.feet = [50, 0, 0];
  loaded.host.frame(PASSAGE_FIRST_S + 0.1);
  assert.equal(boat.packable, false, 'never packed, after a load too');
  assert.deepEqual(loaded.log.routed, [], 'never routed off the helm');
  assert.equal(loaded.log.say.at(-1), PASSAGE_TEXT.helm('Sentinel'));
  loaded.host.frame(PASSAGE_RESUME_S); loaded.host.frame(PASSAGE_RESUME_S);
  assert.equal(loaded.log.say.filter((t) => t === PASSAGE_TEXT.helm('Sentinel')).length, 1, 'asked once');
  loaded.rt.StartSailing(boat);
  loaded.host.frame(PASSAGE_RESUME_S);
  assert.deepEqual(loaded.log.routed, ['Sentinel'], 'at her helm: she sails on');
});

test('AUDIT PASSAGE B3: HER MASTER HOLDS HIS COURSE - a journey begun from her helm to anywhere but her port (another place, a spot on the map) is stopped and said, and he sails on for her port soon after; one for her port goes on (mutants: a journey elsewhere kept; the course word unsaid)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  w.host.frame(1);
  assert.deepEqual([w.log.stopped, w.live], [0, true], 'her own voyage goes on');
  w.to = { x: 100, y: 60 };   // the passenger picks Wayrest on the Overworld from her helm
  w.host.frame(1);
  assert.deepEqual([w.log.stopped, w.live], [1, false], 'stopped');
  assert.equal(w.log.say.at(-1), PASSAGE_TEXT.holds('Sentinel'));
  w.host.frame(PASSAGE_FIRST_S + 0.1);
  assert.deepEqual([w.log.routed.at(-1), w.to], ['Sentinel', { x: 130, y: 100 }], 'and sails on for her port');
  w.to = 'spot';
  w.host.frame(1);
  assert.equal(w.log.stopped, 2, 'a spot on the map too');
});

test('PASSAGE host: STEP OFF HER AND THE PASSAGE ENDS - past PASSAGE_LEAVE_M beyond her HULL\'s reach and not aboard, for PASSAGE_OFF_S together: what was put in her hold comes into the pack, her boat is laid up and her hold and record forgotten, and she stands out to sea; on her forecastle off the ground, within reach or for a moment, she waits (mutants: never ended; her hold lost; ended on the quay beside her; her root\'s measure; no grace; boarding from her off her)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  const boat = w.rt.AllBoats[0];
  const stored = { name: 'Silk', templateIndex: 1 };
  boat.Cargo.Items.push(stored);
  w.rt.StopSailing();   // the landfall: off her helm, ashore beside her
  w.live = false;
  const reach = hullReach(SHIP.hull);
  assert.ok(reach > 20, 'a Small Ship reaches past 20 m from her root');
  w.feet = [50 + reach + PASSAGE_LEAVE_M - 1, 0, 0];   // AUDIT PASSAGE A2: a jump at her bow's end was "off her" by the root
  w.host.frame(5);
  assert.ok(w.rt.AllBoats.includes(boat), 'within her reach: she waits');
  w.inPlay = boat;   // AUDIT PASSAGE B2: on the deck of a ship boarded from her - the boat in play is aboard
  w.feet = [50 + reach + PASSAGE_LEAVE_M + 40, 0, 0];
  w.host.frame(PASSAGE_OFF_S * 3);
  assert.ok(w.rt.AllBoats.includes(boat), 'boarding from her: she waits');
  w.inPlay = null;
  w.feet = [50 + reach + PASSAGE_LEAVE_M + 1, 0, 0];
  w.host.frame(PASSAGE_OFF_S / 2);
  assert.ok(w.rt.AllBoats.includes(boat), 'a moment off her: she waits');
  w.feet = [50, 0, 0];
  w.host.frame(PASSAGE_OFF_S / 2);   // back beside her - the grace begins again
  w.feet = [50 + reach + PASSAGE_LEAVE_M + 1, 0, 0];
  w.host.frame(PASSAGE_OFF_S * 0.75);
  assert.ok(w.rt.AllBoats.includes(boat), 'the grace counts together, never in pieces');
  w.host.frame(PASSAGE_OFF_S * 0.5);
  assert.deepEqual(w.rt.AllBoats, [], 'her boat gone');
  assert.deepEqual(w.log.laid, [9001]);
  assert.ok(w.pack.includes(stored), 'her hold ashore');
  assert.deepEqual(w.log.forgot, [['hold', 9001], ['boat', 9001]]);
  assert.ok(w.log.say.includes(PASSAGE_TEXT.goods));
  assert.equal(w.log.say.at(-1), PASSAGE_TEXT.ended(SHIP.name));
  assert.equal(w.host.charterBoat(), null);
});

test('PASSAGE host: ANOTHER PLAYER ABOARD HOLDS THE END - Come Sail Away refuses to lay her up, nothing moves (her hold stays in her, nothing is said); the moment they are off her she goes, her hold carried ashore and said (mutants: the hold moved before the laying up; the goods unsaid)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  const boat = w.rt.AllBoats[0];
  const stored = { name: 'Silk', templateIndex: 1 };
  boat.Cargo.Items.push(stored);
  w.rt.StopSailing(); w.live = false;
  w.rt.passengers = 1;
  w.feet = [500, 0, 0];
  w.host.frame(PASSAGE_OFF_S + 1);
  w.host.frame(PASSAGE_OFF_S + 1);
  assert.ok(w.rt.AllBoats.includes(boat), 'she waits for them');
  assert.deepEqual([w.pack.length, boat.Cargo.Items.length], [0, 1], 'her hold where it was (AUDIT PASSAGE A5)');
  assert.ok(!w.log.say.includes(PASSAGE_TEXT.goods));
  w.rt.passengers = 0;
  w.host.frame(PASSAGE_OFF_S + 1);
  assert.deepEqual(w.rt.AllBoats, [], 'gone');
  assert.ok(w.pack.includes(stored), 'her hold ashore');
  assert.equal(w.log.say.filter((t) => t === PASSAGE_TEXT.goods).length, 1, 'and said, once');
  assert.equal(w.rt.held.has(9001), false, 'her number\'s hold let go');
});

test('PASSAGE host: A FOE NEAR SPENDS NO TRY - while the journey\'s gate refuses, her master waits it out at the usual pace without counting a try; the moment it clears she sails on (mutants: a try spent on a refusal; the gate dropped)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  w.live = false;
  w.canGo = false;   // a raider's fight: 61 s and more of it
  for (let t = 0; t < 4; t++) w.host.frame(PASSAGE_RESUME_S);
  assert.deepEqual(w.log.routed, ['Sentinel'], 'never asked while refused (AUDIT PASSAGE A3)');
  w.canGo = true;
  w.host.frame(PASSAGE_RESUME_S);
  assert.deepEqual(w.log.routed, ['Sentinel', 'Sentinel'], 'sails on when it clears');
  assert.ok(!w.log.say.includes(PASSAGE_TEXT.stuck('Sentinel')), 'no run of failures counted against her');
});

test('PASSAGE host: HER MASTER\'S CLOCK IS HER BOAT\'S - a load that stands another booked boat finds him fresh (the first try after PASSAGE_FIRST_S, his words unsaid), whatever the last voyage spent; a record that reads as nothing sails nowhere and ends only when I am off her (mutants: the clock the host\'s; a bad record laid up under me)', () => {
  const w = world();
  bookTo(w, 'Sentinel');
  w.live = false;
  w.live = false; w.noWay = true;
  for (let i = 0; i < PASSAGE_RESUMES; i++) w.host.frame(PASSAGE_RESUME_S);
  assert.ok(w.log.say.includes(PASSAGE_TEXT.stuck('Sentinel')), 'the last voyage at the slow pace');
  w.noWay = false;
  const tried = w.log.routed.length;
  // a load: her boat stood again as another object, at her helm
  const old = w.rt.AllBoats[0];
  w.rt.StopSailing();
  w.rt.AllBoats.length = 0;
  const loaded = { ...old, GameObject: { position: [60, 0, 0] }, Cargo: { Items: [] } };
  w.rt.AllBoats.push(loaded);
  w.rt.StartSailing(loaded);
  w.live = false;
  w.host.frame(PASSAGE_FIRST_S + 0.1);
  assert.equal(w.log.routed.length, tried + 1, 'he sails on after a load (AUDIT PASSAGE A4)');
  // a record that reads as nothing: never sailed, never laid up under me; off her, over
  const b = world();
  const bad = { uid: 7, hull: 2, charter: { to: {} }, GameObject: { position: [0, 0, 0] }, Cargo: { Items: [] } };
  b.rt.AllBoats.push(bad);
  b.onDeck = true;
  b.host.frame(PASSAGE_FIRST_S + PASSAGE_RESUME_S);
  assert.deepEqual([b.rt.AllBoats.length, b.log.routed.length], [1, 0], 'aboard: she stands, and sails nowhere (AUDIT PASSAGE A6)');
  b.onDeck = false; b.feet = [500, 0, 0];
  b.host.frame(PASSAGE_OFF_S + 0.1);
  assert.deepEqual(b.rt.AllBoats, [], 'off her: over');
});

test('PASSAGE host wiring: the world host builds it once and calls it - the berth\'s ship\'s Activate, its frame whatever the sea fight\'s switch, the Overworld\'s crossing as the voyage; a booked ship is never boarded as mine moored, never said left moored, never packed, never the Fleet\'s, and saved with her voyage (mutants: each door unwired)', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /^import \{ createPassageHost \} from '\.\/naval\/passageHost\.js';/m);
  assert.match(world, /\n {4}passage: \(ship\) => passage\?\.offer\(ship\),/, 'the sea\'s door to it');
  assert.match(world, /const passage = createPassageHost\(\{[^]*?canGo: travelViewCanGo, route: travelViewRouteTo, travel: \(\) => travelOptions,/, 'the Overworld\'s journey is the voyage - a voyage\'s');
  assert.match(world, /return tvSeaCrosses\(tvSeaRig\(b\)\) \? \{ start: 'sea', again: !!b\.packable, boat: b, how: 'helm', voyage: !!b\.charter \} : null;/, 'her helm asks the planner for a voyage (AUDIT PASSAGE A1)');
  assert.match(world, /if \(voyage && !plan\?\.kinds\.includes\('sea'\)\) \{ noWay\?\.\(\); return false; \}/, 'a plan that never sails refused');
  assert.match(world, /const tvSeaAsk = \(means, goal\) => \(means \? \{ \.\.\.means, again: means\.again && !means\.voyage, goal \} : null\);/, 'and never packed to launch again');
  assert.match(world, /standsOn: csaStandsOn, busy: worldMoveBusy, player, remount: setTransportModeHere, talk: townTalk \}\);/, 'the rider remounted on a refusal, her deck underfoot, a world\'s move');
  assert.match(world, /\n {4}passage\.frame\(dt, gamePaused\(\) \|\| _loading\);[^\n]*\n {4}const on = navalOn\(\);/, 'its frame, before the switch returns');
  assert.match(world, /if \(!b\.GameObject\?\.activeSelf \|\| b\.inside \|\| b\.charter \|\| !tvSeaCrosses\(tvSeaRig\(b\)\)\) continue;/, 'never boarded as mine moored');
  assert.match(world, /if \(!boat\.charter\) tvSay\(TRAVEL_VIEW_TEXT\.leftMoored\);/, 'never said left moored');
  const csa = read('src/systems/comeSailAway/comeSailAway.js');
  assert.match(csa, /\.\.\.\(b\.charter \? \{ Charter: JSON\.parse\(JSON\.stringify\(b\.charter\)\) \} : \{\}\),/, 'saved with her');
  assert.match(csa, /if \(placedBoat\.Charter && typeof placedBoat\.Charter === 'object'\) boat\.charter = placedBoat\.Charter;/, 'and read back');
  assert.match(csa, /function PackBoat\(boat, item = false, lost = false\) \{\n {4}if \(item && boat\?\.charter\) return false;/, 'never parts in my pack');
  assert.match(read('src/scenes/fleetHost.js'), /const placed = \(\) => \(csa\(\)\?\.AllBoats \?\? \[\]\)\.filter\(\(b\) => b\?\.uid && !b\.charter\);/, 'never the Fleet\'s');
});
