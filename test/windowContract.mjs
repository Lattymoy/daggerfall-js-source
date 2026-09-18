// THE HOST<->WINDOW CONTRACT, DERIVED - the shared library behind
// test/crash1_overlay_contract.test.js and
// test/crash2_window_contract.test.js.
//
// WHY A LIBRARY AND NOT TWO COPIES. CRASH1 shipped a gate whose door
// list derived and whose ARM list did not: four arm names typed by
// hand. One commit later CRASH2 found that list wrong in both
// directions - it demanded `close`, which no host has ever called on a
// slot, and omitted `tick`, which interior.js calls unguarded every
// frame. A second copy of that list would have been a second thing to
// keep in step, which is the failure this whole program exists to
// remove (01-Overview/Hardening.md). So the arms are READ OFF THE
// HOSTS, the population is READ OFF THE HOSTS, and both gates ask this
// module rather than each other.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const read = (p) => readFileSync(join(ROOT, p), 'utf8');
export const jsIn = (dir) => readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => `${dir}/${f}`).sort();

/** Every door in ui/ - the modules a host opens a window through. */
export const doors = () => jsIn('src/ui').filter((p) => /Door\.js$/.test(p));

/** A door that builds its window as a DOM overlay: the shape at issue. */
export const isDomDoor = (src) => /document\.createElement|document\.body\.append/.test(src);

/**
 * THE WINDOW OBJECTS a module builds inline, as source blocks.
 *
 * CRASH2 F1: the first version of this matched `return {` ALONE, so
 * `ui/pauseDoor.js` and `ui/inventoryDoor.js` - which name the object
 * (`const overlay = { ... }`) before handing it over - were never read
 * at all, and the gate reported green over five of eight doors. The
 * pause menu was one of the two, and the pause menu is half of what
 * the player reported. A gate that skips in silence is worse than no
 * gate, so `domDoorWindows` below also ASSERTS its own coverage.
 */
export function inlineWindows(src) {
  const out = [];
  const re = /(?:return|(?:const|let)\s+[A-Za-z_$][\w$]*\s*=)\s*\{\n([\s\S]*?)\n {2}\};/g;
  for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

/** Does an object-literal block answer `arm`? A method (`input() {}`),
 *  a property (`dispose: close`), a getter (`get done()`) or SHORTHAND
 *  (`close,`) all count - the first draft of this matcher missed the
 *  shorthand and reported three healthy doors, which is the kind of
 *  false red that gets a gate deleted. */
export const blockHas = (block, arm) =>
  new RegExp(`(^|\\n)\\s*(${arm}\\s*[(:,]|get ${arm}\\b|${arm}\\s*$)`, 'm').test(block);

/** Does a class body carry `arm` as a method? */
export const classHas = (src, arm) => new RegExp(`^\\s{2}(async\\s+)?${arm}\\s*\\(`, 'm').test(src);

// ---------------------------------------------------------------- //
// THE ARMS, read off the hosts.
// ---------------------------------------------------------------- //

/** A host is a scene that owns a window stack; its SLOT is the mirror
 *  `onTop` writes (ui/windowStack.js). Derived, so a fifth host enters
 *  these gates by existing. */
export function hostSlots() {
  const out = [];
  for (const path of jsIn('src/scenes')) {
    const src = read(path);
    const slots = [...src.matchAll(/makeWindowStack\(\{[^}]*onTop:\s*\(\w+\)\s*=>\s*\{\s*([A-Za-z_$][\w$]*)\s*=/g)].map((m) => m[1]);
    if (slots.length) out.push({ path, src, slots });
  }
  return out;
}

/** The enclosing function body of line `i`, by indentation.
 *
 *  THE SCOPE IS THE LAW, NOT A WINDOW SIZE. The first pass here used a
 *  fixed four-line lookback and so called `townTalk.js:1207`
 *  `overlay.hover(...)` unguarded - its guard, `if (!overlay?.hover)
 *  return false`, sits eight lines up at the top of the same function.
 *  HARD2's D10 pin was re-aimed off a fixed 80-line window for exactly
 *  this reason. */
export function enclosingScope(lines, i) {
  const ind = (s) => s.match(/^\s*/)[0].length;
  const mine = ind(lines[i]);
  for (let j = i - 1; j >= 0; j--) {
    if (!lines[j].trim()) continue;
    if (ind(lines[j]) < mine && /(function\b|=>\s*\{|\)\s*\{)\s*$/.test(lines[j])) return lines.slice(j, i + 1).join('\n');
  }
  return lines.slice(Math.max(0, i - 40), i + 1).join('\n');
}

/** Is line `i` inside a `window.__…` debug probe rather than the
 *  play path? worldModes' inventory probes call `_remote`, `_pick`,
 *  `items`, `labels` and `enabled` straight off the slot, each behind
 *  a DUCK-TYPE test (`isInventory`, worldModes.js:6572) that this
 *  file's guard reader cannot see because the test names a parameter,
 *  not the slot. They are hooks the harness drives with a known window
 *  up, not arms the game calls on whatever is open, so they are not
 *  contract - and `hostArms` reports them SEPARATELY rather than
 *  dropping them, so a real arm can never be lost down this path. */
export function inProbe(lines, i) {
  const ind = (s) => s.match(/^\s*/)[0].length;
  const mine = ind(lines[i]);
  for (let j = i - 1; j >= 0; j--) {
    if (!lines[j].trim()) continue;
    if (ind(lines[j]) >= mine) continue;
    if (/window\.__[A-Za-z0-9_$]+\s*=/.test(lines[j])) return true;
    if (/(function\b|=>\s*\{|\)\s*\{)\s*$/.test(lines[j])) return false;
  }
  return false;
}

/**
 * Every arm a host CALLS on its slot, split by whether the call is
 * guarded. An UNGUARDED call is a hard requirement: the window is
 * there, so `?.` on the object saves nothing, and a missing method is
 * a TypeError thrown inside the host's own event handler - which is a
 * crash the player sees and no test does. A guarded call is the
 * window's own choice (`townTalk.js:432`: "OPTIONAL by design").
 *
 * @returns {{required: Map<string, string[]>, optional: Set<string>, probeOnly: Map<string, string[]>}}
 */
export function hostArms() {
  const required = new Map();   // arm -> ["townTalk.js:371", ...]
  const optional = new Set();
  const probeOnly = new Map();
  for (const { path, src, slots } of hostSlots()) {
    const lines = src.split('\n');
    for (const slot of slots) {
      const call = new RegExp(`\\b${slot}(\\?)?\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g');
      lines.forEach((text, i) => {
        for (const m of text.matchAll(call)) {
          const [, optChain, arm] = m;
          const scope = enclosingScope(lines, i);
          // a mention of the arm that is NOT a call IS the test:
          // `?.`, `typeof slot.arm ===`, `if (slot.arm)`, `!slot?.arm`
          const tested = new RegExp(`\\b${slot}\\??\\.${arm}\\s*(?!\\()`).test(scope);
          if (optChain || tested) { optional.add(arm); continue; }
          const where = `${path.split('/').pop()}:${i + 1}`;
          const bag = inProbe(lines, i) ? probeOnly : required;
          if (!bag.has(arm)) bag.set(arm, []);
          bag.get(arm).push(where);
        }
      });
    }
  }
  for (const arm of required.keys()) { optional.delete(arm); probeOnly.delete(arm); }
  return { required, optional, probeOnly };
}

// ---------------------------------------------------------------- //
// THE POPULATION, read off the hosts.
// ---------------------------------------------------------------- //

/** The name of the thing a window-valued expression produces, or null.
 *  `new RestWindow(...)` -> RestWindow; `host.makeJournal?.('x')` ->
 *  makeJournal; `openInventory(a, b)` -> openInventory. */
export function producerName(expr) {
  const t = String(expr).trim();
  const ctor = t.match(/^new\s+([A-Za-z_$][\w$]*)/);
  if (ctor) return ctor[1];
  const call = t.match(/^(?:[A-Za-z_$][\w$]*\??\.)*([A-Za-z_$][\w$]*)\s*\??\.?\(/);
  if (call && !['if', 'return', 'typeof', 'await', 'JSON'].includes(call[1])) return call[1];
  return null;
}

/**
 * Every expression that can reach a host's slot, and whether that
 * host's population is CLOSED - every site hands it a literal
 * `new X(...)`, so the set is exactly those classes and nothing else
 * can arrive.
 *
 * WHY CLOSEDNESS IS THE POINT. The required arms are NOT uniform:
 * `tick` is required by interior.js alone (:361, every frame), and
 * several windows in this tree answer no `tick` at all - ActionTextBox,
 * ChoiceWindow, ListPickerWindow, TalkWindow, TransportWindow,
 * MerchantServiceWindow. Demanding the union of every host's arms of
 * every window would therefore be a FALSE RED five times over. What
 * makes interior.js safe is not that its window happens to have `tick`
 * but that its slot can hold ONE class, written at the push site. So
 * the gate pins the closedness, and the day a second window is wired
 * into that host the pin says which arms it now owes.
 */
export function hostPopulations() {
  const out = [];
  for (const { path, src, slots } of hostSlots()) {
    const lines = src.split('\n');
    const sites = [];   // { expr, name, literal, where }
    const note = (expr, where) => {
      const name = producerName(expr);
      if (!name) return;
      sites.push({ name, literal: /^new\s/.test(String(expr).trim()), where });
    };
    // the host's own push wrapper(s): a function that reaches pushWindow
    const wrappers = [...src.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>)[\s\S]{0,2000}?\.pushWindow\(/g)]
      .map((m) => m[1] || m[2]).filter(Boolean);
    lines.forEach((text, i) => {
      const where = `${path}:${i + 1}`;
      for (const slot of slots) {
        const asg = text.match(new RegExp(`(?:^|[^.\\w])${slot}\\s*=\\s*(.+)$`));
        if (asg && !/^(null|undefined|w|win)\s*[;,)]/.test(asg[1].trim())) note(asg[1], where);
      }
      const direct = text.match(/\.(?:pushWindow|changeWindow)\(\s*(.+)$/);
      if (direct) note(direct[1], where);
      for (const w of wrappers) {
        if (new RegExp(`(function|const)\\s+${w}\\b`).test(text)) continue;   // its definition, not a call
        const c = text.match(new RegExp(`\\b${w}\\s*\\(\\s*(.+)$`));
        if (c) note(c[1], where);
      }
    });
    const named = sites.filter((s2) => !['w', 'win', 'window'].includes(s2.name));
    out.push({
      path, slots, wrappers, sites: named,
      names: [...new Set(named.map((s2) => s2.name))].sort(),
      closed: named.length > 0 && named.every((s2) => s2.literal),
    });
  }
  return out;
}
