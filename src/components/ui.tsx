import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ripenessColors, useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { accessLabels, ripenessLabels, timeAgo } from '@/lib/labels';
import type { AccessType, TreeReport } from '@/lib/types';

/**
 * Back control that always works: pops history when there is any, otherwise
 * jumps home. Screens outside the tab bar must never be dead ends — deep
 * links, refreshes, and the installed PWA (no browser chrome) all land
 * without navigation history.
 */
export function HeaderBack() {
  const router = useRouter();
  const t = useTheme();
  return (
    <Pressable
      hitSlop={12}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={{ paddingHorizontal: 8 }}>
      <Ionicons name="arrow-back" size={24} color={t.ink} />
    </Pressable>
  );
}

export function AccessBadge({ access }: { access: AccessType }) {
  const t = useTheme();
  const isOwner = access === 'ask_owner';
  return (
    <View style={[styles.badge, { backgroundColor: isOwner ? t.amberSoft : t.greenSoft }]}>
      <Text style={[styles.badgeText, { color: isOwner ? t.amber : t.green }]}>
        {accessLabels[access]}
      </Text>
    </View>
  );
}

export function RipenessBadge({ report }: { report: TreeReport | null }) {
  const t = useTheme();
  if (!report) {
    return <Text style={{ color: t.muted, fontSize: 13 }}>{t2('noReports')}</Text>;
  }
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: ripenessColors[report.state] }]} />
      <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600' }}>
        {ripenessLabels[report.state]}
      </Text>
      <Text style={{ color: t.muted, fontSize: 13 }}> · {timeAgo(report.createdAt)}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.green : kind === 'danger' ? t.redSoft : t.greenSoft;
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'danger' ? t.red : t.green;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
