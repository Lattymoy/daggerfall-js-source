// @ts-check
// VOICE2: the game loop's one door to voice - owns the VoiceClient singleton so no second one can exist per session.

import { VoiceClient, DEFAULT_VOICE_SERVICE } from '../voice/voiceClient.js';
import { loadVoiceSettings, projectVoiceSettings, VOICE_PREF_KEY } from '../voice/voiceSettings.js';
import { setPref } from '../systems/uiPrefs.js';

/** The singleton voice client, created once per session. */
let voiceNet = null;

/**
 * Initialize the voice system. Called once when the world starts.
 * @param {{ mintToken: () => Promise<string|null>, audioContext: () => any, destination: any }} o
 */
export function initVoiceNet(o) {
  if (voiceNet) return voiceNet;
  const voicePref = loadVoiceSettings();
  voiceNet = new VoiceClient({
    service: DEFAULT_VOICE_SERVICE,
    mintToken: o.mintToken,
    audioContext: o.audioContext,
    destination: o.destination,
  });
  // The pref row is the player's last session, not this client's default - carried over explicitly.
  voiceNet.state.setEnabled(voicePref.enabled);
  voiceNet.state.setPushToTalk(voicePref.pushToTalk);
  voiceNet.volume = voicePref.volume;
  voiceNet.state.mutedPeers = new Set(voicePref.mutedPeers);
  return voiceNet;
}

/**
 * Get the singleton voice client (null if not initialized).
 */
export function getVoiceNet() {
  return voiceNet;
}

/**
 * Call every frame from the world host. Drives proximity updates, token refresh, and reconnect logic.
 * @param {{ room: string|null, party: string|null, position: [number, number, number], facing: number, peers: Array<{id: string, feet: [number, number, number]}>|null }} o
 */
export function frameVoiceNet(o) {
  if (!voiceNet) return;
  try {
    voiceNet.setRoom(o.room);
    voiceNet.setParty(o.party);
    voiceNet.frame(o.position, o.facing, o.peers ?? []);
  } catch (e) {
    // A voice bug must never stop the game loop - see voiceClient.js's own law.
    console.error('[voice] frame error:', e.message);
  }
}

/**
 * Teardown on world close.
 */
export function destroyVoiceNet() {
  if (voiceNet) {
    voiceNet.destroy();
    voiceNet = null;
  }
}

/**
 * Persist the player's current voice choices under the `voice` pref row - one read, one validation pass, one write
 * (not four): saveVoiceSetting() per field would otherwise reload/revalidate/restringify the whole shelf each time.
 */
export function saveVoiceSettings() {
  if (!voiceNet) return;
  const next = projectVoiceSettings({
    ...loadVoiceSettings(),
    enabled: voiceNet.state.enabled,
    pushToTalk: voiceNet.state.pushToTalk,
    volume: voiceNet.volume,
    mutedPeers: [...voiceNet.state.mutedPeers],
  });
  return setPref(VOICE_PREF_KEY, next);
}
