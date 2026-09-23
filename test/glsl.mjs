// A GLSL ES 3.00 EVALUATOR FOR TESTS: run a shader's own functions in JS,
// so a test can check a law on the code the GPU runs instead of pinning
// the shader's text.
//
//   const fns = glslFunctions(MARCH_FS, { uCellCount: 1, uCell: [[0, 0, 500, 50], ...] });
//   fns.hg(0.5, 0.55);            // every function the source defines, by name
//   fns.resolveAt([10, 20]);      // vectors are plain arrays of numbers
//   fns.globals.fNear;            // non-const globals persist between calls
//
// glslFunctions(src, bindings = {}, { fp32 = false } = {})
//   src       a whole shader or a fragment of one.
//   bindings  globals by name: uniforms, ins, outs, gl_FragCoord, and
//             overrides of the source's own `const` globals. A scalar is a
//             number (a bool a boolean), a vector an array, a matrix a flat
//             column-major array or an array of columns, an array an array
//             of those. A name the source never declares is taken as a
//             float, vecN, mat3/mat4 or an array of them from its JS shape
//             (declare int/uint uniforms in the source). Also the texture
//             hooks: bindings.texture / textureLod / texelFetch /
//             textureSize(samplerName, ...args) and dFdx / dFdy / fwidth(x);
//             without one those built-ins throw.
//   fp32      round every float result (arithmetic, built-ins,
//             constructors, literals, inputs) with Math.fround.
// The result maps each defined function to a callable. Arguments are
// converted to the parameter's type (and checked for shape); an out/inout
// argument may be a box `{ value }`, whose .value is written back after
// the call. `globals` is the live global store: write to it to change a
// uniform between calls (values are not converted there).
//
// SUPPORTED: float int uint bool, vec/ivec/uvec/bvec 2-4, mat2-4 (square,
// column-major; mat*vec, vec*mat, mat*mat, mat[i] columns), samplers as
// opaque names, arrays (uniform and local, `float[16](...)`, .length());
// declarations with comma lists, const, precision/#version/#extension,
// layout(...), uniform/in/out globals; every GLSL operator with GLSL's
// precedence, including ++/--, compound and bitwise assignment, ?: and the
// comma; swizzles read and write; scalar broadcast; constructors from any
// mix of scalars/vectors/matrices; int is 32-bit signed, uint 32-bit
// unsigned (wrapping * + - << >> & | ^ ~, truncating /); if/else, for,
// while, do/while, break, continue, return, discard (throws GlslDiscard);
// in/out/inout parameters (out into a variable, swizzle, array element or
// matrix column). Built-ins: radians degrees sin cos tan asin acos atan
// (1 or 2 args) sinh cosh tanh asinh acosh atanh pow exp log exp2 log2 sqrt
// inversesqrt abs sign floor ceil trunc round roundEven fract mod min max
// clamp mix (float or bool selector) step smoothstep isnan isinf
// floatBitsToInt/Uint intBitsToFloat uintBitsToFloat length distance dot
// cross normalize reflect refract faceforward matrixCompMult transpose
// lessThan(Equal) greaterThan(Equal) equal notEqual any all not.
//
// NOT SUPPORTED: structs, interface blocks, #define/#if (expand them
// first), function overloads (a second definition of a name throws),
// non-square matrices, determinant/inverse, packing built-ins, implicit
// conversions (GLSL ES 3.00 has none either: `float x = 1;` throws, which
// is what the compiler would do). Evaluation is float64 unless fp32 is set.
// Function bodies compile on their first call, so a fragment may carry
// functions that use names it does not declare, as long as they are not
// called; a type error in a body surfaces on that first call.

export class GlslDiscard extends Error {
  constructor() { super('GLSL discard'); this.name = 'GlslDiscard'; }
}

// ─── types: canonical objects, compared with === ───────────────────────
const T = Object.create(null);
const mkType = (name, base, size, mat = 0) => (T[name] = { name, base, size, mat, arr: 0, elem: null });
mkType('void', 'void', 0);
for (const b of ['float', 'int', 'uint', 'bool']) mkType(b, b, 1);
for (let n = 2; n <= 4; n++) {
  mkType(`vec${n}`, 'float', n); mkType(`ivec${n}`, 'int', n); mkType(`uvec${n}`, 'uint', n); mkType(`bvec${n}`, 'bool', n);
  mkType(`mat${n}`, 'float', n * n, n); T[`mat${n}x${n}`] = T[`mat${n}`];
}
const SAMPLER = /^[iu]?sampler\w+$/;
const typeByName = (name) => T[name] || (SAMPLER.test(name) ? mkType(name, 'sampler', 1) : null);
const VEC = { float: 'vec', int: 'ivec', uint: 'uvec', bool: 'bvec' };
const typeOf = (base, size) => T[size === 1 ? base : VEC[base] + size];
const ARRAYS = new Map();
const arrayOf = (elem, n) => {
  const name = `${elem.name}[${n}]`;
  if (!ARRAYS.has(name)) ARRAYS.set(name, { name, base: elem.base, size: 0, mat: 0, arr: n, elem });
  return ARRAYS.get(name);
};
const BUILTIN_VARS = { gl_FragCoord: 'vec4', gl_Position: 'vec4', gl_PointSize: 'float', gl_FragDepth: 'float', gl_PointCoord: 'vec2', gl_VertexID: 'int', gl_InstanceID: 'int', gl_FrontFacing: 'bool' };
const QUALS = new Set(['const', 'uniform', 'in', 'out', 'inout', 'highp', 'mediump', 'lowp', 'flat', 'smooth', 'centroid', 'invariant', 'precise', 'layout']);

// ─── tokenizer ─────────────────────────────────────────────────────────
const NUM = /(?:0[xX][0-9a-fA-F]+|(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+)([uUfF]?)/y;
const IDENT = /[A-Za-z_]\w*/y;
const PUNCT = ['<<=', '>>=', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '^^', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='];

function tokenize(src) {
  const out = [];
  let i = 0, line = 1, bol = true;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; bol = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new SyntaxError(`GLSL line ${line}: unterminated comment`);
      for (let k = i; k < e; k++) if (src[k] === '\n') line++;
      i = e + 2; continue;
    }
    if (c === '#' && bol) {
      let e = i;
      while (e < src.length && src[e] !== '\n') e++;
      const dir = /^#\s*(\w*)/.exec(src.slice(i, e))[1];
      if (!['version', 'extension', 'pragma', 'line', ''].includes(dir)) throw new SyntaxError(`GLSL line ${line}: #${dir} is not supported (expand the preprocessor first)`);
      i = e; continue;
    }
    bol = false;
    if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      NUM.lastIndex = i;
      const m = NUM.exec(src), suf = m[1].toLowerCase(), body = m[0].slice(0, m[0].length - m[1].length);
      let v, nt;
      if (/^0x/i.test(body)) { v = parseInt(body.slice(2), 16); nt = suf === 'u' ? 'uint' : 'int'; }
      else if (/[.eE]/.test(body) || suf === 'f') { v = parseFloat(body); nt = 'float'; }
      else { v = parseInt(body, body.length > 1 && body[0] === '0' ? 8 : 10); nt = suf === 'u' ? 'uint' : 'int'; }
      if (nt === 'int') v |= 0; else if (nt === 'uint') v >>>= 0;
      out.push({ k: 'num', v, nt, line });
      i = NUM.lastIndex; continue;
    }
    IDENT.lastIndex = i;
    const id = IDENT.exec(src);
    if (id) { out.push({ k: 'id', v: id[0], line }); i = IDENT.lastIndex; continue; }
    const p = PUNCT.find((s) => src.startsWith(s, i)) || c;
    if (!p.length || !'+-*/%<>=!&|^~?:;,.(){}[]'.includes(p[0])) throw new SyntaxError(`GLSL line ${line}: unexpected character '${c}'`);
    out.push({ k: 'p', v: p, line });
    i += p.length;
  }
  out.push({ k: 'eof', v: '<end of source>', line });
  return out;
}

// ─── parser: source -> AST (plain objects with k and line) ─────────────
const BIN = { '||': 1, '^^': 2, '&&': 3, '|': 4, '^': 5, '&': 6, '==': 7, '!=': 7, '<': 8, '>': 8, '<=': 8, '>=': 8, '<<': 9, '>>': 9, '+': 10, '-': 10, '*': 11, '/': 11, '%': 11 };
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|=']);
const isTypeName = (v) => !!(T[v] || SAMPLER.test(v));

class Parser {
  constructor(toks) { this.toks = toks; this.p = 0; }
  peek(o = 0) { return this.toks[Math.min(this.p + o, this.toks.length - 1)]; }
  next() { return this.toks[Math.min(this.p++, this.toks.length - 1)]; }
  is(v, o = 0) { return this.peek(o).v === v && this.peek(o).k !== 'num'; }
  accept(v) { if (this.is(v)) { this.p++; return true; } return false; }
  expect(v) { if (!this.accept(v)) this.fail(`expected '${v}'`); }
  fail(msg, t = this.peek()) { throw new SyntaxError(`GLSL line ${t.line}: ${msg}, found '${t.v}'`); }
  ident() { const t = this.next(); if (t.k !== 'id') this.fail('expected a name', t); return t.v; }

  program() {
    const items = [];
    while (this.peek().k !== 'eof') {
      if (this.accept(';')) continue;
      if (this.accept('precision')) { while (!this.accept(';')) this.next(); continue; }
      const line = this.peek().line, q = this.quals();
      if (this.is('struct')) this.fail('struct is not supported');
      if (this.accept(';')) continue;   // `layout(...) in;`
      if (this.peek().k === 'id' && !isTypeName(this.peek().v) && this.is('{', 1)) this.fail('interface blocks are not supported');
      const type = this.typeSpec(), name = this.ident();
      if (this.accept('(')) { items.push(this.fnRest(type, name, line)); continue; }
      items.push({ k: 'gdecl', q, type, list: this.declRest(name), line });
      this.expect(';');
    }
    return items;
  }
  quals() {
    const q = new Set();
    while (this.peek().k === 'id' && QUALS.has(this.peek().v)) {
      const v = this.next().v;
      q.add(v);
      if (v === 'layout') { this.expect('('); for (let d = 1; d;) { const t = this.next(); if (t.k === 'eof') this.fail('unclosed layout(', t); if (t.v === '(') d++; if (t.v === ')') d--; } }
    }
    return q;
  }
  typeSpec() {
    const t = this.next();
    if (t.k !== 'id' || !isTypeName(t.v)) this.fail('expected a type', t);
    return { name: t.v, arr: this.arraySuffix(), line: t.line };
  }
  arraySuffix() {
    if (!this.accept('[')) return null;
    const a = this.is(']') ? 'unsized' : this.expr();
    this.expect(']');
    return a;
  }
  declRest(first) {
    const list = [];
    for (let name = first; ; name = this.ident()) {
      const line = this.peek().line, arr = this.arraySuffix(), init = this.accept('=') ? this.assign() : null;
      list.push({ name, arr, init, line });
      if (!this.accept(',')) return list;
    }
  }
  fnRest(ret, name, line) {
    const params = [];
    if (this.is('void') && this.is(')', 1)) this.p++;
    if (!this.accept(')')) {
      for (;;) {
        const q = this.quals(), type = this.typeSpec();
        const pname = this.peek().k === 'id' ? this.ident() : null, arr = pname ? this.arraySuffix() : null;
        params.push({ name: pname, type, arr, isConst: q.has('const'), q: q.has('inout') ? 'inout' : q.has('out') ? 'out' : 'in' });
        if (this.accept(')')) break;
        this.expect(',');
      }
    }
    return { k: 'fn', ret, name, params, body: this.accept(';') ? null : this.block(), line };
  }
  block() {
    const line = this.peek().line, body = [];
    this.expect('{');
    while (!this.accept('}')) { if (this.peek().k === 'eof') this.fail("expected '}'"); body.push(this.statement()); }
    return { k: 'block', body, line };
  }
  isDeclStart() {
    const t = this.peek();
    if (t.k !== 'id') return false;
    if (QUALS.has(t.v)) return true;
    if (!isTypeName(t.v)) return false;
    let o = 1;
    if (this.is('[', 1)) { while (!this.is(']', o) && this.peek(o).k !== 'eof') o++; o++; }
    return this.peek(o).k === 'id';
  }
  statement() {
    const line = this.peek().line;
    if (this.is('{')) return this.block();
    if (this.accept(';')) return { k: 'empty', line };
    if (this.accept('if')) {
      this.expect('('); const c = this.expr(); this.expect(')');
      const a = this.statement();
      return { k: 'if', c, a, b: this.accept('else') ? this.statement() : null, line };
    }
    if (this.accept('for')) {
      this.expect('(');
      const init = this.accept(';') ? null : this.simple();
      const c = this.is(';') ? null : this.expr(); this.expect(';');
      const step = this.is(')') ? null : this.expr(); this.expect(')');
      return { k: 'for', init, c, step, body: this.statement(), line };
    }
    if (this.accept('while')) { this.expect('('); const c = this.expr(); this.expect(')'); return { k: 'while', c, body: this.statement(), line }; }
    if (this.accept('do')) {
      const body = this.statement();
      this.expect('while'); this.expect('('); const c = this.expr(); this.expect(')'); this.expect(';');
      return { k: 'do', c, body, line };
    }
    if (this.accept('return')) { const e = this.is(';') ? null : this.expr(); this.expect(';'); return { k: 'ret', e, line }; }
    for (const k of ['break', 'continue', 'discard']) if (this.accept(k)) { this.expect(';'); return { k, line }; }
    return this.simple();
  }
  simple() {   // a declaration or an expression, with its ';'
    const line = this.peek().line;
    let s;
    if (this.isDeclStart()) {
      const q = this.quals(), type = this.typeSpec();
      s = { k: 'decl', type, isConst: q.has('const'), list: this.declRest(this.ident()), line };
    } else s = { k: 'expr', e: this.expr(), line };
    this.expect(';');
    return s;
  }
  expr() {
    const line = this.peek().line, e = this.assign();
    if (!this.is(',')) return e;
    const list = [e];
    while (this.accept(',')) list.push(this.assign());
    return { k: 'seq', list, line };
  }
  assign() {
    const line = this.peek().line, a = this.ternary();
    if (this.peek().k === 'p' && ASSIGN.has(this.peek().v)) { const op = this.next().v; return { k: 'assign', op, a, b: this.assign(), line }; }
    return a;
  }
  ternary() {
    const line = this.peek().line, c = this.binary(1);
    if (!this.accept('?')) return c;
    const a = this.expr(); this.expect(':');
    return { k: 'cond', c, a, b: this.assign(), line };
  }
  binary(min) {
    let a = this.unary();
    for (;;) {
      const t = this.peek(), prec = t.k === 'p' ? BIN[t.v] : undefined;
      if (prec === undefined || prec < min) return a;
      this.p++;
      a = { k: 'bin', op: t.v, a, b: this.binary(prec + 1), line: t.line };
    }
  }
  unary() {
    const t = this.peek();
    if (t.k === 'p' && ['-', '+', '!', '~', '++', '--'].includes(t.v)) { this.p++; return { k: t.v.length === 2 ? 'pre' : 'un', op: t.v, a: this.unary(), line: t.line }; }
    let e = this.primary();
    for (;;) {
      const line = this.peek().line;
      if (this.accept('[')) { e = { k: 'index', a: e, i: this.expr(), line }; this.expect(']'); }
      else if (this.accept('.')) {
        const name = this.ident();
        if (name === 'length' && this.accept('(')) { this.expect(')'); e = { k: 'alen', a: e, line }; }
        else e = { k: 'field', a: e, name, line };
      } else if (this.is('++') || this.is('--')) e = { k: 'post', op: this.next().v, a: e, line };
      else return e;
    }
  }
  primary() {
    const t = this.next(), line = t.line;
    if (t.k === 'num') return { k: 'num', v: t.v, nt: t.nt, line };
    if (t.v === '(') { const e = this.expr(); this.expect(')'); return e; }
    if (t.k !== 'id') this.fail('unexpected token', t);
    if (t.v === 'true' || t.v === 'false') return { k: 'bool', v: t.v === 'true', line };
    if (isTypeName(t.v)) { const arr = this.arraySuffix(); this.expect('('); return { k: 'call', ctor: true, name: t.v, arr, args: this.args(), line }; }
    if (this.accept('(')) return { k: 'call', name: t.v, args: this.args(), line };
    return { k: 'id', name: t.v, line };
  }
  args() {
    const a = [];
    if (this.is('void') && this.is(')', 1)) this.p++;
    if (this.accept(')')) return a;
    for (;;) { a.push(this.assign()); if (this.accept(')')) return a; this.expect(','); }
  }
}

// ─── scalar semantics ──────────────────────────────────────────────────
const INT_OPS = {
  int: { '+': (a, b) => (a + b) | 0, '-': (a, b) => (a - b) | 0, '*': Math.imul, '/': (a, b) => (a / b) | 0, '%': (a, b) => (a % b) | 0,
    '<<': (a, b) => a << b, '>>': (a, b) => a >> b, '&': (a, b) => a & b, '|': (a, b) => a | b, '^': (a, b) => a ^ b },
  uint: { '+': (a, b) => (a + b) >>> 0, '-': (a, b) => (a - b) >>> 0, '*': (a, b) => Math.imul(a, b) >>> 0, '/': (a, b) => (a / b) >>> 0,
    '%': (a, b) => (a % b) >>> 0, '<<': (a, b) => (a << b) >>> 0, '>>': (a, b) => a >>> b, '&': (a, b) => (a & b) >>> 0, '|': (a, b) => (a | b) >>> 0, '^': (a, b) => (a ^ b) >>> 0 },
};
const NEG = { float: (x) => -x, int: (x) => -x | 0, uint: (x) => -x >>> 0 };
const NOT = { int: (x) => ~x, uint: (x) => ~x >>> 0 };
const DV = new DataView(new ArrayBuffer(4));
const bits = (set, get) => (x) => { DV[set](0, x); return DV[get](0); };
const roundEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };
// component-wise built-ins: [fn, arity, argument bases, result base (default: the first argument's)]
const F = 'float', N = 'float int uint', A = 'float int uint bool';
const CW = {
  radians: [(x) => x * (Math.PI / 180), 1, F], degrees: [(x) => x * (180 / Math.PI), 1, F],
  sin: [Math.sin, 1, F], cos: [Math.cos, 1, F], tan: [Math.tan, 1, F], asin: [Math.asin, 1, F], acos: [Math.acos, 1, F],
  atan: [(y, x) => (x === undefined ? Math.atan(y) : Math.atan2(y, x)), [1, 2], F],
  sinh: [Math.sinh, 1, F], cosh: [Math.cosh, 1, F], tanh: [Math.tanh, 1, F], asinh: [Math.asinh, 1, F], acosh: [Math.acosh, 1, F], atanh: [Math.atanh, 1, F],
  pow: [Math.pow, 2, F], exp: [Math.exp, 1, F], log: [Math.log, 1, F], exp2: [(x) => 2 ** x, 1, F], log2: [Math.log2, 1, F],
  sqrt: [Math.sqrt, 1, F], inversesqrt: [(x) => 1 / Math.sqrt(x), 1, F],
  abs: [Math.abs, 1, 'float int'], sign: [Math.sign, 1, 'float int'], floor: [Math.floor, 1, F], ceil: [Math.ceil, 1, F], trunc: [Math.trunc, 1, F],
  round: [(x) => Math.sign(x) * Math.round(Math.abs(x)), 1, F], roundEven: [roundEven, 1, F], fract: [(x) => x - Math.floor(x), 1, F],
  mod: [(x, y) => x - y * Math.floor(x / y), 2, F], min: [Math.min, 2, N], max: [Math.max, 2, N],
  clamp: [(x, lo, hi) => Math.min(Math.max(x, lo), hi), 3, N], mix: [(x, y, a) => x * (1 - a) + y * a, 3, F],
  step: [(e, x) => (x < e ? 0 : 1), 2, F],
  smoothstep: [(e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); }, 3, F],
  isnan: [Number.isNaN, 1, F, 'bool'], isinf: [(x) => x === Infinity || x === -Infinity, 1, F, 'bool'],
  floatBitsToUint: [bits('setFloat32', 'getUint32'), 1, F, 'uint'], floatBitsToInt: [bits('setFloat32', 'getInt32'), 1, F, 'int'],
  uintBitsToFloat: [bits('setUint32', 'getFloat32'), 1, 'uint', 'float'], intBitsToFloat: [bits('setInt32', 'getFloat32'), 1, 'int', 'float'],
  lessThan: [(a, b) => a < b, 2, N, 'bool'], lessThanEqual: [(a, b) => a <= b, 2, N, 'bool'],
  greaterThan: [(a, b) => a > b, 2, N, 'bool'], greaterThanEqual: [(a, b) => a >= b, 2, N, 'bool'],
  equal: [(a, b) => a === b, 2, A, 'bool'], notEqual: [(a, b) => a !== b, 2, A, 'bool'],
  matrixCompMult: [(a, b) => a * b, 2, F],
};
const DERIV = new Set(['dFdx', 'dFdy', 'fwidth']);

// lift a scalar function over vector arguments (flags: which args are vectors)
function liftN(s, flags, n) {
  if (!flags.includes(true)) return s;
  const [va, vb, vc] = flags;
  if (flags.length === 1) return (a) => { const r = new Array(n); for (let i = 0; i < n; i++) r[i] = s(a[i]); return r; };
  if (flags.length === 2) return (a, b) => { const r = new Array(n); for (let i = 0; i < n; i++) r[i] = s(va ? a[i] : a, vb ? b[i] : b); return r; };
  return (a, b, c) => { const r = new Array(n); for (let i = 0; i < n; i++) r[i] = s(va ? a[i] : a, vb ? b[i] : b, vc ? c[i] : c); return r; };
}
function callN(fn, A) {
  const [a, b, c] = A;
  switch (A.length) {
    case 0: return () => fn();
    case 1: return (fr) => fn(a(fr));
    case 2: return (fr) => fn(a(fr), b(fr));
    case 3: return (fr) => fn(a(fr), b(fr), c(fr));
    default: return (fr) => fn(...A.map((g) => g(fr)));
  }
}
const eq = (a, b) => { if (!Array.isArray(a)) return a === b; for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false; return true; };
const copier = (t) => (t.arr ? ((ec) => (v) => v.map(ec))(copier(t.elem)) : t.size > 1 ? (v) => v.slice() : (v) => v);
const zero = (t) => (t.arr ? Array.from({ length: t.arr }, () => zero(t.elem)) : t.base === 'sampler' ? ''
  : t.size === 1 ? (t.base === 'bool' ? false : 0) : new Array(t.size).fill(t.base === 'bool' ? false : 0));
const dotv = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const BRK = 1, CNT = 2, RET = 3;

export function glslFunctions(src, bindings = {}, { fp32 = false } = {}) {
  const R = fp32 ? Math.fround : (x) => x;
  const items = new Parser(tokenize(src)).program();
  const G = {};                 // the global store (exposed as .globals)
  const ginfo = new Map();      // name -> { t, ro, global }
  const fnTable = new Map();    // name -> { node, body, impl, ... }
  const fops = { '+': (a, b) => R(a + b), '-': (a, b) => R(a - b), '*': (a, b) => R(a * b), '/': (a, b) => R(a / b) };
  const CONV = { float: (x) => R(+x), int: (x) => (typeof x === 'boolean' ? +x : Math.trunc(x) | 0), uint: (x) => (typeof x === 'boolean' ? +x : Math.trunc(x) >>> 0), bool: (x) => !!x };
  const JSCONV = { float: (x) => R(+x), int: (x) => x | 0, uint: (x) => x >>> 0, bool: (x) => !!x };
  const err = (n, msg) => { throw new Error(`GLSL line ${n && n.line}: ${msg}`); };
  const rnd = (t, f) => (!fp32 || t.base !== 'float' ? f : t.size === 1 ? (fr) => R(f(fr))
    : (fr) => { const v = f(fr); for (let i = 0; i < v.length; i++) v[i] = R(v[i]); return v; });
  const scope = (parent) => ({ vars: new Map(), parent, fn: parent && parent.fn });

  function fromJS(t, v, what) {
    const bad = () => { throw new TypeError(`GLSL: ${what} must be a ${t.name}, got ${JSON.stringify(v)}`); };
    if (t.arr) { if (!Array.isArray(v) || v.length !== t.arr) bad(); return v.map((e, i) => fromJS(t.elem, e, `${what}[${i}]`)); }
    if (t.base === 'sampler') return typeof v === 'string' ? v : bad();
    const conv = JSCONV[t.base], ok = (x) => (typeof x === 'number' || typeof x === 'boolean' ? conv(x) : bad());
    if (t.size === 1) return ok(v);
    if (t.mat && Array.isArray(v) && Array.isArray(v[0])) v = v.flat();
    if (!(Array.isArray(v) || ArrayBuffer.isView(v)) || v.length !== t.size) bad();
    return Array.from(v, ok);
  }
  function inferType(v) {
    if (typeof v === 'number') return T.float;
    if (typeof v === 'boolean') return T.bool;
    if (!Array.isArray(v) || !v.length) return null;
    if (Array.isArray(v[0])) { const e = inferType(v[0]); return e && !e.arr ? arrayOf(e, v.length) : null; }
    return { 2: T.vec2, 3: T.vec3, 4: T.vec4, 9: T.mat3, 16: T.mat4 }[v.length] || null;
  }
  function lookup(name, sc, n) {
    for (let s = sc; s; s = s.parent) { const v = s.vars.get(name); if (v) return v; }
    let g = ginfo.get(name);
    if (!g) {   // a built-in variable, or a name only the bindings (or a write to .globals) declare
      const inG = Object.hasOwn(G, name), has = inG || (Object.hasOwn(bindings, name) && typeof bindings[name] !== 'function');
      const v = inG ? G[name] : bindings[name];
      const t = BUILTIN_VARS[name] ? T[BUILTIN_VARS[name]] : has ? inferType(v) : null;
      if (!t) err(n, `'${name}' is not declared (declare it in the source or pass it in bindings)`);
      g = { t, ro: false, global: true };
      ginfo.set(name, g);
      G[name] = has ? fromJS(t, v, `bindings.${name}`) : zero(t);
    }
    return g;
  }
  function constInt(n) {
    const e = cx(n, null);
    if ((e.t.base !== 'int' && e.t.base !== 'uint') || e.t.size !== 1) err(n, 'an array size must be a constant int');
    return e.f([]);
  }
  function declType(tn, declArr, init, n) {
    const t = typeByName(tn.name);
    if (tn.arr && declArr) err(n, 'arrays of arrays are not supported');
    const a = tn.arr || declArr;
    if (!a) return t;
    if (a !== 'unsized') return arrayOf(t, constInt(a));
    if (!init || !init.t.arr) err(n, 'an unsized array needs an array initializer');
    return arrayOf(t, init.t.arr);
  }
  function sig(Fn) {
    if (Fn.sig) return;
    const nd = Fn.node;
    Fn.ret = declType(nd.ret, null, null, nd);
    Fn.params = nd.params.map((p) => ({ name: p.name, q: p.q, isConst: p.isConst, t: declType(p.type, p.arr, null, nd) }));
    Fn.sig = true;
  }
  function compileFn(Fn) {
    sig(Fn);
    const fn = { nslots: 1 + Fn.params.length, ret: Fn.ret, name: Fn.name };
    const sc = { vars: new Map(), parent: null, fn };
    Fn.params.forEach((p, i) => { if (p.name) sc.vars.set(p.name, { t: p.t, slot: i + 1, ro: p.isConst }); });
    const run = cblock(Fn.body.body, sc);   // parameters share the body's outermost scope
    Fn.impl = { run, nslots: fn.nslots };
    return Fn.impl;
  }

  // ─── expressions: node -> { t, f(frame) } ─────────────────────────────
  function swz(n, t) {
    const set = ['xyzw', 'rgba', 'stpq'].find((s) => s.includes(n.name[0]));
    const idx = [...n.name].map((ch) => (set ? set.indexOf(ch) : -1));
    if (t.arr || t.mat || t.size < 2 || t.base === 'sampler' || idx.length > 4 || idx.some((i) => i < 0 || i >= t.size)) err(n, `no field '.${n.name}' on ${t.name}`);
    return { idx, t: typeOf(t.base, idx.length) };
  }
  function indexInfo(n, t, it) {
    if ((it.base !== 'int' && it.base !== 'uint') || it.size !== 1 || it.arr) err(n, 'an index must be an int or a uint');
    if (t.arr) return { len: t.arr, et: t.elem };
    if (t.mat) return { len: t.mat, et: typeOf('float', t.mat) };
    if (t.size > 1 && t.base !== 'sampler') return { len: t.size, et: typeOf(t.base, 1) };
    return err(n, `${t.name} cannot be indexed`);
  }
  const oob = (n, k, len) => { throw new RangeError(`GLSL line ${n.line}: index ${k} is out of range [0, ${len})`); };
  function cond(n, sc) {
    const c = cx(n, sc);
    if (c.t !== T.bool) err(n, `a condition must be a bool, not ${c.t.name}`);
    return c.f;
  }
  function arith(op, ta, tb, n) {
    const bad = () => err(n, `'${op}' cannot combine ${ta.name} and ${tb.name}`);
    if (ta.arr || tb.arr || ta.base === 'sampler' || tb.base === 'sampler' || !ta.size || !tb.size) bad();
    if (op === '*' && (ta.mat || tb.mat) && ta.size > 1 && tb.size > 1) {
      const M = ta.mat || tb.mat;
      if ((ta.mat && tb.mat && ta !== tb) || (!ta.mat && ta.size !== M) || (!tb.mat && tb.size !== M) || ta.base !== 'float' || tb.base !== 'float') bad();
      if (ta.mat && tb.mat) return { t: ta, fn: (a, b) => { const r = new Array(M * M); for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) { let s = 0; for (let k = 0; k < M; k++) s += a[k * M + i] * b[j * M + k]; r[j * M + i] = R(s); } return r; } };
      if (ta.mat) return { t: tb, fn: (m, v) => { const r = new Array(M); for (let i = 0; i < M; i++) { let s = 0; for (let j = 0; j < M; j++) s += m[j * M + i] * v[j]; r[i] = R(s); } return r; } };
      return { t: ta, fn: (v, m) => { const r = new Array(M); for (let j = 0; j < M; j++) { let s = 0; for (let i = 0; i < M; i++) s += v[i] * m[j * M + i]; r[j] = R(s); } return r; } };
    }
    const shift = op === '<<' || op === '>>';
    if (shift ? !INT_OPS[ta.base] || !INT_OPS[tb.base] || (ta.size === 1 && tb.size > 1) : ta.base !== tb.base) bad();
    if (ta.size > 1 && tb.size > 1 && (ta.size !== tb.size || ta.mat !== tb.mat)) bad();
    const s = ta.base === 'float' ? fops[op] : INT_OPS[ta.base] && INT_OPS[ta.base][op];
    if (!s) err(n, `'${op}' is not defined on ${ta.name}`);
    const t = ta.size > 1 || shift ? ta : tb;
    return { t, fn: liftN(s, [ta.size > 1, tb.size > 1], t.size) };
  }

  function cx(n, sc) {
    switch (n.k) {
      case 'num': { const v = n.nt === 'float' ? R(n.v) : n.v; return { t: T[n.nt], f: () => v }; }
      case 'bool': { const v = n.v; return { t: T.bool, f: () => v }; }
      case 'id': {
        const info = lookup(n.name, sc, n), name = n.name, s = info.slot;
        return { t: info.t, f: info.global ? () => G[name] : (fr) => fr[s] };
      }
      case 'field': {
        const a = cx(n.a, sc), A = a.f, { idx, t } = swz(n, a.t), [i, j, k, l] = idx;
        const f = [null, (fr) => A(fr)[i], (fr) => { const v = A(fr); return [v[i], v[j]]; },
          (fr) => { const v = A(fr); return [v[i], v[j], v[k]]; }, (fr) => { const v = A(fr); return [v[i], v[j], v[k], v[l]]; }][idx.length];
        return { t, f };
      }
      case 'index': {
        const a = cx(n.a, sc), i = cx(n.i, sc), { len, et } = indexInfo(n, a.t, i.t), A = a.f, I = i.f, M = a.t.mat;
        return { t: et, f: M ? (fr) => { const v = A(fr), k = I(fr); if (!(k >= 0 && k < len)) oob(n, k, len); return v.slice(k * M, k * M + M); }
          : (fr) => { const v = A(fr), k = I(fr); if (!(k >= 0 && k < len)) oob(n, k, len); return v[k]; } };
      }
      case 'alen': { const a = cx(n.a, sc); if (!a.t.arr) err(n, '.length() needs an array'); const v = a.t.arr; return { t: T.int, f: () => v }; }
      case 'un': {
        const a = cx(n.a, sc), A = a.f, t = a.t;
        if (n.op === '+') return a;
        if (n.op === '!') { if (t !== T.bool) err(n, `'!' needs a bool, not ${t.name}`); return { t, f: (fr) => !A(fr) }; }
        const s = (n.op === '-' ? NEG : NOT)[t.base];
        if (!s || t.arr) err(n, `'${n.op}' is not defined on ${t.name}`);
        return { t, f: callN(liftN(s, [t.size > 1], t.size), [A]) };
      }
      case 'pre': case 'post': {
        const lv = clv(n.a, sc), { get, set } = lv;
        if (lv.t.arr || !['float', 'int', 'uint'].includes(lv.t.base)) err(n, `'${n.op}' is not defined on ${lv.t.name}`);
        const { fn } = arith(n.op[0], lv.t, typeOf(lv.t.base, 1), n);
        return { t: lv.t, f: n.k === 'pre' ? (fr) => { const v = fn(get(fr), 1); set(fr, v); return v; }
          : (fr) => { const old = get(fr); set(fr, fn(old, 1)); return old; } };
      }
      case 'bin': {
        const a = cx(n.a, sc), b = cx(n.b, sc), A = a.f, B = b.f, op = n.op;
        if (op === '&&' || op === '||' || op === '^^') {
          if (a.t !== T.bool || b.t !== T.bool) err(n, `'${op}' needs two bools`);
          return { t: T.bool, f: op === '&&' ? (fr) => A(fr) && B(fr) : op === '||' ? (fr) => A(fr) || B(fr) : (fr) => A(fr) !== B(fr) };
        }
        if (op === '==' || op === '!=') {
          if (a.t !== b.t || a.t.base === 'void') err(n, `'${op}' cannot compare ${a.t.name} and ${b.t.name}`);
          return { t: T.bool, f: op === '==' ? (fr) => eq(A(fr), B(fr)) : (fr) => !eq(A(fr), B(fr)) };
        }
        if (BIN[op] === 8) {
          if (a.t !== b.t || a.t.size !== 1 || a.t.base === 'bool' || a.t.base === 'sampler') err(n, `'${op}' cannot compare ${a.t.name} and ${b.t.name}`);
          const f = { '<': (fr) => A(fr) < B(fr), '>': (fr) => A(fr) > B(fr), '<=': (fr) => A(fr) <= B(fr), '>=': (fr) => A(fr) >= B(fr) }[op];
          return { t: T.bool, f };
        }
        const { t, fn } = arith(op, a.t, b.t, n);
        return { t, f: (fr) => fn(A(fr), B(fr)) };
      }
      case 'assign': {
        const lv = clv(n.a, sc), b = cx(n.b, sc), B = b.f, { get, set } = lv;
        if (n.op === '=') {
          if (lv.t !== b.t) err(n, `cannot assign ${b.t.name} to ${lv.t.name}`);
          return { t: lv.t, f: (fr) => { const v = B(fr); set(fr, v); return v; } };
        }
        const { t, fn } = arith(n.op.slice(0, -1), lv.t, b.t, n);
        if (t !== lv.t) err(n, `'${n.op}' would make ${lv.t.name} a ${t.name}`);
        return { t, f: (fr) => { const v = fn(get(fr), B(fr)); set(fr, v); return v; } };
      }
      case 'cond': {
        const C = cond(n.c, sc), a = cx(n.a, sc), b = cx(n.b, sc), A = a.f, B = b.f;
        if (a.t !== b.t) err(n, `?: branches differ: ${a.t.name} and ${b.t.name}`);
        return { t: a.t, f: (fr) => (C(fr) ? A(fr) : B(fr)) };
      }
      case 'seq': {
        const es = n.list.map((e) => cx(e, sc)), fs = es.map((e) => e.f);
        return { t: es[es.length - 1].t, f: (fr) => { let v; for (const g of fs) v = g(fr); return v; } };
      }
      case 'call': return n.ctor ? ctor(n, sc) : ccall(n, sc);
      default: return err(n, `unexpected ${n.k}`);
    }
  }

  // l-values: { t, get(frame), set(frame, v) }; set stores a copy
  function clv(n, sc) {
    if (n.k === 'id') {
      const info = lookup(n.name, sc, n), c = copier(info.t), name = n.name, s = info.slot;
      if (info.ro) err(n, `'${name}' is read-only (const, uniform or a const parameter)`);
      return info.global ? { t: info.t, get: () => G[name], set: (fr, v) => { G[name] = c(v); } }
        : { t: info.t, get: (fr) => fr[s], set: (fr, v) => { fr[s] = c(v); } };
    }
    if (n.k === 'field') {
      const b = clv(n.a, sc), { idx, t } = swz(n, b.t);
      if (new Set(idx).size !== idx.length) err(n, `cannot write '.${n.name}': it repeats a component`);
      const one = idx.length === 1, i0 = idx[0];
      return { t, get: one ? (fr) => b.get(fr)[i0] : (fr) => { const v = b.get(fr); return idx.map((i) => v[i]); },
        set: (fr, v) => { const w = b.get(fr).slice(); if (one) w[i0] = v; else for (let k = 0; k < idx.length; k++) w[idx[k]] = v[k]; b.set(fr, w); } };
    }
    if (n.k === 'index') {
      const b = clv(n.a, sc), i = cx(n.i, sc), { len, et } = indexInfo(n, b.t, i.t), I = i.f, M = b.t.mat;
      const at = (fr) => { const k = I(fr); if (!(k >= 0 && k < len)) oob(n, k, len); return k; };
      if (b.t.arr) { const c = copier(et); return { t: et, get: (fr) => b.get(fr)[at(fr)], set: (fr, v) => { b.get(fr)[at(fr)] = c(v); } }; }
      if (M) return { t: et, get: (fr) => { const k = at(fr); return b.get(fr).slice(k * M, k * M + M); },
        set: (fr, v) => { const k = at(fr), w = b.get(fr).slice(); for (let j = 0; j < M; j++) w[k * M + j] = v[j]; b.set(fr, w); } };
      return { t: et, get: (fr) => b.get(fr)[at(fr)], set: (fr, v) => { const w = b.get(fr).slice(); w[at(fr)] = v; b.set(fr, w); } };
    }
    return err(n, 'this expression cannot be assigned to');
  }

  function ctor(n, sc) {
    const args = n.args.map((a) => cx(a, sc)), A = args.map((a) => a.f), base = typeByName(n.name);
    if (n.arr) {
      const len = n.arr === 'unsized' ? args.length : constInt(n.arr), c = copier(base);
      if (args.length !== len || args.some((a) => a.t !== base)) err(n, `${base.name}[${len}]() needs ${len} ${base.name} arguments`);
      return { t: arrayOf(base, len), f: (fr) => A.map((g) => c(g(fr))) };
    }
    const t = base, conv = CONV[t.base], sz = t.size;
    if (!conv || !args.length) err(n, `${t.name}() is not a constructor this evaluator supports`);
    for (const a of args) if (a.t.arr || !CONV[a.t.base]) err(n, `${t.name}() cannot take a ${a.t.name}`);
    if (args.length === 1 && args[0].t.size === 1) {
      const g = A[0], M = t.mat;
      if (sz === 1) return { t, f: (fr) => conv(g(fr)) };
      if (M) return { t, f: (fr) => { const x = conv(g(fr)), r = new Array(sz).fill(0); for (let i = 0; i < M; i++) r[i * M + i] = x; return r; } };
      return { t, f: (fr) => new Array(sz).fill(conv(g(fr))) };
    }
    if (t.mat && args.length === 1 && args[0].t.mat) {
      const M = t.mat, S = args[0].t.mat, g = A[0];
      return { t, f: (fr) => { const m = g(fr), r = new Array(sz); for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) r[j * M + i] = i < S && j < S ? m[j * S + i] : +(i === j); return r; } };
    }
    const sizes = args.map((a) => a.t.size), total = sizes.reduce((s, x) => s + x, 0), na = A.length;
    if (total < sz) err(n, `${t.name}() needs ${sz} components, got ${total}`);
    if (sz === 1) { const g = A[0]; return { t, f: (fr) => conv(g(fr)[0]) }; }
    return { t, f: (fr) => {
      const r = new Array(sz);
      let k = 0;
      for (let i = 0; i < na; i++) {
        const v = A[i](fr);
        if (sizes[i] === 1) { if (k < sz) r[k++] = conv(v); } else for (let j = 0; j < sizes[i] && k < sz; j++) r[k++] = conv(v[j]);
      }
      return r;
    } };
  }

  function ccall(n, sc) {
    const name = n.name, args = n.args.map((a) => cx(a, sc)), A = args.map((a) => a.f), ts = args.map((a) => a.t);
    const Fn = fnTable.get(name);
    if (Fn) {   // a function the source defines
      sig(Fn);
      const ps = Fn.params, np = ps.length;
      if (args.length !== np) err(n, `${name}() takes ${np} arguments, got ${args.length}`);
      ps.forEach((p, i) => { if (p.t !== ts[i]) err(n, `argument ${i + 1} of ${name}() must be a ${p.t.name}, got ${ts[i].name}`); });
      const ins = ps.map((p, i) => (p.q === 'out' ? null : A[i])), cps = ps.map((p) => copier(p.t));
      const outs = ps.map((p, i) => (p.q === 'in' ? null : clv(n.args[i], sc).set)), anyOut = outs.some(Boolean);
      return { t: Fn.ret, f: (fr) => {
        const impl = Fn.impl || compileFn(Fn), nf = new Array(impl.nslots);
        for (let i = 0; i < np; i++) nf[i + 1] = ins[i] ? cps[i](ins[i](fr)) : zero(ps[i].t);
        impl.run(nf);
        if (anyOut) for (let i = 0; i < np; i++) if (outs[i]) outs[i](fr, nf[i + 1]);
        return nf[0];
      } };
    }
    for (const t of ts) if (t.base === 'void') err(n, `${name}() cannot take a void argument`);
    const spec = CW[name];
    if (spec) {
      const [s0, ar, bases, rbase] = spec;
      if (Array.isArray(ar) ? !ar.includes(args.length) : ar !== args.length) err(n, `${name}() takes ${ar} arguments, got ${args.length}`);
      const sel = name === 'mix' && ts[2].base === 'bool';
      const s = sel ? (x, y, a) => (a ? y : x) : s0;
      let big = ts[0];
      for (const t of ts) if (t.size > big.size) big = t;
      ts.forEach((t, i) => {
        if (t.arr || (t.size !== 1 && t.size !== big.size)) err(n, `${name}() cannot combine ${ts.map((x) => x.name).join(', ')}`);
        if (!(sel && i === 2) && (t.base !== ts[0].base || !bases.split(' ').includes(t.base))) err(n, `${name}() does not take ${t.name} here`);
      });
      const t = big.mat && !rbase ? big : typeOf(rbase || ts[0].base, big.size);
      return { t, f: rnd(t, callN(liftN(s, ts.map((x) => x.size > 1), big.size), A)) };
    }
    const fl = (i) => ts[i] && ts[i].base === 'float' && !ts[i].arr;
    const want = (ok, t, fn) => { if (!ok) err(n, `${name}() does not take (${ts.map((x) => x.name).join(', ')})`); return { t, f: rnd(t, callN(fn, A)) }; };
    const same2 = args.length === 2 && fl(0) && ts[0] === ts[1];
    const len = (v) => (typeof v === 'number' ? Math.abs(v) : Math.sqrt(dotv(v, v)));
    switch (name) {
      case 'length': return want(args.length === 1 && fl(0) && !ts[0].mat, T.float, len);
      case 'distance': return want(same2 && !ts[0].mat, T.float, ts[0].size === 1 ? (a, b) => Math.abs(a - b) : (a, b) => len(a.map((x, i) => x - b[i])));
      case 'dot': return want(same2 && !ts[0].mat, T.float, ts[0].size === 1 ? (a, b) => a * b : dotv);
      case 'cross': return want(same2 && ts[0] === T.vec3, T.vec3, (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]);
      case 'normalize': return want(args.length === 1 && fl(0) && !ts[0].mat, ts[0], ts[0].size === 1 ? Math.sign : (v) => { const l = len(v); return v.map((x) => x / l); });
      case 'reflect': return want(same2 && ts[0].size > 1, ts[0], (I, Nv) => { const d = 2 * dotv(Nv, I); return I.map((x, i) => x - d * Nv[i]); });
      case 'refract': return want(args.length === 3 && fl(0) && ts[0] === ts[1] && ts[2] === T.float, ts[0], (I, Nv, eta) => {
        const d = dotv(Nv, I), k = 1 - eta * eta * (1 - d * d);
        return k < 0 ? I.map(() => 0) : I.map((x, i) => eta * x - (eta * d + Math.sqrt(k)) * Nv[i]);
      });
      case 'faceforward': return want(args.length === 3 && fl(0) && ts[0] === ts[1] && ts[1] === ts[2] && ts[0].size > 1, ts[0], (Nv, I, Nr) => (dotv(Nr, I) < 0 ? Nv.slice() : Nv.map((x) => -x)));
      case 'any': case 'all': case 'not': {
        const ok = args.length === 1 && ts[0].base === 'bool' && ts[0].size > 1 && !ts[0].arr;
        return want(ok, name === 'not' ? ts[0] : T.bool, name === 'any' ? (v) => v.some(Boolean) : name === 'all' ? (v) => v.every(Boolean) : (v) => v.map((x) => !x));
      }
      case 'transpose': { const M = ts[0] && ts[0].mat; return want(args.length === 1 && M, ts[0], (m) => m.map((_, k) => m[(k % M) * M + Math.floor(k / M)])); }
    }
    if (/^(texture|texel)/.test(name) || DERIV.has(name)) {   // handed to the bindings
      let t = ts[0];
      if (!DERIV.has(name)) {
        const st = ts[0];
        if (!st || st.base !== 'sampler') err(n, `${name}() needs a sampler as its first argument`);
        const pre = st.name[0] === 'i' || st.name[0] === 'u' ? st.name[0] : '';
        t = name === 'textureSize' ? T[`ivec${/3D|Array/.test(st.name) ? 3 : 2}`] : /Shadow/.test(st.name) ? T.float : T[`${pre}vec4`];
      } else if (args.length !== 1 || !t || t.base !== 'float') err(n, `${name}() takes one float argument`);
      const cps = ts.map(copier);
      return { t, f: (fr) => {
        const vals = A.map((g, i) => cps[i](g(fr))), h = bindings[name];
        if (typeof h !== 'function') throw new Error(`GLSL line ${n.line}: ${name}(${DERIV.has(name) ? '' : vals[0]}) was called but bindings.${name} is not a function`);
        return fromJS(t, h(...vals), `bindings.${name}() result`);
      } };
    }
    return err(n, `'${name}' is not a function in the source or a supported built-in`);
  }

  // ─── statements: node -> f(frame) returning 0 | BRK | CNT | RET ──────
  function cblock(stmts, sc) {
    const list = stmts.map((s) => cs(s, sc)), n = list.length;
    return (fr) => { for (let i = 0; i < n; i++) { const r = list[i](fr); if (r) return r; } return 0; };
  }
  function cs(s, sc) {
    switch (s.k) {
      case 'block': return cblock(s.body, scope(sc));
      case 'empty': return () => 0;
      case 'expr': { const e = cx(s.e, sc).f; return (fr) => { e(fr); return 0; }; }
      case 'decl': {
        const parts = s.list.map((d) => {
          const init = d.init ? cx(d.init, sc) : null, t = declType(s.type, d.arr, init, d);
          if (init && init.t !== t) err(d, `cannot initialize ${t.name} ${d.name} with a ${init.t.name}`);
          const slot = sc.fn.nslots++, I = init && init.f, c = copier(t);
          sc.vars.set(d.name, { t, slot, ro: s.isConst });
          return I ? (fr) => { fr[slot] = c(I(fr)); } : (fr) => { fr[slot] = zero(t); };
        });
        return (fr) => { for (const p of parts) p(fr); return 0; };
      }
      case 'if': {
        const c = cond(s.c, sc), a = cs(s.a, scope(sc)), b = s.b ? cs(s.b, scope(sc)) : null;
        return b ? (fr) => (c(fr) ? a(fr) : b(fr)) : (fr) => (c(fr) ? a(fr) : 0);
      }
      case 'for': {
        const inner = scope(sc), init = s.init ? cs(s.init, inner) : null, c = s.c ? cond(s.c, inner) : null;
        const step = s.step ? cx(s.step, inner).f : null, body = cs(s.body, scope(inner));
        return (fr) => {
          if (init) init(fr);
          for (;;) {
            if (c && !c(fr)) return 0;
            const r = body(fr);
            if (r === BRK) return 0;
            if (r === RET) return RET;
            if (step) step(fr);
          }
        };
      }
      case 'while': case 'do': {
        const c = cond(s.c, sc), body = cs(s.body, scope(sc)), first = s.k === 'do';
        return (fr) => {
          for (let go = first || c(fr); go; go = c(fr)) { const r = body(fr); if (r === BRK) break; if (r === RET) return RET; }
          return 0;
        };
      }
      case 'ret': {
        const want = sc.fn.ret;
        if (!s.e) { if (want !== T.void) err(s, `${sc.fn.name}() must return a ${want.name}`); return () => RET; }
        const e = cx(s.e, sc), E = e.f;
        if (e.t !== want) err(s, `${sc.fn.name}() returns ${want.name}, not ${e.t.name}`);
        return (fr) => { fr[0] = E(fr); return RET; };
      }
      case 'break': return () => BRK;
      case 'continue': return () => CNT;
      case 'discard': return () => { throw new GlslDiscard(); };
      default: return err(s, `unexpected ${s.k}`);
    }
  }

  // ─── assemble: functions first (names), then globals in order ────────
  for (const it of items) {
    if (it.k !== 'fn') continue;
    const prev = fnTable.get(it.name);
    if (prev && prev.body && it.body) err(it, `function '${it.name}' is defined twice (overloads are not supported)`);
    if (!prev || it.body) fnTable.set(it.name, { name: it.name, node: it, body: it.body, impl: null, sig: false });
  }
  for (const it of items) {
    if (it.k !== 'gdecl') continue;
    const ro = it.q.has('const') || it.q.has('uniform');
    for (const d of it.list) {
      const bound = Object.hasOwn(bindings, d.name);
      const init = d.init && !bound ? cx(d.init, null) : null, t = declType(it.type, d.arr, init, d);
      ginfo.set(d.name, { t, ro, global: true });
      if (t.base === 'sampler') G[d.name] = d.name;
      else if (bound) G[d.name] = fromJS(t, bindings[d.name], `bindings.${d.name}`);
      else if (init) { if (init.t !== t) err(d, `cannot initialize ${t.name} ${d.name} with a ${init.t.name}`); G[d.name] = copier(t)(init.f([])); }
      else G[d.name] = zero(t);
    }
  }
  const out = { globals: G };
  for (const Fn of fnTable.values()) {
    if (!Fn.body) continue;
    if (Fn.name === 'globals') err(Fn.node, "a function named 'globals' would hide the global store");
    out[Fn.name] = (...args) => {
      const impl = Fn.impl || compileFn(Fn), ps = Fn.params;
      if (args.length !== ps.length) throw new TypeError(`GLSL: ${Fn.name}() takes ${ps.length} arguments, got ${args.length}`);
      const fr = new Array(impl.nslots);
      const boxed = (a, p) => p.q !== 'in' && a !== null && typeof a === 'object' && !Array.isArray(a) && !ArrayBuffer.isView(a);
      ps.forEach((p, i) => {
        const a = args[i];
        fr[i + 1] = p.q === 'out' ? zero(p.t) : fromJS(p.t, boxed(a, p) ? a.value : a, `${Fn.name}() argument ${i + 1} (${p.name})`);
      });
      impl.run(fr);
      ps.forEach((p, i) => { if (boxed(args[i], p)) args[i].value = copier(p.t)(fr[i + 1]); });
      return Fn.ret === T.void ? undefined : copier(Fn.ret)(fr[0]);
    };
  }
  return out;
}
