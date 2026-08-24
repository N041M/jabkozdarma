import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { t as t2 } from '@/lib/i18n';
import { privacySections } from '@/lib/privacy-text';

export default function PrivacyScreen() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScreenHeader title={t2('privacyTitle')} />
      <ScrollView contentContainerStyle={styles.content}>
      {privacySections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={[styles.heading, { color: t.ink }]}>{section.heading}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} style={[styles.body, { color: t.muted }]}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 56,
    gap: 22,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: 8 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
});
