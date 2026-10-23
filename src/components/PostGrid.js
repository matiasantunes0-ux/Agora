import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

const COLUMNS = 3;
const GAP = 3;

export default function PostGrid({ posts, onPressPost }) {
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={42} color={colors.primary} />
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyText}>Share your first photo with Agora.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {posts.map((post, i) => (
        <Pressable
          key={post.id}
          onPress={() => onPressPost?.(post)}
          style={{
            width: size,
            height: size,
            marginRight: (i + 1) % COLUMNS === 0 ? 0 : GAP,
            marginBottom: GAP,
          }}
        >
          <Image source={{ uri: post.image }} style={styles.image} />
          <View style={styles.likeBadge}>
            <Ionicons name="heart" size={11} color={colors.white} />
            <Text style={styles.likeText}>{post.likes}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
  },
  likeBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  likeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  emptyText: {
    color: colors.textMuted,
  },
});
