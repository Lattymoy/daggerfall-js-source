import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
function lifted(name, next, scope) {
  const start = world.indexOf(`  function ${name}(`);
  const end = world.indexOf(next, start);
  assert.ok(start > 0 && end > start);
  return new Function('scope', `with (scope) { ${world.slice(start, end)}; return ${name}; }`)(scope);
}

test('a first-person boat journey hides manual helm controls until the journey ends', () => {
  const drawn = [], holder = { ui: { isShowing: true } };
  const scope = { csaRuntime: { helmPanelState: () => ({ hull: 2 }) }, csaOn: () => true, isEnhancedPlus: () => true,
    document: {}, walkMode: true, enhancedHelmMounted: () => false, hideEnhancedHelm: () => {}, csaHelmInput: { held: new Set() },
    csaCall: f => f(), csaAboard: { aboard: null }, drawEnhancedHelm: state => drawn.push(state), peerName: x => x,
    townTalk: { hudCovered: false }, modes: { hudCovered: false }, gamePaused: () => false, hudRenderEnabled: () => true, touch: null,
    cursorActive: () => true, pointerSurfaces: new Set(), csaKeyLabel: () => '', csaHelmHooks: {}, travelView: { active: false },
    navalOn: () => true, _travelUIHolder: holder };
  const draw = lifted('csaDrawHelmPanel', '\n  /** AUDIT HCC', scope);
  draw(); assert.equal(drawn.at(-1).covered, true);
  holder.ui.isShowing = false;
  draw(); assert.equal(drawn.at(-1).covered, false);
});

test('a failed boat landfall never packs the boat without putting the player ashore', () => {
  for (const [dry, packable, passengers] of [[false, true, 0], [false, false, 0], [true, true, 0], [true, false, 0], [true, true, 1]]) {
    const boat = { GameObject: { position: [0, 0, 0], rotation: [0, 0, 0, 1] }, packable };
    const events = [];
    let journey;
    const travelControlUI = new TravelControlUI({ onClose: () => { events.push('stopped'); journey.interruptTravel(); } });
    journey = createTravelOptions({ settings: readTravelOptionsSettings(), ui: travelControlUI, pushWindow: w => w.show(), setTimeScale: () => {} });
    journey.beginTravelToCoords({ x: 501, y: 250 });
    const scope = { tvSea: { boat, phase: 'landing', means: { again: true } },
      csaRuntime: { AllBoats: [boat], deedMissing: () => false, partsTooHeavy: () => false, PackBoat: () => events.push('packed') },
      csaQuatRotate: () => [0, 0, 1], TV_SEA_ASHORE_M: 40, tvSeaWaterAt: () => !dry, heightAt: () => 2, tvSeaY: () => 0,
      player: { spawn: () => events.push('ashore') }, csaPassengersOn: () => passengers, csaCall: f => f(),
      travelControlUI, tvSeaRelease: () => {}, tvSay: line => { if (line !== 'No safe shore.') events.push('moored'); },
      TRAVEL_VIEW_TEXT: { noShore: 'No safe shore.', leftMoored: 'moored' } };
    scope.tvSeaStop = lifted('tvSeaStop', '\n  /** The leg', scope);
    lifted('tvSeaAshore', '\n  /** A sea leg', scope)();
    assert.deepEqual(events, dry ? ['ashore', packable && passengers === 0 ? 'packed' : 'moored'] : ['stopped'], dry ? 'normal dry landing packs only eligible empty boats' : 'failed landing keeps boat and stops');
    if (!dry) {
      assert.equal(travelControlUI.isShowing, false);
      assert.equal(journey.state.autopilot, null, 'no continuing drive into water after failed landing');
      assert.equal(scope.tvSea.means, null);
    } else if (!packable || passengers > 0) assert.equal(scope.tvSea.means.again, false);
  }
});
