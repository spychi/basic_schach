// Persistence via localStorage. Every access is guarded; failures are silent.
const PREFIX = 'bauhaus-schach:';
const KEY_GAME = PREFIX + 'game';
const KEY_SETTINGS = PREFIX + 'settings';

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) { /* ignore */ }
}

export function saveGame(json) { return write(KEY_GAME, json); }
export function loadGame() { return read(KEY_GAME); }
export function clearGame() { remove(KEY_GAME); }

/** Settings are one object; saveSettings merges into the stored object. */
export function saveSettings(obj) {
  const current = read(KEY_SETTINGS);
  const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  return write(KEY_SETTINGS, { ...base, ...obj });
}
export function loadSettings() {
  const s = read(KEY_SETTINGS);
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}
