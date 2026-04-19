import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/constants/ThemeContext';
import { radius, spacing } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  userName: string;
}

function SettingRow({ icon, label, value, chevron, colors }: {
  icon: string;
  label: string;
  value: string;
  chevron?: boolean;
  colors: any;
}) {
  const rowStyles = getRowStyles(colors);
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
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <Text style={styles.title}>Settings</Text>

          <ScrollView>
            <SettingRow icon="👤" label="Name" value={userName} colors={colors} />
            <SettingRow icon="📧" label="Email" value="Tap to set" colors={colors} />
            <SettingRow icon="💱" label="Currency" value="PHP ₱" colors={colors} />
            <SettingRow icon="🔔" label="Notifications" value="On" colors={colors} />
            <SettingRow icon="🌙" label="Theme" value="Dark" colors={colors} />

            <View style={styles.divider} />

            <SettingRow icon="📱" label="Version" value="5.0.1" colors={colors} />
            <SettingRow icon="ℹ️" label="About AfterStay" value="" chevron colors={colors} />
            <SettingRow icon="📝" label="Send Feedback" value="" chevron colors={colors} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const getRowStyles = (colors: any) => StyleSheet.create({
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

const getStyles = (colors: any) => StyleSheet.create({
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
