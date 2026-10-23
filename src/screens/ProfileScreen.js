import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import StatItem from '../components/StatItem';
import PostGrid from '../components/PostGrid';
import ThoughtCard from '../components/ThoughtCard';
import PortfolioCard from '../components/PortfolioCard';
import { colors, radius, spacing } from '../theme';

const AVATAR_SIZE = 96;
const BANNER_HEIGHT = 130;

const TABS = [
  { key: 'ideas', icon: 'bulb-outline', activeIcon: 'bulb', label: 'Ideas' },
  { key: 'posts', icon: 'grid-outline', activeIcon: 'grid', label: 'Posts' },
];

// Decorative "stock chart" line drawn across the banner
function BannerChart() {
  return (
    <Svg width="100%" height={BANNER_HEIGHT} viewBox="0 0 400 130" preserveAspectRatio="none">
      <Path
        d="M0 110 L30 98 L55 104 L85 80 L110 86 L140 62 L170 70 L200 48 L230 56 L260 34 L290 42 L320 22 L350 30 L400 8 L400 130 L0 130 Z"
        fill="rgba(34,197,94,0.08)"
      />
      <Path
        d="M0 110 L30 98 L55 104 L85 80 L110 86 L140 62 L170 70 L200 48 L230 56 L260 34 L290 42 L320 22 L350 30 L400 8"
        stroke="rgba(34,197,94,0.55)"
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

/**
 * Agora profile screen.
 *
 * Props:
 *  - profile:       user object (see src/data/mockProfile.js)
 *  - portfolio:     holdings + returns
 *  - posts:         array of image posts
 *  - thoughts:      array of text ideas
 *  - isOwnProfile:  true → "Edit profile" + tap avatar to change it
 *                   false → "Follow" button
 */
export default function ProfileScreen({ profile, portfolio, posts, thoughts, isOwnProfile = true }) {
  const [avatar, setAvatar] = useState(profile.avatar);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followers, setFollowers] = useState(profile.followers);
  const [activeTab, setActiveTab] = useState('ideas');

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
      // TODO: upload result.assets[0].uri to your backend here
    }
  };

  const toggleFollow = () => {
    setFollowers((f) => f + (isFollowing ? -1 : 1));
    setIsFollowing(!isFollowing);
  };

  const profileWithAvatar = { ...profile, avatar };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Ionicons name="trending-up" size={16} color={colors.primaryDark} />
          </View>
          <Text style={styles.logo}>agora</Text>
        </View>
        <View style={styles.topBarIcons}>
          <View style={styles.marketStatus}>
            <View style={styles.marketDot} />
            <Text style={styles.marketText}>Market open</Text>
          </View>
          <Pressable hitSlop={10}>
            <Ionicons name="search-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={10}>
            <Ionicons name="menu-outline" size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Header (index 0) */}
        <View>
          <View style={styles.banner}>
            <BannerChart />
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarRow}>
              <Pressable onPress={isOwnProfile ? pickAvatar : undefined} style={styles.avatarRing}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                {isOwnProfile && (
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={12} color={colors.onPrimary} />
                  </View>
                )}
              </Pressable>

              <View style={styles.actions}>
                {isOwnProfile ? (
                  <Pressable style={[styles.button, styles.buttonOutline]}>
                    <Text style={styles.buttonOutlineText}>Edit profile</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={toggleFollow}
                    style={[styles.button, isFollowing ? styles.buttonOutline : styles.buttonPrimary]}
                  >
                    <Text style={isFollowing ? styles.buttonOutlineText : styles.buttonPrimaryText}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                )}
                <Pressable style={[styles.iconButton]}>
                  <Ionicons name="share-outline" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.name}</Text>
              <Ionicons name="shield-checkmark" size={17} color={colors.primary} />
            </View>
            <Text style={styles.username}>@{profile.username}</Text>
            {!!profile.headline && (
              <View style={styles.headlineChip}>
                <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
                <Text style={styles.headlineText}>{profile.headline}</Text>
              </View>
            )}
            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            <View style={styles.metaRow}>
              {!!profile.location && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.metaText}>{profile.location}</Text>
                </View>
              )}
              {!!profile.website && (
                <View style={styles.metaItem}>
                  <Ionicons name="link-outline" size={13} color={colors.primary} />
                  <Text style={[styles.metaText, { color: colors.primary }]}>{profile.website}</Text>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatItem label="Ideas" value={thoughts.length + posts.length} />
              <View style={styles.divider} />
              <StatItem label="Followers" value={followers} />
              <View style={styles.divider} />
              <StatItem label="Following" value={profile.following} />
            </View>
          </View>

          <PortfolioCard portfolio={portfolio} />
          <View style={{ height: spacing.md }} />
        </View>

        {/* Tabs (index 1 — sticks to top while scrolling) */}
        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tab}>
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={18}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                {active && <View style={styles.tabIndicator} />}
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'posts' ? (
            <PostGrid posts={posts} />
          ) : (
            <View style={{ paddingTop: spacing.md }}>
              {thoughts.map((t) => (
                <ThoughtCard key={t.id} thought={t} profile={profileWithAvatar} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryDark,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoMark: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  topBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  marketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  marketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  marketText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  banner: {
    height: BANNER_HEIGHT,
    backgroundColor: colors.primaryDark,
  },
  profileCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -AVATAR_SIZE / 2,
  },
  avatarRing: {
    padding: 3,
    borderRadius: AVATAR_SIZE,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primaryLight,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: 4,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buttonOutlineText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  name: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
  },
  username: {
    fontSize: 14,
    color: colors.textMuted,
  },
  headlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  headlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  bio: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '25%',
    right: '25%',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  content: {
    minHeight: 400,
    paddingBottom: spacing.xl,
  },
});
