// the voice settings panel - opt-in, push-to-talk, volume; mounts in the enhanced menu's Voice category.

import { getVoiceNet } from '../net/voiceNet.js';
import { saveVoiceSetting } from '../voice/voiceSettings.js';

/**
 * @param {{ doc?: Document }} o injectable document for tests, mirrors chatPanel.js's own convention
 * @returns {HTMLElement[]} the panel's rows
 */
export function voiceSettingsRows({ doc = document } = {}) {
  const voiceNet = getVoiceNet();
  if (!voiceNet) return [];

  const rows = [];
  const state = voiceNet.state;

  // Opt-in toggle
  const enableRow = doc.createElement('div');
  enableRow.className = 'voice-setting-row';
  enableRow.innerHTML = `
    <label>Voice Chat</label>
    <input type="checkbox" class="voice-enable" ${state.enabled ? 'checked' : ''}>
  `;
  enableRow.querySelector('.voice-enable').addEventListener('change', (e) => {
    state.setEnabled(e.target.checked);
    saveVoiceSetting('enabled', e.target.checked);
  });
  rows.push(enableRow);

  // Push-to-talk toggle
  const pttRow = doc.createElement('div');
  pttRow.className = 'voice-setting-row';
  pttRow.innerHTML = `
    <label>Push-to-Talk</label>
    <input type="checkbox" class="voice-ptt" ${state.pushToTalk ? 'checked' : ''}>
  `;
  pttRow.querySelector('.voice-ptt').addEventListener('change', (e) => {
    state.setPushToTalk(e.target.checked);
    saveVoiceSetting('pushToTalk', e.target.checked);
  });
  rows.push(pttRow);

  // Volume slider
  const volRow = doc.createElement('div');
  volRow.className = 'voice-setting-row';
  volRow.innerHTML = `
    <label>Volume</label>
    <input type="range" class="voice-volume" min="0" max="100" value="${Math.round(voiceNet.volume * 100)}">
  `;
  volRow.querySelector('.voice-volume').addEventListener('input', (e) => {
    voiceNet.setVolume(Number(e.target.value) / 100);
    saveVoiceSetting('volume', voiceNet.volume);
  });
  rows.push(volRow);

  // Status display
  const statusRow = doc.createElement('div');
  statusRow.className = 'voice-setting-row voice-status';
  statusRow.innerHTML = `<label>Status:</label><span class="voice-status-text">${state.status}</span>`;
  // onChange is a single slot (voiceState.js) - chain rather than clobber any handler the host already set.
  const priorOnChange = state.onChange;
  state.onChange = (kind) => {
    priorOnChange?.(kind);
    statusRow.querySelector('.voice-status-text').textContent = state.status;
  };
  rows.push(statusRow);

  return rows;
}

export const voiceSettingsStyles = `
.voice-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
  font-family: 'Pixelify Sans', monospace;
  font-size: 12px;
}
.voice-setting-row label {
  color: #ccc;
  flex: 1;
}
.voice-setting-row input[type="checkbox"],
.voice-setting-row input[type="range"] {
  flex: 0 0 auto;
  margin-left: 12px;
}
.voice-status-text {
  color: #0f0;
  text-transform: capitalize;
}
.voice-status-text[data-status="error"],
.voice-status-text[data-status="denied"] {
  color: #f00;
}
.voice-status-text[data-status="connecting"],
.voice-status-text[data-status="reconnecting"] {
  color: #ff0;
}
`;
