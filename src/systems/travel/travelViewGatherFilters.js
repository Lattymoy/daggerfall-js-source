// @ts-check
// OW-GATHER-TYPES: which gathering nodes the Overworld counts. Under the Gathering switch (travelViewFilters.js), shown
// only while it is on, two refinements that scenes/gatherHost.js overworldGroups reads before a node is counted:
//   mine   - "Workable by me": only nodes my rank in their profession may work (professionLaw tierOpen)
//   hidden - the node types switched OFF, by type key; a type absent from the list shows, so a new ore shows until hidden
// A node of a kind this file does not know (hunting's bodies, a kind added later) has no type and is never filtered.
import { appStorage } from '../appStorage.js';
import { t } from '../textManager.js';   // L10N4: the panel's words
import { VEIN_TABLES, DUNGEON_VEINS, HERB_TABLES, herbTier } from '../../net/nodeLaw.js';
import { ORES, WOODS, minedMaterial, tierOpen } from '../../net/professionLaw.js';
import { materialLabel } from '../professions/profItems.js';
import { templateByIndex } from '../item/itemTemplates.js';

// A type key is `<kind>:<what the node is>`: `mine:metal:iron`, `mine:boulder`, `mine:motherlode`, `tree:log:oak`, `herb:<index>`.
// The catalogue below reads the tables the law draws nodes from, so it cannot offer a type the ground never stands.
export const TV_GATHER_STORE_KEY = 'dfjs.overworld.gather';

/** The panel's words. */
export const TV_GATHER_TEXT = Object.freeze({
  get title() { return t('travel.gather.title', 'Gathering'); },
  get mine() { return t('travel.gather.mine', 'Workable by me'); },
  mineTip: (on) => (on ? t('travel.gather.mineOn', 'Showing only nodes my rank can work. Click to show every node') : t('travel.gather.mineOff', 'Click to show only nodes my rank can work')),
  typeTip: (label, on) => (on ? t('travel.gather.hide', 'Hide {what} on the overworld', { what: label.toLowerCase() }) : t('travel.gather.show', 'Show {what} on the overworld', { what: label.toLowerCase() })),
  head: (title, shown, all) => t('travel.gather.head', '{title} {shown}/{all}', { title, shown, all }),
  get all() { return t('travel.gather.all', 'All'); },
  get none() { return t('travel.gather.none', 'None'); },
});

/** @typedef {{ key: string, label: string }} GatherType */
/** @typedef {{ kind: string, profession: string, title: string, types: GatherType[] }} GatherSection */

const byLabel = (a, b) => a.label.localeCompare(b.label);
const oreWord = (key) => materialLabel(key).replace(/ Ore$/, '');

/** Mining's types: every ore a vein can be (surface or deep), the stone, and a motherlode - lowest tier first. */
function miningTypes() {
  const keys = new Set([...Object.values(VEIN_TABLES).flat(), ...DUNGEON_VEINS, ...ORES.map((o) => o.key)]);
  const ores = [...keys].map((key) => ({ key: `mine:${key}`, label: oreWord(key), tier: minedMaterial(key)?.tier ?? 0 }))
    .sort((a, b) => a.tier - b.tier || byLabel(a, b));
  return [...ores.map(({ key, label }) => ({ key, label })), { key: 'mine:boulder', label: t('travel.gather.boulder', 'Boulder') }, { key: 'mine:motherlode', label: t('travel.gather.motherlode', 'Motherlode') }];
}

/** Logging's types: the seven woods, lowest tier first. */
const loggingTypes = () => WOODS.map((w) => ({ key: `tree:log:${w.id}`, label: w.name }));

/** Herbalism's types: every herb any climate grows, lowest tier first. */
function herbTypes() {
  const indexes = new Set(Object.values(HERB_TABLES).flatMap((table) => table.flat()));
  return [...indexes]
    .map((i) => ({ key: `herb:${i}`, label: templateByIndex(i)?.name ?? `Herb ${i}`, tier: herbTier(i) ?? 9 }))
    .sort((a, b) => a.tier - b.tier || byLabel(a, b))
    .map(({ key, label }) => ({ key, label }));
}

/** @type {GatherSection[] | null} */
let sections = null;
/** The types a player can pick, a section a profession - built once, when the panel first asks. */
export function gatherSections() {
  sections ??= [
    { kind: 'mine', profession: 'mining', title: t('travel.gather.mining', 'Mining'), types: miningTypes() },
    { kind: 'tree', profession: 'logging', title: t('travel.gather.logging', 'Logging'), types: loggingTypes() },
    { kind: 'herb', profession: 'herbalism', title: t('travel.gather.herbalism', 'Herbalism'), types: herbTypes() },
  ];
  return sections;
}

/**
 * The type key of a node, or null for a node that is never filtered. Pure.
 * @param {string} kindId the node's kind ('mine', 'tree', 'herb' ...) @param {any} n the node
 */
export function gatherTypeKey(kindId, n) {
  if (kindId === 'mine') return n?.what === 'boulder' ? 'mine:boulder' : n?.what === 'motherlode' ? 'mine:motherlode' : n?.material ? `mine:${n.material}` : null;
  if (kindId === 'tree') return n?.material ? `tree:${n.material}` : null;
  if (kindId === 'herb') return Number.isSafeInteger(n?.herb) ? `herb:${n.herb}` : null;
  return null;
}

const DEFAULT = Object.freeze({ mine: false, hidden: Object.freeze([]) });
/** @type {{ mine: boolean, hidden: readonly string[] } | null} */
let state = null;
const listeners = new Set();

function read() {
  const s = { mine: DEFAULT.mine, hidden: /** @type {string[]} */ ([]) };
  let raw = null;
  try { raw = appStorage()?.getItem(TV_GATHER_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (typeof v?.mine === 'boolean') s.mine = v.mine;
      if (Array.isArray(v?.hidden)) s.hidden = v.hidden.filter((k) => typeof k === 'string');
    } catch { /* a bad word: the defaults */ }
  }
  return s;
}

/** The gathering refinements now: { mine, hidden }. */
export function travelViewGather() {
  state ??= read();
  return state;
}

function set(next) {
  state = next;
  try { appStorage()?.setItem(TV_GATHER_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next;
}

/** Hear a change; returns the way to stop hearing it. */
export function onTravelViewGather(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Flip "workable by me". Returns its new state. */
export function toggleGatherMine() {
  return set({ ...travelViewGather(), mine: !travelViewGather().mine }).mine;
}

/** Is this type shown? A type not hidden is. */
export const gatherTypeShown = (key, s = travelViewGather()) => !s.hidden.includes(key);

/** Flip one type. Returns its new state (shown). */
export function toggleGatherType(key) {
  const s = travelViewGather();
  const hidden = s.hidden.includes(key) ? s.hidden.filter((k) => k !== key) : [...s.hidden, key];
  return gatherTypeShown(key, set({ ...s, hidden }));
}

/** Show or hide every type of one section at once (the panel's All / None). Returns the new state. */
export function setGatherSection(kind, shown) {
  const section = gatherSections().find((x) => x.kind === kind);
  if (!section) return travelViewGather();
  const mine = new Set(section.types.map((ty) => ty.key));
  const s = travelViewGather();
  const rest = s.hidden.filter((k) => !mine.has(k));
  return set({ ...s, hidden: shown ? rest : [...rest, ...mine] });
}

/**
 * Is a gathering node drawn into the Overworld's groups under these refinements? Pure.
 * @param {string} kindId @param {any} n the node @param {number} rank my rank in the node's profession
 */
export function gatherNodeShown(kindId, n, rank, s = travelViewGather()) {
  const key = gatherTypeKey(kindId, n);
  if (key === null) return true;
  if (s.hidden.includes(key)) return false;
  if (s.mine && Number.isSafeInteger(n?.tier) && !tierOpen(rank, n.tier)) return false;
  return true;
}

/** Pins: back to the device's word. */
export function _resetTravelViewGather() { state = null; listeners.clear(); sections = null; }
