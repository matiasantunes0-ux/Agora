import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, numeric } from '../theme';

export function formatPct(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

// Green/red % change with an arrow, so it never relies on color alone
export default function ChangePill({ value, size = 'sm' }) {
  const up = value >= 0;
  const big = size === 'lg';
  return (
    <View style={[styles.pill, { backgroundColor: up ? colors.gainBg : colors.lossBg }, big && styles.pillLg]}>
      <Ionicons
        name={up ? 'caret-up' : 'caret-down'}
        size={big ? 14 : 10}
        color={up ? colors.gain : colors.loss}
      />
      <Text style={[styles.text, numeric, { color: up ? colors.gain : colors.loss }, big && styles.textLg]}>
        {formatPct(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillLg: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  textLg: {
    fontSize: 15,
  },
});
