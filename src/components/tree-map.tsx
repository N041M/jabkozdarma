import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { pinColor } from '@/lib/labels';
import { PRAGUE, type TreeMapProps } from './tree-map.types';

export default function TreeMap({
  trees,
  reports,
  placing,
  onPressTree,
  onPressMap,
  flyTo,
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
