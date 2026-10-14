// @ts-check
// A plain change-counter object the HUD reads and voiceClient.js writes; no DOM, no transport.

/** The connection's words, as the HUD says them. */
export const VOICE_STATUS = Object.freeze(['off', 'connecting', 'open', 'reconnecting', 'denied', 'error']);

/**
 * @typedef {{ id: string, channel: 'proximity'|'party', speaking: boolean, gain: number, muted: boolean, since: number }} VoiceRemote
 *   `id` the relay peer id (the SFU identity is the identity token's subject, which IS the peer id - online.js's
 *   hello carries the same); `muted` is the LISTENER's own local mute of this one voice.
 */

export class VoiceState {
  constructor({ now = () => Date.now() } = {}) {
    this._now = now;
    /** @type {'off'|'connecting'|'open'|'reconnecting'|'denied'|'error'} */
    this.status = 'off';
    /** @type {string|null} the last refusal or failure, in words the HUD may show; null once anything else happens */
    this.lastError = null;
    /** the player opted in (the switch) - nothing asks for a microphone before this is true */
    this.enabled = false;
    /** the microphone is captured and publishing */
    this.micOpen = false;
    /** the player's own mute: captured but sending silence */
    this.muted = false;
    /** push-to-talk on (the default - the plan's section 8); off is open-mic with the SFU's voice detection */
    this.pushToTalk = true;
    /** the push-to-talk key is held now */
    this.talking = false;
    /** the channel the player's OWN voice goes to */
    this.channel = /** @type {'proximity'|'party'} */ ('proximity');
    /** @type {Map<string, VoiceRemote>} the voices this listener is subscribed to, by peer id */
    this.remotes = new Map();
    /** @type {Set<string>} peers the player muted for themselves - held across sessions by voiceSettings.js */
    this.mutedPeers = new Set();
    /** @type {boolean} a party voice room is joined beside the proximity one */
    this.partyJoined = false;
    /** bumps on every change a panel would draw */
    this.version = 0;
    /** bumps on a speaking edge or a gain alone - the rows read it in place */
    this.levelVersion = 0;
    /** @type {((kind: string) => void)|null} */
    this.onChange = null;
  }

  _changed(kind) { this.version++; this.onChange?.(kind); }

  /** The connection's word. An error's text rides beside it; any other status clears the last error. */
  setStatus(status, error = null) {
    if (!VOICE_STATUS.includes(status)) throw new TypeError(`voice status ${status}`);
    const was = this.status;
    this.status = status;
    this.lastError = error ? String(error) : (status === 'error' || status === 'denied' ? this.lastError : null);
    if (was !== status || error) this._changed('status');
  }

  setEnabled(on) { on = !!on; if (this.enabled !== on) { this.enabled = on; this._changed('enabled'); } }
  setMicOpen(on) { on = !!on; if (this.micOpen !== on) { this.micOpen = on; this._changed('mic'); } }
  setMuted(on) { on = !!on; if (this.muted !== on) { this.muted = on; this._changed('muted'); } }
  setPushToTalk(on) { on = !!on; if (this.pushToTalk !== on) { this.pushToTalk = on; if (!on) this.talking = false; this._changed('ptt'); } }
  setTalking(on) { on = !!on; if (this.talking !== on) { this.talking = on; this._changed('talking'); } }
  setChannel(ch) { if (ch !== 'proximity' && ch !== 'party') throw new TypeError(`voice channel ${ch}`); if (this.channel !== ch) { this.channel = ch; this._changed('channel'); } }
  setPartyJoined(on) { on = !!on; if (this.partyJoined !== on) { this.partyJoined = on; this._changed('party'); } }

  /** Is my own voice going out right now: captured, not muted, and (with push-to-talk) the key held. */
  get transmitting() { return this.micOpen && !this.muted && (!this.pushToTalk || this.talking); }

  /** A remote voice subscribed - its row begins. */
  addRemote(id, channel) {
    if (this.remotes.has(id)) return this.remotes.get(id);
    const row = { id, channel, speaking: false, gain: channel === 'party' ? 1 : 0, muted: this.mutedPeers.has(id), since: this._now() };
    this.remotes.set(id, row);
    this._changed('remote');
    return row;
  }
  /** ...and ends. */
  dropRemote(id) { if (this.remotes.delete(id)) this._changed('remote'); }
  /** The SFU's word on who speaks (ActiveSpeakersChanged) - a level change, not a repaint of the panel's shape. */
  setSpeaking(id, on) { const r = this.remotes.get(id); if (r && r.speaking !== !!on) { r.speaking = !!on; this.levelVersion++; } }
  /** The proximity gain this voice plays at now (voiceProximity.js voiceGainAt). */
  setGain(id, g) { const r = this.remotes.get(id); if (r) { const v = Math.max(0, Math.min(1, Number(g) || 0)); if (r.gain !== v) { r.gain = v; this.levelVersion++; } } }
  /** The player's own mute of one voice - kept in `mutedPeers` so it survives the voice's leave and return. */
  mutePeer(id, on) {
    on = !!on;
    const had = this.mutedPeers.has(id);
    if (on) this.mutedPeers.add(id); else this.mutedPeers.delete(id);
    const r = this.remotes.get(id); if (r) r.muted = on;
    if (had !== on) this._changed('mute-peer');
  }

  /** The rows a panel draws: speaking first, then by channel, then by arrival. */
  rows() {
    return [...this.remotes.values()].sort((a, b) => Number(b.speaking) - Number(a.speaking) || (a.channel === b.channel ? a.since - b.since : a.channel === 'party' ? -1 : 1));
  }

  /** Everything the connection held, gone - the switch off, a terminal failure. The player's choices stay. */
  clearConnection() {
    const had = this.remotes.size || this.micOpen || this.talking || this.partyJoined;
    this.remotes.clear(); this.micOpen = false; this.talking = false; this.partyJoined = false;
    if (had) this._changed('clear');
  }
}
