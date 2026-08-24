import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessBadge, Chip, ScreenHeader } from '@/components/ui';
import { ripenessColors, useTheme } from '@/constants/theme';
import { walkMinutes } from '@/lib/clustering';
import { formatKm, t as t2 } from '@/lib/i18n';
import { distanceMeters } from '@/lib/geo';
import {
  confirmRejectionLabel,
  flagLabels,
  latestReport,
  ripenessLabels,
  seasonLabel,
  timeAgo,
  treeTitle,
} from '@/lib/labels';
import { fetchWalkingRoute, formatWalkTime } from '@/lib/routing';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { useKnownLocation } from '@/lib/use-location';
import { VERIFY, confirmationsRemaining } from '@/lib/verification';
import type { FlagReason, RipenessState } from '@/lib/types';

const RIPENESS_STATES: RipenessState[] = ['flowering', 'unripe', 'ripe', 'past', 'bare'];
const FLAG_REASONS: FlagReason[] = ['gone', 'duplicate', 'private', 'wrong_info'];

export default function TreeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const here = useKnownLocation();
  const showToast = useToast((s) => s.show);

  const tree = useStore((s) => s.trees.find((tr) => tr.id === id));
  const reports = useStore((s) => s.reports);
  const profiles = useStore((s) => s.profiles);
  const profile = useStore((s) => s.profile);
  const favorites = useStore((s) => s.favorites);
  const addReport = useStore((s) => s.addReport);
  const confirmTree = useStore((s) => s.confirmTree);
  const flagTree = useStore((s) => s.flagTree);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const removeTree = useStore((s) => s.removeTree);
  const setRoute = useStore((s) => s.setRoute);

  const [showFlags, setShowFlags] = useState(false);
  const [flagged, setFlagged] = useState<FlagReason | null>(null);
  const [routing, setRouting] = useState<'idle' | 'busy' | 'error'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const treeReports = useMemo(
    () =>
      reports
        .filter((r) => r.treeId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, id]
  );

  if (!tree) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ScreenHeader title={t2('appleTree')} />
        <View style={styles.center}>
          <Text style={{ color: t.muted }}>{t2('treeGone')}</Text>
        </View>
      </View>
    );
  }

  const author = profiles.find((p) => p.id === tree.createdBy);
  const isFavorite = favorites.includes(tree.id);
  const latest = latestReport(tree.id, reports);
  const season = seasonLabel(tree);
  const distance = here ? distanceMeters(here.lat, here.lng, tree.lat, tree.lng) : null;

  /**
   * One tap writes the report. No confirmation step: this is the
   * contribution the map most needs, and the old flow buried it a screen
   * deep behind a second decision.
   */
  const report = (state: RipenessState) => {
    const reward = addReport(tree.id, state, null);
    if (!reward) return;
    if (reward.questCompleted) showToast(t2('toastQuest'), 'trophy');
    else showToast(t2('toastReport'), 'checkmark-circle');
  };

  /**
   * Vouch for this tree. A confirmation is a claim about where you are
   * *now*, so it takes a fresh fix rather than the one the screen loaded
   * with, and the high-accuracy read is worth the extra second: the whole
   * value of the vouch is that it came from the spot.
   */
  const confirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setConfirmError(t2('confirm_no_fix'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, accuracy } = pos.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setConfirmError(t2('confirm_no_fix'));
        return;
      }
      const result = await confirmTree(
        tree.id,
        { lat: latitude, lng: longitude },
        Number.isFinite(accuracy) ? accuracy : null
      );
      if (!result.ok) {
        setConfirmError(confirmRejectionLabel(result.reason));
        return;
      }
      // Crossing the threshold is the news worth interrupting for; a
      // confirmation that only moves the count gets the plain toast.
      if (result.status === 'active') showToast(t2('toastVerified'), 'shield-checkmark');
      else showToast(t2('toastConfirmed'), 'checkmark-circle');
    } catch {
      setConfirmError(t2('confirm_no_fix'));
    } finally {
      setConfirming(false);
    }
  };

  const walkThere = async () => {
    setRouting('busy');
    try {
      // `here` only exists if permission was already granted; asking for a
      // route is the moment where prompting for it is warranted.
      let from = here;
      if (!from) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('location permission denied');
        const pos = await Location.getCurrentPositionAsync({});
        from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      const result = await fetchWalkingRoute(from, { lat: tree.lat, lng: tree.lng });
      setRoute({ treeId: tree.id, treeLabel: treeTitle(tree), ...result });
      setRouting('idle');
      router.navigate('/'); // back to the map, which draws the route
    } catch {
      setRouting('error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader
        title={treeTitle(tree)}
        right={
          <Pressable
            onPress={() => toggleFavorite(tree.id)}
            hitSlop={10}
            disabled={!profile}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? t2('removeFavorite') : t2('addFavorite')}
            accessibilityState={{ selected: isFavorite }}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? t.red : profile ? t.muted : t.line}
            />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {tree.photoUri && (
          <Image source={{ uri: tree.photoUri }} style={styles.photo} resizeMode="cover" />
        )}

        <View style={styles.badgeRow}>
          <AccessBadge access={tree.access} />
          {distance !== null && (
            <Text style={{ color: t.muted, fontSize: 14 }}>
              {formatKm(distance / 1000)} · {formatWalkTime(walkMinutes(distance))}
            </Text>
          )}
          {tree.status === 'unverified' && (
            <View style={[styles.unverified, { borderColor: t.line }]}>
              <Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>
                {t2('unverified')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.ripenessRow}>
          {latest ? (
            <>
              <View style={[styles.dot, { backgroundColor: ripenessColors[latest.state] }]} />
              <Text style={{ color: t.ink, fontSize: 13, fontWeight: '600' }}>
                {ripenessLabels[latest.state]}
              </Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>· {timeAgo(latest.createdAt)}</Text>
            </>
          ) : (
            <Text style={{ color: t.muted, fontSize: 13 }}>{t2('noReports')}</Text>
          )}
        </View>

        {season && (
          <Text style={{ color: t.muted, fontSize: 14 }}>
            {t2('usualSeason')} <Text style={{ color: t.ink, fontWeight: '600' }}>{season}</Text>
          </Text>
        )}

        {tree.description && (
          <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>{tree.description}</Text>
        )}

        <Text style={{ color: t.muted, fontSize: 13 }}>
          {t2('addedBy', { name: author?.username ?? '?', when: timeAgo(tree.createdAt) })}
        </Text>

        <Pressable
          onPress={walkThere}
          disabled={routing === 'busy'}
          style={({ pressed }) => [
            styles.walkButton,
            { backgroundColor: t.green, opacity: routing === 'busy' ? 0.6 : pressed ? 0.85 : 1 },
          ]}>
          <Ionicons name="walk" size={20} color="#FFFFFF" />
          <Text style={styles.walkLabel}>
            {routing === 'busy' ? t2('findingRoute') : t2('walkThere')}
          </Text>
        </Pressable>
        {routing === 'error' && (
          <Text style={{ color: t.red, fontSize: 13 }}>{t2('routeError')}</Text>
        )}

        {profile?.id === tree.createdBy && (
          <Pressable
            onPress={() => router.push({ pathname: '/add-tree', params: { editId: tree.id } })}
            hitSlop={8}
            style={styles.editRow}>
            <Ionicons name="pencil" size={16} color={t.green} />
            <Text style={{ color: t.green, fontSize: 14, fontWeight: '600' }}>{t2('edit')}</Text>
          </Pressable>
        )}

        <View style={[styles.section, { borderTopColor: t.line }]}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('verifyTitle')}</Text>
          {tree.status === 'unverified' ? (
            <View style={[styles.verifyBox, { backgroundColor: t.amberSoft }]}>
              <Text style={{ color: t.amber, fontSize: 14, lineHeight: 20 }}>
                {t2('verifyUnverified')}
              </Text>
              {/* Zero left but still unverified means the count has arrived
                  and the status has not caught up yet; claiming it needs one
                  more picker would be a lie. */}
              {confirmationsRemaining(tree) > 0 && (
                <Text style={{ color: t.amber, fontSize: 14, lineHeight: 20 }}>
                  {t2('verifyNeeds', { n: confirmationsRemaining(tree) })}
                </Text>
              )}
            </View>
          ) : tree.confirmations > 0 ? (
            <View style={styles.verifyRow}>
              <Ionicons name="shield-checkmark" size={18} color={t.green} />
              <Text style={{ color: t.ink, fontSize: 14, flex: 1 }}>
                {t2('verifyConfirmed', { n: tree.confirmations })}
              </Text>
            </View>
          ) : (
            // Active on nobody's vote: a seed pin, or one that predates the
            // verification rules and was grandfathered in.
            <Text style={{ color: t.muted, fontSize: 14 }}>{t2('verifyTrusted')}</Text>
          )}

          {/* Only a pin that still needs vouching gets a button. The author
              can't vouch for their own, and letting anyone confirm anything
              already verified would turn the reward into something you farm
              across the map rather than earn at a tree. */}
          {profile && tree.status === 'unverified' && profile.id !== tree.createdBy && (
            <>
              <Pressable
                onPress={confirm}
                disabled={confirming}
                style={({ pressed }) => [
                  styles.confirmButton,
                  {
                    backgroundColor: t.greenSoft,
                    opacity: confirming ? 0.6 : pressed ? 0.8 : 1,
                  },
                ]}>
                <Ionicons name="location" size={18} color={t.green} />
                <Text style={{ color: t.green, fontSize: 15, fontWeight: '700' }}>
                  {confirming ? t2('verifyChecking') : t2('verifyCta')}
                </Text>
              </Pressable>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {t2('verifyHint', { m: VERIFY.confirmRadiusM })}
              </Text>
            </>
          )}
          {confirmError && <Text style={{ color: t.red, fontSize: 13 }}>{confirmError}</Text>}
        </View>

        <View style={[styles.section, { borderTopColor: t.line }]}>
          <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('howIsIt')}</Text>
          {profile ? (
            <View style={styles.chipRow}>
              {RIPENESS_STATES.map((state) => (
                <Chip
                  key={state}
                  label={ripenessLabels[state]}
                  dotColor={ripenessColors[state]}
                  onPress={() => report(state)}
                />
              ))}
            </View>
          ) : (
            <Text style={{ color: t.muted, fontSize: 14 }}>{t2('signInToReport')}</Text>
          )}
        </View>

        {treeReports.length > 0 && (
          <View style={[styles.section, { borderTopColor: t.line }]}>
            <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('reports')}</Text>
            {treeReports.map((r) => {
              const reporter = profiles.find((p) => p.id === r.userId);
              return (
                <View key={r.id} style={styles.reportRow}>
                  <View style={[styles.dot, { backgroundColor: ripenessColors[r.state] }]} />
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
              {t2('flagThanks', { reason: flagLabels[flagged] })}
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
                    styles.flagChip,
                    { backgroundColor: t.redSoft, opacity: pressed ? 0.7 : 1 },
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
                {profile ? t2('reportProblem') : t2('signInToFlag')}
              </Text>
            </Pressable>
          )}
        </View>

        {profile?.id === tree.createdBy && (
          <View style={[styles.section, { borderTopColor: t.line }]}>
            <Pressable
              onPress={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                removeTree(tree.id);
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              hitSlop={8}>
              <Text style={{ color: t.red, fontSize: 14, fontWeight: '700' }}>
                {confirmDelete ? t2('deleteConfirm') : t2('deleteTree')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  photo: { width: '100%', height: 200, borderRadius: 14 },
  badgeRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  unverified: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  ripenessRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  walkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 4,
  },
  walkLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  section: { borderTopWidth: 1, paddingTop: 16, marginTop: 6, gap: 10 },
  verifyBox: { padding: 12, borderRadius: 10, gap: 6 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
