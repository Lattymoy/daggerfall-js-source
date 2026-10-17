// the HUD's voice indicator - a null object cost (a few DOM nodes) only paid when voice is actually on.

/** @param {{ doc?: Document }} o injectable document for tests, mirrors chatPanel.js's own convention */
export function buildVoiceHud({ doc = document } = {}) {
  const root = doc.createElement('div');
  root.className = 'voice-hud';
  root.setAttribute('data-voice-status', 'off');
  root.innerHTML = `
    <div class="voice-indicator">
      <div class="voice-icon"></div>
      <div class="voice-label"></div>
    </div>
  `;
  const label = root.querySelector('.voice-label');
  let lastStatus = null;
  let lastSpeaking = null;

  /** No module-level state singleton exists - the caller passes the live VoiceClient.state each frame. */
  function update(state) {
    if (!state) return;
    const status = state.status;
    const speaking = state.transmitting;
    if (status !== lastStatus) {
      root.setAttribute('data-voice-status', status);
      label.textContent = status === 'open' ? (speaking ? '🎤' : '🔇') : status.charAt(0).toUpperCase() + status.slice(1);
      lastStatus = status;
    }
    if (speaking !== lastSpeaking) {
      root.classList.toggle('voice-speaking', speaking);
      lastSpeaking = speaking;
    }
  }

  return { root, update };
}

export const voiceHudStyles = `
.voice-hud {
  position: absolute;
  top: 8px;
  right: 8px;
  font-family: 'Pixelify Sans', monospace;
  font-size: 12px;
  color: #ccc;
  pointer-events: none;
}
.voice-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #666;
}
.voice-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
}
.voice-hud[data-voice-status="open"] .voice-icon {
  background: #0f0;
  box-shadow: 0 0 4px #0f0;
}
.voice-hud[data-voice-status="connecting"] .voice-icon {
  background: #ff0;
  animation: pulse 1s infinite;
}
.voice-hud[data-voice-status="error"] .voice-icon {
  background: #f00;
}
.voice-hud.voice-speaking .voice-icon {
  box-shadow: 0 0 8px currentColor;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;
