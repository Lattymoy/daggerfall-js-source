// AUDIT NAV2 (2026-09-30) - THE HELM, the naval second pass's deep audit: Come Sail Away's helm under the port's Ship
// handling, the Overworld's crossing at it, the panel and the sail keys under a journey, the in-irons word, the
// responsive helm's measured figures, and the guns' hold on the readout's own key. Driven on the real runtime
// (test/csaScene.mjs), the real naval host (test/navalSea.mjs) and the world's own lines, lifted.
//
//   F14 - the Ship handling is taken ONCE A HELM SESSION (at StartSailing, let go when she stops sailing): read live, a
//         Carrack under way when it turned Classic froze for good at the helm (her next hold of 0 times every rate)
//   F15 - in irons reads her way through the water, not the sea's current (with the mod's default waves it never fired)
//   F16 - the Overworld's crossing takes the Carrack wherever the responsive helm sails her
//   F17 - under the travel view (a journey holds the helm) the panel is covered and the sail keys stand down
//   F18 - the in-irons advice is the helm's own: the mod's strikes sail and rows (SAIL-FREE: the responsive lies in none)
//   F20 - helmWay.js's measured figures, like-for-like at 1/60 s frames, every one at its speed
//   F31 - Interact, the readout's "E: hold fire", holds fire while the guns are laid; the host never grapples then
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as CSA from '../src/systems/comeSailAway.js';
import { BOAT_ACTIONS } from '../src/systems/comeSailAway.js';
import { helmHint } from '../src/ui/enhancedHelm.js';
import { navalHudText } from '../src/ui/navalHud.js';
import { FEATURES } from '../src/systems/features.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { quatRotate } from '../src/world/quat.js';
import { scene } from './csaScene.mjs';
import { sea } from './navalSea.mjs';

const HULL = Object.freeze({ Rowboat: 0, LargeBoat: 1, SmallShip: 2, LargeGalley: 3, Carrack: 4 });
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = src('src/scenes/world.js');
const near = (a, b, eps, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} vs ${b} (±${eps})`);
/** One whole line of world.js, found by its start. */
const line = (start) => { const i = WORLD.indexOf(start); assert.ok(i >= 0, `${start} is in world.js`); return WORLD.slice(i, WORLD.indexOf('\n', i) + 1); };
/** A two-space-indented function of world.js's, whole. */
const fn = (name) => { const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(WORLD); assert.ok(m, name); return m[0]; };
/** csa_together.test.js's: a scope the lifted text reads its names from (the rest are the page's globals). */
function mount(scope, code, name) {
  const proxy = new Proxy(scope, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { ${code}\n return ${name}; }`)(proxy);
}

/** A helm on `hull` (csaScene's quarter-second frames unless `dt`), the Ship handling read live off `hand.now`, the
 *  wind held where it blows each frame. */
function helmOn(hull, { handling = 'responsive', wind = [1.5, 0, 0], settings, dt } = {}) {
  const s = scene(settings ? { settings } : {});
  const hand = { now: handling };
  s.deps.handling = () => hand.now;
  if (dt) s.deps.dt = () => dt;
  const step = dt ?? 0.25;
  const boat = s.helm(s.place(hull, 0));
  s.rt.RaiseSails();
  const run = (secs, each) => {
    for (let t = 0; t < secs - 1e-9; t += step) {
      s.rt.state.windVectorCurrent = [...wind];
      s.rt.state.windVectorTarget = [...wind];
      s.frame();
      each?.();
    }
  };
  const way = () => Math.hypot(...s.rt.state.MoveVectorCurrent);
  const heading = () => { const fw = quatRotate(boat.GameObject.rotation, [0, 0, 1]); return (Math.atan2(fw[0], fw[2]) * 180) / Math.PI; };
  return { s, boat, hand, run, way, heading };
}

// ── F14 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F14 the Ship handling is taken once a helm session: a Carrack under way when the Features row turns Classic keeps this helm\'s hold at the next magic round - her helm and her sails still take her swing and her way off - and the next helm is the mod\'s own Carrack, which makes no way; Classic to Responsive waits for the next helm too; off the helm the row is read as it stands; the row says so (mutants: read live, never taken, kept past the helm, the row\'s old word)', () => {
  const h = helmOn(HULL.Carrack);
  h.run(15);
  assert.ok(h.way() > 8, `the responsive helm sails her (${h.way()} m/s)`);
  h.s.held.add('MoveRight');
  h.run(2);
  assert.ok(Math.abs(h.s.rt.state.TurnCurrent) > 3, 'the helm over');
  h.hand.now = 'classic';   // Features > Ship handling flipped, mid-voyage
  h.s.rt.OnNewMagicRound();   // the next game minute weighs her hold again (UpdateBoatCargoMod)
  h.s.held.clear();
  assert.ok(h.s.rt.state.boatCargoMod > 0.9, `this helm's hold kept (${h.s.rt.state.boatCargoMod}) - read live it was the mod's 0, every rate times it`);
  h.run(10);
  near(h.s.rt.state.TurnCurrent, 0, 1e-6, 'the helm let go: her swing comes off');
  h.s.rt.LowerSails();
  h.run(30);
  assert.ok(h.way() < 0.01, `sails struck: her way comes off (${h.way()} m/s)`);
  assert.equal(h.s.rt.helmResponsive?.(), true, 'this helm keeps its word');
  // the next helm: Classic, the mod's own Carrack - no hold, no way, and none carried in
  h.s.rt.StopSailing();
  assert.equal(h.s.rt.helmResponsive?.(), false, 'off the helm the row is read as it stands');
  h.s.helm(h.boat);
  h.s.rt.RaiseSails();
  h.run(10);
  assert.equal(h.s.rt.state.boatCargoMod, 0, 'the mod\'s missing Cargo node: a hold of 0');
  assert.equal(h.way(), 0, 'a Carrack under Classic makes no way');
  // Classic to Responsive mid-session: still the mod's until the helm is taken again
  h.hand.now = 'responsive';
  h.s.rt.OnNewMagicRound();
  h.run(5);
  assert.equal(h.s.rt.state.boatCargoMod, 0);
  assert.equal(h.way(), 0);
  h.s.rt.StopSailing();
  h.s.helm(h.boat);
  h.s.rt.RaiseSails();
  h.run(15);
  assert.ok(h.s.rt.state.boatCargoMod > 0.9 && h.way() > 8, 'the next helm: responsive');
  // every rate keeps the session's word, not the hold alone: a Small Ship's sails
  const ss = helmOn(HULL.SmallShip);
  const quick = ss.s.rt.properties.moveAccel();
  ss.hand.now = 'classic';
  near(ss.s.rt.properties.moveAccel(), quick, 1e-9, 'mid-voyage: this helm\'s rate');
  ss.s.rt.StopSailing();
  ss.s.helm(ss.boat);
  ss.s.rt.RaiseSails();
  assert.ok(ss.s.rt.properties.moveAccel() < quick / 2, 'the next helm: the mod\'s');
  // the Features row's own word
  const row = FEATURES.find((r) => r.id === 'naval-combat');
  assert.match(row.effect, /Ship handling, the next time you take the helm/);
  assert.doesNotMatch(row.effect, /^Takes effect at once\. /, 'not "at once" for all of it');
});

// ── F15 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F15 in irons with the mod\'s own waves (Waves.Enable, its default): the sea\'s current rides in her velocity, half the wind - her way through the water is what is read, so a hull lying head to wind is told and the panel says so; under the responsive helm (SAIL-FREE) her own way ahead is her canvas\'s, up into the wind, and nothing is told (mutants: the current counted)', () => {
  for (const handling of ['classic', 'responsive']) {
    const h = helmOn(HULL.SmallShip, { handling, wind: [0, 0, -1.5], settings: { 'Waves.Enable': true } });   // blowing to her stern: dead ahead
    let told = null, t = 0;
    h.run(CSA.IRONS_TELL_S + 3, () => { t += 0.25; if (told == null && h.s.out.hud.some((x) => /^In irons/.test(x))) told = t; });
    assert.ok(Math.hypot(...h.s.rt.state.velocityCurrent) >= CSA.IRONS_TELL_WAY, `${handling}: the current rides in her velocity (${Math.hypot(...h.s.rt.state.velocityCurrent)} m/s)`);
    if (handling === 'responsive') {
      // PIN MOVED (SAIL-FREE, 2026-10-05, Mac's "No tacking, Black Flag"): her canvas draws in the wind's eye and drives
      // her up into it - no irons to tell
      assert.ok(h.s.rt.state.MoveVectorCurrent[2] > 10 * CSA.IRONS_TELL_WAY, `responsive: her own way ahead, into the wind (${h.s.rt.state.MoveVectorCurrent[2]})`);
      assert.equal(told, null, 'responsive: nothing told');
      assert.equal(h.s.rt.helmPanelState().inIrons, false, 'responsive: the panel says nothing');
      continue;
    }
    // PIN MOVED (GALLEON, 2026-10-01): her own way AHEAD nothing - the new galleon's gaff and staysail come aback in the
    // wind's eye (the mod's GetSailPower; her square canvas is stowed there by the default assist - AUDIT GALLEON T6) and
    // drive her astern, where the mod's lateens only stood idle
    assert.ok(h.s.rt.state.MoveVectorCurrent[2] < CSA.IRONS_TELL_WAY, `${handling}: her own way ahead nothing (${h.s.rt.state.MoveVectorCurrent[2]})`);
    assert.ok(told != null && told <= CSA.IRONS_TELL_S + 0.5, `${handling}: told after the dwell (${told})`);
    assert.equal(h.s.rt.helmPanelState().inIrons, true, `${handling}: the panel says it`);
  }
});

// ── F16 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F16 the Overworld\'s crossing, lifted from the world: the Carrack crosses wherever the responsive helm sails her - the runtime\'s own word on the handling (this helm\'s while one is taken, else the row\'s) - and never under the mod\'s own; the Rowboat never, the Large Boat always (mutants: the Carrack refused, any handling taken)', () => {
  const body = `${line('  const tvSeaCrosses = (rig) =>')}${line('  const tvSeaRig = (b) =>')}return { tvSeaCrosses, tvSeaRig };`;
  const s = scene();
  const hand = { now: 'responsive' };   // the world's own default (world.js: getPref('naval-handling') ?? 'responsive')
  s.deps.handling = () => hand.now;
  // eslint-disable-next-line no-new-func
  const { tvSeaCrosses, tvSeaRig } = new Function('csaRuntime', body)(s.rt);
  const boats = Object.fromEntries(Object.entries(HULL).map(([k, v]) => [k, s.place(v, 0)]));
  const crosses = (k) => tvSeaCrosses(tvSeaRig(boats[k]));
  assert.equal(crosses('Carrack'), true, 'moored in reach, the responsive helm: she sails, so she crosses');
  assert.equal(crosses('LargeBoat'), true);
  assert.equal(crosses('Rowboat'), false, 'no sail, no crew');
  hand.now = 'classic';
  assert.equal(crosses('Carrack'), false, 'the mod\'s own: she makes no way');
  assert.equal(crosses('LargeBoat'), true);
  // at her helm, the session's word: taken responsive, the row turned Classic under her - she still sails this helm
  hand.now = 'responsive';
  s.helm(boats.Carrack);
  hand.now = 'classic';
  assert.equal(crosses('Carrack'), true, 'this helm sails her');
  s.rt.StopSailing();
  assert.equal(crosses('Carrack'), false, 'the helm left: the row\'s Classic');
  assert.equal(tvSeaCrosses(null), false);
});

// ── F17 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F17 a journey holds the helm under the travel view: the helm panel, lifted from the world, is covered there - its line taught keys the view had taken, its buttons set sail against the journey - and shows again when the view is down (mutants: the panel under the view)', () => {
  const drawn = [];
  const travelView = { active: true };
  const scope = {
    csaRuntime: { helmPanelState: () => ({ hull: 2, hasSails: true, inIrons: false }) }, csaOn: () => true, isEnhancedPlus: () => true,
    document: {}, walkMode: true, enhancedHelmMounted: () => false, hideEnhancedHelm: () => {}, csaHelmInput: { held: new Set() },
    csaCall: (f) => f(), csaAboard: { aboard: null }, drawEnhancedHelm: (state) => drawn.push(state), peerName: (x) => x,
    townTalk: { hudCovered: false }, modes: { hudCovered: false }, gamePaused: () => false, hudRenderEnabled: () => true, touch: null,
    cursorActive: () => true, pointerSurfaces: new Set(), csaKeyLabel: () => '', csaHelmHooks: {}, travelView, _travelUIHolder: { ui: null },
    navalOn: () => true,   // PIN MOVED (SHIP-CREW): the panel's Orders button asks whether the naval arc is on
  };
  const draw = mount(scope, fn('csaDrawHelmPanel'), 'csaDrawHelmPanel');
  draw();
  assert.equal(drawn.at(-1).covered, true, 'under the travel view: covered');
  travelView.active = false;
  draw();
  assert.equal(drawn.at(-1).covered, false, 'the view down: the panel again');
});

test('AUDIT NAV2 F17 the sail keys stand down under the travel view, as the turn keys do: More sail, Less sail and the mod\'s own sail key pressed on the keyboard reach the mod no longer there - the journey\'s own press through the helm\'s seam still does, and every other helm key still presses; the view down, the sail keys are the helm\'s again (mutants: the keys under the view, the journey\'s press refused)', () => {
  const edges = new Set();
  const travelView = { active: true };
  const scope = {
    keys: new Set(), latch: { edge: { downFrame: edges } }, pressed: (e, _k, a) => e.downFrame.has(a),
    csaHelmInput: { edges: new Set(), chord: new Set(), held: new Set() }, travelView, CSA_BOAT_ACTIONS: BOAT_ACTIONS,
  };
  const { started } = mount(scope, `const __i = { ${line('      started: (action) =>')} };`, '__i');
  const sail = [BOAT_ACTIONS.sailUp, BOAT_ACTIONS.sailDown, BOAT_ACTIONS.toggleSail];
  for (const a of [...sail, BOAT_ACTIONS.toggleLight, BOAT_ACTIONS.disembark]) edges.add(a);
  for (const a of sail) assert.equal(started(a), false, `${a} pressed under the view: the journey's hand sets the sails`);
  assert.equal(started(BOAT_ACTIONS.toggleLight), true, 'the lanterns still the key\'s');
  assert.equal(started(BOAT_ACTIONS.disembark), true, 'leaving the helm still the key\'s');
  scope.csaHelmInput.edges.add(BOAT_ACTIONS.toggleSail);   // world.js tvSeaSail: csaHelmPress(CSA_BOAT_ACTIONS.toggleSail)
  edges.delete(BOAT_ACTIONS.toggleSail);
  assert.equal(started(BOAT_ACTIONS.toggleSail), true, 'the journey\'s own press reaches the mod');
  scope.csaHelmInput.edges.clear();
  edges.add(BOAT_ACTIONS.toggleSail);
  travelView.active = false;
  for (const a of sail) assert.equal(started(a), true, `${a}: the view down, the helm's key again`);
});

// ── F18 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F18 the in-irons word is the helm\'s own: under the mod\'s own nothing turns a hull with no way, so she is told to strike sail and row, and the panel\'s line says so with the keys; under the responsive helm (SAIL-FREE) she is never in irons - her canvas drives her up into the wind\'s eye, and with no way at all (her canvas shot away) the wind is not what holds her: nothing told, the panel quiet - and the helm alone still brings her off the eye (mutants: the responsive helm in irons)', () => {
  for (const handling of ['classic', 'responsive']) {
    const h = helmOn(HULL.SmallShip, { handling, wind: [0, 0, -1.5] });
    h.run(CSA.IRONS_TELL_S + 1);
    // PIN MOVED (SAIL-FREE, 2026-10-05, Mac's "No tacking, Black Flag"): the responsive helm's word ("put the helm over",
    // IRONS_HELM_TEXT) went with its irons - she sails up into the wind's eye
    assert.equal(h.s.out.hud.filter((x) => /^In irons/.test(x)).at(-1), handling === 'classic' ? CSA.IRONS_TEXT : undefined, `${handling}: told`);
    assert.equal(h.s.rt.helmPanelState().inIrons, handling === 'classic', `${handling}: the panel`);
    // the helm alone
    h.s.held.add('MoveRight');
    let off = null, t = 0;
    h.run(20, () => { t += 0.25; if (off == null && Math.abs(h.heading()) > CSA.IRONS_TELL_DEG) off = t; });
    if (handling === 'responsive') assert.ok(off != null && off < 15, `the helm over brings her ${CSA.IRONS_TELL_DEG} degrees off the eye (${off} s)`);
    else assert.equal(off, null, 'the mod\'s rudder waits on her way: she lies there');
  }
  // no way at all under the responsive helm - her canvas shot away (the sea fight's wayScale) - lying head to wind
  const bare = helmOn(HULL.SmallShip, { wind: [0, 0, -1.5] });
  bare.s.deps.wayScale = () => 0;
  bare.run(CSA.IRONS_TELL_S + 1);
  assert.ok(bare.way() < CSA.IRONS_TELL_WAY && bare.s.rt.state.sailPosition > 0, `no way, her sails up (${bare.way()})`);
  assert.equal(bare.s.out.hud.some((x) => /^In irons/.test(x)), false, 'the wind is not what holds her: no irons told');
  assert.equal(bare.s.rt.helmPanelState().inIrons, false);
  assert.equal('IRONS_HELM_TEXT' in CSA, false, 'no word left for a helm that lies in no irons');
  const keyOf = (a) => ({ BoatSailUp: 'UP', BoatSailDown: 'DOWN', TurnLeft: 'LEFT', TurnRight: 'RIGHT', MoveForwards: 'W', MoveBackwards: 'S' })[a] ?? '';
  const irons = { hull: 2, hasSails: true, inIrons: true };
  // PIN MOVED (HELM-LADDER): one rung down strikes the last of her sail and puts her on her oars - its two keys, no row key
  assert.equal(helmHint(irons, { keyOf, mouseFree: true }), 'In irons - strike sail (S DOWN) and row her round', 'the mod\'s own helm: as it was');
  assert.equal(helmHint(irons, { touch: true }), 'In irons - strike sail and row her round', 'a finger: the words alone');
});

// ── F20 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F20 helmWay.js\'s measured figures are the runtime\'s, like-for-like - 1/60 s frames, waves off, a 1.5 m/s wind on her beam - every one at its speed: the mod\'s Small Ship to her full way and to rest, the responsive helm\'s, the rudder at named ways, two seconds from rest (mutants: an old figure back)', () => {
  const DT = 1 / 60;
  const header = src('src/systems/helmWay.js').split('export const HELM_WAY')[0]
    .split('\n').map((l) => l.replace(/^\/\/\s?/, '')).join(' ').replace(/\s+/g, ' ');
  const stated = (re) => { const m = re.exec(header); assert.ok(m, `helmWay.js states ${re}`); return m.slice(1).map(Number); };
  /** From rest with her sails set: to her full way, then struck - to rest, and how far. */
  const wayRun = (handling) => {
    const h = helmOn(HULL.SmallShip, { handling, dt: DT });
    const top = () => Math.hypot(...h.s.rt.state.velocityTarget);
    let t = 0, full = null;
    while (full == null && t < 60) { h.run(DT); t += DT; if (top() > 1 && h.way() >= top() - 1e-4) full = t; }
    const v = top();
    h.s.rt.LowerSails();
    const p0 = [...h.boat.GameObject.position];
    let rest = null;
    t = 0;
    while (rest == null && t < 60) { h.run(DT); t += DT; if (h.way() <= 1e-4) rest = t; }
    const p = h.boat.GameObject.position;
    return { top: v, full, rest, dist: Math.hypot(p[0] - p0[0], p[2] - p0[2]) };
  };
  const classic = wayRun('classic'), quick = wayRun('responsive');
  const [cFull, cTop, cRest, cDist] = stated(/Small Ship took ([\d.]+) s to her full way of ([\d.]+) m\/s and ([\d.]+) s \(([\d.]+) m\) to lose it/);
  near(cFull, classic.full, 0.1, 'the mod\'s: to her full way');
  near(cTop, classic.top, 0.05, 'her full way');
  near(cRest, classic.rest, 0.1, 'the mod\'s: to rest');
  near(cDist, classic.dist, 1, 'over');
  const [qFull, qRest, qDist] = stated(/a Small Ship ([\d.]+) s to her full way, ([\d.]+) s \(([\d.]+) m\) to lose it/);
  near(qFull, quick.full, 0.1, 'the responsive helm: to her full way');
  near(qRest, quick.rest, 0.1, 'the responsive helm: to rest');
  near(qDist, quick.dist, 1, 'over');
  /** Her rudder's steady answer at a way held (her way pinned each frame): deg/s, and the circle it sails. */
  const rudder = (handling, v) => {
    const h = helmOn(HULL.SmallShip, { handling });
    h.s.held.add('MoveRight');
    for (let i = 0; i < 80; i++) { h.s.rt.state.MoveVectorCurrent = [0, 0, v]; h.run(0.25); }
    const rate = Math.abs(h.s.rt.state.TurnCurrent);
    return { rate, circle: (2 * v) / ((rate * Math.PI) / 180) };
  };
  const [atRest, r45, v45, c45, rFull, vFull, cFullWay, r9, v9, c9] = stated(/a Small Ship ([\d.]+) deg\/s at rest, ([\d.]+) at ([\d.]+) m\/s \(a ([\d.]+) m circle\), ([\d.]+) at her full way of ([\d.]+) m\/s \(a ([\d.]+) m circle\), ([\d.]+) at ([\d.]+) m\/s \(([\d.]+) m\)/);
  near(atRest, rudder('responsive', 0).rate, 0.01, 'at rest');
  for (const [r, v, c] of [[r45, v45, c45], [rFull, vFull, cFullWay], [r9, v9, c9]]) {
    const m = rudder('responsive', v);
    near(r, m.rate, 0.06, `at ${v} m/s`);
    near(c, m.circle, 1, `its circle at ${v} m/s`);
  }
  // PIN MOVED (SAIL-FREE, 2026-10-05): her full way is the responsive helm's own - SAIL-FREE's, where it was the mod's
  near(vFull, quick.top, 0.05, 'her full way is the one measured');
  const [modFull] = stated(/0\.75 deg\/s at 1 m\/s, ([\d.]+) at her full way/);
  near(modFull, rudder('classic', classic.top).rate, 0.06, 'the mod\'s at her full way');
  const fromRest = (handling) => {
    const h = helmOn(HULL.SmallShip, { handling, dt: DT });
    h.s.rt.state.MoveVectorCurrent = [0, 0, 0];
    h.s.held.add('MoveRight');
    h.run(2);
    return Math.abs(h.s.rt.state.TurnCurrent);
  };
  const [swing, modSwing] = stated(/two seconds from rest with the helm over she swings ([\d.]+) deg\/s \(the mod's ([\d.]+)\)/);
  near(swing, fromRest('responsive'), 0.05, 'two seconds from rest');
  near(modSwing, fromRest('classic'), 0.01, 'the mod\'s');
  assert.doesNotMatch(header, /29\.8 s|45 s \(200 m\)|8\.5 s to her full way|15 s to lose it|half her way, 124 m at full/, 'no figure that did not reproduce');
});

// ── F31 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT NAV2 F31 the frame\'s gate, lifted from the world: while the guns are laid Interact - the readout\'s "E: hold fire" - holds fire as Activate does, spent before a patch or the ladder (whose naval arm grappled a struck ship with a broadside owed on the release); with nothing laid E is the ladder\'s as ever (mutants: E not the hold, the patch taking the hold\'s press)', () => {
  const start = WORLD.indexOf('        // GUN-HOLD: Activate while the guns are laid holds fire');
  // PIN MOVED (the merge with AUDIT 32 H5: a click mid-act is the act's; AUDIT 2026-10-01 part four CLICK-LIFT: and the
  // click an act took, to its release - `_activateDown` the gate's press, handed in)
  // PIN MOVED (PROF-MENU: a click a profession node's list took is the list's - `nodeClicked`)
  const ifLine = '        if (((_act.activate && !gatherHost?.acting() && !_actClick && !nodeClicked) || (useEdge && !nodeTook)) && !modes.transitioning && !_holdFire) {';
  const end = WORLD.indexOf(ifLine, start);
  assert.ok(start > 0 && end > start, 'the gate is where it was');
  const cond = ifLine.trim().slice('if ('.length, -') {'.length);
  // eslint-disable-next-line no-new-func
  const gate = new Function('_act', 'naval', 'magic', 'gatherHost', 'travelView', 'pressed', 'latch', 'keys', 'modes', '_activateDown',
    `${WORLD.slice(start, end)}return { holdFire: _holdFire, nodeTook, ladder: !!(${cond}) };`);
  const run = ({ activate = false, cast = false, e = false, aiming = true } = {}) => {
    const calls = [];
    const naval = { aiming, holdFire() { calls.push('holdFire'); return aiming; } };
    const gatherHost = { acting: () => false, press: () => { calls.push('patch'); return false; }, clickTaken: () => false };
    const r = gate({ activate, cast }, naval, { interceptAttack: () => calls.push('cast') }, gatherHost, null, (_e, _k, a) => e && a === 'Interact', { edge: null }, null, { transitioning: false }, activate);
    return { ...r, calls };
  };
  const laidE = run({ e: true });
  assert.equal(laidE.holdFire, true, 'E with the guns laid: the hold');
  assert.equal(laidE.ladder, false, 'and the ladder does not run - no grapple thrown');
  assert.deepEqual(laidE.calls, ['holdFire'], 'nothing else took the press');
  const laidClick = run({ activate: true });
  assert.equal(laidClick.holdFire, true, 'Activate\'s click: the hold, as ever');
  assert.equal(laidClick.ladder, false);
  const bareE = run({ e: true, aiming: false });
  assert.equal(bareE.holdFire, false, 'nothing laid: not the hold\'s');
  assert.equal(bareE.ladder, true, 'E is the ladder\'s - a grapple, a heave-to, the yard');
  assert.deepEqual(bareE.calls, ['patch'], 'a patch asked first, as ever');
  // the readout names the key that holds: Interact's
  assert.match(line('        : { aim: navalKeyName(\'SwingWeapon\'),'), /board: navalKeyName\('Interact'\)/);
  const helm = { ship: { name: 'Small Ship', hull: 0.8, sail: 0.5, crew: 0.9, fire: false, wrecked: false, braced: false }, armed: true, aiming: true, aim: null, board: { name: 'The Red Wake', kind: 'board' }, boarding: null, target: null, batteries: [], notoriety: { crown: 'Wayrest', value: 0, level: 0 } };
  assert.equal(navalHudText(helm, { aim: 'RIGHT CLICK', board: 'E', brace: 'C' }).plate.hint, 'Let go to fire - E: hold fire');
});

test('AUDIT NAV2 F31 the naval host never throws the grapples while the guns are laid - defence in depth behind the world\'s gate: Activate there takes nothing, the aim stays laid and the release owes no broadside into a ship being hauled alongside; the hold put down, the same press boards her (mutants: the host boarding while laid)', async () => {
  const h = await sea({ hull: 2 });
  const id = h.host.spawnShip('merchantGalleon', { range: 26.8, bearing: Math.PI / 2, yaw: 0 });
  const e = h.host._sea.get(id);
  e.ship.pos = [26.8, 0, 0];
  h.host.frame(0.1);
  e.ship.damage.apply({ hull: Math.ceil(e.ship.damage.maxHull * 0.8), sail: 0, crew: 0 });
  h.host.frame(0.1);
  assert.equal(e.ship.damage.state, SHIP_STATES.struck, 'struck, in reach');
  h.host.attackInput(true);
  h.host.frame(0.1);
  assert.equal(h.host.aiming, true, 'laid');
  assert.equal(h.host.activate(), false, 'the guns laid: Activate is the hold\'s, never a grapple');
  assert.equal(h.host.boarding, null);
  assert.equal(h.host.aiming, true);
  assert.equal(h.host.holdFire(), true, 'the hold');
  const before = h.host._shots.inFlight;
  h.host.attackInput(false);
  assert.equal(h.host._shots.inFlight, before, 'the release owes nothing');
  assert.equal(h.host.activate(), true, 'nothing laid: the grapples');
  assert.equal(h.host.boarding?.kind, 'board');
});
