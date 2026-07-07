// Inventory, spellbook, death (UI arc, U4). Three overlay-seam
// windows in classic text (backgrounds FLAGGED pending art-name
// verification, as U2/U3):
//   Inventory (classic F6): the player's items with stack counts and
//   CalculateWeightForMaterial weights + the total; Enter on a
//   Weapons-group item EQUIPS it (retires ?weapon - loot a bow, use
//   it). Drop/use pend their slices.
//   Spellbook (DFU default Backspace): the player's KNOWN spells;
//   Enter readies one (retires ?spell). INTERIM loud: with no
//   starting-spells data yet, an empty book lists the file's ranged
//   damage spells as known - the classic starting-spell sets replace
//   this when their data lands.
//   Death: health 0 opens it through the ONE hurtPlayer door; Enter
//   restarts (reload - save/load pends Systems).

import { drawText, measureText } from './text.js';
import { itemWeight, totalWeight } from '../systems/inventory.js';
import { isDamageHealthEffect } from '../systems/spellcast.js';

const panel = (renderer, canvas) =>
  renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.04, 0.03, 0.02, 0.92]);
const GOLD = [0.85, 0.72, 0.35, 1], WHITE = [0.9, 0.9, 0.85, 1], HOT = [1, 0.95, 0.6, 1], DIM = [0.5, 0.5, 0.45, 1];

export class InventoryWindow {
  /** equip(item) comes from the scene (swaps the readied weapon). */
  constructor(entity, { equip = null } = {}) {
    this.entity = entity;
    this.equip = equip;
    this.cursor = 0;
    this.done = false;
  }
  input(action) {
    const items = this.entity.items ?? [];
    if (action === 'up' && items.length) this.cursor = (this.cursor + items.length - 1) % items.length;
    else if (action === 'down' && items.length) this.cursor = (this.cursor + 1) % items.length;
    else if (action === 'confirm') {
      const it = items[this.cursor];
      if (it && it.group === 'Weapons' && it.name !== 'Arrow' && this.equip) { this.equip(it); this.done = true; }
    } else if (action === 'back' || action === 'inventory') this.done = true;
  }
  draw(renderer, canvas, font, s) {
    panel(renderer, canvas);
    const items = this.entity.items ?? [];
    const t = `INVENTORY  ${totalWeight(items).toFixed(2)} kg`;
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, 16 * s, s, GOLD);
    if (!items.length) drawText(renderer, font, '(empty)', 30 * s, 40 * s, s, DIM);
    items.forEach((it, i) => {
      const n = `${i === this.cursor ? '> ' : '  '}${it.name ?? it.group}${(it.stackCount ?? 1) > 1 ? ' x' + it.stackCount : ''}  ${itemWeight(it).toFixed(2)}kg${it.magic ? ' *' : ''}`;
      drawText(renderer, font, n, 20 * s, (36 + i * 10) * s, s, i === this.cursor ? HOT : WHITE);
    });
    drawText(renderer, font, 'ENTER equip weapon   ESC close', 20 * s, canvas.height - 20 * s, s, DIM);
  }
}

export class SpellbookWindow {
  /** spells: [{ index, name, cost, ... }]; ready(spell) from the scene. */
  constructor(spells, entity, { ready = null } = {}) {
    this.spells = spells;
    this.entity = entity;
    this.ready = ready;
    this.cursor = 0;
    this.done = false;
  }
  input(action) {
    if (action === 'up' && this.spells.length) this.cursor = (this.cursor + this.spells.length - 1) % this.spells.length;
    else if (action === 'down' && this.spells.length) this.cursor = (this.cursor + 1) % this.spells.length;
    else if (action === 'confirm') {
      const sp = this.spells[this.cursor];
      if (sp && this.ready) { this.ready(sp); this.done = true; }
    } else if (action === 'back' || action === 'spellbook') this.done = true;
  }
  draw(renderer, canvas, font, s) {
    panel(renderer, canvas);
    const t = `SPELLBOOK  MP ${this.entity.magicka}/${this.entity.maxMagicka}`;
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, 16 * s, s, GOLD);
    if (!this.spells.length) drawText(renderer, font, '(no spells known)', 30 * s, 40 * s, s, DIM);
    this.spells.forEach((sp, i) => drawText(renderer, font,
      `${i === this.cursor ? '> ' : '  '}${sp.name}  (${sp.cost})`,
      20 * s, (36 + i * 10) * s, s, i === this.cursor ? HOT : WHITE));
    drawText(renderer, font, 'ENTER ready   ESC close', 20 * s, canvas.height - 20 * s, s, DIM);
  }
}

/** The known list: entity.spells when it exists; the INTERIM fallback
 *  is the file's ranged damage spells (loud - starting-spell data
 *  replaces it). */
export function knownSpells(entity, spellsByIndex) {
  if (entity.spells?.length) return entity.spells;
  if (!spellsByIndex) return [];
  const out = [];
  for (const sp of spellsByIndex.values()) {
    if ((sp.rangeType === 2 || sp.rangeType === 4) && sp.effects.some(isDamageHealthEffect)) out.push(sp);
  }
  return out;
}

export class DeathScreen {
  constructor() { this.done = false; }
  input(action) {
    if (action === 'confirm' && typeof location !== 'undefined') location.reload();   // save/load pends Systems
  }
  draw(renderer, canvas, font, s) {
    renderer.drawScreenQuad(null, { x: 0, y: 0, w: canvas.width, h: canvas.height }, undefined, [0.15, 0.01, 0.01, 0.94]);
    const t = 'YOU HAVE DIED';
    drawText(renderer, font, t, (canvas.width - measureText(font.fnt, t) * s) / 2, canvas.height / 2 - 10 * s, s, [0.9, 0.2, 0.15, 1]);
    drawText(renderer, font, 'ENTER to rise again', (canvas.width - measureText(font.fnt, 'ENTER to rise again') * s) / 2, canvas.height / 2 + 6 * s, s, DIM);
  }
}
