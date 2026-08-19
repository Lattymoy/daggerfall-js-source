// Mutation driver for project-dagger AUDIT 18.
//
//   node .mutaudit/mutate.mjs --files <glob-ish substr,...> [--ops REL,NUM,...]
//                             [--per-file N] [--seed N] [--out log.jsonl] [--full]
//
// For each mutant: patch file -> node --check -> run the minimal test subset that
// V8 coverage says executes that line -> revert. Survivors are re-confirmed against
// the full suite by confirm.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const COV = JSON.parse(fs.readFileSync(path.join(ROOT, '.mutaudit/cov.json'), 'utf8'));
const ALLTESTS = fs.readdirSync(path.join(ROOT, 'test')).filter(f => f.endsWith('.test.js')).sort();

const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; }
const flag = (name) => argv.includes('--' + name);

const filesSel = (arg('files', '') || '').split(',').filter(Boolean);
const opsSel = new Set((arg('ops', '') || '').split(',').filter(Boolean));
const perFile = Number(arg('per-file', '40'));
const OUTLOG = path.join(ROOT, '.mutaudit', arg('out', 'log.jsonl'));
const MAXSUBSET = Number(arg("max-subset", "126"));
let seed = Number(arg('seed', '12345'));
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

/* ------------------------------------------------------------------ masking */
// Returns array `mask` where mask[i] is true when index i is *code* (not string /
// comment / regex / template literal body).
function maskCode(s) {
  const m = new Uint8Array(s.length).fill(1);
  let i = 0;
  const prevSignificant = (k) => { let j = k - 1; while (j >= 0 && /\s/.test(s[j])) j--; return j >= 0 ? s[j] : ''; };
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { const e = s.indexOf('\n', i); const end = e < 0 ? s.length : e; m.fill(0, i, end); i = end; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); const end = e < 0 ? s.length : e + 2; m.fill(0, i, end); i = end; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < s.length && s[j] !== c) { if (s[j] === '\\') j++; j++; }
      m.fill(0, i, Math.min(j + 1, s.length)); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1; let depth = 0;
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '$' && s[j + 1] === '{') { depth++; j += 2; continue; }
        if (s[j] === '}' && depth > 0) { depth--; j++; continue; }
        if (s[j] === '`' && depth === 0) break;
        j++;
      }
      m.fill(0, i, Math.min(j + 1, s.length)); i = j + 1; continue;
    }
    if (c === '/') {
      const p = prevSignificant(i);
      if (p === '' || '=(,:[!&|?{;+*%~^'.includes(p) || /\n/.test(s.slice(0, i).slice(-1))) {
        // possible regex literal
        let j = i + 1, cls = false, ok = false;
        while (j < s.length && s[j] !== '\n') {
          if (s[j] === '\\') { j += 2; continue; }
          if (s[j] === '[') cls = true;
          else if (s[j] === ']') cls = false;
          else if (s[j] === '/' && !cls) { ok = true; break; }
          j++;
        }
        if (ok) { while (j + 1 < s.length && /[a-z]/.test(s[j + 1])) j++; m.fill(0, i, Math.min(j + 1, s.length)); i = j + 1; continue; }
      }
    }
    i++;
  }
  return m;
}

/* ---------------------------------------------------------------- operators */
const PAIR_OPS = [
  ['REL', '<=', '<'], ['REL', '>=', '>'], ['REL', '===', '!=='], ['REL', '!==', '==='],
  ['LOGIC', '&&', '||'], ['LOGIC', '||', '&&'],
  ['SHIFT', '>>>', '>>'], ['SHIFT', '>>', '>>>'],
];
const IDENT_OPS = [
  ['MATH', 'Math.floor', 'Math.round'], ['MATH', 'Math.trunc', 'Math.round'],
  ['MATH', 'Math.round', 'Math.trunc'], ['MATH', 'Math.ceil', 'Math.floor'],
  ['MATHSIGN', 'Math.floor', 'Math.trunc'], ['MATHSIGN', 'Math.trunc', 'Math.floor'],
  ['CLAMP', 'Math.max', 'Math.min'], ['CLAMP', 'Math.min', 'Math.max'],
  ['BOOL', 'true', 'false'], ['BOOL', 'false', 'true'],
];

function sites(text, rel) {
  const m = maskCode(text);
  const out = [];
  const lineOf = (() => { const ls = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') ls.push(i + 1); return (o) => { let lo = 0, hi = ls.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ls[mid] <= o) lo = mid; else hi = mid - 1; } return lo + 1; }; })();
  const codeAt = (i, n) => { for (let k = i; k < i + n; k++) if (!m[k]) return false; return true; };

  // ordered scan so longer ops win (>>> before >>, <= before <, === before ==)
  for (let i = 0; i < text.length; i++) {
    if (!m[i]) continue;
    let matched = false;
    for (const [op, from, to] of PAIR_OPS) {
      if (text.startsWith(from, i) && codeAt(i, from.length)) {
        // avoid matching inside a longer operator
        if (from === '>>' && text.startsWith('>>>', i)) continue;
        if (from === '<=' || from === '>=') { /* ok */ }
        out.push({ op, start: i, end: i + from.length, from, to, line: lineOf(i) });
        i += from.length - 1; matched = true; break;
      }
    }
    if (matched) continue;
    // bare < and > (not part of <=, >=, <<, >>, =>, </)
    if ((text[i] === '<' || text[i] === '>') && m[i]) {
      const n = text[i + 1], p = text[i - 1];
      if (n !== '=' && n !== text[i] && p !== '=' && p !== '<' && p !== '>' && p !== '!') {
        out.push({ op: 'REL', start: i, end: i + 1, from: text[i], to: text[i] + '=', line: lineOf(i) });
      }
      continue;
    }
    // identifier-ish ops
    for (const [op, from, to] of IDENT_OPS) {
      if (text.startsWith(from, i) && codeAt(i, from.length)) {
        const p = text[i - 1] || ' ', n = text[i + from.length] || ' ';
        if (/[A-Za-z0-9_$.]/.test(p)) break;
        if (/[A-Za-z0-9_$]/.test(n)) break;
        out.push({ op, start: i, end: i + from.length, from, to, line: lineOf(i) });
        break;
      }
    }
  }

  // numeric literals
  const NUM = /(?<![A-Za-z0-9_$.])(0[xX][0-9a-fA-F]+|\d+\.\d+|\d+)(?![A-Za-z0-9_$.])/g;
  let g;
  while ((g = NUM.exec(text))) {
    const i = g.index;
    if (!codeAt(i, g[0].length)) continue;
    if (text[i - 1] === '.') continue;
    const lit = g[0];
    let to;
    if (/^0[xX]/.test(lit)) to = '0x' + (parseInt(lit, 16) + 1).toString(16);
    else if (lit.includes('.')) to = String(Number(lit) + 1);
    else to = String(BigInt(lit) + 1n);
    out.push({ op: 'NUM', start: i, end: i + lit.length, from: lit, to, line: lineOf(i) });
  }

  // unary ! removal
  const NOT = /(^|[(,=&|?:;{[\s])!(?=[A-Za-z_$(])/g;
  while ((g = NOT.exec(text))) {
    const i = g.index + g[1].length;
    if (!m[i]) continue;
    if (text[i + 1] === '=') continue;
    out.push({ op: 'NOT', start: i, end: i + 1, from: '!', to: '', line: lineOf(i) });
  }
  void rel;
  return out.sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------------- runner */
function testsForLine(rel, line) {
  const f = COV[rel];
  if (!f) return null;                       // file never loaded by any test
  const t = f[String(line)];
  return t ? [...new Set(t)] : [];           // [] === line never executed
}

function runTests(list) {
  const argsList = list.length ? list.map(t => path.join('test', t)) : [];
  const r = spawnSync(process.execPath, ['--test', ...argsList], {
    cwd: ROOT, encoding: 'utf8', timeout: 300000,
    env: { ...process.env, ARENA2_PATH: process.env.ARENA2_PATH },
  });
  if (r.error && r.error.code === 'ETIMEDOUT') return { status: 'TIMEOUT' };
  return { status: r.status === 0 ? 'PASS' : 'FAIL', out: (r.stdout || '') + (r.stderr || '') };
}

/* --------------------------------------------------------------------- main */
const allSrc = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) allSrc.push(path.relative(ROOT, p));
  }
})(path.join(ROOT, 'src'));

const targets = allSrc.filter(f => !filesSel.length || filesSel.some(s => f.includes(s))).sort();
const log = { write: (s) => fs.appendFileSync(OUTLOG, s), end: () => {} };  // sync: spawnSync starves the event loop
let nRun = 0, nCaught = 0, nSurv = 0, nDead = 0, nSkip = 0;

for (const rel of targets) {
  const abs = path.join(ROOT, rel);
  const orig = fs.readFileSync(abs, 'utf8');
  let cand = sites(orig, rel).filter(s => !opsSel.size || opsSel.has(s.op));
  // prefer covered lines, then sample
  const covered = [], uncovered = [];
  for (const s of cand) {
    const t = testsForLine(rel, s.line);
    if (t === null || t.length === 0) uncovered.push(s); else { s.tests = t; covered.push(s); }
  }
  // report uncovered-by-construction sites without running
  for (const s of uncovered) {
    nDead++;
    log.write(JSON.stringify({ file: rel, line: s.line, op: s.op, from: s.from, to: s.to, verdict: 'NO_TEST_EXECUTES_LINE', tests: 0 }) + '\n');
  }
  // sample covered sites
  const pick = [];
  const pool = covered.slice();
  const budget = Math.min(perFile, pool.length);
  for (let k = 0; k < budget; k++) { const j = Math.floor(rnd() * pool.length); pick.push(pool.splice(j, 1)[0]); }
  pick.sort((a, b) => a.start - b.start);

  for (const s of pick) {
    const mutated = orig.slice(0, s.start) + s.to + orig.slice(s.end);
    if (mutated === orig) { nSkip++; continue; }
    fs.writeFileSync(abs, mutated);
    const chk = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
    if (chk.status !== 0) { fs.writeFileSync(abs, orig); nSkip++; continue; }
    const subset = s.tests.length && s.tests.length <= MAXSUBSET && !flag('full') ? s.tests : ALLTESTS;
    let res = runTests(subset);
    let escalated = false;
    // Escalate to the FULL suite whenever the minimal subset passes, so every
    // SURVIVED verdict is definitive (no reliance on coverage-map precision).
    if (flag('escalate') && res.status === 'PASS' && subset.length < ALLTESTS.length) {
      escalated = true;
      res = runTests(ALLTESTS);
    }
    fs.writeFileSync(abs, orig);
    nRun++;
    const verdict = res.status === 'PASS' ? 'SURVIVED' : (res.status === 'TIMEOUT' ? 'TIMEOUT' : 'CAUGHT');
    if (verdict === 'SURVIVED') nSurv++; else nCaught++;
    log.write(JSON.stringify({
      file: rel, line: s.line, op: s.op, from: s.from, to: s.to,
      verdict, escalated, tests: subset.length, subset: subset.length <= 12 ? subset : undefined,
      snippet: orig.slice(orig.lastIndexOf('\n', s.start) + 1, orig.indexOf('\n', s.end) < 0 ? undefined : orig.indexOf('\n', s.end)).trim().slice(0, 160),
    }) + '\n');
    process.stderr.write(`${verdict === 'SURVIVED' ? 'SURV ' : 'caught'} ${rel}:${s.line} ${s.op} ${s.from}->${s.to} (${subset.length} tests)\n`);
  }
  // safety: ensure clean
  fs.writeFileSync(abs, orig);
}
log.end();
console.log(JSON.stringify({ run: nRun, caught: nCaught, survived: nSurv, noTestExecutesLine: nDead, skippedInvalid: nSkip }));
