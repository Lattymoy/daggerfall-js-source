// FIRM1 (bible/06-Systems/Firmament.md) - THE FIRMAMENT LAB: the passive tree's window on a page of its own, with made-up
// purses and no service and no game data, so the sky can be judged on a real screen at real sizes, in either dress
// (`?dress=grimoire`), and driven by a probe. Everything but the purses is the SHIPPING code: the tree, the law and the
// window are the game's own; a confirm here is kept in this browser's storage alone.
import { mountFirmamentWindow } from '../ui/firmamentWindow.js';
import { starsFor, craftPointsFor, unpackTree, packTree } from '../net/firmament/firmamentLaw.js';

const KEY = 'firm1.lab';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* a lab's convenience */ } };
const params = new URLSearchParams(location.search);
const saved = read();
const lab = {
  renown: Number(params.get('renown') ?? saved.renown ?? 30),
  ranks: Number(params.get('ranks') ?? saved.ranks ?? 320),
  tree: params.has('fresh') ? '' : (saved.tree ?? ''),
};
let view = null;
function mount() {
  view?.destroy?.();
  const host = document.getElementById('lab');
  view = mountFirmamentWindow(host, {
    preview: {
      tree: unpackTree(lab.tree), stars: starsFor(lab.renown), craft: craftPointsFor(Array.from({ length: 10 }, (_, i) => Math.floor(lab.ranks / 10) + (i < lab.ranks % 10 ? 1 : 0))), renown: lab.renown,
      commit: async (tree) => { lab.tree = packTree(tree); write(lab); return { ok: true }; },
    },
    onExit: () => setTimeout(mount, 400),
  });
  globalThis.firmamentLab = view;   // the probe's handle
  lanes();
}
function lanes() {
  const box = document.getElementById('lanes');
  box.replaceChildren();
  const b = (label, on, fn) => { const e = document.createElement('button'); e.textContent = label; if (on) e.className = 'on'; e.onclick = fn; box.append(e); };
  for (const r of [1, 10, 25, 50]) b(`Renown ${r}`, lab.renown === r, () => { lab.renown = r; write(lab); mount(); });
  for (const k of [0, 160, 600, 1000]) b(`${k} ranks`, lab.ranks === k, () => { lab.ranks = k; write(lab); mount(); });
  const grim = params.get('dress') === 'grimoire';
  b(grim ? 'Enhanced Plus' : 'DFO Grimoire', false, () => { const u = new URL(location.href); u.searchParams.set('dress', grim ? 'none' : 'grimoire'); location.href = u.toString(); });
  b('Clear sky', false, () => { lab.tree = ''; write(lab); mount(); });
}
mount();
