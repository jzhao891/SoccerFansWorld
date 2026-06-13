import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useMapStore, useMergedPlaces } from '@sfw/shared';
import type { LiveStatus } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

const DRAWER_HEIGHT = Dimensions.get('window').height * 0.75;

const CROWD_OPTIONS: LiveStatus['crowd_index'][] = ['Chill', 'Buzzing', 'Packed', 'Wild'];

const CROWD_EMOJI: Record<string, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
  Wild: '🦁',
};

interface Props {
  onCreateParty: (location: { lat: number; lng: number }, source: 'google' | 'osm' | 'custom', venue_id: string | null) => void;
}

export default function VenueDrawer({ onCreateParty }: Props) {
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const liveStatuses = useMapStore((s) => s.liveStatuses);
  const mergedPlaces = useMergedPlaces();
  const [saving, setSaving] = useState(false);

  const osmVenue = selectedOsmVenue;
  const place = osmVenue ? null : (mergedPlaces.find((p) => p.id === selectedPlaceId) ?? null);
  const venueId = place?.fanZone?.id ?? null;
  const liveStatus = venueId ? liveStatuses[venueId] ?? null : null;

  const isOpen = osmVenue !== null || place !== null;

  function dismiss() {
    setSelectedPlaceId(null);
    setSelectedOsmVenue(null);
  }

  const translateY = useRef(new Animated.Value(DRAWER_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOpen ? 0 : DRAWER_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [isOpen, translateY]);

  async function checkIn(patch: Partial<Pick<LiveStatus, 'crowd_index' | 'sound'>>) {
    if (!venueId) return;
    setSaving(true);
    await setDoc(
      doc(db, 'live_statuses', venueId),
      { venue_id: venueId, ...liveStatus, ...patch, updated_at: Date.now() },
      { merge: true },
    );
    setSaving(false);
  }

  return (
    <>
      {isOpen && (
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={[StyleSheet.absoluteFillObject, { bottom: DRAWER_HEIGHT }]} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View style={[styles.drawer, { transform: [{ translateY }] }]}>
        {/* OSM venue */}
        {osmVenue && (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.handleArea} onPress={dismiss} activeOpacity={1}>
              <View style={styles.handle} />
            </TouchableOpacity>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.placeName}>{osmVenue.name}</Text>
                <Text style={[styles.vicinity, { textTransform: 'capitalize' }]}>{osmVenue.category}</Text>
              </View>
              <TouchableOpacity onPress={dismiss} hitSlop={12}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Pressable
              style={({ pressed }) => [styles.hostBtn, pressed && styles.hostBtnPressed]}
              onPress={() => { onCreateParty(osmVenue.location, 'osm', osmVenue.id); dismiss(); }}
            >
              <Text style={styles.hostBtnText}>🎉  Host watch party here</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Google / FanZone venue */}
        {place && (
          <>
            <Pressable
              style={({ pressed }) => [styles.hostBtn, pressed && styles.hostBtnPressed]}
              onPress={() => {
                const src = place.source === 'google' ? 'google' : (place.fanZone?.source ?? 'custom');
                const vid = place.source === 'google' ? place.id : (place.fanZone?.venue_id ?? null);
                onCreateParty(place.location, src, vid);
              }}
            >
              <Text style={styles.hostBtnText}>🎉  Host watch party here</Text>
            </Pressable>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.handleArea} onPress={dismiss} activeOpacity={1}>
                <View style={styles.handle} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerText}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  {place.googleData?.vicinity && (
                    <Text style={styles.vicinity}>{place.googleData.vicinity}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={dismiss} hitSlop={12}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Meta row */}
              <View style={styles.metaRow}>
                {place.googleData?.rating != null && (
                  <Text style={styles.metaText}>⭐ {place.googleData.rating}</Text>
                )}
                {place.googleData?.open_now != null && (
                  <Text style={[styles.metaText, place.googleData.open_now ? styles.openText : styles.closedText]}>
                    {place.googleData.open_now ? 'Open now' : 'Closed'}
                  </Text>
                )}
                <View style={[
                  styles.sourceBadge,
                  place.source === 'fanzone' ? styles.sourceMerged : styles.sourceGoogle,
                ]}>
                  <Text style={[
                    styles.sourceBadgeText,
                    place.source === 'fanzone' ? styles.sourceMergedText : styles.sourceGoogleText,
                  ]}>{place.source === 'fanzone' ? (place.fanZone?.source ?? 'fanzone') : 'google'}</Text>
                </View>
              </View>

              {/* Fan zone */}
              {place.fanZone && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>📺 {place.fanZone.event_title}</Text>
                  {place.fanZone.kickoff_time > 0 && (
                    <Text style={styles.subText}>
                      🕐 {new Date(place.fanZone.kickoff_time).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </Text>
                  )}
                  {place.fanZone.description && (
                    <Text style={[styles.subText, styles.italic]}>{place.fanZone.description}</Text>
                  )}
                  {place.fanZone.watching_teams.length > 0 && (
                    <View style={styles.tagRow}>
                      {place.fanZone.watching_teams.map((team) => (
                        <View key={team} style={styles.tag}>
                          <Text style={styles.tagText}>{team}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {place.fanZone.amenities.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.labelText}>Amenities</Text>
                      <View style={styles.tagRow}>
                        {place.fanZone.amenities.map((a) => (
                          <View key={a} style={styles.tag}>
                            <Text style={styles.tagText}>{a.replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Live status */}
              {liveStatus && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.liveRow}>
                    {liveStatus.crowd_index && (
                      <View>
                        <Text style={styles.labelText}>Crowd</Text>
                        <Text style={styles.liveValue}>{CROWD_EMOJI[liveStatus.crowd_index]} {liveStatus.crowd_index}</Text>
                      </View>
                    )}
                    {liveStatus.sound && (
                      <View>
                        <Text style={styles.labelText}>Sound</Text>
                        <Text style={styles.liveValue}>{liveStatus.sound === 'On' ? '🔊 On' : '🔇 Off'}</Text>
                      </View>
                    )}
                    {liveStatus.fan_ratio && (
                      <View>
                        <Text style={styles.labelText}>Fan ratio</Text>
                        <Text style={styles.liveValue}>{liveStatus.fan_ratio}</Text>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Check-in */}
              {venueId && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.checkinHeader}>
                    <Text style={styles.checkinLabel}>CHECK IN</Text>
                    {saving && <ActivityIndicator size="small" color="#9CA3AF" style={{ marginLeft: 8 }} />}
                  </View>

                  <Text style={styles.labelText}>How's the crowd?</Text>
                  <View style={styles.crowdRow}>
                    {CROWD_OPTIONS.map((option) => {
                      const selected = liveStatus?.crowd_index === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                          onPress={() => checkIn({ crowd_index: option })}
                          disabled={saving}
                        >
                          <Text style={[styles.optionBtnText, selected && styles.optionBtnTextSelected]}>
                            {CROWD_EMOJI[option!]}{'\n'}{option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[styles.labelText, { marginTop: 14 }]}>Sound on?</Text>
                  <View style={styles.soundRow}>
                    {(['On', 'Off'] as const).map((option) => {
                      const selected = liveStatus?.sound === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                          onPress={() => checkIn({ sound: option })}
                          disabled={saving}
                        >
                          <Text style={[styles.optionBtnText, selected && styles.optionBtnTextSelected]}>
                            {option === 'On' ? '🔊 On' : '🔇 Off'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    zIndex: 20,
    ...shadow.lg,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 40 },
  handleArea: { alignItems: 'center', paddingVertical: spacing.md },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  headerText: { flex: 1, marginRight: spacing.md },
  placeName: { fontSize: 20, fontWeight: '700', color: colors.black },
  vicinity: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  closeBtn: { fontSize: 18, color: colors.textFaint },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  metaText: { fontSize: 13, color: '#4B5563' },
  openText: { color: colors.open },
  closedText: { color: colors.closed },
  sourceBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  sourceBadgeText: { fontSize: 11, fontWeight: '600' },
  sourceMerged: { backgroundColor: colors.mergedBg },
  sourceMergedText: { color: colors.mergedText },
  sourceGoogle: { backgroundColor: colors.googleBg },
  sourceGoogleText: { color: colors.googleText },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  subText: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  italic: { fontStyle: 'italic', marginTop: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: spacing.xs, backgroundColor: colors.borderLight, borderRadius: radius.full },
  tagText: { fontSize: 12, color: '#4B5563' },
  labelText: { fontSize: 12, color: colors.textFaint, marginBottom: spacing.xs },
  liveRow: { flexDirection: 'row', gap: spacing.xxl },
  liveValue: { fontSize: 14, fontWeight: '500', color: colors.black, marginTop: 2 },
  checkinHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  checkinLabel: { fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1 },
  crowdRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  soundRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  optionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center',
  },
  optionBtnSelected: { backgroundColor: colors.black, borderColor: colors.black },
  optionBtnText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },
  optionBtnTextSelected: { color: colors.white },
  hostBtn: {
    backgroundColor: colors.black,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  hostBtnPressed: { opacity: 0.75 },
  hostBtnText: { fontSize: 14, fontWeight: '600', color: colors.white },
});
