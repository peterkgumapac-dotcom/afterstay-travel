import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fateColors, fateText } from '@/constants/fateTheme';

interface FateHeaderProps {
  kicker: string;
  headline: string;
  body?: string;
}

export default function FateHeader({ kicker, headline, body }: FateHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  kicker: { ...fateText.kicker, marginBottom: 6 },
  headline: { ...fateText.headline, marginBottom: 8 },
  body: { ...fateText.body, color: fateColors.textSecondary },
});
