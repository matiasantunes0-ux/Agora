import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';

const KINDS = [
  { key: 'all', label: 'All' },
  { key: 'opportunity', label: 'Opportunities', icon: 'trending-up', color: colors.gain },
  { key: 'threat', label: 'Threats', icon: 'warning', color: colors.loss },
];

export default function AlertFilters({ tickers, ticker, kind, onTicker, onKind, counts }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        {KINDS.map((k) => {
          const active = kind === k.key;
          return (
            <Pressable key={k.key} onPress={() => onKind(k.key)} style={[styles.segBtn, active && styles.segBtnActive]}>
              {k.icon && <Ionicons name={k.icon} size={12} color={active ? colors.onPrimary : k.color} />}
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {k.label} {counts[k.key] > 0 ? `· ${counts[k.key]}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tickers.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tickers}>
          {[null, ...tickers].map((t) => {
            const active = ticker === t;
            return (
              <Pressable key={t ?? 'all'} onPress={() => onTicker(t)} style={[styles.tickerChip, active && styles.tickerChipActive]}>
                <Text style={[styles.tickerText, active && styles.tickerTextActive]}>{t ?? 'All stocks'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    padding: 3,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  segTextActive: {
    color: colors.onPrimary,
  },
  tickers: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tickerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  tickerTextActive: {
    color: colors.onPrimary,
  },
});
