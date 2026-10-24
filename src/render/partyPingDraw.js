// @ts-check
// PARTY-PING: the dotted floor route. The mark itself is a screen pin
// (render/partyPingLabels.js), one size at any distance. Added over the
// opaque world, depth-tested, no depth written - the veiled-bodies' slot
// (scenes/world.js drawVeiledPeerBodies). Not a DFU member.
import { buildProgram } from './glProgram.js';
import { pathRibbon } from '../systems/party/partyPing.js';

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uEye;
out float vDist;
void main() {
  vec3 p = aPos;
  vDist = distance(p, uEye);
  gl_Position = uProj * uView * vec4(p, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in float vDist;
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uFade;
out vec4 o;
void main() {
  float fade = 1.0 - smoothstep(uFade.x, uFade.y, vDist);
  float a = uAlpha * fade;
  o = vec4(uColor * a, a);
}`;

export class PartyPingDraw {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, FS, 'party ping');
    this.vao = gl.createVertexArray();
    this.buf = gl.createBuffer();
    this.u = {
      proj: gl.getUniformLocation(this.program, 'uProj'),
      view: gl.getUniformLocation(this.program, 'uView'),
      eye: gl.getUniformLocation(this.program, 'uEye'),
      color: gl.getUniformLocation(this.program, 'uColor'),
      alpha: gl.getUniformLocation(this.program, 'uAlpha'),
      fade: gl.getUniformLocation(this.program, 'uFade'),
    };
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /**
   * @param {{ _proj: Float32Array, _view: Float32Array, _camPos: ArrayLike<number>, gl: WebGL2RenderingContext, markForeignPass: () => void }} renderer
   * @param {ReadonlyArray<{ at: number[], color: number[], alpha: number }>} _marks
   * @param {ReadonlyArray<{ pts: ReadonlyArray<ReadonlyArray<number>>, color: ArrayLike<number>, alpha: number }>} ribbons
   */
  draw(renderer, _marks, ribbons) {
    const gl = this.gl;
    const proj = renderer._proj, view = renderer._view, eye = renderer._camPos;
    if (!proj || !view || !eye) return;
    const lines = [];
    for (const r of ribbons ?? []) {
      const verts = r.pts && r.pts.length > 1 ? pathRibbon(r.pts) : [];
      if (verts.length) lines.push({ verts, color: r.color, alpha: r.alpha });
    }
    if (!lines.length) return;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.proj, false, proj);
    gl.uniformMatrix4fv(this.u.view, false, view);
    gl.uniform3f(this.u.eye, eye[0], eye[1], eye[2]);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    const put = (verts) => {
      const data = verts instanceof Float32Array ? verts : new Float32Array(verts);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.TRIANGLES, 0, data.length / 3);
    };
    if (lines.length) {
      gl.uniform2f(this.u.fade, 70, 120);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-3, -6);
      for (const r of lines) {
        gl.uniform3f(this.u.color, r.color[0], r.color[1], r.color[2]);
        gl.uniform1f(this.u.alpha, 0.85 * r.alpha);
        put(r.verts);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(0, 0);
    }
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    renderer.markForeignPass();
  }

  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.buf);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}
