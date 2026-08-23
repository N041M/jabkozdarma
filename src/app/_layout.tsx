import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text, View, useColorScheme } from 'react-native';

import { Button, HeaderBack } from '@/components/ui';
import { palette, useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { useStore } from '@/lib/store';

/**
 * Crash recovery: whatever throws during render lands here instead of a
 * white screen. "Reset" also clears persisted local state, the escape
 * hatch if bad cached data keeps crashing the app on every launch.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>{t2('errorTitle')}</Text>
      <Text style={{ color: t.muted, fontSize: 13, textAlign: 'center' }} numberOfLines={3}>
        {String(error?.message ?? error)}
      </Text>
      <Button label={t2('errorRetry')} onPress={() => retry()} />
      <Button
        label={t2('errorReset')}
        kind="danger"
        onPress={async () => {
          await AsyncStorage.clear().catch(() => {});
          if (Platform.OS === 'web') window.location.assign('./');
          else retry();
        }}
      />
      <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>{t2('errorResetHint')}</Text>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const initBackend = useStore((s) => s.initBackend);

  useEffect(() => {
    initBackend();
  }, [initBackend]);
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
        <Stack.Screen
          name="tree/[id]"
          options={{ title: t2('appleTree'), headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="privacy"
          options={{ title: t2('privacyTitle'), headerLeft: () => <HeaderBack /> }}
        />
        <Stack.Screen
          name="add-tree"
          options={{
            title: t2('addTreeTitle'),
            presentation: 'modal',
            headerLeft: () => <HeaderBack />,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
