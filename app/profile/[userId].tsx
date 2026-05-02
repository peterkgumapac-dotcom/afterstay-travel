import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronRight,
  Instagram,
  MapPin,
  Moon,
  MoreHorizontal,
  Music2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/lib/auth';
import {
  getCompanionProfile,
  getFollowState,
  getAllUserTrips,
  getLifetimeStats,
  getMoments,
  getMutualTrips,
  getProfile,
  getPublicProfilePosts,
  getSharedMomentsWith,
  toggleFollow,
} from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { formatDatePHT } from '@/lib/utils';
import type { CompanionProfile as CompanionProfileType, FeedPost, Moment, Trip } from '@/lib/types';
import { GroupHeader } from '@/components/trip/GroupHeader';
import { TripCollage } from '@/components/trip/TripCollage';
import ProfileHeader from '@/components/profile/ProfileHeader';
import TravelStatsCard from '@/components/profile/TravelStatsCard';
import TravelMapCard from '@/components/profile/TravelMapCard';
import TopTripCard from '@/components/profile/TopTripCard';
import MemoriesGrid from '@/components/profile/MemoriesGrid';
import CountriesVisited from '@/components/profile/CountriesVisited';
import AchievementBadges from '@/components/profile/AchievementBadges';
import ProfileCustomizeSheet from '@/components/profile/ProfileCustomizeSheet';
import {
  buildAchievementBadges,
  buildCountriesVisited,
  buildProfileStatsFromTrips,
  buildTopTrip,
} from '@/lib/profileStats';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48 - 12) / 2;
const CARD_H = CARD_W * 1.25;

type TripFilter = 'all' | 'completed' | 'upcoming';

export default function CompanionProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const s = getStyles(colors);

  const [profile, setProfile] = useState<CompanionProfileType | null>(null);
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [mutualTrips, setMutualTrips] = useState<Trip[]>([]);
  const [sharedMoments, setSharedMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripFilter, setTripFilter] = useState<TripFilter>('all');
  const [myPosts, setMyPosts] = useState<FeedPost[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [customizeVisible, setCustomizeVisible] = useState(false);

  const isSelf = user?.id === userId;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const profileResult = await getCompanionProfile(userId);
      const viewingSelf = user?.id === userId;
      const [tripsResult, postsResult, followResult, ownProfileResult, lifetimeResult] = await Promise.allSettled([
        viewingSelf ? getAllUserTrips(userId) : getMutualTrips(userId),
        getPublicProfilePosts(userId, 20, 0),
        getFollowState(userId),
        viewingSelf ? getProfile(userId) : Promise.resolve(null),
        getLifetimeStats(userId),
      ]);
      const trips = tripsResult.status === 'fulfilled' ? tripsResult.value : [];
      const posts = postsResult.status === 'fulfilled' ? postsResult.value : [];
      const follow = followResult.status === 'fulfilled' ? followResult.value : { isFollowing: false };
      const resolvedOwnProfile = ownProfileResult.status === 'fulfilled' ? ownProfileResult.value : null;
      const lifetimeStats = lifetimeResult.status === 'fulfilled' ? lifetimeResult.value : null;
      const moments = viewingSelf
        ? (await Promise.allSettled(trips.slice(0, 12).map((trip) => getMoments(trip.id))))
          .flatMap((result) => result.status === 'fulfilled' ? result.value : [])
        : await getSharedMomentsWith(userId).catch(() => []);

      setProfile(lifetimeStats ? { ...profileResult, lifetimeStats } : profileResult);
      setOwnProfile(resolvedOwnProfile);
      setMutualTrips(trips);
      setSharedMoments(moments);
      setMyPosts(posts);
      setIsFollowing(follow.isFollowing);
    } catch (err) {
      if (__DEV__) console.warn('[Profile] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, userId]);

  useEffect(() => { load(); }, [load]);

  const handleFollowPress = async () => {
    if (!userId) return;
    try {
      const next = await toggleFollow(userId);
      setIsFollowing(next);
      Haptics.selectionAsync();
    } catch { /* best-effort */ }
  };

  // Filtered trips
  const filteredTrips = (() => {
    if (tripFilter === 'completed') return mutualTrips.filter(t => t.status === 'Completed');
    if (tripFilter === 'upcoming') return mutualTrips.filter(t => t.status === 'Planning' || t.status === 'Active');
    return mutualTrips;
  })();

  if (loading) {
    return (
      <SafeAreaView style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[s.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.emptyText}>Profile not found</Text>
      </SafeAreaView>
    );
  }

  const isCompanion = profile.companionStatus === 'companion';
  const privacy = profile.companionPrivacy;
  const firstName = profile.fullName.split(' ')[0];
  const stats = profile.lifetimeStats ?? buildProfileStatsFromTrips({ trips: mutualTrips, moments: sharedMoments });
  const countries = buildCountriesVisited(stats);
  const badges = buildAchievementBadges(stats);
  const topTrip = buildTopTrip(mutualTrips);
  const canSeeStats = isSelf || isCompanion || !!profile.publicStatsEnabled;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {/* Top bar */}
      <View style={s.topbar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} activeOpacity={0.7}>
          <MoreHorizontal size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          fullName={profile.fullName}
          handle={profile.handle}
          avatarUrl={profile.avatarUrl}
          bio={profile.bio}
          homeBase={profile.homeBase}
          companionStatus={profile.companionStatus}
          isSelf={isSelf}
          isFollowing={isFollowing}
          onCustomize={() => setCustomizeVisible(true)}
          onToggleFollow={handleFollowPress}
        />

        {/* Crossed Paths (non-companion only) */}
        {!isCompanion && !isSelf && profile.mutualTripCount > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Crossed Paths</Text>
            <View style={s.crossedCard}>
              <View style={s.crossedIcon}>
                <MapPin size={18} color={colors.accent} strokeWidth={1.6} />
              </View>
              <View>
                <Text style={s.crossedTitle}>
                  {mutualTrips[0]?.destination ?? 'Shared trip'}
                </Text>
                <Text style={s.crossedSub}>
                  You both traveled here
                  {mutualTrips[0]?.startDate
                    ? ` · ${new Date(mutualTrips[0].startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                    : ''}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Travel Stats */}
        {canSeeStats && (privacy.showStats || isSelf || profile.publicStatsEnabled) ? (
          <>
            <TravelStatsCard stats={stats} />
            <TravelMapCard stats={stats} />
          </>
        ) : null}

        {topTrip && (isSelf || isCompanion || profile.profileVisibility === 'public') && (
          <>
            <GroupHeader kicker="TOP TRIP" title="Travel flex" colors={colors as any} />
            <TopTripCard
              trip={topTrip}
              photoCount={sharedMoments.length}
              onPress={() => router.push({ pathname: '/trip-recap', params: { tripId: topTrip.id } } as never)}
            />
          </>
        )}

        {/* ── Trips Together — Album Grid ── */}
        {(isCompanion || isSelf) && (isSelf || privacy.showPastTrips || privacy.showUpcomingTrips) && (
          <>
            <GroupHeader
              kicker="TRIPS TOGETHER"
              title="Travel memories"
              colors={colors as any}
              action={
                mutualTrips.length > 0 ? (
                  <Text style={s.link}>All {mutualTrips.length}</Text>
                ) : undefined
              }
            />

            {/* Filter chips */}
            {mutualTrips.length > 1 && (
              <View style={s.filterRow}>
                {(['all', 'completed', 'upcoming'] as TripFilter[]).map(f => {
                  const active = tripFilter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[s.filterChip, active && s.filterChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setTripFilter(f); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                        {f === 'all' ? 'All' : f === 'completed' ? 'Past' : 'Upcoming'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Album grid */}
            <View style={s.albumGrid}>
              {filteredTrips.length === 0 ? (
                <View style={s.emptyCardDashed}>
                  <Text style={s.emptyCardText}>
                    {mutualTrips.length === 0
                      ? `No shared trips with ${firstName} yet.`
                      : 'No trips match this filter.'}
                  </Text>
                </View>
              ) : (
                filteredTrips.map(trip => (
                  <AlbumTripCard
                    key={trip.id}
                    trip={trip}
                    colors={colors}
                    onPress={() => router.push({ pathname: '/trip-recap', params: { tripId: trip.id } } as never)}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* Non-companion trips placeholder */}
        {!isCompanion && !isSelf && profile.profileVisibility !== 'public' && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Trips Together</Text>
            <View style={s.emptyCardDashed}>
              <Text style={s.emptyCardText}>
                Travel together to unlock shared trip memories.
              </Text>
            </View>
          </View>
        )}

        {/* ── Public Posts ── */}
        {myPosts.length > 0 && (
          <>
            <GroupHeader
              kicker={`${myPosts.length} posts`}
              title={isSelf ? 'My Posts' : `${firstName}'s Posts`}
              colors={colors as any}
            />
            <View style={{ paddingBottom: 8 }}>
              {myPosts.map((post) => (
                <PublicPostCard
                  key={post.id}
                  post={post}
                  colors={colors}
                  onPress={() => {
                    if (post.tripId) router.push({ pathname: '/trip-recap', params: { tripId: post.tripId } } as never);
                  }}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Shared Moments — 2-col grid ── */}
        {(isCompanion || isSelf) && (
          <>
            <GroupHeader
              kicker={sharedMoments.length > 0 ? `${sharedMoments.length} photos` : undefined}
              title="Shared moments"
              colors={colors as any}
              action={
                sharedMoments.length > 4 ? (
                  <Text style={s.link}>View all</Text>
                ) : undefined
              }
            />

            {privacy.showSharedMoments && sharedMoments.length > 0 ? (
              <MemoriesGrid moments={sharedMoments} />
            ) : (
              <View style={[s.emptyCard, { marginHorizontal: 16 }]}>
                <Text style={s.emptyCardText}>
                  {sharedMoments.length === 0
                    ? 'No shared moments yet.'
                    : 'Shared moments are private'}
                </Text>
              </View>
            )}
          </>
        )}

        {countries.length > 0 && canSeeStats && (
          <>
            <GroupHeader kicker={`${countries.length} countries`} title="Countries visited" colors={colors as any} />
            <CountriesVisited countries={countries} />
          </>
        )}

        {badges.length > 0 && canSeeStats && (
          <>
            <GroupHeader kicker="ACHIEVEMENTS" title="Travel badges" colors={colors as any} />
            <AchievementBadges badges={badges} />
          </>
        )}

        {profile.bio ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>About {isSelf ? 'You' : firstName}</Text>
            <View style={s.aboutCard}>
              <Text style={s.aboutText}>{profile.bio}</Text>
            </View>
          </View>
        ) : null}

        {/* Non-companion moments placeholder */}
        {!isCompanion && !isSelf && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Shared Moments</Text>
            <View style={s.emptyCardDashed}>
              <Text style={s.emptyCardText}>
                Moments stay private until you're{'\n'}both companions on a trip.
              </Text>
            </View>
          </View>
        )}

        {/* Socials / Connect */}
        {(isCompanion || isSelf) && privacy.showSocials && profile.socials && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Connect</Text>
            <View style={s.socialsList}>
              {profile.socials.instagram && (
                <SocialRow
                  icon={<Instagram size={20} color={colors.accent} strokeWidth={1.7} />}
                  handle={`@${profile.socials.instagram}`}
                  platform="Instagram"
                  colors={colors}
                  onPress={() => Linking.openURL(`https://instagram.com/${profile.socials!.instagram}`)}
                />
              )}
              {profile.socials.tiktok && (
                <SocialRow
                  icon={<Music2 size={20} color={colors.accent} strokeWidth={1.7} />}
                  handle={`@${profile.socials.tiktok}`}
                  platform="TikTok"
                  colors={colors}
                  onPress={() => Linking.openURL(`https://tiktok.com/@${profile.socials!.tiktok}`)}
                />
              )}
            </View>
          </View>
        )}

        <View style={{ height: 36 }} />
      </ScrollView>

      <ProfileCustomizeSheet
        visible={customizeVisible}
        profile={ownProfile}
        onClose={() => setCustomizeVisible(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

// ── Album Trip Card (matches SummaryTab style) ──

function AlbumTripCard({ trip, colors, onPress }: { trip: Trip; colors: any; onPress: () => void }) {
  const s = getStyles(colors);
  const isCompleted = trip.status === 'Completed';
  const isUpcoming = trip.status === 'Planning';

  const nights = (() => {
    try {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
    } catch { return 0; }
  })();

  return (
    <TouchableOpacity style={s.albumCard} onPress={onPress} activeOpacity={0.8}>
      {trip.id ? (
        <TripCollage tripId={trip.id} width={CARD_W} height={CARD_H} animated={false} />
      ) : (
        <View style={[s.albumCover, s.albumCoverFallback]}>
          <Text style={{ fontSize: 40 }}>✈️</Text>
        </View>
      )}
      <View style={s.albumGradient} />

      {/* Status badge */}
      {isCompleted && (
        <View style={s.albumBadge}>
          <Text style={s.albumBadgeText}>Completed</Text>
        </View>
      )}
      {isUpcoming && (
        <View style={[s.albumBadge, { backgroundColor: 'rgba(216,171,122,0.5)' }]}>
          <Text style={s.albumBadgeText}>Upcoming</Text>
        </View>
      )}

      {/* Bottom info */}
      <View style={s.albumInfo}>
        <Text style={s.albumDest} numberOfLines={1}>
          {trip.destination ?? trip.name}
        </Text>
        <Text style={s.albumDates} numberOfLines={1}>
          {formatDatePHT(trip.startDate)} – {formatDatePHT(trip.endDate)}
        </Text>
        {nights > 0 && (
          <View style={s.albumMetaRow}>
            <Moon size={10} color="rgba(255,255,255,0.7)" />
            <Text style={s.albumMetaText}>{nights}n</Text>
            {trip.totalSpent ? (
              <>
                <Text style={s.albumMetaText}> · </Text>
                <Text style={s.albumMetaText}>₱{Math.round(trip.totalSpent).toLocaleString()}</Text>
              </>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function PublicPostCard({ post, colors, onPress }: { post: FeedPost; colors: any; onPress: () => void }) {
  const s = getStyles(colors);
  const imageUrl = post.media?.[0]?.mediaUrl ?? post.photoUrl;

  return (
    <TouchableOpacity style={s.postCard} onPress={onPress} activeOpacity={0.82} disabled={!post.tripId}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={s.postImage} /> : null}
      <View style={s.postBody}>
        {post.locationName ? (
          <View style={s.postLocationRow}>
            <MapPin size={13} color={colors.accent} />
            <Text style={s.postLocation} numberOfLines={1}>{post.locationName}</Text>
          </View>
        ) : null}
        {post.caption ? <Text style={s.postCaption} numberOfLines={3}>{post.caption}</Text> : null}
        <Text style={s.postMeta}>
          {post.likesCount} likes · {post.commentsCount} comments
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SocialRow({ icon, handle, platform, colors, onPress }: {
  icon: React.ReactNode; handle: string; platform: string; colors: any; onPress: () => void;
}) {
  const s = getStyles(colors);
  return (
    <TouchableOpacity style={s.socialRow} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={s.socialHandle}>{handle}</Text>
        <Text style={s.socialPlatform}>{platform}</Text>
      </View>
      <ChevronRight size={16} color={colors.text3} />
    </TouchableOpacity>
  );
}

// ── Styles ──

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.canvas,
    },
    topbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(31,27,23,0.7)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scroll: {
      paddingBottom: 24,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.7,
      textTransform: 'uppercase',
      color: colors.text3,
      marginBottom: 10,
    },
    link: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.accent,
    },
    emptyText: {
      color: colors.text3,
      fontSize: 14,
    },

    // Active story
    storyStrip: {
      paddingHorizontal: 16,
      paddingTop: 14,
    },
    storyBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
    },
    storyRing: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 3,
    },
    storyThumb: {
      width: '100%',
      height: '100%',
      borderRadius: 25,
    },
    storyTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    storySub: {
      fontSize: 11.5,
      color: colors.text3,
      marginTop: 2,
    },

    // Crossed Paths
    crossedCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    crossedIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentBg,
      borderWidth: 1,
      borderColor: colors.accentBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crossedTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      letterSpacing: -0.2,
    },
    crossedSub: {
      fontSize: 11.5,
      color: colors.text3,
      marginTop: 2,
    },

    // Placeholder grid (behind gated veil)
    placeholderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    placeholderCell: {
      width: '33.333%',
      paddingVertical: 16,
      alignItems: 'center',
      gap: 6,
    },
    placeholderBar: {
      backgroundColor: colors.border,
      borderRadius: 4,
    },

    // Empty cards
    emptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
    },
    emptyCardDashed: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border2,
      borderRadius: 14,
      padding: 20,
      alignItems: 'center',
      marginHorizontal: 16,
    },
    emptyCardText: {
      color: colors.text3,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
    aboutCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
    },
    aboutText: {
      color: colors.text2,
      fontSize: 14,
      lineHeight: 21,
    },

    // ── Filter chips (matching SummaryTab) ──
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 8,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      borderColor: colors.text,
      backgroundColor: colors.text,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    filterChipTextActive: {
      color: colors.bg,
    },

    // ── Album grid (matching SummaryTab) ──
    albumGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: 12,
      paddingBottom: 8,
    },
    albumCard: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    albumCover: {
      width: '100%',
      height: '100%',
    },
    albumCoverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.elevated,
    },
    albumGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '55%',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    albumBadge: {
      position: 'absolute',
      top: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    albumBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#fff',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    albumInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 12,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    albumDest: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: -0.2,
    },
    albumDates: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 2,
    },
    albumMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 4,
    },
    albumMetaText: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
      fontWeight: '600',
    },

    // ── Moments grid (2-col, bigger) ──
    momentsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      gap: 8,
    },
    photoCell: {
      width: (SCREEN_W - 40) / 3,
      aspectRatio: 1,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },

    // Public posts
    postCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postImage: {
      width: '100%',
      height: 220,
      backgroundColor: colors.elevated,
    },
    postBody: {
      padding: 14,
      gap: 8,
    },
    postLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    postLocation: {
      flex: 1,
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
    },
    postCaption: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    postMeta: {
      color: colors.text3,
      fontSize: 12,
      fontWeight: '600',
    },

    // Social rows
    socialsList: {
      gap: 8,
    },
    socialRow: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    socialHandle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    socialPlatform: {
      fontSize: 11,
      color: colors.text3,
      marginTop: 1,
    },
  });
