import React, { createContext, useContext, useState } from 'react';

export type ThemeName = 'slate' | 'emerald' | 'amethyst' | 'ocean' | 'crimson';

export interface ColorPalette {
  primary: string;
  primaryHover: string;
  accent: string;
  accentMuted: string;
  outline: string;
  bgPage: string;
  bgCard: string;
  bgInput: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  shadow: string;
}

export const palettes: Record<ThemeName, ColorPalette> = {
  slate: {
    primary: 'bg-white text-black',
    primaryHover: 'hover:bg-gray-100',
    accent: 'text-white',
    accentMuted: 'bg-white/5 border border-white/10 text-gray-300',
    outline: 'border border-white/10 hover:border-white/25',
    bgPage: 'bg-[#090D0E]',
    bgCard: 'bg-[#0E1314]',
    bgInput: 'bg-[#0D1112]',
    border: 'border-white/5',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-300',
    textMuted: 'text-gray-500',
    shadow: 'shadow-2xl shadow-black/80'
  },
  emerald: {
    primary: 'bg-emerald-500 text-black',
    primaryHover: 'hover:bg-emerald-450',
    accent: 'text-emerald-400',
    accentMuted: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300',
    outline: 'border border-emerald-500/15 hover:border-emerald-500/30',
    bgPage: 'bg-[#070A0B]',
    bgCard: 'bg-[#0B0F10]',
    bgInput: 'bg-[#090C0D]',
    border: 'border-emerald-500/5',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-300',
    textMuted: 'text-emerald-500/40',
    shadow: 'shadow-[0_0_24px_rgba(16,185,129,0.05)]'
  },
  amethyst: {
    primary: 'bg-indigo-600 text-white',
    primaryHover: 'hover:bg-indigo-500',
    accent: 'text-indigo-400',
    accentMuted: 'bg-indigo-500/10 border border-indigo-505/20 text-indigo-300',
    outline: 'border border-indigo-500/15 hover:border-indigo-500/30',
    bgPage: 'bg-[#0B0A0F]',
    bgCard: 'bg-[#100F16]',
    bgInput: 'bg-[#0E0D13]',
    border: 'border-indigo-500/5',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-300',
    textMuted: 'text-indigo-500/40',
    shadow: 'shadow-[0_0_24px_rgba(99,102,241,0.05)]'
  },
  ocean: {
    primary: 'bg-sky-500 text-black',
    primaryHover: 'hover:bg-sky-450',
    accent: 'text-sky-400',
    accentMuted: 'bg-sky-500/10 border border-sky-505/20 text-sky-200',
    outline: 'border border-sky-500/15 hover:border-sky-500/30',
    bgPage: 'bg-[#080D0F]',
    bgCard: 'bg-[#0C1417]',
    bgInput: 'bg-[#0A1012]',
    border: 'border-sky-500/5',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-200',
    textMuted: 'text-sky-500/40',
    shadow: 'shadow-[0_0_24px_rgba(14,165,233,0.05)]'
  },
  crimson: {
    primary: 'bg-rose-600 text-white',
    primaryHover: 'hover:bg-rose-500',
    accent: 'text-rose-400',
    accentMuted: 'bg-rose-500/10 border border-rose-505/20 text-rose-300',
    outline: 'border border-rose-500/15 hover:border-rose-500/30',
    bgPage: 'bg-[#0F0A0A]',
    bgCard: 'bg-[#160F0F]',
    bgInput: 'bg-[#130D0D]',
    border: 'border-rose-500/5',
    textPrimary: 'text-white',
    textSecondary: 'text-gray-200',
    textMuted: 'text-rose-500/40',
    shadow: 'shadow-[0_0_24px_rgba(244,63,94,0.05)]'
  }
};

interface ThemeContextType {
  theme: ThemeName;
  palette: ColorPalette;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ defaultTheme?: ThemeName; children: React.ReactNode }> = ({
  defaultTheme = 'slate',
  children
}) => {
  const [theme, setThemeState] = useState<ThemeName>(defaultTheme);
  const palette = palettes[theme];

  const setTheme = (name: ThemeName) => {
    if (palettes[name]) {
      setThemeState(name);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, palette, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be configured and initialized inside a <ThemeProvider /> framework');
  }
  return context;
};
