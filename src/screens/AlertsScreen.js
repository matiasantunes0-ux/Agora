import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AlertCard from '../components/alerts/AlertCard';
import AlertFilters from '../components/alerts/AlertFilters';
import WatchlistBar from '../components/alerts/WatchlistBar';
import { MAX_WATCHLIST } from '../services/alerts';
import { useAlertsFeed } from '../services/alerts/useAlertsFeed';
import { colors, radius, spacing } from '../theme';

const SOURCE_LABEL = { sec_edgar: 'SEC filings', finnhub: 'News & prices' };

function Banner({ icon, text }) {
  return (
    <View style={styles.banner}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export default function AlertsScreen() {
  const feed = useAlertsFeed();
  const [tickerFilter, setTickerFilter] = useState(null);
  const [kindFilter, setKindFilter] = useState('all');

  // Drop a ticker filter that no longer exists (e.g. the ticker was removed).
  const activeTicker = tickerFilter && feed.watchlist.includes(tickerFilter) ? tickerFilter : null;

  const byTicker = useMemo(
    () => (activeTicker ? feed.alerts.filter((a) => a.ticker === activeTicker) : feed.alerts),
    [feed.alerts, activeTicker],
  );
  const visible = useMemo(
    () => (kindFilter === 'all' ? byTicker : byTicker.filter((a) => a.kind === kindFilter)),
    [byTicker, kindFilter],
  );
  const counts = useMemo(() => ({
    all: byTicker.length,
    opportunity: byTicker.filter((a) => a.kind === 'opportunity').length,
    threat: byTicker.filter((a) => a.kind === 'threat').length,
  }), [byTicker]);

  const header = (
    <View>
      <WatchlistBar watchlist={feed.watchlist} max={MAX_WATCHLIST} onAdd={feed.addTicker} onRemove={feed.removeTicker} />
      {feed.offline && <Banner icon="cloud-offline-outline" text="Can’t reach Agora right now. Showing saved alerts." />}
      {feed.delayedSources.length > 0 && (
        <Banner
          icon="time-outline"
          text={`${feed.delayedSources.map((s) => SOURCE_LABEL[s] ?? s).join(' & ')} delayed. Alerts may arrive late.`}
        />
      )}
      {feed.watchlist.length > 0 && (
        <AlertFilters
          tickers={feed.watchlist}
          ticker={activeTicker}
          kind={kindFilter}
          onTicker={setTickerFilter}
          onKind={setKindFilter}
          counts={counts}
        />
      )}
    </View>
  );

  const empty = feed.loading ? (
    <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
  ) : (
    <View style={styles.empty}>
      <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
      <Text style={styles.emptyTitle}>
        {feed.watchlist.length === 0 ? 'Add a stock to start' : 'Nothing material yet'}
      </Text>
      <Text style={styles.emptyText}>
        {feed.watchlist.length === 0
          ? 'We scan news and filings and only alert you when something could move the price.'
          : 'Routine news is filtered out. You’ll be notified when something important happens.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Alerts</Text>
          <Text style={styles.subtitle}>News & opportunity scanner</Text>
        </View>
        {feed.mode === 'mock' && (
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>DEMO DATA</Text>
          </View>
        )}
      </View>

      <FlatList
        style={styles.list}
        data={visible}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => <AlertCard alert={item} isNew={feed.newIds.has(item.id)} onSeen={feed.markSeen} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.primary} />}
      />

      {/* Outside the list so it stays visible while scrolling. */}
      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
        <Text style={styles.footerText}>Informational only, not investment advice.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  demoText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
  },
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
