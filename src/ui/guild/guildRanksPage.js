// @ts-check
// GUILD-RANKS (2026-10-30, the owner: "More guild ranks plus rank permission edits"; bible/11-Multiplayer/Guild-Shop.md
// section 13): THE GUILD WINDOW'S RANKS PAGE - the ranks by name, four to eight, one added or taken at the bottom, and
// what each may do as a grid, a power a row and a rank a column. The guildmaster edits both; every member reads them.
// The service holds every rule (server-account/src/guilds.js renameGuildRanks, setGuildPowers). Drawn through the
// window's own kit (ui/socialPanel.js).
import { GUILD_RANKS_MIN, GUILD_RANKS_MAX, GUILD_RANK_NAMES, GUILD_RANK_NAME_MAX, GUILD_POWERS_EDITABLE, guildMay, guildRankNamesOf, guildPowersOf } from '../../net/guild/guildLaw.js';
import { t } from '../../systems/textManager.js';

/** An editable power's name on the grid. */
export function guildPowerName(/** @type {string} */ p) {
  switch (p) {
    case 'invite': return t('guild.ranks.power.invite', 'Invite and answer requests');
    case 'remove': return t('guild.ranks.power.remove', 'Remove lower ranks');
    case 'promote': return t('guild.ranks.power.promote', 'Promote and demote');
    case 'deposit': return t('guild.ranks.power.deposit', 'Put into the treasuries');
    case 'withdraw': return t('guild.ranks.power.withdraw', 'Take from the treasuries');
    case 'vaultGrant': return t('guild.ranks.power.vaultGrant', 'Set vault access');
    case 'shop': return t('guild.ranks.power.shop', 'Buy hall furniture');
    case 'logo': return t('guild.ranks.power.logo', 'Send a guild logo');
    case 'hallEntry': return t('guild.ranks.power.hallEntry', 'Choose who enters the hall');
    case 'decorate': return t('guild.ranks.power.decorate', 'Decorate the hall');
    case 'notes': return t('guild.ranks.power.notes', 'Take down board notes');
    default: return p;
  }
}

/** AUDIT GUILD-RANKS A4/C1: the grid as the guild keeps it - only the powers that differ from the law's default for `n`
 *  ranks, so one left at its default follows the guild as it grows (a deposit stays every rank's). */
export function guildPowersChanged(/** @type {Record<string, number[]>} */ grid, /** @type {number} */ n) {
  const def = guildPowersOf(null, n);
  /** @type {Record<string, number[]>} */
  const out = {};
  for (const p of GUILD_POWERS_EDITABLE) {
    const mine = (grid?.[p] ?? []).filter((r) => r > 0 && r < n);
    if (JSON.stringify(mine) !== JSON.stringify(def[p].filter((r) => r > 0))) out[p] = mine;
  }
  return out;
}

/** The guild's rank names - its own, else the defaults. */
const namesOf = (/** @type {any} */ v) => (Array.isArray(v?.ranks) && v.ranks.length >= GUILD_RANKS_MIN ? v.ranks : GUILD_RANK_NAMES);
/** The ranks beside the guildmaster that hold `power` in the view's table. */
const holders = (/** @type {any} */ v, /** @type {string} */ p, /** @type {number} */ n) => (Array.isArray(v?.powers?.[p]) ? v.powers[p] : []).filter((/** @type {number} */ r) => r > 0 && r < n);

/**
 * THE PAGE'S NODES. `k` the window's kit (`el`, `btn`, `live`, `field`, `act`, `arm`, `armed`, `draft`, `doc`, `paint`,
 * `redraw`); `me` the reader's rank.
 * @param {any} k @param {any} g the guild book @param {any} v the guild's view @param {number} me
 */
export function guildRanksNodes(k, g, v, me) {
  const names = namesOf(v);
  const master = guildMay(me, 'renameRanks', v.powers);
  return [...namesNodes(k, g, v, names, master), ...gridNodes(k, g, v, names, master)];
}

/** THE NAMES: each rank's, and how many stand at it; the guildmaster's to rename, add to and take from. */
function namesNodes(/** @type {any} */ k, /** @type {any} */ g, /** @type {any} */ v, /** @type {string[]} */ names, /** @type {boolean} */ master) {
  const { el } = k;
  const out = [el('div', 'dfsocial-sec', t('guild.ranks.title', 'Ranks')),
    el('div', 'dfsocial-note', t('guild.ranks.about', 'A guild has {min} to {max} ranks. New members join at the lowest.', { min: GUILD_RANKS_MIN, max: GUILD_RANKS_MAX }))];
  const count = (/** @type {number} */ r) => (v.members ?? []).filter((/** @type {any} */ m) => m.rank === r).length;
  if (!master) {
    const list = el('div', 'dfguild-ranklist');
    names.forEach((name, r) => list.append(el('div', 'dfguild-rankrow', t('guild.ranks.row', '{n}. {name} - {count, plural, one {# member} other {# members}}', { n: r + 1, name, count: count(r) }))));
    out.push(list);
    return out;
  }
  const d = k.draft;
  const from = `${v.id}|${JSON.stringify(names)}`;
  if (d.rankNamesFor !== from || !Array.isArray(d.rankNames)) { d.rankNamesFor = from; d.rankNames = [...names]; }
  const form = el('div', 'dfsocial-form');
  const note = el('div', 'dfsocial-note');
  // AUDIT GUILD-RANKS C5: a rank added or taken redraws the fields in place, so the focus stays on the button pressed
  const drawNames = () => {
    form.replaceChildren();
    d.rankNames.forEach((/** @type {string} */ name, /** @type {number} */ i) => k.field(form, t('guild.ranks.field', 'Rank {n}', { n: i + 1 }), name, GUILD_RANK_NAME_MAX,
      (/** @type {string} */ x) => { if (Array.isArray(d.rankNames)) d.rankNames[i] = x; }));
    const len = d.rankNames.length;
    const moving = (v.members ?? []).filter((/** @type {any} */ m) => m.rank >= len).length;
    note.textContent = moving > 0 ? t('guild.ranks.moving', 'If you save, {count, plural, one {# member moves} other {# members move}} to {rank}.', { count: moving, rank: d.rankNames[len - 1] || t('guild.ranks.lowest', 'the lowest rank') }) : '';
    k.paint();
  };
  drawNames();
  out.push(form, note);
  const len = () => (Array.isArray(d.rankNames) ? d.rankNames.length : names.length);
  const shape = el('div', 'dfsocial-acts');
  shape.append(
    k.live(t('guild.ranks.add', 'Add a rank'), () => ({ enabled: len() < GUILD_RANKS_MAX && !g.busy, why: len() >= GUILD_RANKS_MAX ? t('guild.ranks.why.most', '{max} at most', { max: GUILD_RANKS_MAX }) : 'a moment' }),
      { run: () => { if (!Array.isArray(d.rankNames)) return; d.rankNames.push(t('guild.ranks.new', 'Rank {n}', { n: len() + 1 })); drawNames(); } }),
    k.live(t('guild.ranks.drop', 'Remove the lowest'), () => ({ enabled: len() > GUILD_RANKS_MIN && !g.busy, why: len() <= GUILD_RANKS_MIN ? t('guild.ranks.why.fewest', '{min} at least', { min: GUILD_RANKS_MIN }) : 'a moment' }),
      { run: () => { if (!Array.isArray(d.rankNames)) return; d.rankNames.pop(); drawNames(); } }));
  out.push(shape);
  const same = () => !Array.isArray(d.rankNames) || JSON.stringify(d.rankNames) === JSON.stringify(names);
  const acts = el('div', 'dfsocial-acts');
  acts.append(k.live(t('guild.ranks.save', 'Save ranks'), () => {
    const why = g.busy ? 'a moment' : !guildRankNamesOf(d.rankNames) ? t('guild.ranks.why.names', 'different names of 1 to {max} letters', { max: GUILD_RANK_NAME_MAX }) : same() ? t('guild.ranks.why.same', 'unchanged') : null;
    return { enabled: !why, why };
  }, { run: () => k.act(g.renameRanks(d.rankNames), t('guild.ranks.saved', 'The ranks are saved.'), () => { d.rankNames = null; }) }));
  out.push(acts);
  return out;
}

/** THE GRID: each power the guildmaster may give, a row; each rank under the guildmaster, a column. The guildmaster holds
 *  every power, so its column is left out. */
function gridNodes(/** @type {any} */ k, /** @type {any} */ g, /** @type {any} */ v, /** @type {string[]} */ names, /** @type {boolean} */ master) {
  const { el, btn } = k;
  const n = names.length;
  const out = [el('div', 'dfsocial-sec', t('guild.ranks.powers', 'What each rank may do')),
    el('div', 'dfsocial-note', t('guild.ranks.powersAbout', 'The guildmaster may do all of it. A rank acts only on the ranks under its own.'))];
  const d = k.draft;
  const from = `${v.id}|${n}|${JSON.stringify(v.powers ?? null)}`;
  if (master && (d.powersFor !== from || !d.powers)) { d.powersFor = from; d.powers = Object.fromEntries(GUILD_POWERS_EDITABLE.map((p) => [p, holders(v, p, n)])); }
  const wrap = el('div', 'dfguild-gridwrap');
  const table = el('table', 'dfguild-grid');
  const head = el('tr', null);
  head.append(el('th', null, ''));
  for (let r = 1; r < n; r++) head.append(el('th', null, names[r]));
  table.append(head);
  for (const p of GUILD_POWERS_EDITABLE) {
    const row = el('tr', null);
    row.append(el('th', null, guildPowerName(p)));
    for (let r = 1; r < n; r++) {
      const cell = el('td', null);
      const has = master ? d.powers[p].includes(r) : holders(v, p, n).includes(r);
      if (master) {
        const box = k.doc.createElement('input');
        box.type = 'checkbox';
        box.checked = has;
        box.setAttribute('aria-label', `${guildPowerName(p)}: ${names[r]}`);
        box.addEventListener('change', () => {
          const set = new Set(d.powers[p]);
          if (box.checked) set.add(r); else set.delete(r);
          d.powers[p] = [...set].sort((a, b) => a - b);
          k.paint();
        });
        cell.append(box);
      } else {
        cell.textContent = has ? '✓' : '–';
        cell.setAttribute('aria-label', `${guildPowerName(p)}, ${names[r]}: ${has ? t('guild.ranks.yes', 'yes') : t('guild.ranks.no', 'no')}`);   // AUDIT GUILD-RANKS C5
      }
      row.append(cell);
    }
    table.append(row);
  }
  wrap.append(table);
  out.push(wrap);
  if (!master) return out;
  const same = () => !d.powers || GUILD_POWERS_EDITABLE.every((p) => JSON.stringify(d.powers[p]) === JSON.stringify(holders(v, p, n)));
  const acts = el('div', 'dfsocial-acts');
  acts.append(k.live(t('guild.ranks.powersSave', 'Save permissions'), () => {
    const why = g.busy ? 'a moment' : same() ? t('guild.ranks.why.same', 'unchanged') : null;
    return { enabled: !why, why };
  }, { run: () => k.act(g.setPowers(guildPowersChanged(d.powers, n)), t('guild.ranks.powersSaved', 'The permissions are saved.'), () => { d.powers = null; }) }));
  acts.append(k.armed('powers-reset')
    ? btn(t('guild.ranks.resetSure', 'Sure? Defaults'), { warn: true, enabled: !g.busy, why: 'a moment', run: () => k.act(g.setPowers({}), t('guild.ranks.reset.done', 'The permissions are back to the defaults.'), () => { d.powers = null; }) })
    : btn(t('guild.ranks.reset', 'Use the defaults'), { enabled: !g.busy, why: 'a moment', run: () => k.arm('powers-reset') }));
  out.push(acts);
  return out;
}
