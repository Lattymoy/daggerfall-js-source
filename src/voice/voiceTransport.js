// @ts-check
// The only module that knows the LiveKit SDK's API; voiceClient.js speaks a small connect/publish/subscribe contract.
//
// The SDK loads lazily on first connect (~300 KB), so a player who never enables voice never pays for it.

/**
 * @typedef {{ identity: string, stream: MediaStream, track: any }} RemoteAudio
 * @typedef {{
 *   onTrack: ((identity: string, stream: MediaStream, track: any) => void)|null,
 *   onTrackGone: ((identity: string) => void)|null,
 *   onSpeakers: ((identities: string[]) => void)|null,
 *   onLeft: ((identity: string) => void)|null,
 *   onState: ((state: 'connected'|'reconnecting'|'disconnected', reason?: string) => void)|null,
 * }} TransportHooks
 */

/** The LiveKit module's shape this adapter reads - a test's fake provides the same five names. */
let _sdk = null;
/** @param {() => Promise<any>} [load] */
export async function loadVoiceSdk(load = () => import('livekit-client')) {
  if (_sdk) return _sdk;
  const m = await load();
  _sdk = { Room: m.Room, RoomEvent: m.RoomEvent, Track: m.Track, createLocalAudioTrack: m.createLocalAudioTrack };
  return _sdk;
}
/** A test's fake SDK in place of the real one; null puts the lazy import back. */
export function _setVoiceSdkForTests(sdk) { _sdk = sdk; }

export class VoiceTransport {
  /** @param {Partial<TransportHooks> & { sdk?: any }} [o] */
  constructor({ onTrack = null, onTrackGone = null, onSpeakers = null, onLeft = null, onState = null, sdk = null } = {}) {
    this.onTrack = onTrack; this.onTrackGone = onTrackGone; this.onSpeakers = onSpeakers; this.onLeft = onLeft; this.onState = onState;
    this._sdk = sdk;
    /** @type {any} the LiveKit Room, while connected */
    this.room = null;
    /** @type {any} my published microphone track */
    this.micTrack = null;
    /** @type {Set<string>} the identities whose audio I asked to receive */
    this.subscribed = new Set();
    this.identity = null;
  }

  async _lib() { return this._sdk ?? (this._sdk = await loadVoiceSdk()); }

  /** Connect: the room, autoSubscribe OFF - a track is received only when `subscribe` names its identity. */
  async connect(url, token, { identity } = /** @type {any} */ ({})) {
    const { Room, RoomEvent, Track } = await this._lib();
    await this.disconnect();
    const room = new Room({ adaptiveStream: false, dynacast: false, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.room = room; this.identity = identity ?? null;
    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track?.kind !== Track.Kind.Audio) return;
      const stream = track.mediaStream ?? new MediaStream([track.mediaStreamTrack]);
      this.onTrack?.(participant.identity, stream, track);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => { if (track?.kind === Track.Kind.Audio) this.onTrackGone?.(participant.identity); });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => { this.subscribed.delete(participant.identity); this.onLeft?.(participant.identity); });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => this.onSpeakers?.(speakers.map((s) => s.identity)));
    room.on(RoomEvent.Reconnecting, () => this.onState?.('reconnecting'));
    room.on(RoomEvent.Reconnected, () => { this.onState?.('connected'); this._resubscribe(); });
    room.on(RoomEvent.Disconnected, (reason) => this.onState?.('disconnected', reason != null ? String(reason) : undefined));
    // a participant arriving after my subscribe ask: their publication is marked wanted as it appears
    room.on(RoomEvent.TrackPublished, (pub, participant) => { if (this.subscribed.has(participant.identity)) { try { pub.setSubscribed(true); } catch { /* not yet */ } } });
    await room.connect(url, token, { autoSubscribe: false });
    this.onState?.('connected');
    return room;
  }

  /** Captures and publishes the microphone - asked for only here, after the player's opt-in. */
  async openMic({ deviceId = '' } = {}) {
    if (!this.room) throw new Error('voice: no room');
    const { createLocalAudioTrack, Track } = await this._lib();
    if (this.micTrack) return this.micTrack;
    const track = await createLocalAudioTrack({ deviceId: deviceId || undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true });
    await this.room.localParticipant.publishTrack(track, { source: Track.Source.Microphone, dtx: true, red: true });
    this.micTrack = track;
    return track;
  }

  /** Mutes the track without unpublishing - the SFU keeps the subscription, others just hear silence. */
  async setMicMuted(on) { if (this.micTrack) { if (on) await this.micTrack.mute(); else await this.micTrack.unmute(); } }

  /** The microphone changed in the settings - LiveKit swaps the device under the published track. */
  async setMicDevice(deviceId) { if (this.micTrack?.setDeviceId) await this.micTrack.setDeviceId(deviceId || undefined); }

  /** Receive this identity's audio (or stop). Idempotent; a participant not yet here is remembered for TrackPublished. */
  subscribe(identity, on = true) {
    if (!this.room) return false;
    if (on) this.subscribed.add(identity); else this.subscribed.delete(identity);
    const p = this.room.remoteParticipants?.get?.(identity) ?? this.room.getParticipantByIdentity?.(identity);
    if (!p) return false;
    for (const pub of p.trackPublications?.values?.() ?? p.audioTrackPublications?.values?.() ?? []) { try { pub.setSubscribed(on); } catch { /* ended */ } }
    return true;
  }

  _resubscribe() { for (const id of this.subscribed) this.subscribe(id, true); }

  /** Everyone here but me, by identity. */
  participants() { return [...(this.room?.remoteParticipants?.values?.() ?? [])].map((p) => p.identity); }

  /** Leave: the microphone stopped, the room gone. Safe to call twice. */
  async disconnect() {
    const room = this.room;
    this.room = null; this.subscribed.clear();
    if (this.micTrack) { try { this.micTrack.stop(); } catch { /* stopped */ } this.micTrack = null; }
    if (room) { try { await room.disconnect(); } catch { /* already down */ } }
  }
}
