import { createInitialState, normalizeState } from './state.js';
export const STORAGE_KEY = 'guarantee-escape:v1';

export function loadState(storage, settings = {}) {
  try { return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY)), settings); }
  catch { return createInitialState(settings); }
}

export function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
