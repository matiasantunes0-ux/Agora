import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

const SENTIMENT = {
  bullish: { label: 'Bullish', icon: 'trending-up', color: colors.gain, bg: colors.gainBg },
  bearish: { label: 'Bearish', icon: 'trending-down', color: colors.loss, bg: colors.lossBg },
};

// Highlights $TICKER cashtags
function RichText({ text }) {
  const parts = text.split(/(\$[A-Z]{1,5}\b)/g);
  return (
    <Text style={styles.body}>
      {parts.map((part, i) =>
        /^\$[A-Z]{1,5}$/.test(part) ? (
          <Text key={i} style={styles.cashtag}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

export default function ThoughtCard({ thought, profile }) {
  const sentiment = SENTIMENT[thought.sentiment];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image source={{ uri: profile.avatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.meta}>
            @{profile.username} · {thought.time}
          </Text>
        </View>
        {sentiment && (
          <View style={[styles.sentiment, { backgroundColor: sentiment.bg }]}>
            <Ionicons name={sentiment.icon} size={13} color={sentiment.color} />
            <Text style={[styles.sentimentText, { color: sentiment.color }]}>{sentiment.label}</Text>
          </View>
        )}
      </View>

      <RichText text={thought.text} />

      <View style={styles.actions}>
        <View style={styles.action}>
          <Ionicons name="heart-outline" size={18} color={colors.textMuted} />
          <Text style={styles.actionText}>{thought.likes}</Text>
        </View>
        <View style={styles.action}>
          <Ionicons name="chatbubble-outline" size={17} color={colors.textMuted} />
          <Text style={styles.actionText}>{thought.replies}</Text>
        </View>
        <View style={styles.action}>
          <Ionicons name="bookmark-outline" size={17} color={colors.textMuted} />
        </View>
        <View style={styles.action}>
          <Ionicons name="share-social-outline" size={18} color={colors.textMuted} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
  },
  name: {
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sentiment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  sentimentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  cashtag: {
    color: colors.primary,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
