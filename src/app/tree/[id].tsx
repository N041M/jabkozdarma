import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessBadge, Button, RipenessBadge } from '@/components/ui';
import { ripenessColors, useTheme } from '@/constants/theme';
import {
  flagLabels,
  latestReport,
  ripenessLabels,
  seasonLabel,
  timeAgo,
} from '@/lib/labels';
import { fetchWalkingRoute } from '@/lib/routing';
import { useStore } from '@/lib/store';
import type { FlagReason, RipenessState } from '@/lib/types';

const RIPENESS_STATES: RipenessState[] = ['flowering', 'unripe', 'ripe', 'past', 'bare'];
const FLAG_REASONS: FlagReason[] = ['gone', 'duplicate', 'private', 'wrong_info'];

export default function TreeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();

  const tree = useStore((s) => s.trees.find((tr) => tr.id === id));
  const reports = useStore((s) => s.reports);
  const profiles = useStore((s) => s.profiles);
  const profile = useStore((s) => s.profile);
  const favorites = useStore((s) => s.favorites);
  const addReport = useStore((s) => s.addReport);
  const flagTree = useStore((s) => s.flagTree);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const setRoute = useStore((s) => s.setRoute);

  const [showFlags, setShowFlags] = useState(false);
  const [flagged, setFlagged] = useState<FlagReason | null>(null);
  const [routing, setRouting] = useState<'idle' | 'busy' | 'error'>('idle');

  const treeReports = useMemo(
    () =>
      reports
        .filter((r) => r.treeId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, id]
  );

  if (!tree) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.muted }}>This tree is no longer on the map.</Text>
      </View>
    );
  }

  const author = profiles.find((p) => p.id === tree.createdBy);
  const isFavorite = favorites.includes(tree.id);
  const latest = latestReport(tree.id, reports);
  const season = seasonLabel(tree);

  const walkThere = async () => {
    setRouting('busy');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('location permission denied');
      const pos = await Location.getCurrentPositionAsync({});
      const result = await fetchWalkingRoute(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        { lat: tree.lat, lng: tree.lng }
      );
      setRoute({
        treeId: tree.id,
        treeLabel: tree.variety ?? 'Apple tree',
        ...result,
      });
      setRouting('idle');
      router.navigate('/'); // back to the map, which draws the route
    } catch {
      setRouting('error');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: tree.variety ?? 'Apple tree',
          headerRight: () => (
            <Pressable onPress={() => toggleFavorite(tree.id)} hitSlop={8} disabled={!profile}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite ? t.red : profile ? t.muted : t.line}
              />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
        {tree.photoUri && (
          <Image source={{ uri: tree.photoUri }} style={styles.photo} resizeMode="cover" />
        )}

        <View style={styles.badgeRow}>
          <AccessBadge access={tree.access} />
          {tree.status === 'unverified' && (
            <View style={[styles.unverified, { borderColor: t.line }]}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>Unverified</Text>
            </View>
          )}
        </View>

        <RipenessBadge report={latest} />

        {season && (
          <Text style={{ color: t.muted, fontSize: 14 }}>
            Usual season: <Text style={{ color: t.ink, fontWeight: '600' }}>{season}</Text>
          </Text>
        )}

        {tree.description && (
          <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>{tree.description}</Text>
        )}

        <Text style={{ color: t.muted, fontSize: 13 }}>
          Added by {author?.username ?? 'unknown'} · {timeAgo(tree.createdAt)}
        </Text>

        <View style={styles.actionRow}>
          <Button
            label={routing === 'busy' ? 'Finding a route…' : 'Walk there'}
            onPress={walkThere}
            disabled={routing === 'busy'}
            style={{ flex: 1 }}
          />
          {profile?.id === tree.createdBy && (
            <Button
              label="Edit"
              kind="secondary"
              onPress={() => router.push({ pathname: '/add-tree', params: { editId: tree.id } })}
              style={{ flex: 1 }}
            />
          )}
        </View>
        {routing === 'error' && (
          <Text style={{ color: t.red, fontSize: 13 }}>
            Couldn’t get a walking route — check that location access is allowed and try again.
          </Text>
        )}

        <View style={[styles.section, { borderTopColor: t.line }]}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>How is it right now?</Text>
          {profile ? (
            <View style={styles.chipRow}>
              {RIPENESS_STATES.map((state) => (
                <Pressable
                  key={state}
                  onPress={() => addReport(tree.id, state, null)}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: t.surface, borderColor: t.line, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <View style={[styles.chipDot, { backgroundColor: ripenessColors[state] }]} />
                  <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600' }}>
                    {ripenessLabels[state]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ color: t.muted, fontSize: 14 }}>
              Sign in on the Profile tab to report ripeness.
            </Text>
          )}
        </View>

        {treeReports.length > 0 && (
          <View style={[styles.section, { borderTopColor: t.line }]}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>Reports</Text>
            {treeReports.map((r) => {
              const reporter = profiles.find((p) => p.id === r.userId);
              return (
                <View key={r.id} style={styles.reportRow}>
                  <View style={[styles.chipDot, { backgroundColor: ripenessColors[r.state] }]} />
                  <Text style={{ color: t.ink, fontSize: 14, flexShrink: 1 }}>
                    <Text style={{ fontWeight: '600' }}>{ripenessLabels[r.state]}</Text>
                    {r.note ? ` — ${r.note}` : ''}
                  </Text>
                  <Text style={{ color: t.muted, fontSize: 12, marginLeft: 'auto' }}>
                    {reporter?.username ?? '?'} · {timeAgo(r.createdAt)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.section, { borderTopColor: t.line }]}>
          {flagged ? (
            <Text style={{ color: t.muted, fontSize: 14 }}>
              Thanks — flagged as “{flagLabels[flagged]}”. A moderator will take a look.
            </Text>
          ) : showFlags ? (
            <View style={styles.chipRow}>
              {FLAG_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => {
                    flagTree(tree.id, reason);
                    setFlagged(reason);
                    if (reason === 'gone') router.back();
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    { backgroundColor: t.redSoft, borderColor: t.redSoft, opacity: pressed ? 0.7 : 1 },
                  ]}>
                  <Text style={{ color: t.red, fontSize: 13, fontWeight: '600' }}>
                    {flagLabels[reason]}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable onPress={() => setShowFlags(true)} disabled={!profile} hitSlop={8}>
              <Text style={{ color: profile ? t.red : t.muted, fontSize: 14, fontWeight: '600' }}>
                {profile ? 'Report a problem with this pin' : 'Sign in to report a problem'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  photo: { width: '100%', height: 220, borderRadius: 14 },
  badgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  unverified: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  section: { borderTopWidth: 1, paddingTop: 16, marginTop: 6, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
