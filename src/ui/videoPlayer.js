// VID playback on the native 320x200 panel. 1:1 translation of Daggerfall
// Unity's DaggerfallVideo (Game/UserInterface/DaggerfallVideo.cs, MIT
// Daggerfall Workshop) - the control that drives VidFile on a clock - plus
// the two lines of DaggerfallVidPlayerWindow that end the window (any key,
// or end of file while playing).
//
// The decoder is the reader (src/formats/vidFile.js); this file only
// schedules it. DFU's Next() reads AT MOST ONE BLOCK per Update, so the
// stream advances at the host's frame rate: a ~14 fps video is two blocks
// (audio + video) per frame delay, well inside a 60 Hz rAF budget. Kept
// verbatim, including:
//   - the read gate `time + FrameDelay >= nextEventTime`, which uses the
//     delay of the block ALREADY read;
//   - "read next block or skip over null block" - exactly one retry, so two
//     consecutive null blocks cost two Update calls;
//   - lastPlayedAudioFrame: nextEventTime advances on an audio block, and on
//     a video block ONLY when the previous block was not audio ("Several
//     videos have parts that are only video frames. If nextEventTime is not
//     updated, the playback becomes too fast in these parts.");
//   - the audio clip padded with one empty sample at each end "to prevent
//     clicks and pops", samples as (byte - 128) * (1/128), scheduled at
//     nextEventTime (Unity PlayScheduled on the dspTime clock -> WebAudio
//     start(when) on ctx.currentTime; both are the same audio-hardware
//     clock, which is why now() defaults to ctx.currentTime).
// DFU's two-AudioSource flip-flop pool is dropped: a WebAudio buffer source
// is one-shot and self-owned. AUDIT 19 corrected the claim that used to sit
// here - "the pool has no observable effect" is false. DFU's pool BOUNDS
// concurrent clips at two; ours has no cap, so after a long host stall more
// clips can be in flight than DFU would ever have. Ledgered rather than
// left as a comfortable sentence.
//
// Presentation departures (Port-Ledger A - the rows exist now; AUDIT 19
// found this comment citing a Ledger page that had none):
//   - Unity uploads Color32[] into a Texture2D; here the frame buffer is
//     uploaded through renderer.uploadTexture under one key, released first
//     so the memoized upload is replaced rather than leaked.
//   - DFU inverts rect Y at draw time because Unity textures are
//     bottom-up. Our textures are top-down (the nativePanel/IMG
//     convention), so the frame is drawn straight.
//   - The frame is stretched to the full 320x200 native panel, as DFU does
//     with video.Size = 320x200 - DAG2.VID is 256 wide and is stretched.
//   - open() catches the reader's header/palette throw and logs, where DFU's
//     Open lets it escape; the READER still throws verbatim, and next()/draw()
//     are inert until a file has opened.

import { getFloat } from '../systems/settings.js';   // SETT: DaggerfallVideo reads SoundVolume per clip
import { UP_Y } from '../world/mat4.js';   // EV2: the shared billboard up axis
import { VidFile, VID_BLOCK_TYPES } from '../formats/vidFile.js';
import { NATIVE_W, NATIVE_H, drawImg, nativeMetrics } from './nativePanel.js';
import { drawMenuBackdrop } from './chargenArt.js';
import { audio } from '../systems/audio.js';

const VIDEO_BLOCKS = [
  VID_BLOCK_TYPES.Video_StartFrame,
  VID_BLOCK_TYPES.Video_IncrementalFrame,
  VID_BLOCK_TYPES.Video_IncrementalRowOffsetFrame,
];
const AUDIO_BLOCKS = [
  VID_BLOCK_TYPES.Audio_StartFrame,
  VID_BLOCK_TYPES.Audio_IncrementalFrame,
];

export class VideoPlayer {
  /**
   * @param {object} deps
   * @param {object} deps.renderer      uploadTexture/releaseTexture/drawScreenQuad host.
   * @param {function():number} [deps.now]          seconds on the audio clock.
   * @param {function():AudioContext} [deps.audioContext]  null when sound is not up yet.
   * @param {number} [deps.soundVolume] an OVERRIDE for DFU
   *   Settings.SoundVolume; null (the default) reads the live setting
   *   at each clip, which is what DaggerfallVideo.cs:117 does.
   * @param {string} [deps.textureKey]  renderer key the frame is uploaded under.
   */
  constructor({ renderer, now, audioContext, soundVolume = null, textureKey = 'vid:frame' } = {}) {
    this.renderer = renderer;
    // The context is resolved ONCE, here: nextEventTime and the clip
    // schedule have to live on the same clock for the whole video, and an
    // AudioContext that appears mid-playback (the first-gesture resume)
    // would move the clock's origin under a running stream. No context at
    // construction means silent playback on the wall clock.
    //
    // AUDIT 19 F2(vid) corrected what used to follow: this said the boot
    // splash is silent "since a browser will not start audio before a
    // gesture". That was the wrong culprit. Nothing had booted an
    // AudioEngine by splash time AT ALL, so there was no context to
    // resolve, gesture or no gesture - the audio path was fully ported and
    // unconditionally dead. main.js boots audio before playing now.
    // The gesture rule is real and still applies to STARTING the context.
    //
    // And it bites HERE: a context that exists but is SUSPENDED (autoplay
    // policy - the repeat visit with ARENA2 cached, no gesture yet) has
    // currentTime pinned at 0, and pacing on a frozen clock closed the
    // gate after one frame - which for ANIM0001 is solid black, so the
    // splash "played" as an indefinite black screen. Only a RUNNING
    // context can be the clock; anything else is treated as no context
    // (wall clock, silent), resolved once like the context itself so the
    // clock's origin can never move under a running stream. A stub with
    // no state field counts as running (the test seam).
    const ctx = (audioContext ?? (() => audio.ctx))();
    this._ctx = (ctx == null || (ctx.state ?? 'running') === 'running') ? ctx : null;
    this._now = now ?? (() => (this._ctx
      ? this._ctx.currentTime
      : (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000)));
    this.soundVolume = soundVolume;
    this.textureKey = textureKey;

    this.vidFile = new VidFile();
    this.playing = false;
    this._tex = null;
    this._opened = false;
    this._nextEventTime = this._now();
    this._lastPlayedAudioFrame = false;
  }

  /** Frames only exist once a video block has been read. */
  get frameTexture() { return this._tex; }
  get endOfFile() { return this.vidFile.endOfFile; }

  /** DFU Open(): decode the header/palette and size the frame texture. */
  open(bytes) {
    try {
      if (!this.vidFile.open(bytes)) throw new Error('empty video file');
    } catch (e) {
      console.error(`Failed to open video file: ${e?.message ?? e}`);
      return false;
    }
    this._opened = true;
    return true;
  }

  /** DFU Play(): Open then Playing = true. */
  play(bytes) {
    const ok = this.open(bytes);
    this.playing = true;
    return ok;
  }

  /** DFU Update() -> Next(). Call once per host frame. */
  update() {
    this.next();
  }

  /** DFU Next(): read at most one block when the clock allows it. */
  next() {
    if (!this._opened) return;
    if (this.vidFile.endOfFile || !this.playing) return;

    const time = this._now();
    if (time + this.vidFile.frameDelay < this._nextEventTime) return;

    // Read next block or skip over null block
    this.vidFile.readNextBlock();
    if (this.vidFile.lastBlockType === VID_BLOCK_TYPES.Null) this.vidFile.readNextBlock();

    if (AUDIO_BLOCKS.includes(this.vidFile.lastBlockType)) {
      this._playAudioBlock();
      this._nextEventTime += this.vidFile.frameDelay;
      this._lastPlayedAudioFrame = true;
    }

    if (VIDEO_BLOCKS.includes(this.vidFile.lastBlockType)) {
      this._uploadFrame();

      // Several videos have parts that are only video frames.
      // If nextEventTime is not updated, the playback becomes too fast in these parts.
      if (!this._lastPlayedAudioFrame) {
        this._nextEventTime += this.vidFile.frameDelay;
      }

      this._lastPlayedAudioFrame = false;
    }
  }

  /** Schedule this block's PCM at nextEventTime (no-op without a context). */
  _playAudioBlock() {
    const ctx = this._ctx;
    if (!ctx) return null;

    // Add empty sample at front and end of clip to prevent clicks and pops
    const src = this.vidFile.audioBuffer;
    const srcLength = src.length;
    const dstLength = srcLength + 2;
    let pos = 1;

    const divisor = 1 / 128;
    const data = new Float32Array(dstLength);
    for (let i = 0; i < srcLength; i++) {
      data[pos++] = (src[i] - 128) * divisor;
    }

    const clip = ctx.createBuffer(1, dstLength, this.vidFile.sampleRate);
    clip.getChannelData(0).set(data);

    const source = ctx.createBufferSource();
    source.buffer = clip;
    const gain = ctx.createGain();
    // MERGE AUDIT: DaggerfallVideo.cs:117 assigns
    // `audioSources[flip].volume = DaggerfallUnity.Settings.SoundVolume`
    // as each clip is scheduled - read at the point of use, like every
    // other live setting. The port had the parameter and never fed it,
    // so the splash and the death video were the two sounds in the
    // build the volume slider could not touch: they played at 1.0
    // while the shipped default is 0.5 and a muted game is 0.
    gain.gain.value = this.soundVolume ?? getFloat('Controls', 'SoundVolume', 0, 1);
    source.connect(gain).connect(ctx.destination);
    source.start(this._nextEventTime);
    // Probe hook: tools/splashProbe.mjs counts scheduled clips, because a
    // context that exists while nothing is scheduled looks identical to
    // working audio from the outside (AUDIT 19 F2).
    if (typeof window !== 'undefined') window.__vidClips = (window.__vidClips ?? 0) + 1;
    return source;
  }

  /** Replace the single frame texture with the current frame buffer. */
  _uploadFrame() {
    const fb = this.vidFile.frameBuffer;
    this.renderer.releaseTexture?.('vid', this.textureKey);
    this._tex = this.renderer.uploadTexture('vid', this.textureKey, {
      width: this.vidFile.frameWidth,
      height: this.vidFile.frameHeight,
      colors: new Uint32Array(fb.buffer, fb.byteOffset, fb.length / 4),
    });
    return this._tex;
  }

  /** DFU Draw(): nothing once the file has ended. `m` is nativeMetrics(). */
  draw(m) {
    if (!this._opened || this.vidFile.endOfFile || !this._tex) return false;
    drawImg(this.renderer, { tex: this._tex, w: NATIVE_W, h: NATIVE_H }, m, 0, 0);
    return true;
  }

  /** DaggerfallVidPlayerWindow.Update (:140-142): THREE disjoined
   *  conditions, in DFU's own order.
   *
   *      endOnAnyKey && AnyKeyDownIgnoreAxisBinds ||
   *      GetBackButtonDown() ||
   *      EndOfFile && Playing
   *
   *  AUDIT 26 F151: the middle one is not inside the endOnAnyKey gate,
   *  so Escape skips even DFU's endOnAnyKey-FALSE videos - the
   *  vampirism and lycanthropy dream and turning clips
   *  (VampirismInfection.cs:126/:136, LycanthropyInfection.cs:114) and
   *  every quest PlayVideo (:78). The port had no back arm at all, so
   *  those ran to the end with no way out. */
  shouldClose(anyKeyDown = false, endOnAnyKey = true, backButtonDown = false) {
    return (endOnAnyKey && anyKeyDown) || backButtonDown || (this.endOfFile && this.playing);
  }

  /** DFU Dispose(): stop playback and drop the frame texture. */
  dispose() {
    this.playing = false;
    if (this._tex) {
      this.renderer.releaseTexture?.('vid', this.textureKey);
      this._tex = null;
    }
  }
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const LIGHT = UP_Y;

/** Any-key watch for playVideo. Returns its own detach. */
function defaultListen(onAnyKey) {
  if (typeof window === 'undefined') return () => {};
  const events = ['pointerdown', 'keydown', 'touchstart'];
  // AUDIT 26 F151: the handler is told whether the press was the BACK
  // button - Escape (InputManager.cs:1065-1067). Update tests
  // GetBackButtonDown as its own disjunct, OUTSIDE the endOnAnyKey
  // gate, so it skips a video that no other key can.
  const handler = (ev) => onAnyKey(ev?.key === 'Escape');
  for (const ev of events) window.addEventListener(ev, handler, { passive: true });
  return () => { for (const ev of events) window.removeEventListener(ev, handler); };
}

/**
 * Play one VID over the whole screen and resolve when it is done - the
 * DaggerfallVidPlayerWindow shape: it owns the frame loop for its lifetime,
 * ends on any key or at end of file, and hands the screen back.
 * Resolves true if the video played, false if the bytes would not open.
 * `raf`/`listen`/`now` exist so the loop can be driven headlessly.
 */
export function playVideo(canvas, renderer, bytes, {
  endOnAnyKey = true, soundVolume = null, audioContext, now,
  raf = (fn) => requestAnimationFrame(fn),
  listen = defaultListen,
} = {}) {
  return new Promise((resolve) => {
    const player = new VideoPlayer({ renderer, soundVolume, audioContext, now });
    if (!player.play(bytes)) { resolve(false); return; }

    let anyKey = false;
    let backDown = false;   // F151: GetBackButtonDown, its own disjunct
    let settled = false;
    const detach = listen((back = false) => { anyKey = true; if (back) backDown = true; });
    const finish = (played) => {
      if (settled) return;
      settled = true;
      detach();
      try { player.dispose(); } catch { /* nothing to release */ }
      resolve(played);
    };
    const frame = () => {
      try {
        player.update();
        renderer.beginFrame(IDENTITY, IDENTITY, LIGHT);
        // The letterbox is BLACK - the THIRD time this has bitten. The
        // renderer clears to the pale Iliac Bay sky, which is right behind
        // a world and reads as a blue border around anything on the native
        // panel; U21 blacked it for the menu and U21b for chargen, and the
        // splash arrived with the same blue frame until the eyeball caught
        // it. drawMenuBackdrop is the one helper all three now share.
        drawMenuBackdrop(renderer, canvas);
        player.draw(nativeMetrics(canvas));
      } catch (e) {
        // AUDIT 19 F1(vid): THE ERROR BOUNDARY THIS DID NOT HAVE. The
        // reader throws OUTSIDE ReadBlock's try on purpose (end of stream
        // on the block-type byte, a null audioBuffer). In Unity that logs
        // and the next frame retries; here it killed the rAF chain, so the
        // promise never settled, the key watch never detached and the
        // texture never released. main.js AWAITS this - a truncated
        // ANIM0001.VID was a permanent black screen, which made the
        // "NEVER TRAPS" law in this file's header a false claim.
        console.warn('[video] playback stopped:', e?.message ?? e);
        finish(false);
        return;
      }
      if (player.shouldClose(anyKey, endOnAnyKey, backDown)) {
        finish(true);
        return;
      }
      raf(frame);
    };
    raf(frame);
  });
}
