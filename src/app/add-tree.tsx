import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip, FieldLabel, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { monthShort, t as t2 } from '@/lib/i18n';
import { accessLabels, pinRejectionLabel, speciesLabels } from '@/lib/labels';
import { discoveredVarieties } from '@/lib/dex';
import { capturePhoto, pickPhoto } from '@/lib/photo';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { SPECIES, type AccessType, type Species } from '@/lib/types';

const ACCESS_TYPES: AccessType[] = ['public', 'roadside', 'ask_owner'];

/** A route param that is a number, or null for the empty string the map sends. */
function numberOrNull(raw: string | undefined): number | null {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

const SEASONS: { label: string; start: number | null; end: number | null }[] = [
  { label: t2('notSure'), start: null, end: null },
  ...[7, 8, 9, 10].map((m) => ({
    label: `${monthShort(m)} – ${monthShort(m + 1)}`,
    start: m,
    end: m + 1,
  })),
];

export default function AddTree() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    nearby?: string;
    accuracy?: string;
    placed?: string;
    editId?: string;
  }>();

  const addTree = useStore((s) => s.addTree);
  const updateTree = useStore((s) => s.updateTree);
  const editing = useStore((s) => s.trees.find((tr) => tr.id === params.editId));
  const seenVarieties = useStore((s) => s.seenVarieties);
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const profile = useStore((s) => s.profile);
  const pendingPhoto = useStore((s) => s.pendingPhoto);
  const showToast = useToast((s) => s.show);

  const [species, setSpecies] = useState<Species>(editing?.species ?? 'apple');
  const [variety, setVariety] = useState(editing?.variety ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [access, setAccess] = useState<AccessType>(editing?.access ?? 'public');
  const [seasonIdx, setSeasonIdx] = useState(() => {
    if (!editing?.seasonStart) return 0;
    const idx = SEASONS.findIndex((s) => s.start === editing.seasonStart);
    return idx === -1 ? 0 : idx;
  });
  // A plain read, never a write: clearing the slot here would be a store
  // update during render. The map sets it on every add, so it can't go stale,
  // and editing an existing pin must not inherit it.
  const [photoUri, setPhotoUri] = useState<string | null>(() =>
    params.editId ? (editing?.photoUri ?? null) : pendingPhoto
  );
  const [refused, setRefused] = useState<string | null>(null);

  const nearbyCount = Number(params.nearby ?? 0);

  /**
   * The evidence the aim carried, as the map measured it.
   *
   * `Number('')` is 0, and an empty string is what the map sends when it has
   * nothing to report — so coercing either of these blind would claim a
   * perfect zero-metre fix, and a pin placed exactly underfoot, at precisely
   * the moment there was no reading at all.
   */
  const accuracyM = numberOrNull(params.accuracy);
  const placedDistanceM = numberOrNull(params.placed);

  const shoot = async () => {
    const uri = await capturePhoto();
    if (uri) setPhotoUri(uri);
  };

  const choose = async () => {
    const uri = await pickPhoto();
    if (uri) setPhotoUri(uri);
  };

  const save = () => {
    const season = SEASONS[seasonIdx];
    const fields = {
      species,
      variety: variety.trim() || null,
      description: description.trim() || null,
      access,
      seasonStart: season.start,
      seasonEnd: season.end,
      photoUri,
    };
    if (editing) {
      updateTree(editing.id, fields);
      if (router.canGoBack()) router.back();
      else router.replace(`/tree/${editing.id}`);
      return;
    }
    // Guard against opening this form without map coordinates (deep link,
    // refresh) — a NaN tree would poison persisted state and crash the map.
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      router.replace('/');
      return;
    }
    // Read this *before* saving — addTree is what adds the variety to the set.
    const named = fields.variety;
    const known = discoveredVarieties({
      seen: seenVarieties,
      trees,
      reports,
      profileId: profile?.id,
    });
    const isNewVariety =
      !!named && !known.some((v) => v.toLocaleLowerCase('cs') === named.toLocaleLowerCase('cs'));

    const result = addTree({
      lat,
      lng,
      accuracyM,
      placedDistanceM,
      ...fields,
    });
    if (!result.ok) {
      // Stay on the form. Every rejection except a missing profile is
      // something the picker can act on — move a few steps, come back
      // tomorrow — and throwing the filled-in form away would punish them
      // for it.
      if (result.reason === 'no_profile') {
        router.replace('/');
        return;
      }
      setRefused(pinRejectionLabel(result.reason));
      return;
    }
    const tree = result.tree;
    // A variety nobody has pinned before is the more interesting news, so it
    // wins the toast; the XP is on the button already.
    if (isNewVariety && named) showToast(t2('toastDex', { name: named }), 'grid');
    else showToast(t2('toastTree'), 'checkmark-circle');
    router.replace(`/tree/${tree.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* A form you opened by mistake should cost one tap to leave, so the
          add flow gets a close control rather than a back arrow. */}
      <ScreenHeader title={editing ? t2('saveChanges') : t2('addTreeTitle')} close={!editing} />
      <ScrollView contentContainerStyle={styles.content}>
      {/* Where the pin actually went, and how much the app can say about it.
          Amber when nothing backs the aim but the picker's own eye: the pin
          is welcome either way, but that is worth one glance before saving. */}
      {!editing && (
        <View
          style={[
            styles.placed,
            { backgroundColor: placedDistanceM === null ? t.amberSoft : t.greenSoft },
          ]}>
          <Ionicons
            name="location"
            size={18}
            color={placedDistanceM === null ? t.amber : t.green}
          />
          <Text
            style={{
              color: placedDistanceM === null ? t.amber : t.green,
              fontSize: 13,
              flex: 1,
            }}>
            {placedDistanceM === null
              ? t2('placedByHand')
              : placedDistanceM < 3
                ? t2('placedAtYou')
                : t2('placedNear', { n: Math.round(placedDistanceM) })}
          </Text>
        </View>
      )}

      {nearbyCount > 0 && !editing && (
        <View style={[styles.warning, { backgroundColor: t.amberSoft }]}>
          <Ionicons name="alert-circle" size={18} color={t.amber} />
          <Text style={{ color: t.amber, fontSize: 13, flex: 1 }}>
            {t2('duplicateWarning', { count: nearbyCount })}
          </Text>
        </View>
      )}

      {refused && (
        <View style={[styles.warning, { backgroundColor: t.redSoft }]}>
          <Ionicons name="close-circle" size={18} color={t.red} />
          <Text style={{ color: t.red, fontSize: 13, flex: 1 }}>{refused}</Text>
        </View>
      )}

      {/* The photo leads. It is the one thing you can only capture at the
          tree, it identifies the find better than any chip, and when the map
          shot it on the way in this is where you confirm it came out. */}
      <FieldLabel>{t2('photoLabel')}</FieldLabel>
      {photoUri ? (
        <View>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          <Pressable
            onPress={() => setPhotoUri(null)}
            style={styles.removePhoto}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t2('removePhoto')}>
            <Ionicons name="close-circle" size={26} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.photoRow}>
          <Pressable
            onPress={shoot}
            accessibilityRole="button"
            accessibilityLabel={t2('takePhoto')}
            style={({ pressed }) => [
              styles.photoPicker,
              styles.photoPrimary,
              { borderColor: t.green, backgroundColor: t.greenSoft, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Ionicons name="camera" size={26} color={t.green} />
            <Text style={{ color: t.green, fontSize: 13, fontWeight: '700' }}>
              {t2('takePhoto')}
            </Text>
          </Pressable>
          <Pressable
            onPress={choose}
            accessibilityRole="button"
            accessibilityLabel={t2('choosePhoto')}
            style={({ pressed }) => [
              styles.photoPicker,
              { borderColor: t.line, backgroundColor: t.surface, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Ionicons name="images-outline" size={26} color={t.muted} />
            <Text style={{ color: t.muted, fontSize: 13 }}>{t2('choosePhoto')}</Text>
          </Pressable>
        </View>
      )}

      <FieldLabel>{t2('speciesLabel')}</FieldLabel>
      <View style={styles.chipRow}>
        {SPECIES.map((sp) => (
          <Chip
            key={sp}
            label={speciesLabels[sp]}
            selected={species === sp}
            onPress={() => setSpecies(sp)}
          />
        ))}
      </View>

      <FieldLabel>{t2('varietyLabel')}</FieldLabel>
      <TextInput
        value={variety}
        onChangeText={setVariety}
        placeholder={t2('varietyPlaceholder')}
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.line }]}
      />

      <FieldLabel>{t2('notesLabel')}</FieldLabel>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t2('notesPlaceholder')}
        placeholderTextColor={t.muted}
        multiline
        numberOfLines={3}
        style={[
          styles.input,
          styles.multiline,
          { backgroundColor: t.surface, color: t.ink, borderColor: t.line },
        ]}
      />

      <FieldLabel>{t2('accessLabel')}</FieldLabel>
      <View style={styles.chipRow}>
        {ACCESS_TYPES.map((a) => (
          <Chip
            key={a}
            label={accessLabels[a]}
            selected={access === a}
            onPress={() => setAccess(a)}
          />
        ))}
      </View>
      {access === 'ask_owner' && (
        <Text style={{ color: t.muted, fontSize: 13 }}>{t2('ownerHint')}</Text>
      )}

      <FieldLabel>{t2('seasonLabel')}</FieldLabel>
      <View style={styles.chipRow}>
        {SEASONS.map((season, i) => (
          <Chip
            key={season.label}
            label={season.label}
            selected={seasonIdx === i}
            onPress={() => setSeasonIdx(i)}
          />
        ))}
      </View>

        <Pressable
          onPress={save}
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: t.green, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={styles.saveLabel}>{editing ? t2('saveChanges') : t2('addToMap')}</Text>
        </Pressable>
        {!editing && (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
            {t2('saveReward')}
          </Text>
        )}
        {!editing && (
          <Text style={{ color: t.muted, fontSize: 12, textAlign: 'center' }}>
            {t2('verifyUnverified')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 10,
    paddingBottom: 48,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  placed: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '100%', height: 140, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoPicker: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  /** The camera is the intended path, so it reads as a real control. */
  photoPrimary: { borderStyle: 'solid' },
  save: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
