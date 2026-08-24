import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Chip, FieldLabel, ScreenHeader } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { monthShort, t as t2 } from '@/lib/i18n';
import { accessLabels, speciesLabels } from '@/lib/labels';
import { discoveredVarieties } from '@/lib/dex';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { SPECIES, type AccessType, type Species } from '@/lib/types';

const ACCESS_TYPES: AccessType[] = ['public', 'roadside', 'ask_owner'];

/** Web-only: resize a picked image down to a phone-friendly JPEG data URI. */
async function downscaleImage(uri: string, maxDim: number, quality: number): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = uri;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    if (scale === 1 && uri.length < 400_000) return uri;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return uri; // worst case keep the original
  }
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
    editId?: string;
  }>();

  const addTree = useStore((s) => s.addTree);
  const updateTree = useStore((s) => s.updateTree);
  const editing = useStore((s) => s.trees.find((tr) => tr.id === params.editId));
  const seenVarieties = useStore((s) => s.seenVarieties);
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const profile = useStore((s) => s.profile);
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
  const [photoUri, setPhotoUri] = useState<string | null>(editing?.photoUri ?? null);

  const nearbyCount = Number(params.nearby ?? 0);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: Platform.OS === 'web',
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (Platform.OS !== 'web') {
      setPhotoUri(asset.uri);
      return;
    }
    // Web: downscale before it goes anywhere. A raw phone photo as a
    // multi-MB data URI would blow the localStorage quota and freeze the
    // app re-serializing state on every change.
    const source = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    setPhotoUri(await downscaleImage(source, 1280, 0.72));
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

    const tree = addTree({ lat, lng, ...fields });
    if (!tree) {
      router.replace('/');
      return;
    }
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
      {!editing && (
        <View style={[styles.placed, { backgroundColor: t.greenSoft }]}>
          <Ionicons name="location" size={18} color={t.green} />
          <Text style={{ color: t.green, fontSize: 13, flex: 1 }}>{t2('placedHere')}</Text>
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
        <Pressable
          onPress={pickPhoto}
          style={[styles.photoPicker, { borderColor: t.line, backgroundColor: t.surface }]}>
          <Ionicons name="camera-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13 }}>{t2('addPhoto')}</Text>
        </Pressable>
      )}

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
  photoPicker: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  save: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
