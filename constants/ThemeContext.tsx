import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors as darkColors } from './theme';

const STORAGE_KEY = 'settings_theme_mode';

export type ThemeMode = 'dark' | 'light';

export const lightColors = {
  // Backgrounds — softer ivory
  bg: '#f6efe2',
  bg2: '#efe6d2',
  bg3: '#e8dcc0',
  canvas: '#faf4e8',
  card: '#fefaf0',
  card2: '#f4ecd8',
  elevated: '#fffcf3',
  border: '#e8dcc0',
  border2: '#d6c498',
  ink: '#2b1d0c',

  // Text
  text: '#3d2a12',
  text2: '#6b5131',
  text3: '#9a7d52',
  textDim: '#c2a472',

  // Accent — rich burnt sienna / cognac
  accent: '#a64d1e',
  accentDk: '#7f3712',
  accentLt: '#c66a36',
  accentDim: 'rgba(166, 77, 30, 0.14)',
  accentBg: 'rgba(166, 77, 30, 0.10)',
  accentBorder: 'rgba(166, 77, 30, 0.32)',

  // Semantic
  warn: '#8e5f14',
  info: '#a64d1e',
  success: '#a64d1e',

  // FAB radial colors
  fab1: '#7f3712',
  fab2: '#c66a36',
  fab3: '#b8892b',
  fab4: '#a64d1e',

  // Chart colors
  chart1: '#a64d1e',
  chart2: '#c66a36',
  chart3: '#b8892b',
  chart4: '#7f3712',
  chart5: '#d08a5a',

  // Inverse surface
  black: '#2a1d0d',
  onBlack: '#f9f1de',

  // Utility
  gold: '#b8892b',
  coral: '#c66a36',
  danger: '#9c3a2d',
  warnBg: 'rgba(184, 137, 43, 0.16)',
  warnBorder: 'rgba(184, 137, 43, 0.32)',
  warnInk: '#7a5a18',

  // Legacy aliases
  green: '#a64d1e',
  green2: '#c66a36',
  blue: '#7f3712',
  amber: '#8e5f14',
  red: '#9c3a2d',
  purple: '#a64d1e',
  pink: '#c66a36',
  white: '#ffffff',
} as const;

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof darkColors | typeof lightColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setModeState(stored);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = useMemo(() => mode === 'dark' ? darkColors : lightColors, [mode]);

  const value = useMemo(() => ({ mode, colors, setMode, toggle }), [mode, colors, setMode, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
