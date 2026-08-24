import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { clusterTrees } from '@/lib/clustering';
import { pinColor } from '@/lib/labels';
import { STOPS, zoomForStop } from '@/lib/zoom-ladder';
import { PRAGUE, ROUTE_COLOR, type TreeMapProps } from './tree-map.types';

export default function TreeMap({
  trees,
  reports,
  onPressTree,
  flyTo,
  route,
  userLocation,
  mode = 'go',
  stop,
  onPressCluster,
  onCenterChange,
}: TreeMapProps) {
  const mapRef = useRef<MapView>(null);
  const { width } = useWindowDimensions();

  // Native (v2) has no custom style yet, so the ladder shows up as camera
  // work only: the stop sets both the tilt and how much world is on screen.
  useEffect(() => {
    mapRef.current?.animateCamera(
      {
        pitch: mode === 'flat' ? 0 : STOPS[stop].pitch,
        zoom: zoomForStop(stop, width, PRAGUE.lat),
      },
      { duration: 500 }
    );
  }, [mode, stop, width]);

  const clusters = useMemo(() => {
    const cellM = STOPS[stop].clusterM;
    return cellM === null ? [] : clusterTrees(trees, reports, cellM);
  }, [trees, reports, stop]);

  // Trees draw individually up to street scale, fold into counts at district
  // scale, and are gone entirely at region scale.
  const showSprites = STOPS[stop].spriteH !== null;
  const showAvatar = STOPS[stop].avatarH !== null;

  useEffect(() => {
    if (flyTo) {
      mapRef.current?.animateToRegion(
        { latitude: flyTo.lat, longitude: flyTo.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600
      );
    }
  }, [flyTo]);

  useEffect(() => {
    if (route && route.coords.length > 1) {
      mapRef.current?.fitToCoordinates(
        route.coords.map((c) => ({ latitude: c.lat, longitude: c.lng })),
        { edgePadding: { top: 80, right: 60, bottom: 120, left: 60 }, animated: true }
      );
    }
  }, [route]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{
        latitude: PRAGUE.lat,
        longitude: PRAGUE.lng,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }}
      onRegionChangeComplete={(region) =>
        onCenterChange?.({ lat: region.latitude, lng: region.longitude })
      }>
      {userLocation && showAvatar && (
        <Marker
          coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}>
          <View style={styles.player} />
        </Marker>
      )}
      {route && route.coords.length > 1 && (
        <Polyline
          coordinates={route.coords.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
          strokeColor={ROUTE_COLOR}
          strokeWidth={4}
        />
      )}
      {clusters.map((cluster) => (
        <Marker
          key={cluster.key}
          coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
          onPress={(e) => {
            e.stopPropagation();
            onPressCluster?.({ lat: cluster.lat, lng: cluster.lng });
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}>
          <View
            style={[
              styles.cluster,
              {
                backgroundColor: cluster.hasRipe ? '#C9402F' : '#38754A',
                width: Math.min(64, 30 + cluster.count * 7),
                height: Math.min(64, 30 + cluster.count * 7),
                borderRadius: Math.min(32, 15 + cluster.count * 3.5),
              },
            ]}>
            <Text style={styles.clusterCount}>{cluster.count}</Text>
          </View>
        </Marker>
      ))}
      {showSprites && trees.map((tree) => (
        <Marker
          key={tree.id}
          coordinate={{ latitude: tree.lat, longitude: tree.lng }}
          onPress={(e) => {
            e.stopPropagation();
            onPressTree(tree);
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}>
          <View
            style={[
              styles.pin,
              { backgroundColor: pinColor(tree, reports) },
              tree.status === 'unverified' && styles.unverified,
            ]}
          />
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  unverified: { opacity: 0.55 },
  cluster: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  clusterCount: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  // Native (v2) keeps a plain position dot; the avatar sprite is web-only.
  player: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#3B6FD4',
  },
});
