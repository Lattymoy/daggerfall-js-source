// VOICE2 integration tests: verify the game-facing seam (voiceNet) works correctly. VOICE2's HUD indicator and settings
// rows (src/ui/voiceHud.js, src/ui/voiceSettings.js) wait for the slice that mounts them - AUDIT UI 2 holds every src/ui
// module reachable from a host (bible/11-Multiplayer/Voice-Arc.md section 5).
import test from 'node:test';
import assert from 'node:assert';
import { initVoiceNet, getVoiceNet, frameVoiceNet, destroyVoiceNet, saveVoiceSettings } from '../../../src/net/voice/voiceNet.js';
import { _resetForTests as _resetPrefsForTests } from '../../../src/systems/uiPrefs.js';

test('voiceNet: init and singleton', () => {
  const vc = initVoiceNet({
    mintToken: async () => null,
    audioContext: () => null,
    destination: null,
  });
  assert(vc, 'initVoiceNet returns a client');
  assert.strictEqual(getVoiceNet(), vc, 'getVoiceNet returns the same singleton');
  destroyVoiceNet();
  assert.strictEqual(getVoiceNet(), null, 'getVoiceNet returns null after destroy');
});

test('voiceNet: frame with room/party/position', () => {
  const vc = initVoiceNet({
    mintToken: async () => null,
    audioContext: () => null,
    destination: null,
  });
  frameVoiceNet({
    room: 'cell:1.2',
    party: null,
    position: [100, 0, 200],
    facing: 0,
    peers: [],
  });
  assert.strictEqual(vc.room, 'cell:1.2', 'room is set');
  assert.strictEqual(vc.party, null, 'party is null');
  assert.strictEqual(vc.layer, 0, 'no layer said is the place itself');
  // VOICE-RELAY-DOOR: the host hands the room's layer (online.js `layer`, said in its welcome) on with the room
  frameVoiceNet({ room: 'world:12,34', layer: 2, party: null, position: [100, 0, 200], facing: 0, peers: [] });
  assert.strictEqual(vc.room, 'world:12,34'); assert.strictEqual(vc.layer, 2, 'a crowded place\'s layer is its own voice room');
  destroyVoiceNet();
});

test('voiceNet: saveVoiceSettings writes the shelf exactly once, not once per field', () => {
  const prevLs = globalThis.localStorage;
  const store = new Map();
  let setItemCalls = 0;
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { setItemCalls++; store.set(k, String(v)); },
    removeItem: (k) => store.delete(k),
  };
  _resetPrefsForTests();
  try {
    const vc = initVoiceNet({ mintToken: async () => null, audioContext: () => null, destination: null });
    vc.state.setEnabled(true);
    vc.state.setPushToTalk(false);
    vc.setVolume(0.4);
    vc.state.mutedPeers = new Set(['peer_aaaa']);
    setItemCalls = 0;   // only the save under test counts
    saveVoiceSettings();
    assert.equal(setItemCalls, 1, 'one batched write, not one per field');
    const saved = JSON.parse(store.get('dagger.ui.v1')).voice;
    assert.equal(saved.enabled, true);
    assert.equal(saved.pushToTalk, false);
    assert.equal(saved.volume, 0.4);
    assert.deepEqual(saved.mutedPeers, ['peer_aaaa']);
    destroyVoiceNet();
  } finally {
    globalThis.localStorage = prevLs;
    _resetPrefsForTests();
  }
});
