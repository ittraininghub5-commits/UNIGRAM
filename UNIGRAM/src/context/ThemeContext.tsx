import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';
export type AccentTheme = 'yellow' | 'green' | 'blue' | 'pink';

interface ThemeContextType {
  theme: ThemeMode;
  mode: ThemeMode;
  accent: AccentTheme;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENTS: AccentTheme[] = ['yellow', 'green', 'blue', 'pink'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem('theme-mode');
    if (savedMode === 'light' || savedMode === 'dark') return savedMode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [accent, setAccent] = useState<AccentTheme>(() => {
    const savedAccent = localStorage.getItem('theme-accent');
    return ACCENTS.includes(savedAccent as AccentTheme) ? (savedAccent as AccentTheme) : 'yellow';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(mode);
    root.dataset.theme = mode;
    root.dataset.accent = accent;
    localStorage.setItem('theme-mode', mode);
    localStorage.setItem('theme-accent', accent);
  }, [mode, accent]);

  const value = useMemo<ThemeContextType>(() => ({
    theme: mode,
    mode,
    accent,
    setMode,
    setAccent,
    toggleTheme: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
  }), [mode, accent]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
