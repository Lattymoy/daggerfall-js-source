// @ts-check
// GROWTH2 (2026-10-17, the owner: "properly give the specialization its own UI for ease of player use and proper
// descriptions instead of keeping players guessing"; bible/10-UI/Growth.md section 5) - THE SPECIALISATIONS GUIDE, the
// Growth tab's page (ui/growth/growthTab.js). Every path of both families - the arcane (systems/arcanePaths.js, a pair of
// the six schools) and the martial (systems/martialPaths.js, a pair of the six weapon skills) - with what opens it,
// measured on this character (each skill's value, mastered or not, its career group's slots), what it does (its passive,
// its signature spell or technique and the rider, every number the law's own words carry), how it is used, and its
// state: chosen, open (a Choose that asks first: permanent), closed (the family's other path is held), within reach, or
// out of this class's reach. It replaces the Master Skills page's two cards (SCHOOLS1's specCard, MARTIAL1's).
//
// The model is pure (specGuideModel - the laws' tables and this entity, nothing drawn); the page draws it with the menu's
// kit. The words are the laws' own (their passives, riders and choice boxes) and this page's in growth.spec.*.

import { PATHS, pathOf, pathChoices, pathPossible, pathSchoolsText, choosePath, pathChoiceRows } from '../../systems/arcanePaths.js';
import { MARTIAL_PATHS, MARTIAL_SKILLS, MARTIAL_FAMILY, martialPathOf, martialChoices, martialPossible, martialSkillsText, chooseMartialPath, martialChoiceRows, signatureById } from '../../systems/martialPaths.js';
import { MAGIC_SKILLS, SKILL_NAMES } from '../../systems/skills.js';
import { masterSkillsActive, masterSkillsSwitchable, isMasteredSkill, careerGroupOf, masterySlots } from '../../systems/masterSkills.js';
import { signatureSpell } from '../../systems/signatureSpells.js';
import { effectWords, spellFrame } from '../enhanced/enhancedSpellbook.js';   // the spellbook's own reading of an effect (SB-FX)
import { t } from '../../systems/textManager.js';

/** The two families, in the page's order. */
export const SPEC_FAMILIES = Object.freeze(['arcane', 'martial']);
/** A path's states, in the list's order - what the row's tag says. */
export const SPEC_STATES = Object.freeze(['chosen', 'open', 'ready', 'reach', 'closed', 'never']);

/** The skill a family's path needs, and where this character stands with it. Pure.
 *  `state`: 'mastered' | 'ready' (at 100, a slot left - Master Skills masters it) | 'climb' (under 100, a slot left) |
 *  'full' (its career group's masteries all chosen) | 'misc' (no career group: never mastered). */
export function skillStand(entity, id) {
  const value = Math.max(0, Math.round(entity?.skills?.[id] ?? 0));
  const group = careerGroupOf(entity, id);
  const mastered = isMasteredSkill(entity, id);
  const state = mastered ? 'mastered' : !group ? 'misc' : masterySlots(entity, group).left <= 0 ? 'full' : value >= 100 ? 'ready' : 'climb';
  return { id, name: SKILL_NAMES[id], value, group, mastered, state };
}

/** The skill's state in words, as the guide's checklist says it. */
export function skillStandText(s) {
  switch (s.state) {
    case 'mastered': return t('growth.spec.skill.mastered', '{skill}: mastered ({value})', { skill: s.name, value: s.value });
    case 'ready': return t('growth.spec.skill.ready', '{skill}: {value} - ready to master in Master Skills', { skill: s.name, value: s.value });
    case 'climb': return t('growth.spec.skill.climb', '{skill}: {value} of 100, then master it', { skill: s.name, value: s.value });
    case 'full': return t('growth.spec.skill.full', '{skill}: your {group} masteries are all chosen', { skill: s.name, group: groupWord(s.group) });
    default: return t('growth.spec.skill.misc', '{skill}: not one of your class\'s skills, so it cannot be mastered', { skill: s.name });
  }
}
const groupWord = (g) => (g === 'primary' ? t('growth.spec.group.primary', 'primary') : g === 'major' ? t('growth.spec.group.major', 'major') : t('growth.spec.group.minor', 'minor'));

/** A signature spell in the spellbook's words: what it is cast at, its element, and each effect's line. Pure. */
export function spellLines(pathId) {
  const sp = signatureSpell(pathId);
  if (!sp) return [];
  const fr = spellFrame(sp);
  const out = [];
  const head = [fr.target, fr.element].filter(Boolean).join(' - ');
  if (head) out.push(head);
  for (const e of sp.effects ?? []) {
    if (!e || e.type < 0) continue;   // an empty slot of the maker's three
    const w = effectWords(e);
    if (!w) continue;
    const name = [w.group, w.subgroup].filter(Boolean).join(' ');
    out.push(w.parts.length ? `${name}. ${w.parts.join('. ')}.` : `${name}.`);
  }
  return out;
}

/** A martial signature's forms: which of the path's weapons wield it, its cooldown and its fatigue. Pure. */
export function techniqueLines(path) {
  const out = [];
  for (const [family, formId] of Object.entries(path.forms ?? {})) {
    const f = signatureById(formId);
    if (!f) continue;
    const skill = Number(Object.keys(MARTIAL_FAMILY).find((k) => MARTIAL_FAMILY[k] === family));
    out.push(t('growth.spec.form', 'With {weapon}: ready again after {seconds} seconds, costs {fatigue} fatigue.', { weapon: SKILL_NAMES[skill], seconds: f.cooldown, fatigue: f.fatigue }));
  }
  return out;
}

/** One family's law, uniformly: its skills, its paths and its doors. */
const FAMILY_LAW = Object.freeze({
  arcane: {
    skills: MAGIC_SKILLS, paths: () => PATHS, held: pathOf, choices: pathChoices, possible: pathPossible,
    pair: (p) => p.schools, pairText: pathSchoolsText, ask: (e, id) => pathChoiceRows(e, id), choose: choosePath,
    signature: (p) => ({ kind: 'spell', name: p.spell.name, text: p.rider, lines: spellLines(p.id) }),
  },
  martial: {
    skills: MARTIAL_SKILLS, paths: () => MARTIAL_PATHS, held: martialPathOf, choices: martialChoices, possible: martialPossible,
    pair: (p) => p.skills, pairText: martialSkillsText, ask: (e, id) => martialChoiceRows(e, id), choose: chooseMartialPath,
    signature: (p) => ({ kind: 'technique', name: p.technique.name, text: `${p.technique.text} ${p.rider}`, lines: techniqueLines(p) }),
  },
});

/** How far a path's pair still has to climb - the points under 100 of its skills not yet mastered (the nearest first). */
const owed = (p) => p.pair.reduce((n, s) => n + (s.mastered ? 0 : Math.max(0, 100 - s.value)), 0);

/** A path's state for this character, and why. Pure. */
function pathState(entity, law, p, held, open, on) {
  if (held?.id === p.id) return 'chosen';
  if (held) return 'closed';
  if (open.some((o) => o.id === p.id)) return 'open';
  const st = law.pair(p).map((id) => skillStand(entity, id).state);
  if (st.some((s) => s === 'misc' || s === 'full')) return 'never';
  return on && st.every((s) => s === 'mastered' || s === 'ready') ? 'ready' : 'reach';
}

/**
 * THE GUIDE'S MODEL for `entity` - both families, every path. Pure: reads the laws and the entity, writes nothing.
 * `{ masterOn, switchable, families: [{ id, held, possible, skills, open, paths: [{ id, name, pairText, pair, state,
 *  passive, signature, choose, ask }] }] }` - a family's paths in SPEC_STATES order, the nearest first within a state
 *  (the points its pair still owes 100), then the laws' order.
 */
export function specGuideModel(entity) {
  const on = masterSkillsActive(entity);
  const families = SPEC_FAMILIES.map((id) => {
    const law = FAMILY_LAW[id];
    const held = law.held(entity);
    const open = law.choices(entity);
    const paths = law.paths().map((p, order) => ({
      id: p.id, order, name: p.name, pairText: law.pairText(p),
      pair: law.pair(p).map((s) => skillStand(entity, s)),
      state: pathState(entity, law, p, held, open, on),
      passive: p.passive,
      signature: law.signature(p),
    })).sort((a, b) => SPEC_STATES.indexOf(a.state) - SPEC_STATES.indexOf(b.state) || owed(a) - owed(b) || a.order - b.order);
    return {
      id, held: held ? { id: held.id, name: held.name } : null, possible: law.possible(entity),
      skills: law.skills.map((s) => skillStand(entity, s)), open: open.length,
      paths: paths.map((p) => ({ ...p, ask: () => law.ask(entity, p.id), choose: () => law.choose(entity, p.id) })),
    };
  });
  return { masterOn: on, switchable: masterSkillsSwitchable(entity), families };
}

/** A state's tag on the row. */
export function stateTag(state) {
  return ({
    chosen: t('growth.spec.state.chosen', 'Chosen'),
    open: t('growth.spec.state.open', 'Open to you'),
    ready: t('growth.spec.state.ready', 'Master its skills'),
    reach: t('growth.spec.state.reach', 'Within reach'),
    closed: t('growth.spec.state.closed', 'Closed'),
    never: t('growth.spec.state.never', 'Not for your class'),
  })[state] ?? '';
}

/** What a path's state means, under its name in the detail. */
function stateLine(fam, p) {
  switch (p.state) {
    case 'chosen': return t('growth.spec.why.chosen', 'Your specialisation. It acts while both its skills stay mastered.');
    case 'open': return t('growth.spec.why.open', 'Both its skills are mastered: you can choose it now. The choice is permanent.');
    case 'ready': return t('growth.spec.why.ready', 'Both its skills have reached 100. Master them on the Master Skills page and this path opens.');
    case 'reach': return t('growth.spec.why.reach', 'Raise both its skills to 100 and master them, and this path opens.');
    case 'closed': return t('growth.spec.why.closed', 'You chose {name}. A character holds one path of each family, for good.', { name: fam.held?.name ?? '' });
    default: return t('growth.spec.why.never', 'Your class cannot master both of its skills, so this path is not open to you.');
  }
}

// ── the page ────────────────────────────────────────────────────────

/** The page's choices this visit: the family shown, the path open beneath its row, every path or the reachable. */
let _fam = /** @type {string|null} */ (null);
let _open = /** @type {string|null} */ (null);
let _all = false;
let _note = /** @type {string|null} */ (null);
/** A new visit: the page starts on `fam` (a door's - the classic sheet's S or W row), else the family this character
 *  can reach; nothing open. */
export function resetSpecGuide(fam = null) { _fam = fam === 'arcane' || fam === 'martial' ? fam : null; _open = null; _all = false; _note = null; }

/**
 * THE PAGE into `detail` (the Growth rail's detail pane). `kit` the menu's makers: `{ el, divider, skillMeter, askCard,
 * entity, openMaster }` - `skillMeter(value, mastered)` the Stats page's skill bar (its gold climb past 100 a mastery's),
 * `askCard(rows, onYes)` its Yes/No card, `openMaster()` (optional) the Master Skills page.
 */
export function drawSpecGuide(detail, rerender, { el, divider, skillMeter = null, askCard, entity, openMaster = null }) {
  const m = specGuideModel(entity);
  detail.append(divider(t('growth.spec.title', 'Specialisations')));
  detail.append(el('p', 'gr-lead', t('growth.spec.lead', 'Master two skills of a family and a specialisation opens: a path named for the pair, with a passive power and a signature spell or technique. There are fifteen arcane paths, one for each pair of the six schools of magic, and fifteen martial paths, one for each pair of the six weapon skills. You may hold one of each. A choice is permanent.')));
  if (!m.masterOn) {
    const off = el('div', 'gr-warn');
    off.append(el('span', null, m.switchable ? t('growth.spec.masterOff', 'Master Skills is off, so no skill can be mastered and no path opens. Turn it on in Master Skills.') : t('growth.spec.masterOffLocked', 'Master Skills is off.')));
    detail.append(off);
  }
  if (_note) detail.append(el('div', 'px-master-note', _note));
  if (!_fam) _fam = m.families.find((f) => f.held || f.open)?.id ?? m.families.find((f) => f.possible)?.id ?? 'arcane';
  // the families' switch - each with its count of open paths
  const sw = el('div', 'gr-switch');
  sw.setAttribute('role', 'tablist');
  for (const f of m.families) {
    const b = el('button', `gr-fam${f.id === _fam ? ' on' : ''}`);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', f.id === _fam ? 'true' : 'false');
    b.append(document.createTextNode(f.id === 'arcane' ? t('growth.spec.arcane', 'Arcane') : t('growth.spec.martial', 'Martial')));
    if (f.open) b.append(el('span', 'gr-count', String(f.open)));
    b.onclick = () => { _fam = f.id; _open = null; rerender(); };
    sw.append(b);
  }
  detail.append(sw);
  const fam = m.families.find((f) => f.id === _fam) ?? m.families[0];
  // the family's standing: the path held, or how many are open, or how one opens - and its six skills
  const head = el('section', 'px-mgroup gr-head');
  head.append(el('div', 'gr-headline', fam.held ? t('growth.spec.heldLine', 'Your {family} specialisation: {name}.', { family: famWord(fam.id), name: fam.held.name })
    : fam.open ? t('growth.spec.openLine', '{n, plural, one {# path is open to you. Choose it below.} other {# paths are open to you. Choose one below.}}', { n: fam.open })
      : !fam.possible ? (fam.id === 'arcane' ? t('growth.spec.arcaneNever', 'Your class cannot master two schools of magic, so no arcane path can open for you.') : t('growth.spec.martialNever', 'Your class cannot master two weapon skills, so no martial path can open for you.'))
        : fam.id === 'arcane' ? t('growth.spec.arcaneHow', 'Master two schools of magic to open the path their pair names.') : t('growth.spec.martialHow', 'Master two weapon skills to open the path their pair names.')));
  const grid = el('div', 'gr-skills');
  for (const s of fam.skills) {
    const cell = el('div', 'gr-skill');
    cell.classList.add(`is-${s.state}`);
    const top = el('div', 'gr-skilltop');
    top.append(el('span', 'k', `${s.mastered ? '◆ ' : ''}${s.name}`), el('span', 'v', String(s.value)));
    cell.append(top);
    if (typeof skillMeter === 'function') cell.append(skillMeter(s.value, s.mastered));
    cell.append(el('span', 'gr-skillstate', skillWord(s)));
    grid.append(cell);
  }
  head.append(grid);
  if (typeof openMaster === 'function') {
    const acts = el('div', 'gr-acts');
    const b = el('button', 'act', t('growth.spec.toMaster', 'Master Skills'));
    b.onclick = () => openMaster();
    acts.append(b);
    head.append(acts);
  }
  detail.append(head);
  // the paths - each a row; the open one shows what it does beneath it
  const reachable = fam.paths.filter((p) => p.state !== 'never');
  const shown = _all ? fam.paths : reachable;
  const list = el('div', 'gr-paths');
  for (const p of shown) {
    const open = _open === p.id;
    const row = el('section', 'px-mgroup gr-path');
    row.classList.add(`is-${p.state}`);
    if (open) row.classList.add('is-open');
    const bar = el('button', 'gr-pathbar');
    bar.setAttribute('aria-expanded', open ? 'true' : 'false');
    const tag = el('span', 'px-mtag gr-tag', stateTag(p.state));
    tag.classList.add(`is-${p.state}`);
    if (p.state === 'chosen') tag.classList.add('gold');
    bar.append(el('span', 'gr-pathname', `${p.state === 'chosen' ? '◆ ' : ''}${p.name}`), el('span', 'gr-pathpair', p.pairText), tag);
    bar.onclick = () => { _open = open ? null : p.id; rerender(); };
    row.append(bar);
    if (open) row.append(pathDetail(el, fam, p, rerender, askCard));
    list.append(row);
  }
  detail.append(list);
  if (reachable.length < fam.paths.length) {
    const more = el('button', 'act gr-more', _all ? t('growth.spec.showReach', 'Show only the paths your class can reach') : t('growth.spec.showAll', 'Show all fifteen paths'));
    more.onclick = () => { _all = !_all; rerender(); };
    detail.append(more);
  }
}

const famWord = (id) => (id === 'arcane' ? t('growth.spec.arcaneWord', 'arcane') : t('growth.spec.martialWord', 'martial'));
/** A skill's state, short, under its meter. */
function skillWord(s) {
  return ({
    mastered: t('growth.spec.cell.mastered', 'Mastered'),
    ready: t('growth.spec.cell.ready', 'Ready to master'),
    climb: t('growth.spec.cell.climb', '{n} to 100', { n: 100 - s.value }),
    full: t('growth.spec.cell.full', 'No {group} mastery left', { group: groupWord(s.group) }),
    misc: t('growth.spec.cell.misc', 'Cannot be mastered'),
  })[s.state] ?? '';
}

/** A path's detail: its state, what opens it, its passive, its signature, how it is used - and its Choose. */
function pathDetail(el, fam, p, rerender, askCard) {
  const box = el('div', 'gr-detail');
  const why = el('p', 'gr-why', stateLine(fam, p));
  why.classList.add(`is-${p.state}`);
  box.append(why);
  if (p.state !== 'chosen' && p.state !== 'closed') {
    box.append(el('div', 'gr-sub', t('growth.spec.opens', 'What opens it')));
    const ul = el('ul', 'gr-steps');
    for (const s of p.pair) ul.append(el('li', `is-${s.state}`, skillStandText(s)));
    box.append(ul);
  }
  box.append(el('div', 'gr-sub', t('growth.spec.passive', 'Passive: {name}', { name: p.passive.name })));
  box.append(el('p', 'gr-text', p.passive.text));
  const sig = p.signature;
  box.append(el('div', 'gr-sub', sig.kind === 'spell' ? t('growth.spec.spell', 'Signature spell: {name}', { name: sig.name }) : t('growth.spec.technique', 'Signature technique: {name}', { name: sig.name })));
  box.append(el('p', 'gr-text', sig.text));
  for (const line of sig.lines) box.append(el('p', 'gr-fine', line));
  box.append(el('p', 'gr-fine gr-use', sig.kind === 'spell'
    ? t('growth.spec.useSpell', 'Once chosen, buy it at the Mages Guild and cast it like any other spell.')
    : t('growth.spec.useTechnique', 'Once chosen, press your Weapon Technique key with one of its two weapons in hand. A weapon with a technique of its own keeps it; the signature answers when the weapon has none.')));
  if (p.state === 'open') {
    const acts = el('div', 'gr-acts');
    const b = el('button', 'act primary', t('growth.spec.choose', 'Choose {name}', { name: p.name }));
    b.onclick = () => askCard(p.ask(), () => { _note = p.choose().text; _open = p.id; rerender(); });
    acts.append(b);
    box.append(acts);
  }
  return box;
}

/** The page's own dress, on the System page's (`.px-sys`) as the Holdings pages wear theirs. */
export const SPEC_GUIDE_CSS = `
.px-sys .gr-lead { font-size: 14px; line-height: 1.45; color: #cfc7b1; margin: 4px 0 10px; }
.px-sys .gr-warn { font-size: 14px; color: #e0a54a; margin: 0 0 10px; }
.px-sys .gr-switch { display: flex; gap: 6px; margin: 0 0 10px; flex-wrap: wrap; }
.px-sys .gr-fam { font: inherit; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; min-height: 36px;
  color: #cfc7b1; background: rgba(15,17,22,0.55); border: 2px solid rgba(125,116,96,0.55); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.px-sys .gr-fam.on { color: #f3cf86; border-color: #c9a45a; background: rgba(60,48,26,0.55); }
.px-sys .gr-count { font-size: 12px; min-width: 18px; padding: 0 5px; line-height: 18px; text-align: center; color: #10120f; background: #8fc7a0; }
.px-sys .gr-head { padding: 10px 12px; }
.px-sys .gr-headline { font-size: 15px; line-height: 1.4; color: #e9e4d9; margin-bottom: 8px; }
.px-sys .gr-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 12px; }
.px-sys .gr-skill { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.px-sys .gr-skilltop { display: flex; justify-content: space-between; gap: 6px; font-size: 14px; }
.px-sys .gr-skilltop .k { color: #e9e4d9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.px-sys .gr-skilltop .v { color: #ddd5bd; font-variant-numeric: tabular-nums; }
.px-sys .gr-skillstate { font-size: 12px; color: #9c937d; }
.px-sys .gr-skill.is-mastered .gr-skillstate { color: #f3cf86; }
.px-sys .gr-skill.is-ready .gr-skillstate { color: #8fc7a0; }
.px-sys .gr-skill.is-full .gr-skillstate, .px-sys .gr-skill.is-misc .gr-skillstate { color: #8b8578; }
.px-sys .gr-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.px-sys .gr-paths { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.px-sys .gr-path { padding: 0; }
.px-sys .gr-pathbar { font: inherit; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto; align-items: center; gap: 10px;
  padding: 8px 12px; text-align: left; color: inherit; background: none; border: none; cursor: pointer; }
.px-sys .gr-pathname { font-size: 16px; color: #f3cf86; overflow-wrap: anywhere; }
.px-sys .gr-pathpair { font-size: 13px; color: #bdb4a0; overflow-wrap: anywhere; }
.px-sys .gr-path.is-never .gr-pathname, .px-sys .gr-path.is-closed .gr-pathname { color: #9c937d; }
.px-sys .gr-tag.is-open { color: #8fc7a0; }
.px-sys .gr-tag.is-ready { color: #e0c36a; }
.px-sys .gr-tag.is-never, .px-sys .gr-tag.is-closed { color: #8b8578; }
.px-sys .gr-detail { padding: 4px 14px 12px; border-top: 1px solid rgba(125,116,96,0.35); }
.px-sys .gr-why { font-size: 14px; line-height: 1.4; color: #e9e4d9; margin: 8px 0; }
.px-sys .gr-why.is-open { color: #8fc7a0; }
.px-sys .gr-sub { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #c9a45a; margin: 10px 0 3px; }
.px-sys .gr-text { font-size: 14px; line-height: 1.45; color: #ddd5bd; margin: 0 0 4px; }
.px-sys .gr-fine { font-size: 13px; line-height: 1.4; color: #a9a08b; margin: 0 0 3px; }
.px-sys .gr-use { margin-top: 8px; color: #bdb4a0; }
.px-sys .gr-steps { margin: 0 0 4px; padding-left: 18px; font-size: 14px; line-height: 1.45; color: #ddd5bd; }
.px-sys .gr-steps li.is-mastered { color: #f3cf86; }
.px-sys .gr-steps li.is-ready { color: #8fc7a0; }
.px-sys .gr-steps li.is-full, .px-sys .gr-steps li.is-misc { color: #9c937d; }
.px-sys .gr-more { margin: 4px 0 8px; }
@media (max-width: 660px) {
  .px-sys .gr-pathbar { grid-template-columns: minmax(0, 1fr) auto; }
  .px-sys .gr-pathpair { grid-column: 1 / -1; grid-row: 2; }
  .px-sys .gr-skills { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
