import { atom } from 'nanostores';

export type Theme = 'dark' | 'light';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return false;
}

export const DEFAULT_THEME = 'light';

// Always initialize with light theme
export const themeStore = atom<Theme>('light');

export function toggleTheme() {
  // Force light theme
  themeStore.set('light');
  localStorage.setItem(kTheme, 'light');
  document.querySelector('html')?.setAttribute('data-theme', 'light');
}
