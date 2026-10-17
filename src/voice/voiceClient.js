// @ts-check
// The game's one door to voice: a null object when off (nothing fetched, no SDK, no mic until enabled), and every
// failure here is caught into state rather than thrown - a voice outage must never stop the game.

import { VoiceState } from './voiceState.js';
import { VoiceTransport } from './voiceTransport.js';
import { VoiceSpatialAudio } from './voiceSpatialAudio.js';
import { proximitySet, subscriptionDiff, voiceGainAt, panFor, feetDistance, VOICE_PLACE_MS } from './voiceProximity.js';
import { validTokenAnswer, voiceUrlOk, VOICE_REMINT_AHEAD_S } from './voiceWire.js';
import { jittered } from '../net/backoff.js';

/** The default voice service - beside the relay (online.js DEFAULT_SERVER); a `?voice=` or the pref overrides it. */
export const DEFAULT_VOICE_SERVICE = 'https://daggerfall-voice.mackcothran.workers.dev';
/** How long a failed connect waits before another try (ms), doubling to the max - the relay's backoff shape. */
export const VOICE_RETRY_MIN_MS = 2000;
export const VOICE_RETRY_MAX_MS = 30000;
/** A service answer slower than this is a failure. */
export const VOICE_FETCH_MS = 8000;

/** The words the HUD says for a refusal - one home, read by the test. */
export const VOICE_TEXT = Object.freeze({
  denied: 'the microphone was refused - voice is off until the browser allows it',
  noService: 'the voice service did not answer',
  noToken: 'not signed in - voice needs an account',
  badAnswer: 'the voice service answered something this build does not read',
  sfu: 'the voice server could not be reached',
});

export class VoiceClient {
  /**
   * @param {{
   *   service?: string,
   *   mintToken: (() => Promise<string|null>)|null,   // the relay's identity minter (accountClient.js accountTokenMinter's)
   *   fetch?: typeof fetch,
   *   audioContext?: (() => any)|null,   // a getter: the engine's context once the gesture gate opened it
   *   destination?: any,
   *   transport?: VoiceTransport|null,   // a test's
   *   now?: () => number,
   *   rand?: () => number,   // Math.random's shape - the retry's jitter, injectable for a deterministic test
   *   setTimeout?: typeof setTimeout, clearTimeout?: typeof clearTimeout,
   *   makeElement?: (() => any)|null,   // an <audio> for each remote track (Chromium decodes a remote track only through one)
   * }} o
   */
  constructor({ service = DEFAULT_VOICE_SERVICE, mintToken = null, fetch: fetchImpl = globalThis.fetch, audioContext = null, destination = null, transport = null, now = () => Date.now(), rand = Math.random, setTimeout: st = globalThis.setTimeout, clearTimeout: ct = globalThis.clearTimeout, makeElement = null }) {
    this.service = String(service || DEFAULT_VOICE_SERVICE).replace(/\/+$/, '');
    this.mintToken = mintToken;
    this._fetch = fetchImpl;
    this._audioContext = audioContext;
    this._destination = destination;
    this._now = now; this._rand = rand; this._setTimeout = st; this._clearTimeout = ct;
    this._makeElement = makeElement;
    this.state = new VoiceState({ now });
    /** @type {VoiceTransport} */
    this.transport = transport ?? new VoiceTransport();
    this.transport.onTrack = (id, stream) => this._onTrack(id, stream);
    this.transport.onTrackGone = (id) => this._onTrackGone(id);
    this.transport.onLeft = (id) => this._onTrackGone(id);
    this.transport.onSpeakers = (ids) => this._onSpeakers(ids);
    this.transport.onState = (s, why) => this._onTransportState(s, why);
    /** @type {VoiceSpatialAudio|null} */
    this.spatial = null;
    /** @type {string|null} the game room joined for proximity */
    this.room = null;
    /** @type {string|null} the party joined for party voice */
    this.party = null;
    /** @type {{ channel: 'proximity'|'party', room: string, party: string|null }|null} what the SFU session was minted for */
    this._session = null;
    this._connecting = null;
    this._retryAt = -Infinity; this._retryMs = VOICE_RETRY_MIN_MS;
    this._tokenEndsAt = Infinity;
    this._lastPlaceAt = -Infinity;
    /** @type {string[]} the proximity ids placed last - what the server was told */
    this._placed = [];
    this.identity = null;
    /** @type {string|null} the relay token minted for the current place frame - re-used inside its life */
    this._placeToken = null;
    this._inputDevice = '';
    this.volume = 1;
    this.stats = { mints: 0, places: 0, connects: 0, failures: 0 };
  }

  // ─── the switches ────────────────────────────────────────────────────────────────────────────────────────────
  /** The player's opt-in. Off: everything down, nothing asked for again until on. */
  setEnabled(on) { this.state.setEnabled(on); if (!on) this.disconnect(); }
  setMuted(on) { this.state.setMuted(on); this._applyMute(); }
  setPushToTalk(on) { this.state.setPushToTalk(on); this._applyMute(); }
  /** The push-to-talk key's edge, from the host's keydown/keyup. */
  setTalking(on) { if (this.state.pushToTalk) { this.state.setTalking(on); this._applyMute(); } }
  /** Which channel my own voice goes to. The SFU room is per channel, so this leaves the old room and joins the new. */
  setChannel(ch) { if (this.state.channel !== ch) { this.state.setChannel(ch); if (this._session) this.disconnect(); } }
  setInputDevice(id) { this._inputDevice = String(id ?? ''); this.transport.setMicDevice(this._inputDevice).catch(() => {}); }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, Number(v) || 0)); this.spatial?.setVolume(this.volume); }
  mutePeer(id, on) { this.state.mutePeer(id, on); const r = this.state.remotes.get(id); if (r) this.spatial?.place(id, on ? 0 : r.gain, 0); }

  _applyMute() { this.transport.setMicMuted(!this.state.transmitting).catch(() => {}); }

  // ─── the room and the party ──────────────────────────────────────────────────────────────────────────────────
  /** The game room the player stands in (online.js's `room`), or null between rooms. A change re-mints. */
  setRoom(room) { room = room || null; if (this.room !== room) { this.room = room; this._placed = []; if (this._session?.channel === 'proximity') { if (room) this._session = null; else this.disconnect(); } } }
  /** The party the player sits in (social.party?.id), or null. Leaving the party ends the party channel at once. */
  setParty(party) { party = party || null; if (this.party !== party) { this.party = party; if (this._session?.channel === 'party') { if (party) this._session = null; else this.disconnect(); } } }

  /** What the session should be for now, or null when there is nothing to join. */
  _want() {
    if (!this.state.enabled) return null;
    if (this.state.channel === 'party') return this.party ? { channel: 'party', party: this.party, room: this.room } : null;
    return this.room ? { channel: 'proximity', room: this.room, party: null } : null;
  }

  // ─── the frame ───────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Once a frame: where I am and the peers the host can place. Reconnects on a room/channel change, re-mints before
   * the token expires, keeps the proximity set subscribed and placed. No-op when voice is off.
   * @param {number[]|null} here  my feet
   * @param {number} yaw
   * @param {import('./voiceProximity.js').VoicePeer[]} peers
   */
  frame(here, yaw, peers) {
    if (!this.state.enabled) return;
    const want = this._want();
    const now = this._now();
    if (!want) { if (this._session) this.disconnect(); return; }
    const same = this._session && this._session.channel === want.channel && this._session.room === want.room && this._session.party === want.party;
    if (!same || (now / 1000 > this._tokenEndsAt - VOICE_REMINT_AHEAD_S && this.state.status === 'open')) {
      if (!this._connecting && now >= this._retryAt) this._connecting = this._connect(want).finally(() => { this._connecting = null; });
    }
    if (this.state.status !== 'open') return;
    if (want.channel === 'proximity') this._proximityFrame(here, yaw, peers, now);
  }

  _proximityFrame(here, yaw, peers, now) {
    const held = new Set(this.state.remotes.keys());
    const set = proximitySet(here, peers, held);
    // every frame: the gains and pans of the held voices
    const byId = new Map(set.map((s) => [s.id, s]));
    for (const [id, r] of this.state.remotes) {
      const s = byId.get(id);
      const peer = peers.find((p) => p?.id === id);
      const g = s ? s.gain : (peer ? voiceGainAt(feetDistance(here ?? [], peer.feet)) : 0);
      this.state.setGain(id, g);
      this.spatial?.place(id, r.muted ? 0 : g, peer ? panFor(here ?? [], peer.feet, yaw) : 0);
    }
    // each VOICE_PLACE_MS: the membership said to the server and the subscriptions moved
    if (now - this._lastPlaceAt < VOICE_PLACE_MS) return;
    this._lastPlaceAt = now;
    const { open, drop } = subscriptionDiff(this._placed, set);
    for (const id of open) this.transport.subscribe(id, true);
    for (const id of drop) { this.transport.subscribe(id, false); this._onTrackGone(id); }
    const ids = set.map((s) => s.id);
    if (open.length || drop.length) { this._placed = ids; this._place(ids).catch(() => {}); }
  }

  // ─── the service ─────────────────────────────────────────────────────────────────────────────────────────────
  async _post(path, body) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? this._setTimeout(() => ctl.abort(), VOICE_FETCH_MS) : null;
    try {
      const res = await this._fetch(`${this.service}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl?.signal });
      if (!res?.ok) return null;
      return await res.json();
    } finally { if (timer != null) this._clearTimeout(timer); }
  }

  async _connect(want) {
    this._session = { ...want };
    this.state.setStatus(this.state.status === 'open' ? 'reconnecting' : 'connecting');
    this.stats.connects++;
    try {
      const relayToken = this.mintToken ? await this.mintToken() : null;
      if (!relayToken) return this._fail('noToken', VOICE_TEXT.noToken);
      this._placeToken = relayToken;
      this.stats.mints++;
      const raw = await this._post('/v1/voice/token', { token: relayToken, room: want.room ?? undefined, channel: want.channel, ...(want.channel === 'party' ? { party: want.party } : {}) }).catch(() => null);
      if (!raw) return this._fail('noService', VOICE_TEXT.noService);
      const ans = validTokenAnswer(raw);
      if (!ans || !voiceUrlOk(ans.url)) return this._fail('badAnswer', VOICE_TEXT.badAnswer);
      try { await this.transport.connect(ans.url, ans.token, { identity: ans.identity }); }
      catch (e) { return this._fail('sfu', `${VOICE_TEXT.sfu}: ${e?.message ?? e}`); }
      this.identity = ans.identity;
      this._tokenEndsAt = this._now() / 1000 + ans.ttl;
      this._ensureSpatial();
      try { await this.transport.openMic({ deviceId: this._inputDevice }); this.state.setMicOpen(true); }
      catch (e) {
        // a refused microphone is a LISTENER's session, not a failure: the game plays and the others are heard
        this.state.setMicOpen(false);
        if (String(e?.name) === 'NotAllowedError' || String(e?.name) === 'NotFoundError' || String(e?.name) === 'SecurityError') this.state.setStatus('denied', VOICE_TEXT.denied);
      }
      if (this.state.status !== 'denied') this.state.setStatus('open');
      this.state.setPartyJoined(want.channel === 'party');
      this._applyMute();
      this._retryMs = VOICE_RETRY_MIN_MS; this._placed = []; this._lastPlaceAt = -Infinity;
      if (want.channel === 'party') for (const id of this.transport.participants()) { this.transport.subscribe(id, true); }
      return true;
    } catch (e) { return this._fail('error', String(e?.message ?? e)); }
  }

  _fail(kind, text) {
    this.stats.failures++;
    this.state.setStatus(kind === 'denied' ? 'denied' : 'error', text);
    this._session = null;
    // Jittered, not a lockstep doubling - a relay deploy or SFU outage must not have every client ask again at once.
    this._retryAt = this._now() + jittered(this._retryMs, this._rand);
    this._retryMs = Math.min(VOICE_RETRY_MAX_MS, this._retryMs * 2);
    this.transport.disconnect().catch(() => {});
    this.state.clearConnection();
    return false;
  }

  async _place(ids) {
    if (!this._session || this._session.channel !== 'proximity' || !this._placeToken) return;
    this.stats.places++;
    await this._post('/v1/voice/place', { token: this._placeToken, room: this._session.room, near: ids });
  }

  _ensureSpatial() {
    if (this.spatial) return;
    const ctx = this._audioContext?.();
    if (!ctx) return;
    this.spatial = new VoiceSpatialAudio(ctx, this._destination);
    this.spatial.setVolume(this.volume);
  }

  // ─── the transport's words ───────────────────────────────────────────────────────────────────────────────────
  _onTrack(id, stream) {
    const party = this._session?.channel === 'party';
    const row = this.state.addRemote(id, party ? 'party' : 'proximity');
    this._ensureSpatial();
    this.spatial?.add(id, stream, { el: this._makeElement?.() ?? null, party });
    if (row.muted) this.spatial?.place(id, 0, 0);
  }
  _onTrackGone(id) { this.spatial?.drop(id); this.state.dropRemote(id); }
  _onSpeakers(ids) { const on = new Set(ids); for (const id of this.state.remotes.keys()) this.state.setSpeaking(id, on.has(id)); }
  _onTransportState(s, why) {
    if (s === 'reconnecting') this.state.setStatus('reconnecting');
    else if (s === 'connected') { if (this.state.status === 'reconnecting') this.state.setStatus('open'); }
    else if (s === 'disconnected' && this._session) { this._fail('error', `voice dropped${why ? `: ${why}` : ''}`); }
  }

  /** Everything down. The switch and the player's choices stay; the next frame with the switch on reconnects. */
  disconnect() {
    const had = this._session;
    this._session = null; this._placed = []; this.identity = null; this._placeToken = null;
    this.transport.disconnect().catch(() => {});
    this.spatial?.destroy(); this.spatial = null;
    this.state.clearConnection();
    if (had || this.state.status !== 'off') this.state.setStatus('off');
  }

  /** The host's teardown. */
  destroy() { this.disconnect(); }
}
