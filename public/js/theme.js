/* Theme management
 *
 * Built-in light/dark switcher plus exactly one persistent editable custom palette
 * (stored under the id 'custom'). The topbar owns the controls: a sun/moon button that
 * flips between light and dark, and a theme button beside it that opens the light /
 * dark / custom menu (the custom palette itself is edited from colours pickers there).
 * Everything here is stored in localStorage, so the choice is per browser.
 */

/* ---------- storage helpers ---------- */
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

/* ---------- theme keys ---------- */
const THEME_KEY = 'em-theme';

/* ---------- built-in themes ---------- */
const THEMES = {
  light: {
    name: 'Light',
    vars: {
      '--bg': '#f3f5f9',
      '--card': '#ffffff',
      '--border': '#e2e8f0',
      '--text': '#0f172a',
      '--muted': '#64748b',
      '--accent': '#3b82f6',
      '--accent-dark': '#2563eb',
      '--accent-soft': '#eff4ff',
      '--green': '#16a34a',
      '--green-soft': '#ecfdf3',
      '--amber': '#d97706',
      '--amber-soft': '#fffbeb',
      '--red': '#dc2626',
      '--red-soft': '#fef2f2',
      '--purple': '#7c3aed',
      '--purple-soft': '#f5f3ff',
      '--teal': '#0d9488',
      '--teal-soft': '#f0fdfa',
      '--shadow': '0 1px 2px rgba(31, 36, 48, .05), 0 4px 16px rgba(31, 36, 48, .06)',
      '--shadow-lg': '0 8px 30px rgba(31, 36, 48, .12)',
      '--bg-soft': '#f8fafc',
      '--panel': '#ffffff',
      '--input-bg': '#fbfcfe',
      '--input-border': '#e2e8f0',
    },
  },
  dark: {
    name: 'Dark',
    vars: {
      '--bg': '#0f172a',
      '--card': '#1e293b',
      '--border': '#334155',
      '--text': '#f1f5f9',
      '--muted': '#94a3b8',
      '--accent': '#60a5fa',
      '--accent-dark': '#3b82f6',
      '--accent-soft': '#1e293b',
      '--green': '#4ade80',
      '--green-soft': '#0f2f1d',
      '--amber': '#fbbf24',
      '--amber-soft': '#2a1f05',
      '--red': '#f87171',
      '--red-soft': '#2a1013',
      '--purple': '#a78bfa',
      '--purple-soft': '#1f1436',
      '--teal': '#5eead4',
      '--teal-soft': '#0f2a27',
      '--shadow': '0 1px 2px rgba(0, 0, 0, .3), 0 4px 16px rgba(0, 0, 0, .4)',
      '--shadow-lg': '0 8px 30px rgba(0, 0, 0, .55)',
      '--bg-soft': '#121622',
      '--panel': '#131822',
      '--input-bg': '#0d1119',
      '--input-border': '#334155',
    },
  },
};

/* ---------- persistent custom palette ---------- */
const CUSTOM_THEME_ID = 'custom';
const CUSTOM_VARS_KEY = 'em-theme-custom';
const USER_THEMES = {};

// Variables the palette editor exposes as colour pickers. Everything else
// (shadows, radii) is derived or scalar and cannot round-trip through
// <input type="color">.
const COLOR_VARS = [
  '--bg', '--card', '--border', '--text', '--muted',
  '--accent', '--accent-dark', '--accent-soft',
  '--green', '--green-soft', '--amber', '--amber-soft',
  '--red', '--red-soft', '--purple', '--purple-soft',
  '--teal', '--teal-soft', '--bg-soft', '--panel',
  '--input-bg', '--input-border',
];

function loadCustomVars() {
  const raw = storageGet(CUSTOM_VARS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* corrupt payload: fall back to the defaults */ }
  return null;
}

function ensureCustomTheme() {
  if (!USER_THEMES[CUSTOM_THEME_ID]) {
    USER_THEMES[CUSTOM_THEME_ID] = {
      name: 'Custom',
      vars: Object.assign({}, THEMES.dark.vars, loadCustomVars() || {}),
    };
  }
  return USER_THEMES[CUSTOM_THEME_ID];
}

// Persist the current custom palette so it survives a reload.
function saveCustomTheme() {
  storageSet(CUSTOM_VARS_KEY, JSON.stringify(ensureCustomTheme().vars));
}

function resetCustomTheme() {
  const vars = Object.assign({}, THEMES.dark.vars);
  USER_THEMES[CUSTOM_THEME_ID] = { name: 'Custom', vars };
  saveCustomTheme();
  saveTheme(CUSTOM_THEME_ID);
  return vars;
}

function colorThemeVars() {
  return COLOR_VARS.slice();
}

/* ---------- public API ---------- */
function currentTheme() {
  const themeId = storageGet(THEME_KEY);
  if (themeId === 'dark') return THEMES.dark;
  if (themeId === 'light') return THEMES.light;
  if (themeId === CUSTOM_THEME_ID) return ensureCustomTheme();
  if (themeId && USER_THEMES[themeId]) return USER_THEMES[themeId];
  return THEMES.light;
}

function saveTheme(themeId) {
  storageSet(THEME_KEY, themeId);
  applyTheme(themeId);
}

/* The saved theme id, normalised to one of 'light' | 'dark' | 'custom'. */
function themeMode() {
  const id = storageGet(THEME_KEY);
  if (id === 'dark' || id === CUSTOM_THEME_ID) return id;
  return 'light';
}

/* Quick light <-> dark flip behind the topbar sun/moon button. */
function toggleLightDark() {
  const next = themeMode() === 'light' ? 'dark' : 'light';
  saveTheme(next);
  return next;
}

function applyTheme(themeId) {
  let theme;
  if (themeId === 'dark') theme = THEMES.dark;
  else if (themeId === 'light') theme = THEMES.light;
  else if (themeId === CUSTOM_THEME_ID) theme = ensureCustomTheme();
  else if (USER_THEMES[themeId]) theme = USER_THEMES[themeId];
  else theme = THEMES.light;

  const root = document.documentElement;
  if (!root) return;
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
  root.setAttribute('data-theme', themeId === 'dark' ? 'dark' : themeId === 'light' ? 'light' : 'custom');
}

function customTheme() {
  return ensureCustomTheme();
}

function customThemeVars() {
  return customTheme().vars;
}

function restoreCustomFromCurrentVars() {
  const vars = {};
  for (const [k, v] of Object.entries(THEMES.dark.vars)) {
    vars[k] = getComputedStyle(document.documentElement).getPropertyValue(k).trim() || v;
  }
  USER_THEMES[CUSTOM_THEME_ID] = { name: 'Custom', vars };
  saveCustomTheme();
  return CUSTOM_THEME_ID;
}
