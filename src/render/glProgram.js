// @ts-check
// AUDIT 68 S17-gl-program-dup (2026-09-24): ONE COMPILE AND LINK. The
// renderer and eleven foreign passes (the sky, the rain, the wisps, the
// clouds and their noise, the far ring, the bolts, Dynamic Skies, the grass,
// the enhanced sky) each wrote the same createShader / compile / check /
// attach / link / check out by hand, and had drifted only in their error
// prefixes. A leaf with no imports.

// SHADER-STALL (2026-10-20, a player via the owner: "Gate shader initialization: 11.43-second stall", "Node-outline
// shader initialization: 5.65-second stall" - "ive stripped out like 5 diffrent shader and i dont lag oon load up"):
// THE BUILD THAT WAITS. PERF-COMPILE1's one sync point is still a wait: the LINK_STATUS read holds the page's thread
// until the GPU process has compiled and linked the program - and everything queued ahead of it - and a driver's
// compiler (D3D11's above all) takes seconds over a pass's shaders. A pass built in play froze the game for its
// compile: a gate's fire the first frame one stands, the nodes' glint the first node lit, the sea's programs at
// idle (9.7 s of one task in the real game's boot here, bible/07-Rendering/Performance-Priority.md SHADER-STALL).
// KHR_parallel_shader_compile - every Chromium on a GPU has it, ANGLE compiling on threads of its own - lets the page
// ASK whether a program is done without waiting (COMPLETION_STATUS_KHR). `startPrograms` starts a pass's programs and
// answers that question; `buildProgram` takes the started program for the same sources instead of compiling its own,
// so a pass's constructor - unchanged - reads a link already made. A browser that cannot say is answered "done" at
// once, and its build waits as it always did.

/** Programs started and not yet taken, per context: `${vs}\0${fs}` -> the program and its two stages. */
const STARTED = new WeakMap();
// COMPILE-QUEUE (FIELD BUGS 2026-10-27b): a pair startProgramsInTurn holds for its turn, no program made yet - `wanted`
// once a door asks for it, which brings it to the front.
const queued = () => ({ prog: null, wanted: false });
/** SHADER-EASE MOUNT-START (2026-10-29): the sources a build has made, per context - a queue that comes after never
 *  starts them again (a host that mounted before the queue built its passes cold). */
const TAKEN = new WeakMap();
const takenOf = (gl) => {
  let t = TAKEN.get(gl);
  if (!t) TAKEN.set(gl, (t = new Set()));
  return t;
};
/** SHADER-EASE GFX-BAR (2026-10-29): the started and queued programs on `gl` not yet taken, as [key, program or null]
 *  - read only, nothing linked or started (ui/gfxPrepBar.js). @param {any} gl @returns {Array<[string, any]>} */
export const startedPrograms = (gl) => [...(STARTED.get(gl) ?? [])].map(([k, s]) => [k, s.prog]);
/** Each context's KHR_parallel_shader_compile, or null. */
const PARALLEL = new WeakMap();

/** The context's KHR_parallel_shader_compile, asked once - or null. */
export function parallelCompile(gl) {
  if (!PARALLEL.has(gl)) PARALLEL.set(gl, gl.getExtension?.('KHR_parallel_shader_compile') ?? null);
  return PARALLEL.get(gl);
}

/** The program for the sources, compiling and linking - nothing read back. */
function link(gl, vsSrc, fsSrc) {
  const prog = gl.createProgram();
  const stage = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
    return sh;
  };
  const vs = stage(gl.VERTEX_SHADER, vsSrc);
  const fs = stage(gl.FRAGMENT_SHADER, fsSrc);
  gl.linkProgram(prog);
  return { prog, vs, fs };
}

/** Start the programs `pairs` names (`[vertex source, fragment source]` each) and answer `ready()`: whether the driver
 *  has finished every one - asked without waiting (COMPLETION_STATUS_KHR), and true at once where the context cannot
 *  say (no KHR_parallel_shader_compile, a lost context). The pass's build after `ready()` takes each started program
 *  (buildProgram), so its one read waits on nothing. A program another build took first is started again for this one;
 *  sources started twice share one start.
 *  @param {any} gl @param {ReadonlyArray<readonly [string, string]>} pairs @returns {() => boolean} */
export function startPrograms(gl, pairs) {
  let started = STARTED.get(gl);
  if (!started) STARTED.set(gl, (started = new Map()));
  const keyed = pairs.map(([vs, fs]) => [`${vs}\0${fs}`, vs, fs]);
  const startAll = () =>
    keyed.map(([k, vs, fs]) => {
      let s = started.get(k);
      if (!s) started.set(k, (s = link(gl, vs, fs)));
      else if (!s.prog) s.wanted = true; // COMPILE-QUEUE: a queued pair waits its turn, at the front
      return s.prog;
    });
  startAll();
  const ext = parallelCompile(gl);
  let done = false;
  return () => {
    if (done || !ext || gl.isContextLost?.()) return (done = true);
    return (done = startAll().every(
      (p) => p !== null && gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR) === true,
    ));
  };
}

/** COMPILE-QUEUE (FIELD BUGS 2026-10-27b): start `pairs` one at a time, the next once the driver says the last is done
 *  (asked after each `wait`), so a build that reads a link waits behind one of them at most, never the whole list.
 *  Every pair is queued at once: a door that asks for one first brings it to the front, a build that wants one first
 *  takes it, and a pair a build took is never started. Resolves when the last is done, or the context is lost; at once
 *  where the context cannot say (no KHR_parallel_shader_compile), queuing nothing.
 *  @param {any} gl @param {ReadonlyArray<readonly [string, string]>} pairs @param {() => Promise<unknown>} wait */
export async function startProgramsInTurn(gl, pairs, wait) {
  const ext = parallelCompile(gl);
  if (!ext) return;
  let started = STARTED.get(gl);
  if (!started) STARTED.set(gl, (started = new Map()));
  const keyed = pairs.map(([vs, fs]) => [`${vs}\0${fs}`, vs, fs]);
  const taken = takenOf(gl);
  for (const [k] of keyed) if (!started.has(k) && !taken.has(k)) started.set(k, queued());
  const turn = () => keyed.find(([k]) => started.get(k)?.wanted) ?? keyed.find(([k]) => started.get(k)?.prog === null);
  try {
    for (let next = turn(); next && !gl.isContextLost?.(); next = turn()) {
      const [k, vs, fs] = next,
        s = link(gl, vs, fs);
      started.set(k, s);
      while (
        started.get(k) === s &&
        !gl.isContextLost?.() &&
        gl.getProgramParameter(s.prog, ext.COMPLETION_STATUS_KHR) !== true
      )
        await wait();
    }
  } finally {
    for (const [k] of keyed) if (started.get(k)?.prog === null) started.delete(k); // a queue that ends early strands no pair: its door starts it
  }
}

/** SHADER-EASE MOUNT-START (2026-10-29): whether the driver has finished each program `pairs` names that is started and
 *  not yet taken - read only, nothing linked or started (startPrograms' `ready()` starts again a program a build took).
 *  A pair taken or never started counts as done; true at once where the context cannot say.
 *  @param {any} gl @param {ReadonlyArray<readonly [string, string]>} pairs @returns {boolean} */
export function startedDone(gl, pairs) {
  const ext = parallelCompile(gl),
    started = STARTED.get(gl);
  if (!ext || !started || gl.isContextLost?.()) return true;
  return pairs.every(([vs, fs]) => {
    const prog = started.get(`${vs}\0${fs}`)?.prog;
    return !prog || gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR) === true;
  });
}

/** AUDIT SHADER-STALL (2026-10-20): the programs `pairs` names that were started and never taken, let go - their
 *  stages and the program deleted. A pass whose build threw leaves the rest of its list started for no build (the first
 *  program's fault thrown, its sibling linked and kept for good); its door lets them go.
 *  @param {any} gl @param {ReadonlyArray<readonly [string, string]>} pairs */
export function releasePrograms(gl, pairs) {
  const started = STARTED.get(gl);
  if (!started) return;
  for (const [vs, fs] of pairs) {
    const k = `${vs}\0${fs}`,
      s = started.get(k);
    if (!s) continue;
    started.delete(k);
    if (!s.prog) continue; // COMPILE-QUEUE: queued and never started - its turn is dropped, nothing to free
    gl.deleteShader(s.vs);
    gl.deleteShader(s.fs);
    gl.deleteProgram(s.prog);
  }
}

/** A pass built the first time it is asked for AND its programs are done - started at that first ask (startPrograms):
 *  `get()` answers the pass, or null while the driver compiles them, and null for good once `make` threw (`fail` told
 *  why, the programs it left started let go). The host's door for a pass it builds in play: never a frame frozen on a
 *  compile it can wait for. AUDIT SHADER-STALL: `get(true)` - the pass is NEEDED this frame (a telegraph to draw, a
 *  crystal to strike) - builds it now whatever the driver says, waiting on the compile as every build did before the
 *  slice: a pass the game plays by is never skipped for a compile (it is started early, render/playPrograms.js, so the
 *  wait is rare). `settled` - built, or tried and failed: nothing left to ask it for.
 *  @template T @param {any} gl @param {ReadonlyArray<readonly [string, string]>} programs @param {() => T} make
 *  @param {(e: any) => void} [fail] @returns {((need?: boolean) => T|null) & { readonly settled: boolean }} */
export function compiledPass(gl, programs, make, fail = () => {}) {
  let ready = /** @type {(() => boolean)|null} */ (null),
    pass = /** @type {T|null} */ (null),
    tried = false;
  const door = (need = false) => {
    if (pass || tried || !gl) return pass;
    if (!(ready ??= startPrograms(gl, programs))() && !need) return null;
    tried = true;
    try {
      pass = make();
    } catch (e) {
      fail(e);
      pass = null;
      releasePrograms(gl, programs);
    }
    return pass;
  };
  return /** @type {any} */ (Object.defineProperty(door, 'settled', { get: () => !!pass || tried }));
}

// SHADER-EASE LINK-WAIT (2026-10-29): the one LINK_STATUS read is where a cold compile holds the page's thread. A read
// that waits past LINK_WAIT_MS is kept (the last LINK_WAIT_KEEP): which program, how long, and whether a start had it
// ahead (`started`) - a build no warm started shows false. linkWaits() reads them.
export const LINK_WAIT_MS = 50;
export const LINK_WAIT_KEEP = 32;
/** @type {Array<{ label: string, ms: number, started: boolean }>} */
const WAITS = [];
/** The slow LINK_STATUS reads kept, oldest first - a copy. */
export const linkWaits = () => WAITS.slice();
const clock = () => globalThis.performance?.now?.() ?? 0;

/** Compile `vsSrc` and `fsSrc` and link them into a program, in the order
 *  every pass wrote it: createProgram, then per stage createShader,
 *  shaderSource, compileShader, the COMPILE_STATUS check and attachShader,
 *  then linkProgram and the LINK_STATUS check; both shaders deleted after
 *  (AUDIT EG V - they go with the program). A fault throws the driver's
 *  log - a constructor fault the boot probe sees - prefixed, when `label` is
 *  given, `${label} shader: ` or `${label} link: `. SHADER-STALL: a program
 *  `startPrograms` started for the same sources is taken instead of compiled. */
export function buildProgram(gl, vsSrc, fsSrc, label = '') {
  // PERF-COMPILE1 (2026-10-10, stutter): ONE SYNC POINT, NOT THREE. A status query is a round trip that waits for the
  // driver to finish - asked after each compile, it made the vertex stage finish before the fragment stage was even
  // handed over, and the link wait a third. Both stages go in, the link goes in, and the one LINK_STATUS read waits
  // once; the drivers that compile in parallel (ANGLE's worker threads) overlap the stages. A failure still throws the
  // log it threw: a stage that did not compile is read only when the link failed (a compile fault always fails the
  // link), and its log comes first, prefixed `${label} shader: `.
  const key = `${vsSrc}\0${fsSrc}`;
  const started = STARTED.get(gl);
  const took = started?.get(key);
  if (took) started.delete(key);
  takenOf(gl).add(key);
  const { prog, vs, fs } = took?.prog ? took : link(gl, vsSrc, fsSrc); // COMPILE-QUEUE: a queued pair is compiled here, out of its turn
  let fault = /** @type {string|null} */ (null);
  const t0 = clock(),
    linked = gl.getProgramParameter(prog, gl.LINK_STATUS),
    ms = clock() - t0;
  if (ms > LINK_WAIT_MS) {
    const wait = { label: label || `${vsSrc.length}+${fsSrc.length} chars`, ms: Math.round(ms), started: !!took?.prog };
    if (WAITS.push(wait) > LINK_WAIT_KEEP) WAITS.shift();
  }
  if (!linked) {
    for (const sh of [vs, fs])
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        fault = `${label ? `${label} shader: ` : ''}${gl.getShaderInfoLog(sh)}`;
        break;
      }
    fault ??= `${label ? `${label} link: ` : ''}${gl.getProgramInfoLog(prog)}`;
  }
  // AUDIT EG V (lane 6's shader objects; EVERY ALLOCATION HAS AN OWNER): the two stages flagged for deletion once the link
  // is read - attached, they live as long as the program and go with its deleteProgram. Kept, every pass rebuilt (the
  // Spire's look each breach, the spans' ghosts each circle) left its two behind. A build that throws frees its program too.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (fault != null) {
    gl.deleteProgram(prog);
    throw new Error(fault);
  }
  return prog;
}
