import { Image, StyleSheet, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import WrappedCard from './WrappedCard';

interface CrewMember {
  name: string;
  profilePhoto?: string;
}

interface CrewCardProps {
  members: CrewMember[];
}

export default function CrewCard({ members }: CrewCardProps) {
  return (
    <WrappedCard bg="#16120e">
      <View style={styles.content}>
        <Users size={28} color="#d8ab7a" strokeWidth={1.5} />
        <Text style={styles.title}>Your travel crew</Text>

        <View style={styles.avatarGrid}>
          {members.map((m, i) => (
            <View key={i} style={styles.memberItem}>
              {m.profilePhoto ? (
                <Image source={{ uri: m.profilePhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {m.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>
                {m.name.split(' ')[0]}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.count}>
          {members.length} {members.length === 1 ? 'traveler' : 'travelers'}
        </Text>
      </View>
    </WrappedCard>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#f1ebe2',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 16,
  },
  memberItem: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarFallback: {
    backgroundColor: 'rgba(216,171,122,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(216,171,122,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: '#d8ab7a',
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(241,235,226,0.7)',
    textAlign: 'center',
  },
  count: {
    fontSize: 14,
    color: 'rgba(241,235,226,0.45)',
    marginTop: 8,
  },
});
