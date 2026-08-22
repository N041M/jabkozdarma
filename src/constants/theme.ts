import { useColorScheme } from 'react-native';

export const palette = {
  light: {
    bg: '#F7F8F4',
    surface: '#FFFFFF',
    ink: '#1C261D',
    muted: '#5A685C',
    line: '#DDE4DA',
    green: '#38754A',
    greenSoft: '#E4EFE2',
    red: '#B5443C',
    redSoft: '#F5E3E1',
    amber: '#8A5D14',
    amberSoft: '#F3EAD3',
  },
  dark: {
    bg: '#131A14',
    surface: '#1B231C',
    ink: '#E7ECE5',
    muted: '#9CAA9E',
    line: '#2C362D',
    green: '#6FB984',
    greenSoft: '#223626',
    red: '#E08A82',
    redSoft: '#3A2523',
    amber: '#D9B36A',
    amberSoft: '#33301F',
  },
};

export type Palette = typeof palette.light;

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

/** Pin colors by latest ripeness report; theme-independent so they read on the map. */
export const ripenessColors: Record<string, string> = {
  ripe: '#C9402F',
  flowering: '#C77BA4',
  unripe: '#4C9A5F',
  past: '#B98A2C',
  bare: '#8A948B',
  none: '#38754A',
};
