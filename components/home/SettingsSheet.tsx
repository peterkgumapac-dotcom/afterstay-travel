import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  userName: string;
}

function SettingRow({ icon, label, value, chevron }: {
  icon: string;
  label: string;
  value: string;
  chevron?: boolean;
}) {
  return (
    <Pressable style={rowStyles.row}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>
        {value ? <Text style={rowStyles.value}>{value}</Text> : null}
        {chevron && <Text style={rowStyles.chevron}>›</Text>}
      </View>
    </Pressable>
  );
}

export default function SettingsSheet({ visible, onClose, userName }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title}>Settings</Text>

          <ScrollView>
            <SettingRow icon="👤" label="Name" value={userName} />
            <SettingRow icon="📧" label="Email" value="Tap to set" />
            <SettingRow icon="💱" label="Currency" value="PHP ₱" />
            <SettingRow icon="🔔" label="Notifications" value="On" />
            <SettingRow icon="🌙" label="Theme" value="Dark" />

            <View style={styles.divider} />

            <SettingRow icon="📱" label="Version" value="5.0.1" />
            <SettingRow icon="ℹ️" label="About AfterStay" value="" chevron />
            <SettingRow icon="📝" label="Send Feedback" value="" chevron />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.card,
  },
  icon: { fontSize: 18, marginRight: 14 },
  label: { color: colors.text, fontSize: 15, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { color: colors.text2, fontSize: 14 },
  chevron: { color: colors.text3, fontSize: 22 },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingBottom: 40,
    maxHeight: '85%',
    minHeight: '60%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border2,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.card,
    marginVertical: spacing.sm,
  },
});
