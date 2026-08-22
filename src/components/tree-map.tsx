import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { pinColor } from '@/lib/labels';
import { PRAGUE, ROUTE_COLOR, type TreeMapProps } from './tree-map.types';

export default function TreeMap({
  trees,
  reports,
  placing,
  onPressTree,
  onPressMap,
  flyTo,
  route,
}: TreeMapProps) {
  const mapRef = useRef<MapView>(null);

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
      onPress={(e) => {
        if (!placing) return;
        const { latitude, longitude } = e.nativeEvent.coordinate;
        onPressMap(latitude, longitude);
      }}>
      {route && route.coords.length > 1 && (
        <Polyline
          coordinates={route.coords.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
          strokeColor={ROUTE_COLOR}
          strokeWidth={4}
        />
      )}
      {trees.map((tree) => (
        <Marker
          key={tree.id}
          coordinate={{ latitude: tree.lat, longitude: tree.lng }}
          onPress={(e) => {
            e.stopPropagation();
            if (!placing) onPressTree(tree);
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
});
