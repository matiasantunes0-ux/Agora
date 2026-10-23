import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

export function formatCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export default function StatItem({ label, value, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.stat} hitSlop={8}>
      <Text style={styles.value}>{formatCount(value)}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  label: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
});
