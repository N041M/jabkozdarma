import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';

/**
 * Aiming a pin.
 *
 * The crosshair never moves — the map moves under it. That is the only way to
 * aim one-handed on a phone: a finger put on the target covers the target,
 * and the alternative the app used to have, dropping the pin on the device's
 * own fix, puts it wherever you stepped back to take the photo.
 *
 * It is two pieces because they sit on opposite halves of the screen. The
 * reticle belongs at the optical centre, and the readout belongs on the
 * bottom edge where the context card it replaces already trained the eye to
 * look.
 */

/**
 * The reticle at the centre of the map, and the one thing on this screen the
 * finger must never catch: every touch here belongs to the map underneath.
 */
export function PlacementCrosshair({ blocked }: { blocked: boolean }) {
  const t = useTheme();
  const color = blocked ? t.red : t.green;
  return (
    <View pointerEvents="none" style={styles.crosshairLayer}>
      <View style={styles.reticle}>
        <View style={[styles.tick, styles.tickTop, { backgroundColor: color }]} />
        <View style={[styles.tick, styles.tickBottom, { backgroundColor: color }]} />
        <View style={[styles.tick, styles.tickLeft, { backgroundColor: color }]} />
        <View style={[styles.tick, styles.tickRight, { backgroundColor: color }]} />
        <View style={[styles.ring, { borderColor: color }]}>
          <View style={[styles.pip, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

/**
 * What is under the crosshair, in the context card's own geometry: the map
 * changes what it is saying, not where it says it.
 *
 * `blocked` colours the whole thing rather than only the sentence that
 * explains it, because the reason someone is looking down here at all is that
 * the button in the rail did not do what they expected.
 */
export function PlacementBar({
  title,
  subtitle,
  blocked,
  onCancel,
  left,
  bottom,
}: {
  title: string;
  subtitle: string;
  blocked: boolean;
  onCancel: () => void;
  left: number;
  bottom: number;
}) {
  const t = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: t.surface, bottom, left, shadowColor: '#000' }]}>
      <View style={[styles.badge, { backgroundColor: blocked ? t.redSoft : t.greenSoft }]}>
        <Ionicons name="locate" size={19} color={blocked ? t.red : t.green} />
      </View>

      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: t.ink }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[styles.subtitle, { color: blocked ? t.red : t.muted }]}>
          {subtitle}
        </Text>
      </View>

      <Pressable
        onPress={onCancel}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t2('cancel')}
        style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="close" size={22} color={t.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // A layer rather than a positioned box: `left: '50%'` on the reticle itself
  // would offset it by half its own width on top of half the screen's.
  crosshairLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    // The map underneath is whatever colour the basemap felt like, so the
    // reticle carries its own contrast rather than trusting it.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  pip: { width: 7, height: 7, borderRadius: 3.5 },
  // The ticks are what stop the reticle reading as another position dot, and
  // they are laid out by hand inside an 84 px box: a 42 px ring in the middle
  // leaves 21 px of margin, so a 13 px tick inset by 4 leaves a 4 px breath
  // either side of it. `40.5` is that box's centre line less half a tick.
  reticle: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  tick: { position: 'absolute', borderRadius: 2 },
  tickTop: { width: 3, height: 13, top: 4, left: 40.5 },
  tickBottom: { width: 3, height: 13, bottom: 4, left: 40.5 },
  tickLeft: { width: 13, height: 3, left: 4, top: 40.5 },
  tickRight: { width: 13, height: 3, right: 4, top: 40.5 },
  // Deliberately the context card's geometry — see ContextCard.
  bar: {
    position: 'absolute',
    right: 12,
    minHeight: 70,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, flexShrink: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 17 },
  cancel: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
});
