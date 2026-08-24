import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the bottom edge belongs to somebody else.
 *
 * Most people meet this app as a link in Safari, which parks its toolbar at
 * the bottom: a 52 px bar plus a 22 px home-indicator strip. A bottom tab bar
 * there either hides behind the toolbar or sits directly above it, doubling
 * the visual weight at the bottom and pushing the thumb into the browser's
 * own controls — which is why navigation lives in a rail on the right instead.
 *
 * Installed as a PWA that band becomes just the home indicator. Nothing in
 * the layout reflows when it changes; everything simply moves down.
 */

const SAFARI_CHROME = 74;
const INSTALLED_CHROME = 24;
const DESKTOP_CHROME = 16;

function isStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query for home-screen apps
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** True once the app runs from the home screen rather than inside a browser. */
export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(isStandalone);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const query = window.matchMedia?.('(display-mode: standalone)');
    if (!query) return;
    const update = () => setStandalone(isStandalone());
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return standalone;
}

/**
 * Height of the band at the bottom of the screen that our chrome must stay
 * out of. Everything the map floats — rail, context card, zoom stepper —
 * measures up from this.
 */
export function useBottomChrome(): number {
  const insets = useSafeAreaInsets();
  const standalone = useIsStandalone();

  if (Platform.OS !== 'web') return Math.max(insets.bottom, INSTALLED_CHROME);
  if (standalone) return Math.max(insets.bottom, INSTALLED_CHROME);
  // A coarse pointer means a phone browser, and a phone browser means a
  // toolbar on the bottom edge. Desktop browsers have nothing down there.
  const touch =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return touch ? SAFARI_CHROME : DESKTOP_CHROME;
}

/** Gaps measured up from the bottom chrome, straight off the design. */
export const CARD_GAP = 22;
export const RAIL_GAP = 104;
