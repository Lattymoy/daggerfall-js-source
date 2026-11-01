// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { audio, logarithmicRolloff } from '../systems/audio.js';
import { nodeOf as csaNodeOf } from '../systems/comeSailAway/comeSailAwayBoat.js';
import { csaLayersOf } from '../systems/comeSailAway/csaSynth/csaClips.js';
import { layeredLoop } from '../audio/layeredLoop.js';

/** @param {any} host */
export function createCsaAudio(host) {
  const { _csaLoops, _csaSourceNodes, csaCall, csaClipKey, csaRuntime, csaSounds, csaUnityGain } = host;
  function csaAudioFrame() {
    if (!csaRuntime) return;
    const seen = new Set();
    csaCall(() => {
      const ear = audio.listenerPosition();
      for (const boat of csaRuntime.AllBoats) {
        for (const src of [boat.AudioSourceSlow, boat.AudioSourceFast]) {
          if (!src) continue;
          let node = _csaSourceNodes.get(src);
          if (!node) {
            node = csaNodeOf(boat.GameObject, src);
            if (node) _csaSourceNodes.set(src, node);
          }
          let ch = _csaLoops.get(src);
          // AUDIT HELM-SIGHT A4: a boat whose helm is held from another pixel (a party's landing pending) stays in sight
          // for her sails' sake, and is not heard from there
          if (!src.isPlaying || !node?.activeInHierarchy || boat.helmAfar) {
            if (ch) {
              ch.handle?.stop();
              _csaLoops.delete(src);
            }
            continue;
          }
          seen.add(src);
          if (ch && ch.plays !== src.plays) {
            ch.handle?.stop();
            _csaLoops.delete(src);
            ch = null;
          } // AudioSource.Play: from the clip's start
          if (!ch) {
            ch = { plays: src.plays, handle: null };
            _csaLoops.set(src, ch);
            csaSounds();
          }
          const pos = [...node.position];
          // OWN-WORK4 audit: the loop is its layers (csaClips.js CSA_LAYERS), played together as one
          ch.handle ??= layeredLoop(csaLayersOf(src.clip).map(csaClipKey), (key) =>
            audio.loop3d(key, pos, 0, {
              refDistance: src.minDistance,
              maxDistance: src.maxDistance,
              distanceModel: 'inverse',
              rolloffFactor: 0,
            }),
          ); // null until every layer is made: asked again next frame
          if (!ch.handle) continue;
          ch.handle.move(pos);
          const d = Math.hypot(pos[0] - ear[0], pos[1] - ear[1], pos[2] - ear[2]);
          ch.handle.setVolume(csaUnityGain(src.volume * logarithmicRolloff(d, src.minDistance, src.maxDistance))); // AudioRolloffMode.Logarithmic, the default neither loop changes
        }
      }
    });
    for (const [src, ch] of _csaLoops)
      if (!seen.has(src)) {
        ch.handle?.stop();
        _csaLoops.delete(src);
      }
  }
  return { csaAudioFrame };
}
