import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { palette } from '@/constants/theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? palette.dark : palette.light;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: t.green,
      background: t.bg,
      card: t.surface,
      text: t.ink,
      border: t.line,
    },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="tree/[id]" options={{ title: 'Apple tree' }} />
        <Stack.Screen
          name="add-tree"
          options={{ title: 'Add a tree', presentation: 'modal' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
