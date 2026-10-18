// @ts-check
// WINDOW-WEATHER: reuse the real view out's two depth boundaries without changing its renderer.
// outsideViewDraws runs after the street, while its depth renderbuffer is still bound. Copy that depth
// once per view-out refresh, never per interior frame. The renderer's existing pane texture is the
// other boundary: a particle belongs strictly between its pane and the street surface behind it.
// Reading the actual panes also handles rotated caravan walls, unlike a world-axis bounding box.
// ?windowweatherdepth=off disables only these boundaries: prepare() selects the box fallback.

import { pageParam } from '../systems/pageQuery.js';

export const WW_DEPTH_UNIFORMS = ['uStreetDepth', 'uPaneDepth', 'uStreetPV', 'uPaneScale', 'uStreetDepthOn', 'uPaneDepthOn'];

/** @param {any} renderer @param {() => boolean} enabled */
export function createWindowWeatherDepth(renderer, enabled) {
  const gl = renderer.gl;
  let tex = null, fbo = null, pane = null;
  let width = 0, height = 0, ready = false, subscribed = false;
  const pv = new Float32Array(16);
  const paneScale = [1, 1];

  // The private target is read, never modified: renderer._rwEnsureTarget owns its pane texture and
  // its DEPTH_COMPONENT24 renderbuffer. This add-on owns only the copy and its framebuffer below.
  const capture = (target, matrix) => {
    if (!target?.attached || !matrix || !enabled()) { ready = false; return; }
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    ready = false;
    try {
      tex ??= gl.createTexture();
      fbo ??= gl.createFramebuffer();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (width !== target.w || height !== target.h) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, target.w, target.h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        width = target.w; height = target.h;
      }
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      gl.drawBuffers([gl.NONE]);
      if (gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.fbo);
      gl.disable(gl.SCISSOR_TEST);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      pv.set(matrix);
      pane = target.paneAttached && renderer._rwPaneN > 0 ? target.paneTex : null;
      paneScale[0] = target.w / target.allocW; paneScale[1] = target.h / target.allocH;
      ready = true;
    } finally {
      // The hook runs inside outsideViewFrame: later hooks still draw into this target, and its
      // finally calls markForeignPass() to forget texture shadows after restoring the room pass.
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (scissor) gl.enable(gl.SCISSOR_TEST);
      // A later hook may use renderer.drawMesh and its texture shadows before the host's finally.
      renderer.markForeignPass?.();
    }
  };
  const onView = (info) => capture(renderer._rwTarget, info.pv);

  const prepare = () => {
    // Called at most once by frame(); capture and bind never read the page query.
    if (pageParam('windowweatherdepth') === 'off') { ready = false; return false; }
    if (!renderer.outsideViewDraws?.add) return false;
    if (!subscribed) { renderer.outsideViewDraws.add(onView); subscribed = true; }
    // Until the next refresh, use the room-box fallback. Never copy here: the room's framebuffer
    // is already bound, and capture's target baseline belongs only to the outside-view hook.
    return ready;
  };

  /** Bind on this add-on's program only; frame() invalidates all renderer texture shadows afterward. */
  const bind = (u) => {
    gl.uniform1f(u.uStreetDepthOn, ready ? 1 : 0);
    gl.uniform1f(u.uPaneDepthOn, ready && pane ? 1 : 0);
    if (!ready) return () => gl.activeTexture(gl.TEXTURE0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.uStreetDepth, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, pane ?? tex);
    gl.uniform1i(u.uPaneDepth, 1);
    gl.uniformMatrix4fv(u.uStreetPV, false, pv);
    gl.uniform2f(u.uPaneScale, paneScale[0], paneScale[1]);
    return () => gl.activeTexture(gl.TEXTURE0);
  };

  const release = () => {
    if (subscribed) renderer.outsideViewDraws.delete(onView);
    subscribed = false; ready = false; pane = null;
    if (tex) gl.deleteTexture(tex);
    if (fbo) gl.deleteFramebuffer(fbo);
    tex = null; fbo = null; width = 0; height = 0;
  };
  return { prepare, bind, release, get ready() { return ready; } };
}
