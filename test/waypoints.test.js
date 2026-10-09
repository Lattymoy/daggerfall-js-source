// WAYPOINTS (2026-10-06, the player: "Let players add waypoints, partywaypoints and guild waypoints to the overworld map and
// Worldmap(V) with right mouseclick context menu players should also be able to rename them. They can be small flags with
// different colors. Add the waypoints you want to mark (to follow) to the filter list on the overworld map with a dropdown
// menu. Add Waypoints to the filter on the worldmap"; then "i hope the waypoints are removed when leaving party";
// bible/01-Overview/Waypoints-And-Pace.md). ONE STORE, BOTH MAPS (systems/mapWaypoints.js): a point on the bay in map
// pixels, a name, a colour and a kind; a party's or a guild's said on the hub's own channel as one line the chat never
// shows, moved only by its author; dropped when its group is left.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WAYPOINT_KINDS, WAYPOINT_COLORS, WAYPOINT_MAX_PER_KIND, WAYPOINT_NAME_MAX, WAYPOINT_STORE_KEY, WP_WIRE_PREFIX,
  nativeToMapPoint, mapPointToNative, cleanWaypointName, addWaypoint, renameWaypoint, recolorWaypoint, removeWaypoint,
  listWaypoints, waypointById, setWaypointFollowed, followedWaypointIds, isWaypointFollowed, toggleWaypointKind,
  waypointKindsShown, shownWaypoints, nextWaypointName, setWaypointSender, shareWaypoint, encodeWaypointLine,
  decodeWaypointLine, isWaypointLine, receiveWaypointLine, syncWaypointGroups, onWaypoints, waypointCss, _resetWaypoints,
} from '../src/systems/mapWaypoints.js';
import { openWaypointMenu, closeWaypointMenu, waypointMenuOpen, WAYPOINT_MENU_ID } from '../src/ui/waypointMenu.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const fresh = () => { delete globalThis.localStorage; _resetWaypoints(); };

test('WAYPOINTS: a point is map pixels, the held map\'s unit - the Overworld\'s native point converts both ways (MapsFile.MapPixelToWorldCoords inverted)', () => {
  const n = mapPointToNative(512.25, 233.5);
  assert.deepEqual(n, { x: 512.25 * 32768, z: (500 - 233.5) * 32768 });
  assert.deepEqual(nativeToMapPoint(n.x, n.z), { mx: 512.25, my: 233.5 });
  assert.deepEqual(WAYPOINT_KINDS, ['personal', 'party', 'guild']);
  assert.equal(WAYPOINT_COLORS.length, 8);
  assert.equal(waypointCss('nope'), WAYPOINT_COLORS[0].css, 'an unknown colour is the first');
});

test('WAYPOINTS: add, rename, recolour, follow and remove - names cleaned and bounded, the next "Waypoint N" offered, a point off the bay refused, each kind capped', () => {
  fresh();
  assert.equal(nextWaypointName(), 'Waypoint 1');
  const a = addWaypoint({ mx: 10, my: 20 });
  assert.equal(a.waypoint.name, 'Waypoint 1');
  assert.equal(a.waypoint.kind, 'personal');
  assert.equal(a.shared, null, 'a personal one is never said');
  assert.equal(nextWaypointName(), 'Waypoint 2');
  assert.equal(addWaypoint({ mx: -1, my: 20 }), null, 'off the bay');
  assert.equal(addWaypoint({ mx: 1000, my: 20 }), null);
  assert.equal(cleanWaypointName('  a\u0007b\n  c  '), 'a b c', 'one line, no control characters');
  assert.equal(cleanWaypointName('x'.repeat(80)).length, WAYPOINT_NAME_MAX);
  assert.equal(cleanWaypointName('   ', 'fallback'), 'fallback');
  const id = a.waypoint.id;
  assert.equal(renameWaypoint(id, 'The Ruins'), true);
  assert.equal(waypointById(id).name, 'The Ruins');
  assert.equal(recolorWaypoint(id, 'teal'), true);
  assert.equal(waypointById(id).color, 'teal');
  recolorWaypoint(id, 'magenta');
  assert.equal(waypointById(id).color, 'red', 'an unknown colour: the kind\'s own');
  assert.equal(setWaypointFollowed(id, true), true);
  assert.deepEqual(followedWaypointIds(), [id]);
  assert.equal(removeWaypoint(id), true);
  assert.equal(waypointById(id), null);
  assert.deepEqual(followedWaypointIds(), [], 'a removed waypoint is followed no longer');
  // the cap: the oldest of mine goes for the newest
  const first = addWaypoint({ mx: 1, my: 1 }).waypoint.id;
  for (let i = 1; i < WAYPOINT_MAX_PER_KIND; i++) addWaypoint({ mx: 1 + i / 100, my: 1 });
  assert.equal(listWaypoints().length, WAYPOINT_MAX_PER_KIND);
  addWaypoint({ mx: 2, my: 2 });
  assert.equal(listWaypoints().length, WAYPOINT_MAX_PER_KIND);
  assert.equal(waypointById(first), null, 'the oldest went');
  fresh();
});

test('WAYPOINTS: the show switches - one a kind, read by both maps - hide a kind\'s flags, never one the player follows', () => {
  fresh();
  const mine = addWaypoint({ mx: 5, my: 5 }).waypoint;
  const other = addWaypoint({ mx: 6, my: 6 }).waypoint;
  setWaypointFollowed(other.id, true);
  assert.deepEqual({ ...waypointKindsShown() }, { personal: true, party: true, guild: true });
  assert.equal(toggleWaypointKind('personal'), false);
  assert.deepEqual(shownWaypoints().map((w) => w.id), [other.id], 'the followed one stays - the player asked for it');
  assert.equal(isWaypointFollowed(mine.id), false);
  assert.equal(toggleWaypointKind('personal'), true);
  assert.equal(shownWaypoints().length, 2);
  assert.equal(toggleWaypointKind('nope'), false);
  fresh();
});

test('WAYPOINTS: THE WIRE - a party\'s waypoint is said on the party channel as one line, decoded back whole; a chat line is no waypoint', () => {
  fresh();
  const said = [];
  setWaypointSender((ch, text) => { said.push([ch, text]); return true; });
  const r = addWaypoint({ kind: 'party', mx: 123.4567, my: 45.5, name: 'Camp by the river', color: 'gold', by: 'Mara' });
  assert.equal(r.shared, true);
  assert.equal(said.length, 1);
  const [ch, line] = said[0];
  assert.equal(ch, 'party');
  assert.equal(line, `${WP_WIRE_PREFIX} add ${r.waypoint.id} 123.457 45.5 gold Camp by the river`);
  assert.equal(isWaypointLine(line), true);
  assert.equal(isWaypointLine('hello there'), false);
  assert.deepEqual(decodeWaypointLine(line), { op: 'add', id: r.waypoint.id, mx: 123.457, my: 45.5, color: 'gold', name: 'Camp by the river' });
  assert.equal(decodeWaypointLine(`${WP_WIRE_PREFIX} add BAD! 1 1 red x`), null, 'an id of the wrong shape');
  assert.equal(decodeWaypointLine(`${WP_WIRE_PREFIX} add abc 2000 1 red x`), null, 'off the bay');
  assert.equal(encodeWaypointLine(['del', 'abc']), `${WP_WIRE_PREFIX} del abc`);
  renameWaypoint(r.waypoint.id, 'Old camp');
  assert.equal(said.at(-1)[1], `${WP_WIRE_PREFIX} ren ${r.waypoint.id} Old camp`, 'mine and shared: the rename is said');
  removeWaypoint(r.waypoint.id);
  assert.equal(said.at(-1)[1], `${WP_WIRE_PREFIX} del ${r.waypoint.id}`);
  const p = addWaypoint({ mx: 1, my: 1 }).waypoint;
  assert.equal(shareWaypoint(p.id), false, 'a personal one is never said');
  setWaypointSender(null);
  assert.equal(addWaypoint({ kind: 'guild', mx: 2, my: 2 }).shared, false, 'no hub: kept, not said');
  fresh();
});

test('WAYPOINTS: a line heard - mine is taken and not applied again, another\'s add stands as theirs, and ONLY ITS AUTHOR moves it; a plain line is the chat\'s', () => {
  fresh();
  assert.equal(receiveWaypointLine({ ch: 'party', text: 'hello', id: 'p1' }), false, 'chat stays chat');
  assert.equal(receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} add abc 10 10 red Mine`, mine: true }), true);
  assert.equal(listWaypoints().length, 0, 'my own echo is not a second waypoint');
  assert.equal(receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} add w1 10 20 blue The ford`, id: 'author', name: 'Bran' }), true);
  const w = waypointById('w1');
  assert.equal(w.mine, false); assert.equal(w.kind, 'party'); assert.equal(w.by, 'Bran'); assert.equal(w.name, 'The ford');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} add w1 900 400 red Moved`, id: 'someone-else' });
  assert.deepEqual([waypointById('w1').mx, waypointById('w1').name], [10, 'The ford'], 'nor can another\'s add move it');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} ren w1 Hijacked`, id: 'someone-else' });
  assert.equal(waypointById('w1').name, 'The ford', 'another\'s word on a waypoint they did not make is ignored');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} ren w1 The old ford`, id: 'author' });
  assert.equal(waypointById('w1').name, 'The old ford', 'the author renames it');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} del w1`, id: 'someone-else' });
  assert.ok(waypointById('w1'), 'and only the author removes it');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} del w1`, id: 'author' });
  assert.equal(waypointById('w1'), null);
  assert.equal(receiveWaypointLine({ ch: 'world', text: `${WP_WIRE_PREFIX} add w2 1 1 red x`, id: 'a' }), true, 'a waypoint line is never chat, whatever channel');
  assert.equal(waypointById('w2'), null, 'but only a party\'s or a guild\'s stands');
  fresh();
});

test('WAYPOINTS GROUP-LEAVE: the party and guild I stand in, told by the host - leaving takes that group\'s waypoints, mine and theirs; one kept from before is adopted', () => {
  fresh();
  syncWaypointGroups({ party: 'P1', guild: null });
  const mine = addWaypoint({ kind: 'party', mx: 1, my: 1 }).waypoint;
  assert.equal(mine.grp, 'P1');
  receiveWaypointLine({ ch: 'party', text: `${WP_WIRE_PREFIX} add t1 2 2 red Theirs`, id: 'x' });
  setWaypointFollowed('t1', true);
  const keep = addWaypoint({ mx: 3, my: 3 }).waypoint;
  assert.equal(syncWaypointGroups({ party: 'P1' }), 0, 'the same party: nothing goes');
  assert.equal(syncWaypointGroups({ party: null }), 2, 'left the party: both party waypoints go');
  assert.deepEqual(listWaypoints().map((w) => w.id), [keep.id], 'a personal one stays');
  assert.deepEqual(followedWaypointIds(), []);
  fresh();
  // kept from before groups were told: adopted by the first group heard
  const old = addWaypoint({ kind: 'guild', mx: 4, my: 4 }).waypoint;
  assert.equal(old.grp, null);
  assert.equal(syncWaypointGroups({ guild: 'HND' }), 0);
  assert.equal(waypointById(old.id).grp, 'HND');
  assert.equal(syncWaypointGroups({ guild: 'OTH' }), 1, 'another guild: the old one\'s waypoint goes');
  fresh();
});

test('WAYPOINTS: kept on the device through the storage seam - the list, the follows and the switches read back; a bad record is dropped, never half kept', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    _resetWaypoints();
    const heard = [];
    onWaypoints((why) => heard.push(why));
    const w = addWaypoint({ mx: 7, my: 8, name: 'Keep' }).waypoint;
    setWaypointFollowed(w.id, true);
    toggleWaypointKind('guild');
    assert.deepEqual(heard, ['add', 'follow', 'show']);
    const raw = JSON.parse(store.get(WAYPOINT_STORE_KEY));
    raw.list.push({ id: 'bad', kind: 'nope', mx: 1, my: 1 }, { id: 'far', kind: 'personal', mx: 5000, my: 1 });
    store.set(WAYPOINT_STORE_KEY, JSON.stringify(raw));
    _resetWaypoints();
    assert.deepEqual(listWaypoints().map((x) => [x.id, x.name]), [[w.id, 'Keep']]);
    assert.deepEqual(followedWaypointIds(), [w.id]);
    assert.equal(waypointKindsShown().guild, false);
  } finally { fresh(); }
});

/** A document enough for the menu: elements with classes, text, children, handlers, a box and a window. */
function fakeDoc() {
  const win = { innerWidth: 800, innerHeight: 600, listeners: {}, addEventListener(t, fn) { (this.listeners[t] ??= []).push(fn); }, removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] ?? []).filter((f) => f !== fn); } };
  const mk = (tag) => {
    const n = { tag, className: '', textContent: '', title: '', value: '', disabled: false, children: [], attrs: {}, listeners: {}, style: {}, parent: null };
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.append = (...c) => { for (const x of c) { x.parent = n; n.children.push(x); } };
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.remove = () => { if (n.parent) n.parent.children = n.parent.children.filter((x) => x !== n); n.parent = null; };
    n.contains = (x) => { for (let p = x; p; p = p.parent) if (p === n) return true; return false; };
    n.getBoundingClientRect = () => ({ width: 248, height: 240 });
    n.focus = () => {}; n.select = () => {};
    return n;
  };
  const body = mk('body'), head = mk('head');
  const doc = { body, head, defaultView: win, createElement: mk, getElementById: (id) => [...head.children, ...body.children].find((c) => c.id === id) ?? null };
  return { doc, win };
}
const all = (n) => [n, ...n.children.flatMap(all)];
const press = (b) => b.onclick({ preventDefault() {}, stopPropagation() {} });

test('WAYPOINTS: the right-click menu - added where the map was pressed with its name, kind and colour; a flag\'s own menu renames, follows and removes; Escape closes it, one at a time', () => {
  fresh();
  const { doc, win } = fakeDoc();
  assert.equal(openWaypointMenu({ x: 100, y: 100, doc, point: { mx: 300, my: 200 }, by: 'Me', canKind: { party: false, guild: true } }), true);
  assert.equal(waypointMenuOpen(), true);
  let box = doc.body.children.find((c) => c.id === WAYPOINT_MENU_ID);
  const kinds = all(box).filter((n) => /wpm-kind\b/.test(n.className));
  assert.deepEqual(kinds.map((k) => [k.textContent, k.disabled]), [['Personal', false], ['Party', true], ['Guild', false]], 'not in a party: no party waypoint');
  const name = all(box).find((n) => n.tag === 'input');
  assert.equal(name.value, 'Waypoint 1');
  name.value = 'Fishing spot';
  press(all(box).find((n) => n.className === 'wpm-swatch' && n.title === 'Green'));
  press(all(box).find((n) => /wpm-btn main/.test(n.className) && n.textContent === 'Add'));
  assert.equal(waypointMenuOpen(), false, 'added: the menu goes');
  const [w] = listWaypoints();
  assert.deepEqual([w.name, w.color, w.kind, w.mx, w.my], ['Fishing spot', 'green', 'personal', 300, 200]);
  // the flag's own menu
  let travelled = null;
  openWaypointMenu({ x: 10, y: 10, doc, id: w.id, onTravel: (x) => { travelled = x.id; } });
  box = doc.body.children.find((c) => c.id === WAYPOINT_MENU_ID);
  const btns = () => all(box).filter((n) => /wpm-btn/.test(n.className));
  assert.deepEqual(btns().map((b) => b.textContent), ['Save', 'Follow', 'Travel here', 'Remove'], 'no Share again on a personal one');
  all(box).find((n) => n.tag === 'input').value = 'Best fishing';
  press(btns().find((b) => b.textContent === 'Save'));
  assert.equal(waypointById(w.id).name, 'Best fishing');
  press(btns().find((b) => b.textContent === 'Follow'));
  assert.equal(isWaypointFollowed(w.id), true);
  press(btns().find((b) => b.textContent === 'Travel here'));
  assert.equal(travelled, w.id);
  assert.equal(waypointMenuOpen(), false);
  // Escape: the menu's own, before the host's keys
  openWaypointMenu({ x: 10, y: 10, doc, id: w.id });
  let stopped = false;
  for (const fn of win.listeners.keydown) fn({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; }, stopPropagation() {} });
  assert.equal(waypointMenuOpen(), false);
  assert.equal(stopped, true, 'the host never sees the Escape that closed the menu');
  assert.deepEqual(win.listeners.keydown, [], 'its listeners go with it');
  // a second opens over the first; an owner closes only its own
  openWaypointMenu({ x: 1, y: 1, doc, id: w.id, owner: 'heldmap' });
  closeWaypointMenu('overworld');
  assert.equal(waypointMenuOpen(), true, 'the Overworld going down leaves the held map\'s menu');
  closeWaypointMenu('heldmap');
  assert.equal(waypointMenuOpen(), false);
  assert.equal(doc.body.children.filter((c) => c.id === WAYPOINT_MENU_ID).length, 0);
  fresh();
});

test('WAYPOINTS host: both maps take the right click as the store\'s - the Overworld\'s still right press, the held map\'s world sheet arm - and the hub\'s party and guild lines reach the store before the chat', () => {
  const tv = rd('src/scenes/travelView.js');
  assert.match(tv, /if \(p && p\.id === e\.pointerId && !p\.moved && p\.button === 2 && state === 'up' && e\.type !== 'pointercancel'\) \{\n\s*const key = deps\.hud\?\.pickAt\?\.\(e\.clientX, e\.clientY\) \?\? null;\n\s*deps\.onContext\?\.\(e\.clientX, e\.clientY, key, e\);/, 'a right press that never moved - a right DRAG still orbits');
  const hm = rd('src/ui/heldMap.js');
  assert.match(hm, /context: \(cx, cy\) => this\._waypointContext\(cx, cy\),/, 'the world sheet\'s arm (EM1: the window never asks which sheet)');
  assert.match(hm, /if \(e\.button === 2\) \{ e\.preventDefault\?\.\(\); this\._sheet\?\.context\(e\.clientX, e\.clientY\); \}/);
  for (const f of ['src/ui/automapSheet.js', 'src/ui/townSheet.js']) assert.match(rd(f), /context\(\) \{ return false; \},/, `${f}: no waypoints there`);
  const w = rd('src/scenes/world.js');
  assert.match(w, /setWaypointSender\(\(ch, text\) => socialLink\(\)\?\.sendChat\(text, \{ ch \}\) \?\? false\);/, 'the hub\'s own channels - no relay change');
  assert.match(w, /if \(socialLink\(\)\?\.status === 'open' && social\) syncWaypointGroups\(\{ party: social\.party\?\.id \?\? null, guild: myGuildTag\(\) \}\);/, 'GROUP-LEAVE: told only while the hub is open, so a dropped link removes nothing');
});

test('WILD-WAYPOINT: my remains in the open zone plant one followed red flag, kept with its end on this device - gone at its time, when the room says the remains are gone, at the next death\'s flag, or when removed by hand; and the book hears its room before its word (WILD-SEEN)', async () => {
  fresh();
  const W = await import('../src/systems/wildRemainsWaypoint.js');
  const id = W.markRemains({ mx: 640.5, my: 120.25, until: 10_000, r: 'abc' });
  const wp = waypointById(id);
  assert.equal(wp.name, W.WILD_WP_NAME);
  assert.equal(wp.color, 'red');
  assert.equal(wp.kind, 'personal', 'mine alone - never said to a party');
  assert.ok(isWaypointFollowed(id), 'followed: the Overworld keeps it at the screen\'s edge with its distance');
  assert.deepEqual([wp.mx, wp.my], [640.5, 120.25]);
  assert.equal(W.remainsMarkTick(9_999), false, 'still in its time');
  assert.equal(W.remainsGone('other'), false, 'another remains gone: not mine');
  assert.equal(W.remainsMark()?.id, id, 'remembered on this device');
  assert.equal(W.remainsMarkTick(10_000), true, 'its time up: gone');
  assert.equal(waypointById(id), null);
  const a = W.markRemains({ mx: 1, my: 1, until: 50, r: 'r1' });
  const b = W.markRemains({ mx: 2, my: 2, until: 60, r: 'r2' });
  assert.equal(waypointById(a), null, 'the next death\'s flag takes the last one down');
  assert.equal(W.remainsGone('r2'), true, 'the room says they are gone: the flag goes');
  assert.equal(waypointById(b), null);
  const c = W.markRemains({ mx: 3, my: 3, until: 1e15, r: 'r3' });
  removeWaypoint(c);
  assert.equal(W.remainsMarkTick(0), true, 'removed by hand: the record goes too');
  assert.equal(W.remainsMark(), null);
  assert.equal(W.markRemains({ mx: -5, my: 3, until: 1e15 }), null, 'off the map: no flag');
  // the host
  const src = rd('src/scenes/world.js');
  assert.match(src, /online\.onWildRoom = \(w, room\) => \{\n\s*if \(room !== online\.room\) return;\n\s*wildRemains\.setRoom\(room\);\n\s*wildRemains\.onWord\(w\);\n\s*if \(w\?\.k === 'gone'\) remainsGone\(w\.r\);/, 'WILD-SEEN: the room first, so a near relay\'s hello is never cleared as another room\'s by the frame after it');
  assert.match(src, /if \(at\) markRemains\(\{ mx: at\.mx, my: at\.my, until: _wildMine\.until, r \}\);/, 'the death plants it where they lie');
  assert.match(src, /remainsMarkTick\(Date\.now\(\)\);/, 'and the frame takes it down at its time');
  fresh();
});
