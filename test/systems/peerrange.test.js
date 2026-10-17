// PEER-RANGE (2026-10-10, the owner: "So for online performance, I believe the rendering of players far out is
// contributing to poor performance"): THE OTHERS, DRAWN AS FAR AS THEY CAN BE SEEN. A world cell hands the screen every
// player within the relay's three map pixels (up to 3.3 km along an axis), and every one was drawn. Past the distance on
// the Other players card a player now stands nowhere on this screen - GATE-CROWD's cut, by distance (net/peer/peerRange.js;
// the online frame's drawn list): the party and the one I duel always, nobody cut under the travel view, a drawn player
// held a little past the edge. AUDIT PEER-RANGE + HALO-THIN: me off the origin on both axes, the held set forgotten on
// every way the cut stands down, the room's whole list for a resurrection and a cut peer's sprite. Design:
// bible/07-Rendering/Performance-Priority.md PEER-RANGE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { rangeDrawn, createPeerRange, peerRangeOf, PEER_RANGE_TIERS, PEER_RANGE_DEFAULT, PEER_RANGE_HOLD } from '../../src/net/peer/peerRange.js';
import { PREF_DEFAULTS } from '../../src/systems/uiPrefs.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S } from '../../src/systems/spellcast.js';
import { BLOW } from '../../src/ai/blowShapes.js';
import { RemotePlayers, PEER_ARCHIVE } from '../../src/net/remotePlayers.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const lift = (re, what) => { const m = re.exec(WORLD); assert.ok(m, `lifted from scenes/world.js: ${what}`); return m; };

/** Where I stand - off the origin on both axes and in height (AUDIT C1: every fixture once stood me at x 0, and the law's
 *  x half could read anything). A peer is placed by its offset from me; its pose `shown` is in the scene's own frame. */
const ME = [517, 3, -260];
const peer = (id, dx, dz = 0, dy = 0) => ({ id, shown: { x: ME[0] + dx, y: ME[1] + dy, z: ME[2] + dz } });
const at = (p) => [p.shown.x, p.shown.y, p.shown.z];
const ids = (set) => [...set].sort();
const quiet = (fn) => { const w = console.log; console.log = () => {}; try { return fn(); } finally { console.log = w; } };

// ── the law ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('PEER-RANGE the choices: 150, 300, 600 m or everyone, 300 by default; held to a tenth past; a stored value that is no choice reads as the default; the shelf\'s default is the law\'s (mutants: another default; the tiers reordered; no hold; a stray value kept; the shelf\'s own literal)', () => {
  assert.deepEqual(PEER_RANGE_TIERS, [150, 300, 600, 0], 'outward, then everyone - the card steps through them in order');
  assert.equal(PEER_RANGE_DEFAULT, 300);
  assert.equal(PEER_RANGE_HOLD, 1.1);
  assert.equal(PREF_DEFAULTS.peerRange, PEER_RANGE_DEFAULT, 'the prefs shelf carries the law\'s own default');
  for (const v of PEER_RANGE_TIERS) assert.equal(peerRangeOf(v), v, `${v} is a choice`);
  for (const v of [undefined, null, 7, -300, '300', 301, true, Infinity, NaN]) assert.equal(peerRangeOf(v), PEER_RANGE_DEFAULT, `${String(v)} is no choice`);
});

test('PEER-RANGE the default is past a shot\'s reach: another player\'s arrow or spell flies 25 m/s for 8 s - 200 m - and nobody inside it is cut at the default, nor inside a foe archer\'s aimed shot (x1.3, 260 m); the near tier can, and its row says so (AUDIT A L3 / D6; mutants: a default inside the reach)', () => {
  const reach = MISSILE_SPEED * MISSILE_LIFESPAN_S;
  assert.equal(reach, 200, 'a player\'s shot');
  assert.equal(reach * BLOW.aimed.speed, 260, 'a foe archer\'s aimed shot - the only one sped up (hostCombat.js aimedArrowMeta)');
  assert.ok(PEER_RANGE_DEFAULT >= reach * BLOW.aimed.speed, `the default ${PEER_RANGE_DEFAULT} m reaches past either`);
  assert.ok(PEER_RANGE_TIERS[0] < reach, 'the near tier is inside a player\'s shot');
  assert.match(read('src/ui/enhanced/enhancedMenu.js'), /choiceRow\('peerRange', t\('menu\.peers\.range', 'Draw distance'\),\n\s*t\('menu\.peers\.rangeNote', '[^']*150 m can hide an archer\.'/, 'and the row says so');
  assert.match(read('src/scenes/hostCombat.js'), /export function aimedArrowMeta\(shot\) \{\n\s*return shot \? \{ aimed: true, speedScale: BLOW\.aimed\.speed \} : null;/, 'the aimed shot\'s speed');
});

test('PEER-RANGE the drawn: within the range on the ground drawn, past it not, at it drawn - on either axis, wherever I stand; height is not distance; a party mate anywhere; no range or no place of mine draws everyone; a peer with no place is drawn only as a mate; `out` refilled (mutants: the range unread; strictly inside; either axis read from the origin; height counted; the mate unasked; no range cutting; a placeless peer drawn)', () => {
  const crowd = [peer('a', 10), peer('b', 299, 0), peer('c', 0, -300), peer('d', 301), peer('e', 0, 2400), peer('f', 212, 212), peer('g', -300)];
  assert.deepEqual(ids(rangeDrawn(crowd, ME, { at, range: 300 })), ['a', 'b', 'c', 'f', 'g'], 'within 300 m, the edge included, east and west, north and south');
  assert.deepEqual(ids(rangeDrawn(crowd, ME, { at, range: 150 })), ['a'], 'within 150 m');
  assert.deepEqual(ids(rangeDrawn(crowd, ME, { at, range: 600 })), ['a', 'b', 'c', 'd', 'f', 'g']);
  assert.deepEqual(ids(rangeDrawn(crowd, ME, { at })), ['a', 'b', 'c', 'f', 'g'], 'by default, 300 m');
  assert.equal(rangeDrawn(crowd, ME, { at, range: 0 }).size, crowd.length, 'no range: everyone');
  assert.equal(rangeDrawn(crowd, null, { at, range: 300 }).size, crowd.length, 'no place of mine: everyone');
  // the ground's distance - a player high on a ridge above me is as near as their feet across the ground
  assert.ok(rangeDrawn([peer('up', 50, 0, 900)], ME, { at, range: 150 }).has('up'), 'height is not distance on the ground');
  // measured from me, wherever I stand - moved along x, and along z
  assert.deepEqual(ids(rangeDrawn(crowd, [ME[0] + 300, ME[1], ME[2]], { at, range: 5 })), ['b', 'd'], 'me 300 m east: b and d a metre off');
  assert.deepEqual(ids(rangeDrawn(crowd, [ME[0], ME[1], ME[2] + 2300], { at, range: 150 })), ['e'], 'me 2.3 km north: e 100 m off');
  // a party mate across the map is drawn
  assert.ok(rangeDrawn(crowd, ME, { at, range: 150, mate: (id) => id === 'e' }).has('e'), 'my party mate 2.4 km off');
  // a peer with no place in this scene: a mate's still drawn, a stranger's not
  assert.equal(rangeDrawn([{ id: 'x', shown: null }], ME, { at: () => null, range: 300 }).size, 0);
  assert.equal(rangeDrawn([{ id: 'x', shown: null }], ME, { at: () => null, range: 300, mate: () => true }).size, 1);
  const out = new Set(['stale']);
  assert.equal(rangeDrawn(crowd, ME, { at, range: 300 }, out), out);
  assert.ok(!out.has('stale') && out.size === 5);
});

test('PEER-RANGE the party is asked of a player past the range alone - its answer allocates (AUDIT A L5; mutants: the party asked first)', () => {
  const asked = [];
  rangeDrawn([peer('in', 10), peer('out', 900)], ME, { at, range: 300, mate: (id) => { asked.push(id); return false; } });
  assert.deepEqual(asked, ['out']);
});

test('PEER-RANGE held at the edge: one drawn last frame stays until a tenth past the range, one not drawn needs the range itself (mutants: no hold; the hold given to the newcomer; the hold\'s sign turned)', () => {
  const walker = peer('w', 320), stranger = peer('s', 320);
  const was = new Set(['w']);
  assert.deepEqual(ids(rangeDrawn([walker, stranger], ME, { at, range: 300, was })), ['w'], 'drawn last frame, kept at 320 m');
  assert.equal(rangeDrawn([peer('w', 329)], ME, { at, range: 300, was }).size, 1, 'and at 329 m');
  assert.equal(rangeDrawn([peer('w', 331)], ME, { at, range: 300, was }).size, 0, 'and let go at 331 m');
  assert.equal(rangeDrawn([walker], ME, { at, range: 300, was, hold: 1 }).size, 0, 'no hold, no keeping');
  assert.equal(rangeDrawn([peer('w', 0, -640)], ME, { at, range: 600, was }).size, 1, 'the hold scales with the range: 640 m kept at 600');
});

test('PEER-RANGE the host\'s range: the same list when every one is drawn, else the drawn in order; 300 m when no range is given; `shows` false only for one it cut - a player it never saw is not its to answer for; off (the travel view), with no range or no place of mine, every one and the held set forgotten each time (AUDIT C2, C6; mutants: the hold forgotten frame to frame; shows true for the cut; shows false for the unseen; off still cutting; a range of 0 or no place still live; off keeping the held; another default)', () => {
  const pr = createPeerRange();
  const near = [peer('a', 10), peer('b', 200)];
  assert.equal(pr.cut(near, { me: ME, at, range: 300 }), near, 'everyone within: the same list');
  assert.ok(pr.live);
  const crowd = [peer('a', 10), peer('far', 900), peer('b', 0, 200), peer('edge', -310)];
  assert.deepEqual(pr.cut(crowd, { me: ME, at, range: 300 }).map((p) => p.id), ['a', 'b'], 'the drawn, in the room\'s order');
  assert.equal(pr.shows('far'), false, 'cut: not there to press or hear');
  assert.equal(pr.shows('edge'), false);
  assert.equal(pr.shows('a'), true);
  assert.equal(pr.shows('below-deck'), true, 'never handed to the cut: not the cut\'s to hide');
  // the held set carries frame to frame: 'b' walks out to 320 m and is kept; 'edge' walks in to 320 m and is not
  const next = [peer('a', 10), peer('b', 0, 320), peer('edge', -320)];
  assert.deepEqual(pr.cut(next, { me: ME, at, range: 300 }).map((p) => p.id), ['a', 'b'], 'kept walking out, not taken walking in');
  // every way the cut stands down forgets the held set - the next live cut chooses afresh (320 m is outside)
  for (const [why, o] of [['off - the travel view', { on: false, me: ME, at, range: 300 }], ['everyone on the card', { me: ME, at, range: 0 }], ['no place of mine', { me: null, at, range: 300 }]]) {
    pr.cut(next, { me: ME, at, range: 300 });   // held again: a, b
    assert.equal(pr.cut(crowd, o), crowd, `${why}: every one`);
    assert.ok(!pr.live, `${why}: not live`);
    assert.equal(pr.held().size, 0, `${why}: the held set forgotten`);
    assert.equal(pr.shows('far'), true, `${why}: nobody cut`);
    assert.deepEqual(pr.cut(next, { me: ME, at, range: 300 }).map((p) => p.id), ['a'], `${why}, then on again: chosen afresh`);
  }
  // no range given: the default
  assert.deepEqual(createPeerRange().cut([peer('in', 290), peer('out', 310)], { me: ME, at }).map((p) => p.id), ['in'], '300 m by default');
});

/** The class-sprite path as the host runs it: a counting renderer, a texture of five frames, the build gate's bundle. */
function spriteLayer() {
  const made = [], gone = [];
  const textures = new Map();
  const renderer = {
    textures,
    createBillboardBatch: (archive, record) => { const b = { archive, record, origin: [0, 0, 0] }; made.push(b); return b; },
    destroyBillboardBatch: (b) => gone.push(b),
  };
  const tex = { archive: 4321, getFrameCount: () => 5, getSize: () => ({ width: 64, height: 128 }), getScale: () => ({ width: 0, height: 0 }) };
  let composes = 0;
  const deps = { fetchBytes: null, palette: null, getTexture: async () => tex, uploadRecordFrame: (a, r, f) => textures.set(`${a}_${r}#${f}`, {}), audio: null };
  const rp = new RemotePlayers({ renderer, deps, compose: async () => { composes++; return null; } });
  return { rp, made, gone, composes: () => composes };
}

test('PEER-RANGE the layers let a cut player go and take them back: a class sprite walking out past the hold has its batch destroyed; walking back inside the range it is drawn again in the same frame - its bundle kept while it stays in the room, no doll and no compose for it - and a peer gone from the room keeps nothing (AUDIT A L6; mutants: the bundle swept with the batch; the room unread; the hold and the range)', async () => {
  const { rp, gone, composes } = spriteLayer();
  const pr = createPeerRange();
  const look = { class: 'Warrior', gender: 'male' };
  const toScene = (p) => [p.x, p.y, p.z];
  const peersAt = (x) => [{ id: 'near', look, shown: { x: ME[0] + 5, y: 0, z: ME[2], yaw: 0, mv: 0 } }, { id: 'w', look, shown: { x: ME[0] + x, y: 0, z: ME[2], yaw: 0, mv: 0 } }];
  const frame = (x, room = true) => { const all = peersAt(x); rp.sync(pr.cut(all, { me: ME, at, range: 300 }), toScene, { dt: 1 / 60, eye: ME, room: room ? all : null }); return rp.batches().length; };
  frame(250); await new Promise((r) => setTimeout(r, 0));
  assert.equal(frame(250), 2, 'both drawn inside the range');
  const walkerBatch = rp.batchOf('w');
  assert.ok(walkerBatch);
  assert.equal(frame(325), 2, 'walking out: held at 325 m');
  assert.equal(frame(340), 1, 'past the hold: one sprite');
  assert.ok(gone.includes(walkerBatch), 'and its batch destroyed');
  assert.equal(rp.batchOf('w'), null);
  assert.ok(rp._mobiles.get('w')?.mobileUnit, 'its bundle kept while it stands in the room');
  assert.equal(frame(320), 1, 'coming back: not drawn until inside the range');
  const before = composes();
  assert.equal(frame(290), 2, 'inside: drawn again, this frame');
  assert.ok(rp.batchOf('w') && rp.batchOf('w').archive !== PEER_ARCHIVE, 'as its class sprite - never the doll');
  assert.equal(composes(), before, 'no paperdoll composed for it');
  // gone from the room: nothing kept (AUDIT 68 S14's law)
  rp.sync([peersAt(0)[0]], toScene, { dt: 1 / 60, eye: ME, room: [peersAt(0)[0]] });
  assert.equal(rp._mobiles.has('w'), false, 'a peer who left keeps no bundle');
  rp.destroy();
});

test('PEER-RANGE a resurrection is seen in the whole room: a fallen player raised where they fell past the draw distance takes the body with them; seen in the cut list alone it lay its full minute (AUDIT A L1; mutants: the rise read off the drawn list)', () => {
  const clock = { t: 1_000_000 };
  const rp = new RemotePlayers({ renderer: {}, deps: null, compose: async () => null, now: () => clock.t });
  const fell = { x: ME[0] + 400, y: 0, z: ME[2] };
  quiet(() => rp.addCorpse({ id: 'far', look: null }, fell, null, { quiet: true }));
  clock.t += 2500;
  const risen = { id: 'far', look: null, shown: { ...fell, yaw: 0, mv: 0 } };
  rp.sync([], (p) => [p.x, p.y, p.z], { eye: ME });
  assert.equal(rp._corpses.length, 1, 'the cut list never saw the rise');
  rp.sync([], (p) => [p.x, p.y, p.z], { eye: ME, room: [risen] });
  assert.equal(rp._corpses.length, 0, 'the room did - the body goes with them');
});

// ── the host: the range's cut in the online frame ───────────────────────────────────────────────────────────────────

test('PEER-RANGE the online frame: the drawn list cut by distance after the map\'s poses are kept and before the court\'s crowd, a cast, a light or a body - at the card\'s distance, my party and my duel (from its count on) always, nothing cut under the travel view; the dolls\' sync handed the room\'s whole list; the doors that answer a player on this screen ask the cut too (AUDIT C5, C6; mutants: the travel view cutting; the card unread; the party unasked; the duel unasked; the room\'s list not handed; the pick, the gift and the spark uncut)', () => {
  const m = lift(/\n\s*for \(const d of drawable\) if \(d\?\.shown\) _peerMapPoses\.set\(d\.id, d\.shown\);\n(?:\s*if \(hccOn\(\)\) hcc\.driverGlue\(drawable, \{ toWire: campToWire \}\);[^\n]*\n)?\s*const ranged = peerRange\.cut\(cabin \? drawable : drawable\.filter\(\(d\) => !csaPeers\.isBelowDeck\(d\.id\)\), (\{ on: [^\n]*?\})\);[^\n]*\n\s*const visiblePeers = gateCrowd\.cut\(ranged, \{/, 'the range\'s cut, before the crowd\'s');
  assert.match(WORLD, /const peerRange = createPeerRange\(\);/);
  // the cut's question, evaluated as the frame asks it - the duel manager's own shape: `opponent` from the count on
  const ask = new Function('d', `const { travelView, player, onlineToScene, peerRangeOf, getPref, social, duelMgr } = d; return ${m[1]};`);
  const prefs = { peerRange: 300 };
  const mates = new Set(['mate']);
  const host = ({ tv = false, duel = null } = {}) => ({
    travelView: tv ? { active: true } : { active: false }, player: { pos: ME }, onlineToScene: (p) => [p.x, p.y, p.z], peerRangeOf,
    getPref: (k) => prefs[k], social: { isPartyPeer: (id) => mates.has(id) }, duelMgr: { opponent: duel },
  });
  const crowd = [peer('near', 40), peer('mid', 0, 450), peer('mate', 1800), peer('foe', -700), peer('far', 2400)];
  const cutIds = (o) => createPeerRange().cut(crowd, ask(o)).map((p) => p.id);
  assert.deepEqual(cutIds(host()), ['near', 'mate'], 'on the street: within 300 m, and my party mate across the map');
  assert.deepEqual(cutIds(host({ duel: 'foe' })), ['near', 'mate', 'foe'], 'and the one I duel, wherever they stand - counting down too');
  assert.deepEqual(cutIds(host({ tv: true })), crowd.map((p) => p.id), 'under the travel view: nobody cut (OW-PEERS)');
  prefs.peerRange = 600;
  assert.deepEqual(cutIds(host()), ['near', 'mid', 'mate'], 'the card at 600 m');
  prefs.peerRange = 0;
  assert.deepEqual(cutIds(host()), crowd.map((p) => p.id), 'the card at everyone');
  prefs.peerRange = 'junk';
  assert.deepEqual(cutIds(host()), ['near', 'mate'], 'a stray value reads as the default');
  prefs.peerRange = 150;
  assert.deepEqual(createPeerRange().cut([peer('archer', 200)], ask(host())).length, 0, 'the near tier');
  // the dolls' sync: the cut list to draw, the room's whole list beside it (a rise seen, a cut peer's sprite kept)
  assert.match(WORLD, /remotePlayers\.sync\(visiblePeers, onlineToScene, \{[^\n]*, room: drawable \}\);/);
  // the readers of the drawn list are the cut's (GATE-CROWD's pin holds the casts, the seen and the sprites to it); the
  // doors that answer a player on this screen ask it as they ask the crowd's - the pick and the plaque, a gift's aim and
  // its burst (both through crowdDrawnHere), a blow's spark and a cry
  assert.match(WORLD, /const crowdDrawnHere = \(p\) => gateCrowd\.shows\(p\.id\) && peerRange\.shows\(p\.id\);/);
  assert.match(WORLD, /for \(const p of online\.peers\.values\(\)\) \{\n\s*if \(!p\?\.shown \|\| !online\.visible\(p\) \|\| !gateCrowd\.shows\(p\.id\) \|\| !peerRange\.shows\(p\.id\)\) \{ peerFxPlayer\.forget\(p\?\.id\); continue; \}/, 'a blow\'s spark and a cry');
});

test('PEER-RANGE the Other players card: the distance beside the court\'s crowd, its tiers the law\'s, Everyone for 0, the row reading the law\'s own answer - a stored value that is no tier shows the 300 m it stands for (AUDIT A L2, D7; mutants: the row gone; its key another; the tiers written twice; the raw pref read)', () => {
  const menu = read('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /import \{ PEER_RANGE_TIERS, peerRangeOf \} from '\.\.\/\.\.\/net\/peer\/peerRange\.js';/);
  const card = menu.slice(menu.indexOf('function peerSpritesCard() {'), menu.indexOf('\n}\n', menu.indexOf('function peerSpritesCard() {')));
  assert.match(card, /c\.append\(choiceRow\('peerRange', t\('menu\.peers\.range', 'Draw distance'\),\n\s*t\('menu\.peers\.rangeNote', 'How far away other players are drawn\. Your party and your duel opponent always show\.[^']*'\),\n\s*PEER_RANGE_TIERS\.map\(\(m\) => \[m, m \? t\('menu\.peers\.metres', '\{m\} m', \{ m \}\) : t\('menu\.peers\.everyone', 'Everyone'\)\]\), \{ home: true, read: \(\) => peerRangeOf\(getPref\('peerRange'\)\) \}\)\);/);
  assert.ok(card.indexOf("choiceRow('peerRange'") < card.indexOf("choiceRow('gateCrowd'"), 'the street\'s distance before the court\'s crowd');
  // choiceRow shows the tier `read` answers
  assert.match(menu, /function choiceRow\(key, name, note, tiers, \{ home = false, read = null, write = null \} = \{\}\) \{[\s\S]*?const cur = String\(read \? read\(\) : getPref\(key\)\);/);
});
