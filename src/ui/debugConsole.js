// @ts-check
// In-game debug console UI and input interceptor.
// Provides a minimalist semi-transparent terminal at the top of the screen
// triggered by the `~` (Backquote) key. When open, all keyboard and mouse
// inputs are captured to prevent leaking into character controls.

import { executeConsoleLine, onConsoleLog, consoleInputHistory } from '../systems/consoleCommands.js';
import { releaseLook, setCursorActive } from '../player/pointerLock.js';
import { registerOverlay } from './enhanced/enhancedOverlays.js';

let _installed = false;
let _isOpen = false;
let _container = null;
let _inputEl = null;
let _logEl = null;
let _unregisterOverlay = null;

export function isDebugConsoleOpen() {
  return _isOpen;
}

function ensureDom() {
  if (_container || typeof document === 'undefined') return;

  _container = document.createElement('div');
  _container.id = 'df-debug-console';
  _container.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'width: 100%',
    'height: 36vh',
    'min-height: 190px',
    'max-height: 50vh',
    'background: rgba(10, 14, 22, 0.88)',
    'backdrop-filter: blur(4px)',
    '-webkit-backdrop-filter: blur(4px)',
    'border-bottom: 2px solid rgba(110, 160, 230, 0.5)',
    'box-shadow: 0 8px 30px rgba(0, 0, 0, 0.75)',
    'color: #d8e4f0',
    "font-family: 'Consolas', 'DejaVu Sans Mono', 'Courier New', monospace",
    'font-size: 13px',
    'line-height: 1.4',
    'z-index: 2147483647',
    'display: none',
    'flex-direction: column',
    'box-sizing: border-box',
    'pointer-events: auto',
    'user-select: text',
  ].join(';');

  // Header bar
  const header = document.createElement('div');
  header.style.cssText = [
    'height: 24px',
    'padding: 2px 10px',
    'background: rgba(18, 26, 40, 0.9)',
    'border-bottom: 1px solid rgba(100, 150, 210, 0.25)',
    'display: flex',
    'justify-content: space-between',
    'align-items: center',
    'font-size: 11px',
    'text-transform: uppercase',
    'letter-spacing: 1px',
    'color: #63b3ed',
    'user-select: none',
  ].join(';');

  const title = document.createElement('span');
  title.textContent = 'DAGGERFALL FOREVER DEBUG CONSOLE';
  title.style.fontWeight = 'bold';

  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; align-items: center; gap: 12px; color: #a0aec0;';

  const hint = document.createElement('span');
  hint.textContent = "[~] or [Esc] to Close | Type 'help'";
  hint.style.fontSize = '11px';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close Console';
  closeBtn.style.cssText = [
    'background: none',
    'border: none',
    'color: #a0aec0',
    'cursor: pointer',
    'font-size: 13px',
    'line-height: 1',
    'padding: 2px 6px',
    'border-radius: 2px',
  ].join(';');
  closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; closeBtn.style.background = 'rgba(255, 255, 255, 0.1)'; });
  closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#a0aec0'; closeBtn.style.background = 'none'; });
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeDebugConsole();
  });

  controls.appendChild(hint);
  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);
  _container.appendChild(header);

  // Output log container
  _logEl = document.createElement('div');
  _logEl.id = 'df-debug-log';
  _logEl.style.cssText = [
    'flex: 1',
    'overflow-y: auto',
    'padding: 8px 12px',
    'display: flex',
    'flex-direction: column',
    'gap: 2px',
    'word-break: break-all',
    'white-space: pre-wrap',
    'font-size: 12px',
  ].join(';');

  // Welcome note
  const initLine = document.createElement('div');
  initLine.style.color = '#718096';
  initLine.textContent = "Debug Console ready. Type 'help' for available commands.";
  _logEl.appendChild(initLine);

  _container.appendChild(_logEl);

  // Input row
  const inputRow = document.createElement('div');
  inputRow.style.cssText = [
    'height: 32px',
    'padding: 4px 12px',
    'background: rgba(14, 20, 32, 0.95)',
    'border-top: 1px solid rgba(100, 150, 210, 0.25)',
    'display: flex',
    'align-items: center',
    'gap: 8px',
  ].join(';');

  const promptSpan = document.createElement('span');
  promptSpan.textContent = '>';
  promptSpan.style.cssText = 'color: #48bb78; font-weight: bold; font-size: 14px; user-select: none;';

  _inputEl = document.createElement('input');
  _inputEl.type = 'text';
  _inputEl.id = 'df-debug-input';
  _inputEl.spellcheck = false;
  _inputEl.autocomplete = 'off';
  _inputEl.style.cssText = [
    'flex: 1',
    'background: transparent',
    'border: none',
    'outline: none',
    'color: #ffffff',
    'font-family: inherit',
    'font-size: 13px',
    'caret-color: #48bb78',
  ].join(';');

  _inputEl.addEventListener('keydown', (e) => {
    // When inside input:
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = _inputEl.value.trim();
      if (val) {
        executeConsoleLine(val);
        _inputEl.value = '';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = consoleInputHistory.navigate(true);
      if (typeof prev === 'string') _inputEl.value = prev;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = consoleInputHistory.navigate(false);
      if (typeof next === 'string') _inputEl.value = next;
    }
  });

  inputRow.appendChild(promptSpan);
  inputRow.appendChild(_inputEl);
  _container.appendChild(inputRow);

  // Clicking anywhere inside the terminal focuses the input
  _container.addEventListener('click', (e) => {
    if (e.target !== closeBtn && window.getSelection()?.toString() === '') {
      _inputEl.focus();
    }
  });

  document.body.appendChild(_container);

  // Subscribe to console logs to display in terminal
  onConsoleLog((line) => {
    if (!_logEl) return;
    const lineEl = document.createElement('div');
    lineEl.className = 'df-console-line';
    const str = String(line ?? '');
    if (str.startsWith('> ')) {
      lineEl.style.color = '#a0aec0';
      lineEl.textContent = str;
    } else if (str.startsWith('Error:') || str.includes('not found') || str.startsWith('Usage:')) {
      lineEl.style.color = '#fc8181';
      lineEl.textContent = str;
    } else if (str.includes('<b>')) {
      // Escape HTML and replace <b> tags with styled span
      lineEl.innerHTML = str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;b&gt;/g, '<b style="color: #63b3ed;">')
        .replace(/&lt;\/b&gt;/g, '</b>');
    } else {
      lineEl.textContent = str;
    }
    _logEl.appendChild(lineEl);
    _logEl.scrollTop = _logEl.scrollHeight;
  });
}

export function openDebugConsole() {
  if (_isOpen) return;
  ensureDom();
  if (!_container || !_inputEl) return;

  _isOpen = true;
  _container.style.display = 'flex';

  // Release look and allow normal cursor movement
  releaseLook();
  setCursorActive(true);

  // Register with enhanced overlay stack so other overlays cooperate
  _unregisterOverlay = registerOverlay(closeDebugConsole);

  // Release any keys held in gameplay
  if (typeof window !== 'undefined' && typeof window.Event === 'function') {
    window.dispatchEvent(new window.Event('blur'));
  }

  setTimeout(() => {
    _inputEl?.focus();
    _inputEl?.select();
  }, 0);
}

export function closeDebugConsole() {
  if (!_isOpen) return;
  _isOpen = false;
  if (_container) _container.style.display = 'none';

  if (_unregisterOverlay) {
    try { _unregisterOverlay(); } catch { /* ignore */ }
    _unregisterOverlay = null;
  }

  setCursorActive(false);
  _inputEl?.blur();
}

export function toggleDebugConsole() {
  if (_isOpen) closeDebugConsole();
  else openDebugConsole();
}

/**
 * Intercepts `~` (Backquote) in capture phase and isolates input when open.
 */
export function installDebugConsole() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  // Intercept `~` (Backquote) on keydown in capture phase
  window.addEventListener('keydown', (e) => {
    const isBackquote = e.code === 'Backquote' || (!e.code && (e.key === '`' || e.key === '~'));
    if (isBackquote) {
      e.preventDefault();
      e.stopPropagation();
      toggleDebugConsole();
      return;
    }

    if (_isOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeDebugConsole();
        return;
      }
      // While console is open, do not let gameplay keys propagate into scene/character controls
      e.stopPropagation();
    }
  }, true);

  // Stop keyup propagation while open
  window.addEventListener('keyup', (e) => {
    const isBackquote = e.code === 'Backquote' || (!e.code && (e.key === '`' || e.key === '~'));
    if (isBackquote) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (_isOpen) {
      e.stopPropagation();
    }
  }, true);

  // Block mouse/pointer events from leaking into the game world while console is open
  const stopWorldPointer = (e) => {
    if (!_isOpen) return;
    if (_container && _container.contains(e.target)) return; // Allow interaction within terminal
    e.preventDefault();
    e.stopPropagation();
  };

  window.addEventListener('pointerdown', stopWorldPointer, true);
  window.addEventListener('mousedown', stopWorldPointer, true);
  window.addEventListener('click', stopWorldPointer, true);
}
