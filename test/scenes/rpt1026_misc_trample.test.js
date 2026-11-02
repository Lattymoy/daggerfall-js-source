// RPT1026-MISC JOURNEY-TRAMPLE (a private report: charged with Assault for an Overworld journey on horseback that passed
// through a town). Roleplay & Realism's Enhanced Riding tramples a townsperson a GALLOPING rider meets
// (rrRidingHost.js contacts, EnhancedRiding.OnTriggerEnter) and charges Assault for it (rrTrampleOutcome). A journey -
// the Overworld's view, or a Travel Options autopilot - drives the same motor at sixty or a hundred times the pace with
// the player's own Run and AutoRun keys in its input, so a player who journeyed with AutoRun on rode through a town's
// people at full gallop, unsteered, and was charged. The world host's frame now asks the trample only off the road.
// buildWorld is pinned by source, as rr2_realism.test.js pins this line; the outcome law is driven.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostText } from '../hostText.mjs';
import { rrTrampleOutcome } from '../../src/systems/roleplayRealism/rrRealism.js';

test('RPT1026-MISC JOURNEY-TRAMPLE: the trample a gallop through a town charges is Assault; the world host asks it only off the road - never under the Overworld\'s view or a journey\'s autopilot, whose motor gallops on the player\'s own Run and AutoRun (mutant: rpt1026-misc-trample-on-journey)', () => {
  assert.equal(rrTrampleOutcome({ isGuard: false }).crime, 'Assault', 'a townsperson under the hooves is an Assault');
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(rrRidingOn\(\) && player\.riding && player\.isRunning && !rideOnTheRoad\(\)\) rrRidingContacts\(\);/, 'off the road alone');
  assert.match(w, /const rideOnTheRoad = \(\) => !!travelView\?\.active \|\| !!\(travelOptions\?\.isTravelActive && travelOptions\.state\?\.autopilot\);/, 'the road: the Overworld\'s view, or an autopilot driving');
  // the cause: the journey's motor input is the autopilot's force with the player's own run keys - a held Run or AutoRun gallops it
  assert.match(w, /forward: axes\.forward,   \/\/ TO1: the autopilot's force while a journey runs, else the player's own[^\n]*\n\s*strafe: axes\.strafe,\n\s*run: held\(keys, 'Run'\),[\s\S]{0,200}?autoRun: held\(keys, 'AutoRun'\),/);
});
