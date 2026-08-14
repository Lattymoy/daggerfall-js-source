// A1: runtime sound playback over the shipped DAGGER.SND reader.
// DFU plays SoundClips (enum values = DAGGER.SND record indices)
// through Unity AudioSources; the WebAudio engine here is the
// approved engine-side departure (Port-Ledger A) - the DATA path
// (indices, per-weapon/per-enemy clip selection, volumes) stays 1:1
// with the DFU call sites it serves.
//
// Mobile discipline: an AudioContext starts suspended until a user
// gesture - resume() rides the first pointer/key/touch event, and
// every play call is a silent no-op until the context runs. Records
// decode lazily (8-bit unsigned mono 11025 Hz -> Float32 AudioBuffer,
// (byte - 128) / 128) and cache by index.

import { SndFile, SAMPLE_RATE } from '../formats/sndFile.js';

/** Unsigned 8-bit PCM -> Float32 samples, verbatim (b - 128) / 128. */
export function pcm8ToFloat32(bytes) {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = (bytes[i] - 128) / 128;
  return out;
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.snd = null;
    this.buffers = new Map();   // index -> AudioBuffer
    this.enabled = false;
    this._listener = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1 };
  }

  /** Load DAGGER.SND through the data seam. Safe to call before any
   *  gesture; the context itself is created lazily on resume. */
  async init(fetchBytes) {
    try {
      const f = new SndFile();
      f.load(await fetchBytes('DAGGER.SND'));
      this.snd = f;
      this.enabled = true;
    } catch (e) {
      console.warn('DAGGER.SND unavailable - sound disabled:', e?.message ?? e);
      this.enabled = false;
    }
  }

  /** Hook the first-gesture resume. Call once after init; idempotent. */
  attachGestureResume(target = window) {
    const resume = () => {
      this._ensureCtx();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) {
      target.addEventListener(ev, resume, { passive: true });
    }
  }

  _ensureCtx() {
    if (this.ctx || !this.enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
  }

  _buffer(index) {
    if (!this.snd) return null;
    let b = this.buffers.get(index);
    if (b !== undefined) return b;
    const rec = this.snd.getSound(index);
    if (!rec || !rec.waveData?.length) { this.buffers.set(index, null); return null; }
    const samples = pcm8ToFloat32(rec.waveData);
    b = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    b.getChannelData(0).set(samples);
    this.buffers.set(index, b);
    return b;
  }

  _ready() {
    this._ensureCtx();
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  /** DFU PlayOneShot(clip, _, volumeScale): flat (non-positional). */
  playOneShot(index, volume = 1) {
    if (!this._ready()) return;
    const buf = this._buffer(index);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.ctx.destination);
    src.start();
  }

  /** Positional one-shot: a PannerNode standing in for Unity's 3D
   *  AudioSource. Distances ride the world's own units. */
  play3d(index, pos, volume = 1) {
    if (!this._ready()) return;
    const buf = this._buffer(index);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const pan = this.ctx.createPanner();
    pan.panningModel = 'equalpower';
    pan.distanceModel = 'linear';
    pan.refDistance = 2;
    pan.maxDistance = 40;
    pan.positionX.value = pos[0]; pan.positionY.value = pos[1]; pan.positionZ.value = pos[2];
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(pan).connect(this.ctx.destination);
    src.start();
  }

  /** Per-frame listener sync from the camera (position + forward). */
  setListener(pos, forward) {
    const L = this._listener;
    [L.x, L.y, L.z] = pos; [L.fx, L.fy, L.fz] = forward;
    if (!this._ready()) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = L.x; l.positionY.value = L.y; l.positionZ.value = L.z;
      l.forwardX.value = L.fx; l.forwardY.value = L.fy; l.forwardZ.value = L.fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(L.x, L.y, L.z);                    // Safari fallback
      l.setOrientation(L.fx, L.fy, L.fz, 0, 1, 0);
    }
  }
}

export const audio = new AudioEngine();
