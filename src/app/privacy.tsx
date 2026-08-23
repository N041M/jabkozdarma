import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { privacySections } from '@/lib/privacy-text';

export default function PrivacyScreen() {
  const t = useTheme();
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
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
