import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import DonutChart from './DonutChart';
import ChangePill, { formatPct } from './ChangePill';
import { colors, numeric, radius, spacing } from '../theme';

const PERIODS = ['1M', '6M', '1Y', '5Y'];

export function formatMoney(n, { sign = false } = {}) {
  const abs = Math.abs(n).toFixed(2);
  const [int, dec] = abs.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = n < 0 ? '-' : sign ? '+' : '';
  return `${prefix}$${withCommas}.${dec}`;
}

export default function PortfolioCard({ portfolio }) {
  const [period, setPeriod] = useState('1Y');
  const [selected, setSelected] = useState(null); // ticker or null

  const { holdings, totalValue, benchmark } = portfolio;
  const selectedHolding = holdings.find((h) => h.ticker === selected);

  const portfolioReturn = holdings.reduce((sum, h) => sum + h.weight * h.returns[period], 0);
  const shownReturn = selectedHolding ? selectedHolding.returns[period] : portfolioReturn;
  const shownValue = selectedHolding ? totalValue * selectedHolding.weight : totalValue;
  const dollarChange = shownValue - shownValue / (1 + shownReturn / 100);
  const vsBenchmark = shownReturn - benchmark.returns[period];

  const slices = holdings.map((h, i) => ({
    key: h.ticker,
    value: h.weight,
    color: colors.series[i],
  }));

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PORTFOLIO</Text>
          <Text style={[styles.total, numeric]}>{formatMoney(totalValue)}</Text>
        </View>
        <View style={styles.publicChip}>
          <Ionicons name="eye-outline" size={12} color={colors.primary} />
          <Text style={styles.publicText}>Public</Text>
        </View>
      </View>

      {/* Donut + returns box */}
      <View style={styles.row}>
        <DonutChart
          slices={slices}
          size={124}
          selected={selected}
          onSelect={setSelected}
          centerTop={selectedHolding ? `${Math.round(selectedHolding.weight * 100)}%` : holdings.length}
          centerBottom={selectedHolding ? selectedHolding.ticker : 'HOLDINGS'}
        />

        <View style={styles.returnsBox}>
          <View style={styles.segment}>
            {PERIODS.map((p) => {
              const active = p === period;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  hitSlop={4}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.returnLabel}>
            {selectedHolding ? `${selectedHolding.ticker} return` : 'Total return'} · {period}
          </Text>
          <Text
            style={[styles.returnValue, numeric, { color: shownReturn >= 0 ? colors.gain : colors.loss }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatPct(shownReturn)}
          </Text>
          <Text style={[styles.dollarChange, numeric]}>{formatMoney(dollarChange, { sign: true })}</Text>

          <View style={styles.benchRow}>
            <Text style={styles.benchLabel}>vs {benchmark.name}</Text>
            <ChangePill value={vsBenchmark} />
          </View>
        </View>
      </View>

      {/* Holdings table — doubles as the chart legend */}
      <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 1 }]}>HOLDING</Text>
          <Text style={[styles.th, styles.thRight, { width: 56 }]}>WEIGHT</Text>
          <Text style={[styles.th, styles.thRight, { width: 78 }]}>{period}</Text>
        </View>
        {holdings.map((h, i) => {
          const isSelected = selected === h.ticker;
          return (
            <Pressable
              key={h.ticker}
              onPress={() => setSelected(isSelected ? null : h.ticker)}
              style={[styles.tr, isSelected && styles.trSelected]}
            >
              <View style={styles.holdingCell}>
                <View style={[styles.dot, { backgroundColor: colors.series[i] }]} />
                <View>
                  <Text style={styles.ticker}>{h.ticker}</Text>
                  <Text style={styles.holdingName}>{h.name}</Text>
                </View>
              </View>
              <Text style={[styles.weight, numeric]}>{Math.round(h.weight * 100)}%</Text>
              <View style={{ width: 78, alignItems: 'flex-end' }}>
                <ChangePill value={h.returns[period]} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>Sample data · not investment advice</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  total: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  publicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  publicText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  returnsBox: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  segmentTextActive: {
    color: colors.onPrimary,
  },
  returnLabel: {
    marginTop: spacing.sm + 2,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  returnValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dollarChange: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  benchLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  table: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tableHead: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingBottom: 4,
    paddingHorizontal: spacing.sm,
  },
  th: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  thRight: {
    textAlign: 'right',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  trSelected: {
    backgroundColor: colors.primaryLight,
  },
  holdingCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  ticker: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  holdingName: {
    fontSize: 11,
    color: colors.textMuted,
  },
  weight: {
    width: 56,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  disclaimer: {
    marginTop: spacing.sm,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
