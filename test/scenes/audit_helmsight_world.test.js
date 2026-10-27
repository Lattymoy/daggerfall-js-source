// AUDIT HELM-SIGHT (bible/01-Overview/audits/Audit-Helm-Sight.md): the world host's halves of its findings, read off
// src/scenes/world.js as test/scenes/fb1011_helmjump.test.js reads the teleport core. The runtime's halves are
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
const LET_GO = '        if (csaRuntime?.isSailing()) csaCall(() => csaRuntime.OnPreFastTravel());';

test('AUDIT HELM-SIGHT A1: a party\'s journey lets the helm go once its jump is made - the core takes the landing\'s word away for a pixel this client does not stream', () => {
  const w = read('src/scenes/world.js');
  const core = body(w, '  async function _teleportToPixel(');
  assert.match(core, /if \(unstreamed\) \{[^\n]*resolveArrival = null; \}/, 'the reason: no landing is resolved, so its let-go never runs');
  const travel = body(w, '  async function fastTravelTo(');
  const jumpAt = travel.indexOf('await _teleportToPixel(pick.pixel.x, pick.pixel.y, null,');
  const armAt = travel.indexOf('      if (partyArrival) {\n        payFare();', jumpAt);
  const letGo = travel.indexOf(LET_GO, armAt);
  assert.ok(jumpAt > 0 && armAt > jumpAt, 'the party\'s arm after the jump');
  assert.ok(letGo > armAt && letGo < travel.indexOf('\n      }\n', armAt), 'the helm let go in that arm');
  assert.ok(!travel.slice(armAt, letGo).includes('await '), 'before anything awaits: the frames under a wait must find no helm to pin to');
  assert.ok(letGo < travel.indexOf('_partyArrivalPending = false'), 'while the mod\'s frame is still held for the arrival');
  assert.equal(travel.split(LET_GO).length - 1, 1, 'once');
});

test('AUDIT HELM-SIGHT A4: a boat whose helm is held from another pixel is in sight but not heard - the loops\' frame stops her channels', () => {
  const w = read('src/scenes/world.js');
  const frame = body(w, '  function csaAudioFrame() {');
  assert.match(frame, /if \(!src\.isPlaying \|\| !node\?\.activeInHierarchy \|\| boat\.helmAfar\) \{ if \(ch\) \{ ch\.handle\?\.stop\(\); _csaLoops\.delete\(src\); \} continue; \}/);
});
