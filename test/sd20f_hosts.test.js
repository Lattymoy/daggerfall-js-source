// AUDIT SD III, SD20f (2026-10-08, Mac: "a deep comprehensive audit over everything, ensuring absolute polish and
// perfection"; bible/11-Multiplayer/Super-Dungeons.md "AUDIT SD III"): THE HOSTS AND THE LIFECYCLE - the lens's findings,
// each reproduced and pinned here, run from the hosts' own text where the fix is theirs: one life a Hollow is the
// account's and every tab's (H1); the cast-out once a stay, not once a slot (H4); the way out's words said after the
// Hour is left (H5); a Rift step under another step's veil not spent (H6); the veil built ahead for a Hollow (H9); and
// /unstuck in the Hour the Hour's own way out (H10).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSdHost, SD_CAST_OUT_AGAIN_MS } from '../src/scenes/sdHost.js';
import { sdCities, sdTemplates } from '../src/systems/sdSite.js';
import { scanGatePixels } from '../src/systems/gateSite.js';
import { LOCATION_TYPES, CLIMATES } from '../src/formats/mapsFile.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { sdFirst, sdRise, sdFind, sdFell, sdGone, SD_COLLAPSE_MS, SD_CAST_OUT_LINE, SD_NO_RIFT } from '../src/net/sdLaw.js';
import { SD_ENTERED_KEY, SD_ENTERED_MAX, SD_FALLEN_KEY } from '../src/world/sdDungeon.js';
import { createSdVoice, SD_VOICE_RANK } from '../src/scenes/sdVoice.js';
import { createSdEnd, SD_RIFT_KEY } from '../src/scenes/sdEnd.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const W = read('src/scenes/world.js');
const DC = read('src/scenes/dungeonContext.js');
const M = 60_000, H = 3_600_000, T0 = 1_800_000_000_000;
/** A `function name(` of a host's own (two-space indent), its text. */
const fnIn = (src, name) => { const at = src.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return src.slice(at + 1, src.indexOf('\n  }\n', at) + 4); };
/** A property of world.js's Hollow host (createSdHost's own arguments), its arrow's text - one line, or a block. */
function hostProp(name) {
  const from = W.indexOf('const sdHost = params.has(\'online\') ? createSdHost({');
  assert.ok(from > 0, 'the Hollow host');
  const at = W.indexOf(`\n    ${name}: `, from);
  assert.ok(at > 0, name);
  const head = `    ${name}: `;
  const line = W.slice(at + 1, W.indexOf('\n', at + 1));
  if (/=> \{\s*(\/\/.*)?$/.test(line)) return W.slice(at + 1 + head.length, W.indexOf('\n    },', at) + 6);
  return line.slice(head.length).replace(/\s*\/\/.*$/, '').replace(/,\s*$/, '');
}
const evalIn = (expr, env) => new Function(...Object.keys(env), `return (${expr});`)(...Object.values(env));

// ── H1: one life a Hollow, the account's and every tab's ─────────────

/** world.js's kept slots (its own text) over one store, for the account `me()` names. */
function keptOf(store, me) {
  const at = W.indexOf('\n  const sdSlotsKept = (key) => {');
  assert.ok(at > 0, 'sdSlotsKept');
  const text = W.slice(at + 1, W.indexOf('\n  };\n', at) + 5);
  return new Function('appStorage', 'SD_ENTERED_MAX', '_accountSds', `${text}\nreturn sdSlotsKept;`)(() => store, SD_ENTERED_MAX, { me });
}
const memStore = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('SD20f ONE LIFE A HOLLOW IS THE ACCOUNT\'S, AND EVERY TAB\'S (H1): the slot of an Hour one account died in is kept under that account\'s own key - another account on the same device is not refused a Hollow its realm admits (the realm keeps its dead by account); and two tabs\' memories merge as they are asked - each wrote its own boot-time copy back over the other\'s (mutants: the device\'s key for everyone; the store read once)', () => {
  const store = memStore();
  let who = 'acct-a';
  const fallen = keptOf(store, () => who)(SD_FALLEN_KEY);
  fallen.add(7);
  assert.equal(fallen.has(7), true, 'mine');
  assert.deepEqual(JSON.parse(store.m.get(`${SD_FALLEN_KEY}:acct-a`)), [7], 'under my own key');
  assert.equal(store.m.has(SD_FALLEN_KEY), false, 'never the device\'s');
  who = 'acct-b';
  assert.equal(fallen.has(7), false, 'another account on the device: its own life');
  who = null;
  assert.equal(fallen.has(7), false, 'no session: the device\'s own, as it was');
  fallen.add(3);
  assert.deepEqual(JSON.parse(store.m.get(SD_FALLEN_KEY)), [3]);
  // two tabs, one account
  who = 'acct-a';
  const tabA = keptOf(store, () => 'acct-a')(SD_ENTERED_KEY), tabB = keptOf(store, () => 'acct-a')(SD_ENTERED_KEY);
  assert.equal(tabB.has(5), false);
  tabA.add(5);
  tabB.add(9);
  assert.deepEqual(JSON.parse(store.m.get(`${SD_ENTERED_KEY}:acct-a`)), [5, 9], 'merged - the second tab kept the first\'s');
  assert.equal(tabA.has(9), true, 'and the first reads the second\'s');
  for (let s = 20; s < 40; s++) tabA.add(s);
  assert.equal(JSON.parse(store.m.get(`${SD_ENTERED_KEY}:acct-a`)).length, SD_ENTERED_MAX, 'the last few');
  // a store that refuses: the session's own
  const refusing = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const mine = keptOf(refusing, () => 'acct-a')(SD_FALLEN_KEY);
  mine.add(11);
  assert.equal(mine.has(11), true, 'this session holds it');
  assert.match(W, /const keyNow = \(\) => \{ const me = _accountSds\.me\(\); return me \? `\$\{key\}:\$\{me\}` : key; \};/);
});

// ── H4: the cast-out once a stay ──────────────────────────────────────

const T = LOCATION_TYPES;
const place = (region, index, px, py, type, { name = `P${region}.${index}`, w = 1, h = 1, buildings = 0, blocks = 0 } = {}) => ({
  name, regionIndex: region, locationIndex: index, hasDungeon: blocks > 0,
  mapTableData: { mapId: py * 1000 + px, locationType: type, longitude: 0, latitude: 0 },
  exterior: { exteriorData: { width: w, height: h, locationId: py * 1000 + px }, buildingCount: buildings },
  ...(blocks ? { dungeon: { blocks: Array.from({ length: blocks }, (_, i) => ({ blockName: `${i % 3 ? 'N' : 'B'}0000${i}.RDB`, x: i, z: 0, isStartingBlock: !i })), recordElement: { header: { locationId: py * 1000 + px } } } } : {}),
});
function world(places) {
  const regions = [0, 1].map(() => ({ mapTable: [], mapNames: [] }));
  for (const p of places) { regions[p.regionIndex].mapTable[p.locationIndex] = { mapId: p.mapTableData.mapId, locationType: p.mapTableData.locationType }; regions[p.regionIndex].mapNames[p.locationIndex] = p.name; }
  return { regionCount: 2, getRegion: (r) => regions[r], getClimateIndex: (x) => (x < 100 ? CLIMATES.Ocean : 231), getPoliticIndex: (x) => (x < 100 ? 0 : 128 + (x < 500 ? 0 : 1)), getRegionIndexAt: (x) => (x < 500 ? 0 : 1) };
}
const CITY = place(0, 0, 300, 200, T.TownCity, { name: 'Copperham', w: 3, h: 3, buildings: 80 });
const LAB = place(0, 1, 450, 400, T.DungeonLabyrinth, { name: 'The Old Maze', blocks: 14 });
const SCAN = scanGatePixels(world([CITY, LAB]), { heightAt: () => 90 });

/** The real Hollow host over world.js's own castOut, inside and standing (test/sd11c_page.test.js's rig). */
function hollowRig() {
  const s = { clock: T0, mode: 'exterior', loc: null, health: 50, deathUp: false, exits: true, realmSlot: null };
  const log = [];
  const playerEntity = { get health() { return s.health; } };
  const modes = {
    get mode() { return s.mode; }, get dungeonLocation() { return s.loc; }, deathUp: () => s.deathUp, sdRealmSlot: () => s.realmSlot,
    unstuck: () => { log.push('unstuck'); return s.exits; },
  };
  const env = { playerEntity, modes, setMidScreenText: (t) => log.push(['said', t]), sdSay: (t) => log.push(['said', t]), SD_CAST_OUT_LINE, gateVeil: { flash: () => log.push('veil') } };
  const castOut = evalIn(hostProp('castOut'), env);
  const inside = evalIn(hostProp('inside'), env);
  const standing = evalIn(hostProp('standing'), env);
  const host = createSdHost({
    now: () => s.clock, scan: () => SCAN, cities: (r) => sdCities([CITY], r, { regionNameOf: () => 'Nowhere' }), templates: () => sdTemplates([LAB], isMainStoryDungeon),
    where: () => ({ regionIndex: 0, regionName: 'Alik\'r Desert' }), stand: () => {}, unstand: (k) => log.push(['unstand', k]),
    inside, door: () => null, feet: () => null, sendFound: () => true, say: (t) => log.push(['line', t]), regionName: () => '',
    castOut: (key) => { log.push(['castOut', key]); return castOut(key); }, standing,
  });
  return { s, log, host, outs: () => log.filter((x) => x === 'unstuck').length };
}
/** A Hollow risen, found, felled and gone, with me standing in it - its end at `s.clock`. */
function endOf(rig) {
  const { s, host } = rig;
  const r = sdRise(sdFirst(T0 - 3 * H), T0 - 10 * M, 0);
  host.heard({ k: 'ev', ...r }); host.frame();
  const h = host.hollow();
  s.mode = 'dungeon'; s.loc = { sdSlot: h.s, name: h.loc.name };
  const f = sdFind(r, T0, 'Mara'); host.heard({ k: 'ev', ...f }); host.frame();
  const k = sdFell(f, T0 + H, { top: 'Mara', n: 3 }); host.heard({ k: 'ev', ...k });
  s.clock = T0 + H + SD_COLLAPSE_MS;
  host.heard({ k: 'ev', ...sdGone(k, s.clock) });
  return h;
}

test('SD20f THE CAST-OUT ONCE A STAY (H4): the end casts me out of its Hollow, and the exit is taken a frame later - a death in that frame (a lethal landing) drops it, and a Resurrect raised me where I lay, in an ended Hollow no frame cast me out of again: latched once a slot. Now asked again while I still stand there SD_CAST_OUT_AGAIN_MS on, never sooner; and a stay over (outside) forgets it, so back in by its door while it is still listed I am cast out at once (mutants: latched once a slot; asked every frame; the stay never over)', () => {
  assert.equal(SD_CAST_OUT_AGAIN_MS, 2000);
  const a = hollowRig();
  endOf(a);
  a.host.frame();
  assert.equal(a.outs(), 1, 'cast out at the end');
  assert.ok(a.log.some((x) => Array.isArray(x) && x[0] === 'said' && x[1] === SD_CAST_OUT_LINE), 'in its words');
  // the exit dropped: still in the Hollow (the mode machine's drain met a death; a Resurrect raised me where I lay)
  a.s.clock += 1000; a.host.frame(); a.host.frame();
  assert.equal(a.outs(), 1, 'never asked again inside the window - the exit may still be on its way');
  a.s.clock += SD_CAST_OUT_AGAIN_MS - 1000; a.host.frame();
  assert.equal(a.outs(), 2, 'still standing there: asked again');
  a.host.frame();
  assert.equal(a.outs(), 2, 'once a window');
  // the exit taken: outside, the stay over - and back in by its door at once
  a.s.mode = 'exterior'; a.s.loc = null; a.host.frame();
  const h = { s: a.host.record()?.s };
  a.s.mode = 'dungeon'; a.s.loc = { sdSlot: h.s, name: 'The Stopped Bell' }; a.host.frame();
  assert.equal(a.outs(), 3, 'a new stay: cast out at once, never two seconds on');
  // dead at the end: the death's door, never the way out - asked again each frame, and out the frame I am raised
  const b = hollowRig();
  b.s.health = 0; b.s.deathUp = true;
  endOf(b);
  b.host.frame(); b.host.frame();
  assert.equal(b.outs(), 0);
  b.s.health = 30; b.s.deathUp = false; b.host.frame();
  assert.equal(b.outs(), 1, 'raised: out');
});

// ── H5: the way out's words, said ──────────────────────────────────────

test('SD20f THE WAY OUT\'S WORDS ARE SAID (H5): leaving the Hour lets go of what waits for it - its readouts, the floor\'s notes - and its turns still come in their order: the way home\'s own words waited behind "The way home stands open." and were let go unread as the first frame outside cleared the queue (mutants: the turns let go; the readouts kept)', () => {
  let t = 0;
  const shown = [];
  const v = createSdVoice({ show: (text) => shown.push(text), now: () => t });
  v.say('The way home stands open.');
  v.say('The way home carries you out of the Hour, to the Abyss Dungeon\'s door.');
  v.say('The Abyss Dungeon collapses in 1:00.', SD_VOICE_RANK.readout);
  v.say('Your spoils spill across the arena floor.', SD_VOICE_RANK.note);
  v.leave();
  assert.deepEqual(v.waiting(), ['The way home carries you out of the Hour, to the Abyss Dungeon\'s door.'], 'the turn kept, the rest let go');
  for (t = 0; t < 10_000; t += 100) v.frame();
  assert.deepEqual(shown, ['The way home stands open.', 'The way home carries you out of the Hour, to the Abyss Dungeon\'s door.']);
  assert.match(W, /if \(_sdVoiceIn && !inHour\) sdVoice\.leave\(\);/, 'the world leaves the Hour by it');
});

// ── H6: a Rift step under another step's veil ─────────────────────────

test('SD20f A RIFT STEP UNDER ANOTHER STEP\'S VEIL (H6): a step under way refuses a second (the mode machine\'s one-at-a-time) - and the Rift took the refusal as entered: its walk-in spent, nothing said, the Rift dead under my feet. Now the world answers "not yet" (null) while a step is under way, the dungeon host hands that back as untaken, and the Rift asks again the next frame while I stand in it - until the step is done (mutants: the step under way unseen; the walk-in spent; "not yet" said as a refusal)', () => {
  // the world's two doors: null while a step is under way, and no step asked
  const steps = [];
  const env = {
    sdHost: { hollow: () => ({ s: 4, key: 'k', site: { px: 1, py: 2 }, loc: { name: 'The Stopped Bell', climate: null } }) },
    modes: { stepping: true, stepThroughFire: (go) => steps.push(go), get dungeonLocation() { return { sdRealm: 4, sdHollow: null }; } },
    INTERIOR_SEASON: 3, isSdRealm: (loc) => loc?.sdRealm != null,
  };
  const enter = new Function(...Object.keys(env), `${fnIn(W, 'sdEnterRealm')}\nreturn sdEnterRealm;`)(...Object.values(env));
  const back = new Function(...Object.keys(env), `${fnIn(W, 'sdWayBack')}\nreturn sdWayBack;`)(...Object.values(env));
  assert.equal(enter(4), null, 'into the Hour: not yet');
  assert.equal(back(), null, 'back through it: not yet');
  assert.equal(steps.length, 0, 'no step asked under another');
  env.modes.stepping = false;
  const enter2 = new Function(...Object.keys(env), `${fnIn(W, 'sdEnterRealm')}\nreturn sdEnterRealm;`)(...Object.values(env));
  assert.equal(enter2(4), true, 'none under way: the step');
  assert.equal(steps.length, 1);
  // the dungeon host: "not yet" handed back as untaken, nothing said; a refusal still says the Rift's word
  const said = [];
  const rift = (went) => new Function('sdEndWord', 'SD_NO_RIFT', 'opts', 'setMidScreenText', `${fnIn(DC, 'sdRiftStep')}\nreturn sdRiftStep;`)(
    () => ({ word: null, enter: () => went }), SD_NO_RIFT, { sdSay: (t) => { said.push(t); return true; } }, (t) => said.push(t));
  assert.equal(rift(null)(), false, 'not yet: untaken');
  assert.deepEqual(said, [], 'and nothing said');
  assert.equal(rift(true)(), true, 'stepped');
  assert.equal(rift(false)(), true, 'refused: taken, and said');
  assert.deepEqual(said, [SD_NO_RIFT]);
  // the Rift's walk-in: kept armed while its host answers false, spent once it takes it
  let answer = false, asked = 0;
  const e = createSdEnd({ now: () => 0, onRift: () => { asked += 1; return answer; } });
  e.stand({ rift: { at: [0, 0, 0], size: 4 }, retAt: null });
  for (let z = -2; z <= 0; z += 0.25) e.frame([0, 0, z]);   // walked in, a step at a time
  const first = asked;
  assert.ok(first >= 1, 'walked in');
  for (let i = 0; i < 3; i++) e.frame([0, 0, 0]);
  assert.equal(asked, first + 3, 'asked each frame while it is not yet');
  answer = undefined;
  e.frame([0, 0, 0]);
  assert.equal(asked, first + 4, 'taken');
  e.frame([0, 0, 0]); e.frame([0, 0, 0]);
  assert.equal(asked, first + 4, 'the walk-in spent');
  assert.equal(e.press(SD_RIFT_KEY), true, 'a press hands it over as before');
});

// ── H9, H10: the veil ahead, and /unstuck in the Hour ────────────────

test('SD20f THE VEIL AHEAD, AND /unstuck IN THE HOUR (H9, H10): a Hollow stood builds the Rift\'s veil ahead, as a gate does (a session no gate stood in paid for its program as the first step began); and /unstuck in the Shattered Hour is the Hour\'s own way out - under its veil, in its words, as every other way out of it is - with nothing more said if the Hour will not let me go now (mutants: the veil cold; /unstuck the dungeon\'s door in the Hour)', () => {
  assert.match(W, /stand: \(key, loc\) => \{ _locIndexGen \+= 1; locationIndex\.set\(key, loc\); _sdLate\.add\(key\); warmGateVeil\(\); \},/);
  const at = W.indexOf('        if (/^\\/unstuck$/i.test(text.trim())) {');
  assert.ok(at > 0, 'the /unstuck command');
  const block = W.slice(at, W.indexOf('          return true;\n        }', at) + '          return true;\n        }'.length);
  // PIN MOVED (UNSTUCK-OUT, FIELD BUGS 2026-10-08): outdoors - the door refusing - the body stands on open ground
  const run = (hour, wayHome, unstuck, outdoors = false) => {
    const log = [];
    const env = {
      modes: { sdRealmSlot: () => (hour ? 4 : null), unstuck: () => { log.push('unstuck'); return unstuck; } },
      sdWayHome: () => { log.push('wayHome'); return wayHome; }, chatLog: { push: (tab, m) => log.push(m.text) }, tabId: 'world', text: '/unstuck',
      unstuckOutdoors: () => { log.push('outdoors'); return outdoors; },
    };
    new Function(...Object.keys(env), `${block}\nreturn false;`)(...Object.values(env));
    return log;
  };
  assert.deepEqual(run(true, true, true), ['wayHome', 'You find your way back outside.'], 'in the Hour: its way home');
  assert.deepEqual(run(true, false, true), ['wayHome'], 'refused there: nothing more said');
  assert.deepEqual(run(false, false, true), ['unstuck', 'You find your way back outside.'], 'anywhere else: the door I came in by');
  assert.deepEqual(run(false, false, false, true), ['unstuck', 'outdoors', 'You find your footing on open ground.'], 'outdoors: open ground');
  assert.deepEqual(run(false, false, false), ['unstuck', 'outdoors', 'There is no open ground near enough to send you to.']);
  assert.deepEqual(run(true, false, false, true), ['wayHome'], 'in the Hour: never the open ground');
});
