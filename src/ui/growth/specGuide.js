// @ts-check
// GROWTH2 (2026-10-17, the owner: "properly give the specialization its own UI for ease of player use and proper
// descriptions instead of keeping players guessing"; bible/10-UI/Growth.md section 5) - THE SPECIALISATIONS GUIDE, the
// Growth tab's page (ui/growth/growthTab.js). Every path of both families - the arcane (systems/arcanePaths.js, a pair of
// the six schools) and the martial (systems/martialPaths.js, a pair of the six weapon skills) - with what opens it,
// measured on this character (each skill's value, mastered or not, its career group's slots), what it does (its passive,
// its signature spell or technique and the rider, every number the law's own words carry), how it is used, and its
// state: chosen, open (a Choose that asks first), closed (the family's other path is held), within reach, or out of this
// class's reach. It replaces the Master Skills page's two cards (SCHOOLS1's specCard, MARTIAL1's). SPEC-RESET (section
// 10): the chosen path's detail carries its Reset - the path given up for SPEC_RESET_GOLD (systems/specReset.js), asked
// first, refused where no other path of the family could ever open.
//
// The model is pure (specGuideModel - the laws' tables and this entity, nothing drawn); the page draws it with the menu's
// kit. The words are the laws' own (their passives, riders and choice boxes) and this page's in growth.spec.*.

import { PATHS, pathOf, pathChoices, pathPossible, pathSchoolsText, choosePath, pathChoiceRows, isSignatureSpell, SPEC_RESET_GOLD } from '../../systems/arcanePaths.js';
import { MARTIAL_PATHS, MARTIAL_SKILLS, MARTIAL_FAMILY, martialPathOf, martialChoices, martialPossible, martialSkillsText, chooseMartialPath, martialChoiceRows, signatureById } from '../../systems/martialPaths.js';
import { MAGIC_SKILLS, SKILL_NAMES } from '../../systems/skills.js';
import { masterSkillsActive, masterSkillsSwitchable, isMasteredSkill, careerGroupOf, masterySlots, masterableCount, masterCappedSkill } from '../../systems/masterSkills.js';
import { signatureSpell } from '../../systems/signatureSpells.js';
import { specResetRefusal, resetSpec, resetField } from '../../systems/specReset.js';   // SPEC-RESET: a held path given up, for gold
import { SKILL_SWAP_GOLD, swapOutChoices, swapInChoices, skillSwapRefusal, swapGroupOf, swapSkill, swappedCareer, swapOpens, swapShortfall } from '../../systems/skillSwap.js';   // SKILL-SWAP: a class skill given up for another, for gold
import { alreadyMasteredASkill } from '../../systems/advancement.js';   // AUDIT SUGGESTIONS-1019 L5-2: the 95 lock a swap moves
import { usesVirtueLeveling } from '../../systems/oblivionLeveling.js';   // SWAP-CYCLE: the skill sum levels nothing on Oblivion's bar
import { computeEntityMods } from '../../systems/entityMods.js';   // AUDIT SPEC-RESET L1-3: a chosen path's stats now
import { sigilDueling } from '../../systems/sigil/sigil.js';
import { lootRarityOn } from '../../systems/loot/lootRarity.js';
import { effectWords, spellFrame } from '../enhanced/enhancedSpellbook.js';   // the spellbook's own reading of an effect (SB-FX)
import { t } from '../../systems/textManager.js';

/** The two families, in the page's order. */
export const SPEC_FAMILIES = Object.freeze(['arcane', 'martial']);
/** A path's states, in the list's order - what the row's tag says. 'slots' the mastery slots left can't hold the pair
 *  (AUDIT GROWTH LANE1-4: the player's own masteries, not the class); 'never' a skill the class can't master. */
export const SPEC_STATES = Object.freeze(['chosen', 'open', 'ready', 'reach', 'closed', 'slots', 'never']);

/** The skill a family's path needs, and where this character stands with it. Pure.
 *  `state`: 'mastered' | 'ready' (at 100, a slot left - Master Skills masters it) | 'climb' (under 100, a slot left) |
 *  'full' (its career group's masteries all chosen) | 'misc' (no career group: never mastered). `value` the one the game
 *  reads (AUDIT GROWTH LANE1-2: past 100 reads 100 while Master Skills is off - masterCappedSkill). */
export function skillStand(entity, id) {
  const value = Math.max(0, Math.round(masterCappedSkill(entity, entity?.skills?.[id] ?? 0, id)));
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
    case 'full': return t('growth.spec.skill.full', '{skill}: no {group} mastery slots left', { skill: s.name, group: groupWord(s.group) });
    default: return t('growth.spec.skill.misc', '{skill}: not one of your class skills, so it can\'t be mastered', { skill: s.name });
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

/** A weapon in the technique texts' own words ("Bow:", "Bare hands:" - AUDIT GROWTH LANE5-12: the form lines said "With
 *  Archery:" right under them). */
const weaponWord = (family, skill) => (({
  longBlade: () => t('growth.spec.weapon.longBlade', 'Long blade'), shortBlade: () => t('growth.spec.weapon.shortBlade', 'Short blade'),
  axe: () => t('growth.spec.weapon.axe', 'Axe'), blunt: () => t('growth.spec.weapon.blunt', 'Blunt weapon'),
  archery: () => t('growth.spec.weapon.archery', 'Bow'), handToHand: () => t('growth.spec.weapon.handToHand', 'Bare hands'),
})[family]?.() ?? SKILL_NAMES[skill]);

/** A martial signature's forms: which of the path's weapons wield it, its cooldown and its fatigue. Pure. */
export function techniqueLines(path) {
  const out = [];
  for (const [family, formId] of Object.entries(path.forms ?? {})) {
    const f = signatureById(formId);
    if (!f) continue;
    const skill = Number(Object.keys(MARTIAL_FAMILY).find((k) => MARTIAL_FAMILY[k] === family));
    out.push(t('growth.spec.form', '{weapon}: {seconds}-second cooldown, {fatigue} fatigue.', { weapon: weaponWord(family, skill), seconds: f.cooldown, fatigue: f.fatigue }));
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

/** Choose through the law, and fold the entity's mods now - a passive's stats from this moment, not the next round
 *  (AUDIT SPEC-RESET L1-3; the reset folds its own, specReset.js). */
function chooseNow(entity, law, id) {
  const r = law.choose(entity, id);
  if (r.ok) computeEntityMods(entity);
  return r;
}

/** A path's state for this character, and why. Pure. */
function pathState(entity, law, p, held, open, on) {
  if (held?.id === p.id) return 'chosen';
  // AUDIT SPEC-RESET L3-1: closed only where a reset could open it - a pair the class can never master, or whose slots are
  // spent, says so whatever is held (the masteries are permanent; a reset frees no slot)
  if (held) { const free = pathState(entity, law, p, null, [], on); return free === 'never' || free === 'slots' ? free : 'closed'; }
  if (open.some((o) => o.id === p.id)) return 'open';
  const st = law.pair(p).map((id) => skillStand(entity, id).state);
  if (st.includes('misc')) return 'never';
  // AUDIT GROWTH LANE1-1: the pair's slots counted together, as pathPossible counts the family's (AUDIT MARTIAL L4 L3's
  // masterableCount) - two minor schools, or two majors with one major slot left, can never both be mastered
  if (st.includes('full') || masterableCount(entity, law.pair(p)) < 2) return 'slots';
  return on && st.every((s) => s === 'mastered' || s === 'ready') ? 'ready' : 'reach';
}

/** Why a held path does nothing right now, or null (AUDIT GROWTH LANE1-3 - pathAwake, martialAwake and the powers' own
 *  gates: Master Skills off, mentoring, a refereed duel, and the beast for a martial path). */
function pathAsleep(entity, id, on) {
  if (!on) return 'off';
  if (entity?._mentor) return 'mentor';
  if (sigilDueling()) return 'duel';
  if (id === 'martial' && entity?.isInBeastForm) return 'beast';
  return null;
}

/** SPEC-RESET: what giving up the held path would leave, read by the list's own states on the entity with nothing held
 *  (a view over it, never a write): the paths then open to choose at once (`open`, the held one among them - its pair is
 *  still mastered), whether more are within reach (`later`), and whether any OTHER path of the family is open or within
 *  reach (`others`). Pure. */
function afterReset(entity, id, law, held, on) {
  const bare = Object.create(entity);
  bare[resetField(id)] = null;
  const open = law.choices(bare);
  const states = law.paths().map((p) => [p, pathState(bare, law, p, null, open, on)]);
  const reach = (st) => st === 'ready' || st === 'reach';
  return {
    open: open.map((p) => p.name),
    later: states.some(([, st]) => reach(st)),
    others: states.some(([p, st]) => p.id !== held.id && (st === 'open' || reach(st))),
  };
}

/** SPEC-RESET: a held path's Reset - its refusal (the law's, else no other path could ever open, so a reset would buy
 *  back the same one), the ask's rows, and the reset itself. The ask says a signature spell stays in the book only where
 *  one was bought (AUDIT SPEC-RESET L1-5: choosing grants none - it is sold to the path's holder). */
function resetModel(entity, id, law, held, on) {
  const after = afterReset(entity, id, law, held, on);
  // AUDIT SPEC-RESET L3-1: the reset that can never help says so first - short of the gold too, or the player saves
  // 200,000 for it
  const refusal = (after.others ? null
    : t('growth.spec.reset.only', 'No other {family} path can open for you, so a reset would only let you choose {name} again.', { family: famWord(id), name: held.name }))
    ?? specResetRefusal(entity, id);
  const rows = () => [
    t('growth.spec.reset.ask', 'Reset {name} for {gold, number} gold?', { name: held.name, gold: SPEC_RESET_GOLD }),
    '',
    id !== 'arcane' ? t('growth.spec.reset.loseTechnique', 'You lose its passive and its signature technique.')
      : (entity?.spells ?? []).some((sp) => isSignatureSpell(sp) && sp.path === held.id) ? t('growth.spec.reset.loseSpell', 'You lose its passive. Its signature spell stays in your spellbook as an ordinary spell.')
        : t('growth.spec.reset.loseUnbought', 'You lose its passive, and its signature spell is no longer sold to you.'),
    t('growth.spec.reset.keep', 'Your mastered skills stay mastered.'),
    '',
    ...(!on ? [t('growth.spec.reset.off', 'Master Skills is off. Turn it on to choose a specialization again.')]
      : [t('growth.spec.reset.then', 'Open to you after the reset: {names}.', { names: after.open.join(', ') }),
        ...(after.later ? [t('growth.spec.reset.later', 'More paths unlock as you master more skills.')] : [])]),
  ];
  return { refusal, rows, go: () => resetSpec(entity, id) };
}

/**
 * THE GUIDE'S MODEL for `entity` - both families, every path. Pure: reads the laws and the entity, writes nothing.
 * `{ masterOn, switchable, families: [{ id, held, asleep, possible, classPossible, skills, open, swapOpens, paths: [{ id, name,
 *  pairText, pair, state, passive, signature, choose, ask }], reset }] }` - a family's paths in SPEC_STATES order, the
 *  nearest first within a state (the points its pair still owes 100), then the laws' order. `asleep` why the held path
 *  does nothing now (pathAsleep); `classPossible` the family's law on this class with no mastery spent yet; `reset` the
 *  held path's Reset (resetModel), null with none held; `swapOpens` whether one class skill swap would open a path.
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
      id, held: held ? { id: held.id, name: held.name } : null, asleep: held ? pathAsleep(entity, id, on) : null,
      possible: law.possible(entity), classPossible: law.possible({ career: entity?.career }),
      skills: law.skills.map((s) => skillStand(entity, s)), open: open.length,
      paths: paths.map((p) => ({ ...p, ask: () => law.ask(entity, p.id), choose: () => chooseNow(entity, law, p.id) })),
      reset: held ? resetModel(entity, id, law, held, on) : null,
      swapOpens: false,
    };
  });
  // SKILL-SWAP (systems/skillSwap.js): the class skill given up for one outside it - the choices, and the law's words
  const swap = entity?.career ? {
    out: swapOutChoices(entity), in: swapInChoices(entity),
    refusal: (out, inn) => skillSwapRefusal(entity, out, inn), group: (out) => swapGroupOf(entity, out), go: (out, inn) => swapSkill(entity, out, inn),
    // AUDIT SUGGESTIONS-1019 L5-1: the group's mastery slots left - none, and what comes in can never be mastered
    slotsLeft: (out) => masterySlots(entity, swapGroupOf(entity, out)).left,
    // AUDIT SUGGESTIONS-1019 L5-2: offline with Master Skills off, whether the swap starts ('on') or ends ('off') DFU's 95 lock
    lockTurn: (out, inn) => {
      if (masterSkillsActive(entity)) return null;
      const before = alreadyMasteredASkill(entity), after = alreadyMasteredASkill({ ...entity, career: swappedCareer(entity, out, inn) });
      return before === after ? null : after ? 'on' : 'off';
    },
    // SWAP-CYCLE: the points the class's skills make up before the next level comes closer - none on Oblivion's bar
    shortfall: (out, inn) => (usesVirtueLeveling(entity) ? 0 : swapShortfall(entity, out, inn)),
  } : null;
  // AUDIT SUGGESTIONS-1019 L5-1: a family's hint only where ONE swap would open a path, the masteries and slots as they stand
  for (const f of families) {
    const law = FAMILY_LAW[f.id];
    f.swapOpens = !!swap && !f.possible && swap.out.some((out) => law.skills.some((inn) => swap.in.includes(inn) && swapOpens(entity, out, inn, law.possible)));
  }
  return { masterOn: on, switchable: masterSkillsSwitchable(entity), families, swap };
}

/** A state's tag on the row. */
export function stateTag(state) {
  return ({
    chosen: t('growth.spec.state.chosen', 'Chosen'),
    open: t('growth.spec.state.open', 'Available'),
    ready: t('growth.spec.state.ready', 'Needs mastering'),
    reach: t('growth.spec.state.reach', 'Not yet'),
    closed: t('growth.spec.state.closed', 'Closed'),
    slots: t('growth.spec.state.slots', 'No slots left'),
    never: t('growth.spec.state.never', 'Not for your class'),
  })[state] ?? '';
}

/** What a path's state means, under its name in the detail - naming the skill when only one still needs it (AUDIT
 *  GROWTH LANE1-12), and Master Skills when it is off and nothing is left to climb (LANE1-2). */
export function stateLine(fam, p, on) {
  const need = p.pair.filter((s) => !s.mastered);
  const climb = need.filter((s) => s.state === 'climb');
  switch (p.state) {
    case 'chosen': return chosenLine(fam.asleep);
    case 'open': return t('growth.spec.why.open', 'Both skills are mastered. You can choose it now.');
    case 'ready': return need.length === 1 ? t('growth.spec.why.readyOne', 'Master {skill} on the Master Skills page to unlock this path.', { skill: need[0].name })
      : t('growth.spec.why.ready', 'Both skills are at 100. Master them on the Master Skills page to unlock this path.');
    case 'reach':
      if (!on && !climb.length) return t('growth.spec.why.off', 'Turn Master Skills on to unlock this path.');
      if (climb.length < need.length) return t('growth.spec.why.reachThen', 'Raise {skill} to 100, then master both skills to unlock this path.', { skill: climb[0].name });
      return need.length === 1 ? t('growth.spec.why.reachOne', 'Raise {skill} to 100 and master it to unlock this path.', { skill: need[0].name })
        : t('growth.spec.why.reach', 'Raise both skills to 100 and master them to unlock this path.');
    case 'closed': return t('growth.spec.why.closed', 'You already chose {name}. You can have only one path of each kind; reset {name} to choose another.', { name: fam.held?.name ?? '' });
    case 'slots': return t('growth.spec.why.slots', 'You don\'t have enough mastery slots left to master both of these skills.');
    default: return t('growth.spec.why.never', 'Your class can\'t master both of these skills.');
  }
}
/** The chosen path's line: it works, or why it does nothing right now (pathAsleep). */
function chosenLine(asleep) {
  switch (asleep) {
    case 'off': return t('growth.spec.why.chosenOff', 'Your specialization. Its powers are off while Master Skills is off.');
    case 'mentor': return t('growth.spec.why.chosenMentor', 'Your specialization. Its powers are off while you mentor a lower-level party.');
    case 'duel': return t('growth.spec.why.chosenDuel', 'Your specialization. Its powers are off during a duel.');
    case 'beast': return t('growth.spec.why.chosenBeast', 'Your specialization. Its powers are off in beast form.');
    default: return t('growth.spec.why.chosen', 'Your specialization.');
  }
}

// ── the page ────────────────────────────────────────────────────────

/** The page's choices this visit: the family shown, the path open beneath its row, every path or the reachable. */
let _fam = /** @type {string|null} */ (null);
let _open = /** @type {string|null} */ (null);
let _all = false;
let _note = /** @type {string|null} */ (null);
/** The note was just written - the next draw brings it into view (AUDIT SPEC-RESET L3-2). */
let _noteFresh = false;
/** SKILL-SWAP: the two picks of the swap's form, kept across a redraw. */
let _swapOut = /** @type {number|null} */ (null);
let _swapIn = /** @type {number|null} */ (null);
/** A new visit: the page starts on `fam` (a door's - the classic sheet's S or W row), else the family this character
 *  can reach; nothing open. */
export function resetSpecGuide(fam = null) { _fam = fam === 'arcane' || fam === 'martial' ? fam : null; _open = null; _all = false; _note = null; _noteFresh = false; _swapOut = null; _swapIn = null; }

/**
 * THE PAGE into `detail` (the Growth rail's detail pane). `kit` the menu's makers: `{ el, divider, skillMeter, askCard,
 * entity, openMaster }` - `skillMeter(value, mastered)` the Stats page's skill bar (its gold climb past 100 a mastery's),
 * `askCard(rows, onYes)` its Yes/No card, `openMaster()` (optional) the Master Skills page.
 */
export function drawSpecGuide(detail, rerender, { el, divider, skillMeter = null, askCard, entity, openMaster = null }) {
  const m = specGuideModel(entity);
  detail.append(divider(t('growth.spec.title', 'Specializations')));
  detail.append(el('p', 'gr-lead', t('growth.spec.lead', 'Master two schools of magic or two weapon skills to unlock a specialization: a passive bonus plus a signature spell or technique. You can have one arcane and one martial specialization. Resetting one costs {gold, number} gold.', { gold: SPEC_RESET_GOLD })));
  if (!m.masterOn) {
    const off = el('div', 'gr-warn');
    off.append(el('span', null, m.switchable ? t('growth.spec.masterOff', 'Master Skills is turned off, so no specialization can be unlocked. Turn it on in Master Skills.') : t('growth.spec.masterOffLocked', 'Master Skills is off.')));
    detail.append(off);
  }
  if (_note) {
    // AUDIT SPEC-RESET L3-2: the answer to a Choose or a Reset - a status line, brought into view and focused once it is
    // drawn: the pane kept its scroll, and the note stood above it at every size in both dresses
    const note = el('div', 'px-master-note', _note);
    note.setAttribute('role', 'status');
    detail.append(note);
    if (_noteFresh) {
      _noteFresh = false;
      note.tabIndex = -1;
      Promise.resolve().then(() => { if (!note.isConnected) return; note.scrollIntoView?.({ block: 'nearest' }); note.focus?.({ preventScroll: true }); });
    }
  }
  if (!_fam) _fam = firstFamily(m);
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
  head.append(el('div', 'gr-headline', familyLine(fam)));
  // SKILL-SWAP: a class that can never meet a path is told the one way it now can
  if (fam.swapOpens) head.append(el('p', 'gr-fine', fam.id === 'arcane' ? t('growth.swap.hintArcane', 'You can change one of your class skills for a school of magic below.') : t('growth.swap.hintMartial', 'You can change one of your class skills for a weapon skill below.')));
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
  const reachable = fam.paths.filter((p) => p.state !== 'never' && p.state !== 'slots');
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
    if (open) row.append(pathDetail(el, fam, p, rerender, askCard, m.masterOn));
    list.append(row);
  }
  detail.append(list);
  if (reachable.length < fam.paths.length) {
    const more = el('button', 'act gr-more', _all ? t('growth.spec.showReach', 'Show only paths you can get') : t('growth.spec.showAll', 'Show all 15 paths'));
    more.onclick = () => { _all = !_all; rerender(); };
    detail.append(more);
  }
  if (m.swap?.out.length && m.swap.in.length) drawSkillSwap(detail, rerender, { el, divider, askCard }, m.swap);
}

/** SKILL-SWAP (systems/skillSwap.js): the form - the class skill to give up, the one to take in its place, and the
 *  swap, asked first; refused (the press stands, disabled, and says why) short of the gold. */
function drawSkillSwap(detail, rerender, { el, divider, askCard }, sw) {
  if (!sw.out.includes(_swapOut)) _swapOut = sw.out[0];
  if (!sw.in.includes(_swapIn)) _swapIn = sw.in[0];
  detail.append(divider(t('growth.swap.title', 'Change a class skill')));
  detail.append(el('p', 'gr-lead', t('growth.swap.lead', 'Give up a class skill you have not mastered, and take a skill from outside your class in its place, in the same group. It costs {gold, number} gold. Your level and your skills\' values do not change.', { gold: SKILL_SWAP_GOLD })));
  const box = el('section', 'px-mgroup gr-swap');
  const pick = (label, ids, value, onPick) => {
    const s = el('select', 'act');
    s.setAttribute('aria-label', label);
    for (const id of ids) { const o = el('option', null, SKILL_NAMES[id] ?? String(id)); o.value = String(id); if (id === value) o.selected = true; s.append(o); }
    s.onchange = () => { onPick(Number(s.value)); rerender(); };
    return s;
  };
  box.append(el('div', 'gr-skilltop', t('growth.swap.out', 'Give up')), pick(t('growth.swap.out', 'Give up'), sw.out, _swapOut, (v) => { _swapOut = v; }));
  box.append(el('div', 'gr-skilltop', t('growth.swap.in', 'Take instead')), pick(t('growth.swap.in', 'Take instead'), sw.in, _swapIn, (v) => { _swapIn = v; }));
  const out = _swapOut, inn = _swapIn, refusal = sw.refusal(out, inn);
  const words = { out: SKILL_NAMES[out], inn: SKILL_NAMES[inn], gold: SKILL_SWAP_GOLD, group: groupWord(sw.group(out)) };
  // AUDIT SUGGESTIONS-1019 L5-1/L5-2 and SWAP-CYCLE: what the swap costs beyond the gold, said beside the picks and again in the ask
  const lock = sw.lockTurn(out, inn), short = Math.ceil(sw.shortfall(out, inn));
  const warns = [
    ...(short > 0 ? [t('growth.swap.ground', 'Your level stays, but your class skills then earn nothing toward your next level until they make up {n, plural, one {# point} other {# points}}.', { n: short })] : []),
    ...(sw.slotsLeft(out) === 0 ? [t('growth.swap.noSlots', 'Your {group} mastery slots are spent, so {inn} could never be mastered.', words)] : []),
    ...(lock === 'on' ? [t('growth.swap.lockOn', 'With Master Skills off, {inn} at 100 as a primary skill holds your other skills at 95.', words)]
      : lock === 'off' ? [t('growth.swap.lockOff', 'With Master Skills off, your other skills are no longer held at 95 once {out} leaves your primary skills.', words)] : []),
  ];
  for (const w of warns) box.append(el('p', 'gr-fine gr-swap-warn', w));
  const acts = el('div', 'gr-acts');
  const b = el('button', 'act', t('growth.swap.btn', 'Swap · {gold, number} gold', words).replace(/ ·/g, '\u00a0·'));
  b.disabled = !!refusal;
  b.onclick = () => {
    if (refusal) return;
    askCard([
      t('growth.swap.ask', 'Give up {out} for {inn} for {gold, number} gold?', words),
      t('growth.swap.askGroup', '{inn} becomes one of your {group} skills. {out} becomes a miscellaneous skill: it keeps its value but can no longer be mastered.', words),
      ...warns,
    ], () => { _note = sw.go(out, inn).text; _noteFresh = true; rerender(); });
  };
  acts.append(b);
  box.append(acts);
  if (refusal) {
    const why = el('p', 'gr-fine gr-reset-why', refusal);
    why.id = 'gr-swap-why';
    b.setAttribute('aria-describedby', why.id);
    box.append(why);
  }
  detail.append(box);
}

/** The family the page opens on: one with a choice waiting, then the one held, then one this class can reach (AUDIT
 *  GROWTH LANE1-9 - a held arcane path hid the martial paths waiting). */
export function firstFamily(m) {
  return m.families.find((f) => f.open)?.id ?? m.families.find((f) => f.held)?.id ?? m.families.find((f) => f.possible)?.id ?? 'arcane';
}

/** A family's headline: the path held, how many are open, why none can be (the class, or the slots the player's own
 *  masteries spent - LANE1-4), or how one opens. */
export function familyLine(fam) {
  const arc = fam.id === 'arcane';
  if (fam.held) return t('growth.spec.heldLine', 'Your {family} specialization: {name}.', { family: famWord(fam.id), name: fam.held.name });
  if (fam.open) return t('growth.spec.openLine', '{n, plural, one {# path is available. Choose it below.} other {# paths are available. Choose one below.}}', { n: fam.open });
  if (!fam.possible && !fam.classPossible) return arc ? t('growth.spec.arcaneNever', 'Your class can\'t master two schools of magic, so no arcane path is available.') : t('growth.spec.martialNever', 'Your class can\'t master two weapon skills, so no martial path is available.');
  if (!fam.possible) return arc ? t('growth.spec.arcaneSpent', 'Your mastery slots left can\'t hold two schools of magic, so no arcane path is available.') : t('growth.spec.martialSpent', 'Your mastery slots left can\'t hold two weapon skills, so no martial path is available.');
  return arc ? t('growth.spec.arcaneHow', 'Master any two schools of magic to unlock the path for that pair.') : t('growth.spec.martialHow', 'Master any two weapon skills to unlock the path for that pair.');
}

const famWord = (id) => (id === 'arcane' ? t('growth.spec.arcaneWord', 'arcane') : t('growth.spec.martialWord', 'martial'));
/** A skill's state, short, under its meter. */
function skillWord(s) {
  return ({
    mastered: t('growth.spec.cell.mastered', 'Mastered'),
    ready: t('growth.spec.cell.ready', 'Ready to master'),
    climb: t('growth.spec.cell.climb', '{n} to 100', { n: 100 - s.value }),
    full: t('growth.spec.cell.full', 'No {group} slots left', { group: groupWord(s.group) }),
    misc: t('growth.spec.cell.misc', 'Cannot be mastered'),
  })[s.state] ?? '';
}

/** A path's Requirements: each skill of its pair in its words, `[state, text]` - and, when one slot is left for two
 *  skills of one group (each alone reads ready, the pair never fits - AUDIT GROWTH LANE1-1), that. Pure. */
export function pathSteps(p) {
  const out = p.pair.map((s) => [s.state, skillStandText(s)]);
  if (p.state === 'slots' && !p.pair.some((s) => s.state === 'full')) {
    const [a, b] = p.pair;
    out.push(['full', t('growth.spec.skill.shared', '{a} and {b} are both {group} skills, and you can master only one more {group} skill.', { a: a.name, b: b.name, group: groupWord(a.group) })]);
  }
  return out;
}

/** How a chosen signature is used. LANE1-11: every Buy Spells shelf sells it (the guilds' and the temples' -
 *  worldModes.js signatureOffers); a found technique wins the key only while the loot ladder is on
 *  (combat/techniques.js techniqueInHand). */
export function useLine(kind) {
  if (kind === 'spell') return t('growth.spec.useSpell', 'Once chosen, buy it wherever spells are sold and cast it like any other spell.');
  return lootRarityOn() ? t('growth.spec.useTechniqueOwn', 'Once chosen, press your Weapon Technique key while fighting with one of its two skills. A weapon with a technique of its own uses that instead.')
    : t('growth.spec.useTechnique', 'Once chosen, press your Weapon Technique key while fighting with one of its two skills.');
}

/** A path's detail: its state, what opens it, its passive, its signature, how it is used - and its Choose. */
function pathDetail(el, fam, p, rerender, askCard, on) {
  const box = el('div', 'gr-detail');
  const why = el('p', 'gr-why', stateLine(fam, p, on));
  why.classList.add(`is-${p.state}`);
  box.append(why);
  if (p.state !== 'chosen' && p.state !== 'closed') {
    box.append(el('div', 'gr-sub', t('growth.spec.opens', 'Requirements')));
    const ul = el('ul', 'gr-steps');
    for (const [state, text] of pathSteps(p)) ul.append(el('li', `is-${state}`, text));
    box.append(ul);
  }
  box.append(el('div', 'gr-sub', t('growth.spec.passive', 'Passive: {name}', { name: p.passive.name })));
  box.append(el('p', 'gr-text', p.passive.text));
  const sig = p.signature;
  box.append(el('div', 'gr-sub', sig.kind === 'spell' ? t('growth.spec.spell', 'Signature spell: {name}', { name: sig.name }) : t('growth.spec.technique', 'Signature technique: {name}', { name: sig.name })));
  box.append(el('p', 'gr-text', sig.text));
  for (const line of sig.lines) box.append(el('p', 'gr-fine', line));
  box.append(el('p', 'gr-fine gr-use', useLine(sig.kind)));
  if (p.state === 'open') {
    const acts = el('div', 'gr-acts');
    const b = el('button', 'act primary', t('growth.spec.choose', 'Choose {name}', { name: p.name }));
    b.onclick = () => askCard(p.ask(), () => { _note = p.choose().text; _noteFresh = true; _open = p.id; rerender(); });
    acts.append(b);
    box.append(acts);
  }
  // SPEC-RESET: the held path given up, for gold - asked first; refused (the press stands, disabled, and says why) short
  // of the gold, or where no other path could ever open
  if (p.state === 'chosen' && fam.reset) {
    const r = fam.reset;
    const acts = el('div', 'gr-acts');
    // AUDIT SPEC-RESET L3-7: never a line that starts with the "·" - it binds to the word before it, in every language
    const b = el('button', 'act', t('growth.spec.reset.btn', 'Reset · {gold, number} gold', { gold: SPEC_RESET_GOLD }).replace(/ ·/g, '\u00a0·'));
    b.disabled = !!r.refusal;
    b.onclick = () => { if (!r.refusal) askCard(r.rows(), () => { _note = r.go().text; _noteFresh = true; _open = null; rerender(); }); };
    acts.append(b);
    box.append(acts);
    if (r.refusal) {
      const why = el('p', 'gr-fine gr-reset-why', r.refusal);
      why.id = `gr-reset-why-${fam.id}`;
      b.setAttribute('aria-describedby', why.id);   // AUDIT SPEC-RESET L3-5: the disabled press's reason, read with it
      box.append(why);
    }
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
.px-sys .gr-count { box-sizing: border-box; min-width: 24px; height: 22px; padding: 0 6px; font-size: 16px; line-height: 20px; letter-spacing: 0; text-align: center;
  color: #0f1a12; text-shadow: none; background: #8fc7a0; border: 1px solid #0c120e; box-shadow: inset 0 1px 0 #c4e6cd, inset 0 -2px 0 #5d9370; }   /* GROWTH-BOOK: the rail's plaque, in the path's green */
:root[data-plus-dress="grimoire"] .px-sys .gr-count { color: #f3e2b8; background: #2f6a3c; border-color: #10261a; font-family: inherit;
  box-shadow: inset 0 1px 0 rgba(200,240,200,0.35), inset 0 -2px 0 #1d4527; }
.px-sys .gr-head { padding: 10px 12px; }
.px-sys .gr-headline { font-size: 15px; line-height: 1.4; color: #e9e4d9; margin-bottom: 8px; }
.px-sys .gr-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 12px; }
.px-sys .gr-skill { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.px-sys .gr-skilltop { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 14px; height: 20px; line-height: 20px; }   /* GROWTH-BOOK: one height, so a mastered skill's mark never lifts its row */
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
.px-sys .gr-path.is-never .gr-pathname, .px-sys .gr-path.is-slots .gr-pathname, .px-sys .gr-path.is-closed .gr-pathname { color: #9c937d; }
.px-sys .gr-tag.is-open { color: #8fc7a0; }
.px-sys .gr-tag.is-ready { color: #e0c36a; }
.px-sys .gr-tag.is-never, .px-sys .gr-tag.is-slots, .px-sys .gr-tag.is-closed { color: #8b8578; }
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
.px-sys .gr-reset-why { margin-top: 6px; color: #b8a27a; }
.px-sys .gr-swap select { max-width: 100%; }   /* AUDIT SUGGESTIONS-1019 L5-3: a long skill name never pushes the pane sideways */
.px-sys .gr-swap-warn { color: #e0a54a; }
@media (max-width: 660px) {
  .px-sys .gr-pathbar { grid-template-columns: minmax(0, 1fr) auto; }
  .px-sys .gr-pathpair { grid-column: 1 / -1; grid-row: 2; }
  .px-sys .gr-skills { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
