import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import type { RailSide } from '@/lib/store';
import { scaleLabel, type ZoomStop } from '@/lib/zoom-ladder';

/**
 * The small things floating over the map: what scale you are at, how long
 * your run is, and the zoom stepper. None of them is a bar — the map runs
 * edge to edge underneath and these sit on top of it.
 */

/** System monospace; the scale badge is the only place the app uses it. */
const MONO = Platform.select({
  web: 'ui-monospace, Menlo, monospace',
  default: 'Menlo',
});

/** `50 m · 58°`, top-left. Tapping it cycles the four zoom stops. */
export function ScaleBadge({ stop, onPress, top }: { stop: ZoomStop; onPress: () => void; top: number }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t2('cycleScale')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: t.surface, top, left: 12, opacity: pressed ? 0.8 : 1, shadowColor: '#000' },
      ]}>
      <Text style={[styles.scaleText, { color: t.ink, fontFamily: MONO }]}>{scaleLabel(stop)}</Text>
    </Pressable>
  );
}

/** Days in a row, top-right. Tapping it opens the Jablkodex. */
export function StreakPill({
  streak,
  onPress,
  top,
}: {
  streak: number;
  onPress: () => void;
  top: number;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t2('streakLabel', { n: streak })}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pill,
        styles.streak,
        { backgroundColor: t.surface, top, right: 12, opacity: pressed ? 0.8 : 1, shadowColor: '#000' },
      ]}>
      <Ionicons name="flame" size={15} color="#C9402F" />
      <Text style={{ color: t.ink, fontSize: 13, fontWeight: '700' }}>{streak}</Text>
    </Pressable>
  );
}

/**
 * The `+` / `−` pill. It mirrors to the opposite edge from the rail so the
 * two never fight for the same thumb.
 */
export function ZoomStepper({
  stop,
  onStep,
  bottom,
  side,
}: {
  stop: ZoomStop;
  onStep: (delta: -1 | 1) => void;
  bottom: number;
  /** The side the *rail* is on; the stepper takes the other one. */
  side: RailSide;
}) {
  const t = useTheme();
  // `+` means "closer", which is a lower stop index.
  const canZoomIn = stop > 0;
  const canZoomOut = stop < 3;

  return (
    <View
      style={[
        styles.stepper,
        {
          backgroundColor: t.surface,
          bottom,
          [side === 'right' ? 'left' : 'right']: 12,
          shadowColor: '#000',
        },
      ]}>
      <Pressable
        onPress={() => canZoomIn && onStep(-1)}
        disabled={!canZoomIn}
        accessibilityRole="button"
        accessibilityLabel={t2('zoomIn')}
        style={({ pressed }) => [styles.stepButton, { opacity: pressed && canZoomIn ? 0.6 : 1 }]}>
        <Ionicons name="add" size={22} color={canZoomIn ? t.green : t.disabled} />
      </Pressable>
      <View style={[styles.stepDivider, { backgroundColor: t.line }]} />
      <Pressable
        onPress={() => canZoomOut && onStep(1)}
        disabled={!canZoomOut}
        accessibilityRole="button"
        accessibilityLabel={t2('zoomOut')}
        style={({ pressed }) => [styles.stepButton, { opacity: pressed && canZoomOut ? 0.6 : 1 }]}>
        <Ionicons name="remove" size={22} color={canZoomOut ? t.green : t.disabled} />
      </Pressable>
    </View>
  );
}

const shadow = {
  shadowOpacity: 0.16,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
} as const;

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    ...shadow,
  },
  scaleText: { fontSize: 11, fontWeight: '700' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepper: {
    position: 'absolute',
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    ...shadow,
  },
  stepButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepDivider: { width: 22, height: 1 },
});
