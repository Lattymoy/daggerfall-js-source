import { isOnlinePage } from './online/onlineLane.js';
import { getPref } from './uiPrefs.js';
import { FORK_FLAGS } from '../config/forkFlags.js';

/** Whether unified banking across all regions is currently active (online or offline setting). */
export const isUnifiedBankActive = () =>
  isOnlinePage() || (!!FORK_FLAGS.ENABLE_UNIFIED_BANK && getPref('unifiedBank') === true);
