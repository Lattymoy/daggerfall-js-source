// INTRO2: the cinematic's own, data-free landscape. One perspective camera
// replaces U65's incompatible column-renderer / orthographic-map pair.
// Geometry and texture are generated once; every moving frame stays on the GPU.
import { buildIliac, SEA_LEVEL, INTRO_MAP_W, INTRO_MAP_H } from './introMap.js';
import { multiply, perspective, lookAt, UP_Y } from '../world/mat4.js';
import { introCameraAt } from './introCue.js';

const FIELD_SCALE = 0.70;
const MAX_PIXELS = 900000;
const ATMOSPHERE = `
precision highp float;
const vec3 sun = normalize(vec3(0.84,0.24,-0.30));
float grain(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float cloudNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(grain(i),grain(i+vec2(1,0)),f.x),mix(grain(i+vec2(0,1)),grain(i+vec2(1)),f.x),f.y);
}
float cloudField(vec2 p) {
  float a=0.52,v=0.0;
  for(int i=0;i<4;i++){ v+=a*cloudNoise(p); p=mat2(1.6,-1.2,1.2,1.6)*p+7.3; a*=0.5; }
  return v;
}
vec3 skyLight(vec3 ray) {
  float horizon=exp(-abs(ray.y)*5.0);
  float glow=pow(max(0.0,dot(ray,sun)),12.0);
  vec3 colour=mix(vec3(0.055,0.10,0.17),vec3(0.50,0.43,0.34),horizon);
  colour+=vec3(0.50,0.26,0.09)*glow*0.5;
  float disc=smoothstep(0.99960,0.99993,dot(ray,sun));
  return colour+vec3(0.95,0.73,0.42)*disc*0.6;
}
vec3 haze(vec3 colour,vec3 world,vec3 eye) {
  float distanceToEye=length(world-eye);
  float density=0.0015*exp(-max(0.0,eye.y-30.0)/340.0);
  float f=1.0-exp(-distanceToEye*density);
  return mix(colour,skyLight(normalize(world-eye)),min(0.63,f));
}
`;
const FULLSCREEN = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}`;
const SKY = `#version 300 es
${ATMOSPHERE}
uniform vec2 resolution; uniform mat3 basis; uniform float halfFov;
out vec4 colour;
void main(){
  vec2 p=gl_FragCoord.xy/resolution*2.0-1.0;
  vec3 ray=normalize(basis*vec3(p.x*resolution.x/resolution.y*halfFov,p.y*halfFov,1));
  colour=vec4(skyLight(ray),1);
}`;
const TERRAIN_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 uv;
uniform sampler2D field; uniform mat4 vp; uniform vec2 extent;
out vec2 texcoord; out vec3 world;
void main(){
  texcoord=uv;
  float h=max(0.0,textureLod(field,uv,0.0).a*255.0-${SEA_LEVEL.toFixed(1)})*${FIELD_SCALE};
  world=vec3((uv.x-0.5)*extent.x,h,(uv.y-0.5)*extent.y);
  gl_Position=vp*vec4(world,1);
}`;
const TERRAIN_FRAGMENT = `#version 300 es
${ATMOSPHERE}
uniform sampler2D field; uniform vec3 eye; uniform vec2 extent; uniform float time;
in vec2 texcoord; in vec3 world; out vec4 colour;
void main(){
  vec4 sampleAt=texture(field,texcoord);
  if(sampleAt.a*255.0<=${SEA_LEVEL.toFixed(1)}+0.45) discard;
  vec2 d=1.0/vec2(textureSize(field,0));
  float dx=(texture(field,texcoord+vec2(d.x,0)).a-texture(field,texcoord-vec2(d.x,0)).a)*255.0*${FIELD_SCALE};
  float dz=(texture(field,texcoord+vec2(0,d.y)).a-texture(field,texcoord-vec2(0,d.y)).a)*255.0*${FIELD_SCALE};
  vec3 normal=normalize(vec3(-dx/(2.0*d.x*extent.x),1,-dz/(2.0*d.y*extent.y)));
  float diffuse=max(0.0,dot(normal,sun));
  float shadow=cloudField((world.xz+vec2(time*2.0,-time))/150.0);
  vec3 c=sampleAt.rgb*(vec3(0.36,0.43,0.50)+vec3(0.93,0.78,0.55)*diffuse);
  c*=1.0-0.14*smoothstep(0.48,0.7,shadow);
  float edge=min(min(texcoord.x,1.0-texcoord.x),min(texcoord.y,1.0-texcoord.y));
  c=mix(vec3(0.09,0.14,0.17),c,smoothstep(0.0,0.025,edge));
  colour=vec4(haze(c,world,eye),1);
}`;
const PLANE_VERTEX = `#version 300 es
precision highp float;
uniform mat4 vp; uniform float altitude; out vec3 world;
void main(){
  const vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  world=vec3(corners[gl_VertexID].x*6000.0,altitude,corners[gl_VertexID].y*6000.0);
  gl_Position=vp*vec4(world,1);
}`;
const OCEAN_FRAGMENT = `#version 300 es
${ATMOSPHERE}
uniform vec3 eye; uniform float time; uniform sampler2D field; uniform vec2 extent;
in vec3 world; out vec4 colour;
void main(){
  vec2 p=world.xz;
  float wave=sin(p.x*0.17+p.y*0.21+time*1.4)*0.017+sin(p.x*0.41-p.y*0.12-time)*0.009;
  vec3 n=normalize(vec3(wave,1.0,wave*0.56));
  vec3 v=normalize(eye-world);
  float fresnel=pow(1.0-max(0.0,dot(v,n)),4.0);
  float glint=pow(max(0.0,dot(reflect(-sun,n),v)),190.0);
  vec2 uv=p/extent+0.5;
  vec3 sea=vec3(0.035,0.095,0.13);
  if(all(greaterThan(uv,vec2(0)))&&all(lessThan(uv,vec2(1)))) sea=texture(field,uv).rgb*0.54;
  vec3 c=mix(sea,skyLight(reflect(-v,n))*0.60,0.25+0.50*fresnel);
  c+=vec3(0.9,0.66,0.30)*glint*0.7;
  colour=vec4(haze(c,world,eye),1);
}`;
const CLOUD_FRAGMENT = `#version 300 es
${ATMOSPHERE}
uniform vec3 eye; uniform float time; uniform float altitude;
in vec3 world; out vec4 colour;
void main(){
  vec2 p=(world.xz+vec2(time*2.0,-time*0.7))/170.0;
  float field=cloudField(p);
  float density=smoothstep(0.49,0.72,field);
  float bright=clamp((field-cloudField(p+sun.xz*0.35))*3.0+0.55,0.0,1.0);
  vec3 c=mix(vec3(0.36,0.42,0.48),vec3(0.81,0.77,0.66),bright);
  float edge=1.0-smoothstep(1200.0,3000.0,length(world.xz-eye.xz));
  float facing=smoothstep(0.0,15.0,abs(eye.y-altitude));
  colour=vec4(haze(c,world,eye),density*0.46*edge*facing);
}`;

/** One reusable grid; Uint32 indices are native in the game's WebGL2 target. */
export function introTerrainGrid(columns = 256, rows = 160) {
  const vertices = new Float32Array((columns + 1) * (rows + 1) * 2);
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    const i = (y * (columns + 1) + x) * 2;
    vertices[i] = x / columns; vertices[i + 1] = y / rows;
  }
  const indices = new Uint32Array(columns * rows * 6);
  let n = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * (columns + 1) + x, b = a + columns + 1;
    indices.set([a, b, a + 1, a + 1, b, b + 1], n); n += 6;
  }
  return { vertices, indices };
}

export function createIntroLandscape(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'low-power' });
  if (!gl) return null;
  const allocations = [];
  let disposed = false;
  const own = (value, release) => { allocations.push(() => release.call(gl, value)); return value; };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const release of allocations.reverse()) release();
    allocations.length = 0;
  };
  try {
    const makeProgram = (vertex, fragment) => {
      const shaders = [];
      const program = own(gl.createProgram(), gl.deleteProgram);
      try {
        for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
          const shader = gl.createShader(type);
          shaders.push(shader);
          gl.shaderSource(shader, text); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      } finally { for (const shader of shaders) gl.deleteShader(shader); }
      const locations = new Map();
      const u = (name) => { if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name)); return locations.get(name); };
      return { program, u };
    };
    const sky = makeProgram(FULLSCREEN, SKY);
    const terrain = makeProgram(TERRAIN_VERTEX, TERRAIN_FRAGMENT);
    const water = makeProgram(PLANE_VERTEX, OCEAN_FRAGMENT);
    const clouds = makeProgram(PLANE_VERTEX, CLOUD_FRAGMENT);
    const map = buildIliac({ w: 768, h: 480 });
    const data = new Uint8Array(map.w * map.h * 4);
    for (let i = 0; i < map.height.length; i++) {
      data.set(map.colour.subarray(i * 3, i * 3 + 3), i * 4); data[i * 4 + 3] = map.height[i];
    }
    const texture = own(gl.createTexture(), gl.deleteTexture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, map.w, map.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    const grid = introTerrainGrid();
    const vao = own(gl.createVertexArray(), gl.deleteVertexArray);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
    gl.bufferData(gl.ARRAY_BUFFER, grid.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, own(gl.createBuffer(), gl.deleteBuffer));
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const basis = new Float32Array(9);
    const vp = new Float32Array(16);

    return {
      render(time, width, height, reducedMotion = false) {
        if (disposed || gl.isContextLost()) return;
        const scale = Math.min(1.25, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        const cam = introCameraAt(time, width / height, reducedMotion);
        const view = lookAt(cam.eye, cam.aim, UP_Y);
        multiply(perspective(cam.fov, width / height, 0.5, 10000), view, vp);
        // lookAt's inverse rotation: right, up and FORWARD (negative Z).
        basis.set([view[0], view[4], view[8], view[1], view[5], view[9], -view[2], -view[6], -view[10]]);
        gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
        gl.useProgram(sky.program);
        gl.uniform2f(sky.u('resolution'), w, h);
        gl.uniformMatrix3fv(sky.u('basis'), false, basis);
        gl.uniform1f(sky.u('halfFov'), Math.tan(cam.fov / 2));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.enable(gl.DEPTH_TEST);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
        const bind = (p) => {
          gl.useProgram(p.program);
          gl.uniformMatrix4fv(p.u('vp'), false, vp);
          gl.uniform3fv(p.u('eye'), cam.eye);
          gl.uniform2f(p.u('extent'), INTRO_MAP_W, INTRO_MAP_H);
          gl.uniform1f(p.u('time'), reducedMotion ? 0 : Math.min(time, 24));
          gl.uniform1i(p.u('field'), 0);
        };
        bind(water); gl.uniform1f(water.u('altitude'), -0.15); gl.drawArrays(gl.TRIANGLES, 0, 6);
        bind(terrain); gl.bindVertexArray(vao); gl.drawElements(gl.TRIANGLES, grid.indices.length, gl.UNSIGNED_INT, 0); gl.bindVertexArray(null);
        bind(clouds); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        for (const altitude of (cam.eye[1] > 260 ? [232, 247, 262] : [262, 247, 232])) {
          gl.uniform1f(clouds.u('altitude'), altitude); gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
        gl.depthMask(true); gl.disable(gl.BLEND);
      },
      dispose,
    };
  } catch (error) {
    dispose();
    console.warn('[intro] landscape unavailable:', error.message);
    return null;
  }
}
