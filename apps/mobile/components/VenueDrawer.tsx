import { useRef, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { useMapStore, useMergedPlaces } from '@sfw/shared';
import type { FanZone, LiveStatus } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

// A FanZone is a watch party iff it carries watching_teams (real teams or ["TBD"]).
// Without that field it's a general fan event — Fan Zone only.
function isWatchParty(fz: FanZone): boolean {
  return Array.isArray(fz.watching_teams) && fz.watching_teams.length > 0;
}

function isTeamsTBD(fz: FanZone): boolean {
  return isWatchParty(fz) && fz.watching_teams!.every((t) => t === 'TBD');
}

function formatStart(ms?: number): string {
  if (!ms) return 'Time TBD';
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Check-in is only meaningful for an event happening today.
function isToday(ms?: number): boolean {
  if (!ms) return false;
  const d = new Date(ms);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

const DRAWER_HEIGHT = Dimensions.get('window').height * 0.75;

const CROWD_OPTIONS: LiveStatus['crowd_index'][] = ['Chill', 'Buzzing', 'Packed', 'Wild'];

const CROWD_EMOJI: Record<string, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
  Wild: '🦁',
};

interface Props {
  onCreateParty: (location: { lat: number; lng: number }, source: 'google' | 'osm' | 'custom', venue_id: string | null, address?: string) => void;
}

export default function VenueDrawer({ onCreateParty }: Props) {
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const liveStatuses = useMapStore((s) => s.liveStatuses);
  const mergedPlaces = useMergedPlaces();

  const osmVenue = selectedOsmVenue;
  const place = osmVenue ? null : (mergedPlaces.find((p) => p.id === selectedPlaceId) ?? null);
  const events = place?.fanZones ?? [];
  const rep = events[0] ?? null;
  // Live status is keyed per physical venue: venue_id when present, else the lone event's id.
  const venueId = rep ? (rep.venue_id ?? rep.id) : null;
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
              <Text style={styles.hostBtnText}>Create fan zone here</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Google / FanZone venue */}
        {place && (
          <>
            <Pressable
              style={({ pressed }) => [styles.hostBtn, pressed && styles.hostBtnPressed]}
              onPress={() => {
                const src = place.source === 'google' ? 'google' : (rep?.source ?? 'custom');
                const vid = place.source === 'google' ? place.id : (rep?.venue_id ?? null);
                // Google place + existing fan zone already carry an address — reuse it (no geocode).
                const addr = place.source === 'google' ? place.googleData?.vicinity : rep?.address;
                onCreateParty(place.location, src, vid, addr);
              }}
            >
              <Text style={styles.hostBtnText}>Create fan zone here</Text>
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
                  {(rep?.address || place.googleData?.vicinity) && (
                    <Text style={styles.vicinity}>{rep?.address ?? place.googleData?.vicinity}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={dismiss} hitSlop={12}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Meta row */}
              {place.googleData && (place.googleData.rating != null || place.googleData.open_now != null) && (
                <View style={styles.metaRow}>
                  {place.googleData.rating != null && (
                    <Text style={styles.metaText}>⭐ {place.googleData.rating}</Text>
                  )}
                  {place.googleData.open_now != null && (
                    <Text style={[styles.metaText, place.googleData.open_now ? styles.openText : styles.closedText]}>
                      {place.googleData.open_now ? 'Open now' : 'Closed'}
                    </Text>
                  )}
                </View>
              )}

              {/* Events list — sorted by date then name in useMergedPlaces */}
              {events.map((fz) => {
                const watchParty = isWatchParty(fz);
                const today = isToday(fz.start_time);
                return (
                  <View key={fz.id} style={styles.eventBlock}>
                    {/* Title */}
                    <Text style={styles.eventTitle}>{fz.event_title}</Text>

                    {/* Date & time */}
                    <Text style={styles.subText}>{formatStart(fz.start_time)}</Text>

                    {/* Tags */}
                    <View style={styles.tagRow}>
                      <View style={[styles.pill, styles.fanZonePill]}>
                        <Text style={[styles.pillText, styles.fanZonePillText]}>Fan Zone</Text>
                      </View>
                      {watchParty && (
                        <View style={[styles.pill, styles.watchPartyPill]}>
                          <Text style={[styles.pillText, styles.watchPartyPillText]}>Watch Party</Text>
                        </View>
                      )}
                      {fz.admission && (
                        <View style={[styles.pill, fz.admission === 'free' ? styles.freePill : styles.paidPill]}>
                          <Text style={[styles.pillText, fz.admission === 'free' ? styles.freePillText : styles.paidPillText]}>
                            {fz.admission === 'free' ? 'Free' : 'Paid'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {fz.description && (
                      <Text style={[styles.subText, styles.italic]}>{fz.description}</Text>
                    )}

                    {/* Teams */}
                    {watchParty && (
                      <View style={styles.tagRow}>
                        {isTeamsTBD(fz) ? (
                          <View style={styles.tag}><Text style={styles.tagText}>Match TBD</Text></View>
                        ) : (
                          fz.watching_teams!.map((team) => (
                            <View key={team} style={styles.tag}>
                              <Text style={styles.tagText}>{team}</Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    {/* Amenities */}
                    {fz.amenities.length > 0 && (
                      <View style={styles.tagRow}>
                        {fz.amenities.map((a) => (
                          <View key={a} style={styles.tagFaint}>
                            <Text style={styles.tagFaintText}>{a.replace(/_/g, ' ')}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Event page */}
                    {fz.url && (
                      <TouchableOpacity onPress={() => Linking.openURL(fz.url!)} hitSlop={8}>
                        <Text style={styles.urlLink}>Event page</Text>
                      </TouchableOpacity>
                    )}

                    {/* Check-in — only for events today, disabled until auth (sign in required) */}
                    {today && (
                      <View style={styles.checkinBlock} pointerEvents="none">
                        <Text style={styles.checkinLabelDisabled}>CHECK IN (sign in required)</Text>
                        <Text style={styles.labelTextDisabled}>How&apos;s the crowd?</Text>
                        <View style={styles.crowdRow}>
                          {CROWD_OPTIONS.map((option) => (
                            <View key={option} style={[styles.optionBtn, styles.optionBtnDisabled]}>
                              <Text style={[styles.optionBtnText, styles.optionBtnTextDisabled]}>
                                {CROWD_EMOJI[option!]}{'\n'}{option}
                              </Text>
                            </View>
                          ))}
                        </View>
                        <Text style={[styles.labelTextDisabled, { marginTop: 12 }]}>Screen sound on?</Text>
                        <View style={styles.soundRow}>
                          {(['On', 'Off'] as const).map((option) => (
                            <View key={option} style={[styles.optionBtn, styles.optionBtnDisabled]}>
                              <Text style={[styles.optionBtnText, styles.optionBtnTextDisabled]}>
                                {option === 'On' ? '🔊 On' : '🔇 Off'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Empty state */}
              {place.source === 'fanzone' && events.length === 0 && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.emptyText}>No upcoming events.</Text>
                </>
              )}

              {/* Live status (read-only) */}
              {liveStatus && (liveStatus.crowd_index || liveStatus.sound || liveStatus.fan_ratio) && (
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
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 14 },
  subText: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  italic: { fontStyle: 'italic', marginTop: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: spacing.xs, backgroundColor: colors.borderLight, borderRadius: radius.full },
  tagText: { fontSize: 12, color: '#4B5563' },
  tagFaint: { paddingHorizontal: 10, paddingVertical: spacing.xs, backgroundColor: '#F9FAFB', borderRadius: radius.full },
  tagFaintText: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },
  eventBlock: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingVertical: 12 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: colors.black },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  pillText: { fontSize: 11, fontWeight: '600' },
  fanZonePill: { backgroundColor: '#FFEDD5' },
  fanZonePillText: { color: '#C2410C' },
  watchPartyPill: { backgroundColor: '#F3E8FF' },
  watchPartyPillText: { color: '#7E22CE' },
  freePill: { backgroundColor: '#DCFCE7' },
  freePillText: { color: '#15803D' },
  paidPill: { backgroundColor: colors.borderLight },
  paidPillText: { color: colors.textMuted },
  urlLink: { fontSize: 12, fontWeight: '600', color: '#2563EB', marginTop: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  labelText: { fontSize: 12, color: colors.textFaint, marginBottom: spacing.xs },
  liveRow: { flexDirection: 'row', gap: spacing.xxl },
  liveValue: { fontSize: 14, fontWeight: '500', color: colors.black, marginTop: 2 },
  checkinBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, opacity: 0.5 },
  checkinLabelDisabled: { fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 1, marginBottom: spacing.sm },
  labelTextDisabled: { fontSize: 12, color: colors.textFaint, marginBottom: spacing.xs },
  crowdRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  soundRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  optionBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center',
  },
  optionBtnDisabled: { backgroundColor: colors.white },
  optionBtnText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },
  optionBtnTextDisabled: { color: colors.textFaint },
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
