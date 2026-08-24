import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import type { RailSide } from '@/lib/store';
import type { IconName } from '@/lib/toast';

/**
 * Navigation lives in a vertical rail on the right, in the thumb arc, not on
 * the bottom edge — because most people meet this app as a link in Safari,
 * whose toolbar owns 74 px of that edge. See `src/lib/chrome.ts`.
 *
 * The rail is a map affordance: it appears on the map screen only, and the
 * map is the hub every other screen returns to.
 *
 * Only the active tab and the action slot are labelled. Dropping the other
 * three labels is what buys the room to set the type at 10 px instead of the
 * 7.5 px an earlier revision squeezed inside the circles.
 */

/** RN Web ignores the native driver and warns about it. */
const NATIVE_DRIVER = Platform.OS !== 'web';

export interface RailAction {
  /** Changes when the zoom stop changes; drives the label flash. */
  key: string;
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}

interface NavItem {
  key: string;
  href: '/' | '/harvest' | '/dex' | '/profile';
  icon: IconName;
  size: number;
  label: string;
}

const NAV: NavItem[] = [
  { key: 'map', href: '/', icon: 'map', size: 22, label: 'tabMap' },
  { key: 'harvest', href: '/harvest', icon: 'list-outline', size: 22, label: 'tabHarvest' },
  { key: 'dex', href: '/dex', icon: 'grid-outline', size: 21, label: 'tabDex' },
  { key: 'profile', href: '/profile', icon: 'person-circle-outline', size: 23, label: 'tabProfile' },
];

export default function Rail({
  side,
  bottom,
  action,
  onHeight,
}: {
  side: RailSide;
  bottom: number;
  action: RailAction;
  onHeight?: (height: number) => void;
}) {
  const t = useTheme();
  const router = useRouter();

  // The pulse behind the action slot: slow, endless, and the only motion on
  // the map that is not the camera.
  const [ping] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ping, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);

  // The action changes meaning with the zoom stop, so the thumb target under
  // a stationary finger can mean something new. Colour carries the change;
  // this flash makes sure the label is what the eye lands on when it does.
  const [flash] = useState(() => new Animated.Value(1));
  useEffect(() => {
    flash.setValue(0);
    Animated.timing(flash, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [action.key, flash]);

  const surface = `${t.surface}F0`; // 94% — the map keeps showing through

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => onHeight?.(e.nativeEvent.layout.height)}
      style={[
        styles.rail,
        { backgroundColor: surface, bottom, [side]: 12, shadowColor: '#000' },
      ]}>
      {NAV.map((item) => {
        const active = item.key === 'map';
        return (
          <Pressable
            key={item.key}
            onPress={() => (active ? undefined : router.push(item.href))}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t2(item.label as 'tabMap')}
            style={({ pressed }) => [styles.navItem, { opacity: pressed && !active ? 0.6 : 1 }]}>
            <View style={[styles.navCircle, active && { backgroundColor: t.green }]}>
              <Ionicons
                name={item.icon}
                size={item.size}
                color={active ? '#FFFFFF' : t.green}
              />
            </View>
            {active && (
              <Text style={[styles.navLabel, { color: t.green }]}>{t2(item.label as 'tabMap')}</Text>
            )}
          </Pressable>
        );
      })}

      <View style={[styles.divider, { backgroundColor: t.line }]} />

      <Pressable
        onPress={action.onPress}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        style={({ pressed }) => [styles.navItem, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.actionWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ping,
              {
                backgroundColor: action.color,
                opacity: ping.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }),
                transform: [
                  { scale: ping.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) },
                ],
              },
            ]}
          />
          <View style={[styles.actionCircle, { backgroundColor: action.color }]}>
            <Ionicons name={action.icon} size={26} color="#FFFFFF" />
          </View>
        </View>
        <Animated.Text
          style={[
            styles.actionLabel,
            {
              color: action.color,
              opacity: flash,
              transform: [
                { scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) },
              ],
            },
          ]}>
          {action.label}
        </Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    width: 72,
    alignItems: 'center',
    gap: 10,
    borderRadius: 32,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  navItem: { alignItems: 'center', gap: 3 },
  navCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 10, fontWeight: '700' },
  divider: { width: 32, height: 1 },
  actionWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ping: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 10, fontWeight: '800' },
});
