import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOAST_MS, useToast } from '@/lib/toast';

/**
 * Mounted once, above everything. Rewards are the reason this app has a
 * contribution loop at all, so they get their own channel rather than a
 * banner that shifts the layout underneath the thumb.
 */
export default function Toast() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  // The toast deliberately runs against the scheme so it lifts off whatever
  // is behind it. In light mode these are the design's literal values.
  const dark = useColorScheme() === 'dark';
  const surface = dark ? '#E9EFE7' : '#1C261D';
  const ink = dark ? '#1C261D' : '#FFFFFF';
  const accent = dark ? '#2F6540' : '#8FD3A3';
  // Lazy state, not a ref: an Animated.Value is read during render to build
  // the style, which is exactly what reading a ref there is not allowed to do.
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(dismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, anim, dismiss]);

  if (!toast) return null;

  return (
    <Animated.View
      // A toast is an announcement, never a target — taps belong to the map.
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          backgroundColor: surface,
          top: insets.top + 61,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}>
      <Ionicons name={toast.icon} size={21} color={accent} />
      <Text style={[styles.text, { color: ink }]}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    maxWidth: 520,
    alignSelf: 'center',
  },
  text: { fontSize: 14, fontWeight: '600', flex: 1 },
});
