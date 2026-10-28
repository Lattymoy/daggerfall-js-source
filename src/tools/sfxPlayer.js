// THE LABS' SOUND PLAYER, a leaf (src/tools/gunLab.js re-exports it): the spear lab plays it without the gun lab's
// 981 modules.

/** A one-shot player: each clip decoded once, a fresh source per shot, so a quick second shot layers over the first.
 *  PITCH VARIANCE (±`vary`) is the one liberty, as DFU's own swing varies its pitch; zero it and the clip is the file. */
export function createSfxPlayer({ base = 'sfx/', vary = 0.06, volume = 0.7 } = {}) {
  const buffers = new Map();   // name -> AudioBuffer (or a pending promise)
  let ctx = null;
  const p = {
    vary, volume, enabled: true,
    /** A gesture is what a browser wants before it will make noise. */
    resume() {
      ctx ??= new (globalThis.AudioContext ?? globalThis.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    },
    load(name) {
      if (buffers.has(name)) return buffers.get(name);
      const c = p.resume();
      const url = new URL(`${base}${name}.wav`, globalThis.document?.baseURI ?? 'http://localhost/').href;
      const pending = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${name}`))))
        .then((b) => c.decodeAudioData(b))
        .then((buf) => { buffers.set(name, buf); return buf; })
        .catch((e) => { buffers.delete(name); throw e; });
      buffers.set(name, pending);
      return pending;
    },
    play(name, gain = 1) {
      if (!p.enabled || !name) return false;
      const buf = buffers.get(name);
      if (!buf || typeof buf.then === 'function') { p.load(name).catch(() => {}); return false; }
      const c = p.resume();
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * p.vary;
      const g = c.createGain();
      g.gain.value = p.volume * gain;
      src.connect(g).connect(c.destination);
      src.start();
      return true;
    },
  };
  return p;
}
