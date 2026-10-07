// SUNBABY1 — A LIVE EVENT, STAGED FOR EVERYONE ONLINE: THE SUN BABY (2026-10-04).
//
// The ask: "develop a command like /event dread that turns the sky into pretty flowers, clears weather and shows the
// sun as a big laughing baby ... Like teletubbies". EVENT1's door with a second word on it (`/event sunbaby`, the dev
// glyph, online players only), and a look of its own (world/sunbabySky.js, render/sunbabySkyRenderer.js).
//
// THE PINS, BY THE DOOR THEY GUARD:
//   the wire     - the word appended; the relay that first knows it (world163) (an older one CLOSES the socket on a word it does
//                  not know, so knowing the frame is not enough)
//   the relay    - a REAL Room: a dev stages the sun baby in the hub, kept and said on a late joiner's welcome
//   the session  - the word staged only on a relay that knows it
//   the command  - /event sunbaby [on|off]
//   the look     - the fade and the rise, the clear-day weather word, the haze, the light, the water, the GLSL from
//                  the tables, and the pass (nothing at weight 0; blended over the sky and every state put back)
//   the host     - the sky controller draws it over the sky and its clouds and stands the sky on the clear day;
//                  world.js shows the clear day (never the sim's word), lifts the light, stills the far storms
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, LIVE_EVENTS, LIVE_EVENT_RELAY_MIN, EVENT_RELAY_MIN, EVENT_KEY, relayKnowsLiveEvent, validLiveEvent, RELAY_VERSION, CHAT_WORLD_ROOM } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { parseEventCommand } from '../src/net/chatCommands.js';
import { WEATHER_TYPES } from '../src/world/weather.js';
import { EXTERIOR_NOON_AMBIENT, EXTERIOR_NIGHT_AMBIENT } from '../src/world/worldClock.js';
import {
  SUNBABY_EVENT, SUNBABY_FADE_S, SUNBABY_WEATHER, SUNBABY_ZENITH, SUNBABY_HORIZON, SUNBABY_PETALS, SUNBABY_HEART, SUNBABY_DENSITY,
  SUNBABY_SUN_RADIUS, SUNBABY_SUN_ELEV_DEG, SUNBABY_SUN_SET_DEG, SUNBABY_SUN_BEARING, SUNBABY_AMBIENT, SUNBABY_GLSL,
  createSunbaby, sunbabySunDir, sunbabyHaze, sunbabyLight, sunbabyWaterSky,
} from '../src/world/sunbabySky.js';
import { SunbabySkyRenderer, SUNBABY_FS as FS, SUNBABY_UNIFORMS as UNIFORM_NAMES } from '../src/render/sunbabySkyRenderer.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const ofType = (ws, t) => ws.sent.filter((m) => m.t === t);
const stage = (kind) => JSON.stringify({ t: 'stage', kind });
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

// ── THE WIRE ─────────────────────────────────────────────────────────

test('SUNBABY1 wire: the sun baby is a live event word, appended after the dread - a stage frame takes it and a live event names it (mutants: the word dropped)', () => {
  assert.equal(SUNBABY_EVENT, 'sunbaby', 'the look draws the word the relay carries');
  assert.deepEqual(LIVE_EVENTS, ['dread', 'sunbaby'], 'appended, never reordered - an old build knows the dread at index 0');
  assert.deepEqual(parseClient(stage('sunbaby'), { hasHello: true }), { t: 'stage', kind: 'sunbaby' });
  assert.deepEqual(parseClient(stage('SUNBABY'), { hasHello: true }), { error: 'bad stage' });
  assert.equal(validLiveEvent({ kind: 'sunbaby', at: 1_700_000_000_000 }), true);
});

test('SUNBABY1 wire: each word is staged only on a relay that knows IT - the sun baby from world163, the dread from EVENT1\'s world110; a word with no row is known by none (mutants: the row at world162; the row check dropped)', () => {
  assert.deepEqual(Object.keys(LIVE_EVENT_RELAY_MIN), [...LIVE_EVENTS], 'one row a word, in the words\' order');
  assert.equal(LIVE_EVENT_RELAY_MIN.dread, EVENT_RELAY_MIN);
  assert.equal(LIVE_EVENT_RELAY_MIN.sunbaby, 163);
  assert.equal(relayKnowsLiveEvent('world162', 'sunbaby'), false, 'world162 (PRIMARCH) answers the word "bad stage" and closes the socket');
  assert.equal(relayKnowsLiveEvent('world163', 'sunbaby'), true);
  assert.equal(relayKnowsLiveEvent('world161', 'dread'), true);
  assert.equal(relayKnowsLiveEvent('world109', 'dread'), false);
  assert.equal(relayKnowsLiveEvent(RELAY_VERSION, 'sunbaby'), true, 'the relay this build ships knows it');
  for (const kind of ['plague', '', 'toString', '__proto__', undefined]) assert.equal(relayKnowsLiveEvent('world999', kind), false, String(kind));
  for (const v of [null, '', 'world', 162]) assert.equal(relayKnowsLiveEvent(v, 'sunbaby'), false, String(v));
});

// ── THE RELAY ────────────────────────────────────────────────────────

test('SUNBABY1 relay: a dev stages the sun baby in the hub - kept, fanned to everyone, and said whole on a late joiner\'s welcome; a player cannot', async () => {
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const dev = r.connect(), one = r.connect();
  await r.hello(dev, 'peer-0001', null, { glyphs: ['dev'] });
  await r.hello(one, 'peer-0002');
  await r.raw(one, stage('sunbaby'));
  assert.equal(r.store.has(EVENT_KEY), false, 'a player is ignored');
  await r.raw(dev, stage('sunbaby'));
  const kept = r.store.get(EVENT_KEY);
  assert.equal(kept?.kind, 'sunbaby');
  for (const ws of [dev, one]) assert.deepEqual(ofType(ws, 'event').at(-1), { t: 'event', kind: 'sunbaby', at: kept.at });
  const late = r.connect();
  await r.hello(late, 'peer-0003');
  assert.deepEqual(ofType(late, 'welcome')[0].ev, { kind: 'sunbaby', at: kept.at });
});

// ── THE SESSION AND THE COMMAND ──────────────────────────────────────

const session = () => {
  const s = new OnlineSession({ url: 'wss://example.test', name: 'Mac', id: 'peer-0001', secret: 'x'.repeat(32), presence: false });
  s.room = CHAT_WORLD_ROOM;
  const heard = [];
  s.onEvent = (ev, o) => heard.push([ev, o]);
  return { s, heard };
};
const welcome = (extra = {}) => JSON.stringify({ t: 'welcome', id: 'peer-0001', peers: [], n: 1, v: RELAY_VERSION, now: Date.now(), ...extra });

test('SUNBABY1 session: /event sunbaby is sent only to a relay that knows the word - a world162 hub knows the frame and the dread but would close on this; the end ("") is any stage relay\'s (mutants: the word gate dropped; the version never kept)', () => {
  const { s } = session();
  const out = [];
  s._send = (f) => { out.push(f); return true; };
  s._receive(welcome({ v: 'world162' }));
  assert.equal(s.eventOk, true, 'world162 knows the stage frame');
  assert.equal(s.sendStage('sunbaby'), false, 'but not the word');
  assert.deepEqual(out, []);
  assert.equal(s.sendStage('dread'), true, 'the dread it knows');
  const fresh = session();
  const sent = [];
  fresh.s._send = (f) => { sent.push(f); return true; };
  fresh.s._receive(welcome({ ev: { kind: 'sunbaby', at: 99 } }));
  assert.deepEqual(fresh.heard, [[{ kind: 'sunbaby', at: 99 }, { live: false }]], 'a joiner is told the sun baby whole');
  assert.equal(fresh.s.eventV, RELAY_VERSION);
  assert.equal(fresh.s.sendStage('sunbaby'), true);
  assert.deepEqual(sent, [{ t: 'stage', kind: 'sunbaby' }]);
});

test('SUNBABY1 command: /event sunbaby [on|off] - the usage names it (mutants: none of its own - the parser reads LIVE_EVENTS)', () => {
  assert.deepEqual(parseEventCommand('/event sunbaby'), { kind: 'sunbaby' });
  assert.deepEqual(parseEventCommand('/Event SunBaby ON'), { kind: 'sunbaby' });
  assert.deepEqual(parseEventCommand('/event sunbaby off'), { kind: '' });
  assert.match(parseEventCommand('/event teletubbies').error, /\/event <dread\|sunbaby> \[on\|off\]/);
});

// ── THE LOOK ─────────────────────────────────────────────────────────

test('SUNBABY1 fade: a change the player watched walks over SUNBABY_FADE_S each way, a welcome is whole, the dread is not this event - and `on` is the word at once, for the weather (mutants: live snapped; any word read as this one)', () => {
  assert.equal(SUNBABY_FADE_S, 8);
  const s = createSunbaby();
  s.set({ kind: 'sunbaby', at: 1 }, { live: true });
  assert.equal(s.on, true, 'the weather clears at the word');
  assert.equal(s.tick(SUNBABY_FADE_S / 4), 0.25, 'the sky fades in');
  assert.equal(s.tick(SUNBABY_FADE_S), 1);
  s.set(null, { live: true });
  assert.equal(s.on, false);
  assert.equal(s.tick(SUNBABY_FADE_S / 2), 0.5, 'and out');
  s.set({ kind: 'sunbaby', at: 2 }, { live: false });
  assert.equal(s.weight, 1, 'a welcome: they did not watch it come');
  s.set({ kind: 'dread', at: 3 }, { live: false });
  assert.equal(s.weight, 0, 'the dread is the dread\'s');
  assert.equal(s.on, false);
  assert.equal(s.tick(-5), 0);
});

test('SUNBABY1 sun: the sun baby waits below the horizon and rises to SUNBABY_SUN_ELEV_DEG with the weight, eased, on its bearing - a unit direction (mutants: the rise skipped)', () => {
  const elev = (d) => Math.asin(d[1]) * 180 / Math.PI;
  for (const w of [0, 0.25, 0.5, 1]) assert.ok(Math.abs(Math.hypot(...sunbabySunDir(w)) - 1) < 1e-9, `unit at ${w}`);
  assert.ok(Math.abs(elev(sunbabySunDir(0)) - SUNBABY_SUN_SET_DEG) < 1e-9 && SUNBABY_SUN_SET_DEG < 0, 'waiting under the land');
  assert.ok(Math.abs(elev(sunbabySunDir(1)) - SUNBABY_SUN_ELEV_DEG) < 1e-9);
  assert.equal(SUNBABY_SUN_ELEV_DEG, 30);
  assert.ok(Math.abs(elev(sunbabySunDir(0.5)) - (SUNBABY_SUN_SET_DEG + (SUNBABY_SUN_ELEV_DEG - SUNBABY_SUN_SET_DEG) * 0.875)) < 1e-9, 'eased out: it slows as it climbs');
  const d = sunbabySunDir(1);
  assert.ok(Math.abs(Math.atan2(d[2], d[0]) - SUNBABY_SUN_BEARING) < 1e-9);
  assert.deepEqual(sunbabySunDir(7), sunbabySunDir(1), 'clamped');
  assert.ok(SUNBABY_SUN_RADIUS > 0.15, 'a BIG sun - the face alone wider than eight of the port\'s suns (SUN_RADIUS 0.032)');
});

test('SUNBABY1 the land: the clear day is a weather word; the haze leans to the flower sky\'s horizon; the ambient is LIFTED toward noon\'s and never darkened; the water mirrors the flower sky (mutants: the lift darkening a brighter light)', () => {
  assert.ok(WEATHER_TYPES.includes(SUNBABY_WEATHER) && SUNBABY_WEATHER === 'sunny');
  assert.deepEqual(sunbabyHaze([0.2, 0.3, 0.4], 0), [0.2, 0.3, 0.4]);
  assert.ok(near(sunbabyHaze([0.2, 0.3, 0.4], 1), SUNBABY_HORIZON));
  const fog = Object.freeze([0.5, 0.5, 0.5]);
  assert.ok(near(sunbabyHaze(fog, 0.5), [0.6, 0.69, 0.75]), 'half way');
  const night = sunbabyLight(EXTERIOR_NIGHT_AMBIENT, 1);
  assert.ok(night instanceof Float32Array);
  assert.ok(near([...night], SUNBABY_AMBIENT, 1e-6), 'midnight under the sun baby is its bright day');
  assert.ok(SUNBABY_AMBIENT.every((v, i) => Math.abs(v - EXTERIOR_NOON_AMBIENT[i]) <= 0.1), 'about noon\'s, warmed');
  assert.ok(near([...sunbabyLight([0.25, 0.25, 0.25], 0)], [0.25, 0.25, 0.25]), '0 is the light as given');
  assert.ok(near([...sunbabyLight([1.2, 1.1, 1.0], 1)], [1.2, 1.1, 1.0]), 'a brighter light is never dimmed');
  const ws = { zenith: [0, 0, 0], horizon: [1, 1, 1] };
  assert.equal(sunbabyWaterSky(ws, 0), ws);
  const w1 = sunbabyWaterSky(ws, 1);
  assert.ok(near(w1.zenith, SUNBABY_ZENITH) && near(w1.horizon, SUNBABY_HORIZON));
  assert.equal(sunbabyWaterSky(null, 1), null, 'no reflected sky (the classic lane) stays none');
});

test('SUNBABY1 GLSL: the flower sky and the sun baby are generated from the tables - every petal, the heart, the dome, both densities and the face\'s radius - and the pass draws them along the enhanced sky\'s own ray', () => {
  const v3 = (c) => `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
  assert.equal(SUNBABY_PETALS.length, 6);
  for (const c of [...SUNBABY_PETALS, SUNBABY_HEART, SUNBABY_ZENITH, SUNBABY_HORIZON]) assert.ok(SUNBABY_GLSL.includes(v3(c)), v3(c));
  for (const d of SUNBABY_DENSITY) assert.ok(SUNBABY_GLSL.includes(d.toFixed(4)));
  assert.ok(SUNBABY_GLSL.includes(`/ ${SUNBABY_SUN_RADIUS.toFixed(4)};`), 'the face in its own radii');
  assert.match(SUNBABY_GLSL, /vec3 sunbabySky\(vec3 dir, vec3 sunDir, float t, vec2 face, sampler2D photo, float photoOn\)/);   // SUNBABY2 moved it: the face it wears; SUNBABY3: Todd's photograph
  assert.match(SUNBABY_GLSL, /float px = length\(fwidth\(p\)\);[\s\S]*float upx = length\(fwidth\(uv\)\);\s*\n\s*vec4 duv = vec4\(dFdx\(uv\), dFdy\(uv\)\);\s*\n\s*if \(dot\(dir, sunDir\)/, 'every derivative taken before the branch that reads it');   // SUNBABY3 moved it: the photograph's too
  assert.ok(FS.includes(SUNBABY_GLSL));
  assert.ok(FS.includes(rd('src/render/enhancedSky.js').match(/vec3 ray = normalize\(vec3\(vNdc\.x[^\n]*/)[0]), 'the enhanced sky\'s ray');
  assert.match(FS, /outColor = vec4\(sunbabySky\(dir, uSunDir, uTime, uFace, uToddPhoto, uToddPhotoOn\), clamp\(uWeight, 0\.0, 1\.0\)\);/, 'blended by the weight');   // SUNBABY2 moved it: uFace; SUNBABY3: the photograph
  for (const u of UNIFORM_NAMES) assert.match(FS, new RegExp(`uniform [^;]*\\b${u}\\b`), u);
});

/** A WebGL2 that records every call (constants answer their own names). */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      return (...a) => {
        calls.push([k, ...a]);
        if (k === 'getShaderParameter' || k === 'getProgramParameter') return true;
        if (k === 'getUniformLocation') return a[1];
        if (k.startsWith('create')) return { k };
        return undefined;
      };
    },
  });
  return { gl, calls };
}

test('SUNBABY1 pass: at weight 0 it draws NOTHING; above it, one triangle at the far plane blended over the sky by the weight with the sun where the weight puts it - and every state it touched put back (mutants: drawn at 0; the blend left on)', () => {
  const { gl, calls } = fakeGl();
  const p = new SunbabySkyRenderer(gl);
  calls.length = 0;
  p.draw(0.3, 0.2, 1.1, 16 / 9);
  assert.deepEqual(calls, [], 'no event, no pass');
  p.weight = 0.5;
  p.draw(0.3, 0.2, 1.1, 16 / 9);
  const names = calls.map((c) => c[0]);
  const at = (k, ...a) => calls.findIndex((c) => c[0] === k && a.every((v, i) => c[i + 1] === v));
  assert.ok(at('enable', 'BLEND') >= 0 && at('enable', 'BLEND') < at('drawArrays', 'TRIANGLES', 0, 3));
  assert.ok(at('blendFuncSeparate', 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'ZERO', 'ONE') >= 0, 'over the sky by alpha, the buffer\'s alpha untouched');
  assert.ok(at('depthFunc', 'LEQUAL') >= 0 && at('depthMask', false) >= 0, 'only the cleared depth: the land stands over it');
  assert.deepEqual(calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uWeight'), ['uniform1f', 'uWeight', 0.5]);
  assert.deepEqual([...calls.find((c) => c[0] === 'uniform3fv' && c[1] === 'uSunDir')[2]], sunbabySunDir(0.5));
  const after = calls.slice(names.indexOf('drawArrays'));
  for (const [k, ...a] of [['disable', 'BLEND'], ['enable', 'CULL_FACE'], ['depthFunc', 'LESS'], ['depthMask', true]]) assert.ok(after.some((c) => c[0] === k && a.every((v, i) => c[i + 1] === v)), `${k} ${a} put back`);
  calls.length = 0;
  p.dispose();
  assert.deepEqual(calls.map((c) => c[0]), ['deleteProgram', 'deleteBuffer', 'deleteVertexArray', 'deleteTexture'], 'every allocation has an owner');   // SUNBABY3 moved it: Todd's photograph
});

// ── THE HOST ─────────────────────────────────────────────────────────

test('SUNBABY1 host: the sky controller draws the flower sky over the sky and its clouds, hazes the fog and the water toward it, and while it is staged stands the sky\'s frame on the clear day (mutants: the pass not drawn; the fog unhazed; the storm cells kept)', () => {
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /if \(clouds\) \{ clouds\.update\(viewport\); clouds\.draw\(yaw, pitch, fovY, aspect\); \}[^\n]*\n\s*if \(sunbabyW > 0\) sunbabySky\?\.draw\(yaw, pitch, fovY, aspect\);/, 'after the clouds, before the host\'s marker');
  assert.match(shared, /setSunbaby\(w, on = false\) \{\s*sunbabyW = Math\.max\(0, Math\.min\(1, Number\(w\) \|\| 0\)\);\s*sunbabyOn = !!on;\s*if \(sunbabyW > 0\) \{ const p = sunbabyPass\(\); if \(p\) p\.weight = sunbabyW; \}\s*else if \(sunbabySky\) sunbabySky\.weight = 0;/);
  assert.match(shared, /try \{ sunbabySky = new SunbabySkyRenderer\(gl\); \} catch/, 'built the first time it shows, and a failed build costs the flowers, never the frame');
  assert.match(shared, /const c = sunbabyW > 0 \? sunbabyHaze\(own, sunbabyW, sunbabyEvil\) : own;[^\n]*\n\s*const d = dreadW > 0 \? dreadGrade\(c, dreadW\) : c;/, 'the fog');   // SUNBABY2 moved it: the wrath's horizon; SD19 (PIN MOVED): the brass graded over it
  assert.match(shared, /const dreaded = \(ws\) => sunbabyWaterSky\(dreadW > 0 \? [^\n]*: ws, sunbabyW, sunbabyEvil\);/, 'the water, on either lane');   // SUNBABY2 moved it: the wrath's sky
  assert.match(shared, /use\(skyIndex, minuteOfDay, showNightSky = true, extra = null\) \{\s*if \(sunbabyOn && extra\) extra = \{ \.\.\.extra, violence: extra\.weather, cells: null, cloudBase: null, approach: 0 \};/, 'no storm cell, no violence, no front under the sun baby');
});

test('SUNBABY1 host: world.js hears the sun baby on the hub\'s one onEvent, SHOWS the clear day through every door the weather is applied by (never the sim\'s word), stills the far storms, lifts the light, sets the sky before its frame, and says a word an older relay does not know in words (mutants: the weather left; the hub word unheard; the storms; the light; the sky never told; the word sent to an old relay)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /const shownWeather = \(\) => \(sunbaby\.on \? SUNBABY_WEATHER : currentWeather\(\)\);/);
  assert.equal((world.match(/applyWeather\(currentWeather\(\)\)/g) ?? []).length, 0, 'no door applies the sim\'s word past the event');
  assert.equal((world.match(/if \(shownWeather\(\) !== weather\) applyWeather\(shownWeather\(\)\);/g) ?? []).length, 3, 'the frame\'s drain, the teleport\'s and the travel\'s');
  assert.match(world, /link\.onEvent = \(ev, o\) => \{ dread\.set\(ev, o\); sunbaby\.set\(ev, o\); \};/);
  assert.match(world, /const sunbabyW = sunbaby\.tick\(dt\);/);
  assert.match(world, /if \(isEnhanced\(\) && !weatherOverride && !sunbaby\.on\) \{[^\n]*\n\s*const ds = distantStorms\.tick\(/);
  assert.match(world, /sunbabyLight\(dreadLight\(withMoonAmbient\(exteriorAmbient\([\s\S]*?\), moonNow\), skyDreadW\), sunbabyW, sunbabyFace\.evil\), sdAirW\), sunScale\(minute\)/);   // SUNBABY2 moved it: the wrath; SD19 (PIN MOVED): leaning brass near a Hollow
  const set = world.indexOf('sky.setSunbaby(sunbabyW, sunbaby.on);');
  assert.ok(set > 0 && set < world.indexOf('sky.use(('), 'before the sky\'s frame reads it');
  assert.match(world, /if \(staged\.kind && !relayKnowsLiveEvent\(hub\.eventV, staged\.kind\)\) return say\('The server cannot stage that event yet\.'\);/);
  assert.ok(world.indexOf('relayKnowsLiveEvent(hub.eventV') < world.indexOf('return hub.sendStage(staged.kind);'));
});
