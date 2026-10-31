// AUDIT HELM-SIGHT (bible/01-Overview/audits/Audit-Helm-Sight.md): the world host's halves of its findings, read off
// src/scenes/world.js (and the loops' frame its HOST-SPLIT moved to src/scenes/csaAudio.js) as
// test/scenes/fb1011_helmjump.test.js reads the teleport core. The runtime's halves are
// test/systems/comeSailAway/audit_helmsight.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const body = (src, head) => {
  const at = src.indexOf(head);
  assert.ok(at >= 0, `${head} stands`);
  const ends = ['\n  }\n', '\n  };\n'].map((e) => src.indexOf(e, at)).filter((i) => i > at);
  return src.slice(at, Math.min(...ends));
};

test('AUDIT HELM-SIGHT A1: a party\'s wait holds the mod\'s frame - the runtime lets a helm held from another pixel go only when it runs again, after the landing\'s word', () => {
  const w = read('src/scenes/world.js');
  const core = body(w, '  async function _teleportToPixel(');
  assert.match(core, /if \(unstreamed\) \{[^\n]*resolveArrival = null; \}/, 'the reason: no landing is resolved, so its let-go never runs');
  assert.match(w, /const paused = gamePaused\(\) \|\| _loading \|\| _partyArrivalPending \|\| _etherCrossing;/, 'held while the arrival is pending');
  const travel = body(w, '  async function fastTravelTo(');
  assert.ok(travel.includes('_partyArrivalPending = partyArrival;') && travel.includes('_partyArrivalPending = false'), 'set for the journey and lifted at its end');
});

test('AUDIT HELM-SIGHT A4: a boat whose helm is held from another pixel is in sight but not heard - the loops\' frame stops her channels', () => {
  const w = read('src/scenes/csaAudio.js');   // HOST-SPLIT moved the loops' frame out of world.js
  const frame = body(w, '  function csaAudioFrame() {');
  assert.match(frame, /if \(!src\.isPlaying \|\| !node\?\.activeInHierarchy \|\| boat\.helmAfar\) \{\n\s*if \(ch\) \{\n\s*ch\.handle\?\.stop\(\);\n\s*_csaLoops\.delete\(src\);\n\s*\}\n\s*continue;\n\s*\}/);
});
