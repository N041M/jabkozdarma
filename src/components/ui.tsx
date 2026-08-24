import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ripenessColors, useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { accessLabels, ripenessLabels, timeAgo } from '@/lib/labels';
import type { AccessType, TreeReport } from '@/lib/types';

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
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * The 44 px header every pushed screen carries. The map is the hub, so the
 * back control always returns there rather than unwinding an arbitrary
 * history — a deep link or a refresh has none to unwind.
 */
export function ScreenHeader({
  title,
  right,
  close,
}: {
  title: string;
  right?: ReactNode;
  close?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.header,
        { backgroundColor: t.surface, borderBottomColor: t.line, paddingTop: insets.top },
      ]}>
      <View style={styles.headerRow}>
        <Pressable
          hitSlop={12}
          accessibilityLabel={title}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.headerSide}>
          <Ionicons name={close ? 'close' : 'arrow-back'} size={close ? 26 : 24} color={t.ink} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.headerTitle, { color: t.ink }]}>
          {title}
        </Text>
        <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
      </View>
    </View>
  );
}

/**
 * The pill used for species, access, season, ripeness and filters. One
 * geometry everywhere, so a tap target is never a surprise: 34 px tall
 * inside a row that clears 44 px.
 */
export function Chip({
  label,
  selected,
  onPress,
  dotColor,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  dotColor?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? t.green : t.surface,
          borderColor: selected ? t.green : t.line,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}>
      {dotColor && <View style={[styles.chipDot, { backgroundColor: dotColor }]} />}
      <Text style={{ color: selected ? '#FFFFFF' : t.ink, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The 11 px letter-spaced caps that title a group of fields. */
export function FieldLabel({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.fieldLabel, { color: t.muted }]}>{children}</Text>;
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
  header: { borderBottomWidth: 1 },
  headerRow: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  headerSide: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end', paddingRight: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
