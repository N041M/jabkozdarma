import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import {
  DEX_TARGET,
  QUEST_TARGET,
  SPECIES_FRUIT,
  XP_PER_LEVEL,
  buildDex,
  discoveredVarieties,
  levelFor,
  streakFrom,
  weekCells,
  weekKey,
} from '@/lib/dex';
import { dayShort, t as t2 } from '@/lib/i18n';
import { useStore } from '@/lib/store';

const COLUMNS = 3;
const GRID_GAP = 8;

/**
 * Jablkodex: the reason to report a tree you have already found. Everything
 * on this screen is derived from contributions that were going to happen
 * anyway — no separate currency, no separate actions.
 */
export default function DexScreen() {
  const t = useTheme();
  const xp = useStore((s) => s.xp);
  const activeDays = useStore((s) => s.activeDays);
  const questWeek = useStore((s) => s.questWeek);
  const questTrees = useStore((s) => s.questTrees);
  const questRewarded = useStore((s) => s.questRewarded);
  const seenVarieties = useStore((s) => s.seenVarieties);
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const profile = useStore((s) => s.profile);

  const [gridWidth, setGridWidth] = useState(0);

  const discovered = useMemo(
    () => discoveredVarieties({ seen: seenVarieties, trees, reports, profileId: profile?.id }),
    [seenVarieties, trees, reports, profile?.id]
  );
  const tiles = useMemo(() => buildDex(discovered), [discovered]);
  const found = tiles.filter((tile) => tile.found).length;
  const level = levelFor(xp);
  const intoLevel = xp % XP_PER_LEVEL;
  const streak = useMemo(() => streakFrom(activeDays), [activeDays]);
  const cells = useMemo(() => weekCells(activeDays, dayShort), [activeDays]);

  // A stale week shows an empty counter rather than last week's progress;
  // the store resets it for real on the next contribution.
  const thisWeek = questWeek === weekKey() ? Math.min(QUEST_TARGET, questTrees.length) : 0;
  const questDone = thisWeek >= QUEST_TARGET && questRewarded;

  const tileWidth =
    gridWidth > 0 ? (gridWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={t2('dexTitle')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={{ color: t.muted, fontSize: 14 }}>
          {t2('dexSubtitle', { n: found, total: DEX_TARGET })}
        </Text>

        <View style={{ gap: 8 }}>
          <View style={styles.rowBetween}>
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>
              {t2('level', { n: level })}
            </Text>
            <Text style={{ color: t.muted, fontSize: 13, fontWeight: '600' }}>
              {t2('xpProgress', { xp: intoLevel, max: XP_PER_LEVEL })}
            </Text>
          </View>
          <ProgressBar value={intoLevel / XP_PER_LEVEL} height={10} />
        </View>

        <View style={[styles.quest, { borderColor: t.line, backgroundColor: t.surface }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.questLabel, { color: t.muted }]}>{t2('questLabel')}</Text>
            <View style={[styles.questPill, { backgroundColor: t.greenSoft }]}>
              <Text style={{ color: t.green, fontSize: 12, fontWeight: '700' }}>
                {t2('questReward')}
              </Text>
            </View>
          </View>
          <Text style={{ color: t.ink, fontSize: 17, fontWeight: '700' }}>{t2('questTitle')}</Text>
          <View style={styles.questProgress}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={thisWeek / QUEST_TARGET} height={8} />
            </View>
            <Text style={{ color: t.ink, fontSize: 14, fontWeight: '700' }}>
              {thisWeek}/{QUEST_TARGET}
            </Text>
          </View>
          <Text style={{ color: t.muted, fontSize: 13 }}>
            {questDone ? t2('questDone') : t2('questHint')}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={19} color="#C9402F" />
            <Text style={{ color: t.ink, fontSize: 15, fontWeight: '700' }}>
              {t2('streakLabel', { n: streak })}
            </Text>
          </View>
          <View style={styles.week}>
            {cells.map((cell) => (
              <View key={cell.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View
                  style={[
                    styles.dayCell,
                    cell.state === 'done' && { backgroundColor: t.green },
                    cell.state === 'today' && {
                      backgroundColor: t.greenSoft,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: t.green,
                    },
                    cell.state === 'future' && { backgroundColor: t.subtle },
                  ]}>
                  {cell.state === 'done' && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: cell.state === 'today' ? t.green : t.muted,
                  }}>
                  {cell.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={{ color: t.ink, fontSize: 16, fontWeight: '700' }}>{t2('varieties')}</Text>
        <View
          style={styles.grid}
          onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
          {tiles.map((tile) => (
            <View
              key={tile.name}
              style={[
                styles.tile,
                { width: tileWidth },
                tile.found
                  ? { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1 }
                  : {
                      backgroundColor: t.bg,
                      borderColor: t.line,
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                    },
              ]}>
              <View
                style={[
                  styles.tileCircle,
                  { backgroundColor: tile.found ? SPECIES_FRUIT[tile.species] : t.subtle },
                ]}>
                {!tile.found && (
                  <Text style={[styles.tileUnknown, { color: t.muted }]}>?</Text>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[styles.tileName, { color: tile.found ? t.ink : t.muted }]}>
                {tile.found ? tile.name : t2('notFound')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ProgressBar({ value, height }: { value: number; height: number }) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.greenSoft, overflow: 'hidden' }}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: t.green,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quest: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  questLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  questPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  questProgress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  week: { flexDirection: 'row', gap: 6 },
  dayCell: {
    width: '100%',
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: {
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 6,
  },
  tileCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileUnknown: { fontSize: 17, fontWeight: '800' },
  tileName: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 15 },
});
