import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PeopleMap } from './types';

interface AvatarProps {
  authorKey: string;
  people: PeopleMap;
  size?: number;
  ring?: boolean;
  ringColor?: string;
}

export function Avatar({
  authorKey,
  people,
  size = 22,
  ring = false,
  ringColor = 'transparent',
}: AvatarProps) {
  const person = people[authorKey];
  if (!person) return null;

  const initial = authorKey.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: person.color,
          borderWidth: ring ? 2 : 0,
          borderColor: ring ? ringColor : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          { fontSize: size * 0.46, color: '#0b0f14' },
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initial: {
    fontWeight: '600',
  },
});
