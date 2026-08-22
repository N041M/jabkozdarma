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

import { Button } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { accessLabels } from '@/lib/labels';
import { useStore } from '@/lib/store';
import type { AccessType } from '@/lib/types';

const ACCESS_TYPES: AccessType[] = ['public', 'roadside', 'ask_owner'];

const SEASONS: { label: string; start: number | null; end: number | null }[] = [
  { label: 'Not sure', start: null, end: null },
  { label: 'Jul – Aug', start: 7, end: 8 },
  { label: 'Aug – Sep', start: 8, end: 9 },
  { label: 'Sep – Oct', start: 9, end: 10 },
  { label: 'Oct – Nov', start: 10, end: 11 },
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
      quality: 0.4,
      base64: Platform.OS === 'web',
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    // On web, blob: URIs die on reload — persist a compact data URI instead.
    setPhotoUri(
      Platform.OS === 'web' && asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri
    );
  };

  const save = () => {
    const season = SEASONS[seasonIdx];
    const fields = {
      variety: variety.trim() || null,
      description: description.trim() || null,
      access,
      seasonStart: season.start,
      seasonEnd: season.end,
      photoUri,
    };
    if (editing) {
      updateTree(editing.id, fields);
      router.back();
      return;
    }
    const tree = addTree({
      lat: Number(params.lat),
      lng: Number(params.lng),
      ...fields,
    });
    if (tree) router.replace(`/tree/${tree.id}`);
    else router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      {nearbyCount > 0 && !editing && (
        <View style={[styles.warning, { backgroundColor: t.amberSoft }]}>
          <Ionicons name="alert-circle" size={18} color={t.amber} />
          <Text style={{ color: t.amber, fontSize: 13, flex: 1 }}>
            There {nearbyCount === 1 ? 'is already a pin' : `are already ${nearbyCount} pins`} within
            25 m of this spot. Check it isn’t the same tree before saving.
          </Text>
        </View>
      )}

      <Text style={[styles.label, { color: t.muted }]}>VARIETY (IF KNOWN)</Text>
      <TextInput
        value={variety}
        onChangeText={setVariety}
        placeholder="e.g. James Grieve"
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.surface, color: t.ink, borderColor: t.line }]}
      />

      <Text style={[styles.label, { color: t.muted }]}>NOTES</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Where exactly is it? What are the apples like?"
        placeholderTextColor={t.muted}
        multiline
        numberOfLines={3}
        style={[
          styles.input,
          styles.multiline,
          { backgroundColor: t.surface, color: t.ink, borderColor: t.line },
        ]}
      />

      <Text style={[styles.label, { color: t.muted }]}>WHO CAN PICK HERE?</Text>
      <View style={styles.chipRow}>
        {ACCESS_TYPES.map((a) => (
          <Pressable
            key={a}
            onPress={() => setAccess(a)}
            style={[
              styles.chip,
              {
                backgroundColor: access === a ? t.green : t.surface,
                borderColor: access === a ? t.green : t.line,
              },
            ]}>
            <Text style={{ color: access === a ? '#FFF' : t.ink, fontSize: 13, fontWeight: '600' }}>
              {accessLabels[a]}
            </Text>
          </Pressable>
        ))}
      </View>
      {access === 'ask_owner' && (
        <Text style={{ color: t.muted, fontSize: 13 }}>
          Pins on private land show an “ask the owner” badge. Only add them with the owner’s
          blessing.
        </Text>
      )}

      <Text style={[styles.label, { color: t.muted }]}>WHEN IS IT RIPE?</Text>
      <View style={styles.chipRow}>
        {SEASONS.map((s, i) => (
          <Pressable
            key={s.label}
            onPress={() => setSeasonIdx(i)}
            style={[
              styles.chip,
              {
                backgroundColor: seasonIdx === i ? t.green : t.surface,
                borderColor: seasonIdx === i ? t.green : t.line,
              },
            ]}>
            <Text
              style={{ color: seasonIdx === i ? '#FFF' : t.ink, fontSize: 13, fontWeight: '600' }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: t.muted }]}>PHOTO</Text>
      {photoUri ? (
        <View>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          <Pressable onPress={() => setPhotoUri(null)} style={styles.removePhoto} hitSlop={8}>
            <Ionicons name="close-circle" size={26} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={pickPhoto}
          style={[styles.photoPicker, { borderColor: t.line, backgroundColor: t.surface }]}>
          <Ionicons name="camera-outline" size={26} color={t.muted} />
          <Text style={{ color: t.muted, fontSize: 13 }}>Add a photo of the tree</Text>
        </Pressable>
      )}

      <Button label={editing ? 'Save changes' : 'Add tree to the map'} onPress={save} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  photo: { width: '100%', height: 180, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: 8, right: 8 },
  photoPicker: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 6,
  },
});
