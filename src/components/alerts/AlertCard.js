import { memo, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';

export const KIND_STYLE = {
  opportunity: { label: 'OPPORTUNITY', icon: 'trending-up', color: colors.gain, bg: colors.gainBg },
  threat: { label: 'THREAT', icon: 'warning', color: colors.loss, bg: colors.lossBg },
};

export function timeAgo(iso, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function AlertCard({ alert, isNew, onSeen }) {
  const [expanded, setExpanded] = useState(false);
  const kind = KIND_STYLE[alert.kind];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
    onSeen?.(alert.id);
  };

  return (
    <View style={[styles.card, { borderLeftColor: kind.color }]}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.topRow}>
          <Text style={styles.ticker}>{alert.ticker}</Text>
          {/* Icon + word, so the label never relies on color alone */}
          <View style={[styles.badge, { backgroundColor: kind.bg }]}>
            <Ionicons name={kind.icon} size={12} color={kind.color} />
            <Text style={[styles.badgeText, { color: kind.color }]}>{kind.label}</Text>
          </View>
          {isNew && <View style={styles.newDot} accessibilityLabel="New" />}
          <Text style={styles.time}>{timeAgo(alert.createdAt)}</Text>
        </View>

        <Text style={styles.headline}>{alert.headline}</Text>

        <View style={styles.expandRow}>
          <Text style={styles.expandText}>{expanded ? 'Hide details' : 'Why it matters'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <Text style={styles.why}>{alert.whyItMatters}</Text>
          <Text style={styles.sourcesLabel}>SOURCES</Text>
          {alert.sources.map((s, i) => (
            <Pressable
              key={`${s.url}-${i}`}
              onPress={() => Linking.openURL(s.url).catch(() => {})}
              style={styles.source}
              accessibilityRole="link"
            >
              <Ionicons name="link-outline" size={14} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sourceTitle} numberOfLines={2}>{s.title}</Text>
                <Text style={styles.sourceMeta}>{s.publisher}</Text>
              </View>
              <Ionicons name="open-outline" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
          <Text style={styles.stamp}>Alert sent {formatDateTime(alert.createdAt)}</Text>
        </View>
      )}
    </View>
  );
}

export default memo(AlertCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticker: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  time: {
    marginLeft: 'auto',
    fontSize: 12,
    color: colors.textMuted,
  },
  headline: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    color: colors.text,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  details: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  why: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  sourcesLabel: {
    marginTop: spacing.md,
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  sourceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  sourceMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  stamp: {
    marginTop: spacing.sm,
    fontSize: 11,
    color: colors.textMuted,
  },
});
