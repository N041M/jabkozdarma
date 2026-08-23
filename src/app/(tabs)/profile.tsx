import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { timeAgo } from '@/lib/labels';
import { useStore } from '@/lib/store';
import { isBackendConfigured } from '@/lib/supabase';

export default function ProfileScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useStore((s) => s.profile);
  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const favorites = useStore((s) => s.favorites);
  const signIn = useStore((s) => s.signIn);
  const signOut = useStore((s) => s.signOut);
  const sendCode = useStore((s) => s.sendCode);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [authStep, setAuthStep] = useState<'form' | 'sent'>('form');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const submitEmail = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await sendCode(email, username);
      setAuthStep('sent');
    } catch {
      setAuthError(t2('sendError'));
    } finally {
      setAuthBusy(false);
    }
  };

  const myTrees = useMemo(
    () => (profile ? trees.filter((tr) => tr.createdBy === profile.id) : []),
    [trees, profile]
  );
  const myReports = useMemo(
    () => (profile ? reports.filter((r) => r.userId === profile.id) : []),
    [reports, profile]
  );
  const favoriteTrees = useMemo(
    () => trees.filter((tr) => favorites.includes(tr.id)),
    [trees, favorites]
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      {!profile ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Ionicons name="person-circle-outline" size={44} color={t.green} />
          <Text style={[styles.title, { color: t.ink }]}>{t2('joinTitle')}</Text>
          <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>{t2('joinCopy')}</Text>

          {!isBackendConfigured ? (
            <>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t2('usernamePlaceholder')}
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: t.bg, color: t.ink, borderColor: t.line }]}
                onSubmitEditing={() => signIn(username)}
              />
              <Button
                label={t2('createProfile')}
                onPress={() => signIn(username)}
                disabled={!username.trim()}
              />
              <Text style={{ color: t.muted, fontSize: 12, lineHeight: 17 }}>
                {t2('localProfileNote')}
              </Text>
            </>
          ) : authStep === 'form' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t2('emailPlaceholder')}
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={[styles.input, { backgroundColor: t.bg, color: t.ink, borderColor: t.line }]}
                onSubmitEditing={submitEmail}
              />
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder={t2('usernamePlaceholder')}
                placeholderTextColor={t.muted}
                autoCapitalize="none"
                style={[styles.input, { backgroundColor: t.bg, color: t.ink, borderColor: t.line }]}
              />
              <Text style={{ color: t.muted, fontSize: 12 }}>{t2('usernameHint')}</Text>
              <Button
                label={authBusy ? t2('sendingCode') : t2('sendCode')}
                onPress={submitEmail}
                disabled={authBusy || !email.includes('@')}
              />
            </>
          ) : (
            <>
              <Text style={{ color: t.muted, fontSize: 14, lineHeight: 20 }}>
                {t2('codeSentTo', { email: email.trim() })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={t.green} />
                <Text style={{ color: t.muted, fontSize: 13 }}>{t2('waitingForLink')}</Text>
              </View>
              <Button
                label={authBusy ? t2('sendingCode') : t2('resendLink')}
                kind="secondary"
                onPress={submitEmail}
                disabled={authBusy}
              />
              <Pressable
                onPress={() => {
                  setAuthStep('form');
                  setAuthError(null);
                }}
                hitSlop={8}>
                <Text style={{ color: t.green, fontSize: 13, fontWeight: '600' }}>
                  {t2('changeEmail')}
                </Text>
              </Pressable>
            </>
          )}
          {authError && <Text style={{ color: t.red, fontSize: 13 }}>{authError}</Text>}
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: t.greenSoft }]}>
              <Text style={{ color: t.green, fontSize: 26, fontWeight: '800' }}>
                {profile.username.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: t.ink }]}>{profile.username}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {t2('joined', { when: timeAgo(profile.createdAt) })}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {(
              [
                [myTrees.length, t2('statTrees')],
                [myReports.length, t2('statReports')],
                [favoriteTrees.length, t2('statFavorites')],
              ] as const
            ).map(([n, label]) => (
              <View
                key={label}
                style={[styles.stat, { backgroundColor: t.surface, borderColor: t.line }]}>
                <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{n}</Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
              </View>
            ))}
          </View>

          {myTrees.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('myTrees')}</Text>
              {myTrees.map((tree) => (
                <Link key={tree.id} href={`/tree/${tree.id}`} asChild>
                  <Text style={[styles.link, { color: t.green }]}>
                    {tree.variety ?? t2('appleTree')} ·{' '}
                    {t2('addedWhen', { when: timeAgo(tree.createdAt) })}
                  </Text>
                </Link>
              ))}
            </View>
          )}

          {favoriteTrees.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: t.ink }]}>{t2('favorites')}</Text>
              {favoriteTrees.map((tree) => (
                <Link key={tree.id} href={`/tree/${tree.id}`} asChild>
                  <Text style={[styles.link, { color: t.green }]}>
                    {tree.variety ?? t2('appleTree')}
                    {tree.description ? ` — ${tree.description.slice(0, 40)}…` : ''}
                  </Text>
                </Link>
              ))}
            </View>
          )}

          <Button label={t2('signOut')} kind="danger" onPress={signOut} style={{ marginTop: 12 }} />
        </>
      )}

      <View style={[styles.backendRow, { borderColor: t.line }]}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isBackendConfigured ? t.green : t.amber },
          ]}
        />
        <Text style={{ color: t.muted, fontSize: 12, flex: 1 }}>
          {isBackendConfigured ? t2('backendConnected') : t2('localMode')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 720, width: '100%', alignSelf: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 2 },
  listSection: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '600' },
  backendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
