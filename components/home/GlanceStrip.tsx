import { useRouter } from 'expo-router';
import { Wallet, Package, Paperclip, Camera } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  budgetSpent: number;
  budgetTotal: number;
  packingPacked: number;
  packingTotal: number;
  filesCount: number;
  photosCount: number;
}

const formatK = (n: number) => {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return n.toString();
};

export const GlanceStrip: React.FC<Props> = ({
  budgetSpent,
  budgetTotal,
  packingPacked,
  packingTotal,
  filesCount,
  photosCount,
}) => {
  const router = useRouter();

  const budgetPct = budgetTotal > 0 ? (budgetSpent / budgetTotal) * 100 : 0;
  const budgetColor =
    budgetPct > 90 ? '#ff7777' :
    budgetPct > 75 ? '#fbbf24' :
    budgetTotal > 0 ? '#2dd4a0' : '#8b95a5';

  const items = [
    {
      Icon: Wallet,
      value: budgetTotal > 0
        ? `${formatK(budgetSpent)}/${formatK(budgetTotal)}`
        : 'Set budget',
      color: budgetColor,
      onPress: () => router.push('/(tabs)/budget'),
    },
    {
      Icon: Package,
      value: `${packingPacked}/${packingTotal}`,
      color: packingTotal > 0 && packingPacked === packingTotal ? '#2dd4a0' : '#fff',
      onPress: () => router.push('/(tabs)/trip'),
    },
    {
      Icon: Paperclip,
      value: `${filesCount}`,
      color: filesCount > 0 ? '#2dd4a0' : '#8b95a5',
      onPress: () => router.push('/(tabs)/trip'),
    },
    {
      Icon: Camera,
      value: `${photosCount}`,
      color: photosCount > 0 ? '#2dd4a0' : '#8b95a5',
      onPress: () => router.push('/(tabs)/moments'),
    },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={styles.cell}
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <item.Icon color={item.color} size={20} strokeWidth={2} />
          <Text style={[styles.value, { color: item.color }]} numberOfLines={1}>
            {item.value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#0f1318',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e2530',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  value: {
    fontSize: 11,
    fontWeight: '700',
  },
});
