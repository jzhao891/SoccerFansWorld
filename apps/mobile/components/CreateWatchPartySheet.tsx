import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { collection, doc, setDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '../lib/firebase';
import { useMapStore, WORLD_CUP_2026_TEAMS } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.88;

// "TBD" first so it leads the list and is the default for knockout/unknown matches.
const TEAM_OPTIONS = ['TBD', ...WORLD_CUP_2026_TEAMS];

function defaultKickoff() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function coordString(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// Reverse geocode lat/lng -> address via Google Geocoding API (direct call, mirrors
// how mobile already calls Places). Falls back to a coord string on any failure.
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) return coordString(lat, lng);
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
    const data = await res.json() as { status: string; results?: { formatted_address: string }[] };
    if (data.status !== 'OK' || !data.results?.length) return coordString(lat, lng);
    return data.results[0].formatted_address;
  } catch {
    return coordString(lat, lng);
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  defaultLocation?: { lat: number; lng: number };
  defaultSource?: 'google' | 'osm' | 'custom';
  defaultVenueId?: string | null;
  defaultAddress?: string; // already-known address (google / existing fan zone); osm & custom geocode
}

export default function CreateWatchPartySheet({ visible, onClose, defaultLocation, defaultSource, defaultVenueId, defaultAddress }: Props) {
  const bounds = useMapStore((s) => s.bounds);
  const viewState = useMapStore((s) => s.viewState);

  const mapCenter = defaultLocation ?? (bounds
    ? { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
    : { lat: viewState.latitude, lng: viewState.longitude });

  const [venueName, setVenueName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoff, setKickoff] = useState<Date>(defaultKickoff);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isWatchParty, setIsWatchParty] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['TBD']);
  const [admission, setAdmission] = useState<'free' | 'paid'>('free');
  const [organizers, setOrganizers] = useState('');
  const [url, setUrl] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
    if (!visible) {
      setShowDatePicker(false);
      setShowTimePicker(false);
      setShowEndDatePicker(false);
      setShowEndTimePicker(false);
    }
  }, [visible, translateY]);

  const meetingPoint = gpsLocation ?? mapCenter;
  const canSubmit = Boolean(
    venueName.trim() && eventTitle.trim() && (!isWatchParty || selectedTeams.length > 0),
  );

  // Resolve a human-readable address for the meeting point. Google places and existing
  // fan zones already have one (defaultAddress); osm/custom + any GPS override are geocoded.
  useEffect(() => {
    if (!visible) return;
    const { lat, lng } = meetingPoint;

    if (defaultAddress && !gpsLocation) {
      setAddress(defaultAddress);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);
    const timer = setTimeout(async () => {
      const addr = await reverseGeocode(lat, lng);
      if (!cancelled) {
        setAddress(addr);
        setAddressLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, defaultAddress, gpsLocation, meetingPoint.lat, meetingPoint.lng]);

  function toggleTeam(team: string) {
    setSelectedTeams((prev) => {
      if (prev.includes(team)) return prev.filter((t) => t !== team);
      if (prev.length >= 2) return prev; // a match has at most two teams
      return [...prev, team];
    });
  }

  async function useGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setGpsLoading(false);
    }
  }

  function handleDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) {
      const next = new Date(kickoff);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setKickoff(next);
    }
  }

  function handleTimeChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      const next = new Date(kickoff);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setKickoff(next);
    }
  }

  function handleEndDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (selected) {
      const next = new Date(endTime ?? kickoff);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEndTime(next);
    }
  }

  function handleEndTimeChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowEndTimePicker(false);
    if (selected) {
      const next = new Date(endTime ?? kickoff);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setEndTime(next);
    }
  }

  function resetAndClose() {
    setVenueName('');
    setEventTitle('');
    setDescription('');
    setKickoff(defaultKickoff());
    setEndTime(null);
    setIsWatchParty(true);
    setSelectedTeams(['TBD']);
    setAdmission('free');
    setOrganizers('');
    setUrl('');
    setGpsLocation(null);
    setAddress(null);
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const organizerList = organizers.split(',').map((o) => o.trim()).filter(Boolean);
      const ref = doc(collection(db, 'venues'));
      await setDoc(ref, {
        source: defaultSource ?? 'custom',
        venue_id: defaultVenueId ?? null,
        name: venueName.trim(),
        event_title: eventTitle.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        location: meetingPoint,
        address: address ?? coordString(meetingPoint.lat, meetingPoint.lng),
        geohash: geohashForLocation([meetingPoint.lat, meetingPoint.lng]),
        start_time: kickoff.getTime(),
        ...(endTime ? { end_time: endTime.getTime() } : {}),
        // watching_teams present => watch party; omitted => Fan Zone only
        ...(isWatchParty ? { watching_teams: selectedTeams } : {}),
        admission,
        amenities: [],
        ...(organizerList.length ? { organizers: organizerList } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        activity_status: 'INACTIVE', // created hidden; the activation sweep validates + activates it (see BACKLOGS.md)
        created_by: '',
        created_at: Date.now(),
      });
      resetAndClose();
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={resetAndClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <TouchableOpacity onPress={resetAndClose} style={styles.handleRow}>
          <View style={styles.handle} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Create a fan zone</Text>
          <TouchableOpacity onPress={resetAndClose} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Venue name */}
          <Text style={styles.label}>Venue name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. World Cup 2026 Celebration Festival"
            placeholderTextColor={colors.textFaint}
            value={venueName}
            onChangeText={setVenueName}
            returnKeyType="next"
          />

          {/* Event title */}
          <Text style={styles.label}>Event title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. USA vs England — Group Stage"
            placeholderTextColor={colors.textFaint}
            value={eventTitle}
            onChangeText={setEventTitle}
            returnKeyType="next"
          />

          {/* Event description */}
          <Text style={styles.label}>Event description <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Meet here first, then we'll head somewhere together"
            placeholderTextColor={colors.textFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Start */}
          <Text style={styles.label}>Start <Text style={styles.required}>*</Text></Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}>
              <Text style={styles.dateBtnText}>
                {kickoff.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}>
              <Text style={styles.dateBtnText}>
                {kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={kickoff}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={kickoff}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          {/* End (optional) */}
          <Text style={styles.label}>End <Text style={styles.optional}>(optional)</Text></Text>
          {endTime ? (
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowEndDatePicker(true); setShowEndTimePicker(false); }}>
                <Text style={styles.dateBtnText}>
                  {endTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowEndTimePicker(true); setShowEndDatePicker(false); }}>
                <Text style={styles.dateBtnText}>
                  {endTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearBtn} onPress={() => { setEndTime(null); setShowEndDatePicker(false); setShowEndTimePicker(false); }} hitSlop={8}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setEndTime(new Date(kickoff.getTime() + 2 * 60 * 60 * 1000))}
            >
              <Text style={styles.addBtnText}>Add end time</Text>
            </TouchableOpacity>
          )}

          {showEndDatePicker && (
            <DateTimePicker
              value={endTime ?? kickoff}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={kickoff}
              onChange={handleEndDateChange}
            />
          )}
          {showEndTimePicker && (
            <DateTimePicker
              value={endTime ?? kickoff}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndTimeChange}
            />
          )}

          {/* Meeting point */}
          <Text style={styles.label}>Meeting point</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationText} numberOfLines={2}>
              {addressLoading
                ? 'Finding address…'
                : address
                  ? `📍 ${address}`
                  : `${meetingPoint.lat.toFixed(4)}, ${meetingPoint.lng.toFixed(4)}`}
            </Text>
            <TouchableOpacity style={styles.gpsBtn} onPress={useGPS} disabled={gpsLoading}>
              {gpsLoading
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : <Text style={styles.gpsBtnText}>Use GPS</Text>}
            </TouchableOpacity>
          </View>

          {/* Watch party toggle */}
          <View style={styles.toggleRow}>
            <Text style={[styles.label, styles.toggleLabel]}>Watch party?</Text>
            <Switch
              value={isWatchParty}
              onValueChange={setIsWatchParty}
              trackColor={{ false: colors.border, true: colors.black }}
              thumbColor={colors.white}
            />
          </View>

          {/* Teams — only when this is a watch party */}
          {isWatchParty && (
            <>
              <Text style={styles.label}>
                Teams <Text style={styles.optional}>(pick up to 2)</Text>
                {selectedTeams.length > 0 ? ` — ${selectedTeams.length}` : ''}
              </Text>
              <View style={styles.teamGrid}>
                {TEAM_OPTIONS.map((team) => {
                  const active = selectedTeams.includes(team);
                  return (
                    <TouchableOpacity
                      key={team}
                      style={[styles.teamPill, active && styles.teamPillActive]}
                      onPress={() => toggleTeam(team)}
                    >
                      <Text style={[styles.teamPillText, active && styles.teamPillTextActive]}>
                        {team}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Admission */}
          <Text style={styles.label}>Admission <Text style={styles.required}>*</Text></Text>
          <View style={styles.admissionRow}>
            {(['free', 'paid'] as const).map((opt) => {
              const active = admission === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.admissionBtn, active && styles.admissionBtnActive]}
                  onPress={() => setAdmission(opt)}
                >
                  <Text style={[styles.admissionBtnText, active && styles.admissionBtnTextActive]}>
                    {opt === 'free' ? 'Free' : 'Paid'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Organizers */}
          <Text style={styles.label}>Organizers <Text style={styles.optional}>(optional, comma-separated)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Local Supporters Club, Pub Co"
            placeholderTextColor={colors.textFaint}
            value={organizers}
            onChangeText={setOrganizers}
            returnKeyType="next"
          />

          {/* URL */}
          <Text style={styles.label}>Event page URL <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="https://…"
            placeholderTextColor={colors.textFaint}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            returnKeyType="done"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || saving) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.submitText}>Create fan zone</Text>}
          </TouchableOpacity>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    zIndex: 50,
    ...shadow.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.black },
  closeBtn: { fontSize: 18, color: colors.textFaint },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  required: { color: '#F87171' },
  optional: { fontWeight: '400', textTransform: 'none', color: colors.textFaint },
  input: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, paddingTop: 10 },
  dateRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  dateBtn: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateBtnText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { fontSize: 14, color: colors.textFaint },
  addBtn: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  locationText: { flex: 1, fontSize: 13, color: colors.textMuted },
  gpsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minWidth: 72,
    alignItems: 'center',
  },
  gpsBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  toggleLabel: { marginTop: 0, marginBottom: 0 },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  teamPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  teamPillActive: { backgroundColor: colors.black, borderColor: colors.black },
  teamPillText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  teamPillTextActive: { color: colors.white },
  admissionRow: { flexDirection: 'row', gap: spacing.sm },
  admissionBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  admissionBtnActive: { backgroundColor: colors.black, borderColor: colors.black },
  admissionBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  admissionBtnTextActive: { color: colors.white },
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.border },
  submitText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
