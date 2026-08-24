import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import { ripenessColors, useTheme } from '@/constants/theme';
import { walkMinutes } from '@/lib/clustering';
import { formatKm, t as t2 } from '@/lib/i18n';
import { accessLabels, distanceMeters, latestReport, treeTitle } from '@/lib/labels';
import { formatWalkTime } from '@/lib/routing';
import { useStore } from '@/lib/store';
import { useKnownLocation } from '@/lib/use-location';

/** "Do 2 km" — the radius the near filter means. */
const NEAR_RADIUS_M = 2_000;

/**
 * Sklizeň: the map's ranked twin. Same trees, ordered by how far you would
 * have to walk, which is the question a map can only answer by eye.
 */
export default function HarvestScreen() {
  const t = useTheme();
  const router = useRouter();
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const here = useKnownLocation();

  const [ripeOnly, setRipeOnly] = useState(true);
  const [nearOnly, setNearOnly] = useState(true);

  const rows = useMemo(() => {
    const list = trees
      .filter((tree) => tree.status !== 'gone' && Number.isFinite(tree.lat) && Number.isFinite(tree.lng))
      .map((tree) => {
        const latest = latestReport(tree.id, reports);
        const distance = here ? distanceMeters(here.lat, here.lng, tree.lat, tree.lng) : null;
        return { tree, latest, distance };
      })
      .filter((row) => (ripeOnly ? row.latest?.state === 'ripe' : true))
      .filter((row) => (nearOnly && row.distance !== null ? row.distance <= NEAR_RADIUS_M : true));

    // Without a fix there is no meaningful order, so leave the list as it is
    // rather than pretending to rank it.
    if (here) list.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    return list;
  }, [trees, reports, here, ripeOnly, nearOnly]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={t2('harvestTitle')} />

      <View style={[styles.filters, { backgroundColor: t.surface, borderBottomColor: t.subtle }]}>
        <FilterChip
          label={t2('legendRipe')}
          active={ripeOnly}
          dotColor={ripenessColors.ripe}
          onPress={() => setRipeOnly((v) => !v)}
        />
        <FilterChip
          label={t2('filterNear')}
          active={nearOnly}
          onPress={() => setNearOnly((v) => !v)}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('nearYou')}</Text>
          <Text style={{ color: t.muted, fontSize: 14 }}>{rows.length}</Text>
        </View>

        {!here && (
          <Text style={[styles.empty, { color: t.muted }]}>{t2('needLocationForList')}</Text>
        )}

        {rows.length === 0 ? (
          <Text style={[styles.empty, { color: t.muted }]}>{t2('harvestEmpty')}</Text>
        ) : (
          rows.map(({ tree, latest, distance }) => (
            <Pressable
              key={tree.id}
              onPress={() => router.push(`/tree/${tree.id}`)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: t.surface, borderTopColor: t.subtle, opacity: pressed ? 0.8 : 1 },
              ]}>
              <View
                style={[styles.dot, { backgroundColor: ripenessColors[latest?.state ?? 'none'] }]}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[styles.rowTitle, { color: t.ink }]}>
                  {treeTitle(tree)}
                </Text>
                <Text numberOfLines={1} style={{ color: t.muted, fontSize: 14 }}>
                  {[
                    accessLabels[tree.access],
                    distance === null ? null : formatKm(distance / 1000),
                    distance === null ? null : formatWalkTime(walkMinutes(distance)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Wider and heavier than the form chips: these carry a live filter, not a
 * value, and the dot has to read at a glance while scrolling.
 */
function FilterChip({
  label,
  active,
  dotColor,
  onPress,
}: {
  label: string;
  active: boolean;
  dotColor?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: active ? t.green : t.surface,
          borderColor: active ? t.green : t.line,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {dotColor && (
        <View style={[styles.filterDot, { backgroundColor: active ? '#FFFFFF' : dotColor }]} />
      )}
      <Text style={{ color: active ? '#FFFFFF' : t.ink, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterDot: { width: 9, height: 9, borderRadius: 4.5 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderTopWidth: 1,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: 17, fontWeight: '600' },
  empty: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 14, lineHeight: 20 },
});
