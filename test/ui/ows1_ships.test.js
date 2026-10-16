// OWS1 (2026-09-28, the player's ask: "being able to see other players sailing in the overworld") - THE SHIPS ON THE
// MAP. A traveller at a helm, or aboard a boat (CSA-K), sends the region the mark's way the TV3 frame always carried and
// nothing sent - `ship`, TRAV_MODES' fourth - headed as the boat's bow; the Overworld draws a mark whose way is the sea
// as a ship (a hull under a sail, where the dot stood), riding the sea's top, and the held map inks it so.
//
// Pinned here: the law (systems/travellerMarks.js TRAV_SHIP and isShipMark, the relay's own shape law taking it, the
// cadence sending a changed way at once), the readout (ui/travel/travelViewHud.js: the ship drawn for the kind, the dot for
// the rest, a name over a ship standing over its sail), the held map (ui/partyMapMarks.js's `ship`, its key, and
// ui/ink/inkMap.js's ink), and the world host's wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validTravellerMark, TRAV_MODES } from '../../src/net/wire.js';
import { travellerMarkOf, travellerDue, TRAV_SHIP, isShipMark } from '../../src/systems/travellerMarks.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';
import { readTravellerMarks, travellerMarksKey, TRAVELLER_MARK_CSS } from '../../src/ui/partyMapMarks.js';
import { paintInkOverlay } from '../../src/ui/ink/inkMap.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** A document just real enough for the readout (tv5's own shape, trimmed): elements, and a canvas whose 2D context
 *  records each call with its arguments. */
function fakeDoc() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => { calls.push([k, ...a]); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const win = { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc,
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true,
      width: 0, height: 0, getBoundingClientRect() { return { width: 0, height: 0 }; },
    };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, querySelectorAll: () => [], head: mk('head'), body: mk('body') });
  return { doc, calls };
}

test('OWS1 law: the mark\'s way at sea is TRAV_MODES\' ship - the mark of a traveller at a helm carries it, the relay\'s shape law takes it, and a changed way is sent at once', () => {
  assert.equal(TRAV_SHIP, TRAV_MODES.indexOf('ship'));
  assert.equal(TRAV_SHIP, 3, 'the frame\'s fourth way, unchanged on the wire (no relay version)');
  const at = travellerMarkOf({ x: 207 * 32768 + 100, z: 286 * 32768 + 900, yaw: 1.2, mode: TRANSPORT_MODES.Ship });
  assert.equal(at.m, TRAV_SHIP);
  assert.equal(isShipMark(at), true);
  assert.ok(validTravellerMark(at), 'the relay\'s own law takes a ship');
  const ashore = travellerMarkOf({ x: 207 * 32768 + 100, z: 286 * 32768 + 900, yaw: 1.2, mode: TRANSPORT_MODES.Foot });
  assert.equal(isShipMark(ashore), false);
  assert.equal(isShipMark(null), false);
  assert.equal(isShipMark({ m: TRAV_SHIP - 1 }), false, 'a cart is no ship');
  assert.equal(travellerDue({ last: ashore, at: 1000 }, { now: 1001, mark: at, alone: false, shown: true }), 'send', 'putting to sea is said at once, not at the keepalive');
});

test('OWS1 readout: a mark whose kind says ship is drawn as a hull under a sail - no dot - and the dot stays everyone else\'s; a name over a ship stands over its sail', async () => {
  const hud = await import('../../src/ui/travel/travelViewHud.js');
  assert.equal(hud.isShipKind({ kind: 'traveller ship journey' }), true);
  assert.equal(hud.isShipKind({ kind: 'party ship' }), true);
  assert.equal(hud.isShipKind({ kind: 'traveller journey' }), false);
  assert.equal(hud.isShipKind({ kind: 'place' }), false);
  assert.equal(hud.isShipKind({ kind: 'traveller shipwright' }), false, 'the word, not a part of one');
  const drawn = (kind, badge = undefined) => {
    const { doc, calls } = fakeDoc();
    hud.showTravelViewHud({}, doc);
    try {
      hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [{ key: 'trav:a', x: 400, y: 300, front: true, label: 'Bran', kind, badge }] });
      return calls;
    } finally { hud.disposeTravelViewHud(); }
  };
  const ship = drawn('traveller ship');
  const dot = drawn('traveller');
  assert.equal(ship.filter((c) => c[0] === 'arc').length, 0, 'no dot under a ship');
  assert.equal(dot.filter((c) => c[0] === 'arc').length, 1, 'a traveller ashore keeps the dot');
  const moves = ship.filter((c) => c[0] === 'moveTo').map((c) => [c[1], c[2]]);
  assert.deepEqual(moves, [[393, 301], [399, 300 - hud.SHIP_MARK_RISE]], 'the hull, then the sail off the mast');
  assert.equal(ship.filter((c) => c[0] === 'lineTo').length, 5);
  assert.equal(ship.filter((c) => c[0] === 'fill').length, 2, 'both filled in the look\'s colour');
  // a player's badge worn over the mark: over a ship it stands clear of the sail's top
  const badge = { title: null, glyphs: [], lv: null, gt: null };
  const foot = (calls) => { const d = calls.filter((c) => c[0] === 'drawImage').at(-1); return d[3] + d[5]; };   // [name, image, x, y, w, h]: the sprite's foot
  assert.equal(foot(drawn('traveller', badge)), 300 - 8, 'ashore: the name\'s foot 8 px over the dot');
  assert.equal(foot(drawn('traveller ship', badge)), 300 - hud.SHIP_MARK_RISE - 2, 'at sea: over the sail, with air');
});

test('OWS1 held map: a row the host says is at sea is a ship mark (only `true` counts), keyed so putting to sea draws it again; inked as a hull under a sail where the ring stood', () => {
  const row = { id: 'peer-0002', name: 'Bran', px: 207, py: 213, fx: 12, fy: 250, h: 64, m: TRAV_SHIP, tv: 0 };
  const [sea] = readTravellerMarks(() => [{ ...row, ship: true }]);
  const [land] = readTravellerMarks(() => [{ ...row, ship: false }]);
  assert.equal(sea.ship, true);
  assert.equal(land.ship, false);
  assert.equal(readTravellerMarks(() => [{ ...row, ship: 1 }])[0].ship, false, 'the host\'s word, not a truthy one');
  assert.notEqual(travellerMarksKey([sea]), travellerMarksKey([land]), 'the key moves when the way does');
  const paint = (ship) => {
    const calls = [];
    const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => calls.push([k, ...a])), set: (o, k, v) => { o[k] = v; return true; } });
    paintInkOverlay(ctx, { ox: 0, oy: 0, scale: 4 }, { paperW: 4000, paperH: 2000, travellers: [{ x: 207.05, y: 213.02, name: 'Bran', color: TRAVELLER_MARK_CSS, journey: false, ship }] });
    return calls;
  };
  const inked = paint(true), ringed = paint(false);
  assert.equal(inked.filter((c) => c[0] === 'arc').length, 0, 'no ring under a ship');
  assert.equal(inked.filter((c) => c[0] === 'lineTo').length, 6, 'the hull and the mast\'s sail');
  assert.equal(ringed.filter((c) => c[0] === 'arc').length, 1);
  assert.deepEqual(inked.filter((c) => c[0] === 'fillText').map((c) => c[1]), ['Bran'], 'named under it as under the ring');
});

test('OWS1 host wiring by source: the boat under me is my own at its helm or another\'s I stand aboard; my mark says ship and heads as its bow; the view and the map mark the others\' ships, on the sea\'s top', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const csaBoatUnderMe = \(\) => \(csaRuntime\?\.isSailing\(\) \? csaRuntime\.state\.CurrentBoat : null\) \?\? csaAboard\.aboard\?\.boat \?\? null;/);
  assert.match(w, /const csaBoatYaw = \(boat\) => \{ const fw = csaQuatRotate\(boat\.GameObject\.rotation, \[0, 0, 1\]\); return Math\.atan2\(fw\[0\], fw\[2\]\); \};/);
  assert.match(w, /const ship = n \? csaBoatUnderMe\(\) : null;\n\s*const mark = n \? travellerMarkOf\(\{ x: n\.x, z: n\.z, yaw: ship \? csaBoatYaw\(ship\) : cam\.yaw, mode: ship \? TRANSPORT_MODES\.Ship : player\.transportMode, journey: !!travelControlUI\?\.isShowing \}\) : null;/);
  assert.match(w, /\.map\(\(t\) => \(\{ id: t\.id, name: t\.name, \.\.\.t\.p, ship: isShipMark\(t\.p\), kin: travellerKin\(/, 'the held map\'s rows say who is at sea');   // PIN MOVED (FIELD BUGS 2026-10-04e OW-KIN): and who they are to me
  // PIN MOVED (HOST-SPLIT 1, 2026-10-15): the Overworld's marks left world.js for scenes/travelViewMarks.js
  const tvm = rd('src/scenes/travelViewMarks.js');
  assert.match(tvm, /kind: `\$\{party \? 'party' : 'traveller'\}\$\{isShipMark\(t\?\.p\) \? ' ship' : ''\}\$\{t\?\.p\.tv \? ' journey' : ''\}`/, 'within the pose range, by their region mark');
  assert.match(tvm, /const ship = isShipMark\(t\.p\);[^\n]*\n\s*marks\.push\(\{ key: `trav:\$\{t\.id\}`, at: tvSceneKept\(t, w\.x, w\.z, 2, ship\),/, 'a ship\'s mark asked on the sea');
  assert.match(w, /if \(onSea\) holder\._tvAt\[1\] = Math\.max\(holder\._tvAt\[1\], tvSeaY\(\) \+ lift\);/, 'a ship rides the sea\'s top, not the carved seabed');
  assert.match(w, /if \(holder\._tvGen !== gen \|\| holder\._tvNx !== nx \|\| holder\._tvNz !== nz \|\| holder\._tvSea !== onSea\) \{/, 'kept by it too: putting to sea lifts the point at once');
  assert.match(tvm, /kind: `\$\{kind\}\$\{ship \? ' ship' : ''\}\$\{t\.p\.tv \? ' journey' : ''\}`/);
  assert.match(rd('src/ui/heldMap.js'), /journey: t\.journey, ship: t\.ship \}\)\),/);
});
