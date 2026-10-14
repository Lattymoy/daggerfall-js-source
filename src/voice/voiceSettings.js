// @ts-check
// Keeps the player's voice choices under one pref key so uiPrefs.js's defaults table grows one row, not nine.

import { getPref, setPref } from '../systems/uiPrefs.js';

/** The choices and their defaults: opt-in, push-to-talk, no recording by default. */
export const VOICE_DEFAULTS = Object.freeze({
  /** the switch - nothing asks for a microphone until the player turns it on */
  enabled: false,
  /** push-to-talk (true) or open mic (false) */
  pushToTalk: true,
  /** the push-to-talk key, a KeyboardEvent.code; CapsLock is unbound in systems/inputActions.js DEFAULT_BINDINGS */
  pttCode: 'CapsLock',
  /** the player's own mute */
  muted: false,
  /** the channel their voice goes to */
  channel: 'proximity',
  /** the microphone's deviceId, '' for the browser's default */
  inputDevice: '',
  /** the output's deviceId (setSinkId), '' for the default */
  outputDevice: '',
  /** the master gain of every remote voice, 0..1 */
  volume: 1,
  /** the peer ids the player muted for themselves */
  mutedPeers: Object.freeze(/** @type {string[]} */ ([])),
});

/** The pref key the whole set lives under. */
export const VOICE_PREF_KEY = 'voice';

/** A stored set, projected onto the defaults: an unknown key is dropped, a wrong type takes its default. */
export function projectVoiceSettings(raw) {
  const out = /** @type {Record<string, any>} */ ({ ...VOICE_DEFAULTS, mutedPeers: [] });
  if (!raw || typeof raw !== 'object') return out;
  const r = /** @type {Record<string, any>} */ (raw);
  for (const k of ['enabled', 'pushToTalk', 'muted']) if (typeof r[k] === 'boolean') out[k] = r[k];
  if (typeof r.pttCode === 'string' && /^[A-Za-z0-9]{1,24}$/.test(r.pttCode)) out.pttCode = r.pttCode;
  if (r.channel === 'proximity' || r.channel === 'party') out.channel = r.channel;
  for (const k of ['inputDevice', 'outputDevice']) if (typeof r[k] === 'string' && r[k].length <= 256) out[k] = r[k];
  if (typeof r.volume === 'number' && Number.isFinite(r.volume)) out.volume = Math.max(0, Math.min(1, r.volume));
  if (Array.isArray(r.mutedPeers)) out.mutedPeers = r.mutedPeers.filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(id)).slice(0, 256);
  return out;
}

/** The player's voice settings, read off the shelf. */
export function loadVoiceSettings() { return projectVoiceSettings(getPref(VOICE_PREF_KEY)); }

/** One choice changed, the whole set written back. Answers the store's word (a refused write is the caller's). */
export function saveVoiceSetting(key, value) {
  const next = projectVoiceSettings({ ...loadVoiceSettings(), [key]: value });
  return setPref(VOICE_PREF_KEY, next);
}
