// @ts-check
// KG6 (2026-10-15, bible/11-Multiplayer/Kings-Gambit.md section 19): THE RATED KING'S GAMBIT RESULTS THIS DEVICE CARRIES
// TO THE ACCOUNT SERVICE - Iliac Hand's carrier (net/iliac/iliacClaims.js) for the game's own signature (net/gambit/gambitReceipt.js
// g1) and its own store: a receipt kept, offered to `/v1/gambit/claim` (server-account/src/gambit.js claimGambit) at
// once and again while kept, let go once the service settles it.
//
// Not a DFU member: Daggerfall Unity has no such game - the mod does. Ledger A row (THE KING'S GAMBIT).
import { createIliacClaims } from '../iliac/iliacClaims.js';
import { readGambitReceipt } from './gambitReceipt.js';

/** The device's King's Gambit results not yet settled. */
export const GAMBIT_CLAIMS_KEY = 'kg6.gambitClaims';

/** The carrier, its deps Iliac Hand's (`claim` net/accountClient.js accountGambit's). @param {any} deps */
export const createGambitClaims = (deps) => createIliacClaims({ ...deps, read: readGambitReceipt, key: GAMBIT_CLAIMS_KEY });
