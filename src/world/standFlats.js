// @ts-check
// STAND-FLAT / STAND-HORSE (2026-10-12, bible/04-Characters/Morrowind-NPCs.md section 28): THE FLATS THAT STAND FOR A
// BODY - a town horse (TEXTURE.201's horse records) and a person's flat no StaticNPC holds (a person archive's flat with
// no faction, RMBLayout's scenery: a World of Daggerfall site's people, a block's factionless figure). Each is drawn in a
// batch of its own so a 3D horse (world/standingHorses.js) or a Morrowind body (the street's 'people' lane, read as a
// placed figure is - characters/peopleBodies.js figureLook) can take its place, its billboard drawing nothing while one
// does. THE ONE CONSTRUCTION SEAM: both exterior hosts (scenes/world.js's streamed pixels, scenes/exterior.js's one
// location) mint the record here.
import { isNpcFlat } from './npcFlatArchives.js';
import { isStandingHorseFlat, standingHorseYaw, standingHorseSeed } from './standingHorses.js';
import { strangerHorseLook } from '../systems/horse/horseCoats.js';

/** Does this flat stand for a body - a town horse, or a person's flat (one a StaticNPC holds is the NPC pass's, never
 *  asked here)? */
export const isStandFlat = (archive, record) => isStandingHorseFlat(archive, record) || isNpcFlat(archive);

/** A stand flat's identity - its host's place and its own, to the centimetre - the seed of its heading, its look and
 *  its person. */
export const standFlatId = (place, x, z) => `flat:${place}:${Math.round(x * 100)},${Math.round(z * 100)}`;

/**
 * The record a host keeps for a stand flat it has batched: a horse's heading, idle seed and look (the road's strangers'
 * law, off its id - systems/horse/horseCoats.js strangerHorseLook), or a person's piece (`{ id, flat }` - the BORN flat, their
 * identity, whatever picture NUDE-FLATS drew). `x, y, z` its billboard's base in the host's frame.
 * @param {{ archive: number, record: number, x: number, y: number, z: number }} sf @param {any} batch @param {string} id
 */
export function standFlatRecord(sf, batch, id) {
  if (isStandingHorseFlat(sf.archive, sf.record)) {
    return { kind: 'horse', x: sf.x, y: sf.y, z: sf.z, batch, yaw: standingHorseYaw(id), seed: standingHorseSeed(id), look: strangerHorseLook(id), feet: [sf.x, sf.y, sf.z] };
  }
  return { kind: 'person', x: sf.x, y: sf.y, z: sf.z, batch, piece: { id, flat: [sf.archive, sf.record] }, _mwFeet: null };
}
