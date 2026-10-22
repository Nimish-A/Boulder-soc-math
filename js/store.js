// Local overrides live in localStorage. Every access is guarded: in a private
// window or with storage blocked the site just uses the defaults.
import { DEFAULT_DATA } from "./data.js";

const DATA_KEY = "bsoc-data-v1";
const PREFS_KEY = "bsoc-calc-v1";

const clone = (o) => JSON.parse(JSON.stringify(o));

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function isValidData(d) {
  return !!d && Array.isArray(d.gyms) && !!d.membership && !!d.settings;
}

export function loadData() {
  const saved = read(DATA_KEY);
  return isValidData(saved) ? saved : clone(DEFAULT_DATA);
}

export const saveData = (data) => write(DATA_KEY, data);

export function resetData() {
  try {
    localStorage.removeItem(DATA_KEY);
  } catch {}
}

export const hasLocalData = () => isValidData(read(DATA_KEY));

// True when the user has local data from an older set of default prices.
export function defaultsNewer() {
  const saved = read(DATA_KEY);
  return isValidData(saved) && saved.updated < DEFAULT_DATA.updated;
}

export const loadPrefs = () => read(PREFS_KEY);
export const savePrefs = (prefs) => write(PREFS_KEY, prefs);

export const defaultData = () => clone(DEFAULT_DATA);
