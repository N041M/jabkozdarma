import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';

/**
 * The 70 px card on the bottom edge that says what the camera is looking at.
 * Its contents change with the zoom stop — one tree, a street, a district, a
 * region — but its geometry never does, so the eye always knows where the
 * answer is. Tapping it does whatever its right-hand affordance implies.
 */

export interface CardBar {
  label: string;
  /** 0–1, relative to the tallest bar in the set. */
  value: number;
  current: boolean;
}

export type CardRight =
  | { kind: 'chevron'; direction: 'forward' | 'up' }
  | { kind: 'report'; label: string }
  | { kind: 'chart'; bars: CardBar[] }
  | { kind: 'none' };

export default function ContextCard({
  dotColor,
  title,
  subtitle,
  right,
  onPress,
  left,
  bottom,
}: {
  dotColor?: string | null;
  title: string;
  subtitle: string;
  right: CardRight;
  onPress?: () => void;
  left: number;
  bottom: number;
}) {
  const t = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: t.surface,
          bottom,
          left,
          right: 12,
          opacity: pressed && onPress ? 0.9 : 1,
          shadowColor: '#000',
        },
      ]}>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: t.ink }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: t.muted }]}>
          {subtitle}
        </Text>
      </View>

      {right.kind === 'chevron' && (
        <Ionicons
          name={right.direction === 'up' ? 'chevron-up' : 'chevron-forward'}
          size={21}
          color={t.muted}
        />
      )}

      {right.kind === 'report' && (
        <View style={[styles.reportChip, { backgroundColor: t.greenSoft }]}>
          <Text style={{ color: t.green, fontSize: 13, fontWeight: '600' }}>{right.label}</Text>
        </View>
      )}

      {right.kind === 'chart' && (
        <View style={styles.chart}>
          {right.bars.map((bar) => (
            <View key={bar.label} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(6, bar.value * 100)}%`,
                      backgroundColor: bar.current ? t.green : t.greenSoft,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: t.muted }]}>{bar.label}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    height: 70,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  // flexShrink lets the ellipsis actually happen instead of pushing the
  // chevron off the card
  text: { flex: 1, flexShrink: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  reportChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: 46 },
  // Just wide enough for a three-letter Czech month at 10 px, and no wider —
  // every pixel here comes out of the title beside it.
  barColumn: { alignItems: 'center', gap: 3, width: 18 },
  barTrack: { height: 30, width: 8, justifyContent: 'flex-end' },
  bar: { width: 8, borderRadius: 3 },
  barLabel: { fontSize: 10 },
});
