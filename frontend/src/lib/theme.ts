export type ThemeMode = 'default' | 'dark' | 'light';

const THEME_STORAGE_KEY = 'helpdesk_theme_mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'default' || value === 'dark' || value === 'light';
}

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(value) ? value : null;
}

export function getSystemPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'default';
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'default';
}

export function resolveInitialTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemPreferredTheme() ?? 'default';
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function clearTheme() {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute('data-theme');
}

export function setTheme(theme: ThemeMode) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  applyTheme(theme);
}

export function initTheme(): ThemeMode {
  const theme = resolveInitialTheme();
  applyTheme(theme);
  return theme;
}

export const themeStorageKey = THEME_STORAGE_KEY;
