// @ts-check
// SUNBABY1: THE SUN BABY'S SKY - one fullscreen pass over whichever sky the lane draws (world/sunbabySky.js says why
// it replaces the sky rather than grading it). The enhanced sky's contract: draw(yaw, pitch, fovY, aspect) after the
// sky and its clouds, at the far plane (LEQUAL passes only the cleared depth, so the land stands over it), blended over
// what is there by the event's weight. At weight 0 it draws nothing.

import { buildProgram } from './glProgram.js'; // AUDIT 68 S17-gl-program-dup: the one compile and link
import { SUNBABY_GLSL, sunbabySunDir } from '../world/sunbabySky.js';

/** SUNBABY3: Todd's photograph, as Mac supplied it (cropped to the face's disk, world/sunbabySky.js
 *  SUNBABY_TODD_PHOTO_FIT) - bundled by Vite, a file URL under Node where there is no Image to load it. */
export const SUNBABY_TODD_PHOTO_URL = new URL('../assets/sunbaby/todd.jpg', import.meta.url).href;

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 1.0, 1.0); }`; // AT the far plane, as the enhanced sky's

/** The pass's fragment shader - the enhanced sky's ray, then the flower sky and the sun baby along it. */
export const SUNBABY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
uniform float uWeight;   // the event's weight, 0..1
uniform float uTime;     // real seconds - the flowers' drift and the giggle
uniform vec3 uSunDir;    // the sun baby (sunbabySunDir)
uniform vec2 uFace;      // SUNBABY2: the face it wears - x the wrath, y Todd (sunbabyPhase)
uniform sampler2D uToddPhoto;   // SUNBABY3: Todd's photograph...
uniform float uToddPhotoOn;     // ...and whether it has loaded (the cartoon until it has)
out vec4 outColor;
${SUNBABY_GLSL}
void main() {
  vec3 ray = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray.x, ray.y * cp + ray.z * sp, -ray.y * sp + ray.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 dir = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));
  outColor = vec4(sunbabySky(dir, uSunDir, uTime, uFace, uToddPhoto, uToddPhotoOn), clamp(uWeight, 0.0, 1.0));
}`;

export const SUNBABY_UNIFORMS = Object.freeze([
  'uYaw',
  'uPitch',
  'uTanHalfFov',
  'uAspect',
  'uWeight',
  'uTime',
  'uSunDir',
  'uFace',
  'uToddPhoto',
  'uToddPhotoOn',
]);

/** The flower sky's real-second clock wraps here, so the drift stays inside a float's fraction. */
const TIME_WRAP_S = 3600;

export class SunbabySkyRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, SUNBABY_FS, 'sunbaby sky');
    this.u = {};
    for (const name of SUNBABY_UNIFORMS) this.u[name] = gl.getUniformLocation(this.program, name);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    /** The event's weight, 0..1 - the host's (world/sunbabySky.js createSunbaby). */
    this.weight = 0;
    /** SUNBABY2: the faces' weights, 0..1 - the wrath's and Todd's (world/sunbabySky.js sunbabyPhase); the baby the rest. */
    this.evil = 0;
    this.todd = 0;
    // SUNBABY3: Todd's photograph - a black texel until it has loaded (a sampler never reads an incomplete texture),
    // fetched when the pass is first built (the event's first showing, minutes before Todd's phase) and uploaded by the
    // next draw, inside the frame; a failed load warns and keeps the cartoon
    this.photoTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.photoOn = 0;
    this._photo = null;
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        this._photo = img;
      };
      img.onerror = () => console.warn("[sunbaby] Todd's photograph did not load - the cartoon stands in");
      img.src = SUNBABY_TODD_PHOTO_URL;
    }
    this.t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  }

  draw(yaw, pitch, fovY, aspect) {
    if (!(this.weight > 0)) return;
    const gl = this.gl,
      u = this.u;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL); // only where nothing nearer has drawn - z is the far plane
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); // over the sky by the weight; the buffer's alpha untouched
    gl.uniform1f(u.uYaw, yaw);
    gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2));
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform1f(u.uWeight, this.weight);
    gl.uniform1f(u.uTime, ((now - this.t0) / 1000) % TIME_WRAP_S);
    gl.uniform3fv(u.uSunDir, sunbabySunDir(this.weight));
    gl.uniform2f(u.uFace, this.evil, this.todd); // SUNBABY2
    if (this._photo) this._uploadPhoto(); // SUNBABY3: loaded since the last frame
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.uniform1i(u.uToddPhoto, 0);
    gl.uniform1f(u.uToddPhotoOn, this.photoOn);
    gl.disable(gl.CULL_FACE); // the triangle winds CCW under a CW front face, as the sky's
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
  }

  /** SUNBABY3: the loaded photograph into its texture, mipmapped (it is drawn small, a sun in the sky), rows as the
   *  file has them whatever the unpack flip was left at - then Todd wears it. */
  _uploadPhoto() {
    const gl = this.gl,
      img = this._photo;
    this._photo = null;
    const flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip);
    this.photoOn = 1;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the program, its triangle, its VAO - SUNBABY3: and Todd's photograph. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.vb);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.photoTex);
  }
}
