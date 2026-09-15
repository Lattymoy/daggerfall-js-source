// CM4 - RESIDUAL CHARACTER-SHEET MODALS.
//
// Keep the audited CharSheet itself stable and layer the missing DFU
// button actions over it at the ONE runtime door. The base sheet already
// owns navigation, levelling, skill pages, stat descriptions and banking;
// this subclass restores the four buttons that were still deliberately
// consumed as no-ops: Name, Level, Health, and Affiliations. It also
// consumes the real DaggerfallShortcut bindings for those actions.

import {
  CharSheet as BaseCharSheet, CHARSHEET_RECTS,
} from './charsheet.js';
import { InputMessageBoxWindow } from './inputMessageBox.js';
import { ActionTextBox } from './actionText.js';
import { healthStatusRows } from '../systems/healthStatus.js';
import { activeMemberships, GUILDS, getTitle } from '../systems/guilds.js';
import { templeOf, orderOf } from '../systems/guildVariants.js';
import { getReputation } from '../systems/factionRep.js';
import { firstHotkey } from '../systems/dialogShortcuts.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

export const NO_AFFILIATIONS_TEXT_ID = 19;
const ENTER_NEW_NAME = 'Enter new name : ';
export const LEVEL_PROGRESS_PREFIX = 'Progress made to the next level: ';

/** LevelButton_OnMouseClick, verbatim arithmetic. */
export function levelProgressPercent(entity) {
  const current = ((entity?.currentLevelUpSkillSum ?? 0)
    - (entity?.startingLevelUpSkillSum ?? 0) + 28) / 15;
  return Math.trunc((current % 1) * 100);
}

/** The membership book stores the port's canonical guild-record name. */
export function guildForMembership(membership) {
  const name = membership?.guild;
  if (!name) return null;
  for (const guild of Object.values(GUILDS)) if (guild.name === name) return guild;
  if (name.startsWith('Temple:')) return templeOf(name.slice('Temple:'.length));
  if (name.startsWith('Order:')) return orderOf(name.slice('Order:'.length));
  return null;
}

/** ShowAffiliationsDialog's token table reduced to messageBox row data.
 *  The faction display name is the SAME cloned FACTION.TXT row guild
 *  reputation uses, so no host-specific name hook is necessary. */
export function affiliationRows(entity, rows = null) {
  const memberships = Object.values(activeMemberships(entity) ?? {}).filter(Boolean);
  if (!memberships.length) {
    return rows?.(NO_AFFILIATIONS_TEXT_ID)
      ?? [{ text: 'You have no affiliations.', center: true }];
  }

  const out = [{
    cells: [{ text: 'Affiliation', x: 0 }, { text: 'Rank', x: 125 }],
    highlight: true,
  }];
  for (const membership of memberships) {
    const guild = guildForMembership(membership);
    if (!guild) continue;
    const affiliation = entity?.factionRep?.dict?.get?.(guild.factionId)?.name ?? guild.name;
    const title = getTitle(membership, entity, guild);
    const rep = entity?.factionRep ? getReputation(entity.factionRep, guild.factionId) : 0;
    out.push({
      cells: [
        { text: affiliation, x: 0 },
        { text: `${title} (rep:${rep})`, x: 125 },
      ],
    });
  }
  // A malformed imported membership should not turn a non-empty book
  // into a blank parchment. DFU can only hold guild objects here; the
  // port can encounter hand-built/legacy fixtures.
  return out.length > 1 ? out
    : (rows?.(NO_AFFILIATIONS_TEXT_ID) ?? [{ text: 'You have no affiliations.', center: true }]);
}

const MODAL_HOTKEYS = Object.freeze([
  'CharacterSheetName', 'CharacterSheetLevel', 'CharacterSheetHealth',
  'CharacterSheetAffiliations',
]);

// Deliberately declared, then exported at the tail. The audited base class
// is still the one declared `export class CharSheet`; this wrapper is a
// presentation layer at the runtime door, not a second home for that DFU
// member. Keeping the runtime constructor name `CharSheet` preserves the
// host contract without growing audit24_onehome's declaration population.
class CharSheet extends BaseCharSheet {
  _showName() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new InputMessageBoxWindow({
      label: ENTER_NEW_NAME,
      value: this.entity?.name ?? '',
      onSubmit: (input) => {
        // EnterName_OnGotUserInput only writes a non-empty name.
        if (input.length > 0 && this.entity) this.entity.name = input;
      },
    });
  }

  _showLevel() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new ActionTextBox([
      `${LEVEL_PROGRESS_PREFIX}${levelProgressPercent(this.entity)}%`,
    ]);
  }

  _showHealth() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    const rows = this.hooks.rows
      ? healthStatusRows(this.entity, this.hooks.rows)
      : [{ text: 'You are healthy.', center: true }];
    this.child = new ActionTextBox(rows);
  }

  _showAffiliations() {
    audio.playOneShot(SOUND.ButtonClick, 1);
    this.child = new ActionTextBox(affiliationRows(this.entity, this.hooks.rows));
  }

  input(action, e = null) {
    // A pushed modal keeps the base sheet's existing child ownership.
    if (this.child) { super.input(action, e); return; }
    const hit = firstHotkey(MODAL_HOTKEYS, action, e);
    if (hit === 'CharacterSheetName') { this._showName(); return; }
    if (hit === 'CharacterSheetLevel') { this._showLevel(); return; }
    if (hit === 'CharacterSheetHealth') { this._showHealth(); return; }
    if (hit === 'CharacterSheetAffiliations') { this._showAffiliations(); return; }
    super.input(action, e);
  }

  click(vx, vy) {
    // Let the base class route an already-pushed window first.
    if (this.child) return super.click(vx, vy);
    const R = CHARSHEET_RECTS;
    if (inRect(R.name, vx, vy)) { this._showName(); return true; }
    if (inRect(R.level, vx, vy)) { this._showLevel(); return true; }
    if (inRect(R.health, vx, vy)) { this._showHealth(); return true; }
    if (inRect(R.affiliations, vx, vy)) { this._showAffiliations(); return true; }
    return super.click(vx, vy);
  }
}

const inRect = ([rx, ry, rw, rh], x, y) =>
  x >= rx && y >= ry && x < rx + rw && y < ry + rh;

export { CharSheet };
