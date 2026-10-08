// INSPECT1 (2026-09-23, the community arc - kurkku: "a profile page that you can bring up when you're near them"; Mac:
// "For the profile suggestion. I think we develop a new enhanced UI element for the player inspect interaction.
// Showing their glyph, name, title, stats and worn gear"): THE PROFILE - a card in the middle of the screen for the
// player the F key found, opened from the F-menu's Inspect row.
//
// WHAT IT SAYS, AND WHOSE WORD EACH PART IS:
//   - the TITLE above the name and the GLYPHS after it, the name layer's own order - the RELAY's word, off the signed
//     identity token (net/wire.js badged), drawn through the one badge law (ui/playerBadge.js);
//   - the NAME the room knows them by;
//   - their level, race and class, the eight attributes and the three vitals' maxima - THEIR word, the card their own
//     game hands over when asked (net/profileCard.js composeCard: what their character sheet shows);
//   - what they WEAR, slot by slot, named as the pack names an item (systems/itemInfo.js itemLongName) - off the card's
//     look when it came, and off the room's copy of their look until it does (or if it never does).
// So the card is useful the moment it opens: the gear and the badges are the room's already, and the sheet arrives a
// frame later. A peer whose game cannot answer (the relay is older, or they did not) keeps the room's half, and a line
// says so rather than leaving a blank that reads as a bug.
//
// IT IS A POINTER SURFACE, like the F-menu it opens from (ui/socialMenu.js): the host frees the pointer on the open and
// takes it back on the close, inside those gestures; one capture listener takes one key - Escape closes - unless a
// surface stands over this one; a press inside the card is the card's, never a swing.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { isTextEntryTarget } from './input.js';
import { titleBadge, glyphBadges, glyphSvgNode, paintTitle } from './playerBadge.js';
import { PIXELIFY_FIVE_FACE, PIXEL_FONT_CSS } from './pixelifyFive.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { itemLongName } from '../systems/itemInfo.js';
import { raceDisplayName } from '../systems/talkSession.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { duelRecordText } from '../net/duelRecord.js';   // DUEL1: the duelling record's words, the account card's own
import { renownText } from '../net/renown.js';   // RENOWN1: Renown, left of the name
import { guildTagText } from '../net/guildLaw.js';   // GUILD1c: the guild's tag, right of the name
import { houseLine } from '../net/houseLaw.js';   // LEGACY7: the house, under the name

export const PROFILE_STYLE_ID = 'dagger-profile-style';

/** The attributes as the classic sheet labels them, in STAT_KEYS_ORDER - the card's own order (net/wire.js CARD_ATTRS). */
export const ATTR_SHORT = Object.freeze(['STR', 'INT', 'WIL', 'AGI', 'END', 'PER', 'SPD', 'LUC']);
export const ATTR_LABELS = Object.freeze(['Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck']);
/** The card's three vitals, in its order. */
export const VITAL_LABELS = Object.freeze(['Health', 'Fatigue', 'Magicka']);

/** WHAT THEY WEAR, in the order a reader looks a figure over - head to foot, then the hands, then the trinkets - each
 *  slot the look can carry (net/wire.js LOOK_GROUPS: clothing, armour, weapons, jewellery) under the word a player
 *  would use for it. The paired slots read as one word twice: two rings are two rings. */
export const GEAR_ROWS = Object.freeze([
  [EQUIP_SLOTS.Head, 'Head'],
  [EQUIP_SLOTS.Cloak1, 'Cloak'], [EQUIP_SLOTS.Cloak2, 'Cloak'],
  [EQUIP_SLOTS.RightArm, 'Right arm'], [EQUIP_SLOTS.LeftArm, 'Left arm'],
  [EQUIP_SLOTS.ChestArmor, 'Chest'], [EQUIP_SLOTS.ChestClothes, 'Clothes'],
  [EQUIP_SLOTS.Gloves, 'Hands'],
  [EQUIP_SLOTS.LegsArmor, 'Legs'], [EQUIP_SLOTS.LegsClothes, 'Legs'],
  [EQUIP_SLOTS.Feet, 'Feet'],
  [EQUIP_SLOTS.RightHand, 'Right hand'], [EQUIP_SLOTS.LeftHand, 'Left hand'],
  [EQUIP_SLOTS.Amulet0, 'Amulet'], [EQUIP_SLOTS.Amulet1, 'Amulet'],
  [EQUIP_SLOTS.Bracelet0, 'Bracelet'], [EQUIP_SLOTS.Bracelet1, 'Bracelet'],
  [EQUIP_SLOTS.Bracer0, 'Bracer'], [EQUIP_SLOTS.Bracer1, 'Bracer'],
  [EQUIP_SLOTS.Ring0, 'Ring'], [EQUIP_SLOTS.Ring1, 'Ring'],
  [EQUIP_SLOTS.Mark0, 'Mark'], [EQUIP_SLOTS.Mark1, 'Mark'],
  [EQUIP_SLOTS.Crystal0, 'Crystal'], [EQUIP_SLOTS.Crystal1, 'Crystal'],
]);

/** PROFILE-UI (2026-10-07, Mac: "Lets only organize and polish the player profile. Its a mess"): WHAT THEY WEAR IN ITS
 *  PARTS, in the order a reader looks for them - what is in their hands (a shield with the sword), their armour, their
 *  clothes, their jewellery - each piece by its own group (net/wire.js LOOK_GROUPS: every piece the look carries names
 *  one), a hand's piece in hand whatever it is. */
export const GEAR_PARTS = Object.freeze([['hand', 'In hand'], ['armour', 'Armour'], ['clothing', 'Clothing'], ['jewellery', 'Jewellery']]);
const HAND_SLOTS = new Set([EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand]);
/** The part a worn piece stands in. */
export const gearPartOf = (slot, it) => (HAND_SLOTS.has(slot) || it?.group === 'Weapons' ? 'hand'
  : it?.group === 'Armor' ? 'armour' : it?.group === 'Jewellery' ? 'jewellery' : 'clothing');

/** A look's worn items as rows, slot by slot in GEAR_ROWS' order - the first item a slot names (a look projected by
 *  validLook carries no two, but a slot is one place, so the first stands) - each with its part (PROFILE-UI). */
export function gearRows(look) {
  const bySlot = new Map();
  for (const it of Array.isArray(look?.items) ? look.items : []) {
    if (it && Number.isInteger(it.equipSlot) && !bySlot.has(it.equipSlot)) bySlot.set(it.equipSlot, it);
  }
  const rows = [];
  for (const [slot, label] of GEAR_ROWS) {
    const it = bySlot.get(slot);
    if (it) rows.push({ slot: label, name: itemLongName(it), part: gearPartOf(slot, it) });
  }
  return rows;
}

/** PROFILE-UI: the rows in their parts (GEAR_PARTS' order, a part with nothing in it left out), each part's rows in
 *  GEAR_ROWS' order - and a pair worn in two slots of one name, two rings, ONE row under the plural with both names: the
 *  card said "Ring" twice down the column, ten such pairs to a full look. */
export function gearGroups(rows) {
  const parts = new Map(GEAR_PARTS.map(([key, head]) => [key, { head, rows: [] }]));
  for (const r of Array.isArray(rows) ? rows : []) {
    const part = parts.get(r?.part) ?? parts.get('clothing');
    const last = part.rows[part.rows.length - 1];
    if (last && last.one === r.slot) { last.names.push(r.name); last.slot = `${r.slot}s`; continue; }
    part.rows.push({ one: r.slot, slot: r.slot, names: [r.name] });
  }
  return [...parts.values()].filter((p) => p.rows.length).map((p) => ({ head: p.head, rows: p.rows.map(({ slot, names }) => ({ slot, names })) }));
}

/** The states a profile can stand in: waiting on their card, drawn from it, or drawn without one - because they did not
 *  answer, or because the relay cannot carry a card (net/wire.js relaySupportsCard). */
export const PROFILE_STATES = Object.freeze(['asking', 'answered', 'silent', 'unsupported']);
/** The line under the card for each state - the one place its words live. */
export function profileNote(state, who = 'They') {
  if (state === 'asking') return `Asking ${who} for their card...`;
  if (state === 'silent') return `${who} did not answer - this is what they wear.`;
  if (state === 'unsupported') return `The server cannot carry a card yet - this is what ${who} wears.`;
  return null;
}

/**
 * THE VIEW, pure: `peer` is the room's record of them (net/online.js peers - the name, and the badge the relay read off
 * their token), `look` the room's copy of their look, `card` their answer or null, `state` one of PROFILE_STATES.
 * The card's look wins over the room's: it is the one they wear now.
 */
/** DUEL1: the record line's words while the account service is being asked, and when it could not say. */
export const DUEL_RECORD_ASKING = 'Duels: asking...';
export function profileDuelLine(record) {
  if (record === 'asking') return DUEL_RECORD_ASKING;
  const t = duelRecordText(record);
  return t ? `Duels: ${t}` : null;
}
/** WB5b: their gates closed, off the same record - said only once there is one to say (a stranger's none is not news). */
export function profileGateLine(record) {
  const n = record && typeof record === 'object' ? record.gates?.closed : null;
  return Number.isSafeInteger(n) && n > 0 ? `Breaches closed: ${n}` : null;   // WB12a
}
/** RAID4: the towns they defended, off the same record - said only once there is one to say. */
export function profileRaidLine(record) {
  const n = record && typeof record === 'object' ? record.raids?.defended : null;
  return Number.isSafeInteger(n) && n > 0 ? `Towns defended: ${n}` : null;
}
/** AUDIT SERPENT D4 (SERPENT1): the sea serpents they helped slay, off the same record - said only once there is one. */
export function profileSerpentLine(record) {
  const n = record && typeof record === 'object' ? record.serpents?.slain : null;
  return Number.isSafeInteger(n) && n > 0 ? `Serpents slain: ${n}` : null;
}
/** SD9b: the Hours they broke - each a Brass Remnant's fall the relay signed and the service counted once - off the same
 *  record, said only once there is one. */
export function profileSdLine(record) {
  const n = record && typeof record === 'object' ? record.sds?.broken : null;
  return Number.isSafeInteger(n) && n > 0 ? `Hours broken: ${n}` : null;
}
/** AUDIT RENOWN1 UI-3: a view with the peer's Renown as the session knows it NOW - the level rises on a renown frame
 *  while the card stands open, and the card showed the level it was opened with. A level the session does not know
 *  leaves the view's own. */
export function profileRenown(v, lv) {
  const text = renownText(lv);
  if (!v || !text || v.level === text) return v;
  return { ...v, level: text, levelTitle: `Renown ${lv}` };
}
export function profileView({ name = null, peer = null, look = null, card = null, state = 'asking', duel = null, record = null, wed = null } = {}) {
  const who = (typeof name === 'string' && name) ? name : 'Someone';
  const worn = card?.look ?? look ?? null;
  const race = typeof worn?.race === 'string' ? raceDisplayName(worn.race) : null;
  const klass = typeof worn?.class === 'string' ? worn.class : null;
  // RENOWN1 (Mac: "having their level appear on the left side of character name and ... ingame profile"): the level the
  // relay stamped off their signed token - never the card's own word (the card's "Level" is their Daggerfall level)
  const lv = Number.isSafeInteger(peer?.lv) ? peer.lv : null;
  return {
    name: who,
    level: renownText(lv),
    levelTitle: renownText(lv) ? `Renown ${lv}` : null,
    guild: guildTagText(peer?.gt),   // GUILD1c: the tag the relay stamped off their signed token - "<HND>", or null
    house: houseLine(peer?.house),   // LEGACY7: the house the relay stamped - "☠ Ysolde II of House Hlaalu", or null
    title: titleBadge(peer),
    glyphs: glyphBadges(peer),
    line: [card ? `Level ${card.level}` : null, race, klass].filter(Boolean).join(' '),
    attrs: card ? STAT_KEYS_ORDER.map((key, i) => ({ key, short: ATTR_SHORT[i], label: ATTR_LABELS[i], value: card.attrs[i] })) : [],
    vitals: card ? VITAL_LABELS.map((label, i) => ({ label, value: card.vitals[i] })) : [],
    gear: gearRows(worn),
    note: profileNote(PROFILE_STATES.includes(state) ? state : 'silent', who),
    state,
    // DUEL1 (Mac: "When inspecting a player, they should be able to send an invite to duel"; "Add a dueling K/D to the
    // ... player inspect profile"): the Challenge button's state as the host's duel law says it ({ label, enabled, why }
    // - null: no button, offline or on a relay that cannot carry a duel), and their record's line - the account
    // service's count, read by the account the relay stamped on their card (net/duelRecord.js), never the card's word
    duel: duel && typeof duel.label === 'string' ? { label: duel.label, enabled: !!duel.enabled, why: duel.enabled ? null : (duel.why ?? null) } : null,
    // LEGACY7 part three: the Propose button's state as the house's law says it - the duel's shape (null: no button)
    wed: wed && typeof wed.label === 'string' ? { label: wed.label, enabled: !!wed.enabled, why: wed.enabled ? null : (wed.why ?? null) } : null,
    duels: profileDuelLine(record),
    gates: profileGateLine(record),
    raids: profileRaidLine(record),   // RAID4
    serpents: profileSerpentLine(record),   // AUDIT SERPENT D4
    hours: profileSdLine(record),   // SD9b
  };
}

/** The card's sheet - the F-menu's pairing: the enhanced tokens where the skin's sheet is loaded, a fallback where it is
 *  not; the skin's own pixel face (FONT1). Its prefix is `dfprofile`, a surface of its own (AUDIT SOC C1's lesson: two
 *  surfaces that share a class name fight over it). */
export const PROFILE_CSS = `
${PIXELIFY_FIVE_FACE}
.dfprofile { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 7; display: none;
  width: min(560px, calc(100vw - 28px)); pointer-events: none; ${PIXEL_FONT_CSS} color: var(--bone, #e9e4d9); }
.dfprofile[data-state="open"] { display: block; }
.dfprofile-card { pointer-events: auto; background: rgba(14, 16, 19, .94); border: 1px solid var(--iron, #2b323b); border-radius: 6px;
  backdrop-filter: blur(4px); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;
  max-height: calc(100vh - 28px); overflow-y: auto; container-type: inline-size; }
.dfprofile-card:focus { outline: none; }
.dfprofile-head { text-align: center; padding-bottom: 8px; border-bottom: 1px solid var(--iron, #2b323b); }
.dfprofile-title { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; line-height: 1.4;
  width: fit-content; max-width: 100%; margin-inline: auto; }   /* SHADOW-FANG (AUDIT A1): the word's own width - a gradient title's stops span the word, not the card */
/* PROFILE-UI: where the Renown, the name and the tag will not stand on one line, the line breaks BETWEEN them - the tag
   under the name, never the name in two */
.dfprofile-name { display: inline-flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 6px; font-size: 19px; line-height: 1.3; overflow-wrap: anywhere; }
.dfprofile-glyph { width: 16px; height: 16px; flex: none; }
/* PROFILE-UI: the glyphs' own row under the name - centred, wrapping, never beside the name to squeeze it */
.dfprofile-glyphs { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 6px; margin: 6px auto 0; max-width: 100%; }
/* PROFILE-UI: the record's plaques - one row that wraps, each its own words */
.dfprofile-facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 8px; }
.dfprofile-fact { font-size: 12px; line-height: 1.35; padding: 3px 8px; color: var(--bone, #e9e4d9);
  background: rgba(255, 255, 255, .03); border: 1px solid var(--iron, #2b323b); border-radius: 3px; }
.dfprofile-renown { flex: none; font-size: 13px; line-height: 1.3; padding: 1px 5px; border-radius: 2px; min-width: 1.4em;
  text-align: center; font-variant-numeric: tabular-nums; color: #f2c46b;
  background: rgba(242, 196, 107, .1); border: 1px solid rgba(242, 196, 107, .8); }
.dfprofile-renown:empty { display: none; }
/* LEGACY7: the house under the name - the name layer's own parchment */
.dfprofile-house { font-size: 12px; letter-spacing: .03em; color: #d8c79a; font-style: italic; margin-top: 2px; }
/* GUILD1c: the guild's tag right of the name, before the glyphs - the name layer's own steel */
.dfprofile-guild { flex: none; font-size: 13px; letter-spacing: .04em; color: #a9c4dd; }
.dfprofile-line { font-size: 13px; color: var(--dim, #9a9486); line-height: 1.4; }
.dfprofile-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr); gap: 14px; }
.dfprofile-h { font-size: 11px; color: var(--dim, #9a9486); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
.dfprofile-attrs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 12px; }
.dfprofile-stat, .dfprofile-vital { display: flex; justify-content: space-between; gap: 6px; font-size: 14px; line-height: 1.5; }
.dfprofile-k { color: var(--dim, #9a9486); }
.dfprofile-v { color: var(--bone, #e9e4d9); }
.dfprofile-vitals { margin-top: 8px; }
.dfprofile-row { display: flex; gap: 8px; font-size: 13px; line-height: 1.5; }
/* PROFILE-UI: what they wear in its parts - a part's name over its rows; a pair's names one under the other */
.dfprofile-sub { font-size: 11px; letter-spacing: .06em; color: var(--brass, #c08a3e); margin: 8px 0 2px; }
.dfprofile-h + .dfprofile-sub { margin-top: 0; }
.dfprofile-items { display: flex; flex-direction: column; min-width: 0; }
.dfprofile-slot { flex: none; width: 6.5em; color: var(--dim, #9a9486); }
.dfprofile-item { min-width: 0; overflow-wrap: anywhere; }
.dfprofile-none { font-size: 13px; color: var(--dim, #9a9486); }
.dfprofile-note { font-size: 12px; font-style: italic; color: #c8c2b4; text-align: center; }
.dfprofile-close { align-self: center; min-width: 120px; min-height: 44px; background: var(--iron, #2b323b); color: var(--bone, #e9e4d9);
  border: 0; border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 12px; cursor: pointer; text-align: center; }
.dfprofile-close:hover { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
.dfprofile-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.dfprofile-duel { min-width: 120px; min-height: 44px; background: #3a2226; color: var(--bone, #e9e4d9); border: 1px solid #7a3b3b;
  border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 12px; cursor: pointer; text-align: center; }
.dfprofile-duel:hover:not([disabled]) { background: #b8483f; color: var(--ink, #0e1013); }
.dfprofile-duel[disabled] { opacity: .55; cursor: default; }
.dfprofile-wed { min-width: 120px; min-height: 44px; background: #2e2a1e; color: var(--bone, #e9e4d9); border: 1px solid #8a7440;
  border-radius: 3px; font: inherit; font-size: 14px; padding: 6px 12px; cursor: pointer; text-align: center; }
.dfprofile-wed:hover:not([disabled]) { background: var(--brass, #c08a3e); color: var(--ink, #0e1013); }
.dfprofile-wed[disabled] { opacity: .55; cursor: default; }
.dfprofile-why { font-size: 12px; color: var(--dim, #9a9486); text-align: center; }
/* a phone's width: the sheet above what they wear, not beside it - and the name a size down, so the widest a name can
   be (NAME_MAX of the face's widest letter) stands on one line with its glyphs; breaking inside it is the last resort */
@container (max-width: 400px) { .dfprofile-body { grid-template-columns: minmax(0, 1fr); } .dfprofile-name { font-size: 16px; } }
`;

export function injectProfileStyle(doc = document) {
  if (!doc?.getElementById || doc.getElementById(PROFILE_STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = PROFILE_STYLE_ID;
  s.textContent = PROFILE_CSS;
  (doc.head ?? doc.body)?.append(s);
}

/**
 * The card over the document. `canOpen()` is the host's word on whether a surface may stand (the F-menu's gate),
 * `onOpen`/`onClose` its pointer door, `above()` whether a surface stands over this one (then Escape is not ours).
 */
export function createProfileWindow({ canOpen = () => true, onOpen = null, onClose = null, above = () => false, onDuel = null, onWed = null, doc = document, win = globalThis } = {}) {
  injectProfileStyle(doc);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; };
  const root = el('div', 'dfprofile');
  root.dataset.state = 'closed';
  const card = el('div', 'dfprofile-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'dfprofile-name-node');
  card.setAttribute('tabindex', '-1');
  root.append(card);
  doc.body?.append(root);

  let alive = true;
  let open = false;
  let shownPeer = null;

  const paint = (v) => {
    card.replaceChildren();
    const head = el('div', 'dfprofile-head');
    if (v.title) head.append(paintTitle(el('div', 'dfprofile-title', v.title.text), v.title));   // SHADOW-FANG: its colour, or its gradient
    const nm = el('div', 'dfprofile-name');
    nm.id = 'dfprofile-name-node';
    if (v.level) { const lv = el('span', 'dfprofile-renown', v.level); if (v.levelTitle) lv.title = v.levelTitle; nm.append(lv); }   // RENOWN1: left of the name
    nm.append(el('span', 'dfprofile-nametext', v.name));
    if (v.guild) nm.append(el('span', 'dfprofile-guild', v.guild));   // GUILD1c: right of the name
    head.append(nm);
    // PROFILE-UI (Mac: "Its a mess"): the glyphs on a row of their own under the name, wrapping - beside it, a player's
    // eighteen squeezed the name to a letter a line
    if (v.glyphs.length) {
      const glyphs = el('div', 'dfprofile-glyphs');
      for (const g of v.glyphs) { const svg = glyphSvgNode(doc, g, 'dfprofile-glyph'); if (!svg) break; glyphs.append(svg); }
      head.append(glyphs);
    }
    if (v.house) head.append(el('div', 'dfprofile-house', v.house));   // LEGACY7: under the name, as over the head
    if (v.line) head.append(el('div', 'dfprofile-line', v.line));
    // PROFILE-UI: their record - the duels (DUEL1), the gates closed (WB5b), the towns defended (RAID4), the serpents slain
    // (AUDIT SERPENT D4) - a row of plaques, each its own words, where four dim lines stood one under another
    const facts = [['dfprofile-duels', v.duels], ['dfprofile-gates', v.gates], ['dfprofile-raids', v.raids], ['dfprofile-serpents', v.serpents], ['dfprofile-hours', v.hours]].filter(([, t]) => t);
    if (facts.length) {
      const record = el('div', 'dfprofile-facts');
      for (const [cls, t] of facts) record.append(el('div', `dfprofile-fact ${cls}`, t));
      head.append(record);
    }
    card.append(head);
    // PROFILE-UI: the waiting or the silence said under the head, before the gap it explains - not under the gear
    if (v.note) card.append(el('div', 'dfprofile-note', v.note));
    const body = el('div', 'dfprofile-body');
    const sheet = el('div', 'dfprofile-sheet');
    sheet.append(el('div', 'dfprofile-h', 'Attributes'));
    if (v.attrs.length) {
      const grid = el('div', 'dfprofile-attrs');
      for (const a of v.attrs) {
        const r = el('div', 'dfprofile-stat');
        r.title = a.label;
        r.append(el('span', 'dfprofile-k', a.short), el('span', 'dfprofile-v', String(a.value)));
        grid.append(r);
      }
      sheet.append(grid);
      const vit = el('div', 'dfprofile-vitals');
      for (const x of v.vitals) { const r = el('div', 'dfprofile-vital'); r.append(el('span', 'dfprofile-k', x.label), el('span', 'dfprofile-v', String(x.value))); vit.append(r); }
      sheet.append(vit);
    } else sheet.append(el('div', 'dfprofile-none', v.state === 'asking' ? '...' : 'Not shown.'));
    const gear = el('div', 'dfprofile-gear');
    gear.append(el('div', 'dfprofile-h', 'Worn'));
    // PROFILE-UI: in its parts (gearGroups), a pair one row under the plural - its names one under the other
    if (v.gear.length) {
      for (const part of gearGroups(v.gear)) {
        gear.append(el('div', 'dfprofile-sub', part.head));
        for (const g of part.rows) {
          const r = el('div', 'dfprofile-row');
          const names = el('span', 'dfprofile-items');
          for (const n of g.names) names.append(el('span', 'dfprofile-item', n));
          r.append(el('span', 'dfprofile-slot', g.slot), names);
          gear.append(r);
        }
      }
    } else gear.append(el('div', 'dfprofile-none', 'Nothing worn that shows.'));
    body.append(sheet, gear);
    card.append(body);
    const close = el('button', 'dfprofile-close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => { hide(); });
    // DUEL1: the challenge beside Close - the host's word on whether one can go now (v.duel), its reason under a
    // disabled one; the press is the host's (`onDuel`), which re-asks the duel law before anything is sent.
    // LEGACY7 part three: and the proposal beside it, the same shape (v.wed, `onWed`)
    const duelOn = !!(v.duel && onDuel), wedOn = !!(v.wed && onWed);
    if (duelOn || wedOn) {
      const actions = el('div', 'dfprofile-actions');
      if (duelOn) {
        const duel = el('button', 'dfprofile-duel', v.duel.label);
        duel.type = 'button';
        if (!v.duel.enabled) duel.disabled = true;
        duel.addEventListener('click', () => { if (v.duel.enabled && shownPeer) onDuel(shownPeer); });
        actions.append(duel);
      }
      if (wedOn) {
        const wed = el('button', 'dfprofile-wed', v.wed.label);
        wed.type = 'button';
        if (!v.wed.enabled) wed.disabled = true;
        wed.addEventListener('click', () => { if (v.wed.enabled && shownPeer) onWed(shownPeer); });
        actions.append(wed);
      }
      actions.append(close);
      card.append(actions);
      if (duelOn && v.duel.why) card.append(el('div', 'dfprofile-why', v.duel.why));
      if (wedOn && v.wed.why) card.append(el('div', 'dfprofile-why', v.wed.why));
    } else card.append(close);
  };

  const hide = () => {
    if (!alive || !open) return false;
    open = false;
    shownPeer = null;
    root.dataset.state = 'closed';
    onClose?.();   // the host takes the pointer back - inside the gesture that closed
    return true;
  };

  /** Stand the card for one peer. False when the host will not have a surface now, or there is no peer. */
  const show = (peerId, view) => {
    if (!alive || !peerId || !view || !canOpen()) return false;
    paint(view);
    shownPeer = peerId;
    const was = open;
    open = true;
    root.dataset.state = 'open';
    card.focus?.();
    if (!was) onOpen?.();   // the pointer freed on the OPEN alone - a second peer's card over the first asks for nothing twice
    return true;
  };

  /** Redraw the card standing for `peerId` - their answer landed, or their wait ran out. A card for anyone else is not
   *  this one's: an answer that arrives after the player moved on to another peer draws nothing. */
  const update = (peerId, view) => {
    if (!alive || !open || !peerId || peerId !== shownPeer || !view) return false;
    paint(view);
    return true;
  };

  const onKey = (e) => {
    if (!open) return;
    if (isTextEntryTarget(e.target)) return;
    if (e.code !== 'Escape') return;
    if (above()) return;   // a surface over this one owns the key - untouched, unstopped
    e.preventDefault();
    e.stopImmediatePropagation();
    hide();
  };
  win.addEventListener('keydown', onKey, true);
  // a PRESS inside the card is the card's - never a swing or a look; a RELEASE is never stopped (AUDIT CHAT C5)
  const swallow = (e) => e.stopPropagation();
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) card.addEventListener(t, swallow);

  return {
    root,
    show, update, hide,
    isOpen: () => open,
    /** Which peer the card stands for. */
    peerId: () => shownPeer,
    /** THE HOST'S FRAME: a window over the HUD or a pause takes the card away with it, as it takes the F-menu. */
    render({ covered = false } = {}) {
      if (!alive) return;
      if (covered && open) hide();
    },
    destroy() {
      if (!alive) return;
      alive = false;
      open = false;
      win.removeEventListener('keydown', onKey, true);
      root.remove?.();
    },
  };
}
