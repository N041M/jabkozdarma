import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TreeMap from '@/components/tree-map';
import { ripenessColors, useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { distanceMeters } from '@/lib/labels';
import { formatRoute } from '@/lib/routing';
import { useStore } from '@/lib/store';

const DUPLICATE_RADIUS_M = 25;
/** You must be standing near a tree to pin it — this is the whole point. */
const PLACE_RADIUS_M = 100;

export default function MapScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const profile = useStore((s) => s.profile);
  const activeRoute = useStore((s) => s.activeRoute);
  const clearRoute = useStore((s) => s.clearRoute);
  const mapMode = useStore((s) => s.mapMode);
  const setMapMode = useStore((s) => s.setMapMode);

  const [placing, setPlacing] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  /** Follow the player's position so the avatar keeps up as they walk. */
  const startWatching = useCallback(async () => {
    if (watchRef.current) return true;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 5000 },
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            setUserLoc({ lat: latitude, lng: longitude });
          }
        }
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    startWatching();
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [startWatching]);

  // Also drop any tree with invalid coordinates — bad persisted data must
  // degrade to a missing pin, never a crashed map.
  const visibleTrees = useMemo(
    () =>
      trees.filter(
        (tree) =>
          tree.status !== 'gone' && Number.isFinite(tree.lat) && Number.isFinite(tree.lng)
      ),
    [trees]
  );

  const startAdding = async () => {
    if (!profile) {
      router.push('/(tabs)/profile');
      return;
    }
    setNotice(null);
    let here = userLoc;
    if (!here) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setNotice(t2('needLocationToAdd'));
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(here);
        startWatching();
      } catch {
        setNotice(t2('needLocationToAdd'));
        return;
      }
    }
    setFlyTo({ ...here, key: Date.now() });
    setPlacing(true);
  };

  const placeTree = (lat: number, lng: number) => {
    if (!userLoc) {
      setNotice(t2('needLocationToAdd'));
      return;
    }
    // Pins must be within walking distance of the person adding them —
    // it keeps the map honest and is the point of a field-survey app.
    if (distanceMeters(lat, lng, userLoc.lat, userLoc.lng) > PLACE_RADIUS_M) {
      setNotice(t2('tooFarToPlace', { max: PLACE_RADIUS_M }));
      return; // stay in placing mode so they can try again
    }
    setPlacing(false);
    setNotice(null);
    const nearby = visibleTrees.filter(
      (tree) => distanceMeters(lat, lng, tree.lat, tree.lng) < DUPLICATE_RADIUS_M
    ).length;
    router.push({
      pathname: '/add-tree',
      params: { lat: String(lat), lng: String(lng), nearby: String(nearby) },
    });
  };

  const locateMe = async () => {
    // The permission prompt can background the page; never let a rejection
    // here escape as an unhandled error.
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      if (!Number.isFinite(pos.coords.latitude) || !Number.isFinite(pos.coords.longitude)) return;
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLoc(here); // also drops the avatar, not just the camera
      startWatching();
      setFlyTo({ ...here, key: Date.now() });
    } catch (err) {
      console.warn('[locate] failed', err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TreeMap
        trees={visibleTrees}
        reports={reports}
        placing={placing}
        onPressTree={(tree) => router.push(`/tree/${tree.id}`)}
        onPressMap={placeTree}
        flyTo={flyTo}
        route={activeRoute}
        userLocation={userLoc}
        placeRadiusM={placing ? PLACE_RADIUS_M : null}
        mode={mapMode}
      />

      {activeRoute && !placing && (
        <View style={[styles.banner, { top: insets.top + 12, backgroundColor: t.surface }]}>
          <Ionicons name="walk" size={20} color={t.green} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: '700' }}>
              {formatRoute(activeRoute.distanceM, activeRoute.durationS)}
            </Text>
            <Text style={{ color: t.muted, fontSize: 12 }}>
              {t2('routeTo', { label: activeRoute.treeLabel })}
            </Text>
          </View>
          <Pressable onPress={clearRoute} hitSlop={8}>
            <Ionicons name="close" size={22} color={t.muted} />
          </Pressable>
        </View>
      )}

      {placing && (
        <View style={[styles.banner, { top: insets.top + 12, backgroundColor: t.surface }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>{t2('placingBanner')}</Text>
            <Text style={{ color: notice ? t.red : t.muted, fontSize: 12 }}>
              {notice ?? t2('placingHint', { max: PLACE_RADIUS_M })}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setPlacing(false);
              setNotice(null);
            }}
            hitSlop={8}>
            <Text style={{ color: t.red, fontWeight: '700' }}>{t2('cancel')}</Text>
          </Pressable>
        </View>
      )}

      {!placing && notice && (
        <View style={[styles.banner, { top: insets.top + 12, backgroundColor: t.surface }]}>
          <Text style={{ color: t.red, fontSize: 13, flex: 1 }}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <Ionicons name="close" size={20} color={t.muted} />
          </Pressable>
        </View>
      )}

      {!placing && !activeRoute && !notice && (
        <View style={[styles.legend, { top: insets.top + 12, backgroundColor: t.surface }]}>
          {(
            [
              ['ripe', t2('legendRipe')],
              ['unripe', t2('legendUnripe')],
              ['none', t2('legendNone')],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: ripenessColors[key] }]} />
              <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.fabs, { bottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => setMapMode(mapMode === 'go' ? 'flat' : 'go')}
          accessibilityLabel={mapMode === 'go' ? t2('viewFlat') : t2('viewGo')}
          style={({ pressed }) => [
            styles.fab,
            styles.fabSmall,
            { backgroundColor: t.surface, opacity: pressed ? 0.8 : 1 },
          ]}>
          <Ionicons name={mapMode === 'go' ? 'map-outline' : 'cube-outline'} size={20} color={t.green} />
        </Pressable>
        <Pressable
          onPress={locateMe}
          style={({ pressed }) => [
            styles.fab,
            styles.fabSmall,
            { backgroundColor: t.surface, opacity: pressed ? 0.8 : 1 },
          ]}>
          <Ionicons name="locate" size={22} color={t.green} />
        </Pressable>
        <Pressable
          onPress={startAdding}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: t.green, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legend: {
    position: 'absolute',
    left: 12,
    padding: 10,
    borderRadius: 10,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#FFF' },
  fabs: { position: 'absolute', right: 16, alignItems: 'center', gap: 12 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabSmall: { width: 46, height: 46, borderRadius: 23 },
});
